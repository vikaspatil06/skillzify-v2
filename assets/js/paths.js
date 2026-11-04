/* Skillzify Learning Paths — dynamic list + detail views.
   List: continue-learning hero, level filter pills, rich cards.
   Detail: #path=<id> route with hero, up-next card, visual timeline.
   Progress reads live from localStorage (lessons + exercise attempts). */
(function () {
  "use strict";
  var S = window.Skillzify;
  function esc(s) { return S.esc(String(s == null ? "" : s)); }
  function $(id) { return document.getElementById(id); }

  var LESSON_MIN = 12, EX_MIN = 15;
  var filter = "all";

  function lessonById(id) {
    var L = (window.SkillzifyLearn && window.SkillzifyLearn.LESSONS) || [];
    for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
    return null;
  }
  function exById(id) {
    var E = window.SkillzifyPracticeData || [];
    for (var i = 0; i < E.length; i++) if (E[i].id === id) return E[i];
    return null;
  }
  function lessonDone(id) {
    try { return !!(JSON.parse(localStorage.getItem("skillzify_progress") || "{}")[id]); } catch (e) { return false; }
  }
  function exDone(id) {
    try { var a = JSON.parse(localStorage.getItem("skillzify_exercise_attempts") || "{}")[id]; return !!(a && a.solved); }
    catch (e) { return false; }
  }
  function stepDone(s) { return s.t === "lesson" ? lessonDone(s.id) : exDone(s.id); }
  function stepTitle(s) {
    if (s.t === "lesson") { var l = lessonById(s.id); return l ? l.title : s.id; }
    var e = exById(s.id); return e ? e.title : s.id;
  }
  function stepHref(s) { return s.t === "lesson" ? "learn.html" : "practice.html#ex=" + s.id; }
  function stepKind(s) { return s.t === "lesson" ? "📖 Lesson" : "🏋️ Exercise"; }
  function stepMins(s) { return s.t === "lesson" ? LESSON_MIN : EX_MIN; }

  function pathStats(p) {
    var lessons = 0, exs = 0, done = 0, mins = 0;
    p.steps.forEach(function (s) {
      if (s.t === "lesson") { lessons++; mins += LESSON_MIN; } else { exs++; mins += EX_MIN; }
      if (stepDone(s)) done++;
    });
    return {
      lessons: lessons, exs: exs, done: done, total: p.steps.length, mins: mins,
      pct: p.steps.length ? Math.round(done / p.steps.length * 100) : 0
    };
  }
  function nextStep(p) {
    for (var i = 0; i < p.steps.length; i++) if (!stepDone(p.steps[i])) return { step: p.steps[i], index: i };
    return null;
  }
  function fmtMins(m) {
    if (m < 60) return "~" + m + " min";
    var h = Math.floor(m / 60), r = m % 60;
    return "~" + h + "h" + (r ? " " + r + "m" : "");
  }
  function pathColor(p) { return p.color || "#6c7bff"; }

  /* ---------------- LIST VIEW ---------------- */
  function levelPills(paths) {
    var levels = ["Beginner", "Intermediate", "Advanced"];
    function pill(val, label, n) {
      return '<button class="pill' + (filter === val ? " active" : "") + '" data-level="' + val + '">' +
        esc(label) + ' <span class="pill-n">' + n + "</span></button>";
    }
    var html = pill("all", "All paths", paths.length);
    levels.forEach(function (lv) {
      var n = paths.filter(function (p) { return p.level === lv; }).length;
      if (n) html += pill(lv.toLowerCase(), lv, n);
    });
    return '<div class="pill-row" id="path-pills">' + html + "</div>";
  }

  function continueHero(paths) {
    var best = null, bestPct = -1;
    paths.forEach(function (p) {
      var st = pathStats(p);
      if (st.done > 0 && st.done < st.total && st.pct > bestPct) { best = p; bestPct = st.pct; }
    });
    if (!best) return "";
    var nx = nextStep(best);
    return '<div class="card continue-hero" style="--pc:' + pathColor(best) + '">' +
      '<div class="ch-left"><p class="hint" style="margin:0 0 6px">🔥 Continue learning</p>' +
      "<h3 style='margin:0 0 6px'>" + esc(best.title) + "</h3>" +
      '<p class="hint">Up next: <strong>' + esc(stepTitle(nx.step)) + "</strong> · " +
      pathStats(best).done + "/" + pathStats(best).total + " steps</p></div>" +
      '<div class="ch-actions"><a class="btn" href="' + stepHref(nx.step) + '">Resume →</a> ' +
      '<a class="btn btn-ghost" href="#path=' + best.id + '">View path</a></div></div>';
  }

  function pathCard(p) {
    var st = pathStats(p), c = pathColor(p);
    var nx = nextStep(p);
    var cta = st.done >= st.total
      ? '<span class="badge badge-done">✓ Completed</span>'
      : '<a class="btn btn-sm" href="' + (nx ? stepHref(nx.step) : "#path=" + p.id) + '">' +
        (st.done > 0 ? "Continue →" : "Start →") + "</a>";
    return '<article class="card path-card2" style="--pc:' + c + '">' +
      '<div class="path-top"><div class="path-tile">' + p.icon + '</div>' +
      '<span class="badge path-level">' + esc(p.level || "") + "</span></div>" +
      "<h3>" + esc(p.title) + "</h3>" +
      '<p class="hint">' + esc(p.desc) + "</p>" +
      '<p class="path-meta">📖 ' + st.lessons + " lessons · 🏋️ " + st.exs + " exercises · " + fmtMins(st.mins) + "</p>" +
      '<div class="bar path-bar"><span style="width:' + st.pct + "%;background:" + c + '"></span></div>' +
      '<div class="path-foot"><span class="pct">' + st.done + "/" + st.total + " · " + st.pct + "%</span>" +
      '<a class="btn btn-sm btn-ghost" href="#path=' + p.id + '">Details</a> ' + cta + "</div></article>";
  }

  function renderList() {
    var host = $("paths-list");
    if (!host) return;
    var paths = (window.SkillzifyPaths || []).filter(function (p) {
      return filter === "all" || (p.level || "").toLowerCase() === filter;
    });
    var all = window.SkillzifyPaths || [];
    host.innerHTML = continueHero(all) + levelPills(all) +
      '<div class="grid-3" id="paths-grid">' + paths.map(pathCard).join("") + "</div>";
    var pills = $("path-pills");
    if (pills) pills.querySelectorAll(".pill").forEach(function (b) {
      b.addEventListener("click", function () { filter = b.getAttribute("data-level"); renderList(); });
    });
  }

  /* ---------------- DETAIL VIEW ---------------- */
  function renderDetail(id) {
    var host = $("paths-list");
    if (!host) return;
    var p = null, all = window.SkillzifyPaths || [];
    for (var i = 0; i < all.length; i++) if (all[i].id === id) p = all[i];
    if (!p) { renderList(); return; }
    var st = pathStats(p), c = pathColor(p), nx = nextStep(p);

    var upNext = nx
      ? '<div class="card up-next" style="--pc:' + c + '"><span>⚡ <strong>Up next:</strong> ' +
        esc(stepKind(nx.step)) + " — " + esc(stepTitle(nx.step)) + "</span>" +
        '<a class="btn btn-sm" href="' + stepHref(nx.step) + '">Start →</a></div>'
      : '<div class="card up-next done" style="--pc:' + c + '"><span>🎉 <strong>Path complete!</strong> ' +
        "Every step conquered.</span></div>";

    var timeline = p.steps.map(function (s, i) {
      var done = stepDone(s);
      var isNext = nx && nx.index === i;
      var cls = done ? "done" : (isNext ? "current" : "todo");
      var dot = done ? "✓" : (isNext ? "▶" : (i + 1));
      return '<li class="tl-step ' + cls + '"><span class="tl-dot">' + dot + "</span>" +
        '<div class="tl-body"><a href="' + stepHref(s) + '">' + esc(stepTitle(s)) + "</a>" +
        '<span class="hint">' + esc(stepKind(s)) + " · ~" + stepMins(s) + " min</span></div></li>";
    }).join("");

    host.innerHTML =
      '<button class="btn btn-sm btn-ghost" id="path-back">← All paths</button>' +
      '<div class="path-hero" style="--pc:' + c + '">' +
      '<div class="path-tile lg">' + p.icon + "</div>" +
      '<div><span class="badge path-level">' + esc(p.level || "") + "</span>" +
      '<h1 class="section-title" style="margin:8px 0">' + esc(p.title) + "</h1>" +
      "<p>" + esc(p.desc) + "</p>" +
      '<p class="hint">📖 ' + st.lessons + " lessons · 🏋️ " + st.exs + " exercises · " + fmtMins(st.mins) +
      " · " + st.done + "/" + st.total + " steps (" + st.pct + "%)</p>" +
      '<div class="bar path-bar"><span style="width:' + st.pct + "%;background:" + c + '"></span></div></div></div>' +
      upNext +
      '<div class="card"><h2 class="section-title" style="font-size:1.3rem">🗺️ Your route</h2>' +
      '<ol class="path-timeline">' + timeline + "</ol></div>";

    $("path-back").addEventListener("click", function () { location.hash = ""; });
  }

  /* ---------------- ROUTER ---------------- */
  function route() {
    var m = (location.hash || "").match(/^#path=([\w-]+)/);
    if (m) renderDetail(m[1]); else renderList();
    window.scrollTo(0, 0);
  }

  document.addEventListener("DOMContentLoaded", function () {
    route();
    window.addEventListener("hashchange", route);
  });
  // Re-render when returning from a lesson/exercise (progress changed)
  window.addEventListener("pageshow", route);
})();
