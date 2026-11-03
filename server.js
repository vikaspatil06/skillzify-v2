/* ============================================================
   Skillzify v2 — backend (developer-side AI proxy)
   - Serves the static site
   - POST /api/explain proxies to Gemini using the DEVELOPER's
     API key from the GEMINI_API_KEY environment variable.
     The key is NEVER sent to the browser and NEVER committed.
   - GET  /api/health reports whether the AI backend is live.
   Run:  GEMINI_API_KEY=... node server.js   (or use a .env file)
   ============================================================ */
"use strict";

/* Load .env file if present (local dev convenience). Never commit .env. */
try {
  require("dotenv").config();
} catch (e) { /* dotenv optional on hosts that set env vars directly */ }

const express = require("express");
const path = require("path");

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const app = express();
app.use(express.json({ limit: "200kb" }));

/* ---- tiny in-memory rate limit: 30 AI req/min per IP ---- */
const hits = new Map();
app.use("/api/", (req, res, next) => {
  const now = Date.now();
  const arr = (hits.get(req.ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(req.ip, arr);
  if (arr.length > 30) return res.status(429).json({ error: "Too many requests — slow down a little." });
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ai: !!GEMINI_API_KEY, model: MODEL });
});

app.post("/api/explain", async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(503).json({ error: "AI backend not configured." });
  const code = String((req.body && req.body.code) || "").slice(0, 8000);
  const errText = String((req.body && req.body.error) || "").slice(0, 2000);
  const mode = String((req.body && req.body.mode) || "");
  if (!code.trim() && !errText.trim()) return res.status(400).json({ error: "Nothing to explain." });

  const tutorStyle =
    "You are a friendly Python tutor for a beginner student. " +
    "Format your answer exactly like this:\n" +
    "1. One line starting with '🎯 In short: ' stating what the program does.\n" +
    "2. A '🔍 Walkthrough:' section explaining the important parts step by step " +
    "(group repetitive lines; explain WHY each part exists, not just WHAT it says).\n" +
    "3. A '💡 Key concepts:' section listing each Python idea used with one short line each.\n" +
    "Keep the whole answer concise. Use short bullet points.";

  // Socratic tutor mode (Practice page): guide, don't reveal the answer.
  const socraticStyle =
    "You are a Socratic Python tutor for a beginner student working on a coding exercise. " +
    "Rules you MUST follow:\n" +
    "1. NEVER write the full corrected code — not even a snippet longer than one line.\n" +
    "2. Explain what is likely wrong in plain words, then give exactly ONE guiding hint.\n" +
    "3. Ask one short follow-up question that nudges the student to discover the fix.\n" +
    "4. Keep the whole answer under 120 words. Be encouraging.";
  const useSocratic = mode === "tutor";
  const useFlowchart = mode === "flowchart";
  const useGenerate = mode === "generate";
  const useFix = mode === "fix";
  const style = useSocratic ? socraticStyle : tutorStyle;
  const prompt = useFlowchart
    ? "Write ONLY clean, simple Python code that solves this problem. Output raw code only — no markdown fences, no explanation, no comments beyond one line:\n\n" + code
    : useGenerate
    ? "Write clean, beginner-friendly Python code for this request. Output the code inside a single ```python fenced block, then 2-3 short bullet points explaining the key parts. Keep it simple — no advanced tricks.\n\nREQUEST:\n" + code
    : useFix
    ? "A student's Python code has this error. Output the FULL corrected code inside a single ```python fenced block, then 2-3 short bullet points explaining what was wrong and what you changed. Fix only what's broken — keep their style.\n\nCODE:\n" + code + "\n\nERROR:\n" + errText
    : useSocratic
    ? "A student is stuck on this Python exercise. Their code is failing. Follow your Socratic rules strictly.\n\n" + code + "\n\n" + errText
    : errText
    ? "A student ran this Python code and got this error. First explain the error in simple terms and exactly how to fix it, then give the walkthrough structure above for the code.\n\nCODE:\n" +
      code + "\n\nERROR:\n" + errText
    : "Explain this Python code using the walkthrough structure above.\n\nCODE:\n" + code;

  async function callGemini(prompt, attempt, maxTokens) {
    // Fail fast: never let one slow Google response hang the request for minutes.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(MODEL) + ":generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: style }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
          }),
          signal: ctrl.signal,
        }
      );
      clearTimeout(timer);
      // Google sometimes 503s under load ("try again later") — one retry helps.
      if ((r.status === 503 || r.status === 429) && attempt < 1) {
        await new Promise((ok) => setTimeout(ok, 2500));
        return callGemini(prompt, attempt + 1, maxTokens);
      }
      return r;
    } catch (e) {
      clearTimeout(timer);
      // Timeout / network blip — one retry with a fresh clock.
      if (attempt < 1) {
        console.log("[explain] attempt failed (" + (e.name || "error") + ") — retrying once");
        await new Promise((ok) => setTimeout(ok, 1500));
        return callGemini(prompt, attempt + 1, maxTokens);
      }
      throw e;
    }
  }

  try {
    let r = await callGemini(prompt, 0, 1000);
    if (!r.ok) return res.status(502).json({ error: "AI provider error (HTTP " + r.status + ")." });
    let data = await r.json();
    let cand = data.candidates && data.candidates[0];
    let finishReason = cand && cand.finishReason;
    console.log("[explain] finishReason:", finishReason || "(none)");
    // If the model stopped because it ran out of output budget, retry once with more room.
    if (finishReason === "MAX_TOKENS") {
      console.log("[explain] hit token budget — retrying with a larger one");
      r = await callGemini(prompt, 0, 4000);
      if (!r.ok) return res.status(502).json({ error: "AI provider error (HTTP " + r.status + ")." });
      data = await r.json();
      cand = data.candidates && data.candidates[0];
      finishReason = cand && cand.finishReason;
      console.log("[explain] retry finishReason:", finishReason || "(none)");
    }
    const parts = cand && cand.content && cand.content.parts;
    const text = parts ? parts.map((p) => p.text || "").join("") : "";
    if (!text.trim()) {
      console.log("[explain] empty model text; finishReason was:", finishReason || "(none)");
      return res.status(502).json({ error: "AI returned an empty explanation (finish: " + (finishReason || "unknown") + ")." });
    }
    res.json({ explanation: text });
  } catch (e) {
    res.status(502).json({ error: "Could not reach the AI provider." });
  }
});

/* ---- static site ---- */
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(
    "Skillzify v2 on http://localhost:" + PORT + " | AI backend: " + (GEMINI_API_KEY ? "ON (" + MODEL + ")" : "OFF (set GEMINI_API_KEY)")
  );
});
