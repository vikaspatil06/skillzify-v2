package com.skillzify.app.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.NodeState
import com.skillzify.app.ui.theme.Accent
import com.skillzify.app.ui.theme.Primary
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning

/* Concept Map — website map.html / map.js, two levels, no canvas:
   Level 1: the 7 section nodes (vm.sectionNodes() — SectionNode carries
   the Track, a NodeState and pct) in journey order, connected by a
   vertical line, coloured by state, with the section's "requires X"
   needs-edge as text. Tapping an unlocked section opens Level 2: its
   lesson nodes (vm.lessonNodes(sectionId) — LessonNode carries the
   Lesson + NodeState); tapping a lesson opens LessonDetail (locked
   lessons don't navigate, like the web's fallback).
   State colours (spec): DONE green, CURRENT accent, OPEN surface,
   LOCKED dim, WEAK amber, RUSTY orange-red. */
fun nodeStateColor(state: NodeState): Color = when (state) {
    NodeState.DONE -> Success
    NodeState.CURRENT -> Accent
    NodeState.WEAK -> Warning
    NodeState.RUSTY -> Color(0xFFF97316) // orange-red, between Warning and Danger
    NodeState.LOCKED -> TextMuted.copy(alpha = 0.45f)
    NodeState.OPEN -> Primary
}

private fun nodeStateIcon(state: NodeState): String = when (state) {
    NodeState.DONE -> "✅"
    NodeState.CURRENT -> "▶️"
    NodeState.WEAK -> "⚠️"
    NodeState.RUSTY -> "🍂"
    NodeState.LOCKED -> "🔒"
    NodeState.OPEN -> "📘"
}

private fun nodeStateLabel(state: NodeState): String = when (state) {
    NodeState.DONE -> "Done"
    NodeState.CURRENT -> "Current"
    NodeState.WEAK -> "Weak"
    NodeState.RUSTY -> "Rusty"
    NodeState.LOCKED -> "Locked"
    NodeState.OPEN -> "Open"
}

@Composable
fun ConceptMapScreen(vm: AppViewModel, nav: NavController) {
    var focusSection by remember { mutableStateOf<String?>(null) }
    val sections = vm.sectionNodes()
    val nameById = sections.associate { it.section.id to it.section.name }

    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp)
    ) {
        item {
            ScreenHeader(
                "🗺️ Concept Map",
                "The Learn page tells you what's next; this map shows you where you are. Seven sections, one journey — tap a section to see its lessons, tap a lesson to open it.",
                onBack = if (focusSection != null) {
                    { focusSection = null }
                } else {
                    { nav.popBackStack() }
                }
            )
            // Legend (web cmap legend)
            Row(
                Modifier.fillMaxWidth().padding(vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                NodeState.entries.forEach { st ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(9.dp).clip(CircleShape).background(nodeStateColor(st)))
                        Spacer(Modifier.width(4.dp))
                        Text(nodeStateLabel(st), color = TextMuted, fontSize = 11.sp)
                    }
                }
            }
        }

        val focus = focusSection
        if (focus == null) {
            // ---- Level 1: section nodes ----
            items(sections, key = { it.section.id }) { n ->
                val sec = n.section
                val locked = n.state == NodeState.LOCKED
                val secLessons = vm.catalog.lessons.filter { it.section == sec.id }
                val secDone = secLessons.count { vm.isDone(it.id) }
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(16.dp).clip(CircleShape)
                                .background(nodeStateColor(n.state))
                        )
                        Spacer(Modifier.width(10.dp))
                        WebCard(
                            modifier = Modifier.padding(vertical = 5.dp),
                            onClick = if (locked) null else ({ focusSection = sec.id })
                        ) {
                            Column(Modifier.padding(14.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("${sec.icon} ${sec.name}", fontWeight = FontWeight.Bold, fontSize = 15.sp,
                                        modifier = Modifier.weight(1f))
                                    WebChip(nodeStateLabel(n.state), nodeStateColor(n.state))
                                }
                                Text(
                                    "$secDone/${secLessons.size} lessons · ${n.pct}%",
                                    color = TextMuted, fontSize = 12.sp,
                                    modifier = Modifier.padding(top = 3.dp)
                                )
                                sec.needs?.let { needId ->
                                    Text(
                                        "↳ requires ${nameById[needId] ?: needId}",
                                        color = TextMuted, fontSize = 12.sp
                                    )
                                }
                                if (!locked) {
                                    Text("Tap to see lessons →", color = Primary, fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 3.dp))
                                }
                            }
                        }
                    }
                    // Journey line segment
                    Row {
                        Box(Modifier.width(16.dp), contentAlignment = Alignment.Center) {
                            Box(Modifier.width(2.dp).height(10.dp).background(TextMuted.copy(alpha = 0.35f)))
                        }
                    }
                }
            }
        } else {
            // ---- Level 2: lesson nodes of the focused section ----
            val secNode = sections.firstOrNull { it.section.id == focus }
            item {
                Text(
                    "${secNode?.section?.icon ?: ""} ${secNode?.section?.name ?: focus}",
                    fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                Text("← All sections", color = Primary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 8.dp).clickable { focusSection = null })
            }
            val lessons = vm.lessonNodes(focus)
            itemsIndexed(lessons, key = { _, n -> n.lesson.id }) { i, n ->
                val locked = n.state == NodeState.LOCKED
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(14.dp).clip(CircleShape).background(nodeStateColor(n.state))
                        )
                        Spacer(Modifier.width(10.dp))
                        WebCard(
                            modifier = Modifier.padding(vertical = 4.dp),
                            onClick = if (locked) null else ({ nav.navigate("lesson/${n.lesson.id}") })
                        ) {
                            Row(
                                Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(nodeStateIcon(n.state), fontSize = 17.sp)
                                Spacer(Modifier.width(8.dp))
                                Column(Modifier.weight(1f)) {
                                    Text("${i + 1}. ${n.lesson.title}", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                    Text(nodeStateLabel(n.state), color = nodeStateColor(n.state), fontSize = 11.sp)
                                }
                                if (n.state == NodeState.WEAK || n.state == NodeState.RUSTY) {
                                    Text("Review →", color = Warning, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                    Row {
                        Box(Modifier.width(14.dp), contentAlignment = Alignment.Center) {
                            Box(Modifier.width(2.dp).height(8.dp).background(TextMuted.copy(alpha = 0.35f)))
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(12.dp)) }
        }
    }
}
