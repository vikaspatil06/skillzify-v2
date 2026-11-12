package com.skillzify.app.data

import java.util.Calendar
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * SmartSystems — pure logic for the four smart systems (Mastery,
 * Placement, Passport, Concept Map), ported from the website:
 * assets/js/mastery.js, placement.js, passport.js, map.js +
 * learn-core.js. No Android dependencies beyond the data models, so
 * every function is deterministic given its inputs.
 */

const val RUST_DAYS: Long = 21
private const val DAY_MS: Long = 86400000L

/** Band thresholds (task spec; web band() in mastery.js agrees for
    tried topics: 85+ Mastered, 60+ Solid, 30+ Building, else Starting out). */
fun bandFor(score: Int): String = when {
    score >= 85 -> "Mastered"
    score >= 60 -> "Solid"
    score >= 30 -> "Building"
    else -> "Starting out"
}

/** Web band(score, tried): untried topics are "Not tried yet", not 0%. */
private fun bandFor(score: Int, tried: Boolean): String =
    if (!tried) "Not tried yet" else bandFor(score)

private fun isRusty(lastMs: Long, nowMs: Long): Boolean =
    lastMs > 0 && (nowMs - lastMs) > RUST_DAYS * DAY_MS

/* ================= Mastery (mastery.js) ================= */

/**
 * Per-exercise quality q, mirroring mastery.js quality()'s legacy
 * derivation: unsolved 0; revealed 0.4; hinted or >1 attempt 0.7;
 * clean first-try 1.0.
 * SIMPLIFICATION: the web also honours a `solveQuality` snapshot frozen
 * at solve time; the app's ExerciseAttempt has no such field, so the
 * live derivation is always used. The web's "unknown record -> 0.7"
 * branch (missing hintsUsed/revealed fields) cannot occur here —
 * app records always carry both fields.
 */
fun quality(att: ExerciseAttempt?): Double {
    if (att == null || !att.solved) return 0.0
    if (att.revealed) return 0.4
    if (att.hintsUsed > 0 || att.attempts > 1) return 0.7
    return 1.0
}

data class TopicMastery(
    val topic: String, val score: Int, val band: String,
    val tried: Int, val solved: Int, val total: Int, val rusty: Boolean
)

/**
 * Mirrors mastery.js topicMastery(): score = round(100 * sum(quality)
 * / total exercises in topic), computed only when tried > 0 (web
 * returns a null score for untried topics — here score 0 with band
 * "Not tried yet"). Rusty = tried and the topic's most recent attempt
 * (max lastTry) is older than RUST_DAYS (web isRusty).
 */
fun computeTopicMastery(
    exercises: List<Exercise>,
    attempts: (String) -> ExerciseAttempt,
    nowMs: Long
): List<TopicMastery> {
    val order = mutableListOf<String>()
    val byTopic = mutableMapOf<String, MutableList<Exercise>>()
    for (ex in exercises) {
        if (ex.topic !in byTopic) { byTopic[ex.topic] = mutableListOf(); order.add(ex.topic) }
        byTopic[ex.topic]!!.add(ex)
    }
    return order.map { topic ->
        val list = byTopic[topic]!!
        var qSum = 0.0
        var tried = 0
        var solved = 0
        var lastMs = 0L
        for (ex in list) {
            val a = attempts(ex.id)
            if (a.attempts > 0) {
                tried++
                if (a.solved) solved++
                if (a.lastTry > lastMs) lastMs = a.lastTry
            }
            qSum += quality(a)
        }
        val score = if (tried > 0) (100.0 * qSum / list.size).roundToInt() else 0
        TopicMastery(
            topic = topic, score = score, band = bandFor(score, tried > 0),
            tried = tried, solved = solved, total = list.size,
            rusty = tried > 0 && isRusty(lastMs, nowMs)
        )
    }
}

data class SectionMastery(
    val sectionId: String, val score: Int, val band: String,
    val doneCount: Int, val totalCount: Int, val rusty: Boolean
)

/** Retention credit per completed lesson (mastery.js INTERVAL_RETENTION
    via retentionFor()): never reviewed = 0.7. */
private const val RETENTION_NEVER_REVIEWED: Double = 0.7

/**
 * Mirrors mastery.js sectionMastery(): for each section (catalog.tracks
 * carries the 7 sections), score = round(100 * (done/total) * retention)
 * where retention is the average retentionFor(review interval) over the
 * done lessons.
 * SIMPLIFICATION: the app has no spaced-repetition review store, so
 * every done lesson's interval is null -> retention 0.7 exactly as the
 * web computes for a never-reviewed learner (section score caps at 70
 * until reviews exist). Rust: web uses last REVIEW activity plus an
 * overdue-review fallback; the app has no review dates, so rust falls
 * back to the most recent lesson completion time (lessonDoneAt) older
 * than RUST_DAYS. Sections are matched by Lesson.section.
 */
fun computeSectionMastery(
    catalog: Catalog,
    doneIds: Set<String>,
    lessonDoneAt: (String) -> Long? = { null },
    nowMs: Long = System.currentTimeMillis()
): List<SectionMastery> {
    return catalog.tracks.map { sec ->
        val lessons = catalog.lessons.filter { it.section == sec.id }
        val total = lessons.size
        val doneList = lessons.filter { it.id in doneIds }
        val done = doneList.size
        val score = if (done > 0 && total > 0)
            (100.0 * (done.toDouble() / total) * RETENTION_NEVER_REVIEWED).roundToInt()
        else 0
        var lastMs = 0L
        for (l in doneList) {
            val at = lessonDoneAt(l.id) ?: 0L
            if (at > lastMs) lastMs = at
        }
        SectionMastery(
            sectionId = sec.id, score = score, band = bandFor(score, done > 0),
            doneCount = done, totalCount = total,
            rusty = done > 0 && isRusty(lastMs, nowMs)
        )
    }
}

/* ================= Placement (placement.js) ================= */

data class StageScore(val correct: Int = 0, val total: Int = 0)

data class PlacementQ(
    val exercise: Exercise,
    val stage: String,
    /** Stage-C item the learner had already solved in practice
        (placement.js P2-27) — noted in the result reason. */
    val reasked: Boolean = false
)

data class PlacementResult(
    val section: String,
    val score: Int,
    val total: Int,
    val reason: String,
    val stages: Map<String, StageScore> = emptyMap()
)

data class PlacementRecord(
    val section: String,
    val score: Int,
    val total: Int,
    val date: Long,
    val stages: Map<String, StageScore> = emptyMap()
)

/** The 7 journey sections in order (placement.js SECTION_ORDER). */
val SECTION_ORDER: List<String> = listOf(
    "base-camp", "tool-shed", "object-castle", "algorithm-arena",
    "power-lab", "data-lab", "launch-pad"
)

object PlacementEngine {
    // placement.js STAGES, verbatim.
    private data class StageDef(val n: Int, val topics: List<String>, val diffs: List<Int>, val d3First: Boolean = false)

    private val STAGES: Map<String, StageDef> = linkedMapOf(
        "a" to StageDef(3, listOf("variables", "strings", "collections"), listOf(1)),
        "b" to StageDef(4, listOf("loops", "functions", "oop", "exceptions"), listOf(2)),
        "c" to StageDef(3, listOf(
            "dsa", "recursion", "sorting", "trees-graphs", "dynamic-programming",
            "data-science", "web", "files", "async"
        ), listOf(3, 2), d3First = true)
    )

    // placement.js REASONS, verbatim.
    private val REASONS: Map<String, String> = mapOf(
        "base-camp" to "The basics are still new — start at Base Camp and build up from lesson 1.",
        "tool-shed" to "Basics are solid, but the core is shaky — start at Tool Shed.",
        "object-castle" to "Basics are solid and the core is half there — start at Object Castle.",
        "algorithm-arena" to "The core is solid, but the advanced questions were new — start at Algorithm Arena.",
        "power-lab" to "You know some advanced material — start at Power Lab.",
        "data-lab" to "Strong advanced knowledge — start at Data Lab.",
        "launch-pad" to "You aced the advanced questions — start at the capstone section, Launch Pad."
    )

    private fun tier(
        bank: List<Exercise>, diffs: List<Int>, topics: List<String>?,
        wantSolved: Boolean, solvedIds: Set<String>
    ): List<Exercise> = bank.filter { ex ->
        ex.diff in diffs &&
            (topics == null || ex.topic in topics) &&
            ((ex.id in solvedIds) == wantSolved)
    }

    /** Ordered candidate tiers for one stage, strict first (placement.js
        candidates()). Each tier is shuffled on its own when sampled. */
    private fun candidates(stageKey: String, bank: List<Exercise>, solvedIds: Set<String>): List<List<Exercise>> {
        val def = STAGES.getValue(stageKey)
        val tiers = mutableListOf<List<Exercise>>()
        if (def.d3First) {
            tiers.add(tier(bank, listOf(3), def.topics, false, solvedIds))
            tiers.add(tier(bank, listOf(2), def.topics, false, solvedIds))
            tiers.add(tier(bank, listOf(3), null, false, solvedIds))
            tiers.add(tier(bank, listOf(2), null, false, solvedIds))
            tiers.add(tier(bank, listOf(3), def.topics, true, solvedIds))
            tiers.add(tier(bank, listOf(2), def.topics, true, solvedIds))
            tiers.add(tier(bank, listOf(3), null, true, solvedIds))
            tiers.add(tier(bank, listOf(2), null, true, solvedIds))
        } else {
            tiers.add(tier(bank, def.diffs, def.topics, false, solvedIds))
            tiers.add(tier(bank, def.diffs, null, false, solvedIds))
            tiers.add(tier(bank, def.diffs, def.topics, true, solvedIds))
            tiers.add(tier(bank, def.diffs, null, true, solvedIds))
        }
        if (stageKey == "c") {
            // Stage C final fallback stays at difficulty >= 2 (P2-27).
            tiers.add(bank.filter { it.diff >= 2 && it.id !in solvedIds })
            tiers.add(bank.filter { it.diff >= 2 && it.id in solvedIds })
        } else {
            tiers.add(bank.filter { it.id !in solvedIds })
            tiers.add(bank.filter { it.id in solvedIds })
        }
        return tiers
    }

    private fun sampleStage(
        stageKey: String, bank: List<Exercise>, solvedIds: Set<String>,
        rnd: Random, seen: MutableSet<String>
    ): List<PlacementQ> {
        val def = STAGES.getValue(stageKey)
        val out = mutableListOf<PlacementQ>()
        for (tierList in candidates(stageKey, bank, solvedIds)) {
            for (ex in tierList.shuffled(rnd)) {
                if (out.size >= def.n || ex.id in seen) continue
                seen.add(ex.id)
                out.add(
                    PlacementQ(
                        exercise = ex, stage = stageKey,
                        reasked = stageKey == "c" && ex.id in solvedIds
                    )
                )
            }
        }
        return out
    }

    /**
     * Builds the staged test: bank = predict exercises only; unsolved
     * preferred over solved via the tier order; no question repeats
     * across stages (shared `seen`). Returns A ++ B ++ C (3+4+3 = 10
     * when the bank allows). Deterministic for a given seed.
     */
    fun buildTest(exercises: List<Exercise>, solvedIds: Set<String>, seed: Long): List<PlacementQ> {
        val bank = exercises.filter { it.kind == "predict" }
        val rnd = Random(seed)
        val seen = mutableSetOf<String>()
        val a = sampleStage("a", bank, solvedIds, rnd, seen)
        val b = sampleStage("b", bank, solvedIds, rnd, seen)
        val c = sampleStage("c", bank, solvedIds, rnd, seen)
        return a + b + c
    }

    private fun stageScore(asked: List<PlacementQ>, answers: Map<String, Int>): StageScore {
        var correct = 0
        for (q in asked) if (answers[q.exercise.id] == q.exercise.answer) correct++
        return StageScore(correct, asked.size)
    }

    /**
     * placement.js score(), faithfully: the section ladder uses COUNTS
     * out of the FULL stage size (below(): correct/full < cut/full), so
     * a genuinely short stage reads conservatively — unasked questions
     * count as unanswered. answers maps exerciseId -> chosen option index.
     */
    fun score(asked: List<PlacementQ>, answers: Map<String, Int>): PlacementResult {
        val byStage = mapOf(
            "a" to asked.filter { it.stage == "a" },
            "b" to asked.filter { it.stage == "b" },
            "c" to asked.filter { it.stage == "c" }
        )
        val sa = stageScore(byStage.getValue("a"), answers)
        val sb = stageScore(byStage.getValue("b"), answers)
        val sc = stageScore(byStage.getValue("c"), answers)
        fun below(s: StageScore, full: Int, countCut: Int): Boolean =
            s.correct.toDouble() / full < countCut.toDouble() / full
        val section = when {
            sa.total == 0 -> "base-camp"
            below(sa, 3, 2) -> "base-camp"
            sb.total == 0 -> "tool-shed"
            below(sb, 4, 2) -> "tool-shed"
            below(sb, 4, 3) -> "object-castle"
            sc.total == 0 -> "algorithm-arena"
            below(sc, 3, 1) -> "algorithm-arena"
            below(sc, 3, 2) -> "power-lab"
            below(sc, 3, 3) -> "data-lab"
            else -> "launch-pad"
        }
        val total = sa.total + sb.total + sc.total
        val correct = sa.correct + sb.correct + sc.correct
        var reason = REASONS[section] ?: ""
        val reaskedC = sc.total > 0 && byStage.getValue("c").any { it.reasked }
        if (reaskedC) reason += " Some advanced questions were ones you had already solved in practice, so the advanced result is approximate."
        return PlacementResult(
            section = section, score = correct, total = total, reason = reason,
            stages = mapOf("a" to sa, "b" to sb, "c" to sc)
        )
    }
}

/* ================= Passport (passport.js) ================= */

data class PassportEntry(
    val sectionId: String, val name: String, val icon: String,
    val earned: Boolean, val certId: String?, val completedAt: Long?
)

private fun pad2(n: Int): String = if (n < 10) "0$n" else n.toString()

/** "SKZ-{SECTION}-{YYMMDD}" of the completion date (passport.js certId). */
fun certIdFor(sectionId: String, atMs: Long): String {
    val cal = Calendar.getInstance()
    cal.timeInMillis = atMs
    val yy = pad2(cal.get(Calendar.YEAR) % 100)
    val mm = pad2(cal.get(Calendar.MONTH) + 1)
    val dd = pad2(cal.get(Calendar.DAY_OF_MONTH))
    return "SKZ-" + sectionId.uppercase() + "-" + yy + mm + dd
}

/**
 * One entry per section (catalog.tracks): earned when the section has
 * lessons and ALL of them are done. certId is issued only when a
 * completion date exists (completedAt callback) — a section finished
 * before dates were recorded honestly shows no cert id, matching the
 * web's "null until complete, null again when no date was recorded".
 */
fun buildPassport(
    catalog: Catalog,
    doneIds: Set<String>,
    completedAt: (String) -> Long?
): List<PassportEntry> {
    return catalog.tracks.map { sec ->
        val lessons = catalog.lessons.filter { it.section == sec.id }
        val earned = lessons.isNotEmpty() && lessons.all { it.id in doneIds }
        val at = if (earned) completedAt(sec.id) else null
        PassportEntry(
            sectionId = sec.id, name = sec.name, icon = sec.icon,
            earned = earned,
            certId = if (earned && at != null) certIdFor(sec.id, at) else null,
            completedAt = at
        )
    }
}

/* ================= Concept map (map.js, simplified) ================= */

enum class NodeState { DONE, CURRENT, OPEN, LOCKED, WEAK, RUSTY }

data class SectionNode(val section: Track, val state: NodeState, val pct: Int)
data class LessonNode(val lesson: Lesson, val state: NodeState)

/**
 * Section nodes in journey order. State (map.js buildGraph, simplified):
 * RUSTY overrides when the section is rusty; LOCKED when not unlocked;
 * DONE at 100%; WEAK when mastery < 60 with some progress (pct > 0);
 * CURRENT = the first unlocked, not-done section; otherwise OPEN.
 */
fun sectionNodes(
    catalog: Catalog,
    doneIds: Set<String>,
    unlockedSections: Set<String>,
    masteryBySection: Map<String, Int>,
    rustySections: Set<String>
): List<SectionNode> {
    var currentAssigned = false
    return catalog.tracks.map { sec ->
        val lessons = catalog.lessons.filter { it.section == sec.id }
        val done = lessons.count { it.id in doneIds }
        val pct = if (lessons.isEmpty()) 0 else done * 100 / lessons.size
        val mastery = masteryBySection[sec.id]
        val state = when {
            sec.id in rustySections -> NodeState.RUSTY
            sec.id !in unlockedSections -> NodeState.LOCKED
            lessons.isNotEmpty() && done == lessons.size -> NodeState.DONE
            mastery != null && mastery < 60 && pct > 0 -> NodeState.WEAK
            !currentAssigned -> { currentAssigned = true; NodeState.CURRENT }
            else -> NodeState.OPEN
        }
        SectionNode(section = sec, state = state, pct = pct)
    }
}

/**
 * Lesson nodes of one section, in catalog order. State (task spec):
 * DONE = done; CURRENT = first not-done unlocked lesson of the section;
 * OPEN = unlocked, not done; LOCKED otherwise. isUnlocked receives the
 * lesson's GLOBAL catalog index (AppViewModel.isUnlocked semantics).
 */
fun lessonNodes(
    catalog: Catalog,
    sectionId: String,
    doneIds: Set<String>,
    isUnlocked: (Int) -> Boolean
): List<LessonNode> {
    val lessons = catalog.lessons.filter { it.section == sectionId }
    var currentAssigned = false
    return lessons.map { lesson ->
        val gi = catalog.lessons.indexOf(lesson)
        val unlocked = gi >= 0 && isUnlocked(gi)
        val state = when {
            lesson.id in doneIds -> NodeState.DONE
            !unlocked -> NodeState.LOCKED
            !currentAssigned -> { currentAssigned = true; NodeState.CURRENT }
            else -> NodeState.OPEN
        }
        LessonNode(lesson = lesson, state = state)
    }
}
