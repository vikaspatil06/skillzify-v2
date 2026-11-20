package com.skillzify.app.data.local

import android.content.Context
import java.security.MessageDigest

/* App 2.0 Phase A1 — content versioning for delta updates.
 *
 * Every bundled content asset is SHA-256 hashed; the sorted hash set
 * forms the content version. The importer stores per-file hashes in
 * content_meta, so:
 *  - A2 can skip re-importing when the bundled content is unchanged.
 *  - The later delta-update channel can ship a single changed JSON
 *    (e.g. lessons.json after a fix) and the app re-imports only it,
 *    instead of a new APK release carrying the whole catalog. */
object ContentManifest {

    /** The bundled content assets, in canonical (sorted) order. */
    val ASSET_FILES = listOf(
        "achievements.json",
        "exercises.json",
        "interview.json",
        "lessons.json",
        "paths.json",
        "projects.json",
        "reference.json",
        "snippets.json"
    )

    fun sha256(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return digest.joinToString("") { "%02x".format(it) }
    }

    /** file name -> sha256 of its current bundled bytes. */
    fun assetHashes(ctx: Context): Map<String, String> =
        ASSET_FILES.associateWith { name ->
            sha256(ctx.assets.open(name).readBytes())
        }

    /** One version string for a whole hash set: sha256 of "name:hash" lines. */
    fun contentVersion(hashes: Map<String, String>): String {
        val canonical = hashes.entries
            .sortedBy { it.key }
            .joinToString("\n") { "${it.key}:${it.value}" }
        return sha256(canonical.toByteArray(Charsets.UTF_8))
    }

    const val META_CONTENT_VERSION = "content_version"
    const val META_IMPORTED_AT = "imported_at"
    fun metaKeyForHash(file: String) = "hash:$file"
}
