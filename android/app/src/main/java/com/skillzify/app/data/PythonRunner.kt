package com.skillzify.app.data

import android.content.Context
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import org.json.JSONObject

data class RunResult(val ok: Boolean, val output: String, val error: String, val ms: Long)

data class TestResult(val ok: Boolean, val got: String, val expect: String)
data class TestsOutcome(val codeOk: Boolean, val error: String, val results: List<TestResult>, val ms: Long) {
    val allPassed: Boolean get() = codeOk && results.isNotEmpty() && results.all { it.ok }
}

data class FlowNode(val id: String, val type: String, val label: String)
data class FlowEdge(val from: String, val to: String, val label: String)
data class FlowGraph(val nodes: List<FlowNode>, val edges: List<FlowEdge>, val truncated: Boolean, val error: String?) {
    /** Mermaid `flowchart TD` text for copy/share (website export parity). */
    fun toMermaid(): String {
        val sb = StringBuilder("flowchart TD\n")
        for (n in nodes) {
            val safe = n.label.replace("\"", "'").replace("[", "(").replace("]", ")")
                .replace("{", "(").replace("}", ")").replace(";", ",")
            val shape = when (n.type) {
                "start", "end" -> "([\"$safe\"])"
                "io" -> "[/\"$safe\"/]"
                "decision" -> "{\"$safe\"}"
                else -> "[\"$safe\"]"
            }
            sb.append("    ${n.id}$shape\n")
        }
        for (e in edges) {
            if (e.label.isNotEmpty()) sb.append("    ${e.from} -->|${e.label}| ${e.to}\n")
            else sb.append("    ${e.from} --> ${e.to}\n")
        }
        return sb.toString()
    }
}

/** Runs Python via Chaquopy's skillzify_runner module on a background thread. */
object PythonRunner {
    /* ---- Lazy interpreter start (performance pass, v1.3.1) ----
       The manifest used to name Chaquopy's PyApplication, which starts
       the interpreter on the MAIN thread at every app launch — a cold
       cost paid even by users who never open the compiler. Now the
       interpreter starts on first actual use. Every call site already
       runs on a background thread (Compiler's executor, Dispatchers.IO /
       Default), so the one-time start blocks only that thread. */
    @Volatile private var appContext: Context? = null
    @Volatile private var started = false

    /** Stashes the Application context; called once from AppViewModel init. */
    fun init(context: Context) {
        appContext = context.applicationContext
    }

    private fun ensureStarted() {
        if (started) return
        synchronized(this) {
            if (started) return
            val ctx = appContext
                ?: throw IllegalStateException("PythonRunner.init() was not called")
            if (!Python.isStarted()) Python.start(AndroidPlatform(ctx))
            started = true
        }
    }
    /**
     * Flowchart Lab (website parity): AST graph for Python code, or the
     * pseudocode parser for algorithm text. Returns FlowGraph; error is set
     * for syntax problems instead of throwing.
     */
    fun flowchart(input: String, algo: Boolean): FlowGraph {
        return try {
            ensureStarted()
            val mod = Python.getInstance().getModule(
                if (algo) "flowchart_algo" else "flowchart_gen"
            )
            val json = mod.callAttr(
                if (algo) "algo_flowchart_json" else "flowchart_json", input
            ).toString()
            val o = JSONObject(json)
            val nodes = o.getJSONArray("nodes").let { arr ->
                (0 until arr.length()).map {
                    val n = arr.getJSONObject(it)
                    FlowNode(n.getString("id"), n.getString("type"), n.getString("label"))
                }
            }
            val edges = o.getJSONArray("edges").let { arr ->
                (0 until arr.length()).map {
                    val e = arr.getJSONObject(it)
                    FlowEdge(e.getString("from"), e.getString("to"), e.optString("label", ""))
                }
            }
            FlowGraph(nodes, edges, o.optBoolean("truncated", false),
                if (o.isNull("error")) null else o.optString("error"))
        } catch (e: Exception) {
            FlowGraph(emptyList(), emptyList(), false,
                "Flowchart failed: ${e.message ?: e.javaClass.simpleName}")
        }
    }
    fun run(code: String, stdinText: String): RunResult {
        return try {
            ensureStarted()
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
            ensureStarted()
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

    /** Multi-file workspace run with a live interactive terminal (website
        Code Studio parity). The bridge streams output and blocks input()
        until the user answers in the terminal. Call from a background thread. */
    fun runMultiInteractive(files: Map<String, String>, mainFile: String, bridge: TerminalBridge): RunResult {
        return try {
            ensureStarted()
            val mod = Python.getInstance().getModule("skillzify_runner")
            val filesJson = org.json.JSONObject(files as Map<*, *>).toString()
            val json = mod.callAttr("run_multi_interactive", filesJson, mainFile, bridge).toString()
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
            ensureStarted()
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
