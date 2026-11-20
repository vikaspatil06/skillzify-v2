package com.skillzify.app.ui.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import com.skillzify.app.ui.theme.Primary
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.skillzify.app.ui.theme.CardBorder
import com.skillzify.app.ui.theme.GradientBrush
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted

/* App 2.0 design system — new shared components (Phase A1).
 * The existing shared components (WebCard, GradientButton, WebChip,
 * ScreenHeader, CodeBlock) stay in ui/App.kt until the A3 shell rebuild
 * moves them here; nothing in A1 changes their behaviour. */

/**
 * Circular mastery indicator: gradient arc over a faint track, with an
 * optional centre label (e.g. "72%"). Used by the journey map's section
 * nodes and the Today screen's mastery summary in Phase B.
 *
 * @param progress 0f..1f
 */
@Composable
fun MasteryRing(
    progress: Float,
    modifier: Modifier = Modifier,
    size: Dp = 56.dp,
    strokeWidth: Dp = 6.dp,
    label: String? = null
) {
    val clamped = progress.coerceIn(0f, 1f)
    val trackColor = MaterialTheme.colorScheme.surfaceVariant
    // Accessibility: the ring is visual-only, so the whole component
    // announces one clear description ("Mastery 72 percent") instead
    // of leaving a screen reader with an unlabelled canvas + a bare
    // number.
    Box(
        modifier = modifier
            .size(size)
            .clearAndSetSemantics {
                contentDescription = "Mastery ${(clamped * 100).toInt()} percent"
            },
        contentAlignment = Alignment.Center
    ) {
        Canvas(Modifier.size(size)) {
            val stroke = strokeWidth.toPx()
            val inset = stroke / 2
            val arcSize = Size(this.size.width - stroke, this.size.height - stroke)
            val topLeft = Offset(inset, inset)
            drawArc(
                color = trackColor,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round)
            )
            if (clamped > 0f) {
                drawArc(
                    brush = GradientBrush,
                    startAngle = -90f,
                    sweepAngle = 360f * clamped,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round)
                )
            }
        }
        if (label != null) {
            Text(
                label,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

/**
 * The kinder-streak week view (website dashboard "This week", N/5):
 * seven day dots, Monday first; filled = active that day. A missed day
 * is simply an unfilled dot — no broken-streak imagery, no red.
 *
 * @param activeDays indices 0=Monday .. 6=Sunday active this week
 * @param goal weekly goal (website default 5)
 */
@Composable
fun WeekGoalBar(
    activeDays: Set<Int>,
    modifier: Modifier = Modifier,
    goal: Int = 5
) {
    val done = activeDays.size.coerceAtMost(7)
    // Accessibility: one spoken summary for the whole week view.
    Column(
        modifier = modifier.clearAndSetSemantics {
            contentDescription = "$done of $goal days active this week"
        }
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            verticalAlignment = Alignment.CenterVertically
        ) {
            (0..6).forEach { day ->
                val active = day in activeDays
                Box(
                    Modifier
                        .size(14.dp)
                        .clip(CircleShape)
                        .background(
                            if (active) Success
                            else MaterialTheme.colorScheme.surfaceVariant
                        )
                        .border(1.dp, CardBorder, CircleShape)
                )
            }
        }
        Text(
            "$done of $goal days this week",
            color = TextMuted,
            fontSize = 12.sp,
            modifier = Modifier
        )
    }
}

/**
 * Activity heatmap (App 2.0 Phase B): the last [weeks] weeks as a
 * GitHub-style grid — columns are weeks, rows Monday..Sunday, cell
 * intensity from the per-day activity [counts] (days present only in
 * [activeDays] count as 1). Future days in the current week render
 * transparent so the grid keeps its shape.
 *
 * Accessibility: the whole grid announces one summary ("Active on N
 * of the last M days") instead of 100+ meaningless cells.
 */
@Composable
fun ActivityHeatmap(
    counts: Map<String, Int>,
    activeDays: Set<String>,
    weeks: Int = 16,
    modifier: Modifier = Modifier
) {
    val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    // Start: Monday of the week that is (weeks - 1) weeks before this one.
    val start = Calendar.getInstance().apply {
        set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
        add(Calendar.WEEK_OF_YEAR, -(weeks - 1))
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    val today = Calendar.getInstance()
    val emptyColor = MaterialTheme.colorScheme.surfaceVariant
    var activeInRange = 0
    // Precompute the grid so the semantics summary is exact.
    val grid: List<List<Int?>> = (0 until weeks).map { col ->
        (0..6).map { row ->
            val day = (start.clone() as Calendar).apply {
                add(Calendar.DAY_OF_YEAR, col * 7 + row)
            }
            if (day.after(today)) {
                null
            } else {
                val key = fmt.format(day.time)
                val c = counts[key] ?: if (key in activeDays) 1 else 0
                if (c > 0) activeInRange++
                c
            }
        }
    }
    Row(
        modifier = modifier.clearAndSetSemantics {
            contentDescription = "Active on $activeInRange of the last ${weeks * 7} days"
        },
        horizontalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        grid.forEach { column ->
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                column.forEach { c ->
                    val color = when {
                        c == null -> androidx.compose.ui.graphics.Color.Transparent
                        c <= 0 -> emptyColor
                        c == 1 -> Primary.copy(alpha = 0.35f)
                        c == 2 -> Primary.copy(alpha = 0.65f)
                        else -> Primary
                    }
                    Box(
                        Modifier
                            .size(12.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(color)
                    )
                }
            }
        }
    }
}
