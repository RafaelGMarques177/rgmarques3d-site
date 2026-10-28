/* Service worker do PAINEL (escopo /painel/ — separado do app da loja).
   Deixa o painel abrir como app próprio e carregar rápido. As chamadas do
   Apps Script vão sempre pela rede (dados ao vivo da planilha).
   Ao publicar mudança no painel, troque a data em VERSION. */
const VERSION = "rg-painel-2026-10-28-1";

const CORE = [
  "./", "index.html", "manifest.webmanifest",
  "../catalogo.js",
  "../img/icone-perfil.svg", "../img/icon-192.png", "../img/icon-512.png", "../img/apple-touch-icon.png"
];
const SO_REDE = ["script.google.com", "script.googleusercontent.com", "formsubmit.co"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c =>
    Promise.allSettled(CORE.map(u => c.add(new Request(u, { cache: "reload" }))))
  ));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (SO_REDE.some(h => url.hostname.includes(h))) return;

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
      if (res && (res.ok || res.type === "opaque")) {
        caches.open(VERSION).then(c => c.put(req, res.clone()));
      }
      return res;
    }).catch(() => null);
    return cached || (await rede) || Response.error();
  })());
});
