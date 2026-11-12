package com.skillzify.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Admin control-room client — GET /api/admin/overview, called exactly
 * the way the website's admin.js calls it: the Firebase ID token rides
 * as the `token` QUERY parameter, and the SERVER decides admin-ness
 * (verified token -> ADMIN_EMAIL). A 403 NOT_ADMIN, a 404 (old server
 * without the endpoint), or any other failure returns null — the UI
 * hides the Admin entry then. Admin is NEVER decided by an email
 * string on the client.
 *
 * All parsing is defensive (opt* accessors): missing fields degrade to
 * defaults, and [AdminOverview.raw] keeps the full payload so the UI
 * can surface fields this layer doesn't model yet.
 */
object AdminRepository {
    private const val BASE = "https://skillzify-v2.onrender.com"
    private const val TIMEOUT_MS = 30000

    data class AdminServer(
        val ai: Boolean,
        val models: List<String>,
        /** First model in the failover order (server's primary). */
        val primary: String?,
        val groq: Boolean,
        val groqModels: List<String>,
        val capStore: String,
        val authVerify: Boolean,
        val geminiKeys: Int,
        val uptimeSec: Long
    )

    data class AdminCaps(val anon: Int, val user: Int, val admin: Int, val adminEmail: String)

    data class AdminPlan(val capacity: Int, val adminReserved: Int, val userPool: Int, val userPoolUsed: Int)

    data class AdminMe(val uid: String, val email: String, val used: Int, val cap: Int)

    data class AdminIdentity(val type: String, val who: String, val count: Int)

    data class AdminToday(
        val total: Int, val userAnswers: Int, val anonAnswers: Int,
        val users: Int, val identities: List<AdminIdentity>
    )

    data class AdminDay(val date: String, val total: Int, val userAnswers: Int, val anonAnswers: Int, val users: Int)

    /** Community snapshot counts — present only if the payload carries
        a `community` object (the web admin page reads these straight
        from Firestore instead, so today's payload has none). */
    data class AdminCommunity(
        val questions: Int?, val answers: Int?, val showcase: Int?, val publicProfiles: Int?
    )

    data class AdminOverview(
        val ok: Boolean,
        val date: String,
        val server: AdminServer,
        val caps: AdminCaps,
        val plan: AdminPlan?,
        val me: AdminMe,
        val today: AdminToday,
        val days: List<AdminDay>,
        val community: AdminCommunity?,
        /** Escape hatch: the full parsed payload, unmodelled fields included. */
        val raw: JSONObject
    )

    private fun JSONObject.strList(key: String): List<String> {
        val arr = optJSONArray(key) ?: return emptyList()
        return (0 until arr.length()).map { arr.optString(it, "") }.filter { it.isNotEmpty() }
    }

    private fun parseOverview(json: JSONObject): AdminOverview {
        val sv = json.optJSONObject("server") ?: JSONObject()
        val models = sv.strList("models")
        val caps = json.optJSONObject("caps") ?: JSONObject()
        val plan = json.optJSONObject("plan")?.let {
            AdminPlan(
                capacity = it.optInt("capacity", 0),
                adminReserved = it.optInt("adminReserved", 0),
                userPool = it.optInt("userPool", 0),
                userPoolUsed = it.optInt("userPoolUsed", 0)
            )
        }
        val me = json.optJSONObject("me") ?: JSONObject()
        val today = json.optJSONObject("today") ?: JSONObject()
        val identities = mutableListOf<AdminIdentity>()
        val idArr = today.optJSONArray("identities") ?: JSONArray()
        for (i in 0 until idArr.length()) {
            val e = idArr.optJSONObject(i) ?: continue
            identities.add(
                AdminIdentity(
                    type = e.optString("type", ""),
                    who = e.optString("who", ""),
                    count = e.optInt("count", 0)
                )
            )
        }
        val days = mutableListOf<AdminDay>()
        val dayArr = json.optJSONArray("days") ?: JSONArray()
        for (i in 0 until dayArr.length()) {
            val d = dayArr.optJSONObject(i) ?: continue
            days.add(
                AdminDay(
                    date = d.optString("date", ""),
                    total = d.optInt("total", 0),
                    userAnswers = d.optInt("userAnswers", 0),
                    anonAnswers = d.optInt("anonAnswers", 0),
                    users = d.optInt("users", 0)
                )
            )
        }
        val community = json.optJSONObject("community")?.let {
            fun n(k: String): Int? = if (it.has(k) && !it.isNull(k)) it.optInt(k, 0) else null
            AdminCommunity(n("questions"), n("answers"), n("showcase"), n("publicProfiles"))
        }
        return AdminOverview(
            ok = json.optBoolean("ok", false),
            date = json.optString("date", ""),
            server = AdminServer(
                ai = sv.optBoolean("ai", false),
                models = models,
                primary = models.firstOrNull(),
                groq = sv.optBoolean("groq", false),
                groqModels = sv.strList("groqModels"),
                capStore = sv.optString("capStore", ""),
                authVerify = sv.optBoolean("authVerify", false),
                geminiKeys = sv.optInt("geminiKeys", 0),
                uptimeSec = sv.optLong("uptimeSec", 0)
            ),
            caps = AdminCaps(
                anon = caps.optInt("anon", 0),
                user = caps.optInt("user", 0),
                admin = caps.optInt("admin", 0),
                adminEmail = caps.optString("adminEmail", "")
            ),
            plan = plan,
            me = AdminMe(
                uid = me.optString("uid", ""), email = me.optString("email", ""),
                used = me.optInt("used", 0), cap = me.optInt("cap", 0)
            ),
            today = AdminToday(
                total = today.optInt("total", 0),
                userAnswers = today.optInt("userAnswers", 0),
                anonAnswers = today.optInt("anonAnswers", 0),
                users = today.optInt("users", 0),
                identities = identities
            ),
            days = days,
            community = community,
            raw = json
        )
    }

    /**
     * Fetches the overview with a fresh Firebase ID token (the caller
     * obtains it — see AppViewModel.refreshAiAndAdmin). Returns null on
     * 403 NOT_ADMIN, 404, any non-200, an unparseable body, an
     * ok != true payload, or any network failure.
     */
    suspend fun fetchOverview(token: String): AdminOverview? =
        withContext(Dispatchers.IO) {
            try {
                val url = URL("$BASE/api/admin/overview?token=" +
                    URLEncoder.encode(token, "UTF-8"))
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = TIMEOUT_MS
                    readTimeout = TIMEOUT_MS
                }
                val status = conn.responseCode
                val stream = if (status in 200..299) conn.inputStream else conn.errorStream
                val text = stream?.bufferedReader()?.readText() ?: ""
                conn.disconnect()
                if (status != 200) return@withContext null
                val json = try { JSONObject(text) } catch (e: Exception) { return@withContext null }
                if (!json.optBoolean("ok", false)) return@withContext null
                parseOverview(json)
            } catch (e: Exception) { null }
        }
}
