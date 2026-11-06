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
  var LESSONS = LC.LESSONS, TRACKS = LC.TRACKS, SECTIONS = LC.SECTIONS;
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
          showWhy(qi, "✅ Correct!" + (q.why ? " " + q.why : ""));
        } else {
          st.firstTry = false;
          btn.classList.add("wrong"); btn.disabled = true;
          showWhy(qi, "❌ Not quite — try again." + (q.why ? " " + q.why : ""));
        }
        refreshComplete();
      });
    });
  }
  function showWhy(qi, msg) {
    var w = document.getElementById("why-" + qi);
    if (w) { w.textContent = msg; w.classList.add("show"); }
  }

  /* ================= AI tutor (F1) ================= */
  // Signed-out users get 10 AI answers/day (50/day signed in) — the
  // tutor card says so, and only there. Guarded: no auth module, no hint.
  function capHintHtml() {
    var signedOut = false;
    try { signedOut = !!(window.SkillzifyAuth && typeof window.SkillzifyAuth.currentUser === "function" && !window.SkillzifyAuth.currentUser()); } catch (e) { signedOut = false; }
    return signedOut ? '<p class="hint" style="margin-top:0">Signed out? AI answers are 10/day — sign in for 50/day.</p>' : "";
  }
  // M3: refresh the tutor cap hint when auth state changes (e.g.
  // sign-in/out in another tab) — re-renders the hint line only,
  // never the tutor answer or the quiz.
  function refreshCapHint() {
    var host = document.getElementById("tutor-cap-hint");
    if (host) host.innerHTML = capHintHtml();
  }
  function bindTutor(lesson) {
    var AI = window.SkillzifyAI;
    var askBtn = document.getElementById("tutor-ask");
    var input = document.getElementById("tutor-q");
    var ans = document.getElementById("tutor-answer");
    if (!askBtn || !input || !ans) return;
    if (!AI) { ans.textContent = "AI is unavailable on this page."; askBtn.disabled = true; return; }
    function ask() {
      var q = input.value.trim();
      if (!q) { ans.textContent = "Type a question about this lesson first."; return; }
      askBtn.disabled = true; input.disabled = true;
      ans.innerHTML = "\u{1F916} Thinking\u2026";
      var code = lesson.title + "\n\n" + lesson.explain + "\n\n" + lesson.code +
        "\n\nStudent question: " + q;
      AI.ask({
        mode: "tutor-lesson",
        code: code,
        context: AI.buildContext({ lesson: lesson.title, section: track.name })
      }, function (err, res) {
        askBtn.disabled = false; input.disabled = false;
        if (err) {
          var m = (err && err.message) || "The AI didn't answer.";
          if (m.slice(-1) !== ".") m += ".";
          if (err && err.code === "DAILY_CAP") {
            // Sign-in link only when signed out (ai.js capLink
            // returns "" for signed-in users at the 50/day cap).
            ans.innerHTML = esc(m) + " Try again." +
              (AI.capLink ? AI.capLink() : "");
          } else {
            ans.textContent = m + " Try again.";
          }
          return;
        }
        var text = (res && res.text) || "No answer returned.";
        // Item 8a (round 4): a repeat question served from cache gets a
        // small muted "(cached)" note — same .hint styling as the card.
        ans.innerHTML = (res && res.cached ? '<span class="hint">(cached)</span> ' : "") + esc(text).replace(/\n/g, "<br>");
      });
    }
    askBtn.addEventListener("click", ask);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") ask(); });
  }

  /* ================= Fresh quiz (F7) ================= */
  function bindFreshQuiz(lesson) {
    var AI = window.SkillzifyAI;
    var btn = document.getElementById("lm-new-quiz");
    var note = document.getElementById("lm-quiz-note");
    if (!btn) return;
    if (!AI) { btn.disabled = true; return; }
    btn.addEventListener("click", function () {
      // Don't wipe answers already given: ask first, abort on cancel.
      var answered = quizState.filter(function (q) { return q.correct || !q.firstTry; }).length;
      if (answered > 0 && !confirm("You've answered " + answered + " of " + quizState.length +
          " — get new questions and lose these answers?")) return;
      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = "\u{1F916} Fetching\u2026";
      if (note) note.textContent = "";
      var payload = {
        title: lesson.title,
        explain: lesson.explain,
        code: lesson.code,
        existingQuiz: (lesson.quiz || []).map(function (q) { return q.q; })
      };
      AI.ask({
        mode: "quiz",
        json: true,
        code: JSON.stringify(payload),
        context: AI.buildContext({ lesson: lesson.title, section: track.name })
      }, function (err, res) {
        btn.disabled = false;
        btn.textContent = label;
        var qs = res && res.data && res.data.questions;
        var ok = !err && Array.isArray(qs) && qs.length > 0 && qs.every(function (q) {
          return q && typeof q.q === "string" &&
            Array.isArray(q.options) && q.options.length === 4 &&
            q.options.every(function (o) { return typeof o === "string"; }) &&
            typeof q.answer === "number" && q.answer >= 0 && q.answer <= 3 &&
            Math.floor(q.answer) === q.answer;
        });
        if (!ok) {
          if (note) {
            if (err && err.code === "DAILY_CAP") {
              // Sign-in link only when signed out (ai.js capLink
              // returns "" for signed-in users at the 50/day cap).
              note.innerHTML = esc(err.message || "You've used your AI answers for today — they reset tomorrow.") +
                (AI.capLink ? AI.capLink() : "");
            } else {
              note.textContent = "Couldn't fetch new questions \u2014 keeping the current quiz.";
            }
          }
          return;
        }
        curQuiz = qs.map(function (q) {
          return { q: q.q, options: q.options.slice(), answer: q.answer, why: q.why || "" };
        });
        quizState = curQuiz.map(function () { return { correct: false, firstTry: true }; });
        var box = document.getElementById("lm-quiz");
        if (box) box.innerHTML = quizHTML();
        bindQuiz();
        refreshComplete();
      });
    });
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
    mount.innerHTML = '<div class="lesson-locked"><div class="big">\u{1F50D}</div>' +
      "<h2>Lesson not found</h2>" +
      '<p class="hint">We couldn\u2019t find that lesson. It may have been moved or the link is wrong.</p>' +
      '<p><a class="btn" href="learn.html">\u2190 Back to Learn</a></p></div>';
  }

  function renderLocked(lesson) {
    document.title = "\u{1F512} " + lesson.title + " — Skillzify";
    var track = (SECTIONS.filter(function (t) { return t.id === lesson.section; })[0]) || { icon: "\u{1F4DA}", name: "Python" };
    var inPaths = [];
    try {
      var P = window.SkillzifyPaths;
      if (P) P.forEach(function (p) {
        var has = (p.steps || []).some(function (s) { return s.t === "lesson" && s.id === lesson.id; });
        if (has) inPaths.push(p);
      });
    } catch (e) {}
    var pathCta = inPaths.length ?
      '<div class="card lesson-path-cta"><h3 style="margin-top:0">\u{1F513} Unlock it instantly</h3>' +
      '<p class="hint">This lesson is part of ' + inPaths.map(function (p) { return "<strong>" + esc(p.title) + "</strong>"; }).join(", ") +
      '. Enroll in the path to unlock it right away — no need to finish everything before it.</p>' +
      inPaths.map(function (p) { return '<a class="btn btn-sm" href="paths.html#path=' + p.id + '">View ' + esc(p.title) + "</a> "; }).join("") + "</div>"
      : "";
    // Saved custom paths unlock their lessons when enrolled (the
    // unlock map in paths-data.js reads skillzify_custom_paths).
    // paths.js isn't loaded on lesson pages, so the CTA here just
    // links to the paths page, where the Enroll toggle lives.
    var customCta = "";
    try {
      var saved = JSON.parse(localStorage.getItem("skillzify_custom_paths") || "[]");
      var inCustom = [];
      if (Array.isArray(saved)) saved.forEach(function (cp) {
        // Guard each entry individually: one corrupt entry (non-object
        // or no steps array) must not throw out of the forEach and drop
        // the CTA for every other custom path. The outer try/catch
        // stays as a backstop for a wholly corrupt store.
        if (!cp || typeof cp !== "object" || !Array.isArray(cp.steps)) return;
        var has = cp.steps.some(function (s) {
          return s && typeof s === "object" && (s.lessonId === lesson.id || (s.t === "lesson" && s.id === lesson.id));
        });
        if (has) inCustom.push(cp);
      });
      if (inCustom.length) {
        customCta = '<div class="card lesson-path-cta"><h3 style="margin-top:0">💾 In your custom path</h3>' +
          '<p class="hint">This lesson is in your custom path ' +
          inCustom.map(function (cp) { return "<strong>" + esc(cp.title || "Custom path") + "</strong>"; }).join(", ") +
          " — enroll in that path to unlock it right away, no need to finish everything before it.</p>" +
          '<p><a class="btn btn-sm" href="paths.html">View learning paths</a></p></div>';
      }
    } catch (e) {}
    mount.innerHTML =
      '<nav class="lesson-crumb"><a href="learn.html">Learn</a><span>\u203A</span><span>' + esc(track.name) + '</span></nav>' +
      '<div class="lesson-locked"><div class="big">\u{1F512}</div>' +
      "<h2>This lesson is locked</h2>" +
      '<p class="hint">Finish the previous lessons in order to unlock <strong>' + esc(lesson.title) + "</strong>.</p>" +
      '<p><a class="btn" href="learn.html">\u2190 Back to Learn</a> <a class="btn btn-ghost" href="paths.html">Learning paths</a></p></div>' +
      pathCta + customCta;
  }

  /* ================= Lesson view ================= */
  function renderLesson(gi) {
    cur = gi;
    var lesson = LESSONS[gi];
    curQuiz = buildQuiz(lesson); // fresh random pick + shuffled options, every open
    quizState = curQuiz.map(function () { return { correct: false, firstTry: true }; });
    challengeOk = isDone(lesson.id); // re-opening a done lesson: challenge pre-satisfied
    var track = (SECTIONS.filter(function (t) { return t.id === lesson.section; })[0]) || { icon: "\u{1F4DA}", name: "Python" };
    var num = gi + 1;
    var pathOnly = !isDone(lesson.id) && isPathOnlyUnlocked(gi);
    var prev = prevUnlocked(gi), next = nextUnlocked(gi);
    document.title = lesson.title + " — Skillzify";

    mount.innerHTML =
      '<nav class="lesson-crumb"><a href="learn.html">Learn</a><span>\u203A</span><span>' + esc(track.name) +
      '</span><span>\u203A</span><span class="crumb-cur">' + esc(lesson.title) + "</span></nav>" +
      '<div class="lm-kicker">' + track.icon + " " + esc(track.name) + " · Lesson " + num + " of " + LESSONS.length +
      (pathOnly ? ' · <span class="unlock-badge">\u{1F513} Unlocked by your learning path</span>' : "") + "</div>" +
      "<h2>" + esc(lesson.title) + "</h2>" +
      '<p class="lm-explain">' + esc(lesson.explain) + "</p>" +
      '<ul class="list-check lm-points">' + lesson.takeaways.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
      '<div class="code-window"><div class="cw-bar"><span class="cw-dot" style="background:#f87171"></span><span class="cw-dot" style="background:#fbbf24"></span><span class="cw-dot" style="background:#34d399"></span><span class="cw-title">example.py</span></div>' +
      "<pre><code>" + highlightPython(lesson.code) + "</code></pre></div>" +
      '<div class="lesson-actions">' +
      '<button class="btn btn-sm btn-ghost" id="lm-copy">\u29C9 Copy code</button>' +
      '<button class="btn btn-sm" id="lm-try">\u25B6 Try in compiler</button>' +
      '<button class="btn btn-sm btn-ghost" id="lm-star" aria-label="Star lesson">\u2B50</button>' +
      '<button class="btn btn-sm btn-ghost" id="lm-pin" aria-label="Pin lesson">\u{1F4CC}</button></div>' +
      '<h3 class="lm-sec">\u{1F9E0} Quick quiz <button class="btn btn-sm btn-ghost" id="lm-new-quiz" type="button">\u2728 New AI quiz questions</button></h3><p class="hint" style="margin-top:0">Answer all correctly to proceed. Fresh questions are AI-generated on demand. Wrong answers just cost you bonus XP — keep trying!</p>' +
      '<div class="hint" id="lm-quiz-note" style="margin-top:0"></div>' +
      '<div id="lm-quiz">' + quizHTML() + "</div>" +
      '<h3 class="lm-sec">\u{1F3AF} Mini challenge</h3><div class="challenge" id="lm-challenge">' + challengeHTML(lesson.challenge) + "</div>" +
      '<h3 class="lm-sec">\u{1F916} Ask AI Tutor</h3><div class="card" id="lm-tutor">' +
      '<p class="hint" style="margin-top:0">Stuck on something in this lesson? Ask the tutor — it explains with hints and questions, and won\'t just hand you the answer.</p>' +
      '<span id="tutor-cap-hint">' + capHintHtml() + '</span>' +
      '<div class="blank-row"><input type="text" id="tutor-q" placeholder="Ask about this lesson\u2026" autocomplete="off" spellcheck="false" aria-label="Ask the AI tutor">' +
      '<button class="btn btn-sm" id="tutor-ask">Ask</button></div>' +
      '<div class="hint" id="tutor-answer" style="margin-top:12px">Ask a question and the tutor\u2019s answer will appear here.</div></div>' +
      '<div class="lm-complete" id="lm-complete-wrap">' +
      (isDone(lesson.id)
        ? '<div class="lesson-done-note">\u2705 You\u2019ve completed this lesson — nice work! Redo the quiz any time for practice.</div>'
        : '<button class="btn" id="lm-complete" disabled>\u{1F512} Finish the quiz &amp; challenge to complete</button>') +
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
        starBtn.textContent = A.isStarred("lesson", lesson.id) ? "\u{1F31F} Starred" : "\u2B50 Star";
        pinBtn.textContent = A.isPinned("lesson", lesson.id) ? "\u{1F4CC} Pinned" : "\u{1F4CC} Pin";
      }
      paint();
      starBtn.addEventListener("click", function () {
        var on = A.toggleStar("lesson", lesson.id, lesson.title);
        A.log("star", (on ? "Starred lesson: " : "Unstarred lesson: ") + lesson.title);
        paint(); window.Skillzify.toast(on ? "Starred \u2B50" : "Unstarred", "success");
      });
      pinBtn.addEventListener("click", function () {
        var on = A.togglePin("lesson", lesson.id, lesson.title);
        paint(); window.Skillzify.toast(on ? "Pinned \u{1F4CC}" : "Unpinned", "success");
      });
    })();
    bindQuiz();
    bindChallenge(lesson);
    bindTutor(lesson);
    bindFreshQuiz(lesson);
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
    if (window.SkillzifyReview && typeof window.SkillzifyReview.scheduleFor === "function") window.SkillzifyReview.scheduleFor(lesson.id);
    var st = getState(); delete st[lesson.id]; saveState(st);
    bumpStreak();
    if (window.SkillzifySync) window.SkillzifySync.markDirty();
    if (window.SkillzifyActivity) window.SkillzifyActivity.log("lesson", "Completed lesson: " + lesson.title);
    confetti();
    xpPop(gain);
    if (before !== after) {
      window.Skillzify.toast("\u{1F389} LEVEL UP! You are now " + after + " (+" + gain + " XP)", "success");
    } else {
      window.Skillzify.toast("Lesson complete! +" + gain + " XP \u{1F389}", "success");
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
    // M3: keep the tutor cap hint in step with sign-in/out (e.g. in
    // another tab). refreshCapHint re-renders the hint line only.
    try {
      if (window.SkillzifyAuth && typeof window.SkillzifyAuth.onAuthChange === "function") {
        window.SkillzifyAuth.onAuthChange(function () { refreshCapHint(); });
      }
    } catch (e) {}
  })();
})();
