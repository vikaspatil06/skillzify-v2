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
  }

  document.addEventListener("DOMContentLoaded", renderDashboard);
})();
