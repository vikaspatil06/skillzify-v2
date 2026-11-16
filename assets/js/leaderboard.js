/* ============================================================
   Skillzify — Leaderboard (unified redesign, 16 Nov 2026)
   Real data only: the Firestore `publicProfiles` collection
   (the same public docs the Skillzify Circle publishes via
   community.js / passport.js — displayName, xp, lessonsDone,
   streak, level). No invented people: an empty collection
   renders an honest empty state.

   Two mounts, driven by markup:
     [data-leaderboard="full"]  Community page — top 50 table,
                                own row highlighted; a pinned
                                "your rank" row when the signed-in
                                user is outside the top 50.
     [data-leaderboard="rank"]  Dashboard — personal rank card:
                                own rank, XP, and the XP gap to
                                the learner one rank above.
   Queries follow the codebase convention (community.js): a
   single orderBy only, no composite indexes. If the ordered
   query fails, a bounded unordered fetch is sorted client-side.
   ============================================================ */
(function () {
  "use strict";

  var LIMIT = 50;

  function db() {
    try {
      if (!window.firebase || !window.firebase.firestore) return null;
      if (!window.firebase.apps || !window.firebase.apps.length) return null;
      return window.firebase.firestore();
    } catch (e) { return null; }
  }
  function esc(s) {
    try { if (window.Skillzify && window.Skillzify.esc) return window.Skillzify.esc(s); } catch (e) {}
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function currentUser() {
    try { return window.SkillzifyAuth ? window.SkillzifyAuth.currentUser() : null; } catch (e) { return null; }
  }
  function levelName(p) {
    if (p.level) return String(p.level);
    try {
      var LC = window.SkillzifyLearnCore;
      if (LC && LC.levelFor) return (LC.levelFor(p.xp || 0) || {}).name || "";
    } catch (e) {}
    return "";
  }
  function rowsFromSnap(snap) {
    var rows = [];
    snap.forEach(function (doc) {
      var p = doc.data() || {};
      p.uid = doc.id;
      p.xp = Math.max(0, p.xp || 0);
      rows.push(p);
    });
    rows.sort(function (a, b) { return b.xp - a.xp; });
    return rows;
  }
  function fetchTop() {
    var d = db();
    if (!d) return Promise.reject(new Error("no-db"));
    return d.collection("publicProfiles").orderBy("xp", "desc").limit(LIMIT).get()
      .then(rowsFromSnap)
      .catch(function () {
        // Fallback: bounded fetch + client-side sort (same result,
        // no index requirement).
        return d.collection("publicProfiles").limit(LIMIT).get().then(rowsFromSnap);
      });
  }
  function fetchOwnDoc(uid) {
    var d = db();
    if (!d) return Promise.resolve(null);
    return d.collection("publicProfiles").doc(uid).get().then(function (doc) {
      if (!doc.exists) return null;
      var p = doc.data() || {};
      p.uid = doc.id;
      p.xp = Math.max(0, p.xp || 0);
      return p;
    }).catch(function () { return null; });
  }
  // Exact rank: (# profiles with strictly more XP) + 1.
  function fetchRank(xp) {
    var d = db();
    if (!d) return Promise.resolve(null);
    return d.collection("publicProfiles").where("xp", ">", xp).get()
      .then(function (snap) { return snap.size + 1; })
      .catch(function () { return null; });
  }
  // XP of the learner directly above (smallest XP greater than mine).
  function fetchAboveXp(xp) {
    var d = db();
    if (!d) return Promise.resolve(null);
    return d.collection("publicProfiles").where("xp", ">", xp).orderBy("xp").limit(1).get()
      .then(function (snap) {
        var v = null;
        snap.forEach(function (doc) { v = Math.max(0, (doc.data() || {}).xp || 0); });
        return v;
      })
      .catch(function () { return null; });
  }

  function rowHtml(p, rank, meUid) {
    var name = String(p.displayName || "Skillzify Learner").slice(0, 100);
    var lvl = levelName(p);
    var meta = [];
    if (lvl) meta.push(lvl);
    if (p.lessonsDone != null) meta.push(p.lessonsDone + " lessons");
    if (p.streak) meta.push("🔥 " + p.streak + "d");
    return '<div class="lb-row' + (meUid && p.uid === meUid ? " me" : "") + '">' +
      '<span class="lb-rank">#' + rank + "</span>" +
      '<span class="lb-avatar" aria-hidden="true">' + esc(name.charAt(0).toUpperCase() || "S") + "</span>" +
      '<span style="min-width:0"><a class="lb-name" href="profile.html?uid=' + encodeURIComponent(p.uid) + '">' + esc(name) + "</a>" +
      (meta.length ? '<div class="lb-meta">' + esc(meta.join(" · ")) + "</div>" : "") + "</span>" +
      '<span class="lb-xp">' + (p.xp || 0).toLocaleString() + " XP</span></div>";
  }

  var EMPTY_HTML = '<p class="lb-empty">No public profiles yet — the leaderboard fills up as learners join and publish their profiles. Complete lessons, earn XP, and publish yours from the <a href="passport.html">Skill Passport</a> to claim the first spot.</p>';
  var UNAVAILABLE_HTML = '<p class="lb-empty">Leaderboard is unavailable right now — check your connection and reload.</p>';

  function renderFull(el) {
    el.innerHTML = '<p class="lb-empty">Loading leaderboard…</p>';
    fetchTop().then(function (rows) {
      var u = currentUser();
      var meUid = u ? u.uid : null;
      if (!rows.length) { el.innerHTML = EMPTY_HTML; return; }
      var html = '<div class="lb-list">' + rows.map(function (p, i) { return rowHtml(p, i + 1, meUid); }).join("") + "</div>";
      el.innerHTML = html;
      if (!meUid) return;
      var mine = null, myRank = 0;
      rows.forEach(function (p, i) { if (p.uid === meUid) { mine = p; myRank = i + 1; } });
      if (mine) return; // already highlighted in the table
      // Signed in but outside the top 50: pinned row from the real
      // public doc + exact rank (count query), never invented.
      fetchOwnDoc(meUid).then(function (p) {
        if (!p) {
          el.innerHTML += '<div class="lb-pinned"><p class="lb-empty">You are not on the public board yet — publish your profile from the <a href="passport.html">Skill Passport</a> to join the leaderboard.</p></div>';
          return;
        }
        fetchRank(p.xp).then(function (rank) {
          el.innerHTML += '<div class="lb-pinned">' + rowHtml(p, rank || (LIMIT + "+"), meUid) + "</div>";
        });
      });
    }).catch(function () { el.innerHTML = UNAVAILABLE_HTML; });
  }

  function renderRank(el) {
    var u = currentUser();
    if (!u) {
      el.innerHTML = '<p class="lb-empty"><a href="auth.html">Log in</a> to see your rank on the public leaderboard.</p>';
      return;
    }
    el.innerHTML = '<p class="lb-empty">Loading your rank…</p>';
    fetchOwnDoc(u.uid).then(function (p) {
      if (!p) {
        var localXp = 0;
        try { localXp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0; } catch (e) {}
        el.innerHTML = '<div class="rank-card-num">—</div>' +
          '<p class="hint" style="margin:4px 0 0">' + localXp.toLocaleString() + ' XP earned. You are not on the public board yet — publish your profile from the <a href="passport.html">Skill Passport</a> to join the leaderboard.</p>';
        return;
      }
      Promise.all([fetchRank(p.xp), fetchAboveXp(p.xp)]).then(function (res) {
        var rank = res[0], aboveXp = res[1];
        var sub;
        if (rank === 1) sub = "Top of the board 🏆";
        else if (rank && aboveXp != null) sub = (aboveXp - p.xp).toLocaleString() + " XP behind #" + (rank - 1);
        else if (rank) sub = "Keep climbing!";
        else sub = "On the public board";
        el.innerHTML = '<div class="rank-card-num">#' + (rank || "—") + "</div>" +
          '<p class="hint" style="margin:4px 0 0">' + p.xp.toLocaleString() + " XP · " + sub + "</p>";
      });
    }).catch(function () { el.innerHTML = UNAVAILABLE_HTML; });
  }

  function mountAll() {
    document.querySelectorAll("[data-leaderboard]").forEach(function (el) {
      var mode = el.getAttribute("data-leaderboard");
      if (mode === "full") renderFull(el);
      else if (mode === "rank") renderRank(el);
    });
  }

  var wired = false;
  function init() {
    mountAll();
    // Auth resolves asynchronously — re-render once it settles so
    // the signed-in user's row/rank appears without a reload.
    if (!wired && window.SkillzifyAuth && typeof window.SkillzifyAuth.onAuthChange === "function") {
      wired = true;
      var lastUid = currentUser() ? currentUser().uid : null;
      window.SkillzifyAuth.onAuthChange(function () {
        var uid = currentUser() ? currentUser().uid : null;
        if (uid !== lastUid) { lastUid = uid; mountAll(); }
      });
    }
  }

  window.SkillzifyLeaderboard = { renderFull: renderFull, renderRank: renderRank, mountAll: mountAll };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
