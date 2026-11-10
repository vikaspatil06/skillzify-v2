/* Skillzify Placement Test — Phase 2: placement.html UI.
   One question at a time, stage by stage (Basics -> Core -> Advanced),
   with a Back button and a result screen. Answers are shown only at the
   end (spec default), with the correct output and the walkthrough — the
   same "why" pattern as the practice predict feedback.

   Flow rules (placement.js owns the scoring; this file owns the asking):
   - Ask stage A (3). If A < 2/3, the test ends here (early exit).
   - Else ask stage B (4). If B < 3/4, the test ends here.
   - Else ask stage C (3), then the result.
   - Next is disabled until an option is picked; Back restores the
     recorded answer for the previous question.
   - Placement is a pointer, not progress: no XP, no lessons marked done,
     no activity-feed entry (so taking the test never bumps the streak).
     The result is saved via SkillzifyPlacement.save() for the Learn
     banner (Phase 3).
   Exposes window.SkillzifyPlacementPage = { _getState, _current } for
   the harness and live checks. */
(function () {
  "use strict";

  var STAGE_LABEL = { a: "Basics", b: "Core", c: "Advanced" };
  var TOTAL = 10; // the full test; an early exit ends it sooner

  var P = null, sel = null, asked = [], answers = {}, idx = 0, done = false, result = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return (window.Skillzify && window.Skillzify.esc) ? window.Skillzify.esc(s) : String(s == null ? "" : s);
  }
  function sectionName(id) {
    try {
      var secs = (window.SkillzifyLearnCore && window.SkillzifyLearnCore.SECTIONS) || [];
      var s = secs.filter(function (x) { return x.id === id; })[0];
      return s ? (s.icon ? s.icon + " " : "") + s.name : id;
    } catch (e) { return id; }
  }
  function cur() { return asked[idx] || null; }

  function stageOf(q) { return q ? q.stage : "a"; }

  /* Score only the stages asked so far (placement.js scores what it is
     given, so this is the same function the result screen uses). */
  function scoreSoFar() {
    return P.score(asked, answers);
  }

  function render() {
    var mount = $("plc-mount");
    if (!mount) return;
    if (done && result) { renderResult(mount); return; }
    var q = cur();
    if (!q) { mount.innerHTML = '<p class="hint">Nothing to ask — try reloading the page.</p>'; return; }
    var picked = answers[q.id];
    var lastOfStage = idx === asked.length - 1;
    var nextLabel = "Next →";
    if (lastOfStage) nextLabel = stageOf(q) === "c" ? "See my result →" : "Continue →";
    var html = "";
    html += '<div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<span class="badge">' + esc(STAGE_LABEL[stageOf(q)] || "") + '</span>' +
      '<span class="hint" id="plc-progress">Question ' + (idx + 1) + " of " + TOTAL + "</span></div>" +
      '<h2 class="section-title" style="margin:12px 0 4px">' + esc(q.title) + "</h2>" +
      '<p style="margin:0 0 12px">' + esc(q.prompt || "What does this code print?") + "</p>" +
      '<pre class="code">' + esc(q.code) + "</pre>" +
      '<div id="plc-opts" class="opt-list">';
    q.options.forEach(function (opt, i) {
      html += '<button class="btn btn-ghost opt-btn' + (picked === i ? " sel" : "") + '" data-opt="' + i + '">' + esc(opt) + "</button>";
    });
    html += "</div></div>" +
      '<div style="display:flex;justify-content:space-between;gap:10px">' +
      '<button class="btn btn-ghost" id="plc-back"' + (idx === 0 ? " disabled" : "") + ">← Back</button>" +
      '<button class="btn" id="plc-next"' + (picked === undefined ? " disabled" : "") + ">" + nextLabel + "</button></div>";
    mount.innerHTML = html;
    var opts = document.querySelectorAll("#plc-opts button");
    opts.forEach(function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.getAttribute("data-opt"), 10);
        answers[q.id] = i;
        opts.forEach(function (x) { x.classList.toggle("sel", parseInt(x.getAttribute("data-opt"), 10) === i); });
        var nx = $("plc-next");
        if (nx) nx.disabled = false;
      });
    });
    /* Wire Back/Next once: a real browser destroys these elements on
       every innerHTML re-render, but the audit harness stub reuses the
       same element per id — re-attaching would stack duplicate handlers
       and one click would advance several questions. The handlers read
       live state, so wiring once is correct in both worlds. */
    var back = $("plc-back"), next = $("plc-next");
    if (back && !back._plcWired) { back._plcWired = true; back.addEventListener("click", function () { if (idx > 0) { idx--; render(); } }); }
    if (next && !next._plcWired) { next._plcWired = true; next.addEventListener("click", function () { onNext(); }); }
  }

  function onNext() {
    var q = cur();
    if (!q || answers[q.id] === undefined) return; // Next is disabled until picked
    if (idx < asked.length - 1) { idx++; render(); return; }
    // Last question of the current stage: apply the gate.
    var r = scoreSoFar(), st = stageOf(q);
    if (st === "a") {
      if (r.stages.a.total > 0 && r.stages.a.correct / r.stages.a.total < 2 / 3) { finish(); return; }
      asked = asked.concat(sel.b);
    } else if (st === "b") {
      if (r.stages.b.total > 0 && r.stages.b.correct / r.stages.b.total < 3 / 4) { finish(); return; }
      asked = asked.concat(sel.c);
    } else {
      finish();
      return;
    }
    idx++;
    render();
  }

  function finish() {
    result = P.score(asked, answers);
    done = true;
    try { P.save(result); } catch (e) {}
    render();
  }

  function renderResult(mount) {
    var startId = null, beginId = null;
    try { startId = P.startSection(result.section); } catch (e) {}
    try { beginId = P.startSection("base-camp"); } catch (e) {}
    var html = "";
    html += '<div class="card" id="plc-result" style="margin-bottom:14px">' +
      '<p class="hint" style="margin:0">Your placement</p>' +
      '<h2 class="section-title" id="plc-placed" style="margin:6px 0">' + esc(sectionName(result.section)) + "</h2>" +
      '<p id="plc-reason" style="margin:0 0 4px">' + esc(result.reason) + "</p>" +
      '<p class="hint" style="margin:0">A starting point, not a verdict — move freely.</p></div>';
    html += '<div class="card" style="margin-bottom:14px"><h3 style="margin:0 0 10px">How you did</h3><div id="plc-stages">';
    ["a", "b", "c"].forEach(function (k) {
      var s = result.stages[k];
      if (!s || s.total === 0) {
        html += '<div class="progress-row"><span class="lbl">' + esc(STAGE_LABEL[k]) + '</span><span class="pct" style="color:var(--muted)">Not reached</span></div>';
      } else {
        var pct = Math.round(s.correct / s.total * 100);
        html += '<div class="progress-row"><span class="lbl">' + esc(STAGE_LABEL[k]) + '</span>' +
          '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
          '<span class="pct">' + s.correct + "/" + s.total + "</span></div>";
      }
    });
    html += "</div></div>";
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
      (startId ? '<a class="btn" id="plc-start" href="lesson.html?id=' + esc(startId) + '">Start at ' + esc(sectionName(result.section)) + " →</a>" : "") +
      (beginId ? '<a class="btn btn-ghost" id="plc-begin" href="lesson.html?id=' + esc(beginId) + '">Start from the beginning</a>' : "") +
      '<button class="btn btn-ghost" id="plc-retake">Retake the test</button></div>';
    html += '<div class="card"><h3 style="margin:0 0 10px">Your answers</h3><div id="plc-review">';
    asked.forEach(function (q, i) {
      var picked = answers[q.id], ok = picked === q.answer;
      html += '<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
        "<strong>" + (i + 1) + ". " + esc(q.title) + "</strong>" +
        '<span class="badge">' + esc(STAGE_LABEL[q.stage] || "") + "</span></div>" +
        '<pre class="code" style="margin:8px 0">' + esc(q.code) + "</pre>" +
        (ok
          ? '<p class="pass">✓ Correct — you said ' + esc(q.options[picked]) + "</p>"
          : '<p class="fail">✗ You said ' + esc(picked === undefined ? "—" : q.options[picked]) + " · Correct: " + esc(q.options[q.answer]) + "</p>") +
        (q.walkthrough ? "<p class=\"hint\" style=\"margin:4px 0 0\">" + esc(q.walkthrough) + "</p>" : "") +
        (!ok && hasAi() ? '<div style="margin-top:8px"><button class="btn btn-sm btn-ghost plc-explain-btn" type="button" data-plc-explain="' + i + '">✨ Explain why</button>' +
          '<div class="plc-ai-out" id="plc-ai-out-' + i + '" hidden></div></div>' : "") +
        "</div>";
    });
    html += "</div></div>";
    mount.innerHTML = html;
    document.querySelectorAll("#plc-mount .plc-explain-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.getAttribute("data-plc-explain"), 10);
        var q = asked[i];
        var out = $("plc-ai-out-" + i);
        if (q && out) askExplain(q, b, out);
      });
    });
    var rt = $("plc-retake");
    if (rt && !rt._plcWired) { rt._plcWired = true; rt.addEventListener("click", function () { startTest(); }); }
  }

  function hasAi() {
    return !!(window.SkillzifyAI && typeof window.SkillzifyAI.ask === "function");
  }

  /* Phase 4: one on-demand AI explanation per wrong answer (tutor-lesson
     mode — the same pattern as the community "Ask AI for a hint"). One
     daily-cap call per click, never saved, rendered in place. The learner
     already knows the correct answer and the walkthrough, so the note
     asks the tutor to explain WHY — one hint, one follow-up. */
  function askExplain(q, btn, out) {
    var AI = window.SkillzifyAI;
    if (!AI || typeof AI.ask !== "function") {
      out.hidden = false;
      out.innerHTML = '<p class="fail">AI is not available right now — the walkthrough above explains it.</p>';
      return;
    }
    btn.disabled = true;
    btn.textContent = "AI is thinking…";
    out.hidden = false;
    out.innerHTML = '<p class="hint">Thinking…</p>';
    var note = "Placement test review: the learner was asked \"" + (q.prompt || "What does this code print?") + "\" for this code:\n" + (q.code || "") +
      "\nThey answered \"" + q.options[answers[q.id]] + "\", but the correct output is \"" + q.options[q.answer] + "\". " +
      "Help them understand why the correct output is right and where their answer goes wrong.";
    var ctx = note;
    try { if (AI.buildContext) ctx = AI.buildContext({ note: note }); } catch (e) {}
    AI.ask({ mode: "tutor-lesson", code: q.code || "", error: "", context: ctx }, function (err, res) {
      btn.disabled = false;
      btn.textContent = "✨ Explain why";
      if (err || !res || !res.text) {
        var capLink = (err && err.code === "DAILY_CAP" && AI.capLink) ? AI.capLink() : "";
        out.innerHTML = '<p class="fail">' + esc((err && err.message) || "The AI didn't answer — try again in a moment.") + "</p>" + capLink;
        return;
      }
      out.innerHTML = '<p class="hint">✨ AI explanation' + (res.cached ? " (cached)" : "") + (res.offline ? " (offline)" : "") + "</p>" +
        "<p>" + esc(res.text).replace(/\n/g, "<br>") + "</p>";
    });
  }

  function startTest() {
    sel = P.selectQuestions();
    asked = sel.a.slice();
    answers = {};
    idx = 0;
    done = false;
    result = null;
    render();
  }

  function init() {
    P = window.SkillzifyPlacement || null;
    var mount = $("plc-mount");
    if (!mount) return;
    if (!P || !window.SkillzifyPracticeData) {
      mount.innerHTML = '<p class="hint">⚠️ The test could not load. Check your connection, then reload the page.</p>';
      return;
    }
    startTest();
  }

  document.addEventListener("DOMContentLoaded", init);

  window.SkillzifyPlacementPage = {
    _getState: function () {
      return { idx: idx, stage: cur() ? cur().stage : null, askedN: asked.length, answeredN: Object.keys(answers).length, done: done, section: result ? result.section : null };
    },
    _current: cur,
  };
})();
