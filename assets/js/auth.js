/* ============================================================
   Skillzify v2 — auth.js (DEMO AUTH)
   ----------------------------------------------------------------
   This is a LOCAL demo authentication layer that stores users in
   the browser's localStorage. It is intentionally simple so the
   site works with zero backend (file:// or any static server).

   >>> TO PLUG IN REAL FIREBASE AUTH <<<
   1. Create a Firebase project and enable Email/Password auth.
   2. Replace the functions below (registerUser, loginUser,
      logoutUser, currentUser) with Firebase Auth calls, e.g.:

        import { initializeApp } from
          "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
        import { getAuth, createUserWithEmailAndPassword,
                 signInWithEmailAndPassword, signOut,
                 onAuthStateChanged } from
          "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

        const firebaseConfig = {
          apiKey: "<YOUR_API_KEY>",        // <-- paste your key here
          authDomain: "<YOUR_AUTH_DOMAIN>",
          projectId: "<YOUR_PROJECT_ID>",
          // ... rest of your Firebase config
        };
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);

      NEVER commit real API keys to a public repo.
   ============================================================ */
(function () {
  "use strict";

  var USERS_KEY = "skillzify_users";
  var SESSION_KEY = "skillzify_session";

  function getUsers() {
    return window.Skillzify.storeGet(USERS_KEY, {});
  }
  function saveUsers(u) {
    window.Skillzify.storeSet(USERS_KEY, u);
  }

  // Lightweight obfuscation only — NOT real password hashing.
  // For production, use Firebase Auth or a real backend.
  function obfuscate(s) {
    return btoa(unescape(encodeURIComponent("sz$" + s)));
  }

  function validEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  function registerUser(name, email, password) {
    name = (name || "").trim();
    email = (email || "").trim().toLowerCase();
    if (!name) return { ok: false, error: "Please enter your name." };
    if (!validEmail(email)) return { ok: false, error: "Please enter a valid email address." };
    if (!password || password.length < 6)
      return { ok: false, error: "Password must be at least 6 characters." };
    var users = getUsers();
    if (users[email]) return { ok: false, error: "An account with this email already exists. Try logging in." };
    users[email] = { name: name, email: email, pass: obfuscate(password), created: Date.now() };
    saveUsers(users);
    window.Skillzify.storeSet(SESSION_KEY, email);
    return { ok: true, user: { name: name, email: email } };
  }

  function loginUser(email, password) {
    email = (email || "").trim().toLowerCase();
    var users = getUsers();
    var u = users[email];
    if (!u || u.pass !== obfuscate(password || ""))
      return { ok: false, error: "Invalid email or password." };
    window.Skillzify.storeSet(SESSION_KEY, email);
    return { ok: true, user: { name: u.name, email: u.email } };
  }

  function logoutUser() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function currentUser() {
    var email = window.Skillzify.storeGet(SESSION_KEY, null);
    if (!email) return null;
    var u = getUsers()[email];
    return u ? { name: u.name, email: u.email } : null;
  }

  /* ---------- Nav account area ---------- */
  function refreshAccountUI() {
    var slot = document.getElementById("account-link");
    if (!slot) return;
    var user = currentUser();
    if (user) {
      slot.innerHTML =
        '<span style="font-weight:700;font-size:.9rem">👋 ' +
        window.Skillzify.esc(user.name.split(" ")[0]) +
        '</span> <button class="btn btn-sm btn-ghost" id="logout-btn">Logout</button>';
      var btn = document.getElementById("logout-btn");
      if (btn) btn.addEventListener("click", function () {
        logoutUser();
        window.Skillzify.toast("Logged out. See you soon!", "success");
        refreshAccountUI();
        if (location.pathname.indexOf("dashboard") !== -1) location.href = "index.html";
      });
    } else {
      slot.innerHTML = '<a href="auth.html" class="btn btn-sm">Login</a>';
    }
  }

  /* ---------- Auth page wiring ---------- */
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

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var r = loginUser(
        document.getElementById("login-email").value,
        document.getElementById("login-pass").value
      );
      if (r.ok) {
        window.Skillzify.toast("Welcome back, " + r.user.name.split(" ")[0] + "! 🎉", "success");
        setTimeout(function () { location.href = "dashboard.html"; }, 700);
      } else {
        window.Skillzify.toast(r.error, "error");
      }
    });

    regForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var r = registerUser(
        document.getElementById("reg-name").value,
        document.getElementById("reg-email").value,
        document.getElementById("reg-pass").value
      );
      if (r.ok) {
        window.Skillzify.toast("Account created — let's start learning! 🚀", "success");
        setTimeout(function () { location.href = "learn.html"; }, 700);
      } else {
        window.Skillzify.toast(r.error, "error");
      }
    });

    if (currentUser()) location.href = "dashboard.html";
  }

  document.addEventListener("DOMContentLoaded", function () {
    refreshAccountUI();
    initAuthPage();
  });

  window.SkillzifyAuth = {
    registerUser: registerUser,
    loginUser: loginUser,
    logoutUser: logoutUser,
    currentUser: currentUser
  };
})();
