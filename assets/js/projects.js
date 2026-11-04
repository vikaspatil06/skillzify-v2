/* Skillzify Projects — card grid + detail views.
   List: level filter pills, compact cards (click opens the project).
   Detail: #project=<id> route with hero, steps, code, compiler link. */
(function () {
  "use strict";
  var S = window.Skillzify;
  function esc(s) { return S.esc(String(s == null ? "" : s)); }
  function $(id) { return document.getElementById(id); }

  var filter = "all";
  function projColor(p) { return p.color || "#6c7bff"; }

  /* ---------------- LIST ---------------- */
  function levelPills(projects) {
    var levels = ["Beginner", "Intermediate", "Advanced"];
    function pill(val, label, n) {
      return '<button class="pill' + (filter === val ? " active" : "") + '" data-level="' + val + '">' +
        esc(label) + ' <span class="pill-n">' + n + "</span></button>";
    }
    var html = pill("all", "All projects", projects.length);
    levels.forEach(function (lv) {
      var n = projects.filter(function (p) { return p.level === lv; }).length;
      if (n) html += pill(lv.toLowerCase(), lv, n);
    });
    return '<div class="pill-row" id="proj-pills">' + html + "</div>";
  }

  function projCard(p) {
    var c = projColor(p);
    return '<a class="card proj-card2" style="--pc:' + c + '" href="#project=' + p.id + '">' +
      '<div class="path-top"><div class="path-tile">' + p.icon + "</div>" +
      '<span class="badge path-level">' + esc(p.level || "") + "</span></div>" +
      "<h3>" + esc(p.title) + "</h3>" +
      '<p class="hint proj-skills">' + esc(p.skills || "") + "</p>" +
      '<p class="hint">' + esc(p.desc) + "</p>" +
      '<div class="path-foot"><span class="pct">' + p.steps.length + " steps</span>" +
      '<span class="proj-open">Open →</span></div></a>';
  }

  function renderList() {
    var host = $("projects-list");
    if (!host) return;
    var all = window.SkillzifyProjects || [];
    var shown = all.filter(function (p) {
      return filter === "all" || (p.level || "").toLowerCase() === filter;
    });
    host.innerHTML = levelPills(all) +
      '<div class="grid-3">' + shown.map(projCard).join("") + "</div>";
    var pills = $("proj-pills");
    if (pills) pills.querySelectorAll(".pill").forEach(function (b) {
      b.addEventListener("click", function () { filter = b.getAttribute("data-level"); renderList(); });
    });
  }

  /* ---------------- DETAIL ---------------- */
  function renderDetail(id) {
    var host = $("projects-list");
    if (!host) return;
    var p = null, all = window.SkillzifyProjects || [];
    for (var i = 0; i < all.length; i++) if (all[i].id === id) p = all[i];
    if (!p) { renderList(); return; }
    var c = projColor(p);

    var steps = p.steps.map(function (s) { return "<li>" + s + "</li>"; }).join("");
    var codeHtml = '<pre class="code">' + esc(p.code) + "</pre>";
    var tryBtn = p.tryIt
      ? '<a class="btn btn-sm" href="compiler.html">Try it in the compiler →</a>'
      : "";
    var note = p.note ? '<p class="hint">' + p.note + "</p>" : "";

    // prev/next navigation
    var idx = all.indexOf(p);
    var prev = idx > 0 ? all[idx - 1] : null;
    var next = idx < all.length - 1 ? all[idx + 1] : null;
    var nav = '<div class="proj-nav">' +
      (prev ? '<a class="btn btn-sm btn-ghost" href="#project=' + prev.id + '">← ' + esc(prev.title) + "</a>" : "<span></span>") +
      (next ? '<a class="btn btn-sm btn-ghost" href="#project=' + next.id + '">' + esc(next.title) + " →</a>" : "<span></span>") +
      "</div>";

    host.innerHTML =
      '<button class="btn btn-sm btn-ghost" id="proj-back">← All projects</button>' +
      '<div class="path-hero" style="--pc:' + c + '">' +
      '<div class="path-tile lg">' + p.icon + "</div>" +
      '<div><span class="badge path-level">' + esc(p.level || "") + "</span>" +
      '<h1 class="section-title" style="margin:8px 0">' + esc(p.title) + "</h1>" +
      "<p>" + esc(p.desc) + "</p>" +
      '<p class="hint proj-skills">Skills: ' + esc(p.skills || "") + " · " + p.steps.length + " steps</p></div></div>" +
      '<div class="card"><h2 class="section-title" style="font-size:1.3rem">🛠️ Build it</h2>' +
      "<ol class='proj-steps'>" + steps + "</ol></div>" +
      '<div class="card"><h2 class="section-title" style="font-size:1.3rem">💻 Starter code</h2>' +
      codeHtml + '<div style="margin-top:12px">' + tryBtn + "</div>" + note + "</div>" +
      nav;

    $("proj-back").addEventListener("click", function () { location.hash = ""; });
  }

  /* ---------------- ROUTER ---------------- */
  function route() {
    var m = (location.hash || "").match(/^#project=([\w-]+)/);
    if (m) renderDetail(m[1]); else renderList();
    if (window.scrollTo) window.scrollTo(0, 0);
  }

  document.addEventListener("DOMContentLoaded", function () {
    route();
    window.addEventListener("hashchange", route);
  });
})();
