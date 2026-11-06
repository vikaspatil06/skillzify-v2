# Skillzify v2 — Learn. Build. Shine. 🌟

An advanced, browser-first Python learning platform for students — a modern multi-page static site with an optional Node backend for AI features. No build step required.

**Live:** https://skillzify-v2.onrender.com · https://vikaspatil06.github.io/skillzify-v2/

## ✨ Features

- **Landing page** (`index.html`) — hero, feature cards, animated stats, testimonials, dark/light theme toggle
- **Python learning journey** (`learn.html`) — **250 lessons** across **7 journey sections** (🌱 Base Camp, 🧱 Tool Shed, 🏯 Object Castle, 🧠 Algorithm Arena, ⚡ Power Lab, 📊 Data Lab, 🚀 Launch Pad) rendered as a Duolingo-style visual journey: lesson nodes on a winding animated SVG path (locked 🔒 / current ✨ / completed ✓), sequential unlocking. Each lesson opens on its own page (`lesson.html?id=`) with a rich explanation, key takeaways, syntax-highlighted code (Copy + "Try in compiler" handoff), a quiz with instant feedback (3 questions picked at random from the lesson's question pool), and a mini coding challenge (predict-the-output or fill-the-blank). Completing both triggers confetti, XP gain popup, and streak update. **XP & levels** (Novice → Python Master) persist to `localStorage` and sync across devices via Firebase. Keyboard: `Esc` closes, `←/→` navigate lessons. Respects `prefers-reduced-motion`.
- **Spaced repetition** (`assets/js/review.js`) — SM-2-lite review scheduling (intervals 1 → 3 → 7 → 14 → 30 → 60 days, reset on a miss). A review section on the Learn page, a due-count nudge on the Dashboard, and review state that syncs across devices.
- **Practice Mode** (`practice.html` + `assets/js/practice.js` + `assets/js/practice-data.js`) — **150 exercises** across 17 topics (variables, strings, collections, loops, functions, OOP, exceptions, DSA, recursion, sorting, trees & graphs, dynamic programming, data science, web, files, testing, async) in 3 formats: ✍️ write-code (hidden tests executed in Pyodide), 🔮 predict-output, 🐞 fix-the-bug. Features: per-test pass/fail results, **3-level progressive hints**, ⏱ timed mode with personal bests, 📅 daily challenge (deterministic by date), 🔁 spaced-repetition review queue, solution walkthroughs, 🐍 pythonic-coach notes, your-code-vs-model **solution comparison**, and a **Socratic AI Tutor** (guides without revealing the answer). Solved exercises award XP into the shared system.
- **Learning Paths** (`paths.html`) — 6 guided sequences (Python Fundamentals, DSA with Python, Automation & Scripting, Data Analysis Basics, Interview Prep, Web Development with Python) mixing lessons and exercises with per-path progress bars. Enrolling in a path unlocks all of its lessons.
- **Projects** (`projects.html`) — 14 guided real-world builds (File Organizer, Weather API Client, Web Scraper, CSV Data Analyzer, and more) — each with milestones and starter code.
- **AI Compiler** (`compiler.html`) — real Python 3.11 via Pyodide (CDN), CodeMirror editor, run timing, console output, `input()` support, an interactive terminal, a multi-file workspace (saved locally and synced), sample snippets, snippet library (save/star/pin), and an **AI Explain** panel:
  - Offline heuristic explainer covering 12 common Python error patterns
  - Backend AI via the Render API (developer's Gemini key) → visitor's own optional key → offline fallback
  - A "🆘 Stuck?" button that drafts your code and error into a community question
- **Flowchart Lab** (`flowchart.html`) — draw a program's flow as a diagram, explain it with AI, or turn a flowchart into code
- **Skillzify Circle** (`community.html`) — the learner community: public profiles (verified progress), anchored Q&A (ask from a lesson, exercise, or error, with code attached; best answers earn XP), and a project showcase (share a build, star others, fork into the compiler). An "✨ Ask AI" button gives a Socratic hint on any question.
- **Dashboard** (`dashboard.html`) — overall % ring, per-section progress bars, day streak 🔥, recent run history, next-lesson hint, **exercise accuracy by topic with weak-spot flags**, today's challenge, review queue, and downloadable **section-completion certificates** (canvas-rendered PNG)
- **Profile** (`profile.html`) — GitHub-style identity: identicon avatar, editable name/bio (syncs to Firebase), pinned items, achievements, activity feed, and a shareable public profile (`profile.html?uid=`)
- **Python Reference** (`reference.html`) — W3Schools-style reference with **127 entries**, each with parameters, return values, common pitfalls, a verified example output, and a link to the lesson that teaches it — plus an overview page, an inline "▶ Run here" runner, search, favourites, and recently viewed
- **Firebase Authentication** (`auth.html` + `assets/js/auth.js`) — real Email/Password auth on Firebase project `skillzify-1d0f2` (same as the Android app); one account works across devices; nav shows your name. Progress, exercises, paths, and workspace sync through one Firestore document per user.
- **AI system** (`server.js` + `assets/js/ai.js`) — 15 AI modes behind one client: Socratic lesson tutor, adaptive drills, trace & narrate, context-aware error explainer, project review, build-my-path, mock viva, fresh quizzes, daily challenge, and flowchart explain / flowchart → code. Daily caps (50 calls signed-in, 10 anonymous), Gemini model failover across 6 models, and optional key rotation.
- **Android app** (`android/`) — native Kotlin + Jetpack Compose app (v1.2.3) with 95 lessons, 48 exercises, the reference, projects, paths, cross-device sync, an interactive compiler terminal, Flowchart Lab, and Gemini AI via the same backend
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
> about a minute. Render deploys are triggered manually from the Render
> dashboard — pushing to GitHub does not auto-deploy.

> The compiler downloads the Pyodide runtime (~10 MB) from a CDN on first use, so an internet connection is needed the first time you press **Run**.

### 🤖 Backend (developer-side AI)

The AI features call the backend on the same origin (`/api/*`). The backend
lives in `server.js` and uses the **developer's** Gemini key from the
`GEMINI_API_KEY` environment variable — visitors never need their own key, and
the key never reaches the browser or the repo. It supports 6 Gemini models
with automatic failover, and `GEMINI_API_KEYS` (comma-separated) rotates
across two keys for double the daily budget.

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
├── learn.html          # Learning journey: 7 sections, 250 lessons
├── lesson.html         # Single-lesson page (?id=)
├── practice.html       # Practice Mode (exercises + tests)
├── paths.html          # Guided learning paths (6)
├── projects.html       # Real-world guided projects (14)
├── compiler.html       # AI Python compiler + workspace
├── flowchart.html          # Flowchart Lab
├── community.html      # Skillzify Circle (community)
├── dashboard.html      # Progress dashboard + analytics + certificates
├── profile.html        # GitHub-style profile + public view
├── reference.html      # Python reference (127 entries)
├── auth.html           # Login / Register (Firebase)
├── about.html
├── contact.html
├── SECURITY.md         # Security policy
├── server.js           # Express backend: 15 AI modes, caps, failover
├── render.yaml         # Render one-click deploy
├── assets/
│   ├── css/style.css   # Theme variables, layout, responsive
│   ├── js/app.js       # Theme toggle, nav, toast, storage utils
│   ├── js/auth.js      # Firebase Authentication (Email/Password)
│   ├── js/learn-core.js    # Lesson catalog (250), sections, unlock chain, XP
│   ├── js/lessons-b.js     # Beginner lessons (b11–b70)
│   ├── js/lessons-i.js     # Intermediate lessons (i13–i90)
│   ├── js/lessons-a.js     # Advanced lessons (a11–a90)
│   ├── js/quiz-extra.js    # Extra quiz questions per lesson
│   ├── js/learn.js     # Learn page rendering (sections + review)
│   ├── js/lesson.js    # Single-lesson page + AI tutor
│   ├── js/review.js    # Spaced repetition (SM-2-lite)
│   ├── js/practice.js  # Practice engine: test runner, hints, timed mode
│   ├── js/practice-data.js # 150 validated exercises
│   ├── js/paths-data.js    # Learning path definitions (6 paths, 364 steps)
│   ├── js/paths.js     # Path rendering + enrollment
│   ├── js/projects-data.js # 14 guided projects
│   ├── js/compiler.js  # Pyodide runner + workspace + AI explainer
│   ├── js/dashboard.js # Dashboard rendering + analytics + certificates
│   ├── js/profile.js   # Profile rendering (Firebase-synced name)
│   ├── js/community.js # Community API (Q&A, showcase, profiles)
│   ├── js/community-page.js # Community page rendering
│   ├── js/ai.js        # Single AI client (15 modes, caps, fallback)
│   ├── js/viva.js      # Mock viva
│   ├── js/sync.js      # Firestore cross-device sync
│   ├── js/activity.js  # XP, streaks, achievements, feed
│   ├── js/nav.js       # Single-sourced navbar
│   ├── js/footer.js    # Single-sourced footer
│   ├── js/palette.js   # Cmd+K command palette
│   ├── js/reference-data.js # 127 reference entries
│   ├── js/reference.js # Reference page rendering + runner
│   ├── logo-dark.png   # Logo for light backgrounds
│   └── logo-light.png  # Logo for dark backgrounds
├── android/            # Native Android app (Kotlin + Chaquopy)
├── firestore.rules     # Firestore security rules (deploy in console)
└── README.md
```

## 🗺️ Roadmap

- [x] Quiz mode per lesson with XP scoring
- [x] Progressive unlocking + visual learning path
- [x] Practice Mode: 150 exercises with automated test evaluation
- [x] Progressive hints + Socratic AI Tutor
- [x] Learning paths + guided projects
- [x] Real Firebase Auth (web + Android, shared project)
- [x] Certificates for section completion
- [x] Google Analytics 4
- [x] Spaced-repetition scheduling (SM-2) for the review queue
- [x] Community (Skillzify Circle): profiles, Q&A, showcase
- [x] Multi-file compiler workspace
- [ ] Phase 2: 250 → 500 lessons (new Data Science, Web, ML/AI, Interview tracks)
- [ ] Shareable code snippets (URL-encoded)
- [ ] PWA support for offline lessons
- [ ] Community Phase 2: reviews, squads, helping economy

## 🔑 Notes on secrets

- The Firebase **web API key** in `assets/js/auth.js` and `android/app/google-services.json` is **public by design** (it ships in every web page and APK). Access is controlled by Firebase authorized domains and security rules, not the key.
- The developer's **Gemini API key** lives only in the `GEMINI_API_KEY` environment variable (Render dashboard / `.env`, gitignored) — never in the repo.
- The AI explainer's visitor key field is user-supplied and stored only in the browser.

---
© 2026 Skillzify · Learn. Build. Shine.
