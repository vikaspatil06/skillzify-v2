package com.skillzify.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.PythonRunner
import com.skillzify.app.data.TestResult
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

@Composable
fun ExerciseDetail(vm: AppViewModel, id: String, nav: NavController) {
    val ex = vm.exercises.firstOrNull { it.id == id }
    if (ex == null) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text("Exercise not found.", color = TextMuted)
        }
        return
    }
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf(ex.starter) }
    var running by remember { mutableStateOf(false) }
    var testResults by remember { mutableStateOf<List<TestResult>?>(null) }
    var codeOk by remember { mutableStateOf(true) }
    var codeError by remember { mutableStateOf("") }
    var hintsShown by remember { mutableIntStateOf(0) }
    var showWalkthrough by remember { mutableStateOf(false) }
    var showModel by remember { mutableStateOf(false) }
    var xpMsg by remember { mutableStateOf("") }
    var picked by remember { mutableIntStateOf(-1) }
    var predictChecked by remember { mutableStateOf(false) }
    val att = vm.getAttempt(ex.id)

    fun doRecord(solved: Boolean, ms: Long) {
        val gain = vm.recordAttempt(ex.id, solved, ms, hintsShown, showModel)
        xpMsg = when {
            gain > 0 -> "+$gain XP earned! 🎉"
            solved -> "Already solved — no extra XP."
            else -> ""
        }
        testResults = null // force recompose of attempt state
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row { Text(if (att.solved) "✅ " else "", fontSize = 20.sp); Text(ex.title, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold) }
        Text(ex.prompt, fontSize = 14.sp, lineHeight = 21.sp)
        if (xpMsg.isNotBlank()) Text(xpMsg, color = Success, fontWeight = FontWeight.Bold)

        if (ex.kind == "predict") {
            // predict: show code + MCQ options
            if (!ex.code.isNullOrBlank()) CodeBlock(ex.code!!)
            ex.options.forEachIndexed { i, opt ->
                val selected = picked == i
                val correct = predictChecked && i == ex.answer
                val wrong = predictChecked && selected && i != ex.answer
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = when {
                            correct -> Success.copy(alpha = 0.25f)
                            wrong -> MaterialTheme.colorScheme.error.copy(alpha = 0.25f)
                            selected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)
                            else -> Card
                        }
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { if (!predictChecked) picked = i }
                ) {
                    Text(opt, modifier = Modifier.padding(12.dp), fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                }
            }
            if (!predictChecked) {
                Button(
                    onClick = {
                        if (picked < 0) return@Button
                        predictChecked = true
                        doRecord(picked == ex.answer, 0)
                    },
                    enabled = picked >= 0,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Check answer") }
            } else {
                Text(
                    if (picked == ex.answer) "Correct! 🎉" else "Not quite — the answer is: ${ex.options.getOrNull(ex.answer)}",
                    color = if (picked == ex.answer) Success else Warning,
                    fontWeight = FontWeight.Bold
                )
                if (ex.coach.isNotBlank()) Text("💡 " + ex.coach, color = TextMuted, fontSize = 13.sp)
            }
        } else {
            // code / fix: editor + hidden tests
            OutlinedTextField(
                value = code,
                onValueChange = { code = it },
                modifier = Modifier.fillMaxWidth().height(220.dp),
                textStyle = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Monospace, fontSize = 13.sp),
                label = { Text("Your code") }
            )
            Button(
                onClick = {
                    running = true
                    testResults = null
                    scope.launch(Dispatchers.Default) {
                        val t0 = System.currentTimeMillis()
                        val outcome = withTimeoutOrNull(15000) {
                            PythonRunner.runTests(
                                code,
                                ex.tests.map { (it.run ?: it.expr ?: "") to it.expect }
                            )
                        }
                        val ms = System.currentTimeMillis() - t0
                        withContext(Dispatchers.Main) {
                            running = false
                            if (outcome == null) {
                                codeOk = false
                                codeError = "Timed out after 15s — check for infinite loops."
                                testResults = emptyList()
                            } else {
                                codeOk = outcome.codeOk
                                codeError = outcome.error
                                testResults = outcome.results
                                if (outcome.allPassed) doRecord(true, ms)
                                else vm.recordAttempt(ex.id, false, ms, hintsShown, showModel)
                            }
                        }
                    }
                },
                enabled = !running,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (running) CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp), strokeWidth = 2.dp)
                Text(if (running) "Running tests…" else "▶ Run tests (${ex.tests.size})")
            }
            testResults?.let { rs ->
                if (!codeOk && codeError.isNotBlank())
                    Text("⚠️ Your code crashed:\n" + codeError.take(400), color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                rs.forEachIndexed { i, r ->
                    Text(
                        (if (r.ok) "✅" else "❌") + " Test ${i + 1}" +
                            (if (!r.ok) " — got: ${r.got.take(40)}, expected: ${r.expect.take(40)}" else ""),
                        fontSize = 13.sp,
                        color = if (r.ok) Success else TextMuted
                    )
                }
                if (rs.isNotEmpty() && rs.all { it.ok }) Text("All tests passed! 🎉", color = Success, fontWeight = FontWeight.Bold)
            }

            // progressive hints
            if (hintsShown < ex.hints.size) {
                OutlinedButton(
                    onClick = {
                        hintsShown++
                        vm.useHint(ex.id)
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("💡 Show hint ${hintsShown + 1}/${ex.hints.size}") }
            }
            for (i in 0 until hintsShown) {
                Card(colors = CardDefaults.cardColors(containerColor = Card), modifier = Modifier.fillMaxWidth()) {
                    Text("💡 Hint ${i + 1}: " + ex.hints[i], modifier = Modifier.padding(12.dp), fontSize = 13.sp)
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { showWalkthrough = !showWalkthrough }, modifier = Modifier.weight(1f)) {
                    Text(if (showWalkthrough) "Hide walkthrough" else "📖 Walkthrough")
                }
                OutlinedButton(onClick = { showModel = !showModel }, modifier = Modifier.weight(1f)) {
                    Text(if (showModel) "Hide solution" else "🧠 Model solution")
                }
            }
            if (showWalkthrough && ex.walkthrough.isNotBlank()) {
                Card(colors = CardDefaults.cardColors(containerColor = Card), modifier = Modifier.fillMaxWidth()) {
                    Text(ex.walkthrough, modifier = Modifier.padding(12.dp), fontSize = 13.sp, lineHeight = 20.sp)
                }
            }
            if (showModel && ex.model.isNotBlank()) {
                Text("Model solution (revealing halves the XP):", color = Warning, fontSize = 13.sp)
                CodeBlock(ex.model)
            }
            if (ex.coach.isNotBlank()) Text("🐍 Pythonic tip: " + ex.coach, color = TextMuted, fontSize = 13.sp)
        }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = { nav.popBackStack() }, modifier = Modifier.fillMaxWidth()) {
            Text("← Back to practice")
        }
    }
}
