/* ============================================================
   Skillzify v2 — app.js
   Theme toggle · mobile nav · toast · shared utilities
   ============================================================ */
(function () {
  "use strict";

  var THEME_KEY = "skillzify_theme";

  /* ---------- Theme ---------- */
  function logoFor(theme) {
    return theme === "light" ? "assets/logo-dark.png" : "assets/logo-light.png";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    document.querySelectorAll('img[data-logo]').forEach(function (img) {
      img.src = logoFor(theme);
    });
    var btns = document.querySelectorAll("[data-theme-toggle]");
    btns.forEach(function (b) { b.textContent = theme === "light" ? "🌙" : "☀️"; });
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(saved === "light" ? "light" : "dark"); // dark mode default
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
        applyTheme(cur === "light" ? "dark" : "light");
      });
    });
  }

  /* ---------- Mobile nav ---------- */
  function initNav() {
    var burger = document.getElementById("hamburger");
    var links = document.getElementById("nav-links");
    if (burger && links) {
      burger.addEventListener("click", function () { links.classList.toggle("open"); });
      links.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { links.classList.remove("open"); });
      });
    }
    // Active link highlighting
    var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll("#nav-links a").forEach(function (a) {
      var href = (a.getAttribute("href") || "").toLowerCase();
      if (href === page || (page === "" && href === "index.html")) a.classList.add("active");
    });
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg, type) {
    var el = document.getElementById("toast");
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.className = "toast show " + (type || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, 3200);
  }

  /* ---------- Storage helpers ---------- */
  function storeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function storeSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ---------- Misc ---------- */
  function setYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initNav();
    setYear();
  });

  // Public API
  window.Skillzify = window.Skillzify || {};
  window.Skillzify.toast = toast;
  window.Skillzify.storeGet = storeGet;
  window.Skillzify.storeSet = storeSet;
  window.Skillzify.esc = esc;
})();
