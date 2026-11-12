package com.skillzify.app.data

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.URLEncoder

/**
 * AI tutor client — talks to the website's own Render proxy
 * (https://skillzify-v2.onrender.com/api/explain), the same endpoint
 * and contract as the website's ai.js v21:
 *
 * - POST body (ai.js runJob payload): { mode, stage, code (<=8000),
 *   error (<=2000), context (<=2000), uid, email, token, json }.
 *   `token` is the signed-in user's Firebase ID token (the server
 *   verifies it and derives uid/email from it); signed-out calls send
 *   uid/email/token empty, exactly like the web's anonymous calls.
 *   The token fetch is raced against 3 s (web idToken()) — a stuck
 *   fetch sends the call tokenless rather than wedging it.
 * - Retry (ai.js backendAsk), at most ONE retry:
 *     * HTTP 503 with code != NOT_CONFIGURED, after 2000 ms;
 *     * HTTP 429 with code == QUOTA, after 2000 ms;
 *     * a network failure (connection error, NOT a timeout), after
 *       1500 ms. Timeouts are never retried (web P1-23: the server may
 *       still complete and count the aborted request).
 *   First attempt timeout 60 s (cold Render), retry timeout 10 s.
 * - DAILY_CAP / POOL_CAP (and every other coded error): the server's
 *   message is surfaced VERBATIM in AiError.Provider.message with the
 *   server `code` in AiError.Provider.code — never retried, never
 *   reworded. Callers fall back to the local heuristic Explainer only
 *   for non-cap failures, mirroring the web.
 *
 * Production currently runs the OLD server (Vikas's call): /api/explain
 * there predates token verification and the pool, /api/usage returns
 * the basic shape, and /api/admin/overview does not exist (404). Every
 * call here degrades gracefully against it.
 */
object AiRepository {
    private const val BASE = "https://skillzify-v2.onrender.com"
    private const val TIMEOUT_FIRST_MS = 60000
    private const val TIMEOUT_RETRY_MS = 10000
    private const val TIMEOUT_USAGE_MS = 30000

    sealed class AiError(message: String) : Exception(message) {
        class NotConfigured : AiError("AI backend not configured on the server.")
        /** Server error: [message] is the server's message VERBATIM,
            [code] its machine code (DAILY_CAP, POOL_CAP, QUOTA, ...). */
        class Provider(message: String, val code: String = "") : AiError(message)
        class Network : AiError("No connection — check your internet and try again.")
    }

    data class AiUsage(
        val used: Int, val cap: Int, val admin: Boolean,
        val poolUsed: Int? = null, val poolCap: Int? = null
    )

    /* ---------------- identity (AuthRepository patterns) ---------------- */

    private fun currentUser() = try { FirebaseAuth.getInstance().currentUser } catch (e: Exception) { null }

    /** Fresh-enough ID token (getIdToken(false), like the web's cached
        token), raced against 3 s; "" when signed out or unavailable. */
    suspend fun freshIdToken(): String {
        val user = currentUser() ?: return ""
        return try {
            withTimeoutOrNull(3000) {
                user.getIdToken(false).await().token ?: ""
            } ?: ""
        } catch (e: Exception) { "" }
    }

    /* ---------------- /api/explain ---------------- */

    private class HttpResult(val status: Int, val json: JSONObject?)

    private fun postExplain(payload: JSONObject, timeoutMs: Int): HttpResult {
        val conn = (URL("$BASE/api/explain").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
            doOutput = true
        }
        conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
        val status = conn.responseCode
        val stream = if (status in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader()?.readText() ?: ""
        conn.disconnect()
        val json = try { JSONObject(text) } catch (e: Exception) { null }
        return HttpResult(status, json)
    }

    suspend fun ask(
        code: String, error: String = "", mode: String = "",
        context: String = "", stage: String = "", json: Boolean = false
    ): Result<String> = withContext(Dispatchers.IO) {
        val user = currentUser()
        val payload = JSONObject().apply {
            put("mode", mode)
            put("stage", stage)
            put("code", code.take(8000))
            put("error", error.take(2000))
            put("context", context.take(2000))
            put("uid", user?.uid ?: "")
            put("email", user?.email ?: "")
            put("token", freshIdToken())
            put("json", json)
        }
        explainWithRetry(payload, attempt = 0)
    }

    /** ai.js backendAsk, ported: one retry, only where a retry can help. */
    private suspend fun explainWithRetry(payload: JSONObject, attempt: Int): Result<String> {
        val timeout = if (attempt == 0) TIMEOUT_FIRST_MS else TIMEOUT_RETRY_MS
        val res = try {
            postExplain(payload, timeout)
        } catch (e: SocketTimeoutException) {
            // Our own timeout firing (web's AbortError): NEVER retried.
            return Result.failure(AiError.Network())
        } catch (e: IOException) {
            // Network failure (web's TypeError): retry once after 1500 ms.
            if (attempt < 1) {
                delay(1500)
                return explainWithRetry(payload, attempt + 1)
            }
            return Result.failure(AiError.Network())
        } catch (e: Exception) {
            return Result.failure(AiError.Network())
        }
        val json = res.json
        if (res.status in 200..299 && json != null && json.has("explanation")) {
            return Result.success(json.getString("explanation"))
        }
        val errCode = json?.optString("code", "")?.ifEmpty { "HTTP_${res.status}" } ?: "HTTP_${res.status}"
        // Retry once: 503 overload (not NOT_CONFIGURED) or 429 QUOTA,
        // after 2000 ms. DAILY_CAP / POOL_CAP / RATE_LIMIT are never
        // retried — a retry would burn a second daily answer.
        if (attempt < 1 && ((res.status == 503 && errCode != "NOT_CONFIGURED") || (res.status == 429 && errCode == "QUOTA"))) {
            delay(2000)
            return explainWithRetry(payload, attempt + 1)
        }
        val serverMsg = json?.optString("error", "") ?: ""
        return when {
            errCode == "NOT_CONFIGURED" -> Result.failure(AiError.NotConfigured())
            serverMsg.isNotEmpty() -> Result.failure(AiError.Provider(serverMsg, errCode))
            res.status == 503 -> Result.failure(AiError.NotConfigured())
            else -> Result.failure(AiError.Provider("Unexpected AI response.", errCode))
        }
    }

    /* ---------------- /api/usage ---------------- */

    /**
     * GET /api/usage?uid=&email=&token= — query params exactly as ai.js
     * usage() sends them (all three always present, empty when signed
     * out). Parses { ok, used, cap, admin } plus poolUsed/poolCap when
     * the payload carries them (top-level, or a nested pool/plan
     * object). Null on any failure or ok != true. The OLD production
     * server returns the basic shape — used/cap/admin parse as-is and
     * the pool fields stay null.
     */
    suspend fun fetchUsage(): AiUsage? = withContext(Dispatchers.IO) {
        try {
            val user = currentUser()
            fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
            val q = "uid=" + enc(user?.uid ?: "") +
                "&email=" + enc(user?.email ?: "") +
                "&token=" + enc(freshIdToken())
            val conn = (URL("$BASE/api/usage?$q").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = TIMEOUT_USAGE_MS
                readTimeout = TIMEOUT_USAGE_MS
            }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.readText() ?: ""
            conn.disconnect()
            if (status != 200) return@withContext null
            val json = try { JSONObject(text) } catch (e: Exception) { return@withContext null }
            if (!json.optBoolean("ok", false)) return@withContext null
            fun optIntOrNull(o: JSONObject?, key: String): Int? =
                if (o != null && o.has(key) && !o.isNull(key)) o.optInt(key, 0) else null
            val pool = json.optJSONObject("pool")
            val plan = json.optJSONObject("plan")
            AiUsage(
                used = json.optInt("used", 0),
                cap = json.optInt("cap", 0),
                admin = json.optBoolean("admin", false),
                poolUsed = optIntOrNull(json, "poolUsed")
                    ?: optIntOrNull(pool, "used")
                    ?: optIntOrNull(plan, "userPoolUsed"),
                poolCap = optIntOrNull(json, "poolCap")
                    ?: optIntOrNull(pool, "cap")
                    ?: optIntOrNull(plan, "userPool")
            )
        } catch (e: Exception) { null }
    }

    /** Extracts the ```python fenced block (generate/fix answers). Null when absent. */
    fun extractCode(text: String): String? {
        val fence = Regex("```(?:python|py)?\\s*\\n([\\s\\S]*?)```")
        return fence.find(text)?.groupValues?.get(1)?.trim()?.takeIf { it.isNotEmpty() }
    }

    /** Bullets after the code fence (generate/fix explanations). */
    fun afterCode(text: String): String {
        val idx = text.lastIndexOf("```")
        return if (idx >= 0) text.substring(idx + 3).trim() else text
    }
}
