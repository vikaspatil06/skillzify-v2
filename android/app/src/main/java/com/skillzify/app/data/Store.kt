package com.skillzify.app.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/** SharedPreferences-backed store. Mirrors the web app's localStorage keys. */
class Store(ctx: Context) {
    private val prefs: SharedPreferences =
        ctx.applicationContext.getSharedPreferences("skillzify", Context.MODE_PRIVATE)

    private fun dayString(offsetDays: Int = 0): String {
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, offsetDays)
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)
    }

    fun doneIds(): Set<String> =
        prefs.all.keys.filter { it.startsWith("done_") && prefs.getBoolean(it, false) }
            .map { it.removePrefix("done_") }.toSet()

    fun isDone(id: String): Boolean = prefs.getBoolean("done_$id", false)

    fun markDone(id: String) {
        prefs.edit().putBoolean("done_$id", true).apply()
        // Passport/sync parity: first completion time, earliest wins —
        // recorded once, never overwritten (web progress.doneAt rule).
        if (getLessonDoneAt(id) == null) {
            val m = allLessonDoneAt().toMutableMap()
            m[id] = System.currentTimeMillis()
            saveLessonDoneAt(m)
        }
    }

    fun getXp(): Int = prefs.getInt("xp", 0)

    fun addXp(n: Int): Int {
        val v = getXp() + n
        prefs.edit().putInt("xp", v).apply()
        return v
    }

    fun getStreak(): Int = prefs.getInt("streak_count", 0)

    /** Same rule as the web app: consecutive calendar days. Returns current count. */
    fun bumpStreak(): Int {
        val today = dayString(0)
        val last = prefs.getString("streak_last", null)
        // Web P2-24: a future-dated `last` (clock skew / timezone travel)
        // is ignored, not a broken streak — the count stands and the
        // counter is left untouched (the day still counts as active,
        // like the web's unconditional days-map write in log()).
        if (last != null && last > today) {
            markActiveDay(today)
            return getStreak()
        }
        if (last == today) return getStreak()
        val yesterday = dayString(-1)
        val count = if (last == yesterday) getStreak() + 1 else 1
        markActiveDay(today)
        val e = prefs.edit().putString("streak_last", today).putInt("streak_count", count)
        if (count > getLongestStreak()) e.putInt("streak_longest", count)
        e.apply()
        return count
    }

    /** Web streak().current: the stored count while the streak is
        alive (last activity today or yesterday), 0 once it has lapsed.
        The raw count itself is preserved for `longest`/sync. */
    fun getCurrentStreak(): Int {
        val last = getStreakLast() ?: return 0
        return if (last == dayString(0) || last == dayString(-1)) getStreak() else 0
    }

    /* Streak-milestone XP bonus flags (web activity.js: +50 XP the
       first time the streak reaches 7 days, +150 at 30 — each fires
       exactly once per device, STREAK_BONUS_KEY {d7, d30}). */
    fun isStreakBonusClaimed(days: Int): Boolean =
        prefs.getBoolean("streak_bonus_d$days", false)

    fun claimStreakBonus(days: Int) =
        prefs.edit().putBoolean("streak_bonus_d$days", true).apply()

    fun getRuns(): List<RunRecord> {
        val raw = prefs.getString("runs", "[]") ?: "[]"
        // Fail-soft like every other JSON reader in this store: this is
        // called from AppViewModel property initialisers, so a corrupt
        // or shape-drifted "runs" pref must not crash the VM (and the
        // app) on every launch. Bad entries are skipped, not fatal.
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).mapNotNull {
                try {
                    val o = arr.getJSONObject(it)
                    RunRecord(
                        o.optString("preview", ""), o.optBoolean("ok", false),
                        o.optLong("ts", 0)
                    )
                } catch (e: Exception) { null }
            }
        } catch (e: Exception) { emptyList() }
    }

    fun addRun(record: RunRecord) {
        val arr = JSONArray()
        arr.put(JSONObject().apply {
            put("preview", record.codePreview)
            put("ok", record.ok)
            put("ts", record.timestamp)
        })
        for (r in getRuns().take(19)) {
            arr.put(JSONObject().apply {
                put("preview", r.codePreview)
                put("ok", r.ok)
                put("ts", r.timestamp)
            })
        }
        prefs.edit().putString("runs", arr.toString()).apply()
    }

    fun getLastCode(): String = prefs.getString("last_code", "") ?: ""
    fun saveLastCode(code: String) = prefs.edit().putString("last_code", code).apply()

    /* ---------- exercise attempts (syncs via Firestore) ---------- */

    fun getAttempt(id: String): ExerciseAttempt {
        val raw = prefs.getString("ex_att_$id", null) ?: return ExerciseAttempt()
        return try {
            val o = JSONObject(raw)
            ExerciseAttempt(
                attempts = o.optInt("attempts", 0),
                solved = o.optBoolean("solved", false),
                hintsUsed = o.optInt("hintsUsed", 0),
                revealed = o.optBoolean("revealed", false),
                bestMs = o.optLong("bestMs", 0),
                lastTry = o.optLong("lastTry", 0),
                at = o.optLong("at", 0),
                solveQuality = if (o.has("solveQuality"))
                    o.optDouble("solveQuality", Double.NaN).takeIf { !it.isNaN() } else null
            )
        } catch (e: Exception) { ExerciseAttempt() }
    }

    fun saveAttempt(id: String, a: ExerciseAttempt) {
        val o = JSONObject().apply {
            put("attempts", a.attempts); put("solved", a.solved)
            put("hintsUsed", a.hintsUsed); put("revealed", a.revealed)
            put("bestMs", a.bestMs); put("lastTry", a.lastTry)
            put("at", a.at)
            a.solveQuality?.let { put("solveQuality", it) }
        }
        prefs.edit().putString("ex_att_$id", o.toString()).apply()
    }

    fun allAttemptIds(): Set<String> =
        prefs.all.keys.filter { it.startsWith("ex_att_") }.map { it.removePrefix("ex_att_") }.toSet()

    /* ---------- profile (syncs via Firestore) ---------- */

    fun getProfileName(): String = prefs.getString("profile_name", "") ?: ""
    fun getProfileBio(): String = prefs.getString("profile_bio", "") ?: ""
    fun saveProfile(name: String, bio: String, updatedAt: Long) {
        prefs.edit().putString("profile_name", name).putString("profile_bio", bio)
            .putLong("profile_updated_at", updatedAt).apply()
    }
    fun getProfileUpdatedAt(): Long = prefs.getLong("profile_updated_at", 0)

    /* ---------- sync export / import ---------- */

    /** Streak last-day in yyyy-MM-dd (already normalized in this app). */
    fun getStreakLast(): String? = prefs.getString("streak_last", null)

    fun setStreak(count: Int, last: String?) {
        val e = prefs.edit().putInt("streak_count", count).putString("streak_last", last)
        // Web streak(): longest is at least the (possibly just-synced)
        // counter count — a streak earned on another device counts
        // toward best-ever here too.
        if (count > getLongestStreak()) e.putInt("streak_longest", count)
        e.apply()
    }

    /** Applies a merged progress doc from sync. */
    fun applySyncedProgress(lessons: Set<String>, xp: Int, streakCount: Int, streakLast: String?) {
        val e = prefs.edit()
        // lesson union: only add, never remove
        for (id in lessons) e.putBoolean("done_$id", true)
        if (xp > getXp()) e.putInt("xp", xp)
        e.putInt("streak_count", streakCount)
        if (streakCount > getLongestStreak()) e.putInt("streak_longest", streakCount)
        if (streakLast != null) e.putString("streak_last", streakLast) else e.remove("streak_last")
        e.apply()
    }

    fun applySyncedProfile(name: String, bio: String, updatedAt: Long) {
        saveProfile(name, bio, updatedAt)
    }

    fun applySyncedAttempts(merged: Map<String, ExerciseAttempt>) {
        for ((id, a) in merged) saveAttempt(id, a)
    }

    /* ---------- path enrollments (syncs via Firestore, mirrors web) ----------
       Stored as JSON under the web's key: { pathId: { enrolled, at } }.
       Leaving writes a tombstone so it propagates instead of resurrecting. */

    fun getEnrolledPaths(): Map<String, Pair<Boolean, Long>> {
        val raw = prefs.getString("skillzify_enrolled_paths", null) ?: return emptyMap()
        // Legacy ARRAY shape (web pre-map enrollments: presence = enrolled,
        // at = 0 so any real timestamped event wins) — migrate in memory,
        // exactly like web sync.js readEnrollMap().
        if (raw.trimStart().startsWith("[")) {
            return try {
                val arr = JSONArray(raw)
                (0 until arr.length()).map { arr.getString(it) to (true to 0L) }.toMap()
            } catch (e: Exception) { emptyMap() }
        }
        return try {
            val o = JSONObject(raw)
            val out = mutableMapOf<String, Pair<Boolean, Long>>()
            val keys = o.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                // Drop junk keys the old shape mismatch left behind ("paths"
                // was stored as a bogus enrollment, "updatedAt" is not a path).
                if (k == "paths" || k == "updatedAt") continue
                val e = o.optJSONObject(k) ?: continue
                out[k] = e.optBoolean("enrolled", false) to e.optLong("at", 0)
            }
            out
        } catch (e: Exception) { emptyMap() }
    }

    fun setEnrollment(id: String, enrolled: Boolean, at: Long) {
        // Seed from the parsed map so a legacy ARRAY-shaped store is
        // migrated (not silently dropped) on the first write.
        val o = JSONObject()
        for ((k, v) in getEnrolledPaths()) {
            o.put(k, JSONObject().put("enrolled", v.first).put("at", v.second))
        }
        o.put(id, JSONObject().put("enrolled", enrolled).put("at", at))
        prefs.edit().putString("skillzify_enrolled_paths", o.toString()).apply()
    }

    fun isEnrolled(id: String): Boolean = getEnrolledPaths()[id]?.first == true

    fun applySyncedEnrollments(paths: Map<String, Pair<Boolean, Long>>) {
        val o = JSONObject()
        for ((id, v) in paths) o.put(id, JSONObject().put("enrolled", v.first).put("at", v.second))
        prefs.edit().putString("skillzify_enrolled_paths", o.toString()).apply()
    }

    /* ---------- starred / pinned lessons (website parity) ---------- */

    private fun stringSet(key: String): Set<String> =
        prefs.getStringSet(key, emptySet())?.toSet() ?: emptySet()

    fun starredLessons(): Set<String> = stringSet("starred_lessons")
    fun pinnedLessons(): Set<String> = stringSet("pinned_lessons")

    fun setStarred(id: String, on: Boolean) {
        val s = starredLessons().toMutableSet()
        if (on) s.add(id) else s.remove(id)
        prefs.edit().putStringSet("starred_lessons", s).apply()
    }

    fun setPinned(id: String, on: Boolean) {
        val s = pinnedLessons().toMutableSet()
        if (on) s.add(id) else s.remove(id)
        prefs.edit().putStringSet("pinned_lessons", s).apply()
    }

    /* ---------- activity: run totals, longest streak, active days ---------- */

    fun getRunCount(): Int = prefs.getInt("run_count_total", 0)

    fun getLongestStreak(): Int = prefs.getInt("streak_longest", 0)

    /** Records one activity day (yyyy-MM-dd) for the heatmap. */
    fun markActiveDay(day: String) {
        val s = stringSet("active_days").toMutableSet()
        if (s.add(day)) prefs.edit().putStringSet("active_days", s).apply()
    }

    fun activeDays(): Set<String> = stringSet("active_days")

    /** Call on every code run: total counter + activity day + night/early-bird flags. */
    fun recordRun() {
        val now = System.currentTimeMillis()
        val cal = Calendar.getInstance()
        val day = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)
        markActiveDay(day)
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val e = prefs.edit().putInt("run_count_total", getRunCount() + 1)
        if (hour in 0..4) e.putBoolean("ach_night_owl", true)
        if (hour in 5..7) e.putBoolean("ach_early_bird", true)
        e.apply()
    }

    fun hasNightOwl(): Boolean = prefs.getBoolean("ach_night_owl", false)
    fun hasEarlyBird(): Boolean = prefs.getBoolean("ach_early_bird", false)

    /* ---------- user snippets (website parity: save your own code) ---------- */

    fun userSnippets(): List<Snippet> {
        val raw = prefs.getString("user_snippets", null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).map {
                val o = arr.getJSONObject(it)
                Snippet(o.getString("id"), o.getString("name"), o.getString("code"))
            }
        } catch (e: Exception) { emptyList() }
    }

    fun saveUserSnippet(name: String, code: String) {
        val arr = JSONArray()
        for (s in userSnippets()) {
            arr.put(JSONObject().put("id", s.id).put("name", s.name).put("code", s.code))
        }
        arr.put(JSONObject().put("id", "u" + System.currentTimeMillis())
            .put("name", name).put("code", code))
        prefs.edit().putString("user_snippets", arr.toString()).apply()
    }

    fun deleteUserSnippet(id: String) {
        val arr = JSONArray()
        for (s in userSnippets()) {
            if (s.id != id) arr.put(JSONObject().put("id", s.id).put("name", s.name).put("code", s.code))
        }
        prefs.edit().putString("user_snippets", arr.toString()).apply()
    }

    /* ---------- exercise drafts (website parity: auto-save) ---------- */

    fun getExerciseDraft(id: String): String? {
        val raw = prefs.getString("exercise_drafts", null) ?: return null
        return try { JSONObject(raw).optString(id, "").ifEmpty { null } } catch (e: Exception) { null }
    }

    fun saveExerciseDraft(id: String, code: String) {
        val raw = prefs.getString("exercise_drafts", null)
        val o = try { if (raw != null) JSONObject(raw) else JSONObject() } catch (e: Exception) { JSONObject() }
        o.put(id, code)
        prefs.edit().putString("exercise_drafts", o.toString()).apply()
    }

    /* ---------- theme (website parity: dark/light + 6 accents) ---------- */

    fun getThemeDark(): Boolean = prefs.getBoolean("theme_dark", true)
    fun getThemeAccent(): Int = prefs.getInt("theme_accent", 0)
    fun saveTheme(dark: Boolean, accent: Int) {
        prefs.edit().putBoolean("theme_dark", dark).putInt("theme_accent", accent).apply()
    }

    /* ---------- compiler workspace: multi-file (website Code Studio parity) ---------- */

    /** Map of filename -> code. Empty = no workspace yet (caller seeds main.py). */
    fun workspaceFiles(): Map<String, String> {
        val raw = prefs.getString("workspace_files", null) ?: return emptyMap()
        return try {
            val o = JSONObject(raw)
            val out = LinkedHashMap<String, String>()
            val keys = o.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                out[k] = o.optString(k, "")
            }
            out
        } catch (e: Exception) { emptyMap() }
    }

    fun saveWorkspaceFile(name: String, code: String) {
        val o = JSONObject()
        val cur = workspaceFiles()
        for ((k, v) in cur) o.put(k, v)
        o.put(name, code)
        prefs.edit().putString("workspace_files", o.toString()).apply()
    }

    fun deleteWorkspaceFile(name: String) {
        val o = JSONObject()
        for ((k, v) in workspaceFiles()) if (k != name) o.put(k, v)
        prefs.edit().putString("workspace_files", o.toString()).apply()
    }

    fun renameWorkspaceFile(old: String, new: String) {
        val o = JSONObject()
        for ((k, v) in workspaceFiles()) o.put(if (k == old) new else k, v)
        prefs.edit().putString("workspace_files", o.toString()).apply()
    }

    /* ---------- lesson completion times (syncs in progress.doneAt) ----------
       {lessonId: ms}; per-lesson earliest non-zero wins in sync merges
       (web mergeProgress/earliestMap). 0/absent = date unknown. */

    fun allLessonDoneAt(): Map<String, Long> {
        val raw = prefs.getString("lesson_done_at", null) ?: return emptyMap()
        return try {
            val o = JSONObject(raw)
            val out = mutableMapOf<String, Long>()
            val keys = o.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                out[k] = o.optLong(k, 0)
            }
            out
        } catch (e: Exception) { emptyMap() }
    }

    fun getLessonDoneAt(id: String): Long? = allLessonDoneAt()[id]?.takeIf { it > 0 }

    private fun saveLessonDoneAt(m: Map<String, Long>) {
        val o = JSONObject()
        for ((k, v) in m) o.put(k, v)
        prefs.edit().putString("lesson_done_at", o.toString()).apply()
    }

    /** Applies the merged doneAt map from sync (already merge-resolved). */
    fun applySyncedDoneAt(m: Map<String, Long>) = saveLessonDoneAt(m)

    /** Run total as synced (progress.runCount, MAX merge — web parity). */
    fun applySyncedRunCount(n: Int) {
        if (n > getRunCount()) prefs.edit().putInt("run_count_total", n).apply()
    }

    /* ---------- placement record (syncs as users/{uid}.placement) ---------- */

    fun getPlacement(): PlacementRecord? {
        val raw = prefs.getString("placement", null) ?: return null
        return try {
            val o = JSONObject(raw)
            val section = o.optString("section", "")
            if (section.isBlank()) return null
            val stages = mutableMapOf<String, StageScore>()
            val so = o.optJSONObject("stages")
            if (so != null) {
                for (k in listOf("a", "b", "c")) {
                    val s = so.optJSONObject(k)
                    if (s != null) stages[k] = StageScore(s.optInt("correct", 0), s.optInt("total", 0))
                }
            }
            PlacementRecord(
                section = section,
                score = o.optInt("score", 0),
                total = o.optInt("total", 0),
                date = o.optLong("date", 0),
                stages = stages
            )
        } catch (e: Exception) { null }
    }

    fun setPlacement(rec: PlacementRecord) {
        val stages = JSONObject()
        for (k in listOf("a", "b", "c")) {
            val s = rec.stages[k] ?: StageScore(0, 0)
            stages.put(k, JSONObject().put("correct", s.correct).put("total", s.total))
        }
        val o = JSONObject().apply {
            put("section", rec.section); put("score", rec.score)
            put("total", rec.total); put("date", rec.date); put("stages", stages)
        }
        prefs.edit().putString("placement", o.toString()).apply()
    }

    fun clearPlacement() = prefs.edit().remove("placement").apply()

    /* ---------- per-section completion dates (passport certificates) ----------
       {sectionId: ms}. Recorded once — the FIRST time a section is fully
       done; never backfilled/overwritten afterwards (cert id stability). */

    private fun sectionCompletions(): Map<String, Long> {
        val raw = prefs.getString("section_completed_at", null) ?: return emptyMap()
        return try {
            val o = JSONObject(raw)
            val out = mutableMapOf<String, Long>()
            val keys = o.keys()
            while (keys.hasNext()) { val k = keys.next(); out[k] = o.optLong(k, 0) }
            out
        } catch (e: Exception) { emptyMap() }
    }

    fun recordSectionCompleted(sectionId: String, atMs: Long) {
        if (sectionId.isBlank() || atMs <= 0) return
        val m = sectionCompletions()
        if (m.containsKey(sectionId)) return // first completion stands
        val o = JSONObject()
        for ((k, v) in m) o.put(k, v)
        o.put(sectionId, atMs)
        prefs.edit().putString("section_completed_at", o.toString()).apply()
    }

    fun getSectionCompletedAt(sectionId: String): Long? =
        sectionCompletions()[sectionId]?.takeIf { it > 0 }

    /* ---------- one-time completion bonuses (web learn-core.js) ----------
       Section complete +100 XP, path complete +150 XP, each exactly
       once per id (web SECTION_BONUS_KEY / PATH_BONUS_KEY flag maps).
       The path flags double as the passport's completed-paths record,
       exactly like the web's skillzify_path_bonus. */

    fun isSectionBonusAwarded(id: String): Boolean = stringSet("section_bonus").contains(id)
    fun markSectionBonusAwarded(id: String) {
        val s = stringSet("section_bonus").toMutableSet(); s.add(id)
        prefs.edit().putStringSet("section_bonus", s).apply()
    }

    fun isPathBonusAwarded(id: String): Boolean = stringSet("path_bonus").contains(id)
    fun markPathBonusAwarded(id: String) {
        val s = stringSet("path_bonus").toMutableSet(); s.add(id)
        prefs.edit().putStringSet("path_bonus", s).apply()
    }

    /* ---------- persisted certificate records (web passport.js certFor) ----------
       {sectionId: {"id": "SKZ-…", "issuedAt": ms}}. Get-or-create: once
       minted, a section's cert ID never changes — even if the doneAt
       data later moves via sync (the web persists the same record in
       skillzify_certificates). */

    fun getCertRecord(sectionId: String): Pair<String, Long>? {
        val raw = prefs.getString("certificates", null) ?: return null
        return try {
            val rec = JSONObject(raw).optJSONObject(sectionId) ?: return null
            val id = rec.optString("id", "")
            val at = rec.optLong("issuedAt", 0)
            if (id.isEmpty() || at <= 0) null else id to at
        } catch (e: Exception) { null }
    }

    fun putCertRecord(sectionId: String, certId: String, issuedAt: Long) {
        val o = try {
            prefs.getString("certificates", null)?.let { JSONObject(it) } ?: JSONObject()
        } catch (e: Exception) { JSONObject() }
        o.put(sectionId, JSONObject().put("id", certId).put("issuedAt", issuedAt))
        prefs.edit().putString("certificates", o.toString()).apply()
    }

    /* ---------- achievement counters (syncs as users/{uid}.counters) ----------
       Web shape (sync.js mergeCounters): reviewsDone / plansDone /
       bestAnswers / flowchartsDone are counts that only grow (MAX merge);
       showcaseStarred is a boolean (OR merge). The task-level names
       (reviewsCompleted, plansFinished, flowchartRendered, hasBestAnswer,
       hasShowcaseStar) are views over this single web-shaped store, so
       local state and the synced doc can never disagree. */

    fun getCounters(): Counters = Counters(
        reviewsDone = prefs.getInt("counters_reviews_done", 0),
        plansDone = prefs.getInt("counters_plans_done", 0),
        bestAnswers = prefs.getInt("counters_best_answers", 0),
        showcaseStarred = prefs.getBoolean("counters_showcase_starred", false),
        flowchartsDone = prefs.getInt("counters_flowcharts_done", 0)
    )

    fun applySyncedCounters(c: Counters) {
        prefs.edit()
            .putInt("counters_reviews_done", c.reviewsDone)
            .putInt("counters_plans_done", c.plansDone)
            .putInt("counters_best_answers", c.bestAnswers)
            .putBoolean("counters_showcase_starred", c.showcaseStarred)
            .putInt("counters_flowcharts_done", c.flowchartsDone)
            .apply()
    }

    fun getReviewsCompleted(): Int = getCounters().reviewsDone
    fun incReviewsCompleted() =
        prefs.edit().putInt("counters_reviews_done", getReviewsCompleted() + 1).apply()

    fun getPlansFinished(): Int = getCounters().plansDone
    fun incPlansFinished() =
        prefs.edit().putInt("counters_plans_done", getPlansFinished() + 1).apply()

    fun incBestAnswers() =
        prefs.edit().putInt("counters_best_answers", getCounters().bestAnswers + 1).apply()

    fun incFlowchartsDone() =
        prefs.edit().putInt("counters_flowcharts_done", getCounters().flowchartsDone + 1).apply()

    /** Flag view: true once at least one flowchart has rendered. Setting
        false is a no-op — web counters only grow (MAX merge would undo a
        decrease on the next sync anyway). */
    fun isFlowchartRendered(): Boolean = getCounters().flowchartsDone > 0
    fun setFlowchartRendered(on: Boolean) { if (on && !isFlowchartRendered()) incFlowchartsDone() }

    fun isHasBestAnswer(): Boolean = getCounters().bestAnswers > 0
    fun setHasBestAnswer(on: Boolean) { if (on && !isHasBestAnswer()) incBestAnswers() }

    fun isHasShowcaseStar(): Boolean = getCounters().showcaseStarred
    fun setHasShowcaseStar(on: Boolean) {
        if (on && !isHasShowcaseStar())
            prefs.edit().putBoolean("counters_showcase_starred", true).apply()
    }

    /* ---------- last signed-in uid + sign-out wipe (web sync.js parity) ---------- */

    fun getLastUid(): String? = prefs.getString("last_uid", null)?.ifEmpty { null }
    fun setLastUid(uid: String) = prefs.edit().putString("last_uid", uid).apply()

    /**
     * Wipes ALL per-user data, mirroring web clearLocalUserData(): every
     * key in this store is per-user EXCEPT the theme (device-level: web
     * keeps skillzify_theme/accent across sign-outs), which is preserved.
     * Per-uid keys the web keeps (passport privacy flag) have no app
     * equivalent — nothing else survives. Call ONLY after a successful
     * final push (web P1-25: a failed push keeps the data so the next
     * sign-in can retry instead of losing unsynced progress).
     */
    fun clearUserData() {
        val dark = getThemeDark()
        val accent = getThemeAccent()
        prefs.edit().clear().apply()
        saveTheme(dark, accent)
    }
}

/** Web-shaped achievement counters (sync.js `counters` field). */
data class Counters(
    val reviewsDone: Int = 0,
    val plansDone: Int = 0,
    val bestAnswers: Int = 0,
    val showcaseStarred: Boolean = false,
    val flowchartsDone: Int = 0
)
