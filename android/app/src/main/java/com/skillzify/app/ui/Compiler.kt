package com.skillzify.app.ui

import androidx.compose.foundation.background
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
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.Explainer
import com.skillzify.app.data.PythonRunner
import com.skillzify.app.data.RunResult
import com.skillzify.app.ui.theme.BgSoft
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.CodeBg
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompilerTab(vm: AppViewModel) {
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf(vm.lastCode().ifEmpty { vm.snippets.first().code }) }
    var programInput by remember { mutableStateOf("") }
    var running by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<RunResult?>(null) }
    var showExplainer by remember { mutableStateOf(false) }
    var snippetExpanded by remember { mutableStateOf(false) }
    var snippetIdx by remember { mutableStateOf(0) }

    fun run() {
        if (running || code.isBlank()) return
        running = true
        result = null
        showExplainer = false
        vm.saveLastCode(code)
        scope.launch(Dispatchers.IO) {
            val r = PythonRunner.run(code, PythonRunner.makeStdin(programInput))
            withContext(Dispatchers.Main) {
                result = r
                running = false
                vm.addRun(code, r.ok)
            }
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("🤖 Python Compiler", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
        Text("Real Python 3.11 running on-device via Chaquopy.", color = TextMuted, fontSize = 13.sp)

        ExposedDropdownMenuBox(expanded = snippetExpanded, onExpandedChange = { snippetExpanded = it }) {
            OutlinedTextField(
                value = vm.snippets[snippetIdx].name,
                onValueChange = {},
                readOnly = true,
                label = { Text("Sample snippet") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(snippetExpanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth()
            )
            ExposedDropdownMenu(expanded = snippetExpanded, onDismissRequest = { snippetExpanded = false }) {
                vm.snippets.forEachIndexed { i, s ->
                    DropdownMenuItem(
                        text = { Text(s.name) },
                        onClick = {
                            snippetIdx = i
                            code = s.code
                            snippetExpanded = false
                        }
                    )
                }
            }
        }

        OutlinedTextField(
            value = code,
            onValueChange = { code = it },
            label = { Text("Python code") },
            modifier = Modifier.fillMaxWidth().heightIn(min = 220.dp),
            textStyle = androidx.compose.ui.text.TextStyle(
                fontFamily = FontFamily.Monospace, fontSize = 13.sp, lineHeight = 18.sp
            )
        )

        OutlinedTextField(
            value = programInput,
            onValueChange = { programInput = it },
            label = { Text("⌨️ Program input — one line per input() call") },
            modifier = Modifier.fillMaxWidth(),
            textStyle = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Monospace, fontSize = 13.sp)
        )

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = ::run,
                enabled = !running,
                modifier = Modifier.weight(1f).height(50.dp),
                shape = RoundedCornerShape(12.dp)
            ) { Text(if (running) "⏳ Running…" else "▶ Run", fontSize = 15.sp) }
            Button(
                onClick = { code = ""; result = null; showExplainer = false },
                enabled = !running,
                colors = ButtonDefaults.buttonColors(containerColor = Card),
                modifier = Modifier.weight(1f).height(50.dp),
                shape = RoundedCornerShape(12.dp)
            ) { Text("Clear", fontSize = 15.sp) }
        }

        Text("📟 Console output", fontWeight = FontWeight.Bold, fontSize = 15.sp)
        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 140.dp, max = 320.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(CodeBg)
                .verticalScroll(rememberScrollState())
                .padding(14.dp)
        ) {
            when {
                running -> Text("Running…", fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = TextMuted)
                result == null -> Text(
                    "Press Run to execute your code…",
                    fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = TextMuted
                )
                else -> {
                    val r = result!!
                    if (r.output.isNotEmpty()) Text(r.output, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                    if (!r.ok && r.error.isNotEmpty()) Text(r.error, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = Danger)
                    Text(
                        if (r.ok) "✅ Done in ${r.ms} ms" else "❌ Error after ${r.ms} ms",
                        fontSize = 12.sp,
                        color = if (r.ok) Success else Danger,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
            }
        }

        val r = result
        if (r != null && !r.ok && r.error.isNotEmpty()) {
            Button(
                onClick = { showExplainer = !showExplainer },
                colors = ButtonDefaults.buttonColors(containerColor = BgSoft),
                modifier = Modifier.fillMaxWidth()
            ) { Text("✨ Explain error") }
            if (showExplainer) {
                val ex = remember(r.error) { Explainer.explain(r.error) }
                Card(
                    colors = CardDefaults.cardColors(containerColor = Card),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(ex.title, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        ex.tips.forEach { t -> Text("• $t", fontSize = 13.sp, color = TextMuted) }
                        ex.offending?.let {
                            Text("Offending name: $it", fontSize = 12.sp, color = TextMuted)
                        }
                    }
                }
            }
        } else if (r != null && r.ok) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    "📝 " + Explainer.codeSummary(code),
                    fontSize = 13.sp, color = TextMuted,
                    modifier = Modifier.padding(14.dp)
                )
            }
        }

        if (vm.runs.isNotEmpty()) {
            Text("🕘 Recent runs", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            val fmt = remember { SimpleDateFormat("d MMM, HH:mm", Locale.getDefault()) }
            vm.runs.take(20).forEach { run ->
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        run.codePreview.ifEmpty { "(empty)" },
                        fontFamily = FontFamily.Monospace, fontSize = 12.sp,
                        modifier = Modifier.weight(1f).padding(end = 8.dp),
                        maxLines = 1
                    )
                    Text(
                        (if (run.ok) "✅ " else "❌ ") + fmt.format(Date(run.timestamp)),
                        fontSize = 12.sp, color = TextMuted
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}
