const CACHE_NAME = "wikipedia-around-v1";

const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/favicon.svg",
  "/fallback.svg",
  "/manifest.webmanifest",
  "https://cdn.glitch.com/839bbeb7-1cc6-4801-a6ae-3c66ed884eea%2Ffavicon.png?v=1615934983977"
];

const HEADERS = {
  headers: { "content-type": "application/json" }
};

const WIKIPEDIA_GEOSEARCH_RESPONSE = JSON.stringify({
  query: {
    geosearch: [
      {
        pageid: 0,
        title: "Offline, cannot search nearby articles."
      }
    ]
  }
});

const WIKIPEDIA_SUMMARY_RESPONSE = JSON.stringify({
  query: { pages: { PAGEID: { extract: "" } } }
});

const GEOCODE_RESPONSE = JSON.stringify([
  [{ name: "Offline, cannot look up place name.", admin1Code: { name: "" } }]
]);

self.addEventListener("install", event => {
  console.log("👷", "install", event);
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(ASSETS);
        console.log("👷", "Cached in ", CACHE_NAME, ASSETS);
      } catch (err) {
        console.error("👷", err.name, err.message);
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", event => {
  console.log("👷", "activate", event);
  event.waitUntil(
    (async () => {
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
      }
      try {
        const keys = await caches.keys();
        const oldKeys = keys.filter(key => key !== CACHE_NAME);
        await Promise.all(
          oldKeys.map(oldKey => {
            caches.delete(oldKey);
          })
        );
        console.log(
          oldKeys.length ? `👷 Deleted old caches: ${oldKeys.join(", ")}` : ""
        );
      } catch (err) {
        console.error("👷", err.name, err.message);
      }
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", function(event) {
  
  event.respondWith(
    (async () => {
      const request = event.request;
      try {
        const response = await event.preloadResponse;
        if (response) {
          return response;
        }
        return await fetch(request);
      } catch (err) {
        const { destination } = request;
        switch (destination) {
          case "script":
          case "style":
          case "document":
          case "manifest":
            return caches.match(request, {
              ignoreVary: true
            });
            break;
          case "image":
            if (request.url.endsWith("favicon.svg")) {
              return caches.match("/favicon.svg");
            } else if (request.url.endsWith("favicon.png")) {
              return caches.match("/favicon.png");
            }
            return caches.match("/fallback.svg");
            break;
          case "":
            const url = new URL(request.url);
            if (/geosearch/.test(url.search)) {
              return new Response(WIKIPEDIA_GEOSEARCH_RESPONSE, HEADERS);
            } else if (/geocode/.test(url.pathname)) {
              return new Response(GEOCODE_RESPONSE, HEADERS);
            } else if (/pageids/.test(url.search)) {
              const response = WIKIPEDIA_SUMMARY_RESPONSE.replace(
                "PAGEID",
                url.searchParams.get("pageids")
              );
              return new Response(response, HEADERS);
            }
            break;
          default:
            return caches.match(request);
        }
      }
    })()
  );
});
