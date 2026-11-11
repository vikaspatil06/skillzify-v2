/* Skillzify Learning Paths — dynamic list + detail views.
   List: continue-learning hero, level filter pills, rich cards.
   Detail: #path=<id> route with hero, up-next card, visual timeline.
   Progress reads live from localStorage (lessons + exercise attempts). */
(function () {
  "use strict";
  var S = window.Skillzify;
  function esc(s) { return S.esc(String(s == null ? "" : s)); }
  function $(id) { return document.getElementById(id); }

  var LESSON_MIN = 12, EX_MIN = 15;
  var filter = "all";

  function lessonById(id) {
    var L = (window.SkillzifyLearn && window.SkillzifyLearn.LESSONS) || [];
    for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
    return null;
  }
  function exById(id) {
    var E = window.SkillzifyPracticeData || [];
    for (var i = 0; i < E.length; i++) if (E[i].id === id) return E[i];
    return null;
  }
  function lessonDone(id) {
    try { return !!(JSON.parse(localStorage.getItem("skillzify_progress") || "{}")[id]); } catch (e) { return false; }
  }
  function exDone(id) {
    try { var a = JSON.parse(localStorage.getItem("skillzify_exercise_attempts") || "{}")[id]; return !!(a && a.solved); }
    catch (e) { return false; }
  }
  function stepDone(s) { return s.t === "lesson" ? lessonDone(s.id) : exDone(s.id); }
  function stepTitle(s) {
    if (s.t === "lesson") { var l = lessonById(s.id); return l ? l.title : s.id; }
    var e = exById(s.id); return e ? e.title : s.id;
  }
  function stepHref(s) { return s.t === "lesson" ? "lesson.html?id=" + encodeURIComponent(s.id) : "practice.html#ex=" + s.id; }
  function stepKind(s) { return s.t === "lesson" ? "📖 Lesson" : "🏋️ Exercise"; }
  function stepMins(s) { return s.t === "lesson" ? LESSON_MIN : EX_MIN; }

  /* ---------- enrollment: paths as keys ----------
     Map shape { <pathId>: { enrolled, at } } with local fallbacks, so
     enrollment works even if the browser cached a stale paths-data.js
     without the helper functions. Timestamps let sync merge per path. */
  var ENROLL_KEY = "skillzify_enrolled_paths";
  function readEnrollMap() {
    try {
      var P = window.SkillzifyPaths;
      if (P && typeof P.enrollMap === "function") return P.enrollMap();
    } catch (e) {}
    var map = {};
    try {
      var v = JSON.parse(localStorage.getItem(ENROLL_KEY) || "null");
      if (Array.isArray(v)) v.forEach(function (id) { map[id] = { enrolled: true, at: 0 }; });
      else if (v && typeof v === "object") Object.keys(v).forEach(function (k) {
        var e = v[k] || {};
        map[k] = { enrolled: !!e.enrolled, at: e.at || 0 };
      });
    } catch (e2) {}
    return map;
  }
  function writeEnrollMap(map) { try { localStorage.setItem(ENROLL_KEY, JSON.stringify(map || {})); } catch (e) {} }
  function isEnrolled(p) {
    try {
      var P = window.SkillzifyPaths;
      if (P && typeof P.isEnrolled === "function") return P.isEnrolled(p.id);
    } catch (e) {}
    var m = readEnrollMap();
    return !!(m[p.id] && m[p.id].enrolled);
  }
  function doEnroll(id) {
    var done = false;
    try {
      var P = window.SkillzifyPaths;
      if (P && typeof P.enroll === "function") { P.enroll(id); done = true; }
    } catch (e) {}
    if (!done) { var m = readEnrollMap(); m[id] = { enrolled: true, at: Date.now() }; writeEnrollMap(m); }
    syncPathsDirty();
  }
  function doLeave(id) {
    var done = false;
    try {
      var P = window.SkillzifyPaths;
      if (P && typeof P.leave === "function") { P.leave(id); done = true; }
    } catch (e) {}
    if (!done) { var m = readEnrollMap(); m[id] = { enrolled: false, at: Date.now() }; writeEnrollMap(m); }
    syncPathsDirty();
  }
  function syncPathsDirty() {
    try { if (window.SkillzifySync) window.SkillzifySync.markDirty("paths"); } catch (e) {}
  }
  // lessons in this path still locked in the sequential chain (the "key" value)
  function lockedLessonCount(p) {
    var n = 0;
    (p.steps || []).forEach(function (s) {
      if (s.t !== "lesson" || stepDone(s)) return;
      try { if (!window.SkillzifyLearn.isLessonUnlocked(s.id)) n++; } catch (e) {}
    });
    return n;
  }
  // badge for a timeline lesson step: 🔓 when opened by enrollment, 🔒 when locked
  function lockBadge(s) {
    if (s.t !== "lesson" || stepDone(s)) return "";
    var unlocked = true, pathOnly = false;
    try {
      unlocked = window.SkillzifyLearn.isLessonUnlocked(s.id);
      pathOnly = window.SkillzifyLearn.isLessonPathUnlocked(s.id);
    } catch (e) {}
    if (pathOnly) return ' <span class="badge badge-unlock">🔓 unlocked</span>';
    if (!unlocked) return ' <span class="badge badge-locked">🔒 enroll to unlock</span>';
    return "";
  }
  function bindEnrollBtns(host, rerender) {
    host.querySelectorAll("[data-enroll]").forEach(function (b) {
      b.addEventListener("click", function () { doEnroll(b.getAttribute("data-enroll")); rerender(); });
    });
    host.querySelectorAll("[data-leave]").forEach(function (b) {
      b.addEventListener("click", function () { doLeave(b.getAttribute("data-leave")); rerender(); });
    });
  }

  function pathStats(p) {
    var lessons = 0, exs = 0, done = 0, mins = 0;
    p.steps.forEach(function (s) {
      if (s.t === "lesson") { lessons++; mins += LESSON_MIN; } else { exs++; mins += EX_MIN; }
      if (stepDone(s)) done++;
    });
    return {
      lessons: lessons, exs: exs, done: done, total: p.steps.length, mins: mins,
      pct: p.steps.length ? Math.round(done / p.steps.length * 100) : 0
    };
  }
  function nextStep(p) {
    for (var i = 0; i < p.steps.length; i++) if (!stepDone(p.steps[i])) return { step: p.steps[i], index: i };
    return null;
  }
  function fmtMins(m) {
    if (m < 60) return "~" + m + " min";
    var h = Math.floor(m / 60), r = m % 60;
    return "~" + h + "h" + (r ? " " + r + "m" : "");
  }
  function pathColor(p) { return p.color || "#6c7bff"; }

  /* ---------- custom paths: "Build my path" (F5) ---------- */
  var CUSTOM_KEY = "skillzify_custom_paths";
  function allLessons() { return (window.SkillzifyLearn && window.SkillzifyLearn.LESSONS) || []; }
  function projectNames() {
    return (window.SkillzifyProjects || []).map(function (p) { return p.title; });
  }
  // Corrupt stored JSON must never break the page.
  function loadCustomPaths() {
    try {
      var v = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  // Every save/delete stamps the definitions' updatedAt (used by the
  // sync merge's last-write-wins) and schedules a debounced push, so
  // definitions — and a delete-all — propagate to other devices.
  // The localStorage format itself is unchanged (array of
  // {id, title, steps, ...}).
  var CUSTOM_TS_KEY = "skillzify_custom_paths_ts";
  function saveCustomPaths(list) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list || [])); } catch (e) {}
    try { localStorage.setItem(CUSTOM_TS_KEY, String(Date.now())); } catch (e) {}
    try { if (window.SkillzifySync) window.SkillzifySync.markDirty("customPaths"); } catch (e) {}
  }

  function buildMyPathCard() {
    return '<div class="card" style="margin:16px 0">' +
      '<h2 class="section-title" style="font-size:1.2rem">✨ Build my path</h2>' +
      '<p class="hint">Tell the AI what you want to build — it picks the lessons and the closest project for you.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<input type="text" id="bmp-goal" placeholder="What do you want to build?" style="flex:1;min-width:220px" maxlength="200">' +
      '<button class="btn" id="bmp-btn">Build my path →</button></div>' +
      '<div id="bmp-result" style="margin-top:12px"></div></div>';
  }

  function customPathStepsHtml(steps) {
    return (steps || []).map(function (s) {
      var l = lessonById(s.lessonId);
      return '<li><a href="lesson.html?id=' + encodeURIComponent(s.lessonId) + '">' + esc(l ? l.title : s.lessonId) + "</a>" +
        (s.why ? ' <span class="hint">— ' + esc(s.why) + "</span>" : "") + "</li>";
    }).join("");
  }

  function customPathsHtml() {
    var saved = loadCustomPaths();
    if (!saved.length) return "";
    var items = saved.map(function (cp, i) {
      var enrolled = cp && cp.id ? isEnrolled({ id: cp.id }) : false;
      var enrollUi = !cp || !cp.id ? "" : enrolled
        ? '<span class="badge badge-enrolled">✓ Enrolled</span> <button class="linklike" data-leave="' + esc(cp.id) + '">Leave</button>'
        : '<button class="btn btn-sm" data-enroll="' + esc(cp.id) + '">🔓 Enroll</button>';
      return '<div class="card" style="margin:12px 0"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">' +
        "<h3 style='margin:0'>" + esc(cp.title || "Custom path") + "</h3>" +
        '<span style="white-space:nowrap">' + enrollUi +
        ' <button class="btn btn-sm btn-ghost" data-custom-del="' + i + '">Delete</button></span></div>' +
        '<ol class="proj-steps">' + customPathStepsHtml(cp.steps) + "</ol>" +
        (cp.project ? '<p class="hint">🎯 Suggested project: <strong>' + esc(cp.project) + "</strong></p>" : "") + "</div>";
    }).join("");
    return '<div id="custom-paths" style="margin:16px 0"><h2 class="section-title" style="font-size:1.2rem">💾 Your custom paths</h2>' +
      '<p class="hint">Enrolling in a custom path unlocks its lessons — even ones still locked in the lesson sequence.</p>' + items + "</div>";
  }

  function generatedPathHtml(d, validSteps) {
    var proj = (typeof d.project === "string" && d.project && d.project.toLowerCase() !== "none") ? d.project : "";
    return '<div class="card" style="margin-top:4px"><h3 style="margin:0 0 8px">🗺️ ' + esc(d.title || "Your custom path") + "</h3>" +
      '<ol class="proj-steps">' + customPathStepsHtml(validSteps) + "</ol>" +
      (proj ? '<p class="hint">🎯 Suggested project: <strong>' + esc(proj) + "</strong></p>" : "") +
      '<button class="btn btn-sm" id="bmp-save">💾 Save this path</button></div>';
  }

  function bindBuildMyPath() {
    var btn = $("bmp-btn"), input = $("bmp-goal"), out = $("bmp-result");
    if (!btn || !input || !out) return;
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); btn.click(); }
    });
    btn.addEventListener("click", function () {
      var goal = (input.value || "").trim();
      if (!goal) { out.innerHTML = '<p class="hint">Tell me what you want to build first.</p>'; return; }
      if (!window.SkillzifyAI || typeof window.SkillzifyAI.ask !== "function") {
        out.innerHTML = '<p class="hint">The AI is unavailable on this page right now.</p>'; return;
      }
      var L = allLessons();
      var code = "GOAL: " + goal + "\n\nLESSONS:\n" +
        L.map(function (l) { return l.id + " — " + l.title; }).join("\n") +
        "\n\nPROJECTS:\n" + projectNames().join("\n");
      btn.disabled = true;
      btn.textContent = "Building…";
      out.innerHTML = '<p class="hint">🤖 Building your path… this can take a few seconds while the AI wakes up.</p>';
      window.SkillzifyAI.ask({
        mode: "path", json: true, code: code,
        context: window.SkillzifyAI.buildContext({ note: "Building a custom path for: " + goal })
      }, function (err, res) {
        btn.disabled = false;
        btn.textContent = "Build my path →";
        if (err) {
          // Sign-in link only when signed out (ai.js capLink returns
          // "" for signed-in users at the 200/day cap).
          var bmpCap = (err && err.code === "DAILY_CAP" && window.SkillzifyAI && window.SkillzifyAI.capLink)
            ? window.SkillzifyAI.capLink() : "";
          out.innerHTML = '<p class="hint">⚠️ ' + esc(err.message || "Couldn't build a path.") + bmpCap + "</p>"; return;
        }
        var d = res && res.data;
        if (!d || !Array.isArray(d.steps)) {
          out.innerHTML = '<p class="hint">The AI couldn\'t build a path from your goal — try rephrasing it.</p>'; return;
        }
        // Title must be a string; fall back to "Custom path" (generatedPathHtml
        // has the same fallback, this just makes it explicit and safe).
        if (typeof d.title !== "string" || !d.title) d.title = "Custom path";
        // Validate every step against real lesson IDs; drop the rest.
        var valid = [];
        d.steps.forEach(function (s) {
          if (!s || typeof s.lessonId !== "string") return;
          if (lessonById(s.lessonId)) valid.push({ lessonId: s.lessonId, why: typeof s.why === "string" ? s.why : "" });
        });
        valid = valid.slice(0, 15); // server cap: at most 15 steps
        if (!valid.length) {
          // Steps came back but every one had an invalid lesson ID —
          // that's a matching failure, not an unusable goal.
          out.innerHTML = '<p class="hint">' + (d.steps.length
            ? "The AI returned steps I couldn't match to real lessons — try again."
            : "The AI couldn't build a path from your goal — try rephrasing it.") + "</p>"; return;
        }
        var proj = (typeof d.project === "string" && d.project && d.project.toLowerCase() !== "none") ? d.project : "";
        out.innerHTML = generatedPathHtml(d, valid);
        var saveBtn = $("bmp-save");
        if (saveBtn) saveBtn.addEventListener("click", function () {
          var saved = loadCustomPaths();
          saved.push({ id: "custom-" + Date.now() + "-" + Math.floor(Math.random() * 1000000), title: d.title || "Custom path", steps: valid, project: proj, at: Date.now() });
          saveCustomPaths(saved);
          renderList();
          if (S && typeof S.toast === "function") S.toast("Custom path saved ✓", "success");
          var sec = $("custom-paths");
          if (sec && sec.scrollIntoView) sec.scrollIntoView();
        });
      });
    });
  }

  /* ---------------- LIST VIEW ---------------- */
  function levelPills(paths) {
    var levels = ["Beginner", "Intermediate", "Advanced"];
    function pill(val, label, n) {
      return '<button class="pill' + (filter === val ? " active" : "") + '" data-level="' + val + '">' +
        esc(label) + ' <span class="pill-n">' + n + "</span></button>";
    }
    var html = pill("all", "All paths", paths.length);
    levels.forEach(function (lv) {
      var n = paths.filter(function (p) { return p.level === lv; }).length;
      if (n) html += pill(lv.toLowerCase(), lv, n);
    });
    return '<div class="pill-row" id="path-pills">' + html + "</div>";
  }

  function continueHero(paths) {
    var best = null, bestPct = -1;
    paths.forEach(function (p) {
      var st = pathStats(p);
      if (st.done > 0 && st.done < st.total && st.pct > bestPct) { best = p; bestPct = st.pct; }
    });
    if (!best) return "";
    var nx = nextStep(best);
    return '<div class="card continue-hero" style="--pc:' + pathColor(best) + '">' +
      '<div class="ch-left"><p class="hint" style="margin:0 0 6px">🔥 Continue learning</p>' +
      "<h3 style='margin:0 0 6px'>" + esc(best.title) + "</h3>" +
      '<p class="hint">Up next: <strong>' + esc(stepTitle(nx.step)) + "</strong> · " +
      pathStats(best).done + "/" + pathStats(best).total + " steps</p></div>" +
      '<div class="ch-actions"><a class="btn" href="' + stepHref(nx.step) + '">Resume →</a> ' +
      '<a class="btn btn-ghost" href="#path=' + best.id + '">View path</a></div></div>';
  }

  function pathCard(p) {
    var st = pathStats(p), c = pathColor(p);
    var nx = nextStep(p);
    var enrolled = isEnrolled(p);
    var cta = st.done >= st.total
      ? '<span class="badge badge-done">✓ Completed</span>'
      : '<a class="btn btn-sm" href="' + (nx ? stepHref(nx.step) : "#path=" + p.id) + '">' +
        (st.done > 0 ? "Continue →" : "Start →") + "</a>";
    var enrollUi = enrolled
      ? '<span class="badge badge-enrolled">✓ Enrolled</span>'
      : '<button class="btn btn-sm" data-enroll="' + p.id + '">🔓 Enroll</button>';
    var leaveUi = enrolled ? ' <button class="linklike" data-leave="' + p.id + '">Leave</button>' : "";
    return '<article class="card path-card2" style="--pc:' + c + '">' +
      '<div class="path-top"><div class="path-tile">' + p.icon + '</div>' +
      '<span class="badge path-level">' + esc(p.level || "") + "</span></div>" +
      "<h3>" + esc(p.title) + "</h3>" +
      '<p class="hint">' + esc(p.desc) + "</p>" +
      '<p class="path-meta">📖 ' + st.lessons + " lessons · 🏋️ " + st.exs + " exercises · " + fmtMins(st.mins) + "</p>" +
      '<div class="bar path-bar"><span style="width:' + st.pct + "%;background:" + c + '"></span></div>' +
      '<div class="path-foot"><span class="pct">' + st.done + "/" + st.total + " · " + st.pct + "%</span>" +
      '<span class="path-actions">' + enrollUi +
      '<a class="btn btn-sm btn-ghost" href="#path=' + p.id + '">Details</a> ' + cta + leaveUi + "</span></div></article>";
  }

  function renderList() {
    var host = $("paths-list");
    if (!host) return;
    var paths = (window.SkillzifyPaths || []).filter(function (p) {
      return filter === "all" || (p.level || "").toLowerCase() === filter;
    });
    var all = window.SkillzifyPaths || [];
    host.innerHTML = continueHero(all) + levelPills(all) + buildMyPathCard() + customPathsHtml() +
      '<div class="grid-3" id="paths-grid">' + paths.map(pathCard).join("") + "</div>";
    var pills = $("path-pills");
    if (pills) pills.querySelectorAll(".pill").forEach(function (b) {
      b.addEventListener("click", function () { filter = b.getAttribute("data-level"); renderList(); });
    });
    bindEnrollBtns(host, renderList);
    bindBuildMyPath();
    host.querySelectorAll("[data-custom-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        var saved = loadCustomPaths();
        saved.splice(parseInt(b.getAttribute("data-custom-del"), 10), 1);
        saveCustomPaths(saved);
        renderList();
      });
    });
  }

  /* ---------------- DETAIL VIEW ---------------- */
  function renderDetail(id) {
    var host = $("paths-list");
    if (!host) return;
    var p = null, all = window.SkillzifyPaths || [];
    for (var i = 0; i < all.length; i++) if (all[i].id === id) p = all[i];
    if (!p) { renderList(); return; }
    var st = pathStats(p), c = pathColor(p), nx = nextStep(p);

    var upNext = nx
      ? '<div class="card up-next" style="--pc:' + c + '"><span>⚡ <strong>Up next:</strong> ' +
        esc(stepKind(nx.step)) + " — " + esc(stepTitle(nx.step)) + "</span>" +
        '<a class="btn btn-sm" href="' + stepHref(nx.step) + '">Start →</a></div>'
      : '<div class="card up-next done" style="--pc:' + c + '"><span>🎉 <strong>Path complete!</strong> ' +
        "Every step conquered.</span></div>";

    var timeline = p.steps.map(function (s, i) {
      var done = stepDone(s);
      var isNext = nx && nx.index === i;
      var cls = done ? "done" : (isNext ? "current" : "todo");
      var dot = done ? "✓" : (isNext ? "▶" : (i + 1));
      return '<li class="tl-step ' + cls + '"><span class="tl-dot">' + dot + "</span>" +
        '<div class="tl-body"><a href="' + stepHref(s) + '">' + esc(stepTitle(s)) + "</a>" + lockBadge(s) +
        '<span class="hint">' + esc(stepKind(s)) + " · ~" + stepMins(s) + " min</span></div></li>";
    }).join("");

    var enrolled = isEnrolled(p), nLocked = lockedLessonCount(p);
    var enrollBar = enrolled
      ? '<div class="enroll-bar is-on"><span class="badge badge-enrolled">✓ You\'re enrolled</span>' +
        '<p class="hint">🔓 This path unlocks its lessons — even ones still locked in the lesson sequence. Progress counts everywhere.</p>' +
        '<button class="btn btn-sm btn-ghost" data-leave="' + p.id + '">Leave path</button></div>'
      : '<div class="enroll-bar"><button class="btn" data-enroll="' + p.id + '">🔓 Enroll in this path</button>' +
        '<p class="hint">' + (nLocked > 0
          ? "Enrolling instantly unlocks <strong>" + nLocked + " locked lesson" + (nLocked > 1 ? "s" : "") +
            "</strong> in this path — no need to finish the sequence first."
          : "Enrolling pins this path and opens its lessons wherever you are in the sequence.") + "</p></div>";

    host.innerHTML =
      '<button class="btn btn-sm btn-ghost" id="path-back">← All paths</button>' +
      '<div class="path-hero" style="--pc:' + c + '">' +
      '<div class="path-tile lg">' + p.icon + "</div>" +
      '<div><span class="badge path-level">' + esc(p.level || "") + "</span>" +
      '<h2 class="section-title" style="margin:8px 0">' + esc(p.title) + "</h2>" +
      "<p>" + esc(p.desc) + "</p>" +
      '<p class="hint">📖 ' + st.lessons + " lessons · 🏋️ " + st.exs + " exercises · " + fmtMins(st.mins) +
      " · " + st.done + "/" + st.total + " steps (" + st.pct + "%)</p>" +
      '<div class="bar path-bar"><span style="width:' + st.pct + "%;background:" + c + '"></span></div></div></div>' +
      enrollBar +
      upNext +
      '<div class="card"><h2 class="section-title" style="font-size:1.3rem">🗺️ Your route</h2>' +
      '<ol class="path-timeline">' + timeline + "</ol></div>";

    $("path-back").addEventListener("click", function () { location.hash = ""; });
    bindEnrollBtns(host, function () { renderDetail(id); });
  }

  /* ---------------- ROUTER ---------------- */
  function route() {
    // Backfill: a section or path finished before the +100/+150 bonuses
    // shipped still pays out once (flags in learn-core.js).
    try {
      var LC = window.SkillzifyLearnCore;
      if (LC) { if (LC.checkSectionBonuses) LC.checkSectionBonuses(); if (LC.checkPathBonuses) LC.checkPathBonuses(); }
    } catch (e) {}
    var m = (location.hash || "").match(/^#path=([\w-]+)/);
    if (m) renderDetail(m[1]); else renderList();
    window.scrollTo(0, 0);
  }

  document.addEventListener("DOMContentLoaded", function () {
    route();
    lastEnrollJson = enrollJson();
    lastCustomJson = customJson();
    window.addEventListener("hashchange", route);
  });
  // Live refresh when another device changes enrollments or custom-path
  // definitions (keeps scroll pos)
  var lastEnrollJson = "";
  function enrollJson() { try { return JSON.stringify(readEnrollMap()); } catch (e) { return ""; } }
  var lastCustomJson = "";
  function customJson() { try { return JSON.stringify(loadCustomPaths()); } catch (e) { return ""; } }
  window.addEventListener("skillzify-sync", function () {
    try {
      var cur = enrollJson(), curCustom = customJson();
      if (cur === lastEnrollJson && curCustom === lastCustomJson) return;
      lastEnrollJson = cur; lastCustomJson = curCustom;
      var y = window.scrollY || 0;
      route();
      window.scrollTo(0, y);
    } catch (e) {}
  });
  // Re-render when returning from a lesson/exercise (progress changed)
  window.addEventListener("pageshow", route);
})();
