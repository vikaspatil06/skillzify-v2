/* ============================================================
   Skillzify v2 — backend (developer-side AI proxy)
   - Serves the static site
   - POST /api/explain proxies to Gemini using the DEVELOPER's
     API key from the GEMINI_API_KEY environment variable.
     The key is NEVER sent to the browser and NEVER committed.
   - GET  /api/health reports whether the AI backend is live.
   - GET  /api/warmup wakes the free instance (same as health).
   Modes (see MODES below): the original explain/tutor/flowchart/
   generate/fix, plus the AI-system modes: tutor-lesson, quiz,
   drill, trace, review, path, viva (stage ask/judge), challenge,
   flowchart-explain, flowchart-code.
   JSON modes return { explanation, json } where `json` is the
   parsed, shape-validated object the UI renders from.
   Limits: 30 AI req/min per IP (abuse guard) + 50 AI calls/day
   per signed-in user (uid), 10/day for anonymous users.
   Usage is logged as counts only — never code content.
   Cap persistence: counts live in Firestore (collection
   "aiDailyCaps") when a Firebase service-account credential is
   configured (FIREBASE_SERVICE_ACCOUNT_JSON or
   GOOGLE_APPLICATION_CREDENTIALS) and firebase-admin is
   installed; otherwise they live in memory only and reset on
   every restart. The Firestore store is lazy and optional —
   the server boots and enforces the cap in-memory without it.
   Setup (what Vikas must add — see ai-system-plan.md §10):
   Firebase console → Project settings → Service accounts →
   Generate new private key (project skillzify-1d0f2), then paste
   the JSON as FIREBASE_SERVICE_ACCOUNT_JSON in the Render
   dashboard (Environment) of services skillzify-v2 and
   skillzify-v2-staging. Never commit the JSON.
Run: set GEMINI_API_KEY in the environment, then node server.js (or use a .env file)
   ============================================================ */
"use strict";

/* Load .env file if present (local dev convenience). Never commit .env. */
try {
  require("dotenv").config();
} catch (e) { /* dotenv optional on hosts that set env vars directly */ }

const express = require("express");
const path = require("path");

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = (process.env || {})["GEMINI_API_KEY"] || "";
// Testing-phase model + key failover (plan §14). gemini-3.8-flash free tier
// is 5 RPM / 20 RPD on this project, so one model alone cannot cover
// testing. Limits are per model per project, so trying models in order
// multiplies the daily budget; a second API key (second Google Cloud
// project) multiplies it again. Order is preference order: the primary
// first, then the biggest published daily pools, then the highest
// per-minute headroom. Models with 0 quota on this project
// (gemini-2.0-flash, gemini-2.5-pro, ...) are NOT listed. 2.5-flash is
// deprecated: from 1 Dec 2026 Google auto-routes it to 3.5-flash-lite,
// which is already in this list, so nothing breaks then.
// Override the list with GEMINI_MODELS="model-a,model-b"; GEMINI_MODEL
// still overrides just the primary.
const MODELS = (process.env.GEMINI_MODELS ||
  "gemini-3.8-flash,gemini-2.5-flash,gemini-2.5-flash-lite,gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3.1-flash-lite")
  .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
if (process.env.GEMINI_MODEL) MODELS[0] = process.env.GEMINI_MODEL;
const MODEL = MODELS[0];
// Keys to rotate across (one per Google Cloud project; limits are per
// project). Default is the single GEMINI_API_KEY. For a second project,
// set GEMINI_API_KEYS="key1,key2" — keys are never logged, only key#.
const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || "")
  .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
if (!GEMINI_KEYS.length && GEMINI_API_KEY) GEMINI_KEYS.push(GEMINI_API_KEY);
// Per-attempt ceiling (12s) + total failover budget (40s): the client
// gives up at 60s, so the server must answer first. No same-model
// retry: with failover the next model IS the retry, and re-hitting an
// overloaded model only burns the client's 60s.
const ATTEMPT_TIMEOUT_MS = 12000;
const FAILOVER_BUDGET_MS = 40000;
const DAILY_CAP_USER = 50;
const DAILY_CAP_ANON = 10;

const app = express();
// Render terminates TLS behind a proxy/load balancer: without this,
// req.ip is the proxy's address and every signed-out user would share
// one anonymous 10/day bucket. Trust one proxy hop (X-Forwarded-For);
// direct connections without the header still fall back to the socket.
app.set("trust proxy", 1);
app.use(express.json({ limit: "200kb" }));

/* ---- CORS: the API is called cross-origin from GitHub Pages ----
   (P0-1, 10 Nov 2026 audit: without this every AI call from Pages is
   browser-blocked and AI only works same-origin from Render.) The API
   takes no cookies or credentials, so an allow-listed Origin plus the
   standard preflight headers are enough. Preflight OPTIONS is answered
   here, before the rate limiter, so it never burns budget. */
var CORS_ORIGINS = [
  "https://vikaspatil06.github.io",
  "https://skillzify-v2.onrender.com",
  "https://skillzify-v2-staging.onrender.com"
];
function corsOrigin(origin) {
  if (!origin) return null;
  if (CORS_ORIGINS.indexOf(origin) !== -1) return origin;
  // Local dev: the site served from localhost / 127.0.0.1 on any port.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}
app.use(function (req, res, next) {
  var allowed = corsOrigin(req.headers.origin);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ---- tiny in-memory rate limit: 30 AI req/min per IP ---- */
const hits = new Map();
app.use("/api/", (req, res, next) => {
  const now = Date.now();
  const arr = (hits.get(req.ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(req.ip, arr);
  if (arr.length > 30) return res.status(429).json({ error: "Too many requests — slow down a little.", code: "RATE_LIMIT" });
  next();
});

/* ---- daily cap per user (uid) or per IP when anonymous ----
   Day boundary is IST (UTC+5:30, no DST in India) to match the
   "reset tomorrow" copy.
   Persistence (QA round 4, item 1): a file-backed store was
   considered and REJECTED — Render free web services have an
   ephemeral filesystem (render.com/docs/free): local file
   changes are lost on every redeploy, restart, or spin-down,
   and free services cannot attach a persistent disk. A file
   would reset on exactly the restart that resets the cap, so
   it fixes nothing. The store below is Firestore instead, via
   the existing Firebase project skillzify-1d0f2 — the only
   free, credential-free-at-runtime option that survives a
   restart. It is optional: with no credential configured (or
   firebase-admin not installed, or init failing) the cap
   falls back to the in-memory map and the server still boots.
   Env: FIREBASE_SERVICE_ACCOUNT_JSON (whole service-account
   JSON, one line) or GOOGLE_APPLICATION_CREDENTIALS (path to
   the JSON file). One doc per key per day in collection
   "aiDailyCaps"; increments use FieldValue.increment so
   concurrent requests cannot lose a count. */
const daily = new Map();
const CAP_COLLECTION = "aiDailyCaps";
var capDb = null;         // Firestore instance when the Firestore store is active
var capFieldValue = null; // admin.firestore.FieldValue (for atomic increments)
var capStore = "memory";  // "memory" | "firestore" — reported by /api/health
var capInitDone = false;  // true once this process has decided (either way)

// Firestore document IDs allow ":" and "|" but a sanitised id is
// cheaper to reason about; the mapping stays injective for our keys
// ("u:<uid>|<date>" / "a:<ip>|<date>").
function capDocId(key) { return String(key).replace(/[^A-Za-z0-9._-]/g, "_"); }

// Lazy, once per process, local-only (no network): safe to call from
// /api/health and before the first cap check.
function initCapStore() {
  if (capInitDone) return;
  capInitDone = true;
  var json = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  var credPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  if (!json && !credPath) return; // no credential: in-memory cap (resets on restart)
  var admin;
  try {
    // firebase-admin v11+ is modular — there is no admin.firestore()
    // or admin.credential namespace anymore (verified against v14.5.0,
    // 5 Nov 2026: both are undefined; the entry points are
    // firebase-admin/app and firebase-admin/firestore).
    var appMod = require("firebase-admin/app");
    var fsMod = require("firebase-admin/firestore");
    admin = { appMod: appMod, fsMod: fsMod };
  } catch (e) {
    console.log("[cap] A Firebase credential is set but firebase-admin could not be loaded — daily cap stays in-memory (resets on restart). Run `npm install firebase-admin` to enable the Firestore cap store.");
    return;
  }
  try {
    var credential;
    if (json) {
      credential = admin.appMod.cert(JSON.parse(json));
    } else {
      credential = admin.appMod.applicationDefault();
    }
    // Guard against double init when this module is re-required in
    // one process (harness) while the admin modules stay cached.
    if (!admin.appMod.getApps().length) admin.appMod.initializeApp({ credential: credential });
    capDb = admin.fsMod.getFirestore();
    capFieldValue = admin.fsMod.FieldValue || null;
    capStore = "firestore";
    console.log("[cap] Daily cap store: Firestore (collection " + CAP_COLLECTION + ") — counts survive restarts.");
  } catch (e) {
    capDb = null;
    capFieldValue = null;
    capStore = "memory";
    console.log("[cap] Firestore cap store failed to initialise (" + (e && e.message ? e.message : e) + ") — daily cap stays in-memory (resets on restart). Check the service-account JSON.");
  }
}

// Read one day's count. On a Firestore error, fall back to the
// in-memory map for this request (fail open, logged) — a Firestore
// outage must not block all AI answers.
async function capGetCount(key) {
  if (capStore === "firestore" && capDb) {
    try {
      var snap = await capDb.collection(CAP_COLLECTION).doc(capDocId(key)).get();
      var data = snap.exists ? snap.data() : null;
      return (data && typeof data.count === "number") ? data.count : 0;
    } catch (e) {
      console.log("[cap] Firestore read failed, using in-memory count for this request: " + (e && e.message ? e.message : e));
    }
  }
  var rec = daily.get(key);
  return rec ? rec.count : 0;
}

// Record one successful call. Firestore path is awaited by the
// caller so the count is durable before the answer is returned.
// On a Firestore error, increment the in-memory map instead.
async function capAddCount(key) {
  if (capStore === "firestore" && capDb) {
    try {
      var doc = capDb.collection(CAP_COLLECTION).doc(capDocId(key));
      var patch = { updatedAt: new Date().toISOString() };
      if (capFieldValue && typeof capFieldValue.increment === "function") {
        patch.count = capFieldValue.increment(1);
      } else {
        patch.count = (await capGetCount(key)) + 1;
      }
      await doc.set(patch, { merge: true });
      return;
    } catch (e) {
      console.log("[cap] Firestore write failed, counting in-memory for this request: " + (e && e.message ? e.message : e));
    }
  }
  var rec = daily.get(key) || { count: 0 };
  rec.count += 1;
  daily.set(key, rec);
}
function dayStr() { return new Date(Date.now() + (5 * 60 + 30) * 60000).toISOString().slice(0, 10); }
function dailyKey(uid, ip) { return (uid ? "u:" + uid : "a:" + ip) + "|" + dayStr(); }
// Check only — no increment. The count moves on the success path, so a
// timeout / overload / bad reply never burns a daily answer, and a
// client retry doesn't burn a second one.
async function dailyAllowed(uid, ip) {
  initCapStore();
  var count = await capGetCount(dailyKey(uid, ip));
  return count < (uid ? DAILY_CAP_USER : DAILY_CAP_ANON);
}
async function dailyCount(uid, ip) {
  initCapStore();
  await capAddCount(dailyKey(uid, ip));
}

app.get("/api/health", (req, res) => {
  initCapStore(); // local-only; reports which cap store is active
  res.json({ ok: true, ai: GEMINI_KEYS.length > 0, model: MODEL, models: MODELS, capStore: capStore, uptimeSec: Math.floor(process.uptime()) });
});
app.get("/api/warmup", (req, res) => {
  initCapStore(); // local-only; reports which cap store is active
  res.json({ ok: true, ai: GEMINI_KEYS.length > 0, model: MODEL, models: MODELS, capStore: capStore, uptimeSec: Math.floor(process.uptime()) });
});

/* ---------------- mode definitions ---------------- */
const tutorStyle =
  "You are a friendly Python tutor for a beginner student. " +
  "Format your answer exactly like this:\n" +
  "1. One line starting with '🎯 In short: ' stating what the program does.\n" +
  "2. A '🔍 Walkthrough:' section explaining the important parts step by step " +
  "(group repetitive lines; explain WHY each part exists, not just WHAT it says).\n" +
  "3. A '💡 Key concepts:' section listing each Python idea used with one short line each.\n" +
  "Keep the whole answer concise. Use short bullet points.";

const socraticStyle =
  "You are a Socratic Python tutor for a beginner student working on a coding exercise. " +
  "Rules you MUST follow:\n" +
  "1. NEVER write the full corrected code — not even a snippet longer than one line.\n" +
  "2. Explain what is likely wrong in plain words, then give exactly ONE guiding hint.\n" +
  "3. Ask one short follow-up question that nudges the student to discover the fix.\n" +
  "4. Keep the whole answer under 120 words. Be encouraging.";

const jsonOnly = "Output ONLY valid JSON, no markdown fences, no commentary.";

function isQuiz(o) {
  return o && Array.isArray(o.questions) && o.questions.length >= 1 && o.questions.every(function (q) {
    return q && typeof q.q === "string" && Array.isArray(q.options) && q.options.length === 4 &&
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3;
  });
}
function isDrill(o) {
  return o && typeof o.title === "string" && typeof o.prompt === "string" &&
    typeof o.starter === "string" && typeof o.solution === "string" &&
    Array.isArray(o.tests) && o.tests.length >= 1 && o.tests.length <= 4 &&
    o.tests.every(function (t) { return t && typeof t.run === "string" && typeof t.expect === "string"; }) &&
    Array.isArray(o.hints) && o.hints.length >= 1;
}
function isReview(o) {
  return o && typeof o.score === "number" && o.score >= 0 && o.score <= 100 &&
    Array.isArray(o.issues) && Array.isArray(o.strengths) && Array.isArray(o.suggestions);
}
function isPath(o) {
  return o && typeof o.title === "string" && Array.isArray(o.steps) && o.steps.length >= 1 &&
    o.steps.length <= 15 && o.steps.every(function (s) { return s && typeof s.lessonId === "string"; });
}
function isVivaAsk(o) { return o && typeof o.question === "string" && o.question.trim(); }
function isVivaJudge(o) {
  return o && (o.verdict === "correct" || o.verdict === "partial" || o.verdict === "wrong") &&
    typeof o.feedback === "string" && Array.isArray(o.revisit);
}

const MODES = {
  "": { style: tutorStyle, maxTokens: 1000 },
  tutor: { style: socraticStyle, maxTokens: 600 },
  flowchart: { style: "", maxTokens: 800 },
  generate: { style: "", maxTokens: 1000 },
  fix: { style: "", maxTokens: 1200 },
  "tutor-lesson": { style: socraticStyle, maxTokens: 600 },
  quiz: { style: "You are a Python quiz writer for a beginner course. " + jsonOnly, json: true, validate: isQuiz, maxTokens: 1500 },
  drill: { style: "You are a Python exercise author for a beginner course. " + jsonOnly + " Every exercise must be solvable with beginner Python (no imports beyond math/random) and its solution must pass its own tests.", json: true, validate: isDrill, maxTokens: 1500 },
  trace: { style: "You are a friendly Python tutor. Explain code execution step by step in plain words.", maxTokens: 1500 },
  review: { style: "You are a kind but honest Python code reviewer for a student project. " + jsonOnly, json: true, validate: isReview, maxTokens: 1500 },
  path: { style: "You are a Python curriculum designer. " + jsonOnly, json: true, validate: isPath, maxTokens: 1500 },
  viva: { style: "You are a friendly but rigorous Python examiner (viva). " + jsonOnly, json: true, validate: null, maxTokens: 800 },
  challenge: { style: "You are a Python exercise author for a beginner course. " + jsonOnly + " Every exercise must be solvable with beginner Python (no imports beyond math/random) and its solution must pass its own tests.", json: true, validate: isDrill, maxTokens: 1500 },
  "flowchart-explain": { style: tutorStyle, maxTokens: 1000 },
  "flowchart-code": { style: "", maxTokens: 800 },
};

function buildPrompt(mode, code, errText, context, stage) {
  switch (mode) {
    case "flowchart":
      return "Write ONLY clean, simple Python code that solves this problem. Use only beginner Python (input/print, if/elif/else, for/while loops, functions, lists) — no classes, decorators, or match statements. Output raw code only — no markdown fences, no explanation, no comments beyond one line:\n\n" + code;
    case "flowchart-code":
      return "Write ONLY clean, simple Python code that implements these flowchart steps. Use input() for INPUT steps and print() for PRINT/OUTPUT steps. Use only beginner Python (no classes, decorators, or match statements). Output raw code only — no markdown fences, no explanation, no comments beyond one line:\n\n" + code;
    case "flowchart-explain":
      return "Explain this flowchart / algorithm in plain words, step by step, as if teaching a beginner what the program does and why each step exists. No code, just the explanation.\n\nFLOWCHART / ALGORITHM:\n" + code;
    case "generate":
      return "Write clean, beginner-friendly Python code for this request. Output the code inside a single ```python fenced block, then 2-3 short bullet points explaining the key parts. Keep it simple — no advanced tricks.\n\nREQUEST:\n" + code;
    case "fix":
      return "A student's Python code has this error. Output the FULL corrected code inside a single ```python fenced block, then 2-3 short bullet points explaining what was wrong and what you changed. Fix only what's broken — keep their style.\n\nCODE:\n" + code + "\n\nERROR:\n" + errText;
    case "tutor":
      return "A student is stuck on this Python exercise. Their code is failing. Follow your Socratic rules strictly.\n\n" + code + "\n\n" + errText;
    case "tutor-lesson":
      return "A student is working through a lesson and is stuck. Use the lesson context to ground your hint in what they just learned. Follow your Socratic rules strictly.\n\nLESSON CONTEXT:\n" + context + "\n\nSTUDENT CODE / QUESTION:\n" + code + "\n\nERROR / STUCK POINT:\n" + errText;
    case "quiz":
      return "Write 3 multiple-choice quiz questions that test the concepts in this lesson. Each question: one clear question, exactly 4 options, exactly one correct answer, and a one-line 'why' explaining the answer. Keep questions at the lesson's level — no advanced topics. Vary them from any questions already listed in the lesson.\n\nLESSON:\n" + code + "\n\nLEARNER CONTEXT:\n" + context + "\n\nJSON shape: {\"questions\":[{\"q\":\"...\",\"options\":[\"...\",\"...\",\"...\",\"...\"],\"answer\":0,\"why\":\"...\"}]} — answer is the 0-based index of the correct option.";
    case "drill":
      return "Write ONE short coding exercise that drills this weak topic. The student keeps failing here:\n\nWEAK TOPIC:\n" + code + "\n\nLEARNER CONTEXT:\n" + context + "\n\nJSON shape: {\"title\":\"...\",\"prompt\":\"...\",\"starter\":\"def ...:\\n    # your code here\\n    pass\",\"tests\":[{\"run\":\"fn(1)\",\"expect\":\"2\"}],\"hints\":[\"nudge\",\"strategy\",\"almost there\"],\"solution\":\"...\",\"difficulty\":1}\nRules: 2-3 tests; each test is {\"run\": \"a Python expression using the function\", \"expect\": \"the exact str() of the result\"}; difficulty 1-3; the solution MUST pass all tests when run; keep it small.";
    case "trace":
      return "Walk through this Python code line by line, in execution order. For each step say what happens and what each variable holds after that step. Use short numbered steps. If the program reads input, show one example run with sample input. Keep it plain and beginner-friendly.\n\nCODE:\n" + code + (errText ? "\n\nRUN OUTPUT / ERROR:\n" + errText : "") + "\n\nLEARNER CONTEXT:\n" + context;
    case "review":
      return "Review this student project code. Score it 0-100 and list concrete issues with line numbers, plus what's already good. Be specific — quote the line you're talking about.\n\nPROJECT:\n" + code + "\n\nLEARNER CONTEXT:\n" + context + "\n\nJSON shape: {\"score\":75,\"issues\":[{\"line\":12,\"severity\":\"high|medium|low\",\"note\":\"...\"}],\"strengths\":[\"...\"],\"suggestions\":[\"...\"]}";
    case "path":
      return "Build a custom learning path for this goal. Use ONLY the lesson IDs from the LESSONS list below, in a sensible learning order (basics before advanced). Pick 6-12 lessons, then name the closest existing project from the PROJECTS list, or 'none'.\n\nGOAL + LISTS:\n" + code + "\n\nLEARNER CONTEXT:\n" + context + "\n\nJSON shape: {\"title\":\"...\",\"steps\":[{\"lessonId\":\"...\",\"why\":\"one line\"}],\"project\":\"...\"}";
    case "viva":
      if (stage === "judge") {
        return "The student answered a viva question. Judge the answer: is it correct, partly right, or wrong? Reply with short feedback and name the exact lesson(s) to revisit if they got it wrong.\n\nQUESTION:\n" + code + "\n\nSTUDENT ANSWER:\n" + errText + "\n\nLEARNER CONTEXT:\n" + context + "\n\nJSON shape: {\"verdict\":\"correct|partial|wrong\",\"feedback\":\"...\",\"revisit\":[\"lesson-id\", ...]}";
      }
      return "Ask ONE viva question about this lesson. It should test understanding, not memorization — ask the student to explain WHY or predict what happens. One question only.\n\nLESSON:\n" + code + "\n\nPREVIOUS QUESTIONS (don't repeat these):\n" + errText + "\n\nJSON shape: {\"question\":\"...\"}";
    case "challenge":
      return "Write ONE small daily-challenge exercise for this learner, based on their weak spots. It should take under 10 minutes. Same JSON shape and rules as a drill exercise.\n\nWEAK SPOTS:\n" + code + "\n\nLEARNER CONTEXT:\n" + context + "\n\nJSON shape: {\"title\":\"...\",\"prompt\":\"...\",\"starter\":\"def ...:\\n    # your code here\\n    pass\",\"tests\":[{\"run\":\"fn(1)\",\"expect\":\"2\"}],\"hints\":[\"nudge\",\"strategy\",\"almost there\"],\"solution\":\"...\",\"difficulty\":1}";
    default:
      return errText
        ? "A student ran this Python code and got this error. First explain the error in simple terms and exactly how to fix it, then give the walkthrough structure above for the code.\n\nCODE:\n" +
          code + "\n\nERROR:\n" + errText
        : "Explain this Python code using the walkthrough structure above.\n\nCODE:\n" + code;
  }
}

function parseJsonMode(text, validate) {
  var t = String(text || "").replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  var obj = JSON.parse(t);
  if (validate && !validate(obj)) throw new Error("shape");
  return obj;
}

function geminiError(status) {
  if (status === 404) return { status: 502, code: "MODEL_NOT_FOUND", error: "AI model not found (configuration problem)." };
  if (status === 401 || status === 403) return { status: 502, code: "KEY_ERROR", error: "AI key problem (configuration)." };
  if (status === 429) return { status: 429, code: "QUOTA", error: "AI quota exhausted — try again later." };
  if (status === 503) return { status: 503, code: "OVERLOADED", error: "AI provider is overloaded — try again in a moment." };
  return { status: 502, code: "MODEL_ERROR", error: "AI provider error (HTTP " + status + ")." };
}

app.post("/api/explain", async (req, res) => {
  const started = Date.now();
  if (!GEMINI_KEYS.length) return res.status(503).json({ error: "AI backend not configured.", code: "NOT_CONFIGURED" });
  const code = String((req.body && req.body.code) || "").slice(0, 8000);
  const errText = String((req.body && req.body.error) || "").slice(0, 2000);
  const context = String((req.body && req.body.context) || "").slice(0, 2000);
  const mode = String((req.body && req.body.mode) || "");
  const stage = String((req.body && req.body.stage) || "");
  const uid = String((req.body && req.body.uid) || "").slice(0, 128);
  const spec = Object.prototype.hasOwnProperty.call(MODES, mode) ? MODES[mode] : MODES[""];
  if (!code.trim() && !errText.trim()) return res.status(400).json({ error: "Nothing to explain.", code: "EMPTY" });
  if (!(await dailyAllowed(uid, req.ip))) {
    return res.status(429).json({ error: "You've used your " + (uid ? DAILY_CAP_USER : DAILY_CAP_ANON) + " AI answers for today — they reset tomorrow.", code: "DAILY_CAP" });
  }

  const style = spec.style;
  const prompt = buildPrompt(mode, code, errText, context, stage);

  // Try keys x models in order. Returns { r, model, keyIdx } on the first
  // HTTP response (ok, or fatal), or { r: null, model, keyIdx, error }
  // when every combination failed. Retryable: 429 (quota), 503
  // (overloaded), 404 (model unavailable on this project), timeout /
  // network errors — move to the next combination. Fatal: 401/403 (the
  // key is bad for every model) and anything else — answer at once.
  async function callGemini(promptText, maxTokens, onlyModel, timeoutMs) {
    var models = onlyModel ? [onlyModel] : MODELS;
    var attemptTimeout = timeoutMs || ATTEMPT_TIMEOUT_MS;
    var lastErr = { status: 502, code: "MODEL_ERROR", error: "AI provider error." };
    var lastModel = models[0], lastKeyIdx = 0;
    for (var ki = 0; ki < GEMINI_KEYS.length; ki++) {
      for (var mi = 0; mi < models.length; mi++) {
        var model = models[mi];
        if (Date.now() - started > FAILOVER_BUDGET_MS) {
          console.log("[ai] failover budget spent — answering with last error " + lastErr.code);
          return { r: null, model: lastModel, keyIdx: lastKeyIdx, error: lastErr };
        }
        lastModel = model; lastKeyIdx = ki;
        var ctrl = new AbortController();
        var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, attemptTimeout);
        var r;
        try {
          r = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEYS[ki] },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: style }] },
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: Object.assign(
                  { maxOutputTokens: maxTokens, temperature: 0.4 },
                  spec.json ? { responseMimeType: "application/json" } : {}
                ),
              }),
              signal: ctrl.signal,
            }
          );
        } catch (e) {
          clearTimeout(timer);
          console.log("[ai] model " + model + " key#" + (ki + 1) + " attempt failed (" + (e.name || "error") + ") — trying next");
          lastErr = { status: 502, code: "TIMEOUT", error: "Could not reach the AI provider." };
          continue;
        }
        clearTimeout(timer);
        if (r.ok) return { r: r, model: model, keyIdx: ki };
        var g = geminiError(r.status);
        if (r.status === 429 || r.status === 503 || r.status === 404) {
          console.log("[ai] model " + model + " key#" + (ki + 1) + " fail " + g.code + " — trying next");
          lastErr = g;
          continue;
        }
        console.log("[ai] model " + model + " key#" + (ki + 1) + " fail " + g.code + " — not retryable");
        return { r: r, model: model, keyIdx: ki, error: g };
      }
    }
    return { r: null, model: lastModel, keyIdx: lastKeyIdx, error: lastErr };
  }

  try {
    let got = await callGemini(prompt, spec.maxTokens || 1000);
    if (!got.r || !got.r.ok) {
      const g = got.error || { status: 502, code: "MODEL_ERROR", error: "AI provider error." };
      console.log("[ai]", mode || "explain", uid ? "uid" : "anon", "fail", g.code, Date.now() - started + "ms");
      return res.status(g.status).json({ error: g.error, code: g.code });
    }
    let r = got.r;
    let usedModel = got.model;
    let data = await r.json();
    let cand = data.candidates && data.candidates[0];
    let finishReason = cand && cand.finishReason;
    console.log("[explain] finishReason:", finishReason || "(none)");
    // If the model stopped because it ran out of output budget, retry once
    // with more room — same model (it just proved healthy), longer clock.
    if (finishReason === "MAX_TOKENS") {
      console.log("[explain] hit token budget — retrying with a larger one");
      got = await callGemini(prompt, 4000, usedModel, 25000);
      if (!got.r || !got.r.ok) {
        const g = got.error || { status: 502, code: "MODEL_ERROR", error: "AI provider error." };
        console.log("[ai]", mode || "explain", uid ? "uid" : "anon", "fail", g.code, Date.now() - started + "ms");
        return res.status(g.status).json({ error: g.error, code: g.code });
      }
      r = got.r;
      usedModel = got.model;
      data = await r.json();
      cand = data.candidates && data.candidates[0];
      finishReason = cand && cand.finishReason;
      console.log("[explain] retry finishReason:", finishReason || "(none)");
    }
    const parts = cand && cand.content && cand.content.parts;
    const text = parts ? parts.map((p) => p.text || "").join("") : "";
    if (!text.trim()) {
      console.log("[explain] empty model text; finishReason was:", finishReason || "(none)");
      return res.status(502).json({ error: "AI returned an empty explanation (finish: " + (finishReason || "unknown") + ").", code: "EMPTY_REPLY" });
    }
    let out = { explanation: text, model: usedModel };
    if (spec.json) {
      try {
        const validate = mode === "viva" ? (stage === "judge" ? isVivaJudge : isVivaAsk) : spec.validate;
        out.json = parseJsonMode(text, validate);
      } catch (e) {
        console.log("[ai]", mode, uid ? "uid" : "anon", "fail", "BAD_JSON", Date.now() - started + "ms");
        return res.status(502).json({ error: "AI returned an unusable answer — try again.", code: "BAD_JSON" });
      }
    }
    console.log("[ai]", mode || "explain", uid ? "uid" : "anon", "ok", usedModel, "key#" + (got.keyIdx + 1), Date.now() - started + "ms");
    // Success only — every error return above leaves the cap untouched.
    // A MAX_TOKENS retry is still one request, so it counts once here.
    // Awaited: the count must be durable (Firestore) before answering.
    await dailyCount(uid, req.ip);
    res.json(out);
  } catch (e) {
    console.log("[ai]", mode || "explain", uid ? "uid" : "anon", "fail", "TIMEOUT", Date.now() - started + "ms");
    res.status(502).json({ error: "Could not reach the AI provider.", code: "TIMEOUT" });
  }
});

/* ---- static site ---- */
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(
    "Skillzify v2 on http://localhost:" + PORT + " | AI backend: " + (GEMINI_KEYS.length ? "ON (" + MODELS.join(", ") + ")" : "OFF (set GEMINI_API_KEY)")
  );
});
