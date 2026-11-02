/* ============================================================
   Skillzify v2 — compiler.js
   Pyodide-powered Python compiler with:
   - CodeMirror editor
   - run with timing, stdout capture, input() support
   - sample snippets
   - AI Explain panel:
       * offline heuristic explainer for common Python errors
       * optional OpenAI-compatible API (key stored in
         localStorage ONLY — never hardcoded)
   Run history is stored for the dashboard ("skillzify_runs").
   ============================================================ */
(function () {
  "use strict";

  var RUNS_KEY = "skillzify_runs";
  var AI_KEY = "skillzify_ai_key";
  var AI_BASE_KEY = "skillzify_ai_base";
  var AI_MODEL_KEY = "skillzify_ai_model";

  var pyodide = null;
  var editor = null;
  var lastCode = "";
  var lastError = "";

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

  /* ---------- Pyodide loading ---------- */
  function setStatus(state, text) {
    var pill = document.getElementById("status-pill");
    if (pill) { pill.className = "status-pill " + state; pill.textContent = text; }
  }

  function loadPyodideRuntime() {
    setStatus("running", "Loading Python runtime…");
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
    script.onload = function () {
      window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" })
        .then(function (py) {
          pyodide = py;
          setStatus("ready", "Python ready ✓");
          document.getElementById("run-btn").disabled = false;
          printLine("✅ Python 3.11 runtime ready (Pyodide). Write code and press Run.", "dim");
        })
        .catch(function (err) {
          setStatus("", "Failed to load");
          printLine("❌ Could not load the Python runtime. Check your internet connection and reload.", "err");
          console.error(err);
        });
    };
    script.onerror = function () {
      setStatus("", "Failed to load");
      printLine("❌ Could not download Pyodide. An internet connection is required.", "err");
    };
    document.head.appendChild(script);
  }

  /* ---------- Console ---------- */
  function printLine(text, cls) {
    var con = document.getElementById("console");
    var div = document.createElement("div");
    if (cls) div.className = cls;
    div.textContent = text;
    con.appendChild(div);
    con.scrollTop = con.scrollHeight;
  }
  function clearConsole() {
    document.getElementById("console").innerHTML = "";
  }

  /* ---------- stdin (input() support) ---------- */
  function makeStdin(lines) {
    var text = lines.join("\n") + (lines.length ? "\n" : "");
    var idx = 0;
    return {
      stdin: function () {
        if (idx >= text.length) return null; // EOF -> Python raises EOFError
        return text.charCodeAt(idx++);
      }
    };
  }

  /* ---------- Run (with stop + timeout) ---------- */
  var runToken = 0;
  var RUN_TIMEOUT_MS = 15000;

  function setRunningUI(running) {
    document.getElementById("run-btn").disabled = running;
    var stop = document.getElementById("stop-btn");
    if (stop) stop.disabled = !running;
  }

  function runCode() {
    if (!pyodide) { window.Skillzify.toast("Python runtime is still loading…", "error"); return; }
    var code = editor ? editor.getValue() : document.getElementById("code-fallback").value;
    lastCode = code;
    var inputText = document.getElementById("program-input").value;
    var lines = inputText.split("\n");
    // Drop a single trailing empty line from the textarea
    if (lines.length && lines[lines.length - 1] === "") lines.pop();

    clearConsole();
    setStatus("running", "Running…");
    setRunningUI(true);

    var out = [];
    pyodide.setStdout({ batched: function (s) { out.push(s); } });
    pyodide.setStderr({ batched: function (s) { out.push(s); } });
    try { pyodide.setStdin(makeStdin(lines)); } catch (e) { /* older builds */ }

    var myToken = ++runToken;
    var t0 = performance.now();
    var timer = setTimeout(function () {
      if (myToken !== runToken) return;
      runToken++; // abandon the runaway execution
      out.forEach(function (l) { printLine(l); });
      printLine("———\n⏱ Stopped: your program ran over 15 seconds — likely an infinite loop. The output above is what it printed before the cutoff.", "err");
      recordRun(false, RUN_TIMEOUT_MS);
      setStatus("ready", "Python ready ✓");
      setRunningUI(false);
    }, RUN_TIMEOUT_MS);

    var promise;
    try {
      promise = pyodide.runPythonAsync(code);
    } catch (err) {
      promise = Promise.reject(err);
    }

    promise.then(function () {
      if (myToken !== runToken) return; // abandoned (stop/timeout)
      clearTimeout(timer);
      var ms = Math.round(performance.now() - t0);
      out.forEach(function (l) { printLine(l); });
      printLine("———\n✅ Finished in " + ms + " ms", "ok-meta");
      lastError = "";
      recordRun(true, ms);
      setStatus("ready", "Python ready ✓");
    }).catch(function (err) {
      if (myToken !== runToken) return; // abandoned (stop/timeout)
      clearTimeout(timer);
      var ms = Math.round(performance.now() - t0);
      var msg = String(err && err.message ? err.message : err);
      // Strip Python's noisy traceback down to the last error line + context
      var short = simplifyTraceback(msg);
      out.forEach(function (l) { printLine(l); });
      printLine(short, "err");
      printLine("———\n❌ Error after " + ms + " ms — see AI Explain →", "err");
      lastError = short;
      recordRun(false, ms);
      setStatus("ready", "Python ready ✓");
    }).finally(function () {
      if (myToken !== runToken) return;
      setRunningUI(false);
    });
  }

  function stopRun() {
    if (runToken === 0) return;
    runToken++; // abandon current execution
    printLine("———\n⏹ Stopped by user.", "err");
    setStatus("ready", "Python ready ✓");
    setRunningUI(false);
  }

  /* ---------- Share via link + download ---------- */
  function currentCode() {
    return editor ? editor.getValue() : document.getElementById("code-fallback").value;
  }
  function b64urlEncode(s) {
    return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return decodeURIComponent(escape(atob(s)));
  }
  function shareCode() {
    var hash = "#code=" + b64urlEncode(currentCode());
    try { history.replaceState(null, "", hash); } catch (e) {}
    var url = location.href.split("#")[0] + hash;
    function done() { window.Skillzify.toast("Share link copied! 🔗", "success"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
    } else { fallbackCopy(url); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }
  function loadSharedCode() {
    var m = (location.hash || "").match(/^#code=(.+)$/);
    if (!m) return false;
    try {
      var code = b64urlDecode(m[1]);
      if (editor) editor.setValue(code);
      else document.getElementById("code-fallback").value = code;
      return true;
    } catch (e) { return false; }
  }
  function downloadCode() {
    var blob = new Blob([currentCode()], { type: "text/x-python" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "skillzify.py";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    window.Skillzify.toast("Downloaded skillzify.py ⬇️", "success");
  }

  function simplifyTraceback(msg) {
    var lines = msg.split("\n").filter(function (l) { return l.trim() !== ""; });
    // Keep File lines + the final error line(s)
    var kept = [];
    lines.forEach(function (l) {
      if (/File "<exec>"/.test(l) || /Error|Exception|error/i.test(l) || /^\s*\^/.test(l) || /line \d+/.test(l)) kept.push(l);
    });
    var tail = kept.slice(-6);
    return tail.length ? tail.join("\n") : lines.slice(-3).join("\n");
  }

  function recordRun(ok, ms) {
    var runs = window.Skillzify.storeGet(RUNS_KEY, []);
    runs.unshift({
      t: Date.now(),
      ok: ok,
      ms: ms,
      preview: lastCode.split("\n")[0].slice(0, 60) || "(empty)"
    });
    runs = runs.slice(0, 30);
    window.Skillzify.storeSet(RUNS_KEY, runs);
    bumpStreak();
    if (window.SkillzifyActivity) window.SkillzifyActivity.log("run", "Ran code (" + (ok ? "success" : "error") + ", " + ms + "ms)");
  }

  function bumpStreak() {
    var s = window.Skillzify.storeGet("skillzify_streak", { last: null, count: 0 });
    // Accept both legacy toDateString() and synced yyyy-MM-dd formats.
    function isoDay(d) { var m = d.getMonth() + 1, dy = d.getDate(); return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (dy < 10 ? "0" + dy : dy); }
    function normDay(v) {
      if (!v) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      var t = new Date(v);
      return isNaN(t.getTime()) ? null : isoDay(t);
    }
    var todayIso = isoDay(new Date());
    var yestIso = isoDay(new Date(Date.now() - 864e5));
    var lastIso = normDay(s.last);
    if (lastIso === todayIso) return;
    s.count = (lastIso === yestIso) ? s.count + 1 : 1;
    s.last = todayIso;
    window.Skillzify.storeSet("skillzify_streak", s);
    if (window.SkillzifySync) window.SkillzifySync.markDirty();
  }

  /* ---------- AI Explain (offline heuristics) ---------- */
  var HEURISTICS = [
    { re: /SyntaxError/, title: "🔧 SyntaxError — Python can't parse your code",
      tips: ["Check for missing colons (:) at the end of if/for/while/def lines.", "Match every opening bracket ( [ { with its closing partner.", "Look at the line number in the error — the real mistake is often on the line just above it."] },
    { re: /IndentationError|unexpected indent/, title: "📐 IndentationError — spacing problem",
      tips: ["Use 4 spaces per indent level — never mix tabs and spaces.", "Every block after if/for/def/while must be indented one level deeper.", "An 'unexpected indent' means a line is indented with no block above it."] },
    { re: /NameError: name '(\w+)'/, title: "🏷️ NameError — unknown name",
      tips: ["You used a variable or function that was never defined.", "Check for typos — 'print' vs 'Print' matters (Python is case-sensitive).", "Make sure the variable is assigned BEFORE the line that uses it."] },
    { re: /TypeError/, title: "🧩 TypeError — wrong type of value",
      tips: ["You're mixing incompatible types, e.g. \"5\" + 3 (string + number).", "Convert explicitly: int(\"5\") + 3.", "If calling a function, check you passed the right number of arguments."] },
    { re: /ZeroDivisionError/, title: "➗ ZeroDivisionError — divided by zero",
      tips: ["Guard the division: if b != 0: ...", "Or handle it: try: x = a/b except ZeroDivisionError: ..."] },
    { re: /IndexError/, title: "📋 IndexError — list index out of range",
      tips: ["Valid indexes are 0 to len(list)-1.", "Check loop bounds — range(len(items)) is the safe pattern.", "An empty list has no index 0!"] },
    { re: /KeyError: (.+)/, title: "🔑 KeyError — missing dictionary key",
      tips: ["The key doesn't exist in the dict.", "Use dict.get(key, default) to avoid crashes.", "Check spelling/case of the key."] },
    { re: /ValueError/, title: "⚠️ ValueError — right type, wrong value",
      tips: ["Common cause: int(input()) when the user typed text.", "Validate input first, or wrap in try/except ValueError."] },
    { re: /AttributeError: '(\w+)' object has no attribute '(\w+)'/, title: "🧲 AttributeError — no such method/attribute",
      tips: ["The object doesn't have that method — check the type.", "E.g. append() exists on lists, not strings.", "Typos in method names are the #1 cause."] },
    { re: /ImportError|ModuleNotFoundError/, title: "📦 ImportError — module not found",
      tips: ["The module isn't installed in this Pyodide environment.", "Only the Python standard library + Pyodide packages work here.", "Check the module name spelling."] },
    { re: /EOFError/, title: "⌨️ EOFError — input() ran out of data",
      tips: ["Your program called input() more times than you provided input lines.", "Add more lines in the 'Program input' box below the editor."] },
    { re: /RecursionError/, title: "🔁 RecursionError — infinite recursion",
      tips: ["Your function calls itself forever.", "Every recursive function needs a base case that stops."] }
  ];

  function heuristicExplain(errText, code) {
    for (var i = 0; i < HEURISTICS.length; i++) {
      var h = HEURISTICS[i];
      var m = errText.match(h.re);
      if (m) {
        var html = "<h4>" + h.title + "</h4><ul>";
        h.tips.forEach(function (t) { html += "<li>" + t + "</li>"; });
        html += "</ul>";
        if (m[1]) html += '<p class="hint">Offending name: <span class="kbd">' + window.Skillzify.esc(m[1]) + "</span></p>";
        return html;
      }
    }
    return "<h4>🤔 Unrecognized error</h4><p>The offline explainer doesn't have a rule for this one yet. " +
      "Read the last line of the traceback — it names the error type — or paste an API key below for a real AI explanation.</p>";
  }

  function renderAiBox(html) {
    document.getElementById("ai-output").innerHTML = html;
  }

  function explainLastError() {
    if (!lastError) { renderAiBox('<p class="hint">Run some code first — when it errors, I\'ll explain it here.</p>'); return; }
    aiExplainRemote(lastCode, lastError); // backend AI → own key → offline heuristic
  }

  function offlineCodeSummary(code) {
    var lines = code.split("\n").filter(function (l) { return l.trim() && !l.trim().startsWith("#"); }).length;
    var feats = [];
    if (/def /.test(code)) feats.push("defines function(s)");
    if (/class /.test(code)) feats.push("uses classes");
    if (/for |while /.test(code)) feats.push("uses loops");
    if (/import /.test(code)) feats.push("imports modules");
    if (/input\(/.test(code)) feats.push("reads user input");
    if (/try:/.test(code)) feats.push("handles errors");
    return "<h4>📝 What your code does</h4><p>Your program has <strong>" + lines +
      "</strong> line(s) of code" + (feats.length ? " and " + feats.join(", ") + "." : ".") +
      '</p><p class="hint">Start the backend (or add your own key in Settings) for a full AI walkthrough.</p>';
  }

  function offlineExplain(code, errText) {
    return errText ? heuristicExplain(errText, code) : offlineCodeSummary(code);
  }

  function explainCode() {
    var code = editor ? editor.getValue() : "";
    if (!code.trim()) { renderAiBox('<p class="hint">Write some code first, then ask for an explanation.</p>'); return; }
    aiExplainRemote(code, null); // backend AI → own key → offline summary
  }

  /* ---------- Remote AI: backend first, own key as fallback ---------- */
  function normBase(b) {
    b = (b || "").replace(/\/+$/, "");
    // Forgive the common mistake of pasting the bare Google endpoint:
    if (/^https:\/\/generativelanguage\.googleapis\.com$/i.test(b)) b += "/v1beta/openai";
    return b;
  }
  function aiExplainRemote(code, errText) {
    renderAiBox('<p class="hint">🤖 Waking up the AI…</p>');
    var ctrl = null, timer = null, stageTimer = null;
    try {
      ctrl = new AbortController();
      // Never hang for minutes: give the backend 60s, then fall back fast.
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 60000);
      stageTimer = setTimeout(function () {
        renderAiBox('<p class="hint">🤖 Still working — the AI backend is slow to wake on the free tier. Hang on…</p>');
      }, 9000);
    } catch (e) {}
    function clearTimers() {
      if (timer) clearTimeout(timer);
      if (stageTimer) clearTimeout(stageTimer);
    }
    var opts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code, error: errText || "" })
    };
    if (ctrl) opts.signal = ctrl.signal;
    fetch("api/explain", opts).then(function (r) {
      clearTimers();
      if (!r.ok) throw 0;
      return r.json();
    }).then(function (data) {
      if (!data.explanation) throw 0;
      renderAiBox("<h4>🤖 AI explanation</h4><p>" +
        window.Skillzify.esc(data.explanation).replace(/\n/g, "<br>") + "</p>");
    }).catch(function () {
      clearTimers();
      aiExplainViaKey(code, errText); // no backend / not configured → own key → offline
    });
  }
  function aiExplainViaKey(code, errText) {
    var key = window.Skillzify.storeGet(AI_KEY, "");
    if (!key) { renderAiBox(offlineExplain(code, errText)); return; }
    var base = normBase(window.Skillzify.storeGet(AI_BASE_KEY, "") || "https://generativelanguage.googleapis.com/v1beta/openai");
    var model = window.Skillzify.storeGet(AI_MODEL_KEY, "") || "gemini-3.8-flash";
    var prompt = errText
      ? "A student ran this Python code and got this error. Explain the error in simple terms and how to fix it:\n\nCODE:\n" + code + "\n\nERROR:\n" + errText
      : "Explain this Python code to a beginner student, briefly, concept by concept:\n\n" + code;
    renderAiBox('<p class="hint">🤖 Asking AI…</p>');
    fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a friendly Python tutor for a beginner student. Format every answer like this: 1. One line starting with 'In short:' stating what the program does. 2. A Walkthrough section explaining the important parts step by step (group repetitive lines; explain WHY each part exists). 3. A Key concepts section listing each Python idea used with one short line each. Keep it concise, use short bullet points." },
          { role: "user", content: prompt }
        ],
        max_tokens: 600,
        temperature: 0.4
      })
    }).then(function (r) {
      if (!r.ok) throw new Error("API returned HTTP " + r.status);
      return r.json();
    }).then(function (data) {
      var text = (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content : "(empty response)";
      renderAiBox("<h4>🤖 AI explanation</h4><p>" +
        window.Skillzify.esc(text).replace(/\n/g, "<br>") + "</p>");
    }).catch(function (err) {
      renderAiBox('<h4>⚠️ AI request failed</h4><p class="hint">' +
        window.Skillzify.esc(err.message) +
        ". Falling back to the offline explainer:</p>" +
        (errText ? heuristicExplain(errText, code) : ""));
      console.error(err);
    });
  }

  /* ---------- Settings ---------- */
  function initSettings() {
    var keyEl = document.getElementById("ai-key");
    var baseEl = document.getElementById("ai-base");
    var modelEl = document.getElementById("ai-model");
    var statusEl = document.getElementById("ai-status");
    keyEl.value = window.Skillzify.storeGet(AI_KEY, "");
    baseEl.value = window.Skillzify.storeGet(AI_BASE_KEY, "");
    modelEl.value = window.Skillzify.storeGet(AI_MODEL_KEY, "");
    function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
    var presetGemini = document.getElementById("ai-preset-gemini");
    if (presetGemini) presetGemini.addEventListener("click", function () {
      baseEl.value = "https://generativelanguage.googleapis.com/v1beta/openai";
      modelEl.value = "gemini-3.8-flash";
      setStatus("✨ Gemini preset loaded — now paste your free API key below.");
    });
    var presetOpenai = document.getElementById("ai-preset-openai");
    if (presetOpenai) presetOpenai.addEventListener("click", function () {
      baseEl.value = "https://api.openai.com/v1";
      modelEl.value = "gpt-4o-mini";
      setStatus("OpenAI preset loaded — paste your API key below.");
    });
    document.getElementById("ai-save").addEventListener("click", function () {
      window.Skillzify.storeSet(AI_KEY, keyEl.value.trim());
      window.Skillzify.storeSet(AI_BASE_KEY, baseEl.value.trim());
      window.Skillzify.storeSet(AI_MODEL_KEY, modelEl.value.trim());
      setStatus("🔑 Saved. Hit “Test key” to verify it works.");
      window.Skillzify.toast("AI settings saved in this browser 🔑", "success");
    });
    var testBtn = document.getElementById("ai-test");
    if (testBtn) testBtn.addEventListener("click", function () {
      var key = keyEl.value.trim();
      var base = normBase(baseEl.value.trim() || "https://generativelanguage.googleapis.com/v1beta/openai");
      var model = modelEl.value.trim() || "gemini-3.8-flash";
      if (!key) { setStatus("⚠️ Paste your API key first."); return; }
      setStatus("🔄 Testing your key…");
      fetch(base + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: "Reply with exactly: OK" }],
          max_tokens: 10
        })
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " — check the key, base URL and model, then try again.");
        return r.json();
      }).then(function () {
        setStatus("✅ Key works! “Explain last error” and “Explain my code” are now fully smart.");
        window.Skillzify.toast("API key verified ✅", "success");
      }).catch(function (err) {
        setStatus("❌ " + err.message);
      });
    });
    document.getElementById("ai-clear").addEventListener("click", function () {
      ["ai-key", "ai-base", "ai-model"].forEach(function (id) { document.getElementById(id).value = ""; });
      window.Skillzify.storeSet(AI_KEY, "");
      window.Skillzify.storeSet(AI_BASE_KEY, "");
      window.Skillzify.storeSet(AI_MODEL_KEY, "");
      setStatus("");
      window.Skillzify.toast("API key removed.", "success");
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("editor-host")) return;

    if (window.CodeMirror) {
      editor = window.CodeMirror(document.getElementById("editor-host"), {
        mode: "python",
        theme: "dracula",
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        value: 'print("Hello, Skillzify! 👋")\n# Press Ctrl+Enter to run'
      });
      editor.addKeyMap({ "Ctrl-Enter": runCode, "Cmd-Enter": runCode });
    } else {
      document.getElementById("code-fallback").style.display = "block";
    }

    // Handoff from learn.html ("Try in compiler"), or shared #code= link (link wins)
    try {
      var shared = loadSharedCode();
      if (!shared) {
        var handed = localStorage.getItem("skillzify_compiler_code");
        if (handed) {
          if (editor) editor.setValue(handed);
          else document.getElementById("code-fallback").value = handed;
          localStorage.removeItem("skillzify_compiler_code");
        }
      } else {
        try { localStorage.removeItem("skillzify_compiler_code"); } catch (e) {}
      }
    } catch (e) {}

    var stopBtn = document.getElementById("stop-btn");
    if (stopBtn) stopBtn.addEventListener("click", stopRun);
    var shareBtn = document.getElementById("share-btn");
    if (shareBtn) shareBtn.addEventListener("click", shareCode);
    var dlBtn = document.getElementById("download-btn");
    if (dlBtn) dlBtn.addEventListener("click", downloadCode);

    // Warm the AI backend now, so "Explain" is fast when the user clicks it.
    // (On static hosts like GitHub Pages this 404s harmlessly.)
    try { fetch("api/health", { method: "GET", cache: "no-store" }).catch(function () {}); } catch (e) {}

    var sel = document.getElementById("snippet-select");
    Object.keys(SNIPPETS).forEach(function (k) {
      var o = document.createElement("option");
      o.value = k; o.textContent = SNIPPETS[k].name;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      var s = SNIPPETS[sel.value];
      if (s) {
        if (editor) editor.setValue(s.code);
        else document.getElementById("code-fallback").value = s.code;
      }
    });

    document.getElementById("run-btn").addEventListener("click", runCode);
    document.getElementById("clear-btn").addEventListener("click", function () {
      clearConsole();
      if (editor) editor.setValue("");
      printLine("Console cleared.", "dim");
    });
    document.getElementById("explain-error-btn").addEventListener("click", explainLastError);
    document.getElementById("explain-code-btn").addEventListener("click", explainCode);
    document.getElementById("save-snippet-btn").addEventListener("click", saveSnippetUI);

    initSettings();
    loadPyodideRuntime();
    renderSnippetLibrary();
    // deep-link: compiler.html#snippet-<id>
    if (location.hash.indexOf("#snippet-") === 0) {
      var sid = location.hash.slice(9);
      var sn = (window.SkillzifyActivity ? window.SkillzifyActivity.snippets() : []).filter(function (s) { return s.id === sid; })[0];
      if (sn) { if (editor) editor.setValue(sn.code); else document.getElementById("code-fallback").value = sn.code; }
    }
  });

  /* ---------- Gists-like snippets ---------- */
  function currentCode() { return editor ? editor.getValue() : document.getElementById("code-fallback").value; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  function saveSnippetUI() {
    var A = window.SkillzifyActivity; if (!A) return;
    var code = currentCode().trim();
    if (!code) { window.Skillzify.toast("Write some code first ✍️", "error"); return; }
    var title = prompt("Name this snippet:", code.split("\n")[0].slice(0, 40) || "Untitled snippet");
    if (title == null) return;
    A.saveSnippet(title.trim() || "Untitled snippet", "", code);
    renderSnippetLibrary();
    window.Skillzify.toast("Snippet saved 📝", "success");
  }

  function renderSnippetLibrary() {
    var A = window.SkillzifyActivity; if (!A) return;
    var host = document.getElementById("snippet-library"); if (!host) return;
    var snips = A.snippets();
    if (!snips.length) { host.innerHTML = '<p class="muted small">No snippets yet — write code above and hit 💾 Save.</p>'; return; }
    host.innerHTML = snips.map(function (s) {
      var starred = A.isStarred("snippet", s.id);
      return '<div class="snippet-card"><h4>' + esc(s.title) + '</h4>' +
        '<div class="muted small">' + new Date(s.created).toLocaleDateString() + '</div>' +
        '<pre>' + esc(s.code.slice(0, 220)) + (s.code.length > 220 ? "…" : "") + '</pre>' +
        '<div class="snippet-actions">' +
        '<button class="btn btn-sm" data-load="' + s.id + '">Open</button>' +
        '<button class="btn btn-sm btn-ghost" data-star-snip="' + s.id + '">' + (starred ? "🌟" : "⭐") + '</button>' +
        '<button class="btn btn-sm btn-ghost" data-pin-snip="' + s.id + '">📌</button>' +
        '<button class="btn btn-sm btn-ghost" data-del-snip="' + s.id + '">🗑️</button>' +
        '</div></div>';
    }).join("");
    host.querySelectorAll("[data-load]").forEach(function (b) {
      b.addEventListener("click", function () {
        var s = snips.filter(function (x) { return x.id === b.getAttribute("data-load"); })[0];
        if (s) { if (editor) editor.setValue(s.code); else document.getElementById("code-fallback").value = s.code; window.scrollTo({ top: 0, behavior: "smooth" }); }
      });
    });
    host.querySelectorAll("[data-star-snip]").forEach(function (b) {
      b.addEventListener("click", function () {
        var s = snips.filter(function (x) { return x.id === b.getAttribute("data-star-snip"); })[0];
        if (s) { A.toggleStar("snippet", s.id, s.title); renderSnippetLibrary(); }
      });
    });
    host.querySelectorAll("[data-pin-snip]").forEach(function (b) {
      b.addEventListener("click", function () {
        var s = snips.filter(function (x) { return x.id === b.getAttribute("data-pin-snip"); })[0];
        if (s) { A.togglePin("snippet", s.id, s.title); window.Skillzify.toast("Pinned 📌 — see your profile", "success"); }
      });
    });
    host.querySelectorAll("[data-del-snip]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (confirm("Delete this snippet?")) { A.deleteSnippet(b.getAttribute("data-del-snip")); renderSnippetLibrary(); }
      });
    });
  }
})();
