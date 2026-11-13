# flowchart_ast.py — Skillzify Flowchart Lab v2: Python-AST -> flowchart IR.
#
# Runs inside Pyodide in the browser (and under CPython in the test suite).
# Design rule: PRECISION. Every statement in the source maps to IR or to an
# explicit `unsupported` node naming the construct — never a silently
# wrong chart. Uses only the `ast` module: no eval, no execution.
#
# Output (JSON string from `to_ir`):
# { success, error|null, pyVersion, sharedSyntax,
#   charts: [ { id, title, kind(main|function), name, params, recursive,
#               async, graphviz, trace, stats, nodes[], edges[], warnings[] } ],
#   warnings: [ ...all charts... ] }
# Node: { id, kind, label, line, endLine, note? }
#   kinds: start end process io decision loop merge call return raise
#          unsupported unreachable
# Edge: { from, to, label?, back?, kind?(flow|back|call) }
#
# The same IR drives the Mermaid renderer, Graphviz export, the living
# trace (line spans), the AI layer (structure summary) and the tests.

import ast
import json
import re
import sys

MAX_NODE_LABEL = 72


class FlowGenError(Exception):
    pass


def _short(text, limit=MAX_NODE_LABEL):
    t = " ".join(str(text).split())
    if len(t) > limit:
        t = t[: limit - 1].rstrip() + "…"
    return t


def _unparse(node, src_lines):
    if node is None:
        return ""
    try:
        return ast.unparse(node)
    except Exception:
        pass
    try:
        seg = ast.get_source_segment("\n".join(src_lines), node)
        if seg:
            return seg
    except Exception:
        pass
    return node.__class__.__name__


def _comment_map(src):
    out = {}
    c = re.compile(r"^(\s*)(.*?)\s+#\s*(.+?)\s*$")
    for i, raw in enumerate(src.split("\n"), 1):
        if "#" not in raw:
            continue
        m = c.match(raw)
        if m and m.group(3):
            out[i] = m.group(3)
    return out


class Frag(object):
    __slots__ = ("entry", "exits", "breaks", "continues")

    def __init__(self, entry=None):
        self.entry = entry        # first node id or None
        self.exits = []           # nodes whose flow continues linearly
        self.breaks = []          # break nodes (caller connects)
        self.continues = []       # continue nodes (caller connects)


class ChartBuilder(object):
    def __init__(self, conv, title, kind, name, params):
        self.conv = conv
        self.title = title
        self.kind = kind
        self.name = name
        self.params = params
        self.nodes = []
        self.edges = []
        self.warnings = []
        self.used_ids = set()
        self.recursive = False
        self.is_async = False
        self.max_nesting = 0

    # -- primitives ------------------------------------------------------
    def node(self, kind, label, line, end_line=None, note=None):
        base = kind[0] + str(len(self.nodes) + 1)
        nid = base
        n = 2
        while nid in self.used_ids:
            nid = base + "_" + str(n)
            n += 1
        self.used_ids.add(nid)
        rec = {"id": nid, "kind": kind, "label": _short(label),
               "line": line or 0, "endLine": end_line or line or 0}
        if note:
            rec["note"] = note
        self.nodes.append(rec)
        cm = self.conv.comments.get(line or 0)
        if cm and kind in ("decision", "loop", "process", "call", "io"):
            self.warnings.append({"type": "comment", "line": line,
                                  "text": _short(cm, 90), "nodeId": nid})
        return nid

    def edge(self, a, b, label=None, back=False, kind=None):
        if not a or not b:
            return
        e = {"from": a, "to": b}
        if label:
            e["label"] = label
        if back:
            e["back"] = True
        if kind:
            e["kind"] = kind
        self.edges.append(e)

    def link(self, sources, target, label=None):
        for s in sources or []:
            self.edge(s, target, label)

    def warn(self, wtype, line, text, node_id=None):
        w = {"type": wtype, "line": line or 0, "text": text}
        if node_id:
            w["nodeId"] = node_id
        self.warnings.append(w)

    def fragment(self, entry, exits=None, breaks=None, continues=None):
        f = Frag(entry)
        f.exits = list(exits or [])
        f.breaks = list(breaks or [])
        f.continues = list(continues or [])
        return f

    def merge_from(self, frags):
        out = Frag()
        entries = [f.entry for f in frags if f and f.entry]
        out.entry = entries[0] if entries else None
        for f in frags:
            if not f:
                continue
            out.exits += f.exits
            out.breaks += f.breaks
            out.continues += f.continues
        return out

    def seq(self, prev_exits, frag):
        if prev_exits and frag.entry:
            self.link(prev_exits, frag.entry)
        return frag

    # -- statement sequencing -------------------------------------------
    def seq_block(self, stmts, depth=0):
        if depth > self.max_nesting:
            self.max_nesting = depth
        result = Frag()
        current_exits = []
        dead = False
        for st in stmts:
            if dead:
                nid = self.node(
                    "unreachable", self.stmt_label(st), st.lineno,
                    getattr(st, "end_lineno", st.lineno),
                    note="unreachable: after a statement that always leaves "
                         "this block (return / break / continue / raise)")
                self.warn("unreachable", st.lineno,
                          "Line %d is unreachable — it follows a statement "
                          "that always leaves this block." % st.lineno, nid)
                result = self.merge_from(
                    [result, self.fragment(nid, [])])
                continue
            frag = self.emit_stmt(st, depth)
            if result.entry is None:
                result.entry = frag.entry
            else:
                self.seq(current_exits, frag)
            result.breaks += frag.breaks
            result.continues += frag.continues
            current_exits = frag.exits
            if not current_exits and frag.entry is not None:
                dead = True
        result.exits = current_exits
        return result

    def stmt_label(self, st):
        src = _unparse(st, self.conv.src_lines)
        return src.split("\n")[0] if src else st.__class__.__name__

    # -- main dispatch ----------------------------------------------------
    def emit_stmt(self, st, depth=0):
        handler = getattr(self, "st_" + st.__class__.__name__, None)
        try:
            if handler is None:
                return self.emit_unsupported(st, st.__class__.__name__)
            return handler(st, depth)
        except FlowGenError as e:
            return self.emit_unsupported(st, str(e))
        except RecursionError:
            return self.emit_unsupported(st, "nesting too deep")

    def emit_unsupported(self, st, what):
        nid = self.node("unsupported", "⚠ unsupported: " + what,
                        getattr(st, "lineno", 0),
                        getattr(st, "end_lineno", getattr(st, "lineno", 0)),
                        note="this construct is not drawn — the chart stays "
                             "honest instead of guessing")
        self.warn("unsupported", getattr(st, "lineno", 0),
                  "Unsupported construct: %s (line %s)."
                  % (what, getattr(st, "lineno", "?")), nid)
        return self.fragment(nid, [nid])

    # -- leaves -----------------------------------------------------------
    def st_Expr(self, st, depth):
        v = st.value
        if isinstance(v, ast.Call):
            return self.call_stmt(v, st)
        if isinstance(v, (ast.Yield, ast.YieldFrom)):
            val = _unparse(v.value, self.conv.src_lines) if v.value else ""
            nid = self.node("process",
                            ("yield from " if isinstance(v, ast.YieldFrom)
                             else "yield ") + val, st.lineno)
            return self.fragment(nid, [nid])
        if isinstance(v, ast.Await):
            nid = self.node("process", "await " + _unparse(v.value, self.conv.src_lines), st.lineno)
            return self.fragment(nid, [nid])
        nid = self.node("process", _unparse(v, self.conv.src_lines), st.lineno)
        self.link_known_calls(nid, v)
        return self.fragment(nid, [nid])

    def call_stmt(self, call, st):
        fname = _unparse(call.func, self.conv.src_lines)
        line = st.lineno
        if fname in ("print",):
            nid = self.node("io", "print " + self.call_args(call), line)
            for a in list(call.args) + [k.value for k in call.keywords]:
                self.link_known_calls(nid, a)
            return self.fragment(nid, [nid])
        if fname == "input":
            nid = self.node("io", "input " + self.call_args(call), line)
            return self.fragment(nid, [nid])
        if fname == "exit" or fname == "quit":
            nid = self.node("end", fname + "()", line)
            return self.fragment(nid, [])
        # known function chart -> subroutine node linked by name
        chart = self.conv.function_charts.get(fname)
        nid = self.node("call", "call " + fname + "(" + self.call_args(call) + ")",
                        line)
        for a in list(call.args) + [k.value for k in call.keywords]:
            self.link_known_calls(nid, a)
        if chart is not None:
            self.edges.append({"from": nid, "to": chart["startId"],
                               "kind": "call", "label": "calls"})
            if chart["name"] == self.name:
                self.recursive = True
        return self.fragment(nid, [nid])

    def link_known_calls(self, owner_id, expr):
        """Calls to charted functions nested inside an expression (e.g.
        print(sq(3))) still get a call reference edge from the owner."""
        if expr is None:
            return
        for sub in ast.walk(expr):
            if isinstance(sub, ast.Call):
                nm = _unparse(sub.func, self.conv.src_lines)
                chart = self.conv.function_charts.get(nm)
                if chart is not None:
                    self.edges.append({"from": owner_id,
                                       "to": chart["startId"],
                                       "kind": "call", "label": "calls"})
                    if chart["name"] == self.name:
                        self.recursive = True

    def call_args(self, call):
        parts = [_unparse(a, self.conv.src_lines) for a in call.args]
        for kw in call.keywords:
            parts.append((kw.arg + "=" if kw.arg else "**") +
                         _unparse(kw.value, self.conv.src_lines))
        return ", ".join(parts)

    def is_input_call(self, node):
        return (isinstance(node, ast.Call) and
                isinstance(node.func, ast.Name) and node.func.id == "input")

    def contains_input(self, node):
        if node is None:
            return False
        for sub in ast.walk(node):
            if self.is_input_call(sub):
                return True
        return False

    def st_Assign(self, st, depth):
        target = ", ".join(_unparse(t, self.conv.src_lines) for t in st.targets)
        if self.contains_input(st.value):
            nid = self.node("io", target + " = " +
                            _unparse(st.value, self.conv.src_lines),
                            st.lineno)
            self.link_known_calls(nid, st.value)
            return self.fragment(nid, [nid])
        if isinstance(st.value, ast.Call):
            fname = _unparse(st.value.func, self.conv.src_lines)
            chart = self.conv.function_charts.get(fname)
            if chart is not None:
                nid = self.node("call", target + " = " + fname + "(" +
                                self.call_args(st.value) + ")", st.lineno)
                self.edges.append({"from": nid, "to": chart["startId"],
                                   "kind": "call", "label": "calls"})
                if chart["name"] == self.name:
                    self.recursive = True
                return self.fragment(nid, [nid])
        nid = self.node("process", target + " = " +
                        _unparse(st.value, self.conv.src_lines), st.lineno)
        self.link_known_calls(nid, st.value)
        return self.fragment(nid, [nid])

    def st_AnnAssign(self, st, depth):
        target = _unparse(st.target, self.conv.src_lines)
        if st.value is None:
            nid = self.node("process", target + ": " +
                            _unparse(st.annotation, self.conv.src_lines),
                            st.lineno)
            return self.fragment(nid, [nid])
        if self.contains_input(st.value):
            nid = self.node("io", target + " = " +
                            _unparse(st.value, self.conv.src_lines),
                            st.lineno)
            return self.fragment(nid, [nid])
        nid = self.node("process", target + " = " +
                        _unparse(st.value, self.conv.src_lines), st.lineno)
        return self.fragment(nid, [nid])

    def st_AugAssign(self, st, depth):
        op = type(st.op).__name__.replace("Add", "+").replace("Sub", "-") \
            .replace("Mult", "*").replace("Div", "/").replace("FloorDiv", "//") \
            .replace("Mod", "%").replace("Pow", "**").replace("MatMult", "@") \
            .replace("LShift", "<<").replace("RShift", ">>") \
            .replace("BitOr", "|").replace("BitXor", "^").replace("BitAnd", "&")
        nid = self.node("process", _unparse(st.target, self.conv.src_lines) +
                        " " + op + "= " +
                        _unparse(st.value, self.conv.src_lines), st.lineno)
        return self.fragment(nid, [nid])

    def st_Delete(self, st, depth):
        nid = self.node("process", "del " + ", ".join(
            _unparse(t, self.conv.src_lines) for t in st.targets), st.lineno)
        return self.fragment(nid, [nid])

    def st_Import(self, st, depth):
        names = ", ".join((a.name + (" as " + a.asname if a.asname else ""))
                          for a in st.names[:3])
        nid = self.node("process", "import " + names +
                        ("…" if len(st.names) > 3 else ""), st.lineno)
        return self.fragment(nid, [nid])

    def st_ImportFrom(self, st, depth):
        names = ", ".join((a.name + (" as " + a.asname if a.asname else ""))
                          for a in st.names[:3])
        nid = self.node("process", "from " + (st.module or "") + " import " +
                        names + ("…" if len(st.names) > 3 else ""), st.lineno)
        return self.fragment(nid, [nid])

    def st_Global(self, st, depth):
        nid = self.node("process", "global " + ", ".join(st.names), st.lineno)
        return self.fragment(nid, [nid])

    def st_Nonlocal(self, st, depth):
        nid = self.node("process", "nonlocal " + ", ".join(st.names), st.lineno)
        return self.fragment(nid, [nid])

    def st_Pass(self, st, depth):
        return Frag()

    def st_Break(self, st, depth):
        nid = self.node("process", "break", st.lineno,
                        note="exit the loop immediately")
        return self.fragment(nid, [], breaks=[nid])

    def st_Continue(self, st, depth):
        nid = self.node("process", "continue", st.lineno,
                        note="skip to the next iteration")
        return self.fragment(nid, [], continues=[nid])

    def st_Return(self, st, depth):
        val = _unparse(st.value, self.conv.src_lines) if st.value else ""
        nid = self.node("return", "return" + (" " + val if val else ""),
                        st.lineno)
        self.link_known_calls(nid, st.value)
        return self.fragment(nid, [])

    def st_Raise(self, st, depth):
        what = _unparse(st.exc, self.conv.src_lines) if st.exc else "re-raise"
        nid = self.node("raise", "raise " + what, st.lineno)
        return self.fragment(nid, [])

    def st_Assert(self, st, depth):
        cond = _unparse(st.test, self.conv.src_lines)
        d = self.node("decision", "assert " + cond + "?", st.lineno)
        bad = self.node("raise", "AssertionError", st.lineno)
        self.edge(d, bad, "false")
        f = Frag(d)
        f.exits = [d]
        return f

    # -- branching ----------------------------------------------------------
    def st_If(self, st, depth):
        cond = _unparse(st.test, self.conv.src_lines)
        d = self.node("decision", cond + "?", st.lineno)
        body = self.seq_block(st.body, depth + 1)
        if body.entry:
            self.edge(d, body.entry, "true")
        exits = list(body.exits)
        if not st.orelse:
            exits.append(d)  # false falls through
        else:
            els = self.seq_block(st.orelse, depth + 1)
            if els.entry:
                self.edge(d, els.entry, "false")
            exits += els.exits
            body = self.merge_from([body, els])
        out = self.fragment(d, exits, body.breaks, body.continues)
        if body.entry and st.orelse:
            m = self.node("merge", "", st.lineno)
            self.link(exits, m)
            out.exits = [m]
        return out

    # -- loops --------------------------------------------------------------
    def st_While(self, st, depth):
        cond = _unparse(st.test, self.conv.src_lines)
        h = self.node("loop", "while " + cond + "?", st.lineno)
        body = self.seq_block(st.body, depth + 1)
        if body.entry:
            self.edge(h, body.entry, "repeat")
        self.link(body.exits, h, None)
        for c in body.continues:
            self.edge(c, h)
        loop_exits = [h]  # false branch falls through
        self.warn_while_true(st, h)
        out_breaks = list(body.breaks)
        if st.orelse:
            els = self.seq_block(st.orelse, depth + 1)
            if els.entry:
                self.edge(h, els.entry, "false (loop finished)")
                loop_exits = list(els.exits)
                out_breaks += els.breaks
            else:
                loop_exits = [h]
            out = self.fragment(h, loop_exits + out_breaks, [], [])
            out.exits = self._merge_join(loop_exits, out_breaks, st.lineno, h,
                                          body)
            return out
        return self._loop_join(h, loop_exits, out_breaks, st, body)

    def st_For(self, st, depth):
        target = _unparse(st.target, self.conv.src_lines)
        it = _unparse(st.iter, self.conv.src_lines)
        h = self.node("loop", "for " + target + " in " + it + " — next?",
                      st.lineno)
        body = self.seq_block(st.body, depth + 1)
        if body.entry:
            self.edge(h, body.entry, "next item")
        self.link(body.exits, h, None)
        for c in body.continues:
            self.edge(c, h)
        loop_exits = [h]
        out_breaks = list(body.breaks)
        if st.orelse:
            els = self.seq_block(st.orelse, depth + 1)
            if els.entry:
                self.edge(h, els.entry, "exhausted (else)")
                loop_exits = list(els.exits)
                out_breaks += els.breaks
            out = self.fragment(h, [], [], [])
            out.exits = self._merge_join(loop_exits, out_breaks, st.lineno, h,
                                          body)
            return out
        return self._loop_join(h, loop_exits, out_breaks, st, body)

    def _loop_join(self, h, loop_exits, breaks, st, body):
        exits = list(loop_exits) + list(breaks)
        if breaks and loop_exits:
            m = self.node("merge", "", st.lineno)
            self.edge(h, m, "false")
            self.link(breaks, m)
            return self.fragment(h, [m], [], [])
        f = self.fragment(h, exits, [], [])
        return f

    def _merge_join(self, loop_exits, breaks, line, h, body):
        exits = list(loop_exits) + list(breaks)
        if breaks and loop_exits and loop_exits != [h]:
            m = self.node("merge", "", line)
            self.link(exits, m)
            return [m]
        if breaks and h in loop_exits:
            m = self.node("merge", "", line)
            self.edge(h, m, "false")
            self.link(breaks, m)
            rest = [e for e in loop_exits if e != h]
            return rest + [m]
        return exits

    def warn_while_true(self, st, h):
        t = st.test
        if isinstance(t, ast.Constant) and t.value is True:
            texts = []

            def visit(n):
                for ch in ast.iter_child_nodes(n):
                    texts.append(ch.__class__.__name__)
                    visit(ch)
            visit(st)
            if "Break" not in texts and "Return" not in texts and \
               "Raise" not in texts:
                self.warn("infinite-loop", st.lineno,
                          "while True with no break, return or raise in its "
                          "body — this loop may never end.", h)

    def st_AsyncFor(self, st, depth):
        return self.emit_unsupported(st, "async for")

    def st_AsyncWith(self, st, depth):
        return self.emit_unsupported(st, "async with")

    # -- match ---------------------------------------------------------------
    def st_Match(self, st, depth):
        subj = _unparse(st.subject, self.conv.src_lines)
        d = self.node("decision", "match " + subj, st.lineno)
        exits = []
        breaks, conts = [], []
        covered = False
        for case in st.cases:
            pat = case.pattern
            if isinstance(pat, ast.MatchAs) and pat.pattern is None and \
                    pat.name is None:
                label = "case _"
                covered = True
            else:
                label = "case " + _unparse(pat, self.conv.src_lines)
            if case.guard is not None:
                label += " if " + _unparse(case.guard, self.conv.src_lines)
            body = self.seq_block(case.body, depth + 1)
            breaks += body.breaks
            conts += body.continues
            if body.entry:
                self.edge(d, body.entry, label)
                exits += body.exits
            else:
                exits.append(d)
        if not covered:
            exits.append(d)
            self.warn("match-no-default", st.lineno,
                      "match has no `case _` — some values fall through "
                      "with no branch taken.", d)
        out = self.fragment(d, exits, breaks, conts)
        real = [e for e in exits if e != d]
        if len(real) >= 2:
            m = self.node("merge", "", st.lineno)
            self.link(exits, m)
            out.exits = [m]
        return out

    # -- try / with -------------------------------------------------------------
    def st_Try(self, st, depth):
        return self._try_impl(st, depth)

    def st_TryStar(self, st, depth):
        self.warn("unsupported", st.lineno,
                  "except* (exception groups) is drawn as a regular try.", None)
        return self._try_impl(st, depth)

    def _try_impl(self, st, depth):
        body = self.seq_block(st.body, depth + 1)
        exits = list(body.exits)
        breaks = list(body.breaks)
        conts = list(body.continues)
        first_try_node = body.entry
        for h in st.handlers:
            name = _unparse(h.type, self.conv.src_lines) if h.type else "bare except"
            d = self.node("decision", "except " + name + "?", h.lineno)
            if first_try_node:
                self.edges.append({"from": first_try_node, "to": d,
                                   "kind": "except", "label": "on error"})
            hb = self.seq_block(h.body, depth + 1)
            if hb.entry:
                self.edge(d, hb.entry, "raised")
            exits.append(d)  # handler not taken -> flow continues
            exits += hb.exits
            breaks += hb.breaks
            conts += hb.continues
        if st.orelse:
            els = self.seq_block(st.orelse, depth + 1)
            new_exits = []
            srcs = [e for e in exits if e in body.exits]
            if els.entry:
                self.link(srcs, els.entry)
                rest = [e for e in exits if e not in body.exits]
                exits = rest + els.exits
                breaks += els.breaks
                conts += els.continues
            exits = exits
        out_exits = exits
        if st.finalbody:
            fin = self.seq_block(st.finalbody, depth + 1)
            if fin.entry:
                self.link(out_exits, fin.entry)
                note = self.node("process", "finally — always runs",
                                 st.finalbody[0].lineno)
                # label node sits before the finally body entry visually via
                # an edge chain: exits -> note -> fin entry
                # (rebuild links: remove direct, route through note)
                self.edges = [e for e in self.edges
                              if not (e["to"] == fin.entry and
                                      e["from"] in out_exits)]
                self.link(out_exits, note)
                self.edge(note, fin.entry)
                out_exits = fin.exits
        out = self.fragment(body.entry, out_exits, breaks, conts)
        if body.entry is None:
            out.entry = None
        return out

    def st_With(self, st, depth):
        labels = []
        for item in st.items:
            ce = _unparse(item.context_expr, self.conv.src_lines)
            if item.optional_vars:
                ce += " as " + _unparse(item.optional_vars, self.conv.src_lines)
            labels.append(ce)
        nid = self.node("process", "with " + "; ".join(labels), st.lineno,
                        note="context manager: setup/teardown handled by with")
        body = self.seq_block(st.body, depth + 1)
        if body.entry:
            self.edge(nid, body.entry)
        exits = body.exits if body.entry else [nid]
        return self.fragment(nid, exits, body.breaks, body.continues)

    # -- definitions ------------------------------------------------------------
    def _def_common(self, st, depth, is_async=False):
        self.conv.build_function_chart(st, is_async)
        label = ("async def " if is_async else "def ") + st.name + "(…)"
        nid = self.node("process", label, st.lineno,
                        note="defined here — see its own chart")
        return self.fragment(nid, [nid])

    def st_FunctionDef(self, st, depth):
        return self._def_common(st, depth, False)

    def st_AsyncFunctionDef(self, st, depth):
        self.warn("async-trace", st.lineno,
                  "async def: the chart is exact, but the living trace "
                  "cannot step inside a coroutine (calling it does not run "
                  "its body).", None)
        return self._def_common(st, depth, True)

    def st_ClassDef(self, st, depth):
        bases = ", ".join(_unparse(b, self.conv.src_lines) for b in st.bases)
        nid = self.node("process", "class " + st.name +
                        (("(" + bases + ")") if bases else ""), st.lineno,
                        note="class body drawn inline; methods get their "
                             "own charts")
        body = self.seq_block(st.body, depth + 1)
        exits = [nid]
        if body.entry:
            self.edge(nid, body.entry)
            exits = body.exits
        return self.fragment(nid, exits, body.breaks, body.continues)


class Converter(object):
    def __init__(self, code):
        self.code = code or ""
        self.src_lines = self.code.split("\n")
        self.comments = _comment_map(self.code)
        self.function_charts = {}   # name -> chart meta (startId, name)
        self.charts = []
        self.warnings_all = []
        self._built_defs = set()

    # function chart construction (register-then-fill so self-calls and
    # mutual recursion resolve while the body is being emitted)
    def build_function_chart(self, fnode, is_async):
        if id(fnode) in self._built_defs:
            return self.function_charts.get(fnode.name)
        self._built_defs.add(id(fnode))
        name = fnode.name
        params = []
        a = fnode.args
        for arg in list(getattr(a, "posonlyargs", [])) + list(a.args):
            params.append(arg.arg)
        if a.vararg:
            params.append("*" + a.vararg.arg)
        for arg in a.kwonlyargs:
            params.append(arg.arg)
        if a.kwarg:
            params.append("**" + a.kwarg.arg)
        b = ChartBuilder(self, "def " + name, "function", name, params)
        b.is_async = is_async
        start = b.node("start", "Start " + name, fnode.lineno)
        meta = {"id": "chart_" + name, "title": b.title, "kind": "function",
                "name": name, "params": params, "recursive": False,
                "async": is_async, "graphviz": "", "trace": "",
                "stats": {}, "nodes": b.nodes, "edges": b.edges,
                "warnings": b.warnings, "startId": start, "endId": None}
        self.function_charts[name] = meta
        self.charts.append(meta)
        body = b.seq_block(fnode.body, 0)
        if body.entry:
            b.edge(start, body.entry)
        rets = [n["id"] for n in b.nodes if n["kind"] == "return"]
        end = b.node("end", "End " + name, fnode.lineno)
        b.link(body.exits, end)
        for r in rets:
            b.edge(r, end)
        self._finish_chart(b, start, end, name, meta)
        return meta

    def _finish_chart(self, b, start_id, end_id, name, meta=None):
        nodes = b.nodes
        decisions = sum(1 for n in nodes
                        if n["kind"] in ("decision", "loop"))
        stats = {"nodes": len(nodes), "decisions": decisions,
                 "edges": len(b.edges), "maxNesting": b.max_nesting,
                 "cyclomatic": decisions + 1}
        if meta is None:
            meta = {"id": "chart_" + (name or "main"), "nodes": nodes,
                    "edges": b.edges, "warnings": b.warnings}
        meta.update({"title": b.title, "kind": b.kind, "name": b.name,
                     "params": b.params, "recursive": b.recursive,
                     "async": b.is_async, "graphviz": _graphviz(b, start_id),
                     "trace": _trace_text(b), "stats": stats,
                     "nodes": nodes, "edges": b.edges,
                     "warnings": b.warnings, "startId": start_id,
                     "endId": end_id})
        for w in b.warnings:
            self.warnings_all.append(w)
        return meta

    def run(self):
        try:
            tree = ast.parse(self.code)
        except SyntaxError as e:
            return {"success": False,
                    "error": {"message": str(e.msg or e), "line": e.lineno,
                              "col": e.offset, "text": e.text},
                    "pyVersion": _pyver(), "sharedSyntax": _shared(),
                    "charts": [], "warnings": []}
        # pass 1: build function charts so call sites can link
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                self.build_function_chart(
                    node, isinstance(node, ast.AsyncFunctionDef))
        main = ChartBuilder(self, "<main>", "main", "<main>", [])
        start = main.node("start", "Start", 1)
        body = main.seq_block(tree.body, 0)
        if body.entry:
            main.edge(start, body.entry)
        rets = [n["id"] for n in main.nodes if n["kind"] == "return"]
        end = main.node("end", "End", 1)
        main.link(body.exits, end)
        for r in rets:
            main.edge(r, end)
        main_meta = self._finish_chart(main, start, end, "<main>")
        charts = [main_meta] + self.charts
        return {"success": True, "error": None, "pyVersion": _pyver(),
                "sharedSyntax": _shared(), "charts": charts,
                "warnings": self.warnings_all}


def _pyver():
    return "%d.%d" % (sys.version_info[0], sys.version_info[1])


def _shared():
    v = sys.version_info
    return bool(v[0] == 3 and v[1] in (11, 12))


def _graphviz(b, start_id):
    def esc(s):
        return str(s).replace("\\", "\\\\").replace('"', '\\"') \
                        .replace("\n", "\\n")
    lines = ["digraph flowchart {"]
    lines.append('  graph [rankdir=TB, bgcolor="transparent", fontname="Inter"];')
    lines.append('  node [fontname="Inter", fontsize=11, style="rounded,filled", color="#3a4570", fontcolor="#eef1ff"];')
    lines.append('  edge [color="#7c8cff", fontname="Inter", fontsize=10, fontcolor="#aebaff"];')
    shapes = {"start": "ellipse", "end": "ellipse", "io": "parallelogram",
              "decision": "diamond", "loop": "diamond", "merge": "point",
              "call": "box3d", "return": "ellipse", "raise": "cds",
              "unsupported": "octagon", "unreachable": "box"}
    fills = {"decision": "#3d2b12", "loop": "#12332b", "io": "#14263f",
             "call": "#241a3f", "unsupported": "#3f1420",
             "unreachable": "#26262e", "raise": "#3f1420"}
    for n in b.nodes:
        shape = shapes.get(n["kind"], "box")
        fill = fills.get(n["kind"], "#171d33")
        lines.append('  %s [label="%s", shape=%s, fillcolor="%s"];'
                     % (n["id"], esc(n["label"]), shape, fill))
    for e in b.edges:
        lab = e.get("label")
        attrs = []
        if lab:
            attrs.append('label="%s"' % esc(lab))
        if e.get("back"):
            attrs.append('constraint=false')
        if e.get("kind") == "call":
            attrs.append('style=dashed')
        lines.append("  %s -> %s%s;" % (e["from"], e["to"],
                                        (" [" + ", ".join(attrs) + "]")
                                        if attrs else ""))
    lines.append("}")
    return "\n".join(lines)


def _trace_text(b):
    order = {}
    for i, n in enumerate(b.nodes):
        order[n["id"]] = i
    succ = {}
    for e in b.edges:
        succ.setdefault(e["from"], []).append(e)
    out = []
    visited = set()

    def walk(nid, depth, guard):
        if nid in visited or guard > 400:
            return
        visited.add(nid)
        node = next((x for x in b.nodes if x["id"] == nid), None)
        if node is None:
            return
        out.append("  " * depth + "%s %s" %
                   (node["kind"].upper(), node["label"]))
        nxt = succ.get(nid, [])
        for e in nxt:
            if e.get("back"):
                out.append("  " * (depth + 1) + "↩ back to " + e["to"])
            else:
                walk(e["to"], depth + (1 if len(nxt) > 1 else 0), guard + 1)

    starts = [n["id"] for n in b.nodes if n["kind"] == "start"]
    if starts:
        walk(starts[0], 0, 0)
    return "\n".join(out)


def to_ir(code):
    conv = Converter(code)
    return json.dumps(conv.run())


# Browser entry point (Pyodide): flowchart_ir(code) -> JSON string
def flowchart_ir(code):
    return to_ir(code)


if __name__ == "__main__":
    import sys as _s
    # Desktop CLI only. Under Pyodide (Emscripten) __name__ is also
    # "__main__", but there is no readable stdin in the browser —
    # _s.stdin.read() raises OSError [Errno 29] and kills the load.
    # The browser path calls flowchart_ir() directly instead.
    if _s.platform != "emscripten":
        print(to_ir(_s.stdin.read()))
