package com.skillzify.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/* App 2.0 Phase A1 — DAOs for the content database.
 * Writes are bulk REPLACE inserts driven by ContentImporter; reads are
 * Flow-based so A2 can bind screens to the database as the single source
 * of truth. Search queries are plain LIKE over real columns — with ~530
 * content rows this is comfortably inside the plan's <100 ms budget;
 * an FTS table is a later optimisation only if profiling demands it. */

@Dao
interface TrackDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<TrackEntity>)

    @Query("SELECT * FROM tracks ORDER BY position ASC")
    fun observeAll(): Flow<List<TrackEntity>>

    @Query("DELETE FROM tracks")
    suspend fun clear()
}

@Dao
interface LessonDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<LessonEntity>)

    @Query("SELECT * FROM lessons ORDER BY position ASC")
    fun observeAll(): Flow<List<LessonEntity>>

    @Query("SELECT * FROM lessons WHERE section = :section ORDER BY position ASC")
    fun observeBySection(section: String): Flow<List<LessonEntity>>

    @Query("SELECT * FROM lessons WHERE id = :id")
    suspend fun byId(id: String): LessonEntity?

    @Query(
        "SELECT * FROM lessons WHERE title LIKE '%' || :q || '%' " +
            "OR explain LIKE '%' || :q || '%' ORDER BY position ASC"
    )
    suspend fun search(q: String): List<LessonEntity>

    @Query("SELECT COUNT(*) FROM lessons")
    suspend fun count(): Int

    @Query("DELETE FROM lessons")
    suspend fun clear()
}

@Dao
interface ExerciseDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<ExerciseEntity>)

    @Query("SELECT * FROM exercises ORDER BY position ASC")
    fun observeAll(): Flow<List<ExerciseEntity>>

    @Query("SELECT * FROM exercises WHERE topic = :topic ORDER BY position ASC")
    fun observeByTopic(topic: String): Flow<List<ExerciseEntity>>

    @Query("SELECT * FROM exercises WHERE id = :id")
    suspend fun byId(id: String): ExerciseEntity?

    @Query("SELECT COUNT(*) FROM exercises")
    suspend fun count(): Int

    @Query("DELETE FROM exercises")
    suspend fun clear()
}

@Dao
interface RefEntryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<RefEntryEntity>)

    @Query("SELECT * FROM reference_entries ORDER BY position ASC")
    fun observeAll(): Flow<List<RefEntryEntity>>

    @Query(
        "SELECT * FROM reference_entries WHERE name LIKE '%' || :q || '%' " +
            "OR syntax LIKE '%' || :q || '%' OR desc LIKE '%' || :q || '%' " +
            "ORDER BY position ASC"
    )
    suspend fun search(q: String): List<RefEntryEntity>

    @Query("SELECT COUNT(*) FROM reference_entries")
    suspend fun count(): Int

    @Query("DELETE FROM reference_entries")
    suspend fun clear()
}

@Dao
interface ProjectDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<ProjectEntity>)

    @Query("SELECT * FROM projects ORDER BY position ASC")
    fun observeAll(): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects WHERE id = :id")
    suspend fun byId(id: String): ProjectEntity?

    @Query("SELECT COUNT(*) FROM projects")
    suspend fun count(): Int

    @Query("DELETE FROM projects")
    suspend fun clear()
}

@Dao
interface PathDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<PathEntity>)

    @Query("SELECT * FROM paths ORDER BY position ASC")
    fun observeAll(): Flow<List<PathEntity>>

    @Query("SELECT COUNT(*) FROM paths")
    suspend fun count(): Int

    @Query("DELETE FROM paths")
    suspend fun clear()
}

@Dao
interface AchievementDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<AchievementEntity>)

    @Query("SELECT * FROM achievements ORDER BY position ASC")
    fun observeAll(): Flow<List<AchievementEntity>>

    @Query("SELECT COUNT(*) FROM achievements")
    suspend fun count(): Int

    @Query("DELETE FROM achievements")
    suspend fun clear()
}

@Dao
interface SnippetDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<SnippetEntity>)

    @Query("SELECT * FROM snippets ORDER BY position ASC")
    fun observeAll(): Flow<List<SnippetEntity>>

    @Query("DELETE FROM snippets")
    suspend fun clear()
}

@Dao
interface LevelDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<LevelEntity>)

    @Query("SELECT * FROM levels ORDER BY position ASC")
    fun observeAll(): Flow<List<LevelEntity>>

    @Query("DELETE FROM levels")
    suspend fun clear()
}

@Dao
interface ContentMetaDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(item: ContentMetaEntity)

    @Query("SELECT value FROM content_meta WHERE key = :key")
    suspend fun get(key: String): String?

    @Query("SELECT value FROM content_meta WHERE key = :key")
    fun observe(key: String): Flow<String?>
}
