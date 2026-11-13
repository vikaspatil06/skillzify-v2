package com.skillzify.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
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
import com.skillzify.app.ui.theme.BgSoft
import com.skillzify.app.ui.theme.CardBorder
import com.skillzify.app.ui.theme.Danger
import com.skillzify.app.ui.theme.GradientBrush
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import kotlinx.coroutines.launch

/* =====================================================================
   EXACT WEBSITE REPLICA of auth.html (+ style.css .form-card/.auth-tabs
   rules + auth.js validation) — presentation only; the Firebase calls
   underneath are the same VM/AuthRepository functions as before.

   Web structure being reproduced, top to bottom:
   - Centred .form-card (max-width 440px, --card bg, 1px --card-border,
     20px radius, 36px padding, --shadow) on the plain --bg page.
   - Logo image centred at the top of the card (margin-bottom 20px) —
     here the 🐍 + "Skillzify" wordmark stands in for logo-light.png.
   - .auth-tabs: two flex-1 buttons on --bg-soft with a card border;
     the active one carries the --gradient background and white text.
   - Login form:  h2 "Welcome back 👋", .sub "Log in to personalize
     your dashboard.", Email field, Password field, right-aligned
     "Forgot password?" hint link under the password, full-width
     gradient .btn "Login".
   - Register form: h2 "Create account 🚀", .sub "Free forever. Start
     learning in seconds.", Full name, Email, Password (placeholder
     "Min. 6 characters"), full-width gradient .btn "Create account".
   - Footer hint inside the card: "🔒 Secured by Firebase
     Authentication — one account works across devices."
   Field labels are the web's .field-lbl (small, semibold, muted,
   above each input); placeholders are the web's verbatim placeholders
   ("you@example.com", "••••••••", "Your name", "Min. 6 characters").
   Validation + error copy mirror auth.js exactly (client-side checks
   run before the Firebase call, errors surface as the page's toast —
   rendered here as the red line under the fields):
     register: "Please enter your name." / "Please enter a valid
       email address." / "Password must be at least 6 characters."
     login:    "Please enter a valid email address." /
       "Please enter your password."
   Server errors come back already mapped by AuthRepository (the same
   friendly() strings as auth.js).
   ===================================================================== */
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

    fun validEmail(e: String) =
        Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(e.trim())

    fun submit() {
        // auth.js client-side validation, verbatim messages, in order.
        error = null; notice = null
        val em = email.trim().lowercase()
        if (!isLogin) {
            if (name.trim().isEmpty()) { error = "Please enter your name."; return }
            if (!validEmail(em)) { error = "Please enter a valid email address."; return }
            if (password.length < 6) { error = "Password must be at least 6 characters."; return }
        } else {
            if (!validEmail(em)) { error = "Please enter a valid email address."; return }
            if (password.isEmpty()) { error = "Please enter your password."; return }
        }
        busy = true
        scope.launch {
            val result = if (isLogin) vm.login(email, password)
            else vm.register(name, email, password)
            busy = false
            if (result is AuthResult.Err) error = result.message
            // On Ok, the AuthStateListener flips firebaseUser and the app navigates automatically.
        }
    }

    fun forgotPassword() {
        // Web: the link goes to reset-password.html; here it sends the
        // same Firebase reset email in place (existing behaviour).
        error = null; notice = null
        if (!validEmail(email.trim())) { error = "Please enter a valid email address."; return }
        busy = true
        scope.launch {
            val err = vm.resetPassword(email)
            busy = false
            if (err == null) notice = "✓ Reset link sent to $email — check your inbox."
            else error = err
        }
    }

    // Page: plain --bg background, card centred (web .section/.container).
    Box(
        Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState()),
        contentAlignment = Alignment.Center
    ) {
        // .form-card
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 40.dp)
                .shadow(24.dp, RoundedCornerShape(20.dp))
                .clip(RoundedCornerShape(20.dp))
                .background(MaterialTheme.colorScheme.surface)
                .border(1.dp, CardBorder, RoundedCornerShape(20.dp))
                .padding(36.dp)
        ) {
            // Logo, centred, margin-bottom 20px (web: logo-light.png, 56px tall).
            Column(
                Modifier.fillMaxWidth().padding(bottom = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("🐍", fontSize = 40.sp)
                Text(
                    "Skillzify", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            // .auth-tabs
            Row(
                Modifier.fillMaxWidth().padding(bottom = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf(true to "Login", false to "Register").forEach { (login, label) ->
                    val active = isLogin == login
                    Box(
                        Modifier.weight(1f).clip(RoundedCornerShape(10.dp))
                            .then(
                                if (active) Modifier.background(GradientBrush)
                                else Modifier.background(BgSoft)
                                    .border(1.dp, CardBorder, RoundedCornerShape(10.dp))
                            )
                            .clickable(enabled = !busy) {
                                isLogin = login; error = null; notice = null
                            }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            label, fontWeight = FontWeight.Bold, fontSize = 15.sp,
                            color = if (active) Color.White else TextMuted
                        )
                    }
                }
            }

            // Form heading + sub (verbatim web copy).
            Text(
                if (isLogin) "Welcome back 👋" else "Create account 🚀",
                fontSize = 22.sp, fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                if (isLogin) "Log in to personalize your dashboard."
                else "Free forever. Start learning in seconds.",
                color = TextMuted, fontSize = 14.sp,
                modifier = Modifier.padding(top = 6.dp, bottom = 8.dp)
            )

            if (!isLogin) {
                AuthField(
                    label = "Full name", value = name, onChange = { name = it },
                    placeholder = "Your name",
                    keyboardType = KeyboardType.Text, imeAction = ImeAction.Next
                )
            }
            AuthField(
                label = "Email", value = email, onChange = { email = it },
                placeholder = "you@example.com",
                keyboardType = KeyboardType.Email, imeAction = ImeAction.Next
            )
            AuthField(
                label = "Password", value = password, onChange = { password = it },
                placeholder = if (isLogin) "••••••••" else "Min. 6 characters",
                keyboardType = KeyboardType.Password, imeAction = ImeAction.Done,
                password = true, showPassword = showPassword,
                onToggleShow = { showPassword = !showPassword },
                onDone = { submit() }
            )

            if (isLogin) {
                // .hint, right-aligned, margin -6px 0 16px (web).
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Text(
                        "Forgot password?", color = MaterialTheme.colorScheme.primary,
                        fontSize = 13.sp,
                        modifier = Modifier.clickable(enabled = !busy) { forgotPassword() }
                            .padding(vertical = 4.dp)
                    )
                }
                Spacer(Modifier.height(8.dp))
            } else {
                Spacer(Modifier.height(16.dp))
            }

            // The web shows errors as a toast; here the same message sits
            // directly above the submit button, in --danger.
            error?.let {
                Text(it, color = Danger, fontSize = 13.sp, modifier = Modifier.padding(bottom = 10.dp))
            }
            notice?.let {
                Text(it, color = Success, fontSize = 13.sp, modifier = Modifier.padding(bottom = 10.dp))
            }

            // .btn — full-width gradient submit.
            Box(
                Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(12.dp))
                    .background(GradientBrush)
                    .clickable(enabled = !busy) { submit() },
                contentAlignment = Alignment.Center
            ) {
                if (busy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Color.White
                    )
                } else {
                    Text(
                        if (isLogin) "Login" else "Create account",
                        color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp
                    )
                }
            }

            // Card footer hint (verbatim web copy).
            Text(
                "🔒 Secured by Firebase Authentication — one account works across devices.",
                color = TextMuted, fontSize = 13.sp, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 18.dp)
            )
        }
    }
}

/** One web form-group: .field-lbl above a --bg-soft filled input. */
@Composable
private fun AuthField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    keyboardType: KeyboardType,
    imeAction: ImeAction,
    password: Boolean = false,
    showPassword: Boolean = false,
    onToggleShow: (() -> Unit)? = null,
    onDone: (() -> Unit)? = null
) {
    Column(Modifier.fillMaxWidth().padding(bottom = 2.dp)) {
        Text(
            label, color = TextMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 14.dp, bottom = 6.dp)
        )
        OutlinedTextField(
            value = value, onValueChange = onChange,
            placeholder = { Text(placeholder, color = TextMuted) },
            singleLine = true,
            visualTransformation = if (password && !showPassword) PasswordVisualTransformation()
                else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
            keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
            trailingIcon = if (password && onToggleShow != null) {
                {
                    IconButton(onClick = onToggleShow) {
                        Text(if (showPassword) "🙈" else "👁️", fontSize = 16.sp)
                    }
                }
            } else null,
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = BgSoft,
                unfocusedContainerColor = BgSoft,
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = CardBorder
            ),
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.fillMaxWidth()
        )
    }
}
