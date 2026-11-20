package com.skillzify.app.data.local

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/* App 2.0 — Room migrations. REAL migrations only from v2 onward:
 * the database now holds user progress (Phase A5), so the v1-era
 * destructive fallback is retired (AppGraph no longer installs it).
 *
 * The CREATE TABLE statements below must match Room's generated
 * schema for ProgressEntities.kt EXACTLY (column names, types,
 * nullability, primary keys) — Room validates the schema after
 * migrating and crashes the open if they differ. */
val MIGRATION_1_2: Migration = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `lesson_progress` " +
                "(`lessonId` TEXT NOT NULL, `doneAt` INTEGER NOT NULL, " +
                "PRIMARY KEY(`lessonId`))"
        )
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `exercise_attempts` " +
                "(`exerciseId` TEXT NOT NULL, `attempts` INTEGER NOT NULL, " +
                "`solved` INTEGER NOT NULL, `hintsUsed` INTEGER NOT NULL, " +
                "`revealed` INTEGER NOT NULL, `bestMs` INTEGER NOT NULL, " +
                "`lastTry` INTEGER NOT NULL, `at` INTEGER NOT NULL, " +
                "`solveQuality` REAL, PRIMARY KEY(`exerciseId`))"
        )
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `progress_kv` " +
                "(`key` TEXT NOT NULL, `value` TEXT NOT NULL, " +
                "PRIMARY KEY(`key`))"
        )
    }
}
