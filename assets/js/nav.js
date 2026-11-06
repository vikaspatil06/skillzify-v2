/* ============================================================
   Skillzify v2 — nav.js
   SINGLE SOURCE OF TRUTH for the site navbar.
   Every page mounts <div id="site-nav"></div> and loads this file;
   the full navbar (brand, dropdowns, actions) is rendered from
   the NAV config below. Change it here once — it updates everywhere.
   Must load BEFORE app.js so app.js's initNav/theme wiring finds it.
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- The one nav config ---------------- */
  var NAV = [
    { label: "Home", href: "index.html" },
    { label: "Learn", children: [
      { label: "Lessons", href: "learn.html", icon: "📚" },
      { label: "Practice", href: "practice.html", icon: "✍️" },
      { label: "Learning Paths", href: "paths.html", icon: "🗺️" },
      { label: "Projects", href: "projects.html", icon: "🛠️" },
      { label: "Flowchart Lab", href: "flowchart.html", icon: "🔀" }
    ]},
    { label: "Code Studio", href: "compiler.html" },
    { label: "Reference", href: "reference.html" },
    { label: "Community", href: "community.html" },
    { label: "You", children: [
      { label: "Dashboard", href: "dashboard.html", icon: "📊" },
      { label: "Profile", href: "profile.html", icon: "👤" }
    ]},
    { label: "More", children: [
      { label: "About", href: "about.html", icon: "ℹ️" },
      { label: "Contact", href: "contact.html", icon: "✉️" }
    ]}
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function currentPage() {
    return (location.pathname.split("/").pop() || "index.html").toLowerCase();
  }

  function isActiveHref(href) {
    var h = String(href || "").toLowerCase();
    var p = currentPage();
    return h === p || (p === "" && h === "index.html");
  }

  /* ---------------- Build ---------------- */
  function buildNav() {
    var mount = document.getElementById("site-nav");
    if (!mount || mount.dataset.navBuilt) return;

    var linksHtml = NAV.map(function (item) {
      if (item.children) {
        var kids = item.children.map(function (k) {
          var act = isActiveHref(k.href) ? ' class="active"' : "";
          return '<a role="menuitem" href="' + esc(k.href) + '"' + act + ">" +
            (k.icon ? '<span class="mi">' + k.icon + "</span>" : "") + esc(k.label) + "</a>";
        }).join("");
        var parentActive = item.children.some(function (k) { return isActiveHref(k.href); });
        return '<div class="nav-drop">' +
          '<button type="button" class="nav-drop-btn' + (parentActive ? " active-parent" : "") + '"' +
          ' aria-haspopup="true" aria-expanded="false">' +
          esc(item.label) + ' <span class="caret">▾</span></button>' +
          '<div class="nav-menu" role="menu">' + kids + "</div></div>";
      }
      var act = isActiveHref(item.href) ? ' class="active"' : "";
      return '<a href="' + esc(item.href) + '"' + act + ">" + esc(item.label) + "</a>";
    }).join("");

    mount.innerHTML =
      '<nav class="nav"><div class="nav-inner">' +
      '<a class="brand" href="index.html"><img data-logo src="assets/logo-light.png" alt="Skillzify logo"><span>Skillzify</span></a>' +
      '<div class="nav-links" id="nav-links">' + linksHtml + "</div>" +
      '<div class="nav-actions">' +
      '<span id="ai-status-pill" class="ai-status-pill" role="status" aria-live="polite"></span>' +
      '<span id="account-link"></span>' +
      '<button class="icon-btn" data-theme-toggle aria-label="Toggle dark/light theme">☀️</button>' +
      '<button class="icon-btn hamburger" id="hamburger" aria-label="Open menu" aria-expanded="false">☰</button>' +
      "</div></div></nav>";
    mount.dataset.navBuilt = "1";

    wireDropdowns(mount);
    wireAiStatus(mount);
  }

  /* ---------------- AI status pill ----------------
     nav.js loads before ai.js on every page, so by the time
     buildNav runs (DOMContentLoaded, or synchronously once the
     DOM is ready) window.SkillzifyAI already exists when ai.js
     loaded. attachStatus paints the current status immediately
     and subscribes to live updates, so one call covers both.
     If ai.js failed to load, hide the pill — never crash, never
     show a stale label. */
  function wireAiStatus(mount) {
    var pill = mount.querySelector("#ai-status-pill");
    if (!pill) return;
    if (window.SkillzifyAI && typeof window.SkillzifyAI.attachStatus === "function") {
      window.SkillzifyAI.attachStatus(pill);
    } else {
      pill.style.display = "none";
    }
  }

  /* ---------------- Dropdown behaviour ----------------
     Desktop: click toggles (works for touch laptops too); hover
     opens via CSS. Mobile (menu open): tap expands in place.   */
  function closeAll(except) {
    document.querySelectorAll(".nav-drop.open").forEach(function (d) {
      if (d !== except) {
        d.classList.remove("open");
        var b = d.querySelector(".nav-drop-btn");
        if (b) b.setAttribute("aria-expanded", "false");
      }
    });
  }

  function wireDropdowns(mount) {
    mount.querySelectorAll(".nav-drop-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var drop = btn.closest(".nav-drop");
        var willOpen = !drop.classList.contains("open");
        closeAll(drop);
        drop.classList.toggle("open", willOpen);
        btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
    });
    // Clicking a menu link closes the mobile panel (desktop closes via CSS/app.js)
    mount.querySelectorAll(".nav-menu a").forEach(function (a) {
      a.addEventListener("click", function () {
        closeAll(null);
        var links = document.getElementById("nav-links");
        if (links) links.classList.remove("open");
      });
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest(".nav-drop")) closeAll(null);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        /* Return focus to the dropdown trigger that opened it (P2-44). */
        var openBtn = document.querySelector(".nav-drop.open .nav-drop-btn");
        closeAll(null);
        if (openBtn) openBtn.focus();
        return;
      }
      /* Arrow-key navigation inside an open dropdown (P2-44): move
         focus across its links, wrapping at the ends. */
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
      var active = document.activeElement;
      if (!active || !active.closest || !active.closest(".nav-drop")) return;
      var drop = active.closest(".nav-drop");
      if (!drop.classList.contains("open")) return;
      var links = Array.prototype.slice.call(drop.querySelectorAll(".nav-menu a"));
      if (!links.length) return;
      var i = links.indexOf(active);
      if (e.key === "ArrowDown") i = (i + 1) % links.length;
      else if (e.key === "ArrowUp") i = (i - 1 + links.length) % links.length;
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = links.length - 1;
      e.preventDefault();
      links[i].focus();
    });
  }

  /* Render synchronously if DOM is ready, else on DOMContentLoaded.
     app.js hooks DOMContentLoaded afterwards, so it always sees the nav. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildNav);
  } else {
    buildNav();
  }
})();
