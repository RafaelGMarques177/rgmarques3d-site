/* Tarefas e lembretes do Plano de Vendas RG.
   Tudo fica salvo no aparelho (localStorage). Uma cópia vai para o cache
   do service worker, para ele poder avisar mesmo com o app fechado
   (onde o navegador permitir). */
(function () {
  const BASE = [
    { id: "k1",  t: "Escolher a margem de lucro",              d: "2026-11-03", aba: "t-preco",  dica: "Use a calculadora da aba Preço." },
    { id: "k2",  t: "Pesar 5 peças campeãs",                   d: "2026-11-04", aba: "t-preco",  dica: "Ponha o peso de cada uma na calculadora." },
    { id: "k3",  t: "Decidir: Shopee para o Brasil todo?",     d: "2026-11-05", aba: "t-shopee" },
    { id: "k4",  t: "Abrir a conta na Shopee",                 d: "2026-11-06", aba: "t-shopee", dica: "Uns 30 minutos." },
    { id: "k5",  t: "Tirar fotos e publicar 5 anúncios",       d: "2026-11-07", aba: "t-shopee" },
    { id: "k6",  t: "Imprimir o expositor com logo e QR code", d: "2026-11-09", aba: "t-consig" },
    { id: "k7",  t: "Mandar mensagem para 3 lojas",            d: "2026-11-10", aba: "t-consig", dica: "A mensagem pronta está na aba Consignação." },
    { id: "k8",  t: "Começar os kits de Natal",                d: "2026-11-12", aba: "t-ideias" },
    { id: "k9",  t: "Visitar as lojas que responderam",        d: "2026-11-17", aba: "t-consig" },
    { id: "k10", t: "Anunciar os kits de Natal",               d: "2026-11-20", aba: "t-ideias" },
    { id: "k11", t: "Ver o que vendeu e ajustar os preços",    d: "2026-11-30", aba: "t-preco" }
  ];

  const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let feito = ler("rg-plano-feito", {});
  let datas = ler("rg-plano-datas", {});
  let extras = ler("rg-plano-extras", []);
  let cfg = ler("rg-plano-cfg", { hora: "14:00", ultimoAviso: "" });

  // compatibilidade com a lista antiga (k1..k8 marcados com "1")
  BASE.forEach(b => { try { if (localStorage.getItem("rg-" + b.id) === "1") feito[b.id] = true; } catch (e) {} });

  const hojeISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const todas = () => BASE.concat(extras).map(x => Object.assign({}, x, { d: datas[x.id] || x.d, feito: !!feito[x.id] }))
                          .sort((a, b) => a.d.localeCompare(b.d));
  const pendentesAte = dia => todas().filter(x => !x.feito && x.d <= dia);
  const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function quando(iso) {
    const h = hojeISO();
    if (iso === h) return "hoje";
    const d = new Date(iso + "T12:00:00"), a = new Date(h + "T12:00:00");
    const dif = Math.round((d - a) / 864e5);
    if (dif === 1) return "amanhã";
    if (dif === -1) return "ontem (atrasada)";
    if (dif < 0) return "atrasada " + (-dif) + " dias";
    return DIAS[d.getDay()] + ", " + d.getDate() + " " + MESES[d.getMonth()];
  }

  function linkAgenda(x) {
    const [hh, mm] = (cfg.hora || "14:00").split(":");
    const ini = x.d.replace(/-/g, "") + "T" + hh + mm + "00";
    const fimH = String(Math.min(23, +hh + (+mm >= 30 ? 1 : 0))).padStart(2, "0");
    const fimM = String((+mm + 30) % 60).padStart(2, "0");
    const fim = x.d.replace(/-/g, "") + "T" + fimH + fimM + "00";
    const p = new URLSearchParams({ action: "TEMPLATE", text: "RG: " + x.t, dates: ini + "/" + fim, details: (x.dica || "") + "\nPlano de Vendas RG: " + location.href, ctz: "America/Sao_Paulo" });
    return "https://calendar.google.com/calendar/render?" + p.toString();
  }

  function item(x) {
    const li = document.createElement("li");
    const h = hojeISO();
    li.className = "task" + (x.feito ? " done" : x.d < h ? " late" : x.d === h ? " today" : "");
    const q = quando(x.d);
    li.innerHTML =
      '<button class="ok" type="button" aria-label="' + (x.feito ? "Desmarcar" : "Marcar como feita") + ': ' + x.t.replace(/"/g, "") + '"></button>' +
      '<div class="txt"><span class="t"></span>' + (x.dica ? '<span class="costline dica"></span>' : '') +
      '<div class="meta"><span class="when' + (!x.feito && x.d < h ? " late" : "") + '">' + q + '</span>' +
      '<input type="date" aria-label="Mudar a data" value="' + x.d + '">' +
      (x.aba ? '<button type="button" class="lk abrir">ver como fazer</button>' : '') +
      '<a target="_blank" rel="noopener" href="' + linkAgenda(x) + '">pôr na Agenda</a>' +
      (x.extra ? '<button type="button" class="lk apagar">apagar</button>' : '') +
      '</div></div>';
    li.querySelector(".t").textContent = x.t;
    if (x.dica) li.querySelector(".dica").textContent = x.dica;
    li.querySelector(".ok").addEventListener("click", () => { feito[x.id] = !x.feito; gravar("rg-plano-feito", feito); tudo(); });
    li.querySelector('input[type="date"]').addEventListener("change", e => { if (e.target.value) { datas[x.id] = e.target.value; gravar("rg-plano-datas", datas); tudo(); } });
    const ab = li.querySelector(".abrir"); if (ab) ab.addEventListener("click", () => { window.RGshow && window.RGshow(x.aba); scrollTo({ top: 0 }); });
    const ap = li.querySelector(".apagar"); if (ap) ap.addEventListener("click", () => { extras = extras.filter(e => e.id !== x.id); gravar("rg-plano-extras", extras); tudo(); });
    return li;
  }

  function desenhar() {
    const h = hojeISO();
    const lista = todas();
    const agora = lista.filter(x => !x.feito && x.d <= h);
    const prox = lista.filter(x => !x.feito && x.d > h).slice(0, 2);
    const ulH = document.getElementById("lista-hoje");
    ulH.innerHTML = "";
    if (agora.length) agora.forEach(x => ulH.appendChild(item(x)));
    else { const v = document.createElement("li"); v.className = "vazio"; v.textContent = "Nada para hoje. Bom trabalho!"; ulH.appendChild(v); }
    if (prox.length) {
      const s = document.createElement("li"); s.className = "costline"; s.textContent = "Próximas:"; ulH.appendChild(s);
      prox.forEach(x => ulH.appendChild(item(x)));
    }
    const feitas = lista.filter(x => x.feito).length;
    document.getElementById("hoje-titulo").textContent = agora.length ? (agora.length === 1 ? "1 tarefa para hoje" : agora.length + " tarefas para hoje") : "Tudo em dia";
    document.getElementById("hoje-sub").textContent = feitas + " de " + lista.length + " tarefas feitas.";
    const ulT = document.getElementById("lista-todas"); ulT.innerHTML = ""; lista.forEach(x => ulT.appendChild(item(x)));
    const b = document.getElementById("badge"); b.hidden = !agora.length; b.textContent = agora.length;
    try { if (navigator.setAppBadge) agora.length ? navigator.setAppBadge(agora.length) : navigator.clearAppBadge(); } catch (e) {}
  }

  // cópia para o service worker
  async function salvarParaSW() {
    try {
      const c = await caches.open("rg-plano-estado");
      await c.put("estado.json", new Response(JSON.stringify({ tarefas: todas(), hora: cfg.hora, ultimoAviso: cfg.ultimoAviso }), { headers: { "content-type": "application/json" } }));
    } catch (e) {}
  }

  function estadoLembrete() {
    const el = document.getElementById("lem-estado"), bt = document.getElementById("ativar");
    if (!("Notification" in window)) { el.textContent = "Este navegador não mostra avisos. Use a Google Agenda."; bt.hidden = true; return; }
    if (Notification.permission === "granted") { el.textContent = "Avisos ligados. O app avisa no horário abaixo quando tiver tarefa."; bt.textContent = "Testar aviso"; }
    else if (Notification.permission === "denied") { el.textContent = "Os avisos estão bloqueados. Libere nas configurações do navegador para este site."; bt.hidden = true; }
    else el.textContent = "Toque no botão para o celular avisar das tarefas.";
  }

  async function avisar(forcar) {
    const h = hojeISO();
    const p = pendentesAte(h);
    if (!forcar && (!p.length || cfg.ultimoAviso === h)) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const corpo = p.length ? p.map(x => "• " + x.t).slice(0, 4).join("\n") : "Nada para hoje. Os avisos estão funcionando.";
    const titulo = p.length ? (p.length === 1 ? "1 tarefa para hoje" : p.length + " tarefas para hoje") : "Plano RG";
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(titulo, { body: corpo, icon: "../img/icon-192.png", badge: "../img/icon-192.png", tag: "rg-plano", renotify: true, data: { url: "./" } });
    } catch (e) { try { new Notification(titulo, { body: corpo, icon: "../img/icon-192.png" }); } catch (e2) {} }
    if (!forcar) { cfg.ultimoAviso = h; gravar("rg-plano-cfg", cfg); salvarParaSW(); }
  }
  function passouDaHora() { const [hh, mm] = (cfg.hora || "14:00").split(":").map(Number); const d = new Date(); return d.getHours() * 60 + d.getMinutes() >= hh * 60 + mm; }

  async function registrarPeriodico() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if ("periodicSync" in reg) {
        const st = await navigator.permissions.query({ name: "periodic-background-sync" });
        if (st.state === "granted") await reg.periodicSync.register("rg-lembrete", { minInterval: 6 * 60 * 60 * 1000 });
      }
    } catch (e) {}
  }

  function tudo() { desenhar(); salvarParaSW(); }

  // eventos
  const hora = document.getElementById("hora");
  hora.value = cfg.hora || "14:00";
  hora.addEventListener("change", () => { cfg.hora = hora.value || "14:00"; gravar("rg-plano-cfg", cfg); tudo(); });
  document.getElementById("ativar").addEventListener("click", async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") { avisar(true); return; }
    const r = await Notification.requestPermission();
    estadoLembrete();
    if (r === "granted") { registrarPeriodico(); avisar(true); }
  });
  const nd = document.getElementById("nova-d"); nd.value = hojeISO();
  document.getElementById("add").addEventListener("click", () => {
    const t = document.getElementById("nova-t").value.trim();
    if (!t) { document.getElementById("nova-t").focus(); return; }
    extras.push({ id: "x" + Date.now(), t, d: nd.value || hojeISO(), extra: true });
    gravar("rg-plano-extras", extras);
    document.getElementById("nova-t").value = "";
    tudo();
  });

  tudo();
  estadoLembrete();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(() => { registrarPeriodico(); if (passouDaHora()) avisar(false); }).catch(() => {});
  }
  // com o app aberto: confere a cada minuto
  setInterval(() => { if (passouDaHora()) avisar(false); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { desenhar(); if (passouDaHora()) avisar(false); } });
})();
