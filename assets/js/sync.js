/* ============================================================
   Skillzify v2 — sync.js (Cross-device Firestore sync)
   Project: skillzify-1d0f2 (same Firebase project as the
   Android app).

   Syncs lesson progress, XP, streaks, exercise attempts and the
   profile between this website and the Android app via Cloud
   Firestore, per firestore-spec.md v1. The Code Studio workspace
   (compiler files) syncs website-to-website only. Merge rules MUST stay
   identical on web + Android:

   - lessons: UNION of keys
   - xp: MAX(local, cloud)
   - streak: later streakLast wins (ISO compare); tie -> larger
     streakCount. Both fields copied from the winner.
     Known limitation (not redesigned): two devices active on
     different days can clobber each other's count — the winner's
     count survives whole, the loser's day is lost.
   - exercises.attempts: per-exercise merge — solved/revealed OR,
     attempts/hintsUsed/lastTry MAX, bestMs MIN of non-zero (else 0),
     at (first-solve time) earliest non-zero wins
   - progress.doneAt: per-lesson earliest non-zero wins (0/absent =
     unknown; a real completion ms beats 0; min of two non-zero)
   - projects: union of keys, per-project earliest non-zero wins
     (same rule as doneAt; 0 = done, date unknown, and survives)
   - profile: last-write-wins by updatedAt (whole document)
   - placement: last-write-wins by `date` (whole record — a pointer,
     not progress; see mergePlacement). Null when neither side has one,
     so a fresh device never pushes an empty placement.
   - counters: per-field MAX for reviewsDone/plansDone/bestAnswers/
     flowchartsDone, OR for showcaseStarred (see mergeCounters).
     Counters only grow, so MAX/OR is safe — same reasoning as xp.
   - achievements: UNION of unlocked ids (see mergeAchievements).
     The unlock record is permanent — a badge, once earned, is
     never revoked — so the union of both sides is always the
     truth, and the merged record can only grow.
   - customPaths: last-write-wins by updatedAt (whole document —
     same shape as profile). Definitions live in localStorage
     `skillzify_custom_paths` (array of {id, title, steps, ...});
     `skillzify_custom_paths_ts` records the last local save/delete
     so a device that never had definitions (updatedAt 0, empty)
     never wipes the cloud's, while a delete-all (updatedAt now,
     empty) propagates as the newest write.
   - workspace (website-only): per-file last-write-wins by each file's
     mtime, with a `deleted` tombstone map ({name: deletedAt}) so a
     deletion survives a stale device saving afterwards — a file
     survives only when its mtime is newer than its tombstone; an
     edit after the deletion resurrects it. tabs/active are
     last-write-wins by updatedAt, filtered to surviving files.
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

  /* Coerce non-numeric values (e.g. "abc") to 0 so a malformed doc
     can't poison xp / streak / updatedAt with NaN (P2-36). */
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }

  /* Earliest non-zero wins (passport §4a–b): union of keys; per key
     the minimum of the non-zero values, else the non-zero one, else
     0 (unknown). Keys both sides hold are kept even at 0 — a 0 is a
     real "done, date unknown" marker, not an absence. `ignore` keys
     (e.g. updatedAt on a flat cloud doc) are never treated as ids. */
  function earliestMap(a, b, ignore) {
    var out = {}, keys = {};
    [a, b].forEach(function (m) {
      if (m && typeof m === "object" && !Array.isArray(m)) {
        Object.keys(m).forEach(function (k) {
          if (!ignore || !ignore[k]) keys[k] = true;
        });
      }
    });
    Object.keys(keys).forEach(function (k) {
      var av = num((a || {})[k]), bv = num((b || {})[k]);
      var best = 0;
      if (av > 0 && bv > 0) best = Math.min(av, bv);
      else best = Math.max(av, bv);
      out[k] = best;
    });
    return out;
  }

  function mergeProgress(localDoc, cloudDoc) {
    localDoc = localDoc || {};
    cloudDoc = cloudDoc || {};
    // lessons: UNION of keys (arrays rejected — an array would create
    // phantom "0"/"1" entries; only truthy values count as done)
    var lessons = {};
    [localDoc.lessons, cloudDoc.lessons].forEach(function (m) {
      if (m && typeof m === "object" && !Array.isArray(m)) {
        Object.keys(m).forEach(function (k) { if (m[k]) lessons[k] = true; });
      }
    });
    // xp: MAX
    var xp = Math.max(num(localDoc.xp), num(cloudDoc.xp));
    // runCount: MAX, same as xp. Each origin counts only its own runs,
    // so the true total is at least the larger count. (SUM would
    // double-count after the first sync writes the merged value back.)
    var runCount = Math.max(num(localDoc.runCount), num(cloudDoc.runCount));
    // streak: later streakLast wins (ISO strings compare correctly);
    // tie (or both missing) -> larger streakCount. Copy both from winner.
    var lLast = normalizeDate(localDoc.streakLast);
    var cLast = normalizeDate(cloudDoc.streakLast);
    var streakLast, streakCount;
    if ((lLast || "") > (cLast || "")) {
      streakLast = lLast; streakCount = num(localDoc.streakCount);
    } else if ((cLast || "") > (lLast || "")) {
      streakLast = cLast; streakCount = num(cloudDoc.streakCount);
    } else {
      streakLast = lLast || cLast || null;
      streakCount = Math.max(num(localDoc.streakCount), num(cloudDoc.streakCount));
    }
    return {
      lessons: lessons,
      xp: xp,
      runCount: runCount,
      streakCount: streakCount,
      streakLast: streakLast,
      doneAt: earliestMap(localDoc.doneAt, cloudDoc.doneAt),
      updatedAt: Math.max(num(localDoc.updatedAt), num(cloudDoc.updatedAt))
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
      // P2-51: num() guards, like the neighbouring fields — a malformed
      // attempts: "abc" used to give Math.max("abc", 0) -> NaN, which
      // JSON.stringify writes as null into localStorage and Firestore.
      var bests = [num(a.bestMs), num(b.bestMs)].filter(function (v) { return v > 0; });
      var rec = {
        attempts: Math.max(num(a.attempts), num(b.attempts)),
        solved: !!(a.solved || b.solved),
        hintsUsed: Math.max(num(a.hintsUsed), num(b.hintsUsed)),
        revealed: !!(a.revealed || b.revealed),
        bestMs: bests.length ? Math.min.apply(null, bests) : 0,
        lastTry: Math.max(num(a.lastTry), num(b.lastTry))
      };
      // Passport §4c: first-solve time, earliest non-zero wins. A
      // pre-passport solve has no `at` — the key is left off entirely
      // rather than inventing one (display shows last-solve only).
      var fa = num(a.at), fb = num(b.at);
      var firstAt = (fa > 0 && fb > 0) ? Math.min(fa, fb) : Math.max(fa, fb);
      if (firstAt > 0) rec.at = firstAt;
      out[id] = rec;
    });
    return {
      attempts: out,
      updatedAt: Math.max(num(localDoc.updatedAt), num(cloudDoc.updatedAt))
    };
  }

  function mergeProfile(localDoc, cloudDoc) {
    localDoc = localDoc || {};
    cloudDoc = cloudDoc || {};
    // last-write-wins by updatedAt (whole document); tie -> local
    var winner = num(localDoc.updatedAt) >= num(cloudDoc.updatedAt) ? localDoc : cloudDoc;
    return {
      name: winner.name || "",
      bio: winner.bio || "",
      updatedAt: Math.max(num(localDoc.updatedAt), num(cloudDoc.updatedAt))
    };
  }

  /* ---------- projects (passport §4b) ----------
     Local shape: `skillzify_projects_done` {[projectId]: ms} (0 =
     done, date unknown — the legacy-array migration). Cloud shape:
     a FLAT top-level field `projects` ({<id>: ms, updatedAt}), like
     `paths`. Union of keys, per-project earliest non-zero wins. */
  function mergeProjects(localDoc, cloudDoc) {
    localDoc = localDoc || {}; cloudDoc = cloudDoc || {};
    var lp = (localDoc.projects && typeof localDoc.projects === "object" && !Array.isArray(localDoc.projects))
      ? localDoc.projects : {};
    var src = (cloudDoc.projects && typeof cloudDoc.projects === "object" && !Array.isArray(cloudDoc.projects))
      ? cloudDoc.projects : cloudDoc;
    if (!src || typeof src !== "object" || Array.isArray(src)) src = {};
    return {
      projects: earliestMap(lp, src, { updatedAt: true, projects: true }),
      updatedAt: Math.max(num(localDoc.updatedAt), num(cloudDoc.updatedAt))
    };
  }

  /* ---------- enrollment store (shared shape + array migration) ---------- */
  // canonical shape: { <pathId>: { enrolled: bool, at: timestamp } }
  function readEnrollMap() {
    var map = {};
    try {
      var v = JSON.parse(lsGet(LS.PATHS) || "null");
      if (Array.isArray(v)) {
        // migrate legacy array shape: presence counts, at=0 so real events win
        v.forEach(function (id) { map[id] = { enrolled: true, at: 0 }; });
      } else if (v && typeof v === "object") {
        Object.keys(v).forEach(function (k) {
          var e = v[k] || {};
          map[k] = { enrolled: !!e.enrolled, at: e.at || 0 };
        });
      }
    } catch (e) {}
    return map;
  }
  function writeEnrollMap(map) {
    lsSet(LS.PATHS, JSON.stringify(map || {}));
  }

  function mergePaths(localDoc, cloudDoc) {
    localDoc = localDoc || {}; cloudDoc = cloudDoc || {};
    var lp = localDoc.paths || {};
    // Cloud shape: the app (and new web writes) store the FLAT map
    // { <pathId>: {enrolled, at}, updatedAt }, while older web writes
    // stored the NESTED { paths: {...}, updatedAt }. Read both: unwrap
    // the `paths` key ONLY when its values are path-entry maps — a flat
    // doc can also carry a junk `paths` key ({enrolled, at}) left by old
    // app merges, whose values are scalars, not maps.
    var cp = cloudDoc;
    if (cloudDoc.paths && typeof cloudDoc.paths === "object" && !Array.isArray(cloudDoc.paths)) {
      var vals = Object.keys(cloudDoc.paths).map(function (k) { return cloudDoc.paths[k]; });
      if (vals.every(function (v) { return v && typeof v === "object" && !Array.isArray(v); })) cp = cloudDoc.paths;
    }
    var out = {}, maxAt = 0, seen = {};
    Object.keys(lp).concat(Object.keys(cp)).forEach(function (k) {
      if (seen[k]) return; seen[k] = true;
      if (k === "updatedAt" || k === "paths") return; // timestamp / legacy junk key, not a path
      var a = lp[k] || {}, b = cp[k] || {};
      if (typeof a !== "object" || a === null) a = {};
      if (typeof b !== "object" || b === null) b = {};
      // per-path last-write-wins by `at`; tie -> local. Leaving writes a
      // tombstone {enrolled:false}, so it propagates instead of resurrecting.
      var w = (a.at || 0) >= (b.at || 0) ? a : b;
      out[k] = { enrolled: !!w.enrolled, at: w.at || 0 };
      if (out[k].at > maxAt) maxAt = out[k].at;
    });
    return { paths: out, updatedAt: Math.max(maxAt, localDoc.updatedAt || 0, cloudDoc.updatedAt || 0) };
  }

  /* ---------- custom-path definitions (F5 "Build my path") ----------
     Local format (unchanged): an array of {id, title, steps, ...} in
     localStorage `skillzify_custom_paths`. Cloud shape mirrors the
     profile: { definitions: [...], updatedAt }. Whole-document
     last-write-wins by updatedAt; tie -> local. A side with no
     timestamp AND no definitions carries no information and never
     wins over a side that has definitions — so a fresh device can't
     wipe the cloud, while an explicit delete-all (empty definitions
     stamped with updatedAt=now by the save) propagates as the
     newest write. Corrupt/missing data degrades to "no information"
     on both the local read and the merge, and bad entries (no string
     id) are dropped, never the whole list. Pre-existing definitions
     saved before the timestamp key existed carry updatedAt 0 but
     still count as information because they are non-empty; the one
     exact-tie edge (both updatedAt 0, only one side non-empty)
     prefers the non-empty side so a migration tie can't wipe. */
  function sanitizeCustomPaths(v) {
    if (!Array.isArray(v)) return [];
    var out = [];
    v.forEach(function (cp) {
      if (!cp || typeof cp !== "object" || typeof cp.id !== "string" || !cp.id) return;
      out.push(cp);
    });
    return out;
  }
  function normalizeCustomPaths(doc) {
    // Accept the {definitions, updatedAt} shape and, defensively, a
    // raw array (never written by this code, but cheap to accept).
    if (Array.isArray(doc)) {
      var defs = sanitizeCustomPaths(doc);
      return { definitions: defs, updatedAt: 0, hasInfo: defs.length > 0 };
    }
    doc = doc || {};
    // A present-but-non-array `definitions` is malformed, not an
    // intentional empty list: it carries no information, so it can
    // never wipe the other side. (A real delete-all is an array [].)
    var isArr = Array.isArray(doc.definitions);
    var d = isArr ? sanitizeCustomPaths(doc.definitions) : [];
    var ts = (typeof doc.updatedAt === "number" && doc.updatedAt > 0) ? doc.updatedAt : 0;
    return { definitions: d, updatedAt: ts, hasInfo: isArr && (ts > 0 || d.length > 0) };
  }
  function mergeCustomPaths(localDoc, cloudDoc) {
    var l = normalizeCustomPaths(localDoc), c = normalizeCustomPaths(cloudDoc);
    if (!l.hasInfo && !c.hasInfo) return { definitions: [], updatedAt: 0 };
    if (!l.hasInfo) return { definitions: c.definitions, updatedAt: c.updatedAt };
    if (!c.hasInfo) return { definitions: l.definitions, updatedAt: l.updatedAt };
    var winner;
    if (l.updatedAt === c.updatedAt && l.updatedAt === 0) {
      // migration tie: both pre-timestamp — prefer the non-empty side
      winner = l.definitions.length ? l : c;
    } else {
      winner = l.updatedAt >= c.updatedAt ? l : c; // tie -> local
    }
    return {
      definitions: winner.definitions,
      updatedAt: Math.max(l.updatedAt, c.updatedAt)
    };
  }

  /* ---------- workspace (Code Studio files, website-only) ----------
     Local format: the compiler's `skillzify_ws` JSON
     { files: {name: code}, tabs: [names], active: name } plus a
     separate `skillzify_ws_ts` timestamp stamped on every local save.
     Cloud shape: { files, tabs, active, mtimes, deleted, updatedAt }.
     Per-file last-write-wins by each file's mtime, with a `deleted`
     tombstone map ({name: deletedAt}) — a file survives only when
     some side holds a copy edited AFTER its tombstone, so a stale
     device re-saving its old file set can never resurrect a deleted
     file; an edit after the deletion resurrects it instead. tabs /
     active are last-write-wins by updatedAt, filtered to the files
     that survive. A side with no files AND no tombstones carries no
     information and never wipes the cloud; a delete-all (no files,
     but tombstones) propagates as the newest write. Pre-timestamp
     workspaces (saved before mtimes existed) carry mtime 0, so a
     tombstone newer than 0 still deletes them. Corrupt/missing data
     degrades to "no information". */
  var WS_SYNC_MAX_BYTES = 700 * 1024;
  function sanitizeWorkspaceFiles(files) {
    var clean = {};
    if (!files || typeof files !== "object" || Array.isArray(files)) return clean;
    Object.keys(files).forEach(function (k) {
      if (typeof k === "string" && typeof files[k] === "string") clean[k] = files[k];
    });
    return clean;
  }
  function sanitizeTsMap(m) {
    var out = {};
    if (!m || typeof m !== "object" || Array.isArray(m)) return out;
    Object.keys(m).forEach(function (k) {
      var v = m[k];
      if (typeof k === "string" && typeof v === "number" && v > 0) out[k] = v;
    });
    return out;
  }
  function normalizeWorkspace(doc) {
    doc = doc || {};
    var files = sanitizeWorkspaceFiles(doc.files);
    var mtimes = sanitizeTsMap(doc.mtimes);
    var deleted = sanitizeTsMap(doc.deleted);
    var tabs = Array.isArray(doc.tabs)
      ? doc.tabs.filter(function (t) { return typeof files[t] === "string"; })
      : Object.keys(files);
    var active = (typeof doc.active === "string" && typeof files[doc.active] === "string")
      ? doc.active : (tabs[0] || null);
    var ts = (typeof doc.updatedAt === "number" && doc.updatedAt > 0) ? doc.updatedAt : 0;
    return { files: files, mtimes: mtimes, deleted: deleted, tabs: tabs, active: active, updatedAt: ts };
  }
  function mergeWorkspace(localDoc, cloudDoc) {
    var l = normalizeWorkspace(localDoc), c = normalizeWorkspace(cloudDoc);
    var names = {};
    [l.files, c.files, l.deleted, c.deleted].forEach(function (m) {
      Object.keys(m).forEach(function (k) { names[k] = true; });
    });
    var files = {}, mtimes = {}, deleted = {};
    Object.keys(names).forEach(function (name) {
      // A deletion is a tombstone, not an absence: the file survives
      // only when some side holds a copy edited AFTER the deletion.
      // A stale device re-saving its old file set therefore cannot
      // resurrect a deleted file — its mtime predates the tombstone.
      var d = Math.max(l.deleted[name] || 0, c.deleted[name] || 0);
      var lm = l.files.hasOwnProperty(name) ? (l.mtimes[name] || 0) : -1;
      var cm = c.files.hasOwnProperty(name) ? (c.mtimes[name] || 0) : -1;
      var bestM = Math.max(lm, cm);
      if (d === 0 ? bestM >= 0 : bestM > d) {
        if (lm >= cm) { files[name] = l.files[name]; mtimes[name] = lm; }
        else { files[name] = c.files[name]; mtimes[name] = cm; }
      } else if (d > 0) {
        deleted[name] = d; // deleted, and no newer copy exists anywhere
      }
    });
    // tabs/active: whole-doc LWW by updatedAt, filtered to survivors
    var w = l.updatedAt >= c.updatedAt ? l : c;
    var tabs = (w.tabs || []).filter(function (t) { return files.hasOwnProperty(t); });
    Object.keys(files).sort().forEach(function (n) { if (tabs.indexOf(n) < 0) tabs.push(n); });
    var active = (w.active && files.hasOwnProperty(w.active)) ? w.active : (tabs[0] || null);
    return { files: files, mtimes: mtimes, deleted: deleted, tabs: tabs, active: active,
             updatedAt: Math.max(l.updatedAt, c.updatedAt) };
  }
  /* ---------- reviews (spaced repetition, website-only) ----------
     Local shape: { lessonId: {interval, due, updatedAt} }; cloud shape:
     the same map plus a doc-level updatedAt. Merged per-lesson by later
     updatedAt (tie -> local), mirroring the workspace merge's spirit but
     without tombstones — a review entry is never deleted, only rescheduled. */
  function sanitizeReviewItems(items) {
    var out = {};
    if (!items || typeof items !== "object" || Array.isArray(items)) return out;
    Object.keys(items).forEach(function (id) {
      var e = items[id];
      if (e && typeof e === "object" && typeof e.interval === "number" && e.interval > 0 &&
          typeof e.due === "number" && e.due > 0 && typeof e.updatedAt === "number" && e.updatedAt > 0)
        out[id] = { interval: e.interval, due: e.due, updatedAt: e.updatedAt };
    });
    return out;
  }
  function normalizeReviews(doc) {
    doc = doc || {};
    var items = sanitizeReviewItems(doc.items || doc);
    var ts = (typeof doc.updatedAt === "number" && doc.updatedAt > 0) ? doc.updatedAt : 0;
    return { items: items, updatedAt: ts };
  }
  function mergeReviews(localDoc, cloudDoc) {
    var l = normalizeReviews(localDoc), c = normalizeReviews(cloudDoc);
    var items = {};
    var ids = {};
    [l.items, c.items].forEach(function (m) { Object.keys(m).forEach(function (k) { ids[k] = true; }); });
    Object.keys(ids).forEach(function (id) {
      var le = l.items[id], ce = c.items[id];
      if (le && ce) items[id] = (le.updatedAt >= ce.updatedAt) ? le : ce; // tie -> local
      else items[id] = le || ce;
    });
    return { items: items, updatedAt: Math.max(l.updatedAt, c.updatedAt) };
  }

  /* ---------- placement (Concept Map amplification, Part A2) ----------
     The placement test result is a POINTER, not progress (placement.js):
     { section, score, total, stages, date }. It syncs as a top-level
     `placement` field on users/{uid} — firestore.rules allows any field
     on the owner's own doc, so no rules change is needed. Whole-record
     last-write-wins by `date` (the save timestamp); tie -> local.
     A side with no valid record carries no information and never wipes
     the other side, so a fresh device can't erase a placement and a
     stale device can't resurrect one. Returns null when neither side
     has a valid record, so the caller omits the field from the push
     payload instead of poisoning the cloud with an empty value. */
  var PLACEMENT_SECTIONS = ["base-camp", "tool-shed", "object-castle", "algorithm-arena", "power-lab", "data-lab", "launch-pad"];
  function normalizePlacement(doc) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
    if (typeof doc.section !== "string" || PLACEMENT_SECTIONS.indexOf(doc.section) < 0) return null;
    var stages = (doc.stages && typeof doc.stages === "object" && !Array.isArray(doc.stages)) ? doc.stages : {};
    function stage(s) {
      s = (s && typeof s === "object") ? s : {};
      return { correct: num(s.correct), total: num(s.total) };
    }
    return {
      section: doc.section,
      score: num(doc.score),
      total: num(doc.total),
      stages: { a: stage(stages.a), b: stage(stages.b), c: stage(stages.c) },
      date: num(doc.date)
    };
  }
  function mergePlacement(localDoc, cloudDoc) {
    var l = normalizePlacement(localDoc), c = normalizePlacement(cloudDoc);
    if (!l && !c) return null;
    if (!l) return c;
    if (!c) return l;
    return (l.date >= c.date) ? l : c; // tie -> local
  }

  /* ---------- achievement counters (badge mismatch fix, 11 Nov 2026) ----------
     The 5 achievement counters live in localStorage and feed
     gatherState() in activity.js (reviews/plans/best-answers/
     showcase-starred/flowcharts). They never reached Firestore, so
     the same learner showed 9/32 badges on GitHub Pages and 8/32 on
     staging (First Flowchart — a flowchart rendered on one origin
     didn't count on the other). They sync as a top-level `counters`
     field on users/{uid} — firestore.rules allows any field on the
     owner's own doc, so no rules change is needed. Per-field MAX for
     the four numbers (counters only grow — same reasoning as xp),
     OR for showcaseStarred (true wins). A malformed/non-numeric
     value degrades to 0/false and can never poison the merge; a
     fresh device's all-zero counters can never lower the cloud,
     so the merged value is always pushed (no omit-when-empty rule
     like placement). */
  function normalizeCounters(doc) {
    doc = (doc && typeof doc === "object" && !Array.isArray(doc)) ? doc : {};
    return {
      reviewsDone: Math.max(0, num(doc.reviewsDone)),
      plansDone: Math.max(0, num(doc.plansDone)),
      bestAnswers: Math.max(0, num(doc.bestAnswers)),
      showcaseStarred: doc.showcaseStarred === true,
      flowchartsDone: Math.max(0, num(doc.flowchartsDone))
    };
  }
  function mergeCounters(localDoc, cloudDoc) {
    var l = normalizeCounters(localDoc), c = normalizeCounters(cloudDoc);
    return {
      reviewsDone: Math.max(l.reviewsDone, c.reviewsDone),
      plansDone: Math.max(l.plansDone, c.plansDone),
      bestAnswers: Math.max(l.bestAnswers, c.bestAnswers),
      showcaseStarred: !!(l.showcaseStarred || c.showcaseStarred),
      flowchartsDone: Math.max(l.flowchartsDone, c.flowchartsDone)
    };
  }

  /* ---------- achievement unlock record (app parity fix, 13 Nov 2026) ----------
     Web badges are rendered from the PERMANENT unlock record in
     localStorage `skillzify_achievements` ({id: unlockMs}) — the map
     activity.js persists in unlock()/checkAchievements() and reads
     in achievements(). The Android app keeps the same kind of record
     (synced as a top-level `achievements` field, {id: true}, UNION),
     but the badges it cannot re-derive from synced stats depend on
     evidence that exists ONLY in this browser and never entered
     users/{uid}: streak_7 ("On Fire") needs the longest streak,
     computed from the local-only activity-days log, and
     snippet_saver ("Curator") needs the localStorage snippets list.
     Without the record itself syncing, the app showed 7/32 where the
     web showed 9/32. So the record syncs in the SAME top-level
     `achievements` field — firestore.rules allows any field on the
     owner's own doc, so no rules change is needed. UNION of ids,
     grow-only like lessons: a badge once earned is never revoked, so
     neither side can ever re-lock the other. The cloud/app shape is
     {id: true} — only an exact `true` counts, so a malformed cloud
     value (string, number, nested object) can never fabricate an
     unlock; the local side keeps its unlock timestamps, and an id
     that exists only in the cloud enters the merged map as 0
     ("unlocked, time unknown") until writeLocalAchievements stamps
     its arrival on this device. */
  function mergeAchievements(localDoc, cloudDoc) {
    var out = {};
    if (localDoc && typeof localDoc === "object" && !Array.isArray(localDoc)) {
      Object.keys(localDoc).forEach(function (k) { if (localDoc[k]) out[k] = num(localDoc[k]) || 1; });
    }
    if (cloudDoc && typeof cloudDoc === "object" && !Array.isArray(cloudDoc)) {
      Object.keys(cloudDoc).forEach(function (k) {
        if (cloudDoc[k] === true && !out[k]) out[k] = 0;
      });
    }
    return out;
  }
  function reviewsTooBig(doc) {
    try { return unescape(encodeURIComponent(JSON.stringify((doc && doc.items) || {}))).length > 100 * 1024; }
    catch (e) { return false; }
  }
  function workspaceTooBig(doc) {
    try {
      var s = JSON.stringify({ files: (doc && doc.files) || {}, tabs: (doc && doc.tabs) || [], active: (doc && doc.active) || null,
                               mtimes: (doc && doc.mtimes) || {}, deleted: (doc && doc.deleted) || {} });
      return unescape(encodeURIComponent(s)).length > WS_SYNC_MAX_BYTES;
    } catch (e) { return false; }
  }

  /* ---------- content comparison (ignores updatedAt) ----------
     Key-order-insensitive deep equality, used by syncCycle to decide
     whether a merged field actually changed vs the cloud. */
  function deepEq(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== "object" || typeof b !== "object") return false;
    var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return false;
      if (!deepEq(a[ka[i]], b[kb[i]])) return false;
    }
    return true;
  }
  function contentChanged(merged, cloud) {
    if (!cloud) return true;
    var m = Object.assign({}, merged); delete m.updatedAt;
    var c = Object.assign({}, cloud); delete c.updatedAt;
    return !deepEq(m, c);
  }

  var Merge = {
    normalizeDate: normalizeDate,
    mergeProgress: mergeProgress,
    mergeExercises: mergeExercises,
    mergeProfile: mergeProfile,
    mergeProjects: mergeProjects,
    mergePaths: mergePaths,
    mergeCustomPaths: mergeCustomPaths,
    mergeWorkspace: mergeWorkspace,
    mergeReviews: mergeReviews,
    mergePlacement: mergePlacement,
    mergeCounters: mergeCounters,
    mergeAchievements: mergeAchievements,
    reviewsTooBig: reviewsTooBig,
    workspaceTooBig: workspaceTooBig,
    contentChanged: contentChanged
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
    PROFILE_TS: "skillzify_profile_ts",
    PATHS: "skillzify_enrolled_paths",
    CUSTOM_PATHS: "skillzify_custom_paths",
    CUSTOM_PATHS_TS: "skillzify_custom_paths_ts",
    WORKSPACE: "skillzify_ws",
    WORKSPACE_TS: "skillzify_ws_ts",
    REVIEWS: "skillzify_review",
    LAST_UID: "skillzify_last_uid",
    REVIEWS_TS: "skillzify_review_ts",
    // activity keys (activity.js) — also per-user, wiped on logout so the
    // next sign-in's syncCycle() cannot merge the previous user's data
    ACTIVITY_DAYS: "skillzify_activity_days",
    ACTIVITY_FEED: "skillzify_activity_feed",
    ACHIEVEMENTS: "skillzify_achievements",
    PINS: "skillzify_pins",
    STARS: "skillzify_stars",
    SNIPPETS: "skillzify_snippets",
    RUN_COUNT: "skillzify_run_count",
    // Placement test result (placement.js / learn-core.js) — per-user,
    // local-only, wiped on logout so the next user doesn't inherit it.
    PLACEMENT: "skillzify_placement",
    STREAK_BONUS: "skillzify_streak_bonus", // claimed 7/30-day bonus flags (activity.js)
    // P1-26: every other per-user key, so logout leaves a clean slate on
    // a shared device. Device-level keys are deliberately NOT here:
    // skillzify_theme, skillzify_accent, skillzify_coll_*, skillzify_cm_theme,
    // skillzify_cm_font stay put (they describe the device, not the user).
    // skillzify_ai_key IS wiped: it is the previous user's PERSONAL Gemini
    // key — keeping it would hand the next signed-in user free AI on
    // someone else's key and expose the key itself in Settings. A user who
    // wants the key on a shared device re-enters it after signing in.
    REVIEWS_DONE: "skillzify_reviews_done",
    PLANS_DONE: "skillzify_plans_done",
    BEST_ANSWERS: "skillzify_best_answers",
    SHOWCASE_STARRED: "skillzify_showcase_starred",
    FLOWCHARTS_DONE: "skillzify_flowcharts_done",
    SECTION_BONUS: "skillzify_section_bonus",
    PATH_BONUS: "skillzify_path_bonus",
    DAILY_PLAN: "skillzify_daily_plan",
    DAILY_CHALLENGE: "skillzify_daily_challenge",
    DAILY_CHALLENGE_FAILED: "skillzify_daily_challenge_failed",
    DRILLS: "skillzify_drills",
    DRILL_DEFS: "skillzify_drill_defs",
    VIVA_SESSION: "skillzify_viva_session",
    VIVA_LAST: "skillzify_viva_last",
    EXERCISE_DRAFTS: "skillzify_exercise_drafts",
    PROJECTS_DONE: "skillzify_projects_done",
    // Passport (System 3): lesson completion times, persisted
    // certificate records, and the passport privacy flag.
    DONE_AT: "skillzify_lesson_done_at",
    CERTIFICATES: "skillzify_certificates",
    PASSPORT_PRIVATE: "skillzify_passport_private",
    LESSON_STATE: "skillzify_lesson_state",
    RUNS: "skillzify_runs",
    WS_BACKUP: "skillzify_ws_backup",
    WS_BACKUP_AT: "skillzify_ws_backup_at",
    COMPILER_CODE: "skillzify_compiler_code",
    CODE_HISTORY: "skillzify_code_history",
    COMMUNITY_DRAFT: "skillzify_community_draft",
    AI_KEY: "skillzify_ai_key"
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
    var doneAt = {};
    try {
      var raw = storeGet(LS.DONE_AT, {}) || {};
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        Object.keys(raw).forEach(function (k) { doneAt[k] = num(raw[k]); });
      }
    } catch (e) {}
    return {
      lessons: storeGet(LS.PROGRESS, {}) || {},
      xp: parseInt(lsGet(LS.XP) || "0", 10) || 0,
      runCount: parseInt(lsGet(LS.RUN_COUNT) || "0", 10) || 0,
      streakCount: (storeGet(LS.STREAK, {}) || {}).count || 0,
      streakLast: normalizeDate((storeGet(LS.STREAK, {}) || {}).last),
      doneAt: doneAt,
      updatedAt: Date.now()
    };
  }
  function writeLocalProgress(doc) {
    storeSet(LS.PROGRESS, (doc && doc.lessons) || {});
    lsSet(LS.XP, String((doc && doc.xp) || 0));
    lsSet(LS.RUN_COUNT, String((doc && doc.runCount) || 0));
    // write back normalized yyyy-MM-dd (both formats stay readable)
    storeSet(LS.STREAK, {
      last: normalizeDate(doc && doc.streakLast),
      count: (doc && doc.streakCount) || 0
    });
    storeSet(LS.DONE_AT, (doc && doc.doneAt) || {});
  }
  function readLocalExercises() {
    return {
      attempts: storeGet(LS.ATTEMPTS, {}) || {},
      updatedAt: Date.now()
    };
  }
  /* ---------- projects (passport §4b) ---------- */
  function readLocalProjects() {
    // Legacy array shape (pre-passport) migrates in memory to
    // {[id]: 0} — done, date unknown. projects.js persists the same
    // migration on its own reads; sync never writes the array back.
    var m = {};
    try {
      var v = JSON.parse(lsGet(LS.PROJECTS_DONE) || "null");
      if (Array.isArray(v)) {
        v.forEach(function (id) { if (typeof id === "string") m[id] = 0; });
      } else if (v && typeof v === "object") {
        Object.keys(v).forEach(function (k) { m[k] = num(v[k]); });
      }
    } catch (e) {}
    return { projects: m, updatedAt: Date.now() };
  }
  function writeLocalProjects(doc) {
    storeSet(LS.PROJECTS_DONE, (doc && doc.projects) || {});
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
  function readLocalPaths() {
    var m = readEnrollMap(), maxAt = 0;
    Object.keys(m).forEach(function (k) { if (m[k].at > maxAt) maxAt = m[k].at; });
    return { paths: m, updatedAt: maxAt };
  }
  function writeLocalPaths(doc) {
    writeEnrollMap((doc && doc.paths) || {});
  }
  function readLocalCustomPaths() {
    // Corrupt JSON, a missing key, or a non-array value degrades to
    // "no information" (empty + updatedAt 0), so the merge keeps the
    // cloud's copy and the write-back below heals the local store.
    // Only a successfully parsed array may carry its timestamp.
    var defs = [], ts = 0;
    try {
      var raw = lsGet(LS.CUSTOM_PATHS);
      if (raw !== null) {
        var v = JSON.parse(raw);
        if (Array.isArray(v)) {
          defs = sanitizeCustomPaths(v);
          ts = parseInt(lsGet(LS.CUSTOM_PATHS_TS) || "0", 10) || 0;
        }
      }
    } catch (e) { defs = []; ts = 0; }
    return { definitions: defs, updatedAt: ts };
  }
  function writeLocalCustomPaths(doc) {
    storeSet(LS.CUSTOM_PATHS, (doc && doc.definitions) || []);
    lsSet(LS.CUSTOM_PATHS_TS, String((doc && doc.updatedAt) || 0));
  }
  function readLocalWorkspace() {
    var w = storeGet(LS.WORKSPACE, null);
    if (!w || typeof w !== "object" || !w.files || typeof w.files !== "object") {
      return { files: {}, tabs: [], active: null, updatedAt: 0 };
    }
    return {
      files: w.files,
      mtimes: (w.mtimes && typeof w.mtimes === "object") ? w.mtimes : {},
      deleted: (w.deleted && typeof w.deleted === "object") ? w.deleted : {},
      tabs: Array.isArray(w.tabs) ? w.tabs : Object.keys(w.files),
      active: (typeof w.active === "string") ? w.active : null,
      updatedAt: parseInt(lsGet(LS.WORKSPACE_TS) || "0", 10) || 0
    };
  }
  function writeLocalWorkspace(doc) {
    var files = (doc && doc.files) || {};
    var deleted = (doc && doc.deleted) || {};
    if (!Object.keys(files).length && !Object.keys(deleted).length) {
      // never wipe a real local workspace with an empty merge result
      var cur = storeGet(LS.WORKSPACE, null);
      if (cur && cur.files && Object.keys(cur.files).length) return;
    }
    storeSet(LS.WORKSPACE, {
      files: files,
      mtimes: (doc && doc.mtimes) || {},
      deleted: deleted,
      tabs: (doc && doc.tabs) || Object.keys(files),
      active: (doc && doc.active) || null
    });
    lsSet(LS.WORKSPACE_TS, String((doc && doc.updatedAt) || 0));
  }

  function readLocalReviews() {
    // Corrupt JSON or a non-object value degrades to "no information"
    // (empty + updatedAt 0), so the merge keeps the cloud's copy.
    var items = {}, ts = 0;
    try {
      var raw = lsGet(LS.REVIEWS);
      if (raw !== null) {
        var v = JSON.parse(raw);
        if (v && typeof v === "object" && !Array.isArray(v)) {
          Object.keys(v).forEach(function (id) {
            var e = v[id];
            if (e && typeof e === "object" && typeof e.interval === "number" && e.interval > 0 &&
                typeof e.due === "number" && e.due > 0 && typeof e.updatedAt === "number" && e.updatedAt > 0)
              items[id] = { interval: e.interval, due: e.due, updatedAt: e.updatedAt };
          });
          ts = parseInt(lsGet(LS.REVIEWS_TS) || "0", 10) || 0;
        }
      }
    } catch (e) { items = {}; ts = 0; }
    return { items: items, updatedAt: ts };
  }
  function writeLocalReviews(doc) {
    storeSet(LS.REVIEWS, (doc && doc.items) || {});
    lsSet(LS.REVIEWS_TS, String((doc && doc.updatedAt) || 0));
  }
  function readLocalPlacement() {
    // The raw record (or null); mergePlacement normalizes + validates,
    // so a corrupt or foreign section degrades to "no information".
    var v = storeGet(LS.PLACEMENT, null);
    return (v && typeof v === "object" && !Array.isArray(v)) ? v : null;
  }
  function writeLocalPlacement(doc) {
    if (!doc) return; // never wipe a local placement with "no information"
    storeSet(LS.PLACEMENT, doc);
  }
  function readLocalCounters() {
    return {
      reviewsDone: Math.max(0, parseInt(lsGet(LS.REVIEWS_DONE) || "0", 10) || 0),
      plansDone: Math.max(0, parseInt(lsGet(LS.PLANS_DONE) || "0", 10) || 0),
      bestAnswers: Math.max(0, parseInt(lsGet(LS.BEST_ANSWERS) || "0", 10) || 0),
      showcaseStarred: lsGet(LS.SHOWCASE_STARRED) === "1",
      flowchartsDone: Math.max(0, parseInt(lsGet(LS.FLOWCHARTS_DONE) || "0", 10) || 0)
    };
  }
  function writeLocalCounters(doc) {
    doc = doc || {};
    lsSet(LS.REVIEWS_DONE, String(Math.max(0, num(doc.reviewsDone))));
    lsSet(LS.PLANS_DONE, String(Math.max(0, num(doc.plansDone))));
    lsSet(LS.BEST_ANSWERS, String(Math.max(0, num(doc.bestAnswers))));
    lsSet(LS.SHOWCASE_STARRED, doc.showcaseStarred ? "1" : "0");
    lsSet(LS.FLOWCHARTS_DONE, String(Math.max(0, num(doc.flowchartsDone))));
  }
  function readLocalAchievements() {
    // The permanent unlock record activity.js maintains
    // ({id: unlockMs}). Corrupt JSON or a non-object value degrades
    // to "no local unlocks", so the merge keeps whatever the cloud
    // holds instead of throwing or wiping the record.
    var raw = storeGet(LS.ACHIEVEMENTS, null);
    var out = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      Object.keys(raw).forEach(function (k) { if (raw[k]) out[k] = num(raw[k]) || 1; });
    }
    return out;
  }
  function writeLocalAchievements(doc) {
    var out = {};
    doc = doc || {};
    Object.keys(doc).forEach(function (k) {
      // A 0 marks an unlock that arrived from the cloud/app: its real
      // unlock time never synced, so stamp its arrival on this device
      // (the `at` is display-only — the badge itself is the record).
      out[k] = doc[k] ? doc[k] : Date.now();
    });
    storeSet(LS.ACHIEVEMENTS, out);
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
    // Layout: ONE document per user at users/{uid} with map fields:
    // { profile: {...}, progress: {...}, exercises: {...}, paths: {...},
    //   customPaths: {...}, workspace: {...}, projects: {...},
    //   placement: {...}, counters: {...}, achievements: {...} }. The Android app reads its fields by name
    // and ignores the rest, so the extra customPaths/workspace fields are safe.
    // NOTE: `workspace` is website-only for now — the Android app has its
    // own local compiler workspace and does not read this field.
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
  // buildMerged(data): merge one cloud snapshot against local state and
  // build the push payload. Pure except for the stamp-if-changed lsSet
  // calls (idempotent, so a retried transaction re-running it is safe).
  // It never writes merged state locally — the caller does that only
  // AFTER the cloud write commits, so a failed/aborted transaction
  // leaves local state untouched.
  function buildMerged(data) {
    data = data || {};
    var cloud = [data.profile || null, data.progress || null, data.exercises || null, data.paths || null, data.customPaths || null, data.workspace || null, data.reviews || null, data.projects || null];
    var mergedProfile = mergeProfile(readLocalProfile(), cloud[0]);
    var mergedProgress = mergeProgress(readLocalProgress(), cloud[1]);
    var mergedExercises = mergeExercises(readLocalExercises(), cloud[2]);
    var mergedPaths = mergePaths(readLocalPaths(), cloud[3]);
    var mergedCustomPaths = mergeCustomPaths(readLocalCustomPaths(), cloud[4]);
    var mergedWorkspace = mergeWorkspace(readLocalWorkspace(), cloud[5]);
    var mergedReviews = mergeReviews(readLocalReviews(), cloud[6]);
    var mergedProjects = mergeProjects(readLocalProjects(), cloud[7]);
    // Placement: last-write-wins by date; null when neither side has a
    // valid record (omitted from the payload, never pushed as empty).
    var mergedPlacement = mergePlacement(readLocalPlacement(), data.placement || null);
    // Counters: per-field MAX / OR — a fresh device's zeros can never
    // lower the cloud, so the merged value is always pushed.
    var mergedCounters = mergeCounters(readLocalCounters(), data.counters || null);
    // Achievements: UNION of the permanent unlock record — grow-only,
    // so the merged value is pushed in the app's {id: true} shape
    // whenever the union is non-empty (an empty union is omitted,
    // never pushed as an empty map, mirroring placement).
    var mergedAchievements = mergeAchievements(readLocalAchievements(), data.achievements || null);
    // Profile and customPaths are whole-document last-write-wins by
    // updatedAt, so ONLY stamp them when this device actually contributed
    // a change — re-stamping an unchanged doc let an idle device's old
    // content win over a genuinely newer edit from another device.
    // progress/exercises/paths merge per-item, so their timestamps can't
    // clobber anything.
    var now = Date.now();
    if (contentChanged(mergedProfile, cloud[0])) {
      mergedProfile.updatedAt = now;
      lsSet(LS.PROFILE_TS, String(now));
    } else {
      mergedProfile.updatedAt = (cloud[0] && cloud[0].updatedAt) || mergedProfile.updatedAt || 0;
    }
    if (contentChanged(mergedCustomPaths, cloud[4])) {
      mergedCustomPaths.updatedAt = now;
      lsSet(LS.CUSTOM_PATHS_TS, String(now));
    } else {
      mergedCustomPaths.updatedAt = (cloud[4] && cloud[4].updatedAt) || mergedCustomPaths.updatedAt || 0;
    }
    // Workspace: same stamp-if-changed rule — but an empty merge
    // (neither side has files NOR tombstones) must never be stamped
    // or pushed, or a fresh device would poison the cloud with an
    // empty workspace carrying a fresh timestamp. A delete-all
    // (no files, but tombstones) DOES count as information.
    var wsHasFiles = Object.keys(mergedWorkspace.files || {}).length > 0 ||
                     Object.keys(mergedWorkspace.deleted || {}).length > 0;
    if (wsHasFiles && contentChanged(mergedWorkspace, cloud[5])) {
      mergedWorkspace.updatedAt = now;
      lsSet(LS.WORKSPACE_TS, String(now));
    } else {
      mergedWorkspace.updatedAt = (cloud[5] && cloud[5].updatedAt) || mergedWorkspace.updatedAt || 0;
    }
    // Reviews: same stamp-if-changed rule as the workspace — an
    // empty merge (no scheduled reviews anywhere) must never be
    // stamped or pushed, or a fresh device would poison the cloud
    // with an empty reviews map carrying a fresh timestamp.
    var rvHasItems = Object.keys(mergedReviews.items || {}).length > 0;
    if (rvHasItems && contentChanged(mergedReviews, cloud[6])) {
      mergedReviews.updatedAt = now;
      lsSet(LS.REVIEWS_TS, String(now));
    } else {
      mergedReviews.updatedAt = (cloud[6] && cloud[6].updatedAt) || mergedReviews.updatedAt || 0;
    }
    mergedProgress.updatedAt = now;
    mergedExercises.updatedAt = now;
    mergedPaths.updatedAt = now;
    mergedProjects.updatedAt = now;
    // NOTE: `paths` is pushed FLAT ({ <pathId>: {enrolled, at}, updatedAt })
    // to match the Android app — the old nested { paths: {...} } shape is
    // what broke cross-device enrollment sync (each side read the shape
    // the other never wrote). mergePaths still reads both shapes.
    // `projects` is pushed flat the same way ({ <id>: ms, updatedAt }).
    var flatPaths = Object.assign({}, mergedPaths.paths, { updatedAt: now });
    var flatProjects = Object.assign({}, mergedProjects.projects, { updatedAt: now });
    var payload = { profile: mergedProfile, progress: mergedProgress, exercises: mergedExercises, paths: flatPaths, customPaths: mergedCustomPaths, projects: flatProjects, counters: mergedCounters };
    // Placement carries its own date as the last-write-wins key, so it
    // needs no re-stamping — the merged record is pushed as-is, and only
    // when at least one side actually holds a placement.
    if (mergedPlacement) payload.placement = mergedPlacement;
    // Achievements carry no timestamp of their own in the payload —
    // just the set of unlocked ids in the app's {id: true} shape.
    var achPayload = {};
    Object.keys(mergedAchievements).forEach(function (k) { achPayload[k] = true; });
    if (Object.keys(achPayload).length) payload.achievements = achPayload;
    var wsSkipped = false;
    if (wsHasFiles && !workspaceTooBig(mergedWorkspace)) {
      payload.workspace = mergedWorkspace;
    } else if (wsHasFiles) {
      wsSkipped = true; // too large for the 1 MiB doc limit: keep cloud's copy
    }
    if (rvHasItems && !reviewsTooBig(mergedReviews)) payload.reviews = mergedReviews;
    return {
      profile: mergedProfile, progress: mergedProgress, exercises: mergedExercises,
      paths: mergedPaths, customPaths: mergedCustomPaths, workspace: mergedWorkspace,
      reviews: mergedReviews, projects: mergedProjects, placement: mergedPlacement, counters: mergedCounters, achievements: mergedAchievements, payload: payload, wsSkipped: wsSkipped
    };
  }
  // Write a merged result locally + report success. Runs only after the
  // cloud write has committed.
  function applyMerged(m) {
    writeLocalProfile(m.profile);
    writeLocalProgress(m.progress);
    writeLocalExercises(m.exercises);
    writeLocalPaths(m.paths);
    writeLocalCustomPaths(m.customPaths);
    writeLocalWorkspace(m.workspace);
    writeLocalReviews(m.reviews);
    writeLocalProjects(m.projects);
    writeLocalPlacement(m.placement);
    writeLocalCounters(m.counters);
    writeLocalAchievements(m.achievements);
    if (m.wsSkipped) setStatus("Workspace too large to sync (700 KB limit)");
    else setStatus("Synced \u2713 " + fmtTime(Date.now()));
    try {
      if (typeof CustomEvent === "function")
        window.dispatchEvent(new CustomEvent("skillzify-sync", { detail: { at: Date.now() } }));
    } catch (e) {}
    return true;
  }
  // P1-29: syncCycle runs the read-merge-write inside ONE Firestore
  // transaction (same precedent as community.js toggleStar) whenever the
  // SDK offers runTransaction, so a concurrent write from another device
  // cannot be silently dropped by a stale read-then-write. The
  // transaction re-runs its function on contention, re-reading and
  // re-merging against the newest cloud doc each time; local state is
  // written only after the transaction commits.
  // P1-25: the resolved value REPORTS the push — true only when the cloud
  // write committed, false on any failure (previously the set() error was
  // swallowed with .catch(function () {}) and syncCycle resolved true
  // regardless, so handleLogout wiped unsynced progress on offline logout).
  function syncCycleWith(d, u) {
    if (!d || !u) { setStatus("Sync offline"); return Promise.resolve(false); }
    setStatus("Syncing\u2026");
    var ref;
    try { ref = userDoc(d, u); } catch (e) { setStatus("Sync offline"); return Promise.resolve(false); }
    if (d.runTransaction && typeof d.runTransaction === "function") {
      return d.runTransaction(function (tx) {
        return tx.get(ref).then(function (snap) {
          var data = (snap && snap.exists) ? snap.data() : {};
          var m = buildMerged(data);
          tx.set(ref, m.payload, { merge: true });
          return m;
        });
      }).then(function (m) {
        return applyMerged(m);
      }).catch(function () {
        setStatus("Sync offline");
        return false;
      });
    }
    // Fallback when the SDK has no runTransaction: re-read before writing
    // and re-merge if the doc changed between the first read and the
    // write, so a concurrent edit is merged in instead of overwritten.
    return ref.get()
      .then(function (snap) {
        var data = (snap && snap.exists) ? snap.data() : {};
        var m = buildMerged(data);
        return ref.get().then(function (snap2) {
          var data2 = (snap2 && snap2.exists) ? snap2.data() : {};
          if (!deepEq(data, data2)) m = buildMerged(data2);
          return ref.set(m.payload, { merge: true }).then(function () { return m; });
        });
      })
      .then(function (m) { return applyMerged(m); })
      .catch(function () {
        setStatus("Sync offline");
        return false;
      });
  }
  function syncCycle() {
    var d, u;
    try { d = db(); u = uid(); } catch (e) { d = null; u = null; }
    return syncCycleWith(d, u);
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
    writeLocalPaths(mergePaths(readLocalPaths(), data.paths || null));
    writeLocalCustomPaths(mergeCustomPaths(readLocalCustomPaths(), data.customPaths || null));
    writeLocalWorkspace(mergeWorkspace(readLocalWorkspace(), data.workspace || null));
    writeLocalReviews(mergeReviews(readLocalReviews(), data.reviews || null));
    writeLocalProjects(mergeProjects(readLocalProjects(), data.projects || null));
    writeLocalPlacement(mergePlacement(readLocalPlacement(), data.placement || null));
    writeLocalCounters(mergeCounters(readLocalCounters(), data.counters || null));
    writeLocalAchievements(mergeAchievements(readLocalAchievements(), data.achievements || null));
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
    // P1-26: every per-user key in the LS map above — the previous list
    // missed the counters, bonus flags, daily plan/challenge, drills,
    // viva, drafts, lesson state, runs, workspace backup, compiler /
    // community handoff state, and the personal Gemini key, so the next
    // user on a shared device inherited them. Device-level keys (theme,
    // accent, collapsibles, concept-map theme/font) are NOT in the map
    // and survive, by design.
    [LS.PROGRESS, LS.XP, LS.STREAK, LS.ATTEMPTS, LS.PROFILE, LS.PROFILE_TS, LS.PATHS, LS.CUSTOM_PATHS, LS.CUSTOM_PATHS_TS,
     LS.WORKSPACE, LS.WORKSPACE_TS, LS.REVIEWS, LS.REVIEWS_TS, LS.LAST_UID,
     LS.ACTIVITY_DAYS, LS.ACTIVITY_FEED, LS.ACHIEVEMENTS, LS.PINS, LS.STARS, LS.SNIPPETS, LS.RUN_COUNT, LS.STREAK_BONUS, LS.PLACEMENT,
     LS.REVIEWS_DONE, LS.PLANS_DONE, LS.BEST_ANSWERS, LS.SHOWCASE_STARRED, LS.FLOWCHARTS_DONE,
     LS.SECTION_BONUS, LS.PATH_BONUS, LS.DAILY_PLAN, LS.DAILY_CHALLENGE, LS.DAILY_CHALLENGE_FAILED,
     LS.DRILLS, LS.DRILL_DEFS, LS.VIVA_SESSION, LS.VIVA_LAST, LS.EXERCISE_DRAFTS, LS.PROJECTS_DONE,
     LS.DONE_AT, LS.CERTIFICATES, LS.PASSPORT_PRIVATE,
     LS.LESSON_STATE, LS.RUNS, LS.WS_BACKUP, LS.WS_BACKUP_AT, LS.COMPILER_CODE, LS.CODE_HISTORY,
     LS.COMMUNITY_DRAFT, LS.AI_KEY].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  }
  // P1-25: the final push's result decides the wipe. Resolves true only
  // when the cloud write committed and local data was wiped; false when
  // the push failed (or could not be attempted) — in that case local data
  // is KEPT and the user is warned, instead of wiping unsynced progress
  // on an offline logout. The kept data (and the LAST_UID marker, which
  // the wipe would have removed) retries its push on the next sign-in /
  // auth-state null, so a later successful sync still cleans up.
  function handleLogout() {
    stopListener();
    if (pushTimer) { try { clearTimeout(pushTimer); } catch (e) {} pushTimer = null; }
    var d, u;
    try { d = db(); u = uid(); } catch (e) { d = null; u = null; }
    if (!d || !u) {
      // No push is possible (signed out already / SDK missing): keep the
      // data rather than deleting progress that was never uploaded.
      setStatus("Sync failed \u2014 progress kept on this device");
      try { if (typeof alert === "function") alert("Couldn't sync your progress (you may be offline). Your progress has been kept on this device — sign in again when you're back online to sync it."); } catch (e) {}
      return Promise.resolve(false);
    }
    try {
      return syncCycle().then(function (ok) {
        if (ok) { clearLocalUserData(); setStatus("Sync offline"); }
        else {
          setStatus("Sync failed \u2014 progress kept on this device");
          try { if (typeof alert === "function") alert("Couldn't sync your progress (you may be offline). Your progress has been kept on this device — sign in again when you're back online to sync it."); } catch (e) {}
        }
        return !!ok;
      }).catch(function () {
        setStatus("Sync failed \u2014 progress kept on this device");
        return false;
      });
    } catch (e) {
      setStatus("Sync failed \u2014 progress kept on this device");
      return Promise.resolve(false);
    }
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
          if (u) {
            lsSet(LS.LAST_UID, u.uid); // remember: this device had a signed-in session
            syncCycle(); startListener();
          } else {
            stopListener();
            if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
            // Wipe only if a previous signed-in session is recorded (a
            // real logout / revoked session). The initial null for an
            // anonymous visitor must NOT wipe their local progress.
            // P1-25: a revoked/expired session used to wipe with NO push
            // attempt at all — offline, that deleted unsynced progress
            // outright. Try one last push first, using the recorded uid
            // (currentUser is already null here, so uid() cannot supply
            // it). Wipe only when the push succeeds; on failure keep the
            // data (and the LAST_UID marker) so a later sign-in retries
            // the push instead of losing the progress.
            if (lsGet(LS.LAST_UID)) {
              var lastUid = lsGet(LS.LAST_UID), dd = db();
              if (dd) {
                syncCycleWith(dd, lastUid).then(function (ok) {
                  if (ok) clearLocalUserData();
                  else setStatus("Sync failed \u2014 progress kept on this device");
                });
              } else {
                // No Firestore handle at all, so no push can be attempted
                // (in production a signed-in session always has one);
                // wipe as before rather than stranding the data.
                clearLocalUserData();
              }
            }
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
      // custom-path saves/deletes likewise stamp the definitions'
      // updatedAt, so a delete-all propagates as the newest write
      if (hint === "customPaths") lsSet(LS.CUSTOM_PATHS_TS, String(Date.now()));
      schedulePush();
    } catch (e) {}
  }

  root.SkillzifySync = {
    init: init,
    markDirty: markDirty,
    handleLogout: handleLogout,
    syncNow: function () { try { return syncCycle(); } catch (e) { return Promise.resolve(false); } },
    getStatus: function () { return lastStatus.text; }
  };

  /* Race recovery (found live, 11 Nov 2026): auth.js's callback calls
     init() — but if the auth state resolves BEFORE this script has
     parsed (a fast restore; the test stub fires in 0ms), that
     callback finds window.SkillzifySync undefined, skips init, and
     nothing ever retries — sync stays dead for the whole page load
     while everything else works, so a completed lesson/project
     silently never reaches the cloud. If a user is ALREADY signed in
     when this script loads, the restore already happened: start now.
     When auth hasn't resolved yet, currentUser() is null and this is
     a no-op — the callback path starts sync as usual. init() is
     idempotent (the `inited` flag), so a later callback can't
     double-start it. */
  try {
    var SA = root.SkillzifyAuth;
    if (SA && typeof SA.currentUser === "function" && SA.currentUser()) init();
  } catch (e) {}
})();
