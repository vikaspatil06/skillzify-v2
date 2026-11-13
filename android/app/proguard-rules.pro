# Skillzify release (R8) keep rules — first release build, 13 Nov 2026.
# Policy: when unsure, KEEP. A slightly larger APK beats a crashed one;
# these rules can be tightened later with device-verified builds.

# ---- Chaquopy (Python interpreter bridge) ----
# The interpreter core and the Android platform glue are reflectively/JNI
# loaded; the app's Python modules are invoked by name from Kotlin.
-keep class com.chaquo.python.** { *; }
-keep class chaquopy.** { *; }
# Python entry points called from the .py side / by name.
-keep class com.skillzify.app.data.TerminalBridge { *; }

# ---- Firebase / Google Play services ----
# Auth + Firestore SDKs carry their own consumer rules, but keep them
# wholesale for the first release build (token/Task machinery is
# reflection-heavy).
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.gson.** { *; }

# ---- App data model ----
# All asset JSON is parsed MANUALLY with org.json in Models.kt (no
# reflection-based parser is used), and Firestore documents are read as
# Maps — so strict rules are not required. Keep the data package anyway:
# several classes cross the Chaquopy boundary or are matched by name in
# sync payloads, and the cost is a few KB.
-keep class com.skillzify.app.data.** { *; }

# ---- Kotlin coroutines ----
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# ---- Compose ----
# The Compose runtime/compiler artifacts ship consumer rules; keep the
# runtime entry points regardless for this first optimised build.
-keep class androidx.compose.runtime.** { *; }
-dontwarn androidx.compose.**

# ---- Generic safety ----
# Keep line numbers + source files so any release-build crash report from
# a device stays debuggable.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
# Enums and Parcelable creators are classic R8 casualties.
-keepclassmembers enum * { *; }
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}
