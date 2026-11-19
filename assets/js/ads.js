/* ads.js — dormant AdSense scaffold (19 Nov 2026).
   Built ahead of the 1 Jan 2027 launch so monetisation is a config
   flip, not a code change. It reads the ads section of the same
   siteConfig/state doc site-gate.js uses (Firestore REST, no SDK),
   falling back to GET /api/site-status on the API origin.

   DORMANT BY DEFAULT: unless the admin has saved a valid publisher
   ID (ca-pub-…) AND flipped ads.enabled on AND a placement has a
   slot ID, this file does nothing at all — no styles injected, no
   Google script requested, and the [data-ad-name] placeholders stay
   hidden and empty. Every failure path is silent: a broken config
   read must never break a learning page.

   Activation (after launch, all from Admin → Page controls → Ads):
   1. Create the ad units in the AdSense console, one per placement
      name used in the pages (home, learn, lesson, dashboard,
      practice).
   2. Paste the publisher ID and each unit's slot ID into Admin.
   3. Flip "Ads enabled" on. Also create /ads.txt at the repo root
      then: google.com, pub-<digits>, DIRECT, f08c47fec0942fa0
      (with the real publisher digits) — AdSense asks for it. */
(function () {
  "use strict";
  var REST_URL = "https://firestore.googleapis.com/v1/projects/skillzify-1d0f2/databases/(default)/documents/siteConfig/state?key=AIzaSyBHqH96tS4MpeCVKy8HcnQAzIKMSehJx-U";
  var PUB_RE = /^ca-pub-\d{8,20}$/;
  var SLOT_RE = /^\d{5,20}$/;

  function apiBase() {
    var h = location.hostname || "";
    if (h === "skillzify-v2.onrender.com" || h === "skillzify-v2-staging.onrender.com") return "";
    return "https://skillzify-v2.onrender.com";
  }
  function fetchJson(url, ms) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }
  function parseRest(doc) {
    if (!doc || typeof doc !== "object" || !doc.fields) return null;
    var a = doc.fields.ads && doc.fields.ads.mapValue && doc.fields.ads.mapValue.fields;
    if (!a) return null;
    var cfg = { enabled: false, publisherId: "", slots: {} };
    if (a.enabled && typeof a.enabled.booleanValue === "boolean") cfg.enabled = a.enabled.booleanValue;
    if (a.publisherId && typeof a.publisherId.stringValue === "string") cfg.publisherId = a.publisherId.stringValue;
    var sm = a.slots && a.slots.mapValue && a.slots.mapValue.fields;
    if (sm) Object.keys(sm).forEach(function (k) {
      if (sm[k] && typeof sm[k].stringValue === "string") cfg.slots[k] = sm[k].stringValue;
    });
    return cfg;
  }
  function activate(cfg) {
    if (!cfg || cfg.enabled !== true) return;
    if (!PUB_RE.test(cfg.publisherId || "")) return;
    var boxes = document.querySelectorAll("[data-ad-name]");
    if (!boxes.length) return;
    var st = document.createElement("style");
    st.textContent = ".skz-ad-slot{margin:28px auto;max-width:970px;padding:0 16px}" +
      ".skz-ad-label{font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;" +
      "color:var(--muted,#8b93b8);text-align:center;margin-bottom:6px}";
    document.head.appendChild(st);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.publisherId);
    s.setAttribute("crossorigin", "anonymous");
    document.head.appendChild(s);
    boxes.forEach(function (box) {
      var slotId = cfg.slots && cfg.slots[box.getAttribute("data-ad-name")];
      if (!slotId || !SLOT_RE.test(slotId)) return;
      box.hidden = false;
      var label = document.createElement("div");
      label.className = "skz-ad-label";
      label.textContent = "Advertisement";
      box.appendChild(label);
      var ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", cfg.publisherId);
      ins.setAttribute("data-ad-slot", slotId);
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
      box.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }
  function go() {
    fetchJson(REST_URL, 8000).then(function (doc) {
      var cfg = parseRest(doc);
      if (cfg) { activate(cfg); return; }
      throw new Error("no ads config");
    }).catch(function () {
      fetchJson(apiBase() + "/api/site-status", 8000).then(function (d) {
        activate(d && d.ads ? d.ads : null);
      }).catch(function () {});
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
  else go();
})();
