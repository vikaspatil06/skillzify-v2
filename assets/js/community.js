/* Skillzify Community — Phase 1: anchored Q&A + showcase + public profiles.
   Firestore collections: questions, answers, showcase, publicProfiles, xpGrants.
   Reads are public; writes need a signed-in user (rules in firestore.rules).
   Queries are deliberately index-free: single orderBy/where only, the rest is
   filtered client-side, so no composite indexes are needed. */
(function () {
  "use strict";

  var LESSON_TITLES = {"b1":"Hello, Python! Your First Program","b2":"Variables & Data Types","b3":"Strings & f-strings","b4":"Conditionals: if / elif / else","b5":"Loops: for & while","b6":"Lists & Tuples","b7":"Dictionaries & Sets","b8":"Conditionals & Logic","b9":"Loops: for & while — Practice","b10":"Functions","i1":"Functions & Return Values","i2":"Lists, Tuples & Dictionaries","i3":"Error Handling with try/except","i4":"OOP Basics: Classes & Objects","i5":"Recursion: Functions That Call Themselves","i6":"File Handling: Read & Write Files","i7":"List Comprehensions","i8":"Error Handling","i9":"File Handling","i10":"OOP Basics","i11":"Modules & Imports","i12":"Lambda, map, filter","a1":"List Comprehensions & Lambdas","a2":"Generators & yield","a3":"Decorators","a4":"Modules, pip & Virtual Environments","a5":"Context Managers & the with Statement","a6":"Decorators in Practice","a7":"Generators & Iterators","a8":"Recursion","a9":"Sorting & Searching","a10":"Dictionaries in Depth","b11":"Numbers & Math in Python","b12":"String Methods You Will Use Daily","b13":"Slicing & Indexing Strings","b14":"List Methods in Depth","b15":"Tuples: Unpacking & Immutability","b16":"Dictionary Methods in Depth","b17":"Set Operations: Union, Intersection & Difference","b18":"Type Conversion & the input() Function","b19":"Boolean Logic: and, or, not","b20":"Nested Loops & Patterns","b21":"break, continue & Loop else","b22":"Function Arguments: Defaults & Keywords","b23":"Scope: Local vs Global","b24":"Docstrings & Getting Help","b25":"The random Module: Build a Guessing Game","b26":"Dates & Times with datetime","b27":"None & Checking for Nothing","b28":"Comments & Clean Code Style","b29":"Reading Tracebacks: Debugging Basics","b30":"Capstone: Command-Line To-Do App","i13":"*args & **kwargs","i14":"Advanced String Formatting","i15":"enumerate, zip & Unpacking in Loops","i16":"Dict & Set Comprehensions","i17":"Sorting with key Functions","i18":"Copy vs Deep Copy: The Mutation Trap","i19":"Exception Hierarchy & Custom Exceptions","i20":"Raising Exceptions & Assertions","i21":"try/except/else/finally: The Full Picture","i22":"Working with CSV Files","i23":"JSON: Reading & Writing Data","i24":"Files & Folders with pathlib","i25":"OOP: Inheritance","i26":"OOP: Encapsulation with @property","i27":"OOP: Dunder Methods (__str__, __len__, __eq__)","i28":"OOP: Class vs Instance, @classmethod & @staticmethod","i29":"Iterators & the Iterator Protocol","i30":"Generator Expressions & itertools","i31":"Recursion Patterns & Limits","i32":"Closures & Higher-Order Functions","i33":"Big-O Intuition & Timing Code","i34":"Regular Expressions Basics","i35":"Capstone: File Organizer Script","a11":"Decorators with Arguments & functools.wraps","a12":"Concurrency I: Threading Basics","a13":"Concurrency II: asyncio Basics","a14":"The GIL & Multiprocessing","a15":"Writing Your Own Context Managers","a16":"Generators: send(), Coroutines & Pipelines","a17":"Descriptors & the Descriptor Protocol","a18":"How Classes Work: type() & Metaclasses Intro","a19":"functools Toolkit: lru_cache, partial, reduce","a20":"Dataclasses: Less Boilerplate OOP","a21":"Type Hints & Static Checking","a22":"Logging Done Right","a23":"Debugging with pdb","a24":"Packaging: Ship Your Own pip Package","a25":"Design Patterns in Python","a26":"SQLite Databases with Python","a27":"Talking to APIs: requests & JSON","a28":"Profiling & Optimization","a29":"Capstone: argparse CLI Application","a30":"Pythonic Idioms Masterclass","b31":"F-strings in Depth: Formatting Numbers & Dates","b32":"String Building: join() vs + in Loops","b33":"Working with User Input: Validation Basics","b34":"Numbers: Rounding, abs, min/max in Practice","b35":"Comparisons & Chaining Conditions","b36":"Truthiness: What Counts as False?","b37":"while Loops: Sentinels & Menus","b38":"for Loops over Dictionaries","b39":"List Comprehension: A Gentle First Look","b40":"Dictionaries in Practice: Counting & Grouping","b41":"Sets in Practice: Deduplication","b42":"Tuples in Practice: Returning Multiple Values","b43":"Functions: Return vs Print","b44":"Functions: Passing Lists & Dicts","b45":"Default Arguments & the Mutable Default Trap","b46":"Errors You Will Meet: NameError, TypeError, IndexError","b47":"Reading & Writing Text Files: A Gentle Start","b48":"The math Module: Everyday Helpers","b49":"The string Module & Constants","b50":"Guided Project: Number Guessing Game","b51":"Guided Project: Simple Quiz App","b52":"Guided Project: Rock, Paper, Scissors","b53":"Guided Project: Password Generator","b54":"Guided Project: Simple Calculator with Functions","b55":"Guided Project: Word Counter Script","b56":"Lists of Dictionaries: Tiny Address Book","b57":"Sorting Simple Data with sorted()","b58":"min/max with key: Picking Winners","b59":"any() & all(): Quick Checks","b60":"zip() in Practice: Pairing Data","b61":"enumerate() in Practice: Numbered Lists","b62":"Working with Dates: Birthdays & Deadlines","b63":"Time Delays & Timers with time","b64":"Command-Line Arguments Basics (sys.argv)","b65":"Environment Variables & Secrets Basics","b66":"JSON Basics: Saving Your Data","b67":"Debugging with print(): A Systematic Approach","b68":"Code Style: Naming Things Well","b69":"Capstone: Personal Expense Tracker","b70":"Capstone: Flashcard Quiz App","i36":"Big-O in Practice: Measuring What Matters","i37":"Arrays vs Lists: How Python Lists Work","i38":"Two Pointers Technique","i39":"Sliding Window Technique","i40":"Prefix Sums","i41":"Hash Maps in Practice: Frequency Counting","i42":"Anagram & Grouping Problems","i43":"Stacks: Balanced Parentheses","i44":"Queues: Print Spooler Simulation","i45":"Deques with collections.deque","i46":"Linked Lists: Building Your Own","i47":"Linked Lists: Reversal & Cycle Detection","i48":"Recursion: Base Cases & the Call Stack","i49":"Recursion: Memoization Basics","i50":"Binary Search, Step by Step","i51":"Sorting: Bubble, Selection, Insertion","i52":"Sorting: Merge Sort","i53":"Sorting: Quick Sort","i54":"Sorting in Python: sorted() & sort() Deep Dive","i55":"Trees: Binary Tree Basics","i56":"Trees: Traversals (Preorder, Inorder, Postorder)","i57":"Trees: Binary Search Trees","i58":"Heaps: Priority Queues with heapq","i59":"Graphs: Adjacency Lists & Matrices","i60":"Graphs: BFS","i61":"Graphs: DFS","i62":"Graphs: Shortest Path Intuition (Dijkstra)","i63":"Dynamic Programming: Fibonacci & Climbing Stairs","i64":"Dynamic Programming: Knapsack Intuition","i65":"Greedy Algorithms: When Greedy Works","i66":"Backtracking: N-Queens Intuition","i67":"Bit Manipulation Basics","i68":"Strings: Palindromes & Reversals","i69":"Strings: Pattern Matching Basics","i70":"Interview Patterns: Top K Elements","i71":"Interview Patterns: Fast & Slow Pointers","i72":"Interview Patterns: Intervals","i73":"Complexity Analysis: Time vs Space","i74":"Testing Your Algorithms: Writing Good Tests","i75":"The collections Module: Counter, defaultdict, OrderedDict","i76":"The itertools Module: Combinations & Permutations","i77":"bisect: Searching Sorted Lists","i78":"functools: Caching Recursive Functions","i79":"Generators for Large Data","i80":"Working with Large Files Efficiently","i81":"CSV in Depth: Real-World Data Cleaning","i82":"JSON APIs: Fetching Real Data","i83":"Error Handling in Real Programs","i84":"Logging in Practice","i85":"Virtual Environments in Practice","i86":"Writing Reusable Modules","i87":"Type Hints in Practice","i88":"Capstone: Phonebook with Search","i89":"Capstone: Sorting Visualizer (Text-Based)","i90":"Capstone: Mini Search Engine","a31":"OOP: Composition over Inheritance","a32":"OOP: Abstract Base Classes","a33":"OOP: Mixins & Multiple Inheritance","a34":"OOP: __slots__ & Memory","a35":"OOP: Properties in Depth","a36":"Descriptors in Practice","a37":"Metaclasses in Practice","a38":"Decorators: Building a Timer & Cache","a39":"Decorators: Retry & Rate Limiting","a40":"Context Managers: @contextmanager","a41":"Asyncio: Tasks & Gathering Results","a42":"Asyncio: Async File & Network IO","a43":"Threading: Locks & Race Conditions","a44":"Multiprocessing: Pools & Queues","a45":"Testing: pytest Fundamentals","a46":"Testing: Fixtures & Parametrize","a47":"Testing: Mocking External Services","a48":"Testing: Coverage & CI Basics","a49":"Data Science: NumPy Arrays","a50":"Data Science: NumPy Indexing & Broadcasting","a51":"Data Science: pandas Series & DataFrames","a52":"Data Science: Cleaning Data with pandas","a53":"Data Science: GroupBy & Aggregation","a54":"Data Science: Merging & Joining Data","a55":"Data Science: Visualizing with matplotlib","a56":"Data Science: Descriptive Statistics","a57":"Data Science: Linear Regression Intuition","a58":"Data Science: Train/Test Splits","a59":"ML: scikit-learn First Model","a60":"ML: Classification vs Regression","a61":"ML: Feature Engineering Basics","a62":"ML: Evaluating Models","a63":"Web: HTTP Basics for Python Devs","a64":"Web: Flask First App","a65":"Web: Flask Routing & Templates","a66":"Web: Flask Forms & Validation","a67":"Web: REST APIs with Flask","a68":"Web: FastAPI First App","a69":"Web: Authentication Basics (Sessions & Tokens)","a70":"Web: Talking to Databases (SQLAlchemy Intro)","a71":"Automation: Scripting Your OS with os & shutil","a72":"Automation: Web Scraping Basics","a73":"Automation: Working with Excel Files (openpyxl)","a74":"Automation: Sending Emails with Python","a75":"Automation: Scheduling Tasks","a76":"Packaging: Wheels, pyproject & Publishing","a77":"Profiling: Finding Bottlenecks","a78":"Caching Strategies: lru_cache & Redis Intro","a79":"Design Patterns: Singleton, Factory, Observer","a80":"Design Patterns: Strategy & Adapter","a81":"Code Quality: Linting with Ruff & Black","a82":"Git for Python Devs: A Practical Workflow","a83":"Capstone: REST API with Flask & SQLite","a84":"Capstone: Data Analysis Project (Real Dataset)","a85":"Capstone: Full-Stack Mini App","a86":"Asyncio: Web Scraping at Scale","a87":"ML: Text Classification Project","a88":"Web: Deploying a Flask App","a89":"Data Science: Time Series Basics","a90":"Capstone: Personal AI Assistant CLI"};
  var LESSON_SECTIONS = {"b1":"base-camp","b2":"base-camp","b3":"base-camp","b4":"base-camp","b5":"base-camp","b6":"base-camp","b7":"base-camp","b8":"base-camp","b9":"base-camp","b10":"base-camp","b11":"base-camp","b12":"base-camp","b13":"base-camp","b18":"base-camp","b19":"base-camp","b20":"base-camp","b21":"base-camp","b22":"base-camp","b23":"base-camp","b24":"base-camp","b25":"base-camp","b26":"base-camp","b27":"base-camp","b28":"base-camp","b29":"base-camp","b30":"base-camp","b31":"base-camp","b32":"base-camp","b33":"base-camp","b34":"base-camp","b35":"base-camp","b36":"base-camp","b37":"base-camp","b38":"base-camp","b39":"base-camp","b43":"base-camp","b44":"base-camp","b45":"base-camp","b46":"base-camp","b48":"base-camp","b49":"base-camp","b50":"base-camp","b51":"base-camp","b52":"base-camp","b53":"base-camp","b54":"base-camp","b55":"base-camp","b62":"base-camp","b63":"base-camp","b64":"base-camp","b65":"base-camp","b67":"base-camp","b68":"base-camp","b69":"base-camp","b70":"base-camp","i1":"base-camp","b14":"tool-shed","b15":"tool-shed","b16":"tool-shed","b17":"tool-shed","b40":"tool-shed","b41":"tool-shed","b42":"tool-shed","b47":"tool-shed","b56":"tool-shed","b57":"tool-shed","b58":"tool-shed","b59":"tool-shed","b60":"tool-shed","b61":"tool-shed","b66":"tool-shed","i2":"tool-shed","i6":"tool-shed","i7":"tool-shed","i9":"tool-shed","i11":"tool-shed","i14":"tool-shed","i15":"tool-shed","i16":"tool-shed","i18":"tool-shed","i22":"tool-shed","i23":"tool-shed","i24":"tool-shed","i35":"tool-shed","i75":"tool-shed","i76":"tool-shed","i77":"tool-shed","i80":"tool-shed","i86":"tool-shed","a10":"tool-shed","i4":"object-castle","i10":"object-castle","i25":"object-castle","i26":"object-castle","i27":"object-castle","i28":"object-castle","a5":"object-castle","a15":"object-castle","a17":"object-castle","a18":"object-castle","a20":"object-castle","a25":"object-castle","a31":"object-castle","a32":"object-castle","a33":"object-castle","a34":"object-castle","a35":"object-castle","a36":"object-castle","a37":"object-castle","a79":"object-castle","a80":"object-castle","i5":"algorithm-arena","i17":"algorithm-arena","i31":"algorithm-arena","i33":"algorithm-arena","i34":"algorithm-arena","i36":"algorithm-arena","i37":"algorithm-arena","i38":"algorithm-arena","i39":"algorithm-arena","i40":"algorithm-arena","i41":"algorithm-arena","i42":"algorithm-arena","i43":"algorithm-arena","i44":"algorithm-arena","i45":"algorithm-arena","i46":"algorithm-arena","i47":"algorithm-arena","i48":"algorithm-arena","i49":"algorithm-arena","i50":"algorithm-arena","i51":"algorithm-arena","i52":"algorithm-arena","i53":"algorithm-arena","i54":"algorithm-arena","i55":"algorithm-arena","i56":"algorithm-arena","i57":"algorithm-arena","i58":"algorithm-arena","i59":"algorithm-arena","i60":"algorithm-arena","i61":"algorithm-arena","i62":"algorithm-arena","i63":"algorithm-arena","i64":"algorithm-arena","i65":"algorithm-arena","i66":"algorithm-arena","i67":"algorithm-arena","i68":"algorithm-arena","i69":"algorithm-arena","i70":"algorithm-arena","i71":"algorithm-arena","i72":"algorithm-arena","i73":"algorithm-arena","i78":"algorithm-arena","i88":"algorithm-arena","i89":"algorithm-arena","i90":"algorithm-arena","a8":"algorithm-arena","a9":"algorithm-arena","i3":"power-lab","i8":"power-lab","i12":"power-lab","i13":"power-lab","i19":"power-lab","i20":"power-lab","i21":"power-lab","i29":"power-lab","i30":"power-lab","i32":"power-lab","i74":"power-lab","i79":"power-lab","i83":"power-lab","i84":"power-lab","i85":"power-lab","i87":"power-lab","a1":"power-lab","a2":"power-lab","a3":"power-lab","a4":"power-lab","a6":"power-lab","a7":"power-lab","a11":"power-lab","a12":"power-lab","a13":"power-lab","a14":"power-lab","a16":"power-lab","a19":"power-lab","a21":"power-lab","a22":"power-lab","a23":"power-lab","a24":"power-lab","a28":"power-lab","a30":"power-lab","a38":"power-lab","a39":"power-lab","a40":"power-lab","a41":"power-lab","a42":"power-lab","a43":"power-lab","a44":"power-lab","a45":"power-lab","a46":"power-lab","a47":"power-lab","a48":"power-lab","a76":"power-lab","a77":"power-lab","a78":"power-lab","a81":"power-lab","i81":"data-lab","i82":"data-lab","a49":"data-lab","a50":"data-lab","a51":"data-lab","a52":"data-lab","a53":"data-lab","a54":"data-lab","a55":"data-lab","a56":"data-lab","a57":"data-lab","a58":"data-lab","a59":"data-lab","a60":"data-lab","a61":"data-lab","a62":"data-lab","a84":"data-lab","a87":"data-lab","a89":"data-lab","a26":"launch-pad","a27":"launch-pad","a29":"launch-pad","a63":"launch-pad","a64":"launch-pad","a65":"launch-pad","a66":"launch-pad","a67":"launch-pad","a68":"launch-pad","a69":"launch-pad","a70":"launch-pad","a71":"launch-pad","a72":"launch-pad","a73":"launch-pad","a74":"launch-pad","a75":"launch-pad","a82":"launch-pad","a83":"launch-pad","a85":"launch-pad","a86":"launch-pad","a88":"launch-pad","a90":"launch-pad"};
  var SECTIONS_META = [["base-camp","\u{1F331} Base Camp"],["tool-shed","\u{1F9F1} Tool Shed"],["object-castle","\u{1F3EF} Object Castle"],["algorithm-arena","\u{1F9E0} Algorithm Arena"],["power-lab","\u26A1 Power Lab"],["data-lab","\u{1F4CA} Data Lab"],["launch-pad","\u{1F680} Launch Pad"]];

  var _testDb = null;
  function db() {
    if (_testDb) return _testDb;
    try {
      if (!window.firebase || !window.firebase.firestore) return null;
      if (!window.firebase.apps || !window.firebase.apps.length) return null;
      return window.firebase.firestore();
    } catch (e) { return null; }
  }
  function ts() {
    try {
      if (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue)
        return window.firebase.firestore.FieldValue.serverTimestamp();
    } catch (e) {}
    return Date.now();
  }
  // FieldValue.increment sentinel when the Firestore SDK is present;
  // null when it is not (e.g. the audit harness stub), so callers can
  // fall back to a plain numeric update.
  function incrementValue(n) {
    try {
      var FV = window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue;
      if (FV && typeof FV.increment === "function") return FV.increment(n);
    } catch (e) {}
    return null;
  }
  function currentUser() {
    try { return window.SkillzifyAuth ? window.SkillzifyAuth.currentUser() : null; } catch (e) { return null; }
  }
  function toMs(v) {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    if (v.toMillis) { try { return v.toMillis(); } catch (e) { return 0; } }
    if (v.seconds) return v.seconds * 1000;
    return 0;
  }
  function normDoc(doc) {
    var d = doc.data() || {};
    d.id = doc.id;
    d.createdAt = toMs(d.createdAt);
    d.updatedAt = toMs(d.updatedAt);
    return d;
  }
  function lessonTitle(id) { return (id && LESSON_TITLES[id]) || ""; }

  /* ---------------- validation (pure) ---------------- */
  function validateQuestion(q) {
    q = q || {};
    var title = String(q.title || "").trim();
    if (title.length < 5) return "Give your question a title (at least 5 characters).";
    if (title.length > 140) return "Keep the title under 140 characters.";
    if (String(q.body || "").length > 4000) return "Keep the details under 4,000 characters.";
    if (String(q.code || "").length > 20000) return "Keep the code under 20,000 characters.";
    return null;
  }
  function validateShowcase(p) {
    p = p || {};
    var title = String(p.title || "").trim();
    if (title.length < 3) return "Give your project a title (at least 3 characters).";
    if (title.length > 100) return "Keep the title under 100 characters.";
    if (String(p.desc || "").length > 2000) return "Keep the description under 2,000 characters.";
    if (!String(p.code || "").trim()) return "Add the code for your project so others can run it.";
    if (String(p.code || "").length > 20000) return "Keep the code under 20,000 characters.";
    return null;
  }
  function filterQuestions(qs, filter, uid) {
    if (filter === "unanswered") return qs.filter(function (q) { return q.status !== "answered"; });
    if (filter === "mine") return qs.filter(function (q) { return !!uid && q.authorUid === uid; });
    return qs.slice();
  }
  function pickFeatured(posts, nowMs) {
    var week = 7 * 24 * 3600 * 1000, best = null;
    (posts || []).forEach(function (p) {
      var t = p.createdAt || 0;
      if (nowMs - t > week) return;
      if (!best || (p.starCount || 0) > (best.starCount || 0) ||
        ((p.starCount || 0) === (best.starCount || 0) && t > best.createdAt)) best = p;
    });
    return best;
  }

  function sectionOfLesson(id) { return LESSON_SECTIONS[id] || null; }
  function sectionName(id) {
    for (var i = 0; i < SECTIONS_META.length; i++) if (SECTIONS_META[i][0] === id) return SECTIONS_META[i][1];
    return id || "";
  }
  function lessonList() {
    // Journey order: by section, then by original catalog order within a
    // section (track prefix b < i < a, numeric within the prefix).
    var secOrder = {}, prefix = { b: 0, i: 1, a: 2 };
    SECTIONS_META.forEach(function (s, i) { secOrder[s[0]] = i; });
    return Object.keys(LESSON_TITLES).map(function (id) {
      return { id: id, title: LESSON_TITLES[id], section: sectionOfLesson(id), sectionName: sectionName(sectionOfLesson(id)) };
    }).sort(function (x, y) {
      var sx = secOrder[x.section] != null ? secOrder[x.section] : 99;
      var sy = secOrder[y.section] != null ? secOrder[y.section] : 99;
      if (sx !== sy) return sx - sy;
      var lx = x.id.charAt(0), ly = y.id.charAt(0);
      if (lx !== ly) return (prefix[lx] || 0) - (prefix[ly] || 0);
      return parseInt(x.id.slice(1), 10) - parseInt(y.id.slice(1), 10);
    });
  }
  function filterByQuery(qs, query) {
    query = String(query || "").trim().toLowerCase();
    if (!query) return (qs || []).slice();
    return (qs || []).filter(function (q) {
      var hay = [q.title, q.body, q.authorName, lessonTitle(q.lessonId)].join(" ").toLowerCase();
      return hay.indexOf(query) >= 0;
    });
  }

  /* ---------------- questions ---------------- */
  function askQuestion(input) {
    var err = validateQuestion(input);
    if (err) return Promise.reject(new Error(err));
    var u = currentUser();
    if (!u) return Promise.reject(new Error("Sign in to ask a question."));
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    var now = ts();
    return d.collection("questions").add({
      authorUid: u.uid, authorName: u.name,
      title: String(input.title).trim(),
      body: String(input.body || ""), code: String(input.code || ""),
      lessonId: input.lessonId || null, exId: input.exId || null, error: input.error || null,
      status: "open", bestAnswerId: null, answerCount: 0,
      createdAt: now, updatedAt: now
    }).then(function (ref) { return ref.id; });
  }
  function listQuestions(opts) {
    opts = opts || {};
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    var q = d.collection("questions");
    // P2-33: the "mine" and lesson views filter server-side, so they can
    // reach past the 50 most recent questions instead of coming back
    // empty when no match is in the first page. Single-field equality
    // filters need no composite index.
    var u0 = currentUser();
    if (opts.filter === "mine" && u0) q = q.where("authorUid", "==", u0.uid);
    if (opts.lessonId) q = q.where("lessonId", "==", opts.lessonId);
    q = q.orderBy("createdAt", "desc");
    /* P2-20: page through older questions with startAfter instead of
       stopping at the 50 most recent. The harness fake DB has no
       startAfter — guard so it keeps returning page 1 there. */
    if (opts.after && q.startAfter) q = q.startAfter(opts.after);
    return q.limit(50).get().then(function (snap) {
      var out = [];
      var last = null, n = 0;
      snap.forEach(function (doc) { out.push(normDoc(doc)); last = doc; n++; });
      var cursor = last, hasMore = n === 50;
      var u = currentUser();
      // filterQuestions stays as a safety net ("unanswered" is still
      // client-side; "mine" is a no-op here after the server-side where).
      out = filterQuestions(out, opts.filter || "all", u ? u.uid : null);
      /* Cursor + has-more ride on the array so callers keep the same
         shape (the harness asserts qs.length / qs[0].id). */
      out._cursor = cursor;
      out._hasMore = hasMore;
      /* P1-14: the stored answerCount is client-writable (the rules can
         only check +1 per write), so the displayed count is recomputed
         from the answers query instead of trusting the stored value.
         The stored counter is still bumped on post (P1-15) for compat;
         if a count query fails, that question keeps its stored value. */
      var counts = out.map(function (q) {
        return countAnswers(q.id).then(function (n) { q.answerCount = n; }, function () {});
      });
      return Promise.all(counts).then(function () { return out; });
    });
  }
  function getQuestion(id) {
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    return d.collection("questions").doc(id).get().then(function (doc) {
      return doc.exists ? normDoc(doc) : null;
    });
  }
  function listAnswers(questionId) {
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    return d.collection("answers").where("questionId", "==", questionId).limit(100).get().then(function (snap) {
      var out = [];
      snap.forEach(function (doc) { out.push(normDoc(doc)); });
      out.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      return out;
    });
  }
  /* P1-14: the true answer count, counted from the answers query. */
  function countAnswers(questionId) {
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    return d.collection("answers").where("questionId", "==", questionId).limit(100).get().then(function (snap) {
      var n = 0;
      snap.forEach(function () { n++; });
      return n;
    });
  }
  function postAnswer(questionId, input) {
    input = input || {};
    if (!String(input.body || "").trim()) return Promise.reject(new Error("Write an answer first."));
    if (String(input.body).length > 4000) return Promise.reject(new Error("Keep the answer under 4,000 characters."));
    if (String(input.code || "").length > 20000) return Promise.reject(new Error("Keep the code under 20,000 characters."));
    var u = currentUser();
    if (!u) return Promise.reject(new Error("Sign in to answer."));
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    var now = ts();
    // P2-32: read the question FIRST — answering a deleted/nonexistent
    // question used to create an orphan answer (the add ran before any
    // read, and the missing-question branch silently accepted it).
    return d.collection("questions").doc(questionId).get().then(function (qdoc) {
      if (!qdoc.exists) throw new Error("Question not found.");
      return d.collection("answers").add({
        questionId: questionId, authorUid: u.uid, authorName: u.name,
        body: String(input.body), code: String(input.code || ""),
        createdAt: now, isBest: false
      });
    }).then(function (ref) {
      // P1-15: bump the stored counter atomically with
      // FieldValue.increment(1). The old read-then-write (+1) raced:
      // two answers landing at once both read N, both tried to write
      // N+1, and the second write was denied by the rules, so the
      // question permanently undercounted by one. The displayed count
      // comes from the answers query (P1-14), so this counter is
      // compat-only; a failed bump must never fail the post itself.
      var inc = incrementValue(1);
      if (inc !== null) {
        return d.collection("questions").doc(questionId).update({
          answerCount: inc, updatedAt: now
        }).then(function () { return ref.id; }, function () { return ref.id; });
      }
      // No FieldValue available (e.g. the audit harness stub): fall back
      // to the old read-then-write bump.
      return d.collection("questions").doc(questionId).get().then(function (doc) {
        if (!doc.exists) return ref.id;
        var q = doc.data() || {};
        return d.collection("questions").doc(questionId).update({
          answerCount: (q.answerCount || 0) + 1, updatedAt: now
        }).then(function () { return ref.id; }, function () { return ref.id; });
      }, function () { return ref.id; });
    });
  }
  function markBest(questionId, answerId) {
    var u = currentUser();
    if (!u) return Promise.reject(new Error("Sign in to mark a best answer."));
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    return d.collection("questions").doc(questionId).get().then(function (qdoc) {
      if (!qdoc.exists) throw new Error("Question not found.");
      var q = qdoc.data() || {};
      if (q.authorUid !== u.uid) throw new Error("Only the person who asked can mark the best answer.");
      if (q.bestAnswerId === answerId) return;
      return d.collection("answers").doc(answerId).get().then(function (adoc) {
        if (!adoc.exists) throw new Error("Answer not found.");
        var a = adoc.data() || {};
        if (a.questionId !== questionId) throw new Error("That answer belongs to a different question.");
        var wasBest = !!a.isBest; // capture before the updates below (doc.data() may alias the stored object)
        var now = ts();
        // P1-11: the three updates land or fail together in one batched
        // write. The old Promise.all could leave bestAnswerId pointing
        // at an answer whose isBest was false, and the old-best unmark
        // failure was swallowed, leaving two "Best answer" badges. A
        // failed batch now rejects, so the caller sees the failure
        // instead of a silently corrupt best-answer state.
        var batch = (typeof d.batch === "function") ? d.batch() : null;
        var markDone;
        if (batch) {
          batch.update(d.collection("answers").doc(answerId), { isBest: true });
          if (q.bestAnswerId && q.bestAnswerId !== answerId) {
            batch.update(d.collection("answers").doc(q.bestAnswerId), { isBest: false });
          }
          batch.update(d.collection("questions").doc(questionId), {
            status: "answered", bestAnswerId: answerId, updatedAt: now
          });
          markDone = batch.commit();
        } else {
          // No batch API (e.g. the audit harness stub): the same three
          // updates, but a failure in any of them now rejects.
          markDone = Promise.all([
            d.collection("answers").doc(answerId).update({ isBest: true }),
            (q.bestAnswerId && q.bestAnswerId !== answerId)
              ? d.collection("answers").doc(q.bestAnswerId).update({ isBest: false })
              : Promise.resolve(),
            d.collection("questions").doc(questionId).update({
              status: "answered", bestAnswerId: answerId, updatedAt: now
            })
          ]);
        }
        return markDone.then(function () {
          // +10 XP for the answer author, via a grant they claim on their next visit
          // (a client can only write its own XP — see claimXpGrants).
          if (!wasBest && a.authorUid && a.authorUid !== u.uid) {
            // Deterministic grant id (questionId_answerId): one grant per
            // answer, ever. The rules only allow create when the answer is
            // actually marked best by the asker, and a re-mark's set() is
            // denied as an update (swallowed below) — so toggle farming
            // cannot mint a second grant (P0-2 / P1-12).
            return d.collection("xpGrants").doc(questionId + "_" + answerId).set({
              toUid: a.authorUid, amount: 10, reason: "best-answer",
              questionId: questionId, answerId: answerId,
              createdAt: now, claimed: false
            }).catch(function () {});
          }
        });
      });
    });
  }

  // P1-16: deleting a question must delete its answers too. The old
  // comment claimed orphaned answers were unreachable, but answers are
  // publicly readable (allow read: if true) and listAnswers() queries by
  // questionId, so anyone could still read every answer of a deleted
  // question. Answers are deleted in the same batched write as the
  // question (in 100-answer chunks when there are more than 100).
  function deleteQuestion(id) {
    var u = currentUser();
    if (!u) return Promise.reject(new Error("Sign in to delete."));
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    return d.collection("questions").doc(id).get().then(function (doc) {
      if (!doc.exists) throw new Error("Question not found.");
      if ((doc.data() || {}).authorUid !== u.uid) throw new Error("Only the person who posted it can delete it.");
      var qRef = d.collection("questions").doc(id);
      function deleteChunk() {
        return d.collection("answers").where("questionId", "==", id).limit(100).get().then(function (snap) {
          var answerIds = [];
          snap.forEach(function (a) { answerIds.push(a.id); });
          var batch = (typeof d.batch === "function") ? d.batch() : null;
          var done;
          if (batch) {
            answerIds.forEach(function (aid) { batch.delete(d.collection("answers").doc(aid)); });
            if (answerIds.length < 100) batch.delete(qRef);
            done = batch.commit();
          } else {
            var jobs = answerIds.map(function (aid) { return d.collection("answers").doc(aid).delete(); });
            if (answerIds.length < 100) jobs.push(qRef.delete());
            done = Promise.all(jobs);
          }
          // A full 100-answer chunk may mean more answers remain.
          if (answerIds.length === 100) return done.then(deleteChunk);
          return done;
        });
      }
      return deleteChunk();
    });
  }

  // P2-31: answers can be deleted by their author (the rules already
  // allow it); previously community.js exposed no deleteAnswer at all,
  // so a wrong or embarrassing answer was permanent unless the whole
  // question was deleted.
  // Ruling (10 Nov 2026): deleting the best answer is NOT blocked —
  // an author must be able to remove their own answer — but it drops
  // the question back to "unanswered": bestAnswerId is cleared and
  // status returns to "open", so no dangling pointer remains. The
  // +10 XP grant (if any) stays: earned XP is never revoked, the
  // same as badges, and the rules allow no grant delete. The answer
  // delete and the question update land in one batched write so they
  // cannot half-apply; the stored answerCount is decremented to
  // match (displayed counts come from the answers query).
  function deleteAnswer(questionId, answerId) {
    var u = currentUser();
    if (!u) return Promise.reject(new Error("Sign in to delete."));
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    return d.collection("answers").doc(answerId).get().then(function (doc) {
      if (!doc.exists) throw new Error("Answer not found.");
      var a = doc.data() || {};
      if (a.questionId !== questionId) throw new Error("That answer belongs to a different question.");
      if (a.authorUid !== u.uid) throw new Error("Only the person who posted it can delete it.");
      return d.collection("questions").doc(questionId).get().then(function (qdoc) {
        var q = (qdoc && qdoc.exists) ? (qdoc.data() || {}) : null;
        var now = ts();
        var aRef = d.collection("answers").doc(answerId);
        if (!q) return aRef.delete(); // Orphaned answer (question already gone): just delete it.
        var wasBest = q.bestAnswerId === answerId;
        var qPatch = { updatedAt: now };
        if (wasBest) { qPatch.status = "open"; qPatch.bestAnswerId = null; }
        var inc = incrementValue(-1);
        if (inc !== null) {
          qPatch.answerCount = inc;
        } else {
          // No FieldValue (e.g. the audit harness stub): read-then-write decrement.
          qPatch.answerCount = Math.max(0, (q.answerCount || 0) - 1);
        }
        var qRef = d.collection("questions").doc(questionId);
        var batch = (typeof d.batch === "function") ? d.batch() : null;
        if (batch) {
          batch.delete(aRef);
          batch.update(qRef, qPatch);
          return batch.commit();
        }
        return Promise.all([aRef.delete(), qRef.update(qPatch)]);
      });
    });
  }

  /* ---------------- showcase ---------------- */
  function listShowcase() {
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    return d.collection("showcase").orderBy("createdAt", "desc").limit(50).get().then(function (snap) {
      var out = [];
      snap.forEach(function (doc) { out.push(normDoc(doc)); });
      return out;
    });
  }
  function postShowcase(input) {
    var err = validateShowcase(input);
    if (err) return Promise.reject(new Error(err));
    var u = currentUser();
    if (!u) return Promise.reject(new Error("Sign in to share a project."));
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    var now = ts();
    return d.collection("showcase").add({
      authorUid: u.uid, authorName: u.name,
      title: String(input.title).trim(),
      desc: String(input.desc || ""), code: String(input.code || ""),
      projectId: input.projectId || null,
      createdAt: now, starCount: 0, stars: {}
    }).then(function (ref) { return ref.id; });
  }
  function toggleStar(showcaseId) {
    var u = currentUser();
    if (!u) return Promise.reject(new Error("Sign in to star a project."));
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    var ref = d.collection("showcase").doc(showcaseId);
    // Transaction: two people starring at once must not lose each other's star
    // (a plain read-then-write lets the last writer silently drop the first).
    return d.runTransaction(function (tx) {
      return tx.get(ref).then(function (doc) {
        if (!doc.exists) throw new Error("Project not found.");
        var p = doc.data() || {};
        var stars = p.stars || {};
        var starred;
        if (stars[u.uid]) { delete stars[u.uid]; starred = false; }
        else {
          // P2-34: no starring your own post — a self-star used to unlock
          // your own "Starred" badge (see the flag in loadShowcase).
          // Un-starring your own post (the branch above) stays allowed.
          if (p.authorUid && p.authorUid === u.uid) throw new Error("You can't star your own project.");
          stars[u.uid] = true; starred = true;
        }
        tx.update(ref, { stars: stars, starCount: Object.keys(stars).length });
        return starred;
      });
    });
  }
  function deleteShowcase(id) {
    var u = currentUser();
    if (!u) return Promise.reject(new Error("Sign in to delete."));
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    return d.collection("showcase").doc(id).get().then(function (doc) {
      if (!doc.exists) throw new Error("Project not found.");
      if ((doc.data() || {}).authorUid !== u.uid) throw new Error("Only the person who posted it can delete it.");
      return d.collection("showcase").doc(id).delete();
    });
  }
  function forkShowcase(post) {
    try { localStorage.setItem("skillzify_compiler_code", post.code || ""); } catch (e) {}
    location.href = "compiler.html";
  }

  /* ---------------- public profiles + XP grants ---------------- */
  function publishPublicProfile() {
    var u = currentUser();
    if (!u) return Promise.resolve();
    var d = db();
    if (!d) return Promise.resolve();
    var xp = 0, lessonsDone = 0, streak = 0, achievements = [];
    try { xp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0; } catch (e) {}
    try {
      var prog = JSON.parse(localStorage.getItem("skillzify_progress") || "{}");
      // skillzify_progress is a FLAT map {b1: true, ...} (learn-core.js
      // getProgress) — count its truthy keys, not a nested .lessons object.
      lessonsDone = Object.keys(prog).filter(function (k) { return !!prog[k]; }).length;
    } catch (e) {}
    try {
      var st = window.SkillzifyActivity ? window.SkillzifyActivity.streak() : null;
      streak = (st && st.current) || 0;
    } catch (e) {}
    try {
      var un = window.SkillzifyActivity ? window.SkillzifyActivity.unlocked() : null;
      achievements = un ? Object.keys(un) : [];
    } catch (e) {}
    // P1-28: clamp to sane values before writing — the rules also reject
    // out-of-range stats, but the doc is still client-written, so public
    // stats stay unverified until a server-side source exists.
    var total = Object.keys(LESSON_TITLES).length;
    xp = Math.max(0, xp);
    lessonsDone = Math.max(0, Math.min(lessonsDone, total));
    streak = Math.max(0, streak);
    achievements = (achievements || []).slice(0, 32);
    return d.collection("publicProfiles").doc(u.uid).set({
      displayName: u.name, xp: xp, lessonsDone: lessonsDone,
      lessonsTotal: total,
      streak: streak, achievements: achievements, updatedAt: ts()
    }, { merge: true }).catch(function () {});
  }
  function getPublicProfile(uid) {
    var d = db();
    if (!d) return Promise.reject(new Error("Community is unavailable right now."));
    return d.collection("publicProfiles").doc(uid).get().then(function (doc) {
      if (!doc.exists) return null;
      var p = doc.data() || {};
      p.uid = doc.id;
      p.updatedAt = toMs(p.updatedAt);
      return p;
    });
  }
  function claimXpGrants() {
    var u = currentUser();
    if (!u) return Promise.resolve(0);
    var d = db();
    if (!d) return Promise.resolve(0);
    var query = d.collection("xpGrants").where("toUid", "==", u.uid).where("claimed", "==", false).limit(20);
    function credit(result) {
      var total = result && result.total ? result.total : 0;
      var count = result && result.count ? result.count : 0;
      if (!total) return 0;
      try {
        if (window.SkillzifyLearnCore && window.SkillzifyLearnCore.addXP) window.SkillzifyLearnCore.addXP(total);
        else {
          var xp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0;
          localStorage.setItem("skillzify_xp", String(xp + total));
        }
      } catch (e) {}
      // Best-answer counter (feeds the Best Answer badge). Every grant
      // here is a best-answer grant, so one count per grant claimed.
      try {
        var prev = parseInt(localStorage.getItem("skillzify_best_answers") || "0", 10) || 0;
        localStorage.setItem("skillzify_best_answers", String(prev + count));
        if (window.SkillzifyActivity && typeof window.SkillzifyActivity.checkAchievements === "function") window.SkillzifyActivity.checkAchievements();
      } catch (e2) {}
      return total;
    }
    // P1-10: claim inside one transaction (read unclaimed -> mark
    // claimed -> return total). Two tabs/devices claiming at once can no
    // longer double-credit the same grant, and a failed mark can no
    // longer strand XP: if the transaction fails nothing is credited
    // and the grants stay pending for a later retry.
    if (typeof d.runTransaction === "function") {
      return d.runTransaction(function (tx) {
        return tx.get(query).then(function (snap) {
          var pending = [];
          snap.forEach(function (doc) {
            var g = doc.data() || {};
            if (g.amount > 0) pending.push({ id: doc.id, amount: g.amount });
          });
          if (!pending.length) return { total: 0, count: 0 };
          var total = 0;
          pending.forEach(function (g) {
            total += g.amount;
            tx.update(d.collection("xpGrants").doc(g.id), { claimed: true });
          });
          return { total: total, count: pending.length };
        });
      }).then(credit).catch(function () { return 0; });
    }
    // No transaction API: claim one grant at a time and credit each
    // immediately after its own mark succeeds, so a failure can never
    // lose already-marked XP (the old Promise.all batch did).
    return query.get().then(function (snap) {
      var pending = [];
      snap.forEach(function (doc) {
        var g = doc.data() || {};
        if (g.amount > 0) pending.push({ id: doc.id, amount: g.amount });
      });
      var total = 0, count = 0;
      function next(i) {
        if (i >= pending.length) return Promise.resolve({ total: total, count: count });
        var g = pending[i];
        return d.collection("xpGrants").doc(g.id).update({ claimed: true }).then(function () {
          total += g.amount; count++;
          return next(i + 1);
        }, function () { return next(i + 1); });
      }
      return next(0).then(credit);
    }).catch(function () { return 0; });
  }

  window.SkillzifyCommunity = {
    currentUser: currentUser,
    askQuestion: askQuestion, listQuestions: listQuestions, getQuestion: getQuestion,
    listAnswers: listAnswers, countAnswers: countAnswers, postAnswer: postAnswer, markBest: markBest,
    deleteQuestion: deleteQuestion, deleteAnswer: deleteAnswer,
    listShowcase: listShowcase, postShowcase: postShowcase, toggleStar: toggleStar,
    deleteShowcase: deleteShowcase,
    forkShowcase: forkShowcase,
    publishPublicProfile: publishPublicProfile, getPublicProfile: getPublicProfile,
    claimXpGrants: claimXpGrants,
    validateQuestion: validateQuestion, validateShowcase: validateShowcase,
    filterQuestions: filterQuestions, filterByQuery: filterByQuery,
    pickFeatured: pickFeatured, lessonTitle: lessonTitle, lessonList: lessonList,
    sectionOfLesson: sectionOfLesson, sectionName: sectionName,
    _setDb: function (x) { _testDb = x; }
  };
})();
