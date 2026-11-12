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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.buildQuiz
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun LessonDetail(vm: AppViewModel, lessonId: String, nav: NavController) {
    val lesson = remember(lessonId) { vm.catalog.lessons.first { it.id == lessonId } }
    val gi = remember(lessonId) { vm.lessonIndex(lessonId) }
    // Unlock gate: sequential chain OR enrolled-path unlock OR first
    // lesson of an open (incl. placement-opened) section (web parity).
    if (gi < 0 || !vm.isUnlocked(gi)) {
        Column(
            Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
        ) {
            Text("🔒", fontSize = 48.sp)
            Spacer(Modifier.height(8.dp))
            Text("This lesson is locked", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
            Text(
                "Finish the previous lessons in order — or enroll in a learning path that includes it to unlock it instantly.",
                color = TextMuted, fontSize = 14.sp
            )
            Spacer(Modifier.height(12.dp))
            Button(onClick = { nav.popBackStack() }) { Text("← Back") }
        }
        return
    }
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    // Randomized quiz: fresh 3-question pick from the 5-question bank, options shuffled (web parity).
    val quiz = remember(lessonId) { buildQuiz(lesson) }
    // quiz state per question: -1 unanswered, else chosen index; track first-try correctness
    val chosen = remember(lessonId) { mutableStateListOf(*IntArray(quiz.size) { -1 }.toTypedArray()) }
    val firstTryCorrect = remember(lessonId) { mutableStateListOf(*BooleanArray(quiz.size).toTypedArray()) }
    val attempts = remember(lessonId) { mutableStateListOf(*IntArray(quiz.size).toTypedArray()) }
    var challengeDone by remember(lessonId) { mutableStateOf(false) }
    var blankInput by remember(lessonId) { mutableStateOf("") }
    var blankWrong by remember(lessonId) { mutableStateOf(false) }
    var showCongrats by remember(lessonId) { mutableStateOf(false) }
    var congratsText by remember { mutableStateOf("") }

    val quizOk = quiz.indices.all { chosen[it] == quiz[it].answer }
    val canComplete = quizOk && challengeDone && !vm.isDone(lessonId)

    fun norm(s: String) = s.trim().lowercase()

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(top = 8.dp, start = 4.dp)) {
            IconButton(onClick = { nav.popBackStack() }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
        }
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
        ) {
            Text(lesson.title, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(4.dp))
            // Section / track chip (journey position, website learn parity)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val sec = vm.catalog.tracks.firstOrNull { it.id == lesson.section }
                if (sec != null) WebChip("${sec.icon} ${sec.name}")
                WebChip("Lesson ${gi + 1} of ${vm.catalog.lessons.size}")
                if (vm.isDone(lessonId)) WebChip("Done ✓", Success)
            }
            Spacer(Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { vm.toggleStar(lessonId) }) {
                    Text(if (lessonId in vm.starredLessons) "⭐ Starred" else "☆ Star", fontSize = 12.sp)
                }
                OutlinedButton(onClick = { vm.togglePin(lessonId) }) {
                    Text(if (lessonId in vm.pinnedLessons) "📌 Pinned" else "📍 Pin", fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(lesson.explain, color = TextMuted, fontSize = 14.sp)
            if (lesson.takeaways.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                lesson.takeaways.forEach { t -> Text("• $t", fontSize = 13.sp, modifier = Modifier.padding(vertical = 2.dp)) }
            }
            Spacer(Modifier.height(12.dp))
            CodeBlock(lesson.code)
            Spacer(Modifier.height(16.dp))

            Text("🧠 Quick quiz", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("Answer all correctly to proceed.", color = TextMuted, fontSize = 12.sp)
            quiz.forEachIndexed { qi, q ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Card),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Text(q.q, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Spacer(Modifier.height(8.dp))
                        q.options.forEachIndexed { oi, opt ->
                            val isAnswer = oi == q.answer
                            val picked = chosen[qi] == oi
                            val showState = picked || (chosen[qi] != -1 && isAnswer)
                            OutlinedButton(
                                onClick = {
                                    if (chosen[qi] == q.answer) return@OutlinedButton
                                    attempts[qi] = attempts[qi] + 1
                                    if (oi == q.answer && attempts[qi] == 1) firstTryCorrect[qi] = true
                                    chosen[qi] = oi
                                },
                                enabled = chosen[qi] != q.answer,
                                colors = ButtonDefaults.outlinedButtonColors(
                                    containerColor = when {
                                        showState && isAnswer -> Success.copy(alpha = 0.18f)
                                        picked && !isAnswer -> Danger.copy(alpha = 0.15f)
                                        else -> Card
                                    }
                                ),
                                modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)
                            ) {
                                Text(
                                    "${if (showState && isAnswer) "✅ " else if (picked) "❌ " else ""}$opt",
                                    modifier = Modifier.fillMaxWidth(),
                                    fontSize = 13.sp
                                )
                            }
                        }
                        if (chosen[qi] == q.answer && q.why.isNotEmpty()) {
                            Text(q.why, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
                        }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            Text("💪 Challenge", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text(lesson.challenge.prompt, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    lesson.challenge.code?.let {
                        Spacer(Modifier.height(8.dp))
                        CodeBlock(it)
                    }
                    Spacer(Modifier.height(8.dp))
                    if (lesson.challenge.type == "predict") {
                        lesson.challenge.options.forEachIndexed { oi, opt ->
                            OutlinedButton(
                                onClick = {
                                    if (oi == lesson.challenge.answerIndex) {
                                        challengeDone = true
                                        scope.launch { snackbar.showSnackbar("✅ Correct — challenge smashed!") }
                                    } else {
                                        scope.launch { snackbar.showSnackbar("❌ Nope — think again!") }
                                    }
                                },
                                enabled = !challengeDone,
                                colors = ButtonDefaults.outlinedButtonColors(
                                    containerColor = if (challengeDone && oi == lesson.challenge.answerIndex)
                                        Success.copy(alpha = 0.18f) else Card
                                ),
                                modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)
                            ) { Text(opt, modifier = Modifier.fillMaxWidth(), fontSize = 13.sp) }
                        }
                    } else {
                        OutlinedTextField(
                            value = blankInput,
                            onValueChange = { blankInput = it; blankWrong = false },
                            label = { Text("Your answer") },
                            singleLine = true,
                            enabled = !challengeDone,
                            isError = blankWrong,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = {
                                    val ok = lesson.challenge.answers.any { norm(it) == norm(blankInput) }
                                    if (ok) {
                                        challengeDone = true
                                        scope.launch { snackbar.showSnackbar("✅ Correct — challenge smashed!") }
                                    } else blankWrong = true
                                },
                                enabled = !challengeDone
                            ) { Text("Check") }
                        }
                        if (blankWrong) Text("❌ Not quite — check the hint if you're stuck.", color = Danger, fontSize = 12.sp)
                    }
                    lesson.challenge.hint?.let {
                        Text("💡 Hint: $it", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                    }
                    if (challengeDone) Text("✅ Challenge complete", color = Success, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
                }
            }

            Spacer(Modifier.height(12.dp))
            Button(
                onClick = {
                    val firstTries = firstTryCorrect.count { it }
                    val (gain, leveledUp) = vm.completeLesson(lessonId, firstTries)
                    congratsText = if (leveledUp)
                        "🎉 LEVEL UP! You are now ${vm.currentLevel().name} (+$gain XP)"
                    else "🎉 Lesson complete! +$gain XP"
                    showCongrats = true
                },
                enabled = canComplete,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                Text(if (vm.isDone(lessonId)) "✅ Completed" else "🎉 Complete lesson · +XP", fontSize = 15.sp)
            }
            Spacer(Modifier.height(24.dp))
        }
        SnackbarHost(snackbar, Modifier.padding(16.dp))
    }

    if (showCongrats) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = {},
            confirmButton = {
                Button(onClick = {
                    showCongrats = false
                    nav.popBackStack()
                }) { Text("Continue") }
            },
            title = { Text("🎉") },
            text = { Text(congratsText, fontSize = 16.sp) }
        )
        // auto-dismiss like the web's confetti timing
        androidx.compose.runtime.LaunchedEffect(Unit) {
            delay(1600)
            if (showCongrats) { showCongrats = false; nav.popBackStack() }
        }
    }
}
