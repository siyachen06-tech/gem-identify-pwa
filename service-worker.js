const CACHE_NAME = "gem-pwa-v3";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/styles.css",
  "./src/app.js",
  "./data/gems.json",
  "./data/gems.js",
  "./data/image-credits.json",
  "./data/image-credits.js",
  "./assets/icon.svg",
  "./assets/crystal.svg",
  "./assets/gemstone.svg",
  "./assets/jade.svg",
  "./assets/mineral.svg",
  "./assets/clear-quartz.svg",
  "./assets/amethyst.svg",
  "./assets/citrine.svg",
  "./assets/rose-quartz.svg",
  "./assets/smoky-quartz.svg",
  "./assets/phantom-quartz.svg",
  "./assets/rutilated-quartz.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(CORE_ASSETS);
        const imageAssets = await loadImageAssets();
        await Promise.allSettled(imageAssets.map((asset) => cache.add(asset)));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});

async function loadImageAssets() {
  try {
    const response = await fetch("./data/image-credits.json", { cache: "no-store" });
    if (!response.ok) return [];
    const credits = await response.json();
    return Object.values(credits.images || {})
      .map((image) => image.path)
      .filter(Boolean)
      .map((asset) => `./${asset.replace(/^\.\//, "")}`);
  } catch (error) {
    return [];
  }
}
