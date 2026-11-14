// Service worker: guarda la aplicación para que abra sin internet.
// La huella cambia en cada compilación, así que una versión nueva reemplaza a la anterior.
const CACHE = "invernadero-2abaa534";
const ARCHIVOS = ["./", "index.html", "assets/app.js", "assets/app.css", "manifest.webmanifest", "icono.svg", "icono-192.png", "icono-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Primero la red (para recibir versiones nuevas) y, sin conexión, la copia guardada
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
