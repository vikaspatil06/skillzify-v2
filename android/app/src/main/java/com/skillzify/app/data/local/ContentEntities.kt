package com.skillzify.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/* App 2.0 Phase A1 — Room mirror of the content catalog (Models.kt).
 *
 * Design rules:
 * - One entity per content type; scalar fields are real columns so search
 *   and filtering can run in SQL; list/nested fields (quiz, challenge,
 *   tests, steps, milestones) are stored as JSON strings in the exact
 *   org.json encoding the asset files use, and are decoded by the same
 *   parsing approach as Models.kt when A2 wires the read path.
 * - `position` preserves the asset order (journey order for lessons,
 *   bank order for exercises) — ORDER BY position reproduces today's
 *   in-memory lists exactly.
 * - This database holds CONTENT ONLY in Phase A. It is re-importable from
 *   the bundled assets at any time, which is why SkillzifyDatabase may
 *   use destructive migration for now. Progress tables (Phase A5) must
 *   ship real migrations — see the breakdown doc. */

/** Journey sections (lessons.json "tracks"). `needs` = previous section id. */
@Entity(tableName = "tracks")
data class TrackEntity(
    @PrimaryKey val id: String,
    val name: String,
    val desc: String,
    val icon: String,
    val needs: String?,
    val position: Int
)

@Entity(tableName = "lessons")
data class LessonEntity(
    @PrimaryKey val id: String,
    val track: String,
    val section: String,
    val title: String,
    val explain: String,
    val code: String,
    /** JSONArray string of takeaway strings. */
    val takeawaysJson: String,
    /** JSONArray string of quiz question objects (Models.kt QuizQ shape). */
    val quizJson: String,
    /** JSONObject string of the challenge (Models.kt Challenge source shape). */
    val challengeJson: String,
    val position: Int
)

@Entity(tableName = "exercises")
data class ExerciseEntity(
    @PrimaryKey val id: String,
    val topic: String,
    val kind: String,
    val diff: Int,
    val title: String,
    val prompt: String,
    val starter: String,
    val code: String?,
    val answer: Int,
    val xp: Int,
    /** JSONArray string of ExTest objects. */
    val testsJson: String,
    /** JSONArray string of hint strings. */
    val hintsJson: String,
    /** JSONArray string of predict-kind option strings. */
    val optionsJson: String,
    val walkthrough: String,
    val coach: String,
    val model: String,
    val position: Int
)

@Entity(tableName = "reference_entries")
data class RefEntryEntity(
    @PrimaryKey val id: String,
    val name: String,
    val category: String,
    val syntax: String,
    val desc: String,
    val example: String,
    val position: Int
)

@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey val id: String,
    val title: String,
    val desc: String,
    val difficulty: String,
    val skills: String,
    val icon: String,
    val starter: String,
    /** JSONArray string of milestone strings. */
    val milestonesJson: String,
    val position: Int
)

@Entity(tableName = "paths")
data class PathEntity(
    @PrimaryKey val id: String,
    val title: String,
    val desc: String,
    val icon: String,
    /** JSONArray string of PathStep objects. */
    val stepsJson: String,
    val position: Int
)

@Entity(tableName = "achievements")
data class AchievementEntity(
    @PrimaryKey val id: String,
    val icon: String,
    val name: String,
    val desc: String,
    val position: Int
)

@Entity(tableName = "snippets")
data class SnippetEntity(
    @PrimaryKey val id: String,
    val name: String,
    val code: String,
    val position: Int
)

/** XP level ladder (lessons.json "levels"). */
@Entity(tableName = "levels")
data class LevelEntity(
    @PrimaryKey val xp: Int,
    val name: String,
    val position: Int
)

/** Key/value bookkeeping: content version, per-file hashes, import time. */
@Entity(tableName = "content_meta")
data class ContentMetaEntity(
    @PrimaryKey val key: String,
    val value: String
)
