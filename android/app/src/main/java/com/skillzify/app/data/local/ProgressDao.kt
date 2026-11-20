package com.skillzify.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/* App 2.0 Phase A5 — DAO for the progress mirror tables.
 * ProgressMirror rewrites the tables wholesale per mirror cycle (the
 * data set is a few hundred rows; a clear+insert in one transaction is
 * simpler and safer than diffing). The read queries are the ones the
 * Phase B review queue and adaptive path will build on. */
@Dao
interface ProgressDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLessons(items: List<LessonProgressEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttempts(items: List<ExerciseAttemptEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertKv(items: List<ProgressKvEntity>)

    @Query("DELETE FROM lesson_progress")
    suspend fun clearLessons()

    @Query("DELETE FROM exercise_attempts")
    suspend fun clearAttempts()

    @Query("DELETE FROM progress_kv")
    suspend fun clearKv()

    @Query("SELECT COUNT(*) FROM lesson_progress")
    fun observeDoneCount(): Flow<Int>

    @Query("SELECT * FROM lesson_progress ORDER BY doneAt ASC")
    fun observeLessons(): Flow<List<LessonProgressEntity>>

    @Query("SELECT * FROM exercise_attempts WHERE solved = 0")
    fun observeUnsolvedAttempts(): Flow<List<ExerciseAttemptEntity>>

    @Query("SELECT value FROM progress_kv WHERE key = :key")
    suspend fun kv(key: String): String?
}
