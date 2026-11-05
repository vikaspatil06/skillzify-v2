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
import com.skillzify.app.data.Exercise
import com.skillzify.app.data.ExerciseAttempt
import com.skillzify.app.data.LearnPath
import com.skillzify.app.data.Project
import com.skillzify.app.data.RefEntry
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AppViewModel(app: Application) : AndroidViewModel(app) {
    val store = Store(app)
    private val authRepo = AuthRepository()
    private val syncRepo = SyncRepository(store)

    /* ---------- catalog: parsed on IO, gated by catalogLoaded ----------
       ~1MB of JSON after the v1.3 content port — parsing it on the main
       thread was the startup hitch. Screens are unreachable until the
       App-level gate sees catalogLoaded, so lateinit is safe here. */
    lateinit var catalog: Catalog; private set
    lateinit var snippets: List<Snippet>; private set
    lateinit var exercises: List<Exercise>; private set
    lateinit var reference: List<RefEntry>; private set
    lateinit var paths: List<LearnPath>; private set
    lateinit var projects: List<Project>; private set
    var catalogLoaded by mutableStateOf(false); private set

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

    /** Manual sync refresh (Dashboard ↻ button): full pull + merge + push. */
    var syncRefreshing by mutableStateOf(false); private set

    fun refreshSync() {
        val uid = authRepo.currentUser()?.uid
        if (uid == null) {
            syncStatus = "Not synced"
            return
        }
        if (syncRefreshing) return
        syncRefreshing = true
        viewModelScope.launch {
            syncStatus = "Syncing..."
            val ok = syncRepo.syncNow(uid)
            refreshFromStore()
            syncStatus = syncRepo.lastStatus
            if (!ok) syncStatus = "Sync offline"
            syncRefreshing = false
        }
    }

    /** Re-reads UI state from the store after a sync merge. */
    private fun refreshFromStore() {
        doneIds = store.doneIds()
        xp = store.getXp()
        streak = store.getStreak()
        runs = store.getRuns()
        if (::exercises.isInitialized) exerciseAttempts = exercises.associate { it.id to store.getAttempt(it.id) }
        refreshEnrollments()
    }

    init {
        // Parse catalog JSON off the main thread (startup hitch fix).
        viewModelScope.launch(Dispatchers.IO) {
            // Pre-warm the Chaquopy interpreter in the background, so the
            // FIRST compiler Run feels instant instead of paying the
            // interpreter-startup hitch mid-interaction.
            try { com.chaquo.python.Python.getInstance() } catch (e: Exception) { /* starts on first use */ }
            val c = loadCatalog(app)
            val sn = loadSnippets(app)
            val ex = loadExercises(app)
            val rf = loadReference(app)
            val pa = loadPaths(app)
            val pr = loadProjects(app)
            withContext(Dispatchers.Main) {
                catalog = c; snippets = sn; exercises = ex
                reference = rf; paths = pa; projects = pr
                exerciseAttempts = ex.associate { it.id to store.getAttempt(it.id) }
                refreshEnrollments()
                catalogLoaded = true
            }
        }
    }

    suspend fun register(name: String, email: String, password: String): AuthResult =
        authRepo.register(name, email, password)

    suspend fun login(email: String, password: String): AuthResult =
        authRepo.login(email, password)

    fun logout() = authRepo.logout()

    suspend fun resetPassword(email: String): String? = authRepo.resetPassword(email)

    var doneIds by mutableStateOf(store.doneIds()); private set
    var xp by mutableStateOf(store.getXp()); private set
    var streak by mutableStateOf(store.getStreak()); private set
    var runs by mutableStateOf(store.getRuns()); private set
    var exerciseAttempts by mutableStateOf(emptyMap<String, ExerciseAttempt>()); private set
    var enrolledPaths by mutableStateOf(store.getEnrolledPaths()); private set
    /** lessonId -> pathId for lesson steps of enrolled paths (mirrors web). Recomputed on change. */
    var unlockMap by mutableStateOf(emptyMap<String, String>()); private set

    private fun computeUnlockMap(enrolled: Map<String, Pair<Boolean, Long>>): Map<String, String> {
        if (!::paths.isInitialized) return emptyMap()
        val out = mutableMapOf<String, String>()
        for (p in paths) {
            if (enrolled[p.id]?.first != true) continue
            for (s in p.steps) if (s.type == "lesson") out[s.ref] = p.id
        }
        return out
    }

    private fun refreshEnrollments() {
        enrolledPaths = store.getEnrolledPaths()
        unlockMap = computeUnlockMap(enrolledPaths)
    }

    fun isEnrolled(pathId: String): Boolean = enrolledPaths[pathId]?.first == true

    fun enroll(pathId: String) {
        store.setEnrollment(pathId, true, System.currentTimeMillis())
        refreshEnrollments()
        markDirty()
    }

    fun leave(pathId: String) {
        store.setEnrollment(pathId, false, System.currentTimeMillis())
        refreshEnrollments()
        markDirty()
    }

    /* ---------- starred / pinned lessons ---------- */

    var starredLessons by mutableStateOf(store.starredLessons()); private set
    var pinnedLessons by mutableStateOf(store.pinnedLessons()); private set

    fun toggleStar(id: String) {
        val on = id !in starredLessons
        store.setStarred(id, on)
        starredLessons = store.starredLessons()
    }

    fun togglePin(id: String) {
        val on = id !in pinnedLessons
        store.setPinned(id, on)
        pinnedLessons = store.pinnedLessons()
    }

    /* ---------- theme ---------- */

    var themeDark by mutableStateOf(store.getThemeDark()); private set
    var themeAccent by mutableStateOf(store.getThemeAccent()); private set

    fun setTheme(dark: Boolean, accent: Int) {
        store.saveTheme(dark, accent)
        com.skillzify.app.ui.theme.applyTheme(dark, accent)
        themeDark = dark
        themeAccent = accent
    }

    /* ---------- dashboard helpers (website parity) ---------- */

    /** Next lesson to do: first not-done lesson in catalog order. */
    fun upNextLesson(): com.skillzify.app.data.Lesson? {
        if (!::catalog.isInitialized) return null
        return catalog.lessons.firstOrNull { !isDone(it.id) }
    }

    /** Daily challenge: deterministic by day, like the website (day % count). */
    fun dailyChallenge(): com.skillzify.app.data.Exercise? {
        if (!::exercises.isInitialized || exercises.isEmpty()) return null
        val day = System.currentTimeMillis() / 86400000L
        return exercises[(day % exercises.size).toInt()]
    }

    /** Revision queue: attempted but unsolved, oldest try first (max 4). */
    fun revisionQueue(): List<com.skillzify.app.data.Exercise> {
        if (!::exercises.isInitialized) return emptyList()
        return exercises.filter { ex ->
            val a = getAttempt(ex.id)
            a.attempts > 0 && !a.solved
        }.sortedBy { getAttempt(it.id).lastTry }.take(4)
    }

    /* ---------- achievements (website activity.js parity, derived state) ---------- */

    data class Achievement(val id: String, val icon: String, val name: String, val desc: String, val unlocked: Boolean)

    fun achievements(): List<Achievement> {
        val done = doneIds.size
        val totalLessons = if (::catalog.isInitialized) catalog.lessons.size else 95
        val exSolved = solvedExerciseCount()
        val exTotal = if (::exercises.isInitialized) exercises.size else 0
        val topicDone = if (::exercises.isInitialized) {
            exercises.groupBy { it.topic }.values.any { list ->
                list.isNotEmpty() && list.all { getAttempt(it.id).solved }
            }
        } else false
        val runs = store.getRunCount()
        val streakBest = maxOf(streak, store.getLongestStreak())
        val snips = store.userSnippets().size
        fun a(id: String, icon: String, name: String, desc: String, ok: Boolean) =
            Achievement(id, icon, name, desc, ok)
        return listOf(
            a("first_steps", "🌱", "First Steps", "Complete your first lesson", done >= 1),
            a("scholar", "🎓", "Scholar", "Complete all $totalLessons lessons", done >= totalLessons),
            a("xp_100", "💯", "Century", "Earn 100 XP", xp >= 100),
            a("xp_500", "⚡", "Charged", "Earn 500 XP", xp >= 500),
            a("xp_1000", "🚀", "Rocket", "Earn 1,000 XP", xp >= 1000),
            a("xp_5000", "🌟", "Superstar", "Earn 5,000 XP", xp >= 5000),
            a("streak_3", "🔥", "Warming Up", "3-day learning streak", streakBest >= 3),
            a("streak_7", "🔥", "On Fire", "7-day learning streak", streakBest >= 7),
            a("streak_30", "🔥", "Unstoppable", "30-day learning streak", streakBest >= 30),
            a("runner_10", "▶️", "Tinkerer", "Run code 10 times", runs >= 10),
            a("runner_50", "⚙️", "Engineer", "Run code 50 times", runs >= 50),
            a("snippet_saver", "📝", "Curator", "Save your first snippet", snips >= 1),
            a("night_owl", "🦉", "Night Owl", "Code between midnight and 5 AM", store.hasNightOwl()),
            a("early_bird", "🌅", "Early Bird", "Code between 5 and 8 AM", store.hasEarlyBird()),
            a("ex_first", "🏋️", "Problem Solver", "Solve your first exercise", exSolved >= 1),
            a("ex_10", "💪", "Decathlete", "Solve 10 exercises", exSolved >= 10),
            a("ex_25", "🔥", "On Fire", "Solve 25 exercises", exSolved >= 25),
            a("ex_all", "🏆", "Completionist", "Solve every exercise", exTotal > 0 && exSolved >= exTotal),
            a("topic_master", "🎯", "Topic Master", "Solve every exercise in one topic", topicDone)
        )
    }

    /* ---------- compiler workspace + snippets ---------- */

    var workspaceFiles by mutableStateOf(store.workspaceFiles()); private set
    var userSnippets by mutableStateOf(store.userSnippets()); private set

    fun saveWorkspaceFile(name: String, code: String) {
        store.saveWorkspaceFile(name, code)
        workspaceFiles = store.workspaceFiles()
    }

    fun deleteWorkspaceFile(name: String) {
        store.deleteWorkspaceFile(name)
        workspaceFiles = store.workspaceFiles()
    }

    fun renameWorkspaceFile(old: String, new: String) {
        store.renameWorkspaceFile(old, new)
        workspaceFiles = store.workspaceFiles()
    }

    fun saveUserSnippet(name: String, code: String) {
        store.saveUserSnippet(name, code)
        userSnippets = store.userSnippets()
    }

    fun deleteUserSnippet(id: String) {
        store.deleteUserSnippet(id)
        userSnippets = store.userSnippets()
    }

    fun isDone(id: String) = id in doneIds

    fun lessonIndex(id: String) = catalog.lessons.indexOfFirst { it.id == id }

    /** Sequential unlocking across the whole catalog, OR unlocked via an
        enrolled learning path (web parity with pathUnlockedLessons). */
    fun isUnlocked(index: Int): Boolean {
        if (index <= 0) return true
        if (isDone(catalog.lessons[index - 1].id)) return true
        return unlockMap.containsKey(catalog.lessons[index].id)
    }

    /** True when this lesson is unlocked ONLY via an enrolled path. */
    fun isPathOnlyUnlocked(index: Int): Boolean {
        val id = catalog.lessons[index].id
        return !isDone(id) && unlockMap.containsKey(id)
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
        store.recordRun()
        runs = store.getRuns()
    }

    fun saveLastCode(code: String) = store.saveLastCode(code)

    /**
     * One-shot compiler handoff: Projects/Reference "Try in compiler" sets the
     * code here AND writes it to workspace main.py; CompilerTab consumes it on
     * arrival so the code shows even if the compiler tab was already in the
     * back stack (its editor state would otherwise keep the old code).
     */
    var pendingCompilerCode by mutableStateOf<String?>(null); private set

    fun openInCompiler(code: String) {
        saveWorkspaceFile("main.py", code)
        saveLastCode(code)
        pendingCompilerCode = code
    }

    fun consumePendingCompilerCode() {
        pendingCompilerCode = null
    }
    fun lastCode(): String = store.getLastCode()

    /* ---------- exercises ---------- */

    fun getAttempt(id: String): ExerciseAttempt =
        exerciseAttempts[id] ?: store.getAttempt(id)

    fun solvedExerciseCount(): Int = exerciseAttempts.values.count { it.solved }

    /** Records an exercise attempt; awards XP on first solve. Returns XP gained.
        Website parity: revealed solution halves XP, solving with zero hints
        pays a 1.25x no-hint bonus. */
    fun recordAttempt(id: String, solved: Boolean, ms: Long, hintsUsed: Int, revealed: Boolean): Int {
        val ex = exercises.firstOrNull { it.id == id } ?: return 0
        val prev = getAttempt(id)
        val firstSolve = solved && !prev.solved
        val gain = if (firstSolve) {
            val g = when {
                revealed -> ex.xp / 2
                hintsUsed == 0 -> ex.xp * 5 / 4
                else -> ex.xp
            }
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
