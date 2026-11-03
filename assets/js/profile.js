/* Skillzify Profile page */
(function () {
  "use strict";
  var A = window.SkillzifyActivity;
  var S = window.Skillzify;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  function render() {
    var prof = A.profile();
    var user = null;
    try { user = (window.SkillzifyAuth && window.SkillzifyAuth.currentUser()) || null; } catch (e) {}
    var name = prof.name || (user && user.name) || "Vikas";
    var seed = (user && user.email) || name;

    document.getElementById("profile-avatar").innerHTML = A.identicon(seed, 96);
    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-bio").textContent = prof.bio || "Add a bio so future-you remembers why you started.";
    var xp = 0, done = 0, exSolved = 0, exTotal = 0;
    try { xp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0; } catch (e) {}
    try { done = Object.keys(JSON.parse(localStorage.getItem("skillzify_progress") || "{}")).length; } catch (e) {}
    var totalLessons = (window.SkillzifyLearn && window.SkillzifyLearn.totalLessons) || 95;
    try {
      var EXD = window.SkillzifyPracticeData || [];
      exTotal = EXD.length;
      var atts = JSON.parse(localStorage.getItem("skillzify_exercise_attempts") || "{}");
      EXD.forEach(function (ex) { if (atts[ex.id] && atts[ex.id].solved) exSolved++; });
    } catch (e) {}
    var st = A.streak(), runs = A.runCount();
    var since = "recently";
    if (user && user.created) since = new Date(user.created).toLocaleDateString(undefined, { month: "short", year: "numeric" });
    document.getElementById("profile-meta").textContent = "🗓️ Learning since " + since + " · " + done + "/" + totalLessons + " lessons";

    // Level pill
    try {
      var L = window.SkillzifyLearn;
      if (L) {
        var lvl = L.levelFor(xp);
        document.getElementById("profile-level").textContent = "⚡ " + lvl.name + " · " + xp.toLocaleString() + " XP";
      }
    } catch (e) {}

    renderCerts();
    renderMastery();

    var stats = [
      ["⚡", xp.toLocaleString(), "Total XP"],
      ["📚", done + "/" + totalLessons, "Lessons done"],
      ["🏋️", exSolved + "/" + exTotal, "Exercises solved"],
      ["🔥", st.current + "d", "Day streak"],
      ["▶️", runs, "Code runs"]
    ];
    document.getElementById("profile-stats").innerHTML = stats.map(function (s) {
      return '<div class="dash-card stat"><div class="stat-ico">' + s[0] + '</div><div><div class="big">' + s[1] + '</div><div class="muted small">' + s[2] + '</div></div></div>';
    }).join("");

    var total = A.renderHeatmap(document.getElementById("profile-heatmap"));
    document.getElementById("activity-total").textContent = total + " contributions in the last year";

    var pins = A.pins();
    document.getElementById("profile-pins").innerHTML = pins.length ? pins.map(function (p) {
      var href = p.kind === "lesson" ? "learn.html#lesson-" + p.id : "compiler.html#snippet-" + p.id;
      return '<a class="pin-card" href="' + href + '"><span class="pin-ico">' + (p.kind === "lesson" ? "📚" : "📝") + '</span><span>' + esc(p.title) + '</span><button class="icon-btn pin-x" data-unpin="' + p.kind + ':' + p.id + '" aria-label="Unpin">✕</button></a>';
    }).join("") : '<p class="muted">Nothing pinned yet.</p>';

    var ach = A.achievements(), un = ach.filter(function (a) { return a.unlocked; });
    document.getElementById("ach-count").textContent = un.length + "/" + ach.length + " unlocked";
    document.getElementById("profile-achievements").innerHTML = ach.map(function (a) {
      return '<div class="ach ' + (a.unlocked ? "on" : "") + '" title="' + esc(a.desc) + (a.unlocked ? " — unlocked " + new Date(a.at).toLocaleDateString() : " — locked") + '">' +
        '<span class="ach-ico">' + (a.unlocked ? a.icon : "🔒") + '</span><span class="ach-name">' + esc(a.name) + '</span></div>';
    }).join("");

    var feed = A.feed(15);
    var icons = { lesson: "📚", run: "▶️", snippet: "📝", achievement: "🏆", star: "⭐" };
    document.getElementById("profile-feed").innerHTML = feed.length ? feed.map(function (e) {
      return '<div class="feed-item"><span>' + (icons[e.type] || "•") + '</span><span>' + esc(e.text) + '</span><time class="muted small">' + new Date(e.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + '</time></div>';
    }).join("") : '<p class="muted">No activity yet — complete a lesson or run some code.</p>';

    // unpin buttons
    Array.prototype.forEach.call(document.querySelectorAll("[data-unpin]"), function (b) {
      b.addEventListener("click", function (ev) {
        ev.preventDefault();
        var parts = b.getAttribute("data-unpin").split(":");
        var p = A.pins().filter(function (x) { return !(x.kind === parts[0] && x.id === parts[1]); });
        try { localStorage.setItem("skillzify_pins", JSON.stringify(p)); } catch (e) {}
        render();
      });
    });
  }

  /* ---------- Certificates (showcase) ---------- */
  function renderCerts() {
    var cx = document.getElementById("profile-certs");
    if (!cx) return;
    var L = window.SkillzifyLearn;
    var prog = {};
    try { prog = JSON.parse(localStorage.getItem("skillzify_progress") || "{}"); } catch (e) {}
    var html = "";
    (L ? L.TRACKS : []).forEach(function (t) {
      var lessons = L.LESSONS.filter(function (l) { return l.track === t.id; });
      var done = lessons.filter(function (l) { return prog[l.id]; }).length;
      if (lessons.length && done === lessons.length) {
        html += '<div class="run-item"><span>🎓 ' + esc(t.name) + " track complete</span>" +
          '<button class="btn btn-sm" data-cert="' + t.id + '">Download certificate</button></div>';
      }
    });
    cx.innerHTML = html || '<p class="hint">Finish every lesson in a track to unlock its certificate.</p>';
    Array.prototype.forEach.call(cx.querySelectorAll("[data-cert]"), function (b) {
      b.addEventListener("click", function () { downloadCert(b.getAttribute("data-cert")); });
    });
  }

  function downloadCert(trackId) {
    var L = window.SkillzifyLearn;
    var t = ((L && L.TRACKS.filter(function (x) { return x.id === trackId; })[0])) || { name: trackId };
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

  /* ---------- Topic mastery bar (showcase) ---------- */
  function renderMastery() {
    var bar = document.getElementById("profile-mastery-bar");
    var legend = document.getElementById("profile-mastery-legend");
    if (!bar || !legend) return;
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
      bar.innerHTML = counts.map(function (c) {
        return '<span style="width:' + (c.done / tot * 100) + '%;background:' + c.color + '" title="' + c.name + ": " + c.done + '"></span>';
      }).join("");
      legend.innerHTML = counts.map(function (c) {
        return '<span><i style="background:' + c.color + '"></i>' + c.name + " — " + c.done + "/" + c.total + "</span>";
      }).join("");
    } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    A.checkAchievements();
    render();
    var modal = document.getElementById("profile-modal");
    document.getElementById("edit-profile-btn").addEventListener("click", function () {
      var p = A.profile();
      var fbName = "";
      try { var cu = window.SkillzifyAuth && window.SkillzifyAuth.currentUser(); fbName = (cu && cu.name) || ""; } catch (e) {}
      document.getElementById("pf-name").value = p.name || fbName || "";
      document.getElementById("pf-bio").value = p.bio || "";
      modal.hidden = false;
    });
    document.getElementById("pf-cancel").addEventListener("click", function () { modal.hidden = true; });
    document.getElementById("pf-save").addEventListener("click", function () {
      var newName = document.getElementById("pf-name").value.trim();
      var newBio = document.getElementById("pf-bio").value.trim();
      A.saveProfile({ name: newName, bio: newBio });
      if (window.SkillzifySync) window.SkillzifySync.markDirty("profile");
      // Sync the name to Firebase so the nav + all devices show it
      try {
        var SA = window.SkillzifyAuth;
        var fbu = SA && SA.firebaseUser && SA.firebaseUser();
        if (fbu && newName) {
          fbu.updateProfile({ displayName: newName }).then(function () {
            if (SA.refreshAccountUI) SA.refreshAccountUI();
            render();
          }).catch(function () { render(); });
        } else {
          if (SA && SA.refreshAccountUI) SA.refreshAccountUI();
        }
      } catch (e) {}
      modal.hidden = true; render();
      S.toast("Profile updated ✨", "success");
    });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.hidden = true; });
  });
})();
