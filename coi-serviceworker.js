/*! coi-serviceworker — adds COOP/COEP client-side so SharedArrayBuffer (and webR's
    fast channel) work on plain static hosts like GitHub Pages, with no server config.
    Based on the MIT-licensed coi-serviceworker by Guido Zuidhof and contributors.
    Use 'credentialless' so cross-origin CDN resources (the webR files) load without
    each needing a CORP header. Works in Chrome, Edge, and Firefox. */
let coepCredentialless = true;

if (typeof window === "undefined") {
  // ---- service-worker context ----
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener("message", (ev) => {
    if (!ev.data) return;
    if (ev.data.type === "deregister") {
      self.registration.unregister()
        .then(() => self.clients.matchAll())
        .then((clients) => clients.forEach((c) => c.navigate(c.url)));
    } else if (ev.data.type === "coepCredentialless") {
      coepCredentialless = ev.data.value;
    }
  });

  self.addEventListener("fetch", (event) => {
    const r = event.request;
    if (r.cache === "only-if-cached" && r.mode !== "same-origin") return;
    const request = (coepCredentialless && r.mode === "no-cors")
      ? new Request(r, { credentials: "omit" })
      : r;
    event.respondWith(
      fetch(request).then((response) => {
        if (response.status === 0) return response;
        const headers = new Headers(response.headers);
        headers.set("Cross-Origin-Embedder-Policy",
          coepCredentialless ? "credentialless" : "require-corp");
        if (!coepCredentialless) headers.set("Cross-Origin-Resource-Policy", "cross-origin");
        headers.set("Cross-Origin-Opener-Policy", "same-origin");
        return new Response(response.body, {
          status: response.status, statusText: response.statusText, headers,
        });
      }).catch((e) => console.error(e))
    );
  });
} else {
  // ---- page context: register the worker, reload once to become isolated ----
  (() => {
    if (window.crossOriginIsolated !== false) return; // already isolated (e.g. serve.py)
    if (!window.isSecureContext) return;               // needs https or localhost
    const n = navigator;
    if (!n.serviceWorker) return;
    n.serviceWorker.register(window.document.currentScript.src).then((reg) => {
      reg.addEventListener("updatefound", () => window.location.reload());
      if (reg.active && !n.serviceWorker.controller) window.location.reload();
    }).catch((e) => console.error("COI service worker failed to register:", e));
  })();
}
