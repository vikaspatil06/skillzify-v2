package com.skillzify.app.data.local

import androidx.room.withTransaction
import com.skillzify.app.data.AchievementDef
import com.skillzify.app.data.Catalog
import com.skillzify.app.data.Challenge
import com.skillzify.app.data.ExTest
import com.skillzify.app.data.Exercise
import com.skillzify.app.data.LearnPath
import com.skillzify.app.data.Lesson
import com.skillzify.app.data.PathStep
import com.skillzify.app.data.Project
import com.skillzify.app.data.QuizQ
import com.skillzify.app.data.RefEntry
import com.skillzify.app.data.Snippet
import org.json.JSONArray
import org.json.JSONObject

/* App 2.0 Phase A1 — writes the parsed catalog (Models.kt loaders are
 * still the parsers in A1) into the Room content database.
 *
 * The whole import runs in ONE transaction: a crash mid-import leaves
 * either the old catalog or the new one, never a half-written mix.
 * Nested/list fields are encoded with org.json in the same shapes the
 * asset files use, so the A2 read path can decode them with the same
 * rules as Models.kt's parsers.
 *
 * A1 status: NOT wired into AppViewModel yet (that is A2). This class is
 * exercised first by the A2 startup path behind the content-version
 * check: import only when the stored version differs from the bundled
 * assets' version. */
class ContentImporter(private val db: SkillzifyDatabase) {

    /** Returns the content version that was imported. */
    suspend fun importAll(
        catalog: Catalog,
        exercises: List<Exercise>,
        reference: List<RefEntry>,
        paths: List<LearnPath>,
        projects: List<Project>,
        achievements: List<AchievementDef>,
        snippets: List<Snippet>,
        hashes: Map<String, String>
    ): String {
        val version = ContentManifest.contentVersion(hashes)
        db.withTransaction {
            db.trackDao().clear()
            db.trackDao().insertAll(catalog.tracks.mapIndexed { i, t ->
                TrackEntity(t.id, t.name, t.desc, t.icon, t.needs, i)
            })
            db.levelDao().clear()
            db.levelDao().insertAll(catalog.levels.mapIndexed { i, l ->
                LevelEntity(l.xp, l.name, i)
            })
            db.lessonDao().clear()
            db.lessonDao().insertAll(catalog.lessons.mapIndexed { i, l -> l.toEntity(i) })
            db.exerciseDao().clear()
            db.exerciseDao().insertAll(exercises.mapIndexed { i, e -> e.toEntity(i) })
            db.refEntryDao().clear()
            db.refEntryDao().insertAll(reference.mapIndexed { i, r ->
                RefEntryEntity(r.id, r.name, r.category, r.syntax, r.desc, r.example, i)
            })
            db.projectDao().clear()
            db.projectDao().insertAll(projects.mapIndexed { i, p ->
                ProjectEntity(
                    p.id, p.title, p.desc, p.difficulty, p.skills, p.icon, p.starter,
                    JSONArray(p.milestones).toString(), i
                )
            })
            db.pathDao().clear()
            db.pathDao().insertAll(paths.mapIndexed { i, p ->
                PathEntity(p.id, p.title, p.desc, p.icon, stepsJson(p.steps), i)
            })
            db.achievementDao().clear()
            db.achievementDao().insertAll(achievements.mapIndexed { i, a ->
                AchievementEntity(a.id, a.icon, a.name, a.desc, i)
            })
            db.snippetDao().clear()
            db.snippetDao().insertAll(snippets.mapIndexed { i, s ->
                SnippetEntity(s.id, s.name, s.code, i)
            })
            val meta = db.contentMetaDao()
            meta.put(ContentMetaEntity(ContentManifest.META_CONTENT_VERSION, version))
            meta.put(
                ContentMetaEntity(
                    ContentManifest.META_IMPORTED_AT,
                    System.currentTimeMillis().toString()
                )
            )
            hashes.forEach { (file, hash) ->
                meta.put(ContentMetaEntity(ContentManifest.metaKeyForHash(file), hash))
            }
        }
        return version
    }

    /** The version currently stored, or null when nothing is imported yet. */
    suspend fun importedVersion(): String? =
        db.contentMetaDao().get(ContentManifest.META_CONTENT_VERSION)

    /** Row counts for the A2 exit check (expect 250/150/127/15/6/32). */
    suspend fun counts(): Map<String, Int> = mapOf(
        "lessons" to db.lessonDao().count(),
        "exercises" to db.exerciseDao().count(),
        "reference" to db.refEntryDao().count(),
        "projects" to db.projectDao().count(),
        "paths" to db.pathDao().count(),
        "achievements" to db.achievementDao().count()
    )

    private fun Lesson.toEntity(position: Int) = LessonEntity(
        id = id,
        track = track,
        section = section,
        title = title,
        explain = explain,
        code = code,
        takeawaysJson = JSONArray(takeaways).toString(),
        quizJson = JSONArray().apply { quiz.forEach { put(it.toJson()) } }.toString(),
        challengeJson = challenge.toJson().toString(),
        position = position
    )

    private fun Exercise.toEntity(position: Int) = ExerciseEntity(
        id = id,
        topic = topic,
        kind = kind,
        diff = diff,
        title = title,
        prompt = prompt,
        starter = starter,
        code = code,
        answer = answer,
        xp = xp,
        testsJson = JSONArray().apply { tests.forEach { put(it.toJson()) } }.toString(),
        hintsJson = JSONArray(hints).toString(),
        optionsJson = JSONArray(options).toString(),
        walkthrough = walkthrough,
        coach = coach,
        model = model,
        position = position
    )

    private fun QuizQ.toJson(): JSONObject = JSONObject().apply {
        put("q", q)
        put("options", JSONArray(options))
        put("answer", answer)
        put("why", why)
    }

    private fun Challenge.toJson(): JSONObject = JSONObject().apply {
        put("type", type)
        put("prompt", prompt)
        if (code != null) put("code", code)
        if (options.isNotEmpty()) put("options", JSONArray(options))
        if (type == "predict") {
            put("answer", answerIndex)
        } else if (answers.size == 1) {
            put("answer", answers[0])
        } else {
            put("answer", JSONArray(answers))
        }
        if (hint != null) put("hint", hint)
    }

    private fun ExTest.toJson(): JSONObject = JSONObject().apply {
        put("run", run ?: JSONObject.NULL)
        put("expr", expr ?: JSONObject.NULL)
        put("expect", expect)
        put("expectError", expectError ?: JSONObject.NULL)
    }

    private fun stepsJson(steps: List<PathStep>): String =
        JSONArray().apply {
            steps.forEach { s ->
                put(JSONObject().apply {
                    put("type", s.type)
                    put("ref", s.ref)
                    put("title", s.title)
                })
            }
        }.toString()
}
