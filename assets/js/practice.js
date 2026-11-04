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

  var TOPICS = ["variables", "strings", "collections", "loops", "functions", "oop", "exceptions", "dsa"];
  var TOPIC_LABEL = { variables: "Variables", strings: "Strings", collections: "Collections", loops: "Loops", functions: "Functions", oop: "OOP", exceptions: "Exceptions", dsa: "Algorithms" };
  var KIND_LABEL = { code: "✍️ Write code", predict: "🔮 Predict output", fix: "🐞 Fix the bug" };

  function esc(s) { return S.esc(s == null ? "" : String(s)); }
  function $(id) { return document.getElementById(id); }

  /* ---------------- Pyodide runtime ---------------- */
  var pyodide = null, pyLoading = false, pyQueue = [];
  function ensurePyodide(cb) {
    if (pyodide) { cb(true); return; }
    pyQueue.push(cb);
    if (pyLoading) return;
    pyLoading = true;
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
    script.onload = function () {
      window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" }).then(function (py) {
        pyodide = py; pyLoading = false;
        var q = pyQueue; pyQueue = [];
        q.forEach(function (c) { try { c(true); } catch (e) {} });
      }).catch(function () {
        pyLoading = false;
        var q = pyQueue; pyQueue = [];
        q.forEach(function (c) { try { c(false); } catch (e) {} });
      });
    };
    script.onerror = function () {
      pyLoading = false;
      var q = pyQueue; pyQueue = [];
      q.forEach(function (c) { try { c(false); } catch (e) {} });
    };
    document.head.appendChild(script);
  }

  /* ---------------- Attempts + XP ---------------- */
  function getAttempts() { return S.storeGet(ATT_KEY, {}); }
  function saveAttempts(a) { S.storeSet(ATT_KEY, a); }
  function attFor(id) { return getAttempts()[id] || { attempts: 0, solved: false, hintsUsed: 0, revealed: false, bestMs: 0, lastTry: 0, xpEarned: 0 }; }
  function setAtt(id, patch) {
    var all = getAttempts();
    var cur = all[id] || { attempts: 0, solved: false, hintsUsed: 0, revealed: false, bestMs: 0, lastTry: 0, xpEarned: 0 };
    Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
    cur.lastTry = Date.now();
    all[id] = cur; saveAttempts(all);
    if (window.SkillzifySync) window.SkillzifySync.markDirty();
    return cur;
  }

  /* ---------------- Draft code persistence ---------------- */
  var DRAFT_KEY = "skillzify_exercise_drafts";
  function getDrafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch (e) { return {}; } }
  function getDraft(id) { var d = getDrafts(); return d[id] != null ? d[id] : null; }
  function saveDraft(id, code) {
    try { var d = getDrafts(); d[id] = code; localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
  }
  function clearDraft(id) {
    try { var d = getDrafts(); delete d[id]; localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
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
      if (!ok) { done({ error: "Python runtime failed to load. Check your connection and try again." }); return; }
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
        done({ error: "Your code crashed before the tests could run: " + String(e).split("\n").pop() });
        return;
      }
      done({ results: results });
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

  /* ---------------- AI Tutor ---------------- */
  function askTutor(ex, code, failInfo, box) {
    box.innerHTML = '<p class="hint">🤖 Waking up the AI Tutor…</p>';
    var ctrl = null, timer = null, stageTimer = null;
    try {
      ctrl = new AbortController();
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 60000);
      stageTimer = setTimeout(function () {
        box.innerHTML = '<p class="hint">🤖 Still working — the AI backend is slow to wake on the free tier. Hang on…</p>';
      }, 9000);
    } catch (e) {}
    function clearTimers() {
      if (timer) clearTimeout(timer);
      if (stageTimer) clearTimeout(stageTimer);
    }
    var payload = {
      mode: "tutor",
      code: "EXERCISE: " + ex.title + "\nPROMPT: " + ex.prompt + "\n\nSTUDENT CODE:\n" + (code || "(empty)"),
      error: "TUTOR MODE — the student's code is not passing. " +
        (failInfo || "No test output yet.") +
        " Act as a Socratic tutor: explain what is likely wrong and give ONE guiding hint toward the fix. " +
        "Do NOT write the full corrected code. Keep it short and encouraging."
    };
    var opts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    };
    if (ctrl) opts.signal = ctrl.signal;
    fetch("api/explain", opts).then(function (r) { clearTimers(); if (!r.ok) throw 0; return r.json(); })
    .then(function (data) {
      if (!data.explanation) throw 0;
      box.innerHTML = '<h4>🤖 AI Tutor</h4><p>' + esc(data.explanation).replace(/\n/g, "<br>") + "</p>";
    }).catch(function () {
      clearTimers();
      box.innerHTML = '<h4>🤖 AI Tutor</h4><p class="hint">The AI tutor is unreachable right now (backend offline). ' +
        'Try a hint above — Hint 3 almost gives it away. Your code and failing tests are still visible to you.</p>';
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
      '<div class="daily-inner"><div><div class="badge">📅 Daily challenge</div>' +
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
      if (a && a.solved) totalXP += a.xpEarned || Math.round(ex.xp * (a.revealed ? 0.5 : 1));
    });
    host.innerHTML =
      '<div class="stat"><span class="stat-n">' + solvedCount() + '/' + EX.length + '</span><span class="stat-l">Solved</span></div>' +
      '<div class="stat"><span class="stat-n">' + totalXP + '</span><span class="stat-l">Exercise XP</span></div>' +
      '<div class="stat"><span class="stat-n">' + revisionQueue().length + '</span><span class="stat-l">To review</span></div>';
  }

  /* ---------------- Topic colors, pills, progress ---------------- */
  var TOPIC_COLORS = {
    variables: "#6c7bff", strings: "#22d3ee", collections: "#9d6bff", loops: "#fbbf24",
    functions: "#34d399", oop: "#f472b6", exceptions: "#f87171", dsa: "#fb923c"
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
        '<span class="tp-label"><span class="tp-dot" style="background:' + topicColor(t) + '"></span>' + esc(TOPIC_LABEL[t]) +
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

  function renderAll() { renderDaily(); renderRevision(); renderStats(); renderTopicProgress(); renderPills(); renderList(); }

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
    $("practice-list").style.display = "none";
    $("practice-detail").style.display = "";
    renderDetail();
    window.scrollTo(0, 0);
  }
  function showList() {
    cur = null; stopTimer();
    $("practice-detail").style.display = "none";
    $("practice-list").style.display = "";
    if (location.hash) history.replaceState(null, "", location.pathname);
    renderAll();
  }

  function editorCode() { var t = $("ex-editor"); return t ? t.value : ""; }

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
      html += '</div><div id="predict-msg" style="margin-top:12px"></div></div>';
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
        '<div id="ex-results" style="margin-top:12px"></div></div>';
    }

    html += '<div class="card"><h3>💡 Hints <span class="hint">(progressive)</span></h3><div class="btn-row" id="hint-btns">';
    for (var h = 0; h < 3; h++) {
      html += '<button class="btn btn-sm btn-ghost" data-hint="' + h + '"' + (a.hintsUsed > h ? " disabled" : "") + '>Hint ' + (h + 1) + '</button>';
    }
    html += '</div><div id="hint-box"></div></div>';

    html += '<div class="card"><h3>🤖 AI Tutor</h3>' +
      '<p class="hint">Stuck? The tutor explains and nudges — it won\'t just hand you the answer.</p>' +
      '<button class="btn btn-sm" id="ex-ask">Ask AI Tutor</button><div id="tutor-box" style="margin-top:12px"></div></div>';

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
    $("ex-reveal").addEventListener("click", function () { revealSolution(false); });
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
    var t0 = Date.now();
    runCodeTests(ex, code, function (out) {
      if (out.error) {
        lastFailInfo = out.error;
        resBox.innerHTML = '<p class="fail">⚠️ ' + esc(out.error) + '</p>';
        setAtt(ex.id, { attempts: attFor(ex.id).attempts + 1 });
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
      var ms = Date.now() - t0;
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
          setAtt(ex.id, { attempts: a.attempts + 1 });
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

  function revealSolution(auto) {
    var ex = cur;
    var a = attFor(ex.id);
    if (!a.revealed) setAtt(ex.id, { revealed: true });
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
    try { fetch("api/health", { method: "GET", cache: "no-store" }).catch(function () {}); } catch (e) {}
    initFilters();
    window.addEventListener("hashchange", route);
    route();
    if (A && A.checkAchievements) { try { A.checkAchievements(); } catch (e) {} }
  });

  /* Expose for dashboard widgets */
  window.SkillzifyPractice = {
    dailyExercise: dailyExercise,
    revisionQueue: revisionQueue,
    solvedCount: solvedCount,
    totalCount: function () { return EX.length; },
    attFor: attFor,
    topicProgress: topicProgress,
    topicAccuracy: function () {
      var atts = getAttempts(), out = {};
      TOPICS.forEach(function (t) { out[t] = { solved: 0, total: 0 }; });
      EX.forEach(function (ex) {
        out[ex.topic].total++;
        var a = atts[ex.id];
        if (a && a.solved) out[ex.topic].solved++;
      });
      return out;
    }
  };
})();
