package com.skillzify.app.ui.designsystem

import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics

/* App 2.0 — accessibility helpers (Phase B).
 *
 * Small, deliberate tools used across the Phase B screens:
 *  - heading(): screen/section titles become TalkBack headings, so a
 *    screen-reader user can jump section to section instead of
 *    swiping through every element.
 *  - a11yLabel(): the text equivalent for visual-only indicators
 *    (rings, bars, icon tiles) — the compact UI leans on visuals, so
 *    every visual carries words.
 *  - rememberReducedMotion(): honours the system animator scale —
 *    when the user has animations off, Phase B screens must not
 *    animate transitions or celebrations. */

/** Marks this text as a heading for screen-reader navigation. */
fun Modifier.heading(): Modifier = semantics { heading() }

/** Gives a visual-only element its spoken description. */
fun Modifier.a11yLabel(label: String): Modifier =
    semantics { contentDescription = label }

/** True when the user has turned animations off system-wide. */
@Composable
fun rememberReducedMotion(): Boolean {
    val ctx = LocalContext.current
    return remember {
        try {
            Settings.Global.getFloat(
                ctx.contentResolver,
                Settings.Global.ANIMATOR_DURATION_SCALE,
                1f
            ) == 0f
        } catch (e: Exception) {
            false
        }
    }
}
