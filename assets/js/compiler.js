/* ============================================================
   Skillzify v2 — compiler.js (Code Studio 2.0)
   VS Code-like Python IDE:
   - Monaco editor (the real VS Code engine) with per-file models,
     a plain-textarea fallback when the CDN is unreachable
   - multi-file workspace (localStorage) with tabs + explorer
   - Pyodide execution (all files visible to imports)
   - terminal / problems / output-history panel, live problems,
     clickable tracebacks, restartable kernel
   - AI in the editor: Ctrl+I inline edit with a diff preview,
     selection actions, error -> AI Fix, plus the sidebar chat
   - search across files, find/replace, code history
   ============================================================ */
(function () {
  "use strict";

  var WS_KEY = "skillzify_ws";
  var RUNS_KEY = "skillzify_runs";
  var HIST_KEY = "skillzify_code_history";
  var AI_KEY = "skillzify_ai_key";
  var CM_THEME_KEY = "skillzify_cm_theme";
  var CM_FONT_KEY = "skillzify_cm_font";
  var TAB_KEY = "skillzify_tab_size";
  var CHAT_KEY = "skillzify_ai_chat";
  var SEC_KEY = "skillzify_side_secs";
  var PANEL_HIDDEN_KEY = "skillzify_panel_hidden";

  var pyodide = null;
  var pyodideLoading = false; // guards double-load + retry (P2-35)
  var editor = null;           // facade: Monaco adapter OR textarea fallback
  var monacoEd = null;         // raw Monaco editor instance (null in fallback mode)
  var monacoDiffEd = null;     // diff editor while an AI proposal is shown
  var ws = null;               // {files:{}, tabs:[], active}
  var lastError = "";
  var lastErrorInfo = null;    // {file, line} parsed from the last traceback
  var runToken = 0;
  var RUN_TIMEOUT_MS = 15000;
  var outHistory = [];
  var problems = [];
  var outlineSyms = [];   // symbols of the active file (Outline section)
  var outlineFilter = "";
  var pkgVersion = {};    // package name -> version string, once installed

  var SNIPPETS = {
    hello: { name: "👋 Hello World", code: 'print("Hello, Skillzify!")\nname = input("Your name: ")\nprint(f"Welcome, {name}! 🎉")' },
    fib: { name: "🌀 Fibonacci", code: 'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        print(a, end=" ")\n        a, b = b, a + b\n\nfib(12)' },
    fizzbuzz: { name: "🍹 FizzBuzz", code: 'for i in range(1, 31):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)' },
    factorial: { name: "❗ Factorial", code: 'def factorial(n):\n    return 1 if n <= 1 else n * factorial(n - 1)\n\nfor i in range(1, 8):\n    print(f"{i}! = {factorial(i)}")' },
    guess: { name: "🎲 Guessing Game", code: 'import random\n\nsecret = random.randint(1, 20)\nprint("I picked a number 1-20. You get 4 tries!")\nfor attempt in range(1, 5):\n    g = int(input(f"Try {attempt}: "))\n    if g == secret:\n        print("🎉 Correct!")\n        break\n    print("Too high!" if g > secret else "Too low!")\nelse:\n    print(f"Out of tries — it was {secret}.")' },
    sorting: { name: "📊 Sort Visualizer", code: 'nums = [64, 34, 25, 12, 22, 11, 90]\nprint("Before:", nums)\nfor i in range(len(nums)):\n    for j in range(i + 1, len(nums)):\n        if nums[j] < nums[i]:\n            nums[i], nums[j] = nums[j], nums[i]\n    print(f"Pass {i+1}: {nums}")\nprint("Sorted:", nums)' },
    prime: { name: "🧮 Prime Checker", code: 'def is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, int(n ** 0.5) + 1):\n        if n % i == 0:\n            return False\n    return True\n\nfor n in range(1, 31):\n    if is_prime(n):\n        print(n, end=" ")\nprint("\\nDone!")' },
    wordcount: { name: "📝 Word Counter", code: 'text = input("Paste some text: ")\nwords = text.split()\nprint(f"Words: {len(words)}")\nprint(f"Characters: {len(text)}")\nlongest = max(words, key=len) if words else "-"\nprint(f"Longest word: {longest}")' },
    binsearch: { name: "🎯 Binary Search", code: 'def binary_search(arr, target):\n    lo, hi = 0, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        print(f"Checking index {mid} (value {arr[mid]})")\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n\nnums = [2, 5, 8, 12, 16, 23, 38, 45]\nprint("Found at index:", binary_search(nums, 23))' },
    palindrome: { name: "🔤 Palindrome Check", code: 's = input("Enter a word: ")\nclean = "".join(c.lower() for c in s if c.isalnum())\nif clean == clean[::-1]:\n    print(f"\\"{s}\\" is a palindrome! 🎉")\nelse:\n    print(f"\\"{s}\\" is not a palindrome.")' }
  };

  var DEFAULT_CODE = 'print("Hello, Skillzify! 👋")\n# Press Ctrl+Enter to run this file\n# Create more files with ＋ in the Explorer';

  /* ================= workspace ================= */
  var lastSavedJson = null; // JSON of the workspace as last persisted (skip no-op saves)
  function loadWS() {
    try {
      var raw = localStorage.getItem(WS_KEY) || "null";
      var w = JSON.parse(raw);
      if (w && w.files && Object.keys(w.files).length) {
        lastSavedJson = raw;
        if (!w.mtimes || typeof w.mtimes !== "object") w.mtimes = {};
        if (!w.deleted || typeof w.deleted !== "object") w.deleted = {};
        return w;
      }
    } catch (e) {}
    return { files: { "main.py": DEFAULT_CODE }, tabs: ["main.py"], active: "main.py", mtimes: {}, deleted: {} };
  }
  function saveWS() {
    var json;
    try { json = JSON.stringify(ws); } catch (e) { updateSaveUI(false); return false; }
    if (json === lastSavedJson) { updateSaveUI(true); return true; }
    try {
      localStorage.setItem(WS_KEY, json);
      try { localStorage.setItem(WS_KEY + "_ts", String(Date.now())); } catch (e) {}
    } catch (e) { updateSaveUI(false); return false; } // quota/full: LOUD, never silent
    lastSavedJson = json;
    if (window.SkillzifySync && window.SkillzifySync.markDirty) {
      try { window.SkillzifySync.markDirty("workspace"); } catch (e) {}
    }
    updateSaveUI(true);
    return true;
  }

  /* ---------- save state (status bar + tab dirty dot) ---------- */
  var saveFailed = false;
  function fmtSaveTime(ts) {
    try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
  }
  function updateSaveUI(ok) {
    var el = document.getElementById("st-save");
    if (!el) return;
    if (ok === false) {
      el.textContent = "⚠ Save failed — storage full?";
      el.title = "The workspace could not be saved in this browser. Free up storage, or download a backup (.py) before closing the tab.";
      if (!saveFailed) {
        saveFailed = true;
        try { toast("Workspace save failed — browser storage is full", "error"); } catch (e) {}
      }
    } else {
      saveFailed = false;
      el.textContent = "Saved ✓ " + fmtSaveTime(Date.now());
      el.title = "All files saved in this browser" + ((window.SkillzifySync && window.SkillzifySync.getStatus) ? " · " + window.SkillzifySync.getStatus() : "");
    }
    updateDirtyTab();
  }
  function markUnsaved() {
    var el = document.getElementById("st-save");
    if (el) {
      el.textContent = "● Unsaved changes";
      el.title = "You have unsaved changes — they auto-save as you type";
    }
    updateDirtyTab();
  }
  function updateDirtyTab() {
    try {
      if (!ws || !ws.active) return;
      var dirty = !!(editor && editor.getValue() !== ws.files[ws.active]);
      var tab = document.querySelector('.tab[data-tab="' + ws.active + '"]');
      if (tab) tab.classList.toggle("dirty", dirty);
      var dot = document.querySelector('.file-item[data-file="' + ws.active.replace(/"/g, "") + '"] .fdirty');
      if (dot) dot.classList.toggle("on", dirty);
    } catch (e) {}
  }

  /* ---------- workspace backup (one-step restore) ----------
     Before anything replaces the whole workspace — a shared link, a
     reset, or a newer copy arriving from another device — the current
     workspace is stashed in `skillzify_ws_backup` (with its time), and
     Settings offers a one-tap restore. Restoring swaps: the workspace
     being replaced becomes the new backup, so a mistaken restore is
     itself undoable. */
  function backupWorkspace(obj) {
    try {
      var raw = obj ? JSON.stringify(obj) : localStorage.getItem(WS_KEY);
      if (raw) {
        localStorage.setItem(WS_KEY + "_backup", raw);
        try { localStorage.setItem(WS_KEY + "_backup_at", String(Date.now())); } catch (e) {}
      }
    } catch (e) {}
    updateRestoreButton();
  }
  function updateRestoreButton() {
    var b = document.getElementById("restore-ws-btn");
    if (!b) return;
    var has = false, at = 0;
    try {
      has = !!localStorage.getItem(WS_KEY + "_backup");
      at = parseInt(localStorage.getItem(WS_KEY + "_backup_at") || "0", 10) || 0;
    } catch (e) {}
    b.style.display = has ? "" : "none";
    if (has && at) {
      try { b.title = "Backup from " + new Date(at).toLocaleString(); } catch (e) {}
    }
  }
  function restoreBackupWS() {
    var raw = null;
    try { raw = localStorage.getItem(WS_KEY + "_backup"); } catch (e) {}
    if (!raw) { toast("No backed-up workspace found", "error"); return; }
    var b = null;
    try { b = JSON.parse(raw); } catch (e) {}
    if (!b || !b.files || !Object.keys(b.files).length) { toast("Backed-up workspace is empty", "error"); return; }
    var cur = ws;
    ws = b;
    if (!ws.mtimes) ws.mtimes = {};
    if (!ws.deleted) ws.deleted = {};
    Object.keys(ws.files).forEach(function (k) { ws.mtimes[k] = Date.now(); delete ws.deleted[k]; });
    if (editor) editor.setValue(ws.active ? ws.files[ws.active] : "");
    saveWS();
    backupWorkspace(cur); // the replaced workspace becomes the new backup
    renderExplorer(); renderTabs(); updateStatusBar(); updateRestoreButton();
    toast("Workspace restored from backup ↩", "success");
  }
  function persistActiveFile() {
    if (ws.active && editor) {
      var v = editor.getValue();
      if (ws.files[ws.active] !== v) {
        ws.files[ws.active] = v;
        if (!ws.mtimes) ws.mtimes = {};
        ws.mtimes[ws.active] = Date.now(); // per-file edit time (drives sync)
        if (ws.deleted) delete ws.deleted[ws.active]; // edited after a delete = re-created
      }
    }
  }
  function validName(n) {
    n = String(n || "").trim().replace(/[\/\\]/g, "");
    if (!/^[A-Za-z0-9_][A-Za-z0-9_\-\.]{0,39}$/.test(n)) return null;
    if (!n.endsWith(".py")) n += ".py";
    return n;
  }

  function renderExplorer() {
    var host = document.getElementById("file-list");
    if (!host) return;
    var names = Object.keys(ws.files).sort();
    host.innerHTML = names.map(function (n) {
      return '<div class="file-item' + (n === ws.active ? " active" : "") + '" data-file="' + esc(n) + '">' +
        '<span class="fglyph">🐍</span><span class="fname">' + esc(n) + '</span>' +
        '<span class="fdirty" title="Unsaved changes"></span>' +
        '<span class="frow-acts">' +
        '<button class="fact" data-ren="' + esc(n) + '" title="Rename">✎</button>' +
        '<button class="fact fdel" data-del="' + esc(n) + '" title="Delete">✕</button></span></div>';
    }).join("");
    host.querySelectorAll(".file-item").forEach(function (el) {
      el.addEventListener("click", function (e) {
        if (e.target.closest && (e.target.closest("[data-del]") || e.target.closest("[data-ren]"))) return;
        if (e.target.classList && e.target.classList.contains("fname-edit")) return;
        openFile(el.getAttribute("data-file"));
      });
    });
    host.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteFile(b.getAttribute("data-del"));
      });
    });
    host.querySelectorAll("[data-ren]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        startRename(b.getAttribute("data-ren"));
      });
    });
    var foot = document.getElementById("explorer-foot");
    if (foot) {
      var lines = 0;
      names.forEach(function (n) { lines += String(ws.files[n] || "").split("\n").length; });
      foot.textContent = names.length + (names.length === 1 ? " file" : " files") + " · " + lines + " lines";
    }
    updateDirtyTab();
  }

  /* Inline rename (VS Code style): the row's name becomes an input;
     Enter / blur commits, Esc cancels. */
  function startRename(name) {
    var row = document.querySelector('.file-item[data-file="' + name.replace(/"/g, "") + '"]');
    if (!row) return;
    var span = row.querySelector(".fname");
    if (!span || row.querySelector(".fname-edit")) return;
    var input = document.createElement("input");
    input.className = "fname-edit";
    input.value = name;
    input.setAttribute("aria-label", "Rename file");
    span.replaceWith(input);
    input.focus();
    var dot = name.lastIndexOf(".");
    try { input.setSelectionRange(0, dot > 0 ? dot : name.length); } catch (e) {}
    var done = false;
    function commit() {
      if (done) return;
      done = true;
      renameFile(name, input.value);
    }
    function cancel() {
      if (done) return;
      done = true;
      renderExplorer();
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
      e.stopPropagation();
    });
    input.addEventListener("blur", commit);
    input.addEventListener("click", function (e) { e.stopPropagation(); });
  }
  function renameFile(oldName, rawNew) {
    var n = validName(rawNew);
    if (!n) { toast("Invalid name — use letters, numbers, _ or -", "error"); renderExplorer(); return; }
    if (n === oldName) { renderExplorer(); return; }
    if (ws.files.hasOwnProperty(n)) { toast("File already exists", "error"); renderExplorer(); return; }
    persistActiveFile();
    ws.files[n] = ws.files[oldName];
    delete ws.files[oldName];
    if (!ws.mtimes) ws.mtimes = {};
    ws.mtimes[n] = Date.now();
    delete ws.mtimes[oldName];
    if (!ws.deleted) ws.deleted = {};
    ws.deleted[oldName] = Date.now(); // tombstone the old name, like a delete
    delete ws.deleted[n];
    ws.tabs = ws.tabs.map(function (t) { return t === oldName ? n : t; });
    if (editor && editor.__dropFile) editor.__dropFile(oldName); // retire the old Monaco model
    if (ws.active === oldName) {
      ws.active = n;
      if (editor) editor.setValue(ws.files[n]);
    }
    saveWS(); renderExplorer(); renderTabs(); updateStatusBar();
    toast("Renamed to " + n, "success");
  }

  function renderTabs() {
    var host = document.getElementById("tabs");
    host.innerHTML = ws.tabs.map(function (n) {
      if (!ws.files.hasOwnProperty(n)) return "";
      var dirty = editor && n === ws.active && editor.getValue() !== ws.files[n];
      return '<div class="tab' + (n === ws.active ? " active" : "") + (dirty ? " dirty" : "") + '" data-tab="' + esc(n) + '">' +
        '<span class="dot"></span><span>🐍 ' + esc(n) + '</span>' +
        '<button class="x" data-close="' + esc(n) + '">✕</button></div>';
    }).join("");
    host.querySelectorAll(".tab").forEach(function (el) {
      el.addEventListener("click", function (e) {
        if (e.target.hasAttribute("data-close")) return;
        openFile(el.getAttribute("data-tab"));
      });
    });
    host.querySelectorAll("[data-close]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        closeTab(b.getAttribute("data-close"));
      });
    });
    var bc = document.getElementById("breadcrumbs");
    if (bc) bc.innerHTML = ws.active ? ("explorer <span class='sep'>›</span> " + esc(ws.active)) : "no file open";
    var sf = document.getElementById("st-file");
    if (sf) sf.textContent = ws.active || "—";
    document.getElementById("welcome").style.display = ws.active ? "none" : "flex";
    try { renderOutline(); } catch (e) {}
  }

  function openFile(name) {
    if (!ws.files.hasOwnProperty(name)) return;
    persistActiveFile();
    ws.active = name;
    if (ws.tabs.indexOf(name) < 0) ws.tabs.push(name);
    if (editor) { editor.setValue(ws.files[name]); editor.focus(); }
    saveWS(); renderExplorer(); renderTabs(); updateStatusBar();
    refreshMarkers();
  }
  function closeTab(name) {
    persistActiveFile();
    ws.tabs = ws.tabs.filter(function (t) { return t !== name; });
    if (ws.active === name) ws.active = ws.tabs.length ? ws.tabs[ws.tabs.length - 1] : null;
    if (editor) editor.setValue(ws.active ? ws.files[ws.active] : "");
    saveWS(); renderExplorer(); renderTabs(); updateStatusBar();
  }
  function newFile() {
    var n = prompt("New file name:", "script2.py");
    if (n == null) return;
    n = validName(n);
    if (!n) { toast("Invalid name — use letters, numbers, _ or -", "error"); return; }
    if (ws.files.hasOwnProperty(n)) { toast("File already exists", "error"); return; }
    persistActiveFile();
    ws.files[n] = "# " + n + "\n";
    if (!ws.mtimes) ws.mtimes = {};
    ws.mtimes[n] = Date.now();
    if (ws.deleted) delete ws.deleted[n];
    ws.tabs.push(n); ws.active = n;
    if (editor) { editor.setValue(ws.files[n]); editor.focus(); }
    saveWS(); renderExplorer(); renderTabs();
    toast("Created " + n, "success");
  }
  function deleteFile(name) {
    if (!confirm("Delete " + name + "?")) return;
    persistActiveFile();
    delete ws.files[name];
    if (editor && editor.__dropFile) editor.__dropFile(name); // dispose its Monaco model too
    if (!ws.mtimes) ws.mtimes = {};
    delete ws.mtimes[name];
    if (!ws.deleted) ws.deleted = {};
    ws.deleted[name] = Date.now(); // tombstone: the delete must outlive stale saves
    ws.tabs = ws.tabs.filter(function (t) { return t !== name; });
    if (ws.active === name) ws.active = ws.tabs.length ? ws.tabs[ws.tabs.length - 1] : null;
    if (!Object.keys(ws.files).length) {
      ws.files["main.py"] = DEFAULT_CODE; ws.tabs = ["main.py"]; ws.active = "main.py";
      ws.mtimes["main.py"] = Date.now(); delete ws.deleted["main.py"]; // fresh default, not a resurrection
    }
    if (editor) editor.setValue(ws.active ? ws.files[ws.active] : "");
    saveWS(); renderExplorer(); renderTabs(); updateStatusBar();
  }

  /* ================= editor fallback (P1-7) =================
     Plain <textarea> editor with the same facade API the rest of
     compiler.js uses, so code can still be typed, searched and run
     when the Monaco CDN fails (editor == null otherwise leaves a
     silently empty editor area). No syntax highlighting — everything
     else (get/set value, cursor, find/replace, Ctrl+Enter to run)
     keeps working. */
  function makeFallbackEditor(host, initialValue) {
    var note = document.createElement("div");
    note.id = "cm-fallback-note";
    note.className = "cm-fallback-note";
    note.textContent = "⚠ Code editor failed to load — using a plain-text editor (no syntax highlighting). Your code still runs.";
    host.appendChild(note);
    var ta = document.createElement("textarea");
    ta.id = "editor-fallback";
    ta.value = initialValue || "";
    ta.setAttribute("spellcheck", "false");
    ta.setAttribute("aria-label", "Code editor (plain-text fallback)");
    try { ta.style.fontSize = curFont() + "px"; } catch (e) {}
    try { ta.style.tabSize = String(curTabSize()); } catch (e) {}
    host.appendChild(ta);
    var opts = { theme: "dracula", lineWrapping: false };
    var handlers = {};
    function fire(ev) { (handlers[ev] || []).forEach(function (fn) { try { fn(); } catch (e) {} }); }
    function posToOffset(pos) {
      var lines = ta.value.split("\n"), off = 0, ln = Math.max(0, Math.min(pos.line || 0, lines.length - 1));
      for (var i = 0; i < ln; i++) off += lines[i].length + 1;
      return off + Math.min(pos.ch || 0, (lines[ln] || "").length);
    }
    function offsetToPos(off) {
      var up = ta.value.slice(0, Math.max(0, off)).split("\n");
      return { line: up.length - 1, ch: up[up.length - 1].length };
    }
    function makeSearchCursor(q, fromPos, opts2) {
      var fold = !!(opts2 && opts2.caseFold);
      var hay = fold ? ta.value.toLowerCase() : ta.value;
      var needle = fold ? String(q).toLowerCase() : String(q);
      var at = fromPos ? posToOffset(fromPos) : 0;
      var cur = { fromOff: -1, toOff: -1 };
      function findNext() {
        var i = hay.indexOf(needle, at);
        if (i < 0) return false;
        cur.fromOff = i; cur.toOff = i + needle.length; at = cur.toOff;
        return true;
      }
      function findPrevious() {
        var i = hay.lastIndexOf(needle, Math.max(0, at - needle.length - 1));
        if (i < 0) return false;
        cur.fromOff = i; cur.toOff = i + needle.length; at = i;
        return true;
      }
      return {
        findNext: findNext, findPrevious: findPrevious,
        from: function () { return offsetToPos(cur.fromOff); },
        to: function () { return offsetToPos(cur.toOff); },
        replace: function (rep) {
          if (cur.fromOff < 0) return;
          ta.value = ta.value.slice(0, cur.fromOff) + rep + ta.value.slice(cur.toOff);
          at = cur.fromOff + String(rep).length;
          cur.toOff = at;
          fire("change");
        }
      };
    }
    ta.addEventListener("input", function () { fire("change"); fire("cursorActivity"); });
    ta.addEventListener("keyup", function () { fire("cursorActivity"); });
    ta.addEventListener("click", function () { fire("cursorActivity"); });
    ta.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") { e.preventDefault(); runCode(); }
    });
    return {
      getValue: function () { return ta.value; },
      setValue: function (v) { ta.value = String(v == null ? "" : v); fire("change"); },
      getCursor: function () { return offsetToPos(ta.selectionStart || 0); },
      setCursor: function (pos) { var off = posToOffset(pos || { line: 0, ch: 0 }); try { ta.selectionStart = off; ta.selectionEnd = off; } catch (e) {} },
      focus: function () { try { ta.focus(); } catch (e) {} },
      getSelection: function () { return ta.value.substring(ta.selectionStart || 0, ta.selectionEnd || 0); },
      setSelection: function (from, to) { try { ta.selectionStart = posToOffset(from); ta.selectionEnd = posToOffset(to); } catch (e) {} },
      scrollIntoView: function () {},
      getSearchCursor: makeSearchCursor,
      lastLine: function () { return ta.value.split("\n").length - 1; },
      operation: function (fn) { fn(); },
      /* P2-59: theme / font-size controls must work in fallback mode
         too — apply them to the textarea (dark themes get a dark
         textarea, light themes a light one). */
      setOption: function (k, v) {
        opts[k] = v;
        if (k === "lineWrapping") { try { ta.style.whiteSpace = v ? "pre-wrap" : "pre"; } catch (e) {} }
        if (k === "theme") {
          try {
            var light = /eclipse|light|default/i.test(String(v || ""));
            ta.style.backgroundColor = light ? "#ffffff" : "#282a36";
            ta.style.color = light ? "#1e1e1e" : "#f8f8f2";
          } catch (e) {}
        }
        if (k === "fontSize") { try { ta.style.fontSize = (parseInt(v, 10) || 14) + "px"; } catch (e) {} }
        if (k === "tabSize") { try { ta.style.tabSize = String(parseInt(v, 10) || 4); } catch (e) {} }
      },
      getOption: function (k) { return opts[k]; },
      refresh: function () {},
      on: function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
      addKeyMap: function () {}
    };
  }

  /* ================= Monaco editor (Code Studio 2.0) =================
     The real VS Code engine, loaded from the pinned CDN in
     compiler.html. The adapter exposes the same facade API the rest
     of compiler.js was written against (getValue / setValue /
     getCursor / …), so the workspace, runner and AI code did not
     change shape. Each workspace file gets its OWN Monaco model, so
     undo history and scroll state survive tab switches — like VS
     Code. If the CDN is unreachable the textarea fallback above is
     used instead and the page stays fully functional. */
  var MONACO_THEME_MAP = { "dracula": "skz-dracula", "material-darker": "skz-material", "nord": "skz-nord", "monokai": "monokai", "eclipse": "vs" };
  function minimapOn() {
    try { return localStorage.getItem("skillzify_minimap") !== "0"; } catch (e) { return true; }
  }
  function defineMonacoThemes(monaco) {
    monaco.editor.defineTheme("skz-dracula", {
      base: "vs-dark", inherit: true,
      rules: [
        { token: "comment", foreground: "6272a4", fontStyle: "italic" },
        { token: "keyword", foreground: "ff79c6" },
        { token: "string", foreground: "f1fa8c" },
        { token: "number", foreground: "bd93f9" },
        { token: "type", foreground: "8be9fd" },
        { token: "identifier", foreground: "f8f8f2" },
        { token: "delimiter", foreground: "f8f8f2" }
      ],
      colors: { "editor.background": "#282a36", "editor.lineHighlightBackground": "#44475a55", "editorLineNumber.foreground": "#6272a4", "editorCursor.foreground": "#f8f8f2", "editor.selectionBackground": "#44475a" }
    });
    monaco.editor.defineTheme("skz-material", {
      base: "vs-dark", inherit: true,
      rules: [
        { token: "comment", foreground: "546e7a", fontStyle: "italic" },
        { token: "keyword", foreground: "c792ea" },
        { token: "string", foreground: "c3e88d" },
        { token: "number", foreground: "f78c6c" },
        { token: "type", foreground: "ffcb6b" },
        { token: "identifier", foreground: "eeffff" },
        { token: "delimiter", foreground: "89ddff" }
      ],
      colors: { "editor.background": "#212121", "editor.lineHighlightBackground": "#2a2a2a", "editorLineNumber.foreground": "#424242", "editorCursor.foreground": "#ffcc00", "editor.selectionBackground": "#214283" }
    });
    monaco.editor.defineTheme("skz-nord", {
      base: "vs-dark", inherit: true,
      rules: [
        { token: "comment", foreground: "616e88", fontStyle: "italic" },
        { token: "keyword", foreground: "81a1c1" },
        { token: "string", foreground: "a3be8c" },
        { token: "number", foreground: "b48ead" },
        { token: "type", foreground: "8fbcbb" },
        { token: "identifier", foreground: "d8dee9" },
        { token: "delimiter", foreground: "eceff4" }
      ],
      colors: { "editor.background": "#2e3440", "editor.lineHighlightBackground": "#3b4252", "editorLineNumber.foreground": "#4c566a", "editorCursor.foreground": "#d8dee9", "editor.selectionBackground": "#434c5e" }
    });
  }

  function makeMonacoEditor(host, initialValue) {
    var monaco = window.monaco;
    defineMonacoThemes(monaco);
    var mount = document.createElement("div");
    mount.id = "monaco-host";
    host.appendChild(mount);
    var theme = "dracula";
    try { theme = localStorage.getItem(CM_THEME_KEY) || "dracula"; } catch (e) {}
    var models = {};     // filename -> ITextModel
    var viewStates = {}; // filename -> saved view state
    var curName = ws && ws.active ? ws.active : null;
    function modelFor(name, value) {
      var key = name || "__scratch__";
      if (!models[key]) models[key] = monaco.editor.createModel(value == null ? "" : String(value), "python");
      return models[key];
    }
    var ed = monaco.editor.create(mount, {
      model: modelFor(curName, initialValue),
      theme: MONACO_THEME_MAP[theme] || "skz-dracula",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: curFont(),
      minimap: { enabled: minimapOn() },
      automaticLayout: true,
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      stickyScroll: { enabled: true },
      wordWrap: "off",
      tabSize: curTabSize(),
      insertSpaces: true,
      scrollBeyondLastLine: false,
      renderWhitespace: "selection",
      smoothScrolling: true,
      cursorBlinking: "smooth",
      padding: { top: 8 }
    });
    monacoEd = ed;
    registerAiActions(ed);
    var opts = { theme: theme, lineWrapping: false };
    var handlers = {};
    function fire(ev) { (handlers[ev] || []).forEach(function (fn) { try { fn(); } catch (e) {} }); }
    ed.onDidChangeModelContent(function () { fire("change"); });
    ed.onDidChangeCursorPosition(function () { fire("cursorActivity"); });
    function curModel() { return ed.getModel(); }
    function offToPos(model, off) {
      var p = model.getPositionAt(Math.max(0, off));
      return { line: p.lineNumber - 1, ch: p.column - 1 };
    }
    function posToOff(model, pos) {
      return model.getOffsetAt({ lineNumber: (pos && pos.line || 0) + 1, column: (pos && pos.ch || 0) + 1 });
    }
    function showFile(name, value) {
      var cur = ed.getModel();
      if (curName && models[curName] === cur) { try { viewStates[curName] = ed.saveViewState(); } catch (e) {} }
      curName = name;
      var m = modelFor(name, value);
      if (value != null && m.getValue() !== value) m.setValue(value);
      if (ed.getModel() !== m) ed.setModel(m);
      if (name && viewStates[name]) { try { ed.restoreViewState(viewStates[name]); } catch (e) {} }
    }
    function makeSearchCursor(q, fromPos, opts2) {
      var model = curModel();
      var fold = !!(opts2 && opts2.caseFold);
      var needle = fold ? String(q).toLowerCase() : String(q);
      var at = fromPos ? posToOff(model, fromPos) : 0;
      var cur = { fromOff: -1, toOff: -1 };
      function hay() { var v = model.getValue(); return fold ? v.toLowerCase() : v; }
      function findNext() {
        var i = hay().indexOf(needle, at);
        if (i < 0) return false;
        cur.fromOff = i; cur.toOff = i + needle.length; at = cur.toOff;
        return true;
      }
      function findPrevious() {
        var i = hay().lastIndexOf(needle, Math.max(0, at - needle.length - 1));
        if (i < 0) return false;
        cur.fromOff = i; cur.toOff = i + needle.length; at = i;
        return true;
      }
      return {
        findNext: findNext, findPrevious: findPrevious,
        from: function () { return offToPos(model, cur.fromOff); },
        to: function () { return offToPos(model, cur.toOff); },
        replace: function (rep) {
          if (cur.fromOff < 0) return;
          var r = new monaco.Range(
            offToPos(model, cur.fromOff).line + 1, offToPos(model, cur.fromOff).ch + 1,
            offToPos(model, cur.toOff).line + 1, offToPos(model, cur.toOff).ch + 1);
          model.pushEditOperations([], [{ range: r, text: String(rep) }], null);
          at = cur.fromOff + String(rep).length;
          cur.toOff = at;
        }
      };
    }
    return {
      getValue: function () { var m = curModel(); return m ? m.getValue() : ""; },
      setValue: function (v) {
        v = String(v == null ? "" : v);
        var name = ws && ws.active ? ws.active : null;
        if (name !== curName) { showFile(name, v); return; }
        var m = curModel();
        if (m && m.getValue() !== v) m.setValue(v);
      },
      getCursor: function () {
        var p = ed.getPosition();
        return p ? { line: p.lineNumber - 1, ch: p.column - 1 } : { line: 0, ch: 0 };
      },
      setCursor: function (pos) {
        var np = { lineNumber: (pos && pos.line || 0) + 1, column: (pos && pos.ch || 0) + 1 };
        ed.setPosition(np);
        ed.revealPositionInCenterIfOutsideViewport(np);
      },
      focus: function () { try { ed.focus(); } catch (e) {} },
      getSelection: function () {
        var s = ed.getSelection();
        if (!s || s.isEmpty()) return "";
        return curModel().getValueInRange(s);
      },
      setSelection: function (from, to) {
        var r = new monaco.Range((from.line || 0) + 1, (from.ch || 0) + 1, (to.line || 0) + 1, (to.ch || 0) + 1);
        ed.setSelection(r);
        ed.revealRangeInCenterIfOutsideViewport(r);
      },
      scrollIntoView: function (range) {
        if (range && range.from) {
          ed.revealRangeInCenter(new monaco.Range(range.from.line + 1, range.from.ch + 1, (range.to ? range.to.line : range.from.line) + 1, (range.to ? range.to.ch : range.from.ch) + 1));
        }
      },
      getSearchCursor: makeSearchCursor,
      lastLine: function () { var m = curModel(); return m ? m.getLineCount() - 1 : 0; },
      operation: function (fn) { fn(); },
      setOption: function (k, v) {
        opts[k] = v;
        if (k === "theme") monaco.editor.setTheme(MONACO_THEME_MAP[v] || "vs-dark");
        else if (k === "lineWrapping") ed.updateOptions({ wordWrap: v ? "on" : "off" });
        else if (k === "fontSize") ed.updateOptions({ fontSize: parseInt(v, 10) || 14 });
        else if (k === "minimap") ed.updateOptions({ minimap: { enabled: !!v } });
        else if (k === "tabSize") ed.updateOptions({ tabSize: parseInt(v, 10) || 4 });
      },
      getOption: function (k) { return opts[k]; },
      refresh: function () { try { ed.layout(); } catch (e) {} },
      on: function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
      addKeyMap: function () {
        ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () { runCode(); });
      },
      __dropFile: function (name) {
        if (models[name]) {
          try { models[name].dispose(); } catch (e) {}
          delete models[name];
          delete viewStates[name];
        }
      }
    };
  }

  /* Monaco bootstrap: AMD-load the editor with a timeout, so a hung
     CDN falls back to the textarea instead of wedging the page. */
  function initMonacoEditor(theme, font, onReady, onFail) {
    var done = false;
    function fail() {
      if (done) return;
      done = true;
      try { onFail(); } catch (e) {}
    }
    try {
      if (!window.MonacoEnvironment) {
        var base = String(window.SKZ_MONACO_VS || "").replace(/\/vs\/?$/, "/");
        var abs = new URL(base, location.href).href;
        window.MonacoEnvironment = {
          getWorkerUrl: function () {
            var code = "self.MonacoEnvironment = { baseUrl: '" + abs + "' }; importScripts('" + abs + "vs/base/worker/workerMain.js');";
            return URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
          }
        };
      }
    } catch (e) {}
    var timer = setTimeout(fail, 9000);
    try {
      window.require(["vs/editor/editor.main"], function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          editor = makeMonacoEditor(document.getElementById("editor-host"), ws.active ? ws.files[ws.active] : "");
          registerPyCompletions(window.monaco);
          onReady(); // wireEditor: keymap, theme/font, change + save wiring
        } catch (e) {
          editor = null;
          monacoEd = null;
          try { onFail(); } catch (e2) {}
        }
      }, function () { clearTimeout(timer); fail(); });
    } catch (e) { clearTimeout(timer); fail(); }
  }

  /* ================= Python completions (local, no AI) ================= */
  var PY_KEYWORDS = ["and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield", "True", "False", "None"];
  var PY_BUILTINS = ["print", "input", "len", "range", "int", "str", "float", "bool", "list", "dict", "set", "tuple", "type", "isinstance", "enumerate", "zip", "map", "filter", "sorted", "reversed", "sum", "min", "max", "abs", "round", "open", "repr", "id", "help", "dir", "vars", "getattr", "setattr", "hasattr", "super", "object", "Exception", "ValueError", "TypeError", "IndexError", "KeyError", "NameError", "ZeroDivisionError"];
  var PY_MODULE_MEMBERS = {
    os: ["path", "getcwd", "listdir", "makedirs", "remove", "rename", "environ", "name", "sep", "urandom"],
    sys: ["argv", "exit", "path", "platform", "version", "maxsize", "stdin", "stdout", "stderr", "setrecursionlimit", "getrecursionlimit"],
    math: ["pi", "e", "sqrt", "floor", "ceil", "fabs", "pow", "log", "log2", "log10", "sin", "cos", "tan", "asin", "acos", "atan", "degrees", "radians", "gcd", "factorial", "inf", "nan", "isclose"],
    random: ["random", "randint", "randrange", "choice", "choices", "shuffle", "sample", "uniform", "seed", "gauss"],
    json: ["dumps", "loads", "dump", "load", "JSONDecodeError"],
    re: ["match", "search", "findall", "finditer", "sub", "split", "compile", "escape", "IGNORECASE", "MULTILINE"],
    collections: ["Counter", "defaultdict", "deque", "namedtuple", "OrderedDict", "ChainMap"],
    itertools: ["count", "cycle", "repeat", "chain", "compress", "product", "permutations", "combinations", "accumulate", "groupby", "zip_longest"],
    time: ["time", "sleep", "ctime", "strftime", "localtime", "gmtime", "perf_counter", "monotonic"],
    datetime: ["datetime", "date", "time", "timedelta", "timezone", "now", "today", "utcnow", "fromisoformat"]
  };
  var PY_SNIPPETS = [
    { label: "def", detail: "function definition", body: "def ${1:name}(${2:args}):\n    ${0:pass}" },
    { label: "class", detail: "class definition", body: "class ${1:Name}:\n    def __init__(self${2:, args}):\n        ${0:pass}" },
    { label: "for", detail: "for loop", body: "for ${1:item} in ${2:items}:\n    ${0:pass}" },
    { label: "while", detail: "while loop", body: "while ${1:condition}:\n    ${0:pass}" },
    { label: "if", detail: "if statement", body: "if ${1:condition}:\n    ${0:pass}" },
    { label: "ifmain", detail: "main guard", body: "if __name__ == \"__main__\":\n    ${0:main()}" },
    { label: "try", detail: "try / except", body: "try:\n    ${1:pass}\nexcept ${2:Exception} as e:\n    ${0:print(e)}" },
    { label: "with", detail: "with statement", body: "with open(${1:\"file.txt\"}) as ${2:f}:\n    ${0:pass}" },
    { label: "listcomp", detail: "list comprehension", body: "[${1:x} for ${2:x} in ${3:items}]" },
    { label: "print", detail: "print()", body: "print(${0})" }
  ];
  function collectWorkspaceSymbols() {
    var out = [], seen = {};
    if (!ws || !ws.files) return out;
    Object.keys(ws.files).forEach(function (fname) {
      var src = String(ws.files[fname] || "");
      var re = /(^|\n)[ \t]*(?:async[ \t]+)?def[ \t]+([A-Za-z_]\w*)|^[ \t]*class[ \t]+([A-Za-z_]\w*)|^[ \t]*([A-Za-z_]\w*)[ \t]*=(?!=)/gm, m;
      while ((m = re.exec(src))) {
        var name = m[2] || m[3] || m[4];
        if (!name || seen[name]) continue;
        seen[name] = 1;
        out.push({ name: name, kind: m[2] ? "function" : (m[3] ? "class" : "variable"), file: fname });
      }
    });
    return out;
  }
  /* ================= outline (sidebar) =================
     Same def/class/assignment patterns collectWorkspaceSymbols uses
     for completions, applied per line of the ACTIVE file so the
     Outline gets line numbers + indentation depth. def/class entries
     nest by an indent stack; assignments are listed at top level. */
  function parseFileSymbols(src) {
    var out = [], stack = [];
    var lines = String(src || "").split("\n");
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var indent = (raw.match(/^[ \t]*/) || [""])[0].replace(/\t/g, "    ").length;
      var m = raw.match(/^[ \t]*(?:async[ \t]+)?def[ \t]+([A-Za-z_]\w*)/) ||
              raw.match(/^[ \t]*class[ \t]+([A-Za-z_]\w*)/);
      var kind = null, name = null;
      if (m) { name = m[1]; kind = raw.match(/^[ \t]*class[ \t]/) ? "class" : "def"; }
      else if (indent === 0) {
        var a = raw.match(/^([A-Za-z_]\w*)[ \t]*=(?!=)/);
        if (a) { name = a[1]; kind = "var"; }
      }
      if (!name) continue;
      if (kind === "var") { out.push({ name: name, kind: kind, line: i, depth: 0 }); continue; }
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      out.push({ name: name, kind: kind, line: i, depth: stack.length });
      stack.push({ indent: indent });
    }
    return out;
  }
  function renderOutline() {
    var host = document.getElementById("outline-list");
    if (!host || !ws) return;
    var src = "";
    if (ws.active) src = (editor && editor.getValue && ws.files.hasOwnProperty(ws.active)) ? editor.getValue() : (ws.files[ws.active] || "");
    outlineSyms = parseFileSymbols(src);
    var q = outlineFilter.trim().toLowerCase();
    var shown = outlineSyms.filter(function (s) { return !q || s.name.toLowerCase().indexOf(q) >= 0; });
    if (!ws.active) { host.innerHTML = '<div class="side-empty">No file open.</div>'; return; }
    if (!shown.length) {
      host.innerHTML = '<div class="side-empty">' + (outlineSyms.length ? "No symbols match the filter." : "No functions or classes yet.") + "</div>";
      return;
    }
    host.innerHTML = shown.map(function (s) {
      var glyph = s.kind === "def" ? "ƒ" : (s.kind === "class" ? "C" : "x");
      return '<div class="ol-item" data-line="' + s.line + '" style="padding-left:' + (22 + s.depth * 13) + 'px">' +
        '<span class="olg ol-k-' + s.kind + '">' + glyph + '</span>' +
        '<span class="ol-name">' + esc(s.name) + "</span></div>";
    }).join("");
    host.querySelectorAll(".ol-item").forEach(function (el) {
      el.addEventListener("click", function () {
        var ln = +el.getAttribute("data-line");
        if (editor) { editor.setCursor({ line: ln, ch: 0 }); editor.focus(); }
      });
    });
    updateOutlineCursor();
  }
  /* Highlight the def/class that contains the cursor (indent stack
     over the cached symbols — no reparse on cursor moves). */
  function updateOutlineCursor() {
    try {
      if (!editor || !outlineSyms.length) return;
      var cur = editor.getCursor().line, stack = [], curLine = -1;
      for (var i = 0; i < outlineSyms.length; i++) {
        var s = outlineSyms[i];
        if (s.line > cur) break;
        if (s.kind === "var") continue;
        while (stack.length && stack[stack.length - 1].depth >= s.depth) stack.pop();
        stack.push(s);
      }
      if (stack.length) curLine = stack[stack.length - 1].line;
      document.querySelectorAll(".ol-item").forEach(function (el) {
        el.classList.toggle("cur", +el.getAttribute("data-line") === curLine);
      });
    } catch (e) {}
  }

  function registerPyCompletions(monaco) {
    if (!monaco || !monaco.languages || registerPyCompletions._done) return;
    registerPyCompletions._done = true;
    monaco.languages.registerCompletionItemProvider("python", {
      triggerCharacters: ["."],
      provideCompletionItems: function (model, position) {
        var K = monaco.languages.CompletionItemKind;
        var word = model.getWordUntilPosition(position);
        var range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn
        };
        var linePrefix = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
        var suggestions = [];
        var dot = linePrefix.match(/([A-Za-z_][\w]*)\.$/);
        if (dot) {
          // resolve `import x as y` aliases in the current file
          var mod = dot[1];
          var alias = model.getValue().match(new RegExp("import\\s+([A-Za-z_][\\w.]*)\\s+as\\s+" + mod + "\\b"));
          if (alias) mod = alias[1].split(".")[0];
          (PY_MODULE_MEMBERS[mod] || []).forEach(function (mem) {
            suggestions.push({ label: mem, kind: K.Method, detail: mod + "." + mem, range: range });
          });
          return { suggestions: suggestions };
        }
        PY_KEYWORDS.forEach(function (w) { suggestions.push({ label: w, kind: K.Keyword, range: range }); });
        PY_BUILTINS.forEach(function (w) { suggestions.push({ label: w, kind: K.Function, detail: "builtin", range: range }); });
        collectWorkspaceSymbols().forEach(function (s) {
          suggestions.push({
            label: s.name,
            kind: s.kind === "class" ? K.Class : (s.kind === "function" ? K.Function : K.Variable),
            detail: s.kind + " · " + s.file,
            range: range
          });
        });
        PY_SNIPPETS.forEach(function (s) {
          suggestions.push({
            label: s.label, kind: K.Snippet, detail: s.detail, range: range,
            insertText: s.body, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
          });
        });
        return { suggestions: suggestions };
      }
    });
  }

  /* ================= helpers ================= */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function toast(m, k) { if (window.Skillzify) window.Skillzify.toast(m, k); }

  /* ================= Pyodide ================= */
  function setRunUI(running) {
    document.getElementById("run-btn").disabled = running || !pyodide;
    document.getElementById("stop-btn").disabled = !running;
    // P1-9: the Check button must not be usable before the runtime
    // exists — and its label must not claim "0 problems" meanwhile.
    var chk = document.getElementById("st-check");
    if (chk) {
      chk.disabled = !pyodide;
      if (!pyodide) chk.textContent = "✓ Check";
    }
    var sr = document.getElementById("st-run");
    if (sr) sr.innerHTML = running ? "⏹" : "▶";
  }
  function loadPyodideRuntime() {
    if (pyodide || pyodideLoading) return;
    pyodideLoading = true;
    printLine("⏳ Loading Python 3.11 runtime…", "dim");
    function startPyodide() {
      // P2-57: a script that loads but doesn't define loadPyodide used
      // to throw here, leaving pyodideLoading true forever and Run
      // wedged on "still loading…". Guard it so a retry is possible.
      try {
      window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" }).then(function (py) {
        pyodide = py;
        pyodideLoading = false;
        // Make every workspace file importable right away (Run also
        // rewrites them, but imports/checks can happen before a run).
        try {
          if (ws && ws.files) Object.keys(ws.files).forEach(function (n) {
            try { py.FS.writeFile(n, ws.files[n]); } catch (e) {}
          });
        } catch (e) {}
        printLine("✅ Python 3.11 ready (Pyodide). Press ▶ Run.", "dim");
        setRunUI(false);
        checkProblems(true);
      }).catch(function (e) {
        pyodideLoading = false;
        printLine("❌ Could not load the Python runtime. Check your connection and reload.", "err");
      });
      } catch (e) {
        pyodideLoading = false;
        printLine("❌ Could not load the Python runtime. Check your connection and reload.", "err");
      }
    }
    // AMD-safe load (15 Nov 2026, second iteration): fetch the script
    // and evaluate it with define/require/module/exports SHADOWED as
    // undefined parameters, so Pyodide's UMD wrapper takes its global
    // branch and sets window.loadPyodide — while the page's real AMD
    // globals are never touched. The first iteration hid the globals
    // during a <script> injection; that window raced Monaco's own
    // module loading (its modules call the global define as they
    // arrive over the network) and knocked the editor into its
    // fallback. Shadowing has no window and no race.
    fetch("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js").then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.text();
    }).then(function (code) {
      new Function("define", "require", "module", "exports", code)(undefined, undefined, undefined, undefined);
      // If the evaluated script did not define loadPyodide, the
      // guarded call inside startPyodide reports it (P2-57).
      startPyodide();
    }).catch(function (e) {
      pyodideLoading = false;
      printLine("❌ Could not download Pyodide — internet required.", "err");
    });
  }

  /* ================= interactive stdin bridge =================
     Python's input() is AST-rewritten to await __skillzify_input(),
     which awaits a JS Promise. The terminal shows an inline prompt
     and resolves the promise when the user presses Enter. */
  var stdinResolver = null;
  var runOut = [];        // batched stdout of the active run
  var killTimer = null;
  var hadOutput = false;  // any stdout/stderr batch arrived during the active run (P1-31)

  function drainOut() {
    runOut.forEach(function (l) { printLine(l); });
    runOut.length = 0;
  }

  globalThis.__stdin_flush = function () { drainOut(); };
  globalThis.__stdin_read = function (promptText) {
    return new Promise(function (resolve) {
      stdinResolver = resolve;
      showStdinPrompt(promptText || "");
    });
  };

  function showStdinPrompt(promptText) {
    // pause the runaway watchdog while the human thinks
    if (killTimer) { clearTimeout(killTimer); killTimer = null; }
    var con = document.getElementById("console");
    var line = document.createElement("div");
    line.className = "stdin-line";
    var p = document.createElement("span");
    p.className = "stdin-prompt";
    p.textContent = promptText;
    var inp = document.createElement("input");
    inp.className = "stdin-field";
    inp.setAttribute("spellcheck", "false");
    inp.setAttribute("autocomplete", "off");
    inp.setAttribute("aria-label", "Program input");
    var eofBtn = document.createElement("button");
    eofBtn.className = "stdin-eof";
    eofBtn.textContent = "EOF ⏻";
    eofBtn.title = "Send end-of-input (Ctrl+D)";
    line.appendChild(p); line.appendChild(inp); line.appendChild(eofBtn);
    con.appendChild(line);
    con.scrollTop = con.scrollHeight;
    inp.focus();
    var done = false;
    function submit(eof) {
      if (done) return;
      done = true;
      var val = eof ? null : inp.value;
      // turn the input line into a static echoed line, like a real terminal
      var echo = document.createElement("div");
      echo.textContent = promptText + (eof ? "" : val);
      if (eof) { var s = document.createElement("span"); s.className = "dim"; s.textContent = " [EOF]"; echo.appendChild(s); }
      con.replaceChild(echo, line);
      var r = stdinResolver;
      stdinResolver = null;
      restartKillTimer();
      if (r) r(val);
    }
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); submit(false); }
      else if (e.key === "d" && e.ctrlKey) { e.preventDefault(); submit(true); }
    });
    eofBtn.addEventListener("click", function () { submit(true); });
  }

  function cancelStdin() {
    if (stdinResolver) {
      var r = stdinResolver;
      stdinResolver = null;
      var line = document.querySelector("#console .stdin-line");
      if (line) line.remove();
      r(null); // EOF -> Python raises EOFError, run already abandoned via runToken
    }
  }

  /* P1-31: the watchdog measures silence, not wall-clock run time.
     Every stdout/stderr batch re-arms it, so a program that keeps
     printing is never killed for "no output". It only re-arms
     while a run is actually being watched (killTimer armed): a
     batch arriving after the run finished must not arm a stray
     timer that could "kill" the next idle 15s. */
  function noteOutput(s) {
    runOut.push(s);
    hadOutput = true;
    if (killTimer) restartKillTimer();
  }
  function restartKillTimer() {
    if (killTimer) clearTimeout(killTimer);
    var my = runToken;
    killTimer = setTimeout(function () {
      if (my !== runToken) return;
      runToken++;
      cancelStdin();
      drainOut();
      printLine(hadOutput
        ? "⏱ Stopped: no output for 15s — likely an infinite loop."
        : "⏱ Stopped: ran over 15s with no output — likely an infinite loop.", "err");
      pushOutHist(false, 15000);
      recordRun(false, 15000);
      setRunUI(false);
      killTimer = null;
    }, RUN_TIMEOUT_MS);
  }
  function clearKillTimer() {
    if (killTimer) { clearTimeout(killTimer); killTimer = null; }
  }

  /* Python bootstrap: rewrites input() -> await __skillzify_input() via AST,
     compiles with top-level-await enabled, and eval()s the module code
     object — eval returns the coroutine, which we await. True module
     semantics: global statements, __name__, __future__ all behave exactly
     like real Python. __USER_CODE__ is replaced with a JSON string literal
     (valid Python too). */
  var BOOTSTRAP = [
    "import ast as _ast, inspect as _inspect",
    "import os as _os",
    "_os.environ['MPLBACKEND'] = 'agg'",
    "__uc = __USER_CODE__",
    "__tree = _ast.parse(__uc)",
    "__shadowed = False",
    "for __n in _ast.walk(__tree):",
    "    if isinstance(__n, (_ast.FunctionDef, _ast.AsyncFunctionDef)) and __n.name == 'input':",
    "        __shadowed = True; break",
    "    if isinstance(__n, _ast.Assign):",
    "        for __t in __n.targets:",
    "            if isinstance(__t, _ast.Name) and __t.id == 'input': __shadowed = True; break",
    "    if isinstance(__n, _ast.AnnAssign) and isinstance(__n.target, _ast.Name) and __n.target.id == 'input':",
    "        __shadowed = True; break",
    "from js import __stdin_read as __js_read, __stdin_flush as __js_flush",
    "async def __skillzify_input(__p=''):",
    "    __js_flush()",
    "    __v = await __js_read(str(__p))",
    "    if __v is None: raise EOFError('EOF when reading a line')",
    "    return __v",
    "if not __shadowed:",
    "    class __IT(_ast.NodeTransformer):",
    "        def visit_Call(self, __node):",
    "            self.generic_visit(__node)",
    "            if isinstance(__node.func, _ast.Name) and __node.func.id == 'input':",
    "                __node.func.id = '__skillzify_input'",
    "                return _ast.copy_location(_ast.Await(value=__node), __node)",
    "            return __node",
    "    __tree = __IT().visit(__tree)",
    "    _ast.fix_missing_locations(__tree)",
    "__co = compile(__tree, '<code-studio>', 'exec', flags=_ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)",
    "__ns = {'__name__': '__main__', '__skillzify_input': __skillzify_input}",
    "__r = eval(__co, __ns)",
    "if _inspect.iscoroutine(__r): await __r"
  ].join("\n");
  // Smart scroll (15 Nov 2026): the terminal sticks to the bottom only
  // when the reader is already there. If they scrolled up to read, new
  // output holds their place and lights the "↓ New output" pill instead
  // of yanking the view down. Every console append path settles through
  // conSettle with a stick flag captured BEFORE the append.
  function conStick(con) { return con.scrollHeight - con.scrollTop - con.clientHeight < 48; }
  function conSettle(con, stick) {
    if (stick) con.scrollTop = con.scrollHeight;
    else { var j = document.getElementById("term-jump"); if (j) j.classList.remove("chip-off"); }
  }
  function printLine(text, cls) {
    var con = document.getElementById("console");
    var stick = conStick(con);
    var d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = text;
    con.appendChild(d);
    conSettle(con, stick);
  }
  function clearTerminal() {
    document.getElementById("console").innerHTML = "";
    var j = document.getElementById("term-jump"); if (j) j.classList.add("chip-off");
  }
  function copyOutput() {
    var t = document.getElementById("console").innerText;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("Terminal output copied 📋", "success"); });
  }

  /* Compatibility lever: before executing, auto-load any Pyodide-bundled
     packages the code imports (numpy, pandas, matplotlib…) so plain
     `import numpy` just works, and pin matplotlib to the headless "agg"
     backend. The watchdog is paused while packages download — a slow
     first fetch must not look like an infinite loop — and re-armed when
     execution actually starts. Any failure here falls through to a
     normal run (the import error then surfaces in the terminal). */
  function loadImportsThenRun(src, code) {
    function start() {
      restartKillTimer();
      try { return pyodide.runPythonAsync(src); }
      catch (e) { return Promise.reject(e); }
    }
    if (!pyodide.loadPackagesFromImports) return start();
    clearKillTimer();
    return pyodide.loadPackagesFromImports(code).then(function (loaded) {
      try {
        // The resolved value's shape varies by Pyodide build: an array
        // of names on some, an array of package objects on others.
        var names = [];
        if (loaded && loaded.length) {
          for (var i = 0; i < loaded.length; i++) {
            var p = loaded[i];
            names.push(typeof p === "string" ? p : (p && p.name) || String(p));
          }
        }
        if (names.length) {
          printLine("📦 Auto-loaded package(s): " + names.join(", "), "dim");
          if (names.indexOf("matplotlib") !== -1) {
            try { pyodide.runPython("import matplotlib\nmatplotlib.use('agg')"); } catch (e) {}
          }
        }
      } catch (e) {}
      return start();
    }, function () { return start(); });
  }

  /* ================= run ================= */
  function runCode() {
    if (!pyodide) {
      /* Retry the download instead of wedging on "still loading"
         forever after a failed load (P2-35). */
      if (pyodideLoading) { toast("Python runtime is still loading…", "error"); return; }
      printLine("⏳ Retrying the Python runtime download…", "dim");
      loadPyodideRuntime();
      toast("Python runtime failed to load — retrying the download…", "error");
      return;
    }
    if (!ws.active) { toast("Open a file first", "error"); return; }
    persistActiveFile();
    saveWS();
    var code = ws.files[ws.active];

    switchPtab("terminal");
    clearTerminal();
    cancelStdin();
    setRunUI(true);
    printLine("── ▶ " + ws.active + " · " + new Date().toLocaleTimeString() + " ──", "dim");
    printLine("$ python " + ws.active, "dim");

    // make every workspace file importable
    try {
      Object.keys(ws.files).forEach(function (n) {
        try { pyodide.FS.writeFile(n, ws.files[n]); } catch (e) {}
      });
    } catch (e) {}

    runOut = [];
    hadOutput = false;
    pyodide.setStdout({ batched: noteOutput });
    pyodide.setStderr({ batched: noteOutput });
    // sys.stdin reads (not via input()) get immediate EOF; input() is interactive
    try { pyodide.setStdin({ stdin: function () { return null; } }); } catch (e) {}

    var my = ++runToken;
    var t0 = performance.now();
    restartKillTimer();

    // replacer FUNCTION: user code may contain $& / $' which replace() would otherwise interpret
    var src = BOOTSTRAP.replace("__USER_CODE__", function () { return JSON.stringify(code); });
    var p = loadImportsThenRun(src, code);
    p.then(function () {
      if (my !== runToken) return;
      clearKillTimer();
      cancelStdin();
      var ms = Math.round(performance.now() - t0);
      drainOut();
      printLine("✅ Finished in " + ms + " ms · exit 0", "ok-meta");
      lastError = "";
      lastErrorInfo = null;
      refreshAiChips();
      pushOutHist(true, ms);
      recordRun(true, ms);
      saveCodeHistory();
      checkProblems(true);
      setRunUI(false);
    }).catch(function (e) {
      if (my !== runToken) return;
      clearKillTimer();
      cancelStdin();
      var ms = Math.round(performance.now() - t0);
      var rawMsg = String((e && e.message) || e);
      var short = simplifyTraceback(rawMsg);
      lastErrorInfo = parseTracebackFrame(rawMsg, ws.active);
      drainOut();
      printTraceback(short);
      printLine("❌ Error after " + ms + " ms · exit 1 — see PROBLEMS or ask AI →", "err");
      lastError = short;
      refreshAiChips();
      printAiFixRow();
      pushOutHist(false, ms);
      recordRun(false, ms);
      saveCodeHistory();
      checkProblems(true);
      setRunUI(false);
    });
  }
  function stopRun() {
    if (!runToken) return;
    runToken++;
    clearKillTimer();
    cancelStdin();
    drainOut();
    printLine("⏹ Stopped by user.", "err");
    setRunUI(false);
  }

  /* Restart kernel: throw the Pyodide instance away and boot a fresh
     one. Variables/globals from earlier runs are gone (that's the
     point); workspace files are kept and rewritten into the new
     filesystem by the loader's ready handler. */
  function restartKernel() {
    runToken++;
    clearKillTimer();
    cancelStdin();
    pyodide = null;
    pyodideLoading = false;
    lastErrorInfo = null;
    refreshMarkers();
    clearTerminal();
    printLine("🔄 Kernel restarted — fresh Python runtime, your files are unchanged.", "dim");
    setRunUI(false);
    loadPyodideRuntime();
    toast("Python kernel restarted 🔄", "success");
  }

  function simplifyTraceback(msg) {
    var lines = msg.split("\n").filter(function (l) { return l.trim() !== ""; });
    var kept = lines.filter(function (l) {
      return /File "<exec>"/.test(l) || /Error|Exception/i.test(l) || /^\s*\^/.test(l) || /line \d+/.test(l);
    });
    var tail = kept.slice(-6);
    return tail.length ? tail.join("\n") : lines.slice(-3).join("\n");
  }

  function recordRun(ok, ms) {
    try {
      var runs = window.Skillzify.storeGet(RUNS_KEY, []);
      runs.unshift({ t: Date.now(), ok: ok, ms: ms, preview: (ws.active || "") + " · " + String(ws.files[ws.active] || "").split("\n")[0].slice(0, 50) });
      window.Skillzify.storeSet(RUNS_KEY, runs.slice(0, 30));
      if (window.SkillzifyActivity) window.SkillzifyActivity.log("run", "Ran " + (ws.active || "code"));
    } catch (e) {}
    // No local streak bump here: A.log() above bumps the shared
    // counter (any activity day counts) — the old duplicate
    // bumpStreak() is gone on purpose.
  }

  /* ================= output history tab ================= */
  function pushOutHist(ok, ms) {
    outHistory.unshift({
      t: Date.now(), ok: ok, ms: ms, file: ws.active,
      html: esc(document.getElementById("console").innerText).slice(0, 4000)
    });
    outHistory = outHistory.slice(0, 20);
    renderOutHist();
  }
  function renderOutHist() {
    var host = document.getElementById("outhist-list");
    if (!outHistory.length) { host.innerHTML = '<div class="empty-note">No runs yet — output history appears here.</div>'; return; }
    host.innerHTML = outHistory.map(function (r) {
      return '<div class="oh-item"><div class="meta"><span class="' + (r.ok ? "badge-ok" : "badge-err") + '">' +
        (r.ok ? "✅" : "❌") + '</span><span>' + esc(r.file || "") + '</span><span>' +
        new Date(r.t).toLocaleTimeString() + '</span><span>' + r.ms + ' ms</span></div><pre>' + r.html + '</pre></div>';
    }).join("");
  }

  /* ================= problems tab ================= */
  function checkProblems(silent) {
    problems = [];
    // P1-9: without the runtime the compile check below cannot run, so
    // reporting "no problems" would be a false pass. Say the runtime is
    // still loading instead — never a pass.
    if (!pyodide) {
      var host = document.getElementById("problems-list");
      if (host) host.innerHTML = '<div class="empty-note">⏳ Python runtime still loading — try again in a moment.</div>';
      var badge = document.getElementById("prob-badge");
      if (badge) badge.style.display = "none";
      var ab0 = document.getElementById("activity-problems");
      if (ab0) ab0.style.display = "none";
      if (!silent) switchPtab("problems");
      return problems;
    }
    if (ws.active) {
      var code = ws.files[ws.active];
      try {
        pyodide.runPython("compile(" + JSON.stringify(code) + ", '<editor>', 'exec')");
      } catch (e) {
        var msg = String((e && e.message) || e);
        var m = msg.match(/line (\d+)/);
        problems.push({ file: ws.active, line: m ? +m[1] : null, msg: simplifyTraceback(msg).split("\n").slice(-2).join(" ") });
      }
    }
    renderProblems();
    refreshMarkers();
    if (!silent) switchPtab("problems");
    return problems;
  }
  function renderProblems() {
    var badge = document.getElementById("prob-badge");
    var btn = document.getElementById("st-check");
    badge.style.display = problems.length ? "" : "none";
    badge.textContent = problems.length;
    var ab = document.getElementById("activity-problems");
    if (ab) {
      ab.style.display = problems.length ? "" : "none";
      var abb = document.getElementById("activity-problems-badge");
      if (abb) abb.textContent = problems.length;
    }
    if (btn) btn.textContent = "✓ " + problems.length + " problem" + (problems.length === 1 ? "" : "s");
    var host = document.getElementById("problems-list");
    if (!problems.length) { host.innerHTML = '<div class="empty-note">✅ No problems detected in ' + esc(ws.active || "—") + '.</div>'; return; }
    host.innerHTML = problems.map(function (p, i) {
      return '<div class="prob-item" data-prob="' + i + '"><span>🔴</span>' +
        '<span class="pl">' + esc(p.file) + (p.line ? ":" + p.line : "") + '</span>' +
        '<span class="pm">' + esc(p.msg) + '</span></div>';
    }).join("");
    host.querySelectorAll("[data-prob]").forEach(function (el) {
      el.addEventListener("click", function () {
        var p = problems[+el.getAttribute("data-prob")];
        if (p && p.line && editor) {
          editor.setCursor({ line: p.line - 1, ch: 0 });
          editor.focus();
        }
      });
    });
  }

  /* ================= panel tabs ================= */
  function switchPtab(name) {
    document.querySelectorAll(".ptab").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-ptab") === name);
    });
    document.querySelectorAll(".pview").forEach(function (v) {
      v.classList.toggle("active", v.id === "pview-" + name);
    });
  }

  /* Console panel visibility (hide/unhide): shown by default. Hiding
     adds .hidden (display:none) so the editor flexes into the freed
     space — Monaco's automaticLayout follows on its own. The ⛶
     toggle's inline 60% height is deliberately left untouched, so
     unhiding restores whatever height mode was active. The choice is
     persisted (PANEL_HIDDEN_KEY) and re-applied during init; every
     control (header ✕, status-bar toggle, Ctrl+`, Problems badge)
     goes through setPanelHidden so the state lives in one place. */
  function setPanelHidden(h) {
    var p = document.getElementById("panel");
    if (!p) return;
    p.classList.toggle("hidden", !!h);
    try { localStorage.setItem(PANEL_HIDDEN_KEY, h ? "1" : "0"); } catch (e) {}
  }
  function panelHidden() {
    var p = document.getElementById("panel");
    return !!p && p.classList.contains("hidden");
  }

  /* ================= find & replace ================= */
  var findState = { cursor: null, query: "" };
  function openFind(replaceMode) {
    var bar = document.getElementById("findbar");
    bar.classList.add("on");
    document.getElementById("replace-input").style.display = replaceMode ? "" : "none";
    document.getElementById("replace-one").style.display = replaceMode ? "" : "none";
    document.getElementById("replace-all").style.display = replaceMode ? "" : "none";
    var fi = document.getElementById("find-input");
    if (editor && editor.getSelection()) fi.value = editor.getSelection();
    fi.focus(); fi.select();
    if (fi.value) { findState.query = ""; doFind(1); }
  }
  function closeFind() {
    document.getElementById("findbar").classList.remove("on");
    findState.cursor = null;
    document.getElementById("find-count").textContent = "";
    if (editor) editor.focus();
  }
  function doFind(dir) {
    if (!editor) return; // fallback editor implements getSearchCursor too
    var q = document.getElementById("find-input").value;
    if (!q) { document.getElementById("find-count").textContent = ""; return; }
    if (q !== findState.query || !findState.cursor) {
      findState.query = q;
      findState.cursor = editor.getSearchCursor(q, editor.getCursor(), { caseFold: true });
    }
    var found = dir > 0 ? findState.cursor.findNext() : findState.cursor.findPrevious();
    if (!found) {
      findState.cursor = editor.getSearchCursor(q, dir > 0 ? { line: 0, ch: 0 } : editor.lastLine(), { caseFold: true });
      found = dir > 0 ? findState.cursor.findNext() : findState.cursor.findPrevious();
    }
    if (found) {
      editor.setSelection(findState.cursor.from(), findState.cursor.to());
      editor.scrollIntoView({ from: findState.cursor.from(), to: findState.cursor.to() }, 60);
      document.getElementById("find-count").textContent = "✓ match";
    } else document.getElementById("find-count").textContent = "no matches";
  }
  function doReplace(all) {
    if (!editor || !findState.cursor) return;
    var q = document.getElementById("find-input").value;
    var rep = document.getElementById("replace-input").value;
    if (!q) return;
    if (all) {
      var cur = editor.getSearchCursor(q, { line: 0, ch: 0 }, { caseFold: true });
      var n = 0;
      editor.operation(function () { while (cur.findNext()) { cur.replace(rep); n++; } });
      document.getElementById("find-count").textContent = n + " replaced";
      findState.cursor = null;
    } else {
      if (editor.getSelection()) { findState.cursor.replace(rep); }
      doFind(1);
    }
  }

  /* ================= search across files =================
     Live (debounced input in the terminal init section): results are
     grouped by file with the match highlighted; a click opens the
     file with the match selected. */
  function searchFiles(q) {
    var host = document.getElementById("search-results");
    var countEl = document.getElementById("search-count");
    q = (q || "").trim();
    if (!q) { host.innerHTML = ""; if (countEl) countEl.textContent = ""; return; }
    var ql = q.toLowerCase(), total = 0, groups = [];
    Object.keys(ws.files).sort().forEach(function (name) {
      var hits = [];
      ws.files[name].split("\n").forEach(function (line, i) {
        var at = line.toLowerCase().indexOf(ql);
        if (at >= 0) hits.push({ l: i + 1, c: at, t: line });
      });
      if (hits.length) { groups.push({ f: name, hits: hits }); total += hits.length; }
    });
    if (countEl) {
      countEl.textContent = total
        ? total + (total === 1 ? " result" : " results") + " in " + groups.length + (groups.length === 1 ? " file" : " files")
        : "";
    }
    if (!total) {
      host.innerHTML = '<div class="empty-note">No matches for "' + esc(q) + '"</div>';
      return;
    }
    var shown = 0;
    host.innerHTML = groups.map(function (g) {
      var head = '<div class="search-file-head"><span>🐍</span><span>' + esc(g.f) + '</span>' +
        '<span class="cnt">' + g.hits.length + "</span></div>";
      var rows = g.hits.map(function (h) {
        if (shown >= 200) return "";
        shown++;
        var line = h.t, at = h.c;
        // window long lines around the match so the highlight shows
        if (line.length > 110) {
          var from = Math.max(0, at - 40);
          line = (from > 0 ? "…" : "") + line.slice(from, from + 110);
          at = at - from + (from > 0 ? 1 : 0);
        }
        var html = esc(line.slice(0, at)) + "<mark>" + esc(line.slice(at, at + q.length)) + "</mark>" + esc(line.slice(at + q.length));
        return '<div class="search-hit" data-f="' + esc(g.f) + '" data-l="' + h.l + '" data-c="' + h.c + '" data-len="' + q.length + '">' +
          '<span class="sl-no">' + h.l + '</span><span class="sl">' + html + "</span></div>";
      }).join("");
      return head + rows;
    }).join("") + (total > shown ? '<div class="empty-note">Showing the first ' + shown + " results — refine the search to see more.</div>" : "");
    host.querySelectorAll(".search-hit").forEach(function (el) {
      el.addEventListener("click", function () {
        openFile(el.getAttribute("data-f"));
        var ln = +el.getAttribute("data-l") - 1, c = +el.getAttribute("data-c"), len = +el.getAttribute("data-len");
        if (editor) {
          editor.setSelection({ line: ln, ch: c }, { line: ln, ch: c + len });
          editor.focus();
        }
      });
    });
  }

  /* ================= code history ================= */
  function saveCodeHistory() {
    if (!ws.active) return;
    var code = ws.files[ws.active].trim();
    if (!code) return;
    try {
      var h = window.Skillzify.storeGet(HIST_KEY, []);
      if (h.length && h[0].code === code && h[0].file === ws.active) return;
      h.unshift({ t: Date.now(), file: ws.active, code: code });
      window.Skillzify.storeSet(HIST_KEY, h.slice(0, 30));
      renderHistory();
    } catch (e) {}
  }
  function renderHistory() {
    var host = document.getElementById("hist-list");
    var h = [];
    try { h = window.Skillzify.storeGet(HIST_KEY, []); } catch (e) {}
    if (!host) return;
    host.innerHTML = h.length ? h.map(function (v, i) {
      return '<div class="hist-item-ide"><div class="meta">' + esc(v.file || "") + " · " +
        new Date(v.t).toLocaleString() + '</div><pre>' + esc(v.code.slice(0, 200)) +
        (v.code.length > 200 ? "…" : "") + '</pre><div class="row">' +
        '<button class="mini-btn primary" data-rh="' + i + '">Restore</button>' +
        '<button class="mini-btn" data-dh="' + i + '">Delete</button></div></div>';
    }).join("") : '<div class="empty-note">No saved versions yet.</div>';
    host.querySelectorAll("[data-rh]").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = window.Skillzify.storeGet(HIST_KEY, [])[+b.getAttribute("data-rh")];
        if (v && ws.files.hasOwnProperty(v.file)) {
          openFile(v.file);
          if (!editor) { toast("Editor unavailable — version not restored", "error"); return; }
          editor.setValue(v.code); persistActiveFile(); saveWS(); renderTabs(); toast("Version restored 🕘", "success");
        }
      });
    });
    host.querySelectorAll("[data-dh]").forEach(function (b) {
      b.addEventListener("click", function () {
        var hh = window.Skillzify.storeGet(HIST_KEY, []);
        hh.splice(+b.getAttribute("data-dh"), 1);
        window.Skillzify.storeSet(HIST_KEY, hh);
        renderHistory();
      });
    });
  }

  /* ================= status bar / editor prefs ================= */
  function currentSymbol(code, lineIdx) {
    var lines = String(code || "").split("\n"), sym = "";
    for (var i = 0; i <= Math.min(lineIdx, lines.length - 1); i++) {
      var m = lines[i].match(/^\s*(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)/);
      if (m) sym = m[1];
    }
    return sym;
  }
  function updateStatusBar() {
    if (!editor) return;
    var c = editor.getCursor();
    document.getElementById("st-pos").textContent = "Ln " + (c.line + 1) + ", Col " + (c.ch + 1);
    // breadcrumbs: explorer › file › enclosing def/class at the cursor
    try {
      var bc = document.getElementById("breadcrumbs");
      if (bc && ws.active) {
        var sym = currentSymbol(editor.getValue(), c.line);
        bc.innerHTML = "explorer <span class='sep'>›</span> " + esc(ws.active) +
          (sym ? " <span class='sep'>›</span> " + esc(sym) : "");
      }
    } catch (e) {}
    // refresh dirty dot without full re-render
    if (ws.active) {
      var tab = document.querySelector('.tab[data-tab="' + ws.active.replace(/"/g, "") + '"]');
      if (tab) tab.classList.toggle("dirty", editor.getValue() !== ws.files[ws.active]);
    }
  }
  function applyTheme(t) {
    if (editor) editor.setOption("theme", t);
    try { localStorage.setItem(CM_THEME_KEY, t); } catch (e) {}
    var sel = document.getElementById("theme-select");
    if (sel) sel.value = t;
    try {
      document.querySelectorAll(".swatch").forEach(function (s) {
        s.classList.toggle("on", s.getAttribute("data-theme-val") === t);
      });
    } catch (e) {}
    var st = document.getElementById("st-theme");
    if (st) st.textContent = t.charAt(0).toUpperCase() + t.slice(1).replace("-darker", "");
  }
  function applyFont(px) {
    px = Math.max(10, Math.min(24, px));
    // Both editors honour a "fontSize" option through the facade —
    // Monaco via updateOptions, the fallback textarea via its style
    // (P2-59).
    if (editor) { try { editor.setOption("fontSize", px); } catch (e) {} }
    if (editor) editor.refresh();
    try { localStorage.setItem(CM_FONT_KEY, String(px)); } catch (e) {}
    var fv = document.getElementById("fs-val");
    if (fv) fv.textContent = px + "px";
    var fr = document.getElementById("fs-range");
    if (fr && +fr.value !== px) fr.value = px;
  }
  function curFont() {
    try { return parseInt(localStorage.getItem(CM_FONT_KEY) || "14", 10) || 14; } catch (e) { return 14; }
  }
  function curTabSize() {
    try {
      var n = parseInt(localStorage.getItem(TAB_KEY) || "4", 10);
      return [2, 4, 8].indexOf(n) >= 0 ? n : 4;
    } catch (e) { return 4; }
  }
  function applyTabSize(n) {
    n = [2, 4, 8].indexOf(+n) >= 0 ? +n : 4;
    if (editor) { try { editor.setOption("tabSize", n); } catch (e) {} }
    try { localStorage.setItem(TAB_KEY, String(n)); } catch (e) {}
    var sel = document.getElementById("tabsize-select");
    if (sel) sel.value = String(n);
    var st = document.getElementById("st-tabsize");
    if (st) st.textContent = "Spaces: " + n;
  }

  /* ================= share / download / upload ================= */
  function b64urlEncode(s) {
    return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return decodeURIComponent(escape(atob(s)));
  }
  function b64e(s) { return b64urlEncode(s); }
  function b64d(s) { return b64urlDecode(s); }
  function copyTextFallback(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      toast(ok ? "Share link copied! 🔗" : "Copy failed — copy the URL from the address bar.", ok ? "success" : "error");
    } catch (e) { toast("Copy failed — copy the URL from the address bar.", "error"); }
  }
  function shareCode() {
    if (!ws.active) return;
    persistActiveFile(); saveWS();
    var payload = b64e(JSON.stringify({ files: ws.files, active: ws.active }));
    // P2-68: a multi-file workspace easily exceeds the ~2,000-char URL
    // limit many browsers / chat apps truncate at — a truncated link
    // decodes to garbage. Warn and offer a download instead.
    if (payload.length > 1500) {
      toast("Share link would be " + payload.length + " characters — too long to share reliably. Download the file instead?", "error");
      if (confirm("This workspace is too large for a share link (" + payload.length + " characters — links over ~1,500 often get truncated). Download the active file (" + ws.active + ") instead?")) downloadCode();
      return;
    }
    var url = location.href.split("#")[0] + "#ws=" + payload;
    try { history.replaceState(null, "", "#ws=" + payload); } catch (e) {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast("Share link copied! 🔗", "success"); })
        .catch(function () { copyTextFallback(url); });
    } else {
      copyTextFallback(url);
    }
  }
  function clearShareHash() {
    // A refresh must not re-apply the same shared snapshot and wipe
    // newer local edits, so the hash is cleared once it has been used.
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }
  function loadSharedWS() {
    // P1-3: pinned-snippet deep link (compiler.html#snippet-<id>) — open
    // a saved snippet (SkillzifyActivity) as its own file in the
    // workspace, keeping the user's existing files. This runs before
    // the editor exists, so it works through ws (the editor initialises
    // from ws.files[ws.active]); the hash is cleared once used, like
    // the #ws= / #code= links below. Unknown ids fall through to a
    // normal load.
    var m3 = (location.hash || "").match(/^#snippet-(.+)$/);
    if (m3) {
      try {
        var A = window.SkillzifyActivity;
        var list = (A && A.snippets) ? A.snippets() : [];
        var snip = null;
        list.forEach(function (s) { if (s.id === m3[1]) snip = s; });
        if (snip && snip.code) {
          var base = validName((snip.title || "snippet").replace(/[^A-Za-z0-9_\- ]/g, "").trim().replace(/\s+/g, "-").toLowerCase()) || "snippet.py";
          var fname = base, fi = 2;
          while (ws.files.hasOwnProperty(fname)) fname = base.replace(/\.py$/, "") + "-" + (fi++) + ".py";
          ws.files[fname] = snip.code;
          if (!ws.mtimes) ws.mtimes = {};
          ws.mtimes[fname] = Date.now();
          if (ws.deleted) delete ws.deleted[fname];
          if (ws.tabs.indexOf(fname) < 0) ws.tabs.push(fname);
          ws.active = fname;
          saveWS();
          clearShareHash();
          toast("Snippet loaded 📝", "success");
          return true;
        }
      } catch (e) {}
    }
    var m = (location.hash || "").match(/^#ws=(.+)$/);
    if (!m) return false;
    try {
      var d = JSON.parse(b64d(m[1]));
      if (d && d.files && Object.keys(d.files).length) {
        backupWorkspace();
        ws = { files: d.files, tabs: Object.keys(d.files), active: d.active || Object.keys(d.files)[0] };
        ws.mtimes = {}; Object.keys(ws.files).forEach(function (k) { ws.mtimes[k] = Date.now(); });
        ws.deleted = {};
        saveWS();
        clearShareHash();
        toast("Shared workspace opened — your previous workspace was backed up (Settings → Restore)", "success");
        return true;
      }
    } catch (e) {}
    // P2-68: a #ws= hash was present but didn't decode (truncated link,
    // bad paste) — say so LOUDLY instead of silently loading the old
    // workspace as if nothing happened.
    try {
      toast("Share link couldn't be opened — it may be truncated or corrupted. Your previous workspace is unchanged.", "error");
      printLine("❌ Share link couldn't be opened — it may be truncated or corrupted.", "err");
    } catch (e2) {}
    return false;
    // legacy single-file link
    var m2 = (location.hash || "").match(/^#code=(.+)$/);
    if (m2) {
      try {
        backupWorkspace();
        ws = { files: { "main.py": b64d(m2[1]) }, tabs: ["main.py"], active: "main.py" };
        ws.mtimes = { "main.py": Date.now() };
        ws.deleted = {};
        saveWS();
        clearShareHash();
        toast("Shared code opened — your previous workspace was backed up (Settings → Restore)", "success");
        return true;
      } catch (e) {}
    }
    return false;
  }

  /* Remote workspace arriving from another device (via the sync
     engine's "skillzify-sync" event, which fires after every
     pull/merge). The in-memory workspace is stale after a pull, so
     re-read it from storage — but never clobber unsaved typing: the
     file being edited keeps the editor's content, other files take
     the remote version. The pre-sync workspace is backed up first. */
  function applyRemoteWorkspace() {
    if (!ws) return;
    var raw = null;
    try { raw = localStorage.getItem(WS_KEY); } catch (e) {}
    var fresh = null;
    try { fresh = raw ? JSON.parse(raw) : null; } catch (e) { fresh = null; }
    if (!fresh || !fresh.files || !Object.keys(fresh.files).length) return;
    if (raw === lastSavedJson) return; // already in sync
    var dirty = !!(editor && ws.active && editor.getValue() !== ws.files[ws.active]);
    var myActive = ws.active, myCode = dirty ? editor.getValue() : null;
    backupWorkspace(ws);
    ws = fresh;
    if (!ws.mtimes) ws.mtimes = {};
    if (!ws.deleted) ws.deleted = {};
    if (!Object.keys(ws.files).length) {
      ws.files = { "main.py": DEFAULT_CODE }; ws.tabs = ["main.py"]; ws.active = "main.py";
      ws.mtimes["main.py"] = Date.now(); delete ws.deleted["main.py"];
    }
    if (dirty && myActive) {
      ws.files[myActive] = myCode; // my unsaved typing wins for this file
      ws.mtimes[myActive] = Date.now();
      delete ws.deleted[myActive];
      if (ws.tabs.indexOf(myActive) < 0) ws.tabs.push(myActive);
      if (!ws.active) ws.active = myActive;
      saveWS();
    } else {
      lastSavedJson = raw;
      updateSaveUI(true);
    }
    if (editor) editor.setValue(ws.active ? ws.files[ws.active] : "");
    renderExplorer(); renderTabs(); updateStatusBar();
    toast("Workspace updated from another device ✓", "success");
  }
  function downloadCode() {
    if (!ws.active) return;
    persistActiveFile();
    var blob = new Blob([ws.files[ws.active]], { type: "text/x-python" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = ws.active;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    toast("Downloaded " + ws.active + " ⬇️", "success");
  }

  /* ================= packages (stretch, Code Studio 2.0) =================
     A small curated shelf: Pyodide-bundled wheels install via
     loadPackage; pure-Python wheels via micropip. Installs live in
     the current kernel only — a restart clears them, like a real
     ephemeral environment. Status is reported in the terminal. */
  var PKGS = [
    { name: "numpy", how: "bundle" },
    { name: "pandas", how: "bundle" },
    { name: "matplotlib", how: "bundle" },
    { name: "tabulate", how: "pip" },
    { name: "emoji", how: "pip" }
  ];
  var pkgState = {}; // name -> "installing" | "installed"
  function renderPackages() {
    var host = document.getElementById("pkg-list");
    if (!host) return;
    host.innerHTML = PKGS.map(function (p) {
      var st = pkgState[p.name];
      var state = st === "installed"
        ? '<span class="pkg-ver">✓ Installed' + (pkgVersion[p.name] ? " · v" + esc(pkgVersion[p.name]) : "") + "</span>"
        : st === "installing"
          ? '<span class="pkg-spin">⟳</span> Installing…'
          : (p.how === "bundle" ? "built into Pyodide" : "via micropip");
      return '<div class="pkg-row"><span class="pkg-name">' + esc(p.name) + '</span>' +
        '<span class="pkg-state">' + state + '</span>' +
        '<button class="mini-btn" data-pkg="' + esc(p.name) + '"' + (st ? " disabled" : "") + '>Install</button></div>';
    }).join("");
    host.querySelectorAll("[data-pkg]").forEach(function (b) {
      b.addEventListener("click", function () { installPackage(b.getAttribute("data-pkg")); });
    });
  }
  function installPackage(name) {
    var p = null;
    PKGS.forEach(function (x) { if (x.name === name) p = x; });
    if (!p || pkgState[name]) return;
    if (!pyodide) { toast("Python runtime is still loading — try again in a moment", "error"); return; }
    pkgState[name] = "installing";
    renderPackages();
    switchPtab("terminal");
    printLine("📦 Installing " + name + "…", "dim");
    function done(ok, msg) {
      if (ok) {
        pkgState[name] = "installed";
        // Report the version where the package exposes one.
        try {
          var v = pyodide.runPython("import " + name + "\ngetattr(" + name + ", '__version__', '')");
          if (v) pkgVersion[name] = String(v);
        } catch (e) {}
      } else delete pkgState[name];
      renderPackages();
      printLine(ok ? "✅ " + name + " installed — `import " + name + "` works now."
        : "❌ Could not install " + name + (msg ? " — " + msg : ""), ok ? "ok-meta" : "err");
    }
    try {
      if (p.how === "bundle") {
        pyodide.loadPackage(name).then(function () { done(true); },
          function (e) { done(false, String((e && e.message) || e).slice(0, 140)); });
      } else {
        pyodide.loadPackage("micropip").then(function () {
          return pyodide.pyimport("micropip").install(name);
        }).then(function () { done(true); },
          function (e) { done(false, String((e && e.message) || e).slice(0, 140)); });
      }
    } catch (e) { done(false, String((e && e.message) || e).slice(0, 140)); }
  }

  /* ================= AI in the editor (Code Studio 2.0) =================
     Ctrl+I inline edit, right-click selection actions and the
     terminal's AI Fix all funnel into ONE proposal flow: the AI's
     code is shown as a Monaco diff over the current file, and only
     an explicit Accept touches the model. In fallback-editor mode
     there is no diff view — the sidebar Fix button (direct apply)
     remains the path there. */
  function registerAiActions(ed) {
    var monaco = window.monaco;
    ed.addAction({
      id: "skz-ai-inline", label: "✨ AI: Edit with instruction…",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
      contextMenuGroupId: "ai", contextMenuOrder: 1,
      run: function () { openInlineAi(); }
    });
    ed.addAction({
      id: "skz-ai-explain", label: "✨ AI: Explain selection",
      contextMenuGroupId: "ai", contextMenuOrder: 2, precondition: "editorHasSelection",
      run: function () { aiExplainSelection(); }
    });
    ed.addAction({
      id: "skz-ai-improve", label: "✨ AI: Improve selection",
      contextMenuGroupId: "ai", contextMenuOrder: 3, precondition: "editorHasSelection",
      run: function () { aiEditWithInstruction("Improve this code: make it cleaner, more readable and more Pythonic. Keep exactly the same behaviour and the same function/variable names where possible."); }
    });
    ed.addAction({
      id: "skz-ai-comment", label: "✨ AI: Add comments to selection",
      contextMenuGroupId: "ai", contextMenuOrder: 4, precondition: "editorHasSelection",
      run: function () { aiEditWithInstruction("Add clear, beginner-friendly comments to this code. Do not change any code — only add or improve comments."); }
    });
  }
  function aiTargetRange() {
    if (!monacoEd) return null;
    var model = monacoEd.getModel();
    if (!model) return null;
    var sel = monacoEd.getSelection();
    if (sel && !sel.isEmpty()) return { range: sel, text: model.getValueInRange(sel) };
    var pos = monacoEd.getPosition();
    if (!pos) return null;
    var lineText = model.getLineContent(pos.lineNumber);
    if (!lineText.trim()) {
      return { range: model.getFullModelRange(), text: model.getValue() };
    }
    return { range: new window.monaco.Range(pos.lineNumber, 1, pos.lineNumber, model.getLineMaxColumn(pos.lineNumber)), text: lineText };
  }
  function openInlineAi() {
    if (!monacoEd || !ws.active) { toast("Open a file first", "error"); return; }
    var host = document.getElementById("editor-host");
    var box = document.getElementById("inline-ai");
    if (!box) {
      box = document.createElement("div");
      box.id = "inline-ai";
      box.innerHTML = '<input id="inline-ai-input" placeholder="Tell the AI what to change… e.g. turn this into a while loop" aria-label="AI edit instruction">' +
        '<div class="ia-hint">Enter generates a diff to review · Esc cancels · targets the selection, or the current line</div>';
      host.appendChild(box);
      var inp = box.querySelector("input");
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var v = inp.value.trim();
          box.classList.remove("on");
          if (v) aiEditWithInstruction(v);
          else if (monacoEd) monacoEd.focus();
        } else if (e.key === "Escape") {
          e.preventDefault();
          box.classList.remove("on");
          if (monacoEd) monacoEd.focus();
        }
      });
    }
    var pos = monacoEd.getPosition();
    var coords = null;
    try { coords = pos ? monacoEd.getScrolledVisiblePosition(pos) : null; } catch (e) {}
    if (coords) {
      box.style.left = Math.max(8, Math.min(coords.left, Math.max(8, host.clientWidth - 500))) + "px";
      box.style.top = Math.min(coords.top + 26, Math.max(8, host.clientHeight - 90)) + "px";
    } else { box.style.left = "16px"; box.style.top = "16px"; }
    box.classList.add("on");
    var input = box.querySelector("input");
    input.value = "";
    input.focus();
  }
  function extractAiCode(text, mode) {
    var m = String(text || "").match(/```(?:python)?\n?([\s\S]*?)```/i);
    if (m) return m[1].replace(/\s+$/, "");
    if (mode === "generate" || mode === "fix") {
      var t = String(text || "").trim();
      return t || null;
    }
    return null;
  }
  function aiEditWithInstruction(instruction) {
    if (!monacoEd || !ws.active) { toast("Inline AI needs the full editor", "error"); return; }
    var AI = window.SkillzifyAI;
    if (!AI) { toast("AI module didn't load", "error"); return; }
    var t = aiTargetRange();
    if (!t) return;
    showDiff(null, null, "🤖 " + instruction);
    AI.ask({
      mode: "generate",
      code: "INSTRUCTION: " + instruction + "\n\nRewrite the Python code below following the instruction. Output ONLY the rewritten code inside a single ```python fenced block — no explanations, no extra text.\n\nCODE:\n" + t.text,
      error: ""
    }, function (err, res) {
      if (err) {
        closeDiff();
        toast("AI didn't answer — " + ((err && err.message) || "backend error"), "error");
        return;
      }
      var code = extractAiCode(res && res.text, "generate");
      if (!code) {
        closeDiff();
        renderAi("<h4>🤖 Inline AI</h4><p>" + esc((res && res.text) || "Empty answer.") + "</p>");
        return;
      }
      var model = monacoEd.getModel();
      var full = model.getValue();
      var startOff = model.getOffsetAt(t.range.getStartPosition());
      var endOff = model.getOffsetAt(t.range.getEndPosition());
      showDiff(full, full.slice(0, startOff) + code + full.slice(endOff), "AI edit — review the diff");
    });
  }
  function aiExplainSelection() {
    if (!monacoEd) return;
    var sel = monacoEd.getSelection();
    var model = monacoEd.getModel();
    if (!sel || sel.isEmpty() || !model) { toast("Select some code first", "error"); return; }
    aiCall({ mode: "", code: model.getValueInRange(sel), error: "" }, "explanation", null);
  }
  function aiFixWithDiff() {
    if (!ws.active || !lastError) return;
    persistActiveFile();
    if (!monacoEd) {
      var fb = document.getElementById("fix-code-btn");
      if (fb) fb.click();
      return;
    }
    var AI = window.SkillzifyAI;
    if (!AI) { toast("AI module didn't load", "error"); return; }
    showDiff(null, null, "🤖 Fixing " + ws.active + "…");
    AI.ask({ mode: "fix", code: ws.files[ws.active], error: lastError }, function (err, res) {
      if (err) {
        closeDiff();
        renderAi("<h4>⚠️ AI unavailable</h4><p>" + esc((err && err.message) || "The backend didn't answer.") + "</p>" +
          "<p class='hint'>Showing the offline explainer instead — this isn't the AI's answer.</p>" +
          AI.explainErrorHTML(lastError));
        return;
      }
      var code = extractAiCode(res && res.text, "fix");
      if (!code) { closeDiff(); toast("The AI didn't return a fix", "error"); return; }
      showDiff(monacoEd.getModel().getValue(), code, "AI fix — review the diff");
    });
  }

  /* ---- diff overlay (one proposal at a time) ---- */
  var diffState = null;
  function ensureDiffOverlay() {
    var ov = document.getElementById("diff-overlay");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "diff-overlay";
    ov.innerHTML = '<div class="diff-bar"><span class="t" id="diff-title">AI proposal</span>' +
      '<span style="color:var(--ide-muted)" id="diff-note"></span><span class="sp"></span>' +
      '<button class="mini-btn primary" id="diff-accept">✓ Accept</button>' +
      '<button class="mini-btn" id="diff-reject">✕ Reject</button></div><div id="diff-host"></div>';
    document.getElementById("editor-host").appendChild(ov);
    document.getElementById("diff-accept").addEventListener("click", acceptDiff);
    document.getElementById("diff-reject").addEventListener("click", function () { closeDiff(); });
    return ov;
  }
  function showDiff(original, proposed, label) {
    if (!monacoEd) return;
    var monaco = window.monaco;
    var ov = ensureDiffOverlay();
    ov.classList.add("on");
    document.getElementById("diff-title").textContent = label || "AI proposal";
    if (!monacoDiffEd) {
      monacoDiffEd = monaco.editor.createDiffEditor(document.getElementById("diff-host"), {
        theme: MONACO_THEME_MAP[editor.getOption("theme")] || "skz-dracula",
        originalEditable: false,
        readOnly: true,
        renderSideBySide: true,
        automaticLayout: true,
        minimap: { enabled: false },
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: curFont(),
        scrollBeyondLastLine: false
      });
    }
    if (original == null) {
      document.getElementById("diff-note").textContent = "thinking…";
      return;
    }
    document.getElementById("diff-note").textContent = "green/red shows what changes — Accept applies it to your file";
    if (diffState) { try { diffState.om.dispose(); diffState.mm.dispose(); } catch (e) {} diffState = null; }
    var om = monaco.editor.createModel(original, "python");
    var mm = monaco.editor.createModel(proposed, "python");
    monacoDiffEd.setModel({ original: om, modified: mm });
    diffState = { proposed: proposed, om: om, mm: mm };
  }
  function closeDiff() {
    var ov = document.getElementById("diff-overlay");
    if (ov) ov.classList.remove("on");
    if (diffState) {
      try { diffState.om.dispose(); diffState.mm.dispose(); } catch (e) {}
      diffState = null;
    }
    if (monacoEd) monacoEd.focus();
  }
  function acceptDiff() {
    if (!diffState || !monacoEd) { closeDiff(); return; }
    var model = monacoEd.getModel();
    if (!model) { closeDiff(); return; }
    var proposed = diffState.proposed;
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text: proposed }], null);
    closeDiff();
    persistActiveFile(); saveWS(); renderTabs(); updateStatusBar();
    toast("AI edit applied ✓ — press Run to test it", "success");
  }

  /* ---- error markers + traceback tools ---- */
  function refreshMarkers() {
    if (!monacoEd || !ws || !ws.active) return;
    var model = monacoEd.getModel();
    if (!model) return;
    var monaco = window.monaco;
    var marks = [];
    function col(line) {
      try { return Math.max(2, model.getLineMaxColumn(Math.min(line, model.getLineCount()))); } catch (e) { return 2; }
    }
    problems.forEach(function (p) {
      if (p.file === ws.active && p.line) {
        marks.push({ severity: monaco.MarkerSeverity.Error, message: p.msg, startLineNumber: p.line, startColumn: 1, endLineNumber: p.line, endColumn: col(p.line) });
      }
    });
    if (lastErrorInfo && lastErrorInfo.file === ws.active && lastErrorInfo.line) {
      marks.push({ severity: monaco.MarkerSeverity.Error, message: lastErrorInfo.msg || "Runtime error", startLineNumber: lastErrorInfo.line, startColumn: 1, endLineNumber: lastErrorInfo.line, endColumn: col(lastErrorInfo.line) });
    }
    monaco.editor.setModelMarkers(model, "skillzify", marks);
  }
  function parseTracebackFrame(raw, activeFile) {
    var found = null;
    String(raw || "").split("\n").forEach(function (l) {
      var m = l.match(/File "([^"]+)", line (\d+)/);
      if (!m) return;
      if (m[1] === "<code-studio>") found = { file: activeFile, line: +m[2] };
      else if (ws && ws.files && ws.files.hasOwnProperty(m[1])) found = { file: m[1], line: +m[2] };
    });
    if (found) found.msg = simplifyTraceback(raw).split("\n").pop() || "Runtime error";
    return found;
  }
  function printTraceback(text) {
    var con = document.getElementById("console");
    var stick = conStick(con);
    String(text).split("\n").forEach(function (line) {
      var d = document.createElement("div");
      d.className = "err";
      var m = line.match(/^(.*File )"([^"]+)"(, line )(\d+)(.*)$/);
      var linkable = m && (m[2] === "<code-studio>" || (ws.files && ws.files.hasOwnProperty(m[2])));
      if (linkable) {
        var file = m[2] === "<code-studio>" ? ws.active : m[2];
        var ln = +m[4];
        d.appendChild(document.createTextNode(m[1] + '"' + m[2] + '"' + m[3]));
        var a = document.createElement("span");
        a.className = "tb-link";
        a.textContent = m[4];
        a.title = "Go to " + file + ":" + ln;
        a.addEventListener("click", function () { gotoFileLine(file, ln); });
        d.appendChild(a);
        d.appendChild(document.createTextNode(m[5] || ""));
      } else {
        d.textContent = line;
      }
      con.appendChild(d);
    });
    conSettle(con, stick);
  }
  function gotoFileLine(file, line) {
    if (file && ws.files.hasOwnProperty(file) && file !== ws.active) openFile(file);
    if (editor && line) {
      editor.setCursor({ line: line - 1, ch: 0 });
      editor.focus();
    }
  }
  function printAiFixRow() {
    if (!lastError) return;
    var con = document.getElementById("console");
    var stick = conStick(con);
    var row = document.createElement("div");
    row.className = "ai-fix-row";
    var b = document.createElement("button");
    b.className = "ai-fix-btn";
    b.textContent = "🔧 AI Fix — preview the corrected code as a diff";
    b.addEventListener("click", aiFixWithDiff);
    row.appendChild(b);
    con.appendChild(row);
    conSettle(con, stick);
  }

  /* ================= AI ================= */
  /* AI calls go through the shared client (assets/js/ai.js):
     backend -> personal key -> offline heuristic. The heuristic
     table now lives in ai.js (SkillzifyAI.explainErrorHTML). */
  /* The AI sidebar is a chat (Code Studio 2.0): every answer appends
     a message to the thread in #ai-output instead of replacing it,
     and the composer at the bottom appends the learner's questions. */
  function aiMsgEl(html, who) {
    var host = document.getElementById("ai-output");
    var d = document.createElement("div");
    d.className = "ai-msg" + (who ? " " + who : "");
    d.innerHTML = html;
    host.appendChild(d);
    host.scrollTop = host.scrollHeight;
    return d;
  }
  /* Chat persistence: the thread survives reloads (localStorage,
     capped so it can never crowd out the workspace). Only FINAL
     messages are stored — never the "Working…" placeholder. */
  var AI_CHAT_HINT = '<p style="color:var(--ide-muted)">Ask the AI to write code, explain your file, or fix an error. Runs on the site backend — no setup needed.</p>';
  function loadChatLog() {
    try { var v = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function persistAiMsg(html, who) {
    try {
      var log = loadChatLog();
      log.push({ who: who || "", html: String(html) });
      while (log.length > 40) log.shift();
      var json = JSON.stringify(log);
      while (json.length > 180000 && log.length > 1) { log.shift(); json = JSON.stringify(log); }
      localStorage.setItem(CHAT_KEY, json);
    } catch (e) {}
  }
  function restoreChat() {
    var host = document.getElementById("ai-output");
    if (!host) return;
    var log = loadChatLog();
    if (!log.length) return;
    host.innerHTML = "";
    log.forEach(function (m) {
      var d = document.createElement("div");
      d.className = "ai-msg" + (m.who ? " " + m.who : "");
      d.innerHTML = m.html;
      host.appendChild(d);
    });
    host.scrollTop = host.scrollHeight;
  }
  function clearChat() {
    try { localStorage.removeItem(CHAT_KEY); } catch (e) {}
    var host = document.getElementById("ai-output");
    if (host) host.innerHTML = AI_CHAT_HINT;
  }
  /* Adaptive quick actions: the error chips exist only while there
     is a recent run error to act on. */
  function refreshAiChips() {
    var has = !!lastError;
    ["fix-code-btn", "explain-error-btn"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.classList.toggle("chip-off", !has);
    });
  }
  function appendAiUser(text) {
    var html = '<div class="who">YOU</div><div class="ai-bubble">' + esc(text) + "</div>";
    aiMsgEl(html, "user");
    persistAiMsg(html, "user");
    switchView("ai");
  }
  function renderAi(html) { aiMsgEl(html); persistAiMsg(html); switchView("ai"); }
  // The buttons that trigger aiCall — disabled while an AI answer is in
  // flight so impatient re-clicks can't queue duplicate cap-consuming
  // requests. (Five buttons, four actions: Explain has two entry points.)
  var AI_BTN_IDS = ["ai-generate-btn", "explain-code-btn", "explain-error-btn", "fix-code-btn", "trace-code-btn"];
  function setAiButtons(disabled) {
    AI_BTN_IDS.forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.disabled = disabled;
    });
  }
  function aiCall(opts, label, onCode) {
    var AI = window.SkillzifyAI;
    if (!AI) {
      setAiButtons(false);
      renderAi("<h4>⚠️ AI unavailable</h4><p>The AI module didn't load. Your code is still runnable.</p>");
      return;
    }
    setAiButtons(true);
    var pending = aiMsgEl('<p style="color:var(--ide-muted)">🤖 Working…</p>');
    switchView("ai");
    // The backend can take ~2 min on a cold start (60s timeout + retry):
    // say so after 12s instead of leaving "Working…" frozen.
    var stageTimer = setTimeout(function () {
      pending.innerHTML = '<p style="color:var(--ide-muted)">🤖 Still working — the AI backend is slow to wake on the free tier. Hang on…</p>';
    }, 12000);
    AI.ask({
      mode: opts.mode || "",
      code: opts.code || "",
      error: opts.error || "",
      context: opts.context || "",
      extra: { note: "From Code Studio." }
    }, function (err, res) {
      clearTimeout(stageTimer);
      setAiButtons(false);
      if (err) {
        // DAILY_CAP: sign-in link only when signed out (ai.js capLink
        // returns "" for signed-in users at the 10/day cap).
        var capLink = (err.code === "DAILY_CAP" && AI.capLink) ? AI.capLink() : "";
        if (opts.error) {
          pending.innerHTML = "<h4>⚠️ AI unavailable</h4><p>" + esc(err.message || "The backend didn't answer.") + capLink + "</p>" +
            "<p class='hint'>Showing the offline explainer instead — this isn't the AI's answer.</p>" +
            AI.explainErrorHTML(opts.error);
        } else {
          pending.innerHTML = "<h4>⚠️ AI unavailable</h4><p>" + esc(err.message || "The backend didn't answer.") + capLink + "</p>";
        }
        persistAiMsg(pending.innerHTML);
        return;
      }
      var text = (res && res.text) || "";
      if (!text) {
        pending.innerHTML = opts.error ? AI.explainErrorHTML(opts.error)
          : "<h4>⚠️ AI unavailable</h4><p>Empty answer.</p>";
        persistAiMsg(pending.innerHTML);
        return;
      }
      var m = text.match(/```(?:python)?\n?([\s\S]*?)```/i);
      var code = m ? m[1].trim() : ((opts.mode === "generate" || opts.mode === "fix") ? text.trim() : null);
      // P1-8: a throwing onCode (e.g. editor.setValue with no editor)
      // used to be swallowed by ai.js safeCb BEFORE the answer rendered,
      // leaving the panel stuck on "Working…" forever. Catch it here so
      // the panel always leaves "Working…" and shows the error.
      var codeErr = null;
      if (code && onCode) {
        try { onCode(code); }
        catch (e) { codeErr = (e && e.message) || "The editor isn't available."; }
      }
      var via = res.via === "key" ? " (your key)" : res.via === "offline" ? " (offline)" : "";
      // Item 8a (round 4): repeat question served from cache — small
      // "(cached)" note beside the heading, like the "via" notes.
      if (res.cached) via += " (cached)";
      var html = "<h4>🤖 " + label + via + "</h4><p>" + esc(text).replace(/\n/g, "<br>") + "</p>";
      if (codeErr) html += "<p>⚠️ Couldn't load the code into the editor: " + esc(codeErr) + " — the code is shown above; copy it from there.</p>";
      pending.innerHTML = html;
      persistAiMsg(html);
      var host = document.getElementById("ai-output");
      if (host) host.scrollTop = host.scrollHeight;
    });
  }

  /* ================= sidebar views ================= */
  /* Sidebar open/close on small screens (P2-31): below 860px the
     sidebar is an overlay, so it needs a close button, a tap-to-close
     backdrop, and re-tapping the active icon to close it. */
  function setSidebarOpen(on) {
    var sb = document.getElementById("sidebar");
    if (sb) sb.classList.toggle("open", !!on);
    var bd = document.getElementById("sidebar-backdrop");
    if (bd) bd.classList.toggle("on", !!on && window.innerWidth <= 860);
  }
  function switchView(name) {
    var btn = document.querySelector('.activity-bar button[data-view="' + name + '"]');
    var wasActive = !!(btn && btn.classList.contains("active"));
    var sb0 = document.getElementById("sidebar");
    var wasOpen = !!(sb0 && sb0.classList.contains("open"));
    document.querySelectorAll(".activity-bar button[data-view]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === name);
    });
    document.querySelectorAll(".side-view").forEach(function (v) {
      v.classList.toggle("active", v.id === "view-" + name);
    });
    if (window.innerWidth <= 860) {
      /* Re-tapping the active icon closes the overlay instead of
         re-opening it. */
      if (wasActive && wasOpen) { setSidebarOpen(false); return; }
      setSidebarOpen(true);
    }
  }

  /* ================= samples & snippets (sidebar) ================= */
  function loadSample(key) {
    var s = SNIPPETS[key];
    if (s && ws.active && editor) {
      editor.setValue(s.code);
      persistActiveFile(); saveWS(); renderTabs(); updateStatusBar();
      toast("Sample loaded 📥", "success");
    }
  }
  function renderSamples() {
    var host = document.getElementById("sample-list");
    if (!host) return;
    host.innerHTML = Object.keys(SNIPPETS).map(function (k) {
      return '<div class="sample-item" data-sample="' + esc(k) + '"><span class="sname">' + esc(SNIPPETS[k].name) + "</span></div>";
    }).join("");
    host.querySelectorAll("[data-sample]").forEach(function (el) {
      el.addEventListener("click", function () { loadSample(el.getAttribute("data-sample")); });
    });
  }
  function snippetList() {
    var A = window.SkillzifyActivity;
    try { return (A && A.snippets) ? A.snippets() : []; } catch (e) { return []; }
  }
  function renderSnippets() {
    var host = document.getElementById("snip-list");
    if (!host) return;
    var fEl = document.getElementById("snippet-filter");
    var q = ((fEl && fEl.value) || "").trim().toLowerCase();
    var list = snippetList().filter(function (s) {
      return !q || String(s.title || "").toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) {
      host.innerHTML = '<div class="side-empty">' + (snippetList().length ? "No snippets match the filter." : "No saved snippets yet — ＋ saves the current file.") + "</div>";
      return;
    }
    host.innerHTML = list.map(function (s) {
      return '<div class="snip-item" data-snip="' + esc(s.id) + '"><span class="sname">' + esc(s.title || "Untitled") + '</span>' +
        '<span class="srow-acts"><button class="fact fdel" data-sdel="' + esc(s.id) + '" title="Delete snippet">✕</button></span></div>';
    }).join("");
    host.querySelectorAll("[data-snip]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest("[data-sdel]")) return;
        openSnippet(el.getAttribute("data-snip"));
      });
    });
    host.querySelectorAll("[data-sdel]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var A = window.SkillzifyActivity;
        var id = b.getAttribute("data-sdel");
        var snip = null;
        snippetList().forEach(function (s) { if (s.id === id) snip = s; });
        if (!A || !A.deleteSnippet) return;
        if (!confirm('Delete snippet "' + ((snip && snip.title) || "Untitled") + '"?')) return;
        A.deleteSnippet(id);
        renderSnippets();
        toast("Snippet deleted", "success");
      });
    });
  }
  /* Open a saved snippet as its own file — the same landing the
     #snippet-<id> deep link uses, so the current work is never
     clobbered. */
  function openSnippet(id) {
    var snip = null;
    snippetList().forEach(function (s) { if (s.id === id) snip = s; });
    if (!snip || !snip.code) return;
    persistActiveFile();
    var base = validName((snip.title || "snippet").replace(/[^A-Za-z0-9_\- ]/g, "").trim().replace(/\s+/g, "-").toLowerCase()) || "snippet.py";
    var fname = base, fi = 2;
    while (ws.files.hasOwnProperty(fname)) fname = base.replace(/\.py$/, "") + "-" + (fi++) + ".py";
    ws.files[fname] = snip.code;
    if (!ws.mtimes) ws.mtimes = {};
    ws.mtimes[fname] = Date.now();
    if (ws.deleted) delete ws.deleted[fname];
    if (ws.tabs.indexOf(fname) < 0) ws.tabs.push(fname);
    ws.active = fname;
    if (editor) editor.setValue(snip.code);
    saveWS(); renderExplorer(); renderTabs(); updateStatusBar();
    toast("Snippet loaded 📝", "success");
  }
  function initSnippets() {
    renderSamples();
    renderSnippets();
    var sf = document.getElementById("snippet-filter");
    if (sf) sf.addEventListener("input", function () { renderSnippets(); });
    var of = document.getElementById("outline-filter");
    if (of) of.addEventListener("input", function () { outlineFilter = of.value; renderOutline(); });
    document.getElementById("save-snippet-btn").addEventListener("click", function () {
      var A = window.SkillzifyActivity; if (!A || !ws.active) return;
      var code = ws.files[ws.active].trim();
      if (!code) { toast("Nothing to save", "error"); return; }
      var title = prompt("Name this snippet:", ws.active);
      if (title == null) return;
      A.saveSnippet(title.trim() || ws.active, "", code);
      renderSnippets();
      toast("Snippet saved 📝", "success");
    });
  }

  /* ================= sidebar accordion sections =================
     Collapsed state persists across reloads (SEC_KEY). Clicking a
     section header toggles it; the header's action buttons don't. */
  function initSideSections() {
    var state = {};
    try { state = JSON.parse(localStorage.getItem(SEC_KEY) || "{}") || {}; } catch (e) {}
    document.querySelectorAll(".side-sec-head").forEach(function (head) {
      var sec = null;
      if (head.closest) sec = head.closest(".side-sec");
      else { var p = head.parentElement; while (p && !(p.classList && p.classList.contains("side-sec"))) p = p.parentElement; sec = p; }
      var key = head.getAttribute("data-sec");
      if (!sec || !key) return;
      if (state[key]) { sec.classList.add("collapsed"); head.setAttribute("aria-expanded", "false"); }
      head.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest(".sec-act")) return;
        var now = sec.classList.toggle("collapsed");
        head.setAttribute("aria-expanded", now ? "false" : "true");
        try {
          var s2 = JSON.parse(localStorage.getItem(SEC_KEY) || "{}") || {};
          s2[key] = now;
          localStorage.setItem(SEC_KEY, JSON.stringify(s2));
        } catch (e2) {}
      });
    });
  }

  /* ================= init ================= */
  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("ide")) return;
    ws = loadWS();
    var shared = loadSharedWS();
    try {
      var handed = localStorage.getItem("skillzify_compiler_code");
      if (handed) {
        if (!shared && ws.files["main.py"] === DEFAULT_CODE) {
          // untouched default: the lesson code takes its place, as before
          ws.files["main.py"] = handed;
          if (ws.tabs.indexOf("main.py") < 0) ws.tabs.unshift("main.py");
          ws.active = "main.py";
        } else {
          // P2-67: a share link (#ws=) is present too, or main.py holds
          // the user's own code — open the handed code as its own file
          // instead of silently dropping it (mirrors lesson.py).
          var ln = "lesson.py", li = 2;
          while (ws.files.hasOwnProperty(ln)) ln = "lesson" + (li++) + ".py";
          ws.files[ln] = handed;
          ws.tabs.push(ln); ws.active = ln;
          if (shared) toast("Share link opened — the handed code was added as " + ln, "success");
        }
        if (!ws.mtimes) ws.mtimes = {};
        ws.mtimes[ws.active] = Date.now();
        if (ws.deleted) delete ws.deleted[ws.active];
        saveWS();
        localStorage.removeItem("skillzify_compiler_code");
      }
    } catch (e) {}

    /* P2-72: every wiring section below runs inside guard(), so one
       throw (a missing element, a failed render) can't abort the
       rest of init — the Run and Stuck? buttons must survive an
       early failure. Failures are logged, never silent. */
    function guard(label, fn) {
      try { fn(); } catch (e) {
        try { console.warn("[compiler] init section failed: " + label, e && e.message ? e.message : e); } catch (e2) {}
      }
    }

    guard("editor", function () {
    var theme0 = "dracula", font0 = 14;
    try {
      theme0 = localStorage.getItem(CM_THEME_KEY) || "dracula";
      font0 = parseInt(localStorage.getItem(CM_FONT_KEY) || "14", 10) || 14;
    } catch (e) {}
    function wireEditor() {
      editor.addKeyMap({ "Ctrl-Enter": runCode, "Cmd-Enter": runCode });
      // keep the welcome overlay above the editor surface
      var wel = document.getElementById("welcome");
      if (wel) document.getElementById("editor-host").appendChild(wel);
      applyTheme(theme0);
      applyFont(font0);
      editor.on("cursorActivity", updateStatusBar);
      editor.on("change", function () { updateStatusBar(); markUnsaved(); });
      // auto-save workspace as they type (debounced)
      var saveT = null;
      editor.on("change", function () {
        clearTimeout(saveT);
        saveT = setTimeout(function () { persistActiveFile(); saveWS(); }, 800);
      });
      // live problems: re-run the syntax check shortly after typing
      // stops (only once the runtime exists — checkProblems without
      // it would just report "still loading").
      var liveT = null;
      editor.on("change", function () {
        clearTimeout(liveT);
        liveT = setTimeout(function () {
          if (pyodide && ws.active) { persistActiveFile(); checkProblems(true); }
        }, 900);
      });
      // outline: refresh shortly after typing stops; track the
      // symbol containing the cursor on every cursor move.
      var olT = null;
      editor.on("change", function () {
        clearTimeout(olT);
        olT = setTimeout(function () { try { renderOutline(); } catch (e) {} }, 450);
      });
      editor.on("cursorActivity", function () { updateOutlineCursor(); });
    }
    function useFallback() {
      // P1-7: the editor CDN failed — say so LOUDLY and fall back to a
      // plain <textarea> editor so code can still be typed and run.
      if (editor) return; // Monaco arrived after all — never double-mount
      editor = makeFallbackEditor(document.getElementById("editor-host"), ws.active ? ws.files[ws.active] : "");
      editor.on("cursorActivity", updateStatusBar);
      editor.on("change", function () { updateStatusBar(); markUnsaved(); });
      var saveT = null;
      editor.on("change", function () {
        clearTimeout(saveT);
        saveT = setTimeout(function () { persistActiveFile(); saveWS(); }, 800);
      });
      printLine("⚠ Code editor failed to load (Monaco CDN unreachable) — plain-text editor active. Code still runs.", "err");
      try { toast("Code editor failed to load — using plain-text editor", "error"); } catch (e) {}
      // P2-59: the stored theme / font size apply to the fallback
      // textarea too, via its setOption (theme/fontSize).
      try { applyTheme(localStorage.getItem(CM_THEME_KEY) || "dracula"); } catch (e) {}
      try { applyFont(parseInt(localStorage.getItem(CM_FONT_KEY) || "14", 10) || 14); } catch (e) {}
    }
    if (window.SKZ_MONACO_VS && typeof window.require === "function") {
      initMonacoEditor(theme0, font0, wireEditor, useFallback);
    } else {
      useFallback();
    }
    });

    guard("render", function () {
    renderExplorer(); renderTabs(); renderHistory(); updateStatusBar();
    initSnippets();
    initSideSections();
    });

    guard("activity-bar", function () {
    /* activity bar */
    document.querySelectorAll(".activity-bar button[data-view]").forEach(function (b) {
      b.addEventListener("click", function () { switchView(b.getAttribute("data-view")); });
    });
    /* mobile sidebar close (P2-31): ✕ button + tap the backdrop */
    var scb = document.getElementById("sidebar-close-btn");
    if (scb) scb.addEventListener("click", function () { setSidebarOpen(false); });
    var sbd = document.getElementById("sidebar-backdrop");
    if (sbd) sbd.addEventListener("click", function () { setSidebarOpen(false); });
    /* problems badge button: jumps to the panel's Problems tab,
       unhiding the panel first if it was hidden */
    var apb = document.getElementById("activity-problems");
    if (apb) apb.addEventListener("click", function () { setPanelHidden(false); switchPtab("problems"); });
    });

    guard("panel-tabs", function () {
    /* panel tabs */
    document.querySelectorAll(".ptab").forEach(function (b) {
      b.addEventListener("click", function () { switchPtab(b.getAttribute("data-ptab")); });
    });
    });

    guard("run-stop", function () {
    /* run / stop */
    document.getElementById("run-btn").addEventListener("click", runCode);
    document.getElementById("st-run").addEventListener("click", runCode);
    document.getElementById("stop-btn").addEventListener("click", stopRun);
    var stuckBtn = document.getElementById("stuck-btn");
    if (stuckBtn) stuckBtn.addEventListener("click", function () {
      var code = "";
      try { code = (ws.files && ws.active && ws.files[ws.active]) || ""; } catch (e) {}
      try { localStorage.setItem("skillzify_community_draft", JSON.stringify({ code: code, error: lastError || "" })); } catch (e) {}
      location.href = "community.html?ask=1";
    });
    });

    guard("files", function () {
    /* files */
    document.getElementById("new-file-btn").addEventListener("click", newFile);
    document.getElementById("welcome-new").addEventListener("click", newFile);
    document.getElementById("share-btn").addEventListener("click", shareCode);
    document.getElementById("download-btn").addEventListener("click", downloadCode);
    document.getElementById("upload-btn").addEventListener("click", function () { document.getElementById("upload-input").click(); });
    /* One import path for the file picker AND drag-and-drop. */
    function importFile(f) {
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var name = validName(f.name.replace(/\.[^.]+$/, "")) || "uploaded.py";
        var base = name, i = 2;
        while (ws.files.hasOwnProperty(base)) base = name.replace(/\.py$/, i++ + ".py");
        persistActiveFile();
        ws.files[base] = String(r.result || "");
        if (!ws.mtimes) ws.mtimes = {};
        ws.mtimes[base] = Date.now();
        if (ws.deleted) delete ws.deleted[base];
        ws.tabs.push(base); ws.active = base;
        if (editor) editor.setValue(ws.files[base]);
        saveWS(); renderExplorer(); renderTabs(); updateStatusBar();
        toast("Imported " + base + " 📂", "success");
      };
      r.readAsText(f);
    }
    document.getElementById("upload-input").addEventListener("change", function () {
      importFile(this.files[0]);
      this.value = "";
    });
    /* Drag .py files onto the IDE to import them into the workspace. */
    var ideEl = document.getElementById("ide");
    var sbEl = document.getElementById("sidebar");
    if (ideEl) {
      ideEl.addEventListener("dragover", function (e) {
        e.preventDefault();
        if (sbEl) sbEl.classList.add("drag-over");
      });
      ideEl.addEventListener("dragleave", function (e) {
        if (e.relatedTarget && ideEl.contains(e.relatedTarget)) return;
        if (sbEl) sbEl.classList.remove("drag-over");
      });
      ideEl.addEventListener("drop", function (e) {
        e.preventDefault();
        if (sbEl) sbEl.classList.remove("drag-over");
        var files = (e.dataTransfer && e.dataTransfer.files) || [];
        var n = 0;
        for (var i = 0; i < files.length; i++) {
          if (/\.py$/i.test(files[i].name)) { importFile(files[i]); n++; }
        }
        if (!n && files.length) toast("Only .py files can be imported", "error");
      });
    }
    document.getElementById("reset-ws-btn").addEventListener("click", function () {
      if (!confirm("Reset workspace? All files will be replaced with a fresh main.py.")) return;
      backupWorkspace();
      /* Tombstone every pre-reset file (except the fresh main.py) so
         the sync merge can't resurrect them from another device (P2-32). */
      var now = Date.now();
      var del = {};
      Object.keys(ws.files || {}).forEach(function (n) { if (n !== "main.py") del[n] = now; });
      ws = { files: { "main.py": DEFAULT_CODE }, tabs: ["main.py"], active: "main.py", mtimes: { "main.py": now }, deleted: del };
      saveWS();
      if (editor) editor.setValue(ws.files["main.py"]);
      renderExplorer(); renderTabs(); updateStatusBar();
    });
    });

    guard("find", function () {
    /* find — Monaco has VS Code's own find widget; the page findbar
       remains the fallback editor's find/replace. */
    document.getElementById("find-btn").addEventListener("click", function () {
      if (monacoEd) {
        monacoEd.focus();
        var a = monacoEd.getAction("actions.find");
        if (a) { a.run(); return; }
      }
      openFind(false);
    });
    document.getElementById("find-close").addEventListener("click", closeFind);
    document.getElementById("find-next").addEventListener("click", function () { doFind(1); });
    document.getElementById("find-prev").addEventListener("click", function () { doFind(-1); });
    document.getElementById("find-input").addEventListener("input", function () { findState.query = ""; doFind(1); });
    document.getElementById("find-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); doFind(e.shiftKey ? -1 : 1); }
      if (e.key === "Escape") closeFind();
    });
    document.getElementById("replace-one").addEventListener("click", function () { doReplace(false); });
    document.getElementById("replace-all").addEventListener("click", function () { doReplace(true); });
    });

    guard("terminal", function () {
    /* terminal panel */
    var rkBtn = document.getElementById("restart-kernel-btn");
    if (rkBtn) rkBtn.addEventListener("click", restartKernel);
    document.getElementById("copy-out-btn").addEventListener("click", copyOutput);
    document.getElementById("clear-out-btn").addEventListener("click", function () { clearTerminal(); printLine("Terminal cleared.", "dim"); });
    /* smart-scroll pill: click jumps to the latest output; scrolling
       back to the bottom by hand dismisses it */
    var tj = document.getElementById("term-jump");
    var conEl = document.getElementById("console");
    if (tj && conEl) {
      tj.addEventListener("click", function () { conEl.scrollTop = conEl.scrollHeight; tj.classList.add("chip-off"); });
      conEl.addEventListener("scroll", function () {
        if (conEl.scrollHeight - conEl.scrollTop - conEl.clientHeight < 48) tj.classList.add("chip-off");
      });
    }
    document.getElementById("panel-toggle").addEventListener("click", function () {
      var p = document.getElementById("panel");
      p.style.height = p.style.height === "60%" ? "" : "60%";
    });
    /* hide / unhide the console panel: the header ✕ hides it, the
       status-bar toggle (always visible) flips it, and Ctrl+` toggles
       from anywhere — all through setPanelHidden. */
    var phb = document.getElementById("panel-hide-btn");
    if (phb) phb.addEventListener("click", function () { setPanelHidden(true); });
    var ptv = document.getElementById("panel-toggle-vis");
    if (ptv) ptv.addEventListener("click", function () { setPanelHidden(!panelHidden()); });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") { e.preventDefault(); setPanelHidden(!panelHidden()); }
    });
    /* restore the persisted visibility choice */
    try { if (localStorage.getItem(PANEL_HIDDEN_KEY) === "1") setPanelHidden(true); } catch (e) {}
    /* problems check */
    document.getElementById("st-check").addEventListener("click", function () { checkProblems(false); });
    /* search */
    var sIn = document.getElementById("search-input");
    var sT = null;
    sIn.addEventListener("input", function () { clearTimeout(sT); sT = setTimeout(function () { searchFiles(sIn.value); }, 250); });
    });

    guard("ai", function () {
    /* AI */
    try { restoreChat(); } catch (e) {}
    refreshAiChips();
    var clearBtn = document.getElementById("ai-clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", function () { clearChat(); toast("Chat cleared", "success"); });
    document.getElementById("ai-generate-btn").addEventListener("click", function () {
      var d = prompt("Describe what you want the code to do:", "a function that checks if a number is prime");
      if (d == null || !d.trim()) return;
      aiCall({ mode: "generate", code: d.trim() }, "generated", function (code) {
        if (!ws.active) return;
        if (!editor) throw new Error("The code editor didn't load, so the generated code couldn't be placed in the editor.");
        editor.setValue(code); persistActiveFile(); saveWS(); renderTabs(); updateStatusBar();
        toast("Code generated ✨ — review it, then Run", "success");
      });
    });
    document.getElementById("explain-code-btn").addEventListener("click", function () {
      if (!ws.active) return;
      persistActiveFile();
      aiCall({ mode: "", code: ws.files[ws.active], error: "" }, "explanation", null);
    });
    document.getElementById("explain-error-btn").addEventListener("click", function () {
      if (!lastError) { renderAi('<p style="color:var(--ide-muted)">Run some code first — when it errors, I\'ll explain it here.</p>'); switchView("ai"); return; }
      persistActiveFile();
      aiCall({ mode: "", code: ws.files[ws.active] || "", error: lastError }, "explanation", null);
    });
    document.getElementById("fix-code-btn").addEventListener("click", function () {
      if (!lastError || !ws.active) { renderAi('<p style="color:var(--ide-muted)">Run some code first — when it errors, I\'ll fix it here.</p>'); switchView("ai"); return; }
      persistActiveFile();
      aiCall({ mode: "fix", code: ws.files[ws.active], error: lastError }, "fix", function (code) {
        if (!editor) throw new Error("The code editor didn't load, so the fixed code couldn't be placed in the editor.");
        editor.setValue(code); persistActiveFile(); saveWS(); renderTabs(); updateStatusBar();
        toast("Fixed code loaded 🔧 — press Run to verify", "success");
      });
    });
    document.getElementById("trace-code-btn").addEventListener("click", function () {
      if (!ws.active || !(ws.files[ws.active] || "").trim()) { renderAi('<p style="color:var(--ide-muted)">Write or load some code first — then I\'ll walk through it.</p>'); switchView("ai"); return; }
      persistActiveFile();
      aiCall({ mode: "trace", code: ws.files[ws.active], error: lastError || "" }, "trace", null);
    });
    /* P2-69: the Gemini key is a billable credential. "Remember" is an
       opt-in toggle (default ON = today's behaviour: the key is stored
       in this browser). When it is OFF the key lives only in memory
       (memAiKey) for this page session and is never written to
       storage. ai.js reads the key through window.Skillzify.storeGet
       at call time, so a small wrapper answers that one key from
       memory while a session-only key is held; every other key passes
       through untouched. The preference itself is stored, not the
       key. (skillzify_ai_key is still wiped on logout, P1-26.) */
    var AI_KEY_REMEMBER = "skillzify_ai_key_remember";
    var memAiKey = null;
    function aiKeyRemembered() {
      try {
        var chk = document.getElementById("ai-remember");
        if (chk) return chk.checked !== false;
      } catch (e) {}
      try { return window.Skillzify.storeGet(AI_KEY_REMEMBER, "1") !== "0"; } catch (e) { return true; }
    }
    (function () {
      try {
        var S = window.Skillzify;
        if (!S || typeof S.storeGet !== "function" || S.__aiKeyMemHook) return;
        var origGet = S.storeGet;
        S.storeGet = function (k, fb) {
          if (k === AI_KEY && memAiKey) return memAiKey;
          return origGet(k, fb);
        };
        S.__aiKeyMemHook = true;
      } catch (e) {}
    })();
    document.getElementById("ai-save").addEventListener("click", function () {
      try {
        var v = document.getElementById("ai-key").value.trim();
        if (aiKeyRemembered()) {
          memAiKey = null;
          window.Skillzify.storeSet(AI_KEY, v);
          toast(v ? "API key saved in this browser 🔑" : "API key removed", "success");
        } else {
          memAiKey = v || null;
          try { window.Skillzify.storeSet(AI_KEY, ""); } catch (e2) {}
          toast(v ? "API key kept for this session only — it won't be stored 🔑" : "API key removed", "success");
        }
      } catch (e) {}
    });
    /* The toggle itself: initialise from the stored preference, and
       move the key between storage and memory immediately on change. */
    (function () {
      var rem = document.getElementById("ai-remember");
      if (!rem) return;
      try { rem.checked = window.Skillzify.storeGet(AI_KEY_REMEMBER, "1") !== "0"; } catch (e) {}
      rem.addEventListener("change", function () {
        try { window.Skillzify.storeSet(AI_KEY_REMEMBER, rem.checked ? "1" : "0"); } catch (e) {}
        try {
          if (rem.checked) {
            if (memAiKey) { window.Skillzify.storeSet(AI_KEY, memAiKey); memAiKey = null; }
          } else {
            var stored = window.Skillzify.storeGet(AI_KEY, "");
            if (stored) memAiKey = stored;
            window.Skillzify.storeSet(AI_KEY, "");
          }
        } catch (e) {}
      });
    })();
    try { document.getElementById("ai-key").value = memAiKey || window.Skillzify.storeGet(AI_KEY, ""); } catch (e) {}
    /* AI chat composer: free-form questions about the open file. The
       "explain" mode takes its instruction in `context` (the server
       composes context + CODE), so the question rides there. */
    function chatSend() {
      var inp = document.getElementById("ai-chat-input");
      var q = ((inp && inp.value) || "").trim();
      if (!q) return;
      inp.value = "";
      appendAiUser(q);
      if (!ws.active) { renderAi("<p>Open a file first so the AI can see your code.</p>"); return; }
      persistActiveFile();
      aiCall({
        mode: "explain", code: ws.files[ws.active],
        context: "The student asks: " + q + "\nAnswer about the code in the CODE block in plain, beginner-friendly words. If they ask for code, put it in a single ```python fenced block."
      }, "answer", null);
    }
    var csb = document.getElementById("ai-chat-send");
    if (csb) csb.addEventListener("click", chatSend);
    var csi = document.getElementById("ai-chat-input");
    if (csi) csi.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); chatSend(); }
    });
    });

    guard("settings", function () {
    /* settings */
    document.getElementById("theme-select").addEventListener("change", function () { applyTheme(this.value); });
    document.querySelectorAll(".swatch").forEach(function (s) {
      s.addEventListener("click", function () { applyTheme(s.getAttribute("data-theme-val")); });
    });
    document.getElementById("st-theme").addEventListener("click", function () { switchView("settings"); });
    document.getElementById("fs-up").addEventListener("click", function () { applyFont(curFont() + 1); });
    document.getElementById("fs-down").addEventListener("click", function () { applyFont(curFont() - 1); });
    var fsRange = document.getElementById("fs-range");
    if (fsRange) {
      fsRange.value = curFont();
      fsRange.addEventListener("input", function () { applyFont(+fsRange.value); });
    }
    var tsSel = document.getElementById("tabsize-select");
    if (tsSel) {
      tsSel.value = String(curTabSize());
      tsSel.addEventListener("change", function () { applyTabSize(+tsSel.value); });
    }
    var stTab = document.getElementById("st-tabsize");
    if (stTab) stTab.textContent = "Spaces: " + curTabSize();
    document.getElementById("wrap-btn").addEventListener("click", function () {
      if (!editor) return;
      var on = !editor.getOption("lineWrapping");
      editor.setOption("lineWrapping", on);
      this.textContent = "Wrap: " + (on ? "on" : "off");
      this.classList.toggle("on", on);
    });
    var mmBtn = document.getElementById("minimap-btn");
    if (mmBtn) {
      mmBtn.textContent = "Minimap: " + (minimapOn() ? "on" : "off");
      mmBtn.classList.toggle("on", minimapOn());
      mmBtn.addEventListener("click", function () {
        var on = !minimapOn();
        try { localStorage.setItem("skillzify_minimap", on ? "1" : "0"); } catch (e) {}
        this.textContent = "Minimap: " + (on ? "on" : "off");
        this.classList.toggle("on", on);
        if (editor) { try { editor.setOption("minimap", on); } catch (e) {} }
      });
    }
    renderPackages();
    });

    guard("resize", function () {
    /* sidebar resize + persisted width (Code Studio 2.0). The bottom
       panel is fixed-height in CSS — its drag-resize and persisted
       height were retired on 15 Nov 2026. */
    (function () {
      var sb = document.getElementById("sidebar");
      try {
        var sw = parseInt(localStorage.getItem("skillzify_side_w") || "", 10);
        if (sb && sw >= 180 && sw <= 520) sb.style.width = sw + "px";
      } catch (e) {}
      var handle = document.getElementById("sidebar-resize");
      if (!handle || !sb) return;
      var dragging = false;
      handle.addEventListener("pointerdown", function (e) {
        dragging = true;
        try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      handle.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var ide = document.getElementById("ide");
        var rect = ide.getBoundingClientRect();
        var w = Math.max(180, Math.min(520, e.clientX - rect.left - 53));
        sb.style.width = w + "px";
        try { localStorage.setItem("skillzify_side_w", String(Math.round(w))); } catch (err) {}
      });
      function end() { dragging = false; }
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    })();
    });

    guard("keyboard", function () {
    /* keyboard */
    document.addEventListener("keydown", function (e) {
      var mod = e.ctrlKey || e.metaKey;
      // Inside Monaco, Ctrl+F / Ctrl+H belong to Monaco's own find
      // widget — don't fight it with the page findbar.
      var inMonaco = !!(monacoEd && e.target && e.target.closest && e.target.closest(".monaco-editor"));
      if (mod && e.key.toLowerCase() === "f" && !e.shiftKey) {
        if (inMonaco) return;
        e.preventDefault();
        if (monacoEd) {
          monacoEd.focus();
          var fa = monacoEd.getAction("actions.find");
          if (fa) { fa.run(); return; }
        }
        openFind(false);
      }
      else if (mod && e.key.toLowerCase() === "h") {
        if (inMonaco) return;
        e.preventDefault();
        if (monacoEd) {
          monacoEd.focus();
          var ra = monacoEd.getAction("editor.action.startFindReplaceAction") || monacoEd.getAction("actions.find");
          if (ra) { ra.run(); return; }
        }
        openFind(true);
      }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); persistActiveFile(); if (saveWS()) toast("Workspace saved 💾", "success"); }
      else if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); var sb = document.getElementById("sidebar"); setSidebarOpen(!sb.classList.contains("open")); }
      else if (e.key === "Escape") { closeFind(); setSidebarOpen(false); }
    });
    });

    guard("exit", function () {
    /* save on exit: never lose the last keystrokes inside the autosave window */
    window.addEventListener("beforeunload", function () { persistActiveFile(); saveWS(); });
    /* remote workspace: a newer copy from another device arrives via sync */
    window.addEventListener("skillzify-sync", applyRemoteWorkspace);
    /* restore button (Settings -> Workspace) */
    var rb = document.getElementById("restore-ws-btn");
    if (rb) rb.addEventListener("click", restoreBackupWS);
    updateRestoreButton();
    updateSaveUI(true);
    });

    guard("warmup", function () {
    /* warm the AI backend + load runtime (via the shared client) */
    try {
      if (window.SkillzifyAI && window.SkillzifyAI.warmup) window.SkillzifyAI.warmup();
      else fetch("api/health", { method: "GET", cache: "no-store" }).catch(function () {});
    } catch (e) {}
    setRunUI(false); // P1-9: Run + Check start disabled until Pyodide is ready
    loadPyodideRuntime();
    });
  });
})();
