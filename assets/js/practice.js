/* ============================================================
   Skillzify Practice Mode — practice.js
   Test-driven Python exercises: write code, run hidden tests,
   progressive hints, AI tutor, XP, timed mode, daily challenge.
   Expects window.SkillzifyPracticeData (practice-data.js).
   ============================================================ */
(function () {
  "use strict";

  var EX = window.SkillzifyPracticeData || [];
  var A = window.SkillzifyActivity;
  var S = window.Skillzify;
  var ATT_KEY = "skillzify_exercise_attempts";

  var TOPICS = ["variables", "strings", "collections", "loops", "functions", "oop", "exceptions", "dsa", "recursion", "sorting", "trees-graphs", "dynamic-programming", "data-science", "web", "files", "testing", "async"];
  // P2-22: labels come from the canonical copy in mastery.js
  // (SkillzifyMastery.TOPIC_LABELS — mastery.js loads before this file
  // on practice.html). The {} fallback only covers a failed mastery.js
  // load; every label lookup below falls back to the topic id itself.
  var TOPIC_LABEL = (window.SkillzifyMastery && window.SkillzifyMastery.TOPIC_LABELS) || {};
  var KIND_LABEL = { code: "✍️ Write code", predict: "🔮 Predict output", fix: "🐞 Fix the bug" };

  function esc(s) { return S.esc(s == null ? "" : String(s)); }
  function $(id) { return document.getElementById(id); }

  /* ---------------- Pyodide runtime ---------------- */
  var pyodide = null, pyLoading = false, pyQueue = [], pyTimeout = null, pyScriptAppended = false;
  function ensurePyodide(cb) {
    if (pyodide) { cb(true); return; }
    pyQueue.push(cb);
    // A <script> tag is already appended and unresolved — queue the
    // callback, do NOT append a second tag. This holds even after the
    // phase-1 timeout fired: finish(false) resets pyLoading while the
    // original <script> may still be in flight, so pyLoading alone
    // cannot tell a fresh call that a load is pending.
    if (pyLoading || pyScriptAppended) return;
    pyLoading = true;
    var done = false;
    function drain(ok) {
      var q = pyQueue; pyQueue = [];
      q.forEach(function (c) { try { c(ok); } catch (e) {} });
    }
    function finish(ok) {
      if (done) return; // a late load after the timeout must not double-fire
      done = true;
      if (pyTimeout) { clearTimeout(pyTimeout); pyTimeout = null; }
      pyLoading = false;
      drain(ok);
    }
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
    script.onload = function () {
      pyScriptAppended = false;
      // Phase 1 done: the script fetched. Phase 2 gives loadPyodide()
      // its own 45s — cold init takes 30s+ on first visit, so a single
      // 20s timer over both phases false-fired on normal first loads.
      // (If phase 1 already timed out, done is true: skip the phase-2
      // timer but still init, so a late load sets pyodide for later calls.)
      if (pyTimeout) { clearTimeout(pyTimeout); pyTimeout = null; }
      if (!done) pyTimeout = setTimeout(function () { finish(false); }, 45000);
      window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" }).then(function (py) {
        pyodide = py;
        // Phase-1 timeout already fired: finish() is spent, so drain
        // callbacks queued after it directly (each fires exactly once).
        if (done) { drain(true); return; }
        finish(true);
      }).catch(function () {
        if (done) { drain(false); return; }
        finish(false);
      });
    };
    script.onerror = function () {
      pyScriptAppended = false;
      // Phase-1 timeout already fired: finish() is spent, so drain
      // callbacks queued after it directly (each fires exactly once).
      if (done) { drain(false); return; }
      finish(false);
    };
    pyScriptAppended = true;
    document.head.appendChild(script);
    // Phase 1: stalled CDN — neither onload nor onerror may ever fire.
    // Without this, queued callers (e.g. drill verification) wait forever.
    pyTimeout = setTimeout(function () { finish(false); }, 20000);
  }

  /* ---------------- Attempts + XP ---------------- */
  function getAttempts() { var a = S.storeGet(ATT_KEY, {}); return (a && typeof a === "object") ? a : {}; }
  function saveAttempts(a) { S.storeSet(ATT_KEY, a); }

  /* Drills (AI-generated + AI daily challenge) live in their own store
     so they never pollute the exercise attempts / sync data. */
  var DRILL_KEY = "skillzify_drills";
  function isDrillId(id) { return typeof id === "string" && id.indexOf("drill-") === 0; }
  function getDrills() { try { var d = JSON.parse(localStorage.getItem(DRILL_KEY) || "{}"); return (d && typeof d === "object") ? d : {}; } catch (e) { return {}; } }
  function saveDrills(d) { try { localStorage.setItem(DRILL_KEY, JSON.stringify(d)); } catch (e) {} }
  function drillDefaults() { return { attempts: 0, solved: false, hintsUsed: 0, revealed: false, bestMs: 0, lastTry: 0, xpEarned: 0 }; }

  /* Drill definitions: attempts (skillzify_drills) record solves, but
     the drill object itself was never stored, so a generated drill
     vanished on reload and never appeared in any list. Definitions
     live here, capped at 20 (oldest dropped). */
  var DRILL_DEF_KEY = "skillzify_drill_defs";
  var DRILL_DEF_MAX = 20;
  function getDrillDefs() { try { var d = JSON.parse(localStorage.getItem(DRILL_DEF_KEY) || "{}"); return (d && typeof d === "object") ? d : {}; } catch (e) { return {}; } }
  function saveDrillDef(drill) {
    if (!drill || !isDrillId(drill.id)) return;
    try {
      var defs = getDrillDefs();
      // Re-saving an existing id must refresh its insertion-order
      // position, or a recently re-opened old drill is still evicted
      // as "oldest" when the 20-cap is hit (and its XP is lost from
      // the stats line). Delete first, then re-assign → newest.
      delete defs[drill.id];
      defs[drill.id] = drill;
      var keys = Object.keys(defs);
      while (keys.length > DRILL_DEF_MAX) {
        /* Evict the oldest UNSOLVED drill first — a solved drill's XP
           is earned progress, not dead weight (P2-18). Only when every
           drill is solved does the oldest solved one go. */
        var drills = getDrills();
        var unsolved = keys.filter(function (k) { return !(drills[k] && drills[k].solved); });
        var victim = unsolved.length ? unsolved[0] : keys[0];
        var title = defs[victim] && defs[victim].title;
        delete defs[victim];
        /* D-14: evicting the definition must also drop its attempts
           record, or the orphan keeps counting in the stats line
           (renderStats iterates the attempts store, not the defs). */
        delete drills[victim];
        saveDrills(drills);
        keys = Object.keys(defs);
        try { if (window.Skillzify && window.Skillzify.toast) window.Skillzify.toast("Dropped your oldest drill" + (title ? " (“" + title + "”)" : "") + " — the drill shelf holds 20."); } catch (e) {}
      }
      localStorage.setItem(DRILL_DEF_KEY, JSON.stringify(defs));
    } catch (e) {}
  }

  function attFor(id) {
    if (isDrillId(id)) return getDrills()[id] || drillDefaults();
    return getAttempts()[id] || { attempts: 0, solved: false, hintsUsed: 0, revealed: false, bestMs: 0, lastTry: 0, xpEarned: 0 };
  }
  function setAtt(id, patch) {
    if (isDrillId(id)) {
      // Drill attempts/solves stay in the drills store — never in ATT_KEY.
      var drills = getDrills();
      var dcur = drills[id] || drillDefaults();
      var wasSolved = dcur.solved;
      // P1-04: once solved, the record is frozen for quality purposes —
      // re-solves must not raise attempts and a post-solve reveal must
      // not set revealed (the solve-time quality snapshot below is what
      // mastery scores). Other fields still apply.
      var dp = patch;
      if (wasSolved) {
        dp = {};
        Object.keys(patch).forEach(function (k) {
          if (k === "attempts" || k === "revealed") return;
          dp[k] = patch[k];
        });
      }
      Object.keys(dp).forEach(function (k) { dcur[k] = dp[k]; });
      dcur.lastTry = Date.now();
      if (dp.solved && !wasSolved) { dcur.at = Date.now(); dcur.solveQuality = solveQualityFor(dcur); }
      drills[id] = dcur; saveDrills(drills);
      return dcur;
    }
    var all = getAttempts();
    var cur = all[id] || { attempts: 0, solved: false, hintsUsed: 0, revealed: false, bestMs: 0, lastTry: 0, xpEarned: 0 };
    var wasSolvedEx = cur.solved;
    // P1-04: same freeze as the drill branch above — a solved record
    // never takes a higher attempts count or a post-solve revealed flag.
    var ep = patch;
    if (wasSolvedEx) {
      ep = {};
      Object.keys(patch).forEach(function (k) {
        if (k === "attempts" || k === "revealed") return;
        ep[k] = patch[k];
      });
    }
    Object.keys(ep).forEach(function (k) { cur[k] = ep[k]; });
    cur.lastTry = Date.now();
    // Passport §4c: first-solve time, mirroring the drill branch
    // above. wasSolvedEx gates it, so a re-solve never moves `at`.
    if (ep.solved && !wasSolvedEx) { cur.solveQuality = solveQualityFor(cur); cur.at = Date.now(); }
    all[id] = cur; saveAttempts(all);
    if (window.SkillzifySync) window.SkillzifySync.markDirty();
    return cur;
  }

  /* ---------------- Draft code persistence ---------------- */
  var DRAFT_KEY = "skillzify_exercise_drafts";
  function getDrafts() { try { var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); return (d && typeof d === "object") ? d : {}; } catch (e) { return {}; } }
  function getDraft(id) { var d = getDrafts(); return d[id] != null ? d[id] : null; }
  function saveDraft(id, code) {
    try { var d = getDrafts(); d[id] = code; localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
  }
  function clearDraft(id) {
    try { var d = getDrafts(); delete d[id]; localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
  }

  /* P1-04: quality frozen at solve time. Snapshot from the merged
     record the moment solved flips false -> true: revealed 0.4,
     hinted or >1 attempt 0.7, clean first-try 1.0. mastery.js reads
     `solveQuality` and ignores later mutations of the record. */
  function solveQualityFor(a) {
    if (a.revealed) return 0.4;
    if ((a.hintsUsed || 0) > 0 || (a.attempts || 0) > 1) return 0.7;
    return 1.0;
  }
  /* XP award: no-hint bonus (1.25x), revealed solution halves it */
  function xpForSolve(ex, a) {
    var gain = ex.xp;
    if (a.hintsUsed === 0 && !a.revealed) gain = Math.round(gain * 1.25);
    if (a.revealed) gain = Math.round(gain * 0.5);
    return gain;
  }
  function nextUnsolvedId() {
    var atts = getAttempts();
    for (var i = 0; i < EX.length; i++) {
      var a = atts[EX[i].id];
      if (!a || !a.solved) return EX[i].id;
    }
    return null;
  }
  function nextButtonHtml() {
    var nid = nextUnsolvedId();
    return nid ? '<p style="margin-top:12px"><a class="btn btn-sm" href="#ex=' + nid + '">Next exercise →</a></p>' : "";
  }
  function addXP(n, label) {
    try {
      var xp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0;
      xp += n; localStorage.setItem("skillzify_xp", String(xp));
    } catch (e) {}
    if (A && A.log) A.log("xp", "+" + n + " XP — " + label);
    if (A && A.checkAchievements) { try { A.checkAchievements(); } catch (e) {} }
  }

  /* ---------------- Test runner ---------------- */
  function runCodeTests(ex, code, done) {
    ensurePyodide(function (ok) {
      // P1-08: flag a runtime-load failure so submitCode can tell it
      // apart from a real failed attempt — it must not count.
      if (!ok) { done({ error: "Python runtime failed to load. Check your connection and try again.", runtime: true }); return; }
      // P2-13: the solve clock starts HERE, once Pyodide is ready —
      // not before runCodeTests, so a 30s+ cold load never counts
      // toward "best time". Passed to done() as the 2nd argument.
      var tStart = Date.now();
      var results = [];
      try {
        for (var i = 0; i < ex.tests.length; i++) {
          var t = ex.tests[i];
          var prog = code +
            "\ntry:\n    __sz_out = str((" + t.run + "))\n" +
            "except Exception as __sz_e:\n    __sz_out = 'ERROR:' + type(__sz_e).__name__ + ': ' + str(__sz_e)\n";
          pyodide.runPython(prog);
          var got = String(pyodide.globals.get("__sz_out"));
          var isErr = got.indexOf("ERROR:") === 0;
          // expectError: passes only when the code raises the expected error
          var pass = t.expectError != null
            ? (isErr && got.trim() === String(t.expectError).trim())
            : (!isErr && got.trim() === String(t.expect).trim());
          results.push({ pass: pass, got: got, expect: String(t.expectError != null ? t.expectError : t.expect), run: t.run, error: isErr ? got.slice(6) : null });
        }
      } catch (e) {
        done({ error: "Your code crashed before the tests could run: " + String(e).split("\n").pop() }, tStart);
        return;
      }
      done({ results: results }, tStart);
    });
  }

  /* ---------------- Daily challenge + revision ---------------- */
  function dailyExercise() {
    if (!EX.length) return null;
    var day = Math.floor(Date.now() / 864e5);
    return EX[day % EX.length];
  }
  function revisionQueue() {
    var atts = getAttempts();
    return EX.filter(function (ex) {
      var a = atts[ex.id];
      return a && a.attempts > 0 && !a.solved;
    }).sort(function (x, y) {
      return (atts[x.id].lastTry || 0) - (atts[y.id].lastTry || 0);
    });
  }
  function solvedCount() {
    var atts = getAttempts(), n = 0;
    EX.forEach(function (ex) { if (atts[ex.id] && atts[ex.id].solved) n++; });
    return n;
  }

  /* ============================================================
     F2 — ADAPTIVE DRILLS (AI-generated, verified before showing)
     Drills are shaped like exercises but are NOT added to EX and
     never touch the exercise attempts store (see setAtt guard).
     ============================================================ */
  function weakestTopics() {
    var atts = getAttempts(), byTopic = {};
    EX.forEach(function (ex) {
      var a = atts[ex.id];
      if (a && a.attempts > 0 && !a.solved) {
        var t = byTopic[ex.topic] || (byTopic[ex.topic] = { topic: ex.topic, attempts: 0, exercises: [] });
        t.attempts += a.attempts;
        t.exercises.push({ title: ex.title, attempts: a.attempts });
      }
    });
    var arr = Object.keys(byTopic).map(function (k) { return byTopic[k]; });
    arr.sort(function (x, y) { return y.attempts - x.attempts; });
    return arr;
  }

  function renderDrillCard() {
    var host = $("drill-card");
    if (!host) return;
    var weak = weakestTopics();
    var html = '<h2 class="section-title" style="font-size:1.3rem">🎯 Drill my weak spots</h2>' +
      '<p class="hint">The AI writes a fresh exercise targeting the topics you keep missing — then proves it works before you see it.</p>';
    if (!weak.length) {
      html += '<p class="hint">Solve a few exercises first — your weak spots will show up here.</p>' +
        '<button class="btn" data-drill-topic="variables">Generate a beginner drill</button>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">' +
        weak.slice(0, 3).map(function (w) {
          return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
            '<span class="badge" style="color:' + topicColor(w.topic) + ';border-color:' + topicColor(w.topic) + '66">' + esc(TOPIC_LABEL[w.topic] || w.topic) + '</span>' +
            '<span class="hint" style="flex:1">' + w.attempts + ' unsolved attempt' + (w.attempts > 1 ? 's' : '') +
            ' across ' + w.exercises.length + ' exercise' + (w.exercises.length > 1 ? 's' : '') + '</span>' +
            '<button class="btn btn-sm" data-drill-topic="' + esc(w.topic) + '">Generate a drill</button></div>';
        }).join("") + '</div>';
    }
    html += '<div id="drill-status" style="margin-top:12px"></div>';
    html += '<div id="my-drills" style="margin-top:16px"></div>';
    host.innerHTML = html;
    host.querySelectorAll("[data-drill-topic]").forEach(function (b) {
      b.addEventListener("click", function () { generateDrill(b.getAttribute("data-drill-topic")); });
    });
    renderSavedDrills();
  }

  /* Saved drills (skillzify_drill_defs) with a Solved badge from the
     attempts store — re-openable through the existing openDrill path. */
  function renderSavedDrills() {
    var host = $("my-drills");
    if (!host) return;
    var defs = getDrillDefs();
    var drills = getDrills();
    var ids = Object.keys(defs);
    if (!ids.length) { host.innerHTML = ""; return; }
    host.innerHTML = '<h3 style="margin:0 0 8px;font-size:1rem">🤖 Your AI drills</h3>' +
      ids.map(function (id) {
        var raw = defs[id];
        var d = (raw && typeof raw === "object") ? raw : {};
        var solved = !!(drills[id] && drills[id].solved);
        return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--border, #e5e7eb)">' +
          '<span style="flex:1"><strong>' + esc(d.title || id) + '</strong> <span class="hint">' + esc(TOPIC_LABEL[d.topic] || d.topic || "") + '</span></span>' +
          (solved ? '<span class="badge badge-done">✓ Solved</span>' : "") +
          '<button class="btn btn-sm btn-ghost" data-open-drill="' + esc(id) + '">Open</button></div>';
      }).join("");
    host.querySelectorAll("[data-open-drill]").forEach(function (b) {
      b.addEventListener("click", function () {
        var raw = getDrillDefs()[b.getAttribute("data-open-drill")];
        var drill = normalizeDrill(raw, (raw && raw.topic) || "practice", b.getAttribute("data-open-drill"));
        if (drill) openDrill(drill);
      });
    });
  }

  function setDrillBusy(busy) {
    var host = $("drill-card");
    if (!host) return;
    host.querySelectorAll("button").forEach(function (b) { b.disabled = busy; });
  }

  /* Shape + validate AI drill JSON into an exercise-like object.
     Returns null when the shape is unusable. id is supplied by the
     caller ("drill-<timestamp>" or "drill-daily-<date>"). */
  function normalizeDrill(data, topic, id) {
    if (!data || typeof data !== "object") return null;
    if (typeof data.title !== "string" || !data.title.trim()) return null;
    if (typeof data.prompt !== "string" || !data.prompt.trim()) return null;
    if (typeof data.solution !== "string" || !data.solution.trim()) return null;
    if (typeof data.starter !== "string") return null;
    if (!Array.isArray(data.tests) || data.tests.length < 1 || data.tests.length > 4) return null;
    for (var i = 0; i < data.tests.length; i++) {
      var t = data.tests[i];
      if (!t || typeof t.run !== "string" || !t.run.trim()) return null;
      if (typeof t.expect !== "string") return null;
    }
    var hints = Array.isArray(data.hints) ? data.hints.filter(function (h) { return typeof h === "string"; }) : [];
    if (!hints.length) return null;
    var diff = parseInt(data.difficulty, 10);
    if (!(diff >= 1 && diff <= 3)) diff = 2;
    return {
      id: id,
      topic: topic,
      difficulty: diff,
      kind: "code",
      title: data.title.trim(),
      prompt: data.prompt.trim(),
      starter: data.starter,
      tests: data.tests,
      hints: hints,
      solution: data.solution,
      walkthrough: typeof data.walkthrough === "string" ? data.walkthrough : "",
      pythonic: typeof data.pythonic === "string" ? data.pythonic : "",
      xp: diff * 10
    };
  }

  /* Best-effort static guard: an unbounded `while True:` / `while 1:`
     loop with no loop exit would hang the tab, because runPython has
     no timeout. Comments and string literals are stripped first, so
     a `while True:` in a comment/string (or a `break` in one) no
     longer counts; `break`, `return` or `raise` all count as exits,
     and `while True` with a trailing condition (e.g. `while True and
     keep_going:`) is caught too. This is NOT a guarantee — a loop
     can still hang in other ways — it only rejects the clear pattern,
     and it gates drill display only, never student code. */
  function hasUnboundedLoop(code) {
    var stripped = String(code || "")
      .replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '""')
      .replace(/("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/g, '""')
      .replace(/#.*/g, "");
    if (!/while\s+(True|1)\b/.test(stripped)) return false;
    return !/\b(break|return|raise)\b/.test(stripped);
  }

  /* Mandatory gate: the drill's own solution must pass ALL of its
     tests in the real Pyodide runner before the drill is shown.
     done(ok, reason) — reason is "runtime" when the Python runtime
     itself failed to load (drill never tested) and "broken" when the
     drill's own solution failed or was rejected. */
  function verifyDrill(drill, done) {
    if (hasUnboundedLoop(drill.solution)) { done(false, "broken"); return; }
    runCodeTests(drill, drill.solution, function (out) {
      if (out.error) { done(false, !pyodide ? "runtime" : "broken"); return; }
      if (!out.results || !out.results.length) { done(false, "broken"); return; }
      var allPass = out.results.every(function (r) { return r.pass; });
      done(allPass, allPass ? null : "broken");
    });
  }

  /* Render a drill through the EXISTING exercise detail view. */
  /* The hero stats card lives outside #practice-list, so the
     list/detail toggle does not hide it — hide it explicitly in
     detail view (it is empty there: renderStats only runs in the
     list view) and restore it when back on the list. */
  function setStatsCard(show) {
    var c = $("practice-stats-card");
    if (c) c.style.display = show ? "" : "none";
  }
  function openDrill(ex) {
    saveDrillDef(ex); // persist the definition so the drill survives reload
    cur = ex;
    stopTimer();
    setStatsCard(false);
    $("practice-list").style.display = "none";
    $("practice-detail").style.display = "";
    renderDetail();
    window.scrollTo(0, 0);
  }

  function generateDrill(topic) {
    var AI = window.SkillzifyAI;
    var status = $("drill-status");
    if (!AI) {
      if (status) status.innerHTML = '<p class="hint">The AI module didn\'t load. Reload the page and try again.</p>';
      return;
    }
    var entry = null;
    weakestTopics().forEach(function (w) { if (w.topic === topic) entry = w; });
    /* No weak spot for this topic (e.g. a brand-new user): still allow
       a beginner drill instead of silently returning (P2-15). */
    if (!entry) entry = { topic: topic, attempts: 0, exercises: [] };
    setDrillBusy(true);
    if (status) status.innerHTML = '<p class="hint">🤖 Writing a drill for ' + esc(TOPIC_LABEL[topic] || topic) + '…</p>';
    var summary = "Topic: " + (TOPIC_LABEL[topic] || topic) +
      (entry.exercises.length
        ? ". The student recently failed these exercises (unsolved after trying): " +
          entry.exercises.map(function (e) { return e.title + " (" + e.attempts + " tries)"; }).join("; ") +
          ". Write ONE short drill exercise that targets the same skills and the same common mistakes."
        : ". The student is just starting this topic. Write ONE short beginner drill exercise that introduces the basics.");
    AI.ask({ mode: "drill", json: true, code: summary, extra: { topic: topic } }, function (err, res) {
      if (err) {
        setDrillBusy(false);
        // Sign-in link only when signed out (ai.js capLink returns
        // "" for signed-in users at the 10/day cap).
        var drillCap = (err && err.code === "DAILY_CAP" && AI.capLink)
          ? AI.capLink() : "";
        if (status) status.innerHTML = '<p class="fail">⚠️ ' + esc(err.message || "The AI drill generator is unreachable right now.") + drillCap + '</p>';
        return;
      }
      var drill = normalizeDrill(res && res.data, topic, "drill-" + Date.now());
      if (!drill) {
        setDrillBusy(false);
        if (status) status.innerHTML = '<p class="fail">⚠️ The AI returned a drill I couldn\'t use — try again.</p>';
        return;
      }
      if (status) status.innerHTML = '<p class="hint">🔍 Checking the drill actually runs…</p>';
      verifyDrill(drill, function (ok, reason) {
        setDrillBusy(false);
        if (!ok) {
          if (status) status.innerHTML = '<p class="fail">⚠️ ' +
            (reason === "runtime" ? "Python runtime didn't load — check your connection and try again." : "The AI wrote a broken drill — try again.") + '</p>';
          return;
        }
        openDrill(drill);
      });
    });
  }

  /* ---------------- AI daily challenge intake ----------------
     Dashboard worker stores {date, challenge} under
     "skillzify_daily_challenge" and links to practice.html#challenge.
     Only today's challenge is honoured, and only after the same
     run-the-solution verification as a drill. Anything else falls
     back to the normal list view with a small note. */
  function todayStr() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function challengeFallback(err) {
    showList();
    var n = $("challenge-note");
    if (!n) return;
    n.style.display = "";
    if (err && err.code === "DAILY_CAP") {
      // Sign-in link only when signed out (ai.js capLink returns ""
      // for signed-in users at the 10/day cap).
      n.innerHTML = esc(err.message || "You've used your AI answers for today — they reset tomorrow.") +
        (window.SkillzifyAI && window.SkillzifyAI.capLink ? window.SkillzifyAI.capLink() : "");
    } else {
      n.textContent = "Today's AI challenge wasn't available — pick an exercise below.";
    }
  }
  /* Plain-text weak-spot summary for the AI daily challenge prompt.
     P2-22: the canonical implementation lives in mastery.js
     (SkillzifyMastery.weakSpotsSummary) — this is a thin delegate.
     The solve-rate-only fallback below runs only when mastery.js
     failed to load; it uses the same topicRows math the dashboard
     fallback uses, never the mastery weak/strong lines. */
  function weakSpotsSummary() {
    try {
      var M = window.SkillzifyMastery;
      if (M && typeof M.weakSpotsSummary === "function") return M.weakSpotsSummary(EX, getAttempts());
    } catch (e) {}
    var atts = getAttempts();
    var rows = TOPICS.map(function (t) {
      var tried = 0, solved = 0;
      EX.forEach(function (ex) {
        if (ex.topic !== t) return;
        var a = atts[ex.id];
        if (a && a.attempts > 0) { tried++; if (a.solved) solved++; }
      });
      return { topic: t, label: TOPIC_LABEL[t] || t, tried: tried, solved: solved,
               pct: tried ? Math.round(solved / tried * 100) : null };
    });
    var triedRows = rows.filter(function (r) { return r.tried > 0; })
      .sort(function (a, b) { return a.pct - b.pct || b.tried - a.tried; });
    var untried = rows.filter(function (r) { return r.tried === 0; });
    var unsolved = EX.filter(function (ex) { var a = atts[ex.id]; return a && a.attempts > 0 && !a.solved; });
    var parts = [];
    if (triedRows.length) {
      parts.push("Weakest topic: " + triedRows[0].label + " (" + triedRows[0].pct + "% of " + triedRows[0].tried + " tried).");
      if (triedRows.length > 1) parts.push("Strongest topic: " + triedRows[triedRows.length - 1].label + " (" + triedRows[triedRows.length - 1].pct + "%).");
    }
    if (unsolved.length) {
      parts.push("Unsolved exercises (" + unsolved.length + "): " +
        unsolved.slice(0, 5).map(function (ex) { return ex.title; }).join(", ") + ".");
    }
    if (untried.length) parts.push("Topics not tried yet: " + untried.map(function (r) { return r.label; }).join(", ") + ".");
    if (!parts.length) parts.push("No practice attempts yet — pick a beginner-friendly challenge.");
    return parts.join(" ");
  }
  /* Shared gate: normalize + verify a challenge drill, then open it.
     onFail runs when the challenge is unusable or fails verification.
     onVerified (optional) runs only after verification succeeds —
     callers use it to persist a fetched challenge, so a broken one
     is never stored. */
  function verifyAndOpenChallenge(challenge, onFail, onVerified) {
    showList();
    var note = $("challenge-note");
    if (note) { note.style.display = ""; note.textContent = "⏳ Verifying today's AI challenge…"; }
    var topic = (challenge.topic && typeof challenge.topic === "string") ? challenge.topic : "practice";
    var drill = normalizeDrill(challenge, topic, "drill-daily-" + todayStr());
    if (!drill) { onFail(); return; }
    verifyDrill(drill, function (ok) {
      if (!ok) { onFail(); return; }
      if (onVerified) { try { onVerified(); } catch (e) {} }
      if (note) note.style.display = "none";
      openDrill(drill);
    });
  }
  /* No valid stored challenge for today — fetch a fresh one from the
     AI and run it through the same verify gate. The challenge is
     persisted only inside the verify-success path, never before. */
  function fetchFreshChallenge() {
    showList();
    var note = $("challenge-note");
    if (note) { note.style.display = ""; note.textContent = "🤖 Picking today's challenge for you…"; }
    var AI = window.SkillzifyAI;
    if (!AI) { challengeFallback(); return; }
    AI.ask({
      mode: "challenge",
      json: true,
      code: weakSpotsSummary(),
      context: (AI.buildContext ? AI.buildContext({ note: "Daily challenge." }) : undefined)
    }, function (err, res) {
      if (err || !res || !res.data) { challengeFallback(err); return; }
      verifyAndOpenChallenge(res.data, challengeFallback, function () {
        try { localStorage.setItem("skillzify_daily_challenge", JSON.stringify({ date: todayStr(), challenge: res.data })); } catch (e) {}
      });
    });
  }
  function openDailyChallenge() {
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem("skillzify_daily_challenge") || "null"); } catch (e) { stored = null; }
    if (stored && stored.date === todayStr() && stored.challenge) {
      var topic = (stored.challenge.topic && typeof stored.challenge.topic === "string") ? stored.challenge.topic : "practice";
      if (normalizeDrill(stored.challenge, topic, "drill-daily-" + stored.date)) {
        // Stored challenge is well-shaped: verify it; if verification
        // fails, fetch a fresh one instead of dead-ending.
        verifyAndOpenChallenge(stored.challenge, fetchFreshChallenge);
        return;
      }
    }
    fetchFreshChallenge();
  }

  /* ---------------- AI Tutor ---------------- */
  // Calls go through the shared client (assets/js/ai.js):
  // backend -> personal key. The Socratic rules live in the
  // server's tutor mode; the error field carries the exercise.
  function askTutor(ex, code, failInfo, box) {
    // Disable while the request is in flight: re-clicks would queue
    // duplicate cap-consuming requests. Re-enabled on every path below.
    var askBtn = $("ex-ask");
    if (askBtn) askBtn.disabled = true;
    box.innerHTML = '<p class="hint">🤖 Waking up the AI Tutor…</p>';
    var AI = window.SkillzifyAI;
    if (!AI) {
      if (askBtn) askBtn.disabled = false;
      box.innerHTML = '<h4>🤖 AI Tutor</h4><p class="hint">The AI module didn\'t load. Try a hint above — Hint 3 almost gives it away.</p>';
      return;
    }
    AI.ask({
      mode: "tutor",
      code: "EXERCISE: " + ex.title + "\nPROMPT: " + ex.prompt + "\n\nSTUDENT CODE:\n" + (code || "(empty)"),
      error: "TUTOR MODE — the student's code is not passing. " +
        (failInfo || "No test output yet.") +
        " Act as a Socratic tutor: explain what is likely wrong and give ONE guiding hint toward the fix. " +
        "Do NOT write the full corrected code. Keep it short and encouraging.",
      extra: { exercise: ex.title + " (" + ex.id + ")" }
    }, function (err, res) {
      if (askBtn) askBtn.disabled = false;
      if (err) {
        // Sign-in link only when signed out (ai.js capLink returns
        // "" for signed-in users at the 10/day cap).
        var tutorCap = (err && err.code === "DAILY_CAP" && AI.capLink)
          ? AI.capLink() : "";
        box.innerHTML = '<h4>🤖 AI Tutor</h4><p class="hint">' + esc(err.message || "The AI tutor is unreachable right now.") + tutorCap +
          ' Try a hint above — Hint 3 almost gives it away. Your code and failing tests are still visible to you.</p>';
        return;
      }
      box.innerHTML = '<h4>🤖 AI Tutor' + (res.via === "key" ? " (your key)" : res.via === "offline" ? " (offline)" : "") + (res.cached ? " (cached)" : "") + '</h4>' +
        (res.offline ? "<p class='hint'>Showing the offline explainer instead — this isn't the AI's answer.</p>" : "") +
        '<p>' + esc(res.text || "").replace(/\n/g, "<br>") + "</p>";
    });
  }

  /* ============================================================
     LIST VIEW
     ============================================================ */
  var filters = { topic: "all", difficulty: "all", q: "", unsolved: false };

  function statusBadge(ex) {
    var a = attFor(ex.id);
    if (a.solved) return '<span class="badge badge-done">✓ Solved</span>';
    if (a.attempts > 0) return '<span class="badge badge-try">↻ Attempted</span>';
    return '<span class="badge">New</span>';
  }
  function diffStars(d) { return "★".repeat(d) + "☆".repeat(3 - d); }

  function filtered() {
    var q = filters.q.trim().toLowerCase();
    return EX.filter(function (ex) {
      if (filters.topic !== "all" && ex.topic !== filters.topic) return false;
      if (filters.difficulty !== "all" && String(ex.difficulty) !== String(filters.difficulty)) return false;
      if (filters.unsolved && attFor(ex.id).solved) return false;
      if (q && (ex.title + " " + ex.prompt + " " + ex.topic).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function renderList() {
    var host = $("ex-grid");
    if (!host) return;
    var list = filtered();
    if (!list.length) {
      host.innerHTML = '<p class="hint" style="grid-column:1/-1">No exercises match your filters. Try clearing them.</p>';
      return;
    }
    host.innerHTML = list.map(function (ex) {
      var a = attFor(ex.id);
      var c = topicColor(ex.topic);
      return '<a class="card ex-card" href="#ex=' + ex.id + '" style="border-top:3px solid ' + c + '">' +
        '<div class="ex-top"><span class="badge" style="color:' + c + ';border-color:' + c + '66">' + esc(TOPIC_LABEL[ex.topic] || ex.topic) + '</span>' +
        '<span class="ex-diff" title="Difficulty">' + diffStars(ex.difficulty) + '</span></div>' +
        '<h3>' + esc(ex.title) + '</h3>' +
        '<p class="ex-kind">' + (KIND_LABEL[ex.kind] || ex.kind) + ' · ' + ex.xp + ' XP' +
        (a.bestMs ? ' · ⏱ ' + Math.round(a.bestMs / 1000) + 's best' : '') + '</p>' +
        '<div>' + statusBadge(ex) + '</div>' +
        '</a>';
    }).join("");
    var n = $("ex-count");
    if (n) n.textContent = list.length + " of " + EX.length + " exercises · " + solvedCount() + " solved";
  }

  function renderDaily() {
    var host = $("daily-banner");
    if (!host) return;
    var ex = dailyExercise();
    if (!ex) { host.style.display = "none"; return; }
    var a = attFor(ex.id);
    host.innerHTML =
      '<div class="daily-inner"><div><div class="badge">📅 Today\'s exercise</div>' +
      '<h3>' + esc(ex.title) + '</h3>' +
      '<p class="hint">' + esc(TOPIC_LABEL[ex.topic] || ex.topic) + ' · ' + (KIND_LABEL[ex.kind] || "") + ' · ' + ex.xp + ' XP</p></div>' +
      '<div><a class="btn" href="#ex=' + ex.id + '">' + (a.solved ? "Play again →" : "Start →") + '</a></div></div>';
  }

  function renderRevision() {
    var host = $("revision-row");
    var sec = $("revision-sec");
    if (!host || !sec) return;
    var q = revisionQueue().slice(0, 6);
    if (!q.length) { sec.style.display = "none"; return; }
    sec.style.display = "";
    host.innerHTML = q.map(function (ex) {
      return '<a class="card ex-card mini" href="#ex=' + ex.id + '">' +
        '<span class="badge badge-try">↻ Review</span><h3>' + esc(ex.title) + '</h3>' +
        '<p class="hint">' + esc(TOPIC_LABEL[ex.topic] || ex.topic) + '</p></a>';
    }).join("");
  }

  function renderStats() {
    var host = $("practice-stats");
    if (!host) return;
    var atts = getAttempts(), totalXP = 0;
    EX.forEach(function (ex) {
      var a = atts[ex.id];
      // P2-14: legacy solved records without xpEarned are valued like
      // xpForSolve values a live solve: a no-hint, unrevealed,
      // single-attempt solve earns 1.25x; a reveal halves it.
      if (a && a.solved) totalXP += a.xpEarned || Math.round(ex.xp *
        (a.revealed ? 0.5 : (a.revealed === false && a.hintsUsed === 0 && a.attempts === 1 ? 1.25 : 1)));
    });
    // AI drills solved: N · +X XP (from the drills attempts store and
    // the saved drill definitions — never merged into the 150-exercise counts).
    var drills = getDrills(), defs = getDrillDefs(), drillSolved = 0, drillXP = 0;
    Object.keys(drills).forEach(function (id) {
      if (drills[id] && drills[id].solved) {
        drillSolved++;
        // P1-09: report the XP actually awarded (quality-adjusted,
        // stored as xpEarned on the drill record) — def.xp is only the
        // fallback for legacy records that predate xpEarned.
        var earned = drills[id] && drills[id].xpEarned;
        if (typeof earned === "number") drillXP += earned;
        else {
          var def = defs[id];
          if (def && typeof def === "object" && typeof def.xp === "number") drillXP += def.xp;
        }
      }
    });
    host.innerHTML =
      '<div class="stat"><span class="stat-n">' + solvedCount() + '/' + EX.length + '</span><span class="stat-l">Solved</span></div>' +
      '<div class="stat"><span class="stat-n">' + totalXP + '</span><span class="stat-l">Exercise XP</span></div>' +
      '<div class="stat"><span class="stat-n">' + revisionQueue().length + '</span><span class="stat-l">To review</span></div>' +
      '<div class="stat"><span class="stat-n">' + drillSolved + '</span><span class="stat-l">AI drills solved · +' + drillXP + ' XP</span></div>';
  }

  /* ---------------- Topic colors, pills, progress ---------------- */
  var TOPIC_COLORS = {
    variables: "#6c7bff", strings: "#22d3ee", collections: "#9d6bff", loops: "#fbbf24",
    functions: "#34d399", oop: "#f472b6", exceptions: "#f87171", dsa: "#fb923c",
    recursion: "#c084fc", sorting: "#38bdf8", "trees-graphs": "#4ade80", "dynamic-programming": "#facc15",
    "data-science": "#60a5fa", web: "#e879f9", files: "#a3e635", testing: "#fb7185", async: "#2dd4bf"
  };
  function topicColor(t) { return TOPIC_COLORS[t] || "#6c7bff"; }

  function topicProgress() {
    var atts = getAttempts(), out = {};
    TOPICS.forEach(function (t) { out[t] = { solved: 0, total: 0 }; });
    EX.forEach(function (ex) {
      out[ex.topic].total++;
      var a = atts[ex.id];
      if (a && a.solved) out[ex.topic].solved++;
    });
    return out;
  }

  function renderTopicProgress() {
    var host = $("topic-progress");
    if (!host) return;
    var tp = topicProgress();
    host.innerHTML = TOPICS.map(function (t) {
      var s = tp[t], pct = s.total ? Math.round(s.solved / s.total * 100) : 0;
      var done = s.total > 0 && s.solved === s.total;
      return '<div class="tp-row">' +
        '<span class="tp-label"><span class="tp-dot" style="background:' + topicColor(t) + '"></span>' + esc(TOPIC_LABEL[t] || t) +
        (done ? ' <span class="badge badge-done">✓</span>' : '') + '</span>' +
        '<div class="bar"><span style="width:' + pct + '%;background:' + topicColor(t) + '"></span></div>' +
        '<span class="pct">' + s.solved + '/' + s.total + '</span></div>';
    }).join("");
  }

  function setTopic(t) {
    filters.topic = t;
    renderPills();
    renderList();
  }

  function renderPills() {
    var host = $("topic-pills");
    if (!host) return;
    var tp = topicProgress();
    function pill(t, label) {
      var active = filters.topic === t ? " active" : "";
      var sub = t === "all" ? EX.length + "" : tp[t].solved + "/" + tp[t].total;
      var dot = t === "all" ? "" : '<span class="tp-dot" style="background:' + topicColor(t) + '"></span>';
      return '<button class="pill' + active + '" data-topic="' + t + '">' + dot + esc(label) +
        ' <span class="pill-n">' + sub + '</span></button>';
    }
    host.innerHTML = pill("all", "All") + TOPICS.map(function (t) { return pill(t, TOPIC_LABEL[t]); }).join("");
    host.querySelectorAll(".pill").forEach(function (b) {
      b.addEventListener("click", function () { setTopic(b.getAttribute("data-topic")); });
    });
  }

  function renderAll() { renderDaily(); renderRevision(); renderStats(); renderTopicProgress(); renderPills(); renderDrillCard(); renderList(); }

  /* ============================================================
     DETAIL VIEW
     ============================================================ */
  var cur = null;           // current exercise
  var timerId = null, timerEnd = 0, timerTotal = 0, timerOn = false;

  function openExercise(id) {
    var ex = null;
    EX.forEach(function (e) { if (e.id === id) ex = e; });
    if (!ex) { showList(); return; }
    cur = ex;
    stopTimer();
    setStatsCard(false);
    $("practice-list").style.display = "none";
    $("practice-detail").style.display = "";
    renderDetail();
    window.scrollTo(0, 0);
  }
  function showList() {
    cur = null; stopTimer();
    setStatsCard(true);
    $("practice-detail").style.display = "none";
    $("practice-list").style.display = "";
    if (location.hash) history.replaceState(null, "", location.pathname);
    renderAll();
  }

  function editorCode() { var t = $("ex-editor"); return t ? t.value : ""; }

  // P2-54: the hint must not guess before Firebase resolves.
  // currentUser() is null until the session restores, so an
  // ungated check briefly mislabels signed-in users as signed-out.
  // Until auth.js fires onReady, render NO hint; onReady (and every
  // later auth change) refreshes it — same pattern as dashboard.js.
  var authResolved = false;
  // Signed-out users get 5 AI answers/day (10 when signed in) —
  // one plain-text line under the tutor button, only when signed out.
  function signedOutCapHint() {
    try {
      var auth = window.SkillzifyAuth;
      if (!auth || typeof auth.currentUser !== "function") return "";
      if (typeof auth.onReady === "function" && !authResolved) return "";
      if (!auth.currentUser()) {
        return '<p class="hint" id="tutor-cap-hint">Signed out? AI answers are 5/day — sign in for 10/day.</p>';
      }
    } catch (e) {}
    return "";
  }

  // M3: refresh the tutor cap hint when auth state changes (e.g.
  // sign-in/out in another tab) — re-renders the hint line only,
  // never the tutor answer or the exercise. The hint element is
  // created/removed as needed; the tutor box is untouched.
  function refreshTutorCapHint() {
    var host = $("tutor-cap-hint");
    var hint = signedOutCapHint();
    if (host) {
      if (hint) host.outerHTML = hint;
      else if (host.parentNode) host.parentNode.removeChild(host);
    } else if (hint) {
      var askBtn = $("ex-ask");
      if (askBtn && askBtn.parentNode) askBtn.insertAdjacentHTML("afterend", hint);
    }
  }

  function renderDetail() {
    var ex = cur, a = attFor(ex.id);
    var html = "";
    html += '<button class="btn btn-sm btn-ghost" id="ex-back">← All exercises</button>';
    html += '<div class="ex-head"><div><div class="ex-top"><span class="badge">' + esc(TOPIC_LABEL[ex.topic] || ex.topic) + '</span>' +
      '<span class="ex-diff">' + diffStars(ex.difficulty) + '</span>' + statusBadge(ex) + '</div>' +
      '<h1 class="section-title" style="margin:8px 0">' + esc(ex.title) + '</h1>' +
      '<p>' + esc(ex.prompt) + '</p>' +
      '<p class="hint">Attempt ' + (a.attempts + 1) +
      (a.hintsUsed ? ' · ' + a.hintsUsed + ' hint' + (a.hintsUsed > 1 ? 's' : '') + ' used' : '') +
      (a.bestMs ? ' · ⏱ best ' + Math.round(a.bestMs / 1000) + 's' : '') + '</p></div></div>';

    if (ex.kind === "predict") {
      html += '<div class="card"><h3>🔮 What does this print?</h3><pre class="code">' + esc(ex.code) + '</pre><div id="predict-opts" class="opt-list">';
      ex.options.forEach(function (opt, i) {
        html += '<button class="btn btn-ghost opt-btn" data-opt="' + i + '">' + esc(opt) + '</button>';
      });
      html += '</div><div id="predict-msg" aria-live="polite" style="margin-top:12px"></div></div>';
    } else {
      var draft = getDraft(ex.id);
      var initial = (draft != null && draft !== "") ? draft : (ex.starter || "");
      html += '<div class="card"><h3>' + (ex.kind === "fix" ? "🐞 Fix the bug" : "✍️ Your solution") + '</h3>' +
        '<textarea id="ex-editor" class="code-editor" spellcheck="false">' + esc(initial) + '</textarea>' +
        '<p class="hint">Ctrl+Enter runs the tests · your draft auto-saves</p>' +
        '<div class="btn-row">' +
        '<button class="btn" id="ex-run">▶ Run tests</button>' +
        '<button class="btn btn-ghost" id="ex-reset">Reset</button>' +
        '<label class="hint" style="margin-left:auto"><input type="checkbox" id="ex-timed"> ⏱ Timed</label>' +
        '<select id="ex-timelen" class="input-sm"><option value="300">5 min</option><option value="600" selected>10 min</option><option value="900">15 min</option></select>' +
        '</div><div id="ex-timer" class="hint" style="display:none"></div>' +
        '<div id="ex-results" aria-live="polite" style="margin-top:12px"></div></div>';
    }

    html += '<div class="card"><h3>💡 Hints <span class="hint">(progressive)</span></h3><div class="btn-row" id="hint-btns">';
    for (var h = 0; h < 3; h++) {
      html += '<button class="btn btn-sm btn-ghost" data-hint="' + h + '"' + (a.hintsUsed > h ? " disabled" : "") + '>Hint ' + (h + 1) + '</button>';
    }
    html += '</div><div id="hint-box"></div></div>';

    html += '<div class="card"><h3>🤖 AI Tutor</h3>' +
      '<p class="hint">Stuck? The tutor explains and nudges — it won\'t just hand you the answer.</p>' +
      '<button class="btn btn-sm" id="ex-ask">Ask AI Tutor</button>' + signedOutCapHint() + '<div id="tutor-box" style="margin-top:12px"></div></div>';

    html += '<div class="card"><div class="btn-row">' +
      '<button class="btn btn-sm btn-ghost" id="ex-reveal">👁 Reveal solution</button>' +
      '<button class="btn btn-sm btn-ghost" id="ex-walk">📖 Walkthrough</button>' +
      '</div><div id="solution-box" style="margin-top:12px"></div></div>';

    html += '<div id="compare-box"></div>';

    $("practice-detail").innerHTML = html;
    wireDetail();
    if (a.hintsUsed > 0) showHintsUpTo(a.hintsUsed);
  }

  function showHintsUpTo(n) {
    var box = $("hint-box"); if (!box || !cur) return;
    var html = "";
    for (var i = 0; i < Math.min(n, cur.hints.length); i++) {
      html += '<p class="hint-box-p"><strong>Hint ' + (i + 1) + ':</strong> ' + esc(cur.hints[i]) + '</p>';
    }
    box.innerHTML = html;
  }

  function wireDetail() {
    var ex = cur;
    $("ex-back").addEventListener("click", showList);
    if (ex.kind === "predict") { wirePredict(); }
    else { wireCode(); }
    document.querySelectorAll("#hint-btns button").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.getAttribute("data-hint"), 10);
        var a = attFor(ex.id);
        if (a.hintsUsed <= i) { setAtt(ex.id, { hintsUsed: i + 1 }); a = attFor(ex.id); }
        b.disabled = true;
        showHintsUpTo(a.hintsUsed);
      });
    });
    $("ex-reveal").addEventListener("click", function () { revealSolution(); });
    $("ex-walk").addEventListener("click", function () {
      $("solution-box").innerHTML = '<h4>📖 Walkthrough</h4><p>' + esc(ex.walkthrough).replace(/\n/g, "<br>") + '</p>' +
        (ex.pythonic ? '<h4>🐍 Pythonic take</h4><p>' + esc(ex.pythonic) + '</p>' : '');
    });
    $("ex-ask").addEventListener("click", function () {
      askTutor(ex, ex.kind === "predict" ? ex.code : editorCode(), lastFailInfo, $("tutor-box"));
    });
  }

  var lastFailInfo = "";

  /* ----- predict kind ----- */
  function wirePredict() {
    var ex = cur;
    document.querySelectorAll("#predict-opts button").forEach(function (b) {
      b.addEventListener("click", function () {
        // Solved exercises ignore further option clicks: a wrong click
        // after "✓ Correct!" must not overwrite the success message
        // (or inflate the attempt count).
        if (attFor(ex.id).solved) return;
        var i = parseInt(b.getAttribute("data-opt"), 10);
        var msg = $("predict-msg");
        var a = setAtt(ex.id, { attempts: attFor(ex.id).attempts + 1 });
        if (i === ex.answer) {
          if (!a.solved) {
            var gain = xpForSolve(ex, a);
            setAtt(ex.id, { solved: true, xpEarned: gain });
            addXP(gain, "Solved: " + ex.title);
            S.toast("+" + gain + " XP! 🎉" + (a.hintsUsed === 0 && !a.revealed ? " (no-hint bonus)" : ""), "success");
          }
          msg.innerHTML = '<p class="pass">✓ Correct! ' + esc(ex.walkthrough || "") + '</p>' + nextButtonHtml();
          showCompare();
          renderAll();
        } else {
          msg.innerHTML = '<p class="fail">✗ Not quite — try again, or take a hint.</p>';
        }
      });
    });
  }

  /* ----- code / fix kinds ----- */
  function wireCode() {
    var ex = cur;
    ensurePyodide(function (ok) {
      var r = $("ex-results");
      if (r && !ok) r.innerHTML = '<p class="hint">⚠️ Python runtime failed to load. Check your connection, then reload.</p>';
    });
    $("ex-run").addEventListener("click", function () { submitCode(false); });
    $("ex-reset").addEventListener("click", function () {
      $("ex-editor").value = ex.starter || "";
      $("ex-results").innerHTML = "";
      clearDraft(ex.id);
    });
    $("ex-timed").addEventListener("change", function () {
      if (this.checked) startTimer(parseInt($("ex-timelen").value, 10) * 1000);
      else stopTimer();
    });
    // Draft auto-save + Ctrl+Enter to run
    var ed = $("ex-editor"), draftTimer = null;
    ed.addEventListener("input", function () {
      if (draftTimer) clearTimeout(draftTimer);
      draftTimer = setTimeout(function () { saveDraft(ex.id, ed.value); }, 600);
    });
    ed.addEventListener("keydown", function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); submitCode(false); }
    });
  }

  function submitCode(auto) {
    var ex = cur, code = editorCode();
    if (!code.trim()) { S.toast("Write some code first.", "error"); return; }
    var resBox = $("ex-results");
    resBox.innerHTML = '<p class="hint">Running ' + ex.tests.length + ' tests…</p>';
    // P2-13: no clock here — runCodeTests passes the start time (set
    // inside its ensurePyodide callback) as the 2nd argument, so
    // bestMs measures solving, not the Pyodide cold load.
    runCodeTests(ex, code, function (out, tStart) {
      if (out.error) {
        lastFailInfo = out.error;
        resBox.innerHTML = '<p class="fail">⚠️ ' + esc(out.error) + '</p>';
        // P1-08: a runtime-load failure is not an attempt — don't
        // increment attempts and don't touch lastTry. Only count an
        // attempt once the tests actually ran.
        if (!out.runtime) setAtt(ex.id, { attempts: attFor(ex.id).attempts + 1 });
        return;
      }
      var passed = out.results.filter(function (r) { return r.pass; }).length;
      var total = out.results.length;
      var html = '<div class="test-list">';
      out.results.forEach(function (r, i) {
        html += '<div class="test ' + (r.pass ? "pass" : "fail") + '">' +
          '<span>' + (r.pass ? "✓" : "✗") + ' Test ' + (i + 1) + ' <code>' + esc(r.run) + '</code></span>' +
          (r.pass ? "" : '<span class="hint">expected <code>' + esc(r.expect) + '</code>' +
            (r.error ? ', got <code>' + esc(r.error) + '</code>' : ', got <code>' + esc(r.got.trim()) + '</code>') + '</span>') +
          '</div>';
      });
      html += '</div>';
      var ms = tStart ? Date.now() - tStart : 0;
      if (passed === total) {
        stopTimer();
        var a = attFor(ex.id);
        lastFailInfo = "";
        html = '<p class="pass">🎉 All ' + total + ' tests passed!</p>' + html + nextButtonHtml();
        if (!a.solved) {
          var gain = xpForSolve(ex, a);
          var patch = { solved: true, attempts: a.attempts + 1, xpEarned: gain };
          if (!a.bestMs || (timerOn && ms < a.bestMs)) patch.bestMs = timerOn ? ms : a.bestMs;
          setAtt(ex.id, patch);
          addXP(gain, "Solved: " + ex.title);
          S.toast("+" + gain + " XP! 🎉" + (a.hintsUsed === 0 && !a.revealed ? " (no-hint bonus)" : ""), "success");
          if (A && A.log) A.log("practice", "Solved exercise: " + ex.title);
        } else {
          // P1-04: re-solving a solved exercise must not raise attempts
          // (the solve-time snapshot stands); only lastTry refreshes.
          setAtt(ex.id, {});
        }
        showCompare();
        renderAll();
      } else {
        lastFailInfo = "Failed " + (total - passed) + " of " + total + " tests. " +
          out.results.filter(function (r) { return !r.pass; }).map(function (r) {
            return r.run + " → expected " + r.expect + (r.error ? " but raised " + r.error : " but got " + r.got.trim());
          }).join("; ");
        html = '<p class="fail">' + passed + '/' + total + ' tests passed. Keep going — check the failures below or ask the AI Tutor.</p>' + html;
        setAtt(ex.id, { attempts: attFor(ex.id).attempts + 1 });
        if (auto) S.toast("Time's up! Your code was auto-submitted.", "error");
      }
      resBox.innerHTML = html;
    });
  }

  function revealSolution() {
    var ex = cur;
    var a = attFor(ex.id);
    // P1-04: revealing after solving must not taint the record — the
    // solution still shows, but the solved quality snapshot stands.
    if (!a.solved && !a.revealed) setAtt(ex.id, { revealed: true });
    $("solution-box").innerHTML =
      '<h4>👁 Model solution ' + (a.solved ? '' : '<span class="hint">(revealing halves the XP for this exercise)</span>') + '</h4>' +
      '<pre class="code">' + esc(ex.solution) + '</pre>' +
      '<h4>📖 Walkthrough</h4><p>' + esc(ex.walkthrough).replace(/\n/g, "<br>") + '</p>' +
      (ex.pythonic ? '<h4>🐍 Pythonic take</h4><p>' + esc(ex.pythonic) + '</p>' : '');
    showCompare();
  }

  function showCompare() {
    var ex = cur, box = $("compare-box");
    if (!box || ex.kind === "predict") return;
    var mine = editorCode();
    box.innerHTML = '<div class="card"><h3>⚖️ Your code vs. model solution</h3>' +
      '<div class="two-col"><div><h4>Yours</h4><pre class="code">' + esc(mine || "(empty)") + '</pre></div>' +
      '<div><h4>Model</h4><pre class="code">' + esc(ex.solution) + '</pre></div></div>' +
      (ex.pythonic ? '<p><strong>🐍 Pythonic take:</strong> ' + esc(ex.pythonic) + '</p>' : '') + '</div>';
  }

  /* ---------------- Timed mode ---------------- */
  function startTimer(ms) {
    stopTimer();
    timerOn = true; timerTotal = ms; timerEnd = Date.now() + ms;
    var el = $("ex-timer");
    if (el) el.style.display = "";
    timerId = setInterval(function () {
      var left = timerEnd - Date.now();
      var tel = $("ex-timer");
      if (left <= 0) {
        stopTimer();
        if (tel) tel.innerHTML = '<strong>⏱ Time\'s up!</strong> Auto-submitting…';
        submitCode(true);
        return;
      }
      if (tel) {
        var s = Math.ceil(left / 1000);
        tel.innerHTML = "⏱ " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " left";
      }
    }, 500);
  }
  function stopTimer() {
    timerOn = false;
    if (timerId) clearInterval(timerId);
    timerId = null;
    var el = $("ex-timer");
    if (el) el.style.display = "none";
  }

  /* ---------------- Router + init ---------------- */
  function route() {
    var m = (location.hash || "").match(/^#ex=([\w-]+)/);
    if (m) { openExercise(m[1]); return; }
    // AI daily challenge intake: practice.html#challenge (see openDailyChallenge)
    if (/^#challenge($|[?&])/.test(location.hash || "")) { openDailyChallenge(); return; }
    // Deep link from dashboard weak spots: practice.html#topic=loops
    var tm = (location.hash || "").match(/^#topic=([\w-]+)/);
    if (tm && TOPICS.indexOf(tm[1]) >= 0) filters.topic = tm[1];
    showList();
  }

  function initFilters() {
    var dh = $("filter-diff");
    if (dh) dh.addEventListener("change", function () { filters.difficulty = dh.value; renderList(); });
    var q = $("filter-q");
    if (q) q.addEventListener("input", function () { filters.q = q.value; renderList(); });
    var u = $("filter-unsolved");
    if (u) u.addEventListener("change", function () { filters.unsolved = u.checked; renderList(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("practice-list")) return; // not on practice page
    // Warm the AI backend now, so the tutor is fast when asked.
    // Route through the shared AI client when it loaded; direct
    // fetch is only the fallback if ai.js failed to load.
    try {
      if (window.SkillzifyAI && typeof window.SkillzifyAI.warmup === "function") window.SkillzifyAI.warmup();
      else fetch("api/health", { method: "GET", cache: "no-store" }).catch(function () {});
    } catch (e) {}
    initFilters();
    // P2-54: resolve the auth state BEFORE the first render, so the
    // cap hint never guesses: onReady fires at once when auth is
    // already ready, otherwise when Firebase restores the session.
    try {
      var auth = window.SkillzifyAuth;
      if (auth && typeof auth.onReady === "function") {
        auth.onReady(function () { authResolved = true; refreshTutorCapHint(); });
      }
    } catch (e) {}
    window.addEventListener("hashchange", route);
    route();
    // M3: keep the tutor cap hint in step with sign-in/out (e.g. in
    // another tab). refreshTutorCapHint re-renders the hint line only.
    try {
      if (window.SkillzifyAuth && typeof window.SkillzifyAuth.onAuthChange === "function") {
        window.SkillzifyAuth.onAuthChange(function () { authResolved = true; refreshTutorCapHint(); });
      }
    } catch (e) {}
    if (A && A.checkAchievements) { try { A.checkAchievements(); } catch (e) {} }
  });

  /* Expose for dashboard widgets */
  window.SkillzifyPractice = {
    _weakSpotsSummary: weakSpotsSummary,
    dailyExercise: dailyExercise,
    revisionQueue: revisionQueue,
    solvedCount: solvedCount,
    totalCount: function () { return EX.length; },
    attFor: attFor,
    setAtt: setAtt,
    topicProgress: topicProgress
  };
})();
