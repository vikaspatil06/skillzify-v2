# Skillzify v2 — Learn. Build. Shine. 🌟

An advanced, browser-first Python learning platform for students — rebuilt from scratch as a modern multi-page static site. No build step, no backend required.

## ✨ Features

- **Landing page** (`index.html`) — hero, feature cards, animated stats, testimonials, dark/light theme toggle
- **Python learning tracks** (`learn.html`) — 13 lessons across Beginner / Intermediate / Advanced, each with explanation, copyable code example, and "Try in compiler" handoff; progress checkboxes persist to `localStorage` with progress bars
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

- [ ] Quiz mode per lesson with XP scoring
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
