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
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/* Dashboard — website dashboard.html: greeting header, "Up next" card,
   concept-map card, stat cards (progress / streak / level), today's
   challenge, review queue, weak spots + mastery snapshot, progress by
   section, latest achievements, activity, certificates.
   AI usage line mirrors the web dashboard (ai.js v21): the line renders
   ONLY when vm.aiUsage is non-null — an old backend / unreachable
   server shows nothing at all, never a placeholder error. */
@Composable
fun DashboardTab(vm: AppViewModel, nav: NavController) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var savedCert by remember { mutableStateOf<String?>(null) }
    val user by vm.firebaseUser.collectAsStateWithLifecycle()
    val level = vm.currentLevel()
    val next = vm.nextLevelInfo()
    val fmt = SimpleDateFormat("d MMM, HH:mm", Locale.getDefault())

    // Refresh AI usage (+ admin overview) whenever the dashboard appears.
    LaunchedEffect(Unit) { vm.refreshAiAndAdmin() }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // ---- Greeting header ----
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text("📊 My Dashboard", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                Text(
                    "👋 ${vm.profileName().ifBlank { user?.displayName ?: "Learner" }} · ${user?.email ?: ""}",
                    color = TextMuted, fontSize = 12.sp
                )
            }
            OutlinedButton(
                onClick = { vm.refreshSync() },
                enabled = !vm.syncRefreshing
            ) {
                Text(
                    if (vm.syncRefreshing) "Syncing…" else "☁️ ${vm.syncStatus}",
                    fontSize = 12.sp, maxLines = 1
                )
            }
        }
        if (vm.isAdminConfirmed) {
            // Admin chip — shown ONLY on the server's word (overview 200).
            Row {
                WebChip("🛡️ Admin — open the control room")
                Spacer(Modifier.width(8.dp))
                Text(
                    "Open →", color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                    fontSize = 13.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickableNoRipple { nav.navigate("admin") }
                )
            }
        }

        // ---- AI usage line (web dashboard parity; hidden when null) ----
        val ai = vm.aiUsage
        if (ai != null) {
            WebCard {
                Row(
                    Modifier.fillMaxWidth().padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "🤖 AI answers today: ${ai.used} / ${ai.cap}" + if (ai.admin) " (admin)" else "",
                        fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f)
                    )
                    val poolUsed = ai.poolUsed
                    val poolCap = ai.poolCap
                    if (poolUsed != null && poolCap != null && poolCap > 0) {
                        Text("Pool $poolUsed/$poolCap", color = TextMuted, fontSize = 12.sp)
                    }
                }
            }
        }

        // ---- Up next (website parity) ----
        val upNext = vm.upNextLesson()
        if (upNext != null) {
            WebCard {
                Column(Modifier.padding(16.dp)) {
                    Text("🎯 Up next", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(upNext.title, fontWeight = FontWeight.Bold, fontSize = 17.sp,
                        modifier = Modifier.padding(top = 4.dp))
                    Text(
                        "Lesson ${vm.lessonIndex(upNext.id) + 1} of ${vm.catalog.lessons.size} · ${upNext.section}",
                        color = TextMuted, fontSize = 12.sp
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { nav.navigate("lesson/${upNext.id}") }) {
                            Text("Resume lesson →", fontSize = 13.sp, maxLines = 1)
                        }
                        OutlinedButton(onClick = { nav.navigate("map") }) {
                            Text("🗺️ Show on map", fontSize = 13.sp, maxLines = 1)
                        }
                    }
                }
            }
        } else {
            WebCard {
                Column(Modifier.padding(16.dp)) {
                    Text("🏆 All lessons complete!", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text("You've finished the whole journey — revisit the map or keep practising.",
                        color = TextMuted, fontSize = 13.sp)
                }
            }
        }

        // ---- Placement CTA when no placement ----
        if (vm.placement == null) {
            WebCard(onClick = { nav.navigate("placement") }) {
                Column(Modifier.padding(16.dp)) {
                    Text("🎯 Find your starting point", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text(
                        "Take the 3-minute placement test — 10 quick questions place you at the right section, and sections below it unlock.",
                        color = TextMuted, fontSize = 13.sp
                    )
                    Text("Take the test →", color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                        fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }

        // ---- Stat cards ----
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            StatCard("⚡", "${vm.xp}", "Total XP", Modifier.weight(1f))
            StatCard("🔥", "${vm.streak}", "Day streak", Modifier.weight(1f))
            StatCard("🏅", "${vm.doneIds.size}/${vm.catalog.lessons.size}", "Lessons", Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            StatCard("🏋️", "${vm.solvedExerciseCount()}/${vm.exercises.size}", "Exercises", Modifier.weight(1f))
            StatCard("▶️", "${vm.store.getRunCount()}", "Code runs", Modifier.weight(1f))
            val overall = if (vm.catalog.lessons.isEmpty()) 0
                else vm.doneIds.size * 100 / vm.catalog.lessons.size
            StatCard("📈", "$overall%", "Overall progress", Modifier.weight(1f))
        }

        // ---- Level ----
        WebCard {
            Column(Modifier.padding(16.dp)) {
                Text("⚡ Level", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text(level.name, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(top = 4.dp))
                if (next != null) {
                    val frac = (vm.xp - level.xp).toFloat() / (next.xp - level.xp).coerceAtLeast(1).toFloat()
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { frac.coerceIn(0f, 1f) },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(99.dp))
                    )
                    Text("${next.xp - vm.xp} XP to ${next.name}", color = TextMuted, fontSize = 12.sp,
                        modifier = Modifier.padding(top = 6.dp))
                } else {
                    Text("Max level reached! 🏆", color = Warning, fontSize = 13.sp)
                }
            }
        }

        // ---- Mastery snapshot (mastery.js: weakest topic + section bands) ----
        MasterySnapshot(vm, nav)

        // ---- Daily challenge ----
        val daily = vm.dailyChallenge()
        if (daily != null) {
            WebCard {
                Column(Modifier.padding(16.dp)) {
                    Text("📅 Today's challenge", fontWeight = FontWeight.Bold, fontSize = 15.sp)
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

        // ---- Revision queue ----
        val revision = vm.revisionQueue()
        WebCard {
            Column(Modifier.padding(16.dp)) {
                Text("🔁 Review queue", fontWeight = FontWeight.Bold, fontSize = 15.sp)
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
                                Text("Retry", fontSize = 12.sp, maxLines = 1)
                            }
                        }
                    }
                }
            }
        }

        // ---- Quick links (Passport / Map / Community / Library) ----
        Text("Quick links", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            QuickLink("🎓", "Passport", Modifier.weight(1f)) { nav.navigate("passport") }
            QuickLink("🗺️", "Concept map", Modifier.weight(1f)) { nav.navigate("map") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            QuickLink("🤝", "Community", Modifier.weight(1f)) { nav.navigate("community") }
            QuickLink("📚", "Library", Modifier.weight(1f)) { nav.navigate("library") }
        }

        // ---- Achievements preview ----
        val achievements = vm.achievements()
        val unlockedCount = achievements.count { it.unlocked }
        WebCard(onClick = { nav.navigate("passport") }) {
            Column(Modifier.padding(16.dp)) {
                Text("🏆 Latest achievements · $unlockedCount/${achievements.size}",
                    fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(Modifier.height(10.dp))
                achievements.take(6).chunked(3).forEach { row ->
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        row.forEach { a ->
                            Column(
                                Modifier.weight(1f),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(a.icon, fontSize = 22.sp,
                                    color = if (a.unlocked) androidx.compose.ui.graphics.Color.Unspecified else TextMuted)
                                Text(
                                    a.name, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                                    color = if (a.unlocked) androidx.compose.material3.MaterialTheme.colorScheme.onSurface else TextMuted
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
                Text("See all in your Skill Passport →",
                    color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                    fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 6.dp))
            }
        }

        // ---- Activity heatmap ----
        ActivityHeatmap(vm)

        // ---- Progress by section ----
        Text("Progress by section", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        vm.catalog.tracks.forEach { t ->
            val pct = vm.trackProgress(t.id)
            WebCard {
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

        // ---- Certificates (per completed track/section) ----
        WebCard {
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
                                scope.launch {
                                    withContext(kotlinx.coroutines.Dispatchers.IO) {
                                        downloadCertificate(ctx, vm.profileName().ifBlank { "Learner" }, t.name)
                                    }
                                    savedCert = t.id
                                    kotlinx.coroutines.delay(2500)
                                    if (savedCert == t.id) savedCert = null
                                }
                            }) { Text(if (savedCert == t.id) "✓ Saved" else "Download", fontSize = 12.sp, maxLines = 1) }
                        }
                    }
                }
                if (!anyCert) {
                    Text(
                        "Finish every lesson in a section to unlock its certificate — see your Skill Passport for progress.",
                        color = TextMuted, fontSize = 13.sp
                    )
                }
            }
        }

        // ---- Weak spots (topic accuracy, existing widget) ----
        val accuracy = vm.topicAccuracy()
        if (accuracy.isNotEmpty()) {
            Text("🎯 Weak spots", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("Exercise accuracy by topic — low scores need a revisit.",
                color = TextMuted, fontSize = 12.sp)
            accuracy.toList().sortedByDescending { (_, st) ->
                val (s, total) = st
                if (total == 0) 0f else s / total.toFloat()
            }.forEach { (topic, st) ->
                val (s, total) = st
                val pct = if (total == 0) 0 else s * 100 / total
                WebCard {
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
            WebCard {
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

/** Mastery snapshot: weakest topic (vm.topicMastery) + per-section bands
    (vm.sectionMastery) with the web's band names — Mastered / Solid /
    Building / Starting out / Not tried yet. */
@Composable
private fun MasterySnapshot(vm: AppViewModel, nav: NavController) {
    val topics = try { vm.topicMastery() } catch (e: Exception) { emptyList() }
    val sections = try { vm.sectionMastery() } catch (e: Exception) { emptyList() }
    if (topics.isEmpty() && sections.isEmpty()) return
    // TopicMastery: score is a non-null Int (0 when untried), no label
    // field — the topic id is capitalised for display like elsewhere.
    val weakest = topics.filter { it.tried > 0 }.minByOrNull { it.score }
    WebCard {
        Column(Modifier.padding(16.dp)) {
            Text("🎯 Mastery snapshot", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            if (weakest != null) {
                val w = weakest
                val wLabel = w.topic.replaceFirstChar { it.uppercase() }
                Text(
                    "Weakest topic: $wLabel — ${w.score}% mastery (${w.band})" + if (w.rusty) " · 🍂 rusty" else "",
                    fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp)
                )
                Row(Modifier.padding(top = 6.dp)) {
                    OutlinedButton(onClick = { nav.navigate("practice") }) {
                        Text("Practise $wLabel →", fontSize = 12.sp, maxLines = 1)
                    }
                }
            } else {
                Text(
                    "No exercises tried yet — your mastery snapshot appears once you practise.",
                    color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp)
                )
            }
            if (sections.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                sections.forEach { s ->
                    // SectionMastery carries ids/counts only; the
                    // section's name/icon come from the catalog.
                    val track = vm.catalog.tracks.firstOrNull { it.id == s.sectionId }
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 3.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("${track?.icon ?: ""} ${track?.name ?: s.sectionId}", fontSize = 13.sp, modifier = Modifier.weight(1f))
                        Text("${s.doneCount}/${s.totalCount}", color = TextMuted, fontSize = 12.sp)
                        Spacer(Modifier.width(8.dp))
                        WebChip(
                            s.band + if (s.rusty) " 🍂" else "",
                            when (s.band) {
                                "Mastered" -> Success
                                "Solid" -> Success
                                "Building" -> Warning
                                else -> TextMuted
                            }
                        )
                    }
                    LinearProgressIndicator(
                        progress = { s.score / 100f },
                        modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(99.dp))
                    )
                }
            }
        }
    }
}

@Composable
private fun QuickLink(icon: String, label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    WebCard(modifier = modifier, onClick = onClick) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(icon, fontSize = 20.sp)
            Spacer(Modifier.width(8.dp))
            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        }
    }
}

@Composable
private fun StatCard(emoji: String, big: String, label: String, modifier: Modifier = Modifier) {
    WebCard(modifier = modifier) {
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

/** Small clickable-without-ripple helper for inline text links. */
private fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier =
    this.then(Modifier.clickableText(onClick))

private fun Modifier.clickableText(onClick: () -> Unit): Modifier =
    this.then(
        androidx.compose.foundation.clickable(
            interactionSource = androidx.compose.runtime.MutableInteractionSource(),
            indication = null,
            onClick = onClick
        )
    )

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
