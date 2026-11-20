package com.skillzify.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/* App 2.0 Phase A5 — progress tables (database v2).
 *
 * Store (SharedPreferences) remains the write path in Phase A — its
 * synchronous API is woven through every screen and the sync engine.
 * These tables are the Room mirror of that state, maintained by
 * ProgressMirror after startup and after every sync refresh, so the
 * Phase B/C features that need QUERIES (review queue, adaptive path,
 * coach, mastery analytics) read progress from Room instead of
 * scanning preference keys.
 *
 * MIGRATION RULE (from the A1 breakdown, now in force): these tables
 * hold user progress — real Migration objects only, never destructive
 * fallback. MIGRATION_1_2 in Migrations.kt creates them. */

/** One row per completed lesson; doneAt = first completion ms (0 = unknown). */
@Entity(tableName = "lesson_progress")
data class LessonProgressEntity(
    @PrimaryKey val lessonId: String,
    val doneAt: Long
)

/** Mirror of Store's ExerciseAttempt (Models.kt), including the
    local-only solveQuality snapshot. */
@Entity(tableName = "exercise_attempts")
data class ExerciseAttemptEntity(
    @PrimaryKey val exerciseId: String,
    val attempts: Int,
    val solved: Boolean,
    val hintsUsed: Int,
    val revealed: Boolean,
    val bestMs: Long,
    val lastTry: Long,
    val at: Long,
    val solveQuality: Double?
)

/** Scalar/JSON progress state: xp, streak, profile, counters,
    unlocks, enrollments, placement, active days, stars/pins. */
@Entity(tableName = "progress_kv")
data class ProgressKvEntity(
    @PrimaryKey val key: String,
    val value: String
)
