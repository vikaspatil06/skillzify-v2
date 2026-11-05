package com.skillzify.app.ui

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.LibraryBooks
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
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
import com.skillzify.app.ui.theme.CodeBg
import com.skillzify.app.ui.theme.TextMuted

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("learn", "Learn", Icons.Filled.School),
    Tab("practice", "Practice", Icons.Filled.FitnessCenter),
    Tab("compiler", "Compiler", Icons.Filled.Terminal),
    Tab("library", "Library", Icons.Filled.LibraryBooks),
    Tab("dashboard", "Dashboard", Icons.Filled.Dashboard)
)

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
    val backStack by nav.currentBackStackEntryAsState()
    val current = backStack?.destination?.route?.substringBefore("/") ?: "learn"

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = CodeBg) {
                tabs.forEach { t ->
                    NavigationBarItem(
                        selected = current == t.route,
                        onClick = {
                            nav.navigate(t.route) {
                                popUpTo("learn") { inclusive = false }
                                launchSingleTop = true
                            }
                        },
                        icon = { Icon(t.icon, contentDescription = t.label) },
                        label = { Text(t.label, maxLines = 1) }
                    )
                }
            }
        },
        containerColor = Bg
    ) { pad ->
        // Screen transitions: a short slide + fade on every navigation, so
        // moving between tabs and detail screens feels continuous instead
        // of cutting instantly. 300ms matches Material motion guidance.
        NavHost(
            navController = nav,
            startDestination = "learn",
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
            composable("learn") { LearnTab(vm, nav) }
            composable("practice") { PracticeTab(vm, nav) }
            composable("compiler") { CompilerTab(vm) }
            composable("library") { LibraryTab(vm, nav) }
            composable("dashboard") { DashboardTab(vm, nav) }
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
}

/** Monospace code block with horizontal scrolling. */
@Composable
fun CodeBlock(code: String, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(CodeBg)
            .padding(14.dp)
    ) {
        Text(
            text = code,
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp,
            lineHeight = 19.sp,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.horizontalScroll(rememberScrollState())
        )
    }
}
