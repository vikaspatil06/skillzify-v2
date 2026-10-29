/* ============================================================
   Skillzify v2 — learn.js
   Lesson catalog · progress checkboxes · per-track progress bars
   Progress is stored in localStorage key "skillzify_progress"
   as { lessonId: true }.
   ============================================================ */
(function () {
  "use strict";

  var PROGRESS_KEY = "skillzify_progress";

  var LESSONS = [
    /* ---------------- BEGINNER ---------------- */
    {
      id: "b1", track: "beginner", title: "Hello, Python! Your First Program",
      explain: "The print() function displays text on the screen. Text wrapped in quotes is called a string. This is the traditional first step in every programming language.",
      code: 'print("Hello, Skillzify!")\nprint("I am learning Python 🚀")'
    },
    {
      id: "b2", track: "beginner", title: "Variables & Data Types",
      explain: "Variables store values under a name. Python figures out the type automatically — int for whole numbers, float for decimals, str for text, and bool for True/False.",
      code: 'name = "Vikas"\nage = 20\nheight = 5.9\nis_student = True\n\nprint(name, age, height, is_student)\nprint(type(age))  # <class \'int\'>'
    },
    {
      id: "b3", track: "beginner", title: "Strings & f-strings",
      explain: "f-strings let you embed variables directly inside text using curly braces. They are the cleanest way to build messages in modern Python.",
      code: 'name = "Vikas"\nscore = 95\n\nmessage = f"{name} scored {score} marks!"\nprint(message)\nprint(name.upper())\nprint(len(name))'
    },
    {
      id: "b4", track: "beginner", title: "Conditionals: if / elif / else",
      explain: "Conditionals let your program make decisions. Python checks each condition top to bottom and runs the first block that is True. Indentation (4 spaces) defines the blocks.",
      code: 'marks = 82\n\nif marks >= 90:\n    print("Grade: A")\nelif marks >= 75:\n    print("Grade: B")\nelif marks >= 50:\n    print("Grade: C")\nelse:\n    print("Keep practicing!")'
    },
    {
      id: "b5", track: "beginner", title: "Loops: for & while",
      explain: "Loops repeat work. A for loop iterates over a sequence; range(n) gives numbers 0 to n-1. A while loop repeats while its condition stays True — be careful it can run forever!",
      code: 'print("For loop:")\nfor i in range(1, 6):\n    print(f"  2 x {i} = {2 * i}")\n\nprint("While loop:")\ncount = 3\nwhile count > 0:\n    print(f"  Countdown: {count}")\n    count -= 1\nprint("Go! 🚀")'
    },
    /* ---------------- INTERMEDIATE ---------------- */
    {
      id: "i1", track: "intermediate", title: "Functions & Return Values",
      explain: "Functions package reusable logic. def defines one, parameters receive input, and return sends a result back to the caller. Default parameters make arguments optional.",
      code: 'def greet(name, greeting="Hello"):\n    return f"{greeting}, {name}!"\n\ndef add(a, b):\n    return a + b\n\nprint(greet("Vikas"))\nprint(greet("Sara", greeting="Welcome"))\nprint("Sum:", add(7, 5))'
    },
    {
      id: "i2", track: "intermediate", title: "Lists, Tuples & Dictionaries",
      explain: "Lists are ordered and changeable; tuples are ordered but fixed; dictionaries map keys to values. These three cover most data you'll work with.",
      code: 'skills = ["Python", "HTML", "CSS"]\nskills.append("JavaScript")\nprint(skills[0], "→", skills[-1])\n\npoint = (18.5, 73.7)  # tuple: (lat, lon)\nprint("Pune coords:", point)\n\nstudent = {"name": "Vikas", "track": "CSE", "cgpa": 8.6}\nprint(student["name"], "studies", student["track"])\nprint("Keys:", list(student.keys()))'
    },
    {
      id: "i3", track: "intermediate", title: "Error Handling with try/except",
      explain: "Errors (exceptions) crash programs unless handled. Wrap risky code in try, catch problems with except, and use finally for cleanup. Always handle specific errors when you can.",
      code: 'def safe_divide(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return "Cannot divide by zero!"\n    except TypeError:\n        return "Numbers only, please."\n\nprint(safe_divide(10, 2))\nprint(safe_divide(10, 0))'
    },
    {
      id: "i4", track: "intermediate", title: "OOP Basics: Classes & Objects",
      explain: "Classes are blueprints; objects are the things built from them. __init__ sets up each object, self refers to the object itself, and methods are functions that belong to the class.",
      code: 'class Student:\n    def __init__(self, name, track):\n        self.name = name\n        self.track = track\n        self.xp = 0\n\n    def complete_lesson(self, points=10):\n        self.xp += points\n        return f"{self.name} earned {points} XP (total {self.xp})"\n\ns = Student("Vikas", "CSE")\nprint(s.complete_lesson())\nprint(s.complete_lesson(20))'
    },
    /* ---------------- ADVANCED ---------------- */
    {
      id: "a1", track: "advanced", title: "List Comprehensions & Lambdas",
      explain: "Comprehensions build lists in one expressive line. Lambdas are tiny anonymous functions — perfect for short transformations passed to map, filter, or sorted.",
      code: 'squares = [x**2 for x in range(1, 11)]\nprint("Squares:", squares)\n\nevens = [x for x in range(20) if x % 2 == 0]\nprint("Evens:", evens)\n\nnums = [5, 2, 9, 1]\nprint("Sorted desc:", sorted(nums, key=lambda x: -x))'
    },
    {
      id: "a2", track: "advanced", title: "Generators & yield",
      explain: "Generators produce values lazily, one at a time, using almost no memory. yield pauses the function and resumes where it left off — ideal for large or infinite sequences.",
      code: 'def fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        yield a\n        a, b = b, a + b\n\nprint(list(fibonacci(10)))\n\n# Memory-friendly: squares of 1M numbers, one at a time\ngen = (x**2 for x in range(1_000_000))\nprint("First 3:", [next(gen) for _ in range(3)])'
    },
    {
      id: "a3", track: "advanced", title: "Decorators",
      explain: "Decorators wrap functions to add behaviour — timing, logging, access control — without changing the function's code. The @ syntax applies them cleanly.",
      code: 'import time\nfrom functools import wraps\n\ndef timer(func):\n    @wraps(func)\n    def wrapper(*args, **kwargs):\n        start = time.time()\n        result = func(*args, **kwargs)\n        print(f"{func.__name__} took {time.time()-start:.4f}s")\n        return result\n    return wrapper\n\n@timer\ndef slow_add(a, b):\n    time.sleep(0.2)\n    return a + b\n\nprint(slow_add(3, 4))'
    },
    {
      id: "a4", track: "advanced", title: "Modules, pip & Virtual Environments",
      explain: "Modules organise code into files. pip installs third-party packages; virtual environments isolate each project's dependencies so they never clash. This is the professional workflow.",
      code: '# mymath.py  →  import mymath\n# def square(x): return x * x\n\n# In your terminal:\n#   python -m venv venv        # create isolated environment\n#   source venv/bin/activate   # activate (Windows: venv\\\\Scripts\\\\activate)\n#   pip install requests       # install a package\n#   pip freeze > requirements.txt   # lock dependencies\n\nimport math, random\nprint("π ≈", round(math.pi, 4))\nprint("Lucky number:", random.randint(1, 100))'
    }
  ];

  var TRACKS = [
    { id: "beginner", name: "Beginner", desc: "Zero to confident — syntax, variables, logic and loops.", icon: "🌱" },
    { id: "intermediate", name: "Intermediate", desc: "Functions, data structures, errors and OOP.", icon: "⚙️" },
    { id: "advanced", name: "Advanced", desc: "Pythonic mastery — generators, decorators and tooling.", icon: "🚀" }
  ];

  function getProgress() {
    return window.Skillzify.storeGet(PROGRESS_KEY, {});
  }
  function saveProgress(p) {
    window.Skillzify.storeSet(PROGRESS_KEY, p);
  }
  function trackLessons(trackId) {
    return LESSONS.filter(function (l) { return l.track === trackId; });
  }
  function trackPct(trackId) {
    var ls = trackLessons(trackId);
    var p = getProgress();
    var done = ls.filter(function (l) { return p[l.id]; }).length;
    return ls.length ? Math.round((done / ls.length) * 100) : 0;
  }

  function tryInCompiler(code) {
    try { localStorage.setItem("skillzify_compiler_code", code); } catch (e) {}
    location.href = "compiler.html";
  }

  function copyCode(btn, code) {
    var done = function () {
      btn.textContent = "✓ Copied";
      setTimeout(function () { btn.textContent = "⧉ Copy"; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, function () {
        fallbackCopy(code); done();
      });
    } else { fallbackCopy(code); done(); }
  }
  function fallbackCopy(code) {
    var ta = document.createElement("textarea");
    ta.value = code;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  function renderTabs(active) {
    var wrap = document.getElementById("track-tabs");
    wrap.innerHTML = "";
    TRACKS.forEach(function (t) {
      var b = document.createElement("button");
      b.className = "track-tab" + (t.id === active ? " active" : "");
      b.textContent = t.icon + " " + t.name + " (" + trackLessons(t.id).length + ")";
      b.addEventListener("click", function () { renderTrack(t.id); });
      wrap.appendChild(b);
    });
  }

  function renderProgress() {
    var box = document.getElementById("progress-box");
    if (!box) return;
    var p = getProgress();
    var total = LESSONS.length;
    var done = LESSONS.filter(function (l) { return p[l.id]; }).length;
    var html = '<div class="progress-row"><span class="lbl">Overall</span>' +
      '<div class="bar"><span style="width:' + Math.round(done / total * 100) + '%"></span></div>' +
      '<span class="pct">' + done + "/" + total + "</span></div>";
    TRACKS.forEach(function (t) {
      var pct = trackPct(t.id);
      html += '<div class="progress-row"><span class="lbl">' + t.icon + " " + t.name + "</span>" +
        '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
        '<span class="pct">' + pct + "%</span></div>";
    });
    box.innerHTML = html;
  }

  function renderTrack(trackId) {
    renderTabs(trackId);
    var track = TRACKS.filter(function (t) { return t.id === trackId; })[0];
    var list = document.getElementById("lesson-list");
    var p = getProgress();
    var html = '<p class="section-sub" style="margin-bottom:20px">' + track.icon + " " + track.desc + "</p>";
    trackLessons(trackId).forEach(function (l, idx) {
      var done = !!p[l.id];
      html += '<article class="lesson' + (done ? " done" : "") + '" id="lesson-' + l.id + '">' +
        '<div class="lesson-head">' +
        '<input type="checkbox" class="lesson-check" data-id="' + l.id + '"' + (done ? " checked" : "") + ' aria-label="Mark lesson complete">' +
        "<div><h3>Lesson " + (idx + 1) + ": " + window.Skillzify.esc(l.title) + "</h3>" +
        '<p class="explain">' + window.Skillzify.esc(l.explain) + "</p></div></div>" +
        '<div class="code-window"><div class="cw-bar"><span class="cw-dot" style="background:#f87171"></span><span class="cw-dot" style="background:#fbbf24"></span><span class="cw-dot" style="background:#34d399"></span></div>' +
        "<pre><code>" + window.Skillzify.esc(l.code) + "</code></pre></div>" +
        '<div class="lesson-actions">' +
        '<button class="btn btn-sm btn-ghost" data-copy="' + l.id + '">⧉ Copy</button>' +
        '<button class="btn btn-sm" data-try="' + l.id + '">▶ Try in compiler</button>' +
        "</div></article>";
    });
    list.innerHTML = html;

    list.querySelectorAll(".lesson-check").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var prog = getProgress();
        if (cb.checked) prog[cb.dataset.id] = true; else delete prog[cb.dataset.id];
        saveProgress(prog);
        cb.closest(".lesson").classList.toggle("done", cb.checked);
        renderProgress();
        if (cb.checked) window.Skillzify.toast("Lesson complete — nice work! ✅", "success");
      });
    });
    list.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var l = LESSONS.filter(function (x) { return x.id === b.dataset.copy; })[0];
        copyCode(b, l.code);
      });
    });
    list.querySelectorAll("[data-try]").forEach(function (b) {
      b.addEventListener("click", function () {
        var l = LESSONS.filter(function (x) { return x.id === b.dataset.try; })[0];
        tryInCompiler(l.code);
      });
    });
    renderProgress();
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("lesson-list")) return;
    renderProgress();
    renderTrack("beginner");
  });

  window.SkillzifyLearn = {
    LESSONS: LESSONS, TRACKS: TRACKS,
    getProgress: getProgress, trackPct: trackPct,
    totalLessons: LESSONS.length
  };
})();
