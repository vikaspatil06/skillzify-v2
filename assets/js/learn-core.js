/* ============================================================
   Skillzify v2 — learn-core.js (shared learning engine)
   Single source of truth for lesson data, progress, XP and
   unlock logic. Loaded by learn.js (path overview), lesson.js
   (dedicated lesson page) and any page using window.SkillzifyLearn.
   Load order: lessons-index.js (catalog metadata) and paths-data.js
   must load BEFORE this file; lesson bodies arrive on demand from
   lessons-sec-<section>.js chunks (see the catalog note below).
   ============================================================ */
(function () {
  "use strict";

  var PROGRESS_KEY = "skillzify_progress";
  var XP_KEY = "skillzify_xp";


  /* ================= Lesson catalog =================
     Optimization #5 (13 Nov 2026): the catalog is SPLIT. Pages load
     lessons-index.js (metadata only: id/section/track/title, ~25 KB)
     before this file; LESSONS starts as metadata stubs in final
     catalog order. Full bodies (explain/takeaways/code/quiz/
     challenge) live in lessons-sec-<section>.js chunks and attach
     onto the SAME stub objects on demand via ensureSection() /
     ensureLesson() / ensureAllSections() — object identity is
     preserved, so every consumer holding LESSONS or a lesson
     reference sees the content appear in place. Consumers that need
     bodies (lesson page, review sessions, viva) await the ensure
     call before reading them; everything else (unlock chain,
     progress, mastery, passport, map, search) runs on metadata
     exactly as before. */
  var LESSONS = [];
  var _lessonByIdMap = {};
  (function buildCatalogStubs() {
    var idx = window.LESSON_INDEX || [];
    idx.forEach(function (m) {
      if (!m || !m.id) return;
      var stub = { id: m.id, section: m.section, track: m.track, title: m.title, _loaded: false };
      LESSONS.push(stub);
      _lessonByIdMap[m.id] = stub;
    });
  })();

  /* Quiz bank expansion (quiz-extra.js), applied when a section's
     content attaches — the exact merge the old monolith ran at load
     time. Only pages that load quiz-extra.js ever saw the extra
     questions, and attach-time merging preserves that (lesson and
     learn pages load it; dashboard review does not). Guarded per
     lesson so a re-attach can never double-append.
     Only 32 lessons reach 5 questions (the 32 with a 2-question base
     quiz); the other 218 stay at 3. The lesson page picks 3 at random. */
  function mergeQuizExtra(lesson) {
    if (lesson._qx) return;
    lesson._qx = true;
    try {
      var extra = (window.SkillzifyQuizExtra || {})[lesson.id];
      if (extra && extra.length && Array.isArray(lesson.quiz)) lesson.quiz = lesson.quiz.concat(extra);
    } catch (e) {}
  }

  /* Attach one section's chunk (window.SkillzifyLessonContent[id])
     onto the stubs. Returns true when the section is fully loaded. */
  var _attachedSections = {};
  function attachSectionContent(sectionId) {
    if (_attachedSections[sectionId]) return true;
    var chunk = null;
    try { chunk = (window.SkillzifyLessonContent || {})[sectionId]; } catch (e) {}
    if (!Array.isArray(chunk)) return false;
    chunk.forEach(function (full) {
      var stub = full && _lessonByIdMap[full.id];
      if (!stub) return;
      ["explain", "takeaways", "code", "quiz", "challenge"].forEach(function (k) {
        if (full[k] !== undefined) stub[k] = full[k];
      });
      stub._loaded = true;
      mergeQuizExtra(stub);
    });
    _attachedSections[sectionId] = true;
    return true;
  }

  var SECTION_CONTENT_VERSION = 1;
  var _sectionPromises = {};
  function ensureSection(sectionId) {
    if (!sectionId) return Promise.resolve(false);
    if (attachSectionContent(sectionId)) return Promise.resolve(true);
    if (_sectionPromises[sectionId]) return _sectionPromises[sectionId];
    _sectionPromises[sectionId] = new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = "assets/js/lessons-sec-" + sectionId + ".js?v=" + SECTION_CONTENT_VERSION;
      s.async = true;
      s.onload = function () { resolve(attachSectionContent(sectionId)); };
      s.onerror = function () { delete _sectionPromises[sectionId]; resolve(false); };
      (document.head || document.documentElement).appendChild(s);
    });
    return _sectionPromises[sectionId];
  }
  function ensureLesson(id) {
    var stub = _lessonByIdMap[id];
    if (!stub) return Promise.resolve(false);
    if (stub._loaded) return Promise.resolve(true);
    return ensureSection(stub.section);
  }
  function ensureAllSections() {
    var seen = {}, jobs = [];
    LESSONS.forEach(function (l) {
      if (!seen[l.section]) { seen[l.section] = 1; jobs.push(ensureSection(l.section)); }
    });
    return Promise.all(jobs).then(function (rs) { return rs.every(function (x) { return !!x; }); });
  }
  function sectionContentLoaded(sectionId) { return !!_attachedSections[sectionId]; }
  var TRACKS = [
    { id: "beginner", name: "Beginner", desc: "Zero to confident — syntax, variables, logic and loops.", icon: "🌱", needs: null },
    { id: "intermediate", name: "Intermediate", desc: "Functions, data structures, errors, OOP, recursion and files.", icon: "⚙️", needs: "beginner" },
    { id: "advanced", name: "Advanced", desc: "Pythonic mastery — generators, decorators, tooling and beyond.", icon: "🚀", needs: "intermediate" }
  ];

  /* The 7 journey sections (Vikas, 6 Nov 2026) — the learner-facing
     grouping. `track` stays on every lesson (harmless legacy field);
     sections are the display + unlock grouping. */
  var SECTIONS = [
    { id: "base-camp", name: "Base Camp", icon: "🌱", desc: "Zero to confident: syntax, variables, logic, loops and your first programs.", needs: null },
    { id: "tool-shed", name: "Tool Shed", icon: "🧱", desc: "The data tools: collections, files and formats you'll reach for daily.", needs: "base-camp" },
    { id: "object-castle", name: "Object Castle", icon: "🏯", desc: "Think in objects: classes, inheritance and Python's object protocol.", needs: "tool-shed" },
    { id: "algorithm-arena", name: "Algorithm Arena", icon: "🧠", desc: "Think like an engineer: complexity, data structures and interview patterns.", needs: "object-castle" },
    { id: "power-lab", name: "Power Lab", icon: "⚡", desc: "Pythonic mastery: decorators, generators, async, testing and tooling.", needs: "algorithm-arena" },
    { id: "data-lab", name: "Data Lab", icon: "📊", desc: "Turn data into insight: NumPy, pandas, visualisation and ML.", needs: "power-lab" },
    { id: "launch-pad", name: "Launch Pad", icon: "🚀", desc: "Ship real things: web apps, APIs, automation and deployment.", needs: "data-lab" }
  ];

  var LEVELS = [
    { xp: 0, name: "🌱 Novice" },
    { xp: 150, name: "🔍 Explorer" },
    { xp: 400, name: "💻 Coder" },
    { xp: 800, name: "🛠️ Builder" },
    { xp: 1400, name: "🐍 Pythonista" },
    { xp: 2200, name: "🎯 Solver" },
    { xp: 3200, name: "🧠 Algorithm Ace" },
    { xp: 4500, name: "📊 Data Wrangler" },
    { xp: 6500, name: "🚀 Full-Stack Builder" },
    { xp: 9000, name: "🏆 Python Master" },
    { xp: 11000, name: "👑 Grandmaster" }
  ];

  /* ================= Storage ================= */
  function getProgress() { return window.Skillzify.storeGet(PROGRESS_KEY, {}); }
  function saveProgress(p) { window.Skillzify.storeSet(PROGRESS_KEY, p); }
  function getXP() { return Number(window.Skillzify.storeGet(XP_KEY, 0)) || 0; }
  function addXP(n) {
    var xp = getXP() + (Number(n) || 0);
    window.Skillzify.storeSet(XP_KEY, xp);
    return xp;
  }
  function levelFor(xp) {
    var l = LEVELS[0];
    for (var i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) l = LEVELS[i];
    return l;
  }
  function nextLevel(xp) {
    for (var i = 0; i < LEVELS.length; i++) if (xp < LEVELS[i].xp) return LEVELS[i];
    return null;
  }

  /* ============ One-time completion bonuses ============
     Section completion +100 XP, path completion +150 XP. Each fires
     exactly once (flags in localStorage); re-doing a lesson or step
     never re-awards. Called from lesson completion (lesson.js) and as
     a backfill on the Learn / Paths pages (learn.js, paths.js), so a
     section or path finished before this shipped still pays out once.
     A path finished by an exercise solve on practice.html (which does
     not load the lesson catalog) pays out on the next Learn/Paths/
     lesson visit instead. */
  var SECTION_BONUS_KEY = "skillzify_section_bonus"; // {sectionId: true}
  var PATH_BONUS_KEY = "skillzify_path_bonus";       // {pathId: true}
  function bonusAwarded(key, id) {
    try { var m = window.Skillzify.storeGet(key, {}); if (!m || typeof m !== "object" || Array.isArray(m)) return false; return !!m[id]; } catch (e) { return false; }
  }
  function markBonusAwarded(key, id) {
    try { var m = window.Skillzify.storeGet(key, {}); if (!m || typeof m !== "object" || Array.isArray(m)) m = {}; m[id] = true; window.Skillzify.storeSet(key, m); } catch (e) {}
  }
  function awardBonus(n, label) {
    var xp = addXP(n);
    try { if (window.Skillzify && typeof window.Skillzify.toast === "function") window.Skillzify.toast(label + " +" + n + " XP", "success"); } catch (e) {}
    return xp;
  }
  function checkSectionBonuses() {
    var progress = getProgress();
    SECTIONS.forEach(function (sec) {
      var lessons = sectionLessons(sec.id);
      if (!lessons.length) return;
      if (!lessons.every(function (l) { return progress[l.id]; })) return;
      if (bonusAwarded(SECTION_BONUS_KEY, sec.id)) return;
      markBonusAwarded(SECTION_BONUS_KEY, sec.id);
      awardBonus(100, "🎓 " + sec.name + " section complete!");
    });
  }
  // One enrolled path's steps, all done? Built-in steps are
  // {t: "lesson"|"ex", id}; custom steps are {lessonId, why} (the
  // {t, id} shape is accepted too). A step with no identifiable
  // lesson/exercise id counts as not done — never pay on malformed data.
  function pathStepsDone(steps, progress, atts) {
    return steps.every(function (s) {
      if (!s || typeof s !== "object") return false;
      var lid = s.lessonId || (s.t === "lesson" && s.id) || null;
      if (lid) return !!progress[lid];
      if (s.t === "ex" && s.id) return !!(atts[s.id] && atts[s.id].solved);
      return false;
    });
  }
  // Enrolled path ids, from the enrollment map (object form
  // {id: {enrolled}} or legacy array form). Mirrors paths-data.js.
  function enrolledPathIds() {
    var ids = {};
    try {
      var v = window.Skillzify.storeGet("skillzify_enrolled_paths", null);
      if (Array.isArray(v)) v.forEach(function (id) { ids[id] = true; });
      else if (v && typeof v === "object") Object.keys(v).forEach(function (k) {
        if (v[k] && v[k].enrolled) ids[k] = true;
      });
    } catch (e) {}
    return ids;
  }
  function checkPathBonuses() {
    var paths = window.SkillzifyPaths || [];
    var progress = getProgress();
    var atts = {};
    try { atts = window.Skillzify.storeGet("skillzify_exercise_attempts", {}) || {}; } catch (e) {}
    paths.forEach(function (p) {
      if (!p.steps || !p.steps.length) return;
      if (!pathStepsDone(p.steps, progress, atts)) return;
      if (bonusAwarded(PATH_BONUS_KEY, p.id)) return;
      markBonusAwarded(PATH_BONUS_KEY, p.id);
      awardBonus(150, "🗺️ Path complete: " + p.title + "!");
    });
    // P1-03: custom ("Build my path") paths earn the same +150 bonus.
    // Definitions live in skillzify_custom_paths; only enrolled ones
    // pay out, with the same per-id flag in skillzify_path_bonus
    // (custom ids are `custom-<ts>-<rand>`, so they cannot collide
    // with built-in path ids).
    try {
      var enrolled = enrolledPathIds();
      var saved = window.Skillzify.storeGet("skillzify_custom_paths", []);
      if (Array.isArray(saved)) saved.forEach(function (cp) {
        if (!cp || typeof cp !== "object" || !cp.id || !Array.isArray(cp.steps) || !cp.steps.length) return;
        if (!enrolled[cp.id]) return;
        if (!pathStepsDone(cp.steps, progress, atts)) return;
        if (bonusAwarded(PATH_BONUS_KEY, cp.id)) return;
        markBonusAwarded(PATH_BONUS_KEY, cp.id);
        awardBonus(150, "🗺️ Path complete: " + (cp.title || "Custom path") + "!");
      });
    } catch (e) {}
  }

  /* ============ Section order ============
     The catalog ships in track order (b block, i block, a block); the
     7-section journey reorders it. Stable sort by section index so the
     sequential unlock chain follows the journey and within-section order
     stays the original catalog order. Lessons without a section (should
     not happen) sort last. */
  (function sortBySection() {
    var order = {};
    SECTIONS.forEach(function (s, i) { order[s.id] = i; });
    var decorated = LESSONS.map(function (l, i) { return { l: l, i: i }; });
    decorated.sort(function (a, b) {
      var sa = (order[a.l.section] != null ? order[a.l.section] : 99) - (order[b.l.section] != null ? order[b.l.section] : 99);
      return sa !== 0 ? sa : a.i - b.i;
    });
    for (var k = 0; k < decorated.length; k++) LESSONS[k] = decorated[k].l;
  })();

/* ================= Unlock logic ================= */
  function idxOf(id) { for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return i; return -1; }
  function isDone(id) { return !!getProgress()[id]; }
  function isUnlocked(gi) {
    if (gi < 0 || gi >= LESSONS.length) return false;
    if (gi <= 0) return true;
    if (isDone(LESSONS[gi - 1].id)) return true;
    // Placement: every lesson in a section BEFORE the placed one is open.
    // The test already proved that knowledge, so the learner can jump to
    // any of them freely. Nothing is marked done — progress, XP, section
    // bonuses and badges stay untouched; placement remains a pointer, not
    // progress. The placed section itself still unlocks sequentially from
    // its first lesson (the rule below), and sections after it are
    // unaffected.
    var placed = placedSection();
    if (placed) {
      var ids = SECTIONS.map(function (x) { return x.id; });
      var li = ids.indexOf(LESSONS[gi].section);
      var pi = ids.indexOf(placed);
      if (li !== -1 && pi !== -1 && li < pi) return true;
    }
    // The first lesson of an unlocked section is open. In the normal flow
    // this is already implied (the previous section is fully done, so the
    // previous lesson is done) — but a placement unlocks a section without
    // its predecessor, so the entry point needs this rule, or the placed
    // learner would see an open section whose first lesson is locked
    // (lesson.html enforces the same lock). The rest of the section still
    // unlocks sequentially, lesson by lesson.
    var sec = LESSONS[gi].section;
    if (sec) {
      var first = sectionLessons(sec)[0];
      if (first && first.id === LESSONS[gi].id && sectionUnlocked(sec)) return true;
    }
    // Enrolled learning paths act as keys: their lessons open even mid-chain
    return !!pathUnlockMap()[LESSONS[gi].id];
  }
  // lessonId -> pathId for lessons unlocked ONLY via an enrolled path
  function _computePathUnlockMap() {
    try {
      var P = window.SkillzifyPaths;
      if (!P) return {};
      if (typeof P.pathUnlockedLessons === "function") return P.pathUnlockedLessons();
      // Fallback: stale cached paths-data.js without the enrollment helpers —
      // compute the map directly from localStorage + the path array.
      var m = {};
      try {
        var v = JSON.parse(localStorage.getItem("skillzify_enrolled_paths") || "null");
        if (Array.isArray(v)) v.forEach(function (id) { m[id] = { enrolled: true, at: 0 }; });
        else if (v && typeof v === "object") Object.keys(v).forEach(function (k) {
          var e = v[k] || {};
          m[k] = { enrolled: !!e.enrolled, at: e.at || 0 };
        });
      } catch (e) {}
      var map = {};
      P.forEach(function (p) {
        if (!(m[p.id] && m[p.id].enrolled)) return;
        (p.steps || []).forEach(function (s) { if (s.t === "lesson" && s.id) map[s.id] = p.id; });
      });
      // Same for enrolled custom paths (localStorage-only definitions;
      // a synced enrollment with no local definition unlocks nothing).
      try {
        var saved = JSON.parse(localStorage.getItem("skillzify_custom_paths") || "[]");
        if (Array.isArray(saved)) saved.forEach(function (cp) {
          if (!cp || typeof cp !== "object" || !cp.id || !Array.isArray(cp.steps)) return;
          if (!(m[cp.id] && m[cp.id].enrolled)) return;
          cp.steps.forEach(function (s) {
            if (!s || typeof s !== "object") return;
            var lid = s.lessonId || (s.t === "lesson" && s.id) || null;
            if (lid) map[lid] = cp.id;
          });
        });
      } catch (e2) {}
      return map;
    } catch (e) { return {}; }
  }
  // P2-08: memoize the enrollment map per enrollment state. isUnlocked()
  // is called ~500x per Learn render; re-parsing the enrollment store on
  // every call was the cost. The fingerprint is the raw stored strings,
  // so any enroll/leave (or custom-path edit, or a cross-tab change)
  // yields a fresh map on the next call, while unchanged state reuses
  // the identical map object.
  var _pathUnlockCache = null, _pathUnlockCacheKey = null;
  function pathUnlockMap() {
    var fp = null;
    try { fp = (localStorage.getItem("skillzify_enrolled_paths") || "") + "|" + (localStorage.getItem("skillzify_custom_paths") || ""); } catch (e) {}
    if (_pathUnlockCache && _pathUnlockCacheKey === fp) return _pathUnlockCache;
    var map = _computePathUnlockMap();
    _pathUnlockCache = map; _pathUnlockCacheKey = fp;
    return map;
  }
  // true when this lesson is unlocked solely because of a path enrollment
  function isPathOnlyUnlocked(gi) {
    if (gi < 0 || gi >= LESSONS.length) return false;
    if (gi <= 0 || isDone(LESSONS[gi - 1].id)) return false;
    // P2-04: a lesson already open by placement or by the sequential
    // chain (incl. the first lesson of an unlocked section) is not
    // "path-only" — the path badge must not claim it.
    var placed = placedSection();
    if (placed) {
      var ids = SECTIONS.map(function (x) { return x.id; });
      var li = ids.indexOf(LESSONS[gi].section);
      var pi = ids.indexOf(placed);
      if (li !== -1 && pi !== -1 && li < pi) return false;
    }
    var sec = LESSONS[gi].section;
    if (sec) {
      var first = sectionLessons(sec)[0];
      if (first && first.id === LESSONS[gi].id && sectionUnlocked(sec)) return false;
    }
    return !!pathUnlockMap()[LESSONS[gi].id];
  }
  function trackLessons(trackId) { return LESSONS.filter(function (l) { return l.track === trackId; }); }
  function trackUnlocked(trackId) {
    var t = TRACKS.filter(function (x) { return x.id === trackId; })[0];
    if (!t || !t.needs) return true;
    return trackLessons(t.needs).every(function (l) { return isDone(l.id); });
  }
  function trackPct(trackId) {
    var ls = trackLessons(trackId), p = getProgress();
    var done = ls.filter(function (l) { return p[l.id]; }).length;
    return ls.length ? Math.round(done / ls.length * 100) : 0;
  }
  function sectionOf(id) { for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return LESSONS[i].section || null; return null; }
  function sectionLessons(sectionId) { return LESSONS.filter(function (l) { return l.section === sectionId; }); }
  /* The placement result, if any: {section, score, total, stages, date}
     (localStorage key shared with placement.js — learn.html does not load
     that module, so this reads the key directly). Validated against
     SECTIONS so a stale or foreign value can never unlock anything. */
  var PLACEMENT_KEY = "skillzify_placement";
  function placedSection() {
    try {
      var r = JSON.parse(localStorage.getItem(PLACEMENT_KEY) || "null");
      if (!r || typeof r.section !== "string") return null;
      return SECTIONS.some(function (x) { return x.id === r.section; }) ? r.section : null;
    } catch (e) { return null; }
  }
  function sectionUnlocked(sectionId) {
    var s = SECTIONS.filter(function (x) { return x.id === sectionId; })[0];
    if (!s) return false;
    if (!s.needs) return true;
    // Placement overrides the needs-chain: every section at or before
    // the placed one is open (spec §5). Sections after it still unlock
    // normally, by finishing the previous section.
    var placed = placedSection();
    if (placed) {
      var ids = SECTIONS.map(function (x) { return x.id; });
      if (ids.indexOf(sectionId) <= ids.indexOf(placed)) return true;
    }
    return sectionLessons(s.needs).every(function (l) { return isDone(l.id); });
  }
  function sectionPct(sectionId) {
    var ls = sectionLessons(sectionId), p = getProgress();
    var done = ls.filter(function (l) { return p[l.id]; }).length;
    return ls.length ? Math.round(done / ls.length * 100) : 0;
  }
  function currentIdx() {
    // Placement: a placed learner resumes at/after their placement — the
    // first undone, unlocked lesson in the placed-or-later sections. The
    // old scan returned Base Camp lesson 1 for every placed learner
    // (P1-01). When everything at/after the placement is done, fall
    // through to the global scan (earlier sections still undone).
    var placed = placedSection();
    if (placed) {
      var ids = SECTIONS.map(function (x) { return x.id; });
      var pi = ids.indexOf(placed);
      if (pi >= 0) {
        for (var i = 0; i < LESSONS.length; i++) {
          if (ids.indexOf(LESSONS[i].section) >= pi && isUnlocked(i) && !isDone(LESSONS[i].id)) return i;
        }
      }
    }
    for (var j = 0; j < LESSONS.length; j++) {
      if (isUnlocked(j) && !isDone(LESSONS[j].id)) return j;
    }
    return -1;
  }
  function nextLesson() {
    var i = currentIdx();
    return i >= 0 ? LESSONS[i] : null;
  }
  /* ================= Tiny Python highlighter ================= */
  function highlightPython(src) {
    var esc = window.Skillzify.esc;
    var re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(\d[\d_]*(?:\.\d+)?)\b|\b(import|from|def|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|class|try|except|finally|with|as|lambda|yield|raise|pass|break|continue|assert|del|global|nonlocal|self)\b|([A-Za-z_]\w*)(?=\s*\()/g;
    var out = "", last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      var tok = m[0];
      if (m[1]) out += '<span class="tok-c">' + esc(tok) + "</span>";
      else if (m[2]) out += '<span class="tok-s">' + esc(tok) + "</span>";
      else if (m[3]) out += '<span class="tok-n">' + esc(tok) + "</span>";
      else if (m[4]) out += '<span class="tok-k">' + esc(tok) + "</span>";
      else if (m[5]) out += '<span class="tok-f">' + esc(tok) + "</span>";
      else out += esc(tok);
      last = m.index + tok.length;
    }
    out += esc(src.slice(last));
    return out;
  }

  /* ================= DOM helpers ================= */
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function esc(s) { return window.Skillzify.esc(s); }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function copyCode(btn, code) {
    var done = function () {
      var old = btn.innerHTML;
      btn.innerHTML = "✓ Copied";
      setTimeout(function () { btn.innerHTML = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, function () { fallbackCopy(code); done(); });
    } else { fallbackCopy(code); done(); }
  }
  function fallbackCopy(code) {
    var ta = document.createElement("textarea");
    ta.value = code; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  function tryInCompiler(code) {
    try { localStorage.setItem("skillzify_compiler_code", code); } catch (e) {}
    location.href = "compiler.html";
  }

  /* ---------- lookup by id (new) ---------- */
  function lessonById(id) {
    for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return LESSONS[i];
    return null;
  }

  /* ---------- array shuffle (moved from lesson view) ---------- */
  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ================= Public API ================= */
  window.SkillzifyLearnCore = {
    LESSONS: LESSONS, TRACKS: TRACKS, LEVELS: LEVELS, SECTIONS: SECTIONS,
    totalLessons: LESSONS.length,
    esc: esc, el: el, reducedMotion: reducedMotion,
    highlight: highlightPython, shuffled: shuffled,
    copyCode: copyCode, tryInCompiler: tryInCompiler,
    getProgress: getProgress, saveProgress: saveProgress,
    getXP: getXP, addXP: addXP,
    levelFor: levelFor, nextLevel: nextLevel,
    checkSectionBonuses: checkSectionBonuses, checkPathBonuses: checkPathBonuses,
    idxOf: idxOf, lessonById: lessonById, trackLessons: trackLessons,
    isDone: isDone, isUnlocked: isUnlocked,
    isPathOnlyUnlocked: isPathOnlyUnlocked, pathUnlockMap: pathUnlockMap,
    trackUnlocked: trackUnlocked, trackPct: trackPct,
    sectionOf: sectionOf, sectionLessons: sectionLessons,
    placedSection: placedSection,
    sectionUnlocked: sectionUnlocked, sectionPct: sectionPct,
    currentIdx: currentIdx, nextLesson: nextLesson,
    isLessonDone: function (id) { return isDone(id); },
    lessonIndex: function (id) { return idxOf(id); },
    isLessonUnlocked: function (id) { var gi = idxOf(id); return gi >= 0 && isUnlocked(gi); },
    isLessonPathUnlocked: function (id) { var gi = idxOf(id); return gi >= 0 && isPathOnlyUnlocked(gi); },
    /* Split-catalog content loading (optimization #5): bodies arrive
       per section on demand; metadata consumers never need these. */
    ensureSection: ensureSection, ensureLesson: ensureLesson,
    ensureAllSections: ensureAllSections, sectionContentLoaded: sectionContentLoaded
  };
})();
