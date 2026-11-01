# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| v2.x (website, `main` branch) | ✅ Actively supported |
| Android app (`android/`, latest release) | ✅ Actively supported |
| Older releases | ❌ Please upgrade to the latest |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report them privately:

- **Email:** skillzifyind2024@gmail.com
- **Subject:** `[SECURITY] skillzify-v2 — <short description>`

Include:
1. A description of the vulnerability and its potential impact
2. Steps to reproduce (or a proof of concept)
3. The affected component (website, Android app, backend proxy) and version/commit

### What to expect

- **Acknowledgement** within 72 hours
- **Assessment & fix timeline** communicated after triage
- Credit in the release notes if you'd like it (just say so)

## Scope

In scope:
- `index.html`, `learn.html`, `compiler.html`, `dashboard.html`, `profile.html`, `reference.html`, `auth.html` and all assets under `assets/`
- The Android app under `android/` (Kotlin/Jetpack Compose, Chaquopy runtime, Firebase Authentication)
- The optional backend proxy `server.js` (Express `/api/explain` endpoint)

Out of scope:
- Third-party CDNs and libraries (report upstream, but a heads-up is still welcome)
- Social-engineering or physical attacks

## Security Notes for Contributors

- **Never commit secrets.** API keys, Firebase private keys, and service-account files must not enter the repo. The backend reads `GEMINI_API_KEY` from the environment (see `.env.example`); `.env` is gitignored.
- `android/app/google-services.json` is intentionally committed — its API key is public-by-design (it ships inside every APK) and is restricted to the app's package ID and Firebase project. Do not add unrestricted keys there.
- The website authenticates against `localStorage` demo auth; the Android app uses real Firebase Authentication (Email/Password). Treat the two auth models as separate trust boundaries.
- Dependencies (npm, Gradle) should be kept reasonably current; PRs bumping versions for security fixes are welcome.
