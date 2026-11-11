/* ============================================================
   Skillzify Concept Map (System 4 of 4) — map.js
   One picture of the whole journey: 7 sections as a connected
   path, each expandable to its lessons, every node coloured by
   the learner's real state. Pure view over learn-core.js +
   mastery.js — no new data, nothing to sync, no learn-core
   behaviour changed. Plain DOM nodes + one SVG layer for edges;
   no Mermaid, no graph library (see concept-map-spec.md).
   Exposes window.SkillzifyMap: buildGraph, render, centreOnCurrent,
   expand, collapse, applySearch, openLesson, initFromQuery,
   firstWeakOrRusty, stats, refresh.
   ------------------------------------------------------------
   State rules (spec §3–4):
   - done    ✅  lesson in progress map.
   - current ▶️  first undone, unlocked lesson (LC.currentIdx()).
   - locked  🔒  previous lesson not done (LC.isUnlocked false).
   - weak    ⚠️  a DONE lesson in a section whose mastery band is
                 "Starting out" / "Building". Mastery is per-section
                 (and per-topic); the catalog carries no per-lesson
                 topic, so the section band is the honest signal.
   - rusty   🍂  a DONE lesson untouched 21+ days (RUST_DAYS):
                 last touch = max(doneAt, review updatedAt).
                 Rusty beats weak. A done lesson with no timestamp
                 at all (pre-passport, doneAt 0/absent) is NOT rusty
                 — unknown is not stale.
   - Cross-links: ~40 hand-authored edges (CROSS_LINKS). An edge
     renders only when both endpoints are visible: intra-section
     edges at lesson level, cross-section edges at section level
     (between the two sections). An edge naming a renamed/missing
     lesson id is skipped and logged — never breaks the render.
   - Live re-render: while the map is open it listens for `storage`
     events (another tab completing a lesson) and `skillzify-sync`
     (a cross-device sync pull) and re-renders the current view in
     place, preserving expanded section and search.
   - Deep links: ?section=<id> and ?lesson=<id> (unknown ids and
     locked lessons fall back to the section view, never a broken
     render). "Show on map" links on Learn and Dashboard land here.
   - Stats header: overall %, XP + level, current streak, sections
     completed — all derived from the same sources as Dashboard /
     Profile, so the numbers agree across surfaces.
   - Quick review: weak/rusty nodes carry a "Review →" tag (the node
     itself opens the lesson), and "Review weak spots" jumps straight
     to the first weak/rusty lesson in journey order.
   ============================================================ */
(function () {
  "use strict";

  var RUST_DAYS = 21;
  var DAY_MS = 86400000;

  /* Curated cross-links (~40, spec §3). Verified against the
     catalog at build time by buildGraph(); see skipped[]. */
  var CROSS_LINKS = [
    /* --- within-section (drawn at lesson level) --- */
    { from: "b5", to: "b20", label: "uses" },   /* loops -> nested loops */
    { from: "b10", to: "b22", label: "uses" },  /* functions -> arguments */
    { from: "b6", to: "b39", label: "uses" },   /* lists -> comprehension */
    { from: "b7", to: "b38", label: "uses" },   /* dicts -> loops over dicts */
    { from: "i4", to: "i25", label: "uses" },   /* OOP basics -> inheritance */
    { from: "i25", to: "i27", label: "uses" },  /* inheritance -> dunder */
    { from: "i5", to: "i49", label: "uses" },   /* recursion -> memoization */
    { from: "i49", to: "i63", label: "uses" },  /* memoization -> DP Fibonacci */
    { from: "i51", to: "i52", label: "uses" },  /* bubble sort -> merge sort */
    { from: "i55", to: "i56", label: "uses" },  /* trees -> traversals */
    { from: "i59", to: "i60", label: "uses" },  /* graphs -> BFS */
    { from: "i60", to: "i62", label: "uses" },  /* BFS -> Dijkstra */
    { from: "a3", to: "a11", label: "uses" },   /* decorators -> decorators w/ args */
    { from: "a2", to: "a16", label: "uses" },   /* generators -> send/coroutines */
    { from: "a49", to: "a51", label: "uses" },  /* NumPy -> pandas */
    /* --- cross-section (drawn at section level) --- */
    { from: "b10", to: "i5", label: "uses" },   /* functions -> recursion */
    { from: "b5", to: "i51", label: "uses" },   /* loops -> sorting */
    { from: "i75", to: "i81", label: "uses" },  /* collections -> data-lab intro */
    { from: "i23", to: "a27", label: "uses" },  /* JSON -> talking to APIs */
    { from: "a13", to: "a86", label: "uses" },  /* asyncio -> asyncio scraping */
    /* --- amplification (Part B1): 20 more, same rules --- */
    /* within-section */
    { from: "b2", to: "b18", label: "uses" },   /* variables -> type conversion & input() */
    { from: "b3", to: "b13", label: "uses" },   /* strings -> slicing & indexing */
    { from: "b10", to: "i1", label: "uses" },   /* functions -> return values */
    { from: "i2", to: "i7", label: "uses" },    /* collections -> list comprehensions */
    { from: "i6", to: "i22", label: "uses" },   /* file handling -> CSV files */
    { from: "i11", to: "i86", label: "uses" },  /* modules & imports -> reusable modules */
    { from: "i10", to: "i28", label: "uses" },  /* OOP basics -> class vs instance */
    { from: "i25", to: "a31", label: "uses" },  /* inheritance -> composition over inheritance */
    { from: "i17", to: "i54", label: "uses" },  /* sorting with key -> sorted()/sort() deep dive */
    { from: "i55", to: "i57", label: "uses" },  /* trees -> binary search trees */
    { from: "a3", to: "a38", label: "uses" },   /* decorators -> timer & cache decorators */
    { from: "a51", to: "a53", label: "uses" },  /* pandas -> GroupBy & aggregation */
    { from: "a64", to: "a67", label: "uses" },  /* Flask first app -> REST APIs with Flask */
    /* cross-section */
    { from: "b6", to: "b14", label: "uses" },   /* lists -> list methods in depth */
    { from: "b7", to: "b40", label: "uses" },   /* dicts -> dicts in practice */
    { from: "i7", to: "a1", label: "uses" },    /* list comprehensions -> comprehensions & lambdas */
    { from: "i23", to: "i82", label: "uses" },  /* JSON -> JSON APIs */
    { from: "i22", to: "i81", label: "uses" },  /* CSV files -> CSV in depth */
    { from: "b30", to: "i35", label: "uses" },  /* to-do capstone -> file organizer capstone */
    { from: "i49", to: "a19", label: "uses" }   /* memoization -> functools lru_cache */
  ];

  var level = "sections";      /* "sections" | "lessons" */
  var focusSection = null;     /* expanded section at lesson level */
  var query = "";
  var wired = false;

  function LC() { return window.SkillzifyLearnCore || null; }
  function M() { return window.SkillzifyMastery || null; }
  function esc(s) { var L = LC(); return L ? L.esc(s) : String(s == null ? "" : s); }
  function storeGet(k, fb) {
    try { var v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); }
    catch (e) { return fb; }
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function bandClass(band) {
    if (!band) return "";
    if (band === "Mastered") return "cmap-band-mastered";
    if (band === "Solid") return "cmap-band-solid";
    if (band === "Building") return "cmap-band-building";
    if (band === "Starting out") return "cmap-band-starting";
    return "";
  }

  /* Last touch of a lesson: max(doneAt, review updatedAt), 0 unknown. */
  function lastTouch(id) {
    var doneAt = storeGet("skillzify_lesson_done_at", {}) || {};
    var rev = storeGet("skillzify_review", {}) || {};
    var t = num(doneAt[id]);
    var r = rev[id];
    if (r && typeof r === "object" && num(r.updatedAt) > t) t = num(r.updatedAt);
    return t;
  }
  function isRusty(id) {
    var t = lastTouch(id);
    if (!t) return false;
    var rustDays = (M() && M().RUST_DAYS) || RUST_DAYS;
    return (Date.now() - t) > rustDays * DAY_MS;
  }
  /* Section mastery band, when mastery.js loaded; null otherwise. */
  function sectionBandMap() {
    var out = {};
    try {
      var m = M();
      if (m && typeof m.sectionMastery === "function") {
        m.sectionMastery().forEach(function (r) { out[r.section] = r.band || null; });
      }
    } catch (e) {}
    return out;
  }

  /* localStorage keys whose change means the map's picture is stale.
     A `storage` event with any other key (theme, accent, …) is ignored. */
  var LIVE_KEYS = {
    "skillzify_progress": true, "skillzify_lesson_done_at": true,
    "skillzify_review": true, "skillzify_placement": true,
    "skillzify_xp": true, "skillzify_streak": true,
    "skillzify_exercise_attempts": true
  };

  /* Current streak, from the same source as the Dashboard:
     SkillzifyActivity.streak().current when activity.js loaded, else
     the raw counter with the same lapse rule (last activity neither
     today nor yesterday -> 0). */
  function streakCurrent() {
    try {
      var A = window.SkillzifyActivity;
      if (A && typeof A.streak === "function") {
        var st = A.streak();
        return (st && st.current) || 0;
      }
    } catch (e) {}
    try {
      var raw = storeGet("skillzify_streak", { last: null, count: 0 }) || {};
      var last = raw.last ? new Date(raw.last) : null;
      if (!last || isNaN(last.getTime())) return 0;
      var iso = function (d) { var m = d.getMonth() + 1, dy = d.getDate(); return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (dy < 10 ? "0" + dy : dy); };
      var lastIso = iso(last), today = iso(new Date()), yest = iso(new Date(Date.now() - 864e5));
      return (lastIso === today || lastIso === yest) ? (raw.count || 0) : 0;
    } catch (e) { return 0; }
  }

  /* Stats header values, derived from the same sources as the
     Dashboard (progress + XP/level from learn-core, streak from
     Activity) so the numbers agree across surfaces for the same
     learner. No new stored data. */
  function statsData(graph) {
    graph = graph || buildGraph();
    var L = LC(), done = 0, total = 0;
    graph.sections.forEach(function (s) { done += s.done; total += s.total; });
    var xp = 0, levelName = "";
    try {
      if (L) {
        xp = L.getXP();
        var lv = L.levelFor(xp);
        levelName = lv ? lv.name : "";
      }
    } catch (e) {}
    var sectionsDone = graph.sections.filter(function (s) { return s.total > 0 && s.done >= s.total; }).length;
    return {
      done: done, total: total, pct: total ? Math.round(done / total * 100) : 0,
      xp: xp, level: levelName, streak: streakCurrent(),
      sectionsDone: sectionsDone, sectionsTotal: graph.sections.length
    };
  }
  function statsHtml(graph) {
    var s = statsData(graph);
    return '<div class="cmap-stats" role="status" aria-label="Your progress summary">' +
      '<span class="cmap-stat"><span class="cmap-stat-val" id="cmap-stat-pct">' + s.pct + '%</span><span class="cmap-stat-lbl">complete · ' + s.done + '/' + s.total + ' lessons</span></span>' +
      '<span class="cmap-stat"><span class="cmap-stat-val" id="cmap-stat-xp">' + s.xp.toLocaleString() + ' XP</span><span class="cmap-stat-lbl" id="cmap-stat-level">' + esc(s.level) + '</span></span>' +
      '<span class="cmap-stat"><span class="cmap-stat-val" id="cmap-stat-streak">🔥 ' + s.streak + '</span><span class="cmap-stat-lbl">day streak</span></span>' +
      '<span class="cmap-stat"><span class="cmap-stat-val" id="cmap-stat-sections">' + s.sectionsDone + '/' + s.sectionsTotal + '</span><span class="cmap-stat-lbl">sections complete</span></span></div>';
  }

  /* First weak/rusty lesson in journey order (sections in order,
     lessons in catalog order) — the quick-review jump target. */
  function firstWeakOrRusty() {
    var graph = buildGraph();
    for (var i = 0; i < graph.sections.length; i++) {
      var lsns = graph.lessons[graph.sections[i].id] || [];
      for (var j = 0; j < lsns.length; j++) {
        if (lsns[j].state === "weak" || lsns[j].state === "rusty")
          return { lessonId: lsns[j].id, sectionId: lsns[j].section, state: lsns[j].state, title: lsns[j].title };
      }
    }
    return null;
  }

  /* ---------- graph ---------- */
  function lessonStateFor(lesson, gi, curIdx, bands) {
    var L = LC();
    var done = L.isDone(lesson.id);
    var unlocked = L.isUnlocked(gi);
    if (!unlocked && !done) return { state: "locked", band: null, rusty: false, weak: false };
    if (!done && gi === curIdx) return { state: "current", band: null, rusty: false, weak: false };
    if (done) {
      var band = bands[lesson.section] || null;
      var rusty = isRusty(lesson.id);
      if (rusty) return { state: "rusty", band: band, rusty: true, weak: false };
      var weak = band === "Starting out" || band === "Building";
      return { state: weak ? "weak" : "done", band: band, rusty: false, weak: weak };
    }
    return { state: "open", band: null, rusty: false, weak: false };
  }

  function buildGraph() {
    var L = LC();
    if (!L) return { sections: [], lessons: {}, edges: [], skipped: [], focusSection: null, current: null };
    var bands = sectionBandMap();
    var curIdx = (typeof L.currentIdx === "function") ? L.currentIdx() : -1;
    var curLesson = curIdx >= 0 ? L.LESSONS[curIdx] : null;
    var placed = (typeof L.placedSection === "function") ? L.placedSection() : null;
    var sections = L.SECTIONS.map(function (s) {
      var ls = L.sectionLessons(s.id);
      var done = ls.filter(function (l) { return L.isDone(l.id); }).length;
      var unlocked = L.sectionUnlocked(s.id);
      var needsSec = s.needs ? L.SECTIONS.filter(function (x) { return x.id === s.needs; })[0] : null;
      return {
        id: s.id, name: s.name, icon: s.icon || "", desc: s.desc || "",
        needs: s.needs, needsName: needsSec ? needsSec.name : null,
        total: ls.length, done: done,
        pct: ls.length ? Math.round(done / ls.length * 100) : 0,
        band: bands[s.id] || null,
        unlocked: unlocked,
        current: !!(curLesson && curLesson.section === s.id)
      };
    });
    var lessons = {};
    L.SECTIONS.forEach(function (s) {
      lessons[s.id] = L.sectionLessons(s.id).map(function (l, i) {
        var gi = L.idxOf(l.id);
        var st = lessonStateFor(l, gi, curIdx, bands);
        return {
          id: l.id, title: l.title, section: l.section,
          index: i + 1, globalIndex: gi,
          state: st.state, band: st.band, rusty: st.rusty, weak: st.weak
        };
      });
    });
    /* Cross-links: keep only edges whose endpoints exist. */
    var byId = {};
    L.LESSONS.forEach(function (l) { byId[l.id] = l; });
    var edges = [], skipped = [];
    CROSS_LINKS.forEach(function (e) {
      var a = byId[e.from], b = byId[e.to];
      if (!a || !b) {
        skipped.push({ from: e.from, to: e.to, missing: !a ? e.from : e.to });
        try { console.warn("[concept-map] cross-link skipped, unknown lesson id:", !a ? e.from : e.to); } catch (err) {}
        return;
      }
      edges.push({ from: e.from, to: e.to, label: e.label || "uses",
                   intra: a.section === b.section, fromSection: a.section, toSection: b.section });
    });
    return {
      sections: sections, lessons: lessons, edges: edges, skipped: skipped,
      focusSection: placed,
      current: curLesson ? { lessonId: curLesson.id, sectionId: curLesson.section } : null
    };
  }

  /* ---------- render ---------- */
  function stateIcon(st) {
    return st === "done" ? "✅" : st === "current" ? "▶️" : st === "locked" ? "🔒" :
           st === "weak" ? "⚠️" : st === "rusty" ? "🍂" : "○";
  }
  function stateLabel(st) {
    return st === "done" ? "completed" : st === "current" ? "current" :
           st === "locked" ? "locked" : st === "weak" ? "weak — revisit" :
           st === "rusty" ? "rusty — untouched 21+ days" : "open";
  }
  function dimmed(title) {
    if (!query) return false;
    return String(title || "").toLowerCase().indexOf(query.toLowerCase()) < 0;
  }

  function legendHtml() {
    return '<div class="cmap-legend" role="note" aria-label="Map legend">' +
      '<span><i class="cmap-dot cmap-state-done"></i>Done</span>' +
      '<span><i class="cmap-dot cmap-state-current"></i>Current</span>' +
      '<span><i class="cmap-dot cmap-state-open"></i>Open</span>' +
      '<span><i class="cmap-dot cmap-state-locked"></i>Locked</span>' +
      '<span><i class="cmap-dot cmap-state-weak"></i>Weak</span>' +
      '<span><i class="cmap-dot cmap-state-rusty"></i>Rusty</span>' +
      '<span><i class="cmap-edge-sample"></i>uses</span></div>';
  }
  function toolbarHtml() {
    var weak = firstWeakOrRusty();
    return '<div class="cmap-toolbar">' +
      '<input id="cmap-search" class="cmap-search" type="search" placeholder="Search the map…" aria-label="Search map nodes" autocomplete="off" value="' + esc(query) + '">' +
      '<button type="button" class="btn btn-sm cmap-btn" id="cmap-centre">◎ Centre on me</button>' +
      '<button type="button" class="btn btn-sm cmap-btn" id="cmap-review-weak"' + (weak ? "" : " disabled") +
        ' title="' + (weak ? "Jump to your first weak or rusty lesson: " + esc(weak.title) : "No weak or rusty lessons right now") + '">🍂 Review weak spots</button>' +
      '</div>';
  }

  function sectionNodeHtml(sec, graph) {
    var cls = "cmap-secnode cmap-state-" + (sec.unlocked ? (sec.current ? "current" : sec.pct === 100 ? "done" : "open") : "locked");
    if (sec.band) cls += " " + bandClass(sec.band);
    if (graph.focusSection === sec.id) cls += " cmap-focus";
    if (dimmed(sec.name)) cls += " cmap-dim";
    var inner = '<span class="cmap-sec-ico">' + esc(sec.icon) + '</span>' +
      '<span class="cmap-sec-name">' + esc(sec.name) + '</span>' +
      '<span class="cmap-sec-meta">' + sec.done + '/' + sec.total + ' lessons · ' + sec.pct + '%</span>' +
      (sec.band ? '<span class="cmap-sec-band">' + esc(sec.band) + '</span>' : "") +
      (sec.unlocked ? "" : '<span class="cmap-sec-lock">🔒 Finish ' + esc(sec.needsName || "the previous section") + ' to unlock</span>');
    if (!sec.unlocked) {
      return '<button type="button" class="' + cls + '" data-section="' + esc(sec.id) + '" data-title="' + esc(sec.name) + '" disabled aria-label="' + esc(sec.name) + ' (locked)">' + inner + '</button>';
    }
    return '<button type="button" class="' + cls + '" data-section="' + esc(sec.id) + '" data-title="' + esc(sec.name) + '" aria-label="' + esc(sec.name) + ', ' + sec.done + ' of ' + sec.total + ' lessons done">' + inner + '</button>';
  }

  function lessonNodeHtml(lsn) {
    var cls = "cmap-lessonnode cmap-state-" + lsn.state;
    if (lsn.band) cls += " " + bandClass(lsn.band);
    if (dimmed(lsn.title)) cls += " cmap-dim";
    var inner = '<span class="cmap-lesson-ico">' + stateIcon(lsn.state) + '</span>' +
      '<span class="cmap-lesson-num">' + lsn.index + '</span>' +
      '<span class="cmap-lesson-title">' + esc(lsn.title) + '</span>';
    /* Weak/rusty nodes carry a visible "Review →" tag. The node itself
       is already the lesson link, so the tag is the affordance, not a
       nested control (a button inside the link would be invalid HTML)
       — clicking the node opens the lesson for review, and the
       lesson's own Next continues through the journey order, so the
       learner can work through the weak set from there. */
    if (lsn.state === "weak" || lsn.state === "rusty") inner += '<span class="cmap-lesson-review">Review →</span>';
    var attrs = 'data-lesson="' + esc(lsn.id) + '" data-title="' + esc(lsn.title) + '" data-section="' + esc(lsn.section) + '"';
    if (lsn.state === "locked") {
      return '<button type="button" class="' + cls + '" ' + attrs + ' disabled aria-label="Lesson ' + lsn.index + ': ' + esc(lsn.title) + ' (locked)">' + inner + '</button>';
    }
    return '<a class="' + cls + '" ' + attrs + ' href="lesson.html?id=' + encodeURIComponent(lsn.id) + '" aria-label="Lesson ' + lsn.index + ': ' + esc(lsn.title) + ' (' + stateLabel(lsn.state) + ')">' + inner + '</a>';
  }

  function edgeSvgHtml(edges, kind) {
    /* Placeholder straight paths; drawEdges() replaces d with real
       curves once nodes are laid out (no layout in the Node harness,
       so the placeholders keep the SVG queryable there). */
    var out = edges.map(function (e) {
      var key = kind === "cross" ? e.fromSection + "->" + e.toSection : e.from + "->" + e.to;
      return '<path class="cmap-edge-' + kind + '" data-from="' + esc(e.from) + '" data-to="' + esc(e.to) +
        '" data-edge="' + esc(key) + '" d="M0 0 L0 0"><title>' + esc(e.from + " uses " + e.to) + '</title></path>';
    }).join("");
    return '<svg class="cmap-edges" aria-hidden="true">' + out + '</svg>';
  }

  function renderSections(graph) {
    var nodes = graph.sections.map(function (s) { return sectionNodeHtml(s, graph); }).join("");
    /* Cross-section links, drawn between section nodes: dedupe by
       section pair (two lessons can link the same two sections). */
    var seen = {}, cross = [];
    graph.edges.forEach(function (e) {
      if (e.intra) return;
      var key = e.fromSection + "->" + e.toSection;
      if (seen[key]) return;
      seen[key] = true;
      cross.push({ from: e.fromSection, to: e.toSection, label: "uses", fromSection: e.fromSection, toSection: e.toSection });
    });
    return '<div class="cmap-secpath" id="cmap-canvas">' +
      edgeSvgHtml(cross, "cross") + nodes + '</div>' +
      '<p class="hint cmap-hint">Click a section to see its lessons. Dashed curves show concept links between sections.</p>';
  }
  function renderLessons(graph, sectionId) {
    var sec = graph.sections.filter(function (s) { return s.id === sectionId; })[0];
    if (!sec) return renderSections(graph);
    var lsns = graph.lessons[sectionId] || [];
    var nodes = lsns.map(function (l) { return lessonNodeHtml(l); }).join("");
    /* Sequential edges: lesson N -> N+1 (all pairs, always visible). */
    var seq = [];
    for (var i = 0; i + 1 < lsns.length; i++) seq.push({ from: lsns[i].id, to: lsns[i + 1].id, label: "", fromSection: sectionId, toSection: sectionId });
    var cross = graph.edges.filter(function (e) { return e.intra && e.fromSection === sectionId; });
    var crumb = '<div class="cmap-crumb"><button type="button" class="btn btn-sm btn-ghost cmap-btn" id="cmap-back">← All sections</button>' +
      '<span><strong>' + esc(sec.icon) + ' ' + esc(sec.name) + '</strong> · ' + sec.done + '/' + sec.total + ' lessons · ' + sec.pct + '%</span></div>';
    return crumb +
      '<div class="cmap-lessonpath" id="cmap-canvas">' +
      edgeSvgHtml(seq, "seq") + edgeSvgHtml(cross, "cross") + nodes + '</div>' +
      '<p class="hint cmap-hint">Click a lesson to open it. Solid lines follow the journey; dashed “uses” curves link related lessons.</p>';
  }

  function render(lvl, focus) {
    var L = LC();
    var root = document.getElementById("map-root");
    if (!root) return null;
    if (lvl) level = lvl;
    if (focus !== undefined) focusSection = focus;
    var graph = buildGraph();
    if (!L) { root.innerHTML = '<div class="dash-card"><p class="hint">The concept map needs the lesson catalog — it did not load. Try reloading the page.</p></div>'; return graph; }
    var html = statsHtml(graph) + toolbarHtml() + legendHtml();
    if (level === "lessons" && focusSection) html += renderLessons(graph, focusSection);
    else { level = "sections"; html += renderSections(graph); }
    root.innerHTML = html;
    wire(root);
    scheduleDraw();
    return graph;
  }

  /* ---------- edges: real curves from laid-out node centres ---------- */
  function nodeCentre(node, canvasRect) {
    try {
      var r = node.getBoundingClientRect();
      return { x: r.left + r.width / 2 - canvasRect.left, y: r.top + r.height / 2 - canvasRect.top,
               top: r.top - canvasRect.top, bottom: r.bottom - canvasRect.top,
               left: r.left - canvasRect.left, right: r.right - canvasRect.left };
    } catch (e) { return null; }
  }
  /* "uses" curve at lesson level: from the right edge of A, out to a
     lane right of the node column, down, and back into the right edge
     of B. Pure (x/y in canvas pixels) so the harness can unit-test
     it: no point of the path ever goes left of the nodes' right
     edges, so it can never cut through a card. */
  function crossLaneD(a, b, laneX) {
    return "M" + a.right + " " + a.y + " C" + laneX + " " + a.y + "," +
      laneX + " " + b.y + "," + b.right + " " + b.y;
  }
  function drawEdges() {
    var canvas = document.getElementById("cmap-canvas");
    if (!canvas) return;
    /* Lesson level renders TWO edge layers (sequential + "uses") — the
       old code only drew the first SVG, so the "uses" curves stayed at
       M0 0 L0 0 (invisible). Collect paths from every layer. */
    var paths = [];
    var svgs = canvas.querySelectorAll ? canvas.querySelectorAll(".cmap-edges") : [];
    for (var s = 0; s < svgs.length; s++) {
      var ps = svgs[s].querySelectorAll ? svgs[s].querySelectorAll("path") : [];
      for (var j = 0; j < ps.length; j++) paths.push(ps[j]);
    }
    if (!paths.length) return;
    var canvasRect;
    try { canvasRect = canvas.getBoundingClientRect(); } catch (e) { return; }
    if (!canvasRect || !canvasRect.width) return; /* no layout (harness) */
    var horizontal = level === "sections" && window.innerWidth >= 720;
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      var from = canvas.querySelector('[data-lesson="' + p.getAttribute("data-from") + '"]') ||
                 canvas.querySelector('[data-section="' + p.getAttribute("data-from") + '"]');
      var to = canvas.querySelector('[data-lesson="' + p.getAttribute("data-to") + '"]') ||
               canvas.querySelector('[data-section="' + p.getAttribute("data-to") + '"]');
      if (!from || !to) continue;
      var a = nodeCentre(from, canvasRect), b = nodeCentre(to, canvasRect);
      if (!a || !b) continue;
      var mx, my;
      /* Lesson-level "uses" curves run in a lane OUTSIDE the node
         column (right edge -> lane -> right edge). A long-span link
         drawn centre-to-centre strikes straight through every card
         between its endpoints — the yellow line in the 11 Nov
         screenshots. The lane sits just right of the column; on
         narrow screens it clamps to the canvas edge. */
      if (level === "lessons" && p.classList && p.classList.contains("cmap-edge-cross")) {
        var lane = Math.min(canvasRect.width - 6, Math.max(a.right, b.right) + 28);
        p.setAttribute("d", crossLaneD(a, b, lane));
      } else if (level === "sections" && p.classList && p.classList.contains("cmap-edge-cross")) {
        /* Section-level "uses" curves arc BELOW the nodes (a straight
           centre-to-centre line would strike through the card text). */
        var dip = 36;
        p.setAttribute("d", "M" + a.x + " " + a.bottom + " C" + a.x + " " + (a.bottom + dip) + "," + b.x + " " + (b.bottom + dip) + "," + b.x + " " + b.bottom);
      } else if (horizontal) { mx = (a.x + b.x) / 2; my = (a.y + b.y) / 2; p.setAttribute("d", "M" + a.x + " " + a.y + " C" + mx + " " + a.y + "," + mx + " " + b.y + "," + b.x + " " + b.y); }
      else { mx = (a.x + b.x) / 2; my = (a.y + b.y) / 2; p.setAttribute("d", "M" + a.x + " " + a.y + " C" + a.x + " " + my + "," + b.x + " " + my + "," + b.x + " " + b.y); }
    }
  }
  function scheduleDraw() {
    try {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(drawEdges);
      else setTimeout(drawEdges, 0);
    } catch (e) {}
  }

  /* ---------- search ---------- */
  function applySearch(q) {
    query = String(q == null ? "" : q);
    /* Re-render so dimming is in the HTML (and survives re-renders);
       the live input handler refocuses the search box afterwards. */
    render();
    var input = document.getElementById("cmap-search");
    if (input && document.activeElement !== input) {
      try { input.focus(); var v = input.value; input.value = ""; input.value = v; } catch (e) {}
    }
    return query;
  }

  /* Live re-render (Part A1): re-render the current view in place.
     render() preserves level, focus section and search; the
     search box keeps focus when it had it. */
  function refreshFromExternal() {
    var searchFocused = false;
    try { searchFocused = !!(document.activeElement && document.activeElement.id === "cmap-search"); } catch (e) {}
    render();
    if (searchFocused) {
      var input = document.getElementById("cmap-search");
      if (input) { try { input.focus(); var v = input.value; input.value = ""; input.value = v; } catch (e) {} }
    }
  }

  function expand(sectionId) {
    var graph = buildGraph();
    var sec = graph.sections.filter(function (s) { return s.id === sectionId; })[0];
    if (!sec || !sec.unlocked) return graph;
    return render("lessons", sectionId);
  }
  function collapse() { return render("sections", null); }

  function centreOnCurrent() {
    var graph = buildGraph();
    if (!graph.current) { render("sections", graph.focusSection); return graph; }
    render("lessons", graph.current.sectionId);
    try {
      var node = document.querySelector('[data-lesson="' + graph.current.lessonId + '"]');
      if (node) {
        if (node.scrollIntoView) node.scrollIntoView({ block: "center", behavior: "smooth" });
        if (node.classList) node.classList.add("cmap-focus");
      }
    } catch (e) {}
    return graph;
  }

  /* ---------- wiring (delegated; one listener per root) ---------- */
  function wire(root) {
    if (wired) return;
    wired = true;
    root.addEventListener("click", function (ev) {
      var t = ev.target, btn = null;
      while (t && t !== root) {
        if (t.getAttribute) {
          /* Lesson links navigate on their own — never intercept. */
          if (t.getAttribute("data-lesson")) return;
          if (t.getAttribute("data-section") && t.tagName === "BUTTON") { btn = t; break; }
          if (t.id === "cmap-back" || t.id === "cmap-centre" || t.id === "cmap-review-weak") { btn = t; break; }
        }
        t = t.parentNode;
      }
      if (!btn) return;
      if (btn.id === "cmap-back") { collapse(); return; }
      if (btn.id === "cmap-centre") { centreOnCurrent(); return; }
      if (btn.id === "cmap-review-weak") {
        var w = firstWeakOrRusty();
        if (w) { try { window.location.href = "lesson.html?id=" + encodeURIComponent(w.lessonId); } catch (e) {} }
        return;
      }
      if (btn.getAttribute("data-section") && level === "sections") { expand(btn.getAttribute("data-section")); return; }
      if (btn.getAttribute("data-section") && level === "lessons") { collapse(); return; }
    });
    root.addEventListener("input", function (ev) {
      if (ev.target && ev.target.id === "cmap-search") applySearch(ev.target.value);
    });
    window.addEventListener("resize", scheduleDraw);
    /* Live re-render (Part A1): the map goes stale while open when a
       lesson completes in another tab or a sync pull lands. Both arrive
       as events this page can hear — `storage` (another tab writing
       localStorage; this tab's own writes never fire it) and
       `skillzify-sync` (sync.js dispatches it after every pull/merge,
       including cross-device progress). Either one re-renders the
       current view in place; unrelated keys are ignored. */
    window.addEventListener("storage", function (ev) {
      if (!ev || !ev.key || LIVE_KEYS[ev.key]) refreshFromExternal();
    });
    window.addEventListener("skillzify-sync", refreshFromExternal);
  }

  /* Deep link to one lesson (Part A3): expand to its section and centre
     on the node. Unknown ids and locked lessons fall back to the section
     view — never a broken render, and never a lock bypass. */
  function openLesson(lessonId) {
    var graph = buildGraph();
    var L = LC();
    if (!L || !lessonId) return render("sections", graph.focusSection);
    var lesson = null;
    try { lesson = L.lessonById(lessonId); } catch (e) {}
    if (!lesson) return render("sections", graph.focusSection);
    var gi = L.idxOf(lessonId), ok = false;
    try { ok = L.isDone(lessonId) || L.isUnlocked(gi); } catch (e) {}
    if (!ok) return render("sections", graph.focusSection);
    render("lessons", lesson.section);
    try {
      var node = document.querySelector('[data-lesson="' + lessonId + '"]');
      if (node) {
        if (node.scrollIntoView) node.scrollIntoView({ block: "center", behavior: "smooth" });
        if (node.classList) node.classList.add("cmap-focus");
      }
    } catch (e) {}
    return graph;
  }

  function initFromQuery() {
    var section = null, lesson = null;
    try {
      var q = new URLSearchParams(location.search);
      section = q.get("section");
      lesson = q.get("lesson");
    } catch (e) {}
    if (lesson) { openLesson(lesson); return; }
    var graph = buildGraph();
    if (section && graph.lessons[section]) {
      /* Same rule as expand(): a locked section's lessons stay behind
         the section view — a deep link must not bypass the lock. */
      var sec = graph.sections.filter(function (x) { return x.id === section; })[0];
      if (sec && sec.unlocked) { render("lessons", section); return; }
    }
    render("sections", graph.focusSection);
    /* Placement focus: land centred on the placed section. */
    try {
      if (graph.focusSection) {
        var node = document.querySelector('[data-section="' + graph.focusSection + '"]');
        if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest", inline: "center" });
      }
    } catch (e) {}
  }

  window.SkillzifyMap = {
    CROSS_LINKS: CROSS_LINKS,
    buildGraph: buildGraph,
    render: render,
    expand: expand,
    collapse: collapse,
    centreOnCurrent: centreOnCurrent,
    applySearch: applySearch,
    openLesson: openLesson,
    initFromQuery: initFromQuery,
    firstWeakOrRusty: firstWeakOrRusty,
    stats: statsData,
    refresh: refreshFromExternal,
    /* test seams */
    crossLaneD: crossLaneD,
    lessonStateFor: lessonStateFor,
    lastTouch: lastTouch,
    isRusty: isRusty,
    state: function () { return { level: level, focusSection: focusSection, query: query }; }
  };

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", initFromQuery);
  }
})();
