/* Skillzify Profile page */
(function () {
  "use strict";
  var A = window.SkillzifyActivity;
  var S = window.Skillzify;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  function render() {
    var prof = A.profile();
    var user = null;
    try { var sess = S.storeGet("skillzify_session", null); if (sess) user = (S.storeGet("skillzify_users", [])).filter(function(u){return u.email===sess.email;})[0] || null; } catch (e) {}
    var name = prof.name || (user && user.name) || "Learner";
    var seed = (user && user.email) || name;

    document.getElementById("profile-avatar").innerHTML = A.identicon(seed, 96);
    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-bio").textContent = prof.bio || "Add a bio so future-you remembers why you started.";
    var xp = 0, done = 0;
    try { xp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0; } catch (e) {}
    try { done = Object.keys(JSON.parse(localStorage.getItem("skillzify_progress") || "{}")).length; } catch (e) {}
    var st = A.streak(), runs = A.runCount();
    var joined = null;
    try { joined = JSON.parse(localStorage.getItem("skillzify_users") || "[]"); } catch (e) {}
    var since = "recently";
    if (user && user.created) since = new Date(user.created).toLocaleDateString(undefined, { month: "short", year: "numeric" });
    document.getElementById("profile-meta").textContent = "🗓️ Learning since " + since + " · " + done + "/16 lessons";

    var stats = [
      ["⚡", xp.toLocaleString(), "Total XP"],
      ["📚", done + "/16", "Lessons done"],
      ["🔥", st.current + "d", "Day streak"],
      ["▶️", runs, "Code runs"]
    ];
    document.getElementById("profile-stats").innerHTML = stats.map(function (s) {
      return '<div class="dash-card stat"><div class="stat-ico">' + s[0] + '</div><div><div class="big">' + s[1] + '</div><div class="muted small">' + s[2] + '</div></div></div>';
    }).join("");

    var total = A.renderHeatmap(document.getElementById("profile-heatmap"));
    document.getElementById("activity-total").textContent = total + " contributions in the last year";

    var pins = A.pins();
    document.getElementById("profile-pins").innerHTML = pins.length ? pins.map(function (p) {
      var href = p.kind === "lesson" ? "learn.html#lesson-" + p.id : "compiler.html#snippet-" + p.id;
      return '<a class="pin-card" href="' + href + '"><span class="pin-ico">' + (p.kind === "lesson" ? "📚" : "📝") + '</span><span>' + esc(p.title) + '</span><button class="icon-btn pin-x" data-unpin="' + p.kind + ':' + p.id + '" aria-label="Unpin">✕</button></a>';
    }).join("") : '<p class="muted">Nothing pinned yet.</p>';

    var ach = A.achievements(), un = ach.filter(function (a) { return a.unlocked; });
    document.getElementById("ach-count").textContent = un.length + "/" + ach.length + " unlocked";
    document.getElementById("profile-achievements").innerHTML = ach.map(function (a) {
      return '<div class="ach ' + (a.unlocked ? "on" : "") + '" title="' + esc(a.desc) + (a.unlocked ? " — unlocked " + new Date(a.at).toLocaleDateString() : " — locked") + '">' +
        '<span class="ach-ico">' + (a.unlocked ? a.icon : "🔒") + '</span><span class="ach-name">' + esc(a.name) + '</span></div>';
    }).join("");

    var feed = A.feed(15);
    var icons = { lesson: "📚", run: "▶️", snippet: "📝", achievement: "🏆", star: "⭐" };
    document.getElementById("profile-feed").innerHTML = feed.length ? feed.map(function (e) {
      return '<div class="feed-item"><span>' + (icons[e.type] || "•") + '</span><span>' + esc(e.text) + '</span><time class="muted small">' + new Date(e.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + '</time></div>';
    }).join("") : '<p class="muted">No activity yet — complete a lesson or run some code.</p>';

    // unpin buttons
    Array.prototype.forEach.call(document.querySelectorAll("[data-unpin]"), function (b) {
      b.addEventListener("click", function (ev) {
        ev.preventDefault();
        var parts = b.getAttribute("data-unpin").split(":");
        var p = A.pins().filter(function (x) { return !(x.kind === parts[0] && x.id === parts[1]); });
        try { localStorage.setItem("skillzify_pins", JSON.stringify(p)); } catch (e) {}
        render();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    A.checkAchievements();
    render();
    var modal = document.getElementById("profile-modal");
    document.getElementById("edit-profile-btn").addEventListener("click", function () {
      var p = A.profile();
      document.getElementById("pf-name").value = p.name || "";
      document.getElementById("pf-bio").value = p.bio || "";
      modal.hidden = false;
    });
    document.getElementById("pf-cancel").addEventListener("click", function () { modal.hidden = true; });
    document.getElementById("pf-save").addEventListener("click", function () {
      A.saveProfile({ name: document.getElementById("pf-name").value.trim(), bio: document.getElementById("pf-bio").value.trim() });
      modal.hidden = true; render();
      S.toast("Profile updated ✨", "success");
    });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.hidden = true; });
  });
})();
