/* ============================================================
   Skillzify v2 — app.js
   Theme toggle · mobile nav · toast · shared utilities
   ============================================================ */
(function () {
  "use strict";

  var THEME_KEY = "skillzify_theme";
  var ACCENT_KEY = "skillzify_accent";

  var ACCENTS = [
    { id: "indigo",   name: "Indigo",   c1: "#6c7bff", c2: "#9d6bff" },
    { id: "ocean",    name: "Ocean",    c1: "#22d3ee", c2: "#38bdf8" },
    { id: "sunset",   name: "Sunset",   c1: "#fb923c", c2: "#f472b6" },
    { id: "forest",   name: "Forest",   c1: "#34d399", c2: "#22d3ee" },
    { id: "amethyst", name: "Amethyst", c1: "#9d6bff", c2: "#e879f9" },
    { id: "rose",     name: "Rose",     c1: "#fb7185", c2: "#f472b6" }
  ];

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
    document.querySelectorAll(".mode-btn").forEach(function (b) {
      b.classList.toggle("selected", b.dataset.mode === theme);
    });
  }

  function applyAccent(accent) {
    if (accent === "indigo") document.documentElement.removeAttribute("data-accent");
    else document.documentElement.setAttribute("data-accent", accent);
    try { localStorage.setItem(ACCENT_KEY, accent); } catch (e) {}
    document.querySelectorAll(".swatch").forEach(function (s) {
      s.classList.toggle("selected", s.dataset.accent === accent);
    });
  }

  function buildPicker() {
    // Inject a palette button + dropdown next to the theme toggle
    var toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle || document.querySelector(".theme-picker-wrap")) return;
    var wrap = document.createElement("span");
    wrap.className = "theme-picker-wrap";
    var btn = document.createElement("button");
    btn.className = "icon-btn";
    btn.setAttribute("aria-label", "Choose color theme");
    btn.textContent = "🎨";
    var drop = document.createElement("div");
    drop.className = "theme-picker";
    drop.innerHTML =
      "<h4>Mode</h4><div class='mode-row'>" +
        "<button class='mode-btn' data-mode='dark'>🌙 Dark</button>" +
        "<button class='mode-btn' data-mode='light'>☀️ Light</button>" +
      "</div><h4>Accent</h4><div class='swatch-row'>" +
      ACCENTS.map(function (a) {
        return "<button class='swatch' data-accent='" + a.id + "' title='" + a.name + "'" +
          " style='background:linear-gradient(135deg," + a.c1 + " 0%," + a.c2 + " 100%)'" +
          " aria-label='" + a.name + " accent'></button>";
      }).join("") + "</div>";
    wrap.appendChild(btn);
    wrap.appendChild(drop);
    toggle.parentNode.insertBefore(wrap, toggle.nextSibling);

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      drop.classList.toggle("open");
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) drop.classList.remove("open");
    });
    drop.querySelectorAll(".mode-btn").forEach(function (b) {
      b.addEventListener("click", function () { applyTheme(b.dataset.mode); });
    });
    drop.querySelectorAll(".swatch").forEach(function (s) {
      s.addEventListener("click", function () { applyAccent(s.dataset.accent); });
    });
  }

  function initTheme() {
    var saved = null, accent = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
      accent = localStorage.getItem(ACCENT_KEY);
    } catch (e) {}
    buildPicker();
    applyTheme(saved === "light" ? "light" : "dark"); // dark mode default
    applyAccent(accent || "indigo");
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
      burger.addEventListener("click", function () {
        var open = links.classList.toggle("open");
        burger.setAttribute("aria-expanded", open ? "true" : "false");
        burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      });
      links.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          links.classList.remove("open");
          burger.setAttribute("aria-expanded", "false");
          burger.setAttribute("aria-label", "Open menu");
        });
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

  // Collapsible cards: <div class="dash-card collapsible" id="x" data-collapsed="1">
  // with a <button class="coll-head">. State persists per card id in localStorage.
  function initCollapsibles() {
    document.querySelectorAll(".collapsible").forEach(function (card) {
      var key = "skillzify_coll_" + (card.id || "noid");
      var stored = storeGet(key, null);
      var collapsed = stored !== null ? stored === "1"
                                      : card.getAttribute("data-collapsed") === "1";
      var head = card.querySelector(".coll-head");
      function apply() {
        card.classList.toggle("open", !collapsed);
        if (head) head.setAttribute("aria-expanded", collapsed ? "false" : "true");
      }
      apply();
      if (head) head.addEventListener("click", function () {
        collapsed = !collapsed;
        storeSet(key, collapsed ? "1" : "0");
        apply();
      });
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
    initCollapsibles();
  });

  // Public API
  window.Skillzify = window.Skillzify || {};
  window.Skillzify.toast = toast;
  window.Skillzify.storeGet = storeGet;
  window.Skillzify.storeSet = storeSet;
  window.Skillzify.esc = esc;
})();
