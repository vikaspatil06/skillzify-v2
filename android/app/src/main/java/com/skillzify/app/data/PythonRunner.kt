package com.skillzify.app.data

import com.chaquo.python.Python
import org.json.JSONObject

data class RunResult(val ok: Boolean, val output: String, val error: String, val ms: Long)

/** Runs Python via Chaquopy's skillzify_runner module on a background thread. */
object PythonRunner {
    fun run(code: String, stdinText: String): RunResult {
        return try {
            val mod = Python.getInstance().getModule("skillzify_runner")
            val json = mod.callAttr("run_code", code, stdinText).toString()
            val o = JSONObject(json)
            RunResult(
                ok = o.getBoolean("ok"),
                output = o.getString("output"),
                error = o.getString("error"),
                ms = o.getLong("ms")
            )
        } catch (e: Exception) {
            RunResult(
                ok = false,
                output = "",
                error = "Runner failed: ${e.message ?: e.javaClass.simpleName}",
                ms = 0
            )
        }
    }

    /** Mirrors the web app's stdin handling: one line per input() call. */
    fun makeStdin(raw: String): String {
        val lines = raw.split("\n").toMutableList()
        if (lines.isNotEmpty() && lines.last().isEmpty()) lines.removeAt(lines.size - 1)
        return if (lines.isEmpty()) "" else lines.joinToString("\n") + "\n"
    }
}
