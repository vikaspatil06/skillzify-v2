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
  if (!code.trim() && !errText.trim()) return res.status(400).json({ error: "Nothing to explain." });

  const prompt = errText
    ? "A student ran this Python code and got this error. Explain the error in simple terms and how to fix it:\n\nCODE:\n" +
      code + "\n\nERROR:\n" + errText
    : "Explain this Python code to a beginner student, briefly, concept by concept:\n\n" + code;

  async function callGemini(prompt, attempt) {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(MODEL) + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: "You are a friendly Python tutor for students. Keep answers concise, use simple language, and format with short bullet points.",
              },
            ],
          },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.4 },
        }),
      }
    );
    // Google sometimes 503s under load ("try again later") — one retry helps.
    if ((r.status === 503 || r.status === 429) && attempt < 1) {
      await new Promise((ok) => setTimeout(ok, 2500));
      return callGemini(prompt, attempt + 1);
    }
    return r;
  }

  try {
    const r = await callGemini(prompt, 0);
    if (!r.ok) return res.status(502).json({ error: "AI provider error (HTTP " + r.status + ")." });
    const data = await r.json();
    const parts =
      data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const text = parts ? parts.map((p) => p.text || "").join("") : "";
    res.json({ explanation: text || "(empty response)" });
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
