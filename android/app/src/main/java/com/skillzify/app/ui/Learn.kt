package com.skillzify.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.Lesson
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning

/* Learn — rebuilt around the 7 journey SECTIONS (web learn.html +
   learn-core.js SECTIONS). catalog.tracks now carries the sections in
   journey order (id/name/desc/icon/needs — the Track shape), and every
   Lesson carries its `section`. Unlock semantics mirror the web:
   - vm.sectionUnlocked(section): needs-section fully done, OR the
     placement pointer at/after this section (sections before the
     placed section are open).
   - Lesson rows use the GLOBAL catalog index (catalog.lessons is in web
     order) for vm.isUnlocked(index): sequential chain + path unlocks.
   Search filters across all sections; star/pin markers are kept. */

/* Unlock rules come from the VM (web learn-core.js parity):
   vm.sectionUnlocked(sectionId) — needs-section fully done OR the
   placement pointer at/after the section; vm.isUnlocked(globalIndex)
   — sequential chain OR path unlock OR placement OR first lesson of
   an unlocked section. */

@Composable
fun LearnTab(vm: AppViewModel, nav: NavController, initialSection: String? = null) {
    val sections = vm.catalog.tracks
    // Section to expand first: the deep-linked one, else the section of
    // the next lesson, else the first section.
    val defaultSection = remember {
        initialSection?.takeIf { id -> sections.any { it.id == id } }
            ?: vm.upNextLesson()?.section
            ?: sections.firstOrNull()?.id
    }
    var expanded by remember { mutableStateOf(defaultSection) }
    var query by remember { mutableStateOf("") }
    val searching = query.isNotBlank()
    val placedSection = vm.placement?.section

    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("🗺️ Your Python Journey", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
            Text(
                "Follow the path, node by node. Each lesson unlocks the next — finish the quiz and the mini challenge to earn XP and move forward.",
                color = TextMuted, fontSize = 13.sp, lineHeight = 19.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
            Text(
                "${vm.xp} XP · ${vm.currentLevel().name} · ${vm.doneIds.size}/${vm.catalog.lessons.size} lessons",
                color = TextMuted, fontSize = 13.sp,
                modifier = Modifier.padding(top = 6.dp, bottom = 4.dp)
            )
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Search ${vm.catalog.lessons.size} lessons… try \"decorators\", \"files\", \"loops\"", fontSize = 13.sp) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)
            )
        }

        // Placement banner (web learn.html #plc-banner).
        item {
            if (vm.placement == null) {
                // Web learn.js: the "New here?" nudge is for 0-lesson learners only.
                if (vm.doneIds.isEmpty()) {
                    WebCard(onClick = { nav.navigate("placement") }) {
                        Column(Modifier.padding(16.dp)) {
                            Text("🎯 New here?", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text(
                                "Take the 3-minute placement test and skip what you already know.",
                                color = TextMuted, fontSize = 13.sp
                            )
                            Text("Take the placement test →", color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                                fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
                        }
                    }
                }
            } else {
                val sec = sections.firstOrNull { it.id == placedSection }
                WebCard(onClick = { nav.navigate("placement") }) {
                    Column(Modifier.padding(16.dp)) {
                        Text("🎯 Placed at ${sec?.let { "${it.icon} ${it.name}" } ?: placedSection}",
                            fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(
                            "Your test put you here — start at this section, or move freely.",
                            color = TextMuted, fontSize = 13.sp
                        )
                    }
                }
            }
        }

        if (searching) {
            val hits = vm.catalog.lessons.filter {
                it.title.contains(query, ignoreCase = true) || it.explain.contains(query, ignoreCase = true)
            }
            item {
                Text(
                    if (hits.isEmpty()) "No lessons match your search."
                    else "${hits.size} lesson${if (hits.size == 1) "" else "s"} match \"$query\"",
                    color = TextMuted, fontSize = 13.sp
                )
            }
            items(hits, key = { it.id }) { lesson ->
                LessonRow(lesson, vm.lessonIndex(lesson.id), vm, Modifier.animateItem()) {
                    nav.navigate("lesson/${lesson.id}")
                }
            }
        } else {
            sections.forEach { sec ->
                val secLessons = vm.catalog.lessons.filter { it.section == sec.id }
                val doneCount = secLessons.count { vm.isDone(it.id) }
                val pct = if (secLessons.isEmpty()) 0 else doneCount * 100 / secLessons.size
                val unlocked = vm.sectionUnlocked(sec.id)
                val isExpanded = expanded == sec.id
                item(key = "sec-${sec.id}") {
                    WebCard(onClick = {
                        if (unlocked) expanded = if (isExpanded) null else sec.id
                    }) {
                        Column(Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(sec.icon, fontSize = 26.sp)
                                Spacer(Modifier.width(10.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        sec.name + when {
                                            pct == 100 -> " ✓"
                                            !unlocked -> " 🔒"
                                            else -> ""
                                        },
                                        fontWeight = FontWeight.Bold, fontSize = 16.sp
                                    )
                                    Text(sec.desc, color = TextMuted, fontSize = 12.sp, lineHeight = 17.sp)
                                }
                                Text("$pct%", color = TextMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                            Spacer(Modifier.height(8.dp))
                            LinearProgressIndicator(
                                progress = { pct / 100f },
                                modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(99.dp))
                            )
                            Row(
                                Modifier.fillMaxWidth().padding(top = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    when {
                                        !unlocked -> {
                                            val needName = sections.firstOrNull { it.id == sec.needs }?.name ?: sec.needs ?: ""
                                            "🔒 Finish $needName to unlock — or take the placement test"
                                        }
                                        placedSection != null && sec.id == placedSection -> "🎯 Your placement — start here"
                                        else -> "$doneCount/${secLessons.size} lessons"
                                    },
                                    color = TextMuted, fontSize = 12.sp
                                )
                                if (unlocked) Text(if (isExpanded) "▾" else "▸", color = TextMuted, fontSize = 13.sp)
                            }
                        }
                    }
                }
                if (isExpanded && unlocked) {
                    items(secLessons, key = { it.id }) { lesson ->
                        LessonRow(lesson, vm.lessonIndex(lesson.id), vm, Modifier.animateItem()) {
                            nav.navigate("lesson/${lesson.id}")
                        }
                    }
                }
            }
        }

        item {
            // Library shortcuts (paths / map / reference live one tap away).
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                WebCard(Modifier.weight(1f), onClick = { nav.navigate("map") }) {
                    Text("🗺️ Map view", fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                        modifier = Modifier.padding(12.dp))
                }
                WebCard(Modifier.weight(1f), onClick = { nav.navigate("library") }) {
                    Text("📚 Library", fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                        modifier = Modifier.padding(12.dp))
                }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun LessonRow(lesson: Lesson, globalIndex: Int, vm: AppViewModel, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val done = vm.isDone(lesson.id)
    val unlocked = globalIndex >= 0 && vm.isUnlocked(globalIndex)
    val pathOnly = globalIndex >= 0 && vm.isPathOnlyUnlocked(globalIndex)
    val isCurrent = unlocked && !done &&
        vm.upNextLesson()?.id == lesson.id
    WebCard(
        modifier = modifier.clickable(enabled = unlocked, onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = when {
                    done -> "✅"
                    pathOnly -> "🔓"
                    isCurrent -> "▶️"
                    unlocked -> "📘"
                    else -> "🔒"
                },
                fontSize = 24.sp,
                modifier = Modifier.size(36.dp)
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(lesson.title, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Text(
                    (if (pathOnly) "Unlocked by your learning path · " else "") +
                        (if (isCurrent) "Up next · " else "") +
                        lesson.explain.take(90) + "…",
                    color = TextMuted, fontSize = 12.sp, maxLines = 2
                )
            }
            if (lesson.id in vm.starredLessons) Text("⭐", fontSize = 14.sp)
            if (lesson.id in vm.pinnedLessons) Text("📌", fontSize = 14.sp)
            if (done) Text("+XP ✓", color = Warning, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            else if (isCurrent) Text("Next", color = Success, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}
