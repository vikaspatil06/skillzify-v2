/* Skillzify client error reporter (Tier 2, 19 Nov 2026).
   Tiny, dependency-free, fail-silent: forwards uncaught JS errors and
   unhandled promise rejections to POST /api/error-report so they show
   up on the Admin page instead of waiting for a user screenshot.
   Privacy rails: only the page PATH (no query/hash), the message
   (truncated, long opaque tokens masked server-side too) and the
   source file:line are sent — never a stack, storage, or identity.
   At most 5 reports per page load, duplicates counted once here and
   deduped into a counter server-side. Any failure is swallowed: this
   script must never become a source of errors itself. */
(function () {
  "use strict";
  if (window.__skzErrRep) return;
  window.__skzErrRep = true;

  var API_BASE = "https://skillzify-v2.onrender.com";
  var BASE = (function () {
    try { return /\.onrender\.com$/.test(window.location.hostname) ? "" : API_BASE; }
    catch (e) { return API_BASE; }
  })();

  var sent = 0;
  var seen = {};
  var MAX_SENDS = 5;

  function send(msg, src) {
    try {
      if (!msg || sent >= MAX_SENDS) return;
      var page = "";
      try { page = window.location.pathname || ""; } catch (e) {}
      var key = page + "|" + msg + "|" + src;
      if (seen[key]) return;
      seen[key] = true;
      sent++;
      var body = JSON.stringify({ page: page, msg: String(msg).slice(0, 300), src: String(src || "").slice(0, 200) });
      if (window.fetch) {
        window.fetch(BASE + "/api/error-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true
        }).catch(function () {});
      } else if (navigator.sendBeacon) {
        navigator.sendBeacon(BASE + "/api/error-report", new Blob([body], { type: "application/json" }));
      }
    } catch (e) { /* never throw from the reporter */ }
  }

  window.addEventListener("error", function (ev) {
    try {
      if (!ev || !ev.message) return; // resource-load errors carry no message; skip them
      var src = "";
      if (ev.filename) {
        src = String(ev.filename).split("/").pop().split("?")[0] + (ev.lineno ? ":" + ev.lineno : "");
      }
      send(String(ev.message), src);
    } catch (e) {}
  });

  window.addEventListener("unhandledrejection", function (ev) {
    try {
      var r = ev ? ev.reason : null;
      var msg = "";
      if (r && r.message) msg = String(r.message);
      else if (r != null) msg = String(r);
      if (msg) send("Unhandled rejection: " + msg, "");
    } catch (e) {}
  });
})();
