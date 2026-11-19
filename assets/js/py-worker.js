/* Skillzify Code Studio — Python Web Worker (19 Nov 2026).
 *
 * Pyodide used to run on the page's main thread, so a tight
 * `while True: pass` froze the whole tab and Stop could only pretend
 * to stop it. This worker owns the runtime instead: boot, workspace
 * files, runs (same AST input() bootstrap — it arrives in the init
 * message so there is exactly one copy, in compiler.js), syntax
 * checks, and package installs with their IndexedDB snapshots.
 * The page stays responsive during any run, and Stop is now real:
 * the main thread terminates this worker and boots a fresh one.
 *
 * Protocol (main -> worker):
 *   {t:"init", scriptURL, indexURL, bootstrap, files, remembered, pkgs}
 *   {t:"run", code, files}        {t:"check", id, code}
 *   {t:"install", name, how}      {t:"stdin-reply", id, value}
 * Protocol (worker -> main):
 *   {t:"booted"} {t:"boot-failed", message}
 *   {t:"out", s} {t:"flush"} {t:"stdin", id, prompt}
 *   {t:"done"} {t:"error", message} {t:"autopkg", names}
 *   {t:"check", id, error} {t:"installed", name, ok, version, message}
 *   {t:"pkg-state", name, state, version} {t:"pkg-forget", name}
 *   {t:"pkg-log", line}
 */
"use strict";

var pyodide = null;
var BOOTSTRAP = "";
var PKG_META = {}; // name -> {name, how}
var stdinWaiters = {};
var stdinSeq = 0;

function post(msg) { postMessage(msg); }
function out(s) { post({ t: "out", s: String(s) }); }

/* ---- stdin bridge: same contract as the main-thread engine ----
   Python's bootstrap imports __stdin_read / __stdin_flush from `js`;
   in the worker those are this global scope. Reading a line posts a
   request to the page and parks on a Promise the page resolves when
   the learner submits (null = EOF, the bootstrap raises EOFError). */
globalThis.__stdin_flush = function () { post({ t: "flush" }); };
globalThis.__stdin_read = function (promptText) {
  return new Promise(function (resolve) {
    var id = ++stdinSeq;
    stdinWaiters[id] = resolve;
    post({ t: "stdin", id: id, prompt: String(promptText || "") });
  });
};

/* ---- workspace files ---- */
function writeFiles(files) {
  if (!pyodide || !files) return;
  Object.keys(files).forEach(function (n) {
    try { pyodide.FS.writeFile(n, files[n]); } catch (e) {}
  });
}

/* ---- IndexedDB snapshots (same DB/store/record shape as the
   main-thread engine's pkgIdb* helpers: db "skillzify-pkg-fs",
   store "files", record {files:[{path, data:Uint8Array}]}) ---- */
function idbOpen() {
  return new Promise(function (resolve, reject) {
    try {
      var req = indexedDB.open("skillzify-pkg-fs", 1);
      req.onupgradeneeded = function () {
        try { req.result.createObjectStore("files"); } catch (e) {}
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    } catch (e) { reject(e); }
  });
}
function idbGet(name) {
  return idbOpen().then(function (db) {
    return new Promise(function (resolve, reject) {
      var req = db.transaction("files", "readonly").objectStore("files").get(name);
      req.onsuccess = function () { try { db.close(); } catch (e) {} resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    });
  });
}
function idbPut(name, files) {
  return idbOpen().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put({ files: files }, name);
      tx.oncomplete = function () { try { db.close(); } catch (e) {} resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

/* ---- package helpers (worker mirrors of the main-thread logic) ---- */
function purelib() {
  try { return String(pyodide.runPython("import sysconfig\nsysconfig.get_paths()['purelib']")); }
  catch (e) { return ""; }
}
function walkFiles(root) {
  var outMap = {};
  try {
    var FS = pyodide.FS;
    (function walk(dir, rel) {
      var entries = [];
      try { entries = FS.readdir(dir); } catch (e) { return; }
      entries.forEach(function (ent) {
        if (ent === "." || ent === "..") return;
        var full = dir + "/" + ent, r = rel ? rel + "/" + ent : ent;
        try {
          var st = FS.stat(full);
          if (FS.isDir(st.mode)) walk(full, r);
          else outMap[r] = st.size + ":" + Math.floor(st.mtime || 0);
        } catch (e) {}
      });
    })(root, "");
  } catch (e) {}
  return outMap;
}
function snapshotDiff(name, root, before) {
  try {
    var FS = pyodide.FS;
    var after = walkFiles(root);
    var files = [];
    Object.keys(after).forEach(function (rel) {
      if (before[rel] !== after[rel]) {
        try { files.push({ path: rel, data: FS.readFile(root + "/" + rel) }); } catch (e) {}
      }
    });
    if (files.length) idbPut(name, files).catch(function () {});
  } catch (e) {}
}
function pkgVersionOf(name) {
  try {
    var v = pyodide.runPython("import " + name + "\ngetattr(" + name + ", '__version__', '')");
    return v ? String(v) : "";
  } catch (e) { return ""; }
}

/* Restore the remembered set into a fresh kernel (bundle packages
   re-load from the distribution; pip packages replay their IDB
   snapshot). A package that fails to restore is reported forgotten,
   exactly like the main-thread engine, rather than lying. */
function restorePackages(remembered) {
  var names = Object.keys(remembered || {});
  var chain = Promise.resolve();
  names.forEach(function (name) {
    chain = chain.then(function () {
      var meta = PKG_META[name];
      if (!meta) { post({ t: "pkg-forget", name: name }); return null; }
      if (meta.how === "bundle") {
        return pyodide.loadPackage(name).then(function () {
          post({ t: "pkg-state", name: name, state: "installed", version: pkgVersionOf(name) });
        }, function () { post({ t: "pkg-forget", name: name }); });
      }
      return idbGet(name).then(function (rec) {
        if (!rec || !rec.files || !rec.files.length) throw new Error("no snapshot");
        var root = purelib();
        if (!root) throw new Error("no purelib");
        var FS = pyodide.FS;
        rec.files.forEach(function (f) {
          var full = root + "/" + f.path;
          var dir = full.slice(0, full.lastIndexOf("/"));
          try { FS.mkdirTree(dir); } catch (e) {}
          FS.writeFile(full, f.data);
        });
        pyodide.runPython("import importlib\nimportlib.invalidate_caches()");
        post({ t: "pkg-state", name: name, state: "installed", version: pkgVersionOf(name) });
        post({ t: "pkg-log", line: "\uD83D\uDCE6 " + name + " restored from your saved installs." });
      }).catch(function () { post({ t: "pkg-forget", name: name }); });
    });
  });
  return chain;
}

/* ---- boot ---- */
function boot(msg) {
  BOOTSTRAP = msg.bootstrap || "";
  (msg.pkgs || []).forEach(function (p) { PKG_META[p.name] = p; });
  try { importScripts(msg.scriptURL); } catch (e) {
    post({ t: "boot-failed", message: "download" });
    return;
  }
  loadPyodide({ indexURL: msg.indexURL }).then(function (py) {
    pyodide = py;
    pyodide.setStdout({ batched: out });
    pyodide.setStderr({ batched: out });
    // sys.stdin reads (not via input()) get immediate EOF; input() is interactive
    try { pyodide.setStdin({ stdin: function () { return null; } }); } catch (e) {}
    writeFiles(msg.files || {});
    post({ t: "booted" });
    restorePackages(msg.remembered || {});
  }).catch(function () { post({ t: "boot-failed", message: "runtime" }); });
}

/* ---- run ---- */
function doRun(msg) {
  writeFiles(msg.files || {});
  var code = msg.code;
  function start() {
    // replacer FUNCTION: user code may contain $& / $' which replace()
    // would otherwise interpret (same guard as the main-thread engine)
    var src = BOOTSTRAP.replace("__USER_CODE__", function () { return JSON.stringify(code); });
    return pyodide.runPythonAsync(src);
  }
  var p;
  if (pyodide.loadPackagesFromImports) {
    p = pyodide.loadPackagesFromImports(code).then(function (loaded) {
      try {
        var names = [];
        if (loaded && loaded.length) {
          for (var i = 0; i < loaded.length; i++) {
            var lp = loaded[i];
            names.push(typeof lp === "string" ? lp : (lp && lp.name) || String(lp));
          }
        }
        if (names.length) {
          post({ t: "autopkg", names: names });
          if (names.indexOf("matplotlib") !== -1) {
            try { pyodide.runPython("import matplotlib\nmatplotlib.use('agg')"); } catch (e) {}
          }
        }
      } catch (e) {}
      return start();
    }, function () { return start(); });
  } else {
    try { p = Promise.resolve(start()); } catch (e) { p = Promise.reject(e); }
  }
  p.then(function () { post({ t: "done" }); },
         function (e) { post({ t: "error", message: String((e && e.message) || e) }); });
}

/* ---- syntax check (same compile + filename as the main thread) ---- */
function doCheck(msg) {
  try {
    pyodide.runPython("compile(" + JSON.stringify(msg.code) + ", '<editor>', 'exec')");
    post({ t: "check", id: msg.id, error: null });
  } catch (e) {
    post({ t: "check", id: msg.id, error: String((e && e.message) || e) });
  }
}

/* ---- install ---- */
function doInstall(msg) {
  var name = msg.name;
  var p;
  if (msg.how === "bundle") {
    p = pyodide.loadPackage(name);
  } else {
    var root = purelib();
    var before = root ? walkFiles(root) : null;
    p = pyodide.loadPackage("micropip").then(function () {
      return pyodide.pyimport("micropip").install(name);
    }).then(function () {
      if (root && before) snapshotDiff(name, root, before);
    });
  }
  p.then(function () {
    post({ t: "installed", name: name, ok: true, version: pkgVersionOf(name) });
  }, function (e) {
    post({ t: "installed", name: name, ok: false, message: String((e && e.message) || e).slice(0, 140) });
  });
}

onmessage = function (e) {
  var msg = e.data || {};
  try {
    if (msg.t === "init") boot(msg);
    else if (msg.t === "run") doRun(msg);
    else if (msg.t === "check") doCheck(msg);
    else if (msg.t === "install") doInstall(msg);
    else if (msg.t === "stdin-reply") {
      var r = stdinWaiters[msg.id];
      delete stdinWaiters[msg.id];
      if (r) r(msg.value == null ? null : String(msg.value));
    }
  } catch (err) {
    if (msg.t === "run") post({ t: "error", message: String((err && err.message) || err) });
  }
};
