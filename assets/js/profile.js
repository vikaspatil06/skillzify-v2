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
    var name = prof.name || (user && user.name) || "Skillzify Learner";
    var seed = (user && user.email) || name;

    document.getElementById("profile-avatar").innerHTML = A.identicon(seed, 96);
    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-bio").textContent = prof.bio || "Add a bio so future-you remembers why you started.";
    var xp = 0, done = 0, exSolved = 0, exTotal = 0;
    try { xp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0; } catch (e) {}
    var totalLessons = (window.SkillzifyLearn && window.SkillzifyLearn.totalLessons) || 250;
    // P2-15: count only lessons that exist in the catalog — a stale /
    // removed lesson id lingering in skillzify_progress must not
    // inflate "lessons done" (or the stats card below). Same filter as
    // the dashboard and activity.js gatherState().
    try {
      var progIds = JSON.parse(localStorage.getItem("skillzify_progress") || "{}");
      var catalogIds = {};
      var catLessons = (window.SkillzifyLearnCore && window.SkillzifyLearnCore.LESSONS) ||
        (window.SkillzifyLearn && window.SkillzifyLearn.LESSONS) || [];
      catLessons.forEach(function (l) { catalogIds[l.id] = true; });
      done = Object.keys(progIds).filter(function (id) { return !catLessons.length || catalogIds[id]; }).length;
    } catch (e) {}
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
      ["🔥", st.current + "d", "Day streak · best " + st.longest + "d"],
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
      // Locked badges show how close you are (X/Y + thin bar); unlocked
      // ones stay clean — the date is already in the tooltip.
      var prog = (!a.unlocked && a.progress) ? a.progress : null;
      var pct = prog && prog.total > 0 ? Math.round(prog.done / prog.total * 100) : 0;
      return '<div class="ach ' + (a.unlocked ? "on" : "") + '" title="' + esc(a.desc) + (a.unlocked ? " — unlocked " + new Date(a.at).toLocaleDateString() : " — locked") + '">' +
        '<span class="ach-ico">' + (a.unlocked ? a.icon : "🔒") + '</span><span class="ach-name">' + esc(a.name) + '</span>' +
        (prog ? '<span class="ach-prog">' + prog.done + "/" + prog.total + '</span><span class="ach-bar"><span style="width:' + pct + '%"></span></span>' : "") +
        '</div>';
    }).join("");

    var feed = A.feed(15);
    var icons = { lesson: "📚", run: "▶️", snippet: "📝", achievement: "🏆", star: "⭐", xp: "⚡", practice: "✍️", review: "🔁" };
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
    // Passport link + privacy toggle (own view only — this whole card
    // is hidden in public view via hideCard). Re-rendered from the
    // stored flag on every render(), so the toggle always shows its
    // current state. The extra markup joins the string BEFORE the
    // single innerHTML write — appending afterwards would re-parse
    // the card and drop the Download buttons' listeners.
    var ownUid = null;
    try {
      var me = window.SkillzifyAuth && window.SkillzifyAuth.currentUser();
      ownUid = me && me.uid;
    } catch (e) {}
    var extra = "";
    if (ownUid) {
      extra += '<p style="margin-top:12px"><a href="passport.html?uid=' + encodeURIComponent(ownUid) + '">View your public passport \u2192</a></p>';
    }
    var PP = window.SkillzifyPassport;
    if (PP && typeof PP.isPrivate === "function") {
      var priv = false;
      try { priv = PP.isPrivate(); } catch (e2) {}
      extra += '<div class="passport-privacy" style="margin-top:12px;border-top:1px solid var(--border,#334155);padding-top:12px">' +
        '<p class="hint" style="margin:0 0 8px">' + (priv
          ? "Your passport is private \u2014 certificates still download, but their verify link shows \u2018passport not public\u2019."
          : "Anyone with the link can see your lessons, exercises and projects with dates.") + "</p>" +
        '<button class="btn btn-sm btn-ghost" id="passport-privacy-btn">' +
        (priv ? "Make my passport public" : "Make my passport private") + "</button></div>";
    }
    cx.innerHTML = (html || '<p class="hint">Finish every lesson in a section to unlock its certificate.</p>') + extra;
    Array.prototype.forEach.call(cx.querySelectorAll("[data-cert]"), function (b) {
      b.addEventListener("click", function () { downloadCert(b.getAttribute("data-cert")); });
    });
    var privBtn = document.getElementById("passport-privacy-btn");
    if (privBtn) privBtn.addEventListener("click", function () {
      var P = window.SkillzifyPassport;
      if (!P) return;
      var nowPriv = false;
      try { nowPriv = P.isPrivate(); } catch (e) {}
      if (nowPriv) {
        try { P.setPrivate(false); } catch (e2) {}
        try { if (window.SkillzifyCommunity) window.SkillzifyCommunity.publishPublicProfile(); } catch (e3) {}
        if (window.Skillzify) window.Skillzify.toast("Your passport is public \u2014 anyone with the link can see it. \u{1F513}", "success");
        renderCerts();
      } else {
        var done = function () {
          if (window.Skillzify) window.Skillzify.toast("Your passport is private \u2014 the public page is gone. \u{1F512}", "success");
          renderCerts();
        };
        try {
          var r = P.unpublish();
          if (r && typeof r.then === "function") r.then(done, done); else done();
        } catch (e4) { done(); }
      }
    });
  }

  /* ---- Pending certificate: downloaded after sign-in ----
     The Download button stays exactly as it is for everyone. A
     signed-out click does NOT produce a PNG — it parks the intent and
     sends the user to sign in; on return the certificate downloads
     on its own (resumePendingCert, called from decideView). A parked
     intent older than 24h is discarded. */
  var PENDING_CERT_KEY = "skillzify_pending_cert";
  var PENDING_CERT_TTL = 24 * 60 * 60 * 1000;
  function resumePendingCert() {
    var user = null;
    try { user = (window.SkillzifyAuth && window.SkillzifyAuth.currentUser()) || null; } catch (e) {}
    if (!user) return;
    var raw = null;
    try { raw = localStorage.getItem(PENDING_CERT_KEY); } catch (e) {}
    if (!raw) return;
    var rec = null;
    try { rec = JSON.parse(raw); } catch (e) {}
    if (!rec || !rec.section) { try { localStorage.removeItem(PENDING_CERT_KEY); } catch (e2) {} return; }
    if (!rec.at || Date.now() - rec.at > PENDING_CERT_TTL) { try { localStorage.removeItem(PENDING_CERT_KEY); } catch (e2) {} return; }
    try { localStorage.removeItem(PENDING_CERT_KEY); } catch (e2) {}
    downloadCert(rec.section);
    if (window.Skillzify) window.Skillzify.toast("Certificate downloading — if it doesn't start, use the Download button below. 🎓", "success");
  }

  /* Fallback certificate ID, same shape as SkillzifyPassport.certId
     (SKZ-{SECTION}-{YYMMDD}, local timezone) — used only when
     passport.js failed to load, so the certificate still gets an ID. */
  function fallbackCertId(sectionId, date) {
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    var dt = date || new Date();
    return "SKZ-" + String(sectionId || "").toUpperCase() + "-" +
      p2(dt.getFullYear() % 100) + p2(dt.getMonth() + 1) + p2(dt.getDate());
  }

  function downloadCert(unitId) {
    // Signed out? Park the intent and go sign in — no PNG is produced
    // in any path before sign-in. The toast gets ~700ms to be read,
    // following auth.js's own toast-then-redirect pattern.
    var signedIn = null;
    try { signedIn = (window.SkillzifyAuth && window.SkillzifyAuth.currentUser()) || null; } catch (e) {}
    if (!signedIn) {
      try { localStorage.setItem(PENDING_CERT_KEY, JSON.stringify({ section: unitId, at: Date.now() })); } catch (e) {}
      if (window.Skillzify) window.Skillzify.toast("Sign in and your certificate will download right after. 🎓", "success");
      setTimeout(function () { location.href = "auth.html?next=profile.html"; }, 700);
      return;
    }
    var L = window.SkillzifyLearn;
    var t = ((L && (L.SECTIONS || []).filter(function (x) { return x.id === unitId; })[0])) ||
      ((L && (L.TRACKS || []).filter(function (x) { return x.id === unitId; })[0])) || { name: unitId };
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
    // Passport (System 3): certificate ID + verify link. certFor()
    // persists the record, so the ID printed here is the same one the
    // passport page shows — and it stays stable across downloads.
    // Without passport.js, fall back to the same ID shape built from
    // today's date so the certificate still gets an ID. When the
    // passport is private the verify line says so instead of
    // pointing at a page that no longer exists.
    var certIdText = null, passportPriv = false;
    try {
      var PP = window.SkillzifyPassport;
      if (PP) {
        if (typeof PP.certFor === "function") {
          var rec = PP.certFor(unitId);
          certIdText = rec && rec.id;
        }
        if (!certIdText && typeof PP.certId === "function") certIdText = PP.certId(unitId, Date.now());
        if (typeof PP.isPrivate === "function") passportPriv = !!PP.isPrivate();
      }
    } catch (e) {}
    if (!certIdText) certIdText = fallbackCertId(unitId, d);
    var verifyText = passportPriv ? "Verify: passport not public"
      : "Verify: skillzify-v2.onrender.com/passport.html?uid=" + ((signedIn && signedIn.uid) || "");
    g.font = "400 26px Georgia, serif"; g.fillStyle = "#cbd5e1";
    g.fillText("Certificate ID: " + certIdText, 600, 640);
    g.fillText(verifyText, 600, 675);
    g.font = "700 40px Georgia, serif"; g.fillStyle = "#c9a227";
    g.fillText("🐍", 600, 730);
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
      // P2-22: section names/order come from SkillzifyLearnCore.SECTIONS
      // (single source — a rename there now flows here). Colours are
      // NOT in SECTIONS (learn-core.js carries no colour field, and it
      // is outside this batch), so the small id->colour map below is
      // presentation only; unknown sections fall back to grey.
      var SECTION_COLORS = { "base-camp": "#6c7bff", "tool-shed": "#22d3ee", "object-castle": "#f0a35e", "algorithm-arena": "#9d6bff", "power-lab": "#f59e0b", "data-lab": "#34d399", "launch-pad": "#f472b6" };
      var secs = (window.SkillzifyLearnCore && window.SkillzifyLearnCore.SECTIONS) ||
        (L && L.SECTIONS) || [];
      var counts = secs.map(function (sec) {
        var lessons = L ? L.LESSONS.filter(function (l) { return l.section === sec.id; }) : [];
        var done = lessons.filter(function (l) { return prog[l.id]; }).length;
        return { name: sec.name, color: SECTION_COLORS[sec.id] || "#94a3b8", done: done, total: lessons.length };
      });
      var tot = counts.reduce(function (s, c) { return s + c.done; }, 0) || 1;
      bar.innerHTML = counts.map(function (c) {
        return '<span style="width:' + (c.done / tot * 100) + '%;background:' + c.color + '" title="' + c.name + ": " + c.done + '"></span>';
      }).join("");
      legend.innerHTML = counts.map(function (c) {
        return '<span><i style="background:' + c.color + '"></i>' + c.name + " — " + c.done + "/" + c.total + "</span>";
      }).join("");
    } catch (e) {}
    // Phase 4: per-topic mastery rows (own view only — the whole card
    // hides for public views via hideCard, so no local data leaks).
    var topicsEl = document.getElementById("profile-mastery-topics");
    if (topicsEl) {
      try {
        var MM = window.SkillzifyMastery;
        if (MM && typeof MM.topicMastery === "function") {
          var esc = (window.Skillzify && window.Skillzify.esc) || function (x) { return String(x); };
          var mrows = MM.topicMastery();
          var triedM = mrows.filter(function (r) { return r.tried > 0; }).sort(function (a, b) { return a.score - b.score; });
          var untriedM = mrows.filter(function (r) { return r.tried === 0; });
          var th = "";
          if (!mrows.length) { th = ""; }
          else if (!triedM.length) { th = '<p class="hint">No exercises tried yet — solve a few and your topic mastery will show here.</p>'; }
          else {
            th = triedM.map(function (r) {
              return '<div class="weak-row"><div class="weak-top"><span class="lbl">' + esc(r.label) + '</span>' +
                '<span class="pct">' + r.score + "% · " + esc(r.band) + (r.rusty ? " \u{1F342}" : "") + '</span></div>' +
                '<div class="bar"><span style="width:' + r.score + '%"></span></div></div>';
            }).join("");
            if (untriedM.length) th += '<p class="hint" style="margin-top:10px">Not tried yet: ' + untriedM.map(function (r) { return esc(r.label); }).join(" · ") + "</p>";
          }
          topicsEl.innerHTML = th;
        }
      } catch (e) {}
    }
  }

  function hideCard(el) {
    while (el && !(el.className && String(el.className).indexOf("dash-card") >= 0)) el = el.parentNode;
    if (el) el.style.display = "none";
  }
  // Undo what renderPublic() hid, so switching from a public view back
  // to the own view (e.g. signing in while on ?uid=<own-uid>) restores
  // the edit/certs/pins/achievements UI instead of leaving it hidden.
  function showOwnCards() {
    ["edit-profile-btn", "profile-sync"].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = "";
    });
    ["profile-certs", "profile-mastery-bar", "profile-pins", "profile-achievements", "profile-feed-card"].forEach(function (id) {
      var el = document.getElementById(id);
      while (el && !(el.className && String(el.className).indexOf("dash-card") >= 0)) el = el.parentNode;
      if (el) el.style.display = "";
    });
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
      }).join("") +
        '<div class="dash-card" style="grid-column:1/-1;text-align:center"><a href="passport.html?uid=' + encodeURIComponent(uid) + '">View full passport \u2192</a></div>';
    }).catch(function () {
      document.getElementById("profile-name").textContent = "Couldn't load this profile";
      document.getElementById("profile-bio").textContent = "Check your connection and try again.";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var wantUid = null;
    try { wantUid = new URLSearchParams(location.search).get("uid"); } catch (e) {}

    // P1-2: decide own-vs-public only once the auth state is known, and
    // re-decide on every later sign-in/out. Deciding synchronously here
    // reads currentUser() before Firebase has resolved, so the owner
    // opening their own ?uid= link is shown the public view (edit /
    // certs / mastery / pins / achievements hidden) until a reload.
    // onAuthChange fires immediately if auth is already ready, on first
    // ready otherwise, and again on every later auth change.
    function decideView() {
      var me = null;
      try { me = window.SkillzifyAuth && window.SkillzifyAuth.currentUser(); } catch (e) {}
      if (wantUid && (!me || me.uid !== wantUid)) { renderPublic(wantUid); return; }
      showOwnCards();
      A.checkAchievements();
      render();
      resumePendingCert();
      try { if (window.SkillzifyCommunity) window.SkillzifyCommunity.publishPublicProfile(); } catch (e) {}
    }
    if (window.SkillzifyAuth && typeof window.SkillzifyAuth.onAuthChange === "function") {
      window.SkillzifyAuth.onAuthChange(decideView);
    } else {
      decideView();
    }
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

  // Test seam (harness): the certificate entry points. The sign-in gate
  // lives inside downloadCert itself, so calling it signed-out is safe.
  window.SkillzifyProfile = { downloadCert: downloadCert, resumePendingCert: resumePendingCert };
})();
