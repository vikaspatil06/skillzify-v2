/* ============================================================
   Skillzify Admin — the control room (admin.html)
   - Data comes from GET /api/admin/overview, which answers ONLY
     a verified admin token (server.js resolveIdentity +
     ADMIN_EMAIL). This page renders whatever the server allows;
     it holds no secrets and grants nothing by itself.
   - States: loading -> denied (signed out / not the admin) /
     unavailable (this server has no admin endpoint yet — e.g.
     the old production backend) / the full panel set.
   - Community counts are read straight from Firestore with the
     admin's own signed-in session (public community data).
   ============================================================ */
(function () {
  "use strict";

  var API_BASE = "https://skillzify-v2.onrender.com";
  var BASE = (function () {
    try { return /\.onrender\.com$/.test(window.location.hostname) ? "" : API_BASE; }
    catch (e) { return API_BASE; }
  })();

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
    });
  }
  function fmt(n) { return Number(n || 0).toLocaleString("en-IN"); }
  function fmtUptime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    if (d) return d + "d " + h + "h";
    if (h) return h + "h " + m + "m";
    if (m) return m + "m";
    return sec + "s";
  }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return String(iso || "");
    return Number(p[2]) + " " + (MONTHS[Number(p[1]) - 1] || "");
  }

  var lastOverview = null;
  var loading = false;

  function show(state) {
    el("admin-loading").style.display = state === "loading" ? "" : "none";
    el("admin-denied").style.display = state === "denied" ? "" : "none";
    el("admin-unavailable").style.display = state === "unavailable" ? "" : "none";
    el("admin-root").style.display = state === "root" ? "" : "none";
  }
  function toolsMsg(t) { var m = el("admin-tools-msg"); if (m) m.textContent = t || ""; }

  /* ---------------- data ---------------- */
  function authReady() {
    return new Promise(function (resolve) {
      try {
        var A = window.SkillzifyAuth;
        if (!A || typeof A.onReady !== "function") { resolve(); return; }
        var done = false;
        A.onReady(function () { if (!done) { done = true; resolve(); } });
        setTimeout(function () { if (!done) { done = true; resolve(); } }, 5000);
      } catch (e) { resolve(); }
    });
  }
  function currentUser() {
    try { return window.SkillzifyAuth ? window.SkillzifyAuth.currentUser() : null; }
    catch (e) { return null; }
  }
  function idToken() {
    try {
      var A = window.SkillzifyAuth;
      if (!A || typeof A.idToken !== "function") return Promise.resolve("");
      return A.idToken().catch(function () { return ""; });
    } catch (e) { return Promise.resolve(""); }
  }

  function load() {
    if (loading) return;
    loading = true;
    show("loading");
    authReady().then(function () {
      var u = currentUser();
      if (!u) {
        loading = false;
        el("admin-denied-msg").textContent = "You're signed out. Sign in with the admin account to see this page's data.";
        show("denied");
        return;
      }
      return idToken().then(function (tok) {
        return fetch(BASE + "/api/admin/overview?token=" + encodeURIComponent(tok || ""))
          .then(function (r) {
            if (r.status === 403) { loading = false; el("admin-denied-msg").textContent = "You're signed in as " + (u.email || "another account") + " — this page's data is served only to the verified admin account."; show("denied"); return null; }
            if (r.status === 404) { loading = false; show("unavailable"); return null; }
            if (!r.ok) { loading = false; show("unavailable"); return null; }
            return r.json();
          })
          .then(function (d) {
            loading = false;
            if (!d || !d.ok) return;
            lastOverview = d;
            render(d);
            show("root");
            loadCommunity();
          })
          .catch(function () { loading = false; show("unavailable"); });
      });
    }).catch(function () { loading = false; show("unavailable"); });
  }

  /* ---------------- render ---------------- */
  function statCard(k, v, s) {
    return '<div class="admin-stat"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div>' +
      (s ? '<div class="s">' + esc(s) + "</div>" : "") + "</div>";
  }
  function render(d) {
    el("admin-sub").textContent = "Signed in as " + d.me.email + " · " + fmtDate(d.date) + " (IST) · everything below is live from the server.";

    var sv = d.server || {};
    el("admin-stats").innerHTML =
      statCard("AI backend", sv.ai ? "On" : "Off", sv.geminiKeys + " Gemini key(s)" + (sv.groq ? " · Groq spillover on" : " · Groq off")) +
      statCard("Cap store", sv.capStore === "firestore" ? "Firestore" : "Memory", sv.capStore === "firestore" ? "Counts survive restarts" : "Counts reset on restart") +
      statCard("Token verification", sv.authVerify ? "On" : "Off", sv.authVerify ? "Identity is verified, not claimed" : "Legacy client-supplied identity") +
      statCard("Backend uptime", fmtUptime(sv.uptimeSec), "Since the last deploy / restart");

    /* today */
    var t = d.today || { total: 0, userAnswers: 0, anonAnswers: 0, users: 0, identities: [] };
    el("admin-today-sub").textContent = fmt(t.total) + " AI answers today — " + fmt(t.userAnswers) + " signed-in · " + fmt(t.anonAnswers) + " anonymous · " + fmt(t.users) + " learner(s) active.";
    var pct = d.me.cap > 0 ? Math.min(100, (d.me.used / d.me.cap) * 100) : 0;
    el("admin-me").innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><b>Your usage (admin)</b>' +
      "<span>" + fmt(d.me.used) + " / " + fmt(d.me.cap) + " · " + pct.toFixed(2) + "%</span></div>" +
      '<div class="usage-bar"><div style="width:' + pct.toFixed(2) + '%"></div></div>' +
      '<p class="hint" style="margin:0">Your cap is reserved like everyone else\u2019s — just a much bigger bucket.</p>';

    if (!t.identities.length) {
      el("admin-today-table").innerHTML = '<p class="hint" style="margin-top:14px">No AI answers yet today.</p>';
    } else {
      var max = t.identities[0].count || 1;
      var rows = t.identities.map(function (e, i) {
        var who = e.type === "user" ? e.who : e.who + " (IP)";
        var you = e.type === "user" && e.who === d.me.uid ? ' <span class="chip ok">you</span>' : "";
        var share = Math.max(2, Math.round((e.count / max) * 100));
        return "<tr><td>" + (i + 1) + "</td>" +
          "<td>" + (e.type === "user" ? '<span class="chip">👤 learner</span>' : '<span class="chip">🌐 anon</span>') + "</td>" +
          '<td class="who">' + esc(who) + you + "</td>" +
          '<td class="num"><b>' + fmt(e.count) + "</b></td>" +
          '<td style="min-width:90px"><div class="share"><div style="width:' + share + '%"></div></div></td></tr>';
      }).join("");
      el("admin-today-table").innerHTML =
        '<table class="admin-table" style="margin-top:14px"><thead><tr><th>#</th><th>Type</th><th>Identity</th><th class="num">Answers</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>";
    }

    /* days */
    var days = d.days || [];
    var dmax = 0;
    days.forEach(function (x) { if (x.total > dmax) dmax = x.total; });
    var cols = days.map(function (x) {
      var h = dmax > 0 ? Math.max(3, Math.round((x.total / dmax) * 100)) : 3;
      return '<div class="day-col"><div class="d-total">' + fmt(x.total) + '</div>' +
        '<div class="day-bar-wrap"><div class="day-bar" style="height:' + h + '%"></div></div>' +
        '<div class="d-label">' + esc(fmtDate(x.date)) + "</div></div>";
    }).join("");
    var drows = days.slice().reverse().map(function (x) {
      return "<tr><td>" + esc(fmtDate(x.date)) + (x.date === d.date ? ' <span class="chip ok">today</span>' : "") + "</td>" +
        '<td class="num"><b>' + fmt(x.total) + '</b></td><td class="num">' + fmt(x.userAnswers) + '</td><td class="num">' + fmt(x.anonAnswers) + '</td><td class="num">' + fmt(x.users) + "</td></tr>";
    }).join("");
    el("admin-days").innerHTML =
      '<div class="days-chart">' + cols + "</div>" +
      '<table class="admin-table" style="margin-top:10px"><thead><tr><th>Day</th><th class="num">Total</th><th class="num">Signed-in</th><th class="num">Anon</th><th class="num">Learners</th></tr></thead><tbody>' + drows + "</tbody></table>";

    /* config */
    var models = (sv.models || []).map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("");
    el("admin-config").innerHTML =
      '<div class="kv">' +
      '<div class="row"><span>Anonymous cap</span><b>' + fmt(d.caps.anon) + " / day</b></div>" +
      '<div class="row"><span>Signed-in cap</span><b>' + fmt(d.caps.user) + " / day</b></div>" +
      '<div class="row"><span>Admin cap</span><b>' + fmt(d.caps.admin) + " / day</b></div>" +
      '<div class="row"><span>Admin email</span><b>' + esc(d.caps.adminEmail) + "</b></div>" +
      '<div class="row"><span>Gemini keys configured</span><b>' + fmt(sv.geminiKeys) + "</b></div>" +
      '<div class="row"><span>Groq spillover</span><b>' + (sv.groq ? "On" : "Off") + "</b></div>" +
      "</div>" +
      "<p style=\"margin:14px 0 4px\"><b>Gemini failover order</b> <span class=\"hint\">(first success wins; quota/overload moves to the next)</span></p>" +
      "<ol class=\"models\">" + models + "</ol>" +
      (sv.groq ? "<p style=\"margin:10px 0 0\"><b>Groq models:</b> <span class=\"who\">" + esc((sv.groqModels || []).join(", ")) + "</span></p>" : "");
  }

  /* ---------------- community counts ---------------- */
  function commCell(label, id) {
    return '<div class="admin-stat"><div class="k">' + esc(label) + '</div><div class="v" id="' + id + '">…</div></div>';
  }
  function loadCommunity() {
    var host = el("admin-community");
    if (!host) return;
    host.innerHTML = commCell("❓ Questions", "comm-questions") + commCell("💬 Answers", "comm-answers") +
      commCell("🌟 Showcase posts", "comm-showcase") + commCell("👤 Public profiles", "comm-profiles");
    var db = null;
    try { if (window.firebase && firebase.firestore) db = firebase.firestore(); } catch (e) {}
    if (!db) { ["comm-questions", "comm-answers", "comm-showcase", "comm-profiles"].forEach(function (i) { el(i).textContent = "—"; }); return; }
    [["questions", "comm-questions"], ["answers", "comm-answers"], ["showcase", "comm-showcase"], ["publicProfiles", "comm-profiles"]].forEach(function (pair) {
      db.collection(pair[0]).get().then(function (snap) {
        var n = el(pair[1]); if (n) n.textContent = fmt(snap.size);
      }).catch(function () { var n = el(pair[1]); if (n) n.textContent = "—"; });
    });
  }

  /* ---------------- tools ---------------- */
  function summaryText(d) {
    var t = d.today || {};
    return "Skillzify admin — " + d.date + " (IST)\n" +
      "AI answers today: " + fmt(t.total) + " (signed-in " + fmt(t.userAnswers) + " · anonymous " + fmt(t.anonAnswers) + " · " + fmt(t.users) + " learner(s))\n" +
      "My usage: " + fmt(d.me.used) + " / " + fmt(d.me.cap) + " (admin)\n" +
      "Cap store: " + d.server.capStore + " · Token verification: " + (d.server.authVerify ? "on" : "off") +
      " · Gemini keys: " + d.server.geminiKeys + " · Groq: " + (d.server.groq ? "on" : "off");
  }
  function wireTools() {
    el("admin-refresh").addEventListener("click", function () { toolsMsg("Refreshing…"); load(); });
    el("admin-copy").addEventListener("click", function () {
      if (!lastOverview) { toolsMsg("Nothing to copy yet."); return; }
      var txt = summaryText(lastOverview);
      function done() { toolsMsg("Summary copied to clipboard."); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { toolsMsg(txt); });
      else toolsMsg(txt);
    });
    el("admin-warm").addEventListener("click", function () {
      toolsMsg("Waking the production backend…");
      var t0 = Date.now();
      fetch(API_BASE + "/api/health").then(function (r) { return r.json(); }).then(function (h) {
        var secs = ((Date.now() - t0) / 1000).toFixed(1);
        toolsMsg("Production backend answered in " + secs + "s — AI " + (h && h.ai ? "on" : "off") +
          (h && h.capStore ? ", cap store: " + h.capStore : ", still the old backend") + ".");
      }).catch(function () { toolsMsg("Production backend didn't answer — it may still be waking up. Try again in 30 seconds."); });
    });
  }

  /* ---------------- init ---------------- */
  var started = false;
  function start() {
    if (started) return;
    started = true;
    wireTools();
    load();
    try {
      if (window.SkillzifyAuth && typeof window.SkillzifyAuth.onAuthChange === "function") {
        window.SkillzifyAuth.onAuthChange(function () { if (!loading) load(); });
      }
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
