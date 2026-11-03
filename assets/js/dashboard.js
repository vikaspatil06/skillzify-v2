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

    // Mini heatmap (this week's activity — full year lives on the profile)
    var hm = document.getElementById("dash-heatmap");
    if (hm) A.renderHeatmap(hm);

    // Achievements preview (compact — full grid lives on the profile)
    var ach = A.achievements().filter(function (a) { return a.unlocked; }).slice(0, 3);
    document.getElementById("dash-achievements").innerHTML = ach.length ? ach.map(function (a) {
      return '<div class="ach on" title="' + a.desc + '"><span class="ach-ico">' + a.icon + '</span><span class="ach-name">' + a.name + "</span></div>";
    }).join("") + '<p style="grid-column:1/-1"><a href="profile.html">All achievements →</a></p>'
      : '<p class="muted" style="grid-column:1/-1">Complete a lesson to earn your first badge. <a href="learn.html">Start →</a></p>';

    renderPracticeWidgets();
  }

  /* ---------- Practice analytics, daily, revision, certificates ---------- */
  function renderPracticeWidgets() {
    var EX = window.SkillzifyPracticeData || [];
    if (!EX.length) return;
    var esc = window.Skillzify.esc;
    var atts = {};
    try { atts = JSON.parse(localStorage.getItem("skillzify_exercise_attempts") || "{}"); } catch (e) {}

    // Daily challenge
    var dd = document.getElementById("dash-daily");
    if (dd) {
      var day = Math.floor(Date.now() / 864e5);
      var dex = EX[day % EX.length];
      var da = atts[dex.id] || {};
      dd.innerHTML = '<p><strong>' + esc(dex.title) + '</strong></p>' +
        '<p class="hint">' + esc(dex.prompt).slice(0, 90) + '…</p>' +
        '<p><a class="btn btn-sm" href="practice.html#ex=' + dex.id + '">' +
        (da.solved ? "Play again →" : "Take the challenge →") + "</a></p>";
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
      var rows = order.map(function (t) {
        var s = topics[t];
        return { topic: t, label: labels[t] || t, solved: s.solved, tried: s.tried,
                 pct: s.tried ? Math.round(s.solved / s.tried * 100) : null };
      });
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
