/* ============================================================
   Skillzify v2 — site-gate.js (Site Controls visitor gate)
   Loaded in <head> on the 18 content pages (never on admin.html,
   auth.html or reset-password.html — those are always live).

   What it does: reads the Site Controls state (which pages the
   admin has switched OFF, plus the master switch) and, when THIS
   page is off, covers it with the branded offline screen. The
   admin (patil.vikas6306@gmail.com) is never blocked: he gets a
   slim banner instead, so he can keep working on an off page.

   State sources, in order:
     1. localStorage cache (skillzify_site_config_v1) — applied
        instantly, so an off page never flashes its content.
     2. Firestore REST read of siteConfig/state (plain fetch, no
        SDK weight) — needs the one-line public-read rule.
     3. GET /api/site-status on the backend — the fallback that
        works even before that rule is published.
   While the offline screen (or the admin banner) is up, the
   state is re-checked every 60 s; the moment the page is back
   ON, the screen removes itself — no manual refresh.

   FAIL OPEN, always: any error anywhere in this file means the
   page loads completely normally. A kill switch must never
   become a self-inflicted outage. This script only ever adds
   or removes its own overlay/banner nodes; it never touches,
   delays or blocks the page's own scripts.
   ============================================================ */
(function () {
  "use strict";

  var NAMES = {
    "index.html": "Home", "learn.html": "Learn", "lesson.html": "Lesson",
    "practice.html": "Practice", "paths.html": "Learning Paths",
    "projects.html": "Projects", "community.html": "Community",
    "compiler.html": "Code Studio", "flowchart.html": "Flowchart Lab",
    "reference.html": "Reference", "dashboard.html": "Dashboard",
    "profile.html": "Profile", "passport.html": "Skill Passport",
    "map.html": "Journey Map", "placement.html": "Placement Test",
    "interview.html": "AI Interview", "about.html": "About",
    "contact.html": "Contact"
  };
  var CACHE_KEY = "skillzify_site_config_v1";
  var ADMIN_FLAG = "skillzify_is_admin";
  var ADMIN_EMAIL = "patil.vikas6306@gmail.com";
  var DEFAULT_MESSAGE = "An update is on the way — we'll be back soon.";
  /* The Firebase web API key is PUBLIC BY DESIGN (see auth.js) —
     it identifies the project for the REST read; access control
     is the Firestore rule, not the key. */
  var REST_URL = "https://firestore.googleapis.com/v1/projects/skillzify-1d0f2/databases/(default)/documents/siteConfig/state?key=AIzaSyBHqH96tS4MpeCVKy8HcnQAzIKMSehJx-U";
  var API_BASE = "https://skillzify-v2.onrender.com";
  var BASE = API_BASE;
  try { BASE = /\.onrender\.com$/.test(window.location.hostname) ? "" : API_BASE; } catch (e) {}

  var PAGE = "";
  try {
    PAGE = String(window.location.pathname || "").split("/").pop() || "";
    if (!PAGE) PAGE = "index.html";
  } catch (e) { PAGE = ""; }
  if (!NAMES[PAGE]) return; // not a gated page — do nothing at all

  var cur = null;        // last known normalized state (null = unknown)
  var desired = { kind: "none", sig: "" };
  var pollTimer = null;
  var scrollLock = null; // previous <html> overflow while the overlay is up

  /* ---------------- state shape ---------------- */
  function normalize(s) {
    if (!s || typeof s !== "object") return null;
    var st = { master: true, pages: {}, pageMessages: {}, message: "", updatedAt: "" };
    if (typeof s.master === "boolean") st.master = s.master;
    if (s.pages && typeof s.pages === "object") {
      Object.keys(s.pages).forEach(function (k) { if (s.pages[k] === false && NAMES[k]) st.pages[k] = false; });
    }
    if (s.pageMessages && typeof s.pageMessages === "object") {
      Object.keys(s.pageMessages).forEach(function (k) {
        if (typeof s.pageMessages[k] === "string" && s.pageMessages[k] && NAMES[k]) st.pageMessages[k] = s.pageMessages[k];
      });
    }
    if (typeof s.message === "string") st.message = s.message;
    if (typeof s.updatedAt === "string") st.updatedAt = s.updatedAt;
    return st;
  }
  function parseRest(doc) {
    try {
      if (!doc || typeof doc !== "object" || !doc.fields) return null;
      var f = doc.fields;
      var raw = { master: true, pages: {}, pageMessages: {}, message: "", updatedAt: "" };
      if (f.master && typeof f.master.booleanValue === "boolean") raw.master = f.master.booleanValue;
      if (f.message && typeof f.message.stringValue === "string") raw.message = f.message.stringValue;
      if (f.updatedAt && typeof f.updatedAt.stringValue === "string") raw.updatedAt = f.updatedAt.stringValue;
      var pm = f.pages && f.pages.mapValue && f.pages.mapValue.fields;
      if (pm) Object.keys(pm).forEach(function (k) { if (pm[k] && pm[k].booleanValue === false) raw.pages[k] = false; });
      var mm = f.pageMessages && f.pageMessages.mapValue && f.pageMessages.mapValue.fields;
      if (mm) Object.keys(mm).forEach(function (k) { if (mm[k] && typeof mm[k].stringValue === "string" && mm[k].stringValue) raw.pageMessages[k] = mm[k].stringValue; });
      return normalize(raw);
    } catch (e) { return null; }
  }
  function loadCache() {
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      return raw ? normalize(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function saveCache(st) {
    try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(st)); } catch (e) {}
  }

  /* ---------------- decisions ---------------- */
  function siteOff() { return !!cur && cur.master === false; }
  function pageOff() { return !!cur && cur.pages[PAGE] === false; }
  function isOff() { return siteOff() || pageOff(); }
  function isAdmin() {
    try { if (window.localStorage.getItem(ADMIN_FLAG) === "1") return true; } catch (e) {}
    try {
      var A = window.SkillzifyAuth;
      var u = A && typeof A.currentUser === "function" ? A.currentUser() : null;
      if (u && String(u.email || "").trim().toLowerCase() === ADMIN_EMAIL) return true;
    } catch (e) {}
    return false;
  }
  function resolveMessage(mode) {
    if (mode === "page" && cur.pageMessages[PAGE]) return cur.pageMessages[PAGE];
    return cur.message || DEFAULT_MESSAGE;
  }
  function linkFiles() {
    var cands = ["index.html", "community.html", "compiler.html"];
    return cands.filter(function (f) { return f !== PAGE && !(cur.pages && cur.pages[f] === false); });
  }

  /* ---------------- DOM ---------------- */
  function whenBody(fn) {
    if (document.body) { fn(); return; }
    document.addEventListener("DOMContentLoaded", function h() {
      document.removeEventListener("DOMContentLoaded", h);
      fn();
    });
  }
  function buildLinks() {
    var labels = { "index.html": "Go to Home", "community.html": "Visit Community", "compiler.html": "Open Code Studio" };
    var files = linkFiles();
    if (!files.length) return null;
    var row = document.createElement("div");
    row.className = "so-links";
    files.forEach(function (f, i) {
      var a = document.createElement("a");
      a.href = f;
      a.textContent = labels[f];
      a.className = i === 0 ? "btn" : "btn btn-ghost";
      row.appendChild(a);
    });
    return row;
  }
  function buildOverlay(mode) {
    var ov = document.createElement("div");
    ov.className = "so-overlay";
    ov.id = "so-overlay";
    ov.setAttribute("role", "alertdialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-label", mode === "site" ? "Site offline" : "Page offline");
    var card = document.createElement("div");
    card.className = "so-card";
    var img = document.createElement("img");
    img.className = "so-logo";
    img.src = "assets/logo-light-small.png";
    img.alt = "Skillzify";
    card.appendChild(img);
    var pill = document.createElement("div");
    pill.className = "so-pill";
    var dot = document.createElement("span");
    dot.className = "so-dot";
    var pillTxt = document.createElement("span");
    pillTxt.textContent = mode === "site" ? "SITE OFFLINE" : "PAGE OFFLINE";
    pill.appendChild(dot);
    pill.appendChild(pillTxt);
    card.appendChild(pill);
    var h = document.createElement("h1");
    h.className = "so-title";
    h.appendChild(document.createTextNode(mode === "site" ? "Skillzify is taking a " : NAMES[PAGE] + " is taking a "));
    var grad = document.createElement("span");
    grad.className = "so-grad";
    grad.textContent = "short break";
    h.appendChild(grad);
    card.appendChild(h);
    var msg = document.createElement("p");
    msg.className = "so-msg";
    msg.textContent = resolveMessage(mode);
    card.appendChild(msg);
    var sub = document.createElement("p");
    sub.className = "so-sub";
    sub.textContent = mode === "site"
      ? "The whole site is switched off while we ship an update. Your progress, XP and streak are completely safe."
      : "This page is switched off while we ship an update. Your progress, XP and streak are completely safe.";
    card.appendChild(sub);
    if (mode === "page") {
      var links = buildLinks();
      if (links) card.appendChild(links);
    }
    var foot = document.createElement("div");
    foot.className = "so-foot";
    var spin = document.createElement("span");
    spin.className = "so-spinner";
    foot.appendChild(spin);
    foot.appendChild(document.createTextNode("This page checks again on its own and comes back automatically when the update is done — no need to refresh."));
    card.appendChild(foot);
    ov.appendChild(card);
    var brand = document.createElement("div");
    brand.className = "so-brand";
    brand.textContent = "SKILLZIFY · LEARN PYTHON BY DOING";
    ov.appendChild(brand);
    return ov;
  }
  function buildBanner() {
    var b = document.createElement("div");
    b.className = "so-banner";
    b.id = "so-banner";
    var span = document.createElement("span");
    span.textContent = siteOff()
      ? "⚠ The whole site is OFF for learners — you're seeing it as admin."
      : "⚠ This page is OFF for learners — you're seeing it as admin.";
    var a = document.createElement("a");
    a.href = "admin.html";
    a.textContent = "Open Page controls";
    b.appendChild(span);
    b.appendChild(a);
    return b;
  }
  function lockScroll(on) {
    try {
      var root = document.documentElement;
      if (on) {
        if (scrollLock === null) scrollLock = root.style.overflow || "";
        root.style.overflow = "hidden";
      } else if (scrollLock !== null) {
        root.style.overflow = scrollLock;
        scrollLock = null;
      }
    } catch (e) {}
  }
  // Converge the DOM to `desired`. Runs on DOMContentLoaded at the
  // earliest (the gate sits in <head>), and re-reads `desired` when
  // it runs, so queued calls can never resurrect a stale screen.
  function syncDom() {
    try {
      var ov = document.getElementById("so-overlay");
      var bn = document.getElementById("so-banner");
      if (desired.kind === "overlay") {
        if (bn) bn.remove();
        if (!ov || ov.getAttribute("data-sig") !== desired.sig) {
          if (ov) ov.remove();
          ov = buildOverlay(desired.mode);
          ov.setAttribute("data-sig", desired.sig);
          document.body.appendChild(ov);
        }
        lockScroll(true);
      } else if (desired.kind === "banner") {
        if (ov) { ov.remove(); lockScroll(false); }
        if (!bn || bn.getAttribute("data-sig") !== desired.sig) {
          if (bn) bn.remove();
          bn = buildBanner();
          bn.setAttribute("data-sig", desired.sig);
          document.body.appendChild(bn);
        }
      } else {
        if (ov) ov.remove();
        if (bn) bn.remove();
        lockScroll(false);
      }
    } catch (e) { /* fail open: a broken gate must not break the page */ }
  }
  function apply() {
    try {
      if (!cur) desired = { kind: "none", sig: "" };
      else if (isAdmin()) {
        desired = isOff()
          ? { kind: "banner", sig: "banner:" + (siteOff() ? "site" : "page"), mode: siteOff() ? "site" : "page" }
          : { kind: "none", sig: "" };
      } else if (isOff()) {
        var mode = siteOff() ? "site" : "page";
        desired = {
          kind: "overlay", mode: mode,
          sig: mode + "|" + resolveMessage(mode) + "|" + (mode === "page" ? linkFiles().join(",") : "")
        };
      } else desired = { kind: "none", sig: "" };
    } catch (e) { desired = { kind: "none", sig: "" }; }
    if (desired.kind === "none") stopPoll(); else startPoll();
    whenBody(syncDom);
  }

  /* ---------------- fetching ---------------- */
  function fetchJson(url, ms) {
    var ctrl = null, timer = null;
    try {
      ctrl = new AbortController();
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || 8000);
    } catch (e) {}
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }
  function refresh() {
    fetchJson(REST_URL, 8000).then(function (doc) {
      var st = parseRest(doc);
      if (!st) throw new Error("rest shape");
      saveCache(st);
      cur = st;
      apply();
    }).catch(function () {
      fetchJson(BASE + "/api/site-status", 8000).then(function (j) {
        var st = normalize(j);
        if (!st) return;
        saveCache(st);
        cur = st;
        apply();
      }).catch(function () { /* both sources down: keep what we have */ });
    });
  }
  function recheckMs() {
    var v = 0;
    try { v = Number(window.__SO_RECHECK_MS) || 0; } catch (e) {}
    return v > 0 ? v : 60000;
  }
  function startPoll() {
    if (pollTimer !== null) return;
    pollTimer = setInterval(refresh, recheckMs());
  }
  function stopPoll() {
    if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null; }
  }

  /* ---------------- admin auth hookup ----------------
     auth.js loads at the end of <body>, long after this gate.
     Poll briefly for it, then re-apply on every auth change:
     sign-in as admin swaps the overlay for the banner, sign-out
     (or a learner sign-in) restores the overlay. */
  var authHooked = false, authTries = 0;
  function hookAuth() {
    try {
      var A = window.SkillzifyAuth;
      if (A && typeof A.onAuthChange === "function") {
        if (!authHooked) {
          authHooked = true;
          A.onAuthChange(function () { apply(); });
        }
        return;
      }
    } catch (e) {}
    if (++authTries < 40) setTimeout(hookAuth, 250);
  }

  /* ---------------- boot ---------------- */
  try {
    cur = loadCache();
    apply();   // cached state first: an OFF page never flashes content
    refresh(); // then the fresh state, in the background
    hookAuth();
  } catch (e) { /* fail open */ }
})();
