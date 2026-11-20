package com.skillzify.app.ui.designsystem

import androidx.compose.ui.unit.dp

/* App 2.0 — COMPACT density scale (Phase B, Vikas's directive:
 * "deliberately compressed but accessible").
 *
 * The rule, stated once and applied everywhere Phase B builds:
 * compression comes from SPACING and VISUAL WEIGHT — tighter gaps,
 * tighter card padding, one-line secondary text — never from the
 * things accessibility depends on:
 *
 *  - Touch targets stay >= 48dp (minTouchTarget), even when the
 *    visual element is smaller (padding absorbs the difference).
 *  - Primary text stays >= 14sp, secondary >= 12sp; nothing shrinks
 *    below that, and all text scales with the system font size
 *    (sp units everywhere, no fixed-px text).
 *  - Contrast comes from the theme tokens, which already meet it.
 *  - Every visual-only indicator (rings, bars, dots) carries a text
 *    equivalent via semantics (see A11y.kt and the components).
 *
 * Phase B screens use Density; Phase A screens keep Spacing until
 * they are rebuilt. */
object Density {
    /** Screen edge padding — 2dp tighter than the legacy 16. */
    val screen = 14.dp

    /** Card inner padding — the main compression lever. */
    val cardPadding = 12.dp

    val gapXs = 4.dp
    val gapSm = 6.dp
    val gapMd = 8.dp
    val gapLg = 12.dp

    /** Compact list row height — dense, still above the 48dp floor. */
    val rowMinHeight = 52.dp

    /** Android accessibility minimum for any interactive element. */
    val minTouchTarget = 48.dp
}
