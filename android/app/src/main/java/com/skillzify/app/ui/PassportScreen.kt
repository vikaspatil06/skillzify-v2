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
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Switch
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
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/* Skill Passport — website passport.html / passport.js (own-passport view).
   - Profile header: name, level, XP (same numbers as Dashboard/Profile).
   - One certificate card per section from vm.passportEntries():
     earned → cert id (SKZ-…) + completion date; not earned → locked
     progress (done/total lessons + bar).
   - Achievements grid from vm.achievements().
   - Privacy: the web stores a PER-USER flag (skillzify_passport_private
     _<uid>, survives sign-out) controlling whether the public passport
     is published. No VM/store API for it exists in the current tree, so
     the toggle below is wired to a local remember state ONLY — it does
     not persist and does not publish/unpublish anything yet. (Noted in
     the delivery report as unwired.)
   - Honesty line from passport.js PUBLIC_NOTE, paraphrased in place:
     the passport is a transparent record, not tamper-proof. */
@Composable
fun PassportScreen(vm: AppViewModel, nav: NavController) {
    val level = vm.currentLevel()
    val entries = vm.passportEntries()
    val achievements = vm.achievements()
    val unlocked = achievements.count { it.unlocked }
    var passportPrivate by remember { mutableStateOf(false) }
    val dateFmt = remember { SimpleDateFormat("d MMM yyyy", Locale.getDefault()) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        ScreenHeader(
            "🎓 Skill Passport",
            "A public, itemised record of what you did — every lesson, exercise, project and path, with dates.",
            onBack = { nav.popBackStack() }
        )

        // Profile header
        WebCard {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("🎓", fontSize = 34.sp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(vm.profileName().ifBlank { "Learner" }, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Text("${level.name} · ${vm.xp} XP", color = TextMuted, fontSize = 13.sp)
                    Text(
                        "${vm.doneIds.size}/${vm.catalog.lessons.size} lessons · ${vm.solvedExerciseCount()}/${vm.exercises.size} exercises · 🔥 ${vm.streak} day streak",
                        color = TextMuted, fontSize = 12.sp
                    )
                }
            }
        }

        // Privacy toggle (local state only — see header comment)
        WebCard {
            Row(
                Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text("🔒 Private passport", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text(
                        "When on, your public passport is not published. (This toggle is not wired to the sync layer yet — it won't persist.)",
                        color = TextMuted, fontSize = 12.sp
                    )
                }
                Switch(checked = passportPrivate, onCheckedChange = { passportPrivate = it })
            }
        }
        Text(
            "This passport reads live from Skillzify's database — a transparent, itemised record, not a screenshot. It is not tamper-proof: your own account writes this record.",
            color = TextMuted, fontSize = 12.sp
        )

        // Per-section certificates. PassportEntry carries no done/total:
        // locked progress is computed from the catalog + doneIds here.
        Text("🎓 Certificates by section", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        entries.forEach { e ->
            val secLessons = vm.catalog.lessons.filter { it.section == e.sectionId }
            val secDone = secLessons.count { vm.isDone(it.id) }
            val secTotal = secLessons.size
            WebCard {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(e.icon, fontSize = 24.sp)
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(e.name, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            if (e.earned) {
                                Text(
                                    "✓ Earned" + (e.completedAt?.let { " · ${dateFmt.format(Date(it))}" } ?: ""),
                                    color = Success, fontSize = 12.sp
                                )
                            } else {
                                Text("🔒 $secDone/$secTotal lessons", color = TextMuted, fontSize = 12.sp)
                            }
                        }
                        if (e.earned) Text("🏆", fontSize = 20.sp)
                    }
                    if (e.earned) {
                        e.certId?.let {
                            Spacer(Modifier.height(6.dp))
                            Text(
                                it, fontFamily = FontFamily.Monospace, fontSize = 13.sp,
                                color = Warning, fontWeight = FontWeight.Bold
                            )
                        }
                    } else {
                        Spacer(Modifier.height(8.dp))
                        val pct = if (secTotal == 0) 0 else secDone * 100 / secTotal
                        LinearProgressIndicator(
                            progress = { pct / 100f },
                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(99.dp))
                        )
                        Text("$pct% — finish every lesson in this section to earn its certificate.",
                            color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }
        }
        if (entries.isEmpty()) {
            Text("No sections yet — your passport fills in as you learn.", color = TextMuted, fontSize = 13.sp)
        }

        // Achievements grid
        Text(
            "🏆 Achievements · $unlocked/${achievements.size}",
            fontWeight = FontWeight.Bold, fontSize = 16.sp
        )
        WebCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                achievements.chunked(3).forEach { row ->
                    Row(
                        Modifier.fillMaxWidth(),
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
                                    color = if (a.unlocked) androidx.compose.material3.MaterialTheme.colorScheme.onSurface else TextMuted,
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
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
        Spacer(Modifier.height(8.dp))
    }
}
