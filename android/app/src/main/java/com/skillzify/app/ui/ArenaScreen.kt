package com.skillzify.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Leaderboard
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.ui.theme.Primary
import com.skillzify.app.ui.theme.TextMuted

/* App 2.0 Phase A3 — the Arena hub. Arena groups everything competitive
 * and social: Practice, the Placement Test, Community, the AI Interview
 * Studio and the Leaderboard (Phase B).
 *
 * Card discipline (Vikas's rule, carried from the website): cards in a
 * row are the SAME SIZE — fixed height, equal weights, action/title
 * layout identical per card. */
@Composable
fun ArenaScreen(vm: AppViewModel, nav: NavController) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        ScreenHeader(
            "Arena",
            "Practice, compete and prove it — drills, placement and the community in one place."
        )
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ArenaCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.FitnessCenter,
                title = "Practice",
                sub = "150 exercises — predict, fix and code",
                onClick = { nav.navigate("practice") }
            )
            ArenaCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.EmojiEvents,
                title = "Placement Test",
                sub = "Timed stages with a readiness score",
                onClick = { nav.navigate("placement") }
            )
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ArenaCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.People,
                title = "Community",
                sub = "Ask, answer and showcase your work",
                onClick = { nav.navigate("community") }
            )
            ArenaCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.Psychology,
                title = "AI Interview",
                sub = "Voice-first mock interviews with scoring",
                onClick = { nav.navigate("interview") }
            )
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ArenaCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.Leaderboard,
                title = "Leaderboard",
                sub = "XP leagues — the same board as the website",
                onClick = { nav.navigate("leaderboard") }
            )
            Spacer(Modifier.weight(1f))
        }
    }
}

@Composable
private fun ArenaCard(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    title: String,
    sub: String,
    soon: Boolean = false,
    onClick: (() -> Unit)? = null
) {
    WebCard(modifier = modifier.height(128.dp), onClick = if (soon) null else onClick) {
        Column(Modifier.padding(12.dp)) {
            Row {
                Icon(icon, contentDescription = title, tint = Primary)
                Spacer(Modifier.weight(1f))
                if (soon) WebChip("Phase B")
            }
            Spacer(Modifier.height(8.dp))
            Text(
                title,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(Modifier.height(3.dp))
            Text(sub, color = TextMuted, fontSize = 12.sp, lineHeight = 17.sp)
        }
    }
}
