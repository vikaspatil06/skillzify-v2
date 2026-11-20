package com.skillzify.app.ui

import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.ui.designsystem.Density
import com.skillzify.app.ui.designsystem.MasteryRing
import com.skillzify.app.ui.designsystem.WeekGoalBar
import com.skillzify.app.ui.designsystem.heading
import com.skillzify.app.ui.theme.Primary
import com.skillzify.app.ui.theme.TextMuted
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/* App 2.0 Phase B — the Today screen (replaces the Dashboard tab's
 * content; Dashboard.kt remains in the tree as the fallback).
 *
 * Built to the Phase B design rule: COMPACT but ACCESSIBLE.
 * Compression: Density spacing, combined stat/level card, one-line
 * secondary text. Accessibility: heading semantics on every section
 * title, spoken equivalents on the week bar / mastery rings / level
 * progress, every tap target >= 48dp (full-width cards and rows),
 * text >= 12sp and system-scalable throughout.
 *
 * Content order = the Daily Coach's logic, minus the AI (Phase C):
 * where you are this week -> the single next lesson -> your numbers
 * -> what needs picking back up -> today's challenge. */
@Composable
fun TodayScreen(vm: AppViewModel, nav: NavController) {
    val user by vm.firebaseUser.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.refreshAiAndAdmin() }

    val name = vm.profileName()
        .ifBlank { user?.displayName ?: "Learner" }
        .split(" ").first()
    val hour = remember { Calendar.getInstance().get(Calendar.HOUR_OF_DAY) }
    val greeting = when (hour) {
        in 5..11 -> "Good morning"
        in 12..16 -> "Good afternoon"
        in 17..21 -> "Good evening"
        else -> "Ready when you are"
    }
    val level = vm.currentLevel()
    val next = vm.nextLevelInfo()
    val activeDays = vm.store.activeDays()
    val weekActive = remember(activeDays) { currentWeekActiveDays(activeDays) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(Density.screen)
    ) {
        Text(
            "$greeting, $name",
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.heading()
        )
        Text(
            "One small step today is enough.",
            color = TextMuted, fontSize = 13.sp
        )
        Spacer(Modifier.height(Density.gapLg))

        // This week (kinder-streak framing) + streak.
        WebCard {
            Column(Modifier.padding(Density.cardPadding)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("This week", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.weight(1f))
                    Text(
                        "🔥 ${vm.currentStreak()} day streak",
                        color = TextMuted, fontSize = 12.sp
                    )
                }
                Spacer(Modifier.height(Density.gapMd))
                WeekGoalBar(weekActive)
            }
        }

        // Reviews due (Phase B) — the day's highest-value minutes.
        val dueCount = vm.dueReviewCount()
        if (dueCount > 0) {
            Spacer(Modifier.height(Density.gapLg))
            WebCard(onClick = { nav.navigate("review") }) {
                Row(
                    Modifier.padding(Density.cardPadding),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("🔁 Reviews due", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text(
                            "$dueCount lesson${if (dueCount == 1) "" else "s"} waiting — a few minutes of recall keeps your mastery climbing.",
                            color = TextMuted, fontSize = 12.sp
                        )
                    }
                    Text(
                        "Start →",
                        color = Primary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // Continue learning — the one next thing.
        val upNext = vm.upNextLesson()
        if (upNext != null) {
            val sectionName = vm.catalog.tracks
                .firstOrNull { it.id == upNext.section }?.name ?: upNext.section
            Spacer(Modifier.height(Density.gapLg))
            WebCard(onClick = { nav.navigate("lesson/${upNext.id}") }) {
                Column(Modifier.padding(Density.cardPadding)) {
                    WebChip("Continue learning")
                    Spacer(Modifier.height(Density.gapSm))
                    Text(
                        upNext.title,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 2
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "Lesson ${vm.lessonIndex(upNext.id) + 1} of " +
                            "${vm.catalog.lessons.size} · $sectionName",
                        color = TextMuted, fontSize = 12.sp
                    )
                }
            }
        }

        // Numbers + level progress, one combined compact card.
        Spacer(Modifier.height(Density.gapLg))
        WebCard {
            Column(Modifier.padding(Density.cardPadding)) {
                Row {
                    TodayStat("⚡ ${vm.xp}", "Total XP", Modifier.weight(1f))
                    TodayStat(
                        "🏅 ${vm.doneIds.size}/${vm.catalog.lessons.size}",
                        "Lessons", Modifier.weight(1f)
                    )
                    TodayStat(
                        "🏋️ ${vm.solvedExerciseCount()}/${vm.exercises.size}",
                        "Exercises", Modifier.weight(1f)
                    )
                }
                if (next != null) {
                    val frac = (vm.xp - level.xp).toFloat() /
                        (next.xp - level.xp).coerceAtLeast(1).toFloat()
                    Spacer(Modifier.height(Density.gapMd))
                    LinearProgressIndicator(
                        progress = { frac.coerceIn(0f, 1f) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .semantics {
                                progressBarRangeInfo =
                                    ProgressBarRangeInfo(frac.coerceIn(0f, 1f), 0f..1f)
                            }
                    )
                    Spacer(Modifier.height(Density.gapXs))
                    Text(
                        "${level.name} · ${next.xp - vm.xp} XP to ${next.name}",
                        color = TextMuted, fontSize = 12.sp
                    )
                }
            }
        }

        // Section mastery rings.
        val sections = try { vm.sectionMastery() } catch (e: Exception) { emptyList() }
        if (sections.isNotEmpty()) {
            Spacer(Modifier.height(Density.gapLg))
            Text(
                "Your sections",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.heading()
            )
            Spacer(Modifier.height(Density.gapMd))
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(Density.gapLg)
            ) {
                sections.forEach { s ->
                    val trackName = vm.catalog.tracks
                        .firstOrNull { it.id == s.sectionId }?.name ?: s.sectionId
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        MasteryRing(
                            progress = s.score / 100f,
                            size = 54.dp,
                            label = "${s.score}"
                        )
                        Spacer(Modifier.height(Density.gapXs))
                        Text(trackName, fontSize = 12.sp, maxLines = 1)
                        Text(
                            "${s.doneCount}/${s.totalCount} lessons",
                            color = TextMuted, fontSize = 12.sp, maxLines = 1
                        )
                    }
                }
            }
        }

        // Pick back up — attempted but unsolved (the review queue v0;
        // the full spaced-review system is a later Phase B item).
        val queue = vm.revisionQueue()
        if (queue.isNotEmpty()) {
            Spacer(Modifier.height(Density.gapLg))
            Text(
                "Pick back up",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.heading()
            )
            Spacer(Modifier.height(Density.gapMd))
            queue.forEach { ex ->
                WebCard(onClick = { nav.navigate("exercise/${ex.id}") }) {
                    Row(
                        Modifier.padding(Density.cardPadding),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                ex.title,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1
                            )
                            Text(
                                "${ex.topic} · ${ex.kind}",
                                color = TextMuted, fontSize = 12.sp, maxLines = 1
                            )
                        }
                        Text(
                            "Retry →",
                            color = Primary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
                Spacer(Modifier.height(Density.gapSm))
            }
        }

        // Daily challenge.
        val daily = vm.dailyChallenge()
        if (daily != null) {
            Spacer(Modifier.height(Density.gapSm))
            WebCard(onClick = { nav.navigate("exercise/${daily.id}") }) {
                Row(
                    Modifier.padding(Density.cardPadding),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        WebChip("Daily challenge")
                        Spacer(Modifier.height(Density.gapXs))
                        Text(
                            daily.title,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1
                        )
                    }
                    Text(
                        if (vm.getAttempt(daily.id).solved) "Play again →" else "Start →",
                        color = Primary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // Sync status (parity with the old Dashboard).
        Spacer(Modifier.height(Density.gapMd))
        TextButton(
            onClick = { vm.refreshSync() },
            enabled = !vm.syncRefreshing
        ) {
            Text(if (vm.syncRefreshing) "Syncing…" else "☁️ ${vm.syncStatus}", fontSize = 13.sp)
        }
    }
}

@Composable
private fun TodayStat(value: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(value, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        Text(label, color = TextMuted, fontSize = 12.sp, maxLines = 1)
    }
}

/** Indices (0 = Monday .. 6 = Sunday) of the CURRENT week present in
    the active-days set (yyyy-MM-dd strings, Store.activeDays). */
private fun currentWeekActiveDays(active: Set<String>): Set<Int> {
    val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    val cal = Calendar.getInstance()
    cal.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
    val out = mutableSetOf<Int>()
    for (i in 0..6) {
        if (fmt.format(cal.time) in active) out += i
        cal.add(Calendar.DAY_OF_YEAR, 1)
    }
    return out
}
