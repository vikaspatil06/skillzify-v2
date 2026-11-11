/* ============================================================
   Skillzify v2 — passport.js (Verifiable Skill Passport,
   System 3 of 4, Phases 1–3)

   A public, shareable page proving what a learner actually did —
   every lesson, exercise, project and path, with dates — read live
   from Skillzify's public database and linked from every
   certificate. The certificate stops being an image and becomes a
   link to the proof.

   THE HONEST LIMIT (read first): publicProfiles/{uid} is
   owner-writable, so v1 proves TRANSPARENCY, not tamper-proofness.
   Never call it "tamper-proof" or unqualified "verified" anywhere
   in the UI or copy. The passport page carries the honesty line
   (PUBLIC_NOTE, stored in the doc too) saying exactly that.
   Server-signed snapshots are Phase 4 — NOT built here.

   Exposes window.SkillzifyPassport:
   - buildPassport() -> the rich §4c public-profile document, built
     from local data (progress + doneAt + attempts + projects +
     paths + activity + persisted certificate records)
   - renderPublic(uid) -> fetches publicProfiles/{uid} and renders
     the passport page into #passport-root
   - certId(sectionId, issuedAt) -> "SKZ-{SECTION}-{YYMMDD}"
   - certFor(sectionId) -> get-or-create the persisted certificate
     record {id, issuedAt} for a completed section
   - unpublish() -> deletes the public doc + sets the private flag
   - isPrivate() / setPrivate(bool) -> the privacy flag
   ============================================================ */
(function () {
  "use strict";

  var DONE_AT_KEY = "skillzify_lesson_done_at";
  var CERT_KEY = "skillzify_certificates";
  var PRIVATE_KEY = "skillzify_passport_private";
  var PROJECTS_KEY = "skillzify_projects_done";
  var VERIFY_HOST = "skillzify-v2.onrender.com";

  var PUBLIC_NOTE = "This page reads live from Skillzify's public database \u2014 a transparent, itemised record, not a screenshot. It is not tamper-proof: the learner's own account writes this record.";

  /* ---------------- small helpers ---------------- */
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function storeGet(key, fallback) {
    try {
      if (window.Skillzify && typeof window.Skillzify.storeGet === "function")
        return window.Skillzify.storeGet(key, fallback);
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function storeSet(key, val) {
    try {
      if (window.Skillzify && typeof window.Skillzify.storeSet === "function") {
        window.Skillzify.storeSet(key, val);
        return;
      }
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function yymmdd(ms) {
    var d = new Date(ms);
    return pad2(d.getFullYear() % 100) + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }
  /* A date, or the honest "not recorded" — never an invented one. */
  function fmtDate(ms) {
    ms = num(ms);
    if (!ms) return "date not recorded";
    try {
      return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return "date not recorded"; }
  }
  function fmtDay(s) {
    if (!s) return "—";
    try {
      var d = new Date(s + "T00:00:00");
      return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return s; }
  }
  function verifyUrl(uid) {
    return "https://" + VERIFY_HOST + "/passport.html?uid=" + encodeURIComponent(uid || "");
  }

  /* ---------------- certificates (§5) ---------------- */
  function certId(sectionId, issuedAt) {
    return "SKZ-" + String(sectionId || "").toUpperCase() + "-" + yymmdd(issuedAt || Date.now());
  }
  function getCerts() {
    var m = storeGet(CERT_KEY, {}) || {};
    return (m && typeof m === "object" && !Array.isArray(m)) ? m : {};
  }
  function sectionDoneAt(sectionId) {
    // Section completion time = max doneAt of its lessons (0 when
    // none recorded — pre-passport completions have no dates).
    var LC = window.SkillzifyLearnCore || null;
    var doneAt = storeGet(DONE_AT_KEY, {}) || {};
    var max = 0;
    try {
      var lessons = (LC && LC.LESSONS) || [];
      lessons.forEach(function (l) {
        if (l.section === sectionId) {
          var at = num(doneAt[l.id]);
          if (at > max) max = at;
        }
      });
    } catch (e) {}
    return max;
  }
  /* Get-or-create, persisted: the canvas ID and the passport-doc ID
     are the same record, so they can never drift apart. A section
     completed before the passport shipped gets today as its ISSUE
     date — the lessons themselves still honestly show "date not
     recorded". */
  function certFor(sectionId) {
    var certs = getCerts();
    if (certs[sectionId] && certs[sectionId].id) return certs[sectionId];
    var issuedAt = sectionDoneAt(sectionId) || Date.now();
    var rec = { id: certId(sectionId, issuedAt), issuedAt: issuedAt };
    certs[sectionId] = rec;
    storeSet(CERT_KEY, certs);
    return rec;
  }

  /* ---------------- privacy (§6) ---------------- */
  // The flag is stored PER USER: skillzify_passport_private_<uid>.
  // The plain key below is only the pre-fix legacy shape — see
  // migratePrivate(). Per-uid keys are NOT in sync.js's
  // clearLocalUserData() wipe list (an explicit key list, not a
  // prefix sweep), so they survive sign-out by design; the legacy
  // key IS in that list, so a stale legacy choice can never leak
  // to the next user on a shared device.
  function privateKeyFor(uid) { return PRIVATE_KEY + "_" + uid; }
  function currentUid() {
    try {
      var u = (window.SkillzifyAuth && typeof window.SkillzifyAuth.currentUser === "function" &&
        window.SkillzifyAuth.currentUser()) || null;
      return (u && u.uid) ? String(u.uid) : null;
    } catch (e) { return null; }
  }
  /* One-time migration: a choice made before per-uid keys existed
     lives under the plain key. Copy it to this user's key, then
     delete the plain key. Runs on first use with a uid — before
     any sign-out can wipe the legacy key. (If a logout push ever
     fails, the wipe is skipped and a legacy key could in theory be
     migrated to the next user; that degraded state already mixes
     local data across users, and the plain key is wiped on every
     successful logout.) */
  function migratePrivate() {
    var uid = currentUid();
    if (!uid) return;
    try {
      if (localStorage.getItem(PRIVATE_KEY) === "1") {
        localStorage.setItem(privateKeyFor(uid), "1");
        localStorage.removeItem(PRIVATE_KEY);
      }
    } catch (e) {}
  }
  function isPrivate() {
    try {
      var uid = currentUid();
      // No signed-in user: there is no per-uid flag to read.
      if (!uid) return false;
      migratePrivate();
      return localStorage.getItem(privateKeyFor(uid)) === "1";
    } catch (e) { return false; }
  }
  function setPrivate(on) {
    try {
      var uid = currentUid();
      // No signed-in user: nothing to store the choice against.
      if (!uid) return;
      migratePrivate();
      if (on) localStorage.setItem(privateKeyFor(uid), "1");
      else localStorage.removeItem(privateKeyFor(uid));
    } catch (e) {}
  }
  function unpublish() {
    setPrivate(true);
    try {
      var C = window.SkillzifyCommunity;
      if (C && typeof C.deletePublicProfile === "function")
        return C.deletePublicProfile().catch(function () {});
    } catch (e) {}
    return Promise.resolve();
  }

  /* ---------------- build the rich public doc (§4c) ---------------- */
  function buildPassport() {
    var LC = window.SkillzifyLearnCore || null;
    var LESSONS = (LC && LC.LESSONS) || [];
    var SECTIONS = (LC && LC.SECTIONS) || [];
    var catalogIds = {};
    LESSONS.forEach(function (l) { catalogIds[l.id] = true; });
    var prog = storeGet("skillzify_progress", {}) || {};
    var doneAt = storeGet(DONE_AT_KEY, {}) || {};

    var xp = 0;
    try { xp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0; } catch (e) {}
    xp = Math.max(0, xp);

    var streak = 0, achievements = [], runCount = 0;
    try {
      var A = window.SkillzifyActivity || null;
      if (A) {
        var st = A.streak ? A.streak() : null;
        streak = (st && st.current) || 0;
        var un = A.unlocked ? A.unlocked() : null;
        achievements = un ? Object.keys(un) : [];
        runCount = A.runCount ? (A.runCount() || 0) : 0;
      }
    } catch (e) {}

    var name = "";
    try {
      var u = (window.SkillzifyAuth && window.SkillzifyAuth.currentUser()) || null;
      name = (u && u.name) || "";
    } catch (e) {}
    if (!name) {
      try {
        var prof = (window.SkillzifyActivity && window.SkillzifyActivity.profile()) || {};
        name = prof.name || "";
      } catch (e2) {}
    }
    if (!name) name = "Skillzify Learner";

    var level = "";
    try { if (LC && LC.levelFor) level = (LC.levelFor(xp) || {}).name || ""; } catch (e) {}

    // Lessons done: only lessons that exist in the catalog count
    // (a stale/removed id lingering in progress must not inflate it).
    var lessonsDone = 0;
    Object.keys(prog).forEach(function (id) {
      if (prog[id] && (!LESSONS.length || catalogIds[id])) lessonsDone++;
    });
    var lessonsTotal = LESSONS.length || 250;

    var sections = SECTIONS.map(function (sec) {
      var secLessons = LESSONS.filter(function (l) { return l.section === sec.id; });
      var done = secLessons.filter(function (l) { return !!prog[l.id]; });
      var maxAt = 0;
      var lessons = secLessons.map(function (l) {
        var at = num(doneAt[l.id]);
        if (at > maxAt) maxAt = at;
        return { id: l.id, title: l.title, doneAt: at };
      });
      var complete = secLessons.length > 0 && done.length === secLessons.length;
      return {
        id: sec.id, name: sec.name, done: done.length, total: secLessons.length,
        // null until the section is complete — and null again when it
        // is complete but no lesson carries a date (pre-passport).
        completedAt: complete ? (maxAt || null) : null,
        lessons: lessons
      };
    });

    var EXD = window.SkillzifyPracticeData || [];
    var attempts = storeGet("skillzify_exercise_attempts", {}) || {};
    var byTopic = {};
    EXD.forEach(function (ex) {
      var t = byTopic[ex.topic];
      if (!t) t = byTopic[ex.topic] = { solved: 0, total: 0, first: null, last: null };
      t.total++;
      var a = attempts[ex.id];
      if (a && a.solved) {
        t.solved++;
        var firstAt = num(a.at);
        if (firstAt > 0 && (t.first === null || firstAt < t.first)) t.first = firstAt;
        var lastTry = num(a.lastTry);
        if (lastTry > 0 && (t.last === null || lastTry > t.last)) t.last = lastTry;
      }
    });
    var exSolved = 0;
    Object.keys(byTopic).forEach(function (k) { exSolved += byTopic[k].solved; });

    // Projects: catalog order first, then any done id the catalog no
    // longer knows (title falls back to the id itself).
    var projDone = storeGet(PROJECTS_KEY, {}) || {};
    if (Array.isArray(projDone)) {
      var mig = {};
      projDone.forEach(function (id) { if (typeof id === "string") mig[id] = 0; });
      projDone = mig;
    }
    var catalog = window.SkillzifyProjects || [];
    var projById = {};
    catalog.forEach(function (p) { projById[p.id] = p; });
    var projList = [];
    catalog.forEach(function (p) {
      if (Object.prototype.hasOwnProperty.call(projDone, p.id))
        projList.push({ id: p.id, title: p.title, at: num(projDone[p.id]) });
    });
    Object.keys(projDone).forEach(function (id) {
      if (!projById[id]) projList.push({ id: id, title: id, at: num(projDone[id]) });
    });
    var projTotal = catalog.length || projList.length;

    var pathBonus = storeGet("skillzify_path_bonus", {}) || {};
    var pathIds = Object.keys(pathBonus).filter(function (k) { return !!pathBonus[k]; });

    var days = storeGet("skillzify_activity_days", {}) || {};
    var dayKeys = Object.keys(days).sort();
    var codeRuns = runCount;

    // Certificates: one per completed section, minted (and persisted)
    // here so the doc and any downloaded certificate always agree.
    var certs = {};
    sections.forEach(function (s) {
      if (s.total > 0 && s.done === s.total) certs[s.id] = certFor(s.id);
    });

    return {
      displayName: name,
      xp: xp,
      lessonsDone: lessonsDone,
      lessonsTotal: lessonsTotal,
      streak: streak,
      achievements: (achievements || []).slice(0, 32),
      level: level,
      sections: sections,
      exercises: { solved: exSolved, total: EXD.length, byTopic: byTopic },
      projects: { done: projList, total: projTotal },
      paths: { completed: pathIds },
      activity: {
        firstActive: dayKeys.length ? dayKeys[0] : null,
        lastActive: dayKeys.length ? dayKeys[dayKeys.length - 1] : null,
        codeRuns: codeRuns
      },
      certificates: certs,
      publicNote: PUBLIC_NOTE,
      updatedAt: Date.now()
    };
  }

  /* ---------------- render the public page (§6) ---------------- */
  function renderPublic(uid) {
    var root = null;
    try { root = document.getElementById("passport-root"); } catch (e) {}
    function show(html) { if (root) root.innerHTML = html; }
    if (!uid) {
      show('<div class="dash-card"><h2>\u{1F393} Skill Passport</h2>' +
        '<p class="hint">Open a learner\u2019s passport link to see their public record — ' +
        "for example <code>passport.html?uid=&lt;learner-id&gt;</code>. " +
        "Learners get their link from the Certificates card on their own profile.</p></div>");
      return Promise.resolve(false);
    }
    var C = window.SkillzifyCommunity;
    if (!C || typeof C.getPublicProfile !== "function") {
      show('<div class="dash-card"><h2>Couldn\u2019t load this passport</h2>' +
        '<p class="hint">The community module didn\u2019t load — check your connection and try again.</p></div>');
      return Promise.resolve(false);
    }
    return C.getPublicProfile(uid).then(function (p) {
      if (!p) {
        show(emptyHtml());
        return false;
      }
      var hasAnything = (p.lessonsDone || 0) > 0 ||
        (p.exercises && p.exercises.solved > 0) ||
        (p.projects && p.projects.done && p.projects.done.length > 0) ||
        (p.paths && p.paths.completed && p.paths.completed.length > 0) ||
        (p.certificates && Object.keys(p.certificates).length > 0);
      if (!hasAnything) {
        show(emptyHtml());
        return false;
      }
      show(renderDoc(p));
      return true;
    }).catch(function () {
      show('<div class="dash-card"><h2>Couldn\u2019t load this passport</h2>' +
        '<p class="hint">Check your connection and try again.</p></div>');
      return false;
    });
  }
  function emptyHtml() {
    return '<div class="dash-card"><h2>No public activity yet</h2>' +
      '<p class="hint">This learner hasn\u2019t published a passport, or hasn\u2019t completed anything yet. ' +
      "A passport appears here once they open their own profile while signed in.</p></div>";
  }
  function renderDoc(p) {
    var secs = p.sections || [];
    var certs = p.certificates || {};
    var certIds = Object.keys(certs);
    var ex = p.exercises || { solved: 0, total: 0, byTopic: {} };
    var proj = p.projects || { done: [], total: 0 };
    var paths = (p.paths && p.paths.completed) || [];
    var act = p.activity || {};

    var html = "";
    // Header
    html += '<div class="dash-card"><h2 style="margin-top:0">' + esc(p.displayName || "Learner") + "</h2>" +
      '<p class="muted">' + esc(p.level || "") + " · " + num(p.xp).toLocaleString() + " XP · \u{1F525} " + num(p.streak) + "d streak</p>" +
      '<p class="muted small">First active: ' + esc(fmtDay(act.firstActive)) + " · Last active: " + esc(fmtDay(act.lastActive)) +
      " · Code runs: " + num(act.codeRuns) + "</p></div>";

    // Certificates
    html += '<div class="dash-card" style="margin-top:20px"><h2>\u{1F393} Certificates</h2>';
    if (!certIds.length) {
      html += '<p class="hint">No section completed yet — finish every lesson in a section to earn its certificate.</p>';
    } else {
      certIds.forEach(function (sid) {
        var cert = certs[sid];
        var sec = null;
        secs.forEach(function (s) { if (s.id === sid) sec = s; });
        var secName = sec ? sec.name : sid;
        html += '<div class="run-item"><span>\u{1F393} ' + esc(secName) + "</span>" +
          '<span class="muted small">' + esc(cert.id) + " · issued " + esc(fmtDate(cert.issuedAt)) + "</span></div>";
        var lessons = sec ? (sec.lessons || []) : [];
        if (lessons.length) {
          html += "<details><summary>Lessons in this section (" + lessons.length + ")</summary><ul>" +
            lessons.map(function (l) {
              return "<li>" + esc(l.title) + ' — <span class="muted">' + esc(fmtDate(l.doneAt)) + "</span></li>";
            }).join("") + "</ul></details>";
        }
      });
    }
    html += "</div>";

    // Proof tables
    html += '<div class="dash-card" style="margin-top:20px"><h2>\u{1F50D} Proof of work</h2>';
    html += "<h3>Exercises — " + num(ex.solved) + "/" + num(ex.total) + " solved</h3>";
    var topics = Object.keys(ex.byTopic || {}).sort();
    if (!topics.length) {
      html += '<p class="hint">No exercises attempted yet.</p>';
    } else {
      html += '<table class="passport-table"><thead><tr><th>Topic</th><th>Solved</th><th>First solve</th><th>Last solve</th></tr></thead><tbody>' +
        topics.map(function (t) {
          var row = ex.byTopic[t];
          return "<tr><td>" + esc(t) + "</td><td>" + num(row.solved) + "/" + num(row.total) +
            "</td><td>" + esc(fmtDate(row.first)) + "</td><td>" + esc(fmtDate(row.last)) + "</td></tr>";
        }).join("") + "</tbody></table>";
    }
    html += "<h3>Projects — " + (proj.done || []).length + "/" + num(proj.total) + " done</h3>";
    if (!(proj.done || []).length) {
      html += '<p class="hint">No projects completed yet.</p>';
    } else {
      html += "<ul>" + (proj.done || []).map(function (pr) {
        return "<li>" + esc(pr.title) + ' — <span class="muted">' + esc(fmtDate(pr.at)) + "</span></li>";
      }).join("") + "</ul>";
    }
    html += "<h3>Learning paths</h3>";
    html += paths.length
      ? "<p>" + paths.map(function (id) { return esc(id); }).join(" · ") + "</p>"
      : '<p class="hint">No learning paths completed yet.</p>';
    html += "<p>Code runs: <strong>" + num(act.codeRuns) + "</strong></p>";
    html += "</div>";

    // How to verify + the honesty line (verbatim from the doc).
    html += '<div class="dash-card" style="margin-top:20px"><h2>How to verify</h2>' +
      "<p>This page reads live from Skillzify's database \u2014 not a screenshot. " +
      "Certificate IDs on this page match the IDs printed on the certificates.</p>" +
      '<p class="hint">' + esc(p.publicNote || PUBLIC_NOTE) + "</p></div>";
    return html;
  }

  window.SkillzifyPassport = {
    buildPassport: buildPassport,
    renderPublic: renderPublic,
    certId: certId,
    certFor: certFor,
    unpublish: unpublish,
    isPrivate: isPrivate,
    setPrivate: setPrivate,
    verifyUrl: verifyUrl,
    PUBLIC_NOTE: PUBLIC_NOTE
  };
})();
