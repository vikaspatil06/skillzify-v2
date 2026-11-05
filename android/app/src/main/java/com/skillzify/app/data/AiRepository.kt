package com.skillzify.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * AI tutor client — talks to the website's own Render proxy
 * (https://skillzify-v2.onrender.com/api/explain), the same endpoint the
 * website's compiler uses. The Gemini key lives on the server, never in the
 * app. Modes mirror server.js: "" (explain code/error), "generate",
 * "fix", "flowchart" (question -> raw code only).
 *
 * All failures surface as Result.failure with a human message; callers fall
 * back to the local heuristic Explainer so a Gemini outage never blocks
 * the user.
 */
object AiRepository {
    private const val BASE = "https://skillzify-v2.onrender.com"
    private const val TIMEOUT_MS = 30000

    sealed class AiError(message: String) : Exception(message) {
        class NotConfigured : AiError("AI backend not configured on the server.")
        class Provider(message: String) : AiError(message)
        class Network : AiError("No connection — check your internet and try again.")
    }

    suspend fun ask(code: String, error: String = "", mode: String = ""): Result<String> =
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("$BASE/api/explain").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = TIMEOUT_MS
                    readTimeout = TIMEOUT_MS
                    doOutput = true
                }
                val body = JSONObject().apply {
                    put("code", code.take(8000))
                    put("error", error.take(2000))
                    put("mode", mode)
                }.toString()
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val status = conn.responseCode
                val stream = if (status in 200..299) conn.inputStream else conn.errorStream
                val text = stream?.bufferedReader()?.readText() ?: ""
                conn.disconnect()
                val json = try { JSONObject(text) } catch (e: Exception) { null }
                when {
                    status == 503 ->
                        Result.failure(AiError.NotConfigured())
                    json != null && json.has("explanation") ->
                        Result.success(json.getString("explanation"))
                    json != null && json.has("error") ->
                        Result.failure(AiError.Provider(json.getString("error")))
                    else ->
                        Result.failure(AiError.Provider("Unexpected AI response."))
                }
            } catch (e: Exception) {
                Result.failure(AiError.Network())
            }
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
