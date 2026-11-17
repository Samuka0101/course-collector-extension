const JOB_KEY = "assaadCollectionJob";
const PLATFORM_ORIGIN = "https://app.plataformaassaad.com.br";
const forbidden = /logout|log-out|signout|sair|delete|excluir|remove|cancel|pagamento|payment|checkout|billing|assinatura|perfil/i;
const noisy = /\/feed(?:\/|\?|$)|noticias|notifications|comunidade/i;
let running = false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (raw, origin) => { try { const u = new URL(raw); if (u.origin !== origin || forbidden.test(u.href) || noisy.test(u.href)) return null; u.hash = ""; ["page","pagina","offset","cursor","sort"].forEach((x)=>u.searchParams.delete(x)); return u.href; } catch { return null; } };
const rank = (url) => /assistir|aula|modulo|curso/.test(url) ? 1 : /banco-de-questoes|listas/.test(url) ? 2 : /simulados|materiais|ferramentas|mentorias/.test(url) ? 3 : 9;
const allowedForScope = (url, scope) => {
  if (scope === "all" || scope === "current") return true;
  const rules = { courses:/conteudos\/(?:ciclos|cursos|vestibulares)|assistir|aula|modulo/, questions:/banco-de-questoes/, simulations:/simulados/, materials:/materiais/, tools:/ferramentas|mentorias/ };
  return rules[scope]?.test(url) ?? true;
};
const seedsFor = (origin, scope, current) => {
  const routes = { courses:["/conteudos/ciclos","/conteudos/cursos","/conteudos/vestibulares"], questions:["/banco-de-questoes","/banco-de-questoes/explorar"], simulations:["/simulados"], materials:["/materiais"], tools:["/ferramentas","/conteudos/mentorias"] };
  if (scope === "current") return [current];
  if (scope === "all") return Object.values(routes).flat().map((x)=>origin+x);
  return (routes[scope] || [current]).map((x)=>origin+x);
};
const save = (job) => chrome.storage.local.set({ [JOB_KEY]: job });
async function waitLoaded(tabId, timeout = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try { if ((await chrome.tabs.get(tabId)).status === "complete") return; } catch { throw new Error("Aba temporária foi fechada."); }
    await sleep(300);
  }
}
async function run() {
  if (running) return;
  running = true;
  let { [JOB_KEY]: job } = await chrome.storage.local.get(JOB_KEY);
  if (job?.origin !== PLATFORM_ORIGIN) {
    running = false;
    return;
  }
  while (job?.status === "running" && job.queue.length && job.pages.length < job.limit) {
    const url = job.queue.shift();
    if (job.visited.includes(url)) continue;
    job.visited.push(url); job.currentUrl = url; await save(job);
    let tab;
    try {
      tab = await chrome.tabs.create({ url, active: false });
      await waitLoaded(tab.id); await sleep(1200);
      const renderedTab = await chrome.tabs.get(tab.id);
      if (!renderedTab.url?.startsWith(`${PLATFORM_ORIGIN}/`)) {
        throw new Error("A página redirecionou para fora da Plataforma Assaad.");
      }
      let page;
      try { page = await chrome.tabs.sendMessage(tab.id, { type: "COLLECT_RENDERED_PAGE" }); }
      catch { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["collector.js"] }); page = await chrome.tabs.sendMessage(tab.id, { type: "COLLECT_RENDERED_PAGE" }); }
      if (!page.error) {
        job.pages.push(page);
        for (const raw of page.links || []) { const link = normalize(raw, job.origin); if (link && allowedForScope(link, job.scope) && !job.visited.includes(link) && !job.queue.includes(link)) job.queue.push(link); }
        job.queue.sort((a,b)=>rank(a)-rank(b));
      } else job.errors.push(page);
    } catch (error) { job.errors.push({ url, error: String(error.message || error) }); }
    finally { if (tab?.id) await chrome.tabs.remove(tab.id).catch(() => {}); }
    await save(job);
  }
  if (job?.status === "running") job.status = job.queue.length ? "limit_reached" : "complete";
  job.currentUrl = null; job.completedAt = new Date().toISOString(); await save(job); running = false;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === "START_RENDERED_COLLECTION") {
    const origin = new URL(message.startUrl).origin;
    if (origin !== PLATFORM_ORIGIN) {
      respond({ ok: false });
      return;
    }
    const scope = message.scope || "all";
    const job = { format: "assaad-rendered-information", version: 3.1, origin, scope, startUrl: message.startUrl, limit: Math.min(500, +message.limit || 150), status: "running", queue: seedsFor(origin, scope, message.startUrl), visited: [], pages: [], errors: [], currentUrl: null, startedAt: new Date().toISOString() };
    save(job).then(() => { run(); respond({ ok: true }); }); return true;
  }
  if (message?.type === "STOP_RENDERED_COLLECTION") { chrome.storage.local.get(JOB_KEY).then(async (x) => { const job=x[JOB_KEY]; if(job){job.status="stopped";await save(job);} respond({ok:true}); }); return true; }
  if (message?.type === "GET_COLLECTION_JOB") { chrome.storage.local.get(JOB_KEY).then((x) => respond(x[JOB_KEY] || null)); return true; }
});
chrome.runtime.onStartup.addListener(run);
