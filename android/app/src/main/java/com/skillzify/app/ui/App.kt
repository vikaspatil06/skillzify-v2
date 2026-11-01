package com.skillzify.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
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

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("learn", "Learn", Icons.Filled.School),
    Tab("compiler", "Compiler", Icons.Filled.Terminal),
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
                        label = { Text(t.label) }
                    )
                }
            }
        },
        containerColor = Bg
    ) { pad ->
        NavHost(
            navController = nav,
            startDestination = "learn",
            modifier = Modifier.padding(pad)
        ) {
            composable("learn") { LearnTab(vm, nav) }
            composable("compiler") { CompilerTab(vm) }
            composable("dashboard") { DashboardTab(vm) }
            composable(
                "lesson/{id}",
                arguments = listOf(navArgument("id") { type = NavType.StringType })
            ) { entry ->
                LessonDetail(vm, entry.arguments!!.getString("id")!!, nav)
            }
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
