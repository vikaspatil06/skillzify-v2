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

    // Topic accuracy
    var ta = document.getElementById("dash-topic-acc");
    if (ta) {
      var topics = {}, order = [];
      EX.forEach(function (ex) {
        if (!topics[ex.topic]) { topics[ex.topic] = { solved: 0, total: 0 }; order.push(ex.topic); }
        topics[ex.topic].total++;
        var a = atts[ex.id];
        if (a && a.solved) topics[ex.topic].solved++;
      });
      var labels = { variables: "Variables", strings: "Strings", collections: "Collections", loops: "Loops", functions: "Functions", oop: "OOP", exceptions: "Exceptions", dsa: "Algorithms" };
      ta.innerHTML = order.map(function (t) {
        var s = topics[t], pct = s.total ? Math.round(s.solved / s.total * 100) : 0;
        var weak = s.total >= 2 && pct < 50;
        return '<div class="progress-row"><span class="lbl">' + esc(labels[t] || t) +
          (weak ? ' <span class="badge badge-try">weak spot</span>' : "") + "</span>" +
          '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
          '<span class="pct">' + s.solved + "/" + s.total + "</span></div>";
      }).join("");
    }

    // Certificates
    var cx = document.getElementById("dash-certs");
    if (cx) {
      var L = window.SkillzifyLearn;
      var prog = {};
      try { prog = JSON.parse(localStorage.getItem("skillzify_progress") || "{}"); } catch (e) {}
      var html = "";
      (L ? L.TRACKS : []).forEach(function (t) {
        var lessons = L.LESSONS.filter(function (l) { return l.track === t.id; });
        var done = lessons.filter(function (l) { return prog[l.id]; }).length;
        if (lessons.length && done === lessons.length) {
          html += '<div class="run-item"><span>🎓 ' + esc(t.name) + ' track complete</span>' +
            '<button class="btn btn-sm" data-cert="' + t.id + '">Download certificate</button></div>';
        }
      });
      cx.innerHTML = html || '<p class="hint">Finish every lesson in a track to unlock its certificate.</p>';
      cx.querySelectorAll("[data-cert]").forEach(function (b) {
        b.addEventListener("click", function () { downloadCert(b.getAttribute("data-cert")); });
      });
    }
  }

  function downloadCert(trackId) {
    var L = window.SkillzifyLearn;
    var t = (L.TRACKS.filter(function (x) { return x.id === trackId; })[0]) || { name: trackId };
    var user = (window.SkillzifyAuth && window.SkillzifyAuth.currentUser()) || null;
    var prof = (window.SkillzifyActivity && window.SkillzifyActivity.profile()) || {};
    var name = prof.name || (user && user.name) || "Skillzify Learner";
    var c = document.createElement("canvas");
    c.width = 1200; c.height = 850;
    var g = c.getContext("2d");
    var grad = g.createLinearGradient(0, 0, 1200, 850);
    grad.addColorStop(0, "#0f2027"); grad.addColorStop(0.5, "#203a43"); grad.addColorStop(1, "#2c5364");
    g.fillStyle = grad; g.fillRect(0, 0, 1200, 850);
    g.strokeStyle = "#c9a227"; g.lineWidth = 8; g.strokeRect(30, 30, 1140, 790);
    g.strokeStyle = "rgba(201,162,39,.4)"; g.lineWidth = 2; g.strokeRect(50, 50, 1100, 750);
    g.fillStyle = "#fff"; g.textAlign = "center";
    g.font = "600 44px Georgia, serif";
    g.fillText("Certificate of Completion", 600, 170);
    g.strokeStyle = "#c9a227"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(400, 200); g.lineTo(800, 200); g.stroke();
    g.font = "400 30px Georgia, serif"; g.fillStyle = "#cbd5e1";
    g.fillText("This certifies that", 600, 270);
    g.font = "800 64px Georgia, serif"; g.fillStyle = "#ffe9a8";
    g.fillText(name, 600, 360);
    g.font = "400 30px Georgia, serif"; g.fillStyle = "#cbd5e1";
    g.fillText("has successfully completed the", 600, 430);
    g.font = "700 46px Georgia, serif"; g.fillStyle = "#fff";
    g.fillText(t.name + " Track", 600, 510);
    g.font = "400 26px Georgia, serif"; g.fillStyle = "#94a3b8";
    var d = new Date();
    g.fillText("Skillzify · Learn. Build. Shine. — " + d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), 600, 600);
    g.font = "700 40px Georgia, serif"; g.fillStyle = "#c9a227";
    g.fillText("🐍", 600, 700);
    var a = document.createElement("a");
    a.download = "skillzify-" + trackId + "-certificate.png";
    a.href = c.toDataURL("image/png");
    document.body.appendChild(a); a.click(); a.remove();
    if (window.Skillzify) window.Skillzify.toast("Certificate downloaded! 🎓", "success");
  }

  document.addEventListener("DOMContentLoaded", renderDashboard);
})();
