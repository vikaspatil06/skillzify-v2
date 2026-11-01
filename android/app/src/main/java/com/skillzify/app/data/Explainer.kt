package com.skillzify.app.data

/** Offline Python error explainer — ported from the web app's heuristicExplain(). */
data class Explanation(val title: String, val tips: List<String>, val offending: String?)

object Explainer {
    private data class Rule(val re: Regex, val title: String, val tips: List<String>)

    private val rules = listOf(
        Rule(Regex("SyntaxError"), "🔧 SyntaxError — Python can't parse your code", listOf(
            "Check for missing colons (:) at the end of if/for/while/def lines.",
            "Match every opening bracket ( [ { with its closing partner.",
            "Look at the line number in the error — the real mistake is often on the line just above it."
        )),
        Rule(Regex("IndentationError|unexpected indent"), "📐 IndentationError — spacing problem", listOf(
            "Use 4 spaces per indent level — never mix tabs and spaces.",
            "Every block after if/for/def/while must be indented one level deeper.",
            "An 'unexpected indent' means a line is indented with no block above it."
        )),
        Rule(Regex("NameError: name '(\\w+)'"), "🏷️ NameError — unknown name", listOf(
            "You used a variable or function that was never defined.",
            "Check for typos — 'print' vs 'Print' matters (Python is case-sensitive).",
            "Make sure the variable is assigned BEFORE the line that uses it."
        )),
        Rule(Regex("TypeError"), "🧩 TypeError — wrong type of value", listOf(
            "You're mixing incompatible types, e.g. \"5\" + 3 (string + number).",
            "Convert explicitly: int(\"5\") + 3.",
            "If calling a function, check you passed the right number of arguments."
        )),
        Rule(Regex("ZeroDivisionError"), "➗ ZeroDivisionError — divided by zero", listOf(
            "Guard the division: if b != 0: ...",
            "Or handle it: try: x = a/b except ZeroDivisionError: ..."
        )),
        Rule(Regex("IndexError"), "📋 IndexError — list index out of range", listOf(
            "Valid indexes are 0 to len(list)-1.",
            "Check loop bounds — range(len(items)) is the safe pattern.",
            "An empty list has no index 0!"
        )),
        Rule(Regex("KeyError: (.+)"), "🔑 KeyError — missing dictionary key", listOf(
            "The key doesn't exist in the dict.",
            "Use dict.get(key, default) to avoid crashes.",
            "Check spelling/case of the key."
        )),
        Rule(Regex("ValueError"), "⚠️ ValueError — right type, wrong value", listOf(
            "Common cause: int(input()) when the user typed text.",
            "Validate input first, or wrap in try/except ValueError."
        )),
        Rule(Regex("AttributeError: '(\\w+)' object has no attribute '(\\w+)'"), "🧲 AttributeError — no such method/attribute", listOf(
            "The object doesn't have that method — check the type.",
            "E.g. append() exists on lists, not strings.",
            "Typos in method names are the #1 cause."
        )),
        Rule(Regex("ImportError|ModuleNotFoundError"), "📦 ImportError — module not found", listOf(
            "Only the Python standard library is available in this app.",
            "Check the module name spelling."
        )),
        Rule(Regex("EOFError"), "⌨️ EOFError — input() ran out of data", listOf(
            "Your program called input() more times than you provided input lines.",
            "Add more lines in the 'Program input' box."
        )),
        Rule(Regex("RecursionError"), "🔁 RecursionError — infinite recursion", listOf(
            "Your function calls itself forever.",
            "Every recursive function needs a base case that stops."
        ))
    )

    fun explain(errText: String): Explanation {
        for (r in rules) {
            val m = r.re.find(errText)
            if (m != null) {
                return Explanation(r.title, r.tips, m.groups.getOrNull(1)?.value)
            }
        }
        return Explanation(
            "🤔 Unrecognized error",
            listOf("The offline explainer doesn't have a rule for this one yet.",
                "Read the last line of the traceback — it names the error type."),
            null
        )
    }

    /** Port of the web app's offlineCodeSummary(). */
    fun codeSummary(code: String): String {
        val lines = code.lines().count { it.isNotBlank() && !it.trimStart().startsWith("#") }
        val feats = mutableListOf<String>()
        if (Regex("def ").containsMatchIn(code)) feats += "defines function(s)"
        if (Regex("class ").containsMatchIn(code)) feats += "uses classes"
        if (Regex("for |while ").containsMatchIn(code)) feats += "uses loops"
        if (Regex("import ").containsMatchIn(code)) feats += "imports modules"
        if (Regex("input\\(").containsMatchIn(code)) feats += "reads user input"
        if (Regex("try:").containsMatchIn(code)) feats += "handles errors"
        return "Your program has $lines line(s) of code" +
            (if (feats.isNotEmpty()) " and " + feats.joinToString(", ") + "." else ".")
    }
}
