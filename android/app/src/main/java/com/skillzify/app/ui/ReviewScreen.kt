package com.skillzify.app.ui

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
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.ui.designsystem.Density
import com.skillzify.app.ui.designsystem.MasteryRing
import com.skillzify.app.ui.designsystem.heading
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/* App 2.0 Phase B — Review session (spaced repetition, web parity).
 *
 * Due lessons re-ask their challenge: recall it right and the next
 * review moves further out (1 -> 3 -> 7 -> 14 -> 30 -> 60 days);
 * miss it and the lesson comes back tomorrow. Reviews are what lift
 * section mastery past the 70% never-reviewed ceiling — the schedule
 * itself is the website's exact shape and syncs both ways, so a
 * review done here moves the same schedule on the web.
 *
 * Judging mirrors LessonDetail: predict = the option index, blank =
 * trimmed lowercase compare against the accepted answers. */
@Composable
fun ReviewScreen(vm: AppViewModel, nav: NavController) {
    val queue = remember { vm.dueReviewLessons() }
    var index by remember { mutableStateOf(0) }
    var selected by remember { mutableStateOf(-1) }
    var blank by remember { mutableStateOf("") }
    var judged by remember { mutableStateOf<Boolean?>(null) }
    var correctCount by remember { mutableStateOf(0) }
    var finished by remember { mutableStateOf(queue.isEmpty()) }

    fun judge(correct: Boolean) {
        if (judged != null) return
        judged = correct
        if (correct) correctCount++
        vm.recordReviewOutcome(queue[index].id, correct)
    }

    fun next() {
        if (index >= queue.size - 1) {
            finished = true
        } else {
            index++
            selected = -1
            blank = ""
            judged = null
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(Density.screen)
    ) {
        ScreenHeader(
            "Reviews",
            "Short recalls that keep what you learned — and lift your mastery.",
            onBack = { nav.popBackStack() }
        )
        Spacer(Modifier.height(Density.gapLg))

        when {
            queue.isEmpty() -> {
                val nextDue = vm.nextReviewDue()
                WebCard {
                    Column(Modifier.padding(Density.cardPadding)) {
                        Text(
                            "✅ All caught up",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.heading()
                        )
                        Spacer(Modifier.height(Density.gapXs))
                        Text(
                            if (nextDue != null) {
                                "No reviews are due right now. Your next one arrives " +
                                    SimpleDateFormat("EEE, d MMM", Locale.US).format(Date(nextDue)) +
                                    " — mastery grows when you recall on schedule."
                            } else {
                                "Complete any lesson and its first review will be scheduled for tomorrow."
                            },
                            color = TextMuted, fontSize = 13.sp
                        )
                    }
                }
            }

            finished -> {
                val total = queue.size
                WebCard {
                    Column(
                        Modifier.padding(Density.cardPadding),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        MasteryRing(
                            progress = if (total == 0) 0f else correctCount.toFloat() / total,
                            size = 84.dp,
                            label = "$correctCount/$total"
                        )
                        Spacer(Modifier.height(Density.gapMd))
                        Text(
                            "Session complete",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.heading()
                        )
                        Spacer(Modifier.height(Density.gapXs))
                        Text(
                            "You recalled $correctCount of $total. Correct recalls push the next review further out; the ones you missed come back tomorrow — that's the system working, not failing.",
                            color = TextMuted, fontSize = 13.sp
                        )
                    }
                }
                Spacer(Modifier.height(Density.gapLg))
                GradientButton("Done", Modifier.fillMaxWidth()) { nav.popBackStack() }
            }

            else -> {
                val lesson = queue[index]
                val ch = lesson.challenge
                val sectionName = vm.catalog.tracks
                    .firstOrNull { it.id == lesson.section }?.name ?: lesson.section
                Text(
                    "Review ${index + 1} of ${queue.size}",
                    color = TextMuted, fontSize = 12.sp
                )
                Spacer(Modifier.height(Density.gapSm))
                LinearProgressIndicator(
                    progress = { (index.toFloat() / queue.size).coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(Density.gapLg))
                WebCard {
                    Column(Modifier.padding(Density.cardPadding)) {
                        WebChip(sectionName)
                        Spacer(Modifier.height(Density.gapSm))
                        Text(
                            lesson.title,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.heading()
                        )
                        Spacer(Modifier.height(Density.gapSm))
                        Text(ch.prompt, fontSize = 14.sp)
                        if (!ch.code.isNullOrBlank()) {
                            Spacer(Modifier.height(Density.gapMd))
                            CodeBlock(ch.code)
                        }
                        Spacer(Modifier.height(Density.gapMd))

                        if (ch.type == "predict") {
                            ch.options.forEachIndexed { oi, opt ->
                                val isAnswer = oi == ch.answerIndex
                                val isPicked = oi == selected
                                OutlinedButton(
                                    onClick = {
                                        selected = oi
                                        judge(isAnswer)
                                    },
                                    enabled = judged == null,
                                    colors = ButtonDefaults.outlinedButtonColors(
                                        containerColor = when {
                                            judged != null && isAnswer -> Success.copy(alpha = 0.18f)
                                            judged != null && isPicked -> Danger.copy(alpha = 0.15f)
                                            else -> Card
                                        }
                                    ),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 3.dp)
                                ) {
                                    Text(opt, fontSize = 13.sp, modifier = Modifier.fillMaxWidth())
                                }
                            }
                        } else {
                            OutlinedTextField(
                                value = blank,
                                onValueChange = { blank = it },
                                label = { Text("Your answer") },
                                singleLine = true,
                                enabled = judged == null,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(Modifier.height(Density.gapMd))
                            Button(
                                onClick = {
                                    val norm = { s: String -> s.trim().lowercase() }
                                    judge(ch.answers.any { norm(it) == norm(blank) })
                                },
                                enabled = judged == null && blank.isNotBlank()
                            ) { Text("Check") }
                        }

                        if (ch.hint != null && judged == null) {
                            Spacer(Modifier.height(Density.gapMd))
                            Text("💡 Hint: ${ch.hint}", color = TextMuted, fontSize = 12.sp)
                        }

                        if (judged != null) {
                            Spacer(Modifier.height(Density.gapMd))
                            if (judged == true) {
                                Text(
                                    "✅ Recalled — this review moves further out.",
                                    color = Success, fontSize = 13.sp, fontWeight = FontWeight.Bold
                                )
                            } else {
                                Text(
                                    "❌ Not this time — it comes back tomorrow, while it's fresh.",
                                    color = Danger, fontSize = 13.sp, fontWeight = FontWeight.Bold
                                )
                                if (ch.type == "predict") {
                                    Spacer(Modifier.height(Density.gapXs))
                                    Text(
                                        "Correct answer: ${ch.options.getOrNull(ch.answerIndex) ?: ""}",
                                        fontSize = 13.sp
                                    )
                                } else if (ch.answers.isNotEmpty()) {
                                    Spacer(Modifier.height(Density.gapXs))
                                    Text(
                                        "Correct answer: ${ch.answers.first()}",
                                        fontSize = 13.sp
                                    )
                                }
                            }
                            Spacer(Modifier.height(Density.gapMd))
                            GradientButton(
                                text = if (index >= queue.size - 1) "Finish" else "Next review",
                                modifier = Modifier.fillMaxWidth()
                            ) { next() }
                        }
                    }
                }
                Spacer(Modifier.height(Density.gapMd))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Reviews reschedule automatically — nothing to set up.",
                        color = TextMuted, fontSize = 12.sp,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedButton(onClick = { nav.navigate("lesson/${lesson.id}") }) {
                        Text("Revisit lesson", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
