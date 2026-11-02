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

  function onReady(cb) { if (ready) { try { cb(); } catch (e) {} } else readyCbs.push(cb); }

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
        // Cross-device sync: start Firestore sync once auth state is known.
        // Guarded — sync.js is a no-op if the SDK failed to load.
        try { if (window.SkillzifySync && window.SkillzifySync.init) window.SkillzifySync.init(); } catch (e) {}
        if (fbUser && /auth\.html$/.test(location.pathname)) location.href = "dashboard.html";
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
        window.Skillzify.esc(user.name.split(" ")[0]) +
        '</span> <button class="btn btn-sm btn-ghost" id="logout-btn">Logout</button>';
      var btn = document.getElementById("logout-btn");
      if (btn) btn.addEventListener("click", function () {
        logoutUser();
        window.Skillzify.toast("Logged out. See you soon!", "success");
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
      loginForm.style.display = which === "login" ? "block" : "none";
      regForm.style.display = which === "register" ? "block" : "none";
    }
    loginTab.addEventListener("click", function () { show("login"); });
    regTab.addEventListener("click", function () { show("register"); });

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
          window.Skillzify.toast("Welcome back, " + r.user.name.split(" ")[0] + "! \uD83C\uDF89", "success");
          setTimeout(function () { location.href = "dashboard.html"; }, 700);
        } else {
          window.Skillzify.toast(r.error, "error");
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
          window.Skillzify.toast("Account created — let's start learning! \uD83D\uDE80", "success");
          setTimeout(function () { location.href = "learn.html"; }, 700);
        } else {
          window.Skillzify.toast(r.error, "error");
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
    onReady: onReady,
    refreshAccountUI: refreshAccountUI,
    firebaseUser: function () { return fbUser; }
  };
})();
