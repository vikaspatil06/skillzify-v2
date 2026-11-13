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
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.PlacementEngine
import com.skillzify.app.data.PlacementQ
import com.skillzify.app.data.PlacementRecord
import com.skillzify.app.data.PlacementResult
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning

/* Placement Test — website placement.html + placement-page.js, native.
   Flow rules mirrored from the web page:
   - Ask stage A (3, "Basics"). If A < 2/3 correct, the test ends.
   - Else ask stage B (4, "Core"). If B < 3/4 correct, the test ends.
   - Else ask stage C (3, "Advanced"), then the result.
   - One question at a time; Next is disabled until an option is picked;
     Back restores the recorded answer. Progress is per stage
     ("Question 2 of 3 (Basics)"), like the web.
   - A pointer, not progress: no XP, no lessons marked done. The result
     is saved via vm.savePlacement(result) — PlacementEngine.score does
     the §4-table scoring on the questions actually asked.
   Questions come from PlacementEngine.buildTest(exercises, solvedIds,
   seed) which returns ALL stages up front (List<PlacementQ>); this
   screen asks them stage by stage and applies the web's early-exit
   gates itself, exactly like placement-page.js concatenating sel.b/c
   only after a gate passes. */
private val STAGE_LABEL = mapOf("a" to "Basics", "b" to "Core", "c" to "Advanced")

@Composable
fun PlacementScreen(vm: AppViewModel, nav: NavController) {
    // Existing placement: show it + retake (web result lives until retaken).
    // inTest: a retake is running. justFinished: the test in THIS visit
    // just saved a result — its result screen must stay up even though
    // vm.placement is now non-null.
    var inTest by remember { mutableStateOf(false) }
    var justFinished by remember { mutableStateOf(false) }
    val existing = vm.placement
    if (existing != null && !inTest && !justFinished) {
        PlacementExisting(vm, nav, existing) {
            // Retake does NOT clear the stored pointer first (web
            // startTest() parity): the old placement survives an
            // abandoned retake and is only replaced when the new test
            // finishes and saves over it.
            inTest = true
        }
        return
    }
    PlacementTest(vm, nav, onFinished = { justFinished = true })
}

@Composable
private fun PlacementExisting(
    vm: AppViewModel,
    nav: NavController,
    result: PlacementRecord,
    onRetake: () -> Unit
) {
    val sec = vm.catalog.tracks.firstOrNull { it.id == result.section }
    val dateFmt = remember { java.text.SimpleDateFormat("d MMM yyyy", java.util.Locale.getDefault()) }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        ScreenHeader(
            "🎯 Placement Test",
            "Answer 10 quick questions — about 3 minutes — and find out where to start. Already know the basics? Skip what you don't need. No account needed, and the result is a starting point, not a verdict.",
            onBack = { nav.popBackStack() }
        )
        WebCard {
            Column(Modifier.padding(18.dp)) {
                Text("Your placement", color = TextMuted, fontSize = 12.sp)
                Text(
                    sec?.let { "${it.icon} ${it.name}" } ?: result.section,
                    fontSize = 22.sp, fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(vertical = 6.dp)
                )
                // PlacementRecord stores no reason text (the reason is a
                // PlacementResult-only field), so the stored view shows
                // the score + per-stage breakdown instead.
                Text(
                    "You scored ${result.score}/${result.total}. A starting point, not a verdict — move freely.",
                    fontSize = 14.sp, lineHeight = 20.sp
                )
                for (stage in listOf("a", "b", "c")) {
                    val s = result.stages[stage]
                    Row(
                        Modifier.fillMaxWidth().padding(top = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(STAGE_LABEL[stage] ?: stage, fontSize = 13.sp)
                        Text(
                            if (s == null || s.total == 0) "Not reached" else "${s.correct}/${s.total}",
                            color = TextMuted, fontSize = 12.sp
                        )
                    }
                }
                if (result.date > 0) {
                    Text(
                        "Taken ${dateFmt.format(java.util.Date(result.date))}",
                        color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        }
        GradientButton(
            "Start at ${sec?.name ?: result.section} →",
            Modifier.fillMaxWidth()
        ) { nav.navigate("learn?section=${result.section}") }
        OutlinedButton(onClick = onRetake, modifier = Modifier.fillMaxWidth()) {
            Text("Retake the test", maxLines = 1)
        }
        OutlinedButton(
            onClick = { nav.navigate("learn?section=${vm.catalog.tracks.firstOrNull()?.id ?: ""}") },
            modifier = Modifier.fillMaxWidth()
        ) { Text("Start from the beginning", maxLines = 1) }
    }
}

@Composable
private fun PlacementTest(vm: AppViewModel, nav: NavController, onFinished: () -> Unit) {
    // Full staged test built once per entry (seeded by the day, so a
    // retake in the same session reshuffles via the attempt counter).
    var attempt by remember { mutableStateOf(0) }
    val all = remember(attempt) {
        val solvedIds = vm.exercises.filter { vm.getAttempt(it.id).solved }.map { it.id }.toSet()
        try {
            PlacementEngine.buildTest(vm.exercises, solvedIds, System.currentTimeMillis() + attempt)
        } catch (e: Exception) {
            emptyList()
        }
    }
    // asked = stage A first; B/C are appended only when a gate passes.
    var asked by remember(attempt) { mutableStateOf(all.filter { it.stage == "a" }) }
    val answers = remember(attempt) { mutableStateMapOf<String, Int>() }
    var idx by remember(attempt) { mutableStateOf(0) }
    var result by remember(attempt) { mutableStateOf<PlacementResult?>(null) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        ScreenHeader(
            "🎯 Placement Test",
            "Answer 10 quick questions — about 3 minutes — and find out where to start. A pointer, not progress: no XP, no lessons marked done — it only says where to start. Sections below your placement unlock.",
            onBack = { nav.popBackStack() }
        )

        val r = result
        if (r != null) {
            // ---- Result screen (web renderResult) ----
            val sec = vm.catalog.tracks.firstOrNull { it.id == r.section }
            WebCard {
                Column(Modifier.padding(18.dp)) {
                    Text("Your placement", color = TextMuted, fontSize = 12.sp)
                    Text(
                        sec?.let { "${it.icon} ${it.name}" } ?: r.section,
                        fontSize = 22.sp, fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(vertical = 6.dp)
                    )
                    Text(r.reason, fontSize = 14.sp, lineHeight = 20.sp)
                    Text(
                        "A starting point, not a verdict — move freely.",
                        color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
            WebCard {
                Column(Modifier.padding(16.dp)) {
                    Text("How you did", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Spacer(Modifier.height(8.dp))
                    // Per-stage breakdown from the asked questions + answers.
                    for (stage in listOf("a", "b", "c")) {
                        val qs = asked.filter { it.stage == stage }
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 3.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(STAGE_LABEL[stage] ?: stage, fontSize = 13.sp)
                            if (qs.isEmpty()) {
                                Text("Not reached", color = TextMuted, fontSize = 12.sp)
                            } else {
                                val correct = qs.count { answers[it.exercise.id] == it.exercise.answer }
                                Text("$correct/${qs.size}", color = TextMuted, fontSize = 12.sp)
                            }
                        }
                        if (qs.isNotEmpty()) {
                            val correct = qs.count { answers[it.exercise.id] == it.exercise.answer }
                            LinearProgressIndicator(
                                progress = { correct / qs.size.toFloat() },
                                modifier = Modifier.fillMaxWidth().height(6.dp)
                                    .clip(RoundedCornerShape(99.dp))
                            )
                        }
                    }
                    Text(
                        "Total: ${r.score}/${r.total}",
                        color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
            GradientButton(
                "Start learning →",
                Modifier.fillMaxWidth()
            ) {
                nav.navigate("learn?section=${r.section}")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { nav.navigate("learn?section=${vm.catalog.tracks.firstOrNull()?.id ?: ""}") },
                    modifier = Modifier.weight(1f)
                ) { Text("From the beginning", fontSize = 12.sp, maxLines = 1) }
                OutlinedButton(
                    onClick = { attempt++ },
                    modifier = Modifier.weight(1f)
                ) { Text("Retake", fontSize = 12.sp, maxLines = 1) }
            }
            // Answer review (web shows answers only at the end).
            Text("Your answers", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            asked.forEachIndexed { i, q ->
                val ex = q.exercise
                val picked = answers[ex.id]
                val ok = picked == ex.answer
                WebCard {
                    Column(Modifier.padding(14.dp)) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("${i + 1}. ${ex.title}", fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                                modifier = Modifier.weight(1f))
                            WebChip(STAGE_LABEL[q.stage] ?: q.stage)
                        }
                        if (!ex.code.isNullOrBlank()) {
                            Spacer(Modifier.height(6.dp))
                            CodeBlock(ex.code!!)
                        }
                        Text(
                            if (ok) "✓ Correct — you said ${ex.options.getOrNull(picked ?: -1) ?: "—"}"
                            else "✗ You said ${ex.options.getOrNull(picked ?: -1) ?: "—"} · Correct: ${ex.options.getOrNull(ex.answer) ?: ""}",
                            color = if (ok) Success else Warning,
                            fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp)
                        )
                        if (ex.walkthrough.isNotBlank()) {
                            Text(ex.walkthrough, color = TextMuted, fontSize = 12.sp,
                                modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
            }
            return@Column
        }

        val q: PlacementQ? = asked.getOrNull(idx)
        if (all.isEmpty() || q == null) {
            WebCard {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        "Nothing to ask — the test has no questions right now.",
                        color = TextMuted, fontSize = 14.sp
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { attempt++ }) { Text("Try again", maxLines = 1) }
                }
            }
            return@Column
        }

        // ---- One question at a time (web render()) ----
        val ex = q.exercise
        val stageQs = asked.filter { it.stage == q.stage }
        val posInStage = stageQs.indexOf(q) + 1
        val picked = answers[ex.id]
        val lastOfStage = idx == asked.size - 1
        WebCard {
            Column(Modifier.padding(16.dp)) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    WebChip(STAGE_LABEL[q.stage] ?: q.stage)
                    Text(
                        "Question $posInStage of ${stageQs.size} (${STAGE_LABEL[q.stage] ?: q.stage})",
                        color = TextMuted, fontSize = 12.sp
                    )
                }
                LinearProgressIndicator(
                    progress = { posInStage / stageQs.size.coerceAtLeast(1).toFloat() },
                    modifier = Modifier.fillMaxWidth().height(6.dp)
                        .clip(RoundedCornerShape(99.dp)).padding(top = 8.dp)
                )
                Text(ex.title, fontSize = 18.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
                Text(ex.prompt.ifBlank { "What does this code print?" }, fontSize = 14.sp)
                if (!ex.code.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    CodeBlock(ex.code!!)
                }
                Spacer(Modifier.height(10.dp))
                ex.options.forEachIndexed { i, opt ->
                    val selected = picked == i
                    WebCard(
                        modifier = Modifier.padding(vertical = 4.dp),
                        onClick = { answers[ex.id] = i }
                    ) {
                        Text(
                            (if (selected) "● " else "○ ") + opt,
                            fontSize = 14.sp,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                            color = if (selected) androidx.compose.material3.MaterialTheme.colorScheme.primary
                                else androidx.compose.material3.MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }
        }
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            OutlinedButton(onClick = { if (idx > 0) idx-- }, enabled = idx > 0) {
                Text("← Back", maxLines = 1)
            }
            Button(
                onClick = {
                    if (picked == null) return@Button
                    if (!lastOfStage) { idx++; return@Button }
                    // Last question of the stage: apply the web's gate.
                    // placement-page.js reads the gate off scoreSoFar's
                    // stage totals — correct / ASKED in this stage (not
                    // the full stage size; identical for full stages,
                    // different when a stage came up short).
                    val stageCorrect = stageQs.count { answers[it.exercise.id] == it.exercise.answer }
                    val full = stageQs.size
                    fun finish() {
                        val res = PlacementEngine.score(asked, answers.toMap())
                        vm.savePlacement(res); result = res; onFinished()
                    }
                    when (q.stage) {
                        "a" -> {
                            if (stageCorrect.toFloat() / full < 2f / 3f) {
                                finish()
                            } else {
                                asked = asked + all.filter { it.stage == "b" }
                                idx++
                            }
                        }
                        "b" -> {
                            if (stageCorrect.toFloat() / full < 3f / 4f) {
                                finish()
                            } else {
                                asked = asked + all.filter { it.stage == "c" }
                                idx++
                            }
                        }
                        else -> finish()
                    }
                },
                enabled = picked != null
            ) {
                Text(
                    when {
                        !lastOfStage -> "Next →"
                        q.stage == "c" -> "See my result →"
                        else -> "Continue →"
                    },
                    maxLines = 1
                )
            }
        }
        Text(
            "Stage ${STAGE_LABEL[q.stage]} · ${asked.size} question${if (asked.size == 1) "" else "s"} so far — the test adapts: do well and it keeps going.",
            color = TextMuted, fontSize = 12.sp
        )
    }
}
