package com.skillzify.app.data.local

import androidx.room.withTransaction
import com.skillzify.app.data.Store
import org.json.JSONArray
import org.json.JSONObject

/* App 2.0 Phase A5 — mirrors Store's progress state into Room.
 *
 * Why a mirror and not a cutover: Store's API is synchronous and is
 * called from composables, the sync engine and achievement checks all
 * over the app; Room is suspend-only. Rewriting every call site in
 * Phase A would destabilise the working app for no user-visible gain.
 * Instead: Store stays the write path, and this mirror keeps the Room
 * progress tables current (startup + after every sync refresh), so
 * Phase B/C query-driven features build on Room from day one. A full
 * Store cutover, if ever wanted, becomes a Phase B hardening item
 * with the mirror already proving the schema.
 *
 * Best-effort by design: any failure is swallowed — the mirror must
 * never break a screen or a sync. */
object ProgressMirror {

    suspend fun mirror(store: Store, db: SkillzifyDatabase) {
        try {
            val doneAt = store.allLessonDoneAt()
            val lessons = store.doneIds().map { id ->
                LessonProgressEntity(id, doneAt[id] ?: 0)
            }
            val attempts = store.allAttemptIds().map { id ->
                val a = store.getAttempt(id)
                ExerciseAttemptEntity(
                    exerciseId = id,
                    attempts = a.attempts,
                    solved = a.solved,
                    hintsUsed = a.hintsUsed,
                    revealed = a.revealed,
                    bestMs = a.bestMs,
                    lastTry = a.lastTry,
                    at = a.at,
                    solveQuality = a.solveQuality
                )
            }
            val kv = mutableListOf<ProgressKvEntity>()
            fun put(key: String, value: String) {
                kv += ProgressKvEntity(key, value)
            }
            put("xp", store.getXp().toString())
            put("streak_count", store.getStreak().toString())
            put("streak_last", store.getStreakLast() ?: "")
            put("streak_longest", store.getLongestStreak().toString())
            put("run_count", store.getRunCount().toString())
            put("profile_name", store.getProfileName())
            put("profile_bio", store.getProfileBio())
            put("profile_updated_at", store.getProfileUpdatedAt().toString())
            val c = store.getCounters()
            put(
                "counters",
                JSONObject().apply {
                    put("reviewsDone", c.reviewsDone)
                    put("plansDone", c.plansDone)
                    put("bestAnswers", c.bestAnswers)
                    put("showcaseStarred", c.showcaseStarred)
                    put("flowchartsDone", c.flowchartsDone)
                }.toString()
            )
            put("unlocked", JSONArray(store.getUnlockedAchievements().toList()).toString())
            put("active_days", JSONArray(store.activeDays().toList()).toString())
            put("starred", JSONArray(store.starredLessons().toList()).toString())
            put("pinned", JSONArray(store.pinnedLessons().toList()).toString())
            put(
                "enrollments",
                JSONObject().apply {
                    for ((id, v) in store.getEnrolledPaths()) {
                        put(id, JSONArray().apply { put(v.first); put(v.second) })
                    }
                }.toString()
            )
            store.getPlacement()?.let { p ->
                put(
                    "placement",
                    JSONObject().apply {
                        put("section", p.section)
                        put("score", p.score)
                        put("total", p.total)
                        put("date", p.date)
                        put("stages", JSONObject().apply {
                            for ((k, s) in p.stages) {
                                put(k, JSONObject().apply {
                                    put("correct", s.correct)
                                    put("total", s.total)
                                })
                            }
                        })
                    }.toString()
                )
            }
            db.withTransaction {
                val dao = db.progressDao()
                dao.clearLessons()
                dao.insertLessons(lessons)
                dao.clearAttempts()
                dao.insertAttempts(attempts)
                dao.clearKv()
                dao.insertKv(kv)
            }
        } catch (e: Exception) {
            // Best-effort: the mirror never breaks the app.
        }
    }
}
