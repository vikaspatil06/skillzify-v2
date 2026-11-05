"""
Skillzify v2 — flowchart-algo.py
Converts structured algorithm pseudocode into a flowchart graph (nodes + edges).

Input format (case-insensitive keywords, indentation for blocks):

    START
    INPUT n
    SET total = 0
    FOR i FROM 1 TO n
        IF i % 2 == 0 THEN
            total = total + i
        ELSE
            total = total - i
        END IF
    END FOR
    PRINT total
    END

Supported statements:
    START / END / STOP
    INPUT x, y            -> io node
    OUTPUT / PRINT expr   -> io node
    SET x = expr          -> process node
    <anything else>       -> process node
    IF cond THEN ... [ELSE ...] END IF
    WHILE cond ... END WHILE
    FOR var FROM a TO b ... END FOR
    REPEAT ... UNTIL cond

Runs in Pyodide. Entry point: algo_flowchart_json(text) -> str.
Output format matches flowchart-gen.py: {nodes, edges, truncated, error}.
"""

import json
import re


MAX_LABEL = 42
NODE_BUDGET = 60


def _clean(s):
    s = " ".join(s.split())
    if len(s) > MAX_LABEL:
        s = s[: MAX_LABEL - 1] + "\u2026"
    return s


class AlgoParser:
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

    # ---------- parsing ----------

    def parse(self, text):
        lines = []
        for raw in text.split("\n"):
            stripped = raw.strip()
            if not stripped or stripped.startswith("#"):
                continue
            indent = len(raw) - len(raw.lstrip())
            lines.append((indent, stripped))
        if not lines:
            return {"nodes": [], "edges": [], "truncated": False,
                    "error": "No steps found. Write your algorithm line by line."}

        start = self.add_node("start", "Start")
        try:
            tails = self._walk_block(lines, 0, len(lines), start)
        except ValueError as e:
            return {"nodes": [], "edges": [], "truncated": False,
                    "error": str(e)}
        end = self.add_node("end", "End")
        if end:
            for t in tails:
                if isinstance(t, tuple):
                    self.add_edge(t[0], end, t[1])
                elif t:
                    self.add_edge(t, end)
        return {"nodes": self.nodes, "edges": self.edges,
                "truncated": self.truncated, "error": None}

    def _walk_block(self, lines, lo, hi, entry):
        """Walk lines[lo:hi], chaining after entry. Returns tails."""
        tails = [entry]
        i = lo
        while i < hi:
            indent, text = lines[i]
            upper = text.upper()

            # ----- block closers (handled by caller) -----
            if upper in ("END IF", "ENDIF", "END FOR", "ENDFOR",
                         "END WHILE", "ENDWHILE", "END"):
                break

            # ----- IF -----
            m = re.match(r"IF\s+(.+?)\s+THEN\s*$", text, re.I)
            if m:
                cond_text = m.group(1).strip()
                # find matching END IF / ELSE at same indent
                j = i + 1
                depth = 0
                else_idx = -1
                end_idx = -1
                while j < hi:
                    _, t2 = lines[j]
                    u2 = t2.upper()
                    if re.match(r"IF\s+.+\s+THEN\s*$", t2, re.I):
                        depth += 1
                    elif u2 in ("END IF", "ENDIF"):
                        if depth == 0:
                            end_idx = j
                            break
                        depth -= 1
                    elif u2 == "ELSE" and depth == 0 and lines[j][0] == indent:
                        else_idx = j
                    j += 1
                if end_idx == -1:
                    raise ValueError(
                        "Missing END IF for: %s" % text)
                cond = self.add_node("decision", _clean(cond_text) + " ?")
                new_tails = []
                for t in tails:
                    base = t[0] if isinstance(t, tuple) else t
                    plabel = t[1] if isinstance(t, tuple) else ""
                    if not base:
                        continue
                    self.add_edge(base, cond, plabel)
                    then_first = self._next_id()
                    then_tails = self._walk_block(lines, i + 1,
                                                  else_idx if else_idx != -1 else end_idx,
                                                  cond)
                    self.label_edge(cond, then_first, "Yes")
                    new_tails.extend(then_tails)
                    if else_idx != -1:
                        else_first = self._next_id()
                        else_tails = self._walk_block(lines, else_idx + 1,
                                                      end_idx, cond)
                        self.label_edge(cond, else_first, "No")
                        new_tails.extend(else_tails)
                    else:
                        new_tails.append((cond, "No"))
                tails = new_tails
                i = end_idx + 1
                continue

            # ----- WHILE -----
            m = re.match(r"WHILE\s+(.+?)\s*$", text, re.I)
            if m and not re.match(r"WHILE\s+.+\s+DO\s*$", text, re.I):
                cond_text = m.group(1).strip()
                end_idx = self._find_end(lines, i + 1, hi,
                                         ("END WHILE", "ENDWHILE"))
                if end_idx == -1:
                    raise ValueError("Missing END WHILE for: %s" % text)
                cond = self.add_node("decision", _clean(cond_text) + " ?")
                new_tails = []
                for t in tails:
                    base = t[0] if isinstance(t, tuple) else t
                    plabel = t[1] if isinstance(t, tuple) else ""
                    if not base:
                        continue
                    self.add_edge(base, cond, plabel)
                    body_first = self._next_id()
                    body_tails = self._walk_block(lines, i + 1, end_idx, cond)
                    self.label_edge(cond, body_first, "Yes")
                    for bt in body_tails:
                        bb = bt[0] if isinstance(bt, tuple) else bt
                        bl = bt[1] if isinstance(bt, tuple) else ""
                        if bb:
                            self.add_edge(bb, cond, bl)
                    new_tails.append((cond, "No"))
                tails = new_tails
                i = end_idx + 1
                continue

            # ----- FOR -----
            m = re.match(r"FOR\s+(\w+)\s+FROM\s+(.+?)\s+TO\s+(.+?)\s*$", text, re.I)
            if m:
                var, a, b = m.group(1), m.group(2).strip(), m.group(3).strip()
                end_idx = self._find_end(lines, i + 1, hi,
                                         ("END FOR", "ENDFOR"))
                if end_idx == -1:
                    raise ValueError("Missing END FOR for: %s" % text)
                cond = self.add_node(
                    "decision", _clean("%s = %s to %s" % (var, a, b)) + " ?")
                new_tails = []
                for t in tails:
                    base = t[0] if isinstance(t, tuple) else t
                    plabel = t[1] if isinstance(t, tuple) else ""
                    if not base:
                        continue
                    self.add_edge(base, cond, plabel)
                    body_first = self._next_id()
                    body_tails = self._walk_block(lines, i + 1, end_idx, cond)
                    self.label_edge(cond, body_first, "Yes")
                    for bt in body_tails:
                        bb = bt[0] if isinstance(bt, tuple) else bt
                        bl = bt[1] if isinstance(bt, tuple) else ""
                        if bb:
                            self.add_edge(bb, cond, bl)
                    new_tails.append((cond, "No"))
                tails = new_tails
                i = end_idx + 1
                continue

            # ----- REPEAT / UNTIL -----
            if upper == "REPEAT":
                end_idx = -1
                j = i + 1
                while j < hi:
                    _, t2 = lines[j]
                    mu = re.match(r"UNTIL\s+(.+)", t2, re.I)
                    if mu and lines[j][0] == indent:
                        end_idx = j
                        until_cond = mu.group(1).strip()
                        break
                    j += 1
                if end_idx == -1:
                    raise ValueError("Missing UNTIL for REPEAT")
                new_tails = []
                for t in tails:
                    base = t[0] if isinstance(t, tuple) else t
                    plabel = t[1] if isinstance(t, tuple) else ""
                    if not base:
                        continue
                    body_tails = self._walk_block(lines, i + 1, end_idx, base)
                    # connect entry->body first node with pending label
                    # (walk_block already chained from base)
                    cond = self.add_node(
                        "decision", _clean(until_cond) + " ?")
                    for bt in body_tails:
                        bb = bt[0] if isinstance(bt, tuple) else bt
                        bl = bt[1] if isinstance(bt, tuple) else ""
                        if bb:
                            self.add_edge(bb, cond, bl)
                    # No -> loop back to body start; Yes -> exit
                    # find body first node = first edge from base
                    firsts = [e["to"] for e in self.edges
                              if e["from"] == base]
                    if firsts:
                        self.add_edge(cond, firsts[0], "No")
                    new_tails.append((cond, "Yes"))
                tails = new_tails
                i = end_idx + 1
                continue

            # ----- simple statements -----
            nid = self._simple_node(text)
            new_tails = []
            for t in tails:
                base = t[0] if isinstance(t, tuple) else t
                plabel = t[1] if isinstance(t, tuple) else ""
                if base and nid:
                    self.add_edge(base, nid, plabel)
                    new_tails.append(nid)
                elif base:
                    new_tails.append(t)
            tails = new_tails
            i += 1

        return tails

    def _find_end(self, lines, lo, hi, closers):
        depth = 0
        for j in range(lo, hi):
            _, t = lines[j]
            u = t.upper()
            if (re.match(r"IF\s+.+\s+THEN\s*$", t, re.I)
                    or re.match(r"WHILE\s+.+$", t, re.I)
                    or re.match(r"FOR\s+\w+\s+FROM\s+.+$", t, re.I)
                    or u == "REPEAT"):
                depth += 1
            elif u in ("END IF", "ENDIF", "END WHILE", "ENDWHILE",
                       "END FOR", "ENDFOR"):
                if u in closers and depth == 0:
                    return j
                if depth > 0:
                    depth -= 1
                # a closer for another block type at depth 0 when we're
                # looking for a different closer: let the caller handle it
        return -1

    def _simple_node(self, text):
        upper = text.upper()
        if upper in ("START", "BEGIN"):
            return None  # already have start
        if upper in ("STOP",):
            nid = self.add_node("end", "Stop")
            return nid
        m = re.match(r"INPUT\s+(.+)", text, re.I)
        if m:
            return self.add_node("io", "Input " + _clean(m.group(1)))
        m = re.match(r"(OUTPUT|PRINT)\s+(.+)", text, re.I)
        if m:
            return self.add_node("io", "Print " + _clean(m.group(2)))
        m = re.match(r"SET\s+(.+)", text, re.I)
        if m:
            return self.add_node("process", _clean(m.group(1)))
        m = re.match(r"CALL\s+(.+)", text, re.I)
        if m:
            return self.add_node("subroutine", _clean(m.group(1)))
        if upper.startswith("RETURN"):
            return self.add_node("io", _clean(text))
        return self.add_node("process", _clean(text))


def algo_flowchart_json(text, budget=NODE_BUDGET):
    p = AlgoParser(budget=budget)
    return json.dumps(p.parse(text))
