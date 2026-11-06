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
   are absent (flowchart-test.html). Exposes window.SkillzifyAI.
   ============================================================ */
(function () {
  "use strict";

  var API_BASE = "https://skillzify-v2.onrender.com";
  var KEY_STORE = "skillzify_ai_key";
  var MODEL = "gemini-3.8-flash";
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
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
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

  // Sign-in link for DAILY_CAP errors — shown ONLY to signed-out
  // users. A signed-in user who hit the 50/day cap gets the plain
  // server message with no link (the link would just bounce them to
  // auth.html and back to the dashboard). All DAILY_CAP error sites
  // must go through this helper; none hardcodes the link anymore.
  function capLink() {
    return uid() ? "" : ' <a href="auth.html">Sign in for 50 AI answers/day</a>';
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
  function cacheGet(key) {
    if (!Object.prototype.hasOwnProperty.call(cache, key)) return null;
    var e = cache[key];
    if (!e || (Date.now() - e.at) > CACHE_TTL) { delete cache[key]; var i = cacheOrder.indexOf(key); if (i >= 0) cacheOrder.splice(i, 1); return null; }
    return e.val;
  }
  function cacheSet(key, val) {
    if (cacheOrder.indexOf(key) < 0) { cacheOrder.push(key); if (cacheOrder.length > 40) delete cache[cacheOrder.shift()]; }
    cache[key] = { at: Date.now(), val: val };
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
    return fetchJSON(BASE + "/api/explain", payload, 60000).then(function (res) {
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
      if (attempt < 1 && (e.name === "AbortError" || e.name === "TypeError")) {
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
    var prompt = opts.mode === "generate" ? "Write Python code for: " + (opts.code || "")
      : opts.mode === "fix" ? "Fix this Python code. Error: " + (opts.error || "") + "\n\n" + (opts.code || "")
      : opts.mode === "flowchart" ? "Write ONLY clean, simple Python code that solves this problem. Output raw code only:\n\n" + (opts.code || "")
      : "Explain this Python code for a beginner. Code:\n" + (opts.code || "") + (opts.error ? "\nError:\n" + opts.error : "");
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
    var keyOpts = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }], max_tokens: 1200 })
    };
    if (ctrl) keyOpts.signal = ctrl.signal;
    return fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", keyOpts).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.json();
    }).then(function (d) {
      var t = (d.choices && d.choices[0] && d.choices[0].message) ? d.choices[0].message.content : "";
      if (!t) throw new Error("empty");
      return { explanation: t, via: "key" };
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  }
  function friendlyError(e) {
    var code = (e && e.code) || "";
    var msg = (e && typeof e.message === "string" && e.message) ? e.message : "";
    if (code === "DAILY_CAP") {
      // The server's message already carries the right cap (10/day signed
      // out, 50/day signed in) — keep it verbatim. Never hardcode a number
      // in the fallback.
      if (msg) return { code: code, message: msg };
      return { code: code, message: "You've used your AI answers for today — they reset tomorrow." };
    }
    if (code === "QUOTA") return { code: code, message: "The AI is out of quota right now. Try again in a bit." };
    if (code === "OVERLOADED" || code === "TIMEOUT") return { code: code, message: "The AI is busy or slow to wake on the free tier. Try again in a moment." };
    if (code === "KEY_ERROR" || code === "MODEL_NOT_FOUND") return { code: code, message: "The AI backend needs attention (configuration problem)." };
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
    // Resolve the learner context ONCE: the cache key and the payload
    // must see the same string (opts.extra folds in via buildContext).
    var ctx = String(opts.context || buildContext(opts.extra)).slice(0, 2000);
    var key = hash(JSON.stringify({ m: opts.mode, c: opts.code, e: opts.error, x: ctx }));
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
      return Promise.resolve();
    }
    var payload = {
      mode: opts.mode || "",
      stage: String(opts.stage || ""),
      code: String(opts.code || "").slice(0, 8000),
      error: String(opts.error || "").slice(0, 2000),
      context: ctx,
      uid: uid(),
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
      }).catch(function () {
        // DAILY_CAP / RATE_LIMIT must reach the student verbatim — never
        // let the offline heuristic mask them with generic tips, even
        // when opts.error matches a heuristic rule. (A saved personal
        // key already had its chance above and bypasses the cap.)
        if (be && (be.code === "DAILY_CAP" || be.code === "RATE_LIMIT")) {
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
      warmed = r.ok;
      setStatus(r.ok ? "ok" : "offline");
      // Item 5 (round 4): guard the initiating callback like flushWarm
      // does — a throwing callback must not skip flushWarm and strand
      // the queued waiters with `warming` stuck true.
      if (cb) { try { cb(r.ok); } catch (e) {} }
      flushWarm(r.ok);
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
    buildContext: buildContext,
    explainError: explainError,
    explainErrorText: explainErrorText,
    explainErrorHTML: explainErrorHTML,
    getStatus: function () { return status; },
    onStatus: onStatus,
    attachStatus: attachStatus,
    apiBase: API_BASE
  };
})();
