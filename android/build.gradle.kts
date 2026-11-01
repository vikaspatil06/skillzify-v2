// Top-level build file — plugin versions live here.
//
// NOTE: com.google.gms.google-services is applied via the buildscript
// classpath (its plugin marker is not reliably on the plugin portal);
// everything else uses the plugins DSL.
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.google.gms:google-services:4.4.2")
    }
}

plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.20" apply false
    id("com.chaquo.python") version "15.0.1" apply false
}
