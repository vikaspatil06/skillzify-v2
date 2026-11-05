package com.skillzify.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import com.skillzify.app.ui.SkillzifyApp
import com.skillzify.app.ui.theme.SkillzifyTheme

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Theme state (dark/light + accent) loads from Store before first frame.
        com.skillzify.app.ui.theme.syncThemeFromStore(vm.store)
        // Python is started by PyApplication (see AndroidManifest) before this runs.
        setContent {
            SkillzifyTheme {
                SkillzifyApp(vm)
            }
        }
    }
}
