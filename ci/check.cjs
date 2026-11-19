/* Skillzify web CI checks — self-contained, no dependencies.
 * Run: node ci/check.cjs   (exit 1 on any failure)
 *
 * 1. node --check on every JS file (assets/js/*.js, server.js)
 * 2. python syntax check on flowchart_ast.py (skipped if python3 absent)
 * 3. Asset pins: every ?v= pin for the same asset identical across all
 *    pages; every referenced local asset exists on disk
 * 4. Page basics: every HTML page has a meta description and one <h1>
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let failures = 0;
function fail(msg) { failures++; console.log("FAIL", msg); }
function ok(msg) { console.log("  ok", msg); }

/* 1 — JS syntax */
const jsFiles = [path.join(ROOT, "server.js"), path.join(ROOT, "sw.js")]
  .concat(fs.readdirSync(path.join(ROOT, "assets", "js")).filter((f) => f.endsWith(".js")).map((f) => path.join(ROOT, "assets", "js", f)));
for (const f of jsFiles) {
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (r.status !== 0) fail("node --check " + path.relative(ROOT, f) + ": " + (r.stderr || "").split("\n")[0]);
}
ok("node --check: " + jsFiles.length + " JS files");

/* 2 — Python syntax (flowchart converter) */
const py = path.join(ROOT, "assets", "js", "flowchart_ast.py");
if (fs.existsSync(py)) {
  const r = spawnSync("python3", ["-m", "py_compile", py], { encoding: "utf8" });
  if (r.error && r.error.code === "ENOENT") console.log("  skip py_compile (no python3)");
  else if (r.status !== 0) fail("py_compile flowchart_ast.py: " + (r.stderr || "").split("\n").slice(-2).join(" "));
  else ok("py_compile: flowchart_ast.py");
}

/* 3+4 — pages: pins, asset existence, meta, h1 */
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const pins = {}; // asset path -> {pin -> [pages]}
for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  if (!/<meta\s+name="description"/i.test(html)) fail(page + ": missing meta description");
  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1s !== 1) fail(page + ": expected exactly one <h1>, found " + h1s);
  const re = /(?:src|href)="(assets\/[^"?#]+)(?:\?v=([0-9A-Za-z._-]+))?"/g;
  let m;
  while ((m = re.exec(html))) {
    const asset = m[1], pin = m[2] || "(none)";
    if (!fs.existsSync(path.join(ROOT, asset))) fail(page + ": references missing file " + asset);
    (pins[asset] = pins[asset] || {})[pin] = (pins[asset][pin] || []).concat(page);
  }
}
for (const asset of Object.keys(pins)) {
  const variants = Object.keys(pins[asset]);
  if (variants.length > 1) {
    fail("pin mismatch for " + asset + ": " + variants.map((v) => "v=" + v + " on " + pins[asset][v].join(",")).join(" vs "));
  }
}
ok("pages: " + pages.length + " HTML files, " + Object.keys(pins).length + " pinned/local assets consistent");

console.log(failures ? "\nCI CHECKS FAILED: " + failures : "\nCI CHECKS PASSED");
process.exit(failures ? 1 : 0);
