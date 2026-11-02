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

    fun markDone(id: String) = prefs.edit().putBoolean("done_$id", true).apply()

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
        if (last == today) return getStreak()
        val yesterday = dayString(-1)
        val count = if (last == yesterday) getStreak() + 1 else 1
        prefs.edit().putString("streak_last", today).putInt("streak_count", count).apply()
        return count
    }

    fun getRuns(): List<RunRecord> {
        val raw = prefs.getString("runs", "[]") ?: "[]"
        val arr = JSONArray(raw)
        return (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            RunRecord(o.getString("preview"), o.getBoolean("ok"), o.getLong("ts"))
        }
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
                lastTry = o.optLong("lastTry", 0)
            )
        } catch (e: Exception) { ExerciseAttempt() }
    }

    fun saveAttempt(id: String, a: ExerciseAttempt) {
        val o = JSONObject().apply {
            put("attempts", a.attempts); put("solved", a.solved)
            put("hintsUsed", a.hintsUsed); put("revealed", a.revealed)
            put("bestMs", a.bestMs); put("lastTry", a.lastTry)
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
        prefs.edit().putInt("streak_count", count).putString("streak_last", last).apply()
    }

    /** Applies a merged progress doc from sync. */
    fun applySyncedProgress(lessons: Set<String>, xp: Int, streakCount: Int, streakLast: String?) {
        val e = prefs.edit()
        // lesson union: only add, never remove
        for (id in lessons) e.putBoolean("done_$id", true)
        if (xp > getXp()) e.putInt("xp", xp)
        e.putInt("streak_count", streakCount)
        if (streakLast != null) e.putString("streak_last", streakLast) else e.remove("streak_last")
        e.apply()
    }

    fun applySyncedProfile(name: String, bio: String, updatedAt: Long) {
        saveProfile(name, bio, updatedAt)
    }

    fun applySyncedAttempts(merged: Map<String, ExerciseAttempt>) {
        for ((id, a) in merged) saveAttempt(id, a)
    }
}
