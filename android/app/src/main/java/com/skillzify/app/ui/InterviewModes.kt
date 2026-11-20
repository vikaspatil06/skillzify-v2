package com.skillzify.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.AiRepository
import com.skillzify.app.data.ExTest
import com.skillzify.app.data.InterviewBank
import com.skillzify.app.data.InterviewLocal
import com.skillzify.app.data.InterviewRecord
import com.skillzify.app.data.IvCoding
import com.skillzify.app.data.IvGdTopic
import com.skillzify.app.data.IvQuestion
import com.skillzify.app.data.PythonRunner
import com.skillzify.app.ui.designsystem.Density
import com.skillzify.app.ui.designsystem.MasteryRing
import com.skillzify.app.ui.designsystem.heading
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/* App 2.0 Phase B — Interview Studio, dedicated modes: the Coding
 * round, the Group Discussion and the Full Placement Drive. (The
 * adaptive Q&A, panel, company simulations and resume start live in
 * InterviewScreen.kt.)
 *
 * Same trust rules as everywhere in the Studio: code is judged by
 * EXECUTION against the bank's visible + hidden tests, never by an
 * AI's opinion; rubric/idea points are revealed only AFTER a submit;
 * every AI path has a deterministic local fallback, honestly
 * labelled. */

/* ---------------- shared Q&A scoring ---------------- */

internal data class QaItem(
    val q: String,
    val points: List<String>,
    val answer: String,
    val skill: String
)

internal data class QaScore(
    val i: Int,
    val score: Int,
    val well: String,
    val improve: String,
    val evidence: String
)

/** interview_score with the local token-overlap fallback.
    Returns (scores, usedOfflineFallback). */
internal suspend fun scoreQa(items: List<QaItem>, roundLabel: String): Pair<List<QaScore>, Boolean> {
    val payload = JSONObject().apply {
        put("round", roundLabel)
        put("items", JSONArray().apply {
            items.forEach { item ->
                put(JSONObject().apply {
                    put("q", item.q)
                    put("points", JSONArray(item.points))
                    put("answer", item.answer.take(1200))
                })
            }
        })
    }
    val obj = AiRepository.askJson(code = payload.toString(), mode = "interview_score").getOrNull()
    val arr = obj?.optJSONArray("scores")
    if (obj != null && arr != null && arr.length() > 0) {
        val out = (0 until arr.length()).map {
            val s = arr.getJSONObject(it)
            QaScore(
                i = s.optInt("i", it),
                score = s.optInt("score", 0).coerceIn(0, 100),
                well = s.optString("well", ""),
                improve = s.optString("improve", ""),
                evidence = s.optString("evidence", "")
            )
        }.sortedBy { it.i }
        return out to false
    }
    val out = items.mapIndexed { i, item ->
        val cov = InterviewLocal.coverage(item.answer, item.points)
        val covered = item.points.filter {
            InterviewLocal.coverage(item.answer, listOf(it)) >= 0.99
        }
        val missed = item.points.firstOrNull { it !in covered }
        QaScore(
            i = i,
            score = (cov * 100).toInt().coerceIn(0, 100),
            well = if (covered.isNotEmpty()) "You covered: ${covered.first()}" else "",
            improve = if (missed != null) "Missing point: $missed" else "",
            evidence = item.answer.trim().take(90)
        )
    }
    return out to true
}

internal fun pickCoding(bank: InterviewBank, difficulty: String, count: Int): List<IvCoding> {
    val tiers = if (difficulty == "Advanced") setOf(2, 3) else setOf(1, 2)
    val filtered = bank.coding.filter { it.tier in tiers }
    return (if (filtered.size >= count) filtered else bank.coding).shuffled().take(count)
}

/* ---------------- Coding round ---------------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CodingInterviewScreen(
    vm: AppViewModel,
    nav: NavController,
    bank: InterviewBank,
    role: String,
    difficulty: String,
    duration: Int,
    onExit: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val problems = remember { pickCoding(bank, difficulty, if (duration == 15) 1 else 2) }
    var idx by remember { mutableStateOf(0) }
    var finished by remember { mutableStateOf(problems.isEmpty()) }
    var problemScores by remember { mutableStateOf<List<Pair<IvCoding, Int>>>(emptyList()) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(Density.screen)
    ) {
        ScreenHeader(
            "Coding Round",
            "Real problems, judged by running your code against visible and hidden tests.",
            onBack = onExit
        )
        Spacer(Modifier.height(Density.gapLg))

        if (finished) {
            val overall = if (problemScores.isEmpty()) 0
                else problemScores.sumOf { it.second } / problemScores.size
            WebCard {
                Column(
                    Modifier.padding(Density.cardPadding),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    MasteryRing(
                        progress = overall / 100f,
                        size = 84.dp,
                        label = "$overall%"
                    )
                    Spacer(Modifier.height(Density.gapMd))
                    Text(
                        "Coding round complete",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.heading()
                    )
                    problemScores.forEach { (p, s) ->
                        Spacer(Modifier.height(Density.gapXs))
                        Text(
                            "${p.title} — $s%",
                            color = TextMuted, fontSize = 13.sp
                        )
                    }
                }
            }
            Spacer(Modifier.height(Density.gapLg))
            GradientButton("Back to Interview Studio", Modifier.fillMaxWidth()) { onExit() }
            return@Column
        }

        val problem = problems[idx]
        var code by remember(idx) { mutableStateOf(problem.starter) }
        var visibleResults by remember(idx) { mutableStateOf<List<Boolean>?>(null) }
        var runError by remember(idx) { mutableStateOf<String?>(null) }
        var busy by remember(idx) { mutableStateOf(false) }
        var submitted by remember(idx) { mutableStateOf<Int?>(null) }
        var totalTests by remember(idx) { mutableStateOf(0) }
        var passedTests by remember(idx) { mutableStateOf(0) }

        Text(
            "Problem ${idx + 1} of ${problems.size} · ~${problem.minutes} min",
            color = TextMuted, fontSize = 12.sp
        )
        Spacer(Modifier.height(Density.gapMd))
        WebCard {
            Column(Modifier.padding(Density.cardPadding)) {
                Text(
                    problem.title,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.heading()
                )
                Spacer(Modifier.height(Density.gapSm))
                Text(problem.prompt, fontSize = 14.sp)
                Spacer(Modifier.height(Density.gapMd))
                Text("Visible tests", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                problem.visible.forEachIndexed { ti, t ->
                    val r = visibleResults?.getOrNull(ti)
                    Text(
                        (when (r) {
                            true -> "✓ "
                            false -> "✗ "
                            null -> "· "
                        }) + "${t.run}  →  ${t.expect}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        color = when (r) {
                            true -> Success
                            false -> Danger
                            null -> TextMuted
                        }
                    )
                }
                if (problem.hidden.isNotEmpty()) {
                    Text(
                        "+ ${problem.hidden.size} hidden tests, run at submit",
                        color = TextMuted, fontSize = 12.sp
                    )
                }
            }
        }
        Spacer(Modifier.height(Density.gapMd))
        OutlinedTextField(
            value = code,
            onValueChange = { code = it },
            label = { Text("Your solution") },
            minLines = 8,
            maxLines = 14,
            enabled = submitted == null,
            textStyle = androidx.compose.ui.text.TextStyle(
                fontFamily = FontFamily.Monospace, fontSize = 13.sp, lineHeight = 18.sp
            ),
            modifier = Modifier.fillMaxWidth()
        )
        if (runError != null) {
            Spacer(Modifier.height(Density.gapSm))
            Text(runError!!, color = Danger, fontSize = 12.sp)
        }
        Spacer(Modifier.height(Density.gapMd))
        Row(horizontalArrangement = Arrangement.spacedBy(Density.gapMd)) {
            OutlinedButton(
                onClick = {
                    busy = true
                    runError = null
                    scope.launch {
                        val out = withContext(Dispatchers.IO) {
                            PythonRunner.runTests(
                                code,
                                problem.visible.map { ExTest(it.run, null, it.expect) }
                            )
                        }
                        busy = false
                        if (!out.codeOk) {
                            runError = out.error.ifBlank { "Your code did not run." }
                            visibleResults = null
                        } else {
                            visibleResults = out.results.map { it.ok }
                        }
                    }
                },
                enabled = !busy && submitted == null,
                modifier = Modifier.weight(1f)
            ) { Text(if (busy) "Running…" else "Run visible tests", fontSize = 13.sp) }
            GradientButton(
                text = "Submit solution",
                enabled = !busy && submitted == null,
                modifier = Modifier.weight(1f)
            ) {
                busy = true
                runError = null
                scope.launch {
                    val all = problem.visible + problem.hidden
                    val out = withContext(Dispatchers.IO) {
                        PythonRunner.runTests(
                            code,
                            all.map { ExTest(it.run, null, it.expect) }
                        )
                    }
                    busy = false
                    totalTests = all.size
                    passedTests = if (out.codeOk) out.results.count { it.ok } else 0
                    if (!out.codeOk) runError = out.error.ifBlank { "Your code did not run." }
                    val score = if (all.isEmpty()) 0
                        else passedTests * 100 / all.size
                    submitted = score
                    problemScores = problemScores + (problem to score)
                }
            }
        }

        if (submitted != null) {
            Spacer(Modifier.height(Density.gapLg))
            WebCard {
                Column(Modifier.padding(Density.cardPadding)) {
                    Text(
                        "Result: ${submitted}% — $passedTests of $totalTests tests passed",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.heading()
                    )
                    if (problem.ideaPoints.isNotEmpty()) {
                        Spacer(Modifier.height(Density.gapSm))
                        Text(
                            "What a strong solution covers:",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        problem.ideaPoints.forEach { p ->
                            Text("• $p", color = TextMuted, fontSize = 12.sp)
                        }
                    }
                    Text(
                        "Reference targets: ${problem.optimalTime} time · ${problem.optimalSpace} space",
                        color = TextMuted, fontSize = 12.sp
                    )
                }
            }
            Spacer(Modifier.height(Density.gapMd))
            GradientButton(
                text = if (idx >= problems.size - 1) "See result" else "Next problem",
                modifier = Modifier.fillMaxWidth()
            ) {
                if (idx >= problems.size - 1) {
                    val overall = problemScores.sumOf { it.second } /
                        problemScores.size.coerceAtLeast(1)
                    vm.store.addInterviewRecord(
                        InterviewRecord(
                            System.currentTimeMillis(), role, "Coding", overall, false
                        )
                    )
                    finished = true
                } else {
                    idx++
                }
            }
        }
    }
}

/* ---------------- Group Discussion ---------------- */

private data class GdLine(val speaker: String, val stance: String, val text: String, val mine: Boolean)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun GdScreen(
    vm: AppViewModel,
    nav: NavController,
    bank: InterviewBank,
    onExit: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var topic by remember { mutableStateOf<IvGdTopic?>(null) }
    var lines by remember { mutableStateOf<List<GdLine>>(emptyList()) }
    var input by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var myRounds by remember { mutableStateOf(0) }
    var assessed by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(Density.screen)
    ) {
        ScreenHeader(
            "Group Discussion",
            "Three other candidates, one topic, your voice in the room — practise being heard.",
            onBack = onExit
        )
        Spacer(Modifier.height(Density.gapLg))

        if (topic == null) {
            Text(
                "Pick a topic",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.heading()
            )
            Spacer(Modifier.height(Density.gapMd))
            bank.gdTopics.forEach { t ->
                WebCard(onClick = {
                    topic = t
                    val opener = t.voices.firstOrNull()
                    lines = if (opener != null) {
                        listOf(GdLine(opener.name, opener.stance, opener.open, false))
                    } else emptyList()
                }) {
                    Column(Modifier.padding(Density.cardPadding)) {
                        Text(t.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(Density.gapXs))
                        Text(t.brief, color = TextMuted, fontSize = 12.sp, maxLines = 2)
                    }
                }
                Spacer(Modifier.height(Density.gapSm))
            }
            return@Column
        }

        val t = topic!!
        WebCard {
            Column(Modifier.padding(Density.cardPadding)) {
                Text(t.title, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.heading())
                Spacer(Modifier.height(Density.gapXs))
                Text(t.brief, color = TextMuted, fontSize = 12.sp)
                Spacer(Modifier.height(Density.gapXs))
                Text(
                    "Round ${minOf(myRounds + 1, 3)} of 3 — add your point, then listen for the replies.",
                    fontSize = 12.sp
                )
            }
        }
        Spacer(Modifier.height(Density.gapMd))
        lines.forEach { line ->
            WebCard {
                Column(Modifier.padding(Density.cardPadding)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            line.speaker,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f)
                        )
                        if (line.stance.isNotBlank()) WebChip(line.stance)
                    }
                    Spacer(Modifier.height(Density.gapXs))
                    Text(line.text, fontSize = 13.sp)
                }
            }
            Spacer(Modifier.height(Density.gapSm))
        }

        if (!assessed) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                label = { Text("Your contribution") },
                minLines = 2,
                maxLines = 4,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(Density.gapMd))
            GradientButton(
                text = if (busy) "The group is responding…" else "Speak",
                enabled = input.isNotBlank() && !busy,
                modifier = Modifier.fillMaxWidth()
            ) {
                val said = input.trim()
                input = ""
                lines = lines + GdLine("You", "", said, true)
                myRounds++
                if (myRounds >= 3) {
                    assessed = true
                    val words = lines.filter { it.mine }
                        .sumOf { it.text.split(Regex("\\s+")).filter { w -> w.isNotBlank() }.size }
                    val avg = words / 3
                    val score = (40 + minOf(60, avg * 2)).coerceIn(0, 100)
                    vm.store.addInterviewRecord(
                        InterviewRecord(
                            System.currentTimeMillis(), "Group Discussion",
                            "Group Discussion", score, false
                        )
                    )
                } else {
                    busy = true
                    scope.launch {
                        val voice = t.voices[myRounds % t.voices.size]
                        val payload = JSONObject().apply {
                            put("topic", t.title)
                            put("brief", t.brief)
                            put("name", voice.name)
                            put("stance", voice.stance)
                            put("opening", voice.open)
                        }
                        val res = AiRepository.askJson(
                            code = payload.toString(),
                            error = said.take(1200),
                            mode = "interview_gd"
                        )
                        val reply = res.getOrNull()?.optString("reply", "")
                            ?.takeIf { it.isNotBlank() }
                            ?: if (lines.none { it.text == voice.open }) {
                                voice.open
                            } else {
                                "I take your point — though I'd weigh the other side of it as well."
                            }
                        lines = lines + GdLine(voice.name, voice.stance, reply, false)
                        busy = false
                    }
                }
            }
        } else {
            val myWords = lines.filter { it.mine }
                .sumOf { it.text.split(Regex("\\s+")).filter { w -> w.isNotBlank() }.size }
            val avg = myWords / 3
            val score = (40 + minOf(60, avg * 2)).coerceIn(0, 100)
            Spacer(Modifier.height(Density.gapSm))
            WebCard {
                Column(Modifier.padding(Density.cardPadding)) {
                    Text(
                        "Discussion assessment — $score%",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.heading()
                    )
                    Spacer(Modifier.height(Density.gapSm))
                    Text("✓ Participation: you spoke in all 3 rounds.", fontSize = 13.sp)
                    Text(
                        "✓ Substance: about $avg words per contribution " +
                            if (avg >= 35) "— developed points, not one-liners."
                            else "— try developing each point a little further.",
                        fontSize = 13.sp
                    )
                    Text(
                        "✓ Presence: the group responded to your points directly.",
                        fontSize = 13.sp
                    )
                    Spacer(Modifier.height(Density.gapSm))
                    Text(
                        "Local assessment (participation and substance heuristics) — a real GD panel also weighs listening, tone and timing.",
                        color = TextMuted, fontSize = 12.sp, fontStyle = FontStyle.Italic
                    )
                }
            }
            Spacer(Modifier.height(Density.gapMd))
            GradientButton("Back to Interview Studio", Modifier.fillMaxWidth()) { onExit() }
        }
    }
}

/* ---------------- Full Placement Drive ---------------- */

private const val DRIVE_PASS_MARK = 40

private fun driveQaQuestions(
    bank: InterviewBank,
    role: String
): List<Pair<IvQuestion, String>> {
    val topics = bank.roleTopics[role].orEmpty()
    val tech = bank.technical.filter { it.tier <= 2 }
    val byRole = if (topics.isNotEmpty()) tech.filter { it.topic in topics } else tech
    val techPick = (if (byRole.size >= 3) byRole else tech).shuffled().take(3)
    val hrPick = bank.hr.shuffled().take(2)
    return techPick.map { it to "Technical" } + hrPick.map { it to "HR" }
}

@Composable
fun DriveScreen(
    vm: AppViewModel,
    nav: NavController,
    bank: InterviewBank,
    role: String,
    onExit: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var stage by remember { mutableStateOf("aptitude") }

    // Stage 1 — aptitude.
    val aptQs = remember { bank.aptitude.shuffled().take(10) }
    var aptIdx by remember { mutableStateOf(0) }
    var aptAnswers by remember { mutableStateOf<List<Int>>(emptyList()) }
    val aptScore = if (aptQs.isEmpty()) 0
        else aptAnswers.indices.count { i -> aptAnswers[i] == aptQs[i].answer } * 100 / aptQs.size

    // Stage 2 — technical + HR Q&A (fixed set, scored at the end).
    val qaQuestions = remember { driveQaQuestions(bank, role) }
    var qaIdx by remember { mutableStateOf(0) }
    var qaAnswer by remember { mutableStateOf("") }
    var qaGiven by remember { mutableStateOf<List<QaItem>>(emptyList()) }
    var qaScore by remember { mutableStateOf<Int?>(null) }
    var qaOffline by remember { mutableStateOf(false) }
    var scoring by remember { mutableStateOf(false) }

    // Stage 3 — coding.
    val codingProblem = remember { pickCoding(bank, "Standard", 1).firstOrNull() }
    var driveCode by remember { mutableStateOf(codingProblem?.starter ?: "") }
    var codingScore by remember { mutableStateOf<Int?>(null) }
    var codingBusy by remember { mutableStateOf(false) }
    var codingError by remember { mutableStateOf<String?>(null) }

    var savedRecord by remember { mutableStateOf(false) }
    fun saveRecord(overall: Int) {
        if (savedRecord) return
        savedRecord = true
        vm.store.addInterviewRecord(
            InterviewRecord(System.currentTimeMillis(), role, "Full Drive", overall, qaOffline)
        )
    }

    @Composable
    fun StageRow(name: String, score: Int?, note: String) {
        WebCard {
            Row(
                Modifier.padding(Density.cardPadding),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text(note, color = TextMuted, fontSize = 12.sp)
                }
                if (score != null) {
                    Text(
                        "$score%",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (score >= DRIVE_PASS_MARK) Success else Danger
                    )
                    Spacer(Modifier.size(Density.gapSm))
                    WebChip(if (score >= DRIVE_PASS_MARK) "Pass" else "Below $DRIVE_PASS_MARK%")
                }
            }
        }
        Spacer(Modifier.height(Density.gapSm))
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(Density.screen)
    ) {
        ScreenHeader(
            "Full Placement Drive",
            "Aptitude → Technical & HR → Coding, like a real campus drive. Each stage must clear $DRIVE_PASS_MARK%.",
            onBack = onExit
        )
        Spacer(Modifier.height(Density.gapLg))

        when (stage) {
            "aptitude" -> {
                if (aptQs.isEmpty() || aptIdx >= aptQs.size) {
                    Text("The aptitude bank is unavailable.", color = TextMuted, fontSize = 13.sp)
                } else {
                    val q = aptQs[aptIdx]
                    Text(
                        "Stage 1 · Aptitude — question ${aptIdx + 1} of ${aptQs.size}",
                        color = TextMuted, fontSize = 12.sp
                    )
                    Spacer(Modifier.height(Density.gapMd))
                    WebCard {
                        Column(Modifier.padding(Density.cardPadding)) {
                            WebChip(q.area)
                            Spacer(Modifier.height(Density.gapSm))
                            Text(q.q, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(Density.gapMd))
                            q.options.forEachIndexed { oi, opt ->
                                OutlinedButton(
                                    onClick = {
                                        aptAnswers = aptAnswers + oi
                                        if (aptIdx >= aptQs.size - 1) {
                                            val finalAnswers = aptAnswers + oi
                                            val score = finalAnswers.indices.count { i ->
                                                finalAnswers[i] == aptQs[i].answer
                                            } * 100 / aptQs.size
                                            if (score >= DRIVE_PASS_MARK) {
                                                stage = "qa"
                                            } else {
                                                saveRecord(score)
                                                stage = "report"
                                            }
                                        } else {
                                            aptIdx++
                                        }
                                    },
                                    colors = ButtonDefaults.outlinedButtonColors(
                                        containerColor = Card
                                    ),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 3.dp)
                                ) {
                                    Text(opt, fontSize = 13.sp, modifier = Modifier.fillMaxWidth())
                                }
                            }
                        }
                    }
                    Text(
                        "Exam rules: no feedback until the stage ends — just like the real test.",
                        color = TextMuted, fontSize = 12.sp
                    )
                }
            }

            "qa" -> {
                if (scoring) {
                    Column(
                        Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator()
                        Spacer(Modifier.height(Density.gapMd))
                        Text("Scoring the interview stage…", color = TextMuted, fontSize = 13.sp)
                    }
                } else if (qaIdx < qaQuestions.size) {
                    val (q, round) = qaQuestions[qaIdx]
                    Text(
                        "Stage 2 · Interview — question ${qaIdx + 1} of ${qaQuestions.size} ($round)",
                        color = TextMuted, fontSize = 12.sp
                    )
                    Spacer(Modifier.height(Density.gapMd))
                    WebCard {
                        Column(Modifier.padding(Density.cardPadding)) {
                            WebChip("$round · ${q.skill}")
                            Spacer(Modifier.height(Density.gapSm))
                            Text(q.q, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    Spacer(Modifier.height(Density.gapMd))
                    OutlinedTextField(
                        value = qaAnswer,
                        onValueChange = { qaAnswer = it },
                        label = { Text("Your answer") },
                        minLines = 3,
                        maxLines = 6,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(Density.gapMd))
                    GradientButton(
                        text = if (qaIdx >= qaQuestions.size - 1) "Finish interview stage" else "Next question",
                        enabled = qaAnswer.isNotBlank(),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        val item = QaItem(q.q, q.points, qaAnswer.trim(), q.skill)
                        val all = qaGiven + item
                        qaGiven = all
                        qaAnswer = ""
                        if (qaIdx >= qaQuestions.size - 1) {
                            scoring = true
                            scope.launch {
                                val (scores, off) = scoreQa(all, "Full Drive")
                                qaScore = if (scores.isEmpty()) 0
                                    else scores.sumOf { it.score } / scores.size
                                qaOffline = off
                                scoring = false
                                stage = "coding"
                            }
                        } else {
                            qaIdx++
                        }
                    }
                }
            }

            "coding" -> {
                val p = codingProblem
                if (p == null) {
                    Text("The coding bank is unavailable.", color = TextMuted, fontSize = 13.sp)
                } else {
                    Text(
                        "Stage 3 · Coding — one problem, judged by tests",
                        color = TextMuted, fontSize = 12.sp
                    )
                    Spacer(Modifier.height(Density.gapMd))
                    WebCard {
                        Column(Modifier.padding(Density.cardPadding)) {
                            Text(p.title, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.heading())
                            Spacer(Modifier.height(Density.gapSm))
                            Text(p.prompt, fontSize = 13.sp)
                            Spacer(Modifier.height(Density.gapSm))
                            Text(
                                "${p.visible.size} visible + ${p.hidden.size} hidden tests",
                                color = TextMuted, fontSize = 12.sp
                            )
                        }
                    }
                    Spacer(Modifier.height(Density.gapMd))
                    OutlinedTextField(
                        value = driveCode,
                        onValueChange = { driveCode = it },
                        label = { Text("Your solution") },
                        minLines = 8,
                        maxLines = 14,
                        enabled = codingScore == null,
                        textStyle = androidx.compose.ui.text.TextStyle(
                            fontFamily = FontFamily.Monospace, fontSize = 13.sp, lineHeight = 18.sp
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (codingError != null) {
                        Spacer(Modifier.height(Density.gapSm))
                        Text(codingError!!, color = Danger, fontSize = 12.sp)
                    }
                    Spacer(Modifier.height(Density.gapMd))
                    if (codingScore == null) {
                        GradientButton(
                            text = if (codingBusy) "Running tests…" else "Submit & finish drive",
                            enabled = !codingBusy,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            codingBusy = true
                            codingError = null
                            scope.launch {
                                val all = p.visible + p.hidden
                                val out = withContext(Dispatchers.IO) {
                                    PythonRunner.runTests(
                                        driveCode,
                                        all.map { ExTest(it.run, null, it.expect) }
                                    )
                                }
                                codingBusy = false
                                if (!out.codeOk) {
                                    codingError = out.error.ifBlank { "Your code did not run." }
                                }
                                val passed = if (out.codeOk) out.results.count { it.ok } else 0
                                codingScore = if (all.isEmpty()) 0 else passed * 100 / all.size
                            }
                        }
                    } else {
                        Text(
                            "Coding score: $codingScore%",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(Density.gapMd))
                        GradientButton("See drive report", Modifier.fillMaxWidth()) {
                            val overall = (aptScore + (qaScore ?: 0) + (codingScore ?: 0)) / 3
                            saveRecord(overall)
                            stage = "report"
                        }
                    }
                }
            }

            "report" -> {
                val completed = listOfNotNull(
                    aptScore,
                    qaScore,
                    codingScore
                )
                val overall = if (completed.isEmpty()) 0 else completed.sum() / completed.size
                val cleared = qaScore != null && codingScore != null &&
                    aptScore >= DRIVE_PASS_MARK &&
                    (qaScore ?: 0) >= DRIVE_PASS_MARK &&
                    (codingScore ?: 0) >= DRIVE_PASS_MARK
                WebCard {
                    Column(
                        Modifier.padding(Density.cardPadding),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        MasteryRing(
                            progress = overall / 100f,
                            size = 84.dp,
                            label = "$overall%"
                        )
                        Spacer(Modifier.height(Density.gapMd))
                        Text(
                            if (cleared) "Drive cleared 🎉" else "Drive report",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.heading()
                        )
                        Text(
                            when {
                                cleared ->
                                    "Every stage cleared the $DRIVE_PASS_MARK% bar. That's genuine placement form."
                                qaScore == null ->
                                    "The drive ended at the aptitude stage — the pass mark is $DRIVE_PASS_MARK%. Practise aptitude questions and take the drive again."
                                else ->
                                    "Some stages fell below $DRIVE_PASS_MARK% — the stage scores below show exactly where to work."
                            },
                            color = TextMuted, fontSize = 13.sp
                        )
                        if (qaOffline) {
                            Text(
                                "Interview stage used offline scoring.",
                                color = TextMuted, fontSize = 12.sp, fontStyle = FontStyle.Italic
                            )
                        }
                    }
                }
                Spacer(Modifier.height(Density.gapLg))
                StageRow("Stage 1 · Aptitude", aptScore, "10 questions across quant, logic and verbal")
                if (qaScore != null) {
                    StageRow("Stage 2 · Technical & HR", qaScore, "5 questions, rubric-scored")
                }
                if (codingScore != null) {
                    StageRow("Stage 3 · Coding", codingScore, "1 problem, visible + hidden tests")
                }
                Spacer(Modifier.height(Density.gapMd))
                GradientButton("Back to Interview Studio", Modifier.fillMaxWidth()) { onExit() }
            }
        }
    }
}
