/* ============================================================
   Skillzify v2 — sync.js (Cross-device Firestore sync)
   Project: skillzify-1d0f2 (same Firebase project as the
   Android app).

   Syncs lesson progress, XP, streaks, exercise attempts and the
   profile between this website and the Android app via Cloud
   Firestore, per firestore-spec.md v1. Merge rules MUST stay
   identical on web + Android:

   - lessons: UNION of keys
   - xp: MAX(local, cloud)
   - streak: later streakLast wins (ISO compare); tie -> larger
     streakCount. Both fields copied from the winner.
   - exercises.attempts: per-exercise merge — solved/revealed OR,
     attempts/hintsUsed/lastTry MAX, bestMs MIN of non-zero (else 0)
   - profile: last-write-wins by updatedAt (whole document)
   - updatedAt: set to now on every local write that gets pushed

   localStorage streak dates are NORMALIZED to yyyy-MM-dd for the
   cloud (web historically stored Date.toDateString()). Both
   formats are accepted when reading.

   All public ops are no-ops when the Firestore SDK is missing or
   the user is signed out, and never throw — failures surface as
   the "Sync offline" status.
   ============================================================ */
(function () {
  "use strict";

  var root = (typeof window !== "undefined") ? window :
             (typeof global !== "undefined" ? global : this);

  /* ==========================================================
     PURE merge functions — no DOM, no storage, no Firebase.
     Exposed as window.SkillzifySyncMerge for unit testing.
     ========================================================== */
  function normalizeDate(d) {
    if (d === null || d === undefined) return null;
    var s = String(d).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already yyyy-MM-dd
    var t = new Date(s); // e.g. "Mon Nov 02 2026" (toDateString)
    if (isNaN(t.getTime())) return null;
    var m = t.getMonth() + 1, day = t.getDate();
    return t.getFullYear() + "-" +
           (m < 10 ? "0" + m : m) + "-" +
           (day < 10 ? "0" + day : day);
  }

  function mergeProgress(localDoc, cloudDoc) {
    localDoc = localDoc || {};
    cloudDoc = cloudDoc || {};
    // lessons: UNION of keys
    var lessons = {};
    [localDoc.lessons, cloudDoc.lessons].forEach(function (m) {
      if (m && typeof m === "object") {
        Object.keys(m).forEach(function (k) { lessons[k] = true; });
      }
    });
    // xp: MAX
    var xp = Math.max(localDoc.xp || 0, cloudDoc.xp || 0);
    // streak: later streakLast wins (ISO strings compare correctly);
    // tie (or both missing) -> larger streakCount. Copy both from winner.
    var lLast = normalizeDate(localDoc.streakLast);
    var cLast = normalizeDate(cloudDoc.streakLast);
    var streakLast, streakCount;
    if ((lLast || "") > (cLast || "")) {
      streakLast = lLast; streakCount = localDoc.streakCount || 0;
    } else if ((cLast || "") > (lLast || "")) {
      streakLast = cLast; streakCount = cloudDoc.streakCount || 0;
    } else {
      streakLast = lLast || cLast || null;
      streakCount = Math.max(localDoc.streakCount || 0, cloudDoc.streakCount || 0);
    }
    return {
      lessons: lessons,
      xp: xp,
      streakCount: streakCount,
      streakLast: streakLast,
      updatedAt: Math.max(localDoc.updatedAt || 0, cloudDoc.updatedAt || 0)
    };
  }

  function mergeExercises(localDoc, cloudDoc) {
    localDoc = localDoc || {};
    cloudDoc = cloudDoc || {};
    var la = (localDoc.attempts && typeof localDoc.attempts === "object") ? localDoc.attempts : {};
    var ca = (cloudDoc.attempts && typeof cloudDoc.attempts === "object") ? cloudDoc.attempts : {};
    var ids = {};
    Object.keys(la).forEach(function (k) { ids[k] = true; });
    Object.keys(ca).forEach(function (k) { ids[k] = true; });
    var out = {};
    Object.keys(ids).forEach(function (id) {
      var a = la[id] || {}, b = ca[id] || {};
      var bests = [a.bestMs || 0, b.bestMs || 0].filter(function (v) { return v > 0; });
      out[id] = {
        attempts: Math.max(a.attempts || 0, b.attempts || 0),
        solved: !!(a.solved || b.solved),
        hintsUsed: Math.max(a.hintsUsed || 0, b.hintsUsed || 0),
        revealed: !!(a.revealed || b.revealed),
        bestMs: bests.length ? Math.min.apply(null, bests) : 0,
        lastTry: Math.max(a.lastTry || 0, b.lastTry || 0)
      };
    });
    return {
      attempts: out,
      updatedAt: Math.max(localDoc.updatedAt || 0, cloudDoc.updatedAt || 0)
    };
  }

  function mergeProfile(localDoc, cloudDoc) {
    localDoc = localDoc || {};
    cloudDoc = cloudDoc || {};
    // last-write-wins by updatedAt (whole document); tie -> local
    var winner = (localDoc.updatedAt || 0) >= (cloudDoc.updatedAt || 0) ? localDoc : cloudDoc;
    return {
      name: winner.name || "",
      bio: winner.bio || "",
      updatedAt: Math.max(localDoc.updatedAt || 0, cloudDoc.updatedAt || 0)
    };
  }

  var Merge = {
    normalizeDate: normalizeDate,
    mergeProgress: mergeProgress,
    mergeExercises: mergeExercises,
    mergeProfile: mergeProfile
  };
  root.SkillzifySyncMerge = Merge;

  /* ==========================================================
     Sync engine (browser only — all browser APIs touched lazily)
     ========================================================== */
  var LS = {
    PROGRESS: "skillzify_progress",
    XP: "skillzify_xp",
    STREAK: "skillzify_streak",
    ATTEMPTS: "skillzify_exercise_attempts",
    PROFILE: "skillzify_profile",
    PROFILE_TS: "skillzify_profile_ts"
  };

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) {}
  }
  function storeGet(key, fb) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fb : JSON.parse(raw);
    } catch (e) { return fb; }
  }
  function storeSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ---------- local <-> cloud doc mapping ---------- */
  function readLocalProgress() {
    return {
      lessons: storeGet(LS.PROGRESS, {}) || {},
      xp: parseInt(lsGet(LS.XP) || "0", 10) || 0,
      streakCount: (storeGet(LS.STREAK, {}) || {}).count || 0,
      streakLast: normalizeDate((storeGet(LS.STREAK, {}) || {}).last),
      updatedAt: Date.now()
    };
  }
  function writeLocalProgress(doc) {
    storeSet(LS.PROGRESS, (doc && doc.lessons) || {});
    lsSet(LS.XP, String((doc && doc.xp) || 0));
    // write back normalized yyyy-MM-dd (both formats stay readable)
    storeSet(LS.STREAK, {
      last: normalizeDate(doc && doc.streakLast),
      count: (doc && doc.streakCount) || 0
    });
  }
  function readLocalExercises() {
    return {
      attempts: storeGet(LS.ATTEMPTS, {}) || {},
      updatedAt: Date.now()
    };
  }
  function writeLocalExercises(doc) {
    storeSet(LS.ATTEMPTS, (doc && doc.attempts) || {});
  }
  function readLocalProfile() {
    var p = storeGet(LS.PROFILE, {}) || {};
    return {
      name: p.name || "",
      bio: p.bio || "",
      updatedAt: parseInt(lsGet(LS.PROFILE_TS) || "0", 10) || 0
    };
  }
  function writeLocalProfile(doc) {
    storeSet(LS.PROFILE, { name: (doc && doc.name) || "", bio: (doc && doc.bio) || "" });
    lsSet(LS.PROFILE_TS, String((doc && doc.updatedAt) || 0));
  }

  /* ---------- Firebase guards ---------- */
  function db() {
    try {
      if (!root.firebase || !root.firebase.firestore) return null;
      if (!root.firebase.apps || !root.firebase.apps.length) return null;
      return root.firebase.firestore();
    } catch (e) { return null; }
  }
  function uid() {
    try {
      var u = root.firebase && root.firebase.auth && root.firebase.auth().currentUser;
      return u ? u.uid : null;
    } catch (e) { return null; }
  }
  function userDoc(d, u) {
    // Layout: ONE document per user at users/{uid} with three map fields:
    // { profile: {...}, progress: {...}, exercises: {...} }.
    // (A doc ref needs an even number of path segments; users/{uid}/profile
    // would be a collection path and is invalid.)
    return d.doc("users/" + u);
  }

  /* ---------- status ---------- */
  var statusCbs = [];
  var lastStatus = { text: "Sync offline", at: 0 };
  function setStatus(text) {
    lastStatus = { text: text, at: Date.now() };
    statusCbs.forEach(function (cb) { try { cb(lastStatus.text, lastStatus.at); } catch (e) {} });
    try {
      var els = document.querySelectorAll("[data-sync-status]");
      for (var i = 0; i < els.length; i++) els[i].textContent = text;
    } catch (e) {}
  }
  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }

  /* ---------- core: pull -> merge -> push ---------- */
  function syncCycle() {
    var d, u;
    try { d = db(); u = uid(); } catch (e) { d = null; u = null; }
    if (!d || !u) { setStatus("Sync offline"); return Promise.resolve(false); }
    setStatus("Syncing…");
    var ref;
    try { ref = userDoc(d, u); } catch (e) { setStatus("Sync offline"); return Promise.resolve(false); }
    return ref.get()
      .then(function (snap) {
        var data = (snap && snap.exists) ? snap.data() : {};
        var cloud = [data.profile || null, data.progress || null, data.exercises || null];
        var mergedProfile = mergeProfile(readLocalProfile(), cloud[0]);
        var mergedProgress = mergeProgress(readLocalProgress(), cloud[1]);
        var mergedExercises = mergeExercises(readLocalExercises(), cloud[2]);
        // write merged state locally…
        writeLocalProfile(mergedProfile);
        writeLocalProgress(mergedProgress);
        writeLocalExercises(mergedExercises);
        // …and push the merged doc to the cloud with updatedAt=now
        var now = Date.now();
        mergedProfile.updatedAt = now;
        mergedProgress.updatedAt = now;
        mergedExercises.updatedAt = now;
        lsSet(LS.PROFILE_TS, String(now));
        return ref.set({ profile: mergedProfile, progress: mergedProgress, exercises: mergedExercises },
          { merge: true }).catch(function () {});
      })
      .then(function () {
        setStatus("Synced ✓ " + fmtTime(Date.now()));
        return true;
      })
      .catch(function () {
        setStatus("Sync offline");
        return false;
      });
  }

  /* ---------- debounced push after local mutations ---------- */
  var pushTimer = null;
  function schedulePush() {
    try {
      if (!uid()) return; // signed out -> no-op, keep local data
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(function () { pushTimer = null; syncCycle(); }, 2000);
    } catch (e) {}
  }

  /* ---------- real-time listener: pull-only on external changes ----------
     The listener NEVER pushes — it only merges cloud -> local. Local
     changes push via syncCycle/markDirty. hasPendingWrites skips the
     echo of our own writes, so this cannot loop. */
  var unsubSnap = null;
  function pullOnly(data) {
    var cloud = [data.profile || null, data.progress || null, data.exercises || null];
    writeLocalProfile(mergeProfile(readLocalProfile(), cloud[0]));
    writeLocalProgress(mergeProgress(readLocalProgress(), cloud[1]));
    writeLocalExercises(mergeExercises(readLocalExercises(), cloud[2]));
    setStatus("Synced ✓ " + fmtTime(Date.now()));
    try {
      if (typeof CustomEvent === "function")
        window.dispatchEvent(new CustomEvent("skillzify-sync", { detail: { at: Date.now() } }));
    } catch (e) {}
  }
  function startListener() {
    try {
      var d = db(), u = uid();
      if (!d || !u) return;
      stopListener();
      unsubSnap = userDoc(d, u).onSnapshot(function (snap) {
        try {
          if (!snap || !snap.exists) return;
          if (snap.metadata && snap.metadata.hasPendingWrites) return; // our own write
          pullOnly(snap.data());
        } catch (e) {}
      }, function () {});
    } catch (e) {}
  }
  function stopListener() {
    try { if (unsubSnap) { unsubSnap(); unsubSnap = null; } } catch (e) {}
  }

  /* ---------- logout: push pending changes, then wipe local user data ----------
     Called BEFORE signOut so nothing is lost. The auth-state listener below
     also wipes as a safety net if logout happens another way. */
  function clearLocalUserData() {
    [LS.PROGRESS, LS.XP, LS.STREAK, LS.ATTEMPTS, LS.PROFILE, LS.PROFILE_TS].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  }
  function handleLogout() {
    stopListener();
    if (pushTimer) { try { clearTimeout(pushTimer); } catch (e) {} pushTimer = null; }
    var d, u;
    try { d = db(); u = uid(); } catch (e) { d = null; u = null; }
    if (!d || !u) { clearLocalUserData(); setStatus("Sync offline"); return Promise.resolve(); }
    try {
      return syncCycle().then(function () {
        clearLocalUserData(); setStatus("Sync offline");
      }).catch(function () {
        clearLocalUserData(); setStatus("Sync offline");
      });
    } catch (e) { clearLocalUserData(); setStatus("Sync offline"); return Promise.resolve(); }
  }

  /* ---------- public API ---------- */
  var inited = false;
  function init() {
    if (inited) return;
    inited = true;
    try {
      if (!root.firebase || !root.firebase.auth) { setStatus("Sync offline"); return; }
      root.firebase.auth().onAuthStateChanged(function (u) {
        try {
          if (u) { syncCycle(); startListener(); }
          else {
            stopListener();
            if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
            clearLocalUserData(); // safety net: never leave progress visible after logout
            setStatus("Sync offline"); // stop syncing; keep cloud data
          }
        } catch (e) { setStatus("Sync offline"); }
      });
    } catch (e) { setStatus("Sync offline"); }
  }

  function markDirty(hint) {
    try {
      // profile edits need a local updatedAt for last-write-wins
      if (hint === "profile") lsSet(LS.PROFILE_TS, String(Date.now()));
      schedulePush();
    } catch (e) {}
  }

  function onStatus(fn) {
    if (typeof fn === "function") {
      statusCbs.push(fn);
      try { fn(lastStatus.text, lastStatus.at); } catch (e) {}
    }
  }

  root.SkillzifySync = {
    init: init,
    markDirty: markDirty,
    onStatus: onStatus,
    handleLogout: handleLogout,
    syncNow: function () { try { return syncCycle(); } catch (e) { return Promise.resolve(false); } },
    getStatus: function () { return lastStatus.text; }
  };
})();
