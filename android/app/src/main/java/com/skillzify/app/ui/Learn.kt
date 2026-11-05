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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning

@Composable
fun LearnTab(vm: AppViewModel, nav: NavController) {
    var trackId by remember { mutableStateOf(vm.catalog.tracks.first().id) }
    var query by remember { mutableStateOf("") }
    val track = vm.catalog.tracks.first { it.id == trackId }
    val unlocked = vm.trackUnlocked(trackId)
    val lessons = vm.catalog.lessons.filter { it.track == trackId }
        .filter { query.isBlank() || it.title.contains(query, ignoreCase = true) }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("📚 Learn Python", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
        Text(
            "${vm.xp} XP · ${vm.currentLevel().name}",
            color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp, bottom = 10.dp)
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            vm.catalog.tracks.forEach { t ->
                val ok = vm.trackUnlocked(t.id)
                FilterChip(
                    selected = trackId == t.id,
                    enabled = ok,
                    onClick = { trackId = t.id },
                    label = { Text("${t.icon} ${t.name}${if (ok) "" else " 🔒"}") }
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(track.desc, color = TextMuted, fontSize = 13.sp)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
        ) {
            LinearProgressIndicator(
                progress = { vm.trackProgress(trackId) / 100f },
                modifier = Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(99.dp))
            )
            Spacer(Modifier.width(8.dp))
            Text("${vm.trackProgress(trackId)}%", color = TextMuted, fontSize = 13.sp)
        }
        androidx.compose.material3.OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text("Search lessons…", fontSize = 13.sp) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
        )
        if (!unlocked) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
            ) {
                Text(
                    "🔒 Finish all ${track.needs} lessons to unlock this track.",
                    modifier = Modifier.padding(18.dp), color = TextMuted
                )
            }
        } else if (lessons.isEmpty()) {
            Text("No lessons match “$query”.", color = TextMuted, fontSize = 13.sp)
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(lessons, key = { it.id }) { lesson ->
                    val gi = vm.lessonIndex(lesson.id)
                    LessonRow(lesson, gi, vm) { nav.navigate("lesson/${lesson.id}") }
                }
            }
        }
    }
}

@Composable
private fun LessonRow(lesson: Lesson, globalIndex: Int, vm: AppViewModel, onClick: () -> Unit) {
    val done = vm.isDone(lesson.id)
    val unlocked = vm.isUnlocked(globalIndex)
    val pathOnly = vm.isPathOnlyUnlocked(globalIndex)
    val isCurrent = unlocked && !done
    Card(
        colors = CardDefaults.cardColors(containerColor = Card),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable(enabled = unlocked, onClick = onClick)
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
                        lesson.explain.take(90) + "…",
                    color = TextMuted, fontSize = 12.sp, maxLines = 2
                )
            }
            if (lesson.id in vm.starredLessons) Text("⭐", fontSize = 14.sp)
            if (lesson.id in vm.pinnedLessons) Text("📌", fontSize = 14.sp)
            if (done) Text("+XP ✓", color = Warning, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}
