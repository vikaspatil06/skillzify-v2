package com.skillzify.app.data

import androidx.compose.runtime.Stable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.concurrent.LinkedBlockingQueue

/**
 * Bridge between the Chaquopy Python thread and the Compose terminal UI.
 *
 * Marked @Stable so a panel that takes it as a parameter is skipped when
 * unrelated parent state changes — streaming output then recomposes only
 * the terminal panel itself, never the editor or buttons around it.
 * (Its observable state lives in the StateFlows below, which panels
 * collect locally; the bridge reference itself never changes.)
 *
 * The Python runner calls [onOutput] for every stdout/stderr write (live
 * streaming) and [readLine] when code calls input() — that call blocks the
 * Python thread until the user submits a line from the terminal input row
 * ([submitInput]) or taps Stop ([cancel]). Website Code Studio parity: no
 * separate "program input" field; input happens inline in the terminal.
 *
 * Called from Python via Chaquopy, so methods must stay Java-visible with
 * simple String signatures.
 */
@Stable
class TerminalBridge {
    private val _output = MutableStateFlow("")
    val output: StateFlow<String> = _output

    /** Non-null while Python waits for input (value = the prompt, may be ""). */
    private val _waitingPrompt = MutableStateFlow<String?>(null)
    val waitingPrompt: StateFlow<String?> = _waitingPrompt

    private val queue = LinkedBlockingQueue<String?>()

    @Volatile
    private var cancelled = false

    /** Called from Python for every stdout/stderr write. */
    fun onOutput(text: String) {
        if (text.isNotEmpty()) _output.value += text
    }

    /** Called from Python for input(). Blocks until submitInput/cancel. */
    fun readLine(prompt: String): String? {
        _waitingPrompt.value = prompt
        val line = try {
            queue.take()
        } catch (e: InterruptedException) {
            null
        }
        _waitingPrompt.value = null
        if (line == null || cancelled) return null
        onOutput(line + "\n") // echo, like a real terminal
        return line
    }

    /** Called from the Compose UI when the user submits a terminal line. */
    fun submitInput(line: String) {
        queue.put(line)
    }

    /** Called from the Compose UI on Stop: unblocks any pending readLine. */
    fun cancel() {
        cancelled = true
        queue.offer(null)
    }

    fun reset() {
        cancelled = false
        queue.clear()
        _output.value = ""
        _waitingPrompt.value = null
    }
}
