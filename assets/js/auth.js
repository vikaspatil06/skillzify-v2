/* ============================================================
   Skillzify v2 — auth.js (Firebase Authentication)
   Project: skillzify-1d0f2 (same Firebase project as the
   Android app). Email/Password sign-in.

   The Firebase web API key below is PUBLIC BY DESIGN — it also
   ships inside android/app/google-services.json in this public
   repo. Access is controlled by Firebase authorized domains,
   not by the key. Never put private keys here.
   ============================================================ */
(function () {
  "use strict";

  var firebaseConfig = {
    apiKey: "AIzaSyBHqH96tS4MpeCVKy8HcnQAzIKMSehJx-U",
    authDomain: "skillzify-1d0f2.firebaseapp.com",
    projectId: "skillzify-1d0f2",
    storageBucket: "skillzify-1d0f2.firebasestorage.app",
    messagingSenderId: "221538535243"
  };

  var auth = null, fbUser = null, ready = false;
  var readyCbs = [];
  var authChangeCbs = [];

  /* Local safe wrappers for the app.js helpers (P2-34): if app.js
     failed to load, window.Skillzify is undefined and a bare
     dereference in refreshAccountUI would throw before the login /
     register wiring runs. These fall back instead of throwing. */
  function esc(s) {
    try { if (window.Skillzify && typeof window.Skillzify.esc === "function") return window.Skillzify.esc(s); } catch (e) {}
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; });
  }
  function toast(m, t) {
    try { if (window.Skillzify && typeof window.Skillzify.toast === "function") window.Skillzify.toast(m, t); } catch (e) {}
  }

  function onReady(cb) { if (ready) { try { cb(); } catch (e) {} } else readyCbs.push(cb); }

  // M3: subscribe to auth-state changes. The callback receives the
  // current user (or null) — immediately if auth is already ready,
  // otherwise on first ready — and again on EVERY later sign-in or
  // sign-out. Safe when Firebase failed to load: ready is true and
  // the user is null, so subscribers get cb(null) at once.
  function onAuthChange(cb) {
    if (typeof cb !== "function") return;
    authChangeCbs.push(cb);
    if (ready) { try { cb(currentUser()); } catch (e) {} }
  }
  function notifyAuthChange() {
    var u = currentUser();
    authChangeCbs.slice().forEach(function (cb) { try { cb(u); } catch (e) {} });
  }

  try {
    if (window.firebase) {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      auth.onAuthStateChanged(function (u) {
        fbUser = u || null;
        if (!ready) {
          ready = true;
          var cbs = readyCbs; readyCbs = [];
          cbs.forEach(function (cb) { try { cb(); } catch (e) {} });
        }
        refreshAccountUI();
        notifyAuthChange();
        // Cross-device sync: start Firestore sync once auth state is known.
        // Guarded — sync.js is a no-op if the SDK failed to load.
        try { if (window.SkillzifySync && window.SkillzifySync.init) window.SkillzifySync.init(); } catch (e) {}
        if (fbUser && /auth\.html$/.test(location.pathname)) location.href = nextTarget() || "dashboard.html";
      });
    } else { ready = true; }
  } catch (e) { ready = true; }

  function toUser(u) {
    if (!u) return null;
    return {
      uid: u.uid,
      email: u.email || "",
      name: u.displayName || (u.email ? u.email.split("@")[0] : "Learner"),
      created: (u.metadata && u.metadata.creationTime) ? new Date(u.metadata.creationTime).getTime() : null
    };
  }

  function currentUser() { return toUser(fbUser); }

  // The signed-in user's Firebase ID token ("" when signed out).
  // ai.js sends it with every backend call; the server verifies it
  // and takes uid/email from the TOKEN, not from anything the page
  // claims — that's what makes the daily caps and the admin role
  // real instead of client-asserted. The SDK caches the token and
  // refreshes it automatically, so calling this per request is cheap.
  function idToken() {
    return new Promise(function (resolve) {
      try {
        if (!fbUser || typeof fbUser.getIdToken !== "function") { resolve(""); return; }
        fbUser.getIdToken().then(function (t) { resolve(t || ""); }, function () { resolve(""); });
      } catch (e) { resolve(""); }
    });
  }

  function friendly(err) {
    var code = (err && err.code) || "";
    var map = {
      "auth/email-already-in-use": "An account with this email already exists. Try logging in.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/user-not-found": "No account found with this email. Try registering.",
      "auth/wrong-password": "Incorrect password. Try again.",
      "auth/invalid-credential": "Invalid email or password.",
      "auth/too-many-requests": "Too many attempts — please wait a bit and try again.",
      "auth/network-request-failed": "Network error. Check your connection and try again.",
      "auth/operation-not-allowed": "Email/password sign-in is not enabled yet.",
      "auth/unauthorized-domain": "This site is not authorized for sign-in yet."
    };
    return map[code] || "Something went wrong. Please try again.";
  }

  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || ""); }

  /* Pending-auth return target: a validated ?next= so a user who signs
     in mid-action lands back where they were. Same-site page only —
     a relative *.html path with an optional safe query string. Anything
     else returns null (never an open redirect). */
  function nextTarget() {
    var raw = "";
    try {
      var m = /[?&]next=([^&]*)/.exec(location.search || "");
      raw = m ? decodeURIComponent(m[1]) : "";
    } catch (e) { return null; }
    if (!raw) return null;
    if (/[\s\x00-\x1f\\]/.test(raw)) return null;
    if (raw.indexOf("..") >= 0) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return null;
    if (raw.indexOf("//") === 0 || raw.charAt(0) === "/") return null;
    var parts = raw.split("?");
    if (parts.length > 2) return null;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.html$/.test(parts[0])) return null;
    if (parts[1] !== undefined && /[<>"]/.test(parts[1])) return null;
    return raw;
  }

  function registerUser(name, email, password) {
    name = (name || "").trim();
    email = (email || "").trim().toLowerCase();
    if (!name) return Promise.resolve({ ok: false, error: "Please enter your name." });
    if (!validEmail(email)) return Promise.resolve({ ok: false, error: "Please enter a valid email address." });
    if (!password || password.length < 6)
      return Promise.resolve({ ok: false, error: "Password must be at least 6 characters." });
    if (!auth) return Promise.resolve({ ok: false, error: "Sign-in service unavailable. Check your connection." });
    return auth.createUserWithEmailAndPassword(email, password).then(function (cred) {
      return cred.user.updateProfile({ displayName: name }).catch(function () {});
    }).then(function () {
      fbUser = auth.currentUser;
      return { ok: true, user: toUser(fbUser) };
    }).catch(function (err) { return { ok: false, error: friendly(err) }; });
  }

  function loginUser(email, password) {
    email = (email || "").trim().toLowerCase();
    if (!validEmail(email)) return Promise.resolve({ ok: false, error: "Please enter a valid email address." });
    if (!password) return Promise.resolve({ ok: false, error: "Please enter your password." });
    if (!auth) return Promise.resolve({ ok: false, error: "Sign-in service unavailable. Check your connection." });
    return auth.signInWithEmailAndPassword(email, password || "").then(function () {
      fbUser = auth.currentUser;
      return { ok: true, user: toUser(fbUser) };
    }).catch(function (err) { return { ok: false, error: friendly(err) }; });
  }

  function logoutUser() {
    // Push pending progress to the cloud, then wipe local user data so the
    // next visitor sees a clean slate. Sign out happens after the push.
    function doSignOut() {
      if (auth) { try { auth.signOut(); } catch (e) {} }
      fbUser = null;
      refreshAccountUI();
      // Land on home with a clean slate (progress is wiped; cloud copy is safe).
      try {
        if (!/auth\.html$/.test(location.pathname)) location.href = "index.html";
      } catch (e) {}
    }
    try {
      if (window.SkillzifySync && window.SkillzifySync.handleLogout) {
        window.SkillzifySync.handleLogout().then(doSignOut).catch(doSignOut);
        return;
      }
    } catch (e) {}
    doSignOut();
  }

  /* ---------- Nav account area (UI unchanged) ---------- */
  function refreshAccountUI() {
    var slot = document.getElementById("account-link");
    if (!slot) return;
    var user = currentUser();
    if (user) {
      slot.innerHTML =
        '<span style="font-weight:700;font-size:.9rem">\uD83D\uDC4B ' +
        esc(user.name.split(" ")[0]) +
        '</span> <button class="btn btn-sm btn-ghost" id="logout-btn">Logout</button>';
      var btn = document.getElementById("logout-btn");
      if (btn) btn.addEventListener("click", function () {
        logoutUser();
        toast("Logged out. See you soon!", "success");
        if (location.pathname.indexOf("dashboard") !== -1) location.href = "index.html";
      });
    } else {
      slot.innerHTML = '<a href="auth.html" class="btn btn-sm">Login</a>';
    }
  }

  /* ---------- Auth page wiring (UI unchanged) ---------- */
  function initAuthPage() {
    var loginTab = document.getElementById("tab-login");
    var regTab = document.getElementById("tab-register");
    var loginForm = document.getElementById("login-form");
    var regForm = document.getElementById("register-form");
    if (!loginTab) return;

    function show(which) {
      loginTab.classList.toggle("active", which === "login");
      regTab.classList.toggle("active", which === "register");
      loginTab.setAttribute("aria-selected", which === "login" ? "true" : "false");
      regTab.setAttribute("aria-selected", which === "register" ? "true" : "false");
      loginForm.style.display = which === "login" ? "block" : "none";
      regForm.style.display = which === "register" ? "block" : "none";
    }
    loginTab.addEventListener("click", function () { show("login"); });
    regTab.addEventListener("click", function () { show("register"); });

    /* P2-66: ARIA tabs keyboard pattern — ArrowLeft/ArrowRight move
       between the tabs (wrapping), Home/End jump to the first/last.
       Moving focus also switches the visible form, like a click. */
    [loginTab, regTab].forEach(function (tab, i) {
      tab.addEventListener("keydown", function (e) {
        var tabs = [loginTab, regTab];
        var next = -1;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        else return;
        e.preventDefault();
        show(next === 0 ? "login" : "register");
        tabs[next].focus();
      });
    });

    function setBusy(form, busy) {
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = busy; btn.style.opacity = busy ? ".6" : ""; }
    }

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      setBusy(loginForm, true);
      loginUser(
        document.getElementById("login-email").value,
        document.getElementById("login-pass").value
      ).then(function (r) {
        setBusy(loginForm, false);
        if (r.ok) {
          toast("Welcome back, " + r.user.name.split(" ")[0] + "! \uD83C\uDF89", "success");
          setTimeout(function () { location.href = nextTarget() || "dashboard.html"; }, 700);
        } else {
          toast(r.error, "error");
        }
      });
    });

    regForm.addEventListener("submit", function (e) {
      e.preventDefault();
      setBusy(regForm, true);
      registerUser(
        document.getElementById("reg-name").value,
        document.getElementById("reg-email").value,
        document.getElementById("reg-pass").value
      ).then(function (r) {
        setBusy(regForm, false);
        if (r.ok) {
          toast("Account created — let's start learning! \uD83D\uDE80", "success");
          setTimeout(function () { location.href = nextTarget() || "learn.html"; }, 700);
        } else {
          toast(r.error, "error");
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    refreshAccountUI();
    initAuthPage();
  });

  window.SkillzifyAuth = {
    registerUser: registerUser,
    loginUser: loginUser,
    logoutUser: logoutUser,
    currentUser: currentUser,
    idToken: idToken,
    onReady: onReady,
    onAuthChange: onAuthChange,
    refreshAccountUI: refreshAccountUI,
    nextTarget: nextTarget,
    firebaseUser: function () { return fbUser; }
  };
})();
