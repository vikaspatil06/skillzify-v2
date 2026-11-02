"""Skillzify Python runner (Chaquopy).

Runs user code with redirected stdin/stdout/stderr and returns a JSON string:
{"ok": bool, "output": str, "error": str, "ms": int}
"""
import io
import json
import sys
import time
import traceback


def run_code(code, stdin_text):
    old_stdin, old_stdout, old_stderr = sys.stdin, sys.stdout, sys.stderr
    sys.stdin = io.StringIO(stdin_text)
    out_buf, err_buf = io.StringIO(), io.StringIO()
    sys.stdout, sys.stderr = out_buf, err_buf
    t0 = time.time()
    ok = True
    err_text = ""
    try:
        exec(compile(code, "<skillzify>", "exec"), {"__name__": "__main__"})
    except BaseException:
        ok = False
        err_text = traceback.format_exc()
    finally:
        ms = int((time.time() - t0) * 1000)
        sys.stdin, sys.stdout, sys.stderr = old_stdin, old_stdout, old_stderr
    return json.dumps(
        {"ok": ok, "output": out_buf.getvalue(), "error": err_text, "ms": ms}
    )


def run_tests(code, tests_json):
    """Run hidden tests against user code, mirroring the web's str(eval(run)) logic.

    tests_json: JSON array of {"run": expr, "expect": str} or {"expr": expr, "expect": str}.
    Returns JSON: {"ok": bool (code executed), "error": str,
                   "results": [{"ok": bool, "got": str, "expect": str}]}
    """
    tests = json.loads(tests_json)
    old_stdout, old_stderr = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = io.StringIO(), io.StringIO()
    t0 = time.time()
    ns = {"__name__": "__main__"}
    code_ok, code_err = True, ""
    try:
        exec(compile(code, "<skillzify>", "exec"), ns)
    except BaseException:
        code_ok, code_err = False, traceback.format_exc(limit=3)
    results = []
    for t in tests:
        expr = t.get("run") or t.get("expr") or ""
        expect = str(t.get("expect", ""))
        if not code_ok:
            results.append({"ok": False, "got": "error", "expect": expect})
            continue
        try:
            val = eval(expr, ns)  # noqa: S307 - sandboxed exercise runner, same as web
            got = str(val)
            results.append({"ok": got == expect, "got": got, "expect": expect})
        except BaseException as e:
            results.append({"ok": False, "got": type(e).__name__, "expect": expect})
    ms = int((time.time() - t0) * 1000)
    sys.stdout, sys.stderr = old_stdout, old_stderr
    return json.dumps({"ok": code_ok, "error": code_err, "results": results, "ms": ms})
