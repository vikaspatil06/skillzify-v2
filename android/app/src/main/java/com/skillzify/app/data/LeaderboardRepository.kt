package com.skillzify.app.data

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await

/* App 2.0 Phase B — the Leaderboard (website parity).
 *
 * Data: the Firestore `publicProfiles` collection, exactly the web's
 * shape (community.js publishProfile / leaderboard.js): one doc per
 * learner {displayName, xp, lessonsDone, lessonsTotal, streak,
 * achievements[], updatedAt}. Real data only — an empty collection
 * shows an honest empty state, never invented people.
 *
 * The read mirrors the web: orderBy xp desc, limit 50, with an
 * unordered-fetch + client-sort fallback when the ordered query
 * fails. Publishing mirrors the web's clamps (name <= 100 chars,
 * lessonsDone <= lessonsTotal, achievements <= 32) and is
 * fire-and-forget: a failed publish never blocks sync. */
object LeaderboardRepository {

    data class LeaderRow(
        val uid: String,
        val name: String,
        val xp: Long,
        val lessonsDone: Long,
        val streak: Long
    )

    private val db: FirebaseFirestore by lazy { FirebaseFirestore.getInstance() }

    suspend fun fetchTop(): Result<List<LeaderRow>> {
        return try {
            val snap = try {
                db.collection("publicProfiles")
                    .orderBy("xp", Query.Direction.DESCENDING)
                    .limit(50)
                    .get().await()
            } catch (e: Exception) {
                db.collection("publicProfiles").limit(50).get().await()
            }
            val rows = snap.documents.map { d ->
                LeaderRow(
                    uid = d.id,
                    name = (d.getString("displayName") ?: "Learner").ifBlank { "Learner" },
                    xp = (d.getLong("xp") ?: 0L).coerceAtLeast(0),
                    lessonsDone = (d.getLong("lessonsDone") ?: 0L).coerceAtLeast(0),
                    streak = (d.getLong("streak") ?: 0L).coerceAtLeast(0)
                )
            }.sortedByDescending { it.xp }
            Result.success(rows)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Publishes the signed-in learner's public profile (web clamps). */
    suspend fun publish(
        uid: String,
        name: String,
        xp: Long,
        lessonsDone: Long,
        lessonsTotal: Long,
        streak: Long,
        achievements: List<String>
    ) {
        try {
            // Clamps match firestore.rules exactly (xp <= 100000,
            // streak <= 1095, lessonsTotal 1..500) so a publish is
            // never rejected for an out-of-range stat.
            val total = lessonsTotal.coerceIn(1, 500)
            val doc = mapOf(
                "displayName" to name.take(100),
                "xp" to xp.coerceIn(0, 100000),
                "lessonsDone" to lessonsDone.coerceIn(0, total),
                "lessonsTotal" to total,
                "streak" to streak.coerceIn(0, 1095),
                "achievements" to achievements.take(32),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            db.collection("publicProfiles").document(uid)
                .set(doc, SetOptions.merge()).await()
        } catch (e: Exception) {
            // Fire-and-forget: publishing must never break sync.
        }
    }
}

/** XP leagues (Phase B v1): bands over the 11-level ladder —
    levels 1-3 Bronze, 4-6 Silver, 7-9 Gold, 10-11 Diamond.
    [levelIndex] is 0-based into the catalog's levels list. */
fun leagueForLevel(levelIndex: Int): String = when {
    levelIndex <= 2 -> "Bronze League"
    levelIndex <= 5 -> "Silver League"
    levelIndex <= 8 -> "Gold League"
    else -> "Diamond League"
}
