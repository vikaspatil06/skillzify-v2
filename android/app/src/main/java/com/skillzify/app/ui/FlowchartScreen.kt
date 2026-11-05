package com.skillzify.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.AiRepository
import com.skillzify.app.data.FlowGraph
import com.skillzify.app.data.PythonRunner
import com.skillzify.app.ui.theme.Accent
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.TextMuted
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val SAMPLE_CODE = "n = int(input(\"Enter a number: \"))\nif n % 2 == 0:\n    print(\"Even\")\nelse:\n    print(\"Odd\")"

private const val SAMPLE_ALGO = "START\nREAD n\nIF n > 0 THEN\n  PRINT \"positive\"\nELSE\n  PRINT \"not positive\"\nENDIF\nEND"

private fun shapeIcon(type: String) = when (type) {
    "start" -> "⬭"
    "end" -> "⬭"
    "io" -> "▱"
    "decision" -> "◆"
    "subroutine" -> "▢"
    else -> "▭"
}

/** Flowchart Lab — website parity, native rendering.
    Modes: Python code (AST), pseudocode (algorithm parser), Ask AI
    (question -> raw code via the Render proxy -> AST graph). Trace steps
    through nodes in order, like the website's trace bar. */
@Composable
fun FlowchartScreen(vm: AppViewModel, nav: NavController) {
    val scope = rememberCoroutineScope()
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val clipboard = ctx.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager

    var mode by remember { mutableStateOf(0) } // 0 python, 1 algo, 2 ask-ai
    var input by remember { mutableStateOf(SAMPLE_CODE) }
    var graph by remember { mutableStateOf<FlowGraph?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var aiCode by remember { mutableStateOf<String?>(null) }
    var tracing by remember { mutableStateOf(false) }
    var step by remember { mutableStateOf(0) }
    var copied by remember { mutableStateOf(false) }

    fun generate() {
        if (busy || input.isBlank()) return
        busy = true; error = null; graph = null; aiCode = null; tracing = false; step = 0
        scope.launch(Dispatchers.IO) {
            if (mode == 2) {
                val res = AiRepository.ask(input, mode = "flowchart")
                res.onSuccess { text ->
                    val raw = AiRepository.extractCode(text)?.takeIf { it.isNotBlank() }
                        ?: text.trim().removePrefix("```python").removePrefix("```").removeSuffix("```").trim()
                    aiCode = raw
                    val g = PythonRunner.flowchart(raw, algo = false)
                    withContext(Dispatchers.Main) {
                        busy = false
                        if (g.error != null) error = g.error else graph = g
                    }
                }.onFailure { e ->
                    withContext(Dispatchers.Main) {
                        busy = false
                        error = "AI unavailable right now (${e.message}). Try the Python or Pseudocode mode."
                    }
                }
            } else {
                val g = PythonRunner.flowchart(input, algo = mode == 1)
                withContext(Dispatchers.Main) {
                    busy = false
                    if (g.error != null) error = g.error else graph = g
                }
            }
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("🔀 Flowchart Lab", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
        Text("Paste Python code, write an algorithm, or ask a question — then trace it step by step.",
            color = TextMuted, fontSize = 13.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("🐍 Python code", "📝 Pseudocode", "🤖 Ask AI").forEachIndexed { i, label ->
                FilterChip(
                    selected = mode == i,
                    onClick = {
                        mode = i
                        input = when (i) {
                            0 -> SAMPLE_CODE
                            1 -> SAMPLE_ALGO
                            else -> "check whether a number is even or odd"
                        }
                        graph = null; aiCode = null; error = null; tracing = false
                    },
                    label = { Text(label, fontSize = 12.sp, maxLines = 1) }
                )
            }
        }
        OutlinedTextField(
            value = input, onValueChange = { input = it },
            label = { Text(if (mode == 2) "Ask a question…" else if (mode == 1) "Algorithm…" else "Python code…") },
            modifier = Modifier.fillMaxWidth().heightIn(min = 160.dp),
            textStyle = androidx.compose.ui.text.TextStyle(
                fontFamily = FontFamily.Monospace, fontSize = 13.sp, lineHeight = 18.sp
            )
        )
        Button(
            onClick = ::generate, enabled = !busy && input.isNotBlank(),
            modifier = Modifier.fillMaxWidth()
        ) { Text(if (busy) "Generating…" else "Generate flowchart", maxLines = 1) }
        error?.let { Text(it, color = Danger, fontSize = 13.sp) }
        aiCode?.let { generated ->
            Text("AI-generated code", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            CodeBlock(generated)
            OutlinedButton(
                onClick = { vm.openInCompiler(generated); nav.navigate("compiler") },
                modifier = Modifier.fillMaxWidth()
            ) { Text("▶ Try this code in compiler", maxLines = 1) }
        }
        val g = graph
        if (g != null) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Flowchart · ${g.nodes.size} nodes", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedButton(onClick = {
                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("skillzify", g.toMermaid()))
                        copied = true
                        scope.launch { kotlinx.coroutines.delay(2000); copied = false }
                    }) { Text(if (copied) "✓ Copied" else "📋 Mermaid", fontSize = 12.sp, maxLines = 1) }
                    OutlinedButton(onClick = { tracing = !tracing; step = 0 }) {
                        Text(if (tracing) "⏹ Stop trace" else "▶ Trace", fontSize = 12.sp, maxLines = 1)
                    }
                }
            }
            if (g.truncated) Text("Truncated at 60 nodes — simplify the code for a full chart.",
                color = TextMuted, fontSize = 12.sp)
            if (tracing) {
                Card(colors = CardDefaults.cardColors(containerColor = Card), modifier = Modifier.fillMaxWidth()) {
                    Row(
                        Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(
                            onClick = { if (step > 0) step-- },
                            enabled = step > 0
                        ) { Text("← Prev", fontSize = 12.sp, maxLines = 1) }
                        Text("Step ${step + 1} / ${g.nodes.size}", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        OutlinedButton(
                            onClick = { if (step < g.nodes.size - 1) step++ },
                            enabled = step < g.nodes.size - 1
                        ) { Text("Next →", fontSize = 12.sp, maxLines = 1) }
                    }
                }
            }
            val byId = g.nodes.associateBy { it.id }
            g.nodes.forEachIndexed { i, n ->
                val active = tracing && i == step
                Card(
                    colors = CardDefaults.cardColors(containerColor = Card),
                    modifier = Modifier.fillMaxWidth()
                        .then(if (active) Modifier.border(2.dp, Accent, RoundedCornerShape(12.dp))
                            else Modifier)
                ) {
                    Column(Modifier.fillMaxWidth().padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("${shapeIcon(n.type)} ", fontSize = 16.sp)
                            Text(n.label, fontFamily = FontFamily.Monospace, fontSize = 13.sp,
                                fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                                modifier = Modifier.weight(1f))
                            Text(n.type, color = TextMuted, fontSize = 11.sp)
                        }
                        val outs = g.edges.filter { it.from == n.id }
                        if (outs.isNotEmpty()) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                outs.joinToString(" · ") {
                                    val target = byId[it.to]?.label ?: it.to
                                    if (it.label.isNotEmpty()) "${it.label} → $target" else "→ $target"
                                },
                                color = TextMuted, fontSize = 12.sp
                            )
                        }
                    }
                }
                if (i < g.nodes.size - 1) {
                    Text("↓", fontSize = 16.sp, color = TextMuted,
                        modifier = Modifier.align(Alignment.CenterHorizontally))
                }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}
