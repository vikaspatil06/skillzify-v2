/* Skillzify service worker (Tier 2, 19 Nov 2026) — PWA basics.
   Deliberately conservative:
   - Navigations: network-first, falling back to the cached copy of
     the page, then to a small built-in offline message. Online
     learners always get the freshest page.
   - Same-origin static files: ?v= versioned URLs are cache-first (a
     pin makes a URL immutable); unversioned files are
     stale-while-revalidate, so the shared chrome (nav/footer) still
     refreshes on the next load.
   - Everything else is NEVER touched: cross-origin traffic (Firebase,
     fonts, CDNs, Pyodide), every /api/ call, and non-GET requests
     pass straight through — auth, sync, AI and Site Controls behave
     exactly as they do without a worker.
   The precache list holds only unversioned essentials on purpose:
   versioned assets join the cache at runtime, so a ?v= bump never
   requires editing this file. Bump CACHE on any behaviour change. */
"use strict";

var CACHE = "skillzify-shell-v1";
var SHELL = [
  "./",
  "./index.html",
  "./assets/js/nav.js",
  "./assets/js/footer.js",
  "./assets/logo-light-small.png",
  "./assets/icon-192.png",
  "./manifest.webmanifest"
];

function offlineResponse() {
  var html = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>Skillzify — you're offline</title></head>" +
    "<body style=\"margin:0;font-family:system-ui,sans-serif;background:#070b1a;color:#e5e9f5;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px\">" +
    "<div><div style=\"font-size:2.4rem\">📡</div><h1 style=\"font-size:1.3rem\">You're offline</h1>" +
    "<p style=\"color:#9aa5c7;max-width:34ch\">This page hasn't been saved for offline use yet. Pages you've already visited still open — or reconnect and try again.</p>" +
    "<p><a href=\"./index.html\" style=\"color:#8ab4ff\">← Back to Skillzify home</a></p></div></body></html>";
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function putInCache(req, res) {
  var copy = res.clone();
  caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (c) {
      // One bad URL must not sink the whole install — warm what we can.
      return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;   // cross-origin: hands off
  if (url.pathname.indexOf("/api/") !== -1) return;   // API: hands off

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(function (res) {
        putInCache(req, res);
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match(req, { ignoreSearch: true }).then(function (hit2) {
            return hit2 || offlineResponse();
          });
        });
      })
    );
    return;
  }

  var versioned = url.search.indexOf("v=") !== -1;
  if (versioned) {
    // Immutable by pin: serve the cache, fill it on first sight.
    event.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          putInCache(req, res);
          return res;
        });
      })
    );
  } else {
    // Stale-while-revalidate: instant from cache, refreshed behind.
    event.respondWith(
      caches.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          putInCache(req, res);
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
  }
});
