"""
Skillzify v2 — flowchart-gen.py
Converts Python source code into a flowchart graph (nodes + edges as JSON).

Runs inside Pyodide in the browser. Entry point: flowchart_json(code) -> str.

Node types: start, end, process, decision, io, subroutine
Edge: {from, to, label} — label is "" or "Yes"/"No".

Deterministic AST-based generation (no AI hallucination). A node budget
keeps huge programs readable.
"""

import ast
import json


MAX_LABEL = 42
NODE_BUDGET = 60


def _short(node):
    try:
        s = ast.unparse(node).replace("\n", " ").strip()
    except Exception:
        s = type(node).__name__
    s = " ".join(s.split())
    if len(s) > MAX_LABEL:
        s = s[: MAX_LABEL - 1] + "\u2026"
    return s


def _is_io_call(node):
    return (
        isinstance(node, ast.Expr)
        and isinstance(node.value, ast.Call)
        and isinstance(node.value.func, ast.Name)
        and node.value.func.id in ("print", "input")
    )


class FlowchartBuilder:
    def __init__(self, budget=NODE_BUDGET):
        self.nodes = []
        self.edges = []
        self._n = 0
        self.budget = budget
        self.truncated = False

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

    # ---- core: walk a statement list, return list of tail ids ----
    # A tail is either a node id, or a (node_id, edge_label) tuple meaning
    # "when connecting onward, label the edge".

    def walk_body(self, stmts, entry):
        """Chain statements after `entry`. Returns list of tails."""
        tails = [entry]
        for s in stmts:
            new_tails = []
            for t in tails:
                if isinstance(t, tuple):
                    base, pending_label = t
                else:
                    base, pending_label = t, ""
                if base is None:
                    continue
                # The first edge from base into this statement carries
                # any pending label (e.g. "No" from a loop exit).
                first_id = self._next_id()
                stmt_tails = self.walk_stmt(s, base)
                if pending_label and self._next_id() != first_id:
                    self.label_edge(base, first_id, pending_label)
                new_tails.extend(stmt_tails)
            tails = new_tails
            if not tails:
                break
        return tails

    def _connect(self, tails, nxt):
        for t in tails:
            if isinstance(t, tuple):
                self.add_edge(t[0], nxt, t[1])
            else:
                self.add_edge(t, nxt)

    def walk_stmt(self, s, prev):
        """Walk one statement after `prev`. Returns list of tails."""
        # ---- simple statements ----
        if isinstance(s, (ast.Assign, ast.AugAssign, ast.AnnAssign,
                          ast.Import, ast.ImportFrom, ast.Assert,
                          ast.Delete, ast.Global, ast.Nonlocal)):
            nid = self.add_node("process", _short(s))
            self.add_edge(prev, nid)
            return [nid] if nid else []

        if isinstance(s, ast.Expr):
            ntype = "io" if _is_io_call(s) else "process"
            nid = self.add_node(ntype, _short(s))
            self.add_edge(prev, nid)
            return [nid] if nid else []

        if isinstance(s, (ast.Break, ast.Continue, ast.Pass)):
            nid = self.add_node("process", type(s).__name__.lower())
            self.add_edge(prev, nid)
            return [nid] if nid else []

        if isinstance(s, ast.Return):
            nid = self.add_node(
                "io", "return " + (_short(s.value) if s.value else ""))
            self.add_edge(prev, nid)
            return [nid] if nid else []

        # ---- if ----
        if isinstance(s, ast.If):
            cond = self.add_node("decision", _short(s.test) + " ?")
            if not cond:
                return []
            self.add_edge(prev, cond)
            then_first = self._next_id()
            then_tails = self.walk_body(s.body, cond)
            self.label_edge(cond, then_first, "Yes")
            if s.orelse:
                else_first = self._next_id()
                else_tails = self.walk_body(s.orelse, cond)
                self.label_edge(cond, else_first, "No")
                return then_tails + else_tails
            return then_tails + [(cond, "No")]

        # ---- while / for ----
        if isinstance(s, (ast.While, ast.For)):
            if isinstance(s, ast.While):
                label = _short(s.test) + " ?"
            else:
                label = ("for " + _short(s.target) + " in "
                         + _short(s.iter) + " ?")
            cond = self.add_node("decision", label)
            if not cond:
                return []
            self.add_edge(prev, cond)
            body_first = self._next_id()
            body_tails = self.walk_body(s.body, cond)
            if body_first != self._next_id():
                self.label_edge(cond, body_first, "Yes")
            # loop back
            for t in body_tails:
                if isinstance(t, tuple):
                    self.add_edge(t[0], cond, t[1])
                else:
                    self.add_edge(t, cond)
            return [(cond, "No")]

        # ---- function def ----
        if isinstance(s, ast.FunctionDef):
            nid = self.add_node(
                "subroutine",
                "define %s(%s)" % (s.name, ", ".join(
                    a.arg for a in s.args.args)))
            if not nid:
                return []
            self.add_edge(prev, nid)
            self.walk_body(s.body, nid)  # detached sub-flow
            return [nid]

        if isinstance(s, (ast.AsyncFunctionDef,)):
            return self.walk_stmt(
                ast.FunctionDef(name=s.name, args=s.args, body=s.body,
                                decorator_list=[], returns=None), prev)

        # ---- try ----
        if isinstance(s, ast.Try):
            nid = self.add_node("process", "try")
            if not nid:
                return []
            self.add_edge(prev, nid)
            tails = self.walk_body(s.body, nid)
            for h in s.handlers:
                tails += self.walk_body(h.body, nid)
            if s.orelse:
                tails += self.walk_body(s.orelse, nid)
            if s.finalbody:
                # finally always runs: chain it after all tails
                fin_tails = []
                for t in tails:
                    base = t[0] if isinstance(t, tuple) else t
                    if base:
                        fin_tails.extend(self.walk_body(s.finalbody, base))
                return fin_tails or tails
            return tails

        # ---- with ----
        if isinstance(s, ast.With):
            nid = self.add_node("process", _short(s.items[0].context_expr)
                                if s.items else "with")
            if not nid:
                return []
            self.add_edge(prev, nid)
            return self.walk_body(s.body, nid) or [nid]

        # ---- fallback ----
        nid = self.add_node("process", _short(s))
        self.add_edge(prev, nid)
        return [nid] if nid else []


def flowchart_json(code, budget=NODE_BUDGET):
    """Parse Python `code`; return JSON {nodes, edges, truncated, error}."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return json.dumps({
            "nodes": [], "edges": [], "truncated": False,
            "error": "Syntax error on line %d: %s" % (e.lineno or 0, e.msg),
        })
    b = FlowchartBuilder(budget=budget)
    start = b.add_node("start", "Start")
    tails = b.walk_body(tree.body, start) if start else []
    end = b.add_node("end", "End")
    if end:
        b._connect(tails, end)
    return json.dumps({
        "nodes": b.nodes,
        "edges": b.edges,
        "truncated": b.truncated,
        "error": None,
    })
