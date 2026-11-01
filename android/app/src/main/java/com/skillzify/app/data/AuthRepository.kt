package com.skillzify.app.data

import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.UserProfileChangeRequest
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

sealed class AuthResult {
    data class Ok(val user: FirebaseUser) : AuthResult()
    data class Err(val message: String) : AuthResult()
}

/** Real authentication via Firebase Authentication (email/password). */
class AuthRepository {
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()

    /** Emits the current user whenever auth state changes (login/logout). */
    val userFlow: Flow<FirebaseUser?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { trySend(it.currentUser) }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    fun currentUser(): FirebaseUser? = auth.currentUser

    suspend fun register(name: String, email: String, password: String): AuthResult {
        val e = email.trim()
        if (!isValidEmail(e)) return AuthResult.Err("Please enter a valid email address.")
        if (password.length < 6) return AuthResult.Err("Password must be at least 6 characters.")
        if (name.trim().isEmpty()) return AuthResult.Err("Please enter your name.")
        return try {
            val res = auth.createUserWithEmailAndPassword(e, password).await()
            val user = res.user ?: return AuthResult.Err("Registration failed — please try again.")
            user.updateProfile(
                UserProfileChangeRequest.Builder().setDisplayName(name.trim()).build()
            ).await()
            AuthResult.Ok(auth.currentUser ?: user)
        } catch (ex: Exception) {
            AuthResult.Err(friendlyError(ex))
        }
    }

    suspend fun login(email: String, password: String): AuthResult {
        val e = email.trim()
        if (!isValidEmail(e)) return AuthResult.Err("Please enter a valid email address.")
        if (password.isEmpty()) return AuthResult.Err("Please enter your password.")
        return try {
            val res = auth.signInWithEmailAndPassword(e, password).await()
            val user = res.user ?: return AuthResult.Err("Login failed — please try again.")
            AuthResult.Ok(user)
        } catch (ex: Exception) {
            AuthResult.Err(friendlyError(ex))
        }
    }

    fun logout() = auth.signOut()

    private fun isValidEmail(e: String) =
        Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(e)

    private fun friendlyError(e: Exception): String = when (e) {
        is FirebaseAuthWeakPasswordException ->
            "Password is too weak — use at least 6 characters."
        is FirebaseAuthUserCollisionException ->
            "An account with this email already exists. Try logging in."
        is FirebaseAuthInvalidUserException ->
            "No account found for this email. Try registering first."
        is FirebaseAuthInvalidCredentialsException ->
            "Invalid email or password. Check both and try again."
        is FirebaseNetworkException ->
            "Network error — check your internet connection and try again."
        else ->
            e.localizedMessage?.takeIf { it.isNotBlank() } ?: "Authentication failed. Please try again."
    }
}
