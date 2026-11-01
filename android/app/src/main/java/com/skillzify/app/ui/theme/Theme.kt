package com.skillzify.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Bg = Color(0xFF0A0F22)
val BgSoft = Color(0xFF0E1430)
val Card = Color(0xFF141B3D)
val Primary = Color(0xFF6C7BFF)
val Accent = Color(0xFF22D3EE)
val TextMain = Color(0xFFEEF1FF)
val TextMuted = Color(0xFF9AA3C7)
val Success = Color(0xFF34D399)
val Warning = Color(0xFFFBBF24)
val Danger = Color(0xFFF87171)
val CodeBg = Color(0xFF0B1128)

private val SkillzifyScheme = darkColorScheme(
    primary = Primary,
    secondary = Accent,
    tertiary = Accent,
    background = Bg,
    surface = Card,
    surfaceVariant = BgSoft,
    onBackground = TextMain,
    onSurface = TextMain,
    onSurfaceVariant = TextMuted,
    error = Danger
)

@Composable
fun SkillzifyTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = SkillzifyScheme, content = content)
}
