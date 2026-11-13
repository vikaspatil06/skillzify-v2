/* ============================================================
   Skillzify AI — one client for the whole site (Phase 1)
   - Every AI feature (compiler, practice, lessons, flowchart,
     dashboard, paths, projects) calls SkillzifyAI.ask().
   - Backend is the Render service (absolute URL on GitHub Pages,
     same-origin when served from Render itself).
   - Fallback chain: backend -> personal Gemini key (if the user
     saved one) -> local heuristic error explainer.
   - Warmup ping on load wakes the free Render instance before
     the user asks anything. Requests run one at a time.
   - No API key ever leaves the browser except the user's OWN
     key, sent directly to Google, only when the backend fails.
   Requires nothing; degrades gracefully when app.js / auth.js
   are absent (flowchart.html). Exposes window.SkillzifyAI.
   ============================================================ */
(function () {
  "use strict";

  var API_BASE = "https://skillzify-v2.onrender.com";
  var KEY_STORE = "skillzify_ai_key";
  var MODEL = "gemini-3.8-flash";
  /* Personal-key fallback models, in order (P2-38): the server path has
     9-model failover; the key path had one model and no retry. */
  var KEY_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash-lite"];
  var BASE = (function () {
    try {
      return /\.onrender\.com$/.test(window.location.hostname) ? "" : API_BASE;
    } catch (e) { return API_BASE; }
  })();

  /* ---------------- small helpers ---------------- */
  function storeGet(k, fb) {
    try {
      if (window.Skillzify && window.Skillzify.storeGet) return window.Skillzify.storeGet(k, fb);
      var raw = window.localStorage.getItem(k);
      return raw == null ? fb : JSON.parse(raw);
    } catch (e) { return fb; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[<>&]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c];
    });
  }
  /* P2-49: stronger cache hash (cyrb53 — two 32-bit lanes, ~53 bits
     of output) instead of the old 32-bit DJB2, which could collide
     across different questions. The cache key also carries the uid
     now (see runJob), so two users can never share an entry. */
  function hash(s) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < s.length; i++) {
      ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  function uid() {
    try {
      if (window.SkillzifyAuth && window.SkillzifyAuth.currentUser) {
        var u = window.SkillzifyAuth.currentUser();
        if (u && u.uid) return String(u.uid);
      }
    } catch (e) {}
    return "";
  }
  function email() {
    try {
      if (window.SkillzifyAuth && window.SkillzifyAuth.currentUser) {
        var u = window.SkillzifyAuth.currentUser();
        if (u && u.email) return String(u.email);
      }
    } catch (e) {}
    return "";
  }
  /* The signed-in user's Firebase ID token, or "". The server
     verifies it and derives uid/email from it (server.js
     resolveIdentity) — the uid/email fields in the payload are now
     only a fallback for a server without verification configured.
     Raced against a 3 s timer: a stuck token fetch must never wedge
     the ask queue; the call then goes out tokenless and the server
     treats it as anonymous. */
  function idToken() {
    try {
      var A = window.SkillzifyAuth;
      if (!A || typeof A.idToken !== "function") return Promise.resolve("");
      var p = A.idToken();
      if (!p || typeof p.then !== "function") return Promise.resolve("");
      var timeoutP = new Promise(function (resolve) { setTimeout(function () { resolve(""); }, 3000); });
      return Promise.race([p, timeoutP]).catch(function () { return ""; });
    } catch (e) { return Promise.resolve(""); }
  }

  /* P2-54 + P2-49: auth readiness and cache clearing.
     - uid() is gated on SkillzifyAuth.onReady: an early tap in the
       first second before Firebase restores the session used to read
       currentUser() === null and burn the anonymous 5/day cap instead
       of the signed-in 10/day. runJob now waits for onReady before it
       resolves the uid (for the payload AND the cache key). A genuinely
       signed-out user still resolves at once: onReady fires with a
       null user as soon as the session state is known, and when the
       auth module is absent there is nothing to wait for. A 5 s safety
       timer keeps a stuck auth restore from wedging the queue forever.
     - The cache is cleared on every auth change (sign-in / sign-out),
       so a cached answer can never leak across users on a shared
       device. The subscription is (re-)attempted on every ask until
       the auth module is present, because ai.js cannot rely on load
       order alone. */
  var authReady = false, authWatchStarted = false;
  function watchAuth() {
    if (authWatchStarted) return;
    try {
      var A = window.SkillzifyAuth;
      if (!A || typeof A.onReady !== "function") return;
      authWatchStarted = true;
      if (typeof A.onAuthChange === "function") {
        A.onAuthChange(function () { cacheClearAll(); });
      }
      A.onReady(function () { authReady = true; });
    } catch (e) {}
  }
  function whenAuthReady() {
    watchAuth();
    if (authReady) return Promise.resolve();
    try {
      var A = window.SkillzifyAuth;
      if (!A || typeof A.onReady !== "function") return Promise.resolve();
      var readyP = new Promise(function (resolve) {
        A.onReady(function () { authReady = true; resolve(); });
      });
      if (typeof setTimeout !== "function") return readyP;
      var timeoutP = new Promise(function (resolve) { setTimeout(function () { resolve(); }, 5000); });
      return Promise.race([readyP, timeoutP]);
    } catch (e) { return Promise.resolve(); }
  }

  // Sign-in link for DAILY_CAP errors — shown ONLY to signed-out
  // users. A signed-in user who hit the 10/day cap gets the plain
  // server message with no link (the link would just bounce them to
  // auth.html and back to the dashboard). All DAILY_CAP error sites
  // must go through this helper; none hardcodes the link anymore.
  function capLink() {
    return uid() ? "" : ' <a href="auth.html">Sign in for 10 AI answers/day</a>';
  }

  // Today's AI usage for the requester (GET /api/usage): { used, cap,
  // admin }. Waits for auth readiness and sends the ID token — on a
  // token-verifying server the uid/email params alone prove nothing.
  // Callback-style like the rest of this module; cb(new Error) on any
  // failure, so callers treat usage as informational and never block.
  function usage(cb) {
    try {
      whenAuthReady().then(function () { return idToken(); }).then(function (tok) {
        var q = "uid=" + encodeURIComponent(uid()) + "&email=" + encodeURIComponent(email()) + "&token=" + encodeURIComponent(tok || "");
        return fetch(BASE + "/api/usage?" + q);
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.ok) { try { cb(null, d); } catch (e) {} }
        else { try { cb(new Error("usage")); } catch (e) {} }
      }).catch(function () { try { cb(new Error("usage")); } catch (e) {} });
    } catch (e) { try { cb(new Error("usage")); } catch (e2) {} }
  }

  /* ---------------- status ---------------- */
  // idle | waking | working | ok | degraded | offline
  var status = "idle", listeners = [];
  function setStatus(s) {
    status = s;
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](s); } catch (e) {} }
  }
  function onStatus(fn) { if (typeof fn === "function") listeners.push(fn); }
  function attachStatus(el) {
    if (!el) return;
    /* The navbar dot carries no text: colour + title/aria-label only,
       so it can never truncate or wrap at any viewport width. */
    var paint = function (s) {
      var map = {
        idle: ["#6b7280", "AI idle", false],
        waking: ["#f59e0b", "Waking up the AI…", true],
        working: ["#f59e0b", "AI is thinking…", true],
        ok: ["#22c55e", "AI ready", false],
        degraded: ["#f59e0b", "AI degraded — offline explainer only", false],
        offline: ["#6b7280", "AI offline", false]
      };
      var m = map[s] || map.idle;
      el.textContent = "";
      el.style.backgroundColor = m[0];
      el.title = "🤖 " + m[1];
      el.setAttribute("aria-label", "AI status: " + m[1]);
      if (el.classList) el.classList.toggle("pulse", !!m[2]);
    };
    onStatus(paint);
    paint(status);
  }

  /* ---------------- learner context ---------------- */
  // Short plain-text summary of where this learner stands, sent with
  // every AI call so the tutor answers about THEM, not a generic student.
  /* Totals come from the loaded catalogues (250 lessons / 150 exercises
     after Phase 1), so the context never goes stale again. */
  function lessonTotal() {
    try { var c = window.SkillzifyLearnCore; if (c && c.totalLessons) return c.totalLessons; } catch (e) {}
    return 250;
  }
  function exerciseTotal() {
    try { var d = window.SkillzifyPracticeData; if (d && d.length) return d.length; } catch (e) {}
    return 150;
  }

  function buildContext(extra) {
    var lines = [];
    try {
      var prog = storeGet("skillzify_progress", {}) || {};
      var done = Object.keys(prog).filter(function (k) { return prog[k]; }).length;
      if (done) lines.push("Lessons completed: " + done + "/" + lessonTotal() + ".");
    } catch (e) {}
    try {
      var atts = storeGet("skillzify_exercise_attempts", {}) || {};
      var weak = Object.keys(atts).filter(function (k) {
        var a = atts[k]; return a && a.attempts > 0 && !a.solved;
      });
      if (weak.length) {
        var names = weak.slice(0, 5).map(function (id) {
          var a = atts[id];
          return id + " (" + (a.attempts || 0) + " tries)";
        });
        lines.push("Stuck on (unsolved after trying): " + names.join(", ") + ".");
      }
      var solved = Object.keys(atts).filter(function (k) { return atts[k] && atts[k].solved; }).length;
      if (solved) lines.push("Exercises solved: " + solved + "/" + exerciseTotal() + ".");
    } catch (e) {}
    try {
      // Single source of truth: the shared streak counter via
      // SkillzifyActivity (lapse-aware — a lapsed streak reads 0).
      var stA = window.SkillzifyActivity && typeof window.SkillzifyActivity.streak === "function"
        ? window.SkillzifyActivity.streak() : null;
      var stN = stA ? stA.current : ((storeGet("skillzify_streak", {}) || {}).count || 0);
      if (stN) lines.push("Day streak: " + stN + ".");
    } catch (e) {}
    if (extra) {
      if (extra.lesson) lines.push("Current lesson: " + extra.lesson + ".");
      if (extra.section) lines.push("Section: " + extra.section + ".");
      if (extra.exercise) lines.push("Current exercise: " + extra.exercise + ".");
      if (extra.topic) lines.push("Topic: " + extra.topic + ".");
      if (extra.note) lines.push(extra.note);
    }
    return lines.join(" ");
  }

  /* ---------------- local heuristic explainer ---------------- */
  // Moved from compiler.js so every page shares it. Offline, instant,
  // and the last link in the fallback chain for error explanations.
  var HEURISTICS = [
    { re: /SyntaxError/, title: "🔧 SyntaxError — Python can't parse your code",
      tips: ["Check for missing colons (:) at the end of if/for/while/def lines.", "Match every opening bracket ( [ { with its closing partner.", "The real mistake is often on the line just above the reported one."] },
    { re: /IndentationError|unexpected indent/, title: "📐 IndentationError — spacing problem",
      tips: ["Use 4 spaces per indent level — never mix tabs and spaces.", "Every block after if/for/def/while must be indented one level deeper."] },
    { re: /NameError: name '(\w+)'/, title: "🏷️ NameError — unknown name",
      tips: ["You used a variable or function that was never defined.", "Check for typos — Python is case-sensitive.", "Make sure it's assigned BEFORE the line that uses it."] },
    { re: /TypeError/, title: "🧩 TypeError — wrong type of value",
      tips: ["You're mixing incompatible types, e.g. \"5\" + 3.", "Convert explicitly: int(\"5\") + 3."] },
    { re: /ZeroDivisionError/, title: "➗ ZeroDivisionError — divided by zero",
      tips: ["Guard it: if b != 0: ...", "Or: try: x = a/b except ZeroDivisionError: ..."] },
    { re: /IndexError/, title: "📋 IndexError — list index out of range",
      tips: ["Valid indexes are 0 to len(list)-1.", "An empty list has no index 0!"] },
    { re: /KeyError: (.+)/, title: "🔑 KeyError — missing dictionary key",
      tips: ["The key doesn't exist in the dict.", "Use dict.get(key, default) to avoid crashes."] },
    { re: /ValueError/, title: "⚠️ ValueError — right type, wrong value",
      tips: ["Common cause: int(input()) when the user typed text.", "Wrap in try/except ValueError."] },
    { re: /AttributeError/, title: "🧲 AttributeError — no such method",
      tips: ["The object doesn't have that method — check the type.", "Typos in method names are the #1 cause."] },
    { re: /ImportError|ModuleNotFoundError/, title: "📦 ImportError — module not found",
      tips: ["Only the Python standard library works in this browser runtime.", "Check the module name spelling."] },
    { re: /EOFError/, title: "⌨️ EOFError — input() ran out of data",
      tips: ["Each input() pauses your program and shows a prompt line right in the terminal — type your answer there and press Enter.", "This error means the program was still waiting for input when it got end-of-input instead — e.g. you clicked the EOF button (or pressed Ctrl+D) on that terminal prompt.", "Make sure every input() call gets a matching answer typed in the terminal, or guard it: try: x = input('...') except EOFError: x = ''"] },
    { re: /RecursionError/, title: "🔁 RecursionError — infinite recursion",
      tips: ["Your function calls itself forever.", "Every recursive function needs a base case."] }
  ];
  function explainError(err) {
    err = String(err || "");
    for (var i = 0; i < HEURISTICS.length; i++) {
      var h = HEURISTICS[i], m = err.match(h.re);
      if (m) return { title: h.title, tips: h.tips.slice(), name: m[1] || "" };
    }
    return null;
  }
  function explainErrorText(err) {
    var h = explainError(err);
    if (!h) return "Unrecognized error — read the last traceback line.";
    var out = h.title + "\n" + h.tips.map(function (t) { return "• " + t; }).join("\n");
    if (h.name) out += "\nOffending name: " + h.name;
    return out;
  }
  function explainErrorHTML(err) {
    var h = explainError(err);
    if (!h) return "<h4>🤔 Unrecognized error</h4><p>The offline explainer has no rule for this one — read the last traceback line.</p>";
    var html = "<h4>" + esc(h.title) + "</h4><ul>";
    h.tips.forEach(function (t) { html += "<li>" + esc(t) + "</li>"; });
    return html + "</ul>" + (h.name ? '<p style="color:var(--ide-muted)">Offending name: <b>' + esc(h.name) + "</b></p>" : "");
  }

  /* ---------------- transport ---------------- */
  var cache = {};
  var cacheOrder = [];
  var CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  /* Answer-cache persistence (optimization #7, 13 Nov 2026): the
     in-memory cache above is mirrored into sessionStorage so repeat
     questions stay free across page navigations for the whole tab
     session (the site is a 20-page MPA — every navigation used to
     wipe the cache and re-bill the provider against the 5/10 caps).
     Safety properties, all preserved from the in-memory design:
       - cache keys already carry the signed-in uid (P2-49), so one
         user's entries can never match another user's lookups;
       - the whole store is wiped on every auth change (watchAuth),
         in memory AND in sessionStorage;
       - sessionStorage dies with the tab — nothing persists on a
         shared device beyond the session;
       - any storage failure (private mode, quota) silently degrades
         to the old in-memory-only behaviour. */
  var CACHE_STORE_KEY = "skillzify_ai_cache_v1";
  var CACHE_STORE_MAX = 1500000; // ~1.5 MB serialized ceiling
  var cacheHydrated = false, cacheStoreDead = false;
  function cacheStoreRead() {
    if (cacheStoreDead) return;
    try {
      var raw = sessionStorage.getItem(CACHE_STORE_KEY);
      if (!raw) return;
      var blob = JSON.parse(raw);
      if (!blob || typeof blob !== "object" || !blob.entries) return;
      var now = Date.now();
      (Array.isArray(blob.order) ? blob.order : []).forEach(function (k) {
        var e = blob.entries[k];
        if (!e || typeof e.at !== "number" || (now - e.at) > CACHE_TTL) return;
        if (!Object.prototype.hasOwnProperty.call(cache, k)) { cache[k] = e; cacheOrder.push(k); }
      });
    } catch (e) { cacheStoreDead = true; }
  }
  function cacheStoreWrite() {
    if (cacheStoreDead) return;
    try {
      var entries = {}, order = cacheOrder.slice(), total = 0, i;
      // Keep the newest entries that fit the ceiling, oldest dropped.
      var kept = [];
      for (i = order.length - 1; i >= 0; i--) {
        var e = cache[order[i]];
        if (!e) continue;
        var s = 0;
        try { s = JSON.stringify(e).length; } catch (err) { continue; }
        if (kept.length && total + s > CACHE_STORE_MAX) continue;
        total += s; kept.unshift(order[i]);
      }
      kept.forEach(function (k) { entries[k] = cache[k]; });
      sessionStorage.setItem(CACHE_STORE_KEY, JSON.stringify({ order: kept, entries: entries }));
    } catch (e) { cacheStoreDead = true; }
  }
  function cacheHydrate() {
    if (cacheHydrated) return;
    cacheHydrated = true;
    cacheStoreRead();
  }
  function cacheClearAll() {
    cache = {}; cacheOrder = [];
    try { sessionStorage.removeItem(CACHE_STORE_KEY); } catch (e) {}
  }
  function cacheGet(key) {
    cacheHydrate();
    if (!Object.prototype.hasOwnProperty.call(cache, key)) return null;
    var e = cache[key];
    if (!e || (Date.now() - e.at) > CACHE_TTL) { delete cache[key]; var i = cacheOrder.indexOf(key); if (i >= 0) cacheOrder.splice(i, 1); cacheStoreWrite(); return null; }
    return e.val;
  }
  function cacheSet(key, val) {
    cacheHydrate();
    if (cacheOrder.indexOf(key) < 0) { cacheOrder.push(key); if (cacheOrder.length > 40) delete cache[cacheOrder.shift()]; }
    // P2-49: store a COPY, not the caller's object — the delivered
    // result and the cached entry must never be the same reference,
    // or a caller mutating its answer would corrupt the cache.
    var copy = val;
    try { copy = JSON.parse(JSON.stringify(val)); } catch (e) { copy = val; }
    cache[key] = { at: Date.now(), val: copy };
    cacheStoreWrite();
  }
  function fetchJSON(url, body, timeoutMs) {
    var ctrl = null, timer = null;
    try {
      ctrl = new AbortController();
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, timeoutMs);
    } catch (e) {}
    var opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, status: r.status, data: d };
      });
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  }
  function backendAsk(payload, attempt) {
    // P2-48: the retry after a network failure (TypeError) gets a short
    // 10 s fuse instead of another full 60 s — when the backend is down,
    // a hung retry used to burn a second minute before the personal-key
    // / offline fallback could run. The first attempt keeps the full
    // 60 s (a cold Render instance legitimately takes that long).
    // AbortError is still never retried (P1-23: the server may still
    // complete and count the aborted request).
    var timeoutMs = attempt === 0 ? 60000 : 10000;
    return fetchJSON(BASE + "/api/explain", payload, timeoutMs).then(function (res) {
      if (res.ok && res.data && res.data.explanation) return res.data;
      var code = (res.data && res.data.code) || ("HTTP_" + res.status);
      // Retry once, and only where a retry can help: a 503 overload, or a
      // 429 that is a transient quota blip. Never retry DAILY_CAP (a retry
      // would burn a second daily answer), RATE_LIMIT, NOT_CONFIGURED, or
      // client errors (400/404).
      if (attempt < 1 && ((res.status === 503 && code !== "NOT_CONFIGURED") || (res.status === 429 && code === "QUOTA"))) {
        return new Promise(function (ok) { setTimeout(ok, 2000); }).then(function () { return backendAsk(payload, attempt + 1); });
      }
      var err = new Error((res.data && res.data.error) || "AI backend error");
      err.code = code;
      err.status = res.status;
      throw err;
    }).catch(function (e) {
      // P1-23: retry a network failure (TypeError) once, but NEVER an
      // AbortError — that is our own 60 s timeout firing, and the server
      // may still complete (and count) the aborted request; retrying the
      // whole thing would burn a second daily-cap answer for one answer.
      if (attempt < 1 && e.name === "TypeError") {
        return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return backendAsk(payload, attempt + 1); });
      }
      throw e;
    });
  }
  // JSON shape the server expects per mode, so the personal-key fallback
  // produces parseable replies in the right shape (client validation is
  // the gate; this just makes the fallback produce the right shape).
  var JSON_SHAPES = {
    quiz: '{"questions":[{"q":"...","options":["","","",""],"answer":0,"why":"..."}]}',
    drill: '{"title":"...","prompt":"...","starter":"...","solution":"...","tests":[{"run":"...","expect":"..."}],"hints":["..."]}',
    challenge: '{"title":"...","prompt":"...","starter":"...","solution":"...","tests":[{"run":"...","expect":"..."}],"hints":["..."]}',
    review: '{"score":0,"issues":[{"severity":"...","line":0,"note":"..."}],"strengths":["..."],"suggestions":["..."]}',
    path: '{"title":"...","steps":[{"lessonId":"...","why":"..."}],"project":"..."}',
    "viva-ask": '{"question":"..."}',
    "viva-judge": '{"verdict":"correct|partial|wrong","feedback":"...","revisit":["..."]}'
  };
  function personalKeyAsk(opts, payload) {
    var key = "";
    try { key = storeGet(KEY_STORE, ""); } catch (e) {}
    if (!key) return Promise.reject(new Error("no-key"));
    // P1-24: mirror the server's per-mode prompts (server.js MODES /
    // buildPrompt) instead of one generic "Explain this Python code"
    // default. Before this fix tutor/tutor-lesson lost the Socratic rules
    // (a key-path tutor could hand over the full corrected code), the
    // JSON modes got a contradictory explain-task prompt, and the learner
    // context in payload.context was never used at all. The flowchart /
    // generate / fix prompts already matched the server and are kept.
    // Context is appended for the modes the server grounds in it (and
    // for tutor / explain); it is NOT appended to the raw-code-only
    // flowchart prompts, where trailing prose would break the output.
    var ctx = (payload && payload.context) ? String(payload.context) : "";
    var ctxBlock = ctx ? "\n\nLEARNER CONTEXT:\n" + ctx : "";
    var socratic =
      "You are a Socratic Python tutor for a beginner student. " +
      "Rules you MUST follow:\n" +
      "1. NEVER write the full corrected code — not even a snippet longer than one line.\n" +
      "2. Explain what is likely wrong in plain words, then give exactly ONE guiding hint.\n" +
      "3. Ask one short follow-up question that nudges the student to discover the fix.\n" +
      "4. Keep the whole answer under 120 words. Be encouraging.\n\n";
    var prompt;
    switch (opts.mode) {
      case "generate":
        prompt = "Write clean, beginner-friendly Python code for this request. Output the code inside a single ```python fenced block, then 2-3 short bullet points explaining the key parts. Keep it simple — no advanced tricks.\n\nREQUEST:\n" + (opts.code || "");
        break;
      case "fix":
        prompt = "A student's Python code has this error. Output the FULL corrected code inside a single ```python fenced block, then 2-3 short bullet points explaining what was wrong and what you changed. Fix only what's broken — keep their style.\n\nCODE:\n" + (opts.code || "") + "\n\nERROR:\n" + (opts.error || "");
        break;
      case "flowchart":
        prompt = "Write ONLY clean, simple Python code that solves this problem. Use only beginner Python (input/print, if/elif/else, for/while loops, functions, lists) — no classes, decorators, or match statements. Output raw code only:\n\n" + (opts.code || "");
        break;
      case "flowchart-code":
        prompt = "Write ONLY clean, simple Python code that implements these flowchart steps. Use input() for INPUT steps and print() for PRINT/OUTPUT steps. Output raw code only:\n\n" + (opts.code || "");
        break;
      case "flowchart-explain":
        prompt = "Explain this flowchart / algorithm in plain words, step by step, as if teaching a beginner what the program does and why each step exists. No code, just the explanation.\n\nFLOWCHART / ALGORITHM:\n" + (opts.code || "");
        break;
      case "tutor":
        prompt = socratic + "A student is stuck on this Python exercise. Their code is failing. Follow your Socratic rules strictly.\n\n" + (opts.code || "") + "\n\n" + (opts.error || "") + ctxBlock;
        break;
      case "tutor-lesson":
        prompt = socratic + "A student is working through a lesson and is stuck. Use the lesson context to ground your hint in what they just learned. Follow your Socratic rules strictly.\n\nLESSON CONTEXT:\n" + ctx + "\n\nSTUDENT CODE / QUESTION:\n" + (opts.code || "") + "\n\nERROR / STUCK POINT:\n" + (opts.error || "");
        break;
      case "quiz":
        prompt = "Write 3 multiple-choice quiz questions that test the concepts in this lesson. Each question: one clear question, exactly 4 options, exactly one correct answer, and a one-line 'why' explaining the answer. Keep questions at the lesson's level — no advanced topics.\n\nLESSON:\n" + (opts.code || "") + ctxBlock + "\n\nJSON shape: {\"questions\":[{\"q\":\"...\",\"options\":[\"...\",\"...\",\"...\",\"...\"],\"answer\":0,\"why\":\"...\"}]} — answer is the 0-based index of the correct option.";
        break;
      case "drill":
        prompt = "Write ONE short coding exercise that drills this weak topic. The student keeps failing here:\n\nWEAK TOPIC:\n" + (opts.code || "") + ctxBlock + "\n\nRules: 2-3 tests; each test is {\"run\": \"a Python expression using the function\", \"expect\": \"the exact str() of the result\"}; difficulty 1-3; the solution MUST pass all tests when run; keep it small.";
        break;
      case "challenge":
        prompt = "Write ONE small daily-challenge exercise for this learner, based on their weak spots. It should take under 10 minutes. Same JSON shape and rules as a drill exercise.\n\nWEAK SPOTS:\n" + (opts.code || "") + ctxBlock;
        break;
      case "trace":
        prompt = "Walk through this Python code line by line, in execution order. For each step say what happens and what each variable holds after that step. Use short numbered steps. If the program reads input, show one example run with sample input. Keep it plain and beginner-friendly.\n\nCODE:\n" + (opts.code || "") + (opts.error ? "\n\nRUN OUTPUT / ERROR:\n" + opts.error : "") + ctxBlock;
        break;
      case "review":
        prompt = "Review this student project code. Score it 0-100 and list concrete issues with line numbers, plus what's already good. Be specific — quote the line you're talking about.\n\nPROJECT:\n" + (opts.code || "") + ctxBlock;
        break;
      case "path":
        prompt = "Build a custom learning path for this goal. Use ONLY the lesson IDs from the LESSONS list below, in a sensible learning order (basics before advanced). Pick 6-12 lessons, then name the closest existing project from the PROJECTS list, or 'none'.\n\nGOAL + LISTS:\n" + (opts.code || "") + ctxBlock;
        break;
      case "viva":
        if (String(opts.stage || "") === "judge") {
          prompt = "The student answered a viva question. Judge the answer: is it correct, partly right, or wrong? Reply with short feedback and name the exact lesson(s) to revisit if they got it wrong.\n\nQUESTION:\n" + (opts.code || "") + "\n\nSTUDENT ANSWER:\n" + (opts.error || "") + ctxBlock;
        } else {
          prompt = "Ask ONE viva question about this lesson. It should test understanding, not memorization — ask the student to explain WHY or predict what happens. One question only.\n\nLESSON:\n" + (opts.code || "") + "\n\nPREVIOUS QUESTIONS (don't repeat these):\n" + (opts.error || "");
        }
        break;
      default:
        prompt = "Explain this Python code for a beginner, using this structure:\n" +
          "1. One line starting with '🎯 In short: ' stating what the program does.\n" +
          "2. A '🔍 Walkthrough:' section explaining the important parts step by step (group repetitive lines; explain WHY each part exists, not just WHAT it says).\n" +
          "3. A '💡 Key concepts:' section listing each Python idea used with one short line each.\n" +
          "Keep the whole answer concise. Use short bullet points.\n\nCODE:\n" + (opts.code || "") + (opts.error ? "\n\nERROR:\n" + opts.error : "") + ctxBlock;
        break;
    }
    if (opts.json) {
      prompt += "\n\nReturn ONLY valid JSON, no markdown fences, no explanation.";
      var shapeKey = opts.mode === "viva" ? "viva-" + String(opts.stage || "") : opts.mode;
      var shape = JSON_SHAPES[shapeKey];
      if (shape) prompt += " Return ONLY valid JSON matching this shape: " + shape;
    }
    var ctrl = null, timer = null;
    try {
      ctrl = new AbortController();
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 30000);
    } catch (e) {}
    /* Try each model in turn: 429/503/404 fail over to the next model
       (a model can be retired or rate-limited), 401/403 fail fast —
       the saved key itself is wrong (P2-38). */
    function tryKeyModel(i) {
      if (i >= KEY_MODELS.length) return Promise.reject(new Error("empty"));
      var keyOpts = {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify({ model: KEY_MODELS[i], messages: [{ role: "user", content: prompt }], max_tokens: 1200 })
      };
      if (ctrl) keyOpts.signal = ctrl.signal;
      return fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", keyOpts).then(function (r) {
        if (!r.ok) {
          if (r.status === 401 || r.status === 403) {
            var bad = new Error("Your saved API key was rejected.");
            bad.code = "BAD_KEY";
            throw bad;
          }
          if ((r.status === 429 || r.status === 503 || r.status === 404) && i + 1 < KEY_MODELS.length) return tryKeyModel(i + 1);
          throw new Error("http-" + r.status);
        }
        return r.json();
      }).then(function (d) {
        var t = (d.choices && d.choices[0] && d.choices[0].message) ? d.choices[0].message.content : "";
        if (!t) {
          if (i + 1 < KEY_MODELS.length) return tryKeyModel(i + 1);
          throw new Error("empty");
        }
        if (timer) clearTimeout(timer);
        return { explanation: t, via: "key" };
      });
    }
    return tryKeyModel(0).catch(function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  }
  function friendlyError(e) {
    var code = (e && e.code) || "";
    var msg = (e && typeof e.message === "string" && e.message) ? e.message : "";
    if (code === "DAILY_CAP") {
      // The server's message already carries the right cap (5/day signed
      // out, 10/day signed in) — keep it verbatim. Never hardcode a number
      // in the fallback.
      if (msg) return { code: code, message: msg };
      return { code: code, message: "You've used your AI answers for today — they reset tomorrow." };
    }
    if (code === "POOL_CAP") {
      // The shared learner pool is used up for today. The server's
      // message carries the pool size — keep it verbatim. Signing in
      // does NOT refill the pool (it binds everyone), so this code
      // never gets the sign-in capLink.
      if (msg) return { code: code, message: msg };
      return { code: code, message: "Skillzify's AI pool for today is used up — it resets tomorrow." };
    }
    if (code === "QUOTA") return { code: code, message: "The AI is out of quota right now. Try again in a bit." };
    if (code === "OVERLOADED" || code === "TIMEOUT") return { code: code, message: "The AI is busy or slow to wake on the free tier. Try again in a moment." };
    if (code === "KEY_ERROR" || code === "MODEL_NOT_FOUND") return { code: code, message: "The AI backend needs attention (configuration problem)." };
    if (code === "BAD_KEY") return { code: code, message: "Your saved API key was rejected — check it in Code Studio → AI Settings." };
    // Anything else (RATE_LIMIT, NOT_CONFIGURED, BAD_JSON, EMPTY_REPLY,
    // MODEL_ERROR, ...): the server's message, verbatim, when it has one.
    if (msg) return { code: code || "UNREACHABLE", message: msg };
    return { code: code || "UNREACHABLE", message: "The AI backend didn't answer — it's probably still waking up on the free tier. Try again in a moment." };
  }

  /* ---------------- queue + main entry ---------------- */
  var queue = [], busy = false;
  // A callback that throws must never wedge the queue: always advance.
  function safeCb(cb, err, res) {
    try { cb(err, res); } catch (e) { try { console.error(e); } catch (e2) {} }
  }
  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    var job = queue.shift();
    function next() { busy = false; pump(); }
    try { runJob(job).then(next, next); } catch (e) { next(); }
  }
  function runJob(job) {
    var opts = job.opts, cb = job.cb;
    setStatus("working");
    // P2-54: wait until Firebase has restored the session before the
    // uid is resolved — an early tap must not burn the anonymous cap.
    return whenAuthReady().then(function () { return idToken(); }).then(function (tok) {
    // Resolve the learner context ONCE: the cache key and the payload
    // must see the same string (opts.extra folds in via buildContext).
    var ctx = String(opts.context || buildContext(opts.extra)).slice(0, 2000);
    // P2-49: the uid is part of the cache key — the same question from
    // two users (or anon vs signed-in) must never share an entry.
    var key = hash(JSON.stringify({ u: uid(), m: opts.mode, c: opts.code, e: opts.error, x: ctx }));
    var cached = (opts.cache !== false && !opts.json) ? cacheGet(key) : null;
    if (cached) {
      setStatus("ok");
      // Item 8a (round 4): flag cache hits so surfaces can show a
      // "(cached)" note. Copy — never mutate the stored entry, so the
      // first (fresh) delivery keeps no flag.
      var hit = {};
      for (var ck in cached) { if (Object.prototype.hasOwnProperty.call(cached, ck)) hit[ck] = cached[ck]; }
      hit.cached = true;
      safeCb(cb, null, hit);
      return;
    }
    var payload = {
      mode: opts.mode || "",
      stage: String(opts.stage || ""),
      code: String(opts.code || "").slice(0, 8000),
      error: String(opts.error || "").slice(0, 2000),
      context: ctx,
      uid: uid(),
      email: email(),
      token: tok,
      json: !!opts.json
    };
    return backendAsk(payload, 0).then(function (d) {
      var res = { text: d.explanation, via: "backend" };
      if (opts.json && d.json != null) res.data = d.json;
      if (opts.cache !== false && !opts.json) cacheSet(key, res);
      setStatus("ok");
      safeCb(cb, null, res);
    }).catch(function (be) {
      // Fallback 2: the user's own key, straight to Google.
      return personalKeyAsk(opts, payload).then(function (d) {
        var res = { text: d.explanation, via: "key" };
        if (opts.json) {
          try { res.data = JSON.parse(d.explanation.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim()); }
          catch (e) { res.data = null; }
        }
        setStatus("ok");
        safeCb(cb, null, res);
      }).catch(function (ke) {
        // A rejected personal key must surface as itself (P2-38), not
        // fall through to the generic offline heuristic.
        if (ke && ke.code === "BAD_KEY") {
          setStatus("offline");
          safeCb(cb, friendlyError(ke), null);
          return;
        }
        // DAILY_CAP / POOL_CAP / RATE_LIMIT must reach the student verbatim — never
        // let the offline heuristic mask them with generic tips, even
        // when opts.error matches a heuristic rule. (A saved personal
        // key already had its chance above and bypasses the cap.)
        if (be && (be.code === "DAILY_CAP" || be.code === "POOL_CAP" || be.code === "RATE_LIMIT")) {
          setStatus("offline");
          safeCb(cb, friendlyError(be), null);
          return;
        }
        // Fallback 3: offline heuristic — only meaningful for errors.
        if (opts.error) {
          var h = explainError(opts.error);
          if (h) {
            setStatus("degraded");
            safeCb(cb, null, { text: explainErrorText(opts.error), via: "offline", offline: true });
            return;
          }
        }
        setStatus("offline");
        safeCb(cb, friendlyError(be), null);
      });
    });
    });
  }
  function ask(opts, cb) {
    if (typeof cb !== "function") cb = function () {};
    queue.push({ opts: opts || {}, cb: cb });
    pump();
  }

  /* ---------------- warmup ---------------- */
  var warmed = false, warming = false, warmWaiters = [];
  function flushWarm(ok) {
    // In-flight guard reset + queued callbacks answered with the first
    // ping's result. A failed ping leaves `warmed` false, so a later
    // warmup() call can retry with a fresh fetch.
    warming = false;
    var ws = warmWaiters; warmWaiters = [];
    for (var i = 0; i < ws.length; i++) { try { ws[i](ok); } catch (e) {} }
  }
  function warmup(cb) {
    if (warmed) { if (cb) cb(true); return; }
    // While a ping is outstanding, queue the callback instead of firing
    // a second GET /api/health (warmup() runs on script load AND again
    // on DOMContentLoaded from practice.js / compiler.js).
    if (warming) { if (cb) warmWaiters.push(cb); return; }
    warming = true;
    setStatus("waking");
    var ctrl = null, timer = null;
    try {
      ctrl = new AbortController();
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 45000); // cold start is 30-60s; 10s near-always "failed"
    } catch (e) {}
    var opts = {};
    if (ctrl) opts.signal = ctrl.signal;
    fetch(BASE + "/api/health", opts).then(function (r) {
      if (timer) clearTimeout(timer);
      // P2-55: r.ok is only the HTTP status — the body field `ai` says
      // whether a Gemini key is configured. With no key the status dot
      // used to show green "AI ready" while every call failed with
      // NOT_CONFIGURED. Status is ok only when the health body has
      // ai: true; anything else leaves `warmed` false, so a later
      // warmup() call can retry with a fresh fetch.
      return r.json().catch(function () { return {}; }).then(function (d) {
        var ok = r.ok && d && d.ai === true;
        warmed = ok;
        setStatus(ok ? "ok" : "offline");
        // Item 5 (round 4): guard the initiating callback like flushWarm
        // does — a throwing callback must not skip flushWarm and strand
        // the queued waiters with `warming` stuck true.
        if (cb) { try { cb(ok); } catch (e) {} }
        flushWarm(ok);
      });
    }).catch(function () {
      if (timer) clearTimeout(timer);
      setStatus("offline");
      if (cb) { try { cb(false); } catch (e) {} }
      flushWarm(false);
    });
  }
  // Wake the free instance as soon as the page loads, so the first
  // real question doesn't pay the cold-start wait.
  try { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { warmup(); }); else warmup(); } catch (e) {}

  window.SkillzifyAI = {
    ask: ask,
    warmup: warmup,
    capLink: capLink,
    usage: usage,
    buildContext: buildContext,
    explainError: explainError,
    explainErrorHTML: explainErrorHTML,
    getStatus: function () { return status; },
    attachStatus: attachStatus
  };
})();
