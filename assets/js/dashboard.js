/* ============================================================
   Skillzify v2 — dashboard.js
   Reads localStorage progress + run history and renders the
   learning dashboard: overall %, per-section bars, streak, runs.
   ============================================================ */
(function () {
  "use strict";

  function renderDashboard() {
    if (!document.getElementById("dash-root")) return;
    var L = window.SkillzifyLearn;
    var progress = L.getProgress();
    var total = L.totalLessons;
    var done = L.LESSONS.filter(function (l) { return progress[l.id]; }).length;
    var overall = total ? Math.round((done / total) * 100) : 0;

    document.getElementById("dash-overall-num").textContent = overall + "%";
    document.getElementById("dash-overall-sub").textContent = done + " of " + total + " lessons complete";
    document.getElementById("dash-ring-fg").style.strokeDashoffset =
      String(264 - (264 * overall) / 100);

    // Per-section
    var tracksHtml = "";
    L.SECTIONS.forEach(function (t) {
      var pct = L.sectionPct(t.id);
      var td = L.LESSONS.filter(function (l) { return l.section === t.id && progress[l.id]; }).length;
      var tc = L.LESSONS.filter(function (l) { return l.section === t.id; }).length;
      tracksHtml += '<div class="progress-row"><span class="lbl">' + t.icon + " " + t.name + "</span>" +
        '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
        '<span class="pct">' + td + "/" + tc + "</span></div>";
    });
    document.getElementById("dash-tracks").innerHTML = tracksHtml;

    // Streak — single source of truth: SkillzifyActivity.streak()
    // (counter bumped by A.log() on any activity day). The profile and
    // the achievements read the same number, so they can never disagree.
    var st = null;
    try { st = window.SkillzifyActivity ? window.SkillzifyActivity.streak() : null; } catch (e) {}
    // P2-16: when SkillzifyActivity fails to load, the fallback reads
    // the raw counter — but it must replicate the lapse check, not
    // trust .count: a streak whose last activity was neither today
    // nor yesterday has lapsed and reads 0.
    var streakN = st ? st.current : streakFallbackCount();
    document.getElementById("dash-streak").textContent = streakN + " 🔥";
    // Best streak beside the current one — badges stay permanent, and the
    // two numbers together tell the truth (Vikas's call, 9 Nov).
    var stb = document.getElementById("dash-streak-best");
    if (stb && st && st.longest > 0) stb.textContent = "Best: " + st.longest + " days";

    // Level
    try {
      var xp = L.getXP(), lvl = L.levelFor(xp), nx = L.nextLevel(xp);
      var ln = document.getElementById("dash-level-name"), ls = document.getElementById("dash-level-sub"),
          lb = document.getElementById("dash-level-bar");
      if (ln) ln.textContent = lvl.name;
      if (ls) ls.textContent = xp.toLocaleString() + " XP" + (nx ? " · " + (nx.xp - xp) + " to " + nx.name : " · max level!");
      if (lb) lb.style.width = (nx ? Math.round((xp - lvl.xp) / (nx.xp - lvl.xp) * 100) : 100) + "%";
    } catch (e) {}

    // Runs
    var runs = window.Skillzify.storeGet("skillzify_runs", []);
    var box = document.getElementById("dash-runs");
    if (!runs.length) {
      box.innerHTML = '<p class="hint">No runs yet — head to the <a href="compiler.html">compiler</a> and run your first program!</p>';
    } else {
      var html = "";
      runs.slice(0, 8).forEach(function (r) {
        var d = new Date(r.t);
        var when = d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        html += '<div class="run-item"><span>' + window.Skillzify.esc(r.preview || "(empty)") + '</span>' +
          '<span><span class="badge ' + (r.ok ? "ok" : "fail") + '">' + (r.ok ? "OK" : "Error") + "</span> " +
          '<span class="hint">' + r.ms + " ms · " + when + "</span></span></div>";
      });
      box.innerHTML = html;
    }

    renderGreeting();

    renderUpgrades();
    renderNextUp();
    renderDailyPlan();
  }

  // Greeting — its own function so auth changes can re-render just
  // this line (P2-52; mirrors profile.js decideView/onAuthChange).
  // Firebase restores the session asynchronously, so the first render
  // (on DOMContentLoaded) can only see a signed-out user; the
  // onAuthChange subscription below fixes it the moment auth resolves.
  var greetingWired = false;
  function renderGreeting() {
    var el = document.getElementById("dash-hello");
    if (!el) return;
    var user = null;
    try { user = window.SkillzifyAuth ? window.SkillzifyAuth.currentUser() : null; } catch (e) {}
    el.textContent =
      user ? "Welcome back, " + user.name.split(" ")[0] + "! Keep the streak alive 🔥" :
             "Your learning at a glance — log in to sync your name here.";
    if (!greetingWired && window.SkillzifyAuth && typeof window.SkillzifyAuth.onAuthChange === "function") {
      greetingWired = true;
      window.SkillzifyAuth.onAuthChange(function () { renderGreeting(); });
    }
  }

  // P2-16 fallback: current streak from the raw skillzify_streak
  // counter, with the same lapse rule as Activity.streakCounter()
  // (last === today or yesterday, else 0). Legacy toDateString()
  // values are normalised the same way activity.js normDay does.
  function streakFallbackCount() {
    try {
      var raw = window.Skillzify.storeGet("skillzify_streak", { last: null, count: 0 }) || {};
      var last = raw.last ? new Date(raw.last) : null;
      if (!last || isNaN(last.getTime())) return 0;
      var iso = function (d) { var m = d.getMonth() + 1, dy = d.getDate(); return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (dy < 10 ? "0" + dy : dy); };
      var lastIso = iso(last), today = iso(new Date()), yest = iso(new Date(Date.now() - 864e5));
      return (lastIso === today || lastIso === yest) ? (raw.count || 0) : 0;
    } catch (e) { return 0; }
  }

  /* Next Up card (Mastery Engine Phase 2): the dashboard hero now shows
     the engine's top-ranked step with the reason why. Falls back to the
     first incomplete lesson when mastery.js didn't load. */
  var dashNuIdx = 0;
  /* Concept Map amplification (Part A3): "Show on map" beside the Next
     Up button, deep-linking at the step's lesson (?lesson=) — a review
     step lands on its oldest due lesson. Steps with no lesson (a drill,
     an intro exercise, all-done) hide the link instead of linking
     nowhere useful. */
  function setNextUpMapLink(lessonId) {
    var mp = document.getElementById("dash-next-map");
    if (!mp) return;
    if (lessonId) {
      mp.href = "map.html?lesson=" + encodeURIComponent(lessonId);
      mp.hidden = false;
    } else {
      mp.hidden = true;
    }
  }
  function renderNextUp() {
    var t = document.getElementById("dash-next-title"),
        sub = document.getElementById("dash-next-sub"),
        b = document.getElementById("dash-next-btn"),
        c = document.getElementById("dash-next-cycle");
    if (!t || !sub) return;
    var M = window.SkillzifyMastery;
    if (!M || typeof M.nextSteps !== "function") { renderNextUpLegacy(t, sub, b, c); return; }
    var steps = M.nextSteps();
    if (!steps.length) { renderNextUpLegacy(t, sub, b, c); return; }
    var step = steps[dashNuIdx % steps.length];
    t.textContent = step.title;
    sub.textContent = step.reason;
    if (b) { b.href = step.href; b.textContent = step.cta || "Go \u2192"; }
    setNextUpMapLink(step.kind === "lesson" ? step.lessonId :
      (step.kind === "review" && step.reviewIds && step.reviewIds[0]) ? step.reviewIds[0] : null);
    if (c) {
      c.hidden = steps.length <= 1;
      if (!c.dataset.wired) {
        c.dataset.wired = "1";
        c.addEventListener("click", function (ev) {
          ev.preventDefault();
          dashNuIdx = (dashNuIdx + 1) % M.nextSteps().length;
          renderNextUp();
        });
      }
    }
  }
  function renderNextUpLegacy(t, sub, b, c) {
    var L = window.SkillzifyLearn;
    if (!L) return;
    var p = L.getProgress();
    var done = L.LESSONS.filter(function (l) { return p[l.id]; }).length;
    // Placement-aware when available: the first undone lesson in global
    // order sends a placed learner back to Base Camp (P1-01).
    var next = (L.nextLesson ? L.nextLesson() : null) || L.LESSONS.filter(function (l) { return !p[l.id]; })[0];
    t.textContent = next ? next.title : "All 250 lessons complete — you're a Python star! \u{1F31F}";
    sub.textContent = next
      ? "Lesson " + (L.LESSONS.indexOf(next) + 1) + " of " + L.totalLessons + " \u00B7 " + (function () { var sec = (L.SECTIONS || []).filter(function (x) { return x.id === next.section; })[0]; return sec ? sec.icon + " " + sec.name : ""; })() + " \u00B7 " + done + " done so far"
      : "Time to build something of your own.";
    if (b) { b.href = "learn.html"; b.textContent = "Resume lesson \u2192"; }
    if (c) c.hidden = true;
    setNextUpMapLink(next ? next.id : null);
  }

  function renderUpgrades() {
    var A = window.SkillzifyActivity; if (!A) return;
    A.checkAchievements();

    // Achievements preview (compact — full grid lives on the profile)
    var ach = A.achievements().filter(function (a) { return a.unlocked; }).slice(0, 3);
    document.getElementById("dash-achievements").innerHTML = ach.length ? ach.map(function (a) {
      return '<div class="ach on" title="' + a.desc + '"><span class="ach-ico">' + a.icon + '</span><span class="ach-name">' + a.name + "</span></div>";
    }).join("") + '<p style="grid-column:1/-1"><a href="profile.html">All achievements →</a></p>'
      : '<p class="muted" style="grid-column:1/-1">Complete a lesson to earn your first badge. <a href="learn.html">Start →</a></p>';

    renderPracticeWidgets();
  }

  /* ---------- Practice analytics, daily, revision, certificates ---------- */
  // Topic rows (solved/tried/%) — shared by the weak-spots section and
  // the daily-challenge prompt so both read the same numbers.
  function topicRows(EX, atts) {
    var topics = {}, order = [];
    EX.forEach(function (ex) {
      if (!topics[ex.topic]) { topics[ex.topic] = { solved: 0, tried: 0 }; order.push(ex.topic); }
      var a = atts[ex.id];
      if (a && a.attempts > 0) {
        topics[ex.topic].tried++;
        if (a.solved) topics[ex.topic].solved++;
      }
    });
    // P2-22: labels come from the canonical copy in mastery.js
    // (SkillzifyMastery.TOPIC_LABELS). The literal fallback only runs
    // when mastery.js failed to load — the weak-spots section must
    // still render proper labels then (the topic label is the only
    // copy kept: deleting it would regress the no-mastery render).
    var labels = (window.SkillzifyMastery && window.SkillzifyMastery.TOPIC_LABELS) ||
      { variables: "Variables", strings: "Strings", collections: "Collections", loops: "Loops", functions: "Functions", oop: "OOP", exceptions: "Exceptions", dsa: "Algorithms", recursion: "Recursion", sorting: "Sorting", "trees-graphs": "Trees & Graphs", "dynamic-programming": "Dynamic Programming", "data-science": "Data Science", web: "Web", files: "Files", testing: "Testing", async: "Async" };
    return order.map(function (t) {
      var s = topics[t];
      return { topic: t, label: labels[t] || t, solved: s.solved, tried: s.tried,
               pct: s.tried ? Math.round(s.solved / s.tried * 100) : null };
    });
  }

  // Plain-text weak-spot summary for the AI daily challenge prompt.
  // P2-22: the canonical implementation lives in mastery.js
  // (SkillzifyMastery.weakSpotsSummary) — this is a thin delegate.
  // The solve-rate-only fallback below runs only when mastery.js
  // failed to load; it reuses topicRows() and never the mastery
  // weak/strong lines.
  function weakSpotsSummary(EX, atts) {
    try {
      var M = window.SkillzifyMastery;
      if (M && typeof M.weakSpotsSummary === "function") return M.weakSpotsSummary(EX, atts);
    } catch (e) {}
    var rows = topicRows(EX, atts);
    var tried = rows.filter(function (r) { return r.tried > 0; })
                    .sort(function (a, b) { return a.pct - b.pct || b.tried - a.tried; });
    var untried = rows.filter(function (r) { return r.tried === 0; });
    var unsolved = EX.filter(function (ex) { var a = atts[ex.id]; return a && a.attempts > 0 && !a.solved; });
    var parts = [];
    if (tried.length) {
      parts.push("Weakest topic: " + tried[0].label + " (" + tried[0].pct + "% of " + tried[0].tried + " tried).");
      if (tried.length > 1) parts.push("Strongest topic: " + tried[tried.length - 1].label + " (" + tried[tried.length - 1].pct + "%).");
    }
    if (unsolved.length) {
      parts.push("Unsolved exercises (" + unsolved.length + "): " +
        unsolved.slice(0, 5).map(function (ex) { return ex.title; }).join(", ") + ".");
    }
    if (untried.length) parts.push("Topics not tried yet: " + untried.map(function (r) { return r.label; }).join(", ") + ".");
    if (!parts.length) parts.push("No practice attempts yet — pick a beginner-friendly challenge.");
    return parts.join(" ");
  }
  // Test hook (also lets other pages reuse the prompt text).
  window.SkillzifyDashboard = { _weakSpotsSummary: weakSpotsSummary };

  // Local "YYYY-MM-DD" for the one-challenge-per-day cache.
  function localToday() {
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
  }

  // Minimal validation of an AI-generated challenge drill (mirrors
  // server.js isDrill: non-empty title/prompt/solution, string
  // starter, 1-4 tests each with string run AND string expect,
  // non-empty hints array).
  function validChallenge(ch) {
    return !!ch && typeof ch.title === "string" && !!ch.title &&
           typeof ch.prompt === "string" && !!ch.prompt &&
           typeof ch.starter === "string" &&
           typeof ch.solution === "string" && !!ch.solution &&
           Array.isArray(ch.tests) && ch.tests.length >= 1 && ch.tests.length <= 4 &&
           ch.tests.every(function (t) { return t && typeof t.run === "string" && !!t.run.trim() && typeof t.expect === "string"; }) &&
           Array.isArray(ch.hints) && ch.hints.length >= 1;
  }

  // Cooldown for failed challenge calls: a failed/invalid AI
  // response is never cached, so without this the challenge call
  // fires again on every dashboard load while the AI is down.
  var CHALLENGE_FAIL_KEY = "skillzify_daily_challenge_failed";
  var CHALLENGE_COOLDOWN_MS = 15 * 60 * 1000;
  // In-flight guard: only one AI challenge fetch runs at a time.
  var challengeInFlight = false;
  function challengeFailedRecently() {
    try {
      var v = parseInt(localStorage.getItem(CHALLENGE_FAIL_KEY) || "0", 10);
      return !!v && (Date.now() - v) < CHALLENGE_COOLDOWN_MS;
    } catch (e) { return false; }
  }
  function markChallengeFailed() {
    try { localStorage.setItem(CHALLENGE_FAIL_KEY, String(Date.now())); } catch (e) {}
  }
  function clearChallengeFailed() {
    try { localStorage.removeItem(CHALLENGE_FAIL_KEY); } catch (e) {}
  }

  function renderPracticeWidgets() {
    var EX = window.SkillzifyPracticeData || [];
    if (!EX.length) {
      var dd0 = document.getElementById("dash-daily");
      if (dd0) dd0.innerHTML = '<p class="hint">Practice data didn\'t load — check your connection and reload.</p>';
      return;
    }
    var esc = window.Skillzify.esc;
    var atts = {};
    try { atts = JSON.parse(localStorage.getItem("skillzify_exercise_attempts") || "{}"); } catch (e) {}

    // Daily challenge — AI-picked when available, cached one per day in
    // localStorage ("skillzify_daily_challenge"). Static exercise is the
    // fallback and renders first, so the card is never empty or broken.
    // The challenge itself is NOT verified here (no Python runner on the
    // dashboard) — practice.html#challenge verifies it before solving.
    var dd = document.getElementById("dash-daily");
    if (dd) {
      var day = Math.floor(Date.now() / 864e5);
      var dex = EX[day % EX.length];
      var da = atts[dex.id] || {};
      var renderStaticDaily = function () {
        dd.innerHTML = '<p><span class="badge">📅 Standard</span> <strong>' + esc(dex.title) + '</strong></p>' +
          '<p class="hint">' + esc(dex.prompt).slice(0, 90) + '…</p>' +
          '<p><a class="btn btn-sm" href="practice.html#ex=' + dex.id + '">' +
          (da.solved ? "Play again →" : "Start →") + "</a></p>";
      };
      // The AI card is a SECOND card below the static one — it never
      // replaces the static card, so its link target can't change
      // under the user while they read.
      var renderAIDaily = function (ch) {
        clearFailNote();
        if (document.getElementById("dash-daily-ai")) return;
        dd.innerHTML += '<div id="dash-daily-ai"><p><strong>' + esc(ch.title) + '</strong> <span class="badge badge-unlock">🤖 Picked for you</span></p>' +
          '<p class="hint">' + esc(ch.prompt).slice(0, 90) + '…</p>' +
          '<p><a class="btn btn-sm" href="practice.html#challenge">Take my challenge →</a></p></div>';
      };
      var clearFailNote = function () {
        var n = document.getElementById("dash-daily-fail");
        if (n && n.parentNode) n.parentNode.removeChild(n);
      };
      // Last challenge error, so an auth change can re-render the fail
      // note's sign-in link for the new auth state (M3, item 2).
      var lastFailErr = null;
      var renderFailNote = function (err) {
        // DAILY_CAP carries the server's message verbatim (10/day signed
        // out, 50/day signed in) — plus a sign-in link only when signed
        // out (ai.js capLink returns "" for signed-in users at cap).
        lastFailErr = err || null;
        var cap = err && err.code === "DAILY_CAP";
        var msg = cap
          ? esc(err.message || "You've used your AI answers for today — they reset tomorrow.") +
            (window.SkillzifyAI && window.SkillzifyAI.capLink ? window.SkillzifyAI.capLink() : "")
          : "Couldn't pick a personal challenge — showing today's standard challenge.";
        var n = document.getElementById("dash-daily-fail");
        if (n) {
          var m = document.getElementById("dash-daily-fail-msg");
          if (m) m.innerHTML = msg;
          var rb0 = document.getElementById("dash-daily-retry");
          if (rb0) rb0.disabled = false;
          return;
        }
        dd.innerHTML += '<p id="dash-daily-fail" class="hint"><span id="dash-daily-fail-msg">' + msg + '</span> ' +
          '<button type="button" class="btn btn-sm btn-ghost" id="dash-daily-retry">↻ Retry</button></p>';
        var rb = document.getElementById("dash-daily-retry");
        if (rb) rb.addEventListener("click", function () {
          rb.disabled = true;
          clearChallengeFailed();
          fetchAIChallenge(true);
        });
      };
      // Signed-out users can still ask for a personal challenge, but only
      // by tapping — never silently on load (see the M2 gate below).
      var renderPersonalBtn = function () {
        if (document.getElementById("dash-daily-personal")) return;
        dd.innerHTML += '<p id="dash-daily-personal"><button type="button" class="btn btn-sm btn-ghost" id="dash-daily-personal-btn">🤖 Get a personal challenge</button></p>';
        var pb = document.getElementById("dash-daily-personal-btn");
        if (pb) pb.addEventListener("click", function () {
          var wrap = document.getElementById("dash-daily-personal");
          if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
          fetchAIChallenge(true);
        });
      };
      var fetchAIChallenge = function (bypassCooldown) {
        if (challengeInFlight) return;
        if (!window.SkillzifyAI || (!bypassCooldown && challengeFailedRecently())) return;
        challengeInFlight = true;
        try {
          window.SkillzifyAI.ask({
            mode: "challenge",
            json: true,
            code: weakSpotsSummary(EX, atts),
            context: window.SkillzifyAI.buildContext({ note: "Daily challenge." })
          }, function (err, res) {
            challengeInFlight = false;
            try {
              if (err || !res || !validChallenge(res.data)) { markChallengeFailed(); renderFailNote(err); return; }
              clearChallengeFailed();
              try { localStorage.setItem("skillzify_daily_challenge", JSON.stringify({ date: today, challenge: res.data })); } catch (e2) {}
              renderAIDaily(res.data);
            } catch (e3) {
              // Render-time error: log it and fall back to the standard
              // challenge, like the AI-failure path above.
              if (window.console && console.error) console.error("[daily-challenge] render failed", e3);
              markChallengeFailed(); renderFailNote();
            }          });
        } catch (e4) {
          // Synchronous throw: clear the flag so Retry can run again.
          challengeInFlight = false;
          markChallengeFailed();
          renderFailNote();
        }
      };
      var today = localToday(), storedDaily = null;
      try { storedDaily = JSON.parse(localStorage.getItem("skillzify_daily_challenge") || "null"); } catch (e) { storedDaily = null; }
      if (storedDaily && storedDaily.date === today && validChallenge(storedDaily.challenge)) {
        renderStaticDaily();
        renderAIDaily(storedDaily.challenge);
      } else {
        renderStaticDaily();
        if (challengeFailedRecently()) renderFailNote();
        // M2: never auto-fetch a personal challenge for a signed-out
        // user — the anonymous 10/day cap would silently burn one
        // answer. Firebase restores the session async, so a
        // currentUser() check here at load time would misclassify
        // signed-in users as anonymous; wait for auth.js to resolve
        // state via onReady, then fetch only when signed in.
        // Signed-out users get a tap-to-fetch button instead.
        var auth = window.SkillzifyAuth;
        if (auth && typeof auth.onReady === "function" && typeof auth.currentUser === "function") {
          auth.onReady(function () {
            var signedIn = false;
            try { signedIn = !!auth.currentUser(); } catch (e) { signedIn = false; }
            if (signedIn) fetchAIChallenge(false);
            else renderPersonalBtn();
          });
          // M3: on auth change (e.g. sign-in/out in another tab),
          // re-render ONLY the auth-dependent copy — the fail note's
          // sign-in link (via capLink: shown only when signed out)
          // and the tap-to-fetch button for a newly signed-out user.
          // Never re-fetches AI content here.
          if (typeof auth.onAuthChange === "function") {
            auth.onAuthChange(function () {
              var signedInNow = false;
              try { signedInNow = !!auth.currentUser(); } catch (e) { signedInNow = false; }
              if (document.getElementById("dash-daily-fail")) renderFailNote(lastFailErr);
              if (!signedInNow && !document.getElementById("dash-daily-ai") && !document.getElementById("dash-daily-personal")) renderPersonalBtn();
            });
          }
        } else {
          // No auth module / no resolved-state hook: no silent fetch.
          renderPersonalBtn();
        }
      }
    }

    // Revision queue
    var rv = document.getElementById("dash-revision");
    if (rv) {
      var q = EX.filter(function (ex) { var a = atts[ex.id]; return a && a.attempts > 0 && !a.solved; })
        .sort(function (x, y) { return (atts[x.id].lastTry || 0) - (atts[y.id].lastTry || 0); }).slice(0, 4);
      rv.innerHTML = q.length ? q.map(function (ex) {
        return '<div class="run-item"><span>↻ ' + esc(ex.title) + '</span><a class="btn btn-sm btn-ghost" href="practice.html#ex=' + ex.id + '">Retry</a></div>';
      }).join("") : '<p class="hint">Nothing to review — clean slate! <a href="practice.html">Practice →</a></p>';
      // Spaced-repetition nudge: due lesson reviews sit above the exercise retries.
      try {
        if (window.SkillzifyReview && typeof window.SkillzifyReview.dueCount === "function") {
          var dueN = window.SkillzifyReview.dueCount();
          if (dueN > 0) rv.innerHTML = '<div class="run-item"><span>🧠 ' + dueN + ' lesson' + (dueN === 1 ? '' : 's') + ' due for review</span><a class="btn btn-sm" href="learn.html#review">Review now →</a></div>' + rv.innerHTML;
        }
      } catch (e) {}
      // Phase 4: rusty nudge — same signal as the Learn review queue.
      try {
        var MM2 = window.SkillzifyMastery, LC2 = window.SkillzifyLearnCore;
        if (MM2 && LC2 && window.SkillzifyReview && typeof window.SkillzifyReview.dueList === "function") {
          var secs2 = {};
          MM2.sectionMastery().forEach(function (sec) { secs2[sec.section] = sec; });
          var seen2 = {}, names2 = [];
          window.SkillzifyReview.dueList().forEach(function (id) {
            var ll = LC2.lessonById(id);
            if (ll && secs2[ll.section] && secs2[ll.section].rusty && !seen2[ll.section]) { seen2[ll.section] = 1; names2.push(secs2[ll.section].name); }
          });
          if (names2.length) {
            rv.innerHTML = '<p class="hint" style="margin:0 0 4px">\u{1F342} ' + names2.slice(0, 2).join(" \u00B7 ") +
              (names2.length > 2 ? " (+" + (names2.length - 2) + " more)" : "") +
              (names2.length === 1 ? " is" : " are") + ' rusty — 21+ days since your last review there.</p>' + rv.innerHTML;
          }
        }
      } catch (e) {}
    }

    // Weak spots — weakest first. Compact by design: only the TOP 3
    // weakest tried topics render as full rows (matching the practice
    // page's "Drill my weak spots" cap); the rest hide behind a toggle,
    // and untried topics render as chips in one wrapped line.
    var ta = document.getElementById("dash-topic-acc");
    if (ta) {
      var rows = topicRows(EX, atts);
      var tried = rows.filter(function (r) { return r.tried > 0; })
                      .sort(function (a, b) { return a.pct - b.pct || b.tried - a.tried; });
      var untried = rows.filter(function (r) { return r.tried === 0; });
      // Phase 4: mastery score + band + rusty badge per topic, from the
      // mastery engine when loaded (falls back to solve-rate-only rows).
      var masteryByTopic = {};
      try {
        var MM = window.SkillzifyMastery;
        if (MM && typeof MM.topicMastery === "function") {
          MM.topicMastery().forEach(function (mr) { masteryByTopic[mr.topic] = mr; });
        }
      } catch (e) {}
      var weakRowHtml = function (r) {
        var weak = r.tried >= 2 && r.pct < 60;
        var m = masteryByTopic[r.topic];
        return '<div class="weak-row' + (weak ? " is-weak" : "") + '">' +
          '<div class="weak-top"><span class="lbl">' + esc(r.label) +
          (weak ? ' <span class="badge badge-try">weak spot</span>' : "") + "</span>" +
          '<span class="pct">' + r.solved + "/" + r.tried + " · " + r.pct + "%</span></div>" +
          (m && m.score != null ? '<div class="hint" style="margin:0 0 6px">Mastery ' + m.score + "% · " + esc(m.band) + (m.rusty ? " \u{1F342} rusty" : "") + "</div>" : "") +
          '<div class="bar"><span style="width:' + r.pct + '%"></span></div>' +
          '<a class="weak-link" href="practice.html#topic=' + r.topic + '">Practice ' + esc(r.label) + " →</a>" +
          "</div>";
      };
      var html = "";
      if (!tried.length) {
        html = '<p class="hint">No attempts yet — solve a few exercises and your weak spots will surface here, weakest first.</p>' +
               '<p><a class="btn btn-sm" href="practice.html">Start practicing →</a></p>';
      } else {
        var weakest = tried[0];
        html += '<p class="weak-summary">🎯 Focus next: <strong>' + esc(weakest.label) + "</strong> (" + weakest.pct + "% of " + weakest.tried + " tried)" +
          (tried.length > 1 ? ' · 💪 Strongest: <strong>' + esc(tried[tried.length - 1].label) + "</strong> (" + tried[tried.length - 1].pct + "%)" : "") + "</p>";
        var top3 = tried.slice(0, 3), rest = tried.slice(3);
        html += '<div id="dash-weak-top">' + top3.map(weakRowHtml).join("") + "</div>";
        if (rest.length) {
          html += '<div id="dash-weak-rest" hidden>' + rest.map(weakRowHtml).join("") + "</div>" +
            '<p style="margin:10px 0 0"><button type="button" class="btn btn-sm btn-ghost" id="dash-weak-toggle">Show all ' + tried.length + ' topics ↓</button></p>';
        }
      }
      if (untried.length) {
        var chips = untried.slice(0, 8).map(function (r) { return '<span class="weak-chip">' + esc(r.label) + "</span>"; }).join(" ");
        html += '<p class="hint" style="margin-top:10px">Not tried yet: ' + chips +
          (untried.length > 8 ? ' <span class="hint">+' + (untried.length - 8) + " more</span>" : "") + "</p>";
      }
      ta.innerHTML = html;
      var tg = document.getElementById("dash-weak-toggle");
      if (tg) tg.addEventListener("click", function () {
        var restEl = document.getElementById("dash-weak-rest");
        if (!restEl) return;
        var isHidden = restEl.hidden !== false; // attribute present initially
        restEl.hidden = !isHidden;
        tg.textContent = isHidden ? "Show less ↑" : "Show all " + tried.length + " topics ↓";
      });
    }

    // (Certificates + downloadCert moved to profile.js — showcase lives on the profile)
  }

  /* Daily plan (Mastery Engine Phase 3): "Today's plan — ~15 min".
     The day's items are generated once (from SkillzifyMastery.dailyPlan)
     and stored for the day, so the checklist is stable: completing an
     item checks it off instead of swapping in the next one. The plan
     regenerates tomorrow. Completion is auto-detected from real data
     (review no longer due / exercise solved / lesson done) and can also
     be toggled by hand. Local-only, not synced — losing it on another
     device just regenerates the plan, harmless.
     +10 XP on completion (Vikas's call, 9 Nov): awarded once per day
     when the last item completes, guarded by the xpAwarded flag on the
     plan itself — re-renders and syncs can never re-award it. */
  var PLAN_KEY = "skillzify_daily_plan";
  function readPlanFlag() {
    try {
      var f = window.Skillzify.storeGet(PLAN_KEY, null);
      if (f && typeof f === "object" && f.date === localToday() &&
          Array.isArray(f.items) && Array.isArray(f.done)) return f;
    } catch (e) {}
    return null;
  }
  function savePlanFlag(f) {
    try { window.Skillzify.storeSet(PLAN_KEY, f); } catch (e) {}
  }
  // P2-17: the last real sync completion, from the skillzify-sync
  // event detail (sync.js always dispatches with {at}). Only
  // detail-bearing events count — a bare event is not a sync.
  var LAST_SYNC_KEY = "skillzify_last_sync_at";
  function lastSyncAt() {
    try {
      var v = parseInt(window.Skillzify.storeGet(LAST_SYNC_KEY, 0) || "0", 10);
      return isFinite(v) ? v : 0;
    } catch (e) { return 0; }
  }
  function noteSyncAt(at) {
    try { window.Skillzify.storeSet(LAST_SYNC_KEY, at || Date.now()); } catch (e) {}
  }
  // Due review ids right now (SkillzifyReview when loaded, else the
  // raw review store). Used to tell a genuinely new due review from
  // the ones the stored plan was built from.
  function currentDueIds() {
    try {
      if (window.SkillzifyReview && typeof window.SkillzifyReview.dueList === "function") {
        return window.SkillzifyReview.dueList().slice();
      }
    } catch (e) {}
    try {
      var rm = window.Skillzify.storeGet("skillzify_review", {}) || {};
      var t = Date.now();
      return Object.keys(rm).filter(function (id) { return rm[id] && typeof rm[id].due === "number" && rm[id].due <= t; });
    } catch (e2) { return []; }
  }
  function getDailyPlan() {
    var M = window.SkillzifyMastery;
    if (!M || typeof M.dailyPlan !== "function") return null;
    var stored = readPlanFlag();
    if (stored) {
      // P2-17: a plan snapshotted before a sync (or before a review's
      // due time arrived) can miss due reviews for the whole day.
      // Regenerate when a due review exists that the plan was not
      // built from — the generation-time snapshot (dueIds) is the
      // comparison, so an ordinary re-render or a sync that changed
      // nothing keeps the plan stable for the day (the existing
      // same-day-stability behaviour). The stored createdAt + last
      // sync time are recorded alongside for the same reason: a sync
      // that changed the due set after the plan was built is the
      // P2-17 case, and the dueIds comparison is what proves it.
      var snap = stored.dueIds || stored.items.filter(function (it) { return it.kind === "review"; }).map(function (it) { return it.id; });
      var snapSet = {};
      snap.forEach(function (id) { snapSet[id] = true; });
      var nowDue = currentDueIds();
      var hasNewDue = nowDue.some(function (id) { return !snapSet[id]; });
      var syncChangedDues = false;
      var ls = lastSyncAt();
      if (ls && stored.createdAt && stored.createdAt < ls) {
        var nowSet = {};
        nowDue.forEach(function (id) { nowSet[id] = true; });
        syncChangedDues = hasNewDue || snap.some(function (id) { return !nowSet[id]; });
      }
      if (!hasNewDue && !syncChangedDues) return stored;
    }
    var dp = M.dailyPlan() || {};
    var items = [];
    (dp.reviews || []).forEach(function (id) {
      items.push({ key: "review:" + id, kind: "review", id: id });
    });
    if (dp.exercise) items.push({ key: "exercise:" + dp.exercise, kind: "exercise", id: dp.exercise });
    if (dp.lesson) items.push({ key: "lesson:" + dp.lesson, kind: "lesson", id: dp.lesson });
    var flag = { date: localToday(), items: items, done: [], createdAt: Date.now(), dueIds: currentDueIds() };
    savePlanFlag(flag);
    return flag;
  }
  function isPlanItemDone(item) {
    try {
      if (item.kind === "review") {
        if (window.SkillzifyReview && typeof window.SkillzifyReview.dueList === "function") {
          return window.SkillzifyReview.dueList().indexOf(item.id) < 0;
        }
        var rm = window.Skillzify.storeGet("skillzify_review", {});
        var e = rm ? rm[item.id] : null;
        if (!e) return true;
        return typeof e.due === "number" ? e.due > Date.now() : false;
      }
      if (item.kind === "exercise") {
        var atts = window.Skillzify.storeGet("skillzify_exercise_attempts", {});
        var a = atts ? atts[item.id] : null;
        return !!(a && a.solved);
      }
      if (item.kind === "lesson") {
        var L = window.SkillzifyLearn;
        return !!(L && L.getProgress && L.getProgress()[item.id]);
      }
    } catch (e) {}
    return false;
  }
  function planItemMeta(item, lessonById, exById) {
    if (item.kind === "review") {
      var l = lessonById[item.id];
      return { icon: "\u{1F9E0}", label: "Review: " + (l ? l.title : item.id), href: "learn.html#review" };
    }
    if (item.kind === "exercise") {
      var ex = exById[item.id];
      return { icon: "\u{1F3CB}️", label: "Practice: " + (ex ? ex.title : item.id), href: "practice.html#ex=" + item.id };
    }
    var ll = lessonById[item.id];
    return { icon: "\u{1F4D6}", label: "Learn: " + (ll ? ll.title : item.id), href: "lesson.html?id=" + item.id };
  }
  function renderDailyPlan() {
    var mount = document.getElementById("dash-plan");
    var card = document.getElementById("dash-plan-card");
    var sub = document.getElementById("dash-plan-sub");
    if (!mount || !card) return;
    var plan = getDailyPlan();
    if (!plan) { card.style.display = "none"; return; }
    card.style.display = "";
    var esc = (window.Skillzify && window.Skillzify.esc) || function (x) { return String(x); };
    var L = window.SkillzifyLearn;
    var lessonById = {}, exById = {};
    if (L && Array.isArray(L.LESSONS)) L.LESSONS.forEach(function (l) { lessonById[l.id] = l; });
    var EX = window.SkillzifyPracticeData || [];
    EX.forEach(function (e) { exById[e.id] = e; });
    var doneSet = {};
    (plan.done || []).forEach(function (k) { doneSet[k] = true; });
    plan.items.forEach(function (it) { if (isPlanItemDone(it)) doneSet[it.key] = true; });
    var doneN = plan.items.filter(function (it) { return doneSet[it.key]; }).length;
    // P1-05: the +10 XP pays only when every item is AUTO-detected
    // done (real review / solve / lesson). Hand-ticked checkboxes
    // still check the box visually, but they never pay the XP and
    // never count toward the Plan Keeper badge (skillzify_plans_done).
    var autoDoneN = plan.items.filter(function (it) { return isPlanItemDone(it); }).length;
    // +10 XP, once per day, the moment the plan completes. The flag is
    // set right after a successful award, in the same synchronous block,
    // so no re-render or sync can award it twice.
    if (plan.items.length > 0 && autoDoneN === plan.items.length && !plan.xpAwarded) {
      // P2-19: two tabs finishing the plan at once must not both pay
      // the +10. Claim the day's award in localStorage first (token
      // re-read: only the tab whose token survives pays); a lost race
      // marks the plan awarded locally too, so this tab never retries.
      var claimKey = "skillzify_daily_plan_xp_" + localToday();
      var claimWon = false, claimToken = "";
      try {
        if (!localStorage.getItem(claimKey)) {
          claimToken = String(Date.now()) + "-" + Math.random().toString(36).slice(2);
          localStorage.setItem(claimKey, claimToken);
          claimWon = localStorage.getItem(claimKey) === claimToken;
        }
      } catch (e) { claimWon = true; }
      if (!claimWon) {
        plan.xpAwarded = true;
        savePlanFlag(plan);
      }
      try {
        var LC = window.SkillzifyLearnCore;
        if (claimWon && LC && typeof LC.addXP === "function") {
          LC.addXP(10);
          plan.xpAwarded = true;
          savePlanFlag(plan);
          // Plans-done counter (feeds the Plan Keeper badge). The flag
          // above guards it, so a finished plan counts exactly once.
          try {
            var pd = parseInt(localStorage.getItem("skillzify_plans_done") || "0", 10) || 0;
            localStorage.setItem("skillzify_plans_done", String(pd + 1));
          } catch (e3) {}
          // Counters sync: push the new plans-done count to Firestore
          // (sync.js `counters` field, MAX merge).
          try { if (window.SkillzifySync && typeof window.SkillzifySync.markDirty === "function") window.SkillzifySync.markDirty("counters"); } catch (e4) {}
          try { window.Skillzify.toast("+10 XP — daily plan complete! \u{1F389}", "success"); } catch (e2) {}
        }
      } catch (e) {}
    }
    if (sub) sub.textContent = plan.items.length === 0 ? "All caught up." :
      (doneN === plan.items.length ? "\u2713 All done — nice work!" + (plan.xpAwarded ? " +10 XP \u{1F389}" : "") : doneN + " of " + plan.items.length + " done \u00B7 about 15 minutes");
    if (plan.items.length === 0) {
      mount.innerHTML = '<p class="hint">Everything is solid for today \u{1F389} — no reviews due, nothing weak, nothing new. ' +
        'Take on the AI challenge below or build something in <a href="compiler.html">Code Studio</a>.</p>';
      return;
    }
    var html = "";
    plan.items.forEach(function (it) {
      var meta = planItemMeta(it, lessonById, exById);
      var done = !!doneSet[it.key];
      // P2-18: an auto-detected-done item has NO working toggle — its
      // checkbox is disabled, so un-checking a genuinely-done item
      // can no longer silently re-check on the next render. Only
      // hand-toggled items (not auto-done) stay toggleable.
      var auto = isPlanItemDone(it);
      var label = esc(meta.icon + " " + meta.label);
      html += '<div class="run-item"><span><input type="checkbox" data-plan-key="' + esc(it.key) + '"' +
        (done ? " checked" : "") + (auto ? " disabled" : "") + ' aria-label="Mark done: ' + label + '"> ' +
        (done ? "<s>" : "") + '<a href="' + esc(meta.href) + '">' + label + "</a>" + (done ? "</s>" : "") + "</span></div>";
    });
    mount.innerHTML = html;
    mount.querySelectorAll("#dash-plan input").forEach(function (cb) {
      cb.addEventListener("click", function () {
        var key = cb.getAttribute("data-plan-key");
        var f = readPlanFlag();
        if (!f) return;
        // P2-18: never hand-toggle an auto-detected-done item, even
        // if a stale enabled checkbox is clicked.
        var it0 = null;
        f.items.forEach(function (x) { if (x.key === key) it0 = x; });
        if (it0 && isPlanItemDone(it0)) { renderDailyPlan(); return; }
        var i = f.done.indexOf(key);
        if (i >= 0) f.done.splice(i, 1); else f.done.push(key);
        savePlanFlag(f);
        renderDailyPlan();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", renderDashboard);
  // Keep Next Up fresh after a cross-device sync (cheap, targeted —
  // the full dashboard render would reset the weak-spots toggle).
  window.addEventListener("skillzify-sync", function (ev) {
    // P2-17: note real sync completions (detail.at) so getDailyPlan
    // can tell a plan built before the sync from one built after it.
    try { if (ev && ev.detail && ev.detail.at) noteSyncAt(ev.detail.at); } catch (e) {}
    try { renderNextUp(); renderDailyPlan(); } catch (e) {}
  });
})();
