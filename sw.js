/* Service worker da RG Marques 3D (site + painel).
   - Deixa o site/painel abrirem como app instalado e carregarem mais rápido.
   - HTML: rede primeiro (sempre pega a versão nova), com reserva offline.
   - Arquivos (js/css/imagens/fontes/CDN): cache primeiro, atualiza em 2º plano.
   - NUNCA mexe nas chamadas do Apps Script nem do FormSubmit: vão sempre pela rede.
   Ao publicar uma mudança, troque a data em VERSION para renovar o cache. */
const VERSION = "rg-2026-10-28-3";

const CORE = [
  "./", "index.html", "catalogo.js", "manifest.webmanifest",
  "img/icone-perfil.svg", "img/logo-horizontal-transparente.svg",
  "img/icon-192.png", "img/icon-512.png", "img/apple-touch-icon.png"
];
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js"
];
// Essas chamadas precisam de dados ao vivo: nunca servir do cache.
const SO_REDE = ["script.google.com", "script.googleusercontent.com", "formsubmit.co"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c =>
    Promise.allSettled([...CORE, ...CDN].map(u => c.add(new Request(u, { cache: "reload" }))))
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
  if (req.method !== "GET") return;                       // POST (pedido/painel) vai direto pra rede
  const url = new URL(req.url);
  if (SO_REDE.some(h => url.hostname.includes(h))) return; // preços/cupom/e-mail sempre ao vivo

  // Páginas (HTML): rede primeiro, cache de reserva quando estiver sem internet
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

  // Demais arquivos: responde do cache na hora e atualiza em segundo plano
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
