/* Service worker do PLANO DE VENDAS (escopo /plano/ — app separado da loja e do painel).
   Deixa o plano abrir offline e avisa das tarefas do dia.
   Ao publicar mudança no plano, troque a data em VERSION. */
const VERSION = "rg-plano-2026-11-08-1";
const ESTADO = "rg-plano-estado";

const CORE = [
  "./", "index.html", "tarefas.js", "manifest.webmanifest",
  "../img/icone-perfil.svg", "../img/icon-192.png", "../img/icon-512.png", "../img/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c =>
    Promise.allSettled(CORE.map(u => c.add(new Request(u, { cache: "reload" }))))
  ));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter(k => k !== VERSION && k !== ESTADO).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(VERSION); c.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match("index.html")) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const rede = fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) caches.open(VERSION).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => null);
    return cached || (await rede) || Response.error();
  })());
});

// Aviso com o app fechado (Chrome no Android com o app instalado; o navegador decide quando roda)
function hojeISO() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
async function conferir() {
  const c = await caches.open(ESTADO);
  const r = await c.match("estado.json");
  if (!r) return;
  const st = await r.json();
  const h = hojeISO();
  const [hh, mm] = (st.hora || "14:00").split(":").map(Number);
  const agora = new Date();
  if (agora.getHours() * 60 + agora.getMinutes() < hh * 60 + mm) return;
  if (st.ultimoAviso === h) return;
  const p = (st.tarefas || []).filter(x => !x.feito && x.d <= h);
  try { if (self.navigator.setAppBadge) p.length ? self.navigator.setAppBadge(p.length) : self.navigator.clearAppBadge(); } catch (e) {}
  if (!p.length) return;
  await self.registration.showNotification(p.length === 1 ? "1 tarefa para hoje" : p.length + " tarefas para hoje", {
    body: p.map(x => "• " + x.t).slice(0, 4).join("\n"),
    icon: "../img/icon-192.png", badge: "../img/icon-192.png", tag: "rg-plano", data: { url: "./" }
  });
  st.ultimoAviso = h;
  await c.put("estado.json", new Response(JSON.stringify(st), { headers: { "content-type": "application/json" } }));
}
self.addEventListener("periodicsync", e => { if (e.tag === "rg-lembrete") e.waitUntil(conferir()); });

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of lista) { if (c.url.includes("/plano/")) return c.focus(); }
    return self.clients.openWindow("./");
  })());
});
