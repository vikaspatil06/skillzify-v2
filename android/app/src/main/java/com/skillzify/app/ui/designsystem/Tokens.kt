package com.skillzify.app.ui.designsystem

import androidx.compose.ui.unit.dp

/* App 2.0 design system — spacing & radius tokens.
 *
 * Theme.kt already owns COLOUR (website tokens, dark/light, 6 accents)
 * and card shapes; this file adds the missing scales so new screens stop
 * hard-coding dp values. Existing screens keep their current values —
 * tokens are adopted screen-by-screen as Phase B rebuilds them, never
 * by a blanket find-and-replace. */
object Spacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 20.dp
    val xxl = 24.dp
    val xxxl = 32.dp

    /** Standard horizontal screen padding (matches today's 16dp screens). */
    val screen = 16.dp

    /** Vertical gap between cards in a feed (equal-size card discipline). */
    val cardGap = 12.dp
}

object Radius {
    val chip = 999.dp
    val button = 12.dp
    val card = 16.dp
    val sheet = 20.dp
    val hero = 24.dp
}
