/* Skillzify Mastery Engine (System 1 of 4) — Phase 1: core scoring.
   Derived mastery scores per topic/section + "what next" ranking, computed
   on the fly from data the site already collects. No new backend, no new
   collections, no sync work: attempts, progress and reviews already sync
   via Firestore, so the score is identical on every origin automatically.
   Exposes window.SkillzifyMastery. See ~/workspace/mastery-engine-spec.md.
   Phase 1 covers scoring + selection only; UI (Next Up card, daily plan
   checklist, topic bars) lands in Phases 2–4. */
(function () {
  "use strict";

  var ATT_KEY = "skillzify_exercise_attempts"; // {exId: {attempts, solved, hintsUsed, revealed, bestMs, lastTry}}
  var PROG_KEY = "skillzify_progress";         // {lessonId: true}
  var REV_KEY = "skillzify_review";            // {lessonId: {interval, due, updatedAt}}
  var RUST_DAYS = 21;
  var DAY_MS = 86400000;

  // Same 17-topic label map as dashboard.js topicRows() — keep in sync.
  var TOPIC_LABELS = {
    variables: "Variables", strings: "Strings", collections: "Collections",
    loops: "Loops", functions: "Functions", oop: "OOP",
    exceptions: "Exceptions", dsa: "Algorithms", recursion: "Recursion",
    sorting: "Sorting", "trees-graphs": "Trees & Graphs",
    "dynamic-programming": "Dynamic Programming",
    "data-science": "Data Science", web: "Web", files: "Files",
    testing: "Testing", async: "Async"
  };

  // Retention credit per completed lesson, by its review interval
  // (spec §4b). Never reviewed: 0.7. Unknown interval: 0.6.
  var INTERVAL_RETENTION = { 60: 1.0, 30: 0.9, 14: 0.8, 7: 0.7, 3: 0.6, 1: 0.5 };

  function storeGet(k, fb) {
    try { var v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); }
    catch (e) { return fb; }
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function practiceData() {
    var d = (typeof window !== "undefined" && window.SkillzifyPracticeData) || [];
    return Array.isArray(d) ? d : [];
  }
  function learnCore() {
    return (typeof window !== "undefined" && window.SkillzifyLearnCore) || null;
  }
  function attempts() {
    var a = storeGet(ATT_KEY, {});
    return (a && typeof a === "object" && !Array.isArray(a)) ? a : {};
  }
  function progress() {
    var p = storeGet(PROG_KEY, {});
    return (p && typeof p === "object" && !Array.isArray(p)) ? p : {};
  }
  // Raw review map, unsanitised: entries that fail sanitizeEntry
  // (e.g. a due date with no updatedAt) are still visible here. Only
  // the P1-07 rust fallback reads it; everything else uses reviewMap().
  function reviewRawMap() {
    var raw = storeGet(REV_KEY, {});
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw;
  }
  // Review map, sanitised exactly like review.js sanitizeEntry().
  function reviewMap() {
    var raw = storeGet(REV_KEY, {});
    var out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(function (id) {
      var e = raw[id];
      if (!e || typeof e !== "object") return;
      if (typeof e.interval !== "number" || e.interval <= 0) return;
      if (typeof e.due !== "number" || e.due <= 0) return;
      if (typeof e.updatedAt !== "number" || e.updatedAt <= 0) return;
      out[id] = { interval: e.interval, due: e.due, updatedAt: e.updatedAt };
    });
    return out;
  }
  // Due review ids, oldest first. Prefers SkillzifyReview when loaded.
  function dueReviews() {
    try {
      if (typeof window !== "undefined" && window.SkillzifyReview &&
          typeof window.SkillzifyReview.dueList === "function") {
        var list = window.SkillzifyReview.dueList();
        return Array.isArray(list) ? list.slice() : [];
      }
    } catch (e) {}
    var m = reviewMap(), t = Date.now();
    return Object.keys(m).filter(function (id) { return m[id].due <= t; })
      .sort(function (a, b) { return m[a].due - m[b].due; });
  }
  function reviewEntry(id) {
    try {
      if (typeof window !== "undefined" && window.SkillzifyReview &&
          typeof window.SkillzifyReview.entry === "function") {
        return window.SkillzifyReview.entry(id) || null;
      }
    } catch (e) {}
    return reviewMap()[id] || null;
  }

  /* ---------------- quality + bands (spec §4a) ---------------- */
  // Per-exercise quality q. Frozen at solve time (P1-04): practice.js
  // snapshots the quality onto the attempt record as `solveQuality`
  // the moment solved flips true, and quality() reads the snapshot —
  // later re-solves and post-solve reveals must not degrade the score.
  // Legacy records without a snapshot use the old live derivation:
  // revealed 0.4; hinted or >1 attempt 0.7; clean first-try 1.0.
  function quality(att) {
    if (!att || !att.solved) return 0;
    if (typeof att.solveQuality === "number" && isFinite(att.solveQuality)) return att.solveQuality;
    if (att.revealed) return 0.4;
    if (att.hintsUsed > 0 || num(att.attempts) > 1) return 0.7;
    return 1.0;
  }
  function band(score, tried) {
    if (!tried) return "Not tried yet";
    if (score >= 85) return "Mastered";
    if (score >= 60) return "Solid";
    if (score >= 30) return "Building";
    return "Starting out";
  }
  function retentionFor(interval) {
    if (interval == null) return 0.7; // completed, never reviewed
    var r = INTERVAL_RETENTION[interval];
    return (r == null) ? 0.6 : r;
  }
  function isRusty(lastMs) {
    if (!lastMs) return false;
    return (Date.now() - lastMs) > RUST_DAYS * DAY_MS;
  }

  /* ---------------- topic mastery (spec §4a) ---------------- */
  function topicMastery() {
    var EX = practiceData(), atts = attempts();
    if (!EX.length) return [];
    var byTopic = {}, order = [];
    EX.forEach(function (ex) {
      if (!byTopic[ex.topic]) { byTopic[ex.topic] = { total: 0, qSum: 0, tried: 0, solved: 0, lastMs: 0, unsolved: [] }; order.push(ex.topic); }
      var t = byTopic[ex.topic];
      t.total++;
      var a = atts[ex.id];
      if (a && num(a.attempts) > 0) {
        t.tried++;
        if (a.solved) t.solved++;
        else t.unsolved.push(ex.id);
        if (num(a.lastTry) > t.lastMs) t.lastMs = num(a.lastTry);
      }
      t.qSum += quality(a);
    });
    return order.map(function (topic) {
      var t = byTopic[topic];
      var score = t.tried ? Math.round(100 * t.qSum / t.total) : null;
      return {
        topic: topic, label: TOPIC_LABELS[topic] || topic,
        score: score, band: band(score, t.tried),
        tried: t.tried, solved: t.solved, total: t.total,
        unsolved: t.unsolved, rusty: isRusty(t.lastMs)
      };
    });
  }

  /* ---------------- section mastery (spec §4b) ---------------- */
  function sectionMastery() {
    var LC = learnCore();
    if (!LC || !Array.isArray(LC.SECTIONS)) return [];
    var prog = progress();
    return LC.SECTIONS.map(function (s) {
      var lessons = (typeof LC.sectionLessons === "function") ? LC.sectionLessons(s.id) : [];
      var total = lessons.length;
      var doneList = lessons.filter(function (l) { return !!prog[l.id]; });
      var done = doneList.length;
      var retention = null, score = 0;
      if (done > 0) {
        var sum = 0;
        doneList.forEach(function (l) {
          var e = reviewEntry(l.id);
          sum += retentionFor(e ? e.interval : null);
        });
        retention = sum / done;
        score = Math.round(100 * (done / total) * retention);
      }
      // Section rust: last review activity on its done lessons.
      // Fallback (P1-07): a done lesson whose review is overdue
      // (due <= now) but which has no recorded review activity (no
      // updatedAt — the sanitised entry is invisible to reviewEntry)
      // is rusty; its due date is the only activity signal we have.
      var lastMs = 0, overdue = false;
      var rawRev = reviewRawMap();
      doneList.forEach(function (l) {
        var e = reviewEntry(l.id);
        if (e && num(e.updatedAt) > lastMs) lastMs = num(e.updatedAt);
        var r = rawRev[l.id];
        if (r && typeof r === "object" && num(r.due) > 0 && num(r.due) <= Date.now() && !num(r.updatedAt)) overdue = true;
      });
      return {
        section: s.id, name: s.name, icon: s.icon || "",
        score: score, band: band(score, done > 0),
        done: done, total: total, retention: retention,
        rusty: isRusty(lastMs) || overdue
      };
    });
  }

  /* ---------------- weakest topic ---------------- */
  function weakestTopic() {
    var rows = topicMastery().filter(function (r) { return r.tried > 0; });
    if (!rows.length) return null;
    rows.sort(function (a, b) { return (a.score - b.score) || (b.tried - a.tried); });
    return rows[0];
  }

  /* ---------------- next step ranking (spec §5) ---------------- */
  function nextLessonInfo() {
    var LC = learnCore();
    if (!LC || !Array.isArray(LC.SECTIONS)) return null;
    var prog = progress();
    var sections = LC.SECTIONS;
    // Placement: scan the placed-or-later sections first — a placed
    // learner's next lesson is at/after their placement, never Base Camp
    // (P1-01). Earlier sections are the fallback once everything at/after
    // the placement is done.
    var placed = (typeof LC.placedSection === "function") ? LC.placedSection() : null;
    if (placed) {
      var ids = sections.map(function (x) { return x.id; });
      var pi = ids.indexOf(placed);
      if (pi > 0) sections = sections.slice(pi).concat(sections.slice(0, pi));
    }
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      if (typeof LC.sectionUnlocked === "function" && !LC.sectionUnlocked(s.id)) continue;
      var lessons = (typeof LC.sectionLessons === "function") ? LC.sectionLessons(s.id) : [];
      for (var j = 0; j < lessons.length; j++) {
        if (!prog[lessons[j].id]) {
          return { lesson: lessons[j], section: s, indexInSection: j + 1, totalInSection: lessons.length };
        }
      }
    }
    return null;
  }
  function easiestUntriedExercise() {
    var EX = practiceData(), atts = attempts();
    var best = null;
    EX.forEach(function (ex) {
      var a = atts[ex.id];
      if (a && num(a.attempts) > 0) return;
      if (!best || num(ex.difficulty) < num(best.difficulty)) best = ex;
    });
    return best;
  }
  // Ranked candidates, best first (one per kind). nextStep() is [0].
  function nextSteps() {
    var out = [];
    var due = dueReviews();
    if (due.length) {
      var LC = learnCore();
      var oldest = due[0], title = oldest;
      if (LC && typeof LC.lessonById === "function") {
        var l = LC.lessonById(oldest);
        if (l && l.title) title = l.title;
      }
      out.push({
        kind: "review",
        title: due.length + (due.length === 1 ? " lesson" : " lessons") + " due for review",
        reason: "Oldest first: " + title + ".",
        href: "learn.html#review",
        cta: "Review now →",
        reviewIds: due.slice(0, 3)
      });
    }
    var rows = topicMastery().filter(function (r) { return r.tried > 0; });
    rows.sort(function (a, b) { return (a.score - b.score) || (b.tried - a.tried); });
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i].unsolved.length) continue;
      var exId = rows[i].unsolved[0];
      out.push({
        kind: "drill",
        title: "Practice " + rows[i].label,
        reason: rows[i].label + " is your weakest topic — " + rows[i].score + "% mastery, " +
          rows[i].unsolved.length + " unsolved.",
        href: "practice.html#ex=" + exId,
        cta: "Practice →",
        exerciseId: exId, topic: rows[i].topic
      });
      break;
    }
    var nl = nextLessonInfo();
    if (nl) {
      out.push({
        kind: "lesson",
        title: nl.section.name + " — lesson " + nl.indexInSection + " of " + nl.totalInSection,
        reason: "Next in your journey: " + (nl.lesson.title || nl.lesson.id) + ".",
        href: "lesson.html?id=" + nl.lesson.id,
        cta: "Resume lesson →",
        lessonId: nl.lesson.id, section: nl.section.id
      });
    }
    var intro = easiestUntriedExercise();
    if (intro) {
      out.push({
        kind: "intro",
        title: "Try " + (TOPIC_LABELS[intro.topic] || intro.topic),
        reason: "You haven't tried " + (TOPIC_LABELS[intro.topic] || intro.topic) + " yet.",
        href: "practice.html#ex=" + intro.id,
        cta: "Try it →",
        exerciseId: intro.id, topic: intro.topic
      });
    }
    if (!out.length) {
      out.push({
        kind: "done",
        title: "Everything is solid",
        reason: "No reviews due, no weak spots, nothing new left in the journey.",
        href: "dashboard.html",
        cta: "Take today's challenge →"
      });
    }
    return out;
  }
  function nextStep() { return nextSteps()[0]; }

  /* ---------------- daily plan (spec §5) ---------------- */
  function dailyPlan() {
    var steps = nextSteps();
    var plan = { reviews: [], exercise: null, lesson: null };
    steps.forEach(function (s) {
      if (s.kind === "review" && !plan.reviews.length) plan.reviews = s.reviewIds || [];
      else if ((s.kind === "drill" || s.kind === "intro") && !plan.exercise) plan.exercise = s.exerciseId;
      else if (s.kind === "lesson" && !plan.lesson) plan.lesson = s.lessonId;
    });
    return plan;
  }

  window.SkillzifyMastery = {
    topicMastery: topicMastery,
    sectionMastery: sectionMastery,
    nextStep: nextStep,
    nextSteps: nextSteps,
    dailyPlan: dailyPlan,
    weakestTopic: weakestTopic,
    RUST_DAYS: RUST_DAYS,
    _quality: quality, _band: band, _retentionFor: retentionFor
  };
})();
