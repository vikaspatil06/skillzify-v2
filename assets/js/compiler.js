/* ============================================================
   Skillzify v2 — compiler.js (Code Studio)
   VS Code-like Python IDE:
   - multi-file workspace (localStorage) with tabs + explorer
   - Pyodide execution (all files visible to imports)
   - terminal / problems / output-history panel
   - search across files, find/replace, code history
   - AI Generate / Explain / Fix via backend
   ============================================================ */
(function () {
  "use strict";

  var WS_KEY = "skillzify_ws";
  var RUNS_KEY = "skillzify_runs";
  var HIST_KEY = "skillzify_code_history";
  var AI_KEY = "skillzify_ai_key";
  var CM_THEME_KEY = "skillzify_cm_theme";
  var CM_FONT_KEY = "skillzify_cm_font";

  var pyodide = null;
  var pyodideLoading = false; // guards double-load + retry (P2-35)
  var editor = null;
  var ws = null;               // {files:{}, tabs:[], active}
  var lastError = "";
  var runToken = 0;
  var RUN_TIMEOUT_MS = 15000;
  var outHistory = [];
  var problems = [];

  /* Panel height clamp — the terminal may only grow by dragging (or the
     maximize toggle) and must never push the status bar off-screen.
     Reserve = tab bar (~36) + breadcrumbs (~27) + editor min-height
     (200) + resize handle (5) + status bar (28) + slack (~24) = 320px.
     The same 320px reserve is the CSS max-height on .panel, so the
     maximize toggle is capped by the same budget. */
  function clampPanelHeight(h, colH) {
    return Math.max(120, Math.min(colH - 320, h));
  }

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
      var tab = document.querySelector('.tab[data-tab="' + ws.active + '"]');
      if (tab) tab.classList.toggle("dirty", !!(editor && editor.getValue() !== ws.files[ws.active]));
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
    var names = Object.keys(ws.files).sort();
    host.innerHTML = names.map(function (n) {
      return '<div class="file-item' + (n === ws.active ? " active" : "") + '" data-file="' + esc(n) + '">' +
        '<span>🐍</span><span class="fname">' + esc(n) + '</span>' +
        '<button class="fdel" data-del="' + esc(n) + '" title="Delete">✕</button></div>';
    }).join("");
    host.querySelectorAll(".file-item").forEach(function (el) {
      el.addEventListener("click", function (e) {
        if (e.target.hasAttribute("data-del")) return;
        openFile(el.getAttribute("data-file"));
      });
    });
    host.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteFile(b.getAttribute("data-del"));
      });
    });
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
  }

  function openFile(name) {
    if (!ws.files.hasOwnProperty(name)) return;
    persistActiveFile();
    ws.active = name;
    if (ws.tabs.indexOf(name) < 0) ws.tabs.push(name);
    if (editor) { editor.setValue(ws.files[name]); editor.focus(); }
    saveWS(); renderExplorer(); renderTabs(); updateStatusBar();
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
     Plain <textarea> editor with the CodeMirror-shaped API the rest
     of compiler.js uses, so code can still be typed, searched and run
     when the CodeMirror CDN fails (editor == null otherwise leaves a
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
      setOption: function (k, v) { opts[k] = v; if (k === "lineWrapping") { try { ta.style.whiteSpace = v ? "pre-wrap" : "pre"; } catch (e) {} } },
      getOption: function (k) { return opts[k]; },
      refresh: function () {},
      on: function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
      addKeyMap: function () {}
    };
  }

  /* ================= helpers ================= */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function toast(m, k) { if (window.Skillzify) window.Skillzify.toast(m, k); }
  function currentCode() { return editor ? editor.getValue() : ""; }

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
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
    s.onload = function () {
      window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" }).then(function (py) {
        pyodide = py;
        pyodideLoading = false;
        printLine("✅ Python 3.11 ready (Pyodide). Press ▶ Run.", "dim");
        setRunUI(false);
        checkProblems(true);
      }).catch(function (e) {
        pyodideLoading = false;
        printLine("❌ Could not load the Python runtime. Check your connection and reload.", "err");
      });
    };
    s.onerror = function () { pyodideLoading = false; printLine("❌ Could not download Pyodide — internet required.", "err"); };
    document.head.appendChild(s);
  }

  /* ================= interactive stdin bridge =================
     Python's input() is AST-rewritten to await __skillzify_input(),
     which awaits a JS Promise. The terminal shows an inline prompt
     and resolves the promise when the user presses Enter. */
  var stdinResolver = null;
  var runOut = [];        // batched stdout of the active run
  var killTimer = null;

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

  function restartKillTimer() {
    if (killTimer) clearTimeout(killTimer);
    var my = runToken;
    killTimer = setTimeout(function () {
      if (my !== runToken) return;
      runToken++;
      cancelStdin();
      drainOut();
      printLine("⏱ Stopped: ran over 15s with no output — likely an infinite loop.", "err");
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
  function printLine(text, cls) {
    var con = document.getElementById("console");
    var d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = text;
    con.appendChild(d);
    con.scrollTop = con.scrollHeight;
  }
  function clearTerminal() { document.getElementById("console").innerHTML = ""; }
  function copyOutput() {
    var t = document.getElementById("console").innerText;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("Terminal output copied 📋", "success"); });
  }
  function makeStdin(lines) {
    var text = lines.join("\n") + (lines.length ? "\n" : "");
    var i = 0;
    return { stdin: function () { return i >= text.length ? null : text.charCodeAt(i++); } };
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
    printLine("$ python " + ws.active, "dim");

    // make every workspace file importable
    try {
      Object.keys(ws.files).forEach(function (n) {
        try { pyodide.FS.writeFile(n, ws.files[n]); } catch (e) {}
      });
    } catch (e) {}

    runOut = [];
    pyodide.setStdout({ batched: function (s) { runOut.push(s); } });
    pyodide.setStderr({ batched: function (s) { runOut.push(s); } });
    // sys.stdin reads (not via input()) get immediate EOF; input() is interactive
    try { pyodide.setStdin({ stdin: function () { return null; } }); } catch (e) {}

    var my = ++runToken;
    var t0 = performance.now();
    restartKillTimer();

    var p;
    try {
      // replacer FUNCTION: user code may contain $& / $' which replace() would otherwise interpret
      var src = BOOTSTRAP.replace("__USER_CODE__", function () { return JSON.stringify(code); });
      p = pyodide.runPythonAsync(src);
    } catch (e) { p = Promise.reject(e); }
    p.then(function () {
      if (my !== runToken) return;
      clearKillTimer();
      cancelStdin();
      var ms = Math.round(performance.now() - t0);
      drainOut();
      printLine("✅ Finished in " + ms + " ms", "ok-meta");
      lastError = "";
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
      var short = simplifyTraceback(String((e && e.message) || e));
      drainOut();
      printLine(short, "err");
      printLine("❌ Error after " + ms + " ms — see PROBLEMS or ask AI →", "err");
      lastError = short;
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
    if (!silent) switchPtab("problems");
    return problems;
  }
  function renderProblems() {
    var badge = document.getElementById("prob-badge");
    var btn = document.getElementById("st-check");
    badge.style.display = problems.length ? "" : "none";
    badge.textContent = problems.length;
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

  /* ================= search across files ================= */
  function searchFiles(q) {
    var host = document.getElementById("search-results");
    q = (q || "").trim();
    if (!q) { host.innerHTML = ""; return; }
    var ql = q.toLowerCase(), hits = [];
    Object.keys(ws.files).forEach(function (name) {
      ws.files[name].split("\n").forEach(function (line, i) {
        if (line.toLowerCase().indexOf(ql) >= 0) hits.push({ f: name, l: i + 1, t: line.trim().slice(0, 80) });
      });
    });
    host.innerHTML = hits.length
      ? hits.slice(0, 100).map(function (h) {
          return '<div class="search-hit" data-f="' + esc(h.f) + '" data-l="' + h.l + '">' +
            '<div class="sf">' + esc(h.f) + '</div><div class="sl">line ' + h.l + ': ' + esc(h.t) + '</div></div>';
        }).join("")
      : '<div class="empty-note">No matches for "' + esc(q) + '"</div>';
    host.querySelectorAll(".search-hit").forEach(function (el) {
      el.addEventListener("click", function () {
        openFile(el.getAttribute("data-f"));
        var ln = +el.getAttribute("data-l") - 1;
        if (editor) { editor.setCursor({ line: ln, ch: 0 }); editor.focus(); }
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
  function updateStatusBar() {
    if (!editor) return;
    var c = editor.getCursor();
    document.getElementById("st-pos").textContent = "Ln " + (c.line + 1) + ", Col " + (c.ch + 1);
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
    var st = document.getElementById("st-theme");
    if (st) st.textContent = t.charAt(0).toUpperCase() + t.slice(1).replace("-darker", "");
  }
  function applyFont(px) {
    px = Math.max(10, Math.min(24, px));
    var cm = document.querySelector("#editor-host .CodeMirror");
    if (cm) cm.style.fontSize = px + "px";
    if (editor) editor.refresh();
    try { localStorage.setItem(CM_FONT_KEY, String(px)); } catch (e) {}
    var fv = document.getElementById("fs-val");
    if (fv) fv.textContent = px + "px";
  }
  function curFont() {
    try { return parseInt(localStorage.getItem(CM_FONT_KEY) || "14", 10) || 14; } catch (e) { return 14; }
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

  /* ================= AI ================= */
  /* AI calls go through the shared client (assets/js/ai.js):
     backend -> personal key -> offline heuristic. The heuristic
     table now lives in ai.js (SkillzifyAI.explainErrorHTML). */
  function renderAi(html) { document.getElementById("ai-output").innerHTML = html; switchView("ai"); }
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
    renderAi('<p style="color:var(--ide-muted)">🤖 Working…</p>');
    // The backend can take ~2 min on a cold start (60s timeout + retry):
    // say so after 12s instead of leaving "Working…" frozen.
    var stageTimer = setTimeout(function () {
      // Update the waiting text without yanking the user into the AI
      // panel: refresh the stored text always, but only switch views
      // if the AI panel is already the one on screen.
      document.getElementById("ai-output").innerHTML = '<p style="color:var(--ide-muted)">🤖 Still working — the AI backend is slow to wake on the free tier. Hang on…</p>';
      var aiView = document.getElementById("view-ai");
      if (aiView && aiView.classList.contains("active")) switchView("ai");
    }, 12000);
    AI.ask({
      mode: opts.mode || "",
      code: opts.code || "",
      error: opts.error || "",
      extra: { note: "From Code Studio." }
    }, function (err, res) {
      clearTimeout(stageTimer);
      setAiButtons(false);
      if (err) {
        // DAILY_CAP: sign-in link only when signed out (ai.js capLink
        // returns "" for signed-in users at the 50/day cap).
        var capLink = (err.code === "DAILY_CAP" && AI.capLink) ? AI.capLink() : "";
        if (opts.error) {
          renderAi("<h4>⚠️ AI unavailable</h4><p>" + esc(err.message || "The backend didn't answer.") + capLink + "</p>" +
            "<p class='hint'>Showing the offline explainer instead — this isn't the AI's answer.</p>" +
            AI.explainErrorHTML(opts.error));
        } else {
          renderAi("<h4>⚠️ AI unavailable</h4><p>" + esc(err.message || "The backend didn't answer.") + capLink + "</p>");
        }
        return;
      }
      var text = (res && res.text) || "";
      if (!text) {
        renderAi(opts.error ? AI.explainErrorHTML(opts.error)
          : "<h4>⚠️ AI unavailable</h4><p>Empty answer.</p>");
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
      renderAi(html);
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

  /* ================= snippets ================= */
  function initSnippets() {
    var sel = document.getElementById("snippet-select");
    sel.innerHTML = '<option value="">— Load sample —</option>';
    Object.keys(SNIPPETS).forEach(function (k) {
      var o = document.createElement("option");
      o.value = k; o.textContent = SNIPPETS[k].name;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      var s = SNIPPETS[sel.value];
      if (s && ws.active && editor) {
        editor.setValue(s.code);
        persistActiveFile(); saveWS(); renderTabs(); updateStatusBar();
        toast("Sample loaded 📥", "success");
      }
      sel.value = "";
    });
    document.getElementById("save-snippet-btn").addEventListener("click", function () {
      var A = window.SkillzifyActivity; if (!A || !ws.active) return;
      var code = ws.files[ws.active].trim();
      if (!code) { toast("Nothing to save", "error"); return; }
      var title = prompt("Name this snippet:", ws.active);
      if (title == null) return;
      A.saveSnippet(title.trim() || ws.active, "", code);
      toast("Snippet saved 📝", "success");
    });
  }

  /* ================= init ================= */
  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("ide")) return;
    ws = loadWS();
    var shared = loadSharedWS();
    try {
      var handed = localStorage.getItem("skillzify_compiler_code");
      if (handed && !shared) {
        if (ws.files["main.py"] === DEFAULT_CODE) {
          // untouched default: the lesson code takes its place, as before
          ws.files["main.py"] = handed;
          if (ws.tabs.indexOf("main.py") < 0) ws.tabs.unshift("main.py");
          ws.active = "main.py";
        } else {
          // main.py holds the user's own code: open the lesson code as a
          // new file instead of overwriting it
          var ln = "lesson.py", li = 2;
          while (ws.files.hasOwnProperty(ln)) ln = "lesson" + (li++) + ".py";
          ws.files[ln] = handed;
          ws.tabs.push(ln); ws.active = ln;
        }
        if (!ws.mtimes) ws.mtimes = {};
        ws.mtimes[ws.active] = Date.now();
        if (ws.deleted) delete ws.deleted[ws.active];
        saveWS();
        localStorage.removeItem("skillzify_compiler_code");
      }
    } catch (e) {}

    if (window.CodeMirror) {
      var theme = "dracula", font = 14;
      try {
        theme = localStorage.getItem(CM_THEME_KEY) || "dracula";
        font = parseInt(localStorage.getItem(CM_FONT_KEY) || "14", 10) || 14;
      } catch (e) {}
      editor = window.CodeMirror(document.getElementById("editor-host"), {
        mode: "python", theme: theme, lineNumbers: true,
        indentUnit: 4, tabSize: 4, matchBrackets: true,
        value: ws.active ? ws.files[ws.active] : ""
      });
      // move welcome overlay above editor content but below nothing else
      var wel = document.getElementById("welcome");
      document.getElementById("editor-host").appendChild(wel);
      editor.addKeyMap({ "Ctrl-Enter": runCode, "Cmd-Enter": runCode });
      applyFont(font);
      document.getElementById("theme-select").value = theme;
      var st = document.getElementById("st-theme");
      if (st) st.textContent = theme.charAt(0).toUpperCase() + theme.slice(1).replace("-darker", "");
      editor.on("cursorActivity", updateStatusBar);
      editor.on("change", function () { updateStatusBar(); markUnsaved(); });
      // auto-save workspace as they type (debounced)
      var saveT = null;
      editor.on("change", function () {
        clearTimeout(saveT);
        saveT = setTimeout(function () { persistActiveFile(); saveWS(); }, 800);
      });
    } else {
      // P1-7: CodeMirror CDN failed — say so LOUDLY and fall back to a
      // plain <textarea> editor so code can still be typed and run.
      editor = makeFallbackEditor(document.getElementById("editor-host"), ws.active ? ws.files[ws.active] : "");
      editor.on("cursorActivity", updateStatusBar);
      editor.on("change", function () { updateStatusBar(); markUnsaved(); });
      var saveT = null;
      editor.on("change", function () {
        clearTimeout(saveT);
        saveT = setTimeout(function () { persistActiveFile(); saveWS(); }, 800);
      });
      printLine("⚠ Code editor failed to load (CodeMirror CDN unreachable) — plain-text editor active. Code still runs.", "err");
      try { toast("Code editor failed to load — using plain-text editor", "error"); } catch (e) {}
    }

    renderExplorer(); renderTabs(); renderHistory(); updateStatusBar();
    initSnippets();

    /* activity bar */
    document.querySelectorAll(".activity-bar button[data-view]").forEach(function (b) {
      b.addEventListener("click", function () { switchView(b.getAttribute("data-view")); });
    });
    /* mobile sidebar close (P2-31): ✕ button + tap the backdrop */
    var scb = document.getElementById("sidebar-close-btn");
    if (scb) scb.addEventListener("click", function () { setSidebarOpen(false); });
    var sbd = document.getElementById("sidebar-backdrop");
    if (sbd) sbd.addEventListener("click", function () { setSidebarOpen(false); });
    /* panel tabs */
    document.querySelectorAll(".ptab").forEach(function (b) {
      b.addEventListener("click", function () { switchPtab(b.getAttribute("data-ptab")); });
    });
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
    /* files */
    document.getElementById("new-file-btn").addEventListener("click", newFile);
    document.getElementById("welcome-new").addEventListener("click", newFile);
    document.getElementById("share-btn").addEventListener("click", shareCode);
    document.getElementById("download-btn").addEventListener("click", downloadCode);
    document.getElementById("upload-btn").addEventListener("click", function () { document.getElementById("upload-input").click(); });
    document.getElementById("upload-input").addEventListener("change", function () {
      var f = this.files[0]; if (!f) return;
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
      this.value = "";
    });
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
    /* find */
    document.getElementById("find-btn").addEventListener("click", function () { openFind(false); });
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
    /* terminal panel */
    document.getElementById("copy-out-btn").addEventListener("click", copyOutput);
    document.getElementById("clear-out-btn").addEventListener("click", function () { clearTerminal(); printLine("Terminal cleared.", "dim"); });
    document.getElementById("panel-toggle").addEventListener("click", function () {
      var p = document.getElementById("panel");
      p.style.height = p.style.height === "60%" ? "" : "60%";
    });
    /* problems check */
    document.getElementById("st-check").addEventListener("click", function () { checkProblems(false); });
    /* search */
    var sIn = document.getElementById("search-input");
    var sT = null;
    sIn.addEventListener("input", function () { clearTimeout(sT); sT = setTimeout(function () { searchFiles(sIn.value); }, 250); });
    /* AI */
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
    document.getElementById("ai-save").addEventListener("click", function () {
      try {
        var v = document.getElementById("ai-key").value.trim();
        window.Skillzify.storeSet(AI_KEY, v);
        toast(v ? "API key saved 🔑" : "API key removed", "success");
      } catch (e) {}
    });
    try { document.getElementById("ai-key").value = window.Skillzify.storeGet(AI_KEY, ""); } catch (e) {}
    /* settings */
    document.getElementById("theme-select").addEventListener("change", function () { applyTheme(this.value); });
    document.getElementById("st-theme").addEventListener("click", function () { switchView("settings"); });
    document.getElementById("fs-up").addEventListener("click", function () { applyFont(curFont() + 1); });
    document.getElementById("fs-down").addEventListener("click", function () { applyFont(curFont() - 1); });
    document.getElementById("wrap-btn").addEventListener("click", function () {
      if (!editor) return;
      var on = !editor.getOption("lineWrapping");
      editor.setOption("lineWrapping", on);
      this.textContent = "Wrap: " + (on ? "on" : "off");
    });
    /* panel resize — pointer events (mouse + touch). The height goes
       through clampPanelHeight, so dragging can never push the panel
       (and the status bar below it) off the bottom of the screen. */
    (function () {
      var handle = document.getElementById("panel-resize");
      var panel = document.getElementById("panel");
      var dragging = false;
      handle.addEventListener("pointerdown", function (e) {
        dragging = true;
        try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      handle.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var rect = panel.parentElement.getBoundingClientRect();
        panel.style.height = clampPanelHeight(rect.bottom - e.clientY, rect.height) + "px";
      });
      function endDrag() { dragging = false; }
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);
    })();
    /* keyboard */
    document.addEventListener("keydown", function (e) {
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "f" && !e.shiftKey) { e.preventDefault(); openFind(false); }
      else if (mod && e.key.toLowerCase() === "h") { e.preventDefault(); openFind(true); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); persistActiveFile(); if (saveWS()) toast("Workspace saved 💾", "success"); }
      else if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); var sb = document.getElementById("sidebar"); setSidebarOpen(!sb.classList.contains("open")); }
      else if (e.key === "Escape") { closeFind(); setSidebarOpen(false); }
    });

    /* save on exit: never lose the last keystrokes inside the autosave window */
    window.addEventListener("beforeunload", function () { persistActiveFile(); saveWS(); });
    /* remote workspace: a newer copy from another device arrives via sync */
    window.addEventListener("skillzify-sync", applyRemoteWorkspace);
    /* restore button (Settings -> Workspace) */
    var rb = document.getElementById("restore-ws-btn");
    if (rb) rb.addEventListener("click", restoreBackupWS);
    updateRestoreButton();
    updateSaveUI(true);

    /* warm the AI backend + load runtime (via the shared client) */
    try {
      if (window.SkillzifyAI && window.SkillzifyAI.warmup) window.SkillzifyAI.warmup();
      else fetch("api/health", { method: "GET", cache: "no-store" }).catch(function () {});
    } catch (e) {}
    setRunUI(false); // P1-9: Run + Check start disabled until Pyodide is ready
    loadPyodideRuntime();
  });
})();
