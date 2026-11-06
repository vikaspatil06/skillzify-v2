/* Skillzify Command Palette — GitHub-style Cmd+K / Ctrl+K quick navigation */
(function () {
  "use strict";

  var PAGES = [
    { icon: "🏠", title: "Home", kind: "page", href: "index.html" },
    { icon: "📚", title: "Learn", kind: "page", href: "learn.html" },
    { icon: "▶️", title: "Compiler", kind: "page", href: "compiler.html" },
    { icon: "📖", title: "Python Reference", kind: "page", href: "reference.html" },
    { icon: "📊", title: "Dashboard", kind: "page", href: "dashboard.html" },
    { icon: "👤", title: "Profile", kind: "page", href: "profile.html" },
    { icon: "ℹ️", title: "About", kind: "page", href: "about.html" },
    { icon: "✉️", title: "Contact", kind: "page", href: "contact.html" }
  ];
  var ACTIONS = [
    { icon: "▶️", title: "Run code in compiler", kind: "action", run: function () { location.href = "compiler.html"; } },
    { icon: "📚", title: "Continue learning", kind: "action", run: function () {
        var L = window.SkillzifyLearn;
        if (L && L.nextLesson) { var n = L.nextLesson(); location.href = "learn.html" + (n ? "#lesson-" + n.id : ""); }
        else location.href = "learn.html";
      } },
    { icon: "🌙", title: "Toggle dark / light theme", kind: "action", run: function () {
        var b = document.querySelector("[data-theme-toggle]"); if (b) b.click();
      } },
    { icon: "📖", title: "Browse Python reference", kind: "action", run: function () { location.href = "reference.html"; } }
  ];

  function allItems() {
    var items = PAGES.slice().concat(ACTIONS);
    try {
      /* Lesson pages load learn-core.js but not learn.js, so fall back
         to the core catalog or the palette shows no lessons (P2-11). */
      var L = window.SkillzifyLearn || window.SkillzifyLearnCore;
      if (L && L.LESSONS) L.LESSONS.forEach(function (l) {
        items.push({ icon: "📚", title: l.title, kind: "lesson", sub: l.track, run: function () { location.href = "learn.html#lesson-" + l.id; } });
      });
    } catch (e) {}
    try {
      var A = window.SkillzifyActivity;
      if (A) A.snippets().forEach(function (s) {
        items.push({ icon: "📝", title: s.title, kind: "snippet", run: function () { location.href = "compiler.html#snippet-" + s.id; } });
      });
    } catch (e) {}
    return items;
  }

  function fuzzy(q, text) {
    q = q.toLowerCase(); text = text.toLowerCase();
    var qi = 0;
    for (var i = 0; i < text.length && qi < q.length; i++) if (text[i] === q[qi]) qi++;
    return qi === q.length;
  }

  var backdrop = null, input = null, list = null, current = [];

  function open() {
    if (backdrop) return;
    backdrop = document.createElement("div");
    backdrop.className = "palette-backdrop";
    backdrop.innerHTML = '<div class="palette" role="dialog" aria-label="Command palette">' +
      '<input id="palette-input" placeholder="Type a command or search lessons…" autocomplete="off">' +
      '<div class="palette-list" id="palette-list"></div></div>';
    document.body.appendChild(backdrop);
    input = backdrop.querySelector("#palette-input");
    list = backdrop.querySelector("#palette-list");
    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      var items = list.querySelectorAll(".palette-item");
      var active = list.querySelector(".palette-item.active");
      var idx = Array.prototype.indexOf.call(items, active);
      if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); setActive(items, idx); }
      else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(idx - 1, 0); setActive(items, idx); }
      else if (e.key === "Enter") { e.preventDefault(); if (active) active.click(); else if (items[0]) items[0].click(); }
      else if (e.key === "Escape") close();
    });
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
    render();
    setTimeout(function () { input.focus(); }, 30);
  }
  function setActive(items, idx) {
    Array.prototype.forEach.call(items, function (it, i) { it.classList.toggle("active", i === idx); });
    if (items[idx]) items[idx].scrollIntoView({ block: "nearest" });
  }
  function render() {
    var q = input.value.trim();
    current = allItems().filter(function (it) { return !q || fuzzy(q, it.title + " " + (it.sub || "")); }).slice(0, 12);
    if (!current.length) { list.innerHTML = '<div class="palette-empty">No matches. Try "learn", "compiler", or a lesson name.</div>'; return; }
    list.innerHTML = "";
    current.forEach(function (it, i) {
      var d = document.createElement("div");
      d.className = "palette-item" + (i === 0 ? " active" : "");
      d.innerHTML = '<span class="p-ico">' + it.icon + '</span><span>' + escapeHtml(it.title) + '</span><span class="p-kind">' + it.kind + '</span>';
      d.addEventListener("click", function () { close(); if (it.href) location.href = it.href; else if (it.run) it.run(); });
      list.appendChild(d);
    });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function close() { if (backdrop) { backdrop.remove(); backdrop = null; } }

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); backdrop ? close() : open(); }
    if (e.key === "Escape" && backdrop) close();
  });
})();
