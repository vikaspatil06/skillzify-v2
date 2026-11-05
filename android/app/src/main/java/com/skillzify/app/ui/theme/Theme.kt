package com.skillzify.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.Color
import com.skillzify.app.data.Store

/* ---------- Theme state (website parity: dark/light + 6 accents) ----------
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
val Accent: Color get() = currentAccent.accent
val Bg: Color get() = if (isDark) Color(0xFF0A0F22) else Color(0xFFF1F3FF)
val BgSoft: Color get() = if (isDark) Color(0xFF0E1430) else Color(0xFFE4E8FF)
val Card: Color get() = if (isDark) Color(0xFF141B3D) else Color(0xFFFFFFFF)
val TextMain: Color get() = if (isDark) Color(0xFFEEF1FF) else Color(0xFF141B3D)
val TextMuted: Color get() = if (isDark) Color(0xFF9AA3C7) else Color(0xFF5B637F)
val CodeBg: Color get() = if (isDark) Color(0xFF0B1128) else Color(0xFF141B3D)
val Success: Color get() = Color(0xFF34D399)
val Warning: Color get() = Color(0xFFFBBF24)
val Danger: Color get() = Color(0xFFF87171)

@Composable
fun SkillzifyTheme(content: @Composable () -> Unit) {
    // State reads subscribe this composable: a theme change recomposes the tree.
    val dark = themeDarkState.value
    val accent = currentAccent
    val scheme = if (dark) {
        darkColorScheme(
            primary = accent.primary,
            secondary = accent.accent,
            tertiary = accent.accent,
            background = Bg,
            surface = Card,
            surfaceVariant = BgSoft,
            onBackground = TextMain,
            onSurface = TextMain,
            onSurfaceVariant = TextMuted,
            error = Danger
        )
    } else {
        lightColorScheme(
            primary = accent.primary,
            secondary = accent.accent,
            tertiary = accent.accent,
            background = Bg,
            surface = Card,
            surfaceVariant = BgSoft,
            onBackground = TextMain,
            onSurface = TextMain,
            onSurfaceVariant = TextMuted,
            error = Danger
        )
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
