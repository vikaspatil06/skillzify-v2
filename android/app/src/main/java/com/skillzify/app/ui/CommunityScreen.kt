package com.skillzify.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.CommunityRepository

/* CommunityRepository is a class (not an object) and its item types are
   nested inside it — aliased here so the screen code stays readable. */
private typealias QItem = CommunityRepository.QItem
private typealias AItem = CommunityRepository.AItem
private typealias SItem = CommunityRepository.SItem
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import com.skillzify.app.ui.theme.Warning
import kotlinx.coroutines.launch

/* Community — Skillzify Circle (web community.html), Questions | Showcase
   tabs over CommunityRepository. All loads run in LaunchedEffect with
   loading/error states and fail soft (an error line, never a crash).
   Signed-out users never reach this screen (the app is auth-gated), but
   every write is still guarded on the Firebase user being present, and
   the repository is the authority — mirroring the web's sign-in gate.
   On load, when signed in, the user's community flags are fetched and
   handed to vm.refreshCommunityBadges(...) untouched (badge state —
   e.g. a new best answer on your question — lives in the VM). */
@Composable
fun CommunityScreen(vm: AppViewModel, nav: NavController) {
    val user by vm.firebaseUser.collectAsStateWithLifecycle()
    val uid = user?.uid ?: ""
    val myName = vm.profileName().ifBlank { user?.displayName ?: "Learner" }
    var tab by remember { mutableStateOf(0) } // 0 questions, 1 showcase
    var openQuestionId by remember { mutableStateOf<String?>(null) }
    val repo = remember { CommunityRepository() }

    LaunchedEffect(uid) {
        if (uid.isNotBlank()) {
            try {
                // fetchMyCommunityFlags returns (hasBestAnswer, hasShowcaseStar);
                // the VM's refreshCommunityBadges takes the two flags.
                val (hasBest, hasStar) = repo.fetchMyCommunityFlags(uid)
                vm.refreshCommunityBadges(hasBest, hasStar)
            } catch (e: Exception) { /* badges are best-effort */ }
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        ScreenHeader(
            "🤝 Skillzify Circle",
            "Ask questions, get answers, and show what you built — with real, runnable code.",
            onBack = { nav.popBackStack() }
        )
        Row(
            Modifier.fillMaxWidth().padding(vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(selected = tab == 0, onClick = { tab = 0; openQuestionId = null },
                label = { Text("Questions") })
            FilterChip(selected = tab == 1, onClick = { tab = 1; openQuestionId = null },
                label = { Text("Showcase") })
        }
        val qid = openQuestionId
        when {
            tab == 0 && qid != null -> QuestionDetail(
                vm, repo, qid, uid, myName,
                onBack = { openQuestionId = null }
            )
            tab == 0 -> QuestionsTab(vm, repo, uid, myName) { openQuestionId = it }
            else -> ShowcaseTab(vm, repo, uid, myName, nav)
        }
    }
}

@Composable
private fun QuestionsTab(vm: AppViewModel, repo: CommunityRepository, uid: String, myName: String, onOpen: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var questions by remember { mutableStateOf<List<QItem>>(emptyList()) }
    var showAsk by remember { mutableStateOf(false) }
    var reloadTick by remember { mutableStateOf(0) }

    LaunchedEffect(reloadTick) {
        loading = true; error = null
        try {
            questions = repo.fetchQuestions(50)
        } catch (e: Exception) {
            error = "Community is unavailable right now. ${e.message ?: ""}".trim()
        }
        loading = false
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Questions", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Button(onClick = { showAsk = !showAsk }) {
                Text(if (showAsk) "Close form" else "Ask a question", maxLines = 1)
            }
        }
        if (showAsk) {
            AskQuestionForm(
                onSubmit = { title, topic, body ->
                    scope.launch {
                        val newId = try { repo.postQuestion(uid, myName, title, body, topic) }
                            catch (e: Exception) { null }
                        if (newId != null) {
                            showAsk = false
                            reloadTick++
                        } else {
                            error = "Could not post your question — check your connection and try again."
                        }
                    }
                }
            )
        }
        when {
            loading -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                CircularProgressIndicator(Modifier.padding(24.dp))
            }
            error != null -> Text(error!!, color = Warning, fontSize = 13.sp)
            questions.isEmpty() -> Text(
                "No questions yet — be the first to ask!", color = TextMuted, fontSize = 13.sp
            )
            else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(questions, key = { it.id }) { q ->
                    WebCard(onClick = { onOpen(q.id) }) {
                        Column(Modifier.padding(14.dp)) {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(q.title, fontWeight = FontWeight.Bold, fontSize = 15.sp,
                                    modifier = Modifier.weight(1f))
                                if (!q.bestAnswerId.isNullOrBlank()) {
                                    WebChip("✓ Answered", Success)
                                }
                            }
                            Row(
                                Modifier.padding(top = 4.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(q.authorName, color = TextMuted, fontSize = 12.sp)
                                if (q.topic.isNotBlank()) WebChip(q.topic)
                                Text(
                                    "💬 ${q.answersCount}",
                                    color = TextMuted, fontSize = 12.sp
                                )
                            }
                            if (q.body.isNotBlank()) {
                                Text(q.body.take(140) + if (q.body.length > 140) "…" else "",
                                    color = TextMuted, fontSize = 13.sp,
                                    modifier = Modifier.padding(top = 4.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AskQuestionForm(onSubmit: (String, String, String) -> Unit) {
    var title by remember { mutableStateOf("") }
    var topic by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    WebCard(Modifier.padding(bottom = 10.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Ask a question", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            OutlinedTextField(
                value = title, onValueChange = { title = it },
                label = { Text("Title") }, singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = topic, onValueChange = { topic = it },
                label = { Text("Topic (e.g. loops)") }, singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = body, onValueChange = { body = it },
                label = { Text("Details — what did you try?") },
                modifier = Modifier.fillMaxWidth().height(110.dp)
            )
            formError?.let { Text(it, color = Warning, fontSize = 12.sp) }
            Button(
                onClick = {
                    // Web validation (community.js validateQuestion).
                    when {
                        title.trim().length < 5 -> formError = "Give your question a title (at least 5 characters)."
                        title.trim().length > 140 -> formError = "Keep the title under 140 characters."
                        body.length > 4000 -> formError = "Keep the details under 4,000 characters."
                        else -> onSubmit(title.trim(), topic.trim(), body)
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) { Text("Post question", maxLines = 1) }
        }
    }
}

@Composable
private fun QuestionDetail(
    vm: AppViewModel,
    repo: CommunityRepository,
    qid: String,
    uid: String,
    myName: String,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var question by remember { mutableStateOf<QItem?>(null) }
    var answers by remember { mutableStateOf<List<AItem>>(emptyList()) }
    var reloadTick by remember { mutableStateOf(0) }
    var myAnswer by remember { mutableStateOf("") }

    LaunchedEffect(qid, reloadTick) {
        loading = true; error = null
        try {
            // No single-question fetch in the contract: find it in the list.
            question = repo.fetchQuestions(50).firstOrNull { it.id == qid }
            answers = repo.fetchAnswers(qid)
        } catch (e: Exception) {
            error = "Could not load this question. ${e.message ?: ""}".trim()
        }
        loading = false
    }

    LazyColumn(
        Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            OutlinedButton(onClick = onBack) { Text("← All questions", maxLines = 1) }
        }
        if (loading) {
            item { CircularProgressIndicator(Modifier.padding(16.dp)) }
            return@LazyColumn
        }
        error?.let {
            item { Text(it, color = Warning, fontSize = 13.sp) }
        }
        val q = question
        if (q == null) {
            item { Text("Question not found (it may be older than the latest 50).", color = TextMuted, fontSize = 13.sp) }
            return@LazyColumn
        }
        item {
            WebCard {
                Column(Modifier.padding(16.dp)) {
                    Text(q.title, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Row(
                        Modifier.padding(top = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(q.authorName, color = TextMuted, fontSize = 12.sp)
                        if (q.topic.isNotBlank()) WebChip(q.topic)
                        if (!q.bestAnswerId.isNullOrBlank()) WebChip("✓ Answered", Success)
                    }
                    if (q.body.isNotBlank()) {
                        Text(q.body, fontSize = 14.sp, lineHeight = 20.sp,
                            modifier = Modifier.padding(top = 8.dp))
                    }
                }
            }
        }
        item {
            Text("💬 ${answers.size} answer${if (answers.size == 1) "" else "s"}",
                fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }
        items(answers, key = { it.id }) { a ->
            val isBest = q.bestAnswerId == a.id || a.isBest
            WebCard {
                Column(Modifier.padding(14.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(a.authorName, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        if (isBest) WebChip("⭐ Best answer", Success)
                    }
                    Text(a.body, fontSize = 14.sp, lineHeight = 20.sp,
                        modifier = Modifier.padding(top = 6.dp))
                    // Mark-best: only the question's author, like the web.
                    if (uid.isNotBlank() && q.uid == uid && !isBest) {
                        Spacer(Modifier.height(6.dp))
                        OutlinedButton(onClick = {
                            scope.launch {
                                val ok = try { repo.markBest(q.id, a.id, a.uid) }
                                    catch (e: Exception) { false }
                                if (ok) reloadTick++
                                else error = "Could not mark the best answer.
                            }
                        }) { Text("⭐ Mark as best answer", fontSize = 12.sp, maxLines = 1) }
                    }
                }
            }
        }
        item {
            if (uid.isNotBlank()) {
                WebCard {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Your answer", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        OutlinedTextField(
                            value = myAnswer, onValueChange = { myAnswer = it },
                            label = { Text("Write a helpful answer…") },
                            modifier = Modifier.fillMaxWidth().height(100.dp)
                        )
                        Button(
                            onClick = {
                                val text = myAnswer
                                if (text.isBlank()) return@Button
                                scope.launch {
                                    val newId = try { repo.postAnswer(q.id, uid, myName, text) }
                                        catch (e: Exception) { null }
                                    if (newId != null) {
                                        myAnswer = ""
                                        reloadTick++
                                    } else {
                                        error = "Could not post your answer."
                                    }
                                }
                            },
                            enabled = myAnswer.isNotBlank(),
                            modifier = Modifier.fillMaxWidth()
                        ) { Text("Post answer", maxLines = 1) }
                    }
                }
            } else {
                Text("Sign in to answer.", color = TextMuted, fontSize = 13.sp)
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun ShowcaseTab(vm: AppViewModel, repo: CommunityRepository, uid: String, myName: String, nav: NavController) {
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var posts by remember { mutableStateOf<List<SItem>>(emptyList()) }
    var showForm by remember { mutableStateOf(false) }
    var reloadTick by remember { mutableStateOf(0) }
    val starred = remember { mutableStateOf<Set<String>>(emptySet()) }

    LaunchedEffect(reloadTick) {
        loading = true; error = null
        try {
            posts = repo.fetchShowcase()
        } catch (e: Exception) {
            error = "Showcase is unavailable right now. ${e.message ?: ""}".trim()
        }
        loading = false
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Showcase", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Button(onClick = { showForm = !showForm }) {
                Text(if (showForm) "Close form" else "Share a project", maxLines = 1)
            }
        }
        if (showForm) {
            ShowcaseForm(
                onSubmit = { title, desc, code ->
                    scope.launch {
                        val newId = try { repo.postShowcase(uid, myName, title, desc, code) }
                            catch (e: Exception) { null }
                        if (newId != null) {
                            showForm = false
                            reloadTick++
                        } else {
                            error = "Could not share your project."
                        }
                    }
                }
            )
        }
        when {
            loading -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                CircularProgressIndicator(Modifier.padding(24.dp))
            }
            error != null -> Text(error!!, color = Warning, fontSize = 13.sp)
            posts.isEmpty() -> Text(
                "Nothing showcased yet — share the first project!", color = TextMuted, fontSize = 13.sp
            )
            else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(posts, key = { it.id }) { s ->
                    val isStarred = s.id in starred.value
                    WebCard {
                        Column(Modifier.padding(14.dp)) {
                            Text(s.title, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("by ${s.authorName}", color = TextMuted, fontSize = 12.sp,
                                modifier = Modifier.padding(top = 2.dp))
                            if (s.desc.isNotBlank()) {
                                Text(s.desc, color = TextMuted, fontSize = 13.sp,
                                    modifier = Modifier.padding(top = 4.dp))
                            }
                            if (s.code.isNotBlank()) {
                                Spacer(Modifier.height(6.dp))
                                CodeBlock(s.code.take(600))
                            }
                            Row(
                                Modifier.fillMaxWidth().padding(top = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedButton(
                                    onClick = {
                                        scope.launch {
                                            // starShowcase returns "starred AFTER
                                            // the call" (false also covers failure
                                            // and the no-self-star refusal).
                                            val nowStarred = try { repo.starShowcase(s) }
                                                catch (e: Exception) { isStarred }
                                            starred.value = if (nowStarred) starred.value + s.id
                                                else starred.value - s.id
                                            reloadTick++
                                        }
                                    },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(
                                        if (isStarred) "★ ${s.stars}" else "☆ ${s.stars}",
                                        fontSize = 13.sp, maxLines = 1
                                    )
                                }
                                if (s.code.isNotBlank()) {
                                    OutlinedButton(
                                        onClick = { vm.openInCompiler(s.code); nav.navigate("compiler") },
                                        modifier = Modifier.weight(1f)
                                    ) { Text("▶ Run in Studio", fontSize = 13.sp, maxLines = 1) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShowcaseForm(onSubmit: (String, String, String) -> Unit) {
    var title by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    WebCard(Modifier.padding(bottom = 10.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Share a project", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            OutlinedTextField(
                value = title, onValueChange = { title = it },
                label = { Text("Title") }, singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = desc, onValueChange = { desc = it },
                label = { Text("Description") },
                modifier = Modifier.fillMaxWidth().height(80.dp)
            )
            OutlinedTextField(
                value = code, onValueChange = { code = it },
                label = { Text("Code (so others can run it)") },
                modifier = Modifier.fillMaxWidth().height(130.dp)
            )
            formError?.let { Text(it, color = Warning, fontSize = 12.sp) }
            Button(
                onClick = {
                    // Web validation (community.js validateShowcase).
                    when {
                        title.trim().length < 3 -> formError = "Give your project a title (at least 3 characters)."
                        title.trim().length > 100 -> formError = "Keep the title under 100 characters."
                        desc.length > 2000 -> formError = "Keep the description under 2,000 characters."
                        code.isBlank() -> formError = "Add the code for your project so others can run it."
                        code.length > 20000 -> formError = "Keep the code under 20,000 characters."
                        else -> onSubmit(title.trim(), desc, code)
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) { Text("Share project", maxLines = 1) }
        }
    }
}
