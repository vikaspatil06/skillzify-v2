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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning

private fun diffLabel(d: Int) = when (d) {
    1 -> "Easy"; 2 -> "Medium"; else -> "Hard"
}

@Composable
fun PracticeTab(vm: AppViewModel, nav: NavController) {
    val topics = remember { listOf("All") + vm.exercises.map { it.topic }.distinct() }
    var topic by remember { mutableStateOf("All") }
    // derivedStateOf: refilter only when the topic changes.
    val list by remember {
        androidx.compose.runtime.derivedStateOf {
            vm.exercises.filter { topic == "All" || it.topic == topic }
        }
    }
    val solved = vm.solvedExerciseCount()

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("🏋️ Practice", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
        Text(
            "$solved / ${vm.exercises.size} solved · ${vm.xp} XP",
            color = TextMuted, fontSize = 13.sp,
            modifier = Modifier.padding(top = 2.dp, bottom = 10.dp)
        )
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 8.dp)
        ) {
            items(topics) { t ->
                FilterChip(
                    selected = topic == t,
                    onClick = { topic = t },
                    label = { Text(t.replaceFirstChar { it.uppercase() }) }
                )
            }
        }
        if (list.isNotEmpty()) {
            val done = list.count { vm.getAttempt(it.id).solved }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                LinearProgressIndicator(
                    progress = { done / list.size.toFloat() },
                    modifier = Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(99.dp))
                )
                Spacer(Modifier.width(8.dp))
                Text("$done/${list.size}", color = TextMuted, fontSize = 13.sp)
            }
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(list, key = { it.id }) { ex ->
                val att = vm.getAttempt(ex.id)
                Card(
                    colors = CardDefaults.cardColors(containerColor = Card),
                    modifier = Modifier.fillMaxWidth().animateItem().clickable { nav.navigate("exercise/${ex.id}") }
                ) {
                    Column(Modifier.fillMaxWidth().padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                if (att.solved) "✅" else "⬜",
                                fontSize = 16.sp
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(ex.title, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(4.dp))
                        Row {
                            Text(
                                diffLabel(ex.diff),
                                fontSize = 12.sp,
                                color = when (ex.diff) { 1 -> Success; 2 -> Warning; else -> MaterialTheme.colorScheme.error }
                            )
                            Text(" · ${ex.kind} · ${ex.xp} XP", fontSize = 12.sp, color = TextMuted)
                            if (att.attempts > 0 && !att.solved)
                                Text(" · ${att.attempts} tries", fontSize = 12.sp, color = TextMuted)
                        }
                    }
                }
            }
        }
    }
}
