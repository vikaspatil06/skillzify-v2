/* Skillzify Circle — community page (Phase 1: anchored Q&A + showcase).
   Renders the Questions and Showcase tabs on community.html.
   All data goes through window.SkillzifyCommunity; all user content is
   escaped with window.Skillzify.esc before it reaches innerHTML. */
(function () {
  "use strict";
  var S = window.Skillzify;
  // Local fallback: if app.js failed to load, S is undefined and every render
  // would throw — the page must not go blank because of one missing script.
  function esc(s) {
    if (S && typeof S.esc === "function") return S.esc(String(s == null ? "" : s));
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; });
  }
  function $(id) { return document.getElementById(id); }

  /* Author name → link to their public profile (P2-19); plain text
     when the author has no uid (legacy/anonymous). */
  function authorLink(a) {
    var name = esc(a.authorName || "Anonymous");
    if (a.authorUid) return '<a href="profile.html?uid=' + esc(a.authorUid) + '">' + name + "</a>";
    return "<span>" + name + "</span>";
  }

  var C = window.SkillzifyCommunity || null;
  var ERR_MSG = "Couldn't load the community right now — check your connection and try again.";
  var DRAFT_KEY = "skillzify_community_draft";

  var state = {
    tab: "questions", filter: "all", qid: null, query: "",
    questions: [], showcase: [], showcaseLoaded: false,
    currentQ: null, currentAnswers: [],
    qCursor: null, qHasMore: false
  };
  var pendingDraft = null; // draft from the compiler, kept for the ask submit

  /* ---------------- helpers ---------------- */
  function showError(msg) {
    var el = $("comm-error");
    if (el) { el.hidden = false; el.textContent = msg; }
  }
  function hideError() {
    var el = $("comm-error");
    if (el) { el.hidden = true; el.textContent = ""; }
  }
  function onApiError() { showError(ERR_MSG); }
  function toast(msg, type) { if (S && S.toast) S.toast(msg, type); }

  function isSignedIn() {
    try { return !!(C && C.currentUser()); } catch (e) { return false; }
  }
  function currentUid() {
    try {
      var u = C && C.currentUser();
      return u ? u.uid : null;
    } catch (e) { return null; }
  }

  /* ---- Pending post: typed while signed out, posted after sign-in ----
     The composers stay open for everyone — the sign-in ask happens only
     at submit, after validation. The draft is parked in localStorage,
     the user signs in, and on return the post goes out on its own
     (resumePendingPost, called from the onAuthChange handler below).
     A parked post older than 24h is discarded. The record is cleared
     BEFORE the API call, so a failed post cannot loop on the next
     auth change. The API functions themselves still reject when signed
     out — that stays as the backstop. */
  var PENDING_POST_KEY = "skillzify_pending_post";
  var PENDING_POST_TTL = 24 * 60 * 60 * 1000;
  var pendingPostResumed = false; // one resume attempt per page load
  function savePendingPost(rec) { try { localStorage.setItem(PENDING_POST_KEY, JSON.stringify(rec)); } catch (e) {} }
  function readPendingPost() {
    var raw = null;
    try { raw = localStorage.getItem(PENDING_POST_KEY); } catch (e) { return null; }
    if (!raw) return null;
    var rec = null;
    try { rec = JSON.parse(raw); } catch (e) { return null; }
    if (!rec || typeof rec !== "object") return null;
    if (rec.kind !== "question" && rec.kind !== "answer" && rec.kind !== "showcase") return null;
    if (!rec.payload || typeof rec.payload !== "object") return null;
    return rec;
  }
  function clearPendingPost() { try { localStorage.removeItem(PENDING_POST_KEY); } catch (e) {} }
  // Park the post and go sign in. Returns true when the caller should
  // stop (nothing was sent); false when signed in and the caller should
  // carry on to the API call. returnTo is the page to come back to.
  function interceptPost(kind, payload, questionId, returnTo) {
    if (isSignedIn()) return false;
    savePendingPost({ kind: kind, payload: payload, questionId: questionId || null, at: Date.now() });
    toast("Sign in to post — your draft is saved and will post when you're back.", "success");
    setTimeout(function () { location.href = "auth.html?next=" + encodeURIComponent(returnTo); }, 700);
    return true;
  }
  function resumePendingPost() {
    if (!isSignedIn() || !C) return;
    if (pendingPostResumed) return;
    var rec = readPendingPost();
    if (!rec) return;
    pendingPostResumed = true;
    if (!rec.at || Date.now() - rec.at > PENDING_POST_TTL) { clearPendingPost(); return; }
    clearPendingPost();
    if (rec.kind === "question") {
      C.askQuestion(rec.payload).then(function (id) {
        toast("Your question is posted ✓", "success");
        state.filter = "all";
        setFilterPills("all");
        showQuestion(id);
      }).catch(onApiError);
    } else if (rec.kind === "answer") {
      C.postAnswer(rec.questionId, rec.payload).then(function () {
        toast("Your answer is posted ✓", "success");
        showQuestion(rec.questionId);
      }).catch(onApiError);
    } else if (rec.kind === "showcase") {
      C.postShowcase(rec.payload).then(function () {
        toast("Your project is shared ✓", "success");
        loadShowcase();
        if (state.tab !== "showcase") switchTab("showcase");
      }).catch(onApiError);
    }
  }
  function gateHTML() {
    return '<div class="card comm-gate"><h3>Sign in to join in</h3>' +
      '<p class="hint">Sign in to ask, answer and share.</p>' +
      '<a class="btn" href="auth.html">Sign in →</a></div>';
  }

  function toMs(ts) {
    if (ts == null) return 0;
    if (typeof ts === "number") return ts;
    if (typeof ts === "string") { var d = Date.parse(ts); return isNaN(d) ? 0 : d; }
    if (typeof ts.toMillis === "function") { try { return ts.toMillis(); } catch (e) { return 0; } }
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
    return 0;
  }
  function relTime(ts) {
    var ms = toMs(ts);
    if (!ms) return "";
    var diff = Date.now() - ms;
    if (diff < 0) diff = 0;
    var m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + (m === 1 ? " min ago" : " mins ago");
    var h = Math.floor(m / 60);
    if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    var d = Math.floor(h / 24);
    if (d < 7) return d + (d === 1 ? " day ago" : " days ago");
    var w = Math.floor(d / 7);
    if (w < 5) return w + (w === 1 ? " week ago" : " weeks ago");
    return new Date(ms).toLocaleDateString();
  }
  function excerpt(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n).trim() + "…" : s;
  }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).catch(function () {}); return; }
    var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {} ta.remove();
  }
  function openInStudio(code) {
    try { localStorage.setItem("skillzify_compiler_code", code); } catch (e) {}
    location.href = "compiler.html";
  }
  function lessonTag(q) {
    var t = "";
    try { t = C.lessonTitle(q.lessonId); } catch (e) { t = ""; }
    if (t) return '<span class="comm-tag">' + esc(t) + "</span>";
    if (q.lessonId) return '<span class="comm-tag">Lesson ' + esc(q.lessonId) + "</span>";
    return "";
  }
  function statusPill(q) {
    if (q.status === "answered") return '<span class="comm-status comm-status-answered">Answered</span>';
    return '<span class="comm-status comm-status-open">Open</span>';
  }
  function codeBlock(code, idPrefix) {
    if (!code) return "";
    return '<div class="comm-code"><pre class="code">' + esc(code) + "</pre>" +
      '<div class="comm-actions">' +
      '<button class="btn btn-sm btn-ghost" type="button" data-copy="' + esc(idPrefix) + '">Copy</button>' +
      '<button class="btn btn-sm btn-ghost" type="button" data-open="' + esc(idPrefix) + '">Open in Code Studio</button>' +
      "</div></div>";
  }

  /* ---------------- tabs ---------------- */
  function switchTab(tab) {
    state.tab = tab;
    var tq = $("tab-questions"), ts = $("tab-showcase");
    if (tq) { tq.classList.toggle("active", tab === "questions"); tq.setAttribute("aria-selected", tab === "questions" ? "true" : "false"); }
    if (ts) { ts.classList.toggle("active", tab === "showcase"); ts.setAttribute("aria-selected", tab === "showcase" ? "true" : "false"); }
    var pq = $("comm-questions"), ps = $("comm-showcase");
    if (pq) pq.hidden = tab !== "questions";
    if (ps) ps.hidden = tab !== "showcase";
    try {
      var u = new URLSearchParams(location.search);
      u.set("tab", tab);
      if (tab !== "questions") u.delete("q");
      if (tab !== "questions") u.delete("ask");
      history.replaceState(null, "", location.pathname + "?" + u.toString());
    } catch (e) {}
    if (tab === "showcase") { if (!state.showcaseLoaded) loadShowcase(); }
    else {
      if (state.qid) showList();
      loadQuestions();
    }
  }

  /* ---------------- questions: list ---------------- */
  function loadQuestions() {
    var list = $("comm-q-list");
    if (!C) { showError(ERR_MSG); return; }
    if (list) list.innerHTML = '<p class="hint">Loading questions…</p>';
    if (!isSignedIn() && state.filter === "mine") {
      if (list) list.innerHTML = gateHTML();
      return;
    }
    C.listQuestions({ filter: state.filter }).then(function (qs) {
      state.questions = qs || [];
      state.qCursor = qs ? qs._cursor : null;
      state.qHasMore = !!(qs && qs._hasMore);
      renderQuestions();
    }).catch(onApiError);
  }
  /* P2-20: load the next page of questions (older than the current
     cursor) and append it, so search can reach past the first 50. */
  function loadMoreQuestions() {
    if (!state.qCursor || !state.qHasMore) return;
    C.listQuestions({ filter: state.filter, after: state.qCursor }).then(function (qs) {
      var seen = {};
      state.questions.forEach(function (q) { seen[q.id] = true; });
      (qs || []).forEach(function (q) { if (!seen[q.id]) state.questions.push(q); });
      state.qCursor = qs ? qs._cursor : null;
      state.qHasMore = !!(qs && qs._hasMore);
      renderQuestions();
    }).catch(onApiError);
  }
  // Delete buttons (author-only; the buttons only render for the author).
  // Shared by the questions list, the question detail and the showcase.
  function bindDelete(root) {
    root.querySelectorAll("[data-del-q]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Delete this question? This can't be undone.")) return;
        b.disabled = true;
        C.deleteQuestion(b.getAttribute("data-del-q")).then(function () {
          toast("Question deleted", "success");
          if (state.qid) showList();
          loadQuestions();
        }).catch(function () { b.disabled = false; onApiError(); });
      });
    });
    // P2-31: author-only answer delete (deleteAnswer in community.js).
    root.querySelectorAll("[data-del-a]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Delete this answer? This can't be undone.")) return;
        b.disabled = true;
        C.deleteAnswer(state.qid, b.getAttribute("data-del-a")).then(function () {
          toast("Answer deleted", "success");
          if (state.qid) showQuestion(state.qid);
        }).catch(function () { b.disabled = false; onApiError(); });
      });
    });
    root.querySelectorAll("[data-del-s]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Delete this project? This can't be undone.")) return;
        b.disabled = true;
        C.deleteShowcase(b.getAttribute("data-del-s")).then(function () {
          toast("Project deleted", "success");
          loadShowcase();
        }).catch(function () { b.disabled = false; onApiError(); });
      });
    });
  }

  function renderQuestions() {
    var list = $("comm-q-list");
    if (!list) return;
    var shown = state.questions;
    try { shown = C.filterByQuery(state.questions, state.query || ""); } catch (e) { shown = state.questions; }
    if (!shown.length) {
      list.innerHTML = (state.query || "").trim()
        ? '<p class="hint">No questions match "' + esc(state.query.trim()) + '".' + (state.qHasMore ? " Only the " + state.questions.length + " most recent are loaded — load more below to search older ones." : "") + "</p>"
        : state.filter === "unanswered"
        ? '<p class="hint">No open questions right now — every question has an answer. Nice.</p>'
        : state.filter === "mine"
        ? '<p class="hint">You haven\'t asked anything yet.</p>'
        : '<p class="hint">No questions yet — be the first to ask.</p>';
    } else {
      list.innerHTML = shown.map(function (q) {
      var n = q.answerCount || 0;
      return '<article class="card comm-q">' +
        '<h3><a href="community.html?q=' + esc(q.id) + '" data-qid="' + esc(q.id) + '">' + esc(q.title) + "</a></h3>" +
        '<p class="comm-meta">' + authorLink(q) +
        "<span>" + esc(relTime(q.createdAt)) + "</span>" +
        lessonTag(q) +
        "<span>" + n + (n === 1 ? " answer" : " answers") + "</span>" +
        statusPill(q) + "</p>" +
        (q.body ? '<p class="comm-excerpt">' + esc(excerpt(q.body, 160)) + "</p>" : "") +
        (q.authorUid && currentUid() === q.authorUid
          ? '<div class="comm-actions"><button class="btn btn-sm btn-ghost" type="button" data-del-q="' + esc(q.id) + '">Delete</button></div>'
          : "") +
        "</article>";
    }).join("");
    }
    if (state.qHasMore) {
      list.innerHTML += '<div style="text-align:center;margin-top:12px"><button class="btn btn-ghost" type="button" data-load-more>Load more questions ↓</button></div>';
      var moreBtn = list.querySelector("[data-load-more]");
      if (moreBtn) moreBtn.addEventListener("click", function () { loadMoreQuestions(); });
    }
    list.querySelectorAll("[data-qid]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        showQuestion(a.getAttribute("data-qid"));
      });
    });
    bindDelete(list);
  }
  function setFilter(f) {
    state.filter = f;
    var btns = $("comm-q-filters");
    if (btns) btns.querySelectorAll("[data-filter]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-filter") === f);
    });
    showList();
    loadQuestions();
  }
  function showList() {
    state.qid = null;
    state.currentQ = null;
    var detail = $("comm-q-detail"), list = $("comm-q-list");
    if (detail) { detail.hidden = true; detail.innerHTML = ""; }
    if (list) list.hidden = false;
    try {
      var u = new URLSearchParams(location.search);
      u.delete("q");
      history.replaceState(null, "", location.pathname + (u.toString() ? "?" + u.toString() : ""));
    } catch (e) {}
  }

  /* ---------------- questions: detail ---------------- */
  function showQuestion(id) {
    state.qid = id;
    switchTabSilent();
    var detail = $("comm-q-detail"), list = $("comm-q-list");
    if (list) list.hidden = true;
    if (!detail) return;
    detail.hidden = false;
    detail.innerHTML = '<p class="hint">Loading question…</p>';
    try {
      var u = new URLSearchParams(location.search);
      u.set("q", id);
      history.replaceState(null, "", location.pathname + "?" + u.toString());
    } catch (e) {}
    C.getQuestion(id).then(function (q) {
      if (!q) {
        detail.innerHTML = '<p class="hint">That question doesn\'t exist any more.</p>' +
          '<p><a class="comm-back" href="community.html">← All questions</a></p>';
        return;
      }
      state.currentQ = q;
      return C.listAnswers(id).then(function (answers) {
        state.currentAnswers = answers || [];
        renderDetail(q, state.currentAnswers);
      });
    }).catch(onApiError);
  }
  // Switch the tab UI to Questions without triggering a list reload.
  function switchTabSilent() {
    var tq = $("tab-questions"), ts = $("tab-showcase");
    if (tq) tq.classList.add("active");
    if (ts) ts.classList.remove("active");
    var pq = $("comm-questions"), ps = $("comm-showcase");
    if (pq) pq.hidden = false;
    if (ps) ps.hidden = true;
    state.tab = "questions";
  }
  /* ---------------- AI hint ----------------
     On-demand Socratic hint from the site's AI tutor (tutor-lesson mode:
     the question + lesson go in as context, the code/error as code/error).
     Never saved to Firestore — generated fresh per click, one daily-cap
     call each. The AI never writes the full fix, so it can't replace
     human answers; it just unblocks the asker while they wait. */
  function renderAiZone(q) {
    var zone = $("comm-ai-zone");
    if (!zone) return;
    zone.innerHTML = '<div class="card comm-ai"><h3>✨ Ask AI</h3>' +
      '<p class="hint">Waiting for a human? The AI tutor gives one Socratic hint — never the full fix.</p>' +
      '<button class="btn" type="button" id="comm-ai-btn">✨ Ask AI for a hint</button>' +
      '<div class="comm-ai-out" id="comm-ai-out" hidden></div></div>';
    var btn = $("comm-ai-btn");
    var out = $("comm-ai-out");
    if (!btn || !out) return;
    btn.addEventListener("click", function () {
      if (!window.SkillzifyAI || typeof window.SkillzifyAI.ask !== "function") { showError(ERR_MSG); return; }
      btn.disabled = true;
      btn.textContent = "AI is thinking…";
      out.hidden = false;
      out.innerHTML = '<p class="hint">Thinking…</p>';
      var lesson = "";
      try { lesson = C.lessonTitle(q.lessonId); } catch (e) { lesson = ""; }
      var note = "Community question: " + (q.title || "") + ". " + (q.body || "") + (lesson ? " Lesson: " + lesson + "." : "");
      var ctx = note;
      try { if (window.SkillzifyAI.buildContext) ctx = window.SkillzifyAI.buildContext({ note: note }); } catch (e) {}
      window.SkillzifyAI.ask({ mode: "tutor-lesson", code: q.code || "", error: q.error || "", context: ctx }, function (err, res) {
        btn.disabled = false;
        btn.textContent = "✨ Ask AI for a hint";
        if (err || !res || !res.text) {
          // P2-30: DAILY_CAP errors append the sign-in link, mirroring
          // placement's askExplain — a signed-out user who hits the
          // 20/day cap gets a path to the 200/day cap.
          var capLink = (err && err.code === "DAILY_CAP" && window.SkillzifyAI && window.SkillzifyAI.capLink) ? window.SkillzifyAI.capLink() : "";
          out.innerHTML = '<p class="comm-form-error">' + esc((err && err.message) || "The AI didn't answer — try again in a moment.") + "</p>" + capLink;
          return;
        }
        out.innerHTML = '<p class="comm-ai-badge">✨ AI hint' + (res.cached ? " (cached)" : "") + (res.offline ? " (offline)" : "") + "</p>" +
          "<p>" + nl2br(res.text) + "</p>" +
          '<p class="hint">Generated by Skillzify AI — a hint, not the full answer. Human answers below may go further.</p>';
      });
    });
  }

  function renderDetail(q, answers) {
    var detail = $("comm-q-detail");
    if (!detail) return;
    var uid = currentUid();
    var isAuthor = !!(uid && q.authorUid && uid === q.authorUid);
    var sorted = (answers || []).slice().sort(function (a, b) {
      if (a.isBest && !b.isBest) return -1;
      if (!a.isBest && b.isBest) return 1;
      return toMs(a.createdAt) - toMs(b.createdAt);
    });
    var html = '<p><a class="comm-back" href="community.html" data-back>← All questions</a></p>' +
      '<article class="card comm-q">' +
      "<h2>" + esc(q.title) + "</h2>" +
      '<p class="comm-meta">' + authorLink(q) +
      "<span>" + esc(relTime(q.createdAt)) + "</span>" +
      lessonTag(q) + statusPill(q) + "</p>" +
      (isAuthor ? '<div class="comm-actions"><button class="btn btn-sm btn-ghost" type="button" data-del-q="' + esc(q.id) + '">Delete question</button></div>' : "") +
      (q.body ? "<p>" + nl2br(q.body) + "</p>" : "") +
      (q.error ? '<p class="hint"><strong>Error:</strong> ' + esc(q.error) + "</p>" : "") +
      codeBlock(q.code, "q") +
      "</article>" +
      '<div id="comm-ai-zone"></div>' +
      '<h3 style="margin:18px 0 10px">' + sorted.length + (sorted.length === 1 ? " answer" : " answers") + "</h3>" +
      '<div id="comm-answers">' + (sorted.length ? sorted.map(function (a) {
        return '<article class="card comm-ans' + (a.isBest ? " comm-ans-best" : "") + '">' +
          '<p class="comm-meta">' + authorLink(a) +
          "<span>" + esc(relTime(a.createdAt)) + "</span>" +
          (a.isBest ? '<span class="comm-best">✓ Best answer</span>' : "") + "</p>" +
          "<p>" + nl2br(a.body) + "</p>" +
          codeBlock(a.code, "a-" + a.id) +
          (isAuthor && !a.isBest
            ? '<div class="comm-actions"><button class="btn btn-sm" type="button" data-best="' + esc(a.id) + '">Mark as best answer</button></div>'
            : "") +
          (a.authorUid && uid === a.authorUid
            ? '<div class="comm-actions"><button class="btn btn-sm btn-ghost" type="button" data-del-a="' + esc(a.id) + '">Delete</button></div>'
            : "") +
          "</article>";
      }).join("") : '<p class="hint">No answers yet — be the first to help.</p>') + "</div>" +
      '<div id="comm-answer-zone"></div>';
    detail.innerHTML = html;

    var back = detail.querySelector("[data-back]");
    if (back) back.addEventListener("click", function (e) { e.preventDefault(); showList(); loadQuestions(); });

    wireCodeButtons(detail, q.code, sorted);

    detail.querySelectorAll("[data-best]").forEach(function (b) {
      b.addEventListener("click", function () {
        b.disabled = true;
        C.markBest(q.id, b.getAttribute("data-best")).then(function () {
          toast("Best answer marked ✓", "success");
          showQuestion(q.id);
        }).catch(function () { b.disabled = false; onApiError(); });
      });
    });
    bindDelete(detail);
    renderAiZone(q);

    var zone = $("comm-answer-zone");
    if (!zone) return;
    zone.innerHTML = '<div class="card comm-form"><h3>Your answer</h3>' +
      '<form id="comm-answer-form">' +
      '<label>Answer<textarea id="ans-body" rows="4" placeholder="Explain it like you would to a friend — code alone rarely helps."></textarea></label>' +
      '<label>Code (optional)<textarea id="ans-code" rows="5" class="code-editor" placeholder="Paste a working example if it helps"></textarea></label>' +
      '<p class="comm-form-error" id="ans-error" hidden></p>' +
      '<div class="comm-actions"><button class="btn btn-primary" type="submit" id="ans-submit">Post answer</button></div>' +
      "</form></div>";
    var form = $("comm-answer-form");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      var body = $("ans-body").value.trim();
      var code = $("ans-code").value;
      var errEl = $("ans-error");
      if (!body) {
        if (errEl) { errEl.hidden = false; errEl.textContent = "Write an answer first."; }
        return;
      }
      if (errEl) errEl.hidden = true;
      if (interceptPost("answer", { body: body, code: code }, q.id, "community.html?q=" + q.id)) return;
      // P1-15: disable the Post button while the request is in flight,
      // so a double-click cannot post the same answer twice.
      var submitBtn = $("ans-submit");
      if (submitBtn) submitBtn.disabled = true;
      C.postAnswer(q.id, { body: body, code: code }).then(function () {
        toast("Answer posted", "success");
        showQuestion(q.id);
      }).catch(function () {
        if (submitBtn) submitBtn.disabled = false;
        onApiError();
      });
    });
  }
  // Copy / Open-in-Studio buttons inside a rendered block. The question's
  // own code uses prefix "q"; each answer's code uses "a-<answer id>".
  function wireCodeButtons(root, qCode, answers) {
    root.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var code = codeForPrefix(b.getAttribute("data-copy"), qCode, answers);
        if (code == null) return;
        copyText(code);
        toast("Copied", "success");
      });
    });
    root.querySelectorAll("[data-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        var code = codeForPrefix(b.getAttribute("data-open"), qCode, answers);
        if (code == null) return;
        openInStudio(code);
      });
    });
  }
  function codeForPrefix(prefix, qCode, answers) {
    if (prefix === "q") return qCode;
    if (prefix.indexOf("a-") === 0) {
      var id = prefix.slice(2);
      for (var i = 0; i < (answers || []).length; i++) {
        if (answers[i].id === id) return answers[i].code;
      }
    }
    return null;
  }

  /* ---------------- ask form ---------------- */
  function openAskForm() {
    var wrap = $("comm-ask-wrap"), gate = $("comm-ask-gate");
    if (!wrap) return;
    if (gate) gate.hidden = true;
    wrap.hidden = false;
    var t = $("ask-title");
    if (t) t.focus();
  }
  function closeAskForm() {
    var wrap = $("comm-ask-wrap");
    if (wrap) wrap.hidden = true;
  }
  function submitAsk(e) {
    e.preventDefault();
    if (!C) { showError(ERR_MSG); return; }
    var title = $("ask-title").value.trim();
    var body = $("ask-body").value.trim();
    var code = $("ask-code").value;
    var lessonId = $("ask-lesson").value.trim();
    var errEl = $("ask-error");
    var err = null;
    try { err = C.validateQuestion({ title: title, body: body, code: code }); } catch (ex) { err = null; }
    if (err) {
      if (errEl) { errEl.hidden = false; errEl.textContent = err; }
      return;
    }
    if (errEl) errEl.hidden = true;
    var qExId = pendingDraft ? (pendingDraft.exId || null) : null;
    var qErr = pendingDraft ? (pendingDraft.error || null) : null;
    if (interceptPost("question", {
      title: title, body: body, code: code,
      lessonId: lessonId || null, exId: qExId, error: qErr
    }, null, "community.html")) { pendingDraft = null; return; }
    C.askQuestion({
      title: title, body: body, code: code,
      lessonId: lessonId || null,
      exId: qExId,
      error: qErr
    }).then(function (id) {
      pendingDraft = null;
      var form = $("comm-ask-form");
      if (form) form.reset();
      closeAskForm();
      toast("Question posted", "success");
      state.filter = "all";
      setFilterPills("all");
      showQuestion(id);
    }).catch(onApiError);
  }
  function setFilterPills(f) {
    var btns = $("comm-q-filters");
    if (btns) btns.querySelectorAll("[data-filter]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-filter") === f);
    });
  }

  /* ---------------- showcase ---------------- */
  function loadShowcase() {
    var grid = $("comm-showcase-grid");
    if (!C) { showError(ERR_MSG); return; }
    if (grid) grid.innerHTML = '<p class="hint">Loading showcase…</p>';
    C.listShowcase().then(function (posts) {
      state.showcase = posts || [];
      state.showcaseLoaded = true;
      renderFeatured();
      renderShowcaseGrid();
      // Showcase-star badge: one of my posts has a star — record it and
      // re-check achievements (the badge unlocks in checkAchievements).
      try {
        var me = currentUid();
        // P2-34: the flag counts only stars from OTHER people — a
        // self-star no longer unlocks your own "Starred" badge (and
        // toggleStar now refuses self-stars outright). Posts without a
        // stars map (legacy data) fall back to the stored starCount.
        if (me && (posts || []).some(function (pp) {
          if (pp.authorUid !== me) return false;
          var stars = pp.stars || null;
          if (stars) return Object.keys(stars).some(function (k) { return k !== me; });
          return (pp.starCount || 0) > 0;
        })) {
          try { localStorage.setItem("skillzify_showcase_starred", "1"); } catch (e2) {}
          // Counters sync: push the starred flag to Firestore
          // (sync.js `counters` field, OR merge).
          try { if (window.SkillzifySync && typeof window.SkillzifySync.markDirty === "function") window.SkillzifySync.markDirty("counters"); } catch (e3) {}
          if (window.SkillzifyActivity && typeof window.SkillzifyActivity.checkAchievements === "function") window.SkillzifyActivity.checkAchievements();
        }
      } catch (e) {}
    }).catch(onApiError);
  }
  function showcaseCardHTML(p, featured) {
    var starred = !!(p.stars && currentUid() && p.stars[currentUid()]);
    return '<article class="card comm-card' + (featured ? " comm-featured" : "") + '">' +
      (featured ? '<div class="comm-featured-label">⭐ Featured this week</div>' : "") +
      "<h3>" + esc(p.title) + "</h3>" +
      '<p class="comm-meta">' + authorLink(p) +
      "<span>" + esc(relTime(p.createdAt)) + "</span></p>" +
      (p.desc ? '<p class="comm-excerpt">' + esc(excerpt(p.desc, 160)) + "</p>" : "") +
      (p.code ? '<div class="comm-code"><pre class="code hidden" data-showcode="' + esc(p.id) + '">' + esc(p.code) + "</pre></div>" : "") +
      '<div class="comm-actions">' +
      '<button class="comm-star' + (starred ? " on" : "") + '" type="button" data-star="' + esc(p.id) + '" aria-label="Star project" aria-pressed="' + (starred ? "true" : "false") + '">' +
      '<span data-star-icon="' + esc(p.id) + '">' + (starred ? "★" : "☆") + '</span> <span data-star-count="' + esc(p.id) + '">' + (p.starCount || 0) + "</span></button>" +
      (p.code ? '<button class="btn btn-sm btn-ghost" type="button" data-viewcode="' + esc(p.id) + '">View code</button>' : "") +
      '<button class="btn btn-sm" type="button" data-fork="' + esc(p.id) + '">Fork</button>' +
      (p.authorUid && currentUid() === p.authorUid
        ? '<button class="btn btn-sm btn-ghost" type="button" data-del-s="' + esc(p.id) + '">Delete</button>'
        : "") +
      "</div></article>";
  }
  function renderFeatured() {
    var box = $("comm-featured");
    if (!box) return;
    var f = null;
    try { f = C.pickFeatured(state.showcase, Date.now()); } catch (e) { f = null; }
    if (!f) { box.innerHTML = ""; return; }
    box.innerHTML = showcaseCardHTML(f, true);
    wireShowcaseButtons(box);
  }
  function renderShowcaseGrid() {
    var grid = $("comm-showcase-grid");
    if (!grid) return;
    var featured = null;
    try { featured = C.pickFeatured(state.showcase, Date.now()); } catch (e) { featured = null; }
    var rest = state.showcase.filter(function (p) { return !featured || p.id !== featured.id; });
    if (!state.showcase.length) {
      grid.innerHTML = '<p class="hint">Nothing shared yet — be the first to show what you built.</p>';
      return;
    }
    grid.innerHTML = rest.map(function (p) { return showcaseCardHTML(p, false); }).join("") ||
      '<p class="hint">Only the featured post so far — share yours below.</p>';
    wireShowcaseButtons(grid);
  }
  function wireShowcaseButtons(root) {
    root.querySelectorAll("[data-star]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!isSignedIn()) { toast("Sign in to star projects", "error"); return; }
        var id = b.getAttribute("data-star");
        var post = findPost(id);
        b.disabled = true;
        C.toggleStar(id).then(function (starred) {
          b.disabled = false;
          if (post) post.starCount = Math.max(0, (post.starCount || 0) + (starred ? 1 : -1));
          b.classList.toggle("on", !!starred);
          b.setAttribute("aria-pressed", starred ? "true" : "false");
          var icon = root.querySelector('[data-star-icon="' + id + '"]');
          if (icon) icon.textContent = starred ? "★" : "☆";
          var n = root.querySelector('[data-star-count="' + id + '"]');
          if (n) n.textContent = String(post ? post.starCount : 0);
        }).catch(function () { b.disabled = false; onApiError(); });
      });
    });
    root.querySelectorAll("[data-fork]").forEach(function (b) {
      b.addEventListener("click", function () {
        var post = findPost(b.getAttribute("data-fork"));
        if (!post) return;
        try { C.forkShowcase(post); } catch (e) { onApiError(); }
      });
    });
    root.querySelectorAll("[data-viewcode]").forEach(function (b) {
      b.addEventListener("click", function () {
        var pre = root.querySelector('[data-showcode="' + b.getAttribute("data-viewcode") + '"]');
        if (!pre) return;
        var hidden = pre.classList.toggle("hidden");
        b.textContent = hidden ? "View code" : "Hide code";
      });
    });
    bindDelete(root);
  }
  function findPost(id) {
    for (var i = 0; i < state.showcase.length; i++) {
      if (state.showcase[i].id === id) return state.showcase[i];
    }
    return null;
  }

  /* ---------------- share form ---------------- */
  function openShareForm() {
    var wrap = $("comm-share-wrap"), gate = $("comm-share-gate");
    if (!wrap) return;
    if (gate) gate.hidden = true;
    wrap.hidden = false;
    var t = $("share-title");
    if (t) t.focus();
  }
  function submitShare(e) {
    e.preventDefault();
    if (!C) { showError(ERR_MSG); return; }
    var title = $("share-title").value.trim();
    var desc = $("share-desc").value.trim();
    var code = $("share-code").value;
    var projectId = $("share-project").value.trim();
    var errEl = $("share-error");
    var err = null;
    try { err = C.validateShowcase({ title: title, desc: desc, code: code }); } catch (ex) { err = null; }
    if (err) {
      if (errEl) { errEl.hidden = false; errEl.textContent = err; }
      return;
    }
    if (errEl) errEl.hidden = true;
    if (interceptPost("showcase", { title: title, desc: desc, code: code, projectId: projectId || null }, null, "community.html?tab=showcase")) return;
    C.postShowcase({ title: title, desc: desc, code: code, projectId: projectId || null }).then(function () {
      var form = $("comm-share-form");
      if (form) form.reset();
      var wrap = $("comm-share-wrap");
      if (wrap) wrap.hidden = true;
      toast("Project shared", "success");
      loadShowcase();
    }).catch(onApiError);
  }

  /* ---------------- compiler draft (Stuck button) ---------------- */
  function readDraft() {
    var raw = null;
    try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    var d = null;
    try { d = JSON.parse(raw); } catch (e) { d = null; }
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    if (!d || typeof d !== "object") return;
    pendingDraft = d;
    if (d.code) { var c = $("ask-code"); if (c) c.value = d.code; }
    if (d.error) {
      var b = $("ask-body");
      if (b) b.value = (b.value ? b.value + "\n\n" : "") + "Error:\n" + d.error;
    }
    if (d.lessonId) { var l = $("ask-lesson"); if (l) l.value = d.lessonId; }
    openAskForm();
  }

  /* ---------------- init ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    if (!C) { showError(ERR_MSG); return; }
    hideError();

    var params = {};
    try { params = new URLSearchParams(location.search); } catch (e) { params = new URLSearchParams(); }
    var tabParam = params.get("tab");
    var qParam = params.get("q");
    var askParam = params.get("ask");

    // Tabs
    var tq = $("tab-questions"), ts = $("tab-showcase");
    if (tq) tq.addEventListener("click", function () { switchTab("questions"); });
    if (ts) ts.addEventListener("click", function () { switchTab("showcase"); });
    // P2-66: ArrowLeft/ArrowRight + Home/End on the tab list (ARIA tabs
    // keyboard pattern): move focus and activate the tab.
    function onTabKey(e) {
      var tabs = [tq, ts].filter(function (t) { return !!t; });
      var t = (e && e.currentTarget) || this;
      var i = tabs.indexOf(t);
      if (i < 0) return;
      var next = null;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === "Home") next = tabs[0];
      else if (e.key === "End") next = tabs[tabs.length - 1];
      else return;
      if (e.preventDefault) e.preventDefault();
      if (next) { next.focus(); next.click(); }
    }
    if (tq) tq.addEventListener("keydown", onTabKey);
    if (ts) ts.addEventListener("keydown", onTabKey);

    // Filters
    var filters = $("comm-q-filters");
    if (filters) filters.querySelectorAll("[data-filter]").forEach(function (b) {
      b.addEventListener("click", function () { setFilter(b.getAttribute("data-filter")); });
    });

    // Search (filters the loaded questions client-side)
    var search = $("comm-q-search");
    if (search) search.addEventListener("input", function () {
      state.query = search.value || "";
      renderQuestions();
    });

    // Lesson picker (the real lesson list — no typos, no bogus ids),
    // grouped by journey section.
    try {
      var sel = $("ask-lesson");
      if (sel && C.lessonList) {
        var curGroup = null, curLabel = null;
        C.lessonList().forEach(function (l) {
          if (l.sectionName !== curLabel) {
            curGroup = document.createElement("optgroup");
            curGroup.label = l.sectionName || "Lessons";
            sel.appendChild(curGroup);
            curLabel = l.sectionName;
          }
          var o = document.createElement("option");
          o.value = l.id; o.textContent = l.id + " — " + l.title;
          (curGroup || sel).appendChild(o);
        });
      }
    } catch (e) {}

    // Ask form
    var askBtn = $("comm-ask-btn");
    if (askBtn) askBtn.addEventListener("click", openAskForm);
    var askCancel = $("ask-cancel");
    if (askCancel) askCancel.addEventListener("click", closeAskForm);
    var askForm = $("comm-ask-form");
    if (askForm) askForm.addEventListener("submit", submitAsk);

    // Share form
    var shareBtn = $("comm-share-btn");
    if (shareBtn) shareBtn.addEventListener("click", openShareForm);
    var shareCancel = $("share-cancel");
    if (shareCancel) shareCancel.addEventListener("click", function () {
      var wrap = $("comm-share-wrap");
      if (wrap) wrap.hidden = true;
    });
    var shareForm = $("comm-share-form");
    if (shareForm) shareForm.addEventListener("submit", submitShare);

    // Re-render on Firebase auth resolve/change. The composers stay
    // open whatever the auth state is — sign-in is asked at submit,
    // not at the door — so nothing is hidden here. A post parked while
    // signed out goes out now that sign-in has landed.
    try {
      if (window.SkillzifyAuth && typeof window.SkillzifyAuth.onAuthChange === "function") {
        window.SkillzifyAuth.onAuthChange(function () {
          resumePendingPost();
          if (state.tab === "questions" && !state.qid) loadQuestions();
          if (state.tab === "showcase" && state.showcaseLoaded) loadShowcase();
        });
      }
    } catch (e) {}

    // Entry points
    readDraft();
    if (qParam) {
      showQuestion(qParam);
    } else if (tabParam === "showcase") {
      switchTab("showcase");
    } else {
      switchTab("questions");
      if (askParam === "1") openAskForm();
    }

    // Claim XP earned from best answers (grants are created when someone
    // marks your answer as best — a client can only write its own XP).
    try {
      if (C.claimXpGrants) C.claimXpGrants().then(function (n) {
        if (n > 0) toast("You earned " + n + " XP — someone marked your answer as best! 🎉", "success");
      }).catch(function () {});
    } catch (e) {}
  });
})();
