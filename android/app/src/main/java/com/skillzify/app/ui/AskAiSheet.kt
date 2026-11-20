package com.skillzify.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.skillzify.app.data.AiRepository
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.TextMuted
import kotlinx.coroutines.launch

/* App 2.0 Phase A3 — the global Ask AI sheet, opened from the floating
 * button on every tab. It calls the SAME backend and tutor mode as the
 * website (AiRepository.ask with the default mode), passes the current
 * tab as context, and follows the app's established AI error rules:
 * server cap messages (DAILY_CAP / POOL_CAP) are shown verbatim; other
 * failures get a plain retry message. Nothing is stored — the sheet's
 * state dies with it, exactly like the website's per-page AI chat
 * before the persistent-chat upgrade (which is a Phase C item). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AskAiSheet(contextLabel: String, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    var question by remember { mutableStateOf("") }
    var answer by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun ask() {
        val q = question.trim()
        if (q.isEmpty() || busy) return
        busy = true
        answer = null
        error = null
        scope.launch {
            val res = AiRepository.ask(
                code = q,
                error = "",
                mode = "",
                context = "The learner is on the $contextLabel tab of the Skillzify Android app. Answer as their Python tutor."
            )
            busy = false
            res.onSuccess { text -> answer = text }
                .onFailure { e ->
                    val code = (e as? AiRepository.AiError.Provider)?.code ?: ""
                    error = if (code == "DAILY_CAP" || code == "POOL_CAP") {
                        e.message ?: "Daily AI limit reached."
                    } else {
                        "AI unavailable right now (${e.message ?: "network error"}). Try again in a bit."
                    }
                }
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text("✦ Ask AI", fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(4.dp))
            Text(
                "Your Python tutor — same AI as the website. You're on the $contextLabel tab.",
                color = TextMuted, fontSize = 12.sp, lineHeight = 17.sp
            )
            Spacer(Modifier.height(14.dp))
            OutlinedTextField(
                value = question,
                onValueChange = { question = it },
                label = { Text("Ask anything about Python…") },
                minLines = 2,
                maxLines = 4,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            GradientButton(
                text = if (busy) "Thinking…" else "Ask",
                enabled = question.isNotBlank() && !busy,
                modifier = Modifier.fillMaxWidth()
            ) { ask() }
            if (error != null) {
                Spacer(Modifier.height(14.dp))
                Text(error!!, color = Danger, fontSize = 13.sp, lineHeight = 19.sp)
            }
            if (answer != null) {
                Spacer(Modifier.height(14.dp))
                Text(answer!!, fontSize = 14.sp, lineHeight = 21.sp)
            }
        }
    }
}
