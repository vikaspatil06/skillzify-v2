package com.skillzify.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

/* App 2.0 — the local-first database.
 *
 * v1 (Phase A1): content only, fully re-importable from bundled assets.
 * v2 (Phase A5): progress mirror tables added (ProgressEntities.kt).
 * From v2 the database holds user progress — REAL migrations only
 * (Migrations.kt); the destructive fallback was retired in A5. */
@Database(
    entities = [
        TrackEntity::class,
        LessonEntity::class,
        ExerciseEntity::class,
        RefEntryEntity::class,
        ProjectEntity::class,
        PathEntity::class,
        AchievementEntity::class,
        SnippetEntity::class,
        LevelEntity::class,
        ContentMetaEntity::class,
        LessonProgressEntity::class,
        ExerciseAttemptEntity::class,
        ProgressKvEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class SkillzifyDatabase : RoomDatabase() {
    abstract fun trackDao(): TrackDao
    abstract fun lessonDao(): LessonDao
    abstract fun exerciseDao(): ExerciseDao
    abstract fun refEntryDao(): RefEntryDao
    abstract fun projectDao(): ProjectDao
    abstract fun pathDao(): PathDao
    abstract fun achievementDao(): AchievementDao
    abstract fun snippetDao(): SnippetDao
    abstract fun levelDao(): LevelDao
    abstract fun contentMetaDao(): ContentMetaDao
    abstract fun progressDao(): ProgressDao
}
