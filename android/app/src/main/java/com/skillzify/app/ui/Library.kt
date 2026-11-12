package com.skillzify.app.ui

import androidx.compose.animation.animateContentSize
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted

private data class LibCard(val route: String, val icon: String, val title: String, val desc: String)

/* ---------------- Library hub ---------------- */

@Composable
fun LibraryTab(vm: AppViewModel, nav: NavController) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("📚 Library", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
        Text("Guided paths, projects and the Python reference.", color = TextMuted, fontSize = 13.sp)
        for (c in listOf(
            LibCard("paths", "🗺️", "Learning Paths", "Step-by-step roadmaps: Fundamentals, DSA, Automation, Data Analysis, Interview Prep."),
            LibCard("projects", "🛠️", "Guided Projects", "Build real things: file organizer, weather client, scraper, CSV analyzer."),
            LibCard("reference", "📖", "Python Reference", "${vm.reference.size} quick-lookup entries with examples — functions, types, control flow."),
            LibCard("flowchart", "🔀", "Flowchart Lab", "Turn Python code or an algorithm into a step-by-step flowchart — and trace it.")
        )) {
            WebCard(onClick = { nav.navigate(c.route) }) {
                Column(Modifier.fillMaxWidth().padding(16.dp)) {
                    Text("${c.icon} ${c.title}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(c.desc, color = TextMuted, fontSize = 13.sp)
                }
            }
        }
    }
}

/* ---------------- Paths ---------------- */

@Composable
fun PathsScreen(vm: AppViewModel, nav: NavController) {
    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("🗺️ Learning Paths", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(4.dp))
        }
        items(vm.paths, key = { it.id }) { p ->
            val enrolled = vm.isEnrolled(p.id)
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth().animateItem().clickable { nav.navigate("path/${p.id}") }
            ) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("${p.icon} ${p.title}", fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
                        if (enrolled) {
                            Text("✓ Enrolled", color = Success, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        } else {
                            OutlinedButton(onClick = { vm.enroll(p.id) }) { Text("Enroll", fontSize = 12.sp) }
                        }
                    }
                    Text(p.desc, color = TextMuted, fontSize = 13.sp)
                    Spacer(Modifier.height(6.dp))
                    val done = p.steps.count { s ->
                        if (s.type == "lesson") vm.isDone(s.ref) else vm.getAttempt(s.ref).solved
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        LinearProgressIndicator(
                            progress = { if (p.steps.isEmpty()) 0f else done / p.steps.size.toFloat() },
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("$done/${p.steps.size}", color = TextMuted, fontSize = 12.sp)
                    }
                    if (enrolled) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Leave path",
                            color = TextMuted, fontSize = 12.sp,
                            modifier = Modifier.clickable { vm.leave(p.id) }
                        )
                    } else {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Enrolling unlocks every lesson in this path — even locked ones.",
                            color = TextMuted, fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun PathDetail(vm: AppViewModel, id: String, nav: NavController) {
    val p = vm.paths.firstOrNull { it.id == id }
    if (p == null) {
        Column(Modifier.fillMaxSize().padding(16.dp)) { Text("Path not found.", color = TextMuted) }
        return
    }
    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            val enrolled = vm.isEnrolled(p.id)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${p.icon} ${p.title}", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
                if (enrolled) {
                    OutlinedButton(onClick = { vm.leave(p.id) }) { Text("Leave", fontSize = 12.sp) }
                } else {
                    OutlinedButton(onClick = { vm.enroll(p.id) }) { Text("Enroll", fontSize = 12.sp) }
                }
            }
            Text(p.desc, color = TextMuted, fontSize = 13.sp)
            if (enrolled) Text("✓ Enrolled — every lesson below is unlocked.", color = Success, fontSize = 13.sp)
            Spacer(Modifier.height(4.dp))
        }
        items(p.steps.withIndex().toList(), key = { (i, s) -> "${p.id}-${s.type}-${s.ref}-$i" }) { (i, s) ->
            val done = if (s.type == "lesson") vm.isDone(s.ref) else vm.getAttempt(s.ref).solved
            val pathUnlocked = s.type == "lesson" && !done &&
                vm.unlockMap.containsKey(s.ref)
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth().clickable {
                    if (s.type == "lesson") nav.navigate("lesson/${s.ref}")
                    else nav.navigate("exercise/${s.ref}")
                }
            ) {
                Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (done) "✅" else if (pathUnlocked) "🔓" else "${i + 1}.", fontSize = 14.sp, modifier = Modifier.width(32.dp))
                    Column(Modifier.weight(1f)) {
                        Text(s.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Row(
                            Modifier.padding(top = 2.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Exercise steps open the exercise (Library brief);
                            // lesson steps open the lesson — routing is in
                            // the card's click handler above.
                            WebChip(
                                if (s.type == "lesson") "Lesson" else "Exercise",
                                if (s.type == "lesson") TextMuted
                                else androidx.compose.material3.MaterialTheme.colorScheme.primary
                            )
                            if (pathUnlocked) Text("unlocked by this path", color = TextMuted, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

/* ---------------- Projects ---------------- */

@Composable
fun ProjectsScreen(vm: AppViewModel, nav: NavController) {
    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("🛠️ Guided Projects", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(4.dp))
        }
        items(vm.projects, key = { it.id }) { pr ->
            Card(
                colors = CardDefaults.cardColors(containerColor = Card),
                modifier = Modifier.fillMaxWidth().animateItem().clickable { nav.navigate("project/${pr.id}") }
            ) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text("${pr.icon} ${pr.title}", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text(pr.desc, color = TextMuted, fontSize = 13.sp)
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        WebChip(
                            pr.difficulty,
                            when {
                                pr.difficulty.contains("Beginner", true) -> Success
                                pr.difficulty.contains("Intermediate", true) -> com.skillzify.app.ui.theme.Warning
                                else -> androidx.compose.material3.MaterialTheme.colorScheme.error
                            }
                        )
                        WebChip("${pr.milestones.size} milestones")
                    }
                }
            }
        }
    }
}

@Composable
fun ProjectDetail(vm: AppViewModel, id: String, nav: NavController) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val clipboard = ctx.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
    var copied by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(copied) {
        if (copied) { kotlinx.coroutines.delay(2000); copied = false }
    }
    val pr = vm.projects.firstOrNull { it.id == id }
    if (pr == null) {
        Column(Modifier.fillMaxSize().padding(16.dp)) { Text("Project not found.", color = TextMuted) }
        return
    }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("${pr.icon} ${pr.title}", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
        Text(pr.desc, fontSize = 14.sp, lineHeight = 21.sp)
        Text("${pr.difficulty} · ${pr.skills}", color = TextMuted, fontSize = 13.sp)
        Text("Milestones", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        pr.milestones.forEachIndexed { i, m ->
            Card(colors = CardDefaults.cardColors(containerColor = Card), modifier = Modifier.fillMaxWidth()) {
                Text("${i + 1}. $m", modifier = Modifier.padding(12.dp), fontSize = 13.sp, lineHeight = 20.sp)
            }
        }
        if (pr.starter.isNotBlank()) {
            Text("Starter code", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            CodeBlock(pr.starter)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = {
                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("skillzify", pr.starter))
                        copied = true
                    },
                    modifier = Modifier.weight(1f)
                ) { Text(if (copied) "✓ Copied!" else "📋 Copy code", maxLines = 1) }
                Button(
                    onClick = { vm.openInCompiler(pr.starter); nav.navigate("compiler") },
                    modifier = Modifier.weight(1f)
                ) { Text("▶ Try in compiler", maxLines = 1) }
            }
        } else {
            OutlinedButton(onClick = { nav.navigate("compiler") }, modifier = Modifier.fillMaxWidth()) {
                Text("Open in compiler →", maxLines = 1)
            }
        }
    }
}

/* ---------------- Reference ---------------- */

@Composable
fun ReferenceScreen(vm: AppViewModel, nav: NavController) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val clipboard = ctx.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
    var q by remember { mutableStateOf("") }
    val cats = remember { listOf("All") + vm.reference.map { it.category }.distinct() }
    var cat by remember { mutableStateOf("All") }
    // derivedStateOf: refilter only when the query or category changes.
    val list by remember {
        androidx.compose.runtime.derivedStateOf {
            vm.reference.filter {
                (cat == "All" || it.category == cat) &&
                    (q.isBlank() || it.name.contains(q, true) || it.desc.contains(q, true))
            }
        }
    }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("📖 Python Reference", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = q, onValueChange = { q = it },
            label = { Text("Search…") }, modifier = Modifier.fillMaxWidth(), singleLine = true
        )
        Spacer(Modifier.height(8.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(cats) { c ->
                FilterChip(
                    selected = cat == c, onClick = { cat = c }, label = { Text(c, maxLines = 1) }
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(list, key = { it.id }) { r ->
                var open by remember { mutableStateOf(false) }
                Card(
                    colors = CardDefaults.cardColors(containerColor = Card),
                    modifier = Modifier.fillMaxWidth().animateItem().clickable { open = !open }
                ) {
                    Column(Modifier.fillMaxWidth().animateContentSize().padding(12.dp)) {
                        Text(r.name, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        if (r.syntax.isNotBlank()) Text(r.syntax, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = TextMuted)
                        if (open) {
                            Spacer(Modifier.height(6.dp))
                            Text(r.desc, fontSize = 13.sp, lineHeight = 20.sp)
                            if (r.example.isNotBlank()) {
                                Spacer(Modifier.height(6.dp))
                                CodeBlock(r.example)
                                Spacer(Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedButton(
                                        onClick = {
                                            clipboard.setPrimaryClip(
                                                android.content.ClipData.newPlainText("skillzify", r.example)
                                            )
                                        },
                                        modifier = Modifier.weight(1f)
                                    ) { Text("📋 Copy code", fontSize = 12.sp, maxLines = 1) }
                                    Button(
                                        onClick = { vm.openInCompiler(r.example); nav.navigate("compiler") },
                                        modifier = Modifier.weight(1f)
                                    ) { Text("▶ Try in compiler", fontSize = 12.sp, maxLines = 1) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
