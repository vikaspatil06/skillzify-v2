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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.skillzify.app.AppViewModel
import com.skillzify.app.ui.theme.BgSoft
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMain
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun DashboardTab(vm: AppViewModel, nav: androidx.navigation.NavController) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
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
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            StatCard("🏋️", "${vm.solvedExerciseCount()}/${vm.exercises.size}", "Exercises", Modifier.weight(1f))
            StatCard(
                "☁️",
                vm.syncStatus.replace("Syncing…", "…").replace("Synced ✓", "✓").replace("Synced", "✓"),
                "Cloud sync",
                Modifier.weight(1f)
            )
        }

        // Profile editing
        var editingProfile by remember { mutableStateOf(false) }
        var editName by remember { mutableStateOf("") }
        var editBio by remember { mutableStateOf("") }
        Card(
            colors = CardDefaults.cardColors(containerColor = Card),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(16.dp)) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("👤 Profile", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    OutlinedButton(onClick = {
                        editName = vm.profileName()
                        editBio = vm.profileBio()
                        editingProfile = true
                    }) { Text("Edit", fontSize = 13.sp) }
                }
                Spacer(Modifier.height(6.dp))
                Text(vm.profileName().ifBlank { "Learner" }, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                if (vm.profileBio().isNotBlank()) Text(vm.profileBio(), color = TextMuted, fontSize = 13.sp)
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
                    }) { Text("Save") }
                },
                dismissButton = {
                    OutlinedButton(onClick = { editingProfile = false }) { Text("Cancel") }
                }
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

        // ---------- Up next (website parity) ----------
        val upNext = vm.upNextLesson()
        if (upNext != null) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text("🎯 Up next", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(upNext.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text(
                        "Lesson ${vm.lessonIndex(upNext.id) + 1} of ${vm.catalog.lessons.size} · ${upNext.track} track",
                        color = TextMuted, fontSize = 12.sp
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { nav.navigate("lesson/${upNext.id}") }) {
                        Text("Resume lesson →", fontSize = 13.sp)
                    }
                }
            }
        }

        // ---------- Daily challenge (website parity: day % count) ----------
        val daily = vm.dailyChallenge()
        if (daily != null) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text("🏋️ Today's challenge", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(daily.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text(daily.prompt.take(90) + "…", color = TextMuted, fontSize = 12.sp)
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = { nav.navigate("exercise/${daily.id}") }) {
                        Text(if (vm.getAttempt(daily.id).solved) "Play again →" else "Take the challenge →", fontSize = 13.sp)
                    }
                }
            }
        }

        // ---------- Revision queue (website parity) ----------
        val revision = vm.revisionQueue()
        Card(
            colors = CardDefaults.cardColors(containerColor = Card),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(16.dp)) {
                Text("🔄 Review queue", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(Modifier.height(6.dp))
                if (revision.isEmpty()) {
                    Text("Nothing to review — clean slate!", color = TextMuted, fontSize = 13.sp)
                } else {
                    revision.forEach { ex ->
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("↻ ${ex.title}", fontSize = 13.sp, modifier = Modifier.weight(1f))
                            OutlinedButton(onClick = { nav.navigate("exercise/${ex.id}") }) {
                                Text("Retry", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }

        // ---------- Achievements (website parity) ----------
        val achievements = vm.achievements()
        val unlockedCount = achievements.count { it.unlocked }
        Card(
            colors = CardDefaults.cardColors(containerColor = Card),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(16.dp)) {
                Text(
                    "🏆 Achievements · $unlockedCount/${achievements.size}",
                    fontWeight = FontWeight.Bold, fontSize = 15.sp
                )
                Spacer(Modifier.height(10.dp))
                achievements.chunked(3).forEach { row ->
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        row.forEach { a ->
                            Column(
                                Modifier.weight(1f),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(a.icon, fontSize = 22.sp, color = if (a.unlocked) androidx.compose.ui.graphics.Color.Unspecified else TextMuted)
                                Text(
                                    a.name, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                                    color = if (a.unlocked) TextMain else TextMuted
                                )
                                Text(
                                    a.desc, fontSize = 10.sp, color = TextMuted,
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            }
                        }
                        repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }

        // ---------- Activity heatmap: last 12 weeks (website parity, compact) ----------
        val activeDays = vm.store.activeDays()
        Card(
            colors = CardDefaults.cardColors(containerColor = Card),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(16.dp)) {
                Text("📅 Activity · last 12 weeks", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(Modifier.height(10.dp))
                val cal = java.util.Calendar.getInstance()
                cal.add(java.util.Calendar.DAY_OF_YEAR, -83)
                // align to week start (Sunday)
                while (cal.get(java.util.Calendar.DAY_OF_WEEK) != java.util.Calendar.SUNDAY) {
                    cal.add(java.util.Calendar.DAY_OF_YEAR, -1)
                }
                val fmt = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    for (w in 0 until 12) {
                        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            for (d in 0 until 7) {
                                val dayStr = fmt.format(cal.time)
                                val active = dayStr in activeDays
                                androidx.compose.foundation.layout.Box(
                                    Modifier.size(14.dp)
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(if (active) Success else BgSoft)
                                )
                                cal.add(java.util.Calendar.DAY_OF_YEAR, 1)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "${activeDays.size} active days · keep the streak alive 🔥",
                    color = TextMuted, fontSize = 12.sp
                )
            }
        }

        // ---------- Certificates (website parity: one per completed track) ----------
        Card(
            colors = CardDefaults.cardColors(containerColor = Card),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(16.dp)) {
                Text("🎓 Certificates", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(Modifier.height(6.dp))
                var anyCert = false
                vm.catalog.tracks.forEach { t ->
                    if (vm.trackProgress(t.id) == 100) {
                        anyCert = true
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("${t.icon} ${t.name}", fontSize = 13.sp, modifier = Modifier.weight(1f))
                            OutlinedButton(onClick = {
                                downloadCertificate(ctx, vm.profileName().ifBlank { "Learner" }, t.name)
                            }) { Text("Download", fontSize = 12.sp) }
                        }
                    }
                }
                if (!anyCert) {
                    Text(
                        "Finish every lesson in a track to unlock its certificate.",
                        color = TextMuted, fontSize = 13.sp
                    )
                }
            }
        }

        // ---------- Topic mastery (website profile parity) ----------
        val mastery = vm.topicAccuracy()
        if (mastery.isNotEmpty()) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text("🎯 Topic mastery", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Spacer(Modifier.height(6.dp))
                    mastery.toList().sortedByDescending { (_, st) ->
                        val (s, total) = st
                        if (total == 0) 0f else s / total.toFloat()
                    }.forEach { (topic, st) ->
                        val (s, total) = st
                        val pct = if (total == 0) 0 else s * 100 / total
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 3.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(topic.replaceFirstChar { it.uppercase() }, fontSize = 13.sp)
                            Text("$pct% ($s/$total)", color = TextMuted, fontSize = 12.sp)
                        }
                        LinearProgressIndicator(
                            progress = { pct / 100f },
                            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(99.dp))
                        )
                        Spacer(Modifier.height(4.dp))
                    }
                }
            }
        }

        // ---------- Theme picker (website parity: dark/light + 6 accents) ----------
        Card(
            colors = CardDefaults.cardColors(containerColor = Card),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(16.dp)) {
                Text("🎨 Theme", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { vm.setTheme(true, vm.themeAccent) },
                        modifier = Modifier.weight(1f)
                    ) { Text(if (vm.themeDark) "🌙 Dark ✓" else "🌙 Dark", fontSize = 13.sp) }
                    OutlinedButton(
                        onClick = { vm.setTheme(false, vm.themeAccent) },
                        modifier = Modifier.weight(1f)
                    ) { Text(if (!vm.themeDark) "☀️ Light ✓" else "☀️ Light", fontSize = 13.sp) }
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    com.skillzify.app.ui.theme.ACCENTS.forEachIndexed { i, a ->
                        androidx.compose.foundation.layout.Box(
                            Modifier.size(36.dp)
                                .clip(androidx.compose.foundation.shape.CircleShape)
                                .background(a.primary)
                                .border(
                                    width = if (i == vm.themeAccent) 3.dp else 0.dp,
                                    color = if (i == vm.themeAccent) TextMain else androidx.compose.ui.graphics.Color.Transparent,
                                    shape = androidx.compose.foundation.shape.CircleShape
                                )
                                .clickable { vm.setTheme(vm.themeDark, i) },
                            contentAlignment = Alignment.Center
                        ) {
                            if (i == vm.themeAccent) Text("✓", color = androidx.compose.ui.graphics.Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    com.skillzify.app.ui.theme.ACCENTS[vm.themeAccent].name,
                    color = TextMuted, fontSize = 12.sp
                )
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

        // Topic accuracy (Practice Mode)
        val accuracy = vm.topicAccuracy()
        if (accuracy.isNotEmpty()) {
            Text("🎯 Practice accuracy by topic", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            accuracy.toList().sortedByDescending { (_, st) ->
                val (s, total) = st
                if (total == 0) 0f else s / total.toFloat()
            }.forEach { (topic, st) ->
                val (s, total) = st
                val pct = if (total == 0) 0 else s * 100 / total
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
                            Text(
                                topic.replaceFirstChar { it.uppercase() } +
                                    if (pct < 60 && total > 0) " ⚠️ weak spot" else "",
                                fontWeight = FontWeight.SemiBold, fontSize = 14.sp
                            )
                            Text("$s/$total", color = TextMuted, fontSize = 13.sp)
                        }
                        Spacer(Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { pct / 100f },
                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(99.dp))
                        )
                    }
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

/** Renders a track-completion certificate PNG into Downloads (website parity). */
private fun downloadCertificate(ctx: android.content.Context, name: String, trackName: String) {
    try {
        val w = 1200
        val h = 800
        val bmp = android.graphics.Bitmap.createBitmap(w, h, android.graphics.Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bmp)
        val bg = android.graphics.Paint().apply { color = android.graphics.Color.parseColor("#0A0F22") }
        canvas.drawRect(0f, 0f, w.toFloat(), h.toFloat(), bg)
        val gold = android.graphics.Paint().apply {
            color = android.graphics.Color.parseColor("#FBBF24")
            style = android.graphics.Paint.Style.STROKE
            strokeWidth = 6f
        }
        canvas.drawRect(40f, 40f, (w - 40).toFloat(), (h - 40).toFloat(), gold)
        fun text(str: String, size: Float, color: Int, y: Float, bold: Boolean = false) {
            val p = android.graphics.Paint().apply {
                this.color = color
                textSize = size
                textAlign = android.graphics.Paint.Align.CENTER
                typeface = if (bold) android.graphics.Typeface.DEFAULT_BOLD else android.graphics.Typeface.DEFAULT
                isAntiAlias = true
            }
            canvas.drawText(str, w / 2f, y, p)
        }
        text("Skillzify", 64f, android.graphics.Color.parseColor("#6C7BFF"), 170f, true)
        text("Certificate of Completion", 56f, android.graphics.Color.WHITE, 270f, true)
        text("This certificate is proudly presented to", 32f, android.graphics.Color.parseColor("#9AA3C7"), 350f)
        text(name, 72f, android.graphics.Color.parseColor("#FBBF24"), 460f, true)
        text("for completing the $trackName track", 36f, android.graphics.Color.WHITE, 550f)
        val dateStr = java.text.SimpleDateFormat("d MMMM yyyy", java.util.Locale.getDefault())
            .format(java.util.Date())
        text(dateStr, 30f, android.graphics.Color.parseColor("#9AA3C7"), 650f)
        val filename = "skillzify-" + trackName.lowercase().replace(" ", "-") + "-certificate.png"
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            val values = android.content.ContentValues().apply {
                put(android.provider.MediaStore.Downloads.DISPLAY_NAME, filename)
                put(android.provider.MediaStore.Downloads.MIME_TYPE, "image/png")
            }
            val uri = ctx.contentResolver.insert(
                android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
            )
            ctx.contentResolver.openOutputStream(uri!!)?.use {
                bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
            }
        } else {
            @Suppress("DEPRECATION")
            val dir = android.os.Environment.getExternalStoragePublicDirectory(
                android.os.Environment.DIRECTORY_DOWNLOADS
            )
            java.io.FileOutputStream(java.io.File(dir, filename)).use {
                bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
            }
        }
    } catch (e: Exception) {
        // Certificate save failed; nothing to roll back (best-effort download).
    }
}
