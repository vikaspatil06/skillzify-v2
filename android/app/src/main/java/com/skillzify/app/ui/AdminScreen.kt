package com.skillzify.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.skillzify.app.AppViewModel
import com.skillzify.app.data.CommunityRepository
import com.skillzify.app.ui.theme.GradientBrush
import com.skillzify.app.ui.theme.Success
import com.skillzify.app.ui.theme.TextMuted
import java.text.NumberFormat
import java.util.Locale

/* =====================================================================
   Admin — mirror of the website's admin.html + admin.js control room.
   Data: vm.adminOverview (GET /api/admin/overview, served ONLY to a
   verified admin token) + vm.aiUsage. States mirror the web:
   - overview present → the full panel set below.
   - overview == null → the web's "unavailable" card, verbatim:
     "🛠️ Admin backend not live here yet" — this server doesn't have
     the admin endpoint yet (404/old backend) or it couldn't be
     reached. Never a crash, never a fake panel.
   The entry point (You screen / Dashboard chip) is gated on
   vm.isAdminConfirmed — true ONLY when the server returned 200 for
   the overview — never on the user's email string.
   Panels, mirroring admin.js render():
   - Stat cards: AI backend on/off (+ Gemini keys, Groq), cap store,
     token verification, backend uptime.
   - 🤖 AI usage — today: totals line (total · signed-in · anonymous ·
     learners), "Your usage (admin)" bar from overview.me, and the
     per-identity table (# / type / identity / answers / share bar).
     (The web overview carries NO per-model breakdown — models appear
     as the failover-order list under Configuration.)
   - 📅 Last 7 days: gradient bar chart + per-day rows.
   - ⚙️ Configuration: caps (anon / signed-in / admin / admin email),
     PLAN panel (capacity split: admin reserve + learner pool, with
     the learner-pool usage bar), Gemini keys, Groq, failover order.
   - 👥 Community snapshot: the web reads these counts straight from
     Firestore; here they come from CommunityRepository list sizes
     (questions / showcase; answers + profiles have no list API, so
     they show "—" exactly like the web's failed-count fallback).
   - 🔗 Quick links: the web's link grid, opened via the URI handler.
   - 🧰 Tools: Refresh data (vm.refreshAiAndAdmin()).
   ===================================================================== */

private fun fmt(n: Int): String = NumberFormat.getInstance(Locale("en", "IN")).format(n)
private fun fmt(n: Long): String = NumberFormat.getInstance(Locale("en", "IN")).format(n)

private fun fmtUptime(sec: Long): String {
    val s = maxOf(0L, sec)
    val d = s / 86400; val h = (s % 86400) / 3600; val m = (s % 3600) / 60
    return when {
        d > 0 -> "${d}d ${h}h"
        h > 0 -> "${h}h ${m}m"
        m > 0 -> "${m}m"
        else -> "${s}s"
    }
}

private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

/** "2026-11-13" -> "13 Nov" (web fmtDate). */
private fun fmtDate(iso: String): String {
    val p = iso.split("-")
    if (p.size != 3) return iso
    val day = p[2].toIntOrNull() ?: return iso
    val mon = MONTHS.getOrNull((p[1].toIntOrNull() ?: 0) - 1) ?: return iso
    return "$day $mon"
}

@Composable
fun AdminScreen(vm: AppViewModel, nav: NavController) {
    val uri = LocalUriHandler.current
    LaunchedEffect(Unit) { vm.refreshAiAndAdmin() }
    val d = vm.adminOverview

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        ScreenHeader(
            "🛡️ Admin",
            if (d != null) "Signed in as ${d.me.email} · ${fmtDate(d.date)} (IST) · everything below is live from the server."
            else "The Skillzify control room — only you can see this page's data.",
            onBack = { nav.popBackStack() }
        )

        if (d == null) {
            // Web #admin-unavailable, verbatim copy.
            WebCard {
                Column(Modifier.padding(18.dp)) {
                    Text("🛠️ Admin backend not live here yet", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "This server doesn't have the admin endpoint yet — it arrives with the backend deploy that carries token verification. Try the staging site, or deploy the latest backend here.",
                        color = TextMuted, fontSize = 14.sp, lineHeight = 20.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    Spacer(Modifier.height(10.dp))
                    GradientButton("Open staging admin", Modifier.fillMaxWidth()) {
                        uri.openUri("https://skillzify-v2-staging.onrender.com/admin.html")
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = { nav.navigate("dashboard") }, modifier = Modifier.fillMaxWidth()) {
                        Text("Go to dashboard", maxLines = 1)
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = { vm.refreshAiAndAdmin() }, modifier = Modifier.fillMaxWidth()) {
                        Text("↻ Refresh data", maxLines = 1)
                    }
                }
            }
            return@Column
        }

        val sv = d.server

        // ---- Stat cards (web .admin-stats) ----
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            AdminStat(
                "AI BACKEND", if (sv.ai) "On" else "Off",
                "${sv.geminiKeys} Gemini key(s)" + if (sv.groq) " · Groq spillover on" else " · Groq off",
                Modifier.weight(1f)
            )
            AdminStat(
                "CAP STORE", if (sv.capStore == "firestore") "Firestore" else "Memory",
                if (sv.capStore == "firestore") "Counts survive restarts" else "Counts reset on restart",
                Modifier.weight(1f)
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            AdminStat(
                "TOKEN VERIFICATION", if (sv.authVerify) "On" else "Off",
                if (sv.authVerify) "Identity is verified, not claimed" else "Legacy client-supplied identity",
                Modifier.weight(1f)
            )
            AdminStat(
                "BACKEND UPTIME", fmtUptime(sv.uptimeSec),
                "Since the last deploy / restart",
                Modifier.weight(1f)
            )
        }
        // Primary model (first in the failover order) + model count.
        WebCard {
            Column(Modifier.padding(14.dp)) {
                Text("PRIMARY MODEL", color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Text(
                    sv.primary ?: sv.models.firstOrNull() ?: "—",
                    fontFamily = FontFamily.Monospace, fontSize = 14.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 4.dp)
                )
                Text(
                    "${sv.models.size} model(s) in the failover order" + if (sv.groq) " · Groq: ${sv.groqModels.joinToString(", ")}" else "",
                    color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp)
                )
            }
        }

        // ---- 🤖 AI usage — today ----
        val t = d.today
        WebCard {
            Column(Modifier.padding(16.dp)) {
                Text("🤖 AI usage — today", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(
                    "${fmt(t.total)} AI answers today — ${fmt(t.userAnswers)} signed-in · ${fmt(t.anonAnswers)} anonymous · ${fmt(t.users)} learner(s) active.",
                    color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp, bottom = 10.dp)
                )
                // Your usage (admin)
                val pct = if (d.me.cap > 0) (d.me.used.toFloat() / d.me.cap * 100f).coerceIn(0f, 100f) else 0f
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Your usage (admin)", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text("${fmt(d.me.used)} / ${fmt(d.me.cap)} · ${"%.2f".format(pct)}%", color = TextMuted, fontSize = 13.sp)
                }
                Spacer(Modifier.height(6.dp))
                Box(
                    Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(99.dp))
                        .background(androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        Modifier.fillMaxWidth(pct / 100f).height(10.dp)
                            .clip(RoundedCornerShape(99.dp)).background(GradientBrush)
                    )
                }
                Text(
                    "Your cap is reserved like everyone else's — just a much bigger bucket.",
                    color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp)
                )
                // Per-identity table
                if (t.identities.isEmpty()) {
                    Text("No AI answers yet today.", color = TextMuted, fontSize = 13.sp,
                        modifier = Modifier.padding(top = 12.dp))
                } else {
                    val max = t.identities.maxOfOrNull { it.count } ?: 1
                    Spacer(Modifier.height(10.dp))
                    t.identities.forEachIndexed { i, e ->
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("${i + 1}", color = TextMuted, fontSize = 12.sp, modifier = Modifier.width(22.dp))
                            WebChip(if (e.type == "user") "👤 learner" else "🌐 anon")
                            Spacer(Modifier.width(8.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    if (e.type == "user") e.who else "${e.who} (IP)",
                                    fontFamily = FontFamily.Monospace, fontSize = 12.sp, maxLines = 1
                                )
                                if (e.type == "user" && e.who == d.me.uid) {
                                    Text("you", color = Success, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                                Box(
                                    Modifier.fillMaxWidth().height(6.dp).padding(top = 2.dp)
                                        .clip(RoundedCornerShape(99.dp))
                                        .background(androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant)
                                ) {
                                    Box(
                                        Modifier.fillMaxWidth(maxOf(0.02f, e.count.toFloat() / maxOf(1, max)))
                                            .height(6.dp)
                                            .background(androidx.compose.material3.MaterialTheme.colorScheme.primary)
                                    )
                                }
                            }
                            Spacer(Modifier.width(8.dp))
                            Text(fmt(e.count), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // ---- 📅 Last 7 days ----
        WebCard {
            Column(Modifier.padding(16.dp)) {
                Text("📅 Last 7 days", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(
                    "AI answers per day (IST). Counts live in the cap store, so they survive backend restarts.",
                    color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp)
                )
                val days = d.days
                val dmax = days.maxOfOrNull { it.total } ?: 0
                if (days.isNotEmpty()) {
                    Row(
                        Modifier.fillMaxWidth().height(120.dp).padding(top = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.Bottom
                    ) {
                        days.forEach { x ->
                            val frac = if (dmax > 0) maxOf(0.04f, x.total.toFloat() / dmax) else 0.04f
                            Column(
                                Modifier.weight(1f),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Bottom
                            ) {
                                Text(fmt(x.total), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                Box(
                                    Modifier.width(30.dp).height((84 * frac).dp.coerceAtLeast(3.dp))
                                        .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                                        .background(GradientBrush)
                                )
                                Text(fmtDate(x.date), color = TextMuted, fontSize = 10.sp, maxLines = 1)
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    days.reversed().forEach { x ->
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 3.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                fmtDate(x.date) + if (x.date == d.date) " · today" else "",
                                fontSize = 13.sp,
                                color = if (x.date == d.date) Success else androidx.compose.material3.MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                "${fmt(x.total)} total · ${fmt(x.userAnswers)} in · ${fmt(x.anonAnswers)} anon · ${fmt(x.users)} learners",
                                color = TextMuted, fontSize = 12.sp
                            )
                        }
                    }
                }
            }
        }

        // ---- ⚙️ Configuration + Plan ----
        WebCard {
            Column(Modifier.padding(16.dp)) {
                Text("⚙️ Configuration", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(
                    "Live from the server. Caps, keys and models change via the server's environment variables + a redeploy — never from this page.",
                    color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)
                )
                KvRow("Anonymous cap", "${fmt(d.caps.anon)} / day")
                KvRow("Signed-in cap", "${fmt(d.caps.user)} / day")
                KvRow("Admin cap", "${fmt(d.caps.admin)} / day")
                KvRow("Admin email", d.caps.adminEmail)
                val plan = d.plan
                if (plan != null) {
                    KvRow("Daily capacity (providers)", "${fmt(plan.capacity)} / day")
                    KvRow("Admin reserve", "${fmt(plan.adminReserved)} / day")
                    KvRow("Learner pool (shared)", "${fmt(plan.userPool)} / day")
                    val poolPct = if (plan.userPool > 0) plan.userPoolUsed.toFloat() / plan.userPool * 100f else 0f
                    KvRow("Learner pool used today", "${fmt(plan.userPoolUsed)} (${"%.1f".format(poolPct)}%)")
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { (poolPct / 100f).coerceIn(0f, 1f) },
                        modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(99.dp))
                    )
                    Text(
                        "Every learner answer — signed-in or anonymous — reserves from the shared pool, so learner traffic can never consume the admin reserve. Your answers never touch the pool.",
                        color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp)
                    )
                }
                KvRow("Gemini keys configured", fmt(sv.geminiKeys))
                KvRow("Groq spillover", if (sv.groq) "On" else "Off")
                KvRow("Cap store", sv.capStore)
                KvRow("Token verification", if (sv.authVerify) "On" else "Off")
                Spacer(Modifier.height(10.dp))
                Text("Gemini failover order", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(
                    "(first success wins; quota/overload moves to the next)",
                    color = TextMuted, fontSize = 12.sp
                )
                sv.models.forEachIndexed { i, m ->
                    Text("${i + 1}. $m", fontFamily = FontFamily.Monospace, fontSize = 12.sp,
                        modifier = Modifier.padding(top = 3.dp))
                }
                if (sv.groq && sv.groqModels.isNotEmpty()) {
                    Text("Groq models: ${sv.groqModels.joinToString(", ")}",
                        fontFamily = FontFamily.Monospace, fontSize = 12.sp,
                        modifier = Modifier.padding(top = 8.dp))
                }
            }
        }

        // ---- 👥 Community snapshot ----
        CommunitySnapshot(vm, d.community)

        // ---- 🔗 Quick links (web grid, verbatim labels/subs) ----
        WebCard {
            Column(Modifier.padding(16.dp)) {
                Text("🔗 Quick links", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text("Everything you operate, one tap away.", color = TextMuted, fontSize = 13.sp,
                    modifier = Modifier.padding(top = 4.dp, bottom = 8.dp))
                val links = listOf(
                    Triple("🌐 Live site", "GitHub Pages — what learners see", "https://vikaspatil06.github.io/skillzify-v2/"),
                    Triple("🧪 Staging site", "Test new backend code here first", "https://skillzify-v2-staging.onrender.com/"),
                    Triple("🐙 GitHub repo", "Source, commits, Actions (APK builds)", "https://github.com/vikaspatil06/skillzify-v2"),
                    Triple("🔥 Firebase console", "Auth, Firestore, rules — project skillzify-1d0f2", "https://console.firebase.google.com/project/skillzify-1d0f2"),
                    Triple("❤️ Production health", "Live backend status JSON", "https://skillzify-v2.onrender.com/api/health"),
                    Triple("💛 Staging health", "Staging backend status JSON", "https://skillzify-v2-staging.onrender.com/api/health"),
                    Triple("✨ Google AI Studio", "Gemini keys + per-project quotas", "https://aistudio.google.com/"),
                    Triple("⚡ Groq console", "Spillover provider keys + limits", "https://console.groq.com/")
                )
                links.forEach { (label, sub, url) ->
                    WebCard(
                        modifier = Modifier.padding(vertical = 4.dp),
                        onClick = { uri.openUri(url) }
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text(sub, color = TextMuted, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // ---- 🧰 Tools ----
        WebCard {
            Column(Modifier.padding(16.dp)) {
                Text("🧰 Tools", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text("Small jobs, no terminal needed.", color = TextMuted, fontSize = 13.sp,
                    modifier = Modifier.padding(top = 4.dp, bottom = 8.dp))
                OutlinedButton(onClick = { vm.refreshAiAndAdmin() }, modifier = Modifier.fillMaxWidth()) {
                    Text("↻ Refresh data", maxLines = 1)
                }
                Spacer(Modifier.height(6.dp))
                OutlinedButton(onClick = { nav.navigate("community") }, modifier = Modifier.fillMaxWidth()) {
                    Text("Open community", maxLines = 1)
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun AdminStat(k: String, v: String, s: String, modifier: Modifier = Modifier) {
    WebCard(modifier = modifier) {
        Column(Modifier.padding(14.dp)) {
            Text(k, color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text(v, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 4.dp))
            Text(s, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
private fun KvRow(k: String, v: String) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(k, fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(v, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

/** Community counts: the overview payload's `community` object when it
    carries one; otherwise CommunityRepository list sizes (the web reads
    Firestore directly — questions / showcase; answers + public profiles
    have no list API, so they show "—", the web's failed-count fallback).
    Today's server payload carries NO community object (per
    AdminRepository), so the repository path is the operative one. */
@Composable
private fun CommunitySnapshot(
    vm: AppViewModel,
    community: com.skillzify.app.data.AdminRepository.AdminCommunity?
) {
    var questions by remember { mutableStateOf<String>("…") }
    var answers by remember { mutableStateOf<String>("—") }
    var showcase by remember { mutableStateOf<String>("…") }
    var profiles by remember { mutableStateOf<String>("—") }
    LaunchedEffect(community) {
        if (community != null) {
            questions = community.questions?.let { fmt(it) } ?: "—"
            answers = community.answers?.let { fmt(it) } ?: "—"
            showcase = community.showcase?.let { fmt(it) } ?: "—"
            profiles = community.publicProfiles?.let { fmt(it) } ?: "—"
        } else {
            val repo = CommunityRepository()
            questions = try { fmt(repo.fetchQuestions(50).size) } catch (e: Exception) { "—" }
            showcase = try { fmt(repo.fetchShowcase().size) } catch (e: Exception) { "—" }
        }
    }
    WebCard {
        Column(Modifier.padding(16.dp)) {
            Text("👥 Community snapshot", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("Live counts from Skillzify Circle (Firestore).", color = TextMuted, fontSize = 13.sp,
                modifier = Modifier.padding(top = 4.dp, bottom = 8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                AdminStat("❓ QUESTIONS", questions, "", Modifier.weight(1f))
                AdminStat("💬 ANSWERS", answers, "", Modifier.weight(1f))
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                AdminStat("🌟 SHOWCASE POSTS", showcase, "", Modifier.weight(1f))
                AdminStat("👤 PUBLIC PROFILES", profiles, "", Modifier.weight(1f))
            }
        }
    }
}
