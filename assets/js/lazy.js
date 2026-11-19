/* Skillzify lazy AI loader (v1, 19 Nov 2026).
 *
 * ai.js (~38 KB) used to load on every page whether the visitor ever
 * touched an AI feature or not. This stub takes its place in the page:
 * it exposes the same window.SkillzifyAI surface, and the first real
 * use (ask / usage / warmup — or a synchronous helper) injects the
 * real ai.js?v=23 and queues the call until it arrives. attachStatus
 * is the one exception: it registers the nav pill and paints its idle
 * state without loading anything, so a passive page view stays light.
 * Callback conventions match ai.js exactly: ask cb(err, res),
 * usage cb(err, data), warmup cb(bool). Synchronous helpers
 * (buildContext / capLink / explainErrorHTML) return the real value
 * once loaded; before that they trigger the load and return a safe
 * empty value — callers already treat those as best-effort, and ask()
 * itself rebuilds context from opts.extra when opts.context is empty.
 * If the script fails to load, queued callbacks receive an Error and
 * the next user action retries. */
(function () {
  "use strict";
  if (window.SkillzifyAI) return; // real ai.js already present; do nothing
  var AI_SRC = "assets/js/ai.js?v=23";
  var real = null, state = "idle", queue = [], pendingPills = [];
  function flush(err) {
    var q = queue; queue = [];
    for (var i = 0; i < q.length; i++) { try { q[i](err); } catch (e) {} }
  }
  function ensure() {
    if (real || state === "loading") return;
    state = "loading";
    try {
      var s = document.createElement("script");
      s.src = AI_SRC;
      s.onload = function () {
        if (window.SkillzifyAI && window.SkillzifyAI !== stub) {
          real = window.SkillzifyAI; state = "ready";
          var pills = pendingPills; pendingPills = [];
          for (var i = 0; i < pills.length; i++) { try { real.attachStatus(pills[i]); } catch (e) {} }
          flush(null);
        } else { state = "idle"; flush(new Error("ai-load")); }
      };
      s.onerror = function () { state = "idle"; flush(new Error("ai-load")); };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { state = "idle"; flush(new Error("ai-load")); }
  }
  var stub = {
    ask: function (opts, cb) {
      if (real) { real.ask(opts, cb); return; }
      queue.push(function (err) {
        if (err) { if (cb) { try { cb(err, null); } catch (e) {} } return; }
        real.ask(opts, cb);
      });
      ensure();
    },
    usage: function (cb) {
      if (real) { real.usage(cb); return; }
      queue.push(function (err) {
        if (err) { if (cb) { try { cb(err, null); } catch (e) {} } return; }
        real.usage(cb);
      });
      ensure();
    },
    warmup: function (cb) {
      if (real) { real.warmup(cb); return; }
      if (cb) queue.push(function (err) { if (!err && real) { try { real.warmup(cb); } catch (e) {} } });
      ensure();
    },
    attachStatus: function (el) {
      if (real) { real.attachStatus(el); return; }
      /* The nav pill must not force a 38 KB download just to show a
         grey dot: register the element, paint the idle state exactly
         as ai.js paints it, and hand the element to the real
         attachStatus when ai.js arrives for an actual AI feature.
         (One mirrored constant: idle = #6b7280 / "AI idle".) */
      if (!el) return;
      pendingPills.push(el);
      try {
        el.textContent = "";
        el.style.backgroundColor = "#6b7280";
        el.title = "\uD83E\uDD16 AI idle";
        el.setAttribute("aria-label", "AI status: AI idle");
        if (el.classList) el.classList.toggle("pulse", false);
      } catch (e) {}
    },
    getStatus: function () {
      if (real) return real.getStatus();
      return "idle";
    },
    explainError: function (err) {
      if (real) return real.explainError(err);
      ensure();
      return { code: "AI_LOAD", message: "The AI helper is still loading — try again in a moment." };
    },
    buildContext: function (extra) {
      if (real) return real.buildContext(extra);
      ensure();
      return "";
    },
    capLink: function () {
      if (real) return real.capLink();
      ensure();
      return "";
    },
    explainErrorHTML: function (err) {
      if (real) return real.explainErrorHTML(err);
      ensure();
      return "";
    }
  };
  window.SkillzifyAI = stub;
  window.SkillzifyLazyAI = { ensure: ensure };
})();
