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
   pathUnlockedLessons() to honor this. Stored locally per device. */
(function () {
  "use strict";
  var KEY = "skillzify_enrolled_paths";
  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function write(ids) {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch (e) {}
  }
  var P = window.SkillzifyPaths;
  if (!P) return;
  P.enrolled = function () { return read(); };
  P.isEnrolled = function (id) { return read().indexOf(id) !== -1; };
  P.enroll = function (id) {
    var e = read();
    if (e.indexOf(id) === -1) { e.push(id); write(e); }
  };
  P.leave = function (id) {
    write(read().filter(function (x) { return x !== id; }));
  };
  // lessonId -> pathId for every lesson step of every enrolled path
  P.pathUnlockedLessons = function () {
    var map = {}, e = read();
    P.forEach(function (p) {
      if (e.indexOf(p.id) === -1) return;
      (p.steps || []).forEach(function (s) {
        if (s.t === "lesson" && s.id) map[s.id] = p.id;
      });
    });
    return map;
  };
})();
