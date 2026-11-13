/* ============================================================
   Skillzify v2 — backend (developer-side AI proxy)
   - Serves the static site
   - POST /api/explain proxies to Gemini using the DEVELOPER's
     API key from the GEMINI_API_KEY environment variable.
     The key is NEVER sent to the browser and NEVER committed.
   - GET  /api/health reports whether the AI backend is live.
   Modes (see MODES below): the original explain/tutor/flowchart/
   generate/fix, plus the AI-system modes: tutor-lesson, quiz,
   drill, trace, review, path, viva (stage ask/judge), challenge,
   flowchart-explain, flowchart-code.
   JSON modes return { explanation, json } where `json` is the
   parsed, shape-validated object the UI renders from.
   Limits: 30 AI req/min per IP (abuse guard) + 10 AI calls/day
   per signed-in user (uid), 5/day for anonymous users. The day's
   ~60,000 provider capacity is split (owner's division, 12 Nov
   2026): a 10,000/day admin reserve (ADMIN_EMAIL, below; usage at
   GET /api/usage) and a shared 50,000/day pool that every non-admin
   answer reserves from, so learner traffic can never eat the
   reserve — and admin answers never touch the pool.
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
   Groq failover: free key at console.groq.com → API Keys, then set
   GROQ_API_KEY the same way (Render Environment, both services).
   No card needed. Without it the server is Gemini-only.
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
// project) multiplies it again. Order is preference order: the proven six
// first, then the newer free-tier models. Free-tier text models on the
// Gemini API failover order — arranged by MEASURED reliability on
// this project's keys (staging logs, 12 Nov 2026), fastest healthy
// model first:
//   3.1-flash-lite — zero failures all day; the workhorse.
//   3.5-flash-lite — serves often; occasional OVERLOADED.
//   3.6-flash — serves often; occasional timeout.
//   3.8-flash — DEMOTED: the best model when healthy, but on the
//     free tier it failed every attempt that day (OVERLOADED 503s
//     and responses slower than the 12 s attempt timeout). Kept in
//     the list — if it recovers, later slots still reach it.
//   3-flash-preview — works, but only ~20 requests/day; kept late
//     so its tiny quota is spent only when the front of the chain
//     is down.
//   gemma-4-31b-it / gemma-4-26b-a4b-it — the capacity backbone:
//     14,400 requests/day EACH per project. Slower, plainer answers
//     than the Flash models, so they sit last as the deep reserve
//     that keeps the site answering when everything Flash is down.
// REMOVED 12 Nov 2026: gemini-2.5-flash / gemini-2.5-flash-lite —
// MODEL_NOT_FOUND on every attempt on this project (since 18 Sep
// 2026 they only serve projects that already used them; this one
// never did). They failed fast, but a model that can never succeed
// here does not belong in the chain. Also NOT listed:
// gemini-2.0-flash/-lite (SHUT DOWN 1 Jun 2026), Pro models (2.5 Pro
// left the free tier Apr 2026; 3.1 Pro Preview, 4 Argon/Carbon are
// paid only), 3.5/3.7 Flash (aliases of 3.6/3.8). 3.1-flash-lite
// shuts down 7 May 2027 — revisit this order before then.
// A model with no quota on a project costs one fast 404/429 skip —
// the loop has no attempt cap, only the shared time budget — but a
// SLOW model costs its full attempt timeout per key, which is why
// the order above is by reliability, not by model prestige.
// Override the list with GEMINI_MODELS="model-a,model-b"; GEMINI_MODEL
// still overrides just the primary.
const MODELS = (process.env.GEMINI_MODELS ||
  "gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3.8-flash,gemini-3-flash-preview,gemma-4-31b-it,gemma-4-26b-a4b-it")
  .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
if (process.env.GEMINI_MODEL) MODELS[0] = process.env.GEMINI_MODEL;
const MODEL = MODELS[0];
// Keys to rotate across (one per Google Cloud project; limits are per
// project). Default is the single GEMINI_API_KEY. For a second project,
// set GEMINI_API_KEYS="key1,key2" — keys are never logged, only key#.
const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || "")
  .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
if (!GEMINI_KEYS.length && GEMINI_API_KEY) GEMINI_KEYS.push(GEMINI_API_KEY);
// Groq failover (second provider, OpenAI-compatible). Free tier, no card:
// console.groq.com → API Keys → GROQ_API_KEY. Limits are per ORGANISATION,
// per model (Groq rate-limits docs, Nov 2026): openai/gpt-oss-120b,
// openai/gpt-oss-20b and qwen/qwen3.8-27b are each 30 RPM / 1,000 RPD /
// 8K TPM / 200K TPD. The TOKEN cap binds first: ~200K tokens/day/model is
// only a few hundred real tutor calls per model. Llama models are
// Enterprise-only on self-serve keys (404) — NOT listed. Groq is tried
// AFTER all Gemini keys x models, so it is spillover capacity, not the
// primary. Override the list with GROQ_MODELS="model-a,model-b". Unset
// key = Groq off, Gemini-only. Key read via bracket notation like
// GEMINI_API_KEY (runtime redaction safety).
const GROQ_API_KEY = (process.env || {})["GROQ_API_KEY"] || "";
const GROQ_MODELS = (process.env.GROQ_MODELS ||
  "openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.8-27b")
  .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Per-attempt ceiling (12s) + total failover budget (40s): the client
// gives up at 60s, so the server must answer first. No same-model
// retry: with failover the next model IS the retry, and re-hitting an
// overloaded model only burns the client's 60s.
const ATTEMPT_TIMEOUT_MS = Number(process.env.ATTEMPT_TIMEOUT_MS) || 12000;
const FAILOVER_BUDGET_MS = 40000;
// Circuit breaker (optimization audit #3, 13 Nov 2026): per-model
// health memory for TIMEOUT-class failures only. A model that hits
// BREAKER_THRESHOLD consecutive attempt timeouts is skipped for
// BREAKER_COOLDOWN_MS, so unlucky requests stop re-walking dead
// chain entries at 12 s apiece (the 12 Nov load test: 3.8-flash and
// gemma-4-31b-it scored 0 successes, all timeout-class). A success
// resets the model's counter at once; HTTP failures (429/503/404)
// are cheap and never touch the breaker. Safety valves: a pinned
// call (onlyModel — the MAX_TOKENS retry) is never skipped, and if
// EVERY model in the list is open the breaker is ignored for that
// call, so a request always gets its full chain when nothing else
// is available. Env overrides exist for the test harness.
const BREAKER_THRESHOLD = Number(process.env.BREAKER_THRESHOLD) || 2;
const BREAKER_COOLDOWN_MS = Number(process.env.BREAKER_COOLDOWN_MS) || 5 * 60 * 1000;
const modelHealth = {}; // "gemini:<model>" / "groq:<model>" -> { timeouts, openUntil }
function breakerIsOpen(kind, model) {
  var h = modelHealth[kind + ":" + model];
  return !!(h && h.openUntil > Date.now());
}
function breakerNoteTimeout(kind, model) {
  var k = kind + ":" + model;
  var h = modelHealth[k] || (modelHealth[k] = { timeouts: 0, openUntil: 0 });
  h.timeouts++;
  if (h.timeouts >= BREAKER_THRESHOLD && h.openUntil <= Date.now()) {
    h.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
    h.timeouts = 0;
    console.log("[ai] circuit breaker open for " + k + " — skipping for " + Math.round(BREAKER_COOLDOWN_MS / 1000) + "s");
  }
}
function breakerNoteSuccess(kind, model) {
  var h = modelHealth[kind + ":" + model];
  if (h) { h.timeouts = 0; h.openUntil = 0; }
}
// P1-23: the MAX_TOKENS retry gets its OWN deadline (started + 55 s) instead
// of the 40 s failover budget — a slow first call (up to 4 x 12 s = 48 s)
// must not make the retry fail instantly and discard a valid first reply.
// The client aborts at 60 s, so 55 s leaves room to deliver the answer.
// Overridable via env only for tests (MAX_TOKENS_DEADLINE_MS).
const MAX_TOKENS_DEADLINE_MS = Number(process.env.MAX_TOKENS_DEADLINE_MS) || 55000;
const DAILY_CAP_USER = 10;
const DAILY_CAP_ANON = 5;
// Skillzify admin (Vikas — patil.vikas6306@gmail.com): a 10,000/day
// cap + a usage view at GET /api/usage. The check needs BOTH the
// signed-in uid AND the matching email — an email alone (no uid) is
// anonymous and stays capped at 5/day. On a server with the
// Firebase credential configured, identity comes from the VERIFIED
// ID token (resolveIdentity), so the email can't be claimed; the
// client-supplied fallback applies only with no credential set.
// Override the address with ADMIN_EMAIL env, the number with
// ADMIN_DAILY_CAP env.
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "patil.vikas6306@gmail.com").trim().toLowerCase();
const ADMIN_DAILY_CAP = Number(process.env.ADMIN_DAILY_CAP) || 10000;
// The capacity division (owner, 12 Nov 2026): the providers give
// roughly 60,000 answers/day in total (two Gemini projects at
// ~29,880 each + ~1,000 Groq). Of that, ADMIN_DAILY_CAP above is
// the admin's reserve and the rest is ONE shared pool for every
// learner answer (signed-in or anonymous), enforced by a single
// daily counter (poolKey) alongside the per-identity caps — a
// learner still can't pass their own 10/5, and all learners
// together can't pass the pool. Override with DAILY_CAPACITY_TOTAL
// / USER_POOL_DAILY_CAP env.
const DAILY_CAPACITY_TOTAL = Number(process.env.DAILY_CAPACITY_TOTAL) || 60000;
const USER_POOL_DAILY_CAP = Number(process.env.USER_POOL_DAILY_CAP) || Math.max(0, DAILY_CAPACITY_TOTAL - ADMIN_DAILY_CAP);

const app = express();
// Render terminates TLS behind a proxy/load balancer: without this,
// req.ip is the proxy's address and every signed-out user would share
// one anonymous 5/day bucket. P2-50: Cloudflare fronts Render, so a
// request passes through TWO proxies (Cloudflare edge, then Render's
// router) — trust proxy 1 resolved req.ip to a shared edge IP. The
// [proxy] log line below records the X-Forwarded-For chain on every
// AI call, so the count can be re-tuned from real traffic if the
// observed chain turns out longer or shorter than two hops.
// Direct connections without the header still fall back to the socket.
app.set("trust proxy", 2);
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

/* ---- P2-50: log the proxy chain on AI calls so the trust-proxy
   count above can be verified (and re-tuned) from real traffic:
   req.ip must be the leftmost (client) entry of X-Forwarded-For.
   Health pings are not logged — they carry no cap identity. */
app.use("/api/explain", function (req, res, next) {
  console.log("[proxy] ip=" + req.ip + " xff=" + (req.headers["x-forwarded-for"] || "(none)"));
  next();
});

/* ---- tiny in-memory rate limit: 30 AI req/min per IP ----
   P2-46: health pings are exempt — ai.js warmups on every page
   load and several pages fire an extra api/health fetch, so counting
   pings against the AI budget let a burst of page loads block real AI
   calls. Only /api/explain consumes budget. An IP whose window has
   fully expired has its map key deleted instead of lingering as an
   empty array (the map otherwise grew by one entry per distinct IP
   forever; an IP that never returns keeps only expired timestamps,
   which the filter drops on its next request, so it can never cause
   a false 429). */
const hits = new Map();
app.use("/api/", (req, res, next) => {
  if (req.method === "GET" && (req.path === "/health" || req.path === "/api/health")) return next();
  const now = Date.now();
  const arr = (hits.get(req.ip) || []).filter((t) => now - t < 60000);
  if (arr.length === 0) hits.delete(req.ip); // prune the stale key
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
var fbAuth = null;        // firebase-admin Auth, set when a credential is configured — verifies ID tokens

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
    console.log("[cap] A Firebase credential is set but firebase-admin could not be loaded (" + (e && e.code ? e.code + ": " : "") + (e && e.message ? e.message : e) + ") — daily cap stays in-memory (resets on restart). Run `npm install firebase-admin` to enable the Firestore cap store.");
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
    // The same credential enables ID-token verification (the N5 fix):
    // caps + admin are then decided from the VERIFIED token instead
    // of client-supplied uid/email. Separate try on purpose — if the
    // auth module is unavailable the cap store must still work, and
    // identity falls back to the legacy model (see resolveIdentity).
    try {
      var authMod = require("firebase-admin/auth");
      fbAuth = authMod.getAuth();
      console.log("[auth] ID-token verification: ON — uid/email come from verified Firebase tokens.");
    } catch (e2) {
      fbAuth = null;
      console.log("[auth] ID-token verification unavailable (" + (e2 && e2.message ? e2.message : e2) + ") — identity stays client-supplied.");
    }
  } catch (e) {
    capDb = null;
    capFieldValue = null;
    capStore = "memory";
    console.log("[cap] Firestore cap store failed to initialise (" + (e && e.message ? e.message : e) + ") — daily cap stays in-memory (resets on restart). Check the service-account JSON.");
  }
}

// Identity for cap/admin decisions (the N5 fix). ai.js sends the
// signed-in user's Firebase ID token with every call (body `token`
// on POSTs, query `token` on GETs; an Authorization: Bearer header
// is also accepted). When this server has a credential configured
// (fbAuth set), the uid/email INSIDE the verified token are the
// identity: client-supplied uid/email fields are ignored, a missing
// token is anonymous, and an invalid/expired token is anonymous too
// — never a fallback to whatever the request claims. Only when NO
// credential is configured (local dev, tests) does the legacy
// client-supplied uid/email apply, so nothing changes before the
// service-account key is added.
async function resolveIdentity(req, bodyObj, queryObj) {
  initCapStore();
  var token = "";
  var authz = String((req.headers && req.headers.authorization) || "");
  if (authz.slice(0, 7).toLowerCase() === "bearer ") token = authz.slice(7).trim();
  if (!token && bodyObj && bodyObj.token) token = String(bodyObj.token);
  if (!token && queryObj && queryObj.token) token = String(queryObj.token);
  token = token.slice(0, 4096);
  if (token && fbAuth) {
    try {
      var decoded = await fbAuth.verifyIdToken(token);
      return { uid: String((decoded && decoded.uid) || "").slice(0, 128), email: String((decoded && decoded.email) || "").trim().toLowerCase().slice(0, 128) };
    } catch (e) {
      console.log("[auth] ID token rejected (" + (e && e.code ? e.code + ": " : "") + (e && e.message ? e.message : e) + ") — treating the request as anonymous.");
      return { uid: "", email: "" };
    }
  }
  if (fbAuth) return { uid: "", email: "" }; // verification on, no token: anonymous
  var src = bodyObj || queryObj || {};
  return { uid: String(src.uid || "").slice(0, 128), email: String(src.email || "").trim().toLowerCase().slice(0, 128) };
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
// P2-47: increment-first with rollback. The old check-then-increment
// was racy: two concurrent requests (two devices, two tabs) could both
// read 199/200, both succeed, and both increment -> 201. Now a call
// RESERVES one answer before the Gemini call (increment first) and
// RELEASES it (decrement) on any failure, so a timeout / overload /
// bad reply still never burns a daily answer — and the success path
// keeps the reservation instead of incrementing a second time. The
// in-memory increment+check runs synchronously (no await between the
// read and the write), so it is atomic in Node's single thread and
// cannot overshoot. The Firestore path uses a transaction when the SDK
// offers one (the check re-runs on contention, so no overshoot);
// without runTransaction it falls back to a pre-read plus an atomic
// FieldValue.increment, which can overshoot by at most the number of
// requests in flight at the same instant — a small, bounded residual
// (real Firestore HAS runTransaction, so this only bites the test
// stand-in). A crash between reserve and release likewise leaves at
// most one count per in-flight request, and the memory store resets
// on restart anyway.
async function dailyReserve(uid, ip, isAdmin) {
  var cap = isAdmin ? ADMIN_DAILY_CAP : (uid ? DAILY_CAP_USER : DAILY_CAP_ANON);
  return reserveKey(dailyKey(uid, ip), cap);
}
// The shared learner pool: ONE counter that every non-admin answer
// reserves from (see USER_POOL_DAILY_CAP). Same reserve/release
// mechanics as a per-identity cap, under its own key.
function poolKey() { return "pool|" + dayStr(); }
async function dailyReservePool() { return reserveKey(poolKey(), USER_POOL_DAILY_CAP); }
async function dailyReleasePool() { return releaseKey(poolKey()); }
async function reserveKey(key, cap) {
  initCapStore();
  if (capStore === "firestore" && capDb) {
    try {
      if (typeof capDb.runTransaction === "function") {
        return await capDb.runTransaction(async function (tx) {
          var doc = capDb.collection(CAP_COLLECTION).doc(capDocId(key));
          var snap = await tx.get(doc);
          var data = snap.exists ? snap.data() : null;
          var count = (data && typeof data.count === "number") ? data.count : 0;
          if (count >= cap) return false;
          var patch = { updatedAt: new Date().toISOString() };
          if (capFieldValue && typeof capFieldValue.increment === "function") patch.count = capFieldValue.increment(1);
          else patch.count = count + 1;
          tx.set(doc, patch, { merge: true });
          return true;
        });
      }
      // No transactions: pre-read + atomic increment (see note above).
      var cur = await capGetCount(key);
      if (cur >= cap) return false;
      await capAddCount(key);
      return true;
    } catch (e) {
      console.log("[cap] Firestore reserve failed, using in-memory reserve for this request: " + (e && e.message ? e.message : e));
    }
  }
  var rec = daily.get(key) || { count: 0 };
  if (rec.count >= cap) return false;
  rec.count += 1;
  daily.set(key, rec);
  return true;
}
// Undo a reservation: any failure return, or a success the client never
// received because it disconnected first (P1-23). Never drops below 0.
async function dailyRelease(uid, ip) {
  return releaseKey(dailyKey(uid, ip));
}
async function releaseKey(key) {
  if (capStore === "firestore" && capDb) {
    try {
      var doc = capDb.collection(CAP_COLLECTION).doc(capDocId(key));
      var patch = { updatedAt: new Date().toISOString() };
      if (capFieldValue && typeof capFieldValue.increment === "function") patch.count = capFieldValue.increment(-1);
      else patch.count = Math.max(0, (await capGetCount(key)) - 1);
      await doc.set(patch, { merge: true });
      return;
    } catch (e) {
      console.log("[cap] Firestore release failed, releasing in-memory for this request: " + (e && e.message ? e.message : e));
    }
  }
  var rec = daily.get(key);
  if (rec) {
    rec.count = Math.max(0, rec.count - 1);
    if (rec.count === 0) daily.delete(key); else daily.set(key, rec);
  }
}

app.get("/api/health", (req, res) => {
  initCapStore(); // local-only; reports which cap store is active
  res.json({ ok: true, ai: GEMINI_KEYS.length > 0 || GROQ_API_KEY !== "", model: MODEL, models: MODELS, groq: GROQ_API_KEY !== "", groqModels: GROQ_MODELS, capStore: capStore, authVerify: !!fbAuth, uptimeSec: Math.floor(process.uptime()) });
});
// GET /api/usage — today's AI usage for the REQUESTER only:
// { ok, date (IST), used, cap, admin }. Signed-in users are keyed by
// uid, anonymous by IP. The admin (ADMIN_EMAIL + uid) gets cap 10,000
// and admin: true. Identity comes from resolveIdentity: a verified
// Firebase ID token when the server has a credential configured
// (the client sends it as ?token=), legacy uid/email params only
// when it does not — this endpoint never returns anyone else's count.
app.get("/api/usage", async (req, res) => {
  var ident = await resolveIdentity(req, null, req.query || {});
  var uid = ident.uid;
  var email = ident.email;
  var admin = !!uid && email === ADMIN_EMAIL;
  var used = await capGetCount(dailyKey(uid, req.ip));
  res.json({ ok: true, date: dayStr(), used: used, cap: admin ? ADMIN_DAILY_CAP : (uid ? DAILY_CAP_USER : DAILY_CAP_ANON), admin: admin });
});
/* ---------------- admin overview ---------------- */
// Every cap-store entry as { type: "user"|"anon", who, date, count }.
// Memory keys are raw ("u:<uid>|<date>" / "a:<ip>|<date>"); Firestore
// doc ids are the sanitised form ("u_<uid>_<date>") — the date is the
// trailing _YYYY-MM-DD and the type the first character either way.
async function capSnapshot() {
  initCapStore();
  var out = [];
  if (capStore === "firestore" && capDb) {
    try {
      var snap = await capDb.collection(CAP_COLLECTION).get();
      snap.forEach(function (doc) {
        var data = doc.data() || {};
        var id = String(doc.id || "");
        var m = id.match(/_(\d{4}-\d{2}-\d{2})$/);
        if (!m) return;
        var head = id.slice(0, id.length - m[0].length);
        if (head === "pool") return; // control counter, not an identity
        out.push({ type: head.charAt(0) === "u" ? "user" : "anon", who: head.slice(2), date: m[1], count: typeof data.count === "number" ? data.count : 0 });
      });
      return out;
    } catch (e) {
      console.log("[admin] Firestore cap snapshot failed, using in-memory entries: " + (e && e.message ? e.message : e));
    }
  }
  daily.forEach(function (rec, key) {
    var parts = String(key).split("|");
    if (parts.length !== 2) return;
    if (parts[0] === "pool") return; // control counter, not an identity
    out.push({ type: parts[0].charAt(0) === "u" ? "user" : "anon", who: parts[0].slice(2), date: parts[1], count: rec && typeof rec.count === "number" ? rec.count : 0 });
  });
  return out;
}
// GET /api/admin/overview — the Admin page's one data call. ADMIN
// ONLY: the requester must resolve (resolveIdentity) to ADMIN_EMAIL
// with a uid — on a credential-configured server that means a real
// verified token, so the page's data can't be claimed into. Returns
// system status, the cap configuration, today's usage totals with
// the top identities, the admin's own usage, and 7 days of totals.
app.get("/api/admin/overview", async (req, res) => {
  var ident = await resolveIdentity(req, null, req.query || {});
  if (!ident.uid || ident.email !== ADMIN_EMAIL) {
    return res.status(403).json({ ok: false, error: "Admins only.", code: "NOT_ADMIN" });
  }
  var entries = await capSnapshot();
  var today = dayStr();
  var byDate = {};
  var todayIds = [];
  var myUsed = 0;
  entries.forEach(function (e) {
    var d = byDate[e.date] || (byDate[e.date] = { date: e.date, total: 0, userAnswers: 0, anonAnswers: 0, users: {} });
    d.total += e.count;
    if (e.type === "user") { d.userAnswers += e.count; if (e.count > 0) d.users[e.who] = true; }
    else d.anonAnswers += e.count;
    if (e.date === today) {
      todayIds.push(e);
      if (e.type === "user" && e.who === ident.uid) myUsed = e.count;
    }
  });
  var days = [];
  for (var i = 6; i >= 0; i--) {
    var ds = new Date(Date.now() + (5 * 60 + 30) * 60000 - i * 86400000).toISOString().slice(0, 10);
    var dd = byDate[ds] || { total: 0, userAnswers: 0, anonAnswers: 0, users: {} };
    days.push({ date: ds, total: dd.total, userAnswers: dd.userAnswers, anonAnswers: dd.anonAnswers, users: Object.keys(dd.users).length });
  }
  var t = byDate[today] || { total: 0, userAnswers: 0, anonAnswers: 0, users: {} };
  todayIds.sort(function (a, b) { return b.count - a.count; });
  res.json({
    ok: true,
    date: today,
    server: { ai: GEMINI_KEYS.length > 0 || GROQ_API_KEY !== "", capStore: capStore, authVerify: !!fbAuth, uptimeSec: Math.floor(process.uptime()), geminiKeys: GEMINI_KEYS.length, models: MODELS, groq: GROQ_API_KEY !== "", groqModels: GROQ_MODELS },
    caps: { anon: DAILY_CAP_ANON, user: DAILY_CAP_USER, admin: ADMIN_DAILY_CAP, adminEmail: ADMIN_EMAIL },
    plan: { capacity: DAILY_CAPACITY_TOTAL, adminReserved: ADMIN_DAILY_CAP, userPool: USER_POOL_DAILY_CAP, userPoolUsed: Math.max(0, t.total - myUsed) },
    me: { uid: ident.uid, email: ident.email, used: myUsed, cap: ADMIN_DAILY_CAP },
    today: { total: t.total, userAnswers: t.userAnswers, anonAnswers: t.anonAnswers, users: Object.keys(t.users).length, identities: todayIds.slice(0, 25) },
    days: days
  });
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
  // Flowchart Lab v2 (AST page): its two AI buttons compose the full
  // instruction + chart structure in `context` (see buildPrompt).
  explain: { style: tutorStyle, maxTokens: 1200 },
  logic_check: { style: "", maxTokens: 1200 },
};

function buildPrompt(mode, code, errText, context, stage) {
  switch (mode) {
    case "flowchart":
      return "Write ONLY clean, simple Python code that solves this problem. Use only beginner Python (input/print, if/elif/else, for/while loops, functions, lists) — no classes, decorators, or match statements. Output raw code only — no markdown fences, no explanation, no comments beyond one line:\n\n" + code;
    case "flowchart-code":
      return "Write ONLY clean, simple Python code that implements these flowchart steps. Use input() for INPUT steps and print() for PRINT/OUTPUT steps. Use only beginner Python (no classes, decorators, or match statements). Output raw code only — no markdown fences, no explanation, no comments beyond one line:\n\n" + code;
    case "flowchart-explain":
      return "Explain this flowchart / algorithm in plain words, step by step, as if teaching a beginner what the program does and why each step exists. No code, just the explanation.\n\nFLOWCHART / ALGORITHM:\n" + code;
    case "explain":
      // Flowchart Lab v2 "Explain this flowchart": the client composes
      // the full instruction + chart structure in `context`; the code
      // under discussion rides in `code`. (The default case below would
      // ignore `context` entirely, so this mode needs its own case.)
      return (context || "Explain this Python code step by step for a beginner.") + "\n\nCODE:\n" + code;
    case "logic_check":
      // Flowchart Lab v2 "Check my logic": same composition contract.
      return (context || "Review this Python code's logic: look for loops that may not terminate, branches that can never run, inverted conditions, off-by-one risks, and inputs that break it. Be specific with line numbers; if it looks correct, say so plainly.") + "\n\nCODE:\n" + code;
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

function providerError(status) {
  if (status === 404) return { status: 502, code: "MODEL_NOT_FOUND", error: "AI model not found (configuration problem)." };
  if (status === 401 || status === 403) return { status: 502, code: "KEY_ERROR", error: "AI key problem (configuration)." };
  if (status === 429) return { status: 429, code: "QUOTA", error: "AI quota exhausted — try again later." };
  if (status === 503) return { status: 503, code: "OVERLOADED", error: "AI provider is overloaded — try again in a moment." };
  return { status: 502, code: "MODEL_ERROR", error: "AI provider error (HTTP " + status + ")." };
}

app.post("/api/explain", async (req, res) => {
  const started = Date.now();
  if (!GEMINI_KEYS.length && !GROQ_API_KEY) return res.status(503).json({ error: "AI backend not configured.", code: "NOT_CONFIGURED" });
  const code = String((req.body && req.body.code) || "").slice(0, 8000);
  const errText = String((req.body && req.body.error) || "").slice(0, 2000);
  const context = String((req.body && req.body.context) || "").slice(0, 2000);
  const mode = String((req.body && req.body.mode) || "");
  const stage = String((req.body && req.body.stage) || "");
  const ident = await resolveIdentity(req, req.body || {}, null);
  const uid = ident.uid;
  const email = ident.email;
  // Admin (ADMIN_EMAIL, signed in): a 10,000/day reserve
  // (ADMIN_DAILY_CAP), counted like everyone else — no bypass, just
  // a much bigger bucket, and it never draws from the learner pool.
  // On a credential-configured server the identity is the VERIFIED
  // token's (see resolveIdentity): the body's uid/email alone grant
  // nothing there.
  const isAdminUser = !!uid && email === ADMIN_EMAIL;
  const spec = Object.prototype.hasOwnProperty.call(MODES, mode) ? MODES[mode] : MODES[""];
  if (!code.trim() && !errText.trim()) return res.status(400).json({ error: "Nothing to explain.", code: "EMPTY" });
  // P2-47: reserve one answer BEFORE the Gemini call (increment-first);
  // every failure return below releases it again via releaseCap().
  var myCap = isAdminUser ? ADMIN_DAILY_CAP : (uid ? DAILY_CAP_USER : DAILY_CAP_ANON);
  var reserved = await dailyReserve(uid, req.ip, isAdminUser);
  if (!reserved) {
    return res.status(429).json({ error: "You've used your " + myCap.toLocaleString("en-IN") + " AI answers for today — they reset tomorrow.", code: "DAILY_CAP" });
  }
  // Capacity division: every non-admin answer ALSO reserves from
  // the shared learner pool, so all learners together can never
  // consume the admin reserve. Admin answers skip the pool. A pool
  // refusal releases the identity reservation again — the caller
  // used nothing.
  var poolReserved = false;
  if (!isAdminUser) {
    poolReserved = await dailyReservePool();
    if (!poolReserved) {
      await dailyRelease(uid, req.ip);
      return res.status(429).json({ error: "Skillzify's shared pool of " + USER_POOL_DAILY_CAP.toLocaleString("en-IN") + " AI answers for today is used up — it resets tomorrow.", code: "POOL_CAP" });
    }
  }
  async function releaseCap() {
    if (reserved) { reserved = false; await dailyRelease(uid, req.ip); }
    if (poolReserved) { poolReserved = false; await dailyReleasePool(); }
  }
  // A success the client never received (disconnected before delivery —
  // P1-23) releases the reservation instead of burning a daily answer
  // the client can't use; a delivered success keeps it (no second count).
  function clientGone() { return req.aborted === true || !!(req.socket && req.socket.destroyed); }
  async function keepOrRelease() {
    if (clientGone()) { await releaseCap(); console.log("[ai] client disconnected before delivery — daily cap not counted"); }
  }

  const style = spec.style;
  const prompt = buildPrompt(mode, code, errText, context, stage);

  // Try keys x models in order. Returns { r, model, keyIdx } on the first
  // HTTP response (ok, or fatal), or { r: null, model, keyIdx, error }
  // when every combination failed. Retryable: 429 (quota), 503
  // (overloaded), 404 (model unavailable on this project), timeout /
  // network errors — move to the next combination. Fatal: 401/403 (the
  // key is bad for every model) and anything else — answer at once.
  async function callGemini(promptText, maxTokens, onlyModel, timeoutMs, budgetMs) {
    var models = onlyModel ? [onlyModel] : MODELS;
    var attemptTimeout = timeoutMs || ATTEMPT_TIMEOUT_MS;
    // P1-23: budgetMs overrides the failover budget for this call only
    // (used by the MAX_TOKENS retry, which has its own 55 s deadline).
    var budget = (typeof budgetMs === "number" && budgetMs > 0) ? budgetMs : FAILOVER_BUDGET_MS;
    var lastErr = { status: 502, code: "MODEL_ERROR", error: "AI provider error." };
    var lastModel = models[0], lastKeyIdx = 0;
    // Circuit breaker: skip open models — unless every model is open
    // (then the full chain still runs) or this call pins one model.
    var breakerActive = !onlyModel && models.some(function (m) { return !breakerIsOpen("gemini", m); });
    for (var ki = 0; ki < GEMINI_KEYS.length; ki++) {
      for (var mi = 0; mi < models.length; mi++) {
        var model = models[mi];
        if (Date.now() - started > budget) {
          console.log("[ai] failover budget spent — answering with last error " + lastErr.code);
          return { r: null, model: lastModel, keyIdx: lastKeyIdx, error: lastErr };
        }
        if (breakerActive && breakerIsOpen("gemini", model)) {
          console.log("[ai] model " + model + " skipped (circuit breaker open)");
          continue;
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
          if (e && e.name === "AbortError") breakerNoteTimeout("gemini", model);
          console.log("[ai] model " + model + " key#" + (ki + 1) + " attempt failed (" + (e.name || "error") + ") — trying next");
          lastErr = { status: 502, code: "TIMEOUT", error: "Could not reach the AI provider." };
          continue;
        }
        clearTimeout(timer);
        if (r.ok) { breakerNoteSuccess("gemini", model); return { r: r, model: model, keyIdx: ki }; }
        var g = providerError(r.status);
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

  // Groq (OpenAI-compatible chat completions). Same contract as
  // callGemini: { r, model, keyIdx, error, provider }. The success `r`
  // is a thin wrapper whose json() translates Groq's OpenAI shape into
  // the Gemini shape the handler below already parses (candidates[0].
  // content.parts, finishReason STOP / MAX_TOKENS), so nothing
  // downstream changes. Retryable: 429 / 503 / 404 (model retired) —
  // next model. Fatal: 401/403 (bad key) and anything else — answer
  // at once. Single key: Groq limits are per organisation, so extra
  // keys in the same org add nothing.
  async function callGroq(promptText, maxTokens, onlyModel, timeoutMs, budgetMs) {
    var models = onlyModel ? [onlyModel] : GROQ_MODELS;
    var attemptTimeout = timeoutMs || ATTEMPT_TIMEOUT_MS;
    var budget = (typeof budgetMs === "number" && budgetMs > 0) ? budgetMs : FAILOVER_BUDGET_MS;
    var lastErr = { status: 502, code: "MODEL_ERROR", error: "AI provider error." };
    var lastModel = models[0];
    // Circuit breaker: same rules as callGemini (see breaker note).
    var breakerActive = !onlyModel && models.some(function (m) { return !breakerIsOpen("groq", m); });
    for (var mi = 0; mi < models.length; mi++) {
      var model = models[mi];
      if (Date.now() - started > budget) {
        console.log("[ai] groq failover budget spent — answering with last error " + lastErr.code);
        return { r: null, model: lastModel, keyIdx: 0, error: lastErr, provider: "groq" };
      }
      if (breakerActive && breakerIsOpen("groq", model)) {
        console.log("[ai] groq model " + model + " skipped (circuit breaker open)");
        continue;
      }
      lastModel = model;
      var ctrl = new AbortController();
      var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, attemptTimeout);
      var r;
      try {
        r = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_API_KEY },
          body: JSON.stringify(Object.assign(
            {
              model: model,
              messages: [
                { role: "system", content: style },
                { role: "user", content: promptText }
              ],
              temperature: 0.4,
              max_tokens: maxTokens,
              stream: false
            },
            spec.json ? { response_format: { type: "json_object" } } : {}
          )),
          signal: ctrl.signal,
        });
      } catch (e) {
        clearTimeout(timer);
        if (e && e.name === "AbortError") breakerNoteTimeout("groq", model);
        console.log("[ai] groq model " + model + " attempt failed (" + (e.name || "error") + ") — trying next");
        lastErr = { status: 502, code: "TIMEOUT", error: "Could not reach the AI provider." };
        continue;
      }
      clearTimeout(timer);
      if (r.ok) {
        breakerNoteSuccess("groq", model);
        var groqData;
        try { groqData = await r.json(); } catch (e) {
          console.log("[ai] groq model " + model + " returned unparsable JSON — trying next");
          lastErr = { status: 502, code: "MODEL_ERROR", error: "AI provider error." };
          continue;
        }
        var choice = (groqData.choices && groqData.choices[0]) || {};
        var groqText = (choice.message && choice.message.content) || "";
        var groqFinish = choice.finish_reason === "length" ? "MAX_TOKENS" : "STOP";
        var translated = { candidates: [{ content: { parts: [{ text: groqText }] }, finishReason: groqFinish }] };
        return { r: { ok: true, json: async function () { return translated; } }, model: model, keyIdx: 0, provider: "groq" };
      }
      var g = providerError(r.status);
      if (r.status === 429 || r.status === 503 || r.status === 404) {
        console.log("[ai] groq model " + model + " fail " + g.code + " — trying next");
        lastErr = g;
        continue;
      }
      console.log("[ai] groq model " + model + " fail " + g.code + " — not retryable");
      return { r: r, model: model, keyIdx: 0, error: g, provider: "groq" };
    }
    return { r: null, model: lastModel, keyIdx: 0, error: lastErr, provider: "groq" };
  }

  // Provider order: all Gemini keys x models first, Groq second.
  // onlyModel pins one model (MAX_TOKENS retry): route by which list
  // owns it. Returns the same { r, model, keyIdx, error, provider }.
  async function callAI(promptText, maxTokens, onlyModel, timeoutMs, budgetMs) {
    if (onlyModel && GROQ_MODELS.indexOf(onlyModel) !== -1) {
      if (!GROQ_API_KEY) return { r: null, model: onlyModel, keyIdx: 0, error: { status: 502, code: "MODEL_ERROR", error: "AI provider error." }, provider: "groq" };
      return callGroq(promptText, maxTokens, onlyModel, timeoutMs, budgetMs);
    }
    var got = await callGemini(promptText, maxTokens, onlyModel, timeoutMs, budgetMs);
    if ((got.r && got.r.ok) || !GROQ_API_KEY) return got;
    // Gemini failed on every combination (or is unconfigured) — spill
    // over to Groq with the same shared budget. The budget clock is
    // shared (started), so a spent budget returns at once from callGroq.
    console.log("[ai] gemini exhausted — trying groq");
    var g2 = await callGroq(promptText, maxTokens, null, timeoutMs, budgetMs);
    // Prefer the Groq answer if it worked; otherwise keep the Gemini
    // error — it is usually the more actionable one for the client.
    // Exception: when Gemini was not even configured, its error is just
    // the default placeholder — Groq's error is the real one.
    if (g2.r && g2.r.ok) return g2;
    if (!GEMINI_KEYS.length) return g2;
    return got;
  }

  try {
    let got = await callAI(prompt, spec.maxTokens || 1000);
    if (!got.r || !got.r.ok) {
      const g = got.error || { status: 502, code: "MODEL_ERROR", error: "AI provider error." };
      console.log("[ai]", mode || "explain", uid ? "uid" : "anon", "fail", g.code, Date.now() - started + "ms");
      await releaseCap();
      return res.status(g.status).json({ error: g.error, code: g.code });
    }
    let r = got.r;
    let usedModel = got.model;
    let data = await r.json();
    let cand = data.candidates && data.candidates[0];
    let finishReason = cand && cand.finishReason;
    console.log("[explain] finishReason:", finishReason || "(none)");
    // P1-23: if the model stopped because it ran out of output budget,
    // retry once with more room — same model (it just proved healthy),
    // longer clock, under its OWN deadline (started + 55 s), exempt from
    // the 40 s failover budget. The retry's per-attempt timeout is capped
    // at the time left before that deadline, so the whole request stays
    // inside the client's 60 s abort. If the retry fails (or there is no
    // time left for it), return the truncated first reply instead of
    // erroring and discarding a valid answer — but only for non-JSON
    // modes: a truncated JSON blob cannot parse, so JSON modes still
    // report the retry failure.
    let firstText = (cand && cand.content && cand.content.parts)
      ? cand.content.parts.map(function (p) { return p.text || ""; }).join("") : "";
    if (finishReason === "MAX_TOKENS") {
      console.log("[explain] hit token budget — retrying with a larger one");
      var retryRemaining = MAX_TOKENS_DEADLINE_MS - (Date.now() - started);
      var retryFailed = false;
      if (retryRemaining <= 0) {
        console.log("[explain] no time left before the MAX_TOKENS deadline — keeping the truncated reply");
        retryFailed = true;
      } else {
        got = await callAI(prompt, 4000, usedModel, Math.min(25000, retryRemaining), MAX_TOKENS_DEADLINE_MS);
        if (!got.r || !got.r.ok) {
          const g = got.error || { status: 502, code: "MODEL_ERROR", error: "AI provider error." };
          console.log("[ai]", mode || "explain", uid ? "uid" : "anon", "MAX_TOKENS retry fail", g.code, Date.now() - started + "ms");
          retryFailed = true;
        } else {
          r = got.r;
          usedModel = got.model;
          data = await r.json();
          cand = data.candidates && data.candidates[0];
          finishReason = cand && cand.finishReason;
          console.log("[explain] retry finishReason:", finishReason || "(none)");
        }
      }
      if (retryFailed) {
        // No usable retry: keep the truncated first reply (non-JSON
        // modes) instead of answering 502 MODEL_ERROR for an answer we
        // already have. JSON modes fall through to the normal error path
        // below via `got` still holding the failed retry.
        if (!spec.json && firstText.trim()) {
          console.log("[ai]", mode || "explain", uid ? "uid" : "anon", "ok-truncated", usedModel, Date.now() - started + "ms");
          await keepOrRelease();
          return res.json({ explanation: firstText, model: usedModel, truncated: true });
        }
        const g = (got && got.error) || { status: 502, code: "MODEL_ERROR", error: "AI provider error." };
        console.log("[ai]", mode || "explain", uid ? "uid" : "anon", "fail", g.code, Date.now() - started + "ms");
        await releaseCap();
        return res.status(g.status).json({ error: g.error, code: g.code });
      }
    }
    const parts = cand && cand.content && cand.content.parts;
    const text = parts ? parts.map((p) => p.text || "").join("") : "";
    if (!text.trim()) {
      console.log("[explain] empty model text; finishReason was:", finishReason || "(none)");
      await releaseCap();
      return res.status(502).json({ error: "AI returned an empty explanation (finish: " + (finishReason || "unknown") + ").", code: "EMPTY_REPLY" });
    }
    let out = { explanation: text, model: usedModel };
    if (spec.json) {
      try {
        const validate = mode === "viva" ? (stage === "judge" ? isVivaJudge : isVivaAsk) : spec.validate;
        out.json = parseJsonMode(text, validate);
      } catch (e) {
        console.log("[ai]", mode, uid ? "uid" : "anon", "fail", "BAD_JSON", Date.now() - started + "ms");
        await releaseCap();
        return res.status(502).json({ error: "AI returned an unusable answer — try again.", code: "BAD_JSON" });
      }
    }
    console.log("[ai]", mode || "explain", isAdminUser ? "admin" : (uid ? "uid" : "anon"), "ok", (got.provider || "gemini") + ":" + usedModel, "key#" + (got.keyIdx + 1), Date.now() - started + "ms");
    // Success only — the reservation made before the call IS the count
    // (no second increment; a MAX_TOKENS retry is still one request).
    // Awaited: the count must be durable (Firestore) before answering.
    // P1-23: if the client already disconnected (aborted fetch), the
    // answer is never delivered — release the reservation instead of
    // burning a daily-cap answer for it, or the client's retry pays
    // twice for one delivered answer.
    await keepOrRelease();
    res.json(out);
  } catch (e) {
    console.log("[ai]", mode || "explain", uid ? "uid" : "anon", "fail", "TIMEOUT", Date.now() - started + "ms");
    try { await releaseCap(); } catch (e2) {}
    res.status(502).json({ error: "Could not reach the AI provider.", code: "TIMEOUT" });
  }
});

/* ---- static site ----
   P2-56: express.static used to serve the whole repo — server.js,
   package.json, firestore.rules and the entire node_modules/ tree
   (dependency versions included) were all downloadable. The site
   files stay where they are (no public/ move); instead a guard denies
   the sensitive paths and hidden files, and cache headers are set
   (HTML entry points and every UNVERSIONED request are revalidated
   on every load; only ?v= versioned assets are cacheable for a day). Denied paths answer
   404, not 403, so the guard never confirms a file exists. */
var STATIC_DENIED_FILES = { "server.js": true, "package.json": true, "firestore.rules": true, ".env": true };
app.use(function (req, res, next) {
  if (req.path && req.path.indexOf("/api/") === 0) return next();
  var parts = String(req.path || "/").split("/");
  for (var i = 0; i < parts.length; i++) {
    var seg = parts[i];
    if (!seg) continue;
    if (seg === "node_modules" || seg.charAt(0) === "." || STATIC_DENIED_FILES[seg]) return res.sendStatus(404);
  }
  next();
});
app.use(express.static(path.join(__dirname), {
  dotfiles: "ignore",
  setHeaders: function (res, filePath) {
    // Entry points change on every deploy; assets are ?v= versioned.
    // BUT the cache decision must key on whether THIS request is
    // versioned: nav.js / footer.js are deliberately UNVERSIONED
    // shared chrome (6 Nov), so a blanket day-long max-age made
    // browsers hold a stale navbar for 24h after a deploy (12 Nov:
    // the new Admin link stayed invisible on the owner's phone while
    // the server already served the new file). Rule: no ?v= in the
    // request URL -> no-cache (stored, but revalidated via ETag on
    // every load, so a 304 keeps it cheap); ?v= -> cache for a day.
    var url = (res.req && (res.req.originalUrl || res.req.url)) || "";
    var versioned = /[?&]v=/.test(url);
    if (/\.html?$/.test(filePath) || !versioned) res.setHeader("Cache-Control", "no-cache");
    else res.setHeader("Cache-Control", "public, max-age=86400");
  }
}));

app.listen(PORT, () => {
  console.log(
    "Skillzify v2 on http://localhost:" + PORT + " | AI backend: " + (GEMINI_KEYS.length ? "ON (" + MODELS.join(", ") + ")" : "OFF (set GEMINI_API_KEY)") + (GROQ_API_KEY ? " + Groq (" + GROQ_MODELS.join(", ") + ")" : "")
  );
});
