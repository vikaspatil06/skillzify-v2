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

/** Web parity: gain = 20 + (quiz questions correct on first try) * 5 + 10 */
fun xpGain(quizFirstTries: Int): Int = 20 + quizFirstTries * 5 + 10

fun levelFor(levels: List<Level>, xp: Int): Level = levels.filter { xp >= it.xp }.maxByOrNull { it.xp } ?: levels.first()
fun nextLevel(levels: List<Level>, xp: Int): Level? = levels.filter { it.xp > xp }.minByOrNull { it.xp }
