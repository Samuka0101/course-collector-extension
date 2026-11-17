(() => {
  if (globalThis.__assaadRenderedCollector) return;
  globalThis.__assaadRenderedCollector = true;
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const unique = (xs) => [...new Set(xs.filter(Boolean))];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const forbidden = /logout|log-out|signout|sair|delete|excluir|remove|cancel|pagamento|payment|checkout|billing|assinatura|perfil/i;
  function safeUrl(href) {
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin || !/^https?:$/.test(u.protocol) || forbidden.test(u.href)) return null;
      u.hash = "";
      ["utm_source", "utm_medium", "utm_campaign", "fbclid", "gclid"].forEach((x) => u.searchParams.delete(x));
      return u.href;
    } catch { return null; }
  }
  function mediaReference(raw) {
    try { const u = new URL(raw, location.href); return `${u.origin}${u.pathname}`; } catch { return ""; }
  }
  async function reveal() {
    const patterns = /módulos|modulos|conteúdo|conteudo|aulas|ver aulas|ver curso|expandir|mostrar mais|carregar mais|continuar/i;
    const dangerous = /concluir|finalizar|responder|enviar|comprar|cancelar|excluir|sair/i;
    const buttons = [...document.querySelectorAll("button,[role=button],[aria-expanded=false]")]
      .filter((el) => patterns.test(clean(el.innerText || el.getAttribute("aria-label"))) && !dangerous.test(clean(el.innerText)));
    for (const button of buttons.slice(0, 30)) { try { button.click(); await wait(180); } catch {} }
    for (const y of [0, .25, .5, .75, 1]) { scrollTo(0, Math.floor(document.documentElement.scrollHeight * y)); await wait(250); }
    scrollTo(0, 0);
  }
  function videoInfo() {
    const native = [...document.querySelectorAll("video")].map((v) => ({
      kind: "video", title: clean(v.getAttribute("title") || v.getAttribute("aria-label") || document.title),
      src: mediaReference(v.currentSrc || v.src || v.querySelector("source")?.src || ""),
      durationSeconds: Number.isFinite(v.duration) ? Math.round(v.duration) : null,
      poster: v.poster || ""
    }));
    const frames = [...document.querySelectorAll("iframe")].map((f) => ({
      kind: "iframe", title: clean(f.title || f.getAttribute("aria-label") || "Player incorporado"),
      src: mediaReference(f.src || ""), durationSeconds: null, poster: ""
    })).filter((x) => /video|player|youtube|vimeo|panda|wistia|embed/i.test(`${x.src} ${x.title}`));
    const cards = [...document.querySelectorAll("[class*=video i],[class*=aula i],[data-video-id]")].map((e) => ({
      kind: "video-card", title: clean(e.innerText).slice(0, 300),
      src: e.getAttribute("data-video-id") || e.querySelector("a")?.href || "", durationSeconds: null, poster: ""
    })).filter((x) => x.title);
    return [...native, ...frames, ...cards].slice(0, 300);
  }
  function durationsFrom(text) {
    return unique(text.match(/\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b|\b\d+\s*(?:h|min|mins|minutos|seg|segundos)\b/gi) || []).slice(0, 200);
  }
  function inferPageType(url, text) {
    const source = `${url} ${text}`.toLowerCase();
    if (/assistir|videoaula|player/.test(source)) return "aula";
    if (/banco-de-questoes|lista de quest|questões/.test(source)) return "questoes";
    if (/simulado/.test(source)) return "simulado";
    if (/materiais|apostila|pdf/.test(source)) return "material";
    if (/mentoria/.test(source)) return "mentoria";
    if (/ferramentas/.test(source)) return "ferramenta";
    if (/curso|ciclo|módulo|modulo/.test(source)) return "curso_ou_modulo";
    return "pagina";
  }
  async function collect() {
    await wait(2200);
    await reveal();
    await wait(800);
    const links = unique([...document.querySelectorAll("a[href]")].map((a) => safeUrl(a.href)));
    const headings = unique([...document.querySelectorAll("h1,h2,h3,h4,h5,[role=heading]")].map((e) => clean(e.innerText)))
      .filter((x) => x.length > 2 && x.length < 250).slice(0, 400);
    const controls = unique([...document.querySelectorAll("button,[role=button],nav a,[role=tab],label")]
      .map((e) => clean(e.getAttribute("aria-label") || e.getAttribute("title") || e.innerText)))
      .filter((x) => x.length > 1 && x.length < 200).slice(0, 350);
    const files = unique([...document.querySelectorAll("a[href]")].map((a) => a.href)
      .filter((x) => /\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(x))).slice(0, 200);
    const body = clean(document.body?.innerText).slice(0, 40000);
    const breadcrumbs = unique([...document.querySelectorAll("nav[aria-label*=breadcrumb i] a,.breadcrumb a,[class*=breadcrumb i]")]
      .map((e) => clean(e.innerText))).filter((x) => x.length < 200);
    const questionSignals = unique(body.match(/\b\d+\s*(?:questões|questoes|acertos|erros)\b/gi) || []);
    return { url: location.href, title: document.title, pageType: inferPageType(location.href, `${headings.join(" ")} ${body.slice(0,3000)}`),
      breadcrumbs, headings, controls, links, files, videos: videoInfo(), durations: durationsFrom(body), questionSignals,
      progressLabels: unique(body.match(/\b\d{1,3}%\b/g) || []), text: body, collectedAt: new Date().toISOString() };
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== "COLLECT_RENDERED_PAGE") return;
    collect().then(respond).catch((error) => respond({ error: String(error.message || error), url: location.href }));
    return true;
  });
})();
