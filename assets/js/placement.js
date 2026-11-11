/* Skillzify Placement Test (System 2 of 4) — Phase 1: selection + scoring.
   A ~3-minute, 10-question diagnostic that drops a new learner at the
   right section instead of Base Camp lesson 1. Reuses the 49 predict
   exercises in practice-data.js — no new questions, no AI, no compiler.

   Design (placement-test-spec.md §2–§4):
   - A pointer, not progress: placement never marks lessons done, never
     awards XP, never fires section bonuses. It only says where to start.
   - 3 stages, adaptive: A (3 x difficulty 1 basics) -> B (4 x difficulty 2
     core, reached if A >= 2/3) -> C (3 x difficulty 3 + hard difficulty 2
     advanced, reached if A >= 2/3 and B >= 3/4). A score of 0-1/3 ends
     the test after 3 questions (early exit).
   - Selection excludes predict exercises the learner already solved in
     practice (so the test can't be passed from memory), with a widening
     fallback when the strict pool is short: same difficulty, any topic ->
     solved items -> any predict item. A stage never asks the same
     question twice, and no question appears in two stages.
   - Scoring uses the §4 table's COUNTS when a stage asked its full
     complement; a genuinely short stage is read as a fraction of the
     FULL stage size (correct / fullN) — a conservative approximation,
     since unasked questions count as unanswered (P2-26: the old
     asked-total fraction inflated short stages — B 1/2 scored as
     Object Castle instead of Tool Shed).
   - Result lives in localStorage `skillzify_placement`, wiped on
     logout (Phase 3 adds the wipe). Works signed-out. When signed in,
     save() also pushes it to the cloud doc (users/{uid} `placement`,
     last-write-wins by date) via sync.js, so the map's focus agrees
     across devices — see mergePlacement in sync.js.

   API (spec §8, with two noted refinements):
   - selectQuestions(opts) -> {a: [...3], b: [...4], c: [...3], all: [...10]}
     Staged + flat; every item carries .stage. opts.solved overrides the
     solved set (default: read from localStorage); opts.rng overrides
     Math.random (tests pass a deterministic rng).
   - score(questions, answers) -> {section, score, total, stages, reason}
     questions = the questions actually ASKED (the UI asks stage by stage,
     so score() never sees unasked stages); answers = {id: chosenIndex}.
     The spec sketches score(answers); the two-arg form is the honest one
     — stage membership and the correct answer live on the selected items.
   - save(result) / read() / clear() -> localStorage wrapper.
   - startSection(sectionId?) -> first lesson id of the placed section
     (defaults to the stored result's section).
   Exposes window.SkillzifyPlacement. */
(function () {
  "use strict";

  var PLACEMENT_KEY = "skillzify_placement";
  var ATTEMPTS_KEY = "skillzify_exercise_attempts";

  /* Stage definitions: question count, topics, difficulties. Stage C
     prefers difficulty 3 and fills with difficulty 2 from the advanced
     topics ("hard d2"). Verified against the real bank (9 Nov): A pool 5,
     B pool 6, C pool 4 x d3 + 14 x d2 — all comfortably above the need. */
  var STAGES = {
    a: { n: 3, topics: ["variables", "strings", "collections"], difficulties: [1] },
    b: { n: 4, topics: ["loops", "functions", "oop", "exceptions"], difficulties: [2] },
    c: { n: 3, topics: ["dsa", "recursion", "sorting", "trees-graphs", "dynamic-programming", "data-science", "web", "files", "async"], difficulties: [3, 2], d3First: true },
  };
  var SECTION_ORDER = ["base-camp", "tool-shed", "object-castle", "algorithm-arena", "power-lab", "data-lab", "launch-pad"];

  var REASONS = {
    "base-camp": "The basics are still new — start at Base Camp and build up from lesson 1.",
    "tool-shed": "Basics are solid, but the core is shaky — start at Tool Shed.",
    "object-castle": "Basics are solid and the core is half there — start at Object Castle.",
    "algorithm-arena": "The core is solid, but the advanced questions were new — start at Algorithm Arena.",
    "power-lab": "You know some advanced material — start at Power Lab.",
    "data-lab": "Strong advanced knowledge — start at Data Lab.",
    "launch-pad": "You aced the advanced questions — start at the capstone section, Launch Pad.",
  };

  function bank() {
    return (window.SkillzifyPracticeData || []).filter(function (e) { return e.kind === "predict"; });
  }

  /* Solved predict ids, as a Set. Accepts a Set, an array of ids, or the
     raw attempts map; defaults to reading localStorage. */
  function solvedSet(over) {
    if (over) {
      // Duck-type a Set (has + forEach) instead of instanceof: callers in
      // another realm (the audit harness vm) build Sets whose constructor
      // is not this realm's Set, so instanceof would silently miss them.
      if (typeof over.has === "function" && typeof over.forEach === "function") {
        var s2 = new Set();
        over.forEach(function (id) { s2.add(id); });
        return s2;
      }
      if (Array.isArray(over)) return new Set(over);
      var s = new Set();
      Object.keys(over).forEach(function (id) { if (over[id] && over[id].solved) s.add(id); });
      return s;
    }
    var set = new Set();
    try {
      var atts = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || "{}") || {};
      Object.keys(atts).forEach(function (id) { if (atts[id] && atts[id].solved) set.add(id); });
    } catch (e) {}
    return set;
  }

  function shuffle(list, rng) {
    var a = list.slice(), r = rng || Math.random, i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* Ordered candidate tiers for one stage, strict first, wider nets later.
     Each tier is shuffled on its own, so the stage stays at the right
     difficulty even when the strict pool is short. */
  function candidates(stageKey, solved) {
    var def = STAGES[stageKey], all = bank(), tiers = [];
    function tier(diffs, topics, wantSolved) {
      return all.filter(function (e) {
        return diffs.indexOf(e.difficulty) >= 0 &&
          (!topics || topics.indexOf(e.topic) >= 0) &&
          (wantSolved ? solved.has(e.id) : !solved.has(e.id));
      });
    }
    if (def.d3First) {
      // Stage C: d3 advanced first, then d2 advanced, then any-topic
      // d3/d2, then solved items, then anything at all.
      tiers.push(tier([3], def.topics, false), tier([2], def.topics, false),
        tier([3], null, false), tier([2], null, false),
        tier([3], def.topics, true), tier([2], def.topics, true),
        tier([3], null, true), tier([2], null, true));
    } else {
      tiers.push(tier(def.difficulties, def.topics, false),
        tier(def.difficulties, null, false),
        tier(def.difficulties, def.topics, true),
        tier(def.difficulties, null, true));
    }
    if (stageKey === "c") {
      // Stage C final fallback stays at difficulty >= 2 (P2-27): a
      // learner who solved every d2/d3 item is re-asked a solved d2/d3
      // item rather than being handed d1 basics as an "Advanced"
      // question. The d3/d2 tiers above already cover every d2/d3 item,
      // solved or not, so these tiers only matter as a safety net.
      tiers.push(all.filter(function (e) { return e.difficulty >= 2 && !solved.has(e.id); }),
        all.filter(function (e) { return e.difficulty >= 2 && solved.has(e.id); }));
    } else {
      tiers.push(all.filter(function (e) { return !solved.has(e.id); }),
        all.filter(function (e) { return solved.has(e.id); }));
    }
    return tiers;
  }

  /* Sample one stage: walk the tiers in order, shuffled, until the stage
     is full. `seen` is shared across stages, so no question is asked
     twice in one test. Returns the sampled items (each a copy with
     .stage set), possibly fewer than n when the whole bank is short. */
  function sampleStage(stageKey, solved, rng, seen) {
    var def = STAGES[stageKey], out = [];
    candidates(stageKey, solved).forEach(function (tierList) {
      shuffle(tierList, rng).forEach(function (e) {
        if (out.length >= def.n || seen[e.id]) return;
        seen[e.id] = true;
        var q = {};
        for (var k in e) q[k] = e[k];
        q.stage = stageKey;
        // P2-27: a stage C item the learner had already solved in
        // practice is a repeat, not fresh evidence — score() notes the
        // dilution in the result reason.
        if (stageKey === "c" && solved.has(e.id)) q.reasked = true;
        out.push(q);
      });
    });
    return out;
  }

  function selectQuestions(opts) {
    opts = opts || {};
    var solved = solvedSet(opts.solved), rng = opts.rng || Math.random, seen = {};
    var a = sampleStage("a", solved, rng, seen);
    var b = sampleStage("b", solved, rng, seen);
    var c = sampleStage("c", solved, rng, seen);
    return { a: a, b: b, c: c, all: a.concat(b, c) };
  }

  function stageScore(asked, answers) {
    var correct = 0;
    asked.forEach(function (q) { if (answers[q.id] === q.answer) correct++; });
    return { correct: correct, total: asked.length };
  }

  /* Score the questions actually asked (the UI asks stage by stage, so
     unasked stages arrive with total 0). The §4 table is written in
     COUNTS out of the full stage (A /3, B /4, C /3): a full stage applies
     its count cutoff directly (A 2/3 passes, B 2/4 -> Object Castle,
     B 3/4 -> C, C 1/3 -> Power Lab, C 2/3 -> Data Lab, C 3/3 ->
     Launch Pad). A genuinely short stage reads the same cutoff as a
     fraction of the FULL stage size (correct / fullN) — approximate and
     conservative, since unasked questions count as unanswered: B 1/2
     -> 1/4 -> Tool Shed, B 2/2 -> 2/4 -> Object Castle. The old
     asked-total fraction inflated short stages (B 1/2 scored as Object
     Castle, B 2/2 as Algorithm Arena). */
  function score(questions, answers) {
    answers = answers || {};
    var byStage = { a: [], b: [], c: [] };
    (questions || []).forEach(function (q) { if (byStage[q.stage]) byStage[q.stage].push(q); });
    var sa = stageScore(byStage.a, answers), sb = stageScore(byStage.b, answers), sc = stageScore(byStage.c, answers);
    // True when the stage's score is below the §4 count cutoff: for a
    // full stage this is the count comparison; for a short stage it is
    // the same cutoff read as a fraction of the full stage size.
    function below(s, full, countCut) { return s.correct / full < countCut / full; }
    var section;
    if (sa.total === 0) section = "base-camp"; // nothing asked: safest start
    else if (below(sa, 3, 2)) section = "base-camp";
    else if (sb.total === 0) section = "tool-shed"; // passed A, B untestable
    else if (below(sb, 4, 2)) section = "tool-shed";
    else if (below(sb, 4, 3)) section = "object-castle";
    else if (sc.total === 0) section = "algorithm-arena"; // core solid, C untestable
    else if (below(sc, 3, 1)) section = "algorithm-arena";
    else if (below(sc, 3, 2)) section = "power-lab";
    else if (below(sc, 3, 3)) section = "data-lab";
    else section = "launch-pad";
    var total = sa.total + sb.total + sc.total, correct = sa.correct + sb.correct + sc.correct;
    // P2-27: stage C may contain re-asked items (previously solved in
    // practice), so a C-driven placement leans on familiar material —
    // say so in the reason rather than presenting it as fresh evidence.
    var reason = REASONS[section];
    var reaskedC = sc.total > 0 && byStage.c.some(function (q) { return !!q.reasked; });
    if (reaskedC) reason += " Some advanced questions were ones you had already solved in practice, so the advanced result is approximate.";
    return { section: section, score: correct, total: total,
      stages: { a: sa, b: sb, c: sc }, reason: reason };
  }

  function save(result) {
    if (!result || !result.section) return null;
    var rec = { section: result.section, score: result.score || 0, total: result.total || 0,
      stages: result.stages || { a: { correct: 0, total: 0 }, b: { correct: 0, total: 0 }, c: { correct: 0, total: 0 } },
      date: Date.now() };
    try { localStorage.setItem(PLACEMENT_KEY, JSON.stringify(rec)); } catch (e) { return null; }
    /* Concept Map amplification (Part A2): the placement is a pointer
       the map focuses on, so it syncs to the cloud doc (users/{uid}
       `placement` field — owner-only rules, no field restriction) via
       the existing sync path. markDirty debounces a syncCycle, which
       merges it last-write-wins by date; signed-out it is a no-op and
       the record stays local-only. placement-page.js finish() is the
       only caller, so this fires exactly when the test completes. */
    try {
      if (window.SkillzifySync && typeof window.SkillzifySync.markDirty === "function")
        window.SkillzifySync.markDirty("placement");
    } catch (e) {}
    return rec;
  }

  function read() {
    try {
      var r = JSON.parse(localStorage.getItem(PLACEMENT_KEY) || "null");
      if (!r || typeof r.section !== "string" || SECTION_ORDER.indexOf(r.section) < 0) return null;
      return r;
    } catch (e) { return null; }
  }

  function clear() {
    try { localStorage.removeItem(PLACEMENT_KEY); } catch (e) {}
  }

  function startSection(sectionId) {
    var sec = sectionId || (read() || {}).section;
    if (!sec) return null;
    try {
      var LC = window.SkillzifyLearnCore;
      if (!LC || typeof LC.sectionLessons !== "function") return null;
      var lessons = LC.sectionLessons(sec) || [];
      return lessons.length ? lessons[0].id : null;
    } catch (e) { return null; }
  }

  window.SkillzifyPlacement = {
    selectQuestions: selectQuestions, score: score,
    save: save, read: read, clear: clear, startSection: startSection,
    STAGES: STAGES, SECTION_ORDER: SECTION_ORDER,
    _candidates: candidates, _sampleStage: sampleStage, _solvedSet: solvedSet,
  };
})();
