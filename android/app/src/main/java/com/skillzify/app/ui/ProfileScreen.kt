package com.skillzify.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.ui.theme.ACCENTS
import com.skillzify.app.ui.theme.BgSoft
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.GradientBrush
import com.skillzify.app.ui.theme.TextMuted

/* "You" — website profile.html (Profile + Dashboard + certificates live
   here in the web's You menu). Avatar initial, name/bio edit (the VM's
   existing profile functions), level + XP progress, streak stats,
   achievements count, theme picker, and links to
   Passport / Concept Map / Placement / Community / Library.
   The 🛡️ Admin row renders ONLY when vm.isAdminConfirmed is true —
   i.e. the server itself returned 200 for /api/admin/overview with
   this user's verified token (same rule as the web nav's admin link).
   Never keyed off the email string. */
@Composable
fun ProfileScreen(vm: AppViewModel, nav: NavController) {
    val user by vm.firebaseUser.collectAsStateWithLifecycle()
    val level = vm.currentLevel()
    val next = vm.nextLevelInfo()
    var editingProfile by remember { mutableStateOf(false) }
    var editName by remember { mutableStateOf("") }
    var editBio by remember { mutableStateOf("") }
    val achievements = vm.achievements()
    val unlockedCount = achievements.count { it.unlocked }
    val name = vm.profileName().ifBlank { user?.displayName ?: "Learner" }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // ---- Profile head (web .profile-head) ----
        WebCard {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(58.dp).clip(CircleShape).background(GradientBrush),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        name.trim().firstOrNull()?.uppercase() ?: "L",
                        color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(name, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Text(
                        vm.profileBio().ifBlank { "Add a bio so future-you remembers why you started." },
                        color = TextMuted, fontSize = 13.sp
                    )
                    Text(user?.email ?: "", color = TextMuted, fontSize = 12.sp)
                    Row(
                        Modifier.padding(top = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        WebChip("⚡ ${level.name}")
                        WebChip("☁️ ${vm.syncStatus}")
                    }
                }
            }
            Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 14.dp)) {
                OutlinedButton(onClick = {
                    editName = vm.profileName()
                    editBio = vm.profileBio()
                    editingProfile = true
                }) { Text("Edit profile", fontSize = 13.sp, maxLines = 1) }
            }
        }
        if (editingProfile) {
            AlertDialog(
                onDismissRequest = { editingProfile = false },
                title = { Text("Edit profile") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = editName, onValueChange = { editName = it },
                            label = { Text("Display name") }, singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = editBio, onValueChange = { editBio = it },
                            label = { Text("Bio") }, modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        vm.saveProfile(editName, editBio)
                        editingProfile = false
                    }) { Text("Save", maxLines = 1) }
                },
                dismissButton = {
                    OutlinedButton(onClick = { editingProfile = false }) { Text("Cancel", maxLines = 1) }
                }
            )
        }

        // ---- Level + XP / streak stats ----
        WebCard {
            Column(Modifier.padding(16.dp)) {
                Text("⚡ Level", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Text(level.name, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(top = 4.dp))
                if (next != null) {
                    val frac = (vm.xp - level.xp).toFloat() / (next.xp - level.xp).coerceAtLeast(1).toFloat()
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { frac.coerceIn(0f, 1f) },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(99.dp))
                    )
                    Text("${next.xp - vm.xp} XP to ${next.name} · ${vm.xp} XP total",
                        color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
                } else {
                    Text("Max level reached! 🏆 · ${vm.xp} XP total", color = TextMuted, fontSize = 12.sp)
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    MiniStat("🔥 ${vm.currentStreak()}", "Day streak", Modifier.weight(1f))
                    MiniStat("🏆 ${vm.store.getLongestStreak()}", "Longest streak", Modifier.weight(1f))
                    MiniStat("📚 ${vm.doneIds.size}", "Lessons done", Modifier.weight(1f))
                }
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    MiniStat("🏋️ ${vm.solvedExerciseCount()}", "Exercises solved", Modifier.weight(1f))
                    MiniStat("▶️ ${vm.store.getRunCount()}", "Code runs", Modifier.weight(1f))
                    MiniStat("🏆 $unlockedCount/${achievements.size}", "Achievements", Modifier.weight(1f))
                }
            }
        }

        // ---- Explore links ----
        Text("Explore", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        LinkRow("🎓", "Skill Passport", "Certificates, achievements and your public record") {
            nav.navigate("passport")
        }
        LinkRow("🗺️", "Concept Map", "The whole journey, coloured by your progress") {
            nav.navigate("map")
        }
        LinkRow("🎯", "Placement Test",
            vm.placement?.let { "Placed: ${it.section} · ${it.score}/${it.total}" }
                ?: "Find your starting section in ~3 minutes") {
            nav.navigate("placement")
        }
        LinkRow("🤝", "Community", "Ask questions, answer, showcase what you built") {
            nav.navigate("community")
        }
        LinkRow("📚", "Library", "Paths, projects, reference and the Flowchart Lab") {
            nav.navigate("library")
        }
        if (vm.isAdminConfirmed) {
            LinkRow("🛡️", "Admin", "Server health, AI usage, plan and community — admins only") {
                nav.navigate("admin")
            }
        }

        // ---- Theme picker (website parity: dark/light + 6 accents) ----
        WebCard {
            Column(Modifier.padding(16.dp)) {
                Text("🎨 Theme", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { vm.setTheme(true, vm.themeAccent) },
                        modifier = Modifier.weight(1f)
                    ) { Text(if (vm.themeDark) "🌙 Dark ✓" else "🌙 Dark", fontSize = 13.sp, maxLines = 1) }
                    OutlinedButton(
                        onClick = { vm.setTheme(false, vm.themeAccent) },
                        modifier = Modifier.weight(1f)
                    ) { Text(if (!vm.themeDark) "☀️ Light ✓" else "☀️ Light", fontSize = 13.sp, maxLines = 1) }
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ACCENTS.forEachIndexed { i, a ->
                        Box(
                            Modifier.size(36.dp)
                                .clip(CircleShape)
                                .background(a.primary)
                                .border(
                                    width = if (i == vm.themeAccent) 3.dp else 0.dp,
                                    color = if (i == vm.themeAccent) androidx.compose.material3.MaterialTheme.colorScheme.onSurface
                                        else Color.Transparent,
                                    shape = CircleShape
                                )
                                .clickable { vm.setTheme(vm.themeDark, i) },
                            contentAlignment = Alignment.Center
                        ) {
                            if (i == vm.themeAccent) Text("✓", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(ACCENTS[vm.themeAccent].name, color = TextMuted, fontSize = 12.sp)
            }
        }

        // ---- Sign out ----
        Button(
            onClick = { vm.logout() },
            colors = ButtonDefaults.buttonColors(containerColor = Danger.copy(alpha = 0.15f)),
            modifier = Modifier.fillMaxWidth()
        ) { Text("Logout", color = Danger, fontSize = 14.sp, maxLines = 1) }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun MiniStat(big: String, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier.clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
            .background(BgSoft).padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(big, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center)
        Text(label, color = TextMuted, fontSize = 10.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun LinkRow(icon: String, title: String, sub: String, onClick: () -> Unit) {
    WebCard(onClick = onClick) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(icon, fontSize = 22.sp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                Text(sub, color = TextMuted, fontSize = 12.sp)
            }
            Text("→", color = TextMuted, fontSize = 16.sp)
        }
    }
}
