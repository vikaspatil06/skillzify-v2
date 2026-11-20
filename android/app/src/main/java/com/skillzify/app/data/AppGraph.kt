package com.skillzify.app.data

import android.content.Context
import androidx.room.Room
import com.skillzify.app.data.local.MIGRATION_1_2
import com.skillzify.app.data.local.SkillzifyDatabase

/* App 2.0 — tiny manual service holder (no DI framework; the app has
 * none today and Phase A does not add one).
 *
 * The database is created lazily on first access. Since Phase A5 the
 * database holds user progress (mirror tables), so it is opened with
 * REAL migrations only — the v1-era destructive fallback was retired
 * when MIGRATION_1_2 landed, exactly as the A1 note here required. */
object AppGraph {

    @Volatile
    private var dbInstance: SkillzifyDatabase? = null

    fun database(ctx: Context): SkillzifyDatabase {
        dbInstance?.let { return it }
        return synchronized(this) {
            dbInstance ?: Room.databaseBuilder(
                ctx.applicationContext,
                SkillzifyDatabase::class.java,
                "skillzify2.db"
            )
                .addMigrations(MIGRATION_1_2)
                .build()
                .also { dbInstance = it }
        }
    }
}
