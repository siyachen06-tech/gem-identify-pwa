const CACHE_NAME = "gem-pwa-v4";
const ASSET_VERSION = "20260605-images-v2";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/styles.css",
  `./src/styles.css?v=${ASSET_VERSION}`,
  "./src/app.js",
  `./src/app.js?v=${ASSET_VERSION}`,
  "./data/gems.json",
  "./data/gems.js",
  `./data/gems.js?v=${ASSET_VERSION}`,
  "./data/image-credits.json",
  "./data/image-credits.js",
  `./data/image-credits.js?v=${ASSET_VERSION}`,
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

  event.respondWith(shouldUseNetworkFirst(event.request, url) ? networkFirst(event.request) : cacheFirst(event.request));
});

function shouldUseNetworkFirst(request, url) {
  if (request.mode === "navigate") return true;
  return (
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/src/app.js") ||
    url.pathname.endsWith("/src/styles.css") ||
    url.pathname.endsWith("/data/gems.json") ||
    url.pathname.endsWith("/data/gems.js") ||
    url.pathname.endsWith("/data/image-credits.json") ||
    url.pathname.endsWith("/data/image-credits.js")
  );
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match(request, { ignoreSearch: true });
    if (fallback) return fallback;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

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
