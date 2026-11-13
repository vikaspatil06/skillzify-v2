/* Skillzify Flowchart Lab v2 — app logic (external, cacheable).
   Pipeline: Python source --(Pyodide + ast)--> IR (JSON) --> Mermaid /
   Graphviz / living trace / exports / AI. Mermaid and Pyodide are
   LAZY-loaded on first use. Trace styling lives in flowchart.css with
   .fc-trace-* classes — no !important war with Mermaid. */
(function () {
  "use strict";

  /* ---------------- tiny DOM helpers ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------------- toast ----------------
     Single-toast invariant: a new message replaces the visible one
     immediately — text swapped, hide timer reset, show transition
     restarted — so a stale message can never linger into the next
     action. hideToast() clears without showing anything. */
  var toastTimer = null;
  function hideToast() {
    var t = $("#fcToast");
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (t) t.classList.remove("show");
  }
  function toast(msg, ms) {
    var t = $("#fcToast");
    if (!t) return;
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    t.textContent = msg;
    t.classList.remove("show");
    void t.offsetWidth; /* restart the transition for the new message */
    t.classList.add("show");
    toastTimer = setTimeout(function () {
      toastTimer = null;
      t.classList.remove("show");
    }, ms || 3200);
  }

  /* ---------------- inline SVG icon set (24px, 1.8 stroke) ---------------- */
  var IC = {
    play: '<path d="M7 4.8v14.4c0 .9 1 1.5 1.8 1L20 13a1.2 1.2 0 0 0 0-2L8.8 3.9C8 3.4 7 4 7 4.8Z"/>',
    pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/>',
    stepB: '<path d="M18 5v14L8.5 12Z"/><rect x="5" y="4.5" width="2.4" height="15" rx="1"/>',
    stepF: '<path d="M6 5v14l9.5-7Z"/><rect x="16.6" y="4.5" width="2.4" height="15" rx="1"/>',
    restart: '<path d="M4.5 9a8 8 0 1 1-.6 6"/><path d="M4 4v5h5"/>',
    gen: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.2"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5.5-5.5 3 3L17 11l3 3"/>',
    code: '<path d="M8 6l-5 6 5 6M16 6l5 6-5 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    sheet: '<path d="M6 3h9l4 4v14H6Z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',
    spark: '<path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z"/>',
    shield: '<path d="M12 3l7 2.5V11c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V5.5Z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
    warn: '<path d="M12 3.5L22 20H2Z"/><path d="M12 10v4.5M12 17.4v.1"/>',
    x: '<path d="M5 5l14 14M19 5L5 19"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    chevD: '<path d="M5 9l7 7 7-7"/>'
  };
  function icon(name, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 17) + '" height="' +
      (size || 17) + '" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (IC[name] || "") + "</svg>";
  }

  /* ---------------- samples ---------------- */
  var SAMPLES = [
    { name: "Factorial", code: "def factorial(n):\n    result = 1\n    for i in range(1, n + 1):\n        result = result * i\n    return result\n\nnum = int(input(\"Enter a number: \"))\nprint(\"Factorial of\", num, \"is\", factorial(num))\n" },
    { name: "Prime check", code: "num = int(input(\"Enter a number: \"))\nis_prime = True\nif num < 2:\n    is_prime = False\nelse:\n    for i in range(2, num):\n        if num % i == 0:\n            is_prime = False\n            break\nif is_prime:\n    print(num, \"is prime\")\nelse:\n    print(num, \"is not prime\")\n" },
    { name: "Fibonacci", code: "n = int(input(\"How many terms? \"))\na, b = 0, 1\ncount = 0\nwhile count < n:\n    print(a)\n    a, b = b, a + b\n    count += 1\n" },
    { name: "Star pattern", code: "rows = 5\nfor i in range(1, rows + 1):\n    for j in range(i):\n        print(\"*\", end=\" \")\n    print()\n" },
    { name: "Palindrome", code: "text = input(\"Enter text: \")\nrev = \"\"\nfor ch in text:\n    rev = ch + rev\nif text == rev:\n    print(\"Palindrome\")\nelse:\n    print(\"Not a palindrome\")\n" },
    { name: "Max of three", code: "a = int(input(\"a: \"))\nb = int(input(\"b: \"))\nc = int(input(\"c: \"))\nif a >= b and a >= c:\n    print(\"Max is\", a)\nelif b >= a and b >= c:\n    print(\"Max is\", b)\nelse:\n    print(\"Max is\", c)\n" },
    { name: "Sum of digits", code: "num = int(input(\"Enter a number: \"))\ntotal = 0\nwhile num > 0:\n    total += num % 10\n    num = num // 10\nprint(\"Sum of digits:\", total)\n" },
    { name: "Grading (match)", code: "score = int(input(\"Score (0-100): \"))\nmatch score // 10:\n    case 10 | 9:\n        grade = \"A\"\n    case 8:\n        grade = \"B\"\n    case 7:\n        grade = \"C\"\n    case _:\n        grade = \"Needs practice\"\nprint(\"Grade:\", grade)\n" }
  ];
  var DEFAULT_CODE = SAMPLES[0].code;

  /* ---------------- lazy module state ---------------- */
  var pyReady = null, pyodide = null, converterCode = null;
  var mermaidReady = null;
  var editor = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("load failed: " + src)); };
      document.head.appendChild(s);
    });
  }

  function setLoadNote(txt) {
    var n = $("#loadNote");
    if (!txt) { n.hidden = true; return; }
    n.hidden = false; n.textContent = txt;
  }

  function ensurePyodide() {
    if (pyReady) return pyReady;
    setLoadNote("Loading the Python engine (Pyodide) — first time only…");
    pyReady = Promise.all([
      (window.loadPyodide ? Promise.resolve() :
        loadScript("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js")),
      fetch("assets/js/flowchart_ast.py").then(function (r) {
        if (!r.ok) throw new Error("converter fetch failed");
        return r.text();
      }).catch(function () {
        return fetch("flowchart_ast.py").then(function (r) {
          if (!r.ok) throw new Error("converter fetch failed");
          return r.text();
        });
      })
    ]).then(function (parts) {
      converterCode = parts[1];
      return window.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
      });
    }).then(function (py) {
      pyodide = py;
      py.runPython(converterCode);
      setLoadNote("");
      return py;
    }).catch(function (e) {
      pyReady = null;
      setLoadNote("");
      throw e;
    });
    return pyReady;
  }

  /* ---------------- theme helpers ---------------- */
  function isLight() {
    return document.documentElement.getAttribute("data-theme") === "light" ||
      document.body.classList.contains("light");
  }
  function accentHex() {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent").trim();
    return v || "#7c8cff";
  }

  /* ---------------- Mermaid rendering ---------------- */
  function ensureMermaid() {
    if (mermaidReady) return mermaidReady;
    mermaidReady = (window.mermaid ? Promise.resolve()
      : loadScript("https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"))
      .then(function () { initMermaid(); });
    return mermaidReady;
  }

  function initMermaid() {
    if (!window.mermaid) return;
    var light = isLight(), acc = accentHex();
    window.mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      securityLevel: "strict",
      flowchart: { htmlLabels: false, curve: "basis", nodeSpacing: 42, rankSpacing: 46 },
      themeVariables: light ? {
        background: "transparent", primaryColor: "#eef1ff",
        primaryBorderColor: "#b9c2f2", primaryTextColor: "#1b2340",
        secondaryColor: "#e2f5ee", tertiaryColor: "#fdf0d5",
        lineColor: "#5b6ee1", textColor: "#1b2340",
        edgeLabelBackground: "#ffffff"
      } : {
        background: "transparent", primaryColor: "#171d33",
        primaryBorderColor: "#3a4570", primaryTextColor: "#eef1ff",
        secondaryColor: "#12332b", tertiaryColor: "#3d2b12",
        lineColor: acc, textColor: "#eef1ff",
        edgeLabelBackground: "#0e1330"
      }
    });
  }

  var SHAPES = {
    start: ['(["', '"])'], end: ['(["', '"])'],
    io: ['[/"', '"/]'],
    decision: ['{"', '"}'], loop: ['{"', '"}'],
    call: ['[["', '"]]'],
    return: ['(["', '"])'],
    raise: ['[\"', '\"]'],
    unsupported: ['[\"', '\"]'],
    unreachable: ['[\"', '\"]'],
    merge: ['(("', '"))'],
    process: ['["', '"]']
  };

  function mmdLabel(s) {
    /* Mermaid runs with htmlLabels:false, so label text lands in SVG
       <text> verbatim — HTML-escaping here would print literally
       ("while n &gt; 0?"). Escape ONLY what a quoted Mermaid label
       cannot contain raw: the double quote itself (as Mermaid's own
       #quot; entity) — plus the structural characters that would
       break the graph syntax (pipes, brackets). */
    return String(s == null ? "" : s)
      .replace(/"/g, "#quot;")
      .replace(/\|/g, "¦").replace(/[\[\]{}()]/g, " ").replace(/\s+/g, " ").trim();
  }

  function chartToMermaid(chart) {
    var lines = ["flowchart TD"], byId = {};
    chart.nodes.forEach(function (n) { byId[n.id] = n; });
    chart.nodes.forEach(function (n) {
      if (n.kind === "merge") { lines.push("  " + n.id + '(("·"))'); return; }
      var sh = SHAPES[n.kind] || SHAPES.process;
      lines.push("  " + n.id + sh[0] + mmdLabel(n.label || n.kind) + sh[1]);
    });
    chart.edges.forEach(function (e) {
      if (e.kind === "call" || e.kind === "except") return;
      var lab = e.label ? "|" + mmdLabel(e.label) + "|" : "";
      lines.push("  " + e.from + " -->" + lab + " " + e.to);
    });
    lines.push("  classDef fcStart fill:#1d2b12,stroke:#8fce5a,color:#eaffea;");
    lines.push("  classDef fcEnd fill:#2b1212,stroke:#e06c5a,color:#ffeaea;");
    lines.push("  classDef fcDec fill:#3d2b12,stroke:#e8b23a,color:#fff4d6;");
    lines.push("  classDef fcLoop fill:#12332b,stroke:#3ac98f,color:#dcffef;");
    lines.push("  classDef fcIo fill:#14263f,stroke:#4d9de0,color:#e3f2ff;");
    lines.push("  classDef fcCall fill:#241a3f,stroke:#9a7ce0,color:#efe9ff;");
    lines.push("  classDef fcBad fill:#3f1420,stroke:#e05a7a,color:#ffe3ea;");
    lines.push("  classDef fcDim fill:#20242f,stroke:#6b7280,color:#c9cedb,stroke-dasharray:4 3;");
    chart.nodes.forEach(function (n) {
      var cls = null;
      if (n.kind === "start") cls = "fcStart";
      else if (n.kind === "end") cls = "fcEnd";
      else if (n.kind === "decision") cls = "fcDec";
      else if (n.kind === "loop") cls = "fcLoop";
      else if (n.kind === "io") cls = "fcIo";
      else if (n.kind === "call") cls = "fcCall";
      else if (n.kind === "unsupported" || n.kind === "raise") cls = "fcBad";
      else if (n.kind === "unreachable") cls = "fcDim";
      if (cls) lines.push("  class " + n.id + " " + cls + ";");
    });
    return lines.join("\n");
  }

  var renderSeq = 0;
  function renderChart(chart) {
    var seq = ++renderSeq;
    return ensureMermaid().then(function () {
      var code = chartToMermaid(chart);
      var id = "fcSvg" + seq;
      return window.mermaid.render(id, code);
    }).then(function (out) {
      /* a newer render started while this one was in flight — it owns
         the stage now; applying this stale SVG (and re-marking the
         trace from it) would resurrect the previous chart */
      if (seq !== renderSeq) return null;
      var stage = $("#fcStage");
      stage.innerHTML = out.svg;
      var svg = stage.querySelector("svg");
      svg.removeAttribute("height");
      svg.style.maxWidth = "none";
      svg.setAttribute("width", svg.viewBox.baseVal.width || 600);
      state.svgEl = svg;
      applyTransform();
      attachNodeClicks();
      if (state.trace) markTraceFrame();
      fitViewSoon(); /* refit once the new SVG has actually laid out */
      return svg;
    });
  }

  /* ---------------- app state ---------------- */
  var state = {
    ir: null, chart: null, chartByStart: {}, lineToNodes: {},
    scale: 1, tx: 0, ty: 0, svgEl: null,
    trace: null, tracePos: 0, traceTimer: null, tracePlaying: false,
    output: "", inputs: [], generated: false
  };

  function getCode() { return editor ? editor.getValue() : $("#fcCode").value; }
  function setCode(code) {
    if (editor) editor.setValue(code);
    else $("#fcCode").value = code;
  }

  function bumpFlowchartCounter() {
    try {
      var k = "skillzify_flowcharts_done";
      var n = parseInt(localStorage.getItem(k) || "0", 10) || 0;
      localStorage.setItem(k, String(n + 1));
      if (window.SkillzifySync && window.SkillzifySync.markDirty)
        window.SkillzifySync.markDirty("counters");
    } catch (e) { /* private mode: counter is best-effort */ }
  }

  function buildIndexes() {
    state.chartByStart = {}; state.lineToNodes = {};
    state.ir.charts.forEach(function (ch) {
      state.chartByStart[ch.startId] = ch;
      ch.nodes.forEach(function (n) {
        for (var L = n.line; L <= (n.endLine || n.line); L++) {
          (state.lineToNodes[L] = state.lineToNodes[L] || []).push(n);
        }
      });
    });
  }

  function currentChartName() { return state.chart ? state.chart.name : ""; }

  function selectChart(name, opts) {
    var ch = null;
    state.ir.charts.forEach(function (c) { if (c.name === name) ch = c; });
    if (!ch) return null;
    state.chart = ch;
    /* opts.keepTrace: the living trace is following execution into
       this chart — switching must not stop the playback, null the
       trace or hide its panel. Manual chart-tab clicks pass no opts
       and keep the full reset behaviour. */
    if (!(opts && opts.keepTrace)) {
      stopTrace(false);
      state.trace = null;
      $("#tracePanel").hidden = true;
    }
    document.querySelectorAll(".fc-fn-btn").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-chart") === name);
    });
    fitViewSoon();
    var p = renderChart(ch);
    renderStats();
    return p;
  }

  function renderStats() {
    var box = $("#fcStats"); box.innerHTML = "";
    if (!state.chart) { box.hidden = true; return; }
    var s = state.chart.stats;
    var pills = [
      ["Nodes", s.nodes], ["Decisions", s.decisions],
      ["Complexity ≈", s.cyclomatic], ["Max nesting", s.maxNesting]
    ];
    if (state.chart.recursive) pills.push(["Recursive", "yes"]);
    if (state.ir.warnings.length)
      pills.push(["Warnings", state.ir.warnings.length]);
    pills.forEach(function (p) {
      var d = el("span", "fc-stat");
      d.innerHTML = esc(p[0]) + " <b>" + esc(p[1]) + "</b>";
      box.appendChild(d);
    });
    box.hidden = false;
  }

  function renderWarnings() {
    var list = $("#warnList"); list.innerHTML = "";
    var ws = state.ir ? state.ir.warnings : [];
    $("#warnCard").hidden = !ws.length;
    ws.forEach(function (w) {
      if (w.type === "comment") return;
      var li = el("li");
      li.innerHTML = icon("warn", 14) + " <span></span>";
      li.querySelector("span").textContent =
        (w.line ? "Line " + w.line + ": " : "") + w.text;
      list.appendChild(li);
    });
    if (!list.children.length) $("#warnCard").hidden = true;
  }

  function renderFnBar() {
    var bar = $("#fnBar"); bar.innerHTML = "";
    if (!state.ir || state.ir.charts.length <= 1) { bar.hidden = true; return; }
    state.ir.charts.forEach(function (ch) {
      var b = el("button", "fc-fn-btn" + (ch === state.chart ? " on" : ""),
        ch.kind === "main" ? "<main>" : ch.name + "()");
      b.type = "button";
      b.setAttribute("data-chart", ch.name);
      b.addEventListener("click", function () { selectChart(ch.name); });
      bar.appendChild(b);
    });
    bar.hidden = false;
  }

  function generate() {
    var btn = $("#btnGenerate");
    btn.disabled = true;
    hideToast();
    $("#genErr").hidden = true;
    return ensurePyodide().then(function (py) {
      var code = getCode();
      var json = py.globals.get("flowchart_ir")(code);
      var ir = JSON.parse(json);
      if (!ir.success) {
        var e = ir.error || {};
        var box = $("#genErr");
        box.hidden = false;
        box.innerHTML = "";
        var t = el("div", "fc-err-title");
        t.innerHTML = icon("warn", 16) + " <span></span>";
        t.querySelector("span").textContent =
          "Python syntax error" + (e.line ? " on line " + e.line : "");
        var p = el("p", null, e.message || "Could not parse this code.");
        var hint = el("p", "fc-err-hint",
          "Fix the line, then generate again — the chart is never guessed from broken code.");
        box.appendChild(t); box.appendChild(p); box.appendChild(hint);
        if (editor && e.line) {
          editor.setSelection({ line: e.line - 1, ch: 0 },
            { line: e.line - 1, ch: (editor.getLine(e.line - 1) || "").length });
          editor.focus();
        }
        return null;
      }
      state.ir = ir;
      buildIndexes();
      renderInputRows();
      bumpFlowchartCounter();
      state.output = ""; state.trace = null; state.generated = true;
      $("#tracePanel").hidden = true;
      $("#outputBox").textContent = "";
      $("#outputEmpty").hidden = false;
      var main = ir.charts[0];
      state.chart = main;
      renderFnBar(); renderStats(); renderWarnings();
      return renderChart(main).then(function () {
        fitView();
        toast("Flowchart generated — " + main.stats.nodes + " nodes, " +
          main.stats.decisions + " decisions.");
      });
    }).catch(function (err) {
      toast("Generation failed: " + (err && err.message ? err.message : err));
      return null;
    }).then(function (r) { btn.disabled = false; return r; });
  }

  /* ---------------- zoom / pan / node<->editor sync ----------------
     MEASURED fit (round 3): the round-2 fit computed from viewBox
     numbers and the host's client size, yet live the chart still
     landed pushed-right and clipped with Fit apparently dead — the
     inputs to that math could not be trusted. Fit now MEASURES what
     the browser actually laid out: reset the transform, read the
     rendered SVG's rect, the wrap's rect and the host's rect via
     getBoundingClientRect, and solve the transform (origin 0 0 on
     #fcWrap) that moves the SVG's centre onto the host's centre at a
     scale fitting BOTH dimensions. One correction pass runs if the
     centred rect still overflows the host by more than 2px. */
  function fitFromRects(host, wrap, content, scaleOverride) {
    if (!host || !wrap || !content || !content.width || !content.height ||
        !host.width || !host.height)
      return { scale: 1, tx: 0, ty: 0 };
    var s = (typeof scaleOverride === "number" && scaleOverride > 0)
      ? scaleOverride
      : Math.min(host.width / content.width, host.height / content.height);
    s = Math.min(1.5, Math.max(0.05, s));
    var ccx = content.left + content.width / 2;
    var ccy = content.top + content.height / 2;
    var hcx = host.left + host.width / 2;
    var hcy = host.top + host.height / 2;
    /* a wrap-local point q lands at viewport x = wrap.left + tx +
       s*(q - wrap.left); solve tx/ty so the content centre lands
       exactly on the host centre */
    return {
      scale: s,
      tx: hcx - wrap.left - s * (ccx - wrap.left),
      ty: hcy - wrap.top - s * (ccy - wrap.top)
    };
  }
  function zoomFromMeasure(st, f, wrapRect, hostRect) {
    /* zoom toward the HOST CENTRE, measured the same way: the content
       point currently under the host centre stays under it. wrapRect
       is the wrap's rect WITH the current transform applied, so the
       wrap's untransformed origin is (wrapRect.left - tx,
       wrapRect.top - ty). */
    if (!st || !st.scale || !wrapRect || !hostRect)
      return { scale: st ? st.scale : 1, tx: st ? st.tx : 0, ty: st ? st.ty : 0 };
    var s2 = Math.min(3, Math.max(0.05, st.scale * f));
    var wx = wrapRect.left - st.tx, wy = wrapRect.top - st.ty;
    var hcx = hostRect.left + hostRect.width / 2;
    var hcy = hostRect.top + hostRect.height / 2;
    var qx = (hcx - (wx + st.tx)) / st.scale;
    var qy = (hcy - (wy + st.ty)) / st.scale;
    return { scale: s2, tx: hcx - s2 * qx - wx, ty: hcy - s2 * qy - wy };
  }
  function applyTransform() {
    var w = $("#fcWrap");
    if (w) w.style.transform = "translate(" + state.tx + "px," + state.ty +
      "px) scale(" + state.scale + ")";
  }
  function fitView() {
    var svg = state.svgEl, host = $("#fcScroll"), wrap = $("#fcWrap");
    if (!svg || !host || !wrap) return;
    var prev = wrap.style.transform;
    wrap.style.transform = "none";
    var hr = host.getBoundingClientRect();
    var wr = wrap.getBoundingClientRect();
    var cr = svg.getBoundingClientRect();
    if (!cr.width || !cr.height || !hr.width || !hr.height) {
      wrap.style.transform = prev;
      return;
    }
    var f = fitFromRects(hr, wr, cr);
    state.scale = f.scale; state.tx = f.tx; state.ty = f.ty;
    applyTransform();
    /* one correction pass: shrink once (and re-centre from the same
       untransformed measurements) if the centred rect still
       overflows the host by more than 2px */
    var r1 = svg.getBoundingClientRect();
    if (r1.width > hr.width + 2 || r1.height > hr.height + 2) {
      var k = Math.min(hr.width / r1.width, hr.height / r1.height);
      if (k < 1) {
        var f2 = fitFromRects(hr, wr, cr, state.scale * k);
        state.scale = f2.scale; state.tx = f2.tx; state.ty = f2.ty;
        applyTransform();
      }
    }
  }
  function fitViewSoon() {
    if (typeof window !== "undefined" && window.requestAnimationFrame)
      window.requestAnimationFrame(function () { fitView(); });
    else setTimeout(fitView, 30);
  }
  function zoomBy(f) {
    var host = $("#fcScroll"), wrap = $("#fcWrap");
    if (!host || !wrap) return;
    var z = zoomFromMeasure(state, f,
      wrap.getBoundingClientRect(), host.getBoundingClientRect());
    state.scale = z.scale; state.tx = z.tx; state.ty = z.ty;
    applyTransform();
  }

  function initPan() {
    var host = $("#fcScroll"), drag = null;
    host.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".fc-node-click")) return;
      drag = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty };
      host.setPointerCapture(e.pointerId);
    });
    host.addEventListener("pointermove", function (e) {
      if (!drag) return;
      state.tx = drag.tx + (e.clientX - drag.x);
      state.ty = drag.ty + (e.clientY - drag.y);
      applyTransform();
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      host.addEventListener(ev, function () { drag = null; });
    });
    host.addEventListener("wheel", function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.1 : 0.9);
    }, { passive: false });
  }

  function editorLineFor(node) { return node && node.line ? node.line : 0; }
  function highlightEditorLine(line) {
    if (!editor || !line) return;
    editor.setSelection({ line: line - 1, ch: 0 },
      { line: line - 1, ch: (editor.getLine(line - 1) || "").length });
    editor.scrollIntoView({ line: line - 1, ch: 0 }, 120);
  }
  function nodeElById(id) {
    if (!state.svgEl) return null;
    var g = state.svgEl.querySelector("#" + CSS.escape(id));
    return g ? g.closest("g.node") || g : null;
  }
  function flashNode(id) {
    var g = nodeElById(id);
    if (!g) return;
    g.classList.remove("fc-flash");
    void g.getBoundingClientRect();
    g.classList.add("fc-flash");
    setTimeout(function () { g.classList.remove("fc-flash"); }, 1600);
  }

  function attachNodeClicks() {
    if (!state.svgEl || !state.chart) return;
    state.chart.nodes.forEach(function (n) {
      var g = nodeElById(n.id);
      if (!g) return;
      g.classList.add("fc-node-click");
      g.addEventListener("click", function () {
        var line = editorLineFor(n);
        if (line) highlightEditorLine(line);
        flashNode(n.id);
      });
    });
  }

  function onEditorCursor() {
    if (!editor || !state.chart || state.trace) return;
    var line = editor.getCursor().line + 1;
    var nodes = (state.lineToNodes[line] || []).filter(function (n) {
      return isNodeInChart(n, state.chart);
    });
    if (nodes.length) flashNode(nodes[0].id);
  }
  function isNodeInChart(node, chart) {
    return chart.nodes.some(function (n) { return n.id === node.id; });
  }

  /* ---------------- living trace ---------------- */
  var TRACE_PY = [
    "import sys, json",
    "MAXS = 2000",
    "REPR_CAP = 60",
    "_steps = []",
    "_truncated = [False]",
    "# _exclude holds the injected input() shim; _snap also drops any",
    "# _-prefixed name — tracer machinery must never pose as a user var",
    "_exclude = {'input'}",
    "def _snap(frame):",
    "    out = {}",
    "    try:",
    "        items = list(frame.f_locals.items())",
    "    except Exception:",
    "        return out",
    "    for k, v in items[:24]:",
    "        if k in _exclude or k.startswith('_'):",
    "            continue",
    "        try:",
    "            r = repr(v)",
    "        except Exception:",
    "            r = '<unprintable>'",
    "        if len(r) > REPR_CAP:",
    "            r = r[:REPR_CAP - 1] + '…'",
    "        out[k] = r",
    "    return out",
    "class _TraceCap(Exception):",
    "    pass",
    "def _tracer(frame, event, arg):",
    "    if frame.f_code.co_filename != '<skillzify>':",
    "        return None",
    "    if event not in ('line', 'return', 'exception'):",
    "        return _tracer",
    "    if len(_steps) >= MAXS:",
    "        _truncated[0] = True",
    "        raise _TraceCap()",
    "    _steps.append({'line': frame.f_lineno, 'event': event,",
    "                   'func': frame.f_code.co_name, 'vars': _snap(frame)})",
    "    return _tracer",
    "def run_traced(src, feed):",
    "    _steps.clear()",
    "    _truncated[0] = False",
    "    lines = list(feed)",
    "    pos = [0]",
    "    def fake_input(prompt=''):",
    "        sys.stdout.write(str(prompt))",
    "        if pos[0] < len(lines):",
    "            v = lines[pos[0]]; pos[0] += 1",
    "        else:",
    "            v = ''",
    "        sys.stdout.write(v + '\\n')",
    "        return v",
    "    import builtins",
    "    g = {'__name__': '__main__', 'input': fake_input}",
    "    err = None",
    "    sys.settrace(_tracer)",
    "    try:",
    "        exec(compile(src, '<skillzify>', 'exec'), g)",
    "    except _TraceCap:",
    "        err = None",
    "    except BaseException as e:",
    "        err = type(e).__name__ + ': ' + str(e)",
    "    finally:",
    "        sys.settrace(None)",
    "    return json.dumps({'steps': _steps, 'truncated': _truncated[0],",
    "                       'error': err})"
  ].join("\n");

  function setStdout(py) {
    var buf = { s: "" };
    py.setStdout({ batched: function (t) { buf.s += t + "\n"; } });
    py.setStderr({ batched: function (t) { buf.s += t + "\n"; } });
    return buf;
  }

  function collectInputs() {
    var raws = document.querySelectorAll(".fc-input-line");
    var out = [];
    raws.forEach(function (i) { out.push(i.value); });
    return out;
  }
  function usesInput() { return /\binput\s*\(/.test(getCode()); }

  function runTrace() {
    if (!state.generated) {
      toast("Generate the flowchart first — the trace walks the chart you see.");
      return;
    }
    hideToast();
    var needs = (state.ir && state.ir.inputs)
      ? state.ir.inputs.length > 0 : usesInput();
    var feed = needs ? collectInputs() : [];
    if (needs && !document.querySelectorAll(".fc-input-line").length) {
      renderInputRows();
      toast("This program asks for input — fill in the values it should receive, then run.");
      $("#inputsBox").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    $("#btnTrace").disabled = true;
    ensurePyodide().then(function (py) {
      var buf = setStdout(py);
      py.runPython(TRACE_PY);
      var json = py.globals.get("run_traced")(getCode(), feed);
      var data = JSON.parse(json);
      state.output = buf.s;
      $("#outputBox").textContent = buf.s || "";
      $("#outputEmpty").hidden = !!buf.s;
      startTracePlayback(data);
    }).catch(function (err) {
      /* a failed run must be visible where the user is looking —
         the output box AND the trace panel — not only as a toast */
      var msg = "Run failed: " + (err && err.message ? err.message : err);
      toast(msg);
      state.output = msg;
      $("#outputBox").textContent = msg;
      $("#outputEmpty").hidden = true;
      showTraceNote(msg);
    }).then(function () { $("#btnTrace").disabled = false; });
  }

  /* Unhide the trace panel carrying only a message (a completed run
     with nothing to step through, or a failed run): the panel is the
     trace's home, so its states are always visible there. */
  function showTraceNote(msg) {
    stopTrace(false);
    state.trace = null;
    $("#tracePanel").hidden = false;
    $("#traceRange").max = "0";
    $("#traceRange").value = "0";
    $("#traceCount").textContent = "Step 0 / 0";
    $("#traceWhere").textContent = "";
    var tv = $("#traceVars");
    tv.innerHTML = "";
    tv.appendChild(el("p", "fc-muted", msg));
  }

  function inferLineChart(ir, funcName) {
    if (!ir) return null;
    if (funcName === "<module>") return ir.charts[0];
    var found = null;
    ir.charts.forEach(function (c) { if (c.name === funcName) found = c; });
    return found;
  }

  function startTracePlayback(data) {
    stopTrace(false);
    state.trace = null;
    var steps = (data && data.steps) || [];
    if (!steps.length) {
      /* a completed trace ALWAYS lands in the panel — even with no
         steps — so a silent run can never look like a dead button */
      showTraceNote(data && data.error
        ? "The program stopped with an error before any line could be traced: " + data.error
        : "No steps captured — the run finished without executing any traceable lines.");
      if (data && data.error) toast("Program error during run: " + data.error);
      $("#tracePanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    state.trace = { steps: steps, truncated: data.truncated, error: data.error };
    state.tracePos = 0;
    $("#tracePanel").hidden = false;
    $("#traceRange").max = String(steps.length - 1);
    $("#traceRange").value = "0";
    if (data.truncated)
      toast("Trace stopped at 2,000 steps (safety cap) — the walkthrough is partial.");
    if (data.error) toast("Program error during run: " + data.error);
    showTraceStep(0);
    if (data.error) {
      var tv = $("#traceVars");
      tv.insertBefore(el("p", "fc-muted",
        "⚠ This run ended with an error: " + data.error), tv.firstChild);
    }
    $("#tracePanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function stepChart(step) {
    return inferLineChart(state.ir, step.func);
  }

  function stepNode(step) {
    /* PURE: resolve a step to its node within the step's OWN chart —
       no DOM writes, no state changes, and above all no selectChart
       call. (Round-2 bug: this switched charts as a side effect, and
       selectChart reset the trace, so stepping into a function —
       Factorial step 4 — destroyed the trace it was walking.)
       Chart-following is decided once per step change, in
       showTraceStep alone. */
    var ch = stepChart(step);
    if (!ch) return null;
    var nodes = (state.lineToNodes[step.line] || []).filter(function (n) {
      return isNodeInChart(n, ch);
    });
    return nodes.length ? nodes[0] : null;
  }

  function clearTraceMarks() {
    if (!state.svgEl) return;
    state.svgEl.querySelectorAll(".fc-trace-current,.fc-trace-done,.fc-trace-dim")
      .forEach(function (g) {
        g.classList.remove("fc-trace-current", "fc-trace-done", "fc-trace-dim");
      });
    state.svgEl.querySelectorAll(".fc-edge-done").forEach(function (p) {
      p.classList.remove("fc-edge-done");
    });
  }

  function edgePathEl(a, b) {
    if (!state.svgEl) return null;
    var sel = 'path[id^="L-' + a + "-" + b + '"]';
    return state.svgEl.querySelector(sel) ||
      state.svgEl.querySelector('path[id*="' + a + "-" + b + '"]');
  }

  function markTraceFrame() {
    if (!state.trace || !state.chart) return;
    clearTraceMarks();
    var steps = state.trace.steps, upto = state.tracePos;
    var seen = {}, prevNode = null;
    for (var i = 0; i <= upto && i < steps.length; i++) {
      /* only steps belonging to the DISPLAYED chart can mark it;
         steps in other charts contribute nothing visible (and must
         never trigger a chart switch from inside this loop) */
      var sch = stepChart(steps[i]);
      if (!sch || sch.name !== state.chart.name) { prevNode = null; continue; }
      var n = stepNode(steps[i]);
      if (!n) continue;
      seen[n.id] = true;
      if (prevNode && prevNode.id !== n.id) {
        var p = edgePathEl(prevNode.id, n.id);
        if (p) p.classList.add("fc-edge-done");
      }
      prevNode = n;
    }
    var cur = stepNode(steps[upto]);
    state.chart.nodes.forEach(function (n) {
      var g = nodeElById(n.id);
      if (!g) return;
      if (cur && n.id === cur.id) g.classList.add("fc-trace-current");
      else if (seen[n.id]) g.classList.add("fc-trace-done");
      else g.classList.add("fc-trace-dim");
    });
    renderLoopBadges(steps, upto);
  }

  function loopCounts(steps, upto) {
    var counts = {};
    for (var i = 0; i <= upto && i < steps.length; i++) {
      var sch = stepChart(steps[i]);
      if (!sch || !state.chart || sch.name !== state.chart.name) continue;
      var n = stepNode(steps[i]);
      if (n && (n.kind === "loop" || n.kind === "decision"))
        counts[n.id] = (counts[n.id] || 0) + 1;
    }
    return counts;
  }

  function renderLoopBadges(steps, upto) {
    if (!state.svgEl) return;
    state.svgEl.querySelectorAll(".fc-loop-badge").forEach(function (b) {
      b.remove();
    });
    var counts = loopCounts(steps, upto);
    Object.keys(counts).forEach(function (id) {
      if (counts[id] < 2) return;
      var g = nodeElById(id);
      if (!g) return;
      try {
        var bb = g.getBBox();
        var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", bb.x + bb.width + 6);
        t.setAttribute("y", bb.y + 4);
        t.setAttribute("class", "fc-loop-badge");
        t.textContent = "×" + counts[id];
        g.appendChild(t);
      } catch (e) { /* SVG not laid out yet */ }
    });
  }

  function showTraceStep(i) {
    if (!state.trace) return;
    var steps = state.trace.steps;
    state.tracePos = Math.max(0, Math.min(steps.length - 1, i));
    var st = steps[state.tracePos];
    $("#traceRange").value = String(state.tracePos);
    $("#traceCount").textContent = "Step " + (state.tracePos + 1) +
      " / " + steps.length;
    $("#traceWhere").textContent = "Line " + st.line + " · " + st.func +
      " · " + st.event + (state.trace.truncated ? " · truncated at 2,000" : "");
    var tbl = $("#traceVars");
    tbl.innerHTML = "";
    var keys = Object.keys(st.vars || {});
    if (!keys.length) {
      tbl.innerHTML = '<p class="fc-muted">No variables in scope at this step.</p>';
    } else {
      var table = el("table", "fc-vartable");
      keys.forEach(function (k) {
        var tr = el("tr");
        var td1 = el("td", "fc-vname", k);
        var td2 = el("td", "fc-vval", st.vars[k]);
        tr.appendChild(td1); tr.appendChild(td2);
        table.appendChild(tr);
      });
      tbl.appendChild(table);
    }
    /* chart-follow, decided ONCE per step change: if this step lives
       in another chart, switch to it keeping the trace alive.
       renderChart re-runs markTraceFrame when the new chart lands
       (state.trace is set), so that render path is the single
       marking route for switched charts — marking here too would
       paint the OLD chart's svg, which is about to be replaced. */
    var ch = stepChart(st);
    if (ch && ch.name !== currentChartName()) {
      selectChart(ch.name, { keepTrace: true });
      var fn = stepNode(st);
      if (fn && editor) highlightEditorLine(fn.line);
      return;
    }
    markTraceFrame();
    var node = stepNode(st);
    if (node && editor) highlightEditorLine(node.line);
  }

  function stopTrace(clearMarks) {
    if (state.traceTimer) { clearInterval(state.traceTimer); state.traceTimer = null; }
    state.tracePlaying = false;
    var b = $("#btnPlay");
    if (b) b.innerHTML = icon("play", 16);
    if (clearMarks !== false) clearTraceMarks();
  }

  function togglePlay() {
    if (!state.trace) return;
    if (state.tracePlaying) { stopTrace(false); return; }
    state.tracePlaying = true;
    $("#btnPlay").innerHTML = icon("pause", 16);
    var speed = parseFloat($("#traceSpeed").value || "1");
    state.traceTimer = setInterval(function () {
      if (!state.trace) { stopTrace(false); return; }
      if (state.tracePos >= state.trace.steps.length - 1) {
        stopTrace(false); return;
      }
      showTraceStep(state.tracePos + 1);
    }, Math.max(120, 650 / speed));
  }

  /* ---------------- exports ---------------- */
  function serializeSvg(bgMode) {
    if (!state.svgEl) return null;
    var clone = state.svgEl.cloneNode(true);
    clone.classList.remove("fc-anim");
    clone.querySelectorAll(".fc-trace-current,.fc-trace-done,.fc-trace-dim,.fc-flash")
      .forEach(function (g) {
        g.classList.remove("fc-trace-current", "fc-trace-done", "fc-trace-dim", "fc-flash");
      });
    var css = "";
    document.querySelectorAll("style").forEach(function (s) {
      var t = s.textContent || "";
      if (t.indexOf("fc-trace") >= 0 || t.indexOf(".node") >= 0 || t.indexOf("mermaid") >= 0)
        css += t + "\n";
    });
    var styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = css + "\ntext{font-family:Inter,system-ui,sans-serif}";
    clone.insertBefore(styleEl, clone.firstChild);
    var vb = clone.viewBox.baseVal;
    var w = vb.width || 800, h = vb.height || 600;
    clone.setAttribute("width", w); clone.setAttribute("height", h);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (bgMode !== "transparent") {
      var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", vb.x || 0); rect.setAttribute("y", vb.y || 0);
      rect.setAttribute("width", w); rect.setAttribute("height", h);
      rect.setAttribute("fill", bgMode === "white" ? "#ffffff" : "#0b1026");
      clone.insertBefore(rect, styleEl.nextSibling);
    }
    var str = new XMLSerializer().serializeToString(clone);
    return { str: str, w: w, h: h };
  }

  function needChart() {
    if (!state.generated || !state.svgEl) {
      toast("Generate a flowchart first — then export it.");
      return false;
    }
    return true;
  }

  function downloadBlob(blob, name) {
    var a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function chartBaseName() {
    var n = currentChartName();
    return "flowchart-" + (n === "<main>" ? "main" : n);
  }

  function svgToPngBlob(data, scale, cb) {
    var url = URL.createObjectURL(new Blob([data.str],
      { type: "image/svg+xml;charset=utf-8" }));
    var img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement("canvas");
        c.width = Math.round(data.w * scale);
        c.height = Math.round(data.h * scale);
        var ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { cb(b); }, "image/png");
      } catch (e) { cb(null); }
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  function exportPng(scale) {
    if (!needChart()) return;
    var bg = $("#bgSelect").value;
    var data = serializeSvg(bg);
    if (!data) { toast("Nothing to export yet."); return; }
    svgToPngBlob(data, scale || 2, function (blob) {
      if (!blob) {
        toast("PNG export hit a browser limit — try the SVG export, it is lossless.");
        return;
      }
      downloadBlob(blob, chartBaseName() + "@" + (scale || 2) + "x.png");
      toast("PNG saved (" + (scale || 2) + "×, " + bg + " background).");
    });
  }

  function exportSvg() {
    if (!needChart()) return;
    var data = serializeSvg($("#bgSelect").value);
    if (!data) return;
    downloadBlob(new Blob([data.str], { type: "image/svg+xml" }),
      chartBaseName() + ".svg");
    toast("SVG saved — scales cleanly at any size.");
  }

  function copyImage() {
    if (!needChart()) return;
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {
      toast("This browser cannot copy images — use PNG export instead.");
      return;
    }
    var data = serializeSvg("white");
    svgToPngBlob(data, 2, function (blob) {
      if (!blob) { toast("Copy failed — PNG export will work instead."); return; }
      var item = {};
      item["image/png"] = blob;
      navigator.clipboard.write([new ClipboardItem(item)]).then(function () {
        toast("Chart image copied — paste it into Word, Docs or Slides.");
      }).catch(function () {
        toast("Copy was blocked by the browser — PNG export will work instead.");
      });
    });
  }

  /* Lab Sheet: a print-mode restyle of THIS page (print CSS in
     flowchart.css hides app chrome and lays out title/code/chart/output). */
  function openLabSheet() {
    if (!needChart()) return;
    var title = $("#sheetTitle").value.trim() || "Flowchart Lab Sheet";
    $("#printTitle").textContent = title;
    $("#printCode").textContent = getCode();
    $("#printOutput").textContent = state.output || "(run the trace to capture output)";
    var host = $("#printChart");
    host.innerHTML = "";
    var data = serializeSvg("white");
    if (data) host.innerHTML = data.str;
    document.body.classList.add("fc-printing");
    var done = function () {
      document.body.classList.remove("fc-printing");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    setTimeout(function () { window.print(); }, 60);
  }

  /* ---------------- AI layer ---------------- */
  function structureSummary() {
    if (!state.chart) return "";
    var parts = ["Chart: " + state.chart.title,
      "Stats: " + JSON.stringify(state.chart.stats)];
    state.chart.nodes.forEach(function (n) {
      parts.push("  " + n.kind.toUpperCase() + " (line " + n.line + "): " + n.label);
    });
    state.chart.edges.forEach(function (e) {
      if (e.kind === "call" || e.kind === "except") return;
      parts.push("  " + e.from + " -> " + e.to +
        (e.label ? " [" + e.label + "]" : "") + (e.back ? " (back-edge)" : ""));
    });
    return parts.join("\n");
  }

  function aiAsk(mode, prompt, boxId) {
    var box = $(boxId);
    box.hidden = false;
    box.innerHTML = '<p class="fc-muted">Thinking…</p>';
    if (!window.SkillzifyAI || typeof window.SkillzifyAI.ask !== "function") {
      box.innerHTML = '<p class="fc-muted">The AI tutor is not available ' +
        'on this page right now. The chart, trace and static checks still work.</p>';
      return;
    }
    var code = getCode();
    /* SkillzifyAI.ask is callback-style across the whole site:
       ask(opts, function (err, res)) with res.text on success and a
       friendly { code, message } error otherwise (ai.js v23). */
    window.SkillzifyAI.ask({
      mode: mode, code: code, context: prompt,
      stage: "flowchart_" + mode
    }, function (err, ans) {
      if (err) {
        box.innerHTML = '<p class="fc-muted"></p>';
        box.firstChild.textContent =
          (err && err.message) ? err.message : aiErrText(err || {});
        return;
      }
      if (ans && typeof ans.text === "string" && ans.text.trim()) {
        box.innerHTML = "";
        box.appendChild(el("div", "fc-ai-text", ans.text));
      } else {
        box.innerHTML = '<p class="fc-muted">No answer came back — try again.</p>';
      }
    });
  }

  function aiErrText(ans) {
    var c = ans.code || ans.error || "";
    if (String(c).indexOf("CAP") >= 0 || String(c).indexOf("429") >= 0)
      return "You have reached today's AI limit for this account. " +
        "The chart, trace and static checks are unlimited — come back tomorrow for more AI help.";
    if (String(c).indexOf("OFF") >= 0 || String(c).indexOf("UNAVAILABLE") >= 0)
      return "The AI backend is off right now. Everything else on this page still works.";
    return "The AI tutor returned an error (" + c + "). Try again in a moment.";
  }

  /* No-chart feedback for the AI buttons: a transient toast alone is
     easy to miss, so the message also lands in the AI panel itself,
     where the user is looking, and stays until replaced. */
  function aiNeedsChart() {
    toast("Generate a flowchart first.");
    var box = $("#aiOut");
    box.hidden = false;
    box.innerHTML = '<p class="fc-muted">Generate a flowchart first — ' +
      'then the AI can explain it and check its logic.</p>';
  }

  function aiExplain() {
    if (!state.generated) { aiNeedsChart(); return; }
    aiAsk("explain",
      "Explain this flowchart in plain English for a beginner. Walk through " +
      "the flow step by step using the structure below, mention loops and " +
      "decisions in words, and end with one sentence on what the program " +
      "achieves.\n\n" + structureSummary(), "#aiOut");
  }

  function aiCheckLogic() {
    if (!state.generated) { aiNeedsChart(); return; }
    var stat = state.ir.warnings.filter(function (w) {
      return w.type !== "comment";
    }).map(function (w) { return "- " + w.text; }).join("\n");
    aiAsk("logic_check",
      "Review this program's logic using its flowchart structure. Look for: " +
      "loops that may not terminate, branches that can never run, conditions " +
      "that look inverted, off-by-one risks, and inputs that break it. Be " +
      "specific with line numbers. If it looks correct, say so plainly.\n\n" +
      "Static findings already detected:\n" + (stat || "(none)") +
      "\n\nStructure:\n" + structureSummary(), "#aiOut");
  }

  /* ---------------- share links (#fc=, legacy-compatible) ----------
     The old Lab's share format: "#fc=" + base64(utf8 JSON {mode,
     input}) with mode code|algo|question. Links already shared or
     bookmarked must keep opening here: code loads directly; the
     retired algo/question tabs are converted to Python through the
     same AI modes the old page itself used ('flowchart-code' /
     'flowchart'), then charted. New outbound links are code-only. */
  function copyTextFallback(text, done) {
    try {
      var ta = el("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      done();
    } catch (e) {
      toast("Copy was blocked by the browser — copy the link from the address bar instead.");
    }
  }

  function shareLink() {
    try {
      var payload = btoa(unescape(encodeURIComponent(JSON.stringify(
        { mode: "code", input: getCode() }))));
      // Same guard as the old page (P2-35): a multi-KB payload exceeds
      // practical URL limits and silently fails to open elsewhere.
      if (payload.length > 2000) {
        toast("Share link too long (" + payload.length +
          " characters) — shorten the code, or export the flowchart instead.");
        return;
      }
      var url = location.origin + location.pathname + "#fc=" + payload;
      var done = function () {
        toast("Share link copied — anyone opening it sees your code.");
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () {
          copyTextFallback(url, done);
        });
      } else {
        copyTextFallback(url, done);
      }
    } catch (e) { toast("Share failed — try the export options instead."); }
  }

  function loadFromHash() {
    if (!location.hash || location.hash.indexOf("#fc=") !== 0) return false;
    var d;
    try {
      d = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(4)))));
      if (!d || typeof d.input !== "string" || !d.input)
        throw new Error("bad share link");
    } catch (e) {
      // P2-35: a present-but-undecodable hash must not fail silently.
      toast("That share link could not be read — it may be incomplete.");
      return false;
    }
    var mode = ["code", "algo", "question"].indexOf(d.mode) >= 0 ? d.mode : "code";
    if (mode === "code") {
      setCode(d.input);
      toast("Shared code loaded — generating its flowchart…");
      generate();
      return true;
    }
    if (!window.SkillzifyAI || typeof window.SkillzifyAI.ask !== "function") {
      toast("This shared link needs the AI tutor to convert it — unavailable right now.");
      return false;
    }
    toast("Shared link loaded — converting it to code…");
    window.SkillzifyAI.ask(
      { mode: mode === "question" ? "flowchart" : "flowchart-code", code: d.input },
      function (err, res) {
        if (err || !res || !res.text) {
          toast("Could not convert that shared link" +
            (err && err.message ? ": " + err.message : "."));
          return;
        }
        var code = res.text.replace(/```python\n?/gi, "")
          .replace(/```\n?/g, "").trim();
        if (!code) { toast("The AI returned no code for that shared link."); return; }
        setCode(code);
        generate();
      });
    return true;
  }

  /* ---------------- samples / inputs UI ---------------- */
  function renderSamples() {
    var pop = $("#samplesPop"); pop.innerHTML = "";
    SAMPLES.forEach(function (s) {
      var b = el("button", "fc-sample", s.name);
      b.type = "button";
      b.addEventListener("click", function () {
        setCode(s.code);
        pop.hidden = true;
        toast("Sample loaded: " + s.name + " — press Generate flowchart.");
      });
      pop.appendChild(b);
    });
  }

  /* One row per input() call site, derived from the converter's IR
     spec (assets/js/flowchart_ast.py _input_spec): labelled with the
     call's own prompt when it is a static string. Extra rows can
     still be added by hand for loops that call input() repeatedly. */
  function inputLabels(spec) {
    return (spec || []).map(function (s, i) {
      if (s.prompt) return s.prompt.replace(/\s+$/, "");
      if (s.prompt === "") return "input() #" + (i + 1) + " (no prompt)";
      return "input() #" + (i + 1) + " (prompt written by the program)";
    });
  }

  function renderInputRows() {
    /* preserve the values already typed, by row index, across the
       rebuild — Generate re-renders the rows from the IR spec and
       must not wipe what the user entered for the trace */
    var prev = collectInputs();
    var box = $("#inputsList");
    box.innerHTML = "";
    inputLabels(state.ir ? state.ir.inputs : []).forEach(function (lab, i) {
      var inp = addInputRow(lab);
      if (inp && i < prev.length) inp.value = prev[i];
    });
  }

  function addInputRow(label) {
    var box = $("#inputsList");
    var row = el("div", "fc-input-row");
    if (label) row.appendChild(el("span", "fc-input-label", label));
    var inp = el("input", "fc-input-line");
    inp.type = "text";
    inp.placeholder = "value for input() call #" + (box.children.length + 1);
    var rm = el("button", "fc-mini danger", "Remove");
    rm.type = "button";
    rm.addEventListener("click", function () { row.remove(); });
    row.appendChild(inp); row.appendChild(rm);
    box.appendChild(row);
    return inp;
  }

  /* ---------------- editor ---------------- */
  function initEditor() {
    var ta = $("#fcCode");
    if (!window.CodeMirror) { ta.hidden = false; return; }
    editor = window.CodeMirror.fromTextArea(ta, {
      mode: "python", theme: "dracula", lineNumbers: true,
      indentUnit: 4, tabSize: 4, viewportMargin: Infinity
    });
    editor.setValue(DEFAULT_CODE);
    editor.on("cursorActivity", onEditorCursor);
    var mo = new MutationObserver(function () {
      initMermaid();
      if (state.chart) renderChart(state.chart);
    });
    mo.observe(document.documentElement,
      { attributes: true, attributeFilter: ["data-theme", "data-accent"] });
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    $("#btnGenerate").addEventListener("click", generate);
    $("#btnTrace").addEventListener("click", runTrace);
    $("#btnSamples").addEventListener("click", function () {
      var p = $("#samplesPop"); p.hidden = !p.hidden;
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".fc-samples-wrap")) $("#samplesPop").hidden = true;
    });
    $("#btnClear").addEventListener("click", function () { setCode(""); });
    $("#btnZoomIn").addEventListener("click", function () { zoomBy(1.2); });
    $("#btnZoomOut").addEventListener("click", function () { zoomBy(0.85); });
    $("#btnFit").addEventListener("click", fitView);
    $("#btnPng2").addEventListener("click", function () { exportPng(2); });
    $("#btnPng3").addEventListener("click", function () { exportPng(3); });
    $("#btnSvg").addEventListener("click", exportSvg);
    $("#btnCopyImg").addEventListener("click", copyImage);
    $("#btnSheet").addEventListener("click", openLabSheet);
    $("#btnShare").addEventListener("click", shareLink);
    $("#btnExplain").addEventListener("click", aiExplain);
    $("#btnLogic").addEventListener("click", aiCheckLogic);
    $("#btnPrev").addEventListener("click", function () { stopTrace(false); showTraceStep(state.tracePos - 1); });
    $("#btnNext").addEventListener("click", function () { stopTrace(false); showTraceStep(state.tracePos + 1); });
    $("#btnPlay").addEventListener("click", togglePlay);
    $("#btnRestart").addEventListener("click", function () { stopTrace(false); showTraceStep(0); });
    $("#traceRange").addEventListener("input", function (e) {
      stopTrace(false); showTraceStep(parseInt(e.target.value, 10) || 0);
    });
    $("#traceSpeed").addEventListener("change", function () {
      if (state.tracePlaying) { stopTrace(false); togglePlay(); }
    });
    $("#btnAddInput").addEventListener("click", function () { addInputRow().focus(); });
    $("#btnDlTxt").addEventListener("click", function () {
      if (!state.chart) { toast("Generate a flowchart first."); return; }
      downloadBlob(new Blob([state.chart.trace], { type: "text/plain" }),
        chartBaseName() + "-trace.txt");
    });
    document.querySelectorAll(".fc-ic").forEach(function (b) {
      var n = b.getAttribute("data-icon");
      if (n) b.innerHTML = icon(n, 16);
    });
    var resizeT = null;
    window.addEventListener("resize", function () {
      if (!state.chart) return;
      clearTimeout(resizeT);
      resizeT = setTimeout(fitView, 120);
    });
  }

  if (typeof window !== "undefined") {
    window.__fcTest = { chartToMermaid: chartToMermaid, TRACE_PY: TRACE_PY,
      SAMPLES: SAMPLES, mmdLabel: mmdLabel, loadFromHash: loadFromHash,
      shareLink: shareLink, fitFromRects: fitFromRects,
      zoomFromMeasure: zoomFromMeasure,
      inputLabels: inputLabels, toast: toast, hideToast: hideToast,
      state: state, selectChart: selectChart, showTraceStep: showTraceStep,
      stepNode: stepNode, startTracePlayback: startTracePlayback,
      buildIndexes: buildIndexes, renderInputRows: renderInputRows,
      collectInputs: collectInputs };
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderSamples();
    initEditor();
    if (!editor) $("#fcCode").value = DEFAULT_CODE;
    wire();
    initPan();
    loadFromHash();
  });
})();
