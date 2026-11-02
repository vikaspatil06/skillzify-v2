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
import com.skillzify.app.data.ExerciseAttempt
import com.skillzify.app.data.RunRecord
import com.skillzify.app.data.Snippet
import com.skillzify.app.data.Store
import com.skillzify.app.data.SyncRepository
import com.skillzify.app.data.levelFor
import com.skillzify.app.data.loadCatalog
import com.skillzify.app.data.loadExercises
import com.skillzify.app.data.loadPaths
import com.skillzify.app.data.loadProjects
import com.skillzify.app.data.loadReference
import com.skillzify.app.data.loadSnippets
import com.skillzify.app.data.nextLevel
import com.skillzify.app.data.xpGain
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class AppViewModel(app: Application) : AndroidViewModel(app) {
    val store = Store(app)
    private val authRepo = AuthRepository()
    private val syncRepo = SyncRepository(store)
    val catalog: Catalog = loadCatalog(app)
    val snippets: List<Snippet> = loadSnippets(app)
    val exercises = loadExercises(app)
    val reference = loadReference(app)
    val paths = loadPaths(app)
    val projects = loadProjects(app)

    /** Firebase user; null = logged out. Collected by the UI to gate navigation. */
    val firebaseUser = authRepo.userFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, authRepo.currentUser())

    var syncStatus by mutableStateOf(syncRepo.lastStatus); private set

    private var pushJob: Job? = null

    init {
        // Sync whenever auth state changes to signed-in, then listen live.
        viewModelScope.launch {
            authRepo.userFlow.collect { user ->
                if (user != null) {
                    syncStatus = "Syncing..."
                    val ok = syncRepo.syncNow(user.uid)
                    refreshFromStore()
                    syncStatus = syncRepo.lastStatus
                    if (!ok) syncStatus = "Sync offline"
                    // Real-time: pull cloud changes as they happen (no re-login needed).
                    syncRepo.startListening(user.uid, viewModelScope) {
                        refreshFromStore()
                        syncStatus = syncRepo.lastStatus
                    }
                } else {
                    syncRepo.stopListening()
                    syncStatus = "Not synced"
                }
            }
        }
    }

    /** Debounced cloud push after any local mutation (2s, like the web). */
    fun markDirty() {
        val uid = authRepo.currentUser()?.uid ?: return
        pushJob?.cancel()
        pushJob = viewModelScope.launch {
            delay(2000)
            syncRepo.pushNow(uid)
            syncStatus = syncRepo.lastStatus
            refreshFromStore()
        }
    }

    /** Re-reads UI state from the store after a sync merge. */
    private fun refreshFromStore() {
        doneIds = store.doneIds()
        xp = store.getXp()
        streak = store.getStreak()
        runs = store.getRuns()
        exerciseAttempts = exercises.associate { it.id to store.getAttempt(it.id) }
    }

    suspend fun register(name: String, email: String, password: String): AuthResult =
        authRepo.register(name, email, password)

    suspend fun login(email: String, password: String): AuthResult =
        authRepo.login(email, password)

    fun logout() = authRepo.logout()

    var doneIds by mutableStateOf(store.doneIds()); private set
    var xp by mutableStateOf(store.getXp()); private set
    var streak by mutableStateOf(store.getStreak()); private set
    var runs by mutableStateOf(store.getRuns()); private set
    var exerciseAttempts by mutableStateOf(exercises.associate { it.id to store.getAttempt(it.id) }); private set

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
        markDirty()
        return gain to (currentLevel().name != before)
    }

    fun addRun(code: String, ok: Boolean) {
        val preview = code.lines().firstOrNull()?.take(60) ?: "(empty)"
        store.addRun(RunRecord(preview, ok, System.currentTimeMillis()))
        runs = store.getRuns()
    }

    fun saveLastCode(code: String) = store.saveLastCode(code)
    fun lastCode(): String = store.getLastCode()

    /* ---------- exercises ---------- */

    fun getAttempt(id: String): ExerciseAttempt =
        exerciseAttempts[id] ?: store.getAttempt(id)

    fun solvedExerciseCount(): Int = exerciseAttempts.values.count { it.solved }

    /** Records an exercise attempt; awards XP on first solve. Returns XP gained. */
    fun recordAttempt(id: String, solved: Boolean, ms: Long, hintsUsed: Int, revealed: Boolean): Int {
        val ex = exercises.firstOrNull { it.id == id } ?: return 0
        val prev = getAttempt(id)
        val firstSolve = solved && !prev.solved
        val gain = if (firstSolve) {
            val g = if (revealed) ex.xp / 2 else ex.xp
            xp = store.addXp(g)
            streak = store.bumpStreak()
            g
        } else 0
        val next = prev.copy(
            attempts = prev.attempts + 1,
            solved = prev.solved || solved,
            hintsUsed = maxOf(prev.hintsUsed, hintsUsed),
            revealed = prev.revealed || revealed,
            bestMs = if (solved && ms > 0 && (prev.bestMs == 0L || ms < prev.bestMs)) ms else prev.bestMs,
            lastTry = System.currentTimeMillis()
        )
        store.saveAttempt(id, next)
        exerciseAttempts = exerciseAttempts + (id to next)
        markDirty()
        return gain
    }

    fun useHint(id: String) {
        val prev = getAttempt(id)
        val next = prev.copy(hintsUsed = prev.hintsUsed + 1)
        store.saveAttempt(id, next)
        exerciseAttempts = exerciseAttempts + (id to next)
        markDirty()
    }

    fun topicAccuracy(): Map<String, Pair<Int, Int>> {
        // topic -> (solved, total)
        val out = mutableMapOf<String, Pair<Int, Int>>()
        for (ex in exercises) {
            val (s, t) = out[ex.topic] ?: (0 to 0)
            out[ex.topic] = (s + if (getAttempt(ex.id).solved) 1 else 0) to (t + 1)
        }
        return out
    }

    /* ---------- profile ---------- */

    fun profileName(): String {
        val local = store.getProfileName()
        if (local.isNotBlank()) return local
        return authRepo.currentUser()?.displayName ?: ""
    }
    fun profileBio(): String = store.getProfileBio()

    fun saveProfile(name: String, bio: String) {
        store.saveProfile(name.trim(), bio.trim(), System.currentTimeMillis())
        markDirty()
    }
}
