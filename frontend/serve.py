#!/usr/bin/env python3
"""
serve.py — Lightweight HTTP server for the FY27 Budget Explorer frontend.

Serves static files from frontend/ and provides a /api/query endpoint
that executes read-only SQL against FY27_budget.sqlite.

Usage:
    python frontend/serve.py
    python frontend/serve.py --port 8080
    python frontend/serve.py --db path/to/other.sqlite
"""

import argparse
import json
import os
import sqlite3
import sys
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DEFAULT_DB = os.path.join(PROJECT_DIR, "FY27_budget.sqlite")

# Disallowed SQL keywords for safety — only SELECT allowed
WRITE_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
    "ATTACH", "DETACH", "REPLACE", "PRAGMA", "VACUUM",
    "REINDEX", "ANALYZE", "GRANT", "REVOKE",
]


def is_read_only(sql):
    """Check that the SQL is a read-only SELECT statement."""
    stripped = sql.strip().upper()
    # Reject multi-statement queries (semicolons followed by more text)
    semi_pos = stripped.find(";")
    if semi_pos != -1 and stripped[semi_pos + 1:].strip():
        return False
    # Must start with SELECT or WITH (for CTEs)
    if not (stripped.startswith("SELECT") or stripped.startswith("WITH")):
        return False
    # Must not contain write keywords
    for kw in WRITE_KEYWORDS:
        if f" {kw} " in f" {stripped} ":
            return False
    return True


class BudgetHandler(SimpleHTTPRequestHandler):
    """Handler that serves static files and a SQL query API."""

    db_path = DEFAULT_DB

    def __init__(self, *args, **kwargs):
        # Serve from the frontend directory
        super().__init__(*args, directory=SCRIPT_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/schema":
            self._handle_schema()
        elif parsed.path == "/api/query":
            params = parse_qs(parsed.query)
            sql = params.get("sql", [""])[0]
            self._handle_query(sql)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/query":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                sql = data.get("sql", "")
            except json.JSONDecodeError:
                sql = body
            self._handle_query(sql)
        else:
            self.send_error(404)

    def _handle_query(self, sql):
        """Execute a read-only SQL query and return results as JSON."""
        if not sql.strip():
            self._json_response({"error": "Empty query"}, 400)
            return

        if not is_read_only(sql):
            self._json_response(
                {"error": "Only SELECT queries are allowed"}, 403
            )
            return

        try:
            start = time.perf_counter()
            conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(sql)

            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            MAX_ROWS = 5000
            rows = [list(row) for row in cursor.fetchmany(MAX_ROWS + 1)]
            truncated = len(rows) > MAX_ROWS
            if truncated:
                rows = rows[:MAX_ROWS]
            elapsed = round((time.perf_counter() - start) * 1000, 1)

            conn.close()

            resp = {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "elapsed_ms": elapsed,
            }
            if truncated:
                resp["warning"] = f"Results truncated to {MAX_ROWS} rows. Add a LIMIT clause for smaller result sets."
            self._json_response(resp)

        except sqlite3.Error as e:
            self._json_response({"error": str(e)}, 400)
        except Exception as e:
            self._json_response({"error": f"Server error: {str(e)}"}, 500)

    def _handle_schema(self):
        """Return database schema information."""
        try:
            conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            cursor = conn.cursor()

            # Get tables
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            tables = {}
            for (tbl,) in cursor.fetchall():
                cursor.execute(f"PRAGMA table_info({tbl})")
                cols = [
                    {"name": r[1], "type": r[2], "notnull": bool(r[3]), "pk": bool(r[5])}
                    for r in cursor.fetchall()
                ]
                cursor.execute(f"SELECT COUNT(*) FROM {tbl}")
                count = cursor.fetchone()[0]
                tables[tbl] = {"columns": cols, "row_count": count}

            # Get views
            cursor.execute(
                "SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name"
            )
            views = {}
            for name, sql in cursor.fetchall():
                cursor.execute(f"SELECT COUNT(*) FROM {name}")
                count = cursor.fetchone()[0]
                views[name] = {"sql": sql, "row_count": count}

            conn.close()

            self._json_response({"tables": tables, "views": views})

        except Exception as e:
            self._json_response({"error": str(e)}, 500)

    def _json_response(self, data, status=200):
        """Send a JSON response."""
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        """Suppress static file logging noise, keep API logs."""
        try:
            if args and isinstance(args[0], str):
                path = args[0].split()[1] if ' ' in args[0] else args[0]
                if path.startswith("/api/"):
                    super().log_message(format, *args)
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser(description="FY27 Budget Explorer Server")
    parser.add_argument("--port", type=int, default=8427, help="Port (default: 8427)")
    parser.add_argument("--db", default=DEFAULT_DB, help="SQLite database path")
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"ERROR: Database not found: {args.db}")
        print("Run load_budget.py first to build the database.")
        sys.exit(1)

    BudgetHandler.db_path = args.db

    server = HTTPServer(("127.0.0.1", args.port), BudgetHandler)
    print(f"FY27 Budget Explorer")
    print(f"  Database: {args.db}")
    print(f"  Server:   http://127.0.0.1:{args.port}")
    print(f"  API:      http://127.0.0.1:{args.port}/api/query?sql=SELECT...")
    print(f"  Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
