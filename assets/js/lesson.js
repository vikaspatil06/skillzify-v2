/* ============================================================
   Skillzify v2 — lesson.js (dedicated lesson page)
   Renders one full lesson at lesson.html?id=<lessonId>:
   explanation, code, quiz, mini challenge, XP completion,
   enrollment-aware prev/next navigation.
   Requires learn-core.js (window.SkillzifyLearnCore) loaded first.
   ============================================================ */
(function () {
  "use strict";
  var LC = window.SkillzifyLearnCore;
  var mount = document.getElementById("lesson-page");

  function fatal(msg) {
    if (mount) mount.innerHTML = '<div class="lesson-locked"><div class="big">\u26A0\uFE0F</div><h2>Something went wrong</h2><p class="hint">' + msg + '</p><p><a class="btn" href="learn.html">\u2190 Back to Learn</a></p></div>';
  }
  if (!LC) { fatal("The learning engine failed to load. Please hard-refresh the page."); return; }
  if (!mount) return;

  /* local aliases */
  var LESSONS = LC.LESSONS, TRACKS = LC.TRACKS;
  var esc = LC.esc, el = LC.el, reducedMotion = LC.reducedMotion;
  var highlightPython = LC.highlight, copyCode = LC.copyCode, tryInCompiler = LC.tryInCompiler;
  var getProgress = LC.getProgress, saveProgress = LC.saveProgress,
      getState = LC.getState, saveState = LC.saveState,
      getXP = LC.getXP, addXP = LC.addXP, levelFor = LC.levelFor,
      bumpStreak = LC.bumpStreak;
  var idxOf = LC.idxOf, lessonById = LC.lessonById, isDone = LC.isDone,
      isUnlocked = LC.isUnlocked, isPathOnlyUnlocked = LC.isPathOnlyUnlocked;

  /* ================= Lesson state ================= */
  var cur = -1, quizState = [], challengeOk = false, curQuiz = [];

  /* enrollment-aware neighbors in global order */
  function prevUnlocked(gi) { for (var j = gi - 1; j >= 0; j--) if (isUnlocked(j)) return j; return -1; }
  function nextUnlocked(gi) { for (var j = gi + 1; j < LESSONS.length; j++) if (isUnlocked(j)) return j; return -1; }
  function lessonHref(gi) { return "lesson.html?id=" + encodeURIComponent(LESSONS[gi].id); }

  function buildQuiz(lesson) {
    var bank = lesson.quiz || [];
    var picked = LC.shuffled(bank).slice(0, Math.min(3, bank.length));
    return picked.map(function (q) {
      var order = LC.shuffled(q.options.map(function (_, i) { return i; }));
      return {
        q: q.q,
        options: order.map(function (i) { return q.options[i]; }),
        answer: order.indexOf(q.answer),
        why: q.why
      };
    });
  }

  function quizHTML() {
    return curQuiz.map(function (q, qi) {
      var opts = q.options.map(function (o, oi) {
        return '<button class="quiz-opt" data-qi="' + qi + '" data-oi="' + oi + '">' +
          "<strong>" + "ABCD"[oi] + ".</strong> " + esc(o) + "</button>";
      }).join("");
      return '<div class="quiz-q" data-qi="' + qi + '"><h4>Q' + (qi + 1) + ". " + esc(q.q) + "</h4>" +
        opts + '<div class="quiz-why" id="why-' + qi + '"></div></div>';
    }).join("");
  }

  function challengeHTML(ch) {
    var inner = '<h4>🎯 Mini challenge</h4><p class="ch-prompt">' + esc(ch.prompt) + "</p>";
    if (ch.code) inner += '<div class="code-window"><div class="cw-bar"><span class="cw-dot" style="background:#f87171"></span><span class="cw-dot" style="background:#fbbf24"></span><span class="cw-dot" style="background:#34d399"></span></div><pre><code>' + highlightPython(ch.code) + "</code></pre></div>";
    if (ch.type === "predict") {
      inner += ch.options.map(function (o, i) {
        return '<button class="quiz-opt ch-opt" data-oi="' + i + '"><strong>' + "ABCD"[i] + ".</strong> " + esc(o) + "</button>";
      }).join("");
    } else {
      inner += '<div class="blank-row"><input type="text" id="ch-blank" placeholder="Type your answer…" autocomplete="off" spellcheck="false" aria-label="Your answer">' +
        '<button class="btn btn-sm" id="ch-check">Check</button></div>';
    }
    inner += '<div class="ch-feedback" id="ch-feedback"></div>';
    if (ch.hint) inner += '<details class="ch-hint"><summary>Need a hint?</summary><p>' + esc(ch.hint) + "</p></details>";
    return inner;
  }

  function refreshComplete() {
    var btn = document.getElementById("lm-complete");
    if (!btn) return;
    var allQuiz = quizState.length && quizState.every(function (q) { return q.correct; });
    btn.disabled = !(allQuiz && challengeOk);
    btn.innerHTML = btn.disabled ? "🔒 Finish the quiz &amp; challenge to complete" : "🎉 Complete lesson · +XP";
  }

  function bindQuiz() {
    document.querySelectorAll("#lm-quiz .quiz-opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var qi = +btn.dataset.qi, oi = +btn.dataset.oi, q = curQuiz[qi], st = quizState[qi];
        if (st.correct) return;
        var box = btn.closest(".quiz-q");
        if (oi === q.answer) {
          st.correct = true;
          btn.classList.add("correct");
          box.querySelectorAll(".quiz-opt").forEach(function (b) { b.disabled = true; });
          showWhy(qi, "✅ Correct! " + q.why);
        } else {
          st.firstTry = false;
          btn.classList.add("wrong"); btn.disabled = true;
          showWhy(qi, "❌ Not quite — try again. " + q.why);
        }
        refreshComplete();
      });
    });
  }
  function showWhy(qi, msg) {
    var w = document.getElementById("why-" + qi);
    if (w) { w.textContent = msg; w.classList.add("show"); }
  }

  function norm(s) { return String(s).trim().toLowerCase(); }
  function bindChallenge(lesson) {
    var ch = lesson.challenge, box = document.getElementById("lm-challenge");
    var fb = document.getElementById("ch-feedback");
    function succeed(msg) {
      challengeOk = true;
      box.classList.add("done");
      fb.innerHTML = '<span class="ch-ok">✅ ' + esc(msg || "Correct — challenge smashed!") + "</span>";
      box.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      var inp = document.getElementById("ch-blank");
      if (inp) inp.disabled = true;
      refreshComplete();
    }
    if (ch.type === "predict") {
      box.querySelectorAll(".ch-opt").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (challengeOk) return;
          if (+btn.dataset.oi === ch.answer) { btn.classList.add("correct"); succeed(); }
          else { btn.classList.add("wrong"); btn.disabled = true; fb.innerHTML = '<span class="ch-bad">❌ Nope — think again!</span>'; }
        });
      });
    } else {
      var answers = Array.isArray(ch.answer) ? ch.answer : [ch.answer];
      var check = function () {
        if (challengeOk) return;
        var v = norm(document.getElementById("ch-blank").value);
        if (answers.some(function (a) { return norm(a) === v; })) succeed();
        else fb.innerHTML = '<span class="ch-bad">❌ Not quite — check the hint if you\'re stuck.</span>';
      };
      document.getElementById("ch-check").addEventListener("click", check);
      document.getElementById("ch-blank").addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
    }
  }

  function confetti() {
    if (reducedMotion()) return;
    var layer = document.getElementById("confetti-layer");
    layer.innerHTML = "";
    var colors = ["#6c7bff", "#9d6bff", "#22d3ee", "#34d399", "#fbbf24", "#f87171"];
    for (var i = 0; i < 60; i++) {
      var s = document.createElement("span");
      s.className = "confetti-piece";
      s.style.left = (Math.random() * 100) + "vw";
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = (Math.random() * 0.35) + "s";
      var sz = 6 + Math.random() * 8;
      s.style.width = sz + "px"; s.style.height = sz * (Math.random() > 0.5 ? 1 : 0.5) + "px";
      layer.appendChild(s);
    }
    setTimeout(function () { layer.innerHTML = ""; }, 2400);
  }
  function xpPop(n) {
    var card = document.getElementById("xp-card");
    if (!card || reducedMotion()) return;
    var s = document.createElement("span");
    s.className = "xp-pop"; s.textContent = "+" + n + " XP";
    card.appendChild(s);
    setTimeout(function () { s.remove(); }, 1600);
  }

  /* ================= Locked / not-found views ================= */
  function renderNotFound() {
    document.title = "Lesson not found — Skillzify";
    mount.innerHTML = '<div class="lesson-locked"><div class="big">\U0001F50D</div>' +
      "<h2>Lesson not found</h2>" +
      '<p class="hint">We couldn\u2019t find that lesson. It may have been moved or the link is wrong.</p>' +
      '<p><a class="btn" href="learn.html">\u2190 Back to Learn</a></p></div>';
  }

  function renderLocked(lesson) {
    document.title = "\U0001F512 " + lesson.title + " — Skillzify";
    var track = TRACKS.filter(function (t) { return t.id === lesson.track; })[0] || { icon: "\U0001F4DA", name: "Python" };
    var inPaths = [];
    try {
      var P = window.SkillzifyPaths;
      if (P) P.forEach(function (p) {
        var has = (p.steps || []).some(function (s) { return s.t === "lesson" && s.id === lesson.id; });
        if (has) inPaths.push(p);
      });
    } catch (e) {}
    var pathCta = inPaths.length ?
      '<div class="card lesson-path-cta"><h3 style="margin-top:0">\U0001F513 Unlock it instantly</h3>' +
      '<p class="hint">This lesson is part of ' + inPaths.map(function (p) { return "<strong>" + esc(p.title) + "</strong>"; }).join(", ") +
      '. Enroll in the path to unlock it right away — no need to finish everything before it.</p>' +
      inPaths.map(function (p) { return '<a class="btn btn-sm" href="paths.html#path=' + p.id + '">View ' + esc(p.title) + "</a> "; }).join("") + "</div>"
      : "";
    mount.innerHTML =
      '<nav class="lesson-crumb"><a href="learn.html">Learn</a><span>\u203A</span><span>' + esc(track.name) + '</span></nav>' +
      '<div class="lesson-locked"><div class="big">\U0001F512</div>' +
      "<h2>This lesson is locked</h2>" +
      '<p class="hint">Finish the previous lessons in order to unlock <strong>' + esc(lesson.title) + "</strong>.</p>" +
      '<p><a class="btn" href="learn.html">\u2190 Back to Learn</a> <a class="btn btn-ghost" href="paths.html">Learning paths</a></p></div>' +
      pathCta;
  }

  /* ================= Lesson view ================= */
  function renderLesson(gi) {
    cur = gi;
    var lesson = LESSONS[gi];
    curQuiz = buildQuiz(lesson); // fresh random pick + shuffled options, every open
    quizState = curQuiz.map(function () { return { correct: false, firstTry: true }; });
    challengeOk = isDone(lesson.id); // re-opening a done lesson: challenge pre-satisfied
    var track = TRACKS.filter(function (t) { return t.id === lesson.track; })[0] || { icon: "\U0001F4DA", name: "Python" };
    var num = gi + 1;
    var pathOnly = !isDone(lesson.id) && isPathOnlyUnlocked(gi);
    var prev = prevUnlocked(gi), next = nextUnlocked(gi);
    document.title = lesson.title + " — Skillzify";

    mount.innerHTML =
      '<nav class="lesson-crumb"><a href="learn.html">Learn</a><span>\u203A</span><span>' + esc(track.name) +
      '</span><span>\u203A</span><span class="crumb-cur">' + esc(lesson.title) + "</span></nav>" +
      '<div class="lm-kicker">' + track.icon + " " + esc(track.name) + " · Lesson " + num + " of " + LESSONS.length +
      (pathOnly ? ' · <span class="unlock-badge">\U0001F513 Unlocked by your learning path</span>' : "") + "</div>" +
      "<h2>" + esc(lesson.title) + "</h2>" +
      '<p class="lm-explain">' + esc(lesson.explain) + "</p>" +
      '<ul class="list-check lm-points">' + lesson.takeaways.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
      '<div class="code-window"><div class="cw-bar"><span class="cw-dot" style="background:#f87171"></span><span class="cw-dot" style="background:#fbbf24"></span><span class="cw-dot" style="background:#34d399"></span><span class="cw-title">example.py</span></div>' +
      "<pre><code>" + highlightPython(lesson.code) + "</code></pre></div>" +
      '<div class="lesson-actions">' +
      '<button class="btn btn-sm btn-ghost" id="lm-copy">\u29C9 Copy code</button>' +
      '<button class="btn btn-sm" id="lm-try">\u25B6 Try in compiler</button>' +
      '<button class="btn btn-sm btn-ghost" id="lm-star" aria-label="Star lesson">\u2B50</button>' +
      '<button class="btn btn-sm btn-ghost" id="lm-pin" aria-label="Pin lesson">\U0001F4CC</button></div>' +
      '<h3 class="lm-sec">\U0001F9E0 Quick quiz</h3><p class="hint" style="margin-top:0">Answer all correctly to proceed. Questions are picked fresh every time — no two attempts are the same. Wrong answers just cost you bonus XP — keep trying!</p>' +
      '<div id="lm-quiz">' + quizHTML() + "</div>" +
      '<h3 class="lm-sec">\U0001F3AF Mini challenge</h3><div class="challenge" id="lm-challenge">' + challengeHTML(lesson.challenge) + "</div>" +
      '<div class="lm-complete" id="lm-complete-wrap">' +
      (isDone(lesson.id)
        ? '<div class="lesson-done-note">\u2705 You\u2019ve completed this lesson — nice work! Redo the quiz any time for practice.</div>'
        : '<button class="btn" id="lm-complete" disabled>\U0001F512 Finish the quiz &amp; challenge to complete</button>') +
      '<div class="lm-nav">' +
      (prev >= 0 ? '<a class="icon-btn" href="' + lessonHref(prev) + '" aria-label="Previous lesson">\u2190</a>'
                 : '<button class="icon-btn" disabled aria-label="No previous lesson">\u2190</button>') +
      (next >= 0 ? '<a class="icon-btn" href="' + lessonHref(next) + '" aria-label="Next lesson">\u2192</a>'
                 : '<a class="icon-btn" href="learn.html" aria-label="Back to Learn">\u2713</a>') +
      "</div></div>";

    document.getElementById("lm-copy").addEventListener("click", function (e) { copyCode(e.currentTarget, lesson.code); });
    document.getElementById("lm-try").addEventListener("click", function () { tryInCompiler(lesson.code); });
    (function () {
      var A = window.SkillzifyActivity; if (!A) return;
      var starBtn = document.getElementById("lm-star"), pinBtn = document.getElementById("lm-pin");
      function paint() {
        starBtn.textContent = A.isStarred("lesson", lesson.id) ? "\U0001F31F Starred" : "\u2B50 Star";
        pinBtn.textContent = A.isPinned("lesson", lesson.id) ? "\U0001F4CC Pinned" : "\U0001F4CC Pin";
      }
      paint();
      starBtn.addEventListener("click", function () {
        var on = A.toggleStar("lesson", lesson.id, lesson.title);
        A.log("star", (on ? "Starred lesson: " : "Unstarred lesson: ") + lesson.title);
        paint(); window.Skillzify.toast(on ? "Starred \u2B50" : "Unstarred", "success");
      });
      pinBtn.addEventListener("click", function () {
        var on = A.togglePin("lesson", lesson.id, lesson.title);
        paint(); window.Skillzify.toast(on ? "Pinned \U0001F4CC" : "Unpinned", "success");
      });
    })();
    bindQuiz();
    bindChallenge(lesson);
    var doneBtn = document.getElementById("lm-complete");
    if (doneBtn) doneBtn.addEventListener("click", completeLesson);
    refreshComplete();
    window.scrollTo(0, 0);
  }

  function completeLesson() {
    var lesson = LESSONS[cur];
    if (!lesson || isDone(lesson.id)) return;
    var firstTries = quizState.filter(function (q) { return q.correct && q.firstTry; }).length;
    var gain = 20 + firstTries * 5 + 10;
    var before = levelFor(getXP()).name;
    var xp = addXP(gain);
    var after = levelFor(xp).name;
    var p = getProgress(); p[lesson.id] = true; saveProgress(p);
    var st = getState(); delete st[lesson.id]; saveState(st);
    bumpStreak();
    if (window.SkillzifySync) window.SkillzifySync.markDirty();
    if (window.SkillzifyActivity) window.SkillzifyActivity.log("lesson", "Completed lesson: " + lesson.title);
    confetti();
    xpPop(gain);
    if (before !== after) {
      window.Skillzify.toast("\U0001F389 LEVEL UP! You are now " + after + " (+" + gain + " XP)", "success");
    } else {
      window.Skillzify.toast("Lesson complete! +" + gain + " XP \U0001F389", "success");
    }
    var next = nextUnlocked(cur);
    var wrap = document.getElementById("lm-complete-wrap");
    if (wrap) {
      wrap.innerHTML = '<div class="lesson-done-note">\u2705 <strong>Completed!</strong> +' + gain + ' XP earned.</div>' +
        '<div class="lm-nav">' +
        (next >= 0 ? '<a class="btn" href="' + lessonHref(next) + '">Next lesson: ' + esc(LESSONS[next].title) + " \u2192</a>"
                   : '<a class="btn" href="learn.html">\u2190 Back to Learn</a>') +
        "</div>";
    }
  }

  /* ================= Keyboard ================= */
  document.addEventListener("keydown", function (e) {
    if (cur < 0) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowRight") {
      var n = nextUnlocked(cur);
      if (n >= 0) location.href = lessonHref(n);
    } else if (e.key === "ArrowLeft") {
      var pv = prevUnlocked(cur);
      if (pv >= 0) location.href = lessonHref(pv);
    }
  });

  /* ================= Init ================= */
  (function init() {
    var id = null;
    try { id = new URLSearchParams(location.search).get("id"); } catch (e) {}
    if (!id) { renderNotFound(); return; }
    var gi = idxOf(id);
    if (gi < 0) { renderNotFound(); return; }
    if (!isUnlocked(gi)) { renderLocked(LESSONS[gi]); return; }
    renderLesson(gi);
  })();
})();
