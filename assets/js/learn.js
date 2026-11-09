/* ============================================================
   Skillzify v2 — learn.js (path overview)
   Renders the Duolingo-style lesson path. Lesson content lives
   on the dedicated lesson page (lesson.html + lesson.js).
   Requires learn-core.js (window.SkillzifyLearnCore) loaded first.
   ============================================================ */
(function () {
  "use strict";
  var LC = window.SkillzifyLearnCore;
  if (!LC) return;

  /* local aliases for the overview code */
  var LESSONS = LC.LESSONS, TRACKS = LC.TRACKS, SECTIONS = LC.SECTIONS;
  var esc = LC.esc, el = LC.el;
  var getProgress = LC.getProgress, getXP = LC.getXP,
      levelFor = LC.levelFor, nextLevel = LC.nextLevel;
  var idxOf = LC.idxOf, isDone = LC.isDone, isUnlocked = LC.isUnlocked,
      isPathOnlyUnlocked = LC.isPathOnlyUnlocked, trackLessons = LC.trackLessons,
      trackUnlocked = LC.trackUnlocked, trackPct = LC.trackPct,
      sectionLessons = LC.sectionLessons, sectionUnlocked = LC.sectionUnlocked,
      sectionPct = LC.sectionPct,
      currentIdx = LC.currentIdx,
      reducedMotion = LC.reducedMotion;

  function renderHero() {
    var card = document.getElementById("xp-card");
    if (!card) return;
    var xp = getXP(), lvl = levelFor(xp), nx = nextLevel(xp);
    var pct = nx ? Math.round((xp - lvl.xp) / (nx.xp - lvl.xp) * 100) : 100;
    card.innerHTML =
      '<div><div class="xp-num">' + xp + ' <span style="font-size:1rem">XP</span></div>' +
      '<div class="xp-lvl">' + esc(lvl.name) + (nx ? " · " + (nx.xp - xp) + " XP to " + esc(nx.name) : " · max level!") + "</div>" +
      '<div class="xp-bar"><span style="width:' + pct + '%"></span></div></div>' +
      '<div style="font-size:2.2rem">🏅</div>';
  }

  function renderProgress() {
    var box = document.getElementById("progress-box");
    if (!box) return;
    var p = getProgress(), total = LESSONS.length;
    var done = LESSONS.filter(function (l) { return p[l.id]; }).length;
    var html = '<div class="progress-row"><span class="lbl">Overall journey</span>' +
      '<div class="bar"><span style="width:' + Math.round(done / total * 100) + '%"></span></div>' +
      '<span class="pct">' + done + "/" + total + "</span></div>";
    SECTIONS.forEach(function (t) {
      var pct = sectionPct(t.id);
      html += '<div class="progress-row"><span class="lbl">' + t.icon + " " + esc(t.name) + "</span>" +
        '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
        '<span class="pct">' + pct + "%</span></div>";
    });
    box.innerHTML = html;
  }

  function nodeRow(lesson, gi, num) {
    var done = isDone(lesson.id), unlocked = isUnlocked(gi),
        pathOnly = !done && unlocked && isPathOnlyUnlocked(gi),
        cur = currentIdx() === gi;
    var row = el("div", "node-row" + (cur ? " is-current" : ""));
    var href = "lesson.html?id=" + encodeURIComponent(lesson.id);
    var btn;
    if (!unlocked) {
      btn = el("button", "node is-locked");
      btn.disabled = true; btn.title = "Complete the previous lesson to unlock";
    } else {
      btn = el("a", "node" + (done ? " is-done" : cur ? " is-current" : pathOnly ? " is-path" : ""));
      btn.href = href;
      if (pathOnly) btn.title = "Unlocked by your enrolled learning path";
    }
    var core = done ? "✓" : !unlocked ? "🔒" : pathOnly ? "🔓" : String(num);
    btn.innerHTML = '<span>' + core + "</span>";
    btn.setAttribute("aria-label", "Lesson " + num + ": " + lesson.title +
      (done ? " (completed)" : !unlocked ? " (locked)" : pathOnly ? " (unlocked by your learning path)" : cur ? " (current)" : ""));
    /* unlocked nodes are anchors now; locked stay disabled buttons */
    var amp = window.innerWidth < 720 ? 34 : 72;
    row.style.setProperty("--ox", Math.round(Math.sin(gi * 1.15) * amp) + "px");
    row.appendChild(btn);
    var lbl = el("div", "node-label", "<strong>" + num + ".</strong> " + esc(lesson.title) +
      (done ? ' <span class="mini-xp">+XP ✓</span>' : ""));
    row.appendChild(lbl);
    return row;
  }

  function lockedTrackCard(t) {
    var prev = SECTIONS.filter(function (x) { return x.id === t.needs; })[0];
    var card = el("div", "track-locked");
    card.innerHTML = '<div class="big">🔒</div>' +
      "<h3>" + t.icon + " " + esc(t.name) + " is locked</h3>" +
      "<p>Finish every lesson in <strong>" + esc(prev.name) + "</strong> (" + sectionPct(prev.id) + "% done) to unlock " +
      sectionLessons(t.id).length + " lessons in " + esc(t.name) + ".</p>" +
      '<div class="bar" style="max-width:280px;margin:16px auto 0"><span style="width:' + sectionPct(prev.id) + '%"></span></div>';
    return card;
  }

  /* True when this section holds the learner's current lesson (stays expanded). */
  function shouldExpand(trackId) {
    var i = currentIdx();
    if (i < 0) return trackId === "base-camp";
    return LESSONS[i].section === trackId;
  }

  /* Next Up card (Mastery Engine Phase 2): the continue card now shows
     the engine's top-ranked step — due review, weak-topic drill, next
     lesson, untried-topic intro, or all-done — with the reason why.
     "Not now" cycles to the next candidate (no persisted state, just an
     index). Falls back to the plain next-lesson card if mastery.js
     didn't load. */
  var nuIdx = 0;
  function renderContinue() {
    var box = document.getElementById("continue-card");
    if (!box) return;
    var M = window.SkillzifyMastery;
    if (!M || typeof M.nextSteps !== "function") { renderContinueLegacy(box); return; }
    var steps = M.nextSteps();
    if (!steps.length) { renderContinueLegacy(box); return; }
    var step = steps[nuIdx % steps.length];
    var html = '<div class="cc-label">\u{1F3AF} Next up</div>' +
      '<div class="cc-title">' + esc(step.title) + "</div>" +
      '<a class="btn" id="cc-go" href="' + esc(step.href) + '">' + esc(step.cta || "Go \u2192") + "</a>" +
      '<div class="hint" style="width:100%;margin:2px 0 0">' + esc(step.reason) + "</div>";
    if (steps.length > 1) {
      html += '<a href="#" class="hint" id="cc-cycle" style="width:100%">Not now — show me something else \u21BB</a>';
    }
    box.innerHTML = html;
    var cyc = document.getElementById("cc-cycle");
    if (cyc) cyc.addEventListener("click", function (ev) {
      ev.preventDefault();
      nuIdx = (nuIdx + 1) % steps.length;
      renderContinue();
    });
  }
  function renderContinueLegacy(box) {
    var i = currentIdx();
    if (i < 0) {
      box.innerHTML = '<div class="cc-done">\u{1F389} All ' + LESSONS.length + " lessons complete — you're a Python master. Time to build!</div>";
      return;
    }
    var l = LESSONS[i];
    box.innerHTML = '<div class="cc-label">\u25B6 Continue learning</div>' +
      '<div class="cc-title"><span class="cc-num">#' + (i + 1) + "</span> " + esc(l.title) + "</div>" +
      '<a class="btn" id="cc-go" href="lesson.html?id=' + l.id + '">Resume lesson \u2192</a>';
  }

  /* Search filter, shared by the input listener and by re-renders
     (resize / sync) so a live query survives them. Locked sections
     render their lessons into a hidden .locked-rows container so
     search can reveal matches there too (P2-9, P2-10). */
  function applySearch(q) {
    var anyMatch = false;
    document.querySelectorAll("#tracks .track-section").forEach(function (sec) {
      var matches = 0, total = 0;
      sec.querySelectorAll(".node-row").forEach(function (row) {
        total++;
        var lbl = row.querySelector(".node-label");
        var hit = !q || (lbl && lbl.textContent.toLowerCase().indexOf(q) >= 0);
        row.style.display = hit ? "" : "none";
        if (hit) matches++;
      });
      var badge = sec.querySelector(".t-count");
      if (q) {
        sec.classList.remove("collapsed");
        if (badge) badge.textContent = matches + "/" + total + " match" + (matches === 1 ? "" : "es");
        if (matches) anyMatch = true;
      } else if (badge) {
        badge.textContent = total + " lessons";
        var tid = sec.dataset.section;
        var c = !shouldExpand(tid);
        sec.classList.toggle("collapsed", c);
        var head = sec.querySelector(".track-head");
        if (head) head.setAttribute("aria-expanded", c ? "false" : "true");
      }
      var lr = sec.querySelector(".locked-rows");
      if (lr) lr.style.display = (q && matches) ? "" : "none";
    });
    var nores = document.getElementById("no-results");
    if (nores) nores.hidden = !(q && !anyMatch);
    if (q) requestAnimationFrame(drawPaths);
  }

  function currentQuery() {
    var inp = document.getElementById("lesson-search");
    return inp ? inp.value.trim().toLowerCase() : "";
  }

  function initSearch() {
    var inp = document.getElementById("lesson-search");
    if (!inp || inp.dataset.wired) return;
    inp.dataset.wired = "1";
    inp.addEventListener("input", function () { applySearch(currentQuery()); });
  }

  function renderTracks() {
    var mount = document.getElementById("tracks");
    if (!mount) return;
    mount.innerHTML = "";
    var lessonNum = 0;
    SECTIONS.forEach(function (t) {
      var sec = el("section", "track-section");
      sec.dataset.section = t.id;
      var pct = sectionPct(t.id);
      var nLessons = sectionLessons(t.id).length;
      var head = el("button", "track-head",
        '<span class="t-icon">' + t.icon + "</span>" +
        '<span class="t-text"><span class="t-name">' + esc(t.name) + "</span>" +
        '<span class="t-desc">' + esc(t.desc) + "</span></span>" +
        '<span class="t-count">' + nLessons + ' lessons</span>' +
        '<span class="t-pct">' + pct + "%</span>" +
        '<span class="t-chev" aria-hidden="true">\u25BE</span>');
      head.setAttribute("aria-expanded", "true");
      sec.appendChild(head);
      if (!sectionUnlocked(t.id)) {
        sec.appendChild(lockedTrackCard(t));
        /* Hidden lesson rows so search can find locked-section lessons
           (revealed by applySearch on a match, P2-9). */
        var lrows = el("div", "locked-rows");
        lrows.style.display = "none";
        sectionLessons(t.id).forEach(function (l) {
          lessonNum++;
          lrows.appendChild(nodeRow(l, idxOf(l.id), lessonNum));
        });
        sec.appendChild(lrows);
      } else {
        var path = el("div", "path");
        path.id = "path-" + t.id;
        path.innerHTML = '<svg class="path-svg" aria-hidden="true"><defs>' +
          '<linearGradient id="pg-' + t.id + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#6c7bff"/><stop offset="1" stop-color="#22d3ee"/>' +
          "</linearGradient></defs>" +
          '<path class="p-base" d=""/><path class="p-prog" stroke="url(#pg-' + t.id + ')" d=""/></svg>';
        sectionLessons(t.id).forEach(function (l) {
          lessonNum++;
          path.appendChild(nodeRow(l, idxOf(l.id), lessonNum));
        });
        sec.appendChild(path);
        var collapsed = !shouldExpand(t.id);
        sec.classList.toggle("collapsed", collapsed);
        head.setAttribute("aria-expanded", collapsed ? "false" : "true");
        head.addEventListener("click", function () {
          var c = sec.classList.toggle("collapsed");
          head.setAttribute("aria-expanded", c ? "false" : "true");
          if (!c) requestAnimationFrame(drawPaths);
        });
      }
      mount.appendChild(sec);
    });
  }

  function smoothPath(p) {
    if (p.length < 2) return "";
    var d = "M" + p[0][0].toFixed(1) + " " + p[0][1].toFixed(1);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += "C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + " " + c2x.toFixed(1) + " " + c2y.toFixed(1) +
           " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return d;
  }

  function drawPaths() {
    document.querySelectorAll(".path").forEach(function (path) {
      var svg = path.querySelector(".path-svg");
      var rows = path.querySelectorAll(".node-row");
      if (!svg || !rows.length) return;
      var pr = path.getBoundingClientRect(), pts = [];
      rows.forEach(function (r) {
        var b = r.querySelector(".node").getBoundingClientRect();
        pts.push([b.left - pr.left + b.width / 2, b.top - pr.top + b.height / 2]);
      });
      svg.setAttribute("viewBox", "0 0 " + path.offsetWidth + " " + path.offsetHeight);
      var d = smoothPath(pts);
      var base = svg.querySelector(".p-base"), prog = svg.querySelector(".p-prog");
      base.setAttribute("d", d); prog.setAttribute("d", d);
      var doneCount = 0;
      rows.forEach(function (r) { if (r.querySelector(".node.is-done")) doneCount++; });
      var frac = pts.length > 1 ? doneCount / (pts.length - 1) : 1;
      frac = Math.max(0, Math.min(1, frac));
      try {
        var total = prog.getTotalLength();
        prog.style.strokeDasharray = String(total);
        prog.style.strokeDashoffset = String(total * (1 - frac));
      } catch (e) {}
    });
  }

  function scrollToCurrent() {
    var n = document.querySelector(".node.is-current");
    if (n) {
      setTimeout(function () {
        n.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
      }, 350);
    }
  }

  /* P1-3: pinned / palette deep links (learn.html#lesson-<id>). Same as
     clicking the lesson node: an unlocked lesson opens on lesson.html;
     a locked one is revealed in place (its section expands and scrolls
     into view); unknown ids are ignored. */
  function openHashLesson() {
    var m = (location.hash || "").match(/^#lesson-(.+)$/);
    if (!m) return;
    var lesson = null;
    LESSONS.forEach(function (l) { if (l.id === m[1]) lesson = l; });
    if (!lesson) return;
    if (isUnlocked(idxOf(lesson.id))) {
      location.href = "lesson.html?id=" + encodeURIComponent(lesson.id);
      return;
    }
    try {
      var sec = document.querySelector('[data-section="' + lesson.section + '"]');
      if (sec) {
        sec.classList.remove("collapsed");
        var head = sec.querySelector(".track-head");
        if (head) head.setAttribute("aria-expanded", "true");
        sec.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
      }
    } catch (e) {}
  }

  function renderAll() {
    renderHero(); renderProgress(); renderContinue(); renderTracks(); initSearch(); applySearch(currentQuery());
    // Backfill: a section or path finished before the +100/+150 bonuses
    // shipped still pays out once (flags in learn-core.js).
    try { if (LC.checkSectionBonuses) LC.checkSectionBonuses(); if (LC.checkPathBonuses) LC.checkPathBonuses(); } catch (e) {}
    requestAnimationFrame(function () { drawPaths(); scrollToCurrent(); });
  }
  var resizeT = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { renderTracks(); applySearch(currentQuery()); requestAnimationFrame(drawPaths); }, 250);
  });

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("tracks")) return;
    renderAll();
    openHashLesson();
    lastUnlockJson = unlockJson();
  });

  /* ---------- live refresh on cross-device sync ----------
     When another device's enrollment changes the unlock set, re-render
     the path overview. */
  var lastUnlockJson = "";
  function unlockJson() {
    try { return JSON.stringify(Object.keys(LC.pathUnlockMap()).sort()); } catch (e) { return ""; }
  }
  window.addEventListener("skillzify-sync", function () {
    try {
      if (!document.getElementById("tracks")) return;
      // Next Up reflects synced progress/reviews even when unlocks don't change.
      renderContinue();
      var cur = unlockJson();
      if (cur !== lastUnlockJson) { lastUnlockJson = cur; renderAll(); }
    } catch (e) {}
  });


  /* ================= Public API (unchanged shape) ================= */
  window.SkillzifyLearn = {
    LESSONS: LC.LESSONS, TRACKS: LC.TRACKS, SECTIONS: LC.SECTIONS,
    getProgress: LC.getProgress, trackPct: LC.trackPct, sectionPct: LC.sectionPct,
    totalLessons: LC.totalLessons,
    nextLesson: LC.nextLesson, highlight: LC.highlight,
    getXP: LC.getXP, levelFor: LC.levelFor, nextLevel: LC.nextLevel,
    isLessonDone: LC.isLessonDone,
    lessonIndex: LC.lessonIndex,
    isLessonUnlocked: LC.isLessonUnlocked,
    isLessonPathUnlocked: LC.isLessonPathUnlocked
  };
})();
