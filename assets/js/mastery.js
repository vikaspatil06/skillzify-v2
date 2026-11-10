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

  // P2-22: CANONICAL 17-topic label map. dashboard.js topicRows() and
  // practice.js read this copy (SkillzifyMastery.TOPIC_LABELS); do not
  // fork it — edit here and both pages follow.
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
    // P2-25: a legacy record with no snapshot and no hintsUsed/revealed
    // fields is UNKNOWN, not clean — it may have used hints or a reveal
    // before those fields existed. Score 0.7, never a presumed 1.0.
    // (A record that explicitly says hintsUsed: 0, revealed: false
    // still scores 1.0 below.)
    if (att.hintsUsed == null || att.revealed == null) return 0.7;
    return 1.0;
  }
  // P2-10 (design decision, recorded in mastery-engine-spec.md §4a):
  // the 85% "Mastered" threshold is a CONSCIOUS choice, not a bug. A
  // learner who solves every exercise but always needs a second try
  // scores 100 x 12x0.7 / 12 = 70% ("Solid") forever, by design — the
  // band rewards first-try mastery. Do not "fix" this by lowering the
  // threshold or re-weighting second-try solves.
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
    var seq = null;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      if (typeof LC.sectionUnlocked === "function" && !LC.sectionUnlocked(s.id)) continue;
      var lessons = (typeof LC.sectionLessons === "function") ? LC.sectionLessons(s.id) : [];
      for (var j = 0; j < lessons.length; j++) {
        if (!prog[lessons[j].id]) {
          seq = { lesson: lessons[j], section: s, indexInSection: j + 1, totalInSection: lessons.length };
          break;
        }
      }
      if (seq) break;
    }
    // P2-06: an enrolled path is the learner's chosen journey — its
    // earliest undone lesson wins over the sequential candidate, even
    // when that lesson sits in a still-locked section (path enrollment
    // unlocks it). Without an enrollment the sequential result stands.
    var pathCand = pathNextLesson(LC, sections, prog);
    return pathCand || seq;
  }
  // Earliest undone lesson of the learner's enrolled paths, in journey
  // order (sections, then lessons within a section). A lesson counts
  // only if it is in the enrollment map AND actually unlocked right
  // now (isUnlocked covers the path key, placement and the chain).
  function pathNextLesson(LC, sections, prog) {
    try {
      if (typeof LC.pathUnlockMap !== "function" || typeof LC.idxOf !== "function" ||
          typeof LC.isUnlocked !== "function" || typeof LC.sectionLessons !== "function") return null;
      var map = LC.pathUnlockMap() || {};
      if (!Object.keys(map).length) return null;
      for (var si = 0; si < sections.length; si++) {
        var s = sections[si];
        var lessons = LC.sectionLessons(s.id) || [];
        for (var j = 0; j < lessons.length; j++) {
          var lid = lessons[j].id;
          if (prog[lid] || !map[lid]) continue;
          var gi = LC.idxOf(lid);
          if (gi < 0 || !LC.isUnlocked(gi)) continue;
          return { lesson: lessons[j], section: s, indexInSection: j + 1, totalInSection: lessons.length };
        }
      }
    } catch (e) {}
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

  /* ---------------- weak-spot summary (P2-22 canonical) ----------------
     Plain-text summary for the AI daily-challenge prompt: weakest topic
     first, unsolved exercises, untried topics. dashboard.js and
     practice.js both delegate here (SkillzifyMastery.weakSpotsSummary);
     each keeps only a solve-rate-only fallback for the case mastery.js
     itself failed to load. The mastery weak/strong lines come from
     topicMastery() (quality-weighted coverage + band + rust); the
     solve-rate lines are the fallback when no topic has been tried. */
  function weakSpotsSummary(EX, atts) {
    EX = Array.isArray(EX) ? EX : [];
    atts = (atts && typeof atts === "object") ? atts : {};
    var rows = [];
    var byTopic = {}, order = [];
    EX.forEach(function (ex) {
      if (!byTopic[ex.topic]) { byTopic[ex.topic] = { solved: 0, tried: 0 }; order.push(ex.topic); }
      var a = atts[ex.id];
      if (a && a.attempts > 0) {
        byTopic[ex.topic].tried++;
        if (a.solved) byTopic[ex.topic].solved++;
      }
    });
    rows = order.map(function (t) {
      var s = byTopic[t];
      return { topic: t, label: TOPIC_LABELS[t] || t, solved: s.solved, tried: s.tried,
               pct: s.tried ? Math.round(s.solved / s.tried * 100) : null };
    });
    var tried = rows.filter(function (r) { return r.tried > 0; })
                    .sort(function (a, b) { return a.pct - b.pct || b.tried - a.tried; });
    var untried = rows.filter(function (r) { return r.tried === 0; });
    var unsolved = EX.filter(function (ex) { var a = atts[ex.id]; return a && a.attempts > 0 && !a.solved; });
    var parts = [];
    var mWeak = null, mStrong = null;
    try {
      var mrows = topicMastery().filter(function (r) { return r.tried > 0 && r.score != null; })
        .sort(function (a, b) { return a.score - b.score; });
      if (mrows.length) { mWeak = mrows[0]; mStrong = mrows[mrows.length - 1]; }
    } catch (e) {}
    if (mWeak) {
      parts.push("Weakest topic: " + mWeak.label + " (mastery " + mWeak.score + "% \u2014 " + mWeak.band + (mWeak.rusty ? ", rusty" : "") + ").");
      if (mStrong && mStrong.topic !== mWeak.topic) parts.push("Strongest topic: " + mStrong.label + " (mastery " + mStrong.score + "% \u2014 " + mStrong.band + ").");
    } else if (tried.length) {
      parts.push("Weakest topic: " + tried[0].label + " (" + tried[0].pct + "% of " + tried[0].tried + " tried).");
      if (tried.length > 1) parts.push("Strongest topic: " + tried[tried.length - 1].label + " (" + tried[tried.length - 1].pct + "%).");
    }
    if (unsolved.length) {
      parts.push("Unsolved exercises (" + unsolved.length + "): " +
        unsolved.slice(0, 5).map(function (ex) { return ex.title; }).join(", ") + ".");
    }
    if (untried.length) parts.push("Topics not tried yet: " + untried.map(function (r) { return r.label; }).join(", ") + ".");
    if (!parts.length) parts.push("No practice attempts yet — pick a beginner-friendly challenge.");
    return parts.join(" ");
  }

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
    weakSpotsSummary: weakSpotsSummary,
    // P2-22: canonical TOPIC_LABELS — dashboard.js and practice.js
    // read this copy instead of keeping their own (each keeps only a
    // degraded fallback for when mastery.js failed to load).
    TOPIC_LABELS: TOPIC_LABELS,
    RUST_DAYS: RUST_DAYS,
    _quality: quality, _band: band, _retentionFor: retentionFor
  };
})();
