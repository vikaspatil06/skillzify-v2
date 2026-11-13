/* Skillzify spaced repetition (SM-2-lite) — review.js v3.
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
  /* Local Fisher-Yates shuffle (mirrors LC.shuffled; review.js must
     not depend on learn-core.js being loaded first). */
  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
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
  // P2-19 helpers — the two-tab guards for the review +5 XP.
  function localDay(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
  }
  // Claim the +5 XP for (lesson, day): first caller wins. The token
  // re-read is the atomicity: two tabs racing both read "unclaimed",
  // both write, but only the tab whose token survives the re-read pays.
  // Returns true when this call holds the claim.
  function claimReviewXp(id, t) {
    var key = "skillzify_review_xp_" + id + "_" + localDay(new Date(t));
    try {
      if (localStorage.getItem(key)) return false;
      var token = String(t) + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem(key, token);
      return localStorage.getItem(key) === token;
    } catch (e) { return true; }
  }
  // Freshness re-check: re-read the review map and require this call's
  // write to still be the latest entry for the lesson. If another tab
  // recorded the same lesson after our write, its updatedAt wins and
  // this call pays nothing. (A correct review pushes the due date at
  // least 3 days out, so the same lesson can't pay twice in a day.)
  function freshWriteStillCurrent(id, t) {
    try {
      var e = readMap()[id];
      return !!e && e.updatedAt === t;
    } catch (err) { return true; }
  }
  // Record one recall outcome. Correct advances the interval to the
  // SMALLEST interval strictly greater than the current one (P2-12),
  // capped at 60; incorrect resets to 1 day. A legacy/cloud interval
  // that is not on the ladder (e.g. 2, 5, 45) therefore advances to
  // 3, 7, 60 — never backwards to 3.
  function recordResult(id, correct) {
    if (!id || typeof id !== "string") return null;
    var m = readMap();
    var e = m[id] || { interval: 1, due: 0, updatedAt: 0 };
    var t = now();
    var next;
    if (correct) {
      next = INTERVALS[INTERVALS.length - 1];
      for (var i = 0; i < INTERVALS.length; i++) {
        if (INTERVALS[i] > e.interval) { next = INTERVALS[i]; break; }
      }
    } else {
      next = 1;
    }
    m[id] = { interval: next, due: t + next * DAY, updatedAt: t };
    writeMap(m);
    // P2-19 (two-tab race on the +5 XP): the award below pays only if
    // this call wins the per-lesson-per-day claim AND its write is
    // still the latest stored entry when re-read — a second tab that
    // recorded the same lesson first (or overwrote us in between)
    // pays nothing. The interval above is still recorded either way:
    // the claim guards the XP/counter only, never the recall itself.
    // Reviews-done counter (feeds the review achievements). One count
    // per lesson reviewed in a session, correct or not — unchanged by
    // P2-19: only the XP below is two-tab guarded, the counter still
    // records every recall outcome exactly as before.
    try {
      var rc = parseInt(localStorage.getItem("skillzify_reviews_done") || "0", 10) || 0;
      localStorage.setItem("skillzify_reviews_done", String(rc + 1));
    } catch (e) {}
    // Counters sync: the reviews-done counter now reaches Firestore
    // (sync.js `counters` field, MAX merge) so badges agree across
    // devices. markDirty() is the local debounced helper (above).
    markDirty();
    // Correct recall earns +5 XP — but only when this call wins the
    // per-lesson-per-day claim and its write is still current (P2-19,
    // see the guards above).
    var payXP = false;
    if (correct) {
      payXP = claimReviewXp(id, t) && freshWriteStillCurrent(id, t);
    }
    if (payXP) {
      var awarded = false;
      try {
        if (window.SkillzifyLearnCore && typeof window.SkillzifyLearnCore.addXP === "function") {
          window.SkillzifyLearnCore.addXP(5); awarded = true;
        }
      } catch (e) {}
      if (!awarded) {
        try {
          var xp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0;
          localStorage.setItem("skillzify_xp", String(xp + 5));
        } catch (e2) {}
      }
    }
    // Any review is an activity day, so it logs to the streak counter
    // via A.log() (correct or not).
    try {
      if (window.SkillzifyActivity && typeof window.SkillzifyActivity.log === "function") {
        var l = lessonById(id);
        window.SkillzifyActivity.log("review", "Reviewed: " + (l ? l.title : id) + (payXP ? " (+5 XP)" : ""));
      }
    } catch (e) {}
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
    // Count only lessons that exist in the catalog, exactly like the
    // due list above — stale/unknown scheduled ids must not inflate it.
    var total = Object.keys(readMap()).filter(function (id) { return !!lessonById(id); }).length;
    var html = '<h3 style="margin:0 0 4px">🔁 Review</h3>' +
      '<p class="hint" style="margin:0 0 10px">Spaced repetition — completed lessons come back just before you forget them.</p>';
    if (!due.length) {
      html += total
        ? '<p class="hint">Nothing due right now. ' + total + ' lesson' + (total === 1 ? '' : 's') + ' scheduled for review.</p>'
        : '<p class="hint">Finish a lesson and its first review will be scheduled for tomorrow.</p>';
    } else {
      html += '<p style="margin:0 0 10px"><strong>' + due.length + ' lesson' + (due.length === 1 ? '' : 's') + ' due</strong> — quick recall, a few minutes.</p>';
      // Phase 4: rusty nudge — a due lesson whose section hasn't been
      // reviewed in 21+ days gets flagged, so the learner knows why
      // these reviews matter most right now.
      try {
        var M = window.SkillzifyMastery;
        if (M && typeof M.sectionMastery === "function") {
          var secs = {};
          M.sectionMastery().forEach(function (sec) { secs[sec.section] = sec; });
          var seen = {}, rustyNames = [];
          due.forEach(function (id) {
            var l = lessonById(id);
            if (l && secs[l.section] && secs[l.section].rusty && !seen[l.section]) { seen[l.section] = 1; rustyNames.push(secs[l.section].name); }
          });
          if (rustyNames.length) {
            html += '<p class="hint" style="margin:0 0 10px">\u{1F342} ' + rustyNames.slice(0, 2).map(function (n) { return esc(n); }).join(" \u00B7 ") +
              (rustyNames.length > 2 ? " (+" + (rustyNames.length - 2) + " more)" : "") +
              (rustyNames.length === 1 ? " is" : " are") + ' rusty — 21+ days since your last review there.</p>';
          }
        }
      } catch (e) {}
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
    /* Optimization #5 (split catalog): quizzes live in per-section
       chunks — attach the due lessons' sections before starting.
       On a load failure the session still begins; a lesson whose
       content is missing has no quiz and is skipped unrecorded by
       the existing P2-11 rule, so nothing is scored wrongly. */
    var LC = null;
    try { LC = window.SkillzifyLearnCore; } catch (e) {}
    if (LC && typeof LC.ensureLesson === "function" && due.some(function (id) { var l = lessonById(id); return l && !l._loaded; })) {
      mount.innerHTML = '<h3 style="margin:0 0 4px">🔁 Review</h3><p class="hint" style="margin:0">Loading your review questions…</p>';
      Promise.all(due.map(function (id) { return LC.ensureLesson(id); })).then(function () {
        beginSession(mount, due);
      }, function () { beginSession(mount, due); });
      return;
    }
    beginSession(mount, due);
  }
  function beginSession(mount, due) {
    /* Shuffle lesson order so reviews don't always run oldest-due first (P2-13). */
    session = { ids: shuffled(due), li: 0, qi: 0, allCorrect: true, done: 0, qs: null, qsFor: null };
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
    /* Shuffle each lesson's questions once per session visit (P2-13). */
    if (session.qsFor !== lesson.id) { session.qs = shuffled(qs); session.qsFor = lesson.id; }
    qs = session.qs;
    if (!qs.length || session.qi >= qs.length) {
      // Lesson finished: record the outcome, move on. P2-11: a lesson
      // with NO quiz questions is never recorded — with zero recall
      // there is nothing to score, so no interval advance, no
      // reviews-done count and no +5 XP. It still leaves the queue.
      if (qs.length) {
        recordResult(lesson.id, session.allCorrect);
        session.done++;
      }
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
      '<div data-review-answer aria-live="polite" hidden>' +
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
    _readMap: readMap, _writeMap: writeMap
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
