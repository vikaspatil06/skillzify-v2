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


def run_multi(files_json, main_file, stdin_text):
    """Multi-file workspace run (website Code Studio parity).

    files_json: JSON object {filename: code}. Every file is written to a
    temp dir that is prepended to sys.path, so `import helper` works exactly
    like the website's "all files written to Pyodide FS before run". Then the
    main file executes with __name__ == "__main__".
    """
    import os
    import tempfile
    files = json.loads(files_json)
    old_stdin, old_stdout, old_stderr = sys.stdin, sys.stdout, sys.stderr
    old_path = list(sys.path)
    sys.stdin = io.StringIO(stdin_text)
    out_buf, err_buf = io.StringIO(), io.StringIO()
    sys.stdout, sys.stderr = out_buf, err_buf
    t0 = time.time()
    ok = True
    err_text = ""
    try:
        tmp = tempfile.mkdtemp(prefix="skillzify_ws_")
        for name, code in files.items():
            # guard against path traversal in filenames
            safe = os.path.basename(str(name))
            if not safe:
                continue
            with open(os.path.join(tmp, safe), "w", encoding="utf-8") as f:
                f.write(code)
        sys.path.insert(0, tmp)
        main_code = files.get(main_file, "")
        ns = {"__name__": "__main__", "__file__": os.path.join(tmp, main_file)}
        exec(compile(main_code, main_file, "exec"), ns)
    except BaseException:
        ok = False
        err_text = traceback.format_exc()
    finally:
        ms = int((time.time() - t0) * 1000)
        sys.stdin, sys.stdout, sys.stderr = old_stdin, old_stdout, old_stderr
        sys.path = old_path
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
        expect_error = t.get("expectError")
        expect = str(expect_error if expect_error is not None else t.get("expect", ""))
        if not code_ok:
            results.append({"ok": False, "got": "error", "expect": expect})
            continue
        try:
            val = eval(expr, ns)  # noqa: S307 - sandboxed exercise runner, same as web
            got = str(val)
            if expect_error is not None:
                # expectError: passes only when the expression raises; a clean
                # return is a failure (mirrors the web runner)
                results.append({"ok": False, "got": got, "expect": expect})
            else:
                results.append({"ok": got == expect, "got": got, "expect": expect})
        except BaseException as e:
            # web format: 'ERROR:' + type name + ': ' + message (no space after ERROR:)
            err_str = "ERROR:" + type(e).__name__ + ": " + str(e)
            if expect_error is not None:
                results.append({"ok": err_str.strip() == str(expect_error).strip(),
                                "got": err_str, "expect": expect})
            else:
                results.append({"ok": False, "got": type(e).__name__, "expect": expect})
    ms = int((time.time() - t0) * 1000)
    sys.stdout, sys.stderr = old_stdout, old_stderr
    return json.dumps({"ok": code_ok, "error": code_err, "results": results, "ms": ms})


class _Cancelled(Exception):
    """Raised when the user taps Stop while code waits for terminal input."""
    pass


class _BridgeOut:
    """sys.stdout/stderr that streams each write to the Kotlin terminal UI."""

    def __init__(self, bridge):
        self.bridge = bridge

    def write(self, s):
        if s:
            self.bridge.onOutput(s)
        return len(s)

    def flush(self):
        pass


class _BridgeIn:
    """sys.stdin whose readline() blocks until the user submits a terminal line.

    The Kotlin bridge shows an inline input row while blocked; Stop cancels
    the wait by returning None, which surfaces as _Cancelled.
    """

    def __init__(self, bridge):
        self.bridge = bridge

    def readline(self, prompt=""):
        line = self.bridge.readLine(prompt if prompt else "")
        if line is None:
            raise _Cancelled()
        return line + "\n"

    def read(self, *args):
        raise _Cancelled()


def run_multi_interactive(files_json, main_file, bridge):
    """Multi-file workspace run with a live interactive terminal (website
    Code Studio parity: input() prompts inline, output streams as it runs).

    bridge: Kotlin TerminalBridge with onOutput(str) / readLine(prompt)->str|None.
    Returns JSON {ok, output: "" (already streamed), error, ms}.
    """
    import os
    import tempfile
    files = json.loads(files_json)
    old_stdin, old_stdout, old_stderr = sys.stdin, sys.stdout, sys.stderr
    old_path = list(sys.path)
    out = _BridgeOut(bridge)
    sys.stdin, sys.stdout, sys.stderr = _BridgeIn(bridge), out, out
    t0 = time.time()
    ok = True
    err_text = ""
    try:
        tmp = tempfile.mkdtemp(prefix="skillzify_ws_")
        for name, code in files.items():
            safe = os.path.basename(str(name))
            if not safe:
                continue
            with open(os.path.join(tmp, safe), "w", encoding="utf-8") as f:
                f.write(code)
        sys.path.insert(0, tmp)
        main_code = files.get(main_file, "")
        ns = {"__name__": "__main__", "__file__": os.path.join(tmp, main_file)}
        exec(compile(main_code, main_file, "exec"), ns)
    except _Cancelled:
        ok = False
        err_text = "⏹ Stopped."
    except BaseException:
        ok = False
        err_text = traceback.format_exc()
    finally:
        ms = int((time.time() - t0) * 1000)
        sys.stdin, sys.stdout, sys.stderr = old_stdin, old_stdout, old_stderr
        sys.path = old_path
    return json.dumps({"ok": ok, "output": "", "error": err_text, "ms": ms})
