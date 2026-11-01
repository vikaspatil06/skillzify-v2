"use strict";
const fs = require("fs");
const path = require("path");

const WEB = "/home/hatch/workspace/skillzify-v2";
const OUT = "/home/hatch/workspace/skillzify-app/content";
fs.mkdirSync(OUT, { recursive: true });

// Extract a JS literal starting at `startMarker` (e.g. "var LESSONS = [")
// by scanning with bracket matching, respecting strings/comments.
function extractLiteral(src, startMarker) {
  const i = src.indexOf(startMarker);
  if (i < 0) throw new Error("marker not found: " + startMarker);
  let j = i + startMarker.length - 1; // position of opening [ or {
  const open = src[j];
  const close = open === "[" ? "]" : "}";
  let depth = 0, k = j;
  let inStr = null, esc = false, inLine = false, inBlock = false;
  for (; k < src.length; k++) {
    const c = src[k], n = src[k + 1];
    if (inLine) { if (c === "\n") inLine = false; continue; }
    if (inBlock) { if (c === "*" && n === "/") { inBlock = false; k++; } continue; }
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === "/" && n === "/") { inLine = true; k++; continue; }
    if (c === "/" && n === "*") { inBlock = true; k++; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) { k++; break; }
    }
  }
  if (depth !== 0) throw new Error("unbalanced brackets for " + startMarker);
  return src.slice(j, k);
}

function evalLiteral(lit, name) {
  // Data-only literals: safe to evaluate via Function.
  return new Function("return (" + lit + ");")();
}

const learnSrc = fs.readFileSync(path.join(WEB, "assets/js/learn.js"), "utf8");
const compSrc = fs.readFileSync(path.join(WEB, "assets/js/compiler.js"), "utf8");

const LESSONS = evalLiteral(extractLiteral(learnSrc, "var LESSONS = ["), "LESSONS");
const TRACKS = evalLiteral(extractLiteral(learnSrc, "var TRACKS = ["), "TRACKS");
const LEVELS = evalLiteral(extractLiteral(learnSrc, "var LEVELS = ["), "LEVELS");
const SNIPPETS = evalLiteral(extractLiteral(compSrc, "var SNIPPETS = {"), "SNIPPETS");

// ---- verify ----
const errors = [];
if (TRACKS.length !== 3) errors.push("tracks != 3: " + TRACKS.length);
if (LESSONS.length !== 16) errors.push("lessons != 16: " + LESSONS.length);
for (const l of LESSONS) {
  if (!l.id || !l.title || !l.explain || !l.code) errors.push(l.id + ": missing core fields");
  if (!Array.isArray(l.quiz) || l.quiz.length !== 2) errors.push(l.id + ": quiz != 2");
  for (const q of (l.quiz || [])) {
    if (!q.q || !Array.isArray(q.options) || q.options.length < 2) errors.push(l.id + ": bad quiz q");
    if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.options.length) errors.push(l.id + ": bad quiz answer idx");
    if (!q.why) errors.push(l.id + ": quiz missing why");
  }
  const ch = l.challenge;
  if (!ch || !ch.type || !ch.prompt) errors.push(l.id + ": bad challenge");
  else if (ch.type === "predict") {
    if (!Array.isArray(ch.options) || typeof ch.answer !== "number" || ch.answer < 0 || ch.answer >= ch.options.length) errors.push(l.id + ": bad predict challenge");
  } else if (ch.type === "blank") {
    const a = Array.isArray(ch.answer) ? ch.answer : [ch.answer];
    if (!a.length || !a.every(x => typeof x === "string" && x.trim())) errors.push(l.id + ": bad blank challenge");
  } else errors.push(l.id + ": unknown challenge type " + ch.type);
  // NOTE: XP is computed at completion (web: gain = 20 + firstTries*5 + 10), not stored per lesson.
  if (!TRACKS.some(t => t.id === l.track)) errors.push(l.id + ": unknown track " + l.track);
}
const trackCounts = {};
for (const l of LESSONS) trackCounts[l.track] = (trackCounts[l.track] || 0) + 1;

const lessonsOut = { tracks: TRACKS, levels: LEVELS, lessons: LESSONS };
fs.writeFileSync(path.join(OUT, "lessons.json"), JSON.stringify(lessonsOut, null, 2));

const snippetsOut = Object.keys(SNIPPETS).map(id => ({ id, name: SNIPPETS[id].name, code: SNIPPETS[id].code }));
fs.writeFileSync(path.join(OUT, "snippets.json"), JSON.stringify(snippetsOut, null, 2));

console.log("tracks:", TRACKS.length, "lessons:", LESSONS.length, JSON.stringify(trackCounts));
console.log("snippets:", snippetsOut.map(s => s.id).join(","));
console.log("errors:", errors.length ? errors : "none");
if (errors.length) process.exit(1);
console.log("EXTRACTION OK");
