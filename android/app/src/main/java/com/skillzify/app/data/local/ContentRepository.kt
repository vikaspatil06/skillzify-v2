package com.skillzify.app.data.local

import android.content.Context
import com.skillzify.app.data.AchievementDef
import com.skillzify.app.data.AppGraph
import com.skillzify.app.data.Catalog
import com.skillzify.app.data.Exercise
import com.skillzify.app.data.LearnPath
import com.skillzify.app.data.Project
import com.skillzify.app.data.RefEntry
import com.skillzify.app.data.Snippet
import com.skillzify.app.data.loadAchievements
import com.skillzify.app.data.loadCatalog
import com.skillzify.app.data.loadExercises
import com.skillzify.app.data.loadPaths
import com.skillzify.app.data.loadProjects
import com.skillzify.app.data.loadReference
import com.skillzify.app.data.loadSnippets
import kotlinx.coroutines.flow.first

/** Everything the catalog gate in AppViewModel publishes at startup. */
data class LoadedContent(
    val catalog: Catalog,
    val achievements: List<AchievementDef>,
    val snippets: List<Snippet>,
    val exercises: List<Exercise>,
    val reference: List<RefEntry>,
    val paths: List<LearnPath>,
    val projects: List<Project>
)

/* App 2.0 Phase A2 — the catalog's single load path.
 *
 * Flow: parse the bundled assets (today's loaders, unchanged) -> if the
 * Room content database's stored version differs from the bundled
 * assets' hash version, import in one transaction -> read the catalog
 * back FROM ROOM, so screens are served by the local database (the
 * local-first source of truth) rather than the parse.
 *
 * Fail-soft by design: ANY failure in the Room path (hashing, import,
 * read-back, an empty read-back) returns the asset-parsed catalog, so
 * startup behaviour can never be worse than v1.4.4. */
object ContentRepository {

    suspend fun load(ctx: Context): LoadedContent {
        val parsed = LoadedContent(
            catalog = loadCatalog(ctx),
            achievements = loadAchievements(ctx),
            snippets = loadSnippets(ctx),
            exercises = loadExercises(ctx),
            reference = loadReference(ctx),
            paths = loadPaths(ctx),
            projects = loadProjects(ctx)
        )
        return try {
            val db = AppGraph.database(ctx)
            val importer = ContentImporter(db)
            val hashes = ContentManifest.assetHashes(ctx)
            if (importer.importedVersion() != ContentManifest.contentVersion(hashes)) {
                importer.importAll(
                    catalog = parsed.catalog,
                    exercises = parsed.exercises,
                    reference = parsed.reference,
                    paths = parsed.paths,
                    projects = parsed.projects,
                    achievements = parsed.achievements,
                    snippets = parsed.snippets,
                    hashes = hashes
                )
            }
            val fromDb = LoadedContent(
                catalog = Catalog(
                    tracks = db.trackDao().observeAll().first().map { it.toModel() },
                    levels = db.levelDao().observeAll().first().map { it.toModel() },
                    lessons = db.lessonDao().observeAll().first().map { it.toModel() }
                ),
                achievements = db.achievementDao().observeAll().first().map { it.toModel() },
                snippets = db.snippetDao().observeAll().first().map { it.toModel() },
                exercises = db.exerciseDao().observeAll().first().map { it.toModel() },
                reference = db.refEntryDao().observeAll().first().map { it.toModel() },
                paths = db.pathDao().observeAll().first().map { it.toModel() },
                projects = db.projectDao().observeAll().first().map { it.toModel() }
            )
            // An empty read-back means the import did not land — never
            // serve an empty catalog when the assets parsed fine.
            if (fromDb.catalog.lessons.isEmpty() || fromDb.exercises.isEmpty()) parsed else fromDb
        } catch (e: Exception) {
            parsed
        }
    }
}
