# Skillzify v2 — Learn. Build. Shine. 🌟

An advanced, browser-first Python learning platform for students — a modern multi-page static site with an optional Node backend for AI features. No build step required.

**Live:** https://skillzify-v2.onrender.com · https://vikaspatil06.github.io/skillzify-v2/

## ✨ Features

- **Landing page** (`index.html`) — a full front door in the unified design system: hero with a live code window and an animated stats bar (250 lessons · 150 exercises · 127 reference entries · 15 projects · 6 paths / 370 steps · 32 achievements · 11 levels · 7 sections), the subject strip, placement-test + learning-paths overview, the 7-section journey, a 12-card feature grid, a Learn → Practice → Build → Prove loop, a Code Studio showcase, a Problem of the Day teaser, community + leaderboard cards, the full 11-level XP ladder, an FAQ, and dark/light theme + accent switching
- **Python learning journey** (`learn.html`) — **250 lessons** across **7 journey sections** (🌱 Base Camp, 🧱 Tool Shed, 🏯 Object Castle, 🧠 Algorithm Arena, ⚡ Power Lab, 📊 Data Lab, 🚀 Launch Pad) rendered as a visual journey: lesson nodes on a left-rail timeline (locked 🔒 / current ✨ / completed ✓), sequential unlocking, and a sticky progress + review rail that travels with you while the lessons scroll. Each lesson opens on its own page (`lesson.html?id=`) with a rich explanation, key takeaways, syntax-highlighted code (Copy + "Try in compiler" handoff), a quiz with instant feedback (up to 3 questions picked at random from the lesson's question pool), and a mini coding challenge (predict-the-output or fill-the-blank). Completing both triggers confetti, XP gain popup, and streak update. **XP & levels** (Novice → Grandmaster, 11 levels up to 11,000 XP, plus once-only bonuses for section/path completion, reviews, and streak milestones) persist to `localStorage` and sync across devices via Firebase. Keyboard: `Esc` closes, `←/→` navigate lessons. Respects `prefers-reduced-motion`.
- **Spaced repetition** (`assets/js/review.js`) — SM-2-lite review scheduling (intervals 1 → 3 → 7 → 14 → 30 → 60 days, reset on a miss). A review section on the Learn page, a due-count nudge on the Dashboard, and review state that syncs across devices.
- **Mastery Engine** (`assets/js/mastery.js`) — a 0–100 mastery score per topic and per section, derived from your solves and reviews (quality frozen at solve time, so practising more never lowers it). Powers the **Next Up** card on Learn and Dashboard, a **~15-minute daily plan** (due reviews + weakest-topic exercise + one new lesson, +10 XP once a day for finishing it), mastery bars and 🍂 rusty badges on Dashboard/Profile, and an AI daily challenge led by your weakest topic.
- **Placement test** (`placement.html`) — a 3-minute, 10-question adaptive diagnostic that places you at the right section of the 7-section journey and unlocks everything before it, so you skip what you already know. Placement is a pointer, never progress: no XP, no lessons marked done. A wrong answer in the review gets an "✨ Explain why" AI explanation.
- **AI Interview Intelligence** (`interview.html`) — a full mock placement drive: optional resume intake (PDF/DOCX/TXT), 12 target roles, Technical → Project → Coding → HR rounds with adaptive AI follow-ups, a coding round with hidden tests run in Pyodide, and a scored report (overall + per-round + per-skill + per-question, rubric-based with evidence) plus an improvement roadmap mapped to real Skillzify lessons and paths. A finished interview can also set your placement. If the AI is unavailable the interview still completes with a deterministic local bank and honestly-labelled offline scoring. Interview AI calls draw only from the shared learner pool (no per-user daily cap). **Phase 2** adds voice mode (the interviewer reads questions aloud; answers can be spoken and edited before sending, via the browser's Web Speech API), company simulations for 9 recruiters (labelled simulations based on publicly available recruitment information), a deep Project Defense round, resume↔job-description matching with gap questions, descriptive communication analytics (answer length, filler words, voice speaking pace — never accent/emotion inference), mid-round adaptive difficulty, a recency-weighted readiness picture, and interview-to-interview comparison. **Phase 3** adds panel interviews (three interviewers in one sitting) and the Full Placement Drive — aptitude test first (18-question bank, locally scored), then technical, coding and HR rounds with a configurable pass mark that ends the drive on elimination, like a real drive. **Phase 4** adds group discussions with three simulated participants (only the candidate's contributions are scored) and opt-in institution sharing: a student can share an anonymised score summary (no name, answers or transcript) under an institution code, reversible at any time, with an aggregate-only institution dashboard (`sharedReports` collection; see `firestore.rules`).
- **Practice Mode** (`practice.html` + `assets/js/practice.js` + `assets/js/practice-data.js`) — **150 exercises** across 17 topics (variables, strings, collections, loops, functions, OOP, exceptions, DSA, recursion, sorting, trees & graphs, dynamic programming, data science, web, files, testing, async) in 3 formats: ✍️ write-code (hidden tests executed in Pyodide), 🔮 predict-output, 🐞 fix-the-bug. Features: per-test pass/fail results, **3-level progressive hints**, ⏱ timed mode with personal bests, 📅 daily challenge (deterministic by date) presented as a **Problem of the Day** card, difficulty pills on every exercise, 🔁 spaced-repetition review queue, solution walkthroughs, 🐍 pythonic-coach notes, your-code-vs-model **solution comparison**, and a **Socratic AI Tutor** (guides without revealing the answer). Solved exercises award XP into the shared system.
- **Learning Paths** (`paths.html`) — 6 guided sequences (Python Fundamentals, DSA with Python, Automation & Scripting, Data Analysis Basics, Interview Prep, Web Development with Python) mixing lessons and exercises with per-path progress bars. Enrolling in a path unlocks all of its lessons.
- **Projects** (`projects.html`) — 15 guided real-world builds (File Organizer, Weather API Client, Web Scraper, CSV Data Analyzer, and more) — each with milestones and starter code.
- **Code Studio** (`compiler.html`) — a complete IDE in the browser: **Monaco editor** (multi-file workspace saved locally and synced, Explorer/Samples/Snippets/Outline sidebar, live search, share links), real Python 3.11 via Pyodide (fetched and evaluated AMD-safely so it can never clash with Monaco's loader), an interactive terminal with `input()` support, clickable tracebacks and a Problems panel, packages (NumPy/pandas/matplotlib built in, more via micropip), a persistent AI chat sidebar, and **inline AI (Ctrl+I)** that proposes changes as an accept/reject diff — plus an **AI Fix** diff for errors. Editor themes include the new default **Midnight** (navy, matched to the site) alongside Dracula, Material, Nord, Monokai and Eclipse; the console panel hides/unhides (header ✕, status-bar toggle, Ctrl+`) and remembers your choice. Also:
  - Offline heuristic explainer covering 12 common Python error patterns
  - Backend AI via the Render API (developer's Gemini key) → visitor's own optional key → offline fallback
  - A "🆘 Stuck?" button that drafts your code and error into a community question
- **Flowchart Lab** (`flowchart.html`) — paste Python and get a precise AST-drawn flowchart (functions as sub-charts, static warnings), watch it play back with a living trace (steps, variables, branch highlighting), export it for lab records (PNG/SVG/lab sheet), and ask AI to explain it or check its logic
- **Skillzify Circle** (`community.html`) — the learner community: public profiles (verified progress), anchored Q&A (ask from a lesson, exercise, or error, with code attached; best answers earn XP), and a project showcase (share a build, star others, fork into the compiler). An "✨ Ask AI" button gives a Socratic hint on any question. A **Leaderboard** (`assets/js/leaderboard.js`) ranks the top 50 public profiles by XP — real Firestore `publicProfiles` data only, no placeholder people; your own row is highlighted (or pinned with your exact rank if you're outside the top 50).
- **Dashboard** (`dashboard.html`) — overall % ring, per-section progress bars, day streak 🔥, an **activity heatmap (your last 182 days)** whose day counts sync across devices like everything else, track rows for section progress, a personal **Your Rank** card (your leaderboard rank, XP, and the gap to the learner one rank above), recent run history, **Next Up** card (mastery-ranked), **~15-minute daily plan**, **exercise accuracy by topic with weak-spot flags**, today's challenge, review queue, and downloadable **section-completion certificates** (canvas-rendered PNG)
- **Profile** (`profile.html`) — identicon avatar, editable name/bio (syncs to Firebase), pinned items, **32 achievements** (with progress bars on locked badges), activity feed, and a shareable public profile (`profile.html?uid=`)
- **Python Reference** (`reference.html`) — quick-lookup reference with **127 entries**, each with parameters, return values, common pitfalls, a verified example output, and a link to the lesson that teaches it — plus an overview page, an inline "▶ Run here" runner, search, favourites, and recently viewed
- **Firebase Authentication** (`auth.html` + `assets/js/auth.js`) — real Email/Password auth on Firebase project `skillzify-1d0f2` (same as the Android app); one account works across devices; nav shows your name. Progress, exercises, paths, workspace, achievements and activity days sync through one Firestore document per user.
- **Admin + Site Controls** (`admin.html`) — an owner-only console (live AI usage, caps and model-chain configuration, 7-day history, community snapshot, tools, quick links) plus **Page controls**: a master switch and a per-page on/off toggle for all 18 content pages, each page with its own offline message. A switched-off page shows learners a designed "update on the way" screen (with links only to pages that are live) and auto-returns the moment it's switched back on; the admin always sees the real page with a warning banner. State lives in `siteConfig/state`, written only through the server; the client gate (`assets/js/site-gate.js`) fails open on any error, and admin/login/reset pages can never be switched off.
- **AI system** (`server.js` + `assets/js/ai.js`) — 19 AI modes behind one client: Socratic lesson tutor, adaptive drills, trace & narrate, context-aware error explainer, project review, build-my-path, mock viva, fresh quizzes, daily challenge, flowchart explain / logic-check, a plain explain mode, and the three interview modes (turn, scoring, resume). Daily caps (**10 answers signed-in, 5 anonymous**, a 10,000/day admin reserve and a shared 50,000/day learner pool, enforced per user in Firestore; interview modes skip the per-user cap and draw from the pool only), a **7-model Gemini/Gemma failover chain** (gemini-3.1-flash-lite → 3.5-flash-lite → 3.6-flash → 3.8-flash → 3-flash-preview → gemma-4-31b-it → gemma-4-26b-a4b-it) with a circuit breaker that benches quota-dead models, **Groq spillover** when the Gemini chain is exhausted, and optional multi-key rotation.
- **Android app** (`android/`) — native Kotlin + Jetpack Compose app mirroring the website: all 250 lessons, 150 exercises, the reference, projects, paths, cross-device sync, an interactive compiler terminal, Flowchart Lab, the smart systems (mastery, placement, passport, concept map) and AI via the same backend; built by GitHub Actions CI
- **Command palette** (`Ctrl/⌘+K`) — fuzzy search over pages, lessons, snippets, and actions
- **About / Contact** — contact form opens the visitor's email app pre-addressed to skillzifyind2024@gmail.com (mailto fallback)
- **Analytics** — Google Analytics 4 on all pages
- **Security** — `SECURITY.md` policy + private vulnerability reporting enabled
- **Quality** — full-site audit (Nov 2026): all 2 P0 and 31 P1 findings fixed and verified, with a **1,397-check automated audit harness** (`audit-harness.cjs`) plus dedicated suites for the compiler (133), the AI server (173) and client (57), exercise validation (150), flowchart (47 + 75), Site Controls server tests (22) and interview server tests (10), and live browser checks
- **Design system (redesign v2, Nov 2026)** — one token system in `style.css` for all 21 pages: midnight-navy base (`#070b1a` / card `#121a3a`), the indigo → purple → cyan brand gradient rationed to the logo, primary CTAs, progress bars and the activity heatmap, flat 1px borders instead of glow, Inter + JetBrains Mono, and shared components (subject strip, Problem of the Day card, difficulty pills, data tables, heatmap, track rows, leaderboard rows). Layout rules: within a section every card is the same size (equal-height rows, footer actions pinned), and long pages keep their context rails sticky. Every pattern in Skillzify's own voice: the subject strip, Problem of the Day, practice + heatmap treatment, tracks and leaderboard
- **Theming** — dark mode default, light mode derived from the same tokens, 6 accent themes (indigo, ocean, sunset, forest, amethyst, rose) × 2 modes, CSS variables throughout, responsive down to phones

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
> dashboard — pushing to GitHub does not auto-deploy. There are two services:
> **production** (`skillzify-v2`) and **staging** (`skillzify-v2-staging`);
> new work is verified on staging first, and production is only deployed
> deliberately. GitHub Pages serves the same repo's static files
> automatically on push.

> The compiler downloads the Pyodide runtime (~10 MB) from a CDN on first use, so an internet connection is needed the first time you press **Run**.

### 🤖 Backend (developer-side AI)

The AI features call the backend on the same origin (`/api/*`). The backend
lives in `server.js` and uses the **developer's** Gemini key from the
`GEMINI_API_KEY` environment variable — visitors never need their own key, and
the key never reaches the browser or the repo. It fails over across a 7-model
Gemini/Gemma chain (a circuit breaker benches models that hit quota), spills
over to Groq when the chain is exhausted (`GROQ_API_KEY`), and
`GEMINI_API_KEYS` (comma-separated) rotates across keys from multiple Google
Cloud projects for a larger daily budget. Per-user daily caps (10 signed-in /
5 anonymous) are enforced server-side in Firestore; the three interview
modes skip the per-user cap and draw from the shared 50,000/day learner
pool only (the admin reserve for the admin).

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
├── index.html          # Landing page (hero, journey, features, FAQ)
├── learn.html          # Learning journey: 7 sections, 250 lessons
├── lesson.html         # Single-lesson page (?id=)
├── placement.html      # 3-minute adaptive placement test
├── interview.html      # AI Interview Intelligence (mock placement drive)
├── practice.html       # Practice Mode (exercises + tests)
├── paths.html          # Guided learning paths (6)
├── projects.html       # Real-world guided projects (15)
├── compiler.html       # AI Python compiler + workspace
├── flowchart.html          # Flowchart Lab
├── community.html      # Skillzify Circle (community + leaderboard)
├── dashboard.html      # Progress dashboard + heatmap + Your Rank + certificates
├── profile.html        # Profile + public view
├── passport.html       # Skill Passport (certificates + shareable record)
├── map.html            # Concept map of the whole journey
├── reference.html      # Python reference (127 entries)
├── auth.html           # Login / Register (Firebase)
├── admin.html          # Admin console + Site Controls page switches (owner only)
├── reset-password.html # Password reset landing
├── about.html
├── contact.html
├── SECURITY.md         # Security policy
├── server.js           # Express backend: 19 AI modes, caps, 7-model failover + Groq, Site Controls API
├── render.yaml         # Render one-click deploy
├── assets/
│   ├── css/style.css   # Design-system tokens, shared components, layout, responsive
│   ├── css/flowchart.css # Flowchart Lab styles
│   ├── js/app.js       # Theme toggle, nav, toast, storage utils
│   ├── js/auth.js      # Firebase Authentication (Email/Password)
│   ├── js/learn-core.js    # Lesson catalog (250), sections, unlock chain, XP
│   ├── js/lessons-index.js # Lesson index (all 250, lightweight)
│   ├── js/lessons-sec-*.js # Per-section lesson chunks, loaded on demand (7 files)
│   ├── js/quiz-extra.js    # Extra quiz questions per lesson
│   ├── js/learn.js     # Learn page rendering (sections + review)
│   ├── js/mastery.js   # Mastery Engine (0–100 scores, Next Up, daily plan)
│   ├── js/placement.js # Placement test engine (adaptive diagnostic)
│   ├── js/placement-page.js # Placement test page
│   ├── js/lesson.js    # Single-lesson page + AI tutor
│   ├── js/review.js    # Spaced repetition (SM-2-lite)
│   ├── js/practice.js  # Practice engine: test runner, hints, timed mode
│   ├── js/practice-data.js # 150 validated exercises
│   ├── js/paths-data.js    # Learning path definitions (6 paths, 370 steps)
│   ├── js/paths.js     # Path rendering + enrollment
│   ├── js/projects-data.js # 15 guided projects
│   ├── js/compiler.js  # Code Studio: Monaco IDE, Pyodide runner, workspace, inline AI
│   ├── js/leaderboard.js # Leaderboard (community table + dashboard Your Rank)
│   ├── js/flowchart-app.js # Flowchart Lab: rendering, living trace, exports, AI
│   ├── js/flowchart_ast.py # AST-based Python → flowchart IR converter (runs in Pyodide)
│   ├── js/dashboard.js # Dashboard rendering + analytics + certificates
│   ├── js/profile.js   # Profile rendering (Firebase-synced name)
│   ├── js/community.js # Community API (Q&A, showcase, profiles)
│   ├── js/community-page.js # Community page rendering
│   ├── js/ai.js        # Single AI client (19 modes, caps, fallback)
│   ├── js/interview.js # AI Interview Intelligence engine (rounds, scoring, report)
│   ├── js/interview-bank.js # Interview question/coding bank + local fallback
│   ├── js/site-gate.js # Site Controls gate (offline screen for switched-off pages)
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
- [x] Mastery Engine: 0–100 mastery, Next Up card, daily plan
- [x] Placement test: adaptive diagnostic + unlock-before-placement
- [x] Achievements upgrade: 32 badges with progress bars
- [x] Multi-file compiler workspace
- [x] Code Studio 2.0: Monaco IDE, inline AI diffs, packages, share links
- [x] Unified redesign: one design system across all 21 pages
- [x] Leaderboard (community top-50 + dashboard Your Rank)
- [x] AI Interview Intelligence Phase 1: full mock drive with scored report + roadmap
- [x] Site Controls: per-page on/off switches with per-page offline messages
- [x] Activity-day sync: the dashboard heatmap now follows your account across devices
- [ ] Phase 2: 250 → 500 lessons (new Data Science, Web, ML/AI, Interview tracks)
- [ ] PWA support for offline lessons
- [ ] Community Phase 2: reviews, squads, helping economy

## 🔑 Notes on secrets

- The Firebase **web API key** in `assets/js/auth.js` and `android/app/google-services.json` is **public by design** (it ships in every web page and APK). Access is controlled by Firebase authorized domains and security rules, not the key.
- The developer's **Gemini API key** lives only in the `GEMINI_API_KEY` environment variable (Render dashboard / `.env`, gitignored) — never in the repo.
- The AI explainer's visitor key field is user-supplied and stored only in the browser.

---
© 2026 Skillzify · Learn. Build. Shine.
