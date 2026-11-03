# Skillzify v2 — Learn. Build. Shine. 🌟

An advanced, browser-first Python learning platform for students — a modern multi-page static site with an optional Node backend for AI features. No build step required.

**Live:** https://skillzify-v2.onrender.com · https://vikaspatil06.github.io/skillzify-v2/

## ✨ Features

- **Landing page** (`index.html`) — hero, feature cards, animated stats, testimonials, dark/light theme toggle
- **Python learning path** (`learn.html`) — **95 lessons** across Beginner (30) / Intermediate (35) / Advanced (30) rendered as a Duolingo-style visual journey: lesson nodes on a winding animated SVG path (locked 🔒 / current ✨ / completed ✓), sequential unlocking. Each lesson opens in a slide-over panel with rich explanation, key takeaways, syntax-highlighted code (Copy + "Try in compiler" handoff), a 2-question quiz with instant feedback, and a mini coding challenge (predict-the-output or fill-the-blank). Completing both triggers confetti, XP gain popup, and streak update. **XP & levels** (Novice → Python Master) persist to `localStorage`. Keyboard: `Esc` closes, `←/→` navigate lessons. Respects `prefers-reduced-motion`.
- **Practice Mode** (`practice.html` + `assets/js/practice.js` + `assets/js/practice-data.js`) — **24 exercises** across 8 topics (variables, strings, collections, loops, functions, OOP, exceptions, algorithms) in 3 formats: ✍️ write-code (hidden tests executed in Pyodide), 🔮 predict-output, 🐞 fix-the-bug. Features: per-test pass/fail results, **3-level progressive hints**, ⏱ timed mode with personal bests, 📅 daily challenge (deterministic by date), 🔁 spaced-repetition review queue, solution walkthroughs, 🐍 pythonic-coach notes, your-code-vs-model **solution comparison**, and a **Socratic AI Tutor** (guides without revealing the answer). Solved exercises award XP into the shared system.
- **Learning Paths** (`paths.html`) — 5 guided sequences (Python Fundamentals, DSA with Python, Automation & Scripting, Data Analysis Basics, Interview Prep) mixing lessons and exercises with per-path progress bars.
- **Projects** (`projects.html`) — 4 guided real-world builds: File Organizer, Weather API Client, Web Scraper, CSV Data Analyzer — each with milestones and starter code.
- **AI Compiler** (`compiler.html`) — real Python 3.11 via Pyodide (CDN), CodeMirror editor, run timing, console output, `input()` support, sample snippets, snippet library (save/star/pin), and an **AI Explain** panel:
  - Offline heuristic explainer covering 12 common Python error patterns
  - Backend AI via `POST /api/explain` (developer's Gemini key, Render) → visitor's own optional key → offline fallback
- **Dashboard** (`dashboard.html`) — overall % ring, per-track bars, day streak 🔥, recent run history, next-lesson hint, **exercise accuracy by topic with weak-spot flags**, today's challenge, review queue, and downloadable **track-completion certificates** (canvas-rendered PNG)
- **Profile** (`profile.html`) — GitHub-style identity: identicon avatar, editable name/bio (syncs to Firebase), contribution heatmap, pinned items, achievements, activity feed
- **Python Reference** (`reference.html`) — W3Schools-style reference with 30+ entries, Try-it-yourself handoff, and copy buttons
- **Firebase Authentication** (`auth.html` + `assets/js/auth.js`) — real Email/Password auth on Firebase project `skillzify-1d0f2` (same as the Android app); one account works across devices; nav shows your name
- **Command palette** (`Ctrl/⌘+K`) — fuzzy search over pages, lessons, snippets, and actions
- **About / Contact** — contact form opens the visitor's email app pre-addressed to skillzifyind2024@gmail.com (mailto fallback)
- **Analytics** — Google Analytics 4 on all pages
- **Security** — `SECURITY.md` policy + private vulnerability reporting enabled
- **Theming** — dark mode default, CSS variables, responsive down to phones

## 🚀 How to run

No build step. Any of these work:

```bash
# Option 1: Python's built-in server (recommended for static preview)
cd skillzify-v2
python3 -m http.server 8080
# then open http://localhost:8080
```

### 🌐 Put it online with smart AI (one click, free)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/vikaspatil06/skillzify-v2)

1. Click **Deploy to Render** above (or open the link).
2. Connect your GitHub account if asked and confirm the `skillzify-v2` repo.
3. When prompted for `GEMINI_API_KEY`, paste your Gemini API key (it stays in
   Render's secret settings — never in the repo).
4. Click **Deploy** and wait 2–3 minutes.
5. Open the URL Render gives you (like `https://skillzify-v2.onrender.com`) —
   the full site works there with smart AI, no setup for visitors.

> Render's free tier sleeps after ~15 minutes idle; the first visit wakes it in
> about a minute. Every push to GitHub redeploys automatically.

> The compiler downloads the Pyodide runtime (~10 MB) from a CDN on first use, so an internet connection is needed the first time you press **Run**.

### 🤖 Backend (developer-side AI)

"Explain last error" / "Explain my code" call `POST /api/explain` on the same
origin first. That endpoint lives in `server.js` and uses the **developer's**
Gemini key from the `GEMINI_API_KEY` environment variable — visitors never
need their own key, and the key never reaches the browser or the repo.

```bash
cd skillzify-v2
npm install
GEMINI_API_KEY=your-key-here npm start
# then open http://localhost:8080
```

Without `GEMINI_API_KEY`, the site still works: the frontend falls back to a
visitor's own optional key, then to the offline explainer. To deploy free,
push to [Render](https://render.com) as a Node web service (`npm start`) and
set `GEMINI_API_KEY` in its environment variables. `.env` is gitignored —
never commit a real key (the repo is public).

## 📁 Project structure

```
skillzify-v2/
├── index.html          # Landing page
├── learn.html          # Learning tracks + 95 lessons
├── practice.html       # Practice Mode (exercises + tests)
├── paths.html          # Guided learning paths
├── projects.html       # Real-world guided projects
├── compiler.html       # AI Python compiler
├── dashboard.html      # Progress dashboard + analytics + certificates
├── profile.html        # GitHub-style profile
├── reference.html      # Python reference
├── auth.html           # Login / Register (Firebase)
├── about.html
├── contact.html
├── SECURITY.md         # Security policy
├── server.js           # Express backend: AI explain + Socratic tutor
├── render.yaml         # Render one-click deploy
├── assets/
│   ├── css/style.css   # Theme variables, layout, responsive
│   ├── js/app.js       # Theme toggle, nav, toast, storage utils
│   ├── js/auth.js      # Firebase Authentication (Email/Password)
│   ├── js/learn.js     # 95-lesson catalog + progress
│   ├── js/practice.js  # Practice engine: test runner, hints, timed mode
│   ├── js/practice-data.js # 24 validated exercises
│   ├── js/paths-data.js    # Learning path definitions
│   ├── js/compiler.js  # Pyodide runner + AI explainer
│   ├── js/dashboard.js # Dashboard rendering + analytics + certificates
│   ├── js/profile.js   # Profile rendering (Firebase-synced name)
│   ├── js/activity.js  # XP, streaks, heatmap, achievements, feed
│   ├── js/palette.js   # Cmd+K command palette
│   ├── js/reference-data.js # Python reference entries
│   ├── logo-dark.png   # Logo for light backgrounds
│   └── logo-light.png  # Logo for dark backgrounds
├── android/            # Native Android app (Kotlin + Chaquopy)
└── README.md
```

## 🗺️ Roadmap

- [x] Quiz mode per lesson with XP scoring
- [x] Progressive unlocking + visual learning path
- [x] Practice Mode: 24 exercises with automated test evaluation
- [x] Progressive hints + Socratic AI Tutor
- [x] Learning paths + guided projects
- [x] Real Firebase Auth (web + Android, shared project)
- [x] Certificates for track completion
- [x] Google Analytics 4
- [ ] Spaced-repetition scheduling (SM-2) for the review queue
- [ ] Shareable code snippets (URL-encoded)
- [ ] PWA support for offline lessons
- [ ] Community forum + live leaderboards (needs backend)
- [ ] Multi-file projects in the compiler

## 🔑 Notes on secrets

- The Firebase **web API key** in `assets/js/auth.js` and `android/app/google-services.json` is **public by design** (it ships in every web page and APK). Access is controlled by Firebase authorized domains and security rules, not the key.
- The developer's **Gemini API key** lives only in the `GEMINI_API_KEY` environment variable (Render dashboard / `.env`, gitignored) — never in the repo.
- The AI explainer's visitor key field is user-supplied and stored only in the browser.

---
© 2026 Skillzify · Learn. Build. Shine.
