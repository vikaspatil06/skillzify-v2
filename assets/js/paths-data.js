/* Skillzify Learning Paths — guided sequences of lessons + exercises */
window.SkillzifyPaths = [
  {
    id: "fundamentals", icon: "🌱", title: "Python Fundamentals",
    desc: "Zero to confident: every core concept in the right order, with practice after each step.",
    steps: [
      { t: "lesson", id: "b1" }, { t: "lesson", id: "b2" }, { t: "ex", id: "ex-variables-01" },
      { t: "lesson", id: "b3" }, { t: "ex", id: "ex-strings-01" },
      { t: "lesson", id: "b8" }, { t: "lesson", id: "b6" }, { t: "ex", id: "ex-collections-01" },
      { t: "lesson", id: "b9" }, { t: "ex", id: "ex-loops-01" },
      { t: "lesson", id: "b7" }, { t: "lesson", id: "b10" }, { t: "ex", id: "ex-functions-01" }
    ]
  },
  {
    id: "dsa", icon: "🧠", title: "DSA with Python",
    desc: "Data structures and algorithms the Pythonic way — from lists to binary search.",
    steps: [
      { t: "lesson", id: "b6" }, { t: "lesson", id: "b9" }, { t: "ex", id: "ex-loops-03" },
      { t: "lesson", id: "i7" }, { t: "ex", id: "ex-collections-02" },
      { t: "lesson", id: "a8" }, { t: "ex", id: "ex-dsa-01" },
      { t: "lesson", id: "a9" }, { t: "ex", id: "ex-dsa-02" }, { t: "ex", id: "ex-dsa-03" }
    ]
  },
  {
    id: "automation", icon: "🤖", title: "Automation & Scripting",
    desc: "Make Python do your boring work: files, scripts, and bulletproof error handling.",
    steps: [
      { t: "lesson", id: "b10" }, { t: "lesson", id: "i9" }, { t: "ex", id: "ex-exceptions-02" },
      { t: "lesson", id: "i8" }, { t: "ex", id: "ex-exceptions-03" },
      { t: "lesson", id: "i11" }, { t: "ex", id: "ex-functions-03" }
    ]
  },
  {
    id: "data", icon: "📊", title: "Data Analysis Basics",
    desc: "From raw data to answers: collections, comprehensions, and file wrangling.",
    steps: [
      { t: "lesson", id: "b6" }, { t: "lesson", id: "b7" }, { t: "ex", id: "ex-collections-03" },
      { t: "lesson", id: "i7" }, { t: "lesson", id: "i12" }, { t: "ex", id: "ex-strings-02" },
      { t: "lesson", id: "i9" }, { t: "ex", id: "ex-functions-02" }
    ]
  },
  {
    id: "interview", icon: "🎯", title: "Interview Prep",
    desc: "The highest-yield problems and patterns for Python coding interviews.",
    steps: [
      { t: "lesson", id: "i7" }, { t: "ex", id: "ex-strings-03" },
      { t: "ex", id: "ex-collections-02" }, { t: "lesson", id: "a8" },
      { t: "ex", id: "ex-dsa-01" }, { t: "ex", id: "ex-dsa-02" },
      { t: "lesson", id: "a9" }, { t: "ex", id: "ex-loops-03" }, { t: "ex", id: "ex-oop-03" }
    ]
  }
];
