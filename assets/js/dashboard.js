/* ============================================================
   Skillzify v2 — dashboard.js
   Reads localStorage progress + run history and renders the
   learning dashboard: overall %, per-track bars, streak, runs.
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

    // Per-track
    var tracksHtml = "";
    L.TRACKS.forEach(function (t) {
      var pct = L.trackPct(t.id);
      var td = L.LESSONS.filter(function (l) { return l.track === t.id && progress[l.id]; }).length;
      var tc = L.LESSONS.filter(function (l) { return l.track === t.id; }).length;
      tracksHtml += '<div class="progress-row"><span class="lbl">' + t.icon + " " + t.name + "</span>" +
        '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
        '<span class="pct">' + td + "/" + tc + "</span></div>";
    });
    document.getElementById("dash-tracks").innerHTML = tracksHtml;

    // Streak
    var s = window.Skillzify.storeGet("skillzify_streak", { last: null, count: 0 });
    document.getElementById("dash-streak").textContent = (s.count || 0) + " 🔥";

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

    // Greeting
    var user = window.SkillzifyAuth ? window.SkillzifyAuth.currentUser() : null;
    document.getElementById("dash-hello").textContent =
      user ? "Welcome back, " + user.name.split(" ")[0] + "! Keep the streak alive 🔥" :
             "Your learning at a glance — log in to sync your name here.";

    renderUpgrades();
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
    var labels = { variables: "Variables", strings: "Strings", collections: "Collections", loops: "Loops", functions: "Functions", oop: "OOP", exceptions: "Exceptions", dsa: "Algorithms" };
    return order.map(function (t) {
      var s = topics[t];
      return { topic: t, label: labels[t] || t, solved: s.solved, tried: s.tried,
               pct: s.tried ? Math.round(s.solved / s.tried * 100) : null };
    });
  }

  // Plain-text weak-spot summary for the AI daily challenge prompt:
  // weakest topic first, unsolved exercises, untried topics.
  function weakSpotsSummary(EX, atts) {
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
        dd.innerHTML = '<p><strong>' + esc(dex.title) + '</strong></p>' +
          '<p class="hint">' + esc(dex.prompt).slice(0, 90) + '…</p>' +
          '<p><a class="btn btn-sm" href="practice.html#ex=' + dex.id + '">' +
          (da.solved ? "Play again →" : "Take the challenge →") + "</a></p>";
      };
      // The AI card is a SECOND card below the static one — it never
      // replaces the static card, so its link target can't change
      // under the user while they read.
      var renderAIDaily = function (ch) {
        clearFailNote();
        if (document.getElementById("dash-daily-ai")) return;
        dd.innerHTML += '<div id="dash-daily-ai"><p><strong>' + esc(ch.title) + '</strong> <span class="badge badge-unlock">🤖 Picked for you</span></p>' +
          '<p class="hint">' + esc(ch.prompt).slice(0, 90) + '…</p>' +
          '<p><a class="btn btn-sm" href="practice.html#challenge">Take the challenge →</a></p></div>';
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
    }

    // Weak spots — weakest first, untried topics separated, each one tap from practice
    var ta = document.getElementById("dash-topic-acc");
    if (ta) {
      var rows = topicRows(EX, atts);
      var tried = rows.filter(function (r) { return r.tried > 0; })
                      .sort(function (a, b) { return a.pct - b.pct || b.tried - a.tried; });
      var untried = rows.filter(function (r) { return r.tried === 0; });
      var html = "";
      if (!tried.length) {
        html = '<p class="hint">No attempts yet — solve a few exercises and your weak spots will surface here, weakest first.</p>' +
               '<p><a class="btn btn-sm" href="practice.html">Start practicing →</a></p>';
      } else {
        var weakest = tried[0];
        html += '<p class="weak-summary">🎯 Focus next: <strong>' + esc(weakest.label) + "</strong> (" + weakest.pct + "% of " + weakest.tried + " tried)" +
          (tried.length > 1 ? ' · 💪 Strongest: <strong>' + esc(tried[tried.length - 1].label) + "</strong> (" + tried[tried.length - 1].pct + "%)" : "") + "</p>";
        html += tried.map(function (r) {
          var weak = r.tried >= 2 && r.pct < 60;
          return '<div class="weak-row' + (weak ? " is-weak" : "") + '">' +
            '<div class="weak-top"><span class="lbl">' + esc(r.label) +
            (weak ? ' <span class="badge badge-try">weak spot</span>' : "") + "</span>" +
            '<span class="pct">' + r.solved + "/" + r.tried + " · " + r.pct + "%</span></div>" +
            '<div class="bar"><span style="width:' + r.pct + '%"></span></div>' +
            '<a class="weak-link" href="practice.html#topic=' + r.topic + '">Practice ' + esc(r.label) + " →</a>" +
            "</div>";
        }).join("");
      }
      if (untried.length) {
        html += '<p class="hint" style="margin-top:10px">Not tried yet: ' +
          untried.map(function (r) { return esc(r.label); }).join(", ") + "</p>";
      }
      ta.innerHTML = html;
    }

    // (Certificates + downloadCert moved to profile.js — showcase lives on the profile)
  }

  document.addEventListener("DOMContentLoaded", renderDashboard);
})();
