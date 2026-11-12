package com.skillzify.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.skillzify.app.data.Store

/* ---------- Theme state (website parity: dark/light + 6 accents) ----------
   Colours are the website's style.css :root variables, verbatim:

     --bg:#0a0f22  --bg-soft:#0e1430  --card:#141b3d
     --card-border:rgba(255,255,255,.08)  --text:#eef1ff  --muted:#9aa3c7
     --primary:#6c7bff  --primary-2:#9d6bff  --accent:#22d3ee
     --success:#34d399  --warning:#fbbf24  --danger:#f87171
     --gradient:linear-gradient(135deg, primary 0%, primary-2 55%, accent 130%)
     --radius:16px  --code-bg:#0b1128

   Light theme ([data-theme="light"]): --bg:#f4f6ff --bg-soft:#eef1fb
   --card:#ffffff --text:#141a33 --muted:#5b648c --code-bg:#101737.

   Colors are computed getters over this state, so every screen that reads
   Card/TextMuted/etc. recomposes on a theme change — no screen edits needed. */

var themeDarkState = mutableStateOf(true)
    private set
var themeAccentState = mutableStateOf(0)
    private set

fun syncThemeFromStore(store: Store) {
    themeDarkState.value = store.getThemeDark()
    themeAccentState.value = store.getThemeAccent()
}

fun applyTheme(dark: Boolean, accent: Int) {
    themeDarkState.value = dark
    themeAccentState.value = accent
}

data class AccentTheme(val name: String, val primary: Color, val primary2: Color, val accent: Color)

/* Accent palettes = style.css [data-accent=...] blocks (indigo = :root). */
val ACCENTS = listOf(
    AccentTheme("Indigo", Color(0xFF6C7BFF), Color(0xFF9D6BFF), Color(0xFF22D3EE)),
    AccentTheme("Ocean", Color(0xFF22D3EE), Color(0xFF38BDF8), Color(0xFF6C7BFF)),
    AccentTheme("Sunset", Color(0xFFFB923C), Color(0xFFF472B6), Color(0xFFFBBF24)),
    AccentTheme("Forest", Color(0xFF34D399), Color(0xFF22D3EE), Color(0xFFA3E635)),
    AccentTheme("Amethyst", Color(0xFF9D6BFF), Color(0xFFE879F9), Color(0xFF6C7BFF)),
    AccentTheme("Rose", Color(0xFFFB7185), Color(0xFFF472B6), Color(0xFFFDA4AF))
)

private val currentAccent: AccentTheme
    get() = ACCENTS[themeAccentState.value.coerceIn(0, ACCENTS.size - 1)]

private val isDark: Boolean get() = themeDarkState.value

val Primary: Color get() = currentAccent.primary
val Primary2: Color get() = currentAccent.primary2
val Accent: Color get() = currentAccent.accent
val Bg: Color get() = if (isDark) Color(0xFF0A0F22) else Color(0xFFF4F6FF)
val BgSoft: Color get() = if (isDark) Color(0xFF0E1430) else Color(0xFFEEF1FB)
val Card: Color get() = if (isDark) Color(0xFF141B3D) else Color(0xFFFFFFFF)
/** --card-border: white 8% on dark, ink 8% on light. */
val CardBorder: Color get() = if (isDark) Color(0x14FFFFFF) else Color(0x14141A33)
val TextMain: Color get() = if (isDark) Color(0xFFEEF1FF) else Color(0xFF141A33)
val TextMuted: Color get() = if (isDark) Color(0xFF9AA3C7) else Color(0xFF5B648C)
val CodeBg: Color get() = if (isDark) Color(0xFF0B1128) else Color(0xFF101737)
val Success: Color get() = Color(0xFF34D399)
val Warning: Color get() = Color(0xFFFBBF24)
val Danger: Color get() = Color(0xFFF87171)

/** Website --gradient: linear-gradient(135deg, primary, primary-2 55%, accent 130%). */
val GradientBrush: Brush
    get() = Brush.linearGradient(
        colors = listOf(currentAccent.primary, currentAccent.primary2, currentAccent.accent),
        // Approximate the web's 135deg diagonal + 55%/130% stops with a
        // longer end point; Brush stops beyond 1f are not expressible, so
        // the accent lands at the far corner instead.
        start = androidx.compose.ui.geometry.Offset(0f, 0f),
        end = androidx.compose.ui.geometry.Offset(420f, 420f)
    )

/** Website --radius: 16px on cards, 20px on the auth form-card, 12px buttons. */
val WebShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(24.dp)
)

@Composable
fun SkillzifyTheme(content: @Composable () -> Unit) {
    // State reads subscribe this composable: a theme change recomposes the tree.
    val dark = themeDarkState.value
    val accent = currentAccent
    val scheme = if (dark) {
        darkColorScheme(
            primary = accent.primary,
            onPrimary = Color.White,
            secondary = accent.primary2,
            tertiary = accent.accent,
            background = Bg,
            surface = Card,
            surfaceVariant = BgSoft,
            onBackground = TextMain,
            onSurface = TextMain,
            onSurfaceVariant = TextMuted,
            outline = CardBorder,
            error = Danger
        )
    } else {
        lightColorScheme(
            primary = accent.primary,
            onPrimary = Color.White,
            secondary = accent.primary2,
            tertiary = accent.accent,
            background = Bg,
            surface = Card,
            surfaceVariant = BgSoft,
            onBackground = TextMain,
            onSurface = TextMain,
            onSurfaceVariant = TextMuted,
            outline = CardBorder,
            error = Danger
        )
    }
    MaterialTheme(colorScheme = scheme, shapes = WebShapes, content = content)
}
