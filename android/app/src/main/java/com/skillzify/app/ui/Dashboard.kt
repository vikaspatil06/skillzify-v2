package com.skillzify.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.skillzify.app.AppViewModel
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun DashboardTab(vm: AppViewModel) {
    val user by vm.firebaseUser.collectAsStateWithLifecycle()
    val level = vm.currentLevel()
    val next = vm.nextLevelInfo()
    val fmt = SimpleDateFormat("d MMM, HH:mm", Locale.getDefault())

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // User header
        Card(
            colors = CardDefaults.cardColors(containerColor = Card),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("👤", fontSize = 32.sp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        user?.displayName?.takeIf { it.isNotBlank() } ?: "Learner",
                        fontWeight = FontWeight.Bold, fontSize = 16.sp
                    )
                    Text(user?.email ?: "", color = TextMuted, fontSize = 12.sp)
                }
                Button(
                    onClick = { vm.logout() },
                    colors = ButtonDefaults.buttonColors(containerColor = Danger.copy(alpha = 0.15f)),
                ) { Text("Logout", color = Danger, fontSize = 13.sp) }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            StatCard("⚡", "${vm.xp}", "Total XP", Modifier.weight(1f))
            StatCard("🔥", "${vm.streak}", "Day streak", Modifier.weight(1f))
            StatCard(
                "🏅",
                "${vm.doneIds.size}/${vm.catalog.lessons.size}",
                "Lessons",
                Modifier.weight(1f)
            )
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = Card),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(18.dp)) {
                Text("Current level", color = TextMuted, fontSize = 12.sp)
                Text(level.name, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
                if (next != null) {
                    Spacer(Modifier.height(8.dp))
                    val frac = (vm.xp - level.xp).toFloat() / (next.xp - level.xp).coerceAtLeast(1).toFloat()
                    LinearProgressIndicator(
                        progress = { frac.coerceIn(0f, 1f) },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(99.dp))
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "${next.xp - vm.xp} XP to ${next.name}",
                        color = TextMuted, fontSize = 12.sp
                    )
                } else {
                    Text("Max level reached! 🏆", color = Warning, fontSize = 13.sp)
                }
            }
        }

        Text("📊 Track progress", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        vm.catalog.tracks.forEach { t ->
            val pct = vm.trackProgress(t.id)
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(14.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("${t.icon} ${t.name}", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text("$pct%", color = TextMuted, fontSize = 13.sp)
                    }
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { pct / 100f },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(99.dp))
                    )
                }
            }
        }

        if (vm.runs.isNotEmpty()) {
            Text("🕘 Recent runs", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(14.dp)) {
                    vm.runs.take(10).forEach { run ->
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                run.codePreview.ifEmpty { "(empty)" },
                                fontFamily = FontFamily.Monospace, fontSize = 12.sp,
                                modifier = Modifier.weight(1f).padding(end = 8.dp),
                                maxLines = 1
                            )
                            Text(
                                (if (run.ok) "✅ " else "❌ ") + fmt.format(Date(run.timestamp)),
                                fontSize = 12.sp, color = TextMuted
                            )
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun StatCard(emoji: String, big: String, label: String, modifier: Modifier = Modifier) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Card),
        modifier = modifier
    ) {
        Column(
            Modifier.padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(emoji, fontSize = 22.sp)
            Text(big, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
            Text(label, color = TextMuted, fontSize = 11.sp)
        }
    }
}
