# Skillzify v2 — Learn. Build. Shine. 🌟

An advanced, browser-first Python learning platform for students — rebuilt from scratch as a modern multi-page static site. No build step, no backend required.

## ✨ Features

- **Landing page** (`index.html`) — hero, feature cards, animated stats, testimonials, dark/light theme toggle
- **Python learning path** (`learn.html`) — 16 lessons across Beginner / Intermediate / Advanced rendered as a Duolingo-style visual journey: lesson nodes on a winding animated SVG path (locked 🔒 / current ✨ / completed ✓), sequential unlocking (lesson N+1 unlocks after N; tracks unlock in order with locked-track teasers). Each lesson opens in a slide-over panel with rich explanation, key takeaways, syntax-highlighted code (Copy + "Try in compiler" handoff via `localStorage`), a 2-question multiple-choice quiz with instant feedback, and a mini coding challenge (predict-the-output or fill-the-blank). Completing both triggers confetti, an XP gain popup, and streak update. **XP & levels** (Novice → Python Master) persist to `localStorage`; progress stays in `skillzify_progress` so the dashboard keeps working. Keyboard: `Esc` closes, `←/→` navigate lessons. Respects `prefers-reduced-motion`.
- **AI Compiler** (`compiler.html`) — real Python 3.11 via Pyodide (CDN), CodeMirror editor, run timing, console output, `input()` support via a program-input box, sample snippets, and an **AI Explain** panel:
  - Offline heuristic explainer covering 12 common Python error patterns
  - Optional OpenAI-compatible API key (stored in `localStorage` only, never hardcoded) for deeper explanations
- **Dashboard** (`dashboard.html`) — overall % ring, per-track bars, day streak 🔥, recent run history, next-lesson hint
- **Demo auth** (`auth.html` + `assets/js/auth.js`) — register/login/logout with `localStorage`; a clearly-marked comment shows where to plug in real Firebase config (no keys shipped)
- **About / Contact** — contact form saves to `localStorage` with a success toast
- **Theming** — dark mode default, CSS variables, responsive down to phones

## 🚀 How to run

No build step. Any of these work:

```bash
# Option 1: Python's built-in server (recommended)
cd skillzify-v2
python3 -m http.server 8080
# then open http://localhost:8080

# Option 2: Node
npx serve .

# Option 3: just double-click index.html
# (works, but the compiler's CDN scripts prefer http://localhost)
```

> The compiler downloads the Pyodide runtime (~10 MB) from a CDN on first use, so an internet connection is needed the first time you press **Run**.

## 📁 Project structure

```
skillzify-v2/
├── index.html          # Landing page
├── learn.html          # Learning tracks + lessons
├── compiler.html       # AI Python compiler
├── dashboard.html      # Progress dashboard
├── auth.html           # Login / Register (demo)
├── about.html
├── contact.html
├── assets/
│   ├── css/style.css   # Theme variables, layout, responsive
│   ├── js/app.js       # Theme toggle, nav, toast, storage utils
│   ├── js/auth.js      # Demo auth (localStorage) + Firebase notes
│   ├── js/learn.js     # Lesson catalog + progress
│   ├── js/compiler.js  # Pyodide runner + AI explainer
│   ├── js/dashboard.js # Dashboard rendering
│   ├── logo-dark.png   # Logo for light backgrounds
│   └── logo-light.png  # Logo for dark backgrounds
└── README.md
```

## 🗺️ Roadmap

- [x] Quiz mode per lesson with XP scoring
- [x] Progressive unlocking + visual learning path
- [ ] More tracks: JavaScript, DSA in Python
- [ ] Shareable code snippets (URL-encoded)
- [ ] PWA support for offline lessons
- [ ] Real Firebase Auth + Firestore sync (see `assets/js/auth.js`)
- [ ] Multi-file projects in the compiler

## 🔑 Notes on secrets

- No API keys are shipped in this project. The AI explainer's API key field is user-supplied and stored only in the browser.
- The old Skillzify Firebase keys were intentionally **not** carried over. To enable real auth, follow the commented guide at the top of `assets/js/auth.js`.

---
© 2026 Skillzify · Learn. Build. Shine.
