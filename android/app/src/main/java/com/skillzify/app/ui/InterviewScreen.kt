package com.skillzify.app.ui

import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.AiRepository
import com.skillzify.app.data.INTERVIEW_ROLES
import com.skillzify.app.data.InterviewLocal
import com.skillzify.app.data.InterviewRecord
import com.skillzify.app.data.InterviewBank
import com.skillzify.app.data.IvCompany
import com.skillzify.app.data.IvQuestion
import com.skillzify.app.data.loadInterviewBank
import com.skillzify.app.ui.designsystem.Density
import com.skillzify.app.ui.designsystem.MasteryRing
import com.skillzify.app.ui.designsystem.heading
import com.skillzify.app.ui.theme.Primary
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/* App 2.0 Phase B — Interview Studio (step 1: the core loop).
 *
 * The website's AI Interview Intelligence, core flow: configure ->
 * adaptive interview (AI interviewer via server mode interview_turn,
 * bank follow-ups as the deterministic fallback) -> scored report
 * (mode interview_score against the rubric points; local token-
 * overlap scoring when the AI is unreachable, honestly labelled
 * "Offline scoring") -> weakness list + a roadmap into real lessons.
 *
 * Voice: the mic button uses the system speech recogniser; the
 * transcript lands in the answer field EDITABLE before sending —
 * nothing is recorded or stored (the web's trust rule).
 *
 * AI budget (web parity): at most 3 interview_turn calls + 1
 * interview_score call per session; later answers use the local
 * follow-up engine. The full port also lives here: panel mode
 * (named interviewers), company simulations (topic/tier/HR shaping
 * with the bank's disclaimer), and resume-based starts (server mode
 * interview_resume). The Coding round, Group Discussion and Full
 * Placement Drive are dedicated screens in InterviewModes.kt. */

private data class Exchange(
    val question: IvQuestion,
    val round: String,
    val answer: String,
    val followupQ: String?,
    val followupAnswer: String?
)

private data class ItemScore(
    val i: Int,
    val score: Int,
    val well: String,
    val improve: String,
    val evidence: String
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun InterviewScreen(vm: AppViewModel, nav: NavController) {
    val ctx = LocalContext.current
    val bank = remember { loadInterviewBank(ctx) }
    val scope = rememberCoroutineScope()

    var stage by remember { mutableStateOf("config") }
    var role by remember { mutableStateOf(INTERVIEW_ROLES[0]) }
    var type by remember { mutableStateOf("Mixed") }
    var difficulty by remember { mutableStateOf("Standard") }
    var duration by remember { mutableStateOf(15) }
    // Full-port additions: company simulation, panel mode, resume start.
    var company by remember { mutableStateOf<IvCompany?>(null) }
    var panelMode by remember { mutableStateOf(false) }
    var modeLabel by remember { mutableStateOf("") }
    var resumeText by remember { mutableStateOf("") }
    var resumeBusy by remember { mutableStateOf(false) }
    var resumeError by remember { mutableStateOf<String?>(null) }

    // Live session state.
    var queue by remember { mutableStateOf<List<Pair<IvQuestion, String>>>(emptyList()) }
    var qIndex by remember { mutableStateOf(0) }
    var done by remember { mutableStateOf<List<Exchange>>(emptyList()) }
    var answer by remember { mutableStateOf("") }
    var mainAnswer by remember { mutableStateOf("") }
    var followup by remember { mutableStateOf<Pair<String?, String>?>(null) }
    var busy by remember { mutableStateOf(false) }
    var turnBudget by remember { mutableStateOf(3) }

    // Report state.
    var scores by remember { mutableStateOf<List<ItemScore>>(emptyList()) }
    var offline by remember { mutableStateOf(false) }

    val speechLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val spoken = result.data
            ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()
        if (!spoken.isNullOrBlank()) {
            answer = if (answer.isBlank()) spoken else "$answer $spoken"
        }
    }

    fun startVoice() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak your answer")
        }
        try {
            speechLauncher.launch(intent)
        } catch (e: Exception) { /* no recogniser on this device */ }
    }

    fun finishExchange(followupAnswer: String?) {
        val (q, round) = queue[qIndex]
        val newDone = done + Exchange(q, round, mainAnswer, followup?.second, followupAnswer)
        done = newDone
        followup = null
        mainAnswer = ""
        answer = ""
        qIndex += 1
        if (qIndex >= queue.size) {
            stage = "scoring"
            scoreSession(scope, newDone, type) { s, off ->
                scores = s
                offline = off
                val overall = if (s.isEmpty()) 0 else s.sumOf { it.score } / s.size
                vm.store.addInterviewRecord(
                    InterviewRecord(
                        System.currentTimeMillis(), role,
                        modeLabel.ifBlank { type }, overall, off
                    )
                )
                stage = "report"
            }
        }
    }

    fun submit() {
        val text = answer.trim()
        if (busy) return
        if (followup != null) {
            finishExchange(text)
            return
        }
        mainAnswer = text
        val (q, round) = queue[qIndex]
        // Decide the follow-up: AI interviewer while budget remains,
        // the local bank engine otherwise (and on any AI failure).
        if (turnBudget > 0) {
            busy = true
            scope.launch {
                val persona = if (panelMode) {
                    bank.persona(if (round == "HR") "hr" else "tech")
                } else null
                val state = JSONObject().apply {
                    put("role", role)
                    put("type", type)
                    put("style", persona?.style ?: "Professional")
                    put("interviewer", persona?.name ?: "")
                    put("round", round)
                    put("question", q.q)
                    put("points", JSONArray(q.points))
                    put("localRead", InterviewLocal.localRead(text, q.points))
                    put("covered", JSONArray(done.map { it.question.skill }))
                }
                val res = AiRepository.askJson(
                    code = state.toString(),
                    error = text.take(1500),
                    mode = "interview_turn"
                )
                busy = false
                turnBudget -= 1
                val obj = res.getOrNull()
                val action = obj?.optString("action", "") ?: ""
                val fq = obj?.optString("followup_question", "")?.takeIf { it.isNotBlank() }
                val say = obj?.optString("say", "")?.takeIf { it.isNotBlank() }
                if (obj != null && fq != null && action != "next" && action != "end") {
                    followup = say to fq
                    answer = ""
                } else if (obj != null) {
                    finishExchange(null)
                } else {
                    val local = InterviewLocal.localFollowup(q, text)
                    if (local != null) {
                        followup = null to local.q
                        answer = ""
                    } else {
                        finishExchange(null)
                    }
                }
            }
        } else {
            val local = InterviewLocal.localFollowup(q, text)
            if (local != null) {
                followup = null to local.q
                answer = ""
            } else {
                finishExchange(null)
            }
        }
    }

    // Dedicated full-screen modes (their own headers and flows).
    if (stage == "coding") {
        CodingInterviewScreen(vm, nav, bank, role, difficulty, duration) { stage = "config" }
        return
    }
    if (stage == "gd") {
        GdScreen(vm, nav, bank) { stage = "config" }
        return
    }
    if (stage == "drive") {
        DriveScreen(vm, nav, bank, role) { stage = "config" }
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(Density.screen)
    ) {
        ScreenHeader(
            "AI Interview",
            "Adaptive mock interviews with rubric scoring — the full Skillzify interviewer, on your phone.",
            onBack = { nav.popBackStack() }
        )
        Spacer(Modifier.height(Density.gapLg))

        if (bank.isEmpty) {
            WebCard {
                Column(Modifier.padding(Density.cardPadding)) {
                    Text("The interview bank could not be loaded on this device.", fontSize = 14.sp)
                }
            }
            return@Column
        }

        when (stage) {
            "config" -> {
                Text("Target role", fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.heading())
                Spacer(Modifier.height(Density.gapSm))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(Density.gapSm)) {
                    INTERVIEW_ROLES.forEach { r ->
                        FilterChip(
                            selected = role == r,
                            onClick = { role = r },
                            label = { Text(r, fontSize = 12.sp) }
                        )
                    }
                }
                Spacer(Modifier.height(Density.gapLg))
                Text("Interview type", fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.heading())
                Spacer(Modifier.height(Density.gapSm))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(Density.gapSm)) {
                    listOf(
                        "Technical", "HR", "Mixed", "Coding",
                        "Group Discussion", "Full Drive"
                    ).forEach { t ->
                        FilterChip(
                            selected = type == t,
                            onClick = { type = t },
                            label = { Text(t, fontSize = 12.sp) }
                        )
                    }
                }
                if (type == "Technical" || type == "HR" || type == "Mixed") {
                    Spacer(Modifier.height(Density.gapMd))
                    FilterChip(
                        selected = panelMode,
                        onClick = { panelMode = !panelMode },
                        label = { Text("👥 Panel interview — named interviewers", fontSize = 12.sp) }
                    )
                }
                if (type != "Coding" && type != "Group Discussion" && bank.companies.isNotEmpty()) {
                    Spacer(Modifier.height(Density.gapLg))
                    Text("Company simulation", fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.heading())
                    Spacer(Modifier.height(Density.gapSm))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(Density.gapSm)) {
                        FilterChip(
                            selected = company == null,
                            onClick = { company = null },
                            label = { Text("Any company", fontSize = 12.sp) }
                        )
                        bank.companies.forEach { c ->
                            FilterChip(
                                selected = company?.id == c.id,
                                onClick = { company = c },
                                label = { Text(c.name, fontSize = 12.sp) }
                            )
                        }
                    }
                    if (company != null) {
                        Spacer(Modifier.height(Density.gapSm))
                        Text(company!!.note, color = TextMuted, fontSize = 12.sp)
                        if (bank.simDisclaimer.isNotBlank()) {
                            Text(bank.simDisclaimer, color = TextMuted, fontSize = 12.sp)
                        }
                    }
                }
                Spacer(Modifier.height(Density.gapLg))
                Row(horizontalArrangement = Arrangement.spacedBy(Density.gapLg)) {
                    Column {
                        Text("Difficulty", fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.heading())
                        Spacer(Modifier.height(Density.gapSm))
                        Row(horizontalArrangement = Arrangement.spacedBy(Density.gapSm)) {
                            listOf("Standard", "Advanced").forEach { d ->
                                FilterChip(
                                    selected = difficulty == d,
                                    onClick = { difficulty = d },
                                    label = { Text(d, fontSize = 12.sp) }
                                )
                            }
                        }
                    }
                    Column {
                        Text("Duration", fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.heading())
                        Spacer(Modifier.height(Density.gapSm))
                        Row(horizontalArrangement = Arrangement.spacedBy(Density.gapSm)) {
                            listOf(15, 30).forEach { d ->
                                FilterChip(
                                    selected = duration == d,
                                    onClick = { duration = d },
                                    label = { Text("$d min", fontSize = 12.sp) }
                                )
                            }
                        }
                    }
                }
                Spacer(Modifier.height(Density.gapLg))
                GradientButton("Start interview", Modifier.fillMaxWidth()) {
                    when (type) {
                        "Coding" -> stage = "coding"
                        "Group Discussion" -> stage = "gd"
                        "Full Drive" -> stage = "drive"
                        else -> {
                            queue = pickQuestions(bank, role, type, difficulty, duration, company)
                            qIndex = 0
                            done = emptyList()
                            answer = ""
                            mainAnswer = ""
                            followup = null
                            turnBudget = 3
                            modeLabel = type
                            stage = "live"
                        }
                    }
                }

                if (type == "Technical" || type == "HR" || type == "Mixed") {
                    Spacer(Modifier.height(Density.gapLg))
                    Text(
                        "Or start from your resume",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.heading()
                    )
                    Spacer(Modifier.height(Density.gapSm))
                    Text(
                        "Paste your resume text — the interviewer builds questions from YOUR projects and skills. The text goes only to the AI service for this analysis.",
                        color = TextMuted, fontSize = 12.sp
                    )
                    Spacer(Modifier.height(Density.gapSm))
                    OutlinedTextField(
                        value = resumeText,
                        onValueChange = { resumeText = it },
                        label = { Text("Resume text") },
                        minLines = 3,
                        maxLines = 5,
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (resumeError != null) {
                        Spacer(Modifier.height(Density.gapSm))
                        Text(resumeError!!, color = TextMuted, fontSize = 12.sp)
                    }
                    Spacer(Modifier.height(Density.gapSm))
                    androidx.compose.material3.OutlinedButton(
                        onClick = {
                            resumeBusy = true
                            resumeError = null
                            scope.launch {
                                val res = AiRepository.askJson(
                                    code = resumeText.take(6000),
                                    mode = "interview_resume",
                                    context = role
                                )
                                resumeBusy = false
                                val arr = res.getOrNull()?.optJSONArray("questions")
                                if (arr != null && arr.length() > 0) {
                                    queue = (0 until arr.length()).map { qi ->
                                        val o = arr.getJSONObject(qi)
                                        IvQuestion(
                                            id = "resume-$qi",
                                            topic = o.optString("topic", ""),
                                            skill = o.optString("topic", "Resume"),
                                            tier = 2,
                                            q = o.optString("q", ""),
                                            points = o.optJSONArray("points")?.let { pa ->
                                                (0 until pa.length()).map { pa.getString(it) }
                                            } ?: emptyList(),
                                            followups = emptyList()
                                        ) to "Technical"
                                    }.filter { it.first.q.isNotBlank() }
                                    if (queue.isNotEmpty()) {
                                        qIndex = 0
                                        done = emptyList()
                                        answer = ""
                                        mainAnswer = ""
                                        followup = null
                                        turnBudget = 3
                                        modeLabel = "Resume"
                                        stage = "live"
                                    } else {
                                        resumeError = "No questions could be built from that text — try pasting more of the resume."
                                    }
                                } else {
                                    resumeError = "The resume analysis is unavailable right now (AI unreachable or pool busy). A standard interview above will work as usual."
                                }
                            }
                        },
                        enabled = resumeText.trim().length > 80 && !resumeBusy,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (resumeBusy) "Analysing…" else "Analyse my resume & start", fontSize = 13.sp)
                    }
                }

                val history = remember(stage) {
                    if (stage == "config") vm.store.interviewHistory() else emptyList()
                }
                if (history.isNotEmpty()) {
                    Spacer(Modifier.height(Density.gapLg))
                    Text("Past interviews", fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.heading())
                    Spacer(Modifier.height(Density.gapMd))
                    val fmt = remember { SimpleDateFormat("d MMM, h:mm a", Locale.US) }
                    history.take(5).forEach { rec ->
                        WebCard {
                            Row(
                                Modifier.padding(Density.cardPadding),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        "${rec.role} · ${rec.type}",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1
                                    )
                                    Text(
                                        fmt.format(Date(rec.date)) +
                                            if (rec.offline) " · offline scoring" else "",
                                        color = TextMuted, fontSize = 12.sp
                                    )
                                }
                                Text(
                                    "${rec.score}%",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (rec.score >= 50) Success else Warning
                                )
                            }
                        }
                        Spacer(Modifier.height(Density.gapSm))
                    }
                }
            }

            "live" -> {
                val (q, round) = queue[qIndex]
                Text(
                    "Question ${qIndex + 1} of ${queue.size} · $round round",
                    color = TextMuted, fontSize = 12.sp
                )
                Spacer(Modifier.height(Density.gapSm))
                LinearProgressIndicator(
                    progress = { (qIndex.toFloat() / queue.size).coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(Density.gapLg))

                if (panelMode && done.isEmpty() && followup == null) {
                    val roundsPresent = queue.map { it.second }.toSet()
                    val panel = listOfNotNull(
                        if ("Technical" in roundsPresent) bank.persona("tech") else null,
                        if ("HR" in roundsPresent) bank.persona("hr") else null
                    )
                    if (panel.isNotEmpty()) {
                        WebCard {
                            Column(Modifier.padding(Density.cardPadding)) {
                                Text(
                                    "Your panel today",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.heading()
                                )
                                panel.forEach { p ->
                                    Spacer(Modifier.height(Density.gapXs))
                                    Text(
                                        "${p.name} · ${p.role} — ${p.intro}",
                                        color = TextMuted, fontSize = 12.sp
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.height(Density.gapMd))
                    }
                }

                done.forEach { ex ->
                    WebCard {
                        Column(Modifier.padding(Density.cardPadding)) {
                            Text(ex.question.q, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(Density.gapXs))
                            Text(ex.answer, color = TextMuted, fontSize = 13.sp)
                            if (ex.followupQ != null) {
                                Spacer(Modifier.height(Density.gapSm))
                                Text(ex.followupQ, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                Spacer(Modifier.height(Density.gapXs))
                                Text(ex.followupAnswer ?: "", color = TextMuted, fontSize = 13.sp)
                            }
                        }
                    }
                    Spacer(Modifier.height(Density.gapSm))
                }

                WebCard {
                    Column(Modifier.padding(Density.cardPadding)) {
                        val persona = if (panelMode) {
                            bank.persona(if (round == "HR") "hr" else "tech")
                        } else null
                        WebChip(
                            when {
                                persona != null && followup != null ->
                                    "Follow-up · ${persona.name}"
                                persona != null ->
                                    "${persona.name} · ${persona.role}"
                                followup != null -> "Follow-up · $round"
                                else -> "$round · ${q.skill}"
                            }
                        )
                        Spacer(Modifier.height(Density.gapSm))
                        if (followup != null) {
                            if (followup!!.first != null) {
                                Text(
                                    followup!!.first!!,
                                    fontSize = 14.sp,
                                    fontStyle = FontStyle.Italic
                                )
                                Spacer(Modifier.height(Density.gapXs))
                            }
                            Text(followup!!.second, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        } else {
                            Text(q.q, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                Spacer(Modifier.height(Density.gapMd))
                OutlinedTextField(
                    value = answer,
                    onValueChange = { answer = it },
                    label = { Text("Your answer — type, or tap the mic and speak") },
                    minLines = 3,
                    maxLines = 6,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(Density.gapMd))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { startVoice() }, enabled = !busy) {
                        Icon(Icons.Filled.Mic, contentDescription = "Answer by voice", tint = Primary)
                    }
                    GradientButton(
                        text = if (busy) "Interviewer is thinking…" else "Send answer",
                        enabled = answer.isNotBlank() && !busy,
                        modifier = Modifier.weight(1f)
                    ) { submit() }
                }
                Spacer(Modifier.height(Density.gapSm))
                Text(
                    "Voice answers are transcribed on-device by the system recogniser and stay editable — nothing is recorded.",
                    color = TextMuted, fontSize = 12.sp
                )
            }

            "scoring" -> {
                Column(
                    Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    CircularProgressIndicator()
                    Spacer(Modifier.height(Density.gapMd))
                    Text("Scoring your interview against the rubric…", color = TextMuted, fontSize = 13.sp)
                }
            }

            "report" -> {
                val overall = if (scores.isEmpty()) 0 else scores.sumOf { it.score } / scores.size
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MasteryRing(
                        progress = overall / 100f,
                        size = 72.dp,
                        label = "$overall%"
                    )
                    Spacer(Modifier.height(Density.gapLg))
                    Column(Modifier.padding(start = Density.gapLg)) {
                        Text(
                            "Interview report",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.heading()
                        )
                        Text(
                            "$role · ${modeLabel.ifBlank { type }}" +
                                if (offline) " · Offline scoring" else "",
                            color = TextMuted, fontSize = 12.sp
                        )
                        Text(
                            when {
                                overall >= 75 -> "Strong — placement-ready form."
                                overall >= 50 -> "Solid base — sharpen the gaps below."
                                else -> "Early days — the roadmap below is the way up."
                            },
                            fontSize = 13.sp
                        )
                    }
                }
                Spacer(Modifier.height(Density.gapLg))
                scores.forEach { s ->
                    val ex = done.getOrNull(s.i) ?: return@forEach
                    WebCard {
                        Column(Modifier.padding(Density.cardPadding)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    ex.question.q,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    "${s.score}",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (s.score >= 50) Success else Warning
                                )
                            }
                            if (s.evidence.isNotBlank()) {
                                Spacer(Modifier.height(Density.gapXs))
                                Text(
                                    "“${s.evidence}”",
                                    color = TextMuted,
                                    fontSize = 12.sp,
                                    fontStyle = FontStyle.Italic
                                )
                            }
                            if (s.well.isNotBlank()) {
                                Spacer(Modifier.height(Density.gapXs))
                                Text("✓ ${s.well}", fontSize = 12.sp)
                            }
                            if (s.improve.isNotBlank()) {
                                Spacer(Modifier.height(Density.gapXs))
                                Text("→ ${s.improve}", fontSize = 12.sp)
                            }
                        }
                    }
                    Spacer(Modifier.height(Density.gapSm))
                }

                // Roadmap: weak answers -> real lessons.
                val weak = scores.filter { it.score < 50 }
                if (weak.isNotEmpty()) {
                    Spacer(Modifier.height(Density.gapMd))
                    Text(
                        "Your roadmap",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.heading()
                    )
                    Spacer(Modifier.height(Density.gapMd))
                    val lessonIds = mutableSetOf<String>()
                    weak.take(3).forEach { s ->
                        val ex = done.getOrNull(s.i) ?: return@forEach
                        val keys = InterviewLocal.words(ex.question.skill) +
                            InterviewLocal.words(ex.question.topic)
                        val lesson = vm.catalog.lessons.firstOrNull { l ->
                            l.id !in lessonIds &&
                                keys.any { k -> l.title.lowercase().contains(k) }
                        }
                        if (lesson != null) {
                            lessonIds += lesson.id
                            WebCard(onClick = { nav.navigate("lesson/${lesson.id}") }) {
                                Row(
                                    Modifier.padding(Density.cardPadding),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            lesson.title,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1
                                        )
                                        Text(
                                            "For: ${ex.question.skill}",
                                            color = TextMuted, fontSize = 12.sp, maxLines = 1
                                        )
                                    }
                                    Text("Open →", color = Primary, fontSize = 13.sp)
                                }
                            }
                            Spacer(Modifier.height(Density.gapSm))
                        }
                    }
                }

                Spacer(Modifier.height(Density.gapMd))
                GradientButton("New interview", Modifier.fillMaxWidth()) {
                    stage = "config"
                    scores = emptyList()
                    done = emptyList()
                }
            }
        }
    }
}

/** Question selection (web shape): the role's topics first, then the
    company's topics when a simulation is picked; tier-filtered with
    the company's tier bias applied; shuffled. */
private fun pickQuestions(
    bank: InterviewBank,
    role: String,
    type: String,
    difficulty: String,
    duration: Int,
    company: IvCompany?
): List<Pair<IvQuestion, String>> {
    val baseTiers = if (difficulty == "Advanced") setOf(2, 3) else setOf(1, 2)
    val bias = company?.tierBias ?: 0
    val tiers = baseTiers.map { (it + bias).coerceIn(1, 3) }.toSet()
    val roleTopics = bank.roleTopics[role].orEmpty()
    fun techPool(): List<IvQuestion> {
        var pool = bank.technical
        if (roleTopics.isNotEmpty()) {
            val byRole = pool.filter { it.topic in roleTopics }
            if (byRole.size >= 3) pool = byRole
        }
        if (company != null) {
            val byCompany = pool.filter { it.topic in company.topics }
            if (byCompany.size >= 2) pool = byCompany
        }
        return pool
    }
    fun pool(list: List<IvQuestion>, n: Int): List<IvQuestion> {
        if (n <= 0) return emptyList()
        val filtered = list.filter { it.tier in tiers }
        return (if (filtered.size >= n) filtered else list).shuffled().take(n)
    }
    val techN = when (type) {
        "Technical" -> if (duration == 15) 4 else 6
        "Mixed" -> if (duration == 15) 2 else 3
        else -> 0
    }
    var hrN = when (type) {
        "HR" -> if (duration == 15) 4 else 6
        "Mixed" -> if (duration == 15) 2 else 3
        else -> 0
    }
    if (company?.hrBoost == true && type == "Mixed") hrN += 1
    val out = mutableListOf<Pair<IvQuestion, String>>()
    pool(techPool(), techN).forEach { out += it to "Technical" }
    pool(bank.hr, hrN).forEach { out += it to "HR" }
    return out
}

/** Scores a finished session: AI rubric scoring first, deterministic
    local scoring as the fallback (labelled offline by the caller). */
private fun scoreSession(
    scope: kotlinx.coroutines.CoroutineScope,
    exchanges: List<Exchange>,
    type: String,
    onDone: (List<ItemScore>, Boolean) -> Unit
) {
    scope.launch {
        val items = JSONArray()
        exchanges.forEach { ex ->
            val combined = buildString {
                append(ex.answer)
                if (ex.followupQ != null) {
                    append("\nFollow-up — Q: ")
                    append(ex.followupQ)
                    append(" A: ")
                    append(ex.followupAnswer ?: "")
                }
            }
            items.put(JSONObject().apply {
                put("q", ex.question.q)
                put("points", JSONArray(ex.question.points))
                put("answer", combined.take(1200))
            })
        }
        val payload = JSONObject().apply {
            put("round", type)
            put("items", items)
        }
        val res = AiRepository.askJson(code = payload.toString(), mode = "interview_score")
        val obj = res.getOrNull()
        val arr = obj?.optJSONArray("scores")
        if (obj != null && arr != null && arr.length() > 0) {
            val out = (0 until arr.length()).map {
                val s = arr.getJSONObject(it)
                ItemScore(
                    i = s.optInt("i", it),
                    score = s.optInt("score", 0).coerceIn(0, 100),
                    well = s.optString("well", ""),
                    improve = s.optString("improve", ""),
                    evidence = s.optString("evidence", "")
                )
            }.sortedBy { it.i }
            onDone(out, false)
        } else {
            val out = exchanges.mapIndexed { i, ex ->
                val combined = ex.answer + " " + (ex.followupAnswer ?: "")
                val cov = InterviewLocal.coverage(combined, ex.question.points)
                val covered = ex.question.points.filter {
                    InterviewLocal.coverage(combined, listOf(it)) >= 0.99
                }
                val missed = ex.question.points.firstOrNull { it !in covered }
                ItemScore(
                    i = i,
                    score = (cov * 100).toInt().coerceIn(0, 100),
                    well = if (covered.isNotEmpty()) "You covered: ${covered.first()}" else "",
                    improve = if (missed != null) "Missing point: $missed" else "",
                    evidence = combined.trim().take(90)
                )
            }
            onDone(out, true)
        }
    }
}
