package com.skillzify.app.data

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * Cross-device sync via Cloud Firestore. Implements firestore-spec.md v1 --
 * merge rules are byte-identical to the website's sync.js:
 * lessons UNION, xp MAX, streak later-date-wins, exercise per-field merge,
 * profile last-write-wins.
 *
 * Layout: ONE document per user at users/{uid} with map fields
 * { profile, progress, exercises } (matches firestore.rules).
 */
class SyncRepository(private val store: Store) {
    private val db: FirebaseFirestore by lazy { FirebaseFirestore.getInstance() }

    var lastStatus: String = "Not synced"
        private set
    var lastSyncAt: Long = 0
        private set

    private fun userDoc(uid: String) = db.collection("users").document(uid)

    /* ---------------- merge (pure, mirrors web SkillzifySyncMerge) ---------------- */

    data class MergedProgress(
        val lessons: Set<String>,
        val xp: Int,
        val streakCount: Int,
        val streakLast: String?
    )

    fun mergeProgress(
        localLessons: Set<String>, localXp: Int, localCount: Int, localLast: String?,
        cloud: Map<String, Any?>?
    ): MergedProgress {
        @Suppress("UNCHECKED_CAST")
        val cloudLessons = (cloud?.get("lessons") as? Map<*, *>)?.keys?.map { it.toString() }?.toSet() ?: emptySet()
        val lessons = localLessons + cloudLessons
        val xp = maxOf(localXp, (cloud?.get("xp") as? Number)?.toInt() ?: 0)
        val cCount = (cloud?.get("streakCount") as? Number)?.toInt() ?: 0
        val cLast = (cloud?.get("streakLast") as? String)?.ifEmpty { null }
        // later streakLast wins (ISO yyyy-MM-dd compares lexicographically); tie -> larger count
        val (count, last) = when {
            cLast != null && localLast != null ->
                if (cLast > localLast) cCount to cLast
                else if (cLast < localLast) localCount to localLast
                else maxOf(cCount, localCount) to localLast
            cLast != null -> cCount to cLast
            else -> localCount to localLast
        }
        return MergedProgress(lessons, xp, count, last)
    }

    fun mergeAttempt(a: ExerciseAttempt, b: ExerciseAttempt): ExerciseAttempt {
        val bests = listOf(a.bestMs, b.bestMs).filter { it > 0 }
        return ExerciseAttempt(
            attempts = maxOf(a.attempts, b.attempts),
            solved = a.solved || b.solved,
            hintsUsed = maxOf(a.hintsUsed, b.hintsUsed),
            revealed = a.revealed || b.revealed,
            bestMs = bests.minOrNull() ?: 0,
            lastTry = maxOf(a.lastTry, b.lastTry)
        )
    }

    @Suppress("UNCHECKED_CAST")
    fun cloudAttempt(o: Map<String, Any?>): ExerciseAttempt = ExerciseAttempt(
        attempts = (o["attempts"] as? Number)?.toInt() ?: 0,
        solved = o["solved"] as? Boolean ?: false,
        hintsUsed = (o["hintsUsed"] as? Number)?.toInt() ?: 0,
        revealed = o["revealed"] as? Boolean ?: false,
        bestMs = (o["bestMs"] as? Number)?.toLong() ?: 0,
        lastTry = (o["lastTry"] as? Number)?.toLong() ?: 0
    )

    @Suppress("UNCHECKED_CAST")
    private fun cloudAttempts(data: Map<String, Any?>?): Map<String, ExerciseAttempt> =
        (data?.get("attempts") as? Map<*, *>)
            ?.entries?.associate { (k, v) -> k.toString() to cloudAttempt(v as Map<String, Any?>) }
            ?: emptyMap()

    private fun attemptMap(a: ExerciseAttempt): Map<String, Any> = mapOf(
        "attempts" to a.attempts, "solved" to a.solved,
        "hintsUsed" to a.hintsUsed, "revealed" to a.revealed,
        "bestMs" to a.bestMs, "lastTry" to a.lastTry
    )

    /* ---------------- enrollment merge (mirrors web mergePaths) ---------------- */

    /**
     * Per-path last-write-wins by `at` timestamp; tie -> local (web parity).
     * Leaving writes a tombstone {enrolled:false} so it propagates instead
     * of resurrecting.
     */
    @Suppress("UNCHECKED_CAST")
    fun mergePaths(
        local: Map<String, Pair<Boolean, Long>>,
        cloud: Map<String, Any?>?
    ): Map<String, Pair<Boolean, Long>> {
        val out = local.toMutableMap()
        val cloudMap = cloud as? Map<String, Map<String, Any?>> ?: emptyMap()
        for ((id, v) in cloudMap) {
            val cEnrolled = v["enrolled"] as? Boolean ?: false
            val cAt = (v["at"] as? Number)?.toLong() ?: 0
            val l = out[id]
            if (l == null || cAt > l.second) out[id] = cEnrolled to cAt
        }
        return out
    }

    @Suppress("UNCHECKED_CAST")
    private fun cloudPaths(data: Map<String, Any?>?): Map<String, Any?>? =
        data?.get("paths") as? Map<String, Any?>

    private fun pathsMap(paths: Map<String, Pair<Boolean, Long>>): Map<String, Any> =
        paths.mapValues { (_, v) -> mapOf("enrolled" to v.first, "at" to v.second) }

    /* ---------------- sync ---------------- */

    /**
     * Full sync: pull the user doc, merge with local, write merged state to both.
     * Never throws -- returns false and sets status on any failure.
     */
    suspend fun syncNow(uid: String): Boolean {
        lastStatus = "Syncing..."
        return try {
            val now = System.currentTimeMillis()
            val snap = userDoc(uid).get().await()
            val data = if (snap.exists()) snap.data else null
            @Suppress("UNCHECKED_CAST")
            val cloudProgress = data?.get("progress") as? Map<String, Any?>
            @Suppress("UNCHECKED_CAST")
            val cloudExercises = data?.get("exercises") as? Map<String, Any?>
            @Suppress("UNCHECKED_CAST")
            val cloudProfile = data?.get("profile") as? Map<String, Any?>

            // merge progress
            val merged = mergeProgress(
                store.doneIds(), store.getXp(), store.getStreak(), store.getStreakLast(),
                cloudProgress
            )
            store.applySyncedProgress(merged.lessons, merged.xp, merged.streakCount, merged.streakLast)

            // merge exercises
            val cloudAtt = cloudAttempts(cloudExercises)
            val ids = store.allAttemptIds() + cloudAtt.keys
            val mergedAtt = ids.associateWith { id ->
                mergeAttempt(store.getAttempt(id), cloudAtt[id] ?: ExerciseAttempt())
            }
            store.applySyncedAttempts(mergedAtt)

            // merge profile (last-write-wins)
            val cName = cloudProfile?.get("name") as? String ?: ""
            val cBio = cloudProfile?.get("bio") as? String ?: ""
            val cTs = (cloudProfile?.get("updatedAt") as? Number)?.toLong() ?: 0
            val lTs = store.getProfileUpdatedAt()
            if (cTs > lTs) store.applySyncedProfile(cName, cBio, cTs)
            val finalName = if (cTs > lTs) cName else store.getProfileName()
            val finalBio = if (cTs > lTs) cBio else store.getProfileBio()
            val finalTs = maxOf(cTs, lTs)

            // merge enrollments (per-path last-write-wins)
            val mergedPaths = mergePaths(store.getEnrolledPaths(), cloudPaths(data))
            store.applySyncedEnrollments(mergedPaths)

            // push merged doc
            userDoc(uid).set(mapOf(
                "profile" to mapOf("name" to finalName, "bio" to finalBio, "updatedAt" to finalTs),
                "progress" to mapOf(
                    "lessons" to merged.lessons.associateWith { true },
                    "xp" to merged.xp,
                    "streakCount" to merged.streakCount,
                    "streakLast" to (merged.streakLast ?: ""),
                    "updatedAt" to now
                ),
                "exercises" to mapOf(
                    "attempts" to mergedAtt.mapValues { (_, a) -> attemptMap(a) },
                    "updatedAt" to now
                ),
                "paths" to pathsMap(mergedPaths)
            ), SetOptions.merge()).await()

            lastSyncAt = now
            lastStatus = "Synced"
            true
        } catch (e: Exception) {
            lastStatus = "Sync offline"
            false
        }
    }

    /**
     * Lightweight push of current local state (debounced by caller).
     * Read-modify-write with merge rules so two devices don't clobber each other.
     */
    suspend fun pushNow(uid: String): Boolean {
        return try {
            val now = System.currentTimeMillis()
            val snap = userDoc(uid).get().await()
            val data = if (snap.exists()) snap.data else null
            @Suppress("UNCHECKED_CAST")
            val merged = mergeProgress(
                store.doneIds(), store.getXp(), store.getStreak(), store.getStreakLast(),
                data?.get("progress") as? Map<String, Any?>
            )
            @Suppress("UNCHECKED_CAST")
            val cloudAtt = cloudAttempts(data?.get("exercises") as? Map<String, Any?>)
            val ids = store.allAttemptIds() + cloudAtt.keys
            val mergedAtt = ids.associateWith { id ->
                mergeAttempt(store.getAttempt(id), cloudAtt[id] ?: ExerciseAttempt())
            }
            val mergedPaths = mergePaths(store.getEnrolledPaths(), cloudPaths(data))
            userDoc(uid).set(mapOf(
                "progress" to mapOf(
                    "lessons" to merged.lessons.associateWith { true },
                    "xp" to merged.xp,
                    "streakCount" to merged.streakCount,
                    "streakLast" to (merged.streakLast ?: ""),
                    "updatedAt" to now
                ),
                "exercises" to mapOf(
                    "attempts" to mergedAtt.mapValues { (_, a) -> attemptMap(a) },
                    "updatedAt" to now
                ),
                "paths" to pathsMap(mergedPaths)
            ), SetOptions.merge()).await()
            lastSyncAt = now
            lastStatus = "Synced"
            true
        } catch (e: Exception) {
            lastStatus = "Sync offline"
            false
        }
    }

    /**
     * Real-time listener: merges cloud -> local WITHOUT pushing back.
     * Local changes push via syncNow/pushNow. hasPendingWrites skips the
     * echo of our own writes, so this cannot loop. UI refreshes automatically
     * because screens observe the Store's StateFlows.
     */
    private var listenerReg: ListenerRegistration? = null

    fun startListening(uid: String, scope: CoroutineScope, onUpdate: () -> Unit = {}) {
        stopListening()
        try {
            listenerReg = userDoc(uid).addSnapshotListener { snap, _ ->
                if (snap == null || !snap.exists()) return@addSnapshotListener
                if (snap.metadata.hasPendingWrites()) return@addSnapshotListener // our own write
                scope.launch {
                    try {
                        pullOnly(snap.data)
                        lastStatus = "Synced"
                        lastSyncAt = System.currentTimeMillis()
                        onUpdate()
                    } catch (e: Exception) { /* keep last status */ }
                }
            }
        } catch (e: Exception) { /* listener unavailable */ }
    }

    fun stopListening() {
        try { listenerReg?.remove() } catch (e: Exception) {}
        listenerReg = null
    }

    /**
     * Pull-only merge: cloud -> local Store, no push. Used by the real-time
     * listener. Idempotent -- merging the same data twice is a no-op.
     */
    suspend fun pullOnly(data: Map<String, Any?>?) {
        @Suppress("UNCHECKED_CAST")
        val cloudProgress = data?.get("progress") as? Map<String, Any?>
        @Suppress("UNCHECKED_CAST")
        val cloudExercises = data?.get("exercises") as? Map<String, Any?>
        @Suppress("UNCHECKED_CAST")
        val cloudProfile = data?.get("profile") as? Map<String, Any?>

        val merged = mergeProgress(
            store.doneIds(), store.getXp(), store.getStreak(), store.getStreakLast(),
            cloudProgress
        )
        store.applySyncedProgress(merged.lessons, merged.xp, merged.streakCount, merged.streakLast)

        val cloudAtt = cloudAttempts(cloudExercises)
        val ids = store.allAttemptIds() + cloudAtt.keys
        val mergedAtt = ids.associateWith { id ->
            mergeAttempt(store.getAttempt(id), cloudAtt[id] ?: ExerciseAttempt())
        }
        store.applySyncedAttempts(mergedAtt)

        val cName = cloudProfile?.get("name") as? String ?: ""
        val cBio = cloudProfile?.get("bio") as? String ?: ""
        val cTs = (cloudProfile?.get("updatedAt") as? Number)?.toLong() ?: 0
        val lTs = store.getProfileUpdatedAt()
        if (cTs > lTs) store.applySyncedProfile(cName, cBio, cTs)

        val mergedPaths = mergePaths(store.getEnrolledPaths(), cloudPaths(data))
        store.applySyncedEnrollments(mergedPaths)
    }
}
