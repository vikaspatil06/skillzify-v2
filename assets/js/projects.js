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

  /* ---------------- AI REVIEW (F4) ---------------- */
  // Single code string today; also handles a future {name, code} files array.
  function projectCodeText(p) {
    var parts = [];
    if (Array.isArray(p.files)) {
      p.files.forEach(function (f) {
        var body = (f && f.code) || "";
        if (body) parts.push("--- " + ((f && f.name) || "file.py") + " ---\n" + body);
      });
    }
    if (!parts.length && p.code) parts.push(String(p.code));
    return parts.join("\n\n");
  }
  var REVIEW_MAX = 7800;
  function reviewHtml(d, truncated) {
    var html = '<div class="card" style="margin-top:12px"><h3 style="margin:0 0 8px">🤖 AI review' +
      (typeof d.score === "number" ? ": " + d.score + "/100" : "") + "</h3>";
    if (typeof d.score === "number") {
      html += '<p class="hint">90+ excellent · 70–89 solid, fix the issues below · 50–69 needs work · under 50 revisit the basics. Scored on correctness, style, and edge cases.</p>';
    }
    if (truncated) {
      html += '<p class="hint">Reviewed the first ' + REVIEW_MAX + ' characters — later code wasn\'t seen.</p>';
    }
    var issues = Array.isArray(d.issues) ? d.issues : [];
    if (issues.length) {
      html += "<h4>Issues</h4><ul>";
      issues.forEach(function (it) {
        html += "<li><strong>" + esc(it.severity || "") + "</strong>" +
          (it.line != null ? " · line " + esc(it.line) : "") + ": " + esc(it.note || "") + "</li>";
      });
      html += "</ul>";
    } else {
      html += '<p class="hint">No issues found — nice work!</p>';
    }
    var strengths = Array.isArray(d.strengths) ? d.strengths : [];
    if (strengths.length) {
      html += "<h4>Strengths</h4><ul>" + strengths.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>";
    }
    var sugg = Array.isArray(d.suggestions) ? d.suggestions : [];
    if (sugg.length) {
      html += "<h4>Suggestions</h4><ul>" + sugg.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>";
    }
    return html + "</div>";
  }
  // isReview-equivalent client check: score must be a number 0-100 and
  // issues/strengths/suggestions must be arrays. Malformed issue entries
  // are dropped instead of crashing the render. Returns a clean review
  // object, or null when the payload is not a review at all.
  function validReview(d) {
    if (!d || typeof d.score !== "number" || d.score < 0 || d.score > 100) return null;
    if (!Array.isArray(d.issues) || !Array.isArray(d.strengths) || !Array.isArray(d.suggestions)) return null;
    return {
      score: d.score,
      issues: d.issues.filter(function (it) { return it && typeof it === "object"; }),
      strengths: d.strengths.filter(function (s) { return typeof s === "string"; }),
      suggestions: d.suggestions.filter(function (s) { return typeof s === "string"; })
    };
  }
  function bindReviewBtn(p) {
    var btn = $("ai-review-btn"), out = $("ai-review-result");
    if (!btn || !out) return;
    btn.addEventListener("click", function () {
      var code = projectCodeText(p);
      if (!code || !code.trim()) { out.innerHTML = '<p class="hint">This project has no code to review yet.</p>'; return; }
      if (!window.SkillzifyAI || typeof window.SkillzifyAI.ask !== "function") {
        out.innerHTML = '<p class="hint">The AI is unavailable on this page right now.</p>'; return;
      }
      var truncated = code.length > REVIEW_MAX;
      if (truncated) {
        code = code.slice(0, REVIEW_MAX) + "\n\n[Note: code truncated for review — the full project is longer.]";
      }
      btn.disabled = true;
      btn.textContent = "🤖 Reviewing…";
      out.innerHTML = '<p class="hint">🤖 Reviewing your code… this can take a few seconds while the AI wakes up.</p>';
      window.SkillzifyAI.ask({
        mode: "review", json: true, code: code,
        context: window.SkillzifyAI.buildContext({ note: "Reviewing project: " + p.title })
      }, function (err, res) {
        btn.disabled = false;
        btn.textContent = "🤖 AI review";
        if (err) {
          // Sign-in link only when signed out (ai.js capLink returns
          // "" for signed-in users at the 50/day cap).
          var revCap = (err && err.code === "DAILY_CAP" && window.SkillzifyAI && window.SkillzifyAI.capLink)
            ? window.SkillzifyAI.capLink() : "";
          out.innerHTML = '<p class="hint">⚠️ ' + esc(err.message || "The AI review failed.") + revCap + "</p>"; return;
        }
        if (!res || !res.data) {
          out.innerHTML = '<p class="hint">The AI didn\'t return a review. Try again.</p>';
          return;
        }
        var review = validReview(res.data);
        if (!review) {
          out.innerHTML = '<p class="hint">The AI didn\'t return a review. Try again.</p>';
          return;
        }
        out.innerHTML = reviewHtml(review, truncated);
      });
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
      codeHtml + '<div style="margin-top:12px">' + tryBtn + ' <button class="btn btn-sm" id="ai-review-btn">🤖 AI review</button></div>' + note + '<div id="ai-review-result"></div></div>' +
      nav;

    $("proj-back").addEventListener("click", function () { location.hash = ""; });
    bindReviewBtn(p);
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
