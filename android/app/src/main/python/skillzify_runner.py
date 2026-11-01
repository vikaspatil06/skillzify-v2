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
