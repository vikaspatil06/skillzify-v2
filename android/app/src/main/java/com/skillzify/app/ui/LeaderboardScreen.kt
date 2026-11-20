package com.skillzify.app.ui

import androidx.compose.foundation.border
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.LeaderboardRepository
import com.skillzify.app.data.leagueForLevel
import com.skillzify.app.ui.designsystem.Density
import com.skillzify.app.ui.designsystem.heading
import com.skillzify.app.ui.theme.Primary
import com.skillzify.app.ui.theme.TextMuted

/* App 2.0 Phase B — the Leaderboard (website parity, Arena).
 *
 * Reads the same publicProfiles collection the website's leaderboard
 * reads — real learners only, ranked by XP, top 50. The signed-in
 * learner's own profile is published by AppViewModel after each
 * successful sync, so the app and the website share ONE board.
 *
 * Leagues (v1): XP bands over the level ladder — Bronze (levels
 * 1-3), Silver (4-6), Gold (7-9), Diamond (10-11) — shown as your
 * current league plus the XP gap to the next one. Kinder framing
 * throughout: the board celebrates progress, it never shames a rank. */
@Composable
fun LeaderboardScreen(vm: AppViewModel, nav: NavController) {
    val user by vm.firebaseUser.collectAsStateWithLifecycle()
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var rows by remember { mutableStateOf<List<LeaderboardRepository.LeaderRow>>(emptyList()) }
    var reloadKey by remember { mutableStateOf(0) }

    LaunchedEffect(reloadKey) {
        loading = true
        error = null
        LeaderboardRepository.fetchTop()
            .onSuccess { rows = it }
            .onFailure { error = "The leaderboard could not be loaded. Check your connection and try again." }
        loading = false
    }

    val levels = vm.catalog.levels
    fun levelIndexFor(xp: Long): Int =
        levels.count { xp >= it.xp.toLong() } - 1
    fun levelNameFor(xp: Long): String =
        levels.getOrNull(levelIndexFor(xp))?.name ?: ""

    val myUid = user?.uid
    val myRank = rows.indexOfFirst { it.uid == myUid }
    val myLevelIdx = levelIndexFor(vm.xp.toLong())
    val myLeague = leagueForLevel(myLevelIdx)
    // Next league starts at level index 3 / 6 / 9 (Silver/Gold/Diamond).
    val nextLeagueStart = when {
        myLevelIdx <= 2 -> 3
        myLevelIdx <= 5 -> 6
        myLevelIdx <= 8 -> 9
        else -> -1
    }
    val xpToNextLeague = if (nextLeagueStart in levels.indices) {
        (levels[nextLeagueStart].xp - vm.xp).coerceAtLeast(0)
    } else 0

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(Density.screen)
    ) {
        ScreenHeader(
            "Leaderboard",
            "Top learners by XP — the same board as the website.",
            onBack = { nav.popBackStack() }
        )
        Spacer(Modifier.height(Density.gapLg))

        // Your league card.
        WebCard {
            Column(Modifier.padding(Density.cardPadding)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "🏆 $myLeague",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    if (myRank >= 0) {
                        WebChip("You · #${myRank + 1}")
                    }
                }
                Spacer(Modifier.height(Density.gapXs))
                Text(
                    when {
                        user == null ->
                            "Sign in (Profile tab) and sync once to join the board."
                        myRank >= 0 && nextLeagueStart > 0 ->
                            "$xpToNextLeague XP to the next league — every lesson counts."
                        myRank >= 0 ->
                            "Top league — remarkable. Keep the streak kind and steady."
                        else ->
                            "You're not on the board yet — it updates after your next sync."
                    },
                    color = TextMuted, fontSize = 12.sp
                )
            }
        }
        Spacer(Modifier.height(Density.gapLg))

        when {
            loading -> {
                Column(
                    Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    CircularProgressIndicator()
                    Spacer(Modifier.height(Density.gapMd))
                    Text("Loading the board…", color = TextMuted, fontSize = 13.sp)
                }
            }
            error != null -> {
                WebCard {
                    Column(Modifier.padding(Density.cardPadding)) {
                        Text(error!!, fontSize = 14.sp)
                        Spacer(Modifier.height(Density.gapMd))
                        OutlinedButton(onClick = { reloadKey++ }) {
                            Text("Try again", fontSize = 13.sp)
                        }
                    }
                }
            }
            rows.isEmpty() -> {
                WebCard {
                    Column(Modifier.padding(Density.cardPadding)) {
                        Text(
                            "No public profiles yet.",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.heading()
                        )
                        Spacer(Modifier.height(Density.gapXs))
                        Text(
                            "Be the first on the board — sign in and sync, and your XP appears here and on the website.",
                            color = TextMuted, fontSize = 13.sp
                        )
                    }
                }
            }
            else -> {
                rows.forEachIndexed { i, row ->
                    val mine = row.uid == myUid
                    WebCard(
                        modifier = if (mine) {
                            Modifier.border(1.5.dp, Primary, RoundedCornerShape(16.dp))
                        } else Modifier
                    ) {
                        Row(
                            Modifier.padding(Density.cardPadding),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                when (i) {
                                    0 -> "🥇"
                                    1 -> "🥈"
                                    2 -> "🥉"
                                    else -> "${i + 1}"
                                },
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(end = Density.gapMd)
                            )
                            Column(Modifier.weight(1f)) {
                                Text(
                                    row.name + if (mine) " (You)" else "",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1
                                )
                                Text(
                                    "${levelNameFor(row.xp)} · ${row.lessonsDone} lessons · 🔥 ${row.streak}",
                                    color = TextMuted, fontSize = 12.sp, maxLines = 1
                                )
                            }
                            Text(
                                "⚡ ${row.xp}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(Modifier.height(Density.gapSm))
                }
                Text(
                    "Ranks update as learners sync. Your public profile is written when you sync while signed in — the same profile the website's leaderboard and Skill Passport use.",
                    color = TextMuted, fontSize = 12.sp
                )
            }
        }
    }
}
