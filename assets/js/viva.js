/* ============================================================
   Skillzify v2 — Mock viva (F6)
   Reusable viva panel: the AI plays examiner for one lesson.
   - open(lesson) starts a session of up to 5 questions.
   - Ask:  SkillzifyAI.ask({mode:"viva", stage:"ask", ...})
   - Judge: SkillzifyAI.ask({mode:"viva", stage:"judge", ...})
   Requires window.SkillzifyAI (assets/js/ai.js) and, for the
   lesson lookup, window.SkillzifyLearnCore (learn-core.js).
   Self-initializes: adds a "Mock viva" button on lesson pages
   (.lesson-actions / #lm-try) and on path detail views
   (paths.html#path=<id>, viva on the path's next lesson).
   Exposes window.SkillzifyViva. ES5, no dependencies beyond
   the two globals above.
   ============================================================ */
(function () {
  "use strict";

  var MAX_Q = 5;
  var OVERLAY_ID = "viva-overlay";
  var BTN_ID = "viva-open-btn";
  var PATH_BTN_ID = "viva-path-btn";

  /* ---------------- session state (per open()) ---------------- */
  var lesson = null;
  var asked = [];        // questions already asked this session
  var revisitIds = [];   // lesson ids to revisit, collected across judges
  var score = 0;         // correct = 1, partial = 0.5, wrong = 0
  var qCount = 0;        // questions judged so far
  var currentQuestion = "";
  var currentAnswer = "";
  var busy = false;
  // Session token: incremented on every open()/close(); AI callbacks
  // captured at call time return early if it no longer matches, so a
  // stale callback can't overwrite a newer session.
  var sessionToken = 0;
  var finished = false; // true once the summary has been shown
  var VIVA_SESSION_KEY = "skillzify_viva_session";
  var VIVA_LAST_KEY = "skillzify_viva_last";

  /* ---------------- small helpers ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  // DAILY_CAP sign-in link, via the shared ai.js helper: "" when
  // signed in (at the 50/day cap), the link only when signed out.
  function aiCapLink() {
    try { return (window.SkillzifyAI && window.SkillzifyAI.capLink) ? window.SkillzifyAI.capLink() : ""; } catch (e) { return ""; }
  }
  function lessonContext() {
    try {
      if (window.SkillzifyAI && window.SkillzifyAI.buildContext) {
        return window.SkillzifyAI.buildContext({ lesson: lesson ? lesson.title : "" });
      }
    } catch (e) {}
    return lesson ? lesson.title : "";
  }
  function addRevisit(ids) {
    if (!ids) return;
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i]);
      if (id && revisitIds.indexOf(id) < 0) revisitIds.push(id);
    }
  }
  function revisitLinks(ids) {
    if (!ids || !ids.length) return "";
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i]);
      var title = null;
      try {
        if (window.SkillzifyLearnCore && typeof window.SkillzifyLearnCore.lessonById === "function") {
          var l = window.SkillzifyLearnCore.lessonById(id);
          if (l && l.title) title = l.title;
        }
      } catch (e) {}
      if (!title) continue; // drop IDs that don't resolve — no broken links
      out.push('<a href="lesson.html?id=' + esc(id) + '">' + esc(title) + "</a>");
    }
    return out.join(" · ");
  }
  function scoreText() { return "Score: " + score + " / " + MAX_Q; }

  /* ---------------- panel DOM (built once) ---------------- */
  var overlay = null, bodyEl = null, scoreEl = null;

  function buildPanel() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("style",
      "position:fixed;inset:0;z-index:9999;display:none;" +
      "align-items:flex-start;justify-content:center;padding:24px 12px;" +
      "background:rgba(4,6,18,0.72);overflow-y:auto;");
    overlay.innerHTML =
      '<div role="dialog" aria-label="Mock viva" style="width:100%;max-width:560px;' +
      'background:#141b3d;color:#eef1ff;border:1px solid #2a3566;border-radius:14px;' +
      'padding:20px;box-shadow:0 18px 50px rgba(0,0,0,0.55);font-family:inherit;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
      '<div><h2 style="margin:0;font-size:1.25rem;">&#127908; Mock viva</h2>' +
      '<p id="viva-sub" class="hint" style="margin:6px 0 0;color:#aab3e0;font-size:0.9rem;"></p></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="viva-close" aria-label="Close mock viva">✕</button>' +
      "</div>" +
      '<p id="viva-score" style="margin:12px 0 0;color:#aab3e0;font-size:0.9rem;"></p>' +
      '<div id="viva-body" style="margin-top:14px;"></div>' +
      "</div>";
    document.body.appendChild(overlay);
    bodyEl = $("viva-body");
    scoreEl = $("viva-score");
    $("viva-close").addEventListener("click", close);
    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) close();
    });
  }

  function show(html) { bodyEl.innerHTML = html; }
  function paintScore() { if (scoreEl) scoreEl.textContent = scoreText() + "  ·  Question " + (qCount + 1) + " of " + MAX_Q; }
  function paintScoreDone() { if (scoreEl) scoreEl.textContent = scoreText(); }

  function showError(msg, retryLabel, retryFn, isCap) {
    var html = '<p style="color:#ffb4b4;">' + esc(msg) +
      (isCap ? aiCapLink() : "") + "</p>" +
      '<button type="button" class="btn" id="viva-retry">' + esc(retryLabel || "Try again") + "</button> " +
      '<button type="button" class="btn btn-ghost" id="viva-close2">Close</button>';
    show(html);
    $("viva-retry").addEventListener("click", retryFn);
    $("viva-close2").addEventListener("click", close);
  }

  // Judge-error view: keeps the student's answer visible and editable
  // while retrying, instead of replacing the question/textarea.
  function showJudgeError(msg, answer, isCap) {
    var html = '<p style="color:#ffb4b4;">' + esc(msg) +
      (isCap ? aiCapLink() : "") + "</p>" +
      '<p style="color:#aab3e0;">Your answer:</p>' +
      '<p style="line-height:1.55;">' + esc(answer || "") + "</p>" +
      '<label for="viva-answer-edit" style="display:block;margin:10px 0 6px;color:#aab3e0;font-size:0.9rem;">Edit your answer</label>' +
      '<textarea id="viva-answer-edit" rows="4" style="width:100%;box-sizing:border-box;' +
      'background:#0a0f22;color:#eef1ff;border:1px solid #2a3566;border-radius:8px;' +
      'padding:10px;font:inherit;resize:vertical;">' + esc(answer || "") + "</textarea>" +
      '<div style="margin-top:12px;"><button type="button" class="btn" id="viva-retry">Try again</button> ' +
      '<button type="button" class="btn" id="viva-judge-again">Judge again</button> ' +
      '<button type="button" class="btn btn-ghost" id="viva-close2">Close</button></div>';
    show(html);
    $("viva-retry").addEventListener("click", function () { judgeAnswer(answer); });
    $("viva-judge-again").addEventListener("click", function () {
      var ta = $("viva-answer-edit");
      var edited = ta ? ta.value : "";
      if (!edited || !edited.replace(/\s+/g, "")) { if (ta) ta.focus(); return; }
      judgeAnswer(edited);
    });
    $("viva-close2").addEventListener("click", close);
  }

  /* ---------------- session persistence ---------------- */
  function saveSession() {
    if (!lesson) return;
    try {
      localStorage.setItem(VIVA_SESSION_KEY, JSON.stringify({
        lessonId: lesson.id, score: score, qCount: qCount,
        asked: asked, revisitIds: revisitIds,
        currentQuestion: currentQuestion, at: Date.now()
      }));
    } catch (e) {}
  }
  function clearSession() { try { localStorage.removeItem(VIVA_SESSION_KEY); } catch (e) {} }
  function loadStored(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      if (!v || typeof v !== "object" || typeof v.lessonId !== "string") return null;
      return v;
    } catch (e) { return null; }
  }
  function saveLast() {
    if (!lesson) return;
    try {
      localStorage.setItem(VIVA_LAST_KEY, JSON.stringify({
        lessonId: lesson.id, score: score, total: MAX_Q, at: Date.now()
      }));
    } catch (e) {}
  }
  function resetSession() {
    asked = [];
    revisitIds = [];
    score = 0;
    qCount = 0;
    currentQuestion = "";
    currentAnswer = "";
    busy = false;
    finished = false;
  }

  /* ---------------- AI steps ---------------- */
  function aiAvailable() {
    return !!(window.SkillzifyAI && typeof window.SkillzifyAI.ask === "function");
  }

  function askQuestion() {
    // M4: in-flight guard — a double-click on Next (or a retry while a
    // question is already being asked) must not queue a second ask
    // call. Returns false when it bailed so callers can re-enable the
    // button; true when a call was started (view is replaced on settle).
    if (busy) return false;
    if (!lesson) { showError("No lesson loaded for this viva.", "Close", close); return false; }
    if (qCount >= MAX_Q) { showSummary(); return false; }
    if (!aiAvailable()) {
      showError("The AI client isn't loaded on this page. Reload and try again.", "Try again", askQuestion);
      return false;
    }
    busy = true;
    paintScore();
    show('<p class="hint" style="color:#aab3e0;">The examiner is thinking up a question…</p>');
    var askTok = sessionToken;
    window.SkillzifyAI.ask({
      mode: "viva",
      stage: "ask",
      json: true,
      cache: false,
      code: JSON.stringify(lesson),
      error: asked.join("\n"),
      context: lessonContext()
    }, function (err, res) {
      if (askTok !== sessionToken) return; // stale: session closed/reopened
      busy = false;
      if (err) {
        // A failed ask does not advance the question count.
        showError(err.message || "The AI didn't answer.", "Try again", askQuestion, err && err.code === "DAILY_CAP");
        return;
      }
      if (!res || res.offline || !res.data || typeof res.data.question !== "string" || !res.data.question.trim()) {
        showError("The examiner didn't return a question. Try again.", "Try again", askQuestion);
        return;
      }
      currentQuestion = res.data.question;
      showQuestion();
    });
    return true;
  }

  function showQuestion() {
    paintScore();
    show(
      '<p style="font-size:1.05rem;line-height:1.5;"><strong>Question ' + (qCount + 1) + ':</strong> ' +
      esc(currentQuestion) + "</p>" +
      '<label for="viva-answer" style="display:block;margin:10px 0 6px;color:#aab3e0;font-size:0.9rem;">Your answer</label>' +
      '<textarea id="viva-answer" rows="4" style="width:100%;box-sizing:border-box;' +
      'background:#0a0f22;color:#eef1ff;border:1px solid #2a3566;border-radius:8px;' +
      'padding:10px;font:inherit;resize:vertical;" placeholder="Answer in your own words…"></textarea>' +
      '<p id="viva-hint" style="min-height:1.2em;color:#ffb4b4;margin:8px 0 0;"></p>' +
      '<div style="margin-top:12px;"><button type="button" class="btn" id="viva-submit">Submit answer</button></div>'
    );
    var ta = $("viva-answer");
    if (ta) ta.focus();
    $("viva-submit").addEventListener("click", function () {
      var ans = ta ? ta.value : "";
      if (!ans || !ans.replace(/\s+/g, "")) {
        var hint = $("viva-hint");
        if (hint) hint.textContent = "Write an answer first.";
        if (ta) ta.focus();
        return; // do not call the AI on an empty answer
      }
      // M4: disable while judging so a double-click can't queue a
      // second judge call; the busy guard in judgeAnswer is the
      // backstop, and the view is replaced on settle anyway.
      var submitBtn = $("viva-submit");
      if (submitBtn) submitBtn.disabled = true;
      if (!judgeAnswer(ans)) { if (submitBtn) submitBtn.disabled = false; }
    });
  }

  function judgeAnswer(answer) {
    // M4: in-flight guard — a double-click on Submit must not queue a
    // second judge call (2 cap charges, qCount advancing twice).
    // Returns false when it bailed, true when a call was started.
    if (busy) return false;
    if (!aiAvailable()) {
      showError("The AI client isn't loaded on this page. Reload and try again.", "Try again", function () { judgeAnswer(answer); });
      return false;
    }
    busy = true;
    currentAnswer = answer;
    show('<p class="hint" style="color:#aab3e0;">Judging your answer…</p>');
    var judgeTok = sessionToken;
    window.SkillzifyAI.ask({
      mode: "viva",
      stage: "judge",
      json: true,
      cache: false,
      code: currentQuestion,
      error: answer,
      context: lessonContext()
    }, function (err, res) {
      if (judgeTok !== sessionToken) return; // stale: session closed/reopened
      busy = false;
      if (err) {
        // A failed judge does not advance the question count.
        showJudgeError(err.message || "The AI didn't answer.", currentAnswer, err && err.code === "DAILY_CAP");
        return;
      }
      if (!res || res.offline || !res.data) {
        showJudgeError("The examiner didn't return a verdict. Try again.", currentAnswer);
        return;
      }
      // No coercion: an invalid verdict is an error, not a "partial".
      // A failed judge does not advance the score or the question count.
      var verdict = (typeof res.data.verdict === "string") ? res.data.verdict.toLowerCase() : "";
      if (verdict !== "correct" && verdict !== "partial" && verdict !== "wrong") {
        showJudgeError("The examiner didn't return a verdict. Try again.", currentAnswer);
        return;
      }
      var feedback = (typeof res.data.feedback === "string") ? res.data.feedback : "";
      var revisit = Array.isArray(res.data.revisit) ? res.data.revisit : [];
      if (verdict === "correct") score += 1;
      else if (verdict === "partial") score += 0.5;
      asked.push(currentQuestion);
      qCount += 1;
      currentQuestion = ""; // judged: no in-progress question to resume
      addRevisit(revisit);
      saveSession();
      showVerdict(verdict, feedback, revisit);
    });
    return true;
  }

  function showVerdict(verdict, feedback, revisit) {
    var color = verdict === "correct" ? "#34d399" : (verdict === "partial" ? "#fbbf24" : "#f87171");
    var label = verdict === "correct" ? "✅ Correct" : (verdict === "partial" ? "🟡 Partially correct" : "❌ Not quite");
    var html =
      '<p style="font-size:1.1rem;"><strong style="color:' + color + ';">' + label + "</strong></p>" +
      (feedback ? '<p style="line-height:1.55;">' + esc(feedback) + "</p>" : "") +
      (revisit && revisit.length
        ? '<p style="color:#aab3e0;">Revisit: ' + revisitLinks(revisit) + "</p>"
        : "") +
      '<p style="color:#aab3e0;">' + esc(scoreText()) + "</p>";
    if (qCount < MAX_Q) {
      html += '<div style="margin-top:12px;"><button type="button" class="btn" id="viva-next">Next question</button> ' +
        '<button type="button" class="btn btn-ghost" id="viva-finish">Finish now</button></div>';
    } else {
      html += '<div style="margin-top:12px;"><button type="button" class="btn" id="viva-summary">See my summary</button></div>';
    }
    paintScore();
    show(html);
    var next = $("viva-next");
    // M4: disable while the next question is being asked; re-enabled
    // only if askQuestion bailed on the in-flight guard (the view is
    // replaced when a call actually starts).
    if (next) next.addEventListener("click", function () {
      next.disabled = true;
      if (!askQuestion()) next.disabled = false;
    });
    var fin = $("viva-finish");
    if (fin) fin.addEventListener("click", showSummary);
    var sum = $("viva-summary");
    if (sum) sum.addEventListener("click", showSummary);
  }

  function showSummary() {
    finished = true;
    saveLast();
    clearSession();
    paintScoreDone();
    var total = Math.max(qCount, 1);
    var html =
      '<h3 style="margin:0 0 8px;">Viva summary — ' + esc(lesson ? lesson.title : "") + "</h3>" +
      "<p>You scored <strong>" + score + " / " + MAX_Q + "</strong>" +
      (qCount < MAX_Q ? " (" + qCount + " question" + (qCount === 1 ? "" : "s") + " answered)" : "") + ".</p>" +
      (revisitIds.length
        ? '<p style="color:#aab3e0;">Revisit: ' + revisitLinks(revisitIds) + "</p>"
        : '<p style="color:#aab3e0;">Nothing flagged to revisit — nice work.</p>') +
      '<div style="margin-top:12px;"><button type="button" class="btn" id="viva-again">Start a new viva</button> ' +
      '<button type="button" class="btn btn-ghost" id="viva-close3">Close</button></div>';
    show(html);
    $("viva-again").addEventListener("click", function () { open(lesson); });
    $("viva-close3").addEventListener("click", close);
  }

  /* ---------------- public open / close ---------------- */
  function open(lessonArg) {
    if (!lessonArg || !lessonArg.id) return false;
    sessionToken += 1;
    buildPanel();
    lesson = lessonArg;
    finished = false;
    var last = loadStored(VIVA_LAST_KEY);
    var lastNote = (last && last.lessonId === lesson.id)
      ? " · Last viva: " + last.score + "/" + (last.total || MAX_Q) : "";
    var sub = $("viva-sub");
    if (sub) sub.textContent = lesson.title + " · up to " + MAX_Q + " questions · answer in your own words" + lastNote;
    overlay.style.display = "flex";
    var saved = loadStored(VIVA_SESSION_KEY);
    if (saved && saved.lessonId === lesson.id && typeof saved.qCount === "number" && saved.qCount < MAX_Q) {
      show('<p style="font-size:1.05rem;line-height:1.5;">Resume your viva on <strong>' + esc(lesson.title) + "</strong>?</p>" +
        "<p>Score " + (typeof saved.score === "number" ? saved.score : 0) + " / " + MAX_Q +
        " · question " + (saved.qCount + 1) + " of " + MAX_Q + ".</p>" +
        (last && last.lessonId === lesson.id
          ? '<p style="color:#aab3e0;">Last viva on this lesson: ' + last.score + "/" + (last.total || MAX_Q) + ".</p>" : "") +
        '<div style="margin-top:12px;"><button type="button" class="btn" id="viva-resume">Resume</button> ' +
        '<button type="button" class="btn btn-ghost" id="viva-new">Start new</button></div>');
      $("viva-resume").addEventListener("click", function () {
        asked = Array.isArray(saved.asked) ? saved.asked.slice() : [];
        revisitIds = Array.isArray(saved.revisitIds) ? saved.revisitIds.slice() : [];
        score = typeof saved.score === "number" ? saved.score : 0;
        qCount = saved.qCount;
        currentAnswer = "";
        busy = false;
        // Restore the in-progress question instead of asking a fresh
        // one; sessions saved before this fix (no currentQuestion)
        // fall back to a fresh question as before.
        if (typeof saved.currentQuestion === "string" && saved.currentQuestion.trim()) {
          currentQuestion = saved.currentQuestion;
          showQuestion();
        } else {
          currentQuestion = "";
          askQuestion();
        }
      });
      $("viva-new").addEventListener("click", function () {
        clearSession();
        resetSession();
        askQuestion();
      });
      return true;
    }
    if (saved && saved.lessonId === lesson.id) clearSession(); // stale finished session
    resetSession();
    askQuestion();
    return true;
  }

  function close() {
    sessionToken += 1;
    if (overlay) overlay.style.display = "none";
    busy = false;
    // Closing mid-session keeps the saved session (already persisted on
    // every judged answer) so it can be resumed; a finished session
    // was already cleared by showSummary. An unanswered in-progress
    // question is also saved, so closing mid-question-1 is resumable.
    if (!finished && lesson && (qCount > 0 || asked.length > 0 || currentQuestion)) saveSession();
  }

  /* ---------------- lesson lookup (no duplicated data) ---------------- */
  function currentLesson() {
    var id = null;
    try {
      var m = (window.location.search || "").match(/[?&]id=([\w-]+)/);
      if (m) id = m[1];
    } catch (e) {}
    if (!id) return null;
    try {
      if (window.SkillzifyLearnCore && window.SkillzifyLearnCore.lessonById) {
        return window.SkillzifyLearnCore.lessonById(id);
      }
      if (window.SkillzifyLearnCore && window.SkillzifyLearnCore.LESSONS) {
        var list = window.SkillzifyLearnCore.LESSONS;
        for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      }
    } catch (e) {}
    return null;
  }

  /* ---------------- hooks ---------------- */
  function addLessonButton() {
    if ($(BTN_ID)) return true;
    var host = document.querySelector(".lesson-actions") || $("lm-try");
    if (!host) return false;
    // #lm-try is the button itself; attach to its parent actions row.
    var row = host.classList && host.classList.contains("lesson-actions")
      ? host : (host.parentNode && host.parentNode.classList &&
        host.parentNode.classList.contains("lesson-actions") ? host.parentNode : host.parentNode);
    if (!row || !row.appendChild) return false;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = BTN_ID;
    btn.className = "btn btn-sm btn-ghost";
    btn.textContent = "🎙️ Mock viva";
    btn.addEventListener("click", function () {
      var l = currentLesson();
      if (!l) {
        open({ id: "__none__", title: "Lesson", explain: "", code: "" });
        showError("Couldn't find this lesson's data. Reload the page and try again.", "Close", close);
        return;
      }
      open(l);
    });
    row.appendChild(btn);
    return true;
  }

  function hookLessonPage() {
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (addLessonButton() || tries >= 20) clearInterval(timer); // ~10s max
    }, 500);
  }

  // Paths: first uncompleted lesson step in the path (else its first lesson).
  function pathTargetLesson(path) {
    if (!path || !path.steps) return null;
    var firstLesson = null;
    for (var i = 0; i < path.steps.length; i++) {
      var s = path.steps[i];
      if (!s || s.t !== "lesson") continue;
      var l = null;
      try {
        if (window.SkillzifyLearnCore && window.SkillzifyLearnCore.lessonById) {
          l = window.SkillzifyLearnCore.lessonById(s.id);
        }
      } catch (e) {}
      if (!l) continue;
      if (!firstLesson) firstLesson = l;
      var done = false;
      try { done = !!(window.SkillzifyLearnCore && window.SkillzifyLearnCore.isDone && window.SkillzifyLearnCore.isDone(s.id)); } catch (e) {}
      if (!done) return l;
    }
    return firstLesson;
  }

  function addPathButton() {
    if ($(PATH_BTN_ID)) return;
    var m = (window.location.hash || "").match(/^#path=([\w-]+)/);
    if (!m) return;
    var paths = window.SkillzifyPaths || [];
    var path = null;
    for (var i = 0; i < paths.length; i++) if (paths[i].id === m[1]) path = paths[i];
    if (!path) return;
    var card = document.querySelector(".up-next");
    if (!card) return;
    var target = pathTargetLesson(path);
    if (!target) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = PATH_BTN_ID;
    btn.className = "btn btn-sm btn-ghost";
    btn.textContent = "🎙️ Mock viva: " + target.title;
    btn.addEventListener("click", function () { open(target); });
    card.appendChild(btn);
  }

  function hookPathsPage() {
    // paths.js re-renders #paths-list on hashchange / sync / pageshow,
    // so re-inject after every render.
    var list = $("paths-list");
    if (!list) return;
    addPathButton();
    if (window.MutationObserver) {
      var obs = new MutationObserver(function () { addPathButton(); });
      obs.observe(list, { childList: true, subtree: true });
    }
    window.addEventListener("hashchange", function () {
      setTimeout(addPathButton, 50);
    });
  }

  function init() {
    var href = window.location.href || "";
    if (href.indexOf("lesson.html") >= 0) hookLessonPage();
    else if (href.indexOf("paths.html") >= 0) hookPathsPage();
  }
  try {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  } catch (e) {}

  window.SkillzifyViva = {
    open: open,
    close: close,
    maxQuestions: MAX_Q
  };
})();
