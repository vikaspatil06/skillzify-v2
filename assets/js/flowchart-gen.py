"""
Skillzify v2 — flowchart-gen.py
Converts Python source code into a flowchart graph (nodes + edges as JSON).

Runs inside Pyodide in the browser. Entry point: flowchart_json(code) -> str.

Node types: start, end, process, decision, io, subroutine
Edge: {from, to, label} — label is "" or "Yes"/"No" (or an exception
name on a try-handler edge, or "no error" on a try-orelse edge).

Deterministic AST-based generation (no AI hallucination). A node budget
keeps huge programs readable.

Design notes (rewritten 6 Nov 2026 after a deep check found the old
walker charted every statement once per incoming tail, duplicating
whole branches after any if-without-else):
- walk_body/walk_stmt take a LIST of entry tails and walk each statement
  exactly once, connecting every entry to the statement's first node.
  A tail is either a node id, or a (node_id, edge_label) tuple meaning
  "when connecting onward, label the edge" (the No-exit of an if/loop).
- break/continue/return terminate the path they are on: break routes to
  the statement after the innermost loop, continue jumps back to the
  loop condition, return routes straight to End. They never chain onward.
- A function definition is a subroutine node only: its body is NOT
  charted in the main flow (a def does not execute its body). The body
  can be charted separately by pasting it on its own.
- try/except/else/finally: handler edges are labelled with the exception
  type, the orelse edge with "no error", and finally is walked once with
  every path as its entries (never duplicated per path).
- match/case is charted as a decision chain (subject node, then one
  decision per case, No chaining to the next case).
- The End node always gets a reserved slot, even for truncated programs.
"""

import ast
import json


MAX_LABEL = 42
MAX_DECISION_LABEL = 60
NODE_BUDGET = 60


def _cap(s, cap=MAX_LABEL):
    s = " ".join(str(s).split())
    if len(s) > cap:
        s = s[: cap - 1] + "\u2026"
    return s


def _short(node, cap=MAX_LABEL):
    try:
        s = ast.unparse(node).replace("\n", " ").strip()
    except Exception:
        s = type(node).__name__
    return _cap(s, cap)


def _has_io_call(node):
    """True when the statement (sub)tree calls print() or input()."""
    for sub in ast.walk(node):
        if (isinstance(sub, ast.Call)
                and isinstance(sub.func, ast.Name)
                and sub.func.id in ("print", "input")):
            return True
    return False


class FlowchartBuilder:
    def __init__(self, budget=NODE_BUDGET):
        self.nodes = []
        self.edges = []
        self._n = 0
        self.budget = budget
        self.truncated = False
        # Stack of innermost-loop frames: {"cond": id, "breaks": [ids]}.
        self._loops = []
        # Return nodes: they route straight to End, never onward.
        self._exits = []

    def _next_id(self):
        return "n%d" % (self._n + 1)

    def add_node(self, ntype, label):
        if self._n >= self.budget:
            self.truncated = True
            return None
        self._n += 1
        nid = "n%d" % self._n
        self.nodes.append({"id": nid, "type": ntype, "label": label})
        return nid

    def add_edge(self, frm, to, label=""):
        if frm and to:
            self.edges.append({"from": frm, "to": to, "label": label})

    def label_edge(self, frm, to, label):
        for e in self.edges:
            if e["from"] == frm and e["to"] == to and not e["label"]:
                e["label"] = label
                return

    def _connect(self, entries, nxt):
        """Connect every entry tail to nxt, honouring tuple labels."""
        for t in entries:
            if isinstance(t, tuple):
                self.add_edge(t[0], nxt, t[1])
            else:
                self.add_edge(t, nxt)

    # ---- core: walk a statement list, return list of tail ids ----
    # A tail is either a node id, or a (node_id, edge_label) tuple meaning
    # "when connecting onward, label the edge".

    def walk_body(self, stmts, entries):
        """Walk statements once, chaining after `entries`. Returns tails."""
        tails = list(entries)
        for s in stmts:
            if not tails:
                break
            tails = self.walk_stmt(s, tails)
        return tails

    def walk_stmt(self, s, entries):
        """Walk one statement after `entries` (list of tails). Returns tails."""
        # ---- simple statements ----
        if isinstance(s, (ast.Assign, ast.AugAssign, ast.AnnAssign,
                          ast.Import, ast.ImportFrom, ast.Assert,
                          ast.Delete, ast.Global, ast.Nonlocal)):
            ntype = "io" if _has_io_call(s) else "process"
            nid = self.add_node(ntype, _short(s))
            if not nid:
                return []
            self._connect(entries, nid)
            return [nid]

        if isinstance(s, ast.Expr):
            ntype = "io" if _has_io_call(s) else "process"
            nid = self.add_node(ntype, _short(s))
            if not nid:
                return []
            self._connect(entries, nid)
            return [nid]

        if isinstance(s, ast.Pass):
            nid = self.add_node("process", "pass")
            if not nid:
                return []
            self._connect(entries, nid)
            return [nid]

        if isinstance(s, ast.Break):
            nid = self.add_node("process", "break")
            if not nid:
                return []
            self._connect(entries, nid)
            if self._loops:
                # Exit the innermost loop: route to the statement after it.
                self._loops[-1]["breaks"].append(nid)
                return []
            return [nid]

        if isinstance(s, ast.Continue):
            nid = self.add_node("process", "continue")
            if not nid:
                return []
            self._connect(entries, nid)
            if self._loops:
                # Skip the rest of the body: jump back to the condition.
                self.add_edge(nid, self._loops[-1]["cond"])
                return []
            return [nid]

        if isinstance(s, ast.Return):
            nid = self.add_node(
                "io", "return " + (_short(s.value, MAX_DECISION_LABEL - 7)
                                   if s.value else ""))
            if not nid:
                return []
            self._connect(entries, nid)
            # A return ends the path: it routes to End, never onward.
            self._exits.append(nid)
            return []

        # ---- if ----
        if isinstance(s, ast.If):
            cond = self.add_node("decision", _short(s.test, MAX_DECISION_LABEL - 2) + " ?")
            if not cond:
                return list(entries)
            self._connect(entries, cond)
            then_first = self._next_id()
            then_tails = self.walk_body(s.body, [cond])
            if then_first != self._next_id():
                self.label_edge(cond, then_first, "Yes")
            if s.orelse:
                else_first = self._next_id()
                else_tails = self.walk_body(s.orelse, [cond])
                if else_first != self._next_id():
                    self.label_edge(cond, else_first, "No")
                return then_tails + else_tails
            return then_tails + [(cond, "No")]

        # ---- while / for ----
        if isinstance(s, (ast.While, ast.For)):
            if isinstance(s, ast.While):
                label = _cap(_short(s.test, MAX_DECISION_LABEL - 2) + " ?", MAX_DECISION_LABEL)
            else:
                label = _cap("for " + _short(s.target) + " in "
                             + _short(s.iter) + " ?", MAX_DECISION_LABEL)
            cond = self.add_node("decision", label)
            if not cond:
                return list(entries)
            self._connect(entries, cond)
            self._loops.append({"cond": cond, "breaks": []})
            body_first = self._next_id()
            body_tails = self.walk_body(s.body, [cond])
            if body_first != self._next_id():
                self.label_edge(cond, body_first, "Yes")
            frame = self._loops.pop()
            # loop back: every body tail returns to the condition
            for t in body_tails:
                if isinstance(t, tuple):
                    self.add_edge(t[0], cond, t[1])
                else:
                    self.add_edge(t, cond)
            if s.orelse:
                # loop-else runs when the loop finishes WITHOUT a break
                else_first = self._next_id()
                else_tails = self.walk_body(s.orelse, [cond])
                if else_first != self._next_id():
                    self.label_edge(cond, else_first, "No")
                return frame["breaks"] + else_tails
            return frame["breaks"] + [(cond, "No")]

        # ---- function def: subroutine node only, body NOT charted ----
        # A def does not execute its body; charting it inline made the
        # diagram claim the body runs at definition time.
        if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef)):
            try:
                sig = ast.unparse(s.args)
            except Exception:
                sig = ", ".join(a.arg for a in s.args.args)
            nid = self.add_node(
                "subroutine",
                _cap("define %s(%s)" % (s.name, sig), MAX_DECISION_LABEL))
            if not nid:
                return []
            self._connect(entries, nid)
            return [nid]

        # ---- class def: subroutine node only, body NOT charted ----
        # A class definition does not execute its body (methods run only
        # when called); flattening the whole body into one process label
        # claimed otherwise. Mirror the FunctionDef branch.
        if isinstance(s, ast.ClassDef):
            nid = self.add_node(
                "subroutine",
                _cap("class " + s.name, MAX_DECISION_LABEL))
            if not nid:
                return []
            self._connect(entries, nid)
            return [nid]

        # ---- match / case: decision chain ----
        if isinstance(s, ast.Match):
            subj = self.add_node(
                "process", _cap("match " + _short(s.subject), MAX_DECISION_LABEL))
            if not subj:
                return list(entries)
            self._connect(entries, subj)
            tails = []
            cur = subj
            for case in s.cases:
                pat = _short(case.pattern, 40)
                if case.guard is not None:
                    pat += " if " + _short(case.guard, 20)
                cdec = self.add_node(
                    "decision", _cap("case " + pat, MAX_DECISION_LABEL) + " ?")
                if not cdec:
                    return tails + [(cur, "No")]
                self.add_edge(cur, cdec, "No" if cur is not subj else "")
                first = self._next_id()
                body_tails = self.walk_body(case.body, [cdec])
                if first != self._next_id():
                    self.label_edge(cdec, first, "Yes")
                tails.extend(body_tails)
                cur = cdec
            tails.append((cur, "No"))
            return tails

        # ---- try ----
        if isinstance(s, ast.Try):
            nid = self.add_node("process", "try")
            if not nid:
                return list(entries)
            self._connect(entries, nid)
            tails = self.walk_body(s.body, [nid])
            for h in s.handlers:
                hname = _short(h.type) if h.type is not None else "except"
                h_first = self._next_id()
                h_tails = self.walk_body(h.body, [nid])
                if h_first != self._next_id():
                    self.label_edge(nid, h_first, hname)
                tails += h_tails
            if s.orelse:
                o_first = self._next_id()
                o_tails = self.walk_body(s.orelse, [nid])
                if o_first != self._next_id():
                    self.label_edge(nid, o_first, "no error")
                tails += o_tails
            if s.finalbody:
                # finally runs after every path: walk it ONCE with all
                # tails as entries (never once per path — that duplicated
                # the finally block). Known limit: paths that ended in
                # return skip finally here (they route straight to End).
                fin_tails = self.walk_body(s.finalbody, tails)
                return fin_tails or tails
            return tails

        # ---- with ----
        if isinstance(s, ast.With):
            nid = self.add_node("process", _short(s.items[0].context_expr)
                                if s.items else "with")
            if not nid:
                return list(entries)
            self._connect(entries, nid)
            return self.walk_body(s.body, [nid]) or [nid]

        # ---- fallback ----
        nid = self.add_node("process", _short(s))
        if not nid:
            return []
        self._connect(entries, nid)
        return [nid]


def flowchart_json(code, budget=NODE_BUDGET):
    """Parse Python `code`; return JSON {nodes, edges, truncated, error}."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return json.dumps({
            "nodes": [], "edges": [], "truncated": False,
            "error": "Syntax error on line %d: %s" % (e.lineno or 0, e.msg),
        })
    except Exception as e:
        # Deeply nested input can raise RecursionError at parse time, etc.
        return json.dumps({
            "nodes": [], "edges": [], "truncated": False,
            "error": "Could not read this code: %s" % type(e).__name__,
        })
    try:
        b = FlowchartBuilder(budget=budget)
        start = b.add_node("start", "Start")
        tails = b.walk_body(tree.body, [start]) if start else []
        # Reserve the End slot: the body walk may have consumed the budget.
        b.budget += 1
        # Capture the last charted node BEFORE adding End: once End is
        # appended, b.nodes[-1] IS End, so the fallback below could never
        # fire and a truncated diagram ended with an orphan End node.
        prev = b.nodes[-1] if b.nodes else None
        end = b.add_node("end", "End")
        if end:
            b._connect(tails + b._exits, end)
            if not tails and not b._exits and prev is not None:
                # Every path died inside the walk (budget cut): end the
                # diagram at the last charted node instead of an orphan End.
                b.add_edge(prev["id"], end)
        return json.dumps({
            "nodes": b.nodes,
            "edges": b.edges,
            "truncated": b.truncated,
            "error": None,
        })
    except Exception as e:
        return json.dumps({
            "nodes": [], "edges": [], "truncated": False,
            "error": "Could not chart this code: %s" % type(e).__name__,
        })
