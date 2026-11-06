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
    var totalLessons = (window.SkillzifyLearn && window.SkillzifyLearn.totalLessons) || 250;
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
    (L ? (L.SECTIONS || L.TRACKS) : []).forEach(function (t) {
      var lessons = L.LESSONS.filter(function (l) { return l.section === t.id; });
      var done = lessons.filter(function (l) { return prog[l.id]; }).length;
      if (lessons.length && done === lessons.length) {
        html += '<div class="run-item"><span>🎓 ' + esc(t.name) + " section complete</span>" +
          '<button class="btn btn-sm" data-cert="' + t.id + '">Download certificate</button></div>';
      }
    });
    cx.innerHTML = html || '<p class="hint">Finish every lesson in a section to unlock its certificate.</p>';
    Array.prototype.forEach.call(cx.querySelectorAll("[data-cert]"), function (b) {
      b.addEventListener("click", function () { downloadCert(b.getAttribute("data-cert")); });
    });
  }

  function downloadCert(unitId) {
    var L = window.SkillzifyLearn;
    var t = ((L && (L.SECTIONS || []).filter(function (x) { return x.id === unitId; })[0])) ||
      ((L && L.TRACKS.filter(function (x) { return x.id === unitId; })[0])) || { name: unitId };
    var isSection = !!(L && (L.SECTIONS || []).some(function (x) { return x.id === unitId; }));
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
    g.fillText(t.name + (isSection ? " Section" : " Track"), 600, 510);
    g.font = "400 26px Georgia, serif"; g.fillStyle = "#94a3b8";
    var d = new Date();
    g.fillText("Skillzify · Learn. Build. Shine. — " + d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), 600, 600);
    g.font = "700 40px Georgia, serif"; g.fillStyle = "#c9a227";
    g.fillText("🐍", 600, 700);
    var a = document.createElement("a");
    a.download = "skillzify-" + unitId + "-certificate.png";
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
      var tracks = [["base-camp", "Base Camp", "#6c7bff"], ["tool-shed", "Tool Shed", "#22d3ee"], ["object-castle", "Object Castle", "#f0a35e"], ["algorithm-arena", "Algorithm Arena", "#9d6bff"], ["power-lab", "Power Lab", "#f59e0b"], ["data-lab", "Data Lab", "#34d399"], ["launch-pad", "Launch Pad", "#f472b6"]];
      var counts = tracks.map(function (t) {
        var lessons = L ? L.LESSONS.filter(function (l) { return l.section === t[0]; }) : [];
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

  function hideCard(el) {
    while (el && !(el.className && String(el.className).indexOf("dash-card") >= 0)) el = el.parentNode;
    if (el) el.style.display = "none";
  }
  function renderPublic(uid) {
    var C = window.SkillzifyCommunity;
    ["edit-profile-btn", "profile-sync"].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = "none";
    });
    ["profile-certs", "profile-mastery-bar", "profile-pins", "profile-achievements", "profile-feed-card"].forEach(function (id) {
      var el = document.getElementById(id); if (el) hideCard(el);
    });
    document.getElementById("profile-name").textContent = "Loading…";
    document.getElementById("profile-bio").textContent = "";
    document.getElementById("profile-meta").textContent = "";
    if (!C) {
      document.getElementById("profile-name").textContent = "Community unavailable";
      document.getElementById("profile-bio").textContent = "The community module did not load — check your connection and try again.";
      return;
    }
    C.getPublicProfile(uid).then(function (p) {
      if (!p) {
        document.getElementById("profile-name").textContent = "Learner not found";
        document.getElementById("profile-bio").textContent = "This learner hasn't shared a public profile yet — they need to open their own profile once to publish it.";
        return;
      }
      document.getElementById("profile-name").textContent = p.displayName || "Learner";
      document.getElementById("profile-bio").textContent = "Community learner";
      if (A && typeof A.identicon === "function") {
        document.getElementById("profile-avatar").innerHTML = A.identicon(p.displayName || "Learner", 96);
      }
      document.getElementById("profile-level").textContent = "⚡ " + (p.xp || 0).toLocaleString() + " XP";
      document.getElementById("profile-meta").textContent = "🔥 " + (p.streak || 0) + "d streak · 🏆 " + (p.achievements || []).length + " badges";
      var stats = [
        ["⚡", (p.xp || 0).toLocaleString(), "Total XP"],
        ["📚", (p.lessonsDone || 0) + "/" + (p.lessonsTotal || 250), "Lessons done"],
        ["🔥", (p.streak || 0) + "d", "Day streak"],
        ["🏆", String((p.achievements || []).length), "Badges unlocked"]
      ];
      document.getElementById("profile-stats").innerHTML = stats.map(function (s) {
        return '<div class="dash-card stat"><div class="stat-ico">' + s[0] + '</div><div><div class="big">' + esc(s[1]) + '</div><div class="muted small">' + esc(s[2]) + "</div></div></div>";
      }).join("");
    }).catch(function () {
      document.getElementById("profile-name").textContent = "Couldn't load this profile";
      document.getElementById("profile-bio").textContent = "Check your connection and try again.";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var me = null;
    try { me = window.SkillzifyAuth && window.SkillzifyAuth.currentUser(); } catch (e) {}
    var wantUid = null;
    try { wantUid = new URLSearchParams(location.search).get("uid"); } catch (e) {}
    if (wantUid && (!me || me.uid !== wantUid)) { renderPublic(wantUid); return; }
    A.checkAchievements();
    render();
    try { if (window.SkillzifyCommunity) window.SkillzifyCommunity.publishPublicProfile(); } catch (e) {}
    var drawer = document.getElementById("profile-modal");
    function openDrawer() {
      var p = A.profile();
      var cu = null;
      try { cu = window.SkillzifyAuth && window.SkillzifyAuth.currentUser(); } catch (e) {}
      var fbName = (cu && cu.name) || "";
      var email = (cu && cu.email) || "";
      document.getElementById("pf-name").value = p.name || fbName || "";
      document.getElementById("pf-bio").value = p.bio || "";
      document.getElementById("pf-email").textContent = email || "Not signed in";
      document.getElementById("pf-reset-status").textContent = "";
      drawer.classList.add("open");
    }
    function closeDrawer() { drawer.classList.remove("open"); }
    document.getElementById("edit-profile-btn").addEventListener("click", openDrawer);
    document.getElementById("pf-close").addEventListener("click", closeDrawer);
    drawer.addEventListener("click", function (e) { if (e.target === drawer) closeDrawer(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });
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
      closeDrawer(); render();
      S.toast("Profile updated \u2728", "success");
    });
    document.getElementById("pf-reset").addEventListener("click", function () {
      var status = document.getElementById("pf-reset-status");
      var email = "";
      try {
        var cu = window.SkillzifyAuth && window.SkillzifyAuth.currentUser();
        email = (cu && cu.email) || "";
      } catch (e) {}
      if (!email) { status.textContent = "Sign in first \u2014 we need an email to send the link to."; return; }
      if (!window.firebase || !firebase.auth) { status.textContent = "Auth isn't ready yet \u2014 try again in a moment."; return; }
      status.textContent = "Sending\u2026";
      firebase.auth().sendPasswordResetEmail(email).then(function () {
        status.textContent = "\u2713 Reset link sent to " + email + " \u2014 check your inbox.";
      }).catch(function (err) {
        status.textContent = "Couldn't send the email (" + ((err && err.code) || "error") + "). Please try again.";
      });
    });
  });
})();
