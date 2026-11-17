const $ = (id) => document.getElementById(id);
let timer;
const status = (text, bad = false) => { $("status").textContent = text; $("status").style.color = bad ? "#9c3528" : ""; };
async function job() { return chrome.runtime.sendMessage({ type: "GET_COLLECTION_JOB" }); }
function render(j) {
  if (!j) return;
  const concepts = new Set(j.pages.flatMap((p) => p.headings || []));
  const videos = j.pages.reduce((n, p) => n + (p.videos?.length || 0), 0);
  $("items").textContent = j.pages.length; $("videos").textContent = concepts.size; $("minutes").textContent = videos;
  $("result").hidden = j.pages.length === 0;
  if (j.status === "running") {
    $("scan").disabled = true; $("stop").hidden = false;
    status(`Renderizadas ${j.pages.length}/${j.limit} páginas; ${j.queue.length} aguardando.${j.currentUrl ? ` Agora: ${j.currentUrl}` : ""}`);
  } else {
    $("scan").disabled = false; $("stop").hidden = true;
    status(`Coleta ${j.status === "complete" ? "concluída" : "finalizada"}: ${j.pages.length} páginas e ${videos} referências de vídeo.`);
    clearInterval(timer);
  }
}
async function poll() { try { render(await job()); } catch {} }
$("scan").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith("https://app.plataformaassaad.com.br/")) return status("Abra o painel da Plataforma Assaad antes de iniciar.", true);
  await chrome.runtime.sendMessage({ type: "START_RENDERED_COLLECTION", startUrl: tab.url, scope: $("scope").value, limit: +$("limit").value });
  status("Coleta iniciada. As páginas serão abertas em abas temporárias.");
  clearInterval(timer); timer = setInterval(poll, 1000); poll();
});
$("stop").addEventListener("click", async () => { await chrome.runtime.sendMessage({ type: "STOP_RENDERED_COLLECTION" }); status("Parando após a página atual…"); });
$("export").addEventListener("click", async () => {
  const j = await job(); if (!j?.pages?.length) return status("Ainda não há informações para exportar.", true);
  const data = { ...j, queue: undefined, visited: undefined };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  chrome.downloads.download({ url, filename: `assaad-${j.scope || "coleta"}-${new Date().toISOString().slice(0,10)}.json`, saveAs: true });
  status("Informações exportadas. A análise aguarda o seu aval.");
});
$("clear").addEventListener("click", async () => {
  const j = await job(); if (j?.status === "running") return status("Pare a coleta antes de apagar.", true);
  if (!confirm("Apagar todas as informações coletadas?")) return;
  await chrome.storage.local.remove("assaadCollectionJob"); $("result").hidden = true; status("Informações apagadas.");
});
poll(); timer = setInterval(poll, 1000);
