package com.skillzify.app.core

import android.os.SystemClock
import android.util.Log

/* App 2.0 Phase A6 — startup timing marks (logcat tag "SkillzifyPerf").
 *
 * The plan's performance budgets (cold start < 1.5 s, catalog ready,
 * first screen) can only be signed off against measurements on a real
 * device. These marks make the phases visible in logcat from the very
 * first Phase A build: process start -> MainActivity -> catalog
 * loaded. Marks cost a log line each; there is no tracing overhead in
 * normal use and nothing is uploaded anywhere. */
object PerfLog {
    private val processStart = SystemClock.elapsedRealtime()

    fun mark(tag: String) {
        Log.d("SkillzifyPerf", "$tag at ${SystemClock.elapsedRealtime() - processStart}ms")
    }
}
