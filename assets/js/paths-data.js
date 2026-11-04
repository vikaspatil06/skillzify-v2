/* Skillzify Learning Paths — guided sequences of lessons + exercises */
window.SkillzifyPaths = [
  {
    id: "fundamentals", icon: "🌱", title: "Python Fundamentals",
    color: "#34d399", level: "Beginner",
    desc: "Zero to confident: every core concept in the right order, with practice after each step.",
    steps: [
      { t: "lesson", id: "b1" },       { t: "lesson", id: "b2" },       { t: "ex", id: "ex-variables-01" },
      { t: "ex", id: "ex-variables-04" },       { t: "ex", id: "ex-variables-05" },       { t: "lesson", id: "b3" },
      { t: "ex", id: "ex-strings-01" },       { t: "ex", id: "ex-strings-05" },       { t: "lesson", id: "b8" },
      { t: "lesson", id: "b6" },       { t: "ex", id: "ex-collections-01" },       { t: "ex", id: "ex-collections-06" },
      { t: "lesson", id: "b9" },       { t: "ex", id: "ex-loops-01" },       { t: "ex", id: "ex-loops-05" },
      { t: "lesson", id: "b7" },       { t: "lesson", id: "b10" },       { t: "ex", id: "ex-functions-01" },
      { t: "ex", id: "ex-functions-04" }
    
    ]
  },
  {
    id: "dsa", icon: "🧠", title: "DSA with Python",
    color: "#9d6bff", level: "Intermediate",
    desc: "Data structures and algorithms the Pythonic way — from lists to binary search.",
    steps: [
      { t: "lesson", id: "b6" },       { t: "lesson", id: "b9" },       { t: "ex", id: "ex-loops-03" },
      { t: "ex", id: "ex-loops-04" },       { t: "lesson", id: "i7" },       { t: "ex", id: "ex-collections-02" },
      { t: "ex", id: "ex-collections-04" },       { t: "lesson", id: "a8" },       { t: "ex", id: "ex-dsa-01" },
      { t: "ex", id: "ex-dsa-04" },       { t: "lesson", id: "a9" },       { t: "ex", id: "ex-dsa-02" },
      { t: "ex", id: "ex-functions-06" },       { t: "ex", id: "ex-dsa-05" },       { t: "ex", id: "ex-dsa-03" },
      { t: "ex", id: "ex-dsa-06" }
    
    ]
  },
  {
    id: "automation", icon: "🤖", title: "Automation & Scripting",
    color: "#22d3ee", level: "Intermediate",
    desc: "Make Python do your boring work: files, scripts, and bulletproof error handling.",
    steps: [
      { t: "lesson", id: "b10" },       { t: "lesson", id: "i9" },       { t: "ex", id: "ex-exceptions-02" },
      { t: "ex", id: "ex-exceptions-05" },       { t: "lesson", id: "i8" },       { t: "ex", id: "ex-exceptions-03" },
      { t: "ex", id: "ex-exceptions-04" },       { t: "ex", id: "ex-exceptions-06" },       { t: "lesson", id: "i11" },
      { t: "ex", id: "ex-functions-03" }
    
    ]
  },
  {
    id: "data", icon: "📊", title: "Data Analysis Basics",
    color: "#fbbf24", level: "Intermediate",
    desc: "From raw data to answers: collections, comprehensions, and file wrangling.",
    steps: [
      { t: "lesson", id: "b6" },       { t: "lesson", id: "b7" },       { t: "ex", id: "ex-collections-03" },
      { t: "ex", id: "ex-collections-04" },       { t: "ex", id: "ex-collections-05" },       { t: "lesson", id: "i7" },
      { t: "lesson", id: "i12" },       { t: "ex", id: "ex-strings-02" },       { t: "ex", id: "ex-strings-04" },
      { t: "ex", id: "ex-strings-06" },       { t: "lesson", id: "i9" },       { t: "ex", id: "ex-functions-02" }
    
    ]
  },
  {
    id: "interview", icon: "🎯", title: "Interview Prep",
    color: "#f472b6", level: "Advanced",
    desc: "The highest-yield problems and patterns for Python coding interviews.",
    steps: [
      { t: "lesson", id: "i7" },       { t: "ex", id: "ex-strings-03" },       { t: "ex", id: "ex-strings-06" },
      { t: "ex", id: "ex-collections-02" },       { t: "ex", id: "ex-collections-05" },       { t: "lesson", id: "a8" },
      { t: "ex", id: "ex-dsa-01" },       { t: "ex", id: "ex-dsa-04" },       { t: "ex", id: "ex-dsa-02" },
      { t: "lesson", id: "a9" },       { t: "ex", id: "ex-dsa-06" },       { t: "ex", id: "ex-loops-03" },
      { t: "ex", id: "ex-functions-05" },       { t: "ex", id: "ex-oop-03" },       { t: "ex", id: "ex-oop-04" },
      { t: "ex", id: "ex-oop-06" }
    
    ]
  }
];

/* ---------- Path enrollment: paths as keys ----------
   Enrolling in a path unlocks all of its lessons, even ones still
   locked in the sequential lesson chain. learn.js reads
   pathUnlockedLessons() to honor this.
   Shape: { <pathId>: { enrolled: bool, at: timestamp } } — per-path
   timestamps let sync.js merge enrollments across devices
   (last-write-wins per path; leaving writes a tombstone). */
(function () {
  "use strict";
  var KEY = "skillzify_enrolled_paths";
  function readMap() {
    var map = {};
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (Array.isArray(v)) v.forEach(function (id) { map[id] = { enrolled: true, at: 0 }; });
      else if (v && typeof v === "object") Object.keys(v).forEach(function (k) {
        var e = v[k] || {};
        map[k] = { enrolled: !!e.enrolled, at: e.at || 0 };
      });
    } catch (e) {}
    return map;
  }
  function writeMap(map) { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) {} }
  var P = window.SkillzifyPaths;
  if (!P) return;
  P.enrollMap = readMap;
  P.enrolled = function () {
    var m = readMap();
    return Object.keys(m).filter(function (k) { return m[k].enrolled; });
  };
  P.isEnrolled = function (id) { var m = readMap(); return !!(m[id] && m[id].enrolled); };
  P.enroll = function (id) { var m = readMap(); m[id] = { enrolled: true, at: Date.now() }; writeMap(m); };
  P.leave = function (id) { var m = readMap(); m[id] = { enrolled: false, at: Date.now() }; writeMap(m); };
  // lessonId -> pathId for every lesson step of every enrolled path
  P.pathUnlockedLessons = function () {
    var map = {}, m = readMap();
    P.forEach(function (p) {
      if (!(m[p.id] && m[p.id].enrolled)) return;
      (p.steps || []).forEach(function (s) {
        if (s.t === "lesson" && s.id) map[s.id] = p.id;
      });
    });
    return map;
  };
})();
