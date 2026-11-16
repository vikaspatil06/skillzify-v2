/* ============================================================
   Skillzify AI Interview Intelligence — Phase 1 (interview.js)
   A stateful, text-based placement interview:
   - Setup: candidate profile, interview configuration, optional
     resume (PDF/DOCX/TXT upload or paste; parsed by ONE AI call,
     mode interview_resume, with a local keyword-extraction
     fallback). The raw resume text is never stored — only the
     parsed skills/projects/questions are kept.
   - Engine: rounds (Technical -> Coding -> HR for Mixed) driven
     by a local adaptive controller over interview-bank.js
     (rubric points + follow-up trees). The AI interviewer
     (server mode interview_turn) is consulted ONCE per round —
     after the round's first answer — to phrase the reaction and
     optionally supply one dynamic follow-up. Every other step
     runs locally, so the interview can never dead-end: if the AI
     is down or the shared pool is exhausted, template phrasing and
     bank follow-ups carry the whole session. (Interview AI calls
     have no per-user daily cap — they draw only from the shared
     learner pool, so an interview never stops mid-session.)
   - Scoring: open answers are scored per round in ONE batched
     AI call (mode interview_score) against the rubric points,
     with a deterministic local rubric-overlap scorer as the
     fallback (the report says honestly when offline scoring was
     used). Coding is scored by execution in Pyodide against
     visible + hidden tests, using the bank's rubric weights.
   - Report: overall / per-round / per-skill scores, a
     question-level breakdown with evidence, weaknesses, and an
     improvement roadmap mapped to real Skillzify lessons,
     practice topics and paths. The interview can also set the
     learner's placement (SkillzifyPlacement.save).
   AI budget for a full Mixed interview (measured in the headless
   e2e): 1 (resume, optional) + 1 turn call per OPEN round (2:
   Technical + HR; the coding round makes no AI calls) + 1 scoring
   call per open round (2) = 4-5 calls. Sessions live in localStorage
   (skillzify_interviews); a summary also goes to Firestore
   collection `interviews` when signed in (fails silently).
   Exposes window.SkillzifyInterview. ES5, no build step.
   ============================================================ */
(function () {
  "use strict";

  var BANK = window.SkillzifyInterviewBank || { technical: [], hr: [], coding: [], roleTopics: {}, codingRubric: { correctness: 35, time: 20, space: 15, edge: 15, quality: 10, explanation: 5 } };

  var PROFILE_KEY = "skillzify_interview_profile";
  var CONFIG_KEY = "skillzify_interview_config";
  var HISTORY_KEY = "skillzify_interviews";

  var ROLES = ["Python Developer", "Software Developer", "Full Stack Developer", "Frontend Developer", "Backend Developer", "Java Developer", "Data Analyst", "Data Scientist", "AI/ML Engineer", "DevOps Engineer", "Cybersecurity Analyst", "QA / Software Testing Engineer"];
  var EXPERIENCE = ["Fresher", "Intern", "0–2 years", "2–5 years"];
  var DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
  var TYPES = ["Mixed", "Technical", "Coding", "HR"];
  var DURATIONS = [15, 30, 45];
  var STYLE_LIST = ["Friendly", "Professional", "Challenging"];
  var TURN_ACTIONS = ["deeper", "clarify", "probe", "diagnostic", "redirect", "next", "end"];

  /* Weakness -> the Skillzify assets that fix it. Lesson ids are
     verified against LESSON_INDEX; practice topics against
     practice-data.js; path ids against paths-data.js. */
  var ROADMAP = {
    "Python Fundamentals": { lessons: ["b2", "b4", "b5", "b10", "b6"], topics: ["variables", "strings", "loops", "functions"], path: "fundamentals" },
    "OOP": { lessons: ["i4", "i25", "i28", "a20"], topics: ["oop"], path: "fundamentals" },
    "Data Structures & Algorithms": { lessons: ["i33", "i50", "i55", "i59", "i38"], topics: ["dsa", "sorting", "trees-graphs", "recursion"], path: "dsa" },
    "Databases & SQL": { lessons: ["a26", "a70", "a54"], topics: ["data-science"], path: "data" },
    "Operating Systems": { lessons: ["a12", "a14", "a43"], topics: ["async"], path: "automation" },
    "Computer Networks": { lessons: ["a63", "a27", "i82"], topics: ["web"], path: "web" },
    "Web & APIs": { lessons: ["a27", "a67", "a68", "a69"], topics: ["web"], path: "web" },
    "Data & pandas": { lessons: ["a51", "a53", "a57"], topics: ["data-science"], path: "data" },
    "Coding": { lessons: ["i38", "i41", "i70", "i73"], topics: ["dsa", "sorting"], path: "interview" },
    "Communication & HR": { lessons: ["i70"], topics: [], path: "interview" },
    "Project Knowledge": { lessons: ["a83", "a85"], topics: [], path: "interview" }
  };
  var TOPIC_LABEL = { fundamentals: "Python fundamentals", oop: "OOP", dsa: "data structures & algorithms", dbms: "databases & SQL", os: "operating systems", cn: "computer networks", web: "web & APIs", data: "data analysis", hr: "HR", project: "your project", resume: "your resume", coding: "coding" };

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
    });
  }
  function storeGet(k, fb) {
    try {
      if (window.Skillzify && window.Skillzify.storeGet) return window.Skillzify.storeGet(k, fb);
      var raw = localStorage.getItem(k);
      return raw == null ? fb : JSON.parse(raw);
    } catch (e) { return fb; }
  }
  function storeSet(k, v) {
    try {
      if (window.Skillzify && window.Skillzify.storeSet) { window.Skillzify.storeSet(k, v); return; }
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }
  function shuffle(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; }
  }
  function lessonTitle(id) {
    try {
      var idx = window.LESSON_INDEX || [];
      for (var i = 0; i < idx.length; i++) if (idx[i].id === id) return idx[i].title;
    } catch (e) {}
    return id;
  }
  function pathTitle(id) {
    try {
      var ps = window.SkillzifyPaths || [];
      for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i].title;
    } catch (e) {}
    return id;
  }
  function toast(msg) {
    try { if (window.Skillzify && window.Skillzify.toast) { window.Skillzify.toast(msg); return; } } catch (e) {}
    var t = $("toast");
    if (t) { t.textContent = msg; t.classList.add("show"); setTimeout(function () { t.classList.remove("show"); }, 2600); }
  }

  /* ---------------- state ---------------- */
  var S = {
    profile: storeGet(PROFILE_KEY, null),
    config: storeGet(CONFIG_KEY, null),
    resume: null,          // parsed resume {skills, projects, questions, quality, summary, source}
    resumeBusy: false,
    session: null,
    timers: [],
    py: null, pyLoading: false, pyFailed: false, pyWaiters: []
  };
  if (!S.profile) {
    var siteProfile = storeGet("skillzify_profile", {}) || {};
    S.profile = { name: siteProfile.name || "", role: "Python Developer", experience: "Fresher", skills: "", targetCompanies: "" };
  }
  if (!S.config) S.config = { role: S.profile.role || "Python Developer", experience: S.profile.experience || "Fresher", difficulty: "Intermediate", type: "Mixed", duration: 30, style: "Professional" };

  function clearTimers() { S.timers.forEach(function (t) { clearInterval(t); }); S.timers = []; }

  /* ---------------- AI wrapper ----------------
     Every interview AI call goes through here: counts the call,
     honours the session's aiDead flag (set when the shared pool is
     exhausted or the provider rate-limits, so we stop burning
     attempts), and validates the returned JSON shape client-side
     before anyone trusts it. Interview calls carry no per-user
     daily cap on the server, so a DAILY_CAP error should never
     occur for them — and no cap message is ever surfaced here:
     the only cap an interview can meet is the shared pool, which
     gets its own pool-full message (POOL_CAP below). */
  var POOL_MSG = "The shared AI pool for today is used up, so the AI interviewer is unavailable for now. Your interview continues in offline mode — questions, follow-ups and scoring all run locally. The pool is shared by every learner and resets tomorrow; signing in doesn't refill it.";
  function aiAsk(opts, cb) {
    var sess = S.session;
    if (!window.SkillzifyAI || typeof window.SkillzifyAI.ask !== "function") { cb(new Error("no-ai"), null); return; }
    if (sess && sess.aiDead) { cb(new Error("ai-dead"), null); return; }
    if (sess) sess.aiCalls++;
    try {
      window.SkillzifyAI.ask(opts, function (err, res) {
        if (err) {
          if (sess && err && (err.code === "DAILY_CAP" || err.code === "POOL_CAP" || err.code === "RATE_LIMIT")) sess.aiDead = true;
          if (sess && err && err.code === "POOL_CAP" && sess.transcript && !sess.poolNotified) {
            sess.poolNotified = true;
            pushSys(POOL_MSG);
          }
          cb(err, null);
          return;
        }
        cb(null, res);
      });
    } catch (e) { cb(e, null); }
  }

  /* ---------------- setup view ---------------- */
  function options(list, current) {
    return list.map(function (o) {
      return '<option value="' + esc(o) + '"' + (o === current ? " selected" : "") + ">" + esc(o) + "</option>";
    }).join("");
  }
  function field(label, inner, hint) {
    return '<div class="field"><label>' + esc(label) + "</label>" + inner + (hint ? '<p class="hint">' + esc(hint) + "</p>" : "") + "</div>";
  }

  function renderSetup() {
    clearTimers();
    S.session = null;
    var p = S.profile, c = S.config;
    var hist = storeGet(HISTORY_KEY, []);
    var histHtml = "";
    if (hist.length) {
      histHtml = '<div class="card"><h3 style="margin-top:0">Past interviews</h3>' + hist.map(function (h, i) {
        return '<div class="iv-hist-row"><div><strong>' + esc(h.role) + " · " + esc(h.type) + '</strong><br><span class="hint">' + fmtDate(h.at) + " · " + esc(h.difficulty || "") + " · " + esc(h.scoring === "ai" ? "AI-scored" : h.scoring === "mixed" ? "Partly offline-scored" : "Offline-scored") + '</span></div>' +
          '<div style="display:flex;gap:10px;align-items:center"><span class="iv-chip">Overall <strong>' + h.overall + "/100</strong></span>" +
          '<button class="btn btn-ghost btn-sm" data-iv-view="' + i + '">View report</button></div></div>';
      }).join("") + "</div>";
    }
    var resumeStatus = "";
    if (S.resume) {
      resumeStatus = '<div class="alert alert-success" style="margin-top:10px">✅ Resume parsed ' + (S.resume.source === "ai" ? "by the AI" : "locally (AI unavailable)") + " — " + S.resume.skills.length + " skills, " + S.resume.projects.length + " projects, " + S.resume.questions.length + " resume questions ready. " +
        (S.resume.quality ? "Quality: " + esc(S.resume.quality) + ". " : "") + '<button class="btn btn-ghost btn-sm" id="iv-resume-clear" type="button">Remove</button></div>';
    }
    $("iv-root").innerHTML =
      '<div class="iv-shell">' +
        '<aside class="card iv-rail"><h3 style="margin-top:0">How it works</h3>' +
          '<div class="iv-step"><span class="n">1</span><div><strong>Set up</strong><br><span class="hint">Role, difficulty, rounds and style — takes a minute.</span></div></div>' +
          '<div class="iv-step"><span class="n">2</span><div><strong>Answer like it\'s real</strong><br><span class="hint">The interviewer follows up on weak spots and digs deeper on strong ones. No hints or solutions during a scored interview.</span></div></div>' +
          '<div class="iv-step"><span class="n">3</span><div><strong>Code live</strong><br><span class="hint">Coding rounds run your Python against real tests, including hidden edge cases.</span></div></div>' +
          '<div class="iv-step"><span class="n">4</span><div><strong>Report &amp; roadmap</strong><br><span class="hint">Per-skill scores with evidence, and the exact Skillzify lessons that close each gap.</span></div></div>' +
          '<p class="hint" style="margin-top:14px">Scores are a practice-based estimate from this session\'s rubric — not a hiring prediction. If the AI is unreachable, the interview still runs and scores locally.</p>' +
        "</aside>" +
        '<div style="display:grid;gap:16px;min-width:0">' +
          '<div class="card"><h3 style="margin-top:0">👤 Candidate profile</h3><div class="iv-form-grid">' +
            field("Your name", '<input class="input" id="iv-name" type="text" value="' + esc(p.name) + '" placeholder="e.g. Aarav Sharma">') +
            field("Experience level", '<select class="input" id="iv-exp">' + options(EXPERIENCE, p.experience) + "</select>") +
            field("Your current skills", '<input class="input" id="iv-skills" type="text" value="' + esc(p.skills) + '" placeholder="e.g. Python, SQL, Flask">', "Comma-separated — used to personalise questions.") +
            field("Target companies (optional)", '<input class="input" id="iv-targets" type="text" value="' + esc(p.targetCompanies) + '" placeholder="e.g. product startups, TCS">') +
          "</div></div>" +
          '<div class="card"><h3 style="margin-top:0">🎛️ Interview setup</h3><div class="iv-form-grid">' +
            field("Target role", '<select class="input" id="iv-role">' + options(ROLES, c.role) + "</select>", "Python-stack roles get the deepest question bank; every role gets the CS core plus HR.") +
            field("Interview type", '<select class="input" id="iv-type">' + options(TYPES, c.type) + "</select>") +
            field("Difficulty", '<select class="input" id="iv-diff">' + options(DIFFICULTIES, c.difficulty) + "</select>") +
            field("Duration", '<select class="input" id="iv-dur">' + DURATIONS.map(function (d) { return '<option value="' + d + '"' + (d === c.duration ? " selected" : "") + ">" + d + " minutes</option>"; }).join("") + "</select>", "Sets how many questions per round.") +
            field("Interviewer style", '<select class="input" id="iv-style">' + options(STYLE_LIST, c.style) + "</select>", "Friendly encourages, Professional is neutral, Challenging pushes back.") +
          "</div>" +
          '<div class="field" style="margin-top:6px"><label>📄 Resume (optional — unlocks resume-based questions)</label>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input class="input" id="iv-file" type="file" accept=".pdf,.docx,.txt" style="max-width:320px">' +
            '<button class="btn btn-ghost btn-sm" id="iv-file-btn" type="button">Extract &amp; parse</button>' +
            '<button class="btn btn-ghost btn-sm" id="iv-projects-btn" type="button">Use my Skillzify projects</button></div>' +
            '<textarea class="input" id="iv-resume-text" rows="4" placeholder="…or paste your resume text here, then press Parse resume" style="margin-top:8px"></textarea>' +
            '<div style="margin-top:8px"><button class="btn btn-ghost btn-sm" id="iv-paste-btn" type="button">Parse resume</button> <span class="hint" id="iv-resume-hint">Your resume is parsed once by the AI; only the extracted skills, projects and questions are kept — the raw text is never stored.</span></div>' +
            resumeStatus +
          "</div>" +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-primary" id="iv-start" type="button">Start interview →</button>' +
          '<span class="hint" style="align-self:center">A full Mixed interview uses about 4–5 AI calls from the shared learner pool — interview calls never touch your personal daily tutor-answer allowance.</span></div>' +
          "</div>" +
          histHtml +
        "</div>" +
      "</div>";
    wireSetup();
  }

  function readSetupForm() {
    S.profile.name = $("iv-name").value.trim();
    S.profile.experience = $("iv-exp").value;
    S.profile.skills = $("iv-skills").value.trim();
    S.profile.targetCompanies = $("iv-targets").value.trim();
    S.config.role = $("iv-role").value;
    S.config.experience = S.profile.experience;
    S.config.difficulty = $("iv-diff").value;
    S.config.type = $("iv-type").value;
    S.config.duration = parseInt($("iv-dur").value, 10) || 30;
    S.config.style = $("iv-style").value;
    S.profile.role = S.config.role;
    storeSet(PROFILE_KEY, S.profile);
    storeSet(CONFIG_KEY, S.config);
  }

  function wireSetup() {
    $("iv-start").addEventListener("click", function () {
      readSetupForm();
      startInterview();
    });
    $("iv-paste-btn").addEventListener("click", function () {
      var text = $("iv-resume-text").value.trim();
      if (text.length < 80) { toast("Paste a little more of your resume first (a few lines at least)."); return; }
      parseResume(text, "pasted");
    });
    $("iv-file-btn").addEventListener("click", function () {
      var f = $("iv-file").files && $("iv-file").files[0];
      if (!f) { toast("Choose a PDF, DOCX or TXT file first."); return; }
      extractFileText(f, function (err, text) {
        if (err) { toast("Could not read that file — try pasting the text instead."); return; }
        parseResume(text, f.name);
      });
    });
    $("iv-projects-btn").addEventListener("click", function () {
      readSetupForm();
      useSkillzifyProjects(true);
    });
    var clearBtn = $("iv-resume-clear");
    if (clearBtn) clearBtn.addEventListener("click", function () { S.resume = null; renderSetup(); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-iv-view]"), function (btn) {
      btn.addEventListener("click", function () {
        var hist = storeGet(HISTORY_KEY, []);
        var rep = hist[parseInt(btn.getAttribute("data-iv-view"), 10)];
        if (rep) renderReport(rep, true);
      });
    });
  }

  /* ---------------- resume: extraction + parse ---------------- */
  function loadScript(src, cb) {
    var s = document.createElement("script");
    s.src = src;
    s.onload = function () { cb(null); };
    s.onerror = function () { cb(new Error("cdn")); };
    document.head.appendChild(s);
  }
  function extractFileText(file, cb) {
    var name = (file.name || "").toLowerCase();
    if (/\.txt$/.test(name)) {
      var r = new FileReader();
      r.onload = function () { cb(null, String(r.result || "")); };
      r.onerror = function () { cb(new Error("read")); };
      r.readAsText(file);
      return;
    }
    if (/\.pdf$/.test(name)) {
      var go = function () {
        file.arrayBuffer().then(function (buf) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
          window.pdfjsLib.getDocument({ data: buf }).promise.then(function (pdf) {
            var pages = [];
            var chain = Promise.resolve();
            for (var i = 1; i <= pdf.numPages; i++) {
              (function (n) {
                chain = chain.then(function () {
                  return pdf.getPage(n).then(function (page) {
                    return page.getTextContent().then(function (tc) {
                      pages.push(tc.items.map(function (it) { return it.str; }).join(" "));
                    });
                  });
                });
              })(i);
            }
            chain.then(function () { cb(null, pages.join("\n")); }, function () { cb(new Error("pdf")); });
          }, function () { cb(new Error("pdf")); });
        }, function () { cb(new Error("read")); });
      };
      if (window.pdfjsLib) go();
      else loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js", function (e) { if (e) cb(e); else go(); });
      return;
    }
    if (/\.docx$/.test(name)) {
      var goDocx = function () {
        file.arrayBuffer().then(function (buf) {
          window.mammoth.extractRawText({ arrayBuffer: buf }).then(function (res) { cb(null, res.value || ""); }, function () { cb(new Error("docx")); });
        }, function () { cb(new Error("read")); });
      };
      if (window.mammoth) goDocx();
      else loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js", function (e) { if (e) cb(e); else goDocx(); });
      return;
    }
    cb(new Error("type"));
  }

  var SKILL_TERMS = ["python", "django", "flask", "fastapi", "javascript", "typescript", "react", "angular", "vue", "node", "express", "html", "css", "sql", "mysql", "postgresql", "sqlite", "mongodb", "redis", "git", "github", "docker", "kubernetes", "aws", "azure", "gcp", "linux", "rest api", "graphql", "pandas", "numpy", "scikit-learn", "tensorflow", "machine learning", "deep learning", "data analysis", "excel", "power bi", "tableau", "java", "c++", "c#", "kotlin", "android", "firebase", "testing", "selenium", "jenkins", "agile", "oop", "data structures", "algorithms"];
  var PROJECT_POINTS = ["what the project does and the problem it solves", "their own contribution, distinct from any team's", "a technical challenge they hit and how they solved it", "what they would improve, or how it would scale"];
  function localResumeParse(text) {
    var low = " " + String(text || "").toLowerCase() + " ";
    var skills = SKILL_TERMS.filter(function (t) { return low.indexOf(t) !== -1; }).map(function (t) {
      return t.split(" ").map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
    });
    var lines = String(text || "").split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var projects = [];
    for (var i = 0; i < lines.length && projects.length < 3; i++) {
      if (/project/i.test(lines[i]) && lines[i].length < 90) {
        var title = lines[i].replace(/.*project[s]?\s*[:\-–]?\s*/i, "").trim() || lines[i];
        if (title.length > 2) projects.push({ title: title.slice(0, 60), summary: (lines[i + 1] || "").slice(0, 140) });
      }
    }
    var questions = [];
    projects.forEach(function (pr) {
      questions.push({ q: "Your resume lists the project \"" + pr.title + "\". Walk me through it — what it does, your exact role, and the hardest problem you solved in it.", topic: "project", points: PROJECT_POINTS.slice() });
    });
    skills.slice(0, 3).forEach(function (sk) {
      questions.push({ q: "Your resume mentions " + sk + ". How have you used it in real work — and what is one limitation or gotcha of it that you have personally run into?", topic: "resume", points: ["a concrete use of " + sk + " from their own work", "depth beyond naming the tool — a real gotcha or trade-off", "how they verified or debugged their work with it"] });
    });
    return { skills: skills, projects: projects, quality: "", summary: "", questions: questions, source: "local" };
  }

  function parseResume(text, sourceName) {
    if (S.resumeBusy) return;
    S.resumeBusy = true;
    var hint = $("iv-resume-hint");
    if (hint) hint.textContent = "Parsing your resume…";
    readSetupForm();
    var fallback = function (why) {
      S.resume = localResumeParse(text);
      S.resumeBusy = false;
      if (why && why.code === "POOL_CAP") toast("The shared AI pool for today is used up, so your resume was parsed locally instead — questions come from keyword extraction. The pool is shared by every learner and resets tomorrow; signing in doesn't refill it.");
      else toast(S.resume.skills.length ? "Resume parsed locally — the AI was unavailable, so questions come from keyword extraction." : "Resume noted. Add a few skill keywords for sharper questions.");
      renderSetup();
    };
    if (!window.SkillzifyAI) { fallback(); return; }
    /* A pseudo-session so aiAsk can count this call and honour caps. */
    var counter = { aiCalls: 0, aiDead: false };
    var realSession = S.session;
    S.session = counter;
    aiAsk({ mode: "interview_resume", code: String(text).slice(0, 7000), context: S.config.role + " role, " + S.config.experience + " experience", json: true, cache: false }, function (err, res) {
      S.session = realSession;
      S.resumeAiCalls = counter.aiCalls;
      if (err || !res || !res.data || !Array.isArray(res.data.skills) || !Array.isArray(res.data.questions)) { fallback(err); return; }
      var d = res.data;
      var qs = d.questions.filter(function (q) { return q && typeof q.q === "string" && q.q.length > 10; }).slice(0, 6).map(function (q) {
        return { q: q.q, topic: "resume", points: (Array.isArray(q.points) && q.points.length ? q.points : PROJECT_POINTS).slice(0, 4) };
      });
      S.resume = {
        skills: d.skills.filter(function (s) { return typeof s === "string"; }).slice(0, 15),
        projects: (Array.isArray(d.projects) ? d.projects : []).slice(0, 4).map(function (pr) { return { title: String(pr.title || "Project"), summary: String(pr.summary || "") }; }),
        quality: typeof d.quality === "number" ? String(d.quality) + "/100" : (typeof d.quality === "string" ? d.quality : ""),
        summary: typeof d.summary === "string" ? d.summary : "",
        questions: qs,
        source: "ai"
      };
      S.resumeBusy = false;
      toast("Resume parsed — " + S.resume.questions.length + " resume questions added to your interview.");
      renderSetup();
    });
  }

  function useSkillzifyProjects(announce) {
    var all = window.SkillzifyProjects || [];
    if (!all.length) { if (announce) toast("Projects data is not available right now."); return []; }
    var done = {};
    try { done = JSON.parse(localStorage.getItem("skillzify_projects_done") || "{}"); } catch (e) {}
    var picked = all.filter(function (pr) { return done[pr.id]; }).slice(0, 2);
    if (picked.length < 2) {
      var mineTokens = String(S.profile.skills || "").toLowerCase().split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 2; });
      var rest = all.filter(function (pr) { return picked.indexOf(pr) === -1; });
      var hit = function (pr) {
        var sk = String(pr.skills || "").toLowerCase();
        return mineTokens.some(function (t) { return sk.indexOf(t) !== -1; }) ? 0 : 1;
      };
      rest.sort(function (a, b) { return hit(a) - hit(b); });
      picked = picked.concat(rest.slice(0, 2 - picked.length));
    }
    S.projectMaterial = picked;
    if (announce) toast("Project round material ready: " + picked.map(function (pr) { return pr.title; }).join(" + ") + ". These join the Technical round.");
    return picked;
  }

  /* ---------------- plan building ---------------- */
  var COUNTS = { 15: { tech: 4, coding: 1, hr: 3 }, 30: { tech: 6, coding: 1, hr: 4 }, 45: { tech: 8, coding: 2, hr: 5 } };
  function countsFor(type, duration) {
    var base = COUNTS[duration] || COUNTS[30];
    if (type === "Technical") return { tech: base.tech + base.hr, coding: 0, hr: 0 };
    if (type === "Coding") return { tech: 0, coding: duration === 45 ? 3 : 2, hr: 0 };
    if (type === "HR") return { tech: 0, coding: 0, hr: base.hr + 3 };
    return { tech: base.tech, coding: base.coding, hr: base.hr };
  }
  function skillForTopic(t) {
    return { fundamentals: "Python Fundamentals", oop: "OOP", dsa: "Data Structures & Algorithms", dbms: "Databases & SQL", os: "Operating Systems", cn: "Computer Networks", web: "Web & APIs", data: "Data & pandas", hr: "Communication & HR", project: "Project Knowledge", resume: "Project Knowledge", coding: "Coding" }[t] || "Python Fundamentals";
  }
  function openItem(q, src) {
    return { kind: "open", src: src || "bank", id: q.id || null, topic: q.topic, skill: q.skill || skillForTopic(q.topic), q: q.q, points: (q.points || []).slice(), followups: q.followups || [], answer: "", fuQ: "", fuAnswer: "", fuKind: "", skipped: false, score: null, scoreSrc: "", well: "", improve: "", evidence: "" };
  }
  function codingItem(c) {
    return { kind: "coding", id: c.id, topic: "coding", skill: "Coding", title: c.title, prompt: c.prompt, starter: c.starter, code: c.starter, visible: c.visible, hidden: c.hidden, minutes: c.minutes, optimalTime: c.optimalTime, optimalSpace: c.optimalSpace, ideaPoints: c.ideaPoints, submitted: false, visResults: null, allResults: null, timeUsedSec: 0, approach: "", complexityAnswer: "", parts: null, score: null, well: "", improve: "", evidence: "" };
  }
  function tierSeq(diff, n) {
    var pat = diff === "Beginner" ? [1, 1, 2, 1, 2, 1, 2, 2] : diff === "Advanced" ? [2, 3, 3, 2, 3, 3, 2, 3] : [1, 2, 2, 3, 2, 1, 3, 2];
    var out = [];
    for (var i = 0; i < n; i++) out.push(pat[i % pat.length]);
    return out;
  }
  function pickTechnical(count, topics, diff) {
    var pool = BANK.technical.filter(function (q) { return topics.indexOf(q.topic) !== -1; });
    if (!pool.length) pool = BANK.technical.slice();
    var used = {}, picked = [];
    tierSeq(diff, count).forEach(function (tier) {
      var cand = pool.filter(function (q) { return !used[q.id] && q.tier === tier; });
      if (!cand.length) cand = pool.filter(function (q) { return !used[q.id] && Math.abs(q.tier - tier) === 1; });
      if (!cand.length) cand = pool.filter(function (q) { return !used[q.id]; });
      if (!cand.length) return;
      var fresh = cand.filter(function (q) { return !picked.some(function (p) { return p.topic === q.topic; }); });
      var src = fresh.length ? fresh : cand;
      var q = src[Math.floor(Math.random() * src.length)];
      used[q.id] = 1;
      picked.push(q);
    });
    return picked;
  }
  function buildPlan() {
    var c = S.config, counts = countsFor(c.type, c.duration), rounds = [];
    if (counts.tech > 0) {
      var topics = BANK.roleTopics[c.role] || ["fundamentals", "oop", "dsa", "dbms", "os", "cn", "web"];
      var items = pickTechnical(counts.tech, topics, c.difficulty).map(function (q) { return openItem(q, "bank"); });
      if (S.resume && S.resume.questions.length) {
        S.resume.questions.slice(0, 2).forEach(function (q) {
          items.push(openItem({ topic: q.topic || "resume", q: q.q, points: q.points, followups: [] }, "resume"));
        });
      }
      var proj = (S.projectMaterial && S.projectMaterial.length) ? S.projectMaterial : useSkillzifyProjects(false);
      (proj || []).slice(0, 2).forEach(function (pr) {
        items.push(openItem({
          topic: "project",
          q: "Let's talk about your Skillzify project \"" + pr.title + "\" — " + (pr.tagline || "") + " What was the hardest part to build, and how did you solve it?",
          points: ["what the project does and the problem it solves", "their own contribution to building it", "the hardest technical problem and how they solved it", "what they would improve or scale next"],
          followups: [{ kind: "deeper", q: "If \"" + pr.title + "\" suddenly had 10,000 users, what would break first, and what would you change?" }]
        }, "project"));
      });
      if (items.length) rounds.push({ kind: "technical", label: "Technical Round", items: items, score: null, scoreMode: null });
    }
    if (counts.coding > 0) {
      var tiers = c.difficulty === "Beginner" ? [1] : c.difficulty === "Advanced" ? [2, 3] : [1, 2];
      var pool = shuffle(BANK.coding.filter(function (x) { return tiers.indexOf(x.tier) !== -1; }));
      if (pool.length < counts.coding) pool = pool.concat(shuffle(BANK.coding.filter(function (x) { return pool.indexOf(x) === -1; })));
      rounds.push({ kind: "coding", label: "Coding Round", items: pool.slice(0, counts.coding).map(codingItem), score: null, scoreMode: "local" });
    }
    if (counts.hr > 0) {
      var hrItems = shuffle(BANK.hr.slice()).slice(0, counts.hr).map(function (q) { return openItem(q, "bank"); });
      rounds.push({ kind: "hr", label: "HR Round", items: hrItems, score: null, scoreMode: null });
    }
    return rounds;
  }

  /* ---------------- local rubric scoring ---------------- */
  var STOPWORDS = {};
  "the,and,for,are,but,not,you,all,any,can,had,her,was,one,our,out,has,have,that,with,they,this,from,when,what,were,your,will,would,there,their,been,than,then,into,over,under,about,which,while,where,these,those,being,does,used,using,also,each,other,more,most,such,like,just,get,set,way,one,two,first".split(",").forEach(function (w) { STOPWORDS[w] = 1; });
  function tokens(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9+#\s]/g, " ").split(/\s+/).filter(function (w) { return w.length > 2 && !STOPWORDS[w]; });
  }
  function tokenHit(tok, set) {
    if (set[tok]) return true;
    if (tok.length >= 5) { for (var k in set) { if (k.indexOf(tok) === 0 || tok.indexOf(k) === 0) return true; } }
    return false;
  }
  var STAR_CHECKS = [
    function (a) { return a.length > 40 || /\b(when|during|project|team|college|internship|semester|once)\b/i.test(a); },
    function (a) { return /\b(i was|my task|responsible|assigned|had to|needed to|my role|asked me)\b/i.test(a); },
    function (a) { return /\b(i|we)\s+(built|created|decided|spoke|asked|wrote|organised|organized|led|fixed|designed|talked|met|proposed|started|ran|made|tested|documented)\b/i.test(a); },
    function (a) { return /\b(result|improved|delivered|reduced|increased|completed|passed|learned|outcome|shipped|won|saved|grew|%|percent)\b/i.test(a) || /\d/.test(a); },
    function (a) { return /\b(learned|learnt|next time|now i|differently|taught me|in future|looking back)\b/i.test(a); }
  ];
  function starCovered(i, answer) { var f = STAR_CHECKS[i]; return f ? !!f(answer) : String(answer).length > 60; }
  function coveredPoints(item, answer) {
    var set = {};
    tokens(answer).forEach(function (t) { set[t] = 1; });
    return item.points.map(function (pt, i) {
      if (item.topic === "hr") return starCovered(i, answer);
      var pts = tokens(pt);
      if (!pts.length) return false;
      var hits = 0;
      pts.forEach(function (t) { if (tokenHit(t, set)) hits++; });
      return hits / pts.length >= 0.45;
    });
  }
  function localScore(item) {
    var combined = ((item.answer || "") + " " + (item.fuAnswer || "")).trim();
    if (item.skipped || combined.length < 3) return { score: item.skipped ? 0 : 2, covered: item.points.map(function () { return false; }) };
    var cov = coveredPoints(item, combined);
    var coveredN = 0;
    cov.forEach(function (c) { if (c) coveredN++; });
    var ratio = item.points.length ? coveredN / item.points.length : 0;
    var words = combined.split(/\s+/).length;
    var lenCap = words < 8 ? 30 : words < 20 ? 55 : words < 40 ? 80 : 100;
    var score = Math.round(ratio * 88 + (words >= 40 ? 8 : words >= 20 ? 4 : 0));
    score = clamp(Math.min(score, lenCap === 100 ? 97 : lenCap + Math.round(ratio * 12)), 4, 97);
    return { score: score, covered: cov };
  }
  function bandOf(item, answer) {
    var probe = { answer: answer, fuAnswer: "", points: item.points, topic: item.topic, skipped: false };
    var s = localScore(probe);
    var words = String(answer || "").trim().split(/\s+/).filter(Boolean).length;
    if (!String(answer || "").trim() || (words < 5 && s.score < 15)) return { band: "irrelevant", score: s.score, covered: s.covered };
    if (s.score >= 68) return { band: "strong", score: s.score, covered: s.covered };
    if (s.score >= 38) return { band: "partial", score: s.score, covered: s.covered };
    return { band: "weak", score: s.score, covered: s.covered };
  }

  /* ---------------- adaptive controller (spec action table) ---------------- */
  function authoredFollowup(item, kind, missingIdx) {
    var fus = item.followups || [], i;
    if (kind === "probe" && missingIdx >= 0) {
      for (i = 0; i < fus.length; i++) if (fus[i].kind === "probe" && fus[i].point === missingIdx) return fus[i].q;
    }
    for (i = 0; i < fus.length; i++) if (fus[i].kind === kind) return fus[i].q;
    return null;
  }
  function decideLocalFollowup(item, info) {
    var missing = [];
    info.covered.forEach(function (c, i) { if (!c) missing.push(i); });
    if (info.band === "strong") {
      var d = authoredFollowup(item, "deeper", -1);
      return d ? { q: d, kind: "deeper" } : null;
    }
    if (info.band === "partial") {
      var mi = missing.length ? missing[0] : -1;
      var p = authoredFollowup(item, "probe", mi);
      if (p) return { q: p, kind: "probe" };
      if (mi >= 0) return { q: "Let's go deeper on one part: " + item.points[mi] + " — tell me more about that.", kind: "probe" };
      return null;
    }
    if (info.band === "weak") {
      if (item.topic !== "hr") {
        var usedQ = {};
        S.session.rounds.forEach(function (r) { r.items.forEach(function (it) { usedQ[it.q] = 1; }); });
        var easier = BANK.technical.filter(function (q) { return q.topic === item.topic && q.tier === 1 && !usedQ[q.q]; });
        if (easier.length) return { q: easier[0].q, kind: "diagnostic" };
      }
      if (missing.length) return { q: "Let's break it down. Start with this: " + item.points[missing[0]] + " — what can you tell me about that?", kind: "diagnostic" };
      return null;
    }
    return { q: "Let's come back to the question itself: " + item.q, kind: "redirect" };
  }
  function reactionFor(style, band, kind) {
    var pool = {
      Friendly: { strong: ["Great answer.", "That's a strong response — nicely explained."], partial: ["Good start.", "You're on the right track."], weak: ["Thanks for trying that one.", "Okay, let's approach it from another angle."], irrelevant: ["No worries — let's refocus."], diagnostic: ["Let's try a simpler one on the same idea."], probe: ["Let me dig a little deeper there."], deeper: ["Impressive. Let's push further."] },
      Challenging: { strong: ["Adequate. Let's see if it holds up."], partial: ["Partially there — that answer has gaps."], weak: ["That's not convincing."], irrelevant: ["That doesn't answer my question."], diagnostic: ["Let's test the basics then."], probe: ["You'll need to be more specific."], deeper: ["Fine. Harder, then."] },
      Professional: { strong: ["Thank you — that's comprehensive."], partial: ["Understood. One point needs more depth."], weak: ["Noted."], irrelevant: ["Let's return to the question."], diagnostic: ["A more fundamental question on the same topic, then."], probe: ["I'd like to probe one point further."], deeper: ["Good. A follow-up on that."] }
    };
    var set = pool[style] || pool.Professional;
    var arr = set[kind] || set[band] || [""];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ---------------- session view ---------------- */
  function currentRound() { return S.session ? S.session.rounds[S.session.ri] : null; }
  function currentItem() { var r = currentRound(); return r ? r.items[S.session.ii] : null; }
  function pushBot(text, tag) { S.session.transcript.push({ who: "bot", text: text, tag: tag || "" }); renderTranscript(); }
  function pushMe(text) { S.session.transcript.push({ who: "me", text: text }); renderTranscript(); }
  function pushSys(text) { S.session.transcript.push({ who: "sys", text: text }); renderTranscript(); }
  function renderSession() {
    $("iv-root").innerHTML =
      '<div class="card" style="max-width:920px;margin:0 auto">' +
        '<div class="iv-progress-line" id="iv-progress"></div>' +
        '<div class="iv-transcript" id="iv-transcript"></div>' +
        '<div id="iv-composer"></div>' +
      "</div>";
    renderProgress();
    renderTranscript();
    renderComposer();
  }
  function renderProgress() {
    var sess = S.session, el = $("iv-progress");
    if (!sess || !el) return;
    var chips = sess.rounds.map(function (r, i) {
      return '<span class="iv-chip">' + (i < sess.ri ? "✓ " : "") + esc(r.label) + (i === sess.ri ? " · <strong>" + (sess.ii + 1) + "/" + r.items.length + "</strong>" : "") + "</span>";
    }).join("");
    el.innerHTML = '<span class="iv-chip">🎙️ <strong>' + esc(sess.config.role) + '</strong></span><span class="iv-chip">' + esc(sess.config.difficulty) + " · " + esc(sess.config.style) + "</span>" + chips +
      '<span class="iv-chip" id="iv-elapsed">⏱ 0:00</span><span class="iv-chip">AI calls: <strong id="iv-aicalls">' + sess.aiCalls + "</strong></span>" +
      '<button class="btn btn-ghost btn-sm" id="iv-quit" type="button" style="margin-left:auto">End interview</button>';
    $("iv-quit").addEventListener("click", function () {
      if (window.confirm("End this interview now? It won't be scored or saved.")) { clearTimers(); S.session = null; renderSetup(); }
    });
  }
  function renderTranscript() {
    var el = $("iv-transcript");
    if (!el || !S.session) return;
    el.innerHTML = S.session.transcript.map(function (m) {
      return '<div class="iv-msg ' + (m.who === "bot" ? "iv-bot" : m.who === "me" ? "iv-me" : "iv-sys") + '">' + (m.tag ? '<span class="iv-qtag">' + esc(m.tag) + "</span>" : "") + esc(m.text) + "</div>";
    }).join("");
    el.scrollTop = el.scrollHeight;
  }
  function renderComposer() {
    var el = $("iv-composer");
    if (!el || !S.session) return;
    var sess = S.session, item = currentItem();
    if (sess.phase === "coding" && item) { renderCodingComposer(el, item); return; }
    if (sess.phase === "scoring") { el.innerHTML = '<p class="hint" style="margin-top:12px">⏳ Scoring this round…</p>'; return; }
    if (sess.phase === "done") { el.innerHTML = ""; return; }
    var placeholder = sess.phase === "approach" ? "Explain your approach: what was the core idea, and why does it work?"
      : sess.phase === "complexity" ? "What is the time and space complexity of your solution? (e.g. time O(n), space O(1))"
      : "Type your answer… (no hints in a scored interview — answer as you would in the real room)";
    el.innerHTML =
      '<div class="iv-composer"><textarea class="input" id="iv-answer" placeholder="' + esc(placeholder) + '"></textarea>' +
      '<div class="iv-actions"><button class="btn btn-primary" id="iv-send" type="button">' + (sess.phase === "main" ? "Answer →" : "Continue →") + "</button>" +
      (sess.phase === "main" ? '<button class="btn btn-ghost" id="iv-skip" type="button">Skip question</button>' : "") +
      '<span class="hint" id="iv-busy"></span></div></div>';
    $("iv-send").addEventListener("click", onSubmitAnswer);
    var ta = $("iv-answer");
    ta.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmitAnswer(); });
    var skip = $("iv-skip");
    if (skip) skip.addEventListener("click", function () { submitAnswer("", true); });
    ta.focus();
  }
  function startElapsedTimer() {
    var t = setInterval(function () {
      if (!S.session) { clearInterval(t); return; }
      var el = $("iv-elapsed");
      if (el) {
        var s = Math.floor((Date.now() - S.session.startedAt) / 1000);
        el.textContent = "⏱ " + Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
      }
      var ac = $("iv-aicalls");
      if (ac) ac.textContent = S.session.aiCalls;
    }, 1000);
    S.timers.push(t);
  }

  /* ---------------- engine flow ---------------- */
  function startInterview() {
    var rounds = buildPlan();
    if (!rounds.length || !rounds.some(function (r) { return r.items.length; })) { toast("No questions available right now — please try again."); return; }
    S.session = {
      id: "iv-" + Date.now().toString(36),
      startedAt: Date.now(),
      config: JSON.parse(JSON.stringify(S.config)),
      rounds: rounds, ri: 0, ii: 0, phase: "main",
      transcript: [], aiCalls: S.resumeAiCalls || 0, aiDead: false, turnUsed: {},
      codingItemStartedAt: 0, codingDeadline: 0,
      resumeUsed: !!S.resume
    };
    S.resumeAiCalls = 0;
    renderSession();
    var c = S.session.config;
    var scope = c.type === "Mixed" ? "technical questions, a live coding round, and an HR conversation" : c.type === "Technical" ? "technical questions" : c.type === "Coding" ? "live coding problems" : "an HR conversation";
    var name = S.profile.name ? " " + S.profile.name.split(" ")[0] : "";
    var intro = c.style === "Friendly"
      ? "Hi" + name + "! Great to meet you. I'm your Skillzify interviewer, and today we'll go through " + scope + ". Take your time, think out loud, and don't worry about being perfect — I just want to see how you think. Here's your first question."
      : c.style === "Challenging"
      ? "Let's begin" + name + ". This interview covers " + scope + ". I expect precise, complete answers — vague generalities won't score, and I will push on anything that sounds memorised. First question."
      : "Hello" + name + ", welcome to your Skillzify interview for the " + c.role + " role. We'll cover " + scope + ". Answer in your own words, with examples where you can. First question.";
    pushBot(intro, "Welcome");
    var first = currentRound();
    pushSys(first.label + " — " + first.items.length + (first.kind === "coding" ? " problem(s)" : " question(s)"));
    askCurrent();
    startElapsedTimer();
  }
  function askCurrent() {
    var sess = S.session, item = currentItem(), round = currentRound();
    if (!item) { endRound(); return; }
    renderProgress();
    if (item.kind === "coding") {
      sess.phase = "coding";
      sess.codingItemStartedAt = Date.now();
      sess.codingDeadline = Date.now() + item.minutes * 60000;
      pushBot("Coding problem — " + item.title + " (" + item.minutes + " minutes, Python)\n\n" + item.prompt + "\n\nVisible tests run right in the editor below; when you submit, hidden edge-case tests run too.", round.label + " · Problem " + (sess.ii + 1));
      renderComposer();
      startCodingTimer();
      return;
    }
    sess.phase = "main";
    pushBot(item.q, round.label + " · " + (TOPIC_LABEL[item.topic] || item.topic) + (item.src === "resume" ? " · from your resume" : item.src === "project" ? " · your project" : ""));
    renderComposer();
  }
  function onSubmitAnswer() {
    var ta = $("iv-answer");
    if (!ta || ta.disabled) return;
    submitAnswer(ta.value, false);
  }
  function setBusy(msg) {
    var b = $("iv-busy"); if (b) b.textContent = msg;
    var ta = $("iv-answer"); if (ta) ta.disabled = true;
    var s = $("iv-send"); if (s) s.disabled = true;
  }
  function submitAnswer(text, skipped) {
    var sess = S.session;
    if (!sess) return;
    var item = currentItem();
    if (!item) return;
    text = String(text || "");
    if (sess.phase === "approach") { item.approach = text; pushMe(text || "(no explanation given)"); askComplexity(); return; }
    if (sess.phase === "complexity") { item.complexityAnswer = text; pushMe(text || "(not stated)"); finishCodingItem(item); return; }
    if (sess.phase === "followup") { item.fuAnswer = text; pushMe(text || "(no follow-up answer)"); advanceItem(); return; }
    item.answer = text;
    item.skipped = !!skipped;
    pushMe(skipped ? "(skipped)" : text);
    if (skipped || !text.trim()) { advanceItem(); return; }
    var info = bandOf(item, text);
    if (!sess.turnUsed[sess.ri] && !sess.aiDead && window.SkillzifyAI) {
      sess.turnUsed[sess.ri] = true;
      setBusy("Your interviewer is thinking…");
      aiTurn(item, text, info, function (aiRes) {
        if (!S.session) return;
        if (aiRes) {
          var act = aiRes.action;
          if ((act === "deeper" || act === "clarify" || act === "probe" || act === "diagnostic" || act === "redirect") && aiRes.followup_question) {
            askFollowup(item, aiRes.say, aiRes.followup_question, act);
            return;
          }
          if (aiRes.say) pushBot(aiRes.say);
          advanceItem();
          return;
        }
        localFollowupOrAdvance(item, info);
      });
      return;
    }
    localFollowupOrAdvance(item, info);
  }
  function localFollowupOrAdvance(item, info) {
    var fu = decideLocalFollowup(item, info);
    if (!fu) { advanceItem(); return; }
    askFollowup(item, reactionFor(S.session.config.style, info.band, fu.kind), fu.q, fu.kind);
  }
  function askFollowup(item, say, q, kind) {
    item.fuQ = q;
    item.fuKind = kind;
    S.session.phase = "followup";
    pushBot((say ? say + "\n\n" : "") + q, "Follow-up");
    renderComposer();
  }
  function aiTurn(item, answer, info, cb) {
    var sess = S.session, digest = [];
    sess.rounds.slice(0, sess.ri + 1).forEach(function (r) {
      r.items.forEach(function (it) {
        if (it !== item && it.answer) digest.push({ topic: it.topic, band: bandOf(it, it.answer).band });
      });
    });
    var state = {
      role: sess.config.role, style: sess.config.style, type: sess.config.type,
      round: currentRound().label, question: item.q, rubricPoints: item.points,
      coveredSoFar: digest.slice(-6), localRead: info.band,
      missingPoints: item.points.filter(function (pt, i) { return !info.covered[i]; })
    };
    var payload = JSON.stringify(state);
    if (payload.length > 7800) payload = payload.slice(0, 7800);
    aiAsk({ mode: "interview_turn", code: payload, error: String(answer).slice(0, 1500), json: true, cache: false }, function (err, res) {
      if (err || !res || !res.data || typeof res.data.say !== "string" || TURN_ACTIONS.indexOf(res.data.action) === -1) { cb(null); return; }
      cb({ say: res.data.say.slice(0, 600), action: res.data.action, followup_question: typeof res.data.followup_question === "string" ? res.data.followup_question.slice(0, 500) : "" });
    });
  }
  function advanceItem() {
    var sess = S.session;
    if (!sess) return;
    sess.ii++;
    renderProgress();
    if (sess.ii >= currentRound().items.length) { endRound(); return; }
    askCurrent();
  }

  /* ---------------- round scoring ---------------- */
  function applyScore(item, score, covered, src) {
    item.score = clamp(Math.round(score), 0, 100);
    item.scoreSrc = src;
    var covNames = item.points.filter(function (pt, i) { return covered[i]; });
    var missNames = item.points.filter(function (pt, i) { return !covered[i]; });
    item.well = covNames.length ? "Covered: " + covNames.join("; ") : (item.score >= 40 ? "A reasonable attempt with some correct ideas." : "");
    item.improve = missNames.length ? "Missing: " + missNames.join("; ") : (item.score >= 85 ? "Add a concrete example to make it airtight." : "Add more depth and a concrete example.");
    item.evidence = "";
  }
  function localScoreRound(round) {
    round.items.forEach(function (item) {
      if (item.kind !== "open") return;
      var r = localScore(item);
      applyScore(item, r.score, r.covered, "local");
    });
  }
  function computeRoundScore(round) {
    var total = 0, n = 0;
    round.items.forEach(function (it) { if (typeof it.score === "number") { total += it.score; n++; } });
    round.score = n ? Math.round(total / n) : 0;
  }
  function aiScoreRound(round, cb) {
    var items = round.items.filter(function (it) { return it.kind === "open"; });
    if (!items.length) { cb(false); return; }
    var payloadItems = items.map(function (item, i) {
      var ans = (item.answer || "") + (item.fuQ ? "\nFollow-up asked: " + item.fuQ + "\nFollow-up answer: " + (item.fuAnswer || "") : "");
      return { i: i, q: item.q.slice(0, 300), points: item.points.slice(0, 4), answer: ans.slice(0, 620) };
    });
    var payload = JSON.stringify({ round: round.label, items: payloadItems });
    if (payload.length > 7900) {
      payloadItems.forEach(function (p) { p.answer = p.answer.slice(0, 380); });
      payload = JSON.stringify({ round: round.label, items: payloadItems });
    }
    aiAsk({ mode: "interview_score", code: payload, json: true, cache: false }, function (err, res) {
      if (err || !res || !res.data || !Array.isArray(res.data.scores)) { cb(false); return; }
      var applied = 0;
      res.data.scores.forEach(function (s) {
        if (!s || typeof s.i !== "number" || !items[s.i] || typeof s.score !== "number") return;
        var item = items[s.i];
        item.score = clamp(Math.round(s.score), 0, 100);
        item.scoreSrc = "ai";
        item.well = typeof s.well === "string" ? s.well.slice(0, 300) : "";
        item.improve = typeof s.improve === "string" ? s.improve.slice(0, 300) : "";
        item.evidence = typeof s.evidence === "string" ? s.evidence.slice(0, 200) : "";
        applied++;
      });
      items.forEach(function (item) {
        if (typeof item.score !== "number") { var r = localScore(item); applyScore(item, r.score, r.covered, "local"); }
      });
      cb(applied > 0);
    });
  }
  function endRound() {
    var sess = S.session, round = currentRound();
    if (!sess || !round) return;
    if (round.kind === "coding") {
      computeRoundScore(round);
      round.scoreMode = "local";
      afterRoundScored(round);
      return;
    }
    sess.phase = "scoring";
    renderComposer();
    var finish = function () { computeRoundScore(round); afterRoundScored(round); };
    if (!sess.aiDead && window.SkillzifyAI) {
      aiScoreRound(round, function (ok) {
        round.scoreMode = ok ? "ai" : "offline";
        if (!ok) localScoreRound(round);
        finish();
      });
    } else {
      round.scoreMode = "offline";
      localScoreRound(round);
      finish();
    }
  }
  function afterRoundScored(round) {
    var sess = S.session;
    if (!sess) return;
    pushSys(round.label + " complete — round score " + round.score + "/100" + (round.scoreMode === "offline" ? " (offline rubric scoring — the AI was unavailable)" : "") + ".");
    sess.ri++;
    sess.ii = 0;
    sess.phase = "main";
    renderProgress();
    if (sess.ri >= sess.rounds.length) { finishInterview(); return; }
    var next = currentRound();
    pushSys(next.label + " — " + next.items.length + (next.kind === "coding" ? " problem(s)" : " question(s)"));
    if (next.kind === "hr") {
      pushBot(sess.config.style === "Friendly"
        ? "Great work so far! Now let's talk about you — your experiences, how you work with people, and what you're aiming for."
        : "That concludes the technical portion. Now the HR round — I want specific, real examples from your own experience, structured clearly: situation, your actions, the result.", next.label);
    }
    askCurrent();
  }

  /* ---------------- coding round (Pyodide) ---------------- */
  function ensurePy(cb) {
    if (S.py) { cb(null, S.py); return; }
    if (S.pyFailed) { cb(new Error("pyodide-failed"), null); return; }
    if (S.pyLoading) { S.pyWaiters.push(cb); return; }
    S.pyLoading = true;
    S.pyWaiters = [cb];
    var done = function (err, py) {
      S.pyLoading = false;
      if (!err && py) S.py = py; else S.pyFailed = true;
      var ws = S.pyWaiters;
      S.pyWaiters = [];
      ws.forEach(function (w) { try { w(err, py); } catch (e) {} });
    };
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
    s.onload = function () {
      try {
        window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" }).then(function (py) { done(null, py); }, function () { done(new Error("init"), null); });
      } catch (e) { done(e, null); }
    };
    s.onerror = function () { done(new Error("load"), null); };
    document.head.appendChild(s);
  }
  var PY_DRIVER = [
    "import json",
    "def __iv_run(code, tests_json):",
    "    tests = json.loads(tests_json)",
    "    results = []",
    "    ns = {}",
    "    setup_error = None",
    "    try:",
    "        exec(code, ns)",
    "    except Exception as e:",
    "        setup_error = type(e).__name__ + ': ' + str(e)",
    "    for t in tests:",
    "        if setup_error is not None:",
    "            results.append({'pass': False, 'got': '', 'error': setup_error})",
    "            continue",
    "        try:",
    "            val = eval(t['run'], ns)",
    "            got = str(val)",
    "            results.append({'pass': got == t['expect'], 'got': got, 'error': None})",
    "        except Exception as e:",
    "            results.append({'pass': False, 'got': '', 'error': type(e).__name__ + ': ' + str(e)})",
    "    return json.dumps(results)"
  ].join("\n");
  function runTests(item, all, cb) {
    var busy = $("iv-code-busy");
    if (busy) busy.textContent = "Loading Python…";
    ensurePy(function (err, py) {
      if (err) {
        if (busy) busy.textContent = "";
        toast("Python could not load (network). Your code is kept — you can still submit; unexecuted code scores 0 on tests.");
        if (cb) cb(null);
        return;
      }
      try { py.setStdout({ batched: function () {} }); py.setStderr({ batched: function () {} }); } catch (e) {}
      if (busy) busy.textContent = "Running tests…";
      setTimeout(function () {
        var tests = all ? item.visible.concat(item.hidden) : item.visible;
        var out = null;
        try {
          py.globals.set("__iv_code", item.code);
          py.globals.set("__iv_tests", JSON.stringify(tests));
          out = py.runPython(PY_DRIVER + "\n__iv_run(__iv_code, __iv_tests)");
        } catch (e) { out = null; }
        if (busy) busy.textContent = "";
        var results = null;
        try { results = JSON.parse(out); } catch (e) {}
        if (!results) { toast("The test runner hit a problem — try running again."); if (cb) cb(null); return; }
        if (all) item.allResults = results; else item.visResults = results;
        if (cb) cb(results); else if (S.session && S.session.phase === "coding") renderComposer();
      }, 30);
    });
  }
  function renderCodingComposer(el, item) {
    var vis = item.visible.map(function (t, i) {
      var r = item.visResults && item.visResults[i];
      var st = !r ? '<span class="st" style="color:var(--muted)">— not run</span>' : r.pass ? '<span class="st">✓ PASS</span>' : '<span class="st">✗ FAIL</span>';
      var cls = !r ? "" : r.pass ? " pass" : " fail";
      var detail = !r || r.pass ? "" : ' <span style="color:var(--muted)">got ' + esc(r.error ? r.error : r.got) + " · expected " + esc(t.expect) + "</span>";
      return '<div class="iv-test' + cls + '">' + st + "<span>" + esc(t.run) + " → " + esc(t.expect) + "</span>" + detail + "</div>";
    }).join("");
    el.innerHTML =
      '<div style="margin-top:12px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong style="font-family:var(--font-mono);font-size:.85rem">' + esc(item.title) + " · solution.py</strong>" +
      '<span class="iv-chip" id="iv-coding-timer">⏱ ' + item.minutes + ':00</span>' +
      '<span class="iv-chip">Hidden tests: <strong>' + item.hidden.length + "</strong> (run at submission)</span>" +
      '<span class="hint" id="iv-py-status"></span></div>' +
      '<div class="iv-editor-wrap" style="margin-top:8px"><div class="iv-gutter" id="iv-gutter">1</div>' +
      '<textarea class="iv-editor" id="iv-code" spellcheck="false">' + esc(item.code) + "</textarea></div>" +
      '<div class="iv-actions"><button class="btn btn-ghost" id="iv-run" type="button">▶ Run visible tests</button>' +
      '<button class="btn btn-primary" id="iv-submit-code" type="button">Submit problem →</button>' +
      '<span class="hint" id="iv-code-busy"></span></div>' +
      '<div class="iv-tests">' + vis + "</div></div>";
    var ta = $("iv-code");
    var syncGutter = function () {
      var lines = ta.value.split("\n").length, g = "", i;
      for (i = 1; i <= lines; i++) g += i + "\n";
      var gut = $("iv-gutter");
      if (gut) { gut.textContent = g; gut.scrollTop = ta.scrollTop; }
    };
    ta.addEventListener("input", function () { item.code = ta.value; syncGutter(); });
    ta.addEventListener("scroll", function () { var gut = $("iv-gutter"); if (gut) gut.scrollTop = ta.scrollTop; });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        e.preventDefault();
        var st = ta.selectionStart;
        ta.value = ta.value.slice(0, st) + "    " + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = st + 4;
        item.code = ta.value;
        syncGutter();
      }
    });
    syncGutter();
    $("iv-run").addEventListener("click", function () { var t2 = $("iv-code"); if (t2) item.code = t2.value; runTests(item, false); });
    $("iv-submit-code").addEventListener("click", function () { submitCoding(item); });
  }
  function startCodingTimer() {
    var t = setInterval(function () {
      var sess = S.session, el = $("iv-coding-timer");
      if (!sess || sess.phase !== "coding" || !el) { clearInterval(t); return; }
      var left = Math.max(0, Math.round((sess.codingDeadline - Date.now()) / 1000));
      el.textContent = "⏱ " + Math.floor(left / 60) + ":" + ("0" + (left % 60)).slice(-2);
      if (left <= 60) el.classList.add("iv-timer-warn");
      if (left <= 0) {
        clearInterval(t);
        var item = currentItem();
        if (item && item.kind === "coding" && !item.submitted) { pushSys("Time's up for this problem — submitting your current code."); submitCoding(item); }
      }
    }, 500);
    S.timers.push(t);
  }
  function submitCoding(item) {
    if (item.submitted || !S.session) return;
    var ta = $("iv-code");
    if (ta) item.code = ta.value;
    item.submitted = true;
    item.timeUsedSec = Math.round((Date.now() - S.session.codingItemStartedAt) / 1000);
    runTests(item, true, function (results) {
      if (!S.session) return;
      if (!results) {
        item.allResults = item.visible.concat(item.hidden).map(function () { return { pass: false, got: "", error: "Python unavailable" }; });
      }
      item.visResults = item.allResults.slice(0, item.visible.length);
      scoreCodingParts(item);
      var passed = 0;
      item.allResults.forEach(function (r) { if (r.pass) passed++; });
      pushBot("Submitted — " + passed + " of " + item.allResults.length + " tests passed (" + item.visible.length + " visible + " + item.hidden.length + " hidden).", "Result · " + item.title);
      S.session.phase = "approach";
      pushBot("Before we move on — walk me through your approach: what was the core idea, and why does it work?", "Explain your approach");
      renderComposer();
    });
  }
  function complexityRank(expr) {
    var e = String(expr || "").toLowerCase().replace(/\s+/g, "");
    if (!e) return -1;
    if (/2\^n/.test(e)) return 6;
    if (/n\^3|n\*\*3/.test(e)) return 5;
    if (/n\^2|n\*\*2|n²/.test(e)) return 4;
    if (/nlogn|klogk/.test(e)) return 3;
    if (/n\+m|n\*m/.test(e)) return 2;
    if (/\(n\)|^n$/.test(e)) return 2;
    if (/logn/.test(e)) return 1;
    if (/\(1\)|^1$/.test(e)) return 0;
    if (e.indexOf("n") !== -1) return 2;
    return -1;
  }
  function heuristicTimeRank(code) {
    var src = String(code || "");
    var hasSort = /\.sort\(|sorted\(/.test(src);
    var fn = (src.match(/def\s+([A-Za-z_]\w*)/) || [])[1];
    var recursive = false;
    if (fn) {
      var body = src.split("\n").slice(1).join("\n");
      recursive = new RegExp("\\b" + fn + "\\s*\\(").test(body);
    }
    var maxDepth = 0, stack = [];
    src.split("\n").forEach(function (ln) {
      var m = ln.match(/^(\s*)(for|while)\b/);
      if (m) {
        var ind = m[1].length;
        while (stack.length && stack[stack.length - 1] >= ind) stack.pop();
        stack.push(ind);
        if (stack.length > maxDepth) maxDepth = stack.length;
      }
    });
    if (maxDepth >= 2) return 4;
    if (maxDepth === 1) return hasSort ? 3 : 2;
    if (hasSort) return 3;
    return 2;
  }
  function heuristicSpaceRank(code) {
    var src = String(code || "");
    if (/\bfor\b/.test(src) && /(set\(|dict\(|defaultdict|Counter\(|\.append\(|list\(|\.setdefault\()/.test(src)) return 2;
    var fn = (src.match(/def\s+([A-Za-z_]\w*)/) || [])[1];
    if (fn && new RegExp("\\b" + fn + "\\s*\\(").test(src.split("\n").slice(1).join("\n"))) return 2;
    return 0;
  }
  function cxScore(statedExpr, optimalExpr, heuristic) {
    var opt = complexityRank(optimalExpr), st = complexityRank(statedExpr);
    if (st >= 0 && opt >= 0) {
      var d = Math.abs(st - opt);
      return d === 0 ? 1 : d === 1 ? 0.55 : 0.2;
    }
    if (opt >= 0) return Math.abs(heuristic - opt) === 0 ? 0.5 : 0.15;
    return 0.5;
  }
  function qualityScore(item) {
    var code = item.code || "";
    var lines = code.split("\n").filter(function (l) { return l.trim().length; });
    if (!lines.length) return 0;
    var pts = 0;
    if (/def\s+[a-z_][a-z0-9_]*\s*\(/.test(code)) pts += 3;
    if (/\breturn\b/.test(code)) pts += 2;
    if (lines.length >= 3 && lines.length <= 45) pts += 2;
    if (/"""|'''|#/.test(code)) pts += 1.5;
    if (!/[a-z][A-Z]/.test(code)) pts += 1.5;
    return Math.min(10, Math.round(pts));
  }
  function scoreCodingParts(item) {
    var R = BANK.codingRubric;
    var vis = item.allResults.slice(0, item.visible.length);
    var hid = item.allResults.slice(item.visible.length);
    var visPass = 0, hidPass = 0;
    vis.forEach(function (r) { if (r.pass) visPass++; });
    hid.forEach(function (r) { if (r.pass) hidPass++; });
    item.parts = {
      correctness: Math.round(R.correctness * (item.visible.length ? visPass / item.visible.length : 0)),
      edge: Math.round(R.edge * (item.hidden.length ? hidPass / item.hidden.length : 1)),
      time: 0, space: 0,
      quality: qualityScore(item),
      explanation: 0
    };
  }
  function askComplexity() {
    S.session.phase = "complexity";
    pushBot("Last thing on this problem: what is the time complexity and the space complexity of your solution? Answer like \"time O(n), space O(1)\".", "Complexity check");
    renderComposer();
  }
  function finishCodingItem(item) {
    var R = BANK.codingRubric;
    var matches = String(item.complexityAnswer || "").match(/O\s*\(([^)]*)\)/gi) || [];
    item.parts.time = Math.round(R.time * cxScore(matches[0] || "", item.optimalTime, heuristicTimeRank(item.code)));
    item.parts.space = Math.round(R.space * cxScore(matches[1] || "", item.optimalSpace, heuristicSpaceRank(item.code)));
    var set = {};
    tokens(item.approach || "").forEach(function (t) { set[t] = 1; });
    var hits = 0;
    item.ideaPoints.forEach(function (pt) {
      var pts = tokens(pt);
      if (!pts.length) return;
      var h = 0;
      pts.forEach(function (t) { if (tokenHit(t, set)) h++; });
      if (h / pts.length >= 0.3) hits++;
    });
    var words = String(item.approach || "").trim().split(/\s+/).filter(Boolean).length;
    var ratio = item.ideaPoints.length ? hits / item.ideaPoints.length : 0;
    item.parts.explanation = Math.round(R.explanation * clamp(ratio * (words >= 8 ? 1 : 0.4), 0, 1));
    item.score = clamp(item.parts.correctness + item.parts.edge + item.parts.time + item.parts.space + item.parts.quality + item.parts.explanation, 0, 100);
    advanceItem();
  }

  /* ---------------- report ---------------- */
  function buildReport(sess) {
    var perSkill = {}, itemsOut = [], roundScores = [], anyAi = false, anyOffline = false;
    sess.rounds.forEach(function (round) {
      roundScores.push({ kind: round.kind, label: round.label, score: round.score, scoreMode: round.scoreMode });
      if (round.kind !== "coding") { if (round.scoreMode === "ai") anyAi = true; else anyOffline = true; }
      round.items.forEach(function (item) {
        var sc = typeof item.score === "number" ? item.score : 0;
        if (!perSkill[item.skill]) perSkill[item.skill] = { total: 0, n: 0 };
        perSkill[item.skill].total += sc;
        perSkill[item.skill].n++;
        if (item.kind === "coding") {
          var passed = 0;
          (item.allResults || []).forEach(function (r) { if (r.pass) passed++; });
          itemsOut.push({ kind: "coding", skill: item.skill, title: item.title, q: item.prompt, score: sc, parts: item.parts, testsPassed: passed, testsTotal: (item.allResults || []).length, timeUsedSec: item.timeUsedSec, approach: item.approach, complexityAnswer: item.complexityAnswer, optimalTime: item.optimalTime, optimalSpace: item.optimalSpace });
        } else {
          itemsOut.push({ kind: "open", skill: item.skill, topic: item.topic, q: item.q, answer: item.answer, fuQ: item.fuQ, fuAnswer: item.fuAnswer, score: sc, well: item.well || "", improve: item.improve || "", evidence: item.evidence || "", scoreSrc: item.scoreSrc || "" });
        }
      });
    });
    var perSkillOut = {}, overallTotal = 0;
    Object.keys(perSkill).forEach(function (k) { perSkillOut[k] = { score: Math.round(perSkill[k].total / perSkill[k].n), n: perSkill[k].n }; });
    roundScores.forEach(function (r) { overallTotal += r.score; });
    var overall = roundScores.length ? Math.round(overallTotal / roundScores.length) : 0;
    var weaknesses = Object.keys(perSkillOut).filter(function (k) { return perSkillOut[k].score < 65; })
      .sort(function (a, b) { return perSkillOut[a].score - perSkillOut[b].score; })
      .map(function (k) { return { skill: k, score: perSkillOut[k].score }; });
    var roadmap = weaknesses.map(function (w) {
      var rm = ROADMAP[w.skill] || ROADMAP["Python Fundamentals"];
      return {
        skill: w.skill, score: w.score,
        lessons: rm.lessons.map(function (id) { return { id: id, title: lessonTitle(id) }; }),
        topics: rm.topics,
        path: rm.path ? { id: rm.path, title: pathTitle(rm.path) } : null
      };
    });
    return {
      id: sess.id, at: sess.startedAt, role: sess.config.role, type: sess.config.type,
      difficulty: sess.config.difficulty, duration: sess.config.duration, style: sess.config.style,
      experience: sess.config.experience, overall: overall, rounds: roundScores, perSkill: perSkillOut,
      items: itemsOut, weaknesses: weaknesses, roadmap: roadmap, aiCalls: sess.aiCalls,
      scoring: anyAi && anyOffline ? "mixed" : anyAi ? "ai" : "offline",
      resumeUsed: sess.resumeUsed
    };
  }
  function saveHistory(report) {
    var hist = storeGet(HISTORY_KEY, []);
    hist.unshift(report);
    storeSet(HISTORY_KEY, hist.slice(0, 20));
  }
  function saveFirestoreSummary(report) {
    try {
      var auth = window.SkillzifyAuth;
      var u = auth && typeof auth.currentUser === "function" ? auth.currentUser() : null;
      if (!u || !u.uid) return;
      if (!window.firebase || !window.firebase.firestore || !window.firebase.apps || !window.firebase.apps.length) return;
      var perSkill = {};
      Object.keys(report.perSkill).forEach(function (k) { perSkill[k] = report.perSkill[k].score; });
      var p = window.firebase.firestore().collection("interviews").add({
        uid: u.uid, at: report.at, role: report.role, type: report.type, overall: report.overall, perSkill: perSkill
      });
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {}
  }
  function finishInterview() {
    var sess = S.session;
    if (!sess) return;
    sess.phase = "done";
    clearTimers();
    var report = buildReport(sess);
    saveHistory(report);
    saveFirestoreSummary(report);
    try { if (window.SkillzifyActivity) window.SkillzifyActivity.log("interview", sess.config.type + " interview · " + report.overall + "/100"); } catch (e) {}
    S.session = null;
    renderReport(report, false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  var SECTION_NAMES = { "base-camp": "Base Camp", "tool-shed": "Tool Shed", "object-castle": "Object Castle", "algorithm-arena": "Algorithm Arena", "power-lab": "Power Lab", "data-lab": "Data Lab", "launch-pad": "Launch Pad" };
  function placementFromReport(report) {
    var tech = null, coding = null;
    report.rounds.forEach(function (r) {
      if (r.kind === "technical") tech = r.score;
      if (r.kind === "coding") coding = r.score;
    });
    if (tech == null && coding == null) return null;
    var ps = tech != null && coding != null ? Math.round(tech * 0.55 + coding * 0.45) : (tech != null ? tech : coding);
    var section = ps < 25 ? "base-camp" : ps < 40 ? "tool-shed" : ps < 52 ? "object-castle" : ps < 64 ? "algorithm-arena" : ps < 76 ? "power-lab" : ps < 88 ? "data-lab" : "launch-pad";
    return { score: ps, section: section };
  }
  function barRow(label, score) {
    return '<div class="iv-score-row"><span style="font-weight:600;font-size:.88rem">' + esc(label) + '</span><span class="bar"><span style="width:' + clamp(score, 0, 100) + '%"></span></span><strong>' + score + "</strong></div>";
  }
  function renderReport(report, fromHistory) {
    clearTimers();
    var scoringNote = report.scoring === "ai"
      ? "Scored by the AI interviewer against each question's rubric, with evidence quoted from your answers."
      : report.scoring === "mixed"
      ? "Mostly AI-scored; some rounds fell back to offline rubric scoring (keyword coverage of the rubric points) when the AI was unavailable."
      : "Offline scoring — the AI was unavailable or capped, so every answer was scored locally against the rubric key points. The interview itself ran in full.";
    var readiness = report.overall >= 75 ? "Strong practice readiness — your answers showed depth across most areas." : report.overall >= 55 ? "Developing readiness — solid foundations with clear gaps to close below." : report.overall >= 35 ? "Early readiness — the roadmap below is your fastest route up." : "Foundation stage — work the roadmap from the top; every item there targets a gap this interview exposed.";
    var placement = placementFromReport(report);
    var roundsHtml = report.rounds.map(function (r) { return barRow(r.label + (r.scoreMode === "offline" ? " (offline)" : ""), r.score); }).join("");
    var skillsHtml = Object.keys(report.perSkill).sort(function (a, b) { return report.perSkill[b].score - report.perSkill[a].score; }).map(function (k) {
      return barRow(k + " · " + report.perSkill[k].n + " item(s)", report.perSkill[k].score);
    }).join("");
    var itemsHtml = report.items.map(function (it, idx) {
      if (it.kind === "coding") {
        var parts = it.parts || {};
        var partChips = [["Correctness", parts.correctness, 35], ["Time complexity", parts.time, 20], ["Space complexity", parts.space, 15], ["Edge cases (hidden)", parts.edge, 15], ["Code quality", parts.quality, 10], ["Explanation", parts.explanation, 5]].map(function (p) {
          return '<span class="iv-chip">' + p[0] + " <strong>" + (p[1] || 0) + "/" + p[2] + "</strong></span>";
        }).join(" ");
        return '<div class="iv-qrow"><div class="iv-qhead"><strong>💻 ' + esc(it.title) + '</strong><span class="iv-chip">Score <strong>' + it.score + '/100</strong></span></div>' +
          '<p class="hint" style="margin:6px 0">' + esc(it.q) + "</p>" +
          '<p style="margin:4px 0;font-size:.88rem">Tests: <strong>' + it.testsPassed + "/" + it.testsTotal + " passed</strong> · time used " + Math.floor((it.timeUsedSec || 0) / 60) + "m " + ((it.timeUsedSec || 0) % 60) + "s · your complexity: " + esc(it.complexityAnswer || "not stated") + " · reference: time " + esc(it.optimalTime) + ", space " + esc(it.optimalSpace) + "</p>" +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' + partChips + "</div></div>";
      }
      return '<div class="iv-qrow"><div class="iv-qhead"><strong>' + (idx + 1) + ". " + esc(it.q.length > 130 ? it.q.slice(0, 130) + "…" : it.q) + '</strong><span class="iv-chip">' + esc(it.skill) + ' · <strong>' + it.score + '/100</strong></span></div>' +
        (it.well ? '<p style="margin:6px 0 0;font-size:.88rem">✅ <strong>What went well:</strong> ' + esc(it.well) + "</p>" : "") +
        (it.improve ? '<p style="margin:4px 0 0;font-size:.88rem">🎯 <strong>Improve:</strong> ' + esc(it.improve) + "</p>" : "") +
        (it.evidence ? '<p class="hint" style="margin:4px 0 0">Evidence from your answer: “' + esc(it.evidence) + "”</p>" : "") +
        "</div>";
    }).join("");
    var roadmapHtml = report.roadmap.length ? report.roadmap.map(function (rm) {
      var links = rm.lessons.map(function (l) { return '<a class="iv-link-chip" href="lesson.html?id=' + esc(l.id) + '">📘 ' + esc(l.title) + "</a>"; }).join("") +
        rm.topics.map(function (t) { return '<a class="iv-link-chip" href="practice.html?topic=' + esc(t) + '">✏️ Practice: ' + esc(t) + "</a>"; }).join("") +
        (rm.path ? '<a class="iv-link-chip" href="paths.html#path=' + esc(rm.path.id) + '">🛤️ Path: ' + esc(rm.path.title) + "</a>" : "");
      return '<div class="iv-road-item"><strong>' + esc(rm.skill) + " — " + rm.score + '/100</strong><p class="hint" style="margin:4px 0 0">Targeted practice for this gap:</p><div class="iv-links">' + links + "</div></div>";
    }).join("") : '<p class="hint">No skill scored below 65 — no weak spots to map. Raise the difficulty and go again.</p>';
    $("iv-root").innerHTML =
      '<div style="max-width:920px;margin:0 auto;display:grid;gap:16px">' +
        '<div class="card"><div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><div><div class="iv-big-score">' + report.overall + '<span style="font-size:1.1rem;color:var(--muted)">/100</span></div><span class="hint">Overall score</span></div>' +
          '<div style="flex:1;min-width:240px"><h3 style="margin:0 0 4px">📋 Interview report — ' + esc(report.role) + '</h3>' +
          '<p class="hint" style="margin:0">' + fmtDate(report.at) + " · " + esc(report.type) + " · " + esc(report.difficulty) + " · " + esc(report.style) + (report.resumeUsed ? " · resume-based questions included" : "") + " · AI calls used: " + report.aiCalls + "</p>" +
          '<p style="margin:8px 0 0;font-size:.92rem">' + esc(readiness) + '</p>' +
          '<p class="hint" style="margin:6px 0 0">' + esc(scoringNote) + " This is a practice-based estimate from one session — not a hiring probability.</p></div></div>" +
          '<h4 style="margin:16px 0 0">Per-round scores</h4>' + roundsHtml +
          '<h4 style="margin:16px 0 0">Per-skill scores</h4>' + skillsHtml +
        "</div>" +
        '<div class="card"><h3 style="margin-top:0">🔍 Question-by-question breakdown</h3>' + itemsHtml + "</div>" +
        '<div class="card"><h3 style="margin-top:0">🗺️ Your improvement roadmap</h3>' +
          (report.weaknesses.length ? '<p class="hint" style="margin-top:0">Weak spots from this interview (' + report.weaknesses.map(function (w) { return esc(w.skill) + " " + w.score; }).join(" · ") + "), each mapped to the Skillzify lessons, practice and path that fix it:</p>" : "") +
          '<div class="iv-road">' + roadmapHtml + "</div></div>" +
        '<div class="card"><h3 style="margin-top:0">Next step</h3>' +
          (placement
            ? '<p style="margin-top:0">Your technical + coding performance supports starting at <strong>' + esc(SECTION_NAMES[placement.section]) + "</strong> (placement score " + placement.score + '/100). Applying it updates your Skillzify placement, exactly like the placement test does.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" id="iv-apply-placement" type="button">Set my placement from this interview</button>'
            : '<p style="margin-top:0">This interview type has no technical or coding round, so it can\'t set a placement level — take a Technical, Coding or Mixed interview for that.</p><div style="display:flex;gap:10px;flex-wrap:wrap">') +
          '<button class="btn btn-ghost" id="iv-again" type="button">↻ New interview</button>' +
          (fromHistory ? '<button class="btn btn-ghost" id="iv-back" type="button">Back to setup</button>' : "") +
          "</div>" + '<p class="hint" id="iv-placement-note" style="margin-bottom:0"></p></div>' +
      "</div>";
    var again = $("iv-again");
    if (again) again.addEventListener("click", renderSetup);
    var back = $("iv-back");
    if (back) back.addEventListener("click", renderSetup);
    var apply = $("iv-apply-placement");
    if (apply && placement) apply.addEventListener("click", function () {
      try {
        if (window.SkillzifyPlacement && typeof window.SkillzifyPlacement.save === "function") {
          window.SkillzifyPlacement.save({ section: placement.section, score: placement.score, total: 100 });
          var note = $("iv-placement-note");
          if (note) note.textContent = "✅ Placement set to " + SECTION_NAMES[placement.section] + " — find it on your Dashboard and the Learn path.";
          toast("Placement set: " + SECTION_NAMES[placement.section]);
          return;
        }
      } catch (e) {}
      toast("Placement could not be applied — the placement module is unavailable.");
    });
  }

  /* ---------------- init ---------------- */
  function init() {
    if (!$("iv-root")) return;
    renderSetup();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.SkillzifyInterview = { version: 1 };
})();
