/* Skillzify spaced repetition (SM-2-lite) — review.js v1.
   Completing a lesson schedules its first review due in 1 day.
   Intervals on a correct recall: 1 -> 3 -> 7 -> 14 -> 30 -> 60 days.
   A missed recall resets the interval to 1 day.
   State: localStorage `skillzify_review` { lessonId: {interval, due, updatedAt} }
   + Firestore `users/{uid}.reviews` (same shape, merged per-lesson by later
   updatedAt in sync.js). Exposes window.SkillzifyReview.
   The Learn-page UI auto-renders into #review-section when present. */
(function () {
  "use strict";
  var LS_KEY = "skillzify_review";
  var LS_TS = "skillzify_review_ts";
  var DAY = 86400000;
  var INTERVALS = [1, 3, 7, 14, 30, 60];
  var SESSION_MAX = 10;

  function now() { return Date.now(); }
  function storeGet(k, fb) { try { var v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } }
  function storeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) {
    try { if (window.SkillzifyLearnCore && typeof window.SkillzifyLearnCore.esc === "function") return window.SkillzifyLearnCore.esc(s); } catch (e) {}
    try { if (window.Skillzify && typeof window.Skillzify.esc === "function") return window.Skillzify.esc(s); } catch (e) {}
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function markDirty() {
    try { if (window.SkillzifySync && typeof window.SkillzifySync.markDirty === "function") window.SkillzifySync.markDirty(); } catch (e) {}
  }

  /* ---------------- data API ---------------- */
  function sanitizeEntry(e) {
    if (!e || typeof e !== "object") return null;
    if (typeof e.interval !== "number" || e.interval <= 0) return null;
    if (typeof e.due !== "number" || e.due <= 0) return null;
    if (typeof e.updatedAt !== "number" || e.updatedAt <= 0) return null;
    return { interval: e.interval, due: e.due, updatedAt: e.updatedAt };
  }
  function readMap() {
    var raw = storeGet(LS_KEY, null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    var out = {};
    Object.keys(raw).forEach(function (id) { var e = sanitizeEntry(raw[id]); if (e) out[id] = e; });
    return out;
  }
  function writeMap(map) {
    var t = now();
    storeSet(LS_KEY, map);
    try { localStorage.setItem(LS_TS, String(t)); } catch (e) {}
    markDirty();
    return t;
  }
  // Schedule the FIRST review for a lesson (due in 1 day). Idempotent:
  // a lesson that already has a schedule keeps it.
  function scheduleFor(id) {
    if (!id || typeof id !== "string") return null;
    var m = readMap();
    if (m[id]) return m[id];
    var t = now();
    m[id] = { interval: 1, due: t + DAY, updatedAt: t };
    writeMap(m);
    return m[id];
  }
  // Record one recall outcome. Correct advances the interval
  // (1->3->7->14->30->60, capped at 60); incorrect resets to 1 day.
  function recordResult(id, correct) {
    if (!id || typeof id !== "string") return null;
    var m = readMap();
    var e = m[id] || { interval: 1, due: 0, updatedAt: 0 };
    var t = now();
    var next;
    if (correct) {
      var i = INTERVALS.indexOf(e.interval);
      next = INTERVALS[Math.min((i < 0 ? 0 : i) + 1, INTERVALS.length - 1)];
    } else {
      next = 1;
    }
    m[id] = { interval: next, due: t + next * DAY, updatedAt: t };
    writeMap(m);
    return m[id];
  }
  function dueList() {
    var m = readMap(), t = now();
    return Object.keys(m).filter(function (id) { return m[id].due <= t; })
      .sort(function (a, b) { return m[a].due - m[b].due; });
  }
  function dueCount() { return dueList().length; }
  function entry(id) { return readMap()[id] || null; }
  function lessonById(id) {
    try {
      if (window.SkillzifyLearnCore && typeof window.SkillzifyLearnCore.lessonById === "function")
        return window.SkillzifyLearnCore.lessonById(id);
    } catch (e) {}
    return null;
  }

  /* ---------------- review session UI ---------------- */
  var session = null; // { ids, li, qi, allCorrect, done }
  function fmtDue(due) {
    var days = Math.floor((now() - due) / DAY);
    if (days <= 0) return "due today";
    if (days === 1) return "1 day overdue";
    return days + " days overdue";
  }
  function renderSection(mount) {
    if (!mount || session) return;
    var due = dueList().filter(function (id) { return !!lessonById(id); });
    var total = Object.keys(readMap()).length;
    var html = '<h3 style="margin:0 0 4px">🔁 Review</h3>' +
      '<p class="hint" style="margin:0 0 10px">Spaced repetition — completed lessons come back just before you forget them.</p>';
    if (!due.length) {
      html += total
        ? '<p class="hint">Nothing due right now. ' + total + ' lesson' + (total === 1 ? '' : 's') + ' scheduled for review.</p>'
        : '<p class="hint">Finish a lesson and its first review will be scheduled for tomorrow.</p>';
    } else {
      html += '<p style="margin:0 0 10px"><strong>' + due.length + ' lesson' + (due.length === 1 ? '' : 's') + ' due</strong> — quick recall, a few minutes.</p>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">' +
        due.slice(0, SESSION_MAX).map(function (id) {
          var l = lessonById(id);
          return '<span class="chip" title="' + esc(l ? l.title : id) + '">' + esc(l ? l.title : id) + ' · ' + fmtDue(readMap()[id].due) + '</span>';
        }).join("") + '</div>';
      html += '<button class="btn" type="button" data-review-start>Start review (' + Math.min(due.length, SESSION_MAX) + ') →</button>';
    }
    mount.innerHTML = html;
    var btn = mount.querySelector("[data-review-start]");
    if (btn) btn.addEventListener("click", function () { startSession(mount); });
  }
  function startSession(mount) {
    var due = dueList().filter(function (id) { return !!lessonById(id); }).slice(0, SESSION_MAX);
    if (!due.length) { renderSection(mount); return; }
    session = { ids: due, li: 0, qi: 0, allCorrect: true, done: 0 };
    renderCard(mount);
  }
  function currentLesson() {
    if (!session || session.li >= session.ids.length) return null;
    return lessonById(session.ids[session.li]);
  }
  function renderCard(mount) {
    var lesson = currentLesson();
    if (!lesson) { finishSession(mount); return; }
    var qs = Array.isArray(lesson.quiz) ? lesson.quiz : [];
    if (!qs.length || session.qi >= qs.length) {
      // lesson finished: record the outcome, move on
      recordResult(lesson.id, session.allCorrect);
      session.done++;
      session.li++;
      session.qi = 0;
      session.allCorrect = true;
      renderCard(mount);
      return;
    }
    var q = qs[session.qi];
    var total = session.ids.length;
    mount.innerHTML =
      '<p class="hint" style="margin:0 0 6px">Review ' + (session.li + 1) + ' of ' + total + ' · ' + esc(lesson.title) + '</p>' +
      '<h3 style="margin:0 0 10px">' + esc(q.q) + '</h3>' +
      '<div data-review-answer hidden>' +
        '<p style="margin:0 0 6px"><strong>Answer: ' + esc(q.options[q.answer]) + '</strong></p>' +
        '<p class="hint" style="margin:0 0 12px">' + esc(q.why || "") + '</p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn" type="button" data-review-got>✓ Got it</button>' +
          '<button class="btn btn-ghost" type="button" data-review-missed>✗ Missed it</button>' +
        '</div>' +
      '</div>' +
      '<div data-review-ask><button class="btn" type="button" data-review-show>Show answer</button></div>' +
      '<p style="margin:12px 0 0"><button class="btn btn-ghost" type="button" data-review-quit>End session</button></p>';
    var show = mount.querySelector("[data-review-show]");
    if (show) show.addEventListener("click", function () {
      var ans = mount.querySelector("[data-review-answer]");
      var ask = mount.querySelector("[data-review-ask]");
      if (ans) ans.hidden = false;
      if (ask) ask.hidden = true;
    });
    var got = mount.querySelector("[data-review-got]");
    if (got) got.addEventListener("click", function () { session.qi++; renderCard(mount); });
    var missed = mount.querySelector("[data-review-missed]");
    if (missed) missed.addEventListener("click", function () { session.allCorrect = false; session.qi++; renderCard(mount); });
    var quit = mount.querySelector("[data-review-quit]");
    if (quit) quit.addEventListener("click", function () { finishSession(mount); });
  }
  function finishSession(mount) {
    var done = session ? session.done : 0;
    session = null;
    mount.innerHTML = '<h3 style="margin:0 0 6px">🔁 Review done</h3>' +
      '<p class="hint" style="margin:0 0 10px">' + (done ? 'Reviewed ' + done + ' lesson' + (done === 1 ? '' : 's') + ' — the next ones are scheduled.' : 'Session ended — your progress is saved.') + '</p>' +
      '<button class="btn btn-ghost" type="button" data-review-back>← Back to review</button>';
    var back = mount.querySelector("[data-review-back]");
    if (back) back.addEventListener("click", function () { renderSection(mount); });
  }

  window.SkillzifyReview = {
    dueList: dueList, dueCount: dueCount, recordResult: recordResult,
    scheduleFor: scheduleFor, entry: entry,
    _readMap: readMap, _writeMap: writeMap, _intervals: INTERVALS
  };

  function init() {
    var mount = document.getElementById("review-section");
    if (mount) renderSection(mount);
    try {
      window.addEventListener("skillzify-sync", function () {
        var m2 = document.getElementById("review-section");
        if (m2 && !session) renderSection(m2);
      });
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
