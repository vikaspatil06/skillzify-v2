package com.skillzify.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/* App 2.0 Phase B — AI Interview Intelligence, data layer.
 * The bank is the website's interview-bank.js converted verbatim by
 * convert.js into assets/interview.json (45 technical / 15 HR /
 * 8 coding / 60 aptitude, plus companies, personas and GD topics for
 * the later Phase B steps). Same trust rules as the web: rubric
 * points drive scoring, generated follow-ups never reveal answers,
 * and every AI path has a deterministic local fallback. */

data class IvFollowup(val kind: String, val q: String, val point: Int = -1)

data class IvQuestion(
    val id: String,
    val topic: String,
    val skill: String,
    val tier: Int,
    val q: String,
    val points: List<String>,
    val followups: List<IvFollowup>
)

data class IvTest(val run: String?, val expect: String)

data class IvCoding(
    val id: String,
    val title: String,
    val topic: String,
    val tier: Int,
    val minutes: Int,
    val prompt: String,
    val starter: String,
    val visible: List<IvTest>,
    val hidden: List<IvTest>,
    val ideaPoints: List<String>,
    val optimalTime: String = "",
    val optimalSpace: String = ""
)

data class IvAptitude(
    val id: String,
    val area: String,
    val q: String,
    val options: List<String>,
    val answer: Int,
    val why: String
)

data class IvCompany(
    val id: String,
    val name: String,
    val note: String,
    val topics: List<String>,
    val tierBias: Int,
    val hrBoost: Boolean
)

data class IvPersona(
    val key: String,
    val name: String,
    val role: String,
    val style: String,
    val intro: String
)

data class IvGdVoice(val name: String, val stance: String, val open: String)

data class IvGdTopic(
    val id: String,
    val title: String,
    val brief: String,
    val voices: List<IvGdVoice>
)

data class InterviewBank(
    val technical: List<IvQuestion> = emptyList(),
    val hr: List<IvQuestion> = emptyList(),
    val coding: List<IvCoding> = emptyList(),
    val aptitude: List<IvAptitude> = emptyList(),
    val companies: List<IvCompany> = emptyList(),
    val personas: List<IvPersona> = emptyList(),
    val gdTopics: List<IvGdTopic> = emptyList(),
    val roleTopics: Map<String, List<String>> = emptyMap(),
    val simDisclaimer: String = ""
) {
    val isEmpty: Boolean get() = technical.isEmpty() && hr.isEmpty()

    fun persona(key: String): IvPersona? = personas.firstOrNull { it.key == key }
}

/** The web's 12 target roles (interview.js ROLES). */
val INTERVIEW_ROLES = listOf(
    "Python Developer", "Software Developer", "Full Stack Developer",
    "Frontend Developer", "Backend Developer", "Java Developer",
    "Data Analyst", "Data Scientist", "AI/ML Engineer",
    "DevOps Engineer", "Cybersecurity Analyst", "QA / Software Testing Engineer"
)

/** One finished interview, kept in the local history (Store). */
data class InterviewRecord(
    val date: Long,
    val role: String,
    val type: String,
    val score: Int,
    val offline: Boolean
)

private fun JSONArray.strings(): List<String> =
    (0 until length()).map { getString(it) }

private fun parseQuestion(o: JSONObject): IvQuestion {
    val fu = o.optJSONArray("followups")
    return IvQuestion(
        id = o.getString("id"),
        topic = o.optString("topic", ""),
        skill = o.optString("skill", ""),
        tier = o.optInt("tier", 1),
        q = o.getString("q"),
        points = o.optJSONArray("points")?.strings() ?: emptyList(),
        followups = if (fu == null) emptyList() else (0 until fu.length()).map {
            val f = fu.getJSONObject(it)
            IvFollowup(
                kind = f.optString("kind", ""),
                q = f.optString("q", ""),
                point = f.optInt("point", -1)
            )
        }
    )
}

private fun parseTests(arr: JSONArray?): List<IvTest> =
    if (arr == null) emptyList() else (0 until arr.length()).map {
        val t = arr.getJSONObject(it)
        IvTest(
            run = if (t.isNull("run")) null else t.optString("run"),
            expect = t.optString("expect", "")
        )
    }

private fun parseCompanies(root: JSONObject): List<IvCompany> {
    val arr = root.optJSONArray("companies") ?: return emptyList()
    return (0 until arr.length()).map {
        val o = arr.getJSONObject(it)
        IvCompany(
            id = o.optString("id", ""),
            name = o.optString("name", ""),
            note = o.optString("note", ""),
            topics = o.optJSONArray("topics")?.strings() ?: emptyList(),
            tierBias = o.optInt("tierBias", 0),
            hrBoost = o.optBoolean("hrBoost", false)
        )
    }
}

private fun parsePersonas(root: JSONObject): List<IvPersona> {
    val arr = root.optJSONArray("panelPersonas") ?: return emptyList()
    return (0 until arr.length()).map {
        val o = arr.getJSONObject(it)
        IvPersona(
            key = o.optString("key", ""),
            name = o.optString("name", ""),
            role = o.optString("role", ""),
            style = o.optString("style", ""),
            intro = o.optString("intro", "")
        )
    }
}

private fun parseGdTopics(root: JSONObject): List<IvGdTopic> {
    val arr = root.optJSONArray("gdTopics") ?: return emptyList()
    return (0 until arr.length()).map {
        val o = arr.getJSONObject(it)
        val voices = o.optJSONArray("voices")
        IvGdTopic(
            id = o.optString("id", ""),
            title = o.optString("title", ""),
            brief = o.optString("brief", ""),
            voices = if (voices == null) emptyList() else (0 until voices.length()).map { vi ->
                val v = voices.getJSONObject(vi)
                IvGdVoice(
                    name = v.optString("name", ""),
                    stance = v.optString("stance", ""),
                    open = v.optString("open", "")
                )
            }
        )
    }
}

private fun parseRoleTopics(root: JSONObject): Map<String, List<String>> {
    val o = root.optJSONObject("roleTopics") ?: return emptyMap()
    val out = mutableMapOf<String, List<String>>()
    val keys = o.keys()
    while (keys.hasNext()) {
        val k = keys.next()
        out[k] = o.optJSONArray(k)?.strings() ?: emptyList()
    }
    return out
}

/** Fail-soft like loadAchievements: an empty bank disables the
    Interview entry gracefully instead of breaking startup. */
fun loadInterviewBank(ctx: Context): InterviewBank {
    return try {
        val json = ctx.assets.open("interview.json").bufferedReader().use { it.readText() }
        val root = JSONObject(json)
        fun questions(key: String): List<IvQuestion> {
            val arr = root.optJSONArray(key) ?: return emptyList()
            return (0 until arr.length()).map { parseQuestion(arr.getJSONObject(it)) }
        }
        val codingArr = root.optJSONArray("coding")
        val aptArr = root.optJSONArray("aptitude")
        InterviewBank(
            technical = questions("technical"),
            hr = questions("hr"),
            coding = if (codingArr == null) emptyList() else (0 until codingArr.length()).map {
                val o = codingArr.getJSONObject(it)
                IvCoding(
                    id = o.getString("id"),
                    title = o.optString("title", ""),
                    topic = o.optString("topic", ""),
                    tier = o.optInt("tier", 1),
                    minutes = o.optInt("minutes", 10),
                    prompt = o.optString("prompt", ""),
                    starter = o.optString("starter", ""),
                    visible = parseTests(o.optJSONArray("visible")),
                    hidden = parseTests(o.optJSONArray("hidden")),
                    ideaPoints = o.optJSONArray("ideaPoints")?.strings() ?: emptyList(),
                    optimalTime = o.optString("optimalTime", ""),
                    optimalSpace = o.optString("optimalSpace", "")
                )
            },
            aptitude = if (aptArr == null) emptyList() else (0 until aptArr.length()).map {
                val o = aptArr.getJSONObject(it)
                IvAptitude(
                    id = o.getString("id"),
                    area = o.optString("area", ""),
                    q = o.getString("q"),
                    options = o.optJSONArray("options")?.strings() ?: emptyList(),
                    answer = o.optInt("answer", 0),
                    why = o.optString("why", "")
                )
            },
            companies = parseCompanies(root),
            personas = parsePersonas(root),
            gdTopics = parseGdTopics(root),
            roleTopics = parseRoleTopics(root),
            simDisclaimer = root.optString("simDisclaimer", "")
        )
    } catch (e: Exception) {
        InterviewBank()
    }
}

/* ---------- deterministic local fallback (web parity) ----------
 * The web's offline path scores by token overlap against the rubric
 * points and picks bank follow-ups by the local read. Same here: an
 * interview NEVER dead-ends when the AI is unreachable or the pool is
 * exhausted — it just gets labelled "Offline scoring" in the report. */
object InterviewLocal {
    private val STOP = setOf(
        "the", "a", "an", "is", "are", "to", "of", "in", "on", "for",
        "and", "or", "it", "that", "this", "with", "as", "by", "at",
        "from", "when", "which", "can", "be", "used", "use", "using",
        "you", "your", "they", "them", "then", "than", "into", "over"
    )

    fun words(s: String): Set<String> =
        s.lowercase().split(Regex("[^a-z0-9]+"))
            .filter { it.length > 2 && it !in STOP }.toSet()

    private fun pointCovered(answerWords: Set<String>, point: String): Boolean {
        val pw = words(point)
        if (pw.isEmpty()) return false
        val hit = pw.count { it in answerWords }
        return hit.toDouble() / pw.size >= 0.34
    }

    /** Fraction of rubric points the answer covers, 0..1. */
    fun coverage(answer: String, points: List<String>): Double {
        if (points.isEmpty() || answer.isBlank()) return 0.0
        val aw = words(answer)
        if (aw.isEmpty()) return 0.0
        return points.count { pointCovered(aw, it) }.toDouble() / points.size
    }

    /** The local read the web sends the AI as a suggestion. */
    fun localRead(answer: String, points: List<String>): String = when {
        answer.isBlank() -> "empty"
        coverage(answer, points) >= 0.66 -> "strong"
        coverage(answer, points) >= 0.33 -> "partial"
        else -> "weak"
    }

    fun scoreFor(answer: String, points: List<String>): Int =
        (coverage(answer, points) * 100).toInt().coerceIn(0, 100)

    /** Index of the first rubric point the answer misses, or -1. */
    fun missingPointIndex(answer: String, points: List<String>): Int {
        val aw = words(answer)
        return points.indexOfFirst { !pointCovered(aw, it) }
    }

    /** The bank follow-up the local engine asks, or null to move on:
        strong -> deeper; partial -> probe the missing point. */
    fun localFollowup(q: IvQuestion, answer: String): IvFollowup? {
        return when (localRead(answer, q.points)) {
            "strong" -> q.followups.firstOrNull { it.kind == "deeper" }
            "partial" -> {
                val miss = missingPointIndex(answer, q.points)
                q.followups.firstOrNull { it.kind == "probe" && it.point == miss }
                    ?: q.followups.firstOrNull { it.kind == "probe" }
            }
            else -> null
        }
    }
}
