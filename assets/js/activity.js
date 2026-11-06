/* Skillzify Activity — GitHub-style contribution tracking, streaks,
   achievements, pins, stars, and identicons. All localStorage-backed. */
(function () {
  "use strict";

  var DAYS_KEY = "skillzify_activity_days";   // {"2026-11-01": 7}
  var FEED_KEY = "skillzify_activity_feed";   // [{t, type, text}]
  var ACH_KEY  = "skillzify_achievements";    // {"first_steps": 169879...}
  var PINS_KEY = "skillzify_pins";            // [{kind, id, title}]
  var STARS_KEY = "skillzify_stars";          // [{kind, id, title}]
  var SNIP_KEY = "skillzify_snippets";        // [{id,title,desc,code,created}]
  var PROF_KEY = "skillzify_profile";         // {name, bio}
  var RUN_COUNT_KEY = "skillzify_run_count";  // total code runs (number)

  function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function get(k, fb) {
    try { var v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); }
    catch (e) { return fb; }
  }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------------- event logging ---------------- */
  function log(type, text) {
    // Every logged event is an activity day: bump the streak counter
    // here so ANY activity (lesson, exercise, code run, review...)
    // counts — the counter is the single source of truth read by the
    // dashboard, the profile and the achievements.
    bumpStreakCounter();
    var days = get(DAYS_KEY, {});
    var t = todayStr();
    days[t] = (days[t] || 0) + 1;
    set(DAYS_KEY, days);

    var feed = get(FEED_KEY, []);
    feed.unshift({ t: Date.now(), type: type, text: text });
    set(FEED_KEY, feed.slice(0, 60));

    if (type === "run") {
      set(RUN_COUNT_KEY, (get(RUN_COUNT_KEY, 0) || 0) + 1);
      var h = new Date().getHours();
      if (h < 5) unlock("night_owl");
      else if (h < 8) unlock("early_bird");
    }
    checkAchievements();
  }

  function feed(limit) { return get(FEED_KEY, []).slice(0, limit || 20); }
  function dayCounts() { return get(DAYS_KEY, {}); }
  function runCount() { return get(RUN_COUNT_KEY, 0) || 0; }

  /* ---------------- streaks ---------------- */
  // Single source of truth: the counter in localStorage
  // `skillzify_streak` {last: "yyyy-MM-dd", count: n}. It is bumped by
  // log() on ANY activity day, so the dashboard, the profile and the
  // achievements all read the same number. The counter syncs
  // cross-device (later-date-wins in sync.js); the days log below is
  // local-only and is kept only for the `longest` computation.
  // Known limitation (not redesigned): later-date-wins means two
  // devices active on different days can clobber each other's count.
  var STREAK_KEY = "skillzify_streak";
  var STREAK_BONUS_KEY = "skillzify_streak_bonus"; // {d7: true, d30: true}
  function isoDay(d) { var m = d.getMonth() + 1, dy = d.getDate(); return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (dy < 10 ? "0" + dy : dy); }
  // Accept both yyyy-MM-dd and legacy toDateString() formats.
  function normDay(v) {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    var t = new Date(v);
    return isNaN(t.getTime()) ? null : isoDay(t);
  }
  // {last, count, current} — current is 0 when the streak has lapsed
  // (last activity was neither today nor yesterday); count keeps the
  // last completed length so `longest` stays correct.
  function streakCounter() {
    var s = get(STREAK_KEY, { last: null, count: 0 });
    var last = normDay(s.last);
    var today = isoDay(new Date()), yest = isoDay(new Date(Date.now() - 864e5));
    var current = (last === today || last === yest) ? (s.count || 0) : 0;
    return { last: last, count: s.count || 0, current: current };
  }
  function bumpStreakCounter() {
    var s = get(STREAK_KEY, { last: null, count: 0 });
    var today = isoDay(new Date()), yest = isoDay(new Date(Date.now() - 864e5));
    var last = normDay(s.last);
    if (last === today) return s; // already counted today
    s.count = (last === yest) ? (s.count || 0) + 1 : 1;
    s.last = today;
    set(STREAK_KEY, s);
    try { if (window.SkillzifySync && typeof window.SkillzifySync.markDirty === "function") window.SkillzifySync.markDirty(); } catch (e) {}
    return s;
  }
  function streak() {
    var c = streakCounter();
    var days = dayCounts(), longest = 0, run = 0;
    // longest: scan all keys sorted
    var keys = Object.keys(days).sort();
    var prev = null;
    keys.forEach(function (k) {
      if (prev) {
        var diff = (new Date(k) - new Date(prev)) / 864e5;
        run = (diff === 1) ? run + 1 : 1;
      } else run = 1;
      if (run > longest) longest = run;
      prev = k;
    });
    // The counter may know of a longer streak (e.g. synced from
    // another device) than this device's local days log.
    if (c.count > longest) longest = c.count;
    return { current: c.current, longest: longest };
  }

  /* ---------------- achievements ---------------- */
  var ACHIEVEMENTS = [
    { id: "first_steps",  icon: "🌱", name: "First Steps",   desc: "Complete your first lesson" },
    { id: "scholar",      icon: "🎓", name: "Scholar",       desc: "Complete all 250 lessons" },
    { id: "xp_100",       icon: "💯", name: "Century",       desc: "Earn 100 XP" },
    { id: "xp_500",       icon: "⚡", name: "Charged",       desc: "Earn 500 XP" },
    { id: "xp_1000",      icon: "🚀", name: "Rocket",        desc: "Earn 1,000 XP" },
    { id: "xp_5000",      icon: "🌟", name: "Superstar",     desc: "Earn 5,000 XP" },
    { id: "xp_10000",     icon: "🌟", name: "Legend",        desc: "Earn 10,000 XP" },
    { id: "streak_3",     icon: "🔥", name: "Warming Up",    desc: "3-day learning streak" },
    { id: "streak_7",     icon: "🔥", name: "On Fire",       desc: "7-day learning streak" },
    { id: "streak_30",    icon: "🔥", name: "Unstoppable",   desc: "30-day learning streak" },
    { id: "runner_10",    icon: "▶️", name: "Tinkerer",      desc: "Run code 10 times" },
    { id: "runner_50",    icon: "⚙️", name: "Engineer",      desc: "Run code 50 times" },
    { id: "snippet_saver",icon: "📝", name: "Curator",       desc: "Save your first snippet" },
    { id: "night_owl",    icon: "🦉", name: "Night Owl",     desc: "Code between midnight and 5 AM" },
    { id: "early_bird",   icon: "🌅", name: "Early Bird",    desc: "Code between 5 and 8 AM" },
    { id: "ex_first",     icon: "🏋️", name: "Problem Solver", desc: "Solve your first exercise" },
    { id: "ex_10",        icon: "💪", name: "Decathlete",    desc: "Solve 10 exercises" },
    { id: "ex_25",        icon: "🔥", name: "On Fire",       desc: "Solve 25 exercises" },
    { id: "ex_all",       icon: "🏆", name: "Completionist", desc: "Solve every exercise" },
    { id: "topic_master", icon: "🎯", name: "Topic Master",  desc: "Solve every exercise in one topic" }
  ];
  function unlocked() { return get(ACH_KEY, {}); }
  function unlock(id) {
    var u = unlocked();
    if (u[id]) return false;
    u[id] = Date.now(); set(ACH_KEY, u);
    var a = ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0];
    if (a) log("achievement", "Unlocked achievement: " + a.icon + " " + a.name);
    return true;
  }
  function checkAchievements() {
    var xp = 0, done = 0;
    try { xp = parseInt(localStorage.getItem("skillzify_xp") || "0", 10) || 0; } catch (e) {}
    try { var p = JSON.parse(localStorage.getItem("skillzify_progress") || "{}"); done = Object.keys(p).length; } catch (e) {}
    var s = streak(), runs = runCount(), snips = get(SNIP_KEY, []).length;
    // Streak-milestone XP: +50 the first time the streak reaches 7 days,
    // +150 at 30 days. Flags make each fire exactly once per device
    // (XP itself syncs by MAX, so a second device can't double-count
    // the synced total). No A.log() here — this already runs inside log().
    try {
      var bonus = get(STREAK_BONUS_KEY, {});
      if (s.current >= 7 && !bonus.d7) {
        bonus.d7 = true; set(STREAK_BONUS_KEY, bonus);
        xp += 50; try { localStorage.setItem("skillzify_xp", String(xp)); } catch (e2) {}
        if (window.Skillzify && typeof window.Skillzify.toast === "function") window.Skillzify.toast("🔥 7-day streak! +50 XP", "success");
      }
      if (s.current >= 30 && !bonus.d30) {
        bonus.d30 = true; set(STREAK_BONUS_KEY, bonus);
        xp += 150; try { localStorage.setItem("skillzify_xp", String(xp)); } catch (e2) {}
        if (window.Skillzify && typeof window.Skillzify.toast === "function") window.Skillzify.toast("🔥 30-day streak! +150 XP", "success");
      }
    } catch (e) {}
    if (done >= 1) unlock("first_steps");
    var totalLessons = (window.SkillzifyLearn && window.SkillzifyLearn.totalLessons) || 250;
    if (done >= totalLessons) unlock("scholar");
    var exSolved = 0, exTotal = 0, topicDone = false;
    try {
      var atts = JSON.parse(localStorage.getItem("skillzify_exercise_attempts") || "{}");
      var EXD = window.SkillzifyPracticeData || [];
      exTotal = EXD.length;
      var byTopic = {};
      EXD.forEach(function (ex) {
        var t = byTopic[ex.topic] || (byTopic[ex.topic] = { total: 0, solved: 0 });
        t.total++;
        if (atts[ex.id] && atts[ex.id].solved) { exSolved++; t.solved++; }
      });
      topicDone = Object.keys(byTopic).some(function (t) {
        return byTopic[t].total > 0 && byTopic[t].solved === byTopic[t].total;
      });
    } catch (e) {}
    if (exSolved >= 1) unlock("ex_first");
    if (exSolved >= 10) unlock("ex_10");
    if (exSolved >= 25) unlock("ex_25");
    if (exTotal > 0 && exSolved >= exTotal) unlock("ex_all");
    if (topicDone) unlock("topic_master");
    if (xp >= 100) unlock("xp_100");
    if (xp >= 500) unlock("xp_500");
    if (xp >= 1000) unlock("xp_1000");
    if (xp >= 5000) unlock("xp_5000");
    if (xp >= 10000) unlock("xp_10000");
    if (s.current >= 3 || s.longest >= 3) unlock("streak_3");
    if (s.current >= 7 || s.longest >= 7) unlock("streak_7");
    if (s.current >= 30 || s.longest >= 30) unlock("streak_30");
    if (runs >= 10) unlock("runner_10");
    if (runs >= 50) unlock("runner_50");
    if (snips >= 1) unlock("snippet_saver");
  }
  function achievements() {
    var u = unlocked();
    return ACHIEVEMENTS.map(function (a) {
      return { id: a.id, icon: a.icon, name: a.name, desc: a.desc, unlocked: !!u[a.id], at: u[a.id] || null };
    });
  }

  /* ---------------- identicon (GitHub-style default avatar) ---------------- */
  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return h >>> 0;
  }
  function identicon(seed, size) {
    size = size || 80;
    var h = hash(String(seed || "skillzify")), hue = h % 360;
    var cells = "";
    var rnd = h;
    function next() { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; }
    for (var y = 0; y < 5; y++) {
      for (var x = 0; x < 3; x++) {
        if (next() > 0.5) {
          var x2 = 4 - x;
          cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>' +
                   (x2 !== x ? '<rect x="' + x2 + '" y="' + y + '" width="1" height="1"/>' : '');
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5" width="' + size + '" height="' + size + '" style="border-radius:12px;background:hsl(' + hue + ',30%,92%)">' +
      '<g fill="hsl(' + hue + ',55%,45%)">' + cells + '</g></svg>';
  }

  /* ---------------- pins & stars ---------------- */
  function pins() { return get(PINS_KEY, []); }
  function togglePin(kind, id, title) {
    var p = pins(), i = p.findIndex(function (x) { return x.kind === kind && x.id === id; });
    if (i >= 0) p.splice(i, 1);
    else { p.unshift({ kind: kind, id: id, title: title }); p = p.slice(0, 6); }
    set(PINS_KEY, p);
    return i < 0;
  }
  function isPinned(kind, id) { return pins().some(function (x) { return x.kind === kind && x.id === id; }); }

  function stars() { return get(STARS_KEY, []); }
  function toggleStar(kind, id, title) {
    var s = stars(), i = s.findIndex(function (x) { return x.kind === kind && x.id === id; });
    if (i >= 0) s.splice(i, 1);
    else s.unshift({ kind: kind, id: id, title: title });
    set(STARS_KEY, s);
    return i < 0;
  }
  function isStarred(kind, id) { return stars().some(function (x) { return x.kind === kind && x.id === id; }); }

  /* ---------------- snippets (Gists-like) ---------------- */
  function snippets() { return get(SNIP_KEY, []); }
  function saveSnippet(title, desc, code) {
    var s = snippets();
    var sn = { id: "s" + Date.now().toString(36), title: title || "Untitled snippet", desc: desc || "", code: code, created: Date.now() };
    s.unshift(sn); set(SNIP_KEY, s);
    log("snippet", "Saved snippet: " + sn.title);
    checkAchievements();
    return sn;
  }
  function deleteSnippet(id) { set(SNIP_KEY, snippets().filter(function (s) { return s.id !== id; })); }

  /* ---------------- profile ---------------- */
  function profile() { return get(PROF_KEY, { name: "", bio: "" }); }
  function saveProfile(p) { set(PROF_KEY, p); }

  window.SkillzifyActivity = {
    log: log, feed: feed, dayCounts: dayCounts, runCount: runCount,
    streak: streak, bumpStreak: bumpStreakCounter, achievements: achievements, unlocked: unlocked,
    identicon: identicon,
    pins: pins, togglePin: togglePin, isPinned: isPinned,
    stars: stars, toggleStar: toggleStar, isStarred: isStarred,
    snippets: snippets, saveSnippet: saveSnippet, deleteSnippet: deleteSnippet,
    profile: profile, saveProfile: saveProfile,
    checkAchievements: checkAchievements, todayStr: todayStr
  };
})();
