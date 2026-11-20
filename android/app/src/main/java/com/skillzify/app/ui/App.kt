package com.skillzify.app.ui

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.skillzify.app.AppViewModel
import com.skillzify.app.ui.theme.Bg
import com.skillzify.app.ui.theme.CardBorder
import com.skillzify.app.ui.theme.CodeBg
import com.skillzify.app.ui.theme.GradientBrush
import com.skillzify.app.ui.theme.Primary
import com.skillzify.app.ui.theme.TextMuted

/* App 2.0 information architecture (Phase A3): five tabs —
   Today (the dashboard, renamed), Learn (journey, lessons, paths,
   reference, library hub), Studio (Code Studio, Flowchart Lab,
   projects), Arena (practice, placement, community; interview and
   leaderboard land here in Phase B) and Profile (the old You hub,
   passport, concept map, admin). All pre-2.0 routes are unchanged;
   only the grouping and labels moved. The global Ask AI floating
   button opens AskAiSheet from every tab. */
private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("dashboard", "Today", Icons.Filled.Home),
    Tab("learn", "Learn", Icons.Filled.School),
    Tab("compiler", "Studio", Icons.Filled.Terminal),
    Tab("arena", "Arena", Icons.Filled.FitnessCenter),
    Tab("you", "Profile", Icons.Filled.Person)
)

/** Routes that belong to a tab, for bottom-bar highlighting. */
private fun tabFor(route: String): String = when (route) {
    "dashboard", "review" -> "dashboard"
    "learn", "lesson", "paths", "path", "reference", "library" -> "learn"
    "compiler", "flowchart", "projects", "project" -> "compiler"
    "arena", "practice", "exercise", "placement", "community", "interview", "leaderboard" -> "arena"
    "you", "passport", "map", "admin" -> "you"
    else -> route
}

@Composable
fun SkillzifyApp(vm: AppViewModel = viewModel()) {
    val firebaseUser by vm.firebaseUser.collectAsStateWithLifecycle()

    if (firebaseUser == null) {
        // Logged out → auth gate. Session persists via Firebase, so a
        // returning user lands straight in the app.
        AuthScreen(vm)
        return
    }

    if (!vm.catalogLoaded) {
        // Catalog JSON parses on IO (startup hitch fix) — show a splash
        // instead of a frozen frame. No screen touches vm.catalog before this.
        Box(
            Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading your lessons…", color = TextMuted, fontSize = 14.sp)
            }
        }
        return
    }

    val nav = rememberNavController()
    var showAskAi by remember { mutableStateOf(false) }
    val backStack by nav.currentBackStackEntryAsState()
    val rawRoute = backStack?.destination?.route ?: "dashboard"
    val current = tabFor(
        rawRoute.substringBefore("/").substringBefore("?").substringBefore("{")
    )

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = CodeBg) {
                tabs.forEach { t ->
                    NavigationBarItem(
                        selected = current == t.route,
                        onClick = {
                            nav.navigate(t.route) {
                                popUpTo("dashboard") { inclusive = false }
                                launchSingleTop = true
                            }
                        },
                        icon = { Icon(t.icon, contentDescription = t.label) },
                        label = { Text(t.label, maxLines = 1, fontSize = 11.sp) }
                    )
                }
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAskAi = true },
                shape = RoundedCornerShape(16.dp),
                containerColor = Primary,
                contentColor = Color.White
            ) {
                Icon(Icons.Filled.AutoAwesome, contentDescription = "Ask AI")
            }
        },
        containerColor = Bg
    ) { pad ->
        // Screen transitions: a short slide + fade on every navigation, so
        // moving between tabs and detail screens feels continuous instead
        // of cutting instantly. 300ms matches Material motion guidance.
        NavHost(
            navController = nav,
            startDestination = "dashboard",
            modifier = Modifier.padding(pad),
            enterTransition = {
                slideInHorizontally(tween(300), initialOffsetX = { it / 4 }) + fadeIn(tween(300))
            },
            exitTransition = {
                slideOutHorizontally(tween(300), targetOffsetX = { -it / 4 }) + fadeOut(tween(300))
            },
            popEnterTransition = {
                slideInHorizontally(tween(300), initialOffsetX = { -it / 4 }) + fadeIn(tween(300))
            },
            popExitTransition = {
                slideOutHorizontally(tween(300), targetOffsetX = { it / 4 }) + fadeOut(tween(300))
            }
        ) {
            // App 2.0 Phase B: Today replaces the Dashboard content
            // (DashboardTab remains in the tree as the fallback).
            composable("dashboard") { TodayScreen(vm, nav) }
            composable("review") { ReviewScreen(vm, nav) }
            composable(
                "learn?section={section}",
                arguments = listOf(navArgument("section") {
                    type = NavType.StringType; nullable = true; defaultValue = null
                })
            ) { entry ->
                LearnTab(vm, nav, entry.arguments?.getString("section"))
            }
            composable("arena") { ArenaScreen(vm, nav) }
            composable("interview") { InterviewScreen(vm, nav) }
            composable("leaderboard") { LeaderboardScreen(vm, nav) }
            composable("practice") { PracticeTab(vm, nav) }
            composable("compiler") { CompilerTab(vm) }
            composable("you") { ProfileScreen(vm, nav) }
            composable("library") { LibraryTab(vm, nav) }
            composable("placement") { PlacementScreen(vm, nav) }
            composable("passport") { PassportScreen(vm, nav) }
            composable("map") { ConceptMapScreen(vm, nav) }
            composable("community") { CommunityScreen(vm, nav) }
            composable("admin") { AdminScreen(vm, nav) }
            composable(
                "lesson/{id}",
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { entry ->
                LessonDetail(vm, entry.arguments!!.getString("id")!!, nav)
            }
            composable(
                "exercise/{id}",
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { entry ->
                ExerciseDetail(vm, entry.arguments!!.getString("id")!!, nav)
            }
            composable("paths") { PathsScreen(vm, nav) }
            composable(
                "path/{id}",
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { entry ->
                PathDetail(vm, entry.arguments!!.getString("id")!!, nav)
            }
            composable("projects") { ProjectsScreen(vm, nav) }
            composable(
                "project/{id}",
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { entry ->
                ProjectDetail(vm, entry.arguments!!.getString("id")!!, nav)
            }
            composable("reference") { ReferenceScreen(vm, nav) }
            composable("flowchart") { FlowchartScreen(vm, nav) }
        }
    }

    if (showAskAi) {
        AskAiSheet(
            contextLabel = tabs.firstOrNull { it.route == current }?.label ?: "Skillzify",
            onDismiss = { showAskAi = false }
        )
    }
}

/* ================= Shared website-style components =================
   style.css: .card { background:var(--card); border:1px solid
   var(--card-border); border-radius:16px } and .btn { gradient, 12px
   radius, white bold text } / .btn-ghost { card bg + border }. */

/** Website .card — surface colour, 1dp card-border, 16dp radius. */
@Composable
fun WebCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(16.dp),
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, CardBorder, RoundedCornerShape(16.dp))
            // Accessibility: a tappable card announces as a Button.
            .then(
                if (onClick != null) Modifier.clickable(role = Role.Button) { onClick() }
                else Modifier
            ),
        content = { content() }
    )
}

/** Website .btn — gradient primary button, 12dp radius. */
@Composable
fun GradientButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.Transparent,
            disabledContainerColor = Color.Transparent
        ),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
        modifier = modifier.height(48.dp)
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .alpha(if (enabled) 1f else 0.5f)
                .background(GradientBrush, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text, color = Color.White, fontWeight = FontWeight.Bold,
                fontSize = 15.sp, maxLines = 1,
                modifier = Modifier.padding(horizontal = 16.dp)
            )
        }
    }
}

/** Small pill chip in website badge style (bg-soft fill, muted text). */
@Composable
fun WebChip(text: String, color: Color = TextMuted) {
    Box(
        Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .border(1.dp, CardBorder, RoundedCornerShape(999.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(text, color = color, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

/** Page title block used at the top of the new screens (website page-hero). */
@Composable
fun ScreenHeader(title: String, sub: String? = null, onBack: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth()) {
        if (onBack != null) {
            Text(
                "← Back", color = MaterialTheme.colorScheme.primary,
                fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable { onBack() }.padding(vertical = 4.dp)
            )
        }
        // Accessibility: page titles are TalkBack headings (Phase B retrofit).
        Text(
            title, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.semantics { heading() }
        )
        if (sub != null) {
            Text(sub, color = TextMuted, fontSize = 13.sp, lineHeight = 19.sp,
                modifier = Modifier.padding(top = 4.dp))
        }
    }
}

/** Monospace code block with horizontal scrolling. */
@Composable
fun CodeBlock(code: String, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(CodeBg)
            .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
            .padding(14.dp)
    ) {
        Text(
            text = code,
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp,
            lineHeight = 19.sp,
            color = Color(0xFFCDD6FF),
            modifier = Modifier.horizontalScroll(rememberScrollState())
        )
    }
}
