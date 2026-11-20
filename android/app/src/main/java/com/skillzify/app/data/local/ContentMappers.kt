package com.skillzify.app.data.local

import com.skillzify.app.data.AchievementDef
import com.skillzify.app.data.Challenge
import com.skillzify.app.data.ExTest
import com.skillzify.app.data.Exercise
import com.skillzify.app.data.LearnPath
import com.skillzify.app.data.Lesson
import com.skillzify.app.data.Level
import com.skillzify.app.data.PathStep
import com.skillzify.app.data.Project
import com.skillzify.app.data.QuizQ
import com.skillzify.app.data.RefEntry
import com.skillzify.app.data.Snippet
import com.skillzify.app.data.Track
import org.json.JSONArray
import org.json.JSONObject

/* App 2.0 Phase A2 (prepared in A1) — entity -> model mapping.
 *
 * The decode rules deliberately mirror Models.kt's asset parsers
 * (parseQuiz / parseChallenge / parseExTest) so a catalog read from
 * Room is indistinguishable from one parsed from the asset JSON:
 * - challenge "predict": answer is an Int index; anything else: answer
 *   is a String or a JSONArray of accepted answers.
 * - nullable JSON fields (run/expr/expectError, lesson code on a
 *   challenge) use JSONObject.NULL checks, exactly like the loaders.
 * If Models.kt's parsing rules ever change, change them here too —
 * the A2 exit check compares Room-loaded counts AND a sample of full
 * lesson/exercise objects against the asset-loaded ones. */

private fun JSONArray.strings(): List<String> =
    (0 until length()).map { getString(it) }

private fun parseQuiz(o: JSONObject) = QuizQ(
    q = o.getString("q"),
    options = o.getJSONArray("options").strings(),
    answer = o.getInt("answer"),
    why = o.optString("why", "")
)

private fun parseChallenge(o: JSONObject): Challenge {
    val type = o.getString("type")
    val options = if (o.has("options")) o.getJSONArray("options").strings() else emptyList()
    var answerIndex = -1
    var answers: List<String> = emptyList()
    if (type == "predict") {
        answerIndex = o.getInt("answer")
    } else {
        val a = o.get("answer")
        answers = if (a is JSONArray) a.strings() else listOf(a.toString())
    }
    return Challenge(
        type = type,
        prompt = o.getString("prompt"),
        code = if (o.has("code")) o.getString("code") else null,
        options = options,
        answerIndex = answerIndex,
        answers = answers,
        hint = if (o.has("hint")) o.getString("hint") else null
    )
}

private fun parseExTest(o: JSONObject) = ExTest(
    run = if (o.isNull("run")) null else o.getString("run"),
    expr = if (o.isNull("expr")) null else o.getString("expr"),
    expect = o.optString("expect", ""),
    expectError = if (o.isNull("expectError")) null else o.getString("expectError")
)

fun TrackEntity.toModel() = Track(id, name, desc, icon, needs)

fun LevelEntity.toModel() = Level(xp, name)

fun LessonEntity.toModel(): Lesson {
    val quizArr = JSONArray(quizJson)
    val takeawaysArr = JSONArray(takeawaysJson)
    return Lesson(
        id = id,
        track = track,
        title = title,
        explain = explain,
        takeaways = (0 until takeawaysArr.length()).map { takeawaysArr.getString(it) },
        code = code,
        quiz = (0 until quizArr.length()).map { parseQuiz(quizArr.getJSONObject(it)) },
        challenge = parseChallenge(JSONObject(challengeJson)),
        section = section
    )
}

fun ExerciseEntity.toModel(): Exercise {
    val testsArr = JSONArray(testsJson)
    return Exercise(
        id = id,
        topic = topic,
        title = title,
        kind = kind,
        diff = diff,
        prompt = prompt,
        starter = starter,
        tests = (0 until testsArr.length()).map { parseExTest(testsArr.getJSONObject(it)) },
        hints = JSONArray(hintsJson).strings(),
        walkthrough = walkthrough,
        coach = coach,
        model = model,
        xp = xp,
        code = code,
        options = JSONArray(optionsJson).strings(),
        answer = answer
    )
}

fun RefEntryEntity.toModel() = RefEntry(id, name, category, syntax, desc, example)

fun ProjectEntity.toModel() = Project(
    id = id,
    title = title,
    desc = desc,
    difficulty = difficulty,
    skills = skills,
    icon = icon,
    milestones = JSONArray(milestonesJson).strings(),
    starter = starter
)

fun PathEntity.toModel(): LearnPath {
    val stepsArr = JSONArray(stepsJson)
    return LearnPath(
        id = id,
        title = title,
        desc = desc,
        icon = icon,
        steps = (0 until stepsArr.length()).map {
            val o = stepsArr.getJSONObject(it)
            PathStep(o.getString("type"), o.getString("ref"), o.optString("title", o.getString("ref")))
        }
    )
}

fun AchievementEntity.toModel() = AchievementDef(id, icon, name, desc)

fun SnippetEntity.toModel() = Snippet(id, name, code)
