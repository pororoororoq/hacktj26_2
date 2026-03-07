"""
SQLite database setup and connection management.
Thread-local connections for safety in a multi-threaded WSGI/ASGI context.
"""

import os
import sqlite3
import threading

_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "voicerecover.db")
_local = threading.local()


def get_db() -> sqlite3.Connection:
    """Return a thread-local SQLite connection (creates if needed)."""
    if not hasattr(_local, "conn") or _local.conn is None:
        os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
        _local.conn = sqlite3.connect(_DB_PATH)
        _local.conn.row_factory = sqlite3.Row
    return _local.conn


def init_db():
    """Create tables if they don't already exist."""
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            username       TEXT    UNIQUE NOT NULL,
            password_hash  TEXT    NOT NULL,
            name           TEXT    DEFAULT '',
            created_at     REAL    DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS user_progress (
            user_id       INTEGER PRIMARY KEY,
            progress_json TEXT    NOT NULL DEFAULT '{}',
            updated_at    REAL    DEFAULT (unixepoch()),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    conn.commit()
    conn.close()
