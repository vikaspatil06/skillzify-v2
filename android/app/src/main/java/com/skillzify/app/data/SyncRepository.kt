package com.skillzify.app.data

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * Cross-device sync via Cloud Firestore. Implements the SAME merge rules
 * as the website's sync.js (the reference implementation) on the SAME
 * single-document schema, users/{uid}:
 *
 * - progress.lessons UNION; progress.xp MAX; progress.runCount MAX
 * - progress.streak: later streakLast wins (ISO yyyy-MM-dd compares
 *   lexicographically); tie -> larger streakCount; BOTH fields copied
 *   from the winner (web mergeProgress)
 * - progress.doneAt: per-lesson earliest non-zero wins (passport §4a)
 * - exercises.attempts: per-field merge — solved/revealed OR,
 *   attempts/hintsUsed/lastTry MAX, bestMs MIN of non-zero (else 0),
 *   at (first-solve) earliest non-zero wins
 * - profile: last-write-wins by updatedAt (tie -> local)
 * - paths: per-path last-write-wins by `at`; leaving writes a tombstone
 *   {enrolled:false}; reads accept BOTH the flat map shape and the
 *   legacy nested {paths:{...}} shape (and a legacy array on the local
 *   side, migrated by Store); pushes the FLAT shape + updatedAt
 * - placement: whole-record last-write-wins by `date` (tie -> local);
 *   null when neither side holds a valid record, and the field is then
 *   OMITTED from the push so a local absence can never delete a remote
 *   placement (web mergePlacement)
 * - counters: per-field MAX for reviewsDone/plansDone/bestAnswers/
 *   flowchartsDone, OR for showcaseStarred (web mergeCounters); the
 *   merged value is always pushed (a fresh device's zeros can't lower it)
 * - achievements: the permanent unlock record ({id: true}), UNION.
 *   App-owned field (v1.4.3): the web keeps its unlock map in
 *   localStorage only (skillzify_achievements — never synced), so this
 *   field is how unlocks earned in-app persist across devices; the
 *   web's writes use {merge:true} with its own named fields only, so
 *   this field survives every web push untouched and the web simply
 *   ignores it.
 *
 * - activityDays (App 2.0 A4): {yyyy-MM-dd: count} on the main doc —
 *   per-day MAX of the cloud counts and the local active days (the app
 *   does not count activities per day, so a local day contributes 1),
 *   floored by the days on which merged lessons were completed (the
 *   web's mergeActivityDays + doneAt history floor).
 * - workspace (App 2.0 A4): synced via its OWN document,
 *   users/{uid}/syncData/workspace, with the web's mergeWorkspace
 *   rules (per-file LWW by mtime, deletion tombstones); the main doc's
 *   legacy inline `workspace` field is folded in on read and never
 *   written by the app. See the workspace section below.
 *
 * NEVER CLOBBER: every write is read-merge-write and uses
 * SetOptions.merge() with ONLY the top-level fields this app owns
 * (profile, progress, exercises, paths, placement, counters,
 * achievements, activityDays). Web-only fields on the same doc
 * (reviews, customPaths, projects) are never named in a payload and
 * therefore survive every app push byte-for-byte. customPaths in
 * particular: the app holds no local custom-path definitions, so —
 * exactly like web mergeCustomPaths treats a side with "no
 * information" — the cloud copy always wins by preservation.
 */
class SyncRepository(private val store: Store) {
    private val db: FirebaseFirestore by lazy { FirebaseFirestore.getInstance() }

    var lastStatus: String = "Not synced"
        private set
    var lastSyncAt: Long = 0
        private set

    private fun userDoc(uid: String) = db.collection("users").document(uid)

    /* ---------------- merge: progress (web mergeProgress) ---------------- */

    data class MergedProgress(
        val lessons: Set<String>,
        val xp: Int,
        val streakCount: Int,
        val streakLast: String?,
        val runCount: Int = 0,
        val doneAt: Map<String, Long> = emptyMap()
    )

    /** Web earliestMap: union of keys; per key the minimum of the
        non-zero values, else the non-zero one, else 0. */
    fun earliestMap(local: Map<String, Long>, cloud: Map<*, *>?): Map<String, Long> {
        val cloudMap = mutableMapOf<String, Long>()
        cloud?.forEach { (k, v) ->
            val key = k.toString()
            if (key == "updatedAt") return@forEach
            cloudMap[key] = (v as? Number)?.toLong() ?: 0L
        }
        val out = mutableMapOf<String, Long>()
        for (k in local.keys + cloudMap.keys) {
            val av = local[k] ?: 0L
            val bv = cloudMap[k] ?: 0L
            out[k] = if (av > 0 && bv > 0) minOf(av, bv) else maxOf(av, bv)
        }
        return out
    }

    fun mergeProgress(
        localLessons: Set<String>, localXp: Int, localCount: Int, localLast: String?,
        cloud: Map<String, Any?>?
    ): MergedProgress {
        @Suppress("UNCHECKED_CAST")
        val cloudLessons = (cloud?.get("lessons") as? Map<*, *>)?.keys?.map { it.toString() }?.toSet() ?: emptySet()
        val lessons = localLessons + cloudLessons
        val xp = maxOf(localXp, (cloud?.get("xp") as? Number)?.toInt() ?: 0)
        val runCount = maxOf(store.getRunCount(), (cloud?.get("runCount") as? Number)?.toInt() ?: 0)
        val cCount = (cloud?.get("streakCount") as? Number)?.toInt() ?: 0
        val cLast = (cloud?.get("streakLast") as? String)?.ifEmpty { null }
        // Web mergeProgress, exactly: later streakLast wins and BOTH
        // fields are copied from the winner; tie (or both missing) ->
        // larger streakCount. (The previous app code kept the LOCAL
        // count when both lasts were null even if the cloud count was
        // larger — fixed to the web rule.)
        val (count, last) = when {
            (localLast ?: "") > (cLast ?: "") -> localCount to localLast
            (cLast ?: "") > (localLast ?: "") -> cCount to cLast
            else -> maxOf(localCount, cCount) to (localLast ?: cLast)
        }
        @Suppress("UNCHECKED_CAST")
        val doneAt = earliestMap(store.allLessonDoneAt(), cloud?.get("doneAt") as? Map<*, *>)
        return MergedProgress(lessons, xp, count, last, runCount, doneAt)
    }

    /* ---------------- merge: exercise attempts (web mergeExercises) ---------------- */

    fun mergeAttempt(a: ExerciseAttempt, b: ExerciseAttempt): ExerciseAttempt {
        val bests = listOf(a.bestMs, b.bestMs).filter { it > 0 }
        val firsts = listOf(a.at, b.at).filter { it > 0 }
        return ExerciseAttempt(
            attempts = maxOf(a.attempts, b.attempts),
            solved = a.solved || b.solved,
            hintsUsed = maxOf(a.hintsUsed, b.hintsUsed),
            revealed = a.revealed || b.revealed,
            bestMs = bests.minOrNull() ?: 0,
            lastTry = maxOf(a.lastTry, b.lastTry),
            at = firsts.minOrNull() ?: 0,
            // solveQuality is a LOCAL-only snapshot on both platforms
            // (web mergeExercises drops it from the cloud doc too), so
            // the merged record simply keeps whichever side holds one —
            // in practice the local side (a); the cloud parse never sets it.
            solveQuality = a.solveQuality ?: b.solveQuality
        )
    }

    @Suppress("UNCHECKED_CAST")
    fun cloudAttempt(o: Map<String, Any?>): ExerciseAttempt = ExerciseAttempt(
        attempts = (o["attempts"] as? Number)?.toInt() ?: 0,
        solved = o["solved"] as? Boolean ?: false,
        hintsUsed = (o["hintsUsed"] as? Number)?.toInt() ?: 0,
        revealed = o["revealed"] as? Boolean ?: false,
        bestMs = (o["bestMs"] as? Number)?.toLong() ?: 0,
        lastTry = (o["lastTry"] as? Number)?.toLong() ?: 0,
        at = (o["at"] as? Number)?.toLong() ?: 0
    )

    @Suppress("UNCHECKED_CAST")
    private fun cloudAttempts(data: Map<String, Any?>?): Map<String, ExerciseAttempt> =
        (data?.get("attempts") as? Map<*, *>)
            ?.entries?.mapNotNull { (k, v) ->
                val m = v as? Map<String, Any?> ?: return@mapNotNull null
                k.toString() to cloudAttempt(m)
            }?.toMap()
            ?: emptyMap()

    private fun attemptMap(a: ExerciseAttempt): Map<String, Any> {
        val m = mutableMapOf<String, Any>(
            "attempts" to a.attempts, "solved" to a.solved,
            "hintsUsed" to a.hintsUsed, "revealed" to a.revealed,
            "bestMs" to a.bestMs, "lastTry" to a.lastTry
        )
        // Web leaves `at` off entirely when there is no first-solve time.
        if (a.at > 0) m["at"] = a.at
        return m
    }

    /* ---------------- merge: enrollments (web mergePaths) ---------------- */

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
        val cloudMap = cloud as? Map<*, *> ?: return out
        // Cloud shape: the app (and new web writes) store the FLAT map
        // { <pathId>: {enrolled, at}, updatedAt }, while older web writes
        // stored the NESTED { paths: {...}, updatedAt }. Read both: unwrap
        // the `paths` key ONLY when its values are path-entry maps — a flat
        // doc can also carry a junk `paths` key ({enrolled, at}) left by old
        // app merges, whose values are scalars, not maps.
        val nested = cloudMap["paths"] as? Map<*, *>
        val entries = if (nested != null && nested.values.all { it is Map<*, *> }) nested else cloudMap
        for ((id, raw) in entries) {
            if (id.toString() == "paths" || id.toString() == "updatedAt") continue
            val v = raw as? Map<*, *> ?: continue
            val cEnrolled = v["enrolled"] as? Boolean ?: false
            val cAt = (v["at"] as? Number)?.toLong() ?: 0
            val key = id.toString()
            val l = out[key]
            if (l == null || cAt > l.second) out[key] = cEnrolled to cAt
        }
        return out
    }

    @Suppress("UNCHECKED_CAST")
    private fun cloudPaths(data: Map<String, Any?>?): Map<String, Any?>? {
        val raw = data?.get("paths") ?: return null
        if (raw is List<*>) {
            // Legacy array: [pathId, ...] -> enrolled tombstone-free entries.
            val m = mutableMapOf<String, Any?>()
            for (id in raw) if (id is String) m[id] = mapOf("enrolled" to true, "at" to 0L)
            return m
        }
        return raw as? Map<String, Any?>
    }

    /** FLAT push shape like web: { <pathId>: {enrolled, at}, updatedAt }. */
    private fun pathsMap(paths: Map<String, Pair<Boolean, Long>>, now: Long): Map<String, Any> {
        val m = mutableMapOf<String, Any>()
        for ((id, v) in paths) m[id] = mapOf("enrolled" to v.first, "at" to v.second)
        m["updatedAt"] = now
        return m
    }

    /* ---------------- merge: placement (web mergePlacement) ---------------- */

    /** Web normalizePlacement: validates the section against the 7
        journey sections and coerces stages; null = no information. */
    fun normalizePlacement(section: String?, score: Int, total: Int, date: Long,
                           stages: Map<String, StageScore>): PlacementRecord? {
        if (section == null || section !in SECTION_ORDER) return null
        return PlacementRecord(
            section = section, score = score, total = total, date = date,
            stages = mapOf(
                "a" to (stages["a"] ?: StageScore()),
                "b" to (stages["b"] ?: StageScore()),
                "c" to (stages["c"] ?: StageScore())
            )
        )
    }

    fun cloudPlacement(data: Map<String, Any?>?): PlacementRecord? {
        val raw = data?.get("placement") as? Map<*, *> ?: return null
        val stagesRaw = raw["stages"] as? Map<*, *>
        fun stage(k: String): StageScore {
            val s = stagesRaw?.get(k) as? Map<*, *> ?: return StageScore()
            return StageScore(
                correct = (s["correct"] as? Number)?.toInt() ?: 0,
                total = (s["total"] as? Number)?.toInt() ?: 0
            )
        }
        return normalizePlacement(
            section = raw["section"] as? String,
            score = (raw["score"] as? Number)?.toInt() ?: 0,
            total = (raw["total"] as? Number)?.toInt() ?: 0,
            date = (raw["date"] as? Number)?.toLong() ?: 0,
            stages = mapOf("a" to stage("a"), "b" to stage("b"), "c" to stage("c"))
        )
    }

    /** Whole-record LWW by `date`; tie -> local. A side with no valid
        record carries no information and never wipes the other side;
        null when neither side has one. */
    fun mergePlacement(local: PlacementRecord?, cloud: Map<String, Any?>?): PlacementRecord? {
        val l = local?.let {
            normalizePlacement(it.section, it.score, it.total, it.date, it.stages)
        }
        val c = cloudPlacement(cloud)
        if (l == null) return c
        if (c == null) return l
        return if (l.date >= c.date) l else c
    }

    private fun placementMap(rec: PlacementRecord): Map<String, Any> = mapOf(
        "section" to rec.section,
        "score" to rec.score,
        "total" to rec.total,
        "stages" to mapOf(
            "a" to mapOf("correct" to (rec.stages["a"]?.correct ?: 0), "total" to (rec.stages["a"]?.total ?: 0)),
            "b" to mapOf("correct" to (rec.stages["b"]?.correct ?: 0), "total" to (rec.stages["b"]?.total ?: 0)),
            "c" to mapOf("correct" to (rec.stages["c"]?.correct ?: 0), "total" to (rec.stages["c"]?.total ?: 0))
        ),
        "date" to rec.date
    )

    /* ---------------- merge: counters (web mergeCounters) ---------------- */

    fun cloudCounters(data: Map<String, Any?>?): Counters {
        val raw = data?.get("counters") as? Map<*, *> ?: return Counters()
        fun n(k: String): Int = maxOf(0, (raw[k] as? Number)?.toInt() ?: 0)
        return Counters(
            reviewsDone = n("reviewsDone"),
            plansDone = n("plansDone"),
            bestAnswers = n("bestAnswers"),
            showcaseStarred = raw["showcaseStarred"] as? Boolean ?: false,
            flowchartsDone = n("flowchartsDone")
        )
    }

    /** Per-field MAX for the numeric counters, OR for showcaseStarred. */
    fun mergeCounters(local: Counters, cloud: Map<String, Any?>?): Counters {
        val c = cloudCounters(cloud)
        return Counters(
            reviewsDone = maxOf(local.reviewsDone, c.reviewsDone),
            plansDone = maxOf(local.plansDone, c.plansDone),
            bestAnswers = maxOf(local.bestAnswers, c.bestAnswers),
            showcaseStarred = local.showcaseStarred || c.showcaseStarred,
            flowchartsDone = maxOf(local.flowchartsDone, c.flowchartsDone)
        )
    }

    private fun countersMap(c: Counters): Map<String, Any> = mapOf(
        "reviewsDone" to c.reviewsDone,
        "plansDone" to c.plansDone,
        "bestAnswers" to c.bestAnswers,
        "showcaseStarred" to c.showcaseStarred,
        "flowchartsDone" to c.flowchartsDone
    )

    /* ---------------- merge: achievement unlock record ---------------- */

    /** Cloud unlock record: users/{uid}.achievements as {id: true}.
        Only truthy entries count (web unlocked() semantics); a legacy
        list shape is tolerated. Absent/malformed = no information. */
    fun cloudUnlocked(data: Map<String, Any?>?): Set<String> {
        val raw = data?.get("achievements") ?: return emptySet()
        if (raw is List<*>) return raw.mapNotNull { it as? String }.toSet()
        val m = raw as? Map<*, *> ?: return emptySet()
        return m.entries.filter { it.value == true }.map { it.key.toString() }.toSet()
    }

    /* ---------------- shared merge machinery ---------------- */

    private data class MergedState(
        val progress: MergedProgress,
        val attempts: Map<String, ExerciseAttempt>,
        val finalName: String,
        val finalBio: String,
        val finalTs: Long,
        val profileCloudWins: Boolean,
        val paths: Map<String, Pair<Boolean, Long>>,
        val placement: PlacementRecord?,
        val counters: Counters,
        val unlocked: Set<String>,
        val activityDays: Map<String, Long>,
        val reviews: Map<String, ReviewEntry>
    )

    /** Merges one cloud snapshot against the local Store (no writes). */
    private fun mergeAll(data: Map<String, Any?>?): MergedState {
        @Suppress("UNCHECKED_CAST")
        val cloudProgress = data?.get("progress") as? Map<String, Any?>
        @Suppress("UNCHECKED_CAST")
        val cloudExercises = data?.get("exercises") as? Map<String, Any?>
        @Suppress("UNCHECKED_CAST")
        val cloudProfile = data?.get("profile") as? Map<String, Any?>

        val progress = mergeProgress(
            store.doneIds(), store.getXp(), store.getStreak(), store.getStreakLast(),
            cloudProgress
        )
        val cloudAtt = cloudAttempts(cloudExercises)
        val ids = store.allAttemptIds() + cloudAtt.keys
        val attempts = ids.associateWith { id ->
            mergeAttempt(store.getAttempt(id), cloudAtt[id] ?: ExerciseAttempt())
        }
        // profile: last-write-wins by updatedAt, tie -> local
        val cName = cloudProfile?.get("name") as? String ?: ""
        val cBio = cloudProfile?.get("bio") as? String ?: ""
        val cTs = (cloudProfile?.get("updatedAt") as? Number)?.toLong() ?: 0
        val lTs = store.getProfileUpdatedAt()
        val cloudWins = cTs > lTs
        val paths = mergePaths(store.getEnrolledPaths(), cloudPaths(data))
        val placement = mergePlacement(store.getPlacement(), data)
        val counters = mergeCounters(store.getCounters(), data)
        // Unlock record: UNION — an unlock known on either side is
        // unlocked, forever (badges never re-lock).
        val unlocked = store.getUnlockedAchievements() + cloudUnlocked(data)
        // activityDays (A4): per-day MAX — cloud counts, local active
        // days as 1 (the app keeps no per-day count), floored by the
        // completion days of the merged lessons (web history floor).
        @Suppress("UNCHECKED_CAST")
        val cloudDays = (data?.get("activityDays") as? Map<String, Any?>) ?: emptyMap()
        val actDays = LinkedHashMap<String, Long>()
        for ((d, v) in cloudDays) {
            val c = (v as? Number)?.toLong() ?: 0
            if (c > 0) actDays[d] = c
        }
        for (d in store.activeDays()) actDays[d] = maxOf(actDays[d] ?: 0, 1)
        val dayFmt = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        for ((_, ts) in progress.doneAt) {
            if (ts > 0) {
                val d = dayFmt.format(java.util.Date(ts))
                actDays[d] = maxOf(actDays[d] ?: 0, 1)
            }
        }
        // reviews (App 2.0 Phase B): per-lesson last-write-wins by
        // updatedAt, tie -> local (web mergeReviews). Cloud shape:
        // {items: {id: {interval, due, updatedAt}}, updatedAt}.
        val cloudReviewsRaw = (data?.get("reviews") as? Map<*, *>)?.get("items") as? Map<*, *>
        val cloudReviews = mutableMapOf<String, ReviewEntry>()
        if (cloudReviewsRaw != null) {
            for ((k, v) in cloudReviewsRaw) {
                val id = k as? String ?: continue
                val e = v as? Map<*, *> ?: continue
                val interval = (e["interval"] as? Number)?.toInt() ?: 0
                val due = (e["due"] as? Number)?.toLong() ?: 0L
                val upd = (e["updatedAt"] as? Number)?.toLong() ?: 0L
                if (interval > 0 && due > 0 && upd > 0) {
                    cloudReviews[id] = ReviewEntry(interval, due, upd)
                }
            }
        }
        val localReviews = store.reviews()
        val reviews = (localReviews.keys + cloudReviews.keys).associateWith { id ->
            val le = localReviews[id]
            val ce = cloudReviews[id]
            when {
                le != null && ce != null -> if (ce.updatedAt > le.updatedAt) ce else le
                else -> le ?: ce!!
            }
        }
        return MergedState(
            progress = progress,
            attempts = attempts,
            finalName = if (cloudWins) cName else store.getProfileName(),
            finalBio = if (cloudWins) cBio else store.getProfileBio(),
            finalTs = maxOf(cTs, lTs),
            profileCloudWins = cloudWins,
            paths = paths,
            placement = placement,
            counters = counters,
            unlocked = unlocked,
            activityDays = actDays,
            reviews = reviews
        )
    }

    /** Applies a merged state to the local Store. A null placement is
        NEVER written (web writeLocalPlacement: no information must not
        wipe a local record). */
    private fun applyMerged(m: MergedState) {
        store.applySyncedProgress(m.progress.lessons, m.progress.xp, m.progress.streakCount, m.progress.streakLast)
        store.applySyncedDoneAt(m.progress.doneAt)
        store.applySyncedRunCount(m.progress.runCount)
        store.applySyncedAttempts(m.attempts)
        // Profile applies locally only when the cloud side won the
        // last-write-wins comparison (original behaviour, web parity).
        if (m.profileCloudWins) store.applySyncedProfile(m.finalName, m.finalBio, m.finalTs)
        store.applySyncedEnrollments(m.paths)
        if (m.placement != null) store.setPlacement(m.placement)
        store.applySyncedCounters(m.counters)
        store.applySyncedUnlocked(m.unlocked)
        store.applySyncedActiveDays(m.activityDays.keys)
        store.applySyncedActivityCounts(m.activityDays)
        store.applySyncedReviews(m.reviews)
    }

    /** Push payload: ONLY the top-level fields the app owns. Placement
        is included only when a merged record exists. */
    private fun payloadOf(m: MergedState, now: Long, includeProfile: Boolean): Map<String, Any?> {
        val payload = mutableMapOf<String, Any?>(
            "progress" to mapOf(
                "lessons" to m.progress.lessons.associateWith { true },
                "xp" to m.progress.xp,
                "runCount" to m.progress.runCount,
                "streakCount" to m.progress.streakCount,
                "streakLast" to (m.progress.streakLast ?: ""),
                "doneAt" to m.progress.doneAt,
                "updatedAt" to now
            ),
            "exercises" to mapOf(
                "attempts" to m.attempts.mapValues { (_, a) -> attemptMap(a) },
                "updatedAt" to now
            ),
            "paths" to pathsMap(m.paths, now),
            "counters" to countersMap(m.counters)
        )
        if (includeProfile) {
            payload["profile"] = mapOf(
                "name" to m.finalName, "bio" to m.finalBio, "updatedAt" to m.finalTs
            )
        }
        m.placement?.let { payload["placement"] = placementMap(it) }
        // Unlock record: written only when non-empty (placement
        // precedent — an empty record carries no information).
        if (m.unlocked.isNotEmpty()) {
            payload["achievements"] = m.unlocked.associateWith { true }
        }
        // activityDays (A4): written only when non-empty (same
        // no-information rule as the unlock record).
        if (m.activityDays.isNotEmpty()) {
            payload["activityDays"] = m.activityDays
        }
        // reviews (Phase B): the web's {items, updatedAt} shape,
        // written only when non-empty.
        if (m.reviews.isNotEmpty()) {
            payload["reviews"] = mapOf(
                "items" to m.reviews.mapValues { (_, e) ->
                    mapOf(
                        "interval" to e.interval,
                        "due" to e.due,
                        "updatedAt" to e.updatedAt
                    )
                },
                "updatedAt" to (m.reviews.values.maxOfOrNull { it.updatedAt } ?: 0L)
            )
        }
        return payload
    }

    /* ---------------- workspace (App 2.0 A4) ----------------
       Port of the web's mergeWorkspace (sync.js v23). The workspace
       lives in its OWN document, users/{uid}/syncData/workspace, in
       the cloud shape {files, tabs, active, mtimes, deleted,
       updatedAt}; the main doc's legacy inline `workspace` field is
       folded into the cloud side on read. Rules (web comment, abridged):
       per-file last-write-wins by mtime; a deletion is a tombstone —
       a file survives only when some side holds a copy edited AFTER
       its tombstone, so a stale device can never resurrect a deleted
       file; tabs/active are whole-doc LWW by updatedAt, filtered to
       surviving files; a side with no files AND no tombstones carries
       no information. The doc is written back only when the merge is
       newer than the stored doc and fits the web's 700 KB budget. */

    private data class WorkspaceDoc(
        val files: Map<String, String> = emptyMap(),
        val mtimes: Map<String, Long> = emptyMap(),
        val deleted: Map<String, Long> = emptyMap(),
        val tabs: List<String> = emptyList(),
        val active: String? = null,
        val updatedAt: Long = 0
    )

    private val wsSyncMaxBytes = 700 * 1024

    private fun workspaceDocRef(uid: String) =
        db.collection("users").document(uid).collection("syncData").document("workspace")

    /** Normalises a raw cloud map (either doc shape) into a WorkspaceDoc. */
    private fun cloudWorkspace(data: Map<String, Any?>?): WorkspaceDoc {
        if (data == null) return WorkspaceDoc()
        val filesRaw = data["files"] as? Map<*, *> ?: emptyMap<Any?, Any?>()
        val files = LinkedHashMap<String, String>()
        for ((k, v) in filesRaw) {
            val name = k as? String ?: continue
            val code = v as? String ?: continue
            files[name] = code
        }
        fun tsMap(key: String): Map<String, Long> {
            val raw = data[key] as? Map<*, *> ?: return emptyMap()
            val out = LinkedHashMap<String, Long>()
            for ((k, v) in raw) {
                val name = k as? String ?: continue
                val ts = (v as? Number)?.toLong() ?: 0
                if (ts > 0) out[name] = ts
            }
            return out
        }
        val tabsRaw = (data["tabs"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
        val tabs = tabsRaw.filter { it in files }.ifEmpty { files.keys.toList() }
        val activeRaw = data["active"] as? String
        val active = if (activeRaw != null && activeRaw in files) activeRaw else tabs.firstOrNull()
        val updatedAt = (data["updatedAt"] as? Number)?.toLong()?.takeIf { it > 0 } ?: 0
        return WorkspaceDoc(files, tsMap("mtimes"), tsMap("deleted"), tabs, active, updatedAt)
    }

    private fun localWorkspace(): WorkspaceDoc {
        val files = store.workspaceFiles()
        val meta = store.workspaceMeta()
        return WorkspaceDoc(
            files = files,
            mtimes = meta.mtimes,
            deleted = meta.deleted,
            tabs = files.keys.toList(),
            active = files.keys.firstOrNull(),
            updatedAt = meta.updatedAt
        )
    }

    private fun mergeWorkspace(l: WorkspaceDoc, c: WorkspaceDoc): WorkspaceDoc {
        val names = l.files.keys + c.files.keys + l.deleted.keys + c.deleted.keys
        val files = LinkedHashMap<String, String>()
        val mtimes = LinkedHashMap<String, Long>()
        val deleted = LinkedHashMap<String, Long>()
        for (name in names) {
            val d = maxOf(l.deleted[name] ?: 0, c.deleted[name] ?: 0)
            val lm = if (name in l.files) (l.mtimes[name] ?: 0) else -1
            val cm = if (name in c.files) (c.mtimes[name] ?: 0) else -1
            val bestM = maxOf(lm, cm)
            if (if (d == 0L) bestM >= 0 else bestM > d) {
                if (lm >= cm) {
                    files[name] = l.files.getValue(name); mtimes[name] = lm
                } else {
                    files[name] = c.files.getValue(name); mtimes[name] = cm
                }
            } else if (d > 0) {
                deleted[name] = d
            }
        }
        val w = if (l.updatedAt >= c.updatedAt) l else c
        val tabs = w.tabs.filter { it in files }.toMutableList()
        for (n in files.keys.sorted()) if (n !in tabs) tabs.add(n)
        val active = if (w.active != null && w.active in files) w.active else tabs.firstOrNull()
        return WorkspaceDoc(files, mtimes, deleted, tabs, active, maxOf(l.updatedAt, c.updatedAt))
    }

    /**
     * One workspace sync cycle: read the workspace doc, fold the legacy
     * inline field in, merge with local, apply locally, and write back
     * only when the merge advanced the doc. Fail-soft: returns false on
     * any error and never disturbs the main sync result.
     */
    suspend fun syncWorkspace(uid: String, legacyInline: Map<String, Any?>?): Boolean {
        return try {
            val ref = workspaceDocRef(uid)
            val snap = ref.get().await()
            val wsData = if (snap.exists()) snap.data else null
            val stored = cloudWorkspace(wsData)
            val cloud = mergeWorkspace(cloudWorkspace(legacyInline), stored)
            val merged = mergeWorkspace(localWorkspace(), cloud)
            store.applySyncedWorkspace(
                merged.files,
                Store.WorkspaceMeta(merged.mtimes, merged.deleted, merged.updatedAt)
            )
            val hasInfo = merged.files.isNotEmpty() || merged.deleted.isNotEmpty()
            val bytes = merged.files.values.sumOf { it.toByteArray(Charsets.UTF_8).size }
            if (hasInfo && merged.updatedAt > stored.updatedAt && bytes <= wsSyncMaxBytes) {
                ref.set(
                    mapOf(
                        "files" to merged.files,
                        "tabs" to merged.tabs,
                        "active" to merged.active,
                        "mtimes" to merged.mtimes,
                        "deleted" to merged.deleted,
                        "updatedAt" to merged.updatedAt
                    )
                ).await()
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    /* ---------------- sync ---------------- */

    /**
     * Full sync: pull the user doc, merge with local, write merged state
     * to both. Read-merge-write with SetOptions.merge() scoped to the
     * app's own top-level fields — unknown/newer web fields survive.
     * Never throws — returns false and sets status on any failure.
     */
    suspend fun syncNow(uid: String): Boolean {
        lastStatus = "Syncing..."
        return try {
            val now = System.currentTimeMillis()
            val snap = userDoc(uid).get().await()
            val data = if (snap.exists()) snap.data else null
            val merged = mergeAll(data)
            userDoc(uid).set(payloadOf(merged, now, includeProfile = true), SetOptions.merge()).await()
            // Local state is written only AFTER the cloud write commits
            // (same discipline as web buildMerged/applyMerged), so a
            // failed push never leaves local pretending to be synced.
            applyMerged(merged)
            // A4: workspace doc cycle (fail-soft by design; the legacy
            // inline workspace field is folded in on read).
            val legacyWs: Map<String, Any?>? = data?.get("workspace") as? Map<String, Any?>
            syncWorkspace(uid, legacyWs)
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
     * Same read-merge-write as syncNow (profile included — web pushes
     * the whole merged payload every cycle), so two devices never
     * clobber each other.
     */
    suspend fun pushNow(uid: String): Boolean {
        return try {
            val now = System.currentTimeMillis()
            val snap = userDoc(uid).get().await()
            val data = if (snap.exists()) snap.data else null
            val merged = mergeAll(data)
            userDoc(uid).set(payloadOf(merged, now, includeProfile = true), SetOptions.merge()).await()
            applyMerged(merged)
            // A4: workspace doc cycle (fail-soft, as in syncNow).
            val legacyWs: Map<String, Any?>? = data?.get("workspace") as? Map<String, Any?>
            syncWorkspace(uid, legacyWs)
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
     * echo of our own writes, so this cannot loop.
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
     * Pull-only merge: cloud -> local Store, no push. Used by the
     * real-time listener. Idempotent — merging the same data twice is
     * a no-op.
     */
    suspend fun pullOnly(data: Map<String, Any?>?) {
        applyMerged(mergeAll(data))
    }
}
