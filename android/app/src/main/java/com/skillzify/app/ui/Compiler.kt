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
    var programInput by remember { mutableStateOf("") }
    var running by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<RunResult?>(null) }
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
            history.add(0, HistoryEntry(activeFile, r.ok, r.output.ifEmpty { r.error }, r.ms, System.currentTimeMillis()))
            vm.addRun(code, r.ok)
            panelTab = if (r.ok) 0 else 1
        }
    }

    fun run() {
        if (running || code.isBlank()) return
        running = true
        result = null
        showExplainer = false
        persistActive()
        val filesSnap = vm.workspaceFiles.toMutableMap()
        filesSnap[activeFile] = code
        val mainSnap = activeFile
        val inputSnap = programInput
        runFuture = runExec.submit {
            try {
                val r = PythonRunner.runMulti(filesSnap, mainSnap, PythonRunner.makeStdin(inputSnap))
                finishOnMain(r)
            } catch (e: Exception) {
                finishOnMain(RunResult(false, "", "Runner failed: ${e.message}", 0))
            }
        }
        // 15s auto-timeout (web parity): abandon runaway code, recover UI
        scope.launch(Dispatchers.IO) {
            kotlinx.coroutines.delay(15000)
            withContext(Dispatchers.Main) {
                if (running) {
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
                "Real Python 3.11 on-device via Chaquopy · multi-file workspace, like Code Studio.",
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
                        }) { Text("Create") }
                    },
                    dismissButton = {
                        OutlinedButton(onClick = { showAddFile = false }) { Text("Cancel") }
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

            OutlinedTextField(
                value = programInput,
                onValueChange = { programInput = it },
                label = { Text("⌨️ Program input — one line per input() call") },
                modifier = Modifier.fillMaxWidth(),
                textStyle = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Monospace, fontSize = 13.sp)
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (running) {
                    Button(
                        onClick = ::stop,
                        colors = ButtonDefaults.buttonColors(containerColor = Danger),
                        modifier = Modifier.weight(1f).height(50.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) { Text("⏹ Stop", fontSize = 15.sp) }
                } else {
                    Button(
                        onClick = ::run,
                        modifier = Modifier.weight(1f).height(50.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) { Text("▶ Run", fontSize = 15.sp) }
                }
                Button(
                    onClick = { code = ""; result = null; showExplainer = false },
                    enabled = !running,
                    colors = ButtonDefaults.buttonColors(containerColor = Card),
                    modifier = Modifier.weight(1f).height(50.dp),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("Clear", fontSize = 15.sp) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = ::shareCode,
                    modifier = Modifier.weight(1f)
                ) { Text("🔗 Share") }
                OutlinedButton(
                    onClick = ::downloadCode,
                    modifier = Modifier.weight(1f)
                ) { Text("⬇️ Save .py") }
                OutlinedButton(
                    onClick = { snippetName = ""; showSaveSnippet = true },
                    modifier = Modifier.weight(1f)
                ) { Text("💾 Snippet") }
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
                        }) { Text("Save") }
                    },
                    dismissButton = {
                        OutlinedButton(onClick = { showSaveSnippet = false }) { Text("Cancel") }
                    }
                )
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
                            OutlinedButton(onClick = { vm.deleteUserSnippet(s.id) }) { Text("Delete", fontSize = 12.sp) }
                        }
                    }
                }
            }

            // ---- Bottom panel: OUTPUT / PROBLEMS / HISTORY ----
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("📟 Output", "⚠️ Problems", "🕘 History").forEachIndexed { i, label ->
                    FilterChip(
                        selected = panelTab == i,
                        onClick = { panelTab = i },
                        label = { Text(label, fontSize = 12.sp) }
                    )
                }
            }
            Column(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 140.dp, max = 320.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(CodeBg)
                    .verticalScroll(rememberScrollState())
                    .padding(14.dp)
            ) {
                when (panelTab) {
                    0 -> when {
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
