package com.skillzify.app.data

import com.chaquo.python.Python
import org.json.JSONObject

data class RunResult(val ok: Boolean, val output: String, val error: String, val ms: Long)

data class TestResult(val ok: Boolean, val got: String, val expect: String)
data class TestsOutcome(val codeOk: Boolean, val error: String, val results: List<TestResult>, val ms: Long) {
    val allPassed: Boolean get() = codeOk && results.isNotEmpty() && results.all { it.ok }
}

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

    /** Multi-file workspace run (website Code Studio parity). */
    fun runMulti(files: Map<String, String>, mainFile: String, stdinText: String): RunResult {
        return try {
            val mod = Python.getInstance().getModule("skillzify_runner")
            val filesJson = org.json.JSONObject(files as Map<*, *>).toString()
            val json = mod.callAttr("run_multi", filesJson, mainFile, stdinText).toString()
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

    /**
     * Runs hidden tests against user code (Practice Mode).
     * tests: list of ExTest (expression + expected str, or expectError).
     * Call from a background thread; Chaquopy calls are blocking.
     */
    fun runTests(code: String, tests: List<ExTest>): TestsOutcome {
        return try {
            val mod = Python.getInstance().getModule("skillzify_runner")
            val testsJson = org.json.JSONArray().apply {
                for (t in tests) {
                    val o = org.json.JSONObject()
                        .put("run", t.run ?: t.expr ?: "")
                        .put("expect", t.expect)
                    if (t.expectError != null) o.put("expectError", t.expectError)
                    put(o)
                }
            }.toString()
            val json = mod.callAttr("run_tests", code, testsJson).toString()
            val o = JSONObject(json)
            val arr = o.getJSONArray("results")
            TestsOutcome(
                codeOk = o.getBoolean("ok"),
                error = o.getString("error"),
                results = (0 until arr.length()).map {
                    val r = arr.getJSONObject(it)
                    TestResult(r.getBoolean("ok"), r.getString("got"), r.getString("expect"))
                },
                ms = o.getLong("ms")
            )
        } catch (e: Exception) {
            TestsOutcome(false, "Test runner failed: ${e.message ?: e.javaClass.simpleName}", emptyList(), 0)
        }
    }
}
