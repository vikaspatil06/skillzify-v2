package com.skillzify.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.skillzify.app.data.AuthRepository
import com.skillzify.app.data.AuthResult
import com.skillzify.app.data.Catalog
import com.skillzify.app.data.RunRecord
import com.skillzify.app.data.Snippet
import com.skillzify.app.data.Store
import com.skillzify.app.data.levelFor
import com.skillzify.app.data.loadCatalog
import com.skillzify.app.data.loadSnippets
import com.skillzify.app.data.nextLevel
import com.skillzify.app.data.xpGain
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn

class AppViewModel(app: Application) : AndroidViewModel(app) {
    val store = Store(app)
    private val authRepo = AuthRepository()
    val catalog: Catalog = loadCatalog(app)
    val snippets: List<Snippet> = loadSnippets(app)

    /** Firebase user; null = logged out. Collected by the UI to gate navigation. */
    val firebaseUser = authRepo.userFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, authRepo.currentUser())

    suspend fun register(name: String, email: String, password: String): AuthResult =
        authRepo.register(name, email, password)

    suspend fun login(email: String, password: String): AuthResult =
        authRepo.login(email, password)

    fun logout() = authRepo.logout()

    var doneIds by mutableStateOf(store.doneIds()); private set
    var xp by mutableStateOf(store.getXp()); private set
    var streak by mutableStateOf(store.getStreak()); private set
    var runs by mutableStateOf(store.getRuns()); private set

    fun isDone(id: String) = id in doneIds

    fun lessonIndex(id: String) = catalog.lessons.indexOfFirst { it.id == id }

    /** Sequential unlocking across the whole catalog (web parity). */
    fun isUnlocked(index: Int): Boolean {
        if (index <= 0) return true
        return isDone(catalog.lessons[index - 1].id)
    }

    fun trackUnlocked(trackId: String): Boolean {
        val track = catalog.tracks.firstOrNull { it.id == trackId } ?: return true
        val needs = track.needs ?: return true
        return catalog.lessons.filter { it.track == needs }.all { isDone(it.id) }
    }

    fun trackProgress(trackId: String): Int {
        val ls = catalog.lessons.filter { it.track == trackId }
        if (ls.isEmpty()) return 0
        return (ls.count { isDone(it.id) } * 100 / ls.size)
    }

    fun currentLevel() = levelFor(catalog.levels, xp)
    fun nextLevelInfo() = nextLevel(catalog.levels, xp)

    /** Awards XP exactly like the web app; returns (gained, leveledUp). */
    fun completeLesson(id: String, quizFirstTries: Int): Pair<Int, Boolean> {
        if (isDone(id)) return 0 to false
        val before = currentLevel().name
        val gain = xpGain(quizFirstTries)
        xp = store.addXp(gain)
        store.markDone(id)
        doneIds = store.doneIds()
        streak = store.bumpStreak()
        return gain to (currentLevel().name != before)
    }

    fun addRun(code: String, ok: Boolean) {
        val preview = code.lines().firstOrNull()?.take(60) ?: "(empty)"
        store.addRun(RunRecord(preview, ok, System.currentTimeMillis()))
        runs = store.getRuns()
    }

    fun saveLastCode(code: String) = store.saveLastCode(code)
    fun lastCode(): String = store.getLastCode()
}
