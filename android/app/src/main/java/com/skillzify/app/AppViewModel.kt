package com.skillzify.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.skillzify.app.data.AchievementDef
import com.skillzify.app.data.AdminRepository
import com.skillzify.app.data.AiRepository
import com.skillzify.app.data.AuthRepository
import com.skillzify.app.data.AuthResult
import com.skillzify.app.data.Catalog
import com.skillzify.app.data.Exercise
import com.skillzify.app.data.ExerciseAttempt
import com.skillzify.app.data.LearnPath
import com.skillzify.app.data.LessonNode
import com.skillzify.app.data.PassportEntry
import com.skillzify.app.data.PlacementRecord
import com.skillzify.app.data.PlacementResult
import com.skillzify.app.data.Project
import com.skillzify.app.data.RefEntry
import com.skillzify.app.data.RunRecord
import com.skillzify.app.data.SectionMastery
import com.skillzify.app.data.SectionNode
import com.skillzify.app.data.Snippet
import com.skillzify.app.data.Store
import com.skillzify.app.data.SyncRepository
import com.skillzify.app.data.TopicMastery
import com.skillzify.app.data.buildPassport
import com.skillzify.app.data.computeSectionMastery
import com.skillzify.app.data.computeTopicMastery
import com.skillzify.app.data.lessonNodes
import com.skillzify.app.data.levelFor
import com.skillzify.app.data.loadAchievements
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
import kotlin.math.roundToInt
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
    lateinit var achievementDefs: List<AchievementDef>; private set
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
                    store.setLastUid(user.uid)
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
                    refreshAiAndAdmin()
                } else {
                    syncRepo.stopListening()
                    syncStatus = "Not synced"
                    adminOverview = null
                    refreshAiAndAdmin()
                    // Web sync.js safety net (P1-25): a session that ended
                    // WITHOUT logout() (revoked/expired) still gets one last
                    // push attempt with the recorded uid; local data is
                    // wiped ONLY when that push succeeds, otherwise kept
                    // (with the uid marker) for the next sign-in to retry.
                    // A plain logout() clears the marker first, so this
                    // no-ops there; a never-signed-in device has no marker
                    // and its anonymous progress is never wiped.
                    val lastUid = store.getLastUid()
                    if (lastUid != null) {
                        viewModelScope.launch {
                            val ok = try { syncRepo.syncNow(lastUid) } catch (e: Exception) { false }
                            // Wipe ONLY if still signed out: if a new
                            // sign-in landed while this push was in
                            // flight, that account's merged state now
                            // owns the store — wiping here would blank
                            // it under the new session.
                            if (ok && authRepo.currentUser() == null) {
                                store.clearUserData()
                                refreshFromStore()
                            }
                        }
                    }
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
        // Backfill (web learn.js/paths.js page-load checks): a section
        // or path completed on another device pays its one-time bonus
        // here, once, when the merged state lands.
        checkCompletionBonuses()
        runs = store.getRuns()
        placement = store.getPlacement()
        starredLessons = store.starredLessons()
        pinnedLessons = store.pinnedLessons()
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
            val ach = loadAchievements(app) // fail-soft: empty until the asset lands
            val sn = loadSnippets(app)
            val ex = loadExercises(app)
            val rf = loadReference(app)
            val pa = loadPaths(app)
            val pr = loadProjects(app)
            withContext(Dispatchers.Main) {
                catalog = c; achievementDefs = ach; snippets = sn; exercises = ex
                reference = rf; paths = pa; projects = pr
                exerciseAttempts = ex.associate { it.id to store.getAttempt(it.id) }
                refreshEnrollments()
                catalogLoaded = true
                checkCompletionBonuses() // startup backfill, web page-load parity
            }
        }
    }

    suspend fun register(name: String, email: String, password: String): AuthResult =
        authRepo.register(name, email, password)

    suspend fun login(email: String, password: String): AuthResult =
        authRepo.login(email, password)

    /**
     * Sign-out, web sync.js handleLogout parity: push pending state
     * FIRST; only a successful push wipes local per-user data
     * (Store.clearUserData — theme survives, everything else goes, so
     * no account leaks into the next one on this device). A failed push
     * keeps the data (and the last-uid marker) for the next sign-in to
     * retry — but sign-out itself always proceeds, like the web.
     */
    fun logout() {
        val uid = authRepo.currentUser()?.uid ?: store.getLastUid()
        pushJob?.cancel()
        syncRepo.stopListening()
        if (uid == null) {
            authRepo.logout()
            return
        }
        viewModelScope.launch {
            val ok = try { syncRepo.syncNow(uid) } catch (e: Exception) { false }
            if (ok) store.clearUserData()
            authRepo.logout()
            adminOverview = null
            if (ok) {
                refreshFromStore()
                syncStatus = "Not synced"
            } else {
                syncStatus = "Sync failed — progress kept on this device"
            }
        }
    }

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

    /* ---------- placement (SmartSystems; syncs via users/{uid}.placement) ---------- */

    var placement by mutableStateOf(store.getPlacement()); private set

    /** Persists a finished placement test: Store first, then the
        debounced sync push carries it (web placement.js save() parity —
        the record is a pointer, never progress/XP). */
    fun savePlacement(result: PlacementResult) {
        val rec = PlacementRecord(
            section = result.section, score = result.score, total = result.total,
            date = System.currentTimeMillis(), stages = result.stages
        )
        store.setPlacement(rec)
        placement = rec
        markDirty()
    }

    fun clearPlacement() {
        store.clearPlacement()
        placement = null
        markDirty()
    }

    /* ---------- smart systems: mastery / passport / concept map ---------- */

    fun topicMastery(): List<TopicMastery> {
        if (!::exercises.isInitialized) return emptyList()
        return computeTopicMastery(exercises, { id -> getAttempt(id) }, System.currentTimeMillis())
    }

    fun sectionMastery(): List<SectionMastery> {
        if (!::catalog.isInitialized) return emptyList()
        return computeSectionMastery(catalog, doneIds, { id -> store.getLessonDoneAt(id) })
    }

    fun passportEntries(): List<PassportEntry> {
        if (!::catalog.isInitialized) return emptyList()
        return buildPassport(
            catalog, doneIds,
            completedAt = { sec ->
                // Web sectionDoneAt: max lesson doneAt of the section
                // (the app's first-completion stamp is that same
                // moment for locally finished sections; the doneAt
                // fallback covers sections completed on the WEB whose
                // dates arrived by sync, which never got a local stamp).
                store.getSectionCompletedAt(sec) ?: catalog.lessons
                    .filter { it.section == sec }
                    .mapNotNull { store.getLessonDoneAt(it.id) }
                    .maxOrNull()
            },
            certIssue = { sec, at ->
                // Web certFor(): get-or-create, persisted. An existing
                // record's ID never changes; a fresh cert is issued at
                // the completion date, or today when none was recorded.
                store.getCertRecord(sec)?.first ?: run {
                    val issuedAt = at ?: System.currentTimeMillis()
                    val id = com.skillzify.app.data.certIdFor(sec, issuedAt)
                    store.putCertRecord(sec, id, issuedAt)
                    id
                }
            }
        )
    }

    fun sectionNodes(): List<SectionNode> {
        if (!::catalog.isInitialized) return emptyList()
        val mastery = sectionMastery()
        return com.skillzify.app.data.sectionNodes(
            catalog = catalog,
            doneIds = doneIds,
            unlockedSections = catalog.tracks.filter { sectionUnlocked(it.id) }.map { it.id }.toSet(),
            masteryBySection = mastery.associate { it.sectionId to it.score },
            rustySections = mastery.filter { it.rusty }.map { it.sectionId }.toSet()
        )
    }

    fun lessonNodes(sectionId: String): List<LessonNode> {
        if (!::catalog.isInitialized) return emptyList()
        return com.skillzify.app.data.lessonNodes(catalog, sectionId, doneIds) { idx -> isUnlocked(idx) }
    }

    /* ---------- community-driven badge flags (UI layer calls these) ---------- */

    /** Flowchart screen rendered a flowchart: First Flowchart badge +
        the synced flowchartsDone counter. */
    fun markFlowchartRendered() {
        val before = store.isFlowchartRendered()
        store.setFlowchartRendered(true)
        if (!before) markDirty()
    }

    /** Community layer reports the signed-in user's flags (best-effort
        fetch via CommunityRepository.fetchMyCommunityFlags). Flags only
        ever turn ON — web counters never decrease. */
    fun refreshCommunityBadges(hasBest: Boolean, hasStar: Boolean) {
        if (hasBest) store.setHasBestAnswer(true)
        if (hasStar) store.setHasShowcaseStar(true)
        if (hasBest || hasStar) markDirty()
    }

    /* ---------- AI usage + admin overview ---------- */

    var aiUsage by mutableStateOf<AiRepository.AiUsage?>(null); private set
    var adminOverview by mutableStateOf<AdminRepository.AdminOverview?>(null); private set

    /** Admin ONLY when the server said so (a 200 from
        /api/admin/overview) — never from an email string. */
    val isAdminConfirmed: Boolean get() = adminOverview != null

    /**
     * Fetches /api/usage (signed-in or anonymous) and, when signed in,
     * the admin overview with a fresh ID token. Fail-soft: failures
     * leave nulls. Against the OLD production server (Vikas: no deploy)
     * /api/usage answers its basic shape (pool fields null) and
     * /api/admin/overview 404s -> adminOverview stays null and the
     * Admin entry stays hidden; both light up automatically once the
     * new server is deployed. Also safe to call manually (Dashboard
     * refresh).
     */
    fun refreshAiAndAdmin() {
        viewModelScope.launch {
            // Staleness guard: if the signed-in identity changes while
            // these fetches are in flight (sign-out, account switch),
            // a slow admin-overview response for the OLD account must
            // not land afterwards — it would resurrect the Admin entry
            // for a signed-out/different user. The new identity's own
            // refresh (auth collector) fetches its own values.
            val uidAtStart = authRepo.currentUser()?.uid
            aiUsage = AiRepository.fetchUsage()
            val user = authRepo.currentUser()
            adminOverview = if (user != null && user.uid == uidAtStart) {
                val token = AiRepository.freshIdToken()
                if (token.isNotEmpty()) AdminRepository.fetchOverview(token) else null
            } else null
        }
    }

    /* ---------- starred / pinned lessons ---------- */

    var starredLessons by mutableStateOf(store.starredLessons()); private set
    var pinnedLessons by mutableStateOf(store.pinnedLessons()); private set

    fun toggleStar(id: String) {
        val on = id !in starredLessons
        store.setStarred(id, on)
        starredLessons = store.starredLessons()
        // Web quirk, preserved: starring a lesson logs activity
        // (lesson.js log("star", …)), and any log() bumps the streak.
        streak = store.bumpStreak()
        applyStreakMilestoneBonus()
        markDirty()
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
        // Web gatherState (P2-15): count only lessons that exist in the
        // catalog — a stale/removed id lingering in progress must not
        // inflate "lessons done" or unlock Scholar early.
        val done = if (::catalog.isInitialized) {
            val catalogIds = catalog.lessons.map { it.id }.toSet()
            doneIds.count { it in catalogIds }
        } else doneIds.size
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
        val masteryScores = if (::exercises.isInitialized) topicMastery().map { it.score } else emptyList()
        // A learning path counts complete when every step is complete
        // (lesson steps done, exercise steps solved) — web checkPathBonuses
        // semantics over the built-in path catalog.
        val pathDone = if (::paths.isInitialized) {
            paths.any { p ->
                p.steps.isNotEmpty() && p.steps.all { s ->
                    when (s.type) {
                        "lesson" -> isDone(s.ref)
                        "ex" -> getAttempt(s.ref).solved
                        else -> false
                    }
                }
            }
        } else false
        fun unlocked(id: String): Boolean = when (id) {
            "first_steps" -> done >= 1
            "scholar" -> done >= totalLessons
            "xp_100" -> xp >= 100
            "xp_500" -> xp >= 500
            "xp_1000" -> xp >= 1000
            "xp_5000" -> xp >= 5000
            "xp_10000" -> xp >= 10000
            "streak_3" -> streakBest >= 3
            "streak_7" -> streakBest >= 7
            "streak_30" -> streakBest >= 30
            "runner_10" -> runs >= 10
            "runner_50" -> runs >= 50
            "snippet_saver" -> snips >= 1
            "night_owl" -> store.hasNightOwl()
            "early_bird" -> store.hasEarlyBird()
            "ex_first" -> exSolved >= 1
            "ex_10" -> exSolved >= 10
            "ex_25" -> exSolved >= 25
            "ex_all" -> exTotal > 0 && exSolved >= exTotal
            "topic_master" -> topicDone
            "lessons_25" -> done >= 25
            "lessons_50" -> done >= 50
            "lessons_100" -> done >= 100
            "review_7" -> store.getReviewsCompleted() >= 7
            "review_30" -> store.getReviewsCompleted() >= 30
            "mastery_solid" -> masteryScores.any { it >= 60 }
            "mastery_mastered" -> masteryScores.any { it >= 85 }
            "path_first" -> pathDone
            "best_answer" -> store.isHasBestAnswer()
            "showcase_star" -> store.isHasShowcaseStar()
            "flowchart_first" -> store.isFlowchartRendered()
            // plansFinished has no UI incrementing it yet — stays locked
            // until a daily-plan surface lands (accepted in the brief).
            "plan_7" -> store.getPlansFinished() >= 7
            else -> false
        }
        // Definitions come from achievements.json (the 32 web
        // definitions, loaded in init). Until that asset lands the
        // loader returns empty and FALLBACK_ACHIEVEMENT_DEFS (the same
        // 32, from web activity.js) keeps all checks live.
        val defs = if (::achievementDefs.isInitialized && achievementDefs.isNotEmpty()) {
            achievementDefs
        } else {
            FALLBACK_ACHIEVEMENT_DEFS
        }
        return defs.map { d ->
            Achievement(
                id = d.id, icon = d.icon, name = d.name,
                // Scholar's target is the live catalog size, as before.
                desc = if (d.id == "scholar") "Complete all $totalLessons lessons" else d.desc,
                unlocked = unlocked(d.id)
            )
        }
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
        // Web: saving a snippet logs activity (activity.js saveSnippet
        // -> log()), which bumps the streak counter.
        streak = store.bumpStreak()
        applyStreakMilestoneBonus()
        markDirty()
    }

    fun deleteUserSnippet(id: String) {
        store.deleteUserSnippet(id)
        userSnippets = store.userSnippets()
    }

    fun isDone(id: String) = id in doneIds

    fun lessonIndex(id: String) = catalog.lessons.indexOfFirst { it.id == id }

    /* ----- unlock rules: web learn-core.js isUnlocked/sectionUnlocked ----- */

    /** Index of the placed section in catalog.tracks (the sections), or -1. */
    private fun placedSectionIndex(): Int {
        val sec = placement?.section ?: return -1
        return catalog.tracks.indexOfFirst { it.id == sec }
    }

    /** Web: every lesson in a section BEFORE the placed one is open. */
    private fun isPlacementOpen(lesson: com.skillzify.app.data.Lesson): Boolean {
        val pi = placedSectionIndex()
        if (pi < 0 || lesson.section.isEmpty()) return false
        val li = catalog.tracks.indexOfFirst { it.id == lesson.section }
        return li >= 0 && li < pi
    }

    /** Web: the first lesson of an unlocked section is open. */
    private fun isFirstOfUnlockedSection(lesson: com.skillzify.app.data.Lesson): Boolean {
        if (lesson.section.isEmpty()) return false
        val first = catalog.lessons.firstOrNull { it.section == lesson.section } ?: return false
        return first.id == lesson.id && sectionUnlocked(lesson.section)
    }

    /**
     * Web sectionUnlocked(): no-needs sections are open; a section at or
     * before the placed section is open (placement overrides the chain);
     * otherwise every lesson of the `needs` section must be done.
     */
    fun sectionUnlocked(sectionId: String): Boolean {
        if (!::catalog.isInitialized) return false
        val idx = catalog.tracks.indexOfFirst { it.id == sectionId }
        if (idx < 0) return false
        val placedIdx = placedSectionIndex()
        if (placedIdx >= 0 && idx <= placedIdx) return true
        val needs = catalog.tracks[idx].needs ?: return true
        return catalog.lessons.filter { it.section == needs }.all { isDone(it.id) }
    }

    /** Web learn-core.js isUnlocked(): sequential (prev done) OR placement
        (section before the placed one) OR first lesson of an unlocked
        section OR unlocked via an enrolled learning path. */
    fun isUnlocked(index: Int): Boolean {
        if (index !in catalog.lessons.indices) return false
        if (index <= 0) return true
        if (isDone(catalog.lessons[index - 1].id)) return true
        val lesson = catalog.lessons[index]
        if (isPlacementOpen(lesson)) return true
        if (isFirstOfUnlockedSection(lesson)) return true
        return unlockMap.containsKey(lesson.id)
    }

    /** True when this lesson is unlocked ONLY via an enrolled path
        (web isPathOnlyUnlocked, P2-04: placement/section-entry openings
        are not path-only). */
    fun isPathOnlyUnlocked(index: Int): Boolean {
        if (index !in catalog.lessons.indices) return false
        if (index <= 0) return false
        if (isDone(catalog.lessons[index - 1].id)) return false
        val lesson = catalog.lessons[index]
        if (isPlacementOpen(lesson)) return false
        if (isFirstOfUnlockedSection(lesson)) return false
        return unlockMap.containsKey(lesson.id)
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

    /** Web streak().current: 0 once the streak has lapsed (the stored
        count survives for longest/sync). Display surfaces use this;
        achievements keep using best-ever via longest. */
    fun currentStreak(): Int = store.getCurrentStreak()

    /** Web activity.js checkAchievements streak milestones: +50 XP
        the first time the streak reaches 7 days, +150 at 30 — each
        once per device (Store flags). Evaluated after every streak
        bump, like the web evaluating inside log(). XP state refreshes
        in place; the caller's markDirty (or the one here, when XP
        actually changed) carries it to sync. */
    private fun applyStreakMilestoneBonus() {
        val count = store.getStreak()
        var changed = false
        if (count >= 7 && !store.isStreakBonusClaimed(7)) {
            store.claimStreakBonus(7); xp = store.addXp(50); changed = true
        }
        if (count >= 30 && !store.isStreakBonusClaimed(30)) {
            store.claimStreakBonus(30); xp = store.addXp(150); changed = true
        }
        if (changed) markDirty()
    }

    /** Web learn-core.js one-time completion bonuses: +100 XP when a
        section's lessons are all done, +150 XP when a path's steps
        are all done — each exactly once per id (Store flags), with a
        backfill sweep so a section/path finished via sync (or before
        this shipped) still pays out once, like the web's Learn/Paths
        page-load backfill. Built-in paths pay on completion whether
        or not they were enrolled (web checkPathBonuses; only custom
        paths are enrollment-gated, and the app has none). */
    private fun checkCompletionBonuses() {
        if (!::catalog.isInitialized) return
        var changed = false
        for (sec in catalog.tracks) {
            val ls = catalog.lessons.filter { it.section == sec.id }
            if (ls.isEmpty() || !ls.all { isDone(it.id) }) continue
            if (store.isSectionBonusAwarded(sec.id)) continue
            store.markSectionBonusAwarded(sec.id)
            xp = store.addXp(100); changed = true
        }
        if (::paths.isInitialized) {
            for (p in paths) {
                if (p.steps.isEmpty()) continue
                val allDone = p.steps.all { s ->
                    when (s.type) {
                        "lesson" -> isDone(s.ref)
                        "ex" -> getAttempt(s.ref).solved
                        else -> false // unidentifiable step: never pay (web pathStepsDone)
                    }
                }
                if (!allDone || store.isPathBonusAwarded(p.id)) continue
                store.markPathBonusAwarded(p.id)
                xp = store.addXp(150); changed = true
            }
        }
        if (changed) markDirty()
    }

    /** Awards XP exactly like the web app; returns (gained, leveledUp). */
    fun completeLesson(id: String, quizFirstTries: Int): Pair<Int, Boolean> {
        if (isDone(id)) return 0 to false
        val before = currentLevel().name
        val gain = xpGain(quizFirstTries)
        xp = store.addXp(gain)
        store.markDone(id)
        doneIds = store.doneIds()
        streak = store.bumpStreak()
        applyStreakMilestoneBonus()
        // Passport: when this completion finishes the LAST lesson of a
        // section, stamp the section's completion date (first time only —
        // Store.recordSectionCompleted never overwrites).
        if (::catalog.isInitialized) {
            val lesson = catalog.lessons.firstOrNull { it.id == id }
            val section = lesson?.section ?: ""
            if (section.isNotEmpty()) {
                val sectionLessons = catalog.lessons.filter { it.section == section }
                if (sectionLessons.isNotEmpty() && sectionLessons.all { isDone(it.id) }) {
                    store.recordSectionCompleted(section, System.currentTimeMillis())
                }
            }
        }
        checkCompletionBonuses()
        markDirty()
        return gain to (currentLevel().name != before)
    }

    fun addRun(code: String, ok: Boolean) {
        val preview = code.lines().firstOrNull()?.take(60) ?: "(empty)"
        store.addRun(RunRecord(preview, ok, System.currentTimeMillis()))
        store.recordRun()
        runs = store.getRuns()
        // Web: a compiler run is activity (compiler.js log("run", …))
        // and log() bumps the streak counter — a run-only day counts.
        streak = store.bumpStreak()
        applyStreakMilestoneBonus()
        // Every other mutator schedules the debounced push; without
        // this, a run-only session's streak/runCount reached the cloud
        // only via some later unrelated action (or the next sign-in).
        markDirty()
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
        Website parity (practice.js xpForSolve + setAtt):
        - The award reads the MERGED record, not this screen session:
          hints/reveals from ANY earlier visit count (the web's stored
          attempt is cumulative), so a hint used yesterday still costs
          today's no-hint bonus and a solution revealed once halves
          the XP forever.
        - Rounding is the web's Math.round: no-hint 1.25x pays 13 XP
          on a 10-XP exercise (not 12), revealed pays half.
        - Once solved, the record is FROZEN for attempts/revealed
          (web P1-04): re-solves never raise the attempt count and a
          post-solve reveal never sets revealed; lastTry/bestMs and
          hintsUsed still update, as on the web.
        - solveQuality is snapshotted at first solve (P1-04) and
          mastery reads the snapshot, never the live record. */
    fun recordAttempt(id: String, solved: Boolean, ms: Long, hintsUsed: Int, revealed: Boolean): Int {
        val ex = exercises.firstOrNull { it.id == id } ?: return 0
        val prev = getAttempt(id)
        val firstSolve = solved && !prev.solved
        val effHints = maxOf(prev.hintsUsed, hintsUsed)
        val effRevealed = prev.revealed || revealed
        val gain = if (firstSolve) {
            val g = when {
                effRevealed -> (ex.xp * 0.5).roundToInt()
                effHints == 0 -> (ex.xp * 1.25).roundToInt()
                else -> ex.xp
            }
            xp = store.addXp(g)
            streak = store.bumpStreak()
            applyStreakMilestoneBonus()
            g
        } else 0
        // NOTE: no "reviews" are counted here. The web's reviewsDone
        // counter counts real spaced-repetition completions; an
        // earlier app build proxied re-solves into it, which inflated
        // the SHARED synced counter (MAX merge) and could unlock the
        // review badges on the web without a single review. The app
        // has no review surface yet (same honest gap as plan_7), so
        // the counter stays untouched here.
        val nowMs = System.currentTimeMillis()
        val nextAttempts = if (prev.solved) prev.attempts else prev.attempts + 1
        val next = prev.copy(
            attempts = nextAttempts,
            solved = prev.solved || solved,
            hintsUsed = effHints,
            revealed = if (prev.solved) prev.revealed else effRevealed,
            bestMs = if (solved && ms > 0 && (prev.bestMs == 0L || ms < prev.bestMs)) ms else prev.bestMs,
            lastTry = nowMs,
            // First-solve time (web attempt `at`): set once, on first solve.
            at = if (firstSolve && prev.at == 0L) nowMs else prev.at,
            // Quality frozen at solve time (web solveQualityFor, read
            // from the record being written: revealed 0.4, hinted or
            // >1 attempt 0.7, clean first-try 1.0).
            solveQuality = if (firstSolve) {
                when {
                    effRevealed -> 0.4
                    effHints > 0 || nextAttempts > 1 -> 0.7
                    else -> 1.0
                }
            } else prev.solveQuality
        )
        store.saveAttempt(id, next)
        exerciseAttempts = exerciseAttempts + (id to next)
        if (firstSolve) checkCompletionBonuses() // an exercise solve can finish a path
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

/**
 * The 32 web achievement definitions (activity.js ACHIEVEMENTS),
 * used only until achievements.json lands in assets — loadAchievements
 * is fail-soft empty before that, and achievements() prefers the asset.
 * Scholar's desc is a placeholder here: achievements() always renders
 * it dynamically from the live lesson count.
 */
private val FALLBACK_ACHIEVEMENT_DEFS: List<AchievementDef> = listOf(
    AchievementDef("first_steps", "🌱", "First Steps", "Complete your first lesson"),
    AchievementDef("scholar", "🎓", "Scholar", "Complete all lessons"),
    AchievementDef("xp_100", "💯", "Century", "Earn 100 XP"),
    AchievementDef("xp_500", "⚡", "Charged", "Earn 500 XP"),
    AchievementDef("xp_1000", "🚀", "Rocket", "Earn 1,000 XP"),
    AchievementDef("xp_5000", "🌟", "Superstar", "Earn 5,000 XP"),
    AchievementDef("xp_10000", "🌟", "Legend", "Earn 10,000 XP"),
    AchievementDef("streak_3", "🔥", "Warming Up", "3-day learning streak"),
    AchievementDef("streak_7", "🔥", "On Fire", "7-day learning streak"),
    AchievementDef("streak_30", "🔥", "Unstoppable", "30-day learning streak"),
    AchievementDef("runner_10", "▶️", "Tinkerer", "Run code 10 times"),
    AchievementDef("runner_50", "⚙️", "Engineer", "Run code 50 times"),
    AchievementDef("snippet_saver", "📝", "Curator", "Save your first snippet"),
    AchievementDef("night_owl", "🦉", "Night Owl", "Code between midnight and 5 AM"),
    AchievementDef("early_bird", "🌅", "Early Bird", "Code between 5 and 8 AM"),
    AchievementDef("ex_first", "🏋️", "Problem Solver", "Solve your first exercise"),
    AchievementDef("ex_10", "💪", "Decathlete", "Solve 10 exercises"),
    AchievementDef("ex_25", "🔥", "On a Roll", "Solve 25 exercises"),
    AchievementDef("ex_all", "🏆", "Completionist", "Solve every exercise"),
    AchievementDef("topic_master", "🎯", "Topic Master", "Solve every exercise in one topic"),
    AchievementDef("lessons_25", "📚", "Bookworm", "Complete 25 lessons"),
    AchievementDef("lessons_50", "📖", "Dedicated", "Complete 50 lessons"),
    AchievementDef("lessons_100", "🏛️", "Centurion", "Complete 100 lessons"),
    AchievementDef("review_7", "🔁", "Regular Reviewer", "Complete 7 reviews"),
    AchievementDef("review_30", "🧠", "Memory Master", "Complete 30 reviews"),
    AchievementDef("mastery_solid", "🎯", "Solid Start", "Reach 60% mastery in any topic"),
    AchievementDef("mastery_mastered", "👑", "True Master", "Reach 85% mastery in any topic"),
    AchievementDef("path_first", "🗺️", "Pathfinder", "Complete your first learning path"),
    AchievementDef("best_answer", "💡", "Best Answer", "Have an answer marked as best"),
    AchievementDef("showcase_star", "⭐", "Starred", "Get your first star on a showcase project"),
    AchievementDef("flowchart_first", "📊", "First Flowchart", "Render your first flowchart"),
    AchievementDef("plan_7", "📋", "Plan Keeper", "Finish 7 daily plans")
)
