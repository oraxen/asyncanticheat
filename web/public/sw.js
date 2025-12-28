/**
 * AsyncAnticheat Service Worker
 * Provides offline caching and PWA functionality
 */

const CACHE_NAME = "asyncac-v1";
const STATIC_CACHE_NAME = "asyncac-static-v1";
const DYNAMIC_CACHE_NAME = "asyncac-dynamic-v1";

// Static assets to cache on install
// Note: Don't include authenticated routes like /dashboard here
// They will be cached dynamically when accessed while logged in
const STATIC_ASSETS = [
  "/",
  "/login",
  "/docs",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.json",
];

// API routes to cache with network-first strategy
const API_ROUTES = [
  "/api/",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete old versioned caches
            return (
              name.startsWith("asyncac-") &&
              name !== STATIC_CACHE_NAME &&
              name !== DYNAMIC_CACHE_NAME
            );
          })
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - serve from cache with network fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests (except for API)
  if (url.origin !== location.origin) {
    return;
  }

  // Skip dev server hot reload
  if (url.pathname.includes("_next/webpack-hmr")) {
    return;
  }

  // API requests: Network first, cache fallback
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: Cache first, network fallback
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation requests: Network first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Default: Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Check if a path is a static asset
function isStaticAsset(pathname) {
  return (
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    pathname.startsWith("/_next/static/")
  );
}

// Cache-first strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log("[SW] Cache-first fetch failed:", error);
    return new Response("Offline", { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log("[SW] Network-first falling back to cache:", error);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(DYNAMIC_CACHE_NAME);
        cache.then((c) => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => {
      // Return cached version if available, otherwise return offline response
      if (cached) {
        return cached;
      }
      return new Response("Offline", { status: 503 });
    });

  return cached || fetchPromise;
}

// Navigation handler with offline fallback
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log("[SW] Navigation failed, trying cache:", error);

    // Try cached version of the page
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Try cached dashboard as fallback for dashboard routes
    const url = new URL(request.url);
    if (url.pathname.startsWith("/dashboard")) {
      const dashboardCached = await caches.match("/dashboard");
      if (dashboardCached) {
        return dashboardCached;
      }
    }

    // Return offline page - await the cache match before applying fallback
    const rootCached = await caches.match("/");
    return rootCached || new Response("Offline", { status: 503 });
  }
}

// Listen for messages from the main thread
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Background sync for offline actions (future enhancement)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-findings") {
    console.log("[SW] Syncing findings...");
    // Future: sync queued API requests
  }
});

// Push notification handler (future enhancement)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || "New notification",
    icon: "/icon-192.png",
    badge: "/icon-128.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/dashboard",
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "AsyncAnticheat", options)
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
