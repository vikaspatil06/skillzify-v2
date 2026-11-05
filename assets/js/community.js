/* Skillzify Community — Phase 1: anchored Q&A + showcase + public profiles.
   Firestore collections: questions, answers, showcase, publicProfiles, xpGrants.
   Reads are public; writes need a signed-in user (rules in firestore.rules).
   Queries are deliberately index-free: single orderBy/where only, the rest is
   filtered client-side, so no composite indexes are needed. */
(function () {
  "use strict";

  var LESSON_TITLES = {"b1":"Hello, Python! Your First Program","b2":"Variables & Data Types","b3":"Strings & f-strings","b4":"Conditionals: if / elif / else","b5":"Loops: for & while","b6":"Lists & Tuples","b7":"Dictionaries & Sets","b8":"Conditionals & Logic","b9":"Loops: for & while","b10":"Functions","i1":"Functions & Return Values","i2":"Lists, Tuples & Dictionaries","i3":"Error Handling with try/except","i4":"OOP Basics: Classes & Objects","i5":"Recursion: Functions That Call Themselves","i6":"File Handling: Read & Write Files","i7":"List Comprehensions","i8":"Error Handling","i9":"File Handling","i10":"OOP Basics","i11":"Modules & Imports","i12":"Lambda, map, filter","a1":"List Comprehensions & Lambdas","a2":"Generators & yield","a3":"Decorators","a4":"Modules, pip & Virtual Environments","a5":"Context Managers & the with Statement","a6":"Decorators","a7":"Generators & Iterators","a8":"Recursion","a9":"Sorting & Searching","a10":"Dictionaries in Depth","b11":"Numbers & Math in Python","b12":"String Methods You Will Use Daily","b13":"Slicing & Indexing Strings","b14":"List Methods in Depth","b15":"Tuples: Unpacking & Immutability","b16":"Dictionary Methods in Depth","b17":"Set Operations: Union, Intersection & Difference","b18":"Type Conversion & the input() Function","b19":"Boolean Logic: and, or, not","b20":"Nested Loops & Patterns","b21":"break, continue & Loop else","b22":"Function Arguments: Defaults & Keywords","b23":"Scope: Local vs Global","b24":"Docstrings & Getting Help","b25":"The random Module: Build a Guessing Game","b26":"Dates & Times with datetime","b27":"None & Checking for Nothing","b28":"Comments & Clean Code Style","b29":"Reading Tracebacks: Debugging Basics","b30":"Capstone: Command-Line To-Do App","i13":"*args & **kwargs","i14":"Advanced String Formatting","i15":"enumerate, zip & Unpacking in Loops","i16":"Dict & Set Comprehensions","i17":"Sorting with key Functions","i18":"Copy vs Deep Copy: The Mutation Trap","i19":"Exception Hierarchy & Custom Exceptions","i20":"Raising Exceptions & Assertions","i21":"try/except/else/finally: The Full Picture","i22":"Working with CSV Files","i23":"JSON: Reading & Writing Data","i24":"Files & Folders with pathlib","i25":"OOP: Inheritance","i26":"OOP: Encapsulation with @property","i27":"OOP: Dunder Methods (__str__, __len__, __eq__)","i28":"OOP: Class vs Instance, @classmethod & @staticmethod","i29":"Iterators & the Iterator Protocol","i30":"Generator Expressions & itertools","i31":"Recursion Patterns & Limits","i32":"Closures & Higher-Order Functions","i33":"Big-O Intuition & Timing Code","i34":"Regular Expressions Basics","i35":"Capstone: File Organizer Script","a11":"Decorators with Arguments & functools.wraps","a12":"Concurrency I: Threading Basics","a13":"Concurrency II: asyncio Basics","a14":"The GIL & Multiprocessing","a15":"Writing Your Own Context Managers","a16":"Generators: send(), Coroutines & Pipelines","a17":"Descriptors & the Descriptor Protocol","a18":"How Classes Work: type() & Metaclasses Intro","a19":"functools Toolkit: lru_cache, partial, reduce","a20":"Dataclasses: Less Boilerplate OOP","a21":"Type Hints & Static Checking","a22":"Logging Done Right","a23":"Debugging with pdb","a24":"Packaging: Ship Your Own pip Package","a25":"Design Patterns in Python","a26":"SQLite Databases with Python","a27":"Talking to APIs: requests & JSON","a28":"Profiling & Optimization","a29":"Capstone: argparse CLI Application","a30":"Pythonic Idioms Masterclass"};

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
    return d.collection("questions").orderBy("createdAt", "desc").limit(50).get().then(function (snap) {
      var out = [];
      snap.forEach(function (doc) { out.push(normDoc(doc)); });
      if (opts.lessonId) out = out.filter(function (q) { return q.lessonId === opts.lessonId; });
      var u = currentUser();
      return filterQuestions(out, opts.filter || "all", u ? u.uid : null);
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
    return d.collection("answers").add({
      questionId: questionId, authorUid: u.uid, authorName: u.name,
      body: String(input.body), code: String(input.code || ""),
      createdAt: now, isBest: false
    }).then(function (ref) {
      // best-effort answer count (the rules allow the counter fields only)
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
        var jobs = [d.collection("answers").doc(answerId).update({ isBest: true })];
        if (q.bestAnswerId && q.bestAnswerId !== answerId) {
          jobs.push(d.collection("answers").doc(q.bestAnswerId).update({ isBest: false }).catch(function () {}));
        }
        jobs.push(d.collection("questions").doc(questionId).update({
          status: "answered", bestAnswerId: answerId, updatedAt: now
        }));
        return Promise.all(jobs).then(function () {
          // +10 XP for the answer author, via a grant they claim on their next visit
          // (a client can only write its own XP — see claimXpGrants).
          if (!wasBest && a.authorUid && a.authorUid !== u.uid) {
            return d.collection("xpGrants").add({
              toUid: a.authorUid, amount: 10, reason: "best-answer",
              questionId: questionId, answerId: answerId,
              createdAt: now, claimed: false
            }).catch(function () {});
          }
        });
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
    return ref.get().then(function (doc) {
      if (!doc.exists) throw new Error("Project not found.");
      var p = doc.data() || {};
      var stars = p.stars || {};
      var starred;
      if (stars[u.uid]) { delete stars[u.uid]; starred = false; }
      else { stars[u.uid] = true; starred = true; }
      return ref.update({ stars: stars, starCount: Object.keys(stars).length }).then(function () { return starred; });
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
      var lessons = prog.lessons || {};
      lessonsDone = Object.keys(lessons).filter(function (k) { return !!lessons[k]; }).length;
    } catch (e) {}
    try {
      var st = window.SkillzifyActivity ? window.SkillzifyActivity.streak() : null;
      streak = (st && st.current) || 0;
    } catch (e) {}
    try {
      var un = window.SkillzifyActivity ? window.SkillzifyActivity.unlocked() : null;
      achievements = un ? Object.keys(un) : [];
    } catch (e) {}
    return d.collection("publicProfiles").doc(u.uid).set({
      displayName: u.name, xp: xp, lessonsDone: lessonsDone,
      lessonsTotal: Object.keys(LESSON_TITLES).length,
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
    return d.collection("xpGrants").where("toUid", "==", u.uid).limit(20).get().then(function (snap) {
      var pending = [];
      snap.forEach(function (doc) {
        var g = doc.data() || {};
        if (!g.claimed && g.amount > 0) pending.push({ id: doc.id, amount: g.amount });
      });
      if (!pending.length) return 0;
      var total = 0;
      pending.forEach(function (g) { total += g.amount; });
      try {
        if (window.SkillzifyLearnCore && window.SkillzifyLearnCore.addXP) window.SkillzifyLearnCore.addXP(total);
        else {
          var xp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0;
          localStorage.setItem("skillzify_xp", String(xp + total));
        }
      } catch (e) {}
      var jobs = pending.map(function (g) {
        return d.collection("xpGrants").doc(g.id).update({ claimed: true }).catch(function () {});
      });
      return Promise.all(jobs).then(function () { return total; });
    }).catch(function () { return 0; });
  }

  window.SkillzifyCommunity = {
    currentUser: currentUser,
    askQuestion: askQuestion, listQuestions: listQuestions, getQuestion: getQuestion,
    listAnswers: listAnswers, postAnswer: postAnswer, markBest: markBest,
    listShowcase: listShowcase, postShowcase: postShowcase, toggleStar: toggleStar,
    forkShowcase: forkShowcase,
    publishPublicProfile: publishPublicProfile, getPublicProfile: getPublicProfile,
    claimXpGrants: claimXpGrants,
    validateQuestion: validateQuestion, validateShowcase: validateShowcase,
    filterQuestions: filterQuestions, pickFeatured: pickFeatured, lessonTitle: lessonTitle,
    _setDb: function (x) { _testDb = x; }
  };
})();
