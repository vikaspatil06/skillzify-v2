"""
Skillzify App 2.0 — Flowchart Lab 2.0 execution tracer.

Runs Python code under sys.settrace and records one step per source
line executed IN THE USER'S OWN CODE (stdlib frames are not traced):
the line number plus a snapshot of the local variables at that line.
FlowchartScreen maps each step's line to the flowchart node stamped
with that line (flowchart_gen.py), so learners watch the chart light
up as the program actually runs — real execution, not graph order.

Safety rails (learning snippets, on-device):
  - recording caps at MAX_STEPS steps (truncated=True beyond that;
    execution still finishes so the output is complete);
  - a hard line-event budget aborts runaway code (infinite loops)
    with a plain-language error;
  - variable values are repr()s truncated to 60 chars, max 12 vars;
  - program output is captured and truncated to 4000 chars.
"""

import io
import json
import sys

MAX_STEPS = 500
MAX_LINE_EVENTS = 200000


class _Abort(Exception):
    pass


def _snapshot(frame):
    out = {}
    for k, v in frame.f_locals.items():
        if k.startswith("__"):
            continue
        try:
            r = repr(v)
        except Exception:
            r = "<unprintable>"
        out[k] = r[:60]
        if len(out) >= 12:
            break
    return out


def trace_json(code, stdin_text=""):
    """Trace `code`; return JSON {steps, output, error, truncated}."""
    try:
        compiled = compile(code, "<trace>", "exec")
    except SyntaxError as e:
        return json.dumps({
            "steps": [], "output": "", "truncated": False,
            "error": "Syntax error on line %d: %s" % (e.lineno or 0, e.msg),
        })

    steps = []
    state = {"events": 0, "truncated": False}

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != "<trace>":
            return None
        if event == "line":
            state["events"] += 1
            if state["events"] > MAX_LINE_EVENTS:
                raise _Abort()
            if len(steps) < MAX_STEPS:
                steps.append({"line": frame.f_lineno, "vars": _snapshot(frame)})
            else:
                state["truncated"] = True
        return tracer

    out_buf = io.StringIO()
    old_stdout, old_stdin = sys.stdout, sys.stdin
    error = None
    sys.stdout = out_buf
    sys.stdin = io.StringIO(stdin_text or "")
    try:
        sys.settrace(tracer)
        try:
            exec(compiled, {"__name__": "__main__"})
        finally:
            sys.settrace(None)
    except _Abort:
        error = "Execution stopped: too many steps (possible infinite loop)."
        state["truncated"] = True
    except BaseException as e:  # the traced program's own errors land here
        if isinstance(e, _Abort) or type(e).__name__ == "_Abort":
            error = "Execution stopped: too many steps (possible infinite loop)."
            state["truncated"] = True
        else:
            error = "%s: %s" % (type(e).__name__, e)
    finally:
        sys.stdout = old_stdout
        sys.stdin = old_stdin

    return json.dumps({
        "steps": steps,
        "output": out_buf.getvalue()[:4000],
        "error": error,
        "truncated": state["truncated"],
    })
