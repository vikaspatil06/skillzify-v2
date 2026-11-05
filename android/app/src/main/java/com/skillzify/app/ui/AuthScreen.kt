package com.skillzify.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.AuthResult
import com.skillzify.app.ui.theme.Accent
import com.skillzify.app.ui.theme.Card
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.Primary
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import kotlinx.coroutines.launch

/** Firebase email/password auth — polished login / register, website parity
    (segmented toggle, password visibility, forgot-password reset email). */
@Composable
fun AuthScreen(vm: AppViewModel) {
    var isLogin by remember { mutableStateOf(true) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun submit() {
        error = null; notice = null; busy = true
        scope.launch {
            val result = if (isLogin) vm.login(email, password)
            else vm.register(name, email, password)
            busy = false
            if (result is AuthResult.Err) error = result.message
            // On Ok, the AuthStateListener flips firebaseUser and the app navigates automatically.
        }
    }

    fun forgotPassword() {
        error = null; notice = null; busy = true
        scope.launch {
            val err = vm.resetPassword(email)
            busy = false
            if (err == null) notice = "Reset link sent to $email — check your inbox."
            else error = err
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Gradient brand header (matches the website's brand gradient).
        Box(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
                .background(Brush.horizontalGradient(listOf(Primary, Accent))),
            contentAlignment = Alignment.Center
        ) {
            Column(
                Modifier.padding(vertical = 28.dp, horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("🐍", fontSize = 52.sp)
                Text("Skillzify", fontSize = 30.sp, fontWeight = FontWeight.ExtraBold, color = Color.White)
                Text("Learn Python. Build projects. Shine.",
                    color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp, textAlign = TextAlign.Center)
            }
        }
        Spacer(Modifier.height(20.dp))
        Card(
            colors = CardDefaults.cardColors(containerColor = Card),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(22.dp)) {
                // Segmented Login / Register toggle.
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf(true to "Login", false to "Register").forEach { (login, label) ->
                        val selected = isLogin == login
                        Box(
                            Modifier.weight(1f).clip(RoundedCornerShape(9.dp))
                                .background(if (selected) Primary else Color.Transparent)
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            TextButton(
                                onClick = { isLogin = login; error = null; notice = null },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(label, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (selected) Color.White else TextMuted,
                                    fontSize = 14.sp, maxLines = 1)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
                if (!isLogin) {
                    OutlinedTextField(
                        value = name, onValueChange = { name = it },
                        label = { Text("Full name") }, singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Text, imeAction = ImeAction.Next),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(10.dp))
                }
                OutlinedTextField(
                    value = email, onValueChange = { email = it },
                    label = { Text("Email") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = password, onValueChange = { password = it },
                    label = { Text("Password") }, singleLine = true,
                    visualTransformation = if (showPassword) VisualTransformation.None
                        else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { submit() }),
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Text(if (showPassword) "🙈" else "👁️", fontSize = 16.sp)
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                if (isLogin) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = ::forgotPassword, enabled = !busy) {
                            Text("Forgot password?", fontSize = 13.sp, maxLines = 1)
                        }
                    }
                }
                error?.let {
                    Spacer(Modifier.height(4.dp))
                    Text(it, color = Danger, fontSize = 13.sp)
                }
                notice?.let {
                    Spacer(Modifier.height(4.dp))
                    Text(it, color = Success, fontSize = 13.sp)
                }
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = ::submit,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (busy) CircularProgressIndicator(
                        modifier = Modifier.size(18.dp).padding(end = 8.dp),
                        strokeWidth = 2.dp, color = Color.White
                    )
                    Text(if (isLogin) "Login" else "Create account", fontSize = 15.sp, maxLines = 1)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    if (isLogin) "New here? Switch to Register above to create your free account."
                    else "Already have an account? Switch to Login above.",
                    color = TextMuted, fontSize = 12.sp, textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
        Spacer(Modifier.height(16.dp))
        Text("Your progress syncs across devices once you're signed in.",
            color = TextMuted, fontSize = 12.sp, textAlign = TextAlign.Center)
    }
}
