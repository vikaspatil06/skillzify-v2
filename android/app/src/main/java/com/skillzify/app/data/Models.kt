package com.skillzify.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class Track(val id: String, val name: String, val desc: String, val icon: String, val needs: String?)
data class Level(val xp: Int, val name: String)
data class QuizQ(val q: String, val options: List<String>, val answer: Int, val why: String)
data class Challenge(
    val type: String,
    val prompt: String,
    val code: String?,
    val options: List<String>,
    /** predict: index into options. blank: accepted answers (normalized compare). */
    val answerIndex: Int,
    val answers: List<String>,
    val hint: String?
)
data class Lesson(
    val id: String, val track: String, val title: String, val explain: String,
    val takeaways: List<String>, val code: String,
    val quiz: List<QuizQ>, val challenge: Challenge
)
data class Snippet(val id: String, val name: String, val code: String)
data class RunRecord(val codePreview: String, val ok: Boolean, val timestamp: Long)

private fun JSONArray.strings(): List<String> = (0 until length()).map { getString(it) }

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

private fun parseLesson(o: JSONObject) = Lesson(
    id = o.getString("id"),
    track = o.getString("track"),
    title = o.getString("title"),
    explain = o.getString("explain"),
    takeaways = o.optJSONArray("takeaways")?.strings() ?: emptyList(),
    code = o.getString("code"),
    quiz = o.getJSONArray("quiz").let { arr -> (0 until arr.length()).map { parseQuiz(arr.getJSONObject(it)) } },
    challenge = parseChallenge(o.getJSONObject("challenge"))
)

data class Catalog(val tracks: List<Track>, val levels: List<Level>, val lessons: List<Lesson>)

/** One exercise attempt record — mirrors the web's skillzify_exercise_attempts entries. */
data class ExerciseAttempt(
    val attempts: Int = 0,
    val solved: Boolean = false,
    val hintsUsed: Int = 0,
    val revealed: Boolean = false,
    val bestMs: Long = 0,
    val lastTry: Long = 0
)

data class ExTest(val run: String?, val expr: String?, val expect: String, val expectError: String? = null)
data class Exercise(
    val id: String, val topic: String, val title: String, val kind: String,
    val diff: Int, val prompt: String, val starter: String,
    val tests: List<ExTest>, val hints: List<String>,
    val walkthrough: String, val coach: String, val model: String, val xp: Int,
    // predict-kind extras (kept from source so predict exercises run)
    val code: String?, val options: List<String>, val answer: Int
)

data class RefEntry(
    val id: String, val name: String, val category: String,
    val syntax: String, val desc: String, val example: String
)

data class PathStep(val type: String, val ref: String, val title: String)
data class LearnPath(val id: String, val title: String, val desc: String, val icon: String, val steps: List<PathStep>)

data class Project(
    val id: String, val title: String, val desc: String, val difficulty: String,
    val skills: String, val icon: String, val milestones: List<String>, val starter: String
)

fun loadCatalog(ctx: Context): Catalog {
    val json = ctx.assets.open("lessons.json").bufferedReader().use { it.readText() }
    val root = JSONObject(json)
    val tracks = root.getJSONArray("tracks").let { arr ->
        (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            Track(o.getString("id"), o.getString("name"), o.getString("desc"), o.getString("icon"),
                if (o.isNull("needs")) null else o.getString("needs"))
        }
    }
    val levels = root.getJSONArray("levels").let { arr ->
        (0 until arr.length()).map { val o = arr.getJSONObject(it); Level(o.getInt("xp"), o.getString("name")) }
    }
    val lessons = root.getJSONArray("lessons").let { arr ->
        (0 until arr.length()).map { parseLesson(arr.getJSONObject(it)) }
    }
    return Catalog(tracks, levels, lessons)
}

fun loadSnippets(ctx: Context): List<Snippet> {
    val json = ctx.assets.open("snippets.json").bufferedReader().use { it.readText() }
    val arr = JSONArray(json)
    return (0 until arr.length()).map {
        val o = arr.getJSONObject(it)
        Snippet(o.getString("id"), o.getString("name"), o.getString("code"))
    }
}

private fun parseExTest(o: JSONObject) = ExTest(
    run = if (o.isNull("run")) null else o.getString("run"),
    expr = if (o.isNull("expr")) null else o.getString("expr"),
    expect = o.optString("expect", ""),
    expectError = if (o.isNull("expectError")) null else o.getString("expectError")
)

fun loadExercises(ctx: Context): List<Exercise> {
    val json = ctx.assets.open("exercises.json").bufferedReader().use { it.readText() }
    val arr = JSONArray(json)
    return (0 until arr.length()).map {
        val o = arr.getJSONObject(it)
        Exercise(
            id = o.getString("id"),
            topic = o.optString("topic", ""),
            title = o.getString("title"),
            kind = o.getString("kind"),
            diff = o.optInt("diff", 1),
            prompt = o.getString("prompt"),
            starter = o.optString("starter", ""),
            tests = o.optJSONArray("tests")?.let { t -> (0 until t.length()).map { parseExTest(t.getJSONObject(it)) } } ?: emptyList(),
            hints = o.optJSONArray("hints")?.strings() ?: emptyList(),
            walkthrough = o.optString("walkthrough", ""),
            coach = o.optString("coach", ""),
            model = o.optString("model", ""),
            xp = o.optInt("xp", 10),
            code = if (o.isNull("code")) null else o.getString("code"),
            options = o.optJSONArray("options")?.strings() ?: emptyList(),
            answer = o.optInt("answer", 0)
        )
    }
}

fun loadReference(ctx: Context): List<RefEntry> {
    val json = ctx.assets.open("reference.json").bufferedReader().use { it.readText() }
    val arr = JSONArray(json)
    return (0 until arr.length()).map {
        val o = arr.getJSONObject(it)
        RefEntry(
            id = o.getString("id"), name = o.getString("name"),
            category = o.optString("category", "Other"),
            syntax = o.optString("syntax", ""), desc = o.optString("desc", ""),
            example = o.optString("example", "")
        )
    }
}

fun loadPaths(ctx: Context): List<LearnPath> {
    val json = ctx.assets.open("paths.json").bufferedReader().use { it.readText() }
    val arr = JSONArray(json)
    return (0 until arr.length()).map {
        val o = arr.getJSONObject(it)
        LearnPath(
            id = o.getString("id"), title = o.getString("title"),
            desc = o.optString("desc", ""), icon = o.optString("icon", "🎯"),
            steps = o.optJSONArray("steps")?.let { s ->
                (0 until s.length()).map { k ->
                    val so = s.getJSONObject(k)
                    PathStep(so.getString("type"), so.getString("ref"), so.optString("title", so.getString("ref")))
                }
            } ?: emptyList()
        )
    }
}

fun loadProjects(ctx: Context): List<Project> {
    val json = ctx.assets.open("projects.json").bufferedReader().use { it.readText() }
    val arr = JSONArray(json)
    return (0 until arr.length()).map {
        val o = arr.getJSONObject(it)
        Project(
            id = o.getString("id"), title = o.getString("title"),
            desc = o.optString("desc", ""), difficulty = o.optString("difficulty", "Beginner"),
            skills = o.optString("skills", ""), icon = o.optString("icon", "🛠"),
            milestones = o.optJSONArray("milestones")?.strings() ?: emptyList(),
            starter = o.optString("starter", "")
        )
    }
}

/** Web parity: gain = 20 + (quiz questions correct on first try) * 5 + 10 */
fun xpGain(quizFirstTries: Int): Int = 20 + quizFirstTries * 5 + 10

/** A quiz question with shuffled options (answer remapped) — mirrors web buildQuiz(). */
data class ShuffledQuiz(val q: String, val options: List<String>, val answer: Int, val why: String)

/** Picks 3 random questions from the 5-question bank, shuffles options. */
fun buildQuiz(lesson: Lesson, seed: Long = System.currentTimeMillis()): List<ShuffledQuiz> {
    val rnd = kotlin.random.Random(seed)
    return lesson.quiz.shuffled(rnd).take(3).map { q ->
        val order = q.options.indices.shuffled(rnd)
        ShuffledQuiz(
            q = q.q,
            options = order.map { q.options[it] },
            answer = order.indexOf(q.answer),
            why = q.why
        )
    }
}

fun levelFor(levels: List<Level>, xp: Int): Level = levels.filter { xp >= it.xp }.maxByOrNull { it.xp } ?: levels.first()
fun nextLevel(levels: List<Level>, xp: Int): Level? = levels.filter { it.xp > xp }.minByOrNull { it.xp }
