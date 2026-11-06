"""
Skillzify v2 — flowchart-algo.py
Converts textbook-style pseudocode (structured English) into a flowchart
graph (nodes + edges as JSON).

Runs inside Pyodide in the browser. Entry point: algo_flowchart_json(text).

Pseudocode grammar (indentation marks nesting, as in the lab):
  START / BEGIN      (optional) — program entry
  INPUT x            (io)
  PRINT expr / OUTPUT expr / DISPLAY expr  (io)
  x = expr           (process)
  IF cond THEN ... [ELSE ...] END IF
  WHILE cond [DO] ... END WHILE
  FOR i FROM a TO b [STEP s] ... END FOR
  FOR i = a TO b [STEP s] ... END FOR
  FOR item IN items ... END FOR
  REPEAT ... UNTIL cond
  STOP / END         (terminal)
  CALL f(args)       (subroutine)
  FUNCTION name(args) ... END FUNCTION

Node types: start, end, process, decision, io, subroutine
Edge: {from, to, label} — label is "" or "Yes"/"No".

Design notes (rewritten 6 Nov 2026 after a deep check found the old
walker charted every statement once per incoming tail, duplicating
whole branches after any if-without-else):
- _walk_block takes a LIST of entry tails and walks each statement
  exactly once, connecting every entry to the statement's first node.
  A tail is either a node id, or a (node_id, edge_label) tuple meaning
  "when connecting onward, label the edge" (the No-exit of an if/loop).
- STOP ends the program: the walk stops at every nesting level and no
  synthetic End node is added after a Stop.
- REPEAT/UNTIL nesting is tracked by depth, not by indentation, so
  mis-indented ELSE/UNTIL lines still match their block.
- A function definition is a subroutine node only: its body is NOT
  charted in the main flow (a def does not execute its body).
- The End node always gets a reserved slot, even for truncated programs.
"""

import re
import json


MAX_LABEL = 42
MAX_DECISION_LABEL = 60
NODE_BUDGET = 60


def _clean(s):
    s = " ".join(str(s).strip().split())
    if len(s) > MAX_LABEL:
        s = s[: MAX_LABEL - 1] + "\u2026"
    return s


def _cap(s, cap=MAX_DECISION_LABEL):
    s = " ".join(str(s).strip().split())
    if len(s) > cap:
        s = s[: cap - 1] + "\u2026"
    return s


class AlgoBuilder:
    def __init__(self, budget=NODE_BUDGET):
        self.nodes = []
        self.edges = []
        self._n = 0
        self.budget = budget
        self.truncated = False
        self._saw_stop = False

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

    def _tail_id(self, t):
        return t[0] if isinstance(t, tuple) else t

    def _tail_label(self, t):
        return t[1] if isinstance(t, tuple) else ""

    def _find_end(self, lines, i, kind):
        """Find the index of the END <kind> matching the block at i.

        Depth-tracked, so nesting works even with sloppy indentation.
        REPEAT is closed by UNTIL, not by END REPEAT."""
        depth = 1
        j = i + 1
        while j < len(lines):
            u = lines[j][1].upper()
            if kind == "REPEAT":
                if u.startswith("REPEAT"):
                    depth += 1
                elif u.startswith("UNTIL"):
                    depth -= 1
                    if depth == 0:
                        return j
            else:
                if u.startswith("IF ") or u.startswith("IF("):
                    depth += 1
                elif u.startswith("WHILE "):
                    depth += 1
                elif u.startswith("FOR "):
                    depth += 1
                elif u.startswith("FUNCTION "):
                    depth += 1
                elif u.startswith("REPEAT"):
                    depth += 1
                elif u.startswith("UNTIL"):
                    depth -= 1
                elif u.startswith("END"):
                    # ANY block closer (END IF / ENDIF / END WHILE / ...)
                    # closes one nesting level; only the target kind's
                    # closer at depth 0 is the match.
                    depth -= 1
                    if depth == 0 and (u.startswith("END " + kind)
                                       or u.startswith("END" + kind)):
                        return j
            j += 1
        return -1

    def _simple_node(self, text):
        """Create a node for a one-line statement. Returns (nid, is_stop)."""
        u = text.upper()
        if u.startswith("INPUT"):
            return self.add_node("io", "Input " + _clean(text[5:])), False
        if u.startswith("PRINT") or u.startswith("OUTPUT") or u.startswith("DISPLAY"):
            rest = re.sub(r"^(PRINT|OUTPUT|DISPLAY)\s*", "", text, flags=re.I)
            return self.add_node("io", "Print " + _clean(rest)), False
        if u.startswith("READ"):
            return self.add_node("io", "Input " + _clean(text[4:])), False
        if u.startswith("CALL"):
            return self.add_node("subroutine", _clean(text[4:])), False
        if u.startswith("SET"):
            return self.add_node("process", _clean(text[3:])), False
        if u in ("STOP", "END", "EXIT"):
            nid = self.add_node("end", "Stop")
            if nid:
                self._saw_stop = True
            return nid, True
        if u.startswith("RETURN"):
            return self.add_node("io", _clean(text)), False
        if "=" in text:
            return self.add_node("process", _clean(text)), False
        return self.add_node("process", _clean(text)), False

    def _walk_block(self, lines, lo, hi, entries):
        """Walk lines[lo:hi] once, chaining after `entries`. Returns tails.

        A tail is either a node id, or a (node_id, edge_label) tuple."""
        tails = list(entries)
        i = lo
        while i < hi:
            if self._saw_stop:
                break
            indent, text = lines[i]
            u = text.upper()
            if not text:
                i += 1
                continue
            if u.startswith("ELSE"):
                break
            if u.startswith("START") or u.startswith("BEGIN"):
                i += 1
                continue
            if u.startswith("END FUNCTION") or u.startswith("END IF") or u.startswith("END WHILE") \
                    or u.startswith("END FOR") or u.startswith("UNTIL"):
                break

            # ---- IF ----
            m = re.match(r"IF\s+(.+?)\s+THEN\s*$", text, re.I)
            if m:
                end_idx = self._find_end(lines, i, "IF")
                if end_idx == -1:
                    raise ValueError("Missing END IF for: " + text)
                # ELSE belongs to this IF only at nesting depth 0.
                # No indent requirement: mis-indented ELSE still matches.
                else_idx = -1
                depth = 0
                for j in range(i + 1, end_idx):
                    uu = lines[j][1].upper()
                    if uu.startswith("IF ") or uu.startswith("IF("):
                        depth += 1
                    elif uu.startswith("END IF") or uu.startswith("ENDIF"):
                        depth -= 1
                    elif uu.startswith("ELSE") and depth == 0:
                        else_idx = j
                        break
                cond = self.add_node("decision", _cap(m.group(1)) + " ?")
                if not cond:
                    i = end_idx + 1
                    continue
                self._connect(tails, cond)
                then_first = self._next_id()
                then_tails = self._walk_block(
                    lines, i + 1, else_idx if else_idx != -1 else end_idx, [cond])
                if then_first != self._next_id():
                    self.label_edge(cond, then_first, "Yes")
                if else_idx != -1:
                    else_first = self._next_id()
                    else_tails = self._walk_block(lines, else_idx + 1, end_idx, [cond])
                    if else_first != self._next_id():
                        self.label_edge(cond, else_first, "No")
                    tails = then_tails + else_tails
                else:
                    tails = then_tails + [(cond, "No")]
                i = end_idx + 1
                continue

            # ---- WHILE ----
            m = re.match(r"WHILE\s+(.+?)(?:\s+DO)?\s*$", text, re.I)
            if m:
                end_idx = self._find_end(lines, i, "WHILE")
                if end_idx == -1:
                    raise ValueError("Missing END WHILE for: " + text)
                cond = self.add_node("decision", _cap(m.group(1)) + " ?")
                if not cond:
                    i = end_idx + 1
                    continue
                self._connect(tails, cond)
                body_first = self._next_id()
                body_tails = self._walk_block(lines, i + 1, end_idx, [cond])
                if body_first != self._next_id():
                    self.label_edge(cond, body_first, "Yes")
                for bt in body_tails:
                    self.add_edge(self._tail_id(bt), cond, self._tail_label(bt))
                tails = [(cond, "No")]
                i = end_idx + 1
                continue

            # ---- FOR ----
            m = re.match(
                r"FOR\s+(\w+)\s+(?:FROM\s+(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+?))?"
                r"|=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+?))?"
                r"|IN\s+(.+?))\s*$", text, re.I)
            if m:
                end_idx = self._find_end(lines, i, "FOR")
                if end_idx == -1:
                    raise ValueError("Missing END FOR for: " + text)
                var = m.group(1)
                if m.group(2) is not None:
                    a, b, step = m.group(2), m.group(3), m.group(4)
                elif m.group(5) is not None:
                    a, b, step = m.group(5), m.group(6), m.group(7)
                else:
                    cond = self.add_node(
                        "decision", _cap("for " + var + " in " + m.group(8)) + " ?")
                    if cond:
                        self._connect(tails, cond)
                        body_first = self._next_id()
                        body_tails = self._walk_block(lines, i + 1, end_idx, [cond])
                        if body_first != self._next_id():
                            self.label_edge(cond, body_first, "Yes")
                        for bt in body_tails:
                            self.add_edge(self._tail_id(bt), cond, self._tail_label(bt))
                        tails = [(cond, "No")]
                    i = end_idx + 1
                    continue
                label = "%s = %s to %s" % (var, a.strip(), b.strip())
                if step:
                    label += " step " + step.strip()
                cond = self.add_node("decision", _cap(label) + " ?")
                if not cond:
                    i = end_idx + 1
                    continue
                self._connect(tails, cond)
                body_first = self._next_id()
                body_tails = self._walk_block(lines, i + 1, end_idx, [cond])
                if body_first != self._next_id():
                    self.label_edge(cond, body_first, "Yes")
                for bt in body_tails:
                    self.add_edge(self._tail_id(bt), cond, self._tail_label(bt))
                tails = [(cond, "No")]
                i = end_idx + 1
                continue

            # ---- REPEAT ----
            if u.startswith("REPEAT"):
                end_idx = self._find_end(lines, i, "REPEAT")
                if end_idx == -1:
                    raise ValueError("Missing UNTIL for REPEAT")
                until_text = lines[end_idx][1]
                mu = re.match(r"UNTIL\s+(.+?)\s*$", until_text, re.I)
                until_cond = mu.group(1) if mu else ""
                body_first = self._next_id()
                body_tails = self._walk_block(lines, i + 1, end_idx, tails)
                cond = self.add_node("decision", _cap(until_cond) + " ?")
                if not cond:
                    tails = body_tails
                    i = end_idx + 1
                    continue
                for bt in body_tails:
                    self.add_edge(self._tail_id(bt), cond, self._tail_label(bt))
                if body_first != self._next_id():
                    # loop back until the condition is true
                    self.add_edge(cond, body_first, "No")
                else:
                    # empty body: the entries flow straight into the test
                    self._connect(tails, cond)
                tails = [(cond, "Yes")]
                i = end_idx + 1
                continue

            # ---- FUNCTION ----
            m = re.match(r"FUNCTION\s+(\w+)\s*\((.*)\)\s*$", text, re.I)
            if m:
                end_idx = self._find_end(lines, i, "FUNCTION")
                if end_idx == -1:
                    raise ValueError("Missing END FUNCTION for: " + text)
                nid = self.add_node(
                    "subroutine", _cap("define %s(%s)" % (m.group(1), m.group(2))))
                if nid:
                    self._connect(tails, nid)
                    tails = [nid]
                i = end_idx + 1
                continue

            # ---- simple statement ----
            nid, is_stop = self._simple_node(text)
            if nid:
                self._connect(tails, nid)
                tails = [nid]
            i += 1
        return tails


def algo_flowchart_json(text, budget=NODE_BUDGET):
    """Parse pseudocode `text`; return JSON {nodes, edges, truncated, error}."""
    try:
        lines = []
        for raw in (text or "").split("\n"):
            if not raw.strip() or raw.strip().startswith("#"):
                continue
            indent = len(raw) - len(raw.lstrip())
            lines.append((indent, raw.strip()))
        if not lines:
            return json.dumps({
                "nodes": [], "edges": [], "truncated": False,
                "error": "No steps found. Write your algorithm line by line.",
            })
        b = AlgoBuilder(budget=budget)
        start = b.add_node("start", "Start")
        tails = b._walk_block(lines, 0, len(lines), [start]) if start else []
        # Reserve the End slot: the body walk may have consumed the budget.
        b.budget += 1
        if b._saw_stop:
            # STOP is the terminal node: no synthetic End after it.
            end = None
        else:
            end = b.add_node("end", "End")
        if end:
            b._connect(tails, end)
            if not tails and b.nodes:
                # Every path died inside the walk (budget cut): end the
                # diagram at the last charted node instead of an orphan End.
                last = b.nodes[-1]
                if last["id"] != end:
                    b.add_edge(last["id"], end)
        return json.dumps({
            "nodes": b.nodes,
            "edges": b.edges,
            "truncated": b.truncated,
            "error": None,
        })
    except ValueError as e:
        return json.dumps({
            "nodes": [], "edges": [], "truncated": False,
            "error": str(e),
        })
    except Exception as e:
        return json.dumps({
            "nodes": [], "edges": [], "truncated": False,
            "error": "Could not chart this pseudocode: %s" % type(e).__name__,
        })
