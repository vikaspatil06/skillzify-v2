/* Skillzify Python Reference — dynamic lookup engine.
   Sidebar: search + collapsible groups with counts.
   Content: breadcrumb, signature, example (try-it + copy),
   related entries, prev/next navigation, hash deep-linking. */
(function () {
  "use strict";
  var S = window.Skillzify;
  function esc(s) { return S.esc(String(s == null ? "" : s)); }
  function $(id) { return document.getElementById(id); }

  var R = window.SkillzifyReference || [];
  var GROUP_ORDER = ["Built-in Functions", "String Methods", "String Formatting",
    "List Methods", "Tuple", "Dict Methods", "Set Methods", "Comprehensions",
    "Functions", "Operators", "Keywords & Syntax", "Exception Handling",
    "File I/O", "Standard Library"];

  var collapsed = {};   // group -> true when user collapsed it
  var currentList = R.slice();
  var currentName = null;

  function groupRank(g) {
    var i = GROUP_ORDER.indexOf(g);
    return i >= 0 ? i : GROUP_ORDER.length;
  }
  function groupsOf(list) {
    var g = {}, order = [];
    list.forEach(function (r) {
      if (!g[r.group]) { g[r.group] = []; order.push(r.group); }
      g[r.group].push(r);
    });
    order.sort(function (a, b) { return groupRank(a) - groupRank(b) || (a < b ? -1 : 1); });
    return order.map(function (k) { return { group: k, items: g[k] }; });
  }
  function findByName(name) {
    for (var i = 0; i < R.length; i++) if (R[i].name === name) return R[i];
    return null;
  }

  /* ---------------- Sidebar ---------------- */
  function renderNav(filter) {
    var nav = $("ref-nav");
    if (!nav) return;
    filter = (filter || "").toLowerCase();
    currentList = R.filter(function (r) {
      return !filter || r.name.toLowerCase().indexOf(filter) >= 0 ||
        r.desc.toLowerCase().indexOf(filter) >= 0;
    });
    var gs = groupsOf(currentList);
    nav.innerHTML = gs.map(function (g) {
      var isCollapsed = !filter && collapsed[g.group];
      return '<div class="ref-group' + (isCollapsed ? " collapsed" : "") + '" data-group="' + esc(g.group) + '">' +
        '<button class="ref-group-head" data-group="' + esc(g.group) + '">' +
        '<span class="ref-caret">▾</span>' + esc(g.group) +
        ' <span class="pill-n">' + g.items.length + "</span></button>" +
        '<div class="ref-group-items">' + g.items.map(function (r) {
          return '<a class="ref-link' + (r.name === currentName ? " active" : "") +
            '" data-name="' + esc(r.name) + '">' + esc(r.name) + "</a>";
        }).join("") + "</div></div>";
    }).join("") || '<p class="muted" style="padding:8px">No matches.</p>';

    nav.querySelectorAll(".ref-group-head").forEach(function (b) {
      b.addEventListener("click", function () {
        var g = b.getAttribute("data-group");
        collapsed[g] = !collapsed[g];
        renderNav($("ref-search") ? $("ref-search").value : "");
      });
    });
    nav.querySelectorAll(".ref-link").forEach(function (a) {
      a.addEventListener("click", function () { show(a.getAttribute("data-name")); });
    });
  }

  /* ---------------- Content ---------------- */
  function related(r) {
    return R.filter(function (x) { return x.group === r.group && x.name !== r.name; }).slice(0, 4);
  }
  function prevNext(r) {
    var i = -1;
    for (var k = 0; k < currentList.length; k++) if (currentList[k].name === r.name) i = k;
    return {
      prev: i > 0 ? currentList[i - 1] : null,
      next: i >= 0 && i < currentList.length - 1 ? currentList[i + 1] : null
    };
  }

  function show(name) {
    var r = findByName(name) || R[0];
    if (!r) return;
    currentName = r.name;
    var content = $("ref-content");
    var rel = related(r).map(function (x) {
      return '<button class="pill rel-chip" data-name="' + esc(x.name) + '">' + esc(x.name) + "</button>";
    }).join("");
    var pn = prevNext(r);
    content.innerHTML =
      '<p class="hint ref-crumb">' + esc(r.group) + "</p>" +
      "<h2>" + esc(r.name) + "</h2>" +
      '<p><code class="sig">' + esc(r.sig) + "</code></p>" +
      "<p>" + esc(r.desc) + "</p>" +
      '<div class="ref-example"><pre>' + esc(r.ex) + '</pre><div class="try-row">' +
      '<button class="btn btn-primary btn-sm" id="ref-try">▶ Try it yourself</button>' +
      '<button class="btn btn-ghost btn-sm" id="ref-copy">📋 Copy</button></div></div>' +
      (rel ? '<div class="ref-related"><h4>Related</h4><div class="pill-row">' + rel + "</div></div>" : "") +
      '<div class="ref-prevnext">' +
      (pn.prev ? '<button class="btn btn-sm btn-ghost" id="ref-prev">← ' + esc(pn.prev.name) + "</button>" : "<span></span>") +
      (pn.next ? '<button class="btn btn-sm btn-ghost" id="ref-next">' + esc(pn.next.name) + " →</button>" : "<span></span>") +
      "</div>";

    $("ref-try").addEventListener("click", function () {
      try { localStorage.setItem("skillzify_compiler_code", r.ex); } catch (e) {}
      location.href = "compiler.html";
    });
    $("ref-copy").addEventListener("click", function () {
      copyText(r.ex); S.toast("Copied 📋", "success");
    });
    content.querySelectorAll(".rel-chip").forEach(function (b) {
      b.addEventListener("click", function () { show(b.getAttribute("data-name")); });
    });
    if (pn.prev) $("ref-prev").addEventListener("click", function () { show(pn.prev.name); });
    if (pn.next) $("ref-next").addEventListener("click", function () { show(pn.next.name); });

    renderNav($("ref-search") ? $("ref-search").value : "");
    try { history.replaceState(null, "", "#" + encodeURIComponent(r.name)); } catch (e) {}
    if (window.scrollTo && window.innerWidth < 960) content.scrollIntoView();
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).catch(function () {}); return; }
    var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {} ta.remove();
  }

  /* ---------------- Init ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    var search = $("ref-search");
    if (search) search.addEventListener("input", function () { renderNav(search.value); });
    // Stats in the hero
    var stats = $("ref-stats");
    if (stats) {
      var gs = groupsOf(R).length;
      stats.textContent = R.length + " entries · " + gs + " categories";
    }
    renderNav("");
    var initial = null;
    if (location.hash) {
      var h = decodeURIComponent(location.hash.slice(1));
      initial = findByName(h);
    }
    show(initial ? initial.name : (R[0] && R[0].name));
  });
})();
