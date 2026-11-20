"""
Skillzify App 2.0 — Studio 2.0 tools.

outline_json: the file's symbol outline (functions, classes, methods)
from the stdlib AST — the same Outline the website's Code Studio 2.0
shows in its sidebar. Pure stdlib, fail-soft: a syntax error returns
an empty outline plus the error message, never an exception.
"""

import ast
import json


def outline_json(code):
    """Return JSON {symbols: [{kind, name, line}], error}."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return json.dumps({
            "symbols": [],
            "error": "Syntax error on line %d: %s" % (e.lineno or 0, e.msg),
        })
    symbols = []

    def walk(body, prefix=""):
        for node in body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                kind = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
                symbols.append({
                    "kind": kind,
                    "name": prefix + node.name,
                    "line": node.lineno,
                })
                walk(node.body, prefix + node.name + ".")
            elif isinstance(node, ast.ClassDef):
                symbols.append({
                    "kind": "class",
                    "name": prefix + node.name,
                    "line": node.lineno,
                })
                walk(node.body, prefix + node.name + ".")

    walk(tree.body)
    return json.dumps({"symbols": symbols, "error": None})
