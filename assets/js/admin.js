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
            wireSiteControls();
            wireErrors();
            scLoad();
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
    var plan = d.plan || null;
    var poolPct = plan && plan.userPool ? Math.min(100, Math.round((plan.userPoolUsed / plan.userPool) * 1000) / 10) : 0;
    var planRows = "";
    var planBar = "";
    if (plan) {
      planRows =
        '<div class="row"><span>Daily capacity (providers)</span><b>' + fmt(plan.capacity) + " / day</b></div>" +
        '<div class="row"><span>Admin reserve</span><b>' + fmt(plan.adminReserved) + " / day</b></div>" +
        '<div class="row"><span>Learner pool (shared)</span><b>' + fmt(plan.userPool) + " / day</b></div>" +
        '<div class="row"><span>Learner pool used today</span><b>' + fmt(plan.userPoolUsed) + " (" + poolPct + "%)</b></div>";
      planBar = '<div class="usage-bar" title="Learner pool used today"><span style="width:' + poolPct + '%"></span></div>' +
        '<p class="hint" style="margin:4px 0 0">Every learner answer — signed-in or anonymous — reserves from the shared pool, so learner traffic can never consume the admin reserve. Your answers never touch the pool.</p>';
    }
    el("admin-config").innerHTML =
      '<div class="kv">' +
      '<div class="row"><span>Anonymous cap</span><b>' + fmt(d.caps.anon) + " / day</b></div>" +
      '<div class="row"><span>Signed-in cap</span><b>' + fmt(d.caps.user) + " / day</b></div>" +
      '<div class="row"><span>Admin cap</span><b>' + fmt(d.caps.admin) + " / day</b></div>" +
      '<div class="row"><span>Admin email</span><b>' + esc(d.caps.adminEmail) + "</b></div>" +
      planRows +
      '<div class="row"><span>Gemini keys configured</span><b>' + fmt(sv.geminiKeys) + "</b></div>" +
      '<div class="row"><span>Groq spillover</span><b>' + (sv.groq ? "On" : "Off") + "</b></div>" +
      "</div>" +
      planBar +
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
    var poolLine = d.plan ? "\nLearner pool today: " + fmt(d.plan.userPoolUsed) + " / " + fmt(d.plan.userPool) + " (admin reserve " + fmt(d.plan.adminReserved) + " of " + fmt(d.plan.capacity) + " total)" : "";
    return "Skillzify admin — " + d.date + " (IST)\n" +
      "AI answers today: " + fmt(t.total) + " (signed-in " + fmt(t.userAnswers) + " · anonymous " + fmt(t.anonAnswers) + " · " + fmt(t.users) + " learner(s))" + poolLine + "\n" +
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

  /* ---------------- Site Controls (Page controls panel) ----------------
     Data: GET /api/admin/site-config (full state incl. the change
     log); writes: POST /api/admin/site-config — both behind the
     same verified admin token as the overview. A switch flip POSTs
     at once (no Save button); a failed POST re-renders from the
     last known state, so the switch visibly reverts. The master
     switch asks for confirmation before taking the site offline. */
  var SC_PAGES = [
    ["index.html", "Home"], ["learn.html", "Learn"], ["lesson.html", "Lesson"],
    ["practice.html", "Practice"], ["paths.html", "Learning Paths"], ["projects.html", "Projects"],
    ["community.html", "Community"], ["compiler.html", "Code Studio"], ["flowchart.html", "Flowchart Lab"],
    ["reference.html", "Reference"], ["dashboard.html", "Dashboard"], ["profile.html", "Profile"],
    ["passport.html", "Skill Passport"], ["map.html", "Journey Map"], ["placement.html", "Placement Test"],
    ["interview.html", "AI Interview"], ["about.html", "About"], ["contact.html", "Contact"]
  ];
  var SC_NAMES = {};
  SC_PAGES.forEach(function (p) { SC_NAMES[p[0]] = p[1]; });
  /* Ads (19 Nov 2026): placement names match the [data-ad-name]
     placeholders in the pages and the server's ADS_SLOTS list. */
  var SC_ADS_SLOTS = [
    ["home", "Home (bottom)"], ["learn", "Learn (bottom)"], ["lesson", "Lesson (end)"],
    ["dashboard", "Dashboard (bottom)"], ["practice", "Practice (bottom)"]
  ];
  var scState = null;
  var scBusy = false;
  var scWired = false;

  function scStatus(t, isErr) {
    var s = el("sc-status");
    if (!s) return;
    s.textContent = t || "";
    s.style.color = isErr ? "var(--danger)" : "";
  }
  function scSetEnabled() {
    var card = el("site-controls-card");
    if (!card) return;
    card.querySelectorAll("input, button").forEach(function (n) { n.disabled = scBusy; });
  }
  function scRender() {
    if (!scState) return;
    el("sc-main").style.display = "";
    var masterOn = scState.master !== false;
    el("sc-master-toggle").checked = masterOn;
    var mp = el("sc-master-pill");
    mp.textContent = masterOn ? "Live" : "Offline";
    mp.className = "chip " + (masterOn ? "ok" : "bad");
    var msgInput = el("sc-message");
    if (document.activeElement !== msgInput) msgInput.value = scState.message || "";
    el("sc-pages").innerHTML = SC_PAGES.map(function (p) {
      var f = p[0];
      var on = !(scState.pages && scState.pages[f] === false);
      var msg = (scState.pageMessages && scState.pageMessages[f]) || "";
      return '<div class="sc-page">' +
        '<div class="sc-page-top"><b>' + esc(p[1]) + "</b>" +
        '<span class="chip ' + (on ? "ok" : "bad") + '">' + (on ? "Live" : "Offline") + "</span>" +
        '<label class="sc-switch"><input type="checkbox" class="sc-page-toggle" data-page="' + f + '"' + (on ? " checked" : "") + '><span class="track"></span></label></div>' +
        '<div class="sc-msgedit"><input class="sc-input sc-page-msg" type="text" data-page="' + f + '" maxlength="300" placeholder="Default message" value="' + esc(msg) + '">' +
        '<button class="btn btn-sm btn-ghost sc-page-msg-save" type="button" data-page="' + f + '">Save</button></div>' +
        "</div>";
    }).join("");
    scAdsRender();
    scSetEnabled();
  }
  function scAdsRender() {
    if (!scState) return;
    var ads = scState.ads || { enabled: false, publisherId: "", slots: {} };
    var tog = el("sc-ads-toggle");
    if (tog) tog.checked = ads.enabled === true;
    var pub = el("sc-ads-pub");
    if (pub && document.activeElement !== pub) pub.value = ads.publisherId || "";
    var wrap = el("sc-ads-slots");
    if (!wrap) return;
    if (wrap.querySelector("input:focus")) return; // never clobber typing
    wrap.innerHTML = SC_ADS_SLOTS.map(function (s) {
      var v = (ads.slots && ads.slots[s[0]]) || "";
      return '<div class="sc-msgedit" style="margin-top:0;align-items:center">' +
        '<span class="hint" style="width:130px;flex:none">' + esc(s[1]) + "</span>" +
        '<input class="sc-input sc-ads-slot" type="text" data-slot="' + s[0] + '" maxlength="20" placeholder="Slot ID (digits)" value="' + esc(v) + '"></div>';
    }).join("");
  }
  function scAdsCollect() {
    var slots = {};
    document.querySelectorAll(".sc-ads-slot").forEach(function (n) {
      slots[n.getAttribute("data-slot")] = n.value.trim();
    });
    return {
      enabled: !!el("sc-ads-toggle").checked,
      publisherId: el("sc-ads-pub").value.trim(),
      slots: slots
    };
  }
  function scLoad() {
    return idToken().then(function (tok) {
      return fetch(BASE + "/api/admin/site-config?token=" + encodeURIComponent(tok || ""))
        .then(function (r) {
          if (!r.ok) throw new Error("http " + r.status);
          return r.json();
        })
        .then(function (d) {
          if (!d || !d.ok) throw new Error("bad state");
          scState = d;
          scStatus("");
          scRender();
        });
    }).catch(function () {
      scState = null;
      var main = el("sc-main");
      if (main) main.style.display = "none";
      scStatus("Couldn't reach the server — controls unavailable. (On a backend without Site Controls, this panel wakes up with that deploy.)", true);
    });
  }
  function scPost(patch, okMsg) {
    if (scBusy) return;
    scBusy = true;
    scSetEnabled();
    idToken().then(function (tok) {
      var body = {};
      Object.keys(patch).forEach(function (k) { body[k] = patch[k]; });
      body.token = tok || "";
      return fetch(BASE + "/api/admin/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().then(function (d) { return { status: r.status, d: d }; }, function () { return { status: r.status, d: null }; });
      });
    }).then(function (res) {
      scBusy = false;
      if (res.status === 200 && res.d && res.d.ok) {
        scState = res.d;
        scStatus(okMsg || "Saved.");
        scRender();
        return;
      }
      scStatus("Couldn't save that change" + (res.d && res.d.error ? " — " + res.d.error : "") + ". The controls were put back as they were.", true);
      scRender();
      scLoad();
    }).catch(function () {
      scBusy = false;
      scStatus("Couldn't reach the server — change not saved.", true);
      scRender();
      scLoad();
    });
  }
  /* ---- Client errors panel (Tier 2, 19 Nov 2026) ----
     Reads GET /api/admin/errors with the same verified admin token as
     the overview; Clear POSTs /api/admin/errors/clear. On a backend
     without the endpoint (older deploy), the panel says so plainly. */
  var ceWired = false;
  function ceStatus(t) { var s = el("ce-status"); if (s) s.textContent = t || ""; }
  function ceRender(list) {
    var box = el("ce-list");
    if (!box) return;
    if (!list || !list.length) { box.innerHTML = '<p class="hint">No errors reported. 🎉</p>'; return; }
    box.innerHTML = list.map(function (e) {
      var when = "";
      try { if (e.lastTs) when = new Date(e.lastTs).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (err) {}
      return '<div class="ce-row"><div class="ce-top"><b>' + esc(e.page || "(unknown page)") + "</b>" +
        (e.count > 1 ? ' <span class="chip bad">×' + e.count + "</span>" : "") +
        '<span class="hint">' + esc(when) + "</span></div>" +
        '<div class="ce-msg">' + esc(e.msg || "") + "</div>" +
        (e.src ? '<div class="hint">' + esc(e.src) + "</div>" : "") + "</div>";
    }).join("");
  }
  function ceLoad() {
    return idToken().then(function (tok) {
      return fetch(BASE + "/api/admin/errors?token=" + encodeURIComponent(tok || ""))
        .then(function (r) {
          if (!r.ok) throw new Error("http " + r.status);
          return r.json();
        })
        .then(function (d) {
          if (!d || !d.ok) throw new Error("bad payload");
          ceStatus("");
          ceRender(d.errors || []);
        });
    }).catch(function () {
      ceStatus("Couldn't reach the server — error list unavailable. (On a backend without client error reporting, this panel wakes up with that deploy.)");
    });
  }
  function ceClear() {
    if (!window.confirm("Clear all reported client errors?")) return;
    idToken().then(function (tok) {
      return fetch(BASE + "/api/admin/errors/clear?token=" + encodeURIComponent(tok || ""), { method: "POST" })
        .then(function (r) {
          if (!r.ok) throw new Error("http " + r.status);
          return r.json();
        });
    }).then(function () {
      ceStatus("Cleared.");
      ceRender([]);
    }).catch(function () {
      ceStatus("Couldn't clear — server unreachable.");
    });
  }
  function wireErrors() {
    var card = el("client-errors-card");
    if (!card || ceWired) return;
    ceWired = true;
    el("ce-refresh").addEventListener("click", ceLoad);
    el("ce-clear").addEventListener("click", ceClear);
    ceLoad();
  }

  function wireSiteControls() {
    var card = el("site-controls-card");
    if (!card || scWired) return;
    scWired = true;
    el("sc-master-toggle").addEventListener("change", function (ev) {
      var on = ev.target.checked;
      if (!on && !window.confirm("Take the WHOLE site offline for learners? Every content page will show the offline screen until you turn it back on.")) {
        ev.target.checked = true;
        return;
      }
      scPost({ master: on }, on ? "Site is live." : "Whole site is OFFLINE for learners.");
    });
    el("sc-message-save").addEventListener("click", function () {
      scPost({ message: el("sc-message").value }, "Default message saved.");
    });
    el("sc-ads-toggle").addEventListener("change", function () {
      var a = scAdsCollect();
      scPost({ ads: a }, a.enabled ? "Ads are ON." : "Ads are off.");
    });
    el("sc-ads-save").addEventListener("click", function () {
      scPost({ ads: scAdsCollect() }, "Ad settings saved.");
    });
    card.addEventListener("change", function (ev) {
      var t = ev.target;
      if (t && t.classList && t.classList.contains("sc-page-toggle")) {
        var f = t.getAttribute("data-page");
        var patch = { pages: {} };
        patch.pages[f] = t.checked;
        scPost(patch, (SC_NAMES[f] || f) + (t.checked ? " is live." : " is OFFLINE for learners."));
      }
    });
    card.addEventListener("click", function (ev) {
      var t = ev.target;
      if (t && t.classList && t.classList.contains("sc-page-msg-save")) {
        var f = t.getAttribute("data-page");
        var input = card.querySelector('.sc-page-msg[data-page="' + f + '"]');
        var patch = { pageMessages: {} };
        patch.pageMessages[f] = input ? input.value : "";
        scPost(patch, (SC_NAMES[f] || f) + " message saved.");
      }
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
