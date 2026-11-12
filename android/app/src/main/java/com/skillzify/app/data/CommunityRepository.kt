package com.skillzify.app.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await

/**
 * Community access — Firestore collections questions / answers /
 * showcase / xpGrants, matching the website's community.js field names
 * and firestore.rules exactly:
 *
 * - questions: { authorUid, authorName, title, body, code, lessonId,
 *   exId, error, status:"open", bestAnswerId:null, answerCount:0,
 *   createdAt, updatedAt } — born open/unanswered (rules P1-27).
 * - answers: { questionId, authorUid, authorName, body, code,
 *   createdAt, isBest:false }; posting bumps the question's stored
 *   answerCount via FieldValue.increment(1) (rules allow exactly +1).
 * - markBest: one batched write (answer isBest, previous best unmarked,
 *   question status/bestAnswerId), then the deterministic xpGrants doc
 *   "${questionId}_${answerId}" { toUid, amount:10, reason:"best-answer",
 *   questionId, answerId, createdAt, claimed:false } — set() only, so a
 *   re-mark can never mint a second grant (rules P0-2/P1-12).
 * - showcase: { authorUid, authorName, title, desc, code, projectId,
 *   createdAt, starCount:0, stars:{} } — born unstarred (rules P1-27);
 *   starring toggles ONLY the caller's own uid in the stars map inside
 *   a transaction, starCount == stars.size (rules P1-17); starring your
 *   own post is refused (web P2-34).
 *
 * Field-name mapping into the app's item types: QItem.uid <- authorUid,
 * QItem.topic <- lessonId (the anchor; exId when lessonId is absent),
 * QItem.answersCount <- answerCount (recomputed from the answers query
 * like web listQuestions P1-14, stored value as fallback), SItem.stars
 * <- starCount.
 *
 * Style matches SyncRepository: suspend functions + Tasks.await().
 * EVERY function fails soft (empty list / null / false on any error) so
 * the UI never crashes offline.
 */
class CommunityRepository {
    private val db: FirebaseFirestore by lazy { FirebaseFirestore.getInstance() }
    private val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }

    data class QItem(
        val id: String, val uid: String, val authorName: String,
        val title: String, val body: String, val topic: String,
        val createdAt: Long, val answersCount: Int, val bestAnswerId: String?
    )

    data class AItem(
        val id: String, val uid: String, val authorName: String,
        val body: String, val createdAt: Long, val isBest: Boolean
    )

    data class SItem(
        val id: String, val uid: String, val authorName: String,
        val title: String, val desc: String, val code: String,
        val stars: Int, val createdAt: Long
    )

    /** Firestore values arrive as Timestamp, Date, Number or null. */
    private fun toMs(v: Any?): Long = when (v) {
        is Number -> v.toLong()
        is com.google.firebase.Timestamp -> v.toDate().time
        is java.util.Date -> v.time
        else -> 0L
    }

    private fun currentUid(): String? = try { auth.currentUser?.uid } catch (e: Exception) { null }

    /* ---------------- questions ---------------- */

    suspend fun fetchQuestions(limit: Int): List<QItem> {
        return try {
            val snap = db.collection("questions")
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get().await()
            val items = snap.documents.map { doc ->
                val d = doc.data ?: emptyMap()
                QItem(
                    id = doc.id,
                    uid = d["authorUid"] as? String ?: "",
                    authorName = d["authorName"] as? String ?: "",
                    title = d["title"] as? String ?: "",
                    body = d["body"] as? String ?: "",
                    topic = (d["lessonId"] as? String) ?: (d["exId"] as? String) ?: "",
                    createdAt = toMs(d["createdAt"]),
                    answersCount = (d["answerCount"] as? Number)?.toInt() ?: 0,
                    bestAnswerId = d["bestAnswerId"] as? String
                )
            }
            // Web P1-14: the stored answerCount is client-writable, so
            // the displayed count is recomputed from the answers query;
            // a failed count keeps the stored value.
            items.map { q ->
                try {
                    val n = db.collection("answers")
                        .whereEqualTo("questionId", q.id).limit(100).get().await().size()
                    q.copy(answersCount = n)
                } catch (e: Exception) { q }
            }
        } catch (e: Exception) { emptyList() }
    }

    suspend fun fetchAnswers(questionId: String): List<AItem> {
        return try {
            val snap = db.collection("answers")
                .whereEqualTo("questionId", questionId).limit(100).get().await()
            snap.documents.map { doc ->
                val d = doc.data ?: emptyMap()
                AItem(
                    id = doc.id,
                    uid = d["authorUid"] as? String ?: "",
                    authorName = d["authorName"] as? String ?: "",
                    body = d["body"] as? String ?: "",
                    createdAt = toMs(d["createdAt"]),
                    isBest = d["isBest"] as? Boolean ?: false
                )
            }.sortedBy { it.createdAt } // web listAnswers sorts client-side
        } catch (e: Exception) { emptyList() }
    }

    /** topic is the anchor: written as lessonId (web askQuestion).
        Returns the new question id, or null on failure. */
    suspend fun postQuestion(uid: String, name: String, title: String, body: String, topic: String): String? {
        return try {
            val now = FieldValue.serverTimestamp()
            val ref = db.collection("questions").add(
                mapOf(
                    "authorUid" to uid, "authorName" to name,
                    "title" to title.trim(), "body" to body, "code" to "",
                    "lessonId" to topic.ifBlank { null }, "exId" to null, "error" to null,
                    "status" to "open", "bestAnswerId" to null, "answerCount" to 0,
                    "createdAt" to now, "updatedAt" to now
                )
            ).await()
            ref.id
        } catch (e: Exception) { null }
    }

    /** Returns the new answer id, or null on failure (including a
        deleted/nonexistent question — web P2-32 reads it first). */
    suspend fun postAnswer(questionId: String, uid: String, name: String, body: String): String? {
        return try {
            val qRef = db.collection("questions").document(questionId)
            val qSnap = qRef.get().await()
            if (!qSnap.exists()) return null
            val ref = db.collection("answers").add(
                mapOf(
                    "questionId" to questionId, "authorUid" to uid, "authorName" to name,
                    "body" to body, "code" to "",
                    "createdAt" to FieldValue.serverTimestamp(), "isBest" to false
                )
            ).await()
            // Stored-counter bump (compat only; display counts come from
            // the answers query). A failed bump never fails the post.
            try {
                qRef.update(
                    mapOf(
                        "answerCount" to FieldValue.increment(1),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            } catch (e: Exception) { /* compat counter only */ }
            ref.id
        } catch (e: Exception) { null }
    }

    /**
     * Marks an answer best. The CALLER must be the question's asker
     * (rules enforce it). answerUid = the answer author's uid — the
     * xpGrants recipient. The three updates land in ONE batch (web
     * P1-11); the +10 XP grant is written afterwards with the web's
     * deterministic doc id and exact fields, and its failure is
     * swallowed like the web (a re-mark's set() is denied as an update).
     * Returns true when the batch committed.
     */
    suspend fun markBest(questionId: String, answerId: String, answerUid: String): Boolean {
        return try {
            val askerUid = currentUid() ?: return false
            val qRef = db.collection("questions").document(questionId)
            val aRef = db.collection("answers").document(answerId)
            val qSnap = qRef.get().await()
            if (!qSnap.exists()) return false
            val q = qSnap.data ?: emptyMap()
            if (q["authorUid"] as? String != askerUid) return false
            if (q["bestAnswerId"] as? String == answerId) return true // already best
            val aSnap = aRef.get().await()
            if (!aSnap.exists()) return false
            val a = aSnap.data ?: emptyMap()
            if (a["questionId"] as? String != questionId) return false
            val wasBest = a["isBest"] as? Boolean ?: false

            val batch = db.batch()
            batch.update(aRef, "isBest", true)
            val prevBest = q["bestAnswerId"] as? String
            if (prevBest != null && prevBest != answerId) {
                batch.update(db.collection("answers").document(prevBest), "isBest", false)
            }
            batch.update(
                qRef,
                mapOf(
                    "status" to "answered", "bestAnswerId" to answerId,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()

            // +10 XP grant for the answer author (never for yourself).
            if (!wasBest && answerUid.isNotEmpty() && answerUid != askerUid) {
                try {
                    db.collection("xpGrants").document("${questionId}_${answerId}").set(
                        mapOf(
                            "toUid" to answerUid, "amount" to 10, "reason" to "best-answer",
                            "questionId" to questionId, "answerId" to answerId,
                            "createdAt" to FieldValue.serverTimestamp(), "claimed" to false
                        )
                    ).await()
                } catch (e: Exception) { /* duplicate grant: denied, swallowed (web parity) */ }
            }
            true
        } catch (e: Exception) { false }
    }

    /* ---------------- showcase ---------------- */

    suspend fun fetchShowcase(): List<SItem> {
        return try {
            val snap = db.collection("showcase")
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(50).get().await()
            snap.documents.map { doc ->
                val d = doc.data ?: emptyMap()
                SItem(
                    id = doc.id,
                    uid = d["authorUid"] as? String ?: "",
                    authorName = d["authorName"] as? String ?: "",
                    title = d["title"] as? String ?: "",
                    desc = d["desc"] as? String ?: "",
                    code = d["code"] as? String ?: "",
                    stars = (d["starCount"] as? Number)?.toInt() ?: 0,
                    createdAt = toMs(d["createdAt"])
                )
            }
        } catch (e: Exception) { emptyList() }
    }

    /** Returns the new showcase id, or null on failure. */
    suspend fun postShowcase(uid: String, name: String, title: String, desc: String, code: String): String? {
        return try {
            val ref = db.collection("showcase").add(
                mapOf(
                    "authorUid" to uid, "authorName" to name,
                    "title" to title.trim(), "desc" to desc, "code" to code,
                    "projectId" to null,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "starCount" to 0, "stars" to emptyMap<String, Boolean>()
                )
            ).await()
            ref.id
        } catch (e: Exception) { null }
    }

    /**
     * Toggles the CURRENT user's star on a showcase post, in a
     * transaction like web toggleStar (concurrent stars can't lose
     * each other). Only the caller's own uid changes in the stars map;
     * starCount is rewritten as stars.size. Starring your own post is
     * refused (web P2-34); un-starring it stays allowed.
     * Returns true when the post is starred AFTER the call; false when
     * it was un-starred OR the operation failed (fail-soft).
     */
    suspend fun starShowcase(item: SItem): Boolean {
        val uid = currentUid() ?: return false
        return try {
            val ref = db.collection("showcase").document(item.id)
            db.runTransaction { tx ->
                val snap = tx.get(ref)
                if (!snap.exists()) return@runTransaction false
                val data = snap.data ?: emptyMap()
                @Suppress("UNCHECKED_CAST")
                val stars = ((data["stars"] as? Map<*, *>)?.entries
                    ?.associate { it.key.toString() to (it.value as? Boolean ?: true) }
                    ?: emptyMap()).toMutableMap()
                val starred: Boolean
                if (stars.containsKey(uid)) {
                    stars.remove(uid); starred = false
                } else {
                    val author = data["authorUid"] as? String
                    if (author != null && author == uid) return@runTransaction false // no self-star
                    stars[uid] = true; starred = true
                }
                tx.update(ref, mapOf("stars" to stars, "starCount" to stars.size))
                starred
            }.await() ?: false
        } catch (e: Exception) { false }
    }

    /* ---------------- my community flags (best effort) ---------------- */

    /**
     * (hasBestAnswer, hasShowcaseStar) for the signed-in user:
     * hasBestAnswer = any of my answers has isBest == true;
     * hasShowcaseStar = any of my showcase posts has starCount > 0.
     * Single-field where + client filter (web stays index-free).
     * Each half is computed independently; failures degrade to false.
     */
    suspend fun fetchMyCommunityFlags(uid: String): Pair<Boolean, Boolean> {
        val hasBest = try {
            val snap = db.collection("answers")
                .whereEqualTo("authorUid", uid).limit(100).get().await()
            snap.documents.any { it.data?.get("isBest") as? Boolean == true }
        } catch (e: Exception) { false }
        val hasStar = try {
            val snap = db.collection("showcase")
                .whereEqualTo("authorUid", uid).limit(50).get().await()
            snap.documents.any { ((it.data?.get("starCount") as? Number)?.toInt() ?: 0) > 0 }
        } catch (e: Exception) { false }
        return hasBest to hasStar
    }
}
