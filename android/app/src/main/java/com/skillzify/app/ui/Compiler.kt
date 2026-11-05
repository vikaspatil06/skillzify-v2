package com.skillzify.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
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

private data class HistoryEntry(val file: String, val ok: Boolean, val output: String, val ms: Long, val ts: Long)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompilerTab(vm: AppViewModel) {
    val scope = rememberCoroutineScope()
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val snackbar = remember { androidx.compose.material3.SnackbarHostState() }
    val clipboard = ctx.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager

    // Workspace: seed main.py from last code / first snippet when empty.
    // effectiveFiles keeps the UI safe on the very first frame (before the seed lands).
    val effectiveFiles = if (vm.workspaceFiles.isEmpty()) {
        mapOf("main.py" to vm.lastCode().ifEmpty { vm.snippets.first().code })
    } else {
        vm.workspaceFiles
    }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        if (vm.workspaceFiles.isEmpty()) {
            vm.saveWorkspaceFile("main.py", vm.lastCode().ifEmpty { vm.snippets.first().code })
        }
    }
    var activeFile by remember { mutableStateOf("main.py") }
    if (activeFile !in effectiveFiles) activeFile = effectiveFiles.keys.first()
    var code by remember(activeFile) {
        mutableStateOf(effectiveFiles[activeFile] ?: "")
    }
    // One-shot handoff from Projects/Reference "Try in compiler": load the
    // code even when this tab was already in the back stack.
    val pendingCode = vm.pendingCompilerCode
    androidx.compose.runtime.LaunchedEffect(pendingCode) {
        if (pendingCode != null) {
            vm.saveWorkspaceFile("main.py", pendingCode)
            activeFile = "main.py"
            code = pendingCode
            vm.consumePendingCompilerCode()
        }
    }
    var running by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<RunResult?>(null) }
    // Interactive terminal (website Code Studio parity): output streams live,
    // input() blocks until the user answers in the terminal input row.
    // The bridge is @Stable and the panel/input-row collect its flows
    // THEMSELVES, so streaming output recomposes only those small scopes —
    // never the editor, buttons, or the rest of this screen.
    val bridge = remember { com.skillzify.app.data.TerminalBridge() }
    var showExplainer by remember { mutableStateOf(false) }
    var snippetExpanded by remember { mutableStateOf(false) }
    var snippetIdx by remember { mutableStateOf(0) }
    var runFuture by remember { mutableStateOf<java.util.concurrent.Future<*>?>(null) }
    val runExec = remember { java.util.concurrent.Executors.newSingleThreadExecutor() }
    var panelTab by remember { mutableStateOf(0) } // 0 output, 1 problems, 2 history
    val history = remember { mutableStateListOf<HistoryEntry>() }
    var showSaveSnippet by remember { mutableStateOf(false) }
    var snippetName by remember { mutableStateOf("") }
    var showAddFile by remember { mutableStateOf(false) }
    var newFileName by remember { mutableStateOf("") }
    // AI tutor (Render proxy; local heuristic Explainer stays as fallback).
    var aiBusy by remember { mutableStateOf(false) }
    var aiText by remember { mutableStateOf<String?>(null) }
    var aiCode by remember { mutableStateOf<String?>(null) }
    var aiNote by remember { mutableStateOf<String?>(null) }
    var showGenerate by remember { mutableStateOf(false) }
    var generatePrompt by remember { mutableStateOf("") }

    fun askAi(mode: String, aiCodeInput: String, aiError: String = "") {
        if (aiBusy) return
        aiBusy = true
        aiText = null; aiCode = null; aiNote = null
        scope.launch {
            val res = com.skillzify.app.data.AiRepository.ask(aiCodeInput, aiError, mode)
            aiBusy = false
            res.onSuccess { text ->
                if (mode == "generate" || mode == "fix") {
                    val extracted = com.skillzify.app.data.AiRepository.extractCode(text)
                    if (extracted != null) {
                        aiCode = extracted
                        aiText = com.skillzify.app.data.AiRepository.afterCode(text)
                            .takeIf { it.isNotBlank() }
                    } else {
                        // Old server build without mode support, or fence-less
                        // answer: show the raw text so nothing is lost.
                        aiText = text
                        aiNote = "The server returned no code block — copy what you need from below."
                    }
                } else {
                    aiText = text
                }
            }.onFailure { e ->
                // AI down? Fall back to the instant local explainer for errors.
                if (aiError.isNotEmpty()) {
                    val ex = Explainer.explain(aiError)
                    aiText = "⚠️ AI unavailable right now (${e.message}) — local explanation:\n\n" +
                        ex.title + "\n" + ex.tips.joinToString("\n") { "• $it" }
                } else {
                    aiText = "⚠️ AI unavailable right now (${e.message}). Try again in a bit."
                }
            }
        }
    }

    fun persistActive() {
        vm.saveWorkspaceFile(activeFile, code)
        vm.saveLastCode(code)
    }

    fun finishOnMain(r: RunResult) {
        scope.launch(Dispatchers.Main) {
            if (!running) return@launch // stopped / timed out — abandon stale result
            result = r
            running = false
            runFuture = null
            // Interactive runs stream output into the terminal; history keeps
            // that transcript (r.output is empty for interactive runs).
            val transcript = bridge.output.value.ifEmpty { r.output.ifEmpty { r.error } }
            history.add(0, HistoryEntry(activeFile, r.ok, transcript, r.ms, System.currentTimeMillis()))
            vm.addRun(code, r.ok)
            panelTab = if (r.ok) 0 else 1
        }
    }

    fun run() {
        if (running || code.isBlank()) return
        running = true
        result = null
        showExplainer = false
        bridge.reset()
        persistActive()
        val filesSnap = vm.workspaceFiles.toMutableMap()
        filesSnap[activeFile] = code
        val mainSnap = activeFile
        runFuture = runExec.submit {
            try {
                val r = PythonRunner.runMultiInteractive(filesSnap, mainSnap, bridge)
                finishOnMain(r)
            } catch (e: Exception) {
                finishOnMain(RunResult(false, "", "Runner failed: ${e.message}", 0))
            }
        }
        // 15s auto-timeout (web parity) — but the clock pauses while the
        // program waits for terminal input, so thinking time never kills a run.
        scope.launch(Dispatchers.IO) {
            var budgetMs = 15000L
            while (running && budgetMs > 0) {
                kotlinx.coroutines.delay(1000)
                if (bridge.waitingPrompt.value == null) budgetMs -= 1000
            }
            withContext(Dispatchers.Main) {
                if (running && bridge.waitingPrompt.value == null) {
                    bridge.cancel()
                    runFuture?.cancel(true)
                    runFuture = null
                    running = false
                    result = RunResult(false, "", "⏱ Timed out after 15s — check for infinite loops.", 15000)
                    panelTab = 1
                }
            }
        }
    }

    fun stop() {
        bridge.cancel()
        runFuture?.cancel(true)
        runFuture = null
        running = false
        result = RunResult(false, "", "⏹ Stopped.", 0)
    }

    fun shareCode() {
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("skillzify", code))
        scope.launch { snackbar.showSnackbar("Code copied to clipboard") }
    }

    fun downloadCode() {
        try {
            val filename = activeFile
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                val values = android.content.ContentValues().apply {
                    put(android.provider.MediaStore.Downloads.DISPLAY_NAME, filename)
                    put(android.provider.MediaStore.Downloads.MIME_TYPE, "text/x-python")
                }
                val uri = ctx.contentResolver.insert(
                    android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
                )
                ctx.contentResolver.openOutputStream(uri!!)?.use { it.write(code.toByteArray()) }
            } else {
                @Suppress("DEPRECATION")
                val dir = android.os.Environment.getExternalStoragePublicDirectory(
                    android.os.Environment.DIRECTORY_DOWNLOADS
                )
                java.io.File(dir, filename).writeText(code)
            }
            scope.launch { snackbar.showSnackbar("Saved to Downloads/$filename") }
        } catch (e: Exception) {
            scope.launch { snackbar.showSnackbar("Save failed: ${e.message}") }
        }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { pad ->
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(pad).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("🤖 Python Compiler", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
            Text(
                "Real Python 3.11 on-device · interactive terminal: input() asks right here, like Code Studio.",
                color = TextMuted, fontSize = 13.sp
            )

            // ---- File tabs (workspace) ----
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                vm.workspaceFiles.keys.forEach { name ->
                    FilterChip(
                        selected = name == activeFile,
                        onClick = {
                            persistActive()
                            activeFile = name
                            code = vm.workspaceFiles[name] ?: ""
                        },
                        label = { Text(name, fontSize = 12.sp) },
                        trailingIcon = if (vm.workspaceFiles.size > 1) {
                            {
                                Text(
                                    "×", fontSize = 14.sp, modifier = Modifier.clickable {
                                        vm.deleteWorkspaceFile(name)
                                        if (name == activeFile) {
                                            val remaining = vm.workspaceFiles.keys.filter { it != name }
                                            activeFile = remaining.firstOrNull() ?: "main.py"
                                            code = vm.workspaceFiles[activeFile] ?: ""
                                        }
                                    }
                                )
                            }
                        } else null
                    )
                }
                OutlinedButton(onClick = { newFileName = ""; showAddFile = true }) {
                    Text("+ File", fontSize = 12.sp)
                }
            }
            if (showAddFile) {
                AlertDialog(
                    onDismissRequest = { showAddFile = false },
                    title = { Text("New file") },
                    text = {
                        OutlinedTextField(
                            value = newFileName, onValueChange = { newFileName = it },
                            label = { Text("Filename (e.g. helper.py)") }, singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    },
                    confirmButton = {
                        Button(onClick = {
                            var n = newFileName.trim()
                            if (n.isEmpty()) n = "file${vm.workspaceFiles.size + 1}.py"
                            if (!n.endsWith(".py")) n += ".py"
                            if (n !in vm.workspaceFiles) vm.saveWorkspaceFile(n, "")
                            persistActive()
                            activeFile = n
                            code = vm.workspaceFiles[n] ?: ""
                            showAddFile = false
                        }) { Text("Create", maxLines = 1) }
                    },
                    dismissButton = {
                        OutlinedButton(onClick = { showAddFile = false }) { Text("Cancel", maxLines = 1) }
                    }
                )
            }
            Text(
                "Import other files with e.g. import helper — all files run together.",
                color = TextMuted, fontSize = 12.sp
            )

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
                label = { Text("$activeFile") },
                modifier = Modifier.fillMaxWidth().heightIn(min = 220.dp),
                textStyle = androidx.compose.ui.text.TextStyle(
                    fontFamily = FontFamily.Monospace, fontSize = 13.sp, lineHeight = 18.sp
                )
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (running) {
                    Button(
                        onClick = ::stop,
                        colors = ButtonDefaults.buttonColors(containerColor = Danger),
                        modifier = Modifier.weight(1f).height(50.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) { Text("⏹ Stop", fontSize = 15.sp, maxLines = 1) }
                } else {
                    Button(
                        onClick = ::run,
                        modifier = Modifier.weight(1f).height(50.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) { Text("▶ Run", fontSize = 15.sp, maxLines = 1) }
                }
                Button(
                    onClick = { code = ""; result = null; showExplainer = false },
                    enabled = !running,
                    colors = ButtonDefaults.buttonColors(containerColor = Card),
                    modifier = Modifier.weight(1f).height(50.dp),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("Clear", fontSize = 15.sp, maxLines = 1) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = ::shareCode,
                    modifier = Modifier.weight(1f)
                ) { Text("🔗 Share", maxLines = 1) }
                OutlinedButton(
                    onClick = ::downloadCode,
                    modifier = Modifier.weight(1f)
                ) { Text("⬇️ Save .py", maxLines = 1) }
                OutlinedButton(
                    onClick = { snippetName = ""; showSaveSnippet = true },
                    modifier = Modifier.weight(1f)
                ) { Text("💾 Snippet", maxLines = 1) }
            }
            if (showSaveSnippet) {
                AlertDialog(
                    onDismissRequest = { showSaveSnippet = false },
                    title = { Text("Save snippet") },
                    text = {
                        OutlinedTextField(
                            value = snippetName, onValueChange = { snippetName = it },
                            label = { Text("Snippet name") }, singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    },
                    confirmButton = {
                        Button(onClick = {
                            val n = snippetName.trim().ifEmpty { "Snippet ${vm.userSnippets.size + 1}" }
                            vm.saveUserSnippet(n, code)
                            showSaveSnippet = false
                            scope.launch { snackbar.showSnackbar("Snippet saved ✓") }
                        }) { Text("Save", maxLines = 1) }
                    },
                    dismissButton = {
                        OutlinedButton(onClick = { showSaveSnippet = false }) { Text("Cancel", maxLines = 1) }
                    }
                )
            }

            // ---- AI tutor row (Render proxy; website compiler parity) ----
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = {
                        val r = result
                        askAi("", code, if (r != null && !r.ok) r.error else "")
                    },
                    enabled = !aiBusy && code.isNotBlank(),
                    modifier = Modifier.weight(1f)
                ) { Text(if (aiBusy) "Thinking…" else "✨ AI Explain", maxLines = 1) }
                OutlinedButton(
                    onClick = { generatePrompt = ""; showGenerate = true },
                    enabled = !aiBusy,
                    modifier = Modifier.weight(1f)
                ) { Text("🤖 AI Generate", maxLines = 1) }
                val r = result
                if (r != null && !r.ok && r.error.isNotEmpty()) {
                    OutlinedButton(
                        onClick = { askAi("fix", code, r.error) },
                        enabled = !aiBusy,
                        modifier = Modifier.weight(1f)
                    ) { Text("🩹 AI Fix", maxLines = 1) }
                }
            }
            if (showGenerate) {
                AlertDialog(
                    onDismissRequest = { showGenerate = false },
                    title = { Text("AI Generate") },
                    text = {
                        OutlinedTextField(
                            value = generatePrompt, onValueChange = { generatePrompt = it },
                            label = { Text("Describe what to build…") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    },
                    confirmButton = {
                        Button(
                            onClick = { showGenerate = false; askAi("generate", generatePrompt) },
                            enabled = generatePrompt.isNotBlank()
                        ) { Text("Generate", maxLines = 1) }
                    },
                    dismissButton = {
                        OutlinedButton(onClick = { showGenerate = false }) { Text("Cancel", maxLines = 1) }
                    }
                )
            }
            if (aiText != null || aiCode != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Card),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("🤖 AI tutor", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            OutlinedButton(onClick = { aiText = null; aiCode = null; aiNote = null }) {
                                Text("Dismiss", fontSize = 12.sp, maxLines = 1)
                            }
                        }
                        aiNote?.let { Text(it, fontSize = 12.sp, color = TextMuted) }
                        aiCode?.let { generated ->
                            CodeBlock(generated)
                            Button(
                                onClick = { code = generated; persistActive(); aiText = null; aiCode = null; aiNote = null },
                                modifier = Modifier.fillMaxWidth()
                            ) { Text("Use this code in the editor", maxLines = 1) }
                        }
                        aiText?.let {
                            Text(it, fontSize = 13.sp, lineHeight = 20.sp,
                                modifier = Modifier.verticalScroll(rememberScrollState()).heightIn(max = 320.dp))
                        }
                    }
                }
            }

            // ---- My snippets ----
            if (vm.userSnippets.isNotEmpty()) {
                Text("📝 My snippets", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                vm.userSnippets.forEach { s ->
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(s.name, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            OutlinedButton(onClick = { code = s.code }) { Text("Load", fontSize = 12.sp) }
                            OutlinedButton(onClick = { vm.deleteUserSnippet(s.id) }) { Text("Delete", fontSize = 12.sp, maxLines = 1) }
                        }
                    }
                }
            }

            // ---- Bottom panel: OUTPUT / PROBLEMS / HISTORY ----
            // Own composable scope: streaming output recomposes ONLY the panel,
            // never the editor or buttons above it.
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("📟 Output", "⚠️ Problems", "🕘 History").forEachIndexed { i, label ->
                    FilterChip(
                        selected = panelTab == i,
                        onClick = { panelTab = i },
                        label = { Text(label, fontSize = 12.sp) }
                    )
                }
            }
            BottomPanel(bridge, panelTab, result, running, history)

            // Terminal input row — appears inline when the running program
            // calls input(), exactly like the website's terminal prompt.
            // Own composable scope: the waiting prompt recomposes only this row.
            TerminalInputRow(bridge, running)

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
            Spacer(Modifier.height(8.dp))
        } // Column
    } // Scaffold
}

/**
 * Compiler bottom panel (OUTPUT / PROBLEMS / HISTORY) in its own scope.
 * It collects the terminal transcript ITSELF, so every streamed write
 * recomposes only this panel — the editor, buttons, and AI card above it
 * are untouched. Params are all stable (Int/Boolean/stable data class/
 * @Stable bridge), so unrelated parent recompositions skip it entirely.
 */
@Composable
private fun BottomPanel(
    bridge: com.skillzify.app.data.TerminalBridge,
    panelTab: Int,
    result: RunResult?,
    running: Boolean,
    history: List<HistoryEntry>
) {
    val terminalText by bridge.output.collectAsState()
    val outputScroll = rememberScrollState()
    // Auto-scroll, but only while the user is already near the bottom —
    // never yank the view away from output they scrolled up to read.
    androidx.compose.runtime.LaunchedEffect(terminalText) {
        if (panelTab == 0 && outputScroll.value >= outputScroll.maxValue - 200) {
            outputScroll.scrollTo(outputScroll.maxValue)
        }
    }
    Column(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 140.dp, max = 320.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(CodeBg)
            .verticalScroll(outputScroll)
            .padding(14.dp)
    ) {
        when (panelTab) {
            0 -> when {
                // Live terminal transcript (streams as the program runs;
                // the traceback already streams here, so it is NOT
                // repeated from r.error after an error).
                terminalText.isNotEmpty() -> {
                    Text(terminalText, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                    val r = result
                    if (r != null && !running) {
                        Text(
                            if (r.ok) "✅ Done in ${r.ms} ms" else "❌ Error after ${r.ms} ms",
                            fontSize = 12.sp,
                            color = if (r.ok) Success else Danger,
                            modifier = Modifier.padding(top = 6.dp)
                        )
                    }
                }
                running -> Text("Running…", fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = TextMuted)
                result != null -> {
                    val r = result!!
                    Text(
                        if (r.ok) "✅ Done in ${r.ms} ms" else "❌ ${r.error}",
                        fontSize = 12.sp,
                        color = if (r.ok) Success else Danger
                    )
                }
                else -> Text(
                    "Press Run to execute your code…",
                    fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = TextMuted
                )
            }
            1 -> {
                val r = result
                if (running) {
                    Text("Running…", fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = TextMuted)
                } else if (r == null || r.ok) {
                    Text("✅ No problems — last run succeeded.", fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = Success)
                } else {
                    Text(r.error, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = Danger)
                }
            }
            2 -> {
                if (history.isEmpty()) {
                    Text("No runs yet this session.", fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = TextMuted)
                } else {
                    val fmt = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }
                    history.forEach { h ->
                        Column(Modifier.padding(vertical = 4.dp)) {
                            Text(
                                "${if (h.ok) "✅" else "❌"} ${h.file} · ${h.ms} ms · ${fmt.format(Date(h.ts))}",
                                fontSize = 12.sp, color = TextMuted
                            )
                            Text(
                                h.output.take(200),
                                fontFamily = FontFamily.Monospace, fontSize = 12.sp,
                                maxLines = 3
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Terminal input row in its own scope: the waiting-prompt state change
    recomposes only this row, never the editor or the panel. */
@Composable
private fun TerminalInputRow(bridge: com.skillzify.app.data.TerminalBridge, running: Boolean) {
    val waitingPrompt by bridge.waitingPrompt.collectAsState()
    var inputLine by remember { mutableStateOf("") }
    // Fresh prompt = fresh field (clears text left over if a previous run
    // was stopped mid-typing).
    androidx.compose.runtime.LaunchedEffect(waitingPrompt) {
        if (waitingPrompt != null) inputLine = ""
    }
    if (running && waitingPrompt != null) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = inputLine,
                onValueChange = { inputLine = it },
                label = { Text("⌨️ Type your input, then Send") },
                singleLine = true,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                    imeAction = androidx.compose.ui.text.input.ImeAction.Send
                ),
                keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                    onSend = {
                        bridge.submitInput(inputLine)
                        inputLine = ""
                    }
                ),
                modifier = Modifier.weight(1f),
                textStyle = androidx.compose.ui.text.TextStyle(
                    fontFamily = FontFamily.Monospace, fontSize = 13.sp
                )
            )
            Button(
                onClick = {
                    bridge.submitInput(inputLine)
                    inputLine = ""
                },
                shape = RoundedCornerShape(12.dp)
            ) { Text("Send ➤", maxLines = 1) }
        }
    }
}
