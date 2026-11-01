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
    document.getElementById("dash-streak").textContent = (s.count || 0) + "🔥";

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

    // Mastery bar (per-track completed lessons, GitHub language-bar style)
    try {
      var L = window.SkillzifyLearn;
      var prog = JSON.parse(localStorage.getItem("skillzify_progress") || "{}");
      var tracks = [["beginner", "Beginner", "#6c7bff"], ["intermediate", "Intermediate", "#22d3ee"], ["advanced", "Advanced", "#f0a35e"]];
      var counts = tracks.map(function (t) {
        var lessons = L ? L.LESSONS.filter(function (l) { return l.track === t[0]; }) : [];
        var done = lessons.filter(function (l) { return prog[l.id]; }).length;
        return { name: t[1], color: t[2], done: done, total: lessons.length };
      });
      var tot = counts.reduce(function (s, c) { return s + c.done; }, 0) || 1;
      document.getElementById("dash-mastery-bar").innerHTML = counts.map(function (c) {
        return '<span style="width:' + (c.done / tot * 100) + '%;background:' + c.color + '" title="' + c.name + ": " + c.done + '"></span>';
      }).join("");
      document.getElementById("dash-mastery-legend").innerHTML = counts.map(function (c) {
        return '<span><i style="background:' + c.color + '"></i>' + c.name + " — " + c.done + "/" + c.total + "</span>";
      }).join("");
    } catch (e) {}

    // Mini heatmap
    var hm = document.getElementById("dash-heatmap");
    if (hm) A.renderHeatmap(hm);

    // Achievements preview
    var ach = A.achievements().filter(function (a) { return a.unlocked; }).slice(0, 6);
    document.getElementById("dash-achievements").innerHTML = ach.length ? ach.map(function (a) {
      return '<div class="ach on" title="' + a.desc + '"><span class="ach-ico">' + a.icon + '</span><span class="ach-name">' + a.name + "</span></div>";
    }).join("") + '<p style="grid-column:1/-1"><a href="profile.html">All achievements →</a></p>'
      : '<p class="muted">Complete a lesson to earn your first badge. <a href="learn.html">Start →</a></p>';

    // Feed
    var feed = A.feed(6), icons = { lesson: "📚", run: "▶️", snippet: "📝", achievement: "🏆", star: "⭐" };
    document.getElementById("dash-feed").innerHTML = feed.length ? feed.map(function (e) {
      return '<div class="feed-item"><span>' + (icons[e.type] || "•") + "</span><span>" + window.Skillzify.esc(e.text) + "</span></div>";
    }).join("") : '<p class="muted">No activity yet.</p>';
  }

  document.addEventListener("DOMContentLoaded", renderDashboard);
})();
