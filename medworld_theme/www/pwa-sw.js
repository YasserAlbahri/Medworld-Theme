const SCRIPT_URL = new URL(self.location.href);
const VERSION = SCRIPT_URL.searchParams.get("v") || "v3";

const SHELL_CACHE = `medworld-pwa-shell-${VERSION}`;
const RUNTIME_CACHE = `medworld-pwa-runtime-${VERSION}`;

const SHELL_ASSETS = [
  "/pwa-offline",
  "/pwa-manifest.json",
  "/assets/medworld_theme/images/logo-xs.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;

  if (!sameOrigin) return;

  if (event.request.mode === "navigate" && isAppNavigation(requestUrl.pathname)) {
    event.respondWith(networkFirst(event.request, SHELL_CACHE, "/pwa-offline"));
    return;
  }

  if (isApiRequest(requestUrl.pathname)) {
    return;
  }

  if (isStaticAsset(requestUrl.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request, RUNTIME_CACHE));
    return;
  }
});

function isAppNavigation(pathname) {
  return (
    pathname === "/" ||
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/login"
  );
}

function isApiRequest(pathname) {
  return pathname.startsWith("/api/") || pathname.startsWith("/socket.io/");
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/files/") ||
    pathname === "/pwa-manifest.json"
  );
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw _;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const freshPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || freshPromise;
}

