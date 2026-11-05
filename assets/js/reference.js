/* Skillzify Python Reference — dynamic lookup engine v2.
   Sidebar: search (name/sig/desc/example) + keyboard nav + recent /
   favourites + collapsible groups with counts.
   Content: overview (group cards) or a detail card — signature,
   level, parameters, returns, example + verified expected output,
   inline runner (lazy Pyodide), common pitfalls, lesson link,
   related entries, prev/next. Hash deep-linking. */
(function () {
  "use strict";
  var S = window.Skillzify;
  function esc(s) { return S.esc(String(s == null ? "" : s)); }
  function $(id) { return document.getElementById(id); }

  var R = window.SkillzifyReference || [];
  var LESSON_TITLES = window.SkillzifyReferenceLessons || {};
  var GROUP_ORDER = ["Built-in Functions", "String Methods", "String Formatting",
    "List Methods", "Tuple", "Dict Methods", "Set Methods", "Comprehensions",
    "Functions", "Operators", "Keywords & Syntax", "Exception Handling",
    "File I/O", "Standard Library"];
  var GROUP_BLURBS = {
    "Built-in Functions": "The tools Python gives you for free — print, len, range and friends.",
    "String Methods": "Slice, split, clean and reshape text.",
    "String Formatting": "f-strings, .format() and % — make output readable.",
    "List Methods": "Grow, sort and search lists in place.",
    "Tuple": "Immutable sequences — packing, unpacking and why they matter.",
    "Dict Methods": "Look up, update and merge key–value data.",
    "Set Methods": "Unique collections and set maths — union, intersection, difference.",
    "Comprehensions": "Build lists, dicts and sets in one expressive line.",
    "Functions": "Arguments, scope, map/filter and decorators.",
    "Operators": "The small symbols with big behaviour — //, :=, is vs ==.",
    "Keywords & Syntax": "The words that shape a Python program.",
    "Exception Handling": "Catch, raise and clean up when things go wrong.",
    "File I/O": "Read and write files, CSV and paths.",
    "Standard Library": "Batteries included — json, datetime, random and more."
  };
  var LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

  var collapsed = {};   // group -> true when user collapsed it
  var currentList = R.slice();
  var currentName = null;
  var navActive = -1;  // keyboard highlight index into visible .ref-link nodes

  /* ---------------- recent + favourites (localStorage) ---------------- */
  function lsList(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string"; }) : [];
    } catch (e) { return []; }
  }
  function lsSave(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {} }
  function getRecent() { return lsList("skillzify_ref_recent"); }
  function getFavs() { return lsList("skillzify_ref_favs"); }
  function pushRecent(name) {
    var r = getRecent().filter(function (n) { return n !== name; });
    r.unshift(name);
    lsSave("skillzify_ref_recent", r.slice(0, 5));
  }
  function isFav(name) { return getFavs().indexOf(name) >= 0; }
  function toggleFav(name) {
    var f = getFavs();
    var i = f.indexOf(name);
    if (i >= 0) f.splice(i, 1); else f.push(name);
    lsSave("skillzify_ref_favs", f);
    return i < 0;
  }

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
  function levelOf(r) {
    return LEVEL_LABEL[r.level] ? r.level : "beginner";
  }
  function searchEntries(q) {
    q = (q || "").toLowerCase().trim();
    if (!q) return R.slice();
    return R.filter(function (r) {
      return r.name.toLowerCase().indexOf(q) >= 0 ||
        (r.sig || "").toLowerCase().indexOf(q) >= 0 ||
        (r.desc || "").toLowerCase().indexOf(q) >= 0 ||
        (r.ex || "").toLowerCase().indexOf(q) >= 0;
    });
  }

  /* ---------------- Sidebar ---------------- */
  function linkRow(r, cls) {
    return '<a class="ref-link' + (cls || "") + '" data-name="' + esc(r.name) + '">' + esc(r.name) + "</a>";
  }
  function renderNav(filter) {
    var nav = $("ref-nav");
    if (!nav) return;
    currentList = searchEntries(filter);
    navActive = -1;
    var html = "";
    if (!filter) {
      var favs = getFavs().map(findByName).filter(Boolean);
      var recents = getRecent().map(findByName).filter(Boolean);
      if (favs.length) {
        html += '<div class="ref-group"><span class="ref-group-head" style="cursor:default">★ Favourites</span><div class="ref-group-items">' +
          favs.map(function (r) { return linkRow(r, r.name === currentName ? " active" : ""); }).join("") + "</div></div>";
      }
      if (recents.length) {
        html += '<div class="ref-group"><span class="ref-group-head" style="cursor:default">🕘 Recently viewed</span><div class="ref-group-items">' +
          recents.map(function (r) { return linkRow(r, r.name === currentName ? " active" : ""); }).join("") + "</div></div>";
      }
    } else {
      html += '<p class="muted ref-match" style="padding:4px 8px">' + currentList.length + " match" + (currentList.length === 1 ? "" : "es") + "</p>";
    }
    var gs = groupsOf(currentList);
    html += gs.map(function (g) {
      var isCollapsed = !filter && collapsed[g.group];
      return '<div class="ref-group' + (isCollapsed ? " collapsed" : "") + '" data-group="' + esc(g.group) + '">' +
        '<button class="ref-group-head" data-group="' + esc(g.group) + '">' +
        '<span class="ref-caret">▾</span>' + esc(g.group) +
        ' <span class="pill-n">' + g.items.length + "</span></button>" +
        '<div class="ref-group-items">' + g.items.map(function (r) {
          return linkRow(r, r.name === currentName ? " active" : "");
        }).join("") + "</div></div>";
    }).join("") || '<p class="muted" style="padding:8px">No matches.</p>';

    nav.innerHTML = html;
    nav.querySelectorAll(".ref-group-head").forEach(function (b) {
      if (!b.getAttribute("data-group")) return;
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
  function navLinks() {
    var nav = $("ref-nav");
    return nav ? nav.querySelectorAll(".ref-link") : [];
  }
  function moveKbd(dir) {
    var links = navLinks();
    if (!links.length) return;
    navActive = Math.max(0, Math.min(links.length - 1, navActive + dir));
    links.forEach(function (el, i) {
      if (el.classList) el.classList.toggle("kbd", i === navActive);
    });
    if (links[navActive] && links[navActive].scrollIntoView) {
      try { links[navActive].scrollIntoView({ block: "nearest" }); } catch (e) {}
    }
  }
  function openKbd() {
    var links = navLinks();
    if (navActive >= 0 && links[navActive]) show(links[navActive].getAttribute("data-name"));
  }

  /* ---------------- Inline runner (lazy Pyodide) ---------------- */
  var pyodide = null, pyodideLoading = null;
  // Runs example code the same way the verified outputs were computed:
  // statement by statement, capturing prints AND bare expression values.
  var CAPTURE_HELPER = [
    "import ast, sys, io",
    "def __skillzify_run(code):",
    "    tree = ast.parse(code)",
    "    ns = {}",
    "    out = []",
    "    for stmt in tree.body:",
    "        buf = io.StringIO()",
    "        old = sys.stdout",
    "        sys.stdout = buf",
    "        try:",
    "            if isinstance(stmt, ast.Expr):",
    "                if isinstance(stmt.value, ast.Call) and isinstance(stmt.value.func, ast.Name) and stmt.value.func.id == 'print':",
    "                    exec(compile(ast.Module(body=[stmt], type_ignores=[]), '<ex>', 'exec'), ns)",
    "                else:",
    "                    try:",
    "                        v = eval(compile(ast.Expression(stmt.value), '<ex>', 'eval'), ns)",
    "                    except Exception:",
    "                        exec(compile(ast.Module(body=[stmt], type_ignores=[]), '<ex>', 'exec'), ns)",
    "                    else:",
    "                        if v is not None: out.append(repr(v))",
    "            else:",
    "                exec(compile(ast.Module(body=[stmt], type_ignores=[]), '<ex>', 'exec'), ns)",
    "        finally:",
    "            sys.stdout = old",
    "        chunk = buf.getvalue()",
    "        if chunk: out.extend(chunk.rstrip(chr(10)).split(chr(10)))",
    "    return chr(10).join(out)"
  ].join("\n");
  function loadPyodide() {
    if (pyodide) return Promise.resolve(pyodide);
    if (pyodideLoading) return pyodideLoading;
    pyodideLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
      s.onload = function () {
        window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" }).then(function (py) {
          pyodide = py;
          try { py.runPython(CAPTURE_HELPER); } catch (e) {}
          resolve(py);
        }, reject);
      };
      s.onerror = function () { reject(new Error("Could not load the Python runtime — check your connection.")); };
      document.head.appendChild(s);
    });
    return pyodideLoading;
  }
  function runExample(code, execFn) {
    var fn = execFn || function (c) {
      return loadPyodide().then(function (py) {
        try {
          var v = py.runPython("__skillzify_run(" + JSON.stringify(c) + ")");
          return String(v == null ? "" : v);
        } catch (e) {
          throw new Error((e && e.message) || String(e));
        }
      });
    };
    return fn(code);
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
  function paramList(params) {
    if (!params || !params.length) return "";
    return '<div class="ref-params"><h4>Parameters</h4><ul>' + params.map(function (p) {
      var s = String(p);
      var cut = s.indexOf(" — ");
      if (cut > 0) return "<li><code>" + esc(s.slice(0, cut)) + "</code> — " + esc(s.slice(cut + 3)) + "</li>";
      return "<li>" + esc(s) + "</li>";
    }).join("") + "</ul></div>";
  }

  function showOverview() {
    currentName = null;
    var content = $("ref-content");
    if (!content) return;
    var gs = groupsOf(R);
    var runnable = R.filter(function (r) { return r.out != null && r.out !== ""; }).length;
    content.innerHTML =
      '<p class="hint ref-crumb">Overview</p>' +
      "<h2>Browse the reference</h2>" +
      "<p>" + R.length + " entries across " + gs.length + " groups · " + runnable +
      " with runnable examples. Pick a group, or search on the left.</p>" +
      '<div class="ref-overview">' + gs.map(function (g) {
        var top = g.items.slice(0, 4).map(function (r) {
          return '<button class="pill rel-chip" data-name="' + esc(r.name) + '">' + esc(r.name) + "</button>";
        }).join("");
        return '<div class="ref-ov-card"><h3>' + esc(g.group) + ' <span class="pill-n">' + g.items.length + "</span></h3>" +
          '<p class="hint">' + esc(GROUP_BLURBS[g.group] || "") + "</p>" +
          '<div class="pill-row">' + top + "</div>" +
          '<button class="btn btn-sm btn-ghost ref-ov-browse" data-group="' + esc(g.group) + '">Browse all →</button></div>';
      }).join("") + "</div>";
    content.querySelectorAll(".rel-chip").forEach(function (b) {
      b.addEventListener("click", function () { show(b.getAttribute("data-name")); });
    });
    content.querySelectorAll(".ref-ov-browse").forEach(function (b) {
      b.addEventListener("click", function () {
        var g = groupsOf(R).filter(function (x) { return x.group === b.getAttribute("data-group"); })[0];
        if (g && g.items[0]) show(g.items[0].name);
      });
    });
    renderNav($("ref-search") ? $("ref-search").value : "");
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }

  function show(name) {
    var r = findByName(name);
    if (!r) { showOverview(); return; }
    currentName = r.name;
    pushRecent(r.name);
    var content = $("ref-content");
    var rel = related(r).map(function (x) {
      return '<button class="pill rel-chip" data-name="' + esc(x.name) + '">' + esc(x.name) + "</button>";
    }).join("");
    var pn = prevNext(r);
    var hasOut = r.out != null && r.out !== "";
    var fav = isFav(r.name);
    content.innerHTML =
      '<p class="hint ref-crumb">' + esc(r.group) + ' · <span class="ref-level ref-level-' + levelOf(r) + '">' + LEVEL_LABEL[levelOf(r)] + "</span></p>" +
      '<div class="ref-title-row"><h2>' + esc(r.name) + '</h2><button class="ref-fav" id="ref-fav" title="' + (fav ? "Remove from favourites" : "Add to favourites") + '">' + (fav ? "★" : "☆") + "</button></div>" +
      '<p><code class="sig">' + esc(r.sig) + "</code></p>" +
      "<p>" + esc(r.desc) + "</p>" +
      paramList(r.params) +
      (r.returns != null ? '<p class="ref-returns"><strong>Returns:</strong> ' + esc(r.returns) + "</p>" : "") +
      '<div class="ref-example"><pre>' + esc(r.ex) + "</pre>" +
      (hasOut ? '<div class="ref-output"><h4>Expected output</h4><pre>' + esc(r.out) + "</pre></div>" : "") +
      (r.out == null ? '<p class="hint">Reads from the keyboard — run it in Code Studio to try it.</p>' : "") +
      '<div class="try-row">' +
      (r.out != null ? '<button class="btn btn-primary btn-sm" id="ref-run">▶ Run here</button>' : "") +
      '<button class="btn btn-ghost btn-sm" id="ref-try">Try it yourself ↗</button>' +
      '<button class="btn btn-ghost btn-sm" id="ref-copy">📋 Copy</button></div>' +
      '<pre class="ref-run-out" id="ref-run-out" hidden></pre>' +
      '<p class="hint ref-run-status" id="ref-run-status" hidden></p></div>' +
      (r.pitfalls ? '<div class="ref-pitfall"><strong>⚠ Common mistake:</strong> ' + esc(r.pitfalls) + "</div>" : "") +
      (r.lesson && LESSON_TITLES[r.lesson] ? '<p class="ref-lesson">📚 Taught in: <a href="lesson.html?id=' + esc(r.lesson) + '">' + esc(LESSON_TITLES[r.lesson]) + "</a></p>" : "") +
      (rel ? '<div class="ref-related"><h4>Related</h4><div class="pill-row">' + rel + "</div></div>" : "") +
      '<div class="ref-prevnext">' +
      (pn.prev ? '<button class="btn btn-sm btn-ghost" id="ref-prev">← ' + esc(pn.prev.name) + "</button>" : "<span></span>") +
      (pn.next ? '<button class="btn btn-sm btn-ghost" id="ref-next">' + esc(pn.next.name) + " →</button>" : "<span></span>") +
      "</div>";

    $("ref-fav").addEventListener("click", function () {
      var nowFav = toggleFav(r.name);
      var b = $("ref-fav");
      if (b) { b.textContent = nowFav ? "★" : "☆"; b.title = nowFav ? "Remove from favourites" : "Add to favourites"; }
      renderNav($("ref-search") ? $("ref-search").value : "");
      if (S && S.toast) S.toast(nowFav ? "Added to favourites ★" : "Removed from favourites", "success");
    });
    var runBtn = $("ref-run");
    if (runBtn) {
      runBtn.addEventListener("click", function () {
        var outEl = $("ref-run-out"), stEl = $("ref-run-status");
        runBtn.disabled = true;
        runBtn.textContent = "Loading Python…";
        if (outEl) { outEl.hidden = false; outEl.textContent = "Running…"; }
        if (stEl) stEl.hidden = true;
        runExample(r.ex).then(function (out) {
          runBtn.disabled = false;
          runBtn.textContent = "▶ Run here";
          if (outEl) outEl.textContent = out === "" ? "(no output)" : out;
          if (stEl) {
            stEl.hidden = false;
            if (r.out != null && r.out !== "") {
              stEl.textContent = out === r.out ? "✓ Matches the expected output" : "Output differs from the expected output above — check the code.";
            } else {
              stEl.textContent = "Ran successfully.";
            }
          }
        }).catch(function (e) {
          runBtn.disabled = false;
          runBtn.textContent = "▶ Run here";
          if (outEl) outEl.textContent = "Error: " + ((e && e.message) || String(e));
          if (stEl) { stEl.hidden = false; stEl.textContent = "Could not run here — try it in Code Studio instead."; }
        });
      });
    }
    $("ref-try").addEventListener("click", function () {
      try { localStorage.setItem("skillzify_compiler_code", r.ex); } catch (e) {}
      location.href = "compiler.html";
    });
    $("ref-copy").addEventListener("click", function () {
      copyText(r.ex);
      if (S && S.toast) S.toast("Copied 📋", "success");
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
    if (search) {
      search.addEventListener("input", function () { renderNav(search.value); });
      search.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") { e.preventDefault(); moveKbd(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); moveKbd(-1); }
        else if (e.key === "Enter") { e.preventDefault(); openKbd(); }
        else if (e.key === "Escape") { search.value = ""; renderNav(""); }
      });
    }
    var stats = $("ref-stats");
    if (stats) {
      var gs = groupsOf(R).length;
      var runnable = R.filter(function (r) { return r.out != null && r.out !== ""; }).length;
      stats.textContent = R.length + " entries · " + gs + " categories · " + runnable + " runnable examples";
    }
    renderNav("");
    var initial = null;
    if (location.hash) {
      var h = decodeURIComponent(location.hash.slice(1));
      if (h && h !== "overview") initial = findByName(h);
    }
    if (initial) show(initial.name);
    else showOverview();
  });

  window.SkillzifyReferenceUI = {
    R: R, show: show, showOverview: showOverview, searchEntries: searchEntries,
    findByName: findByName, groupsOf: groupsOf, toggleFav: toggleFav,
    getFavs: getFavs, getRecent: getRecent, runExample: runExample, levelOf: levelOf,
    moveKbd: moveKbd, openKbd: openKbd
  };
})();
