import sqlite3

from flask import current_app, g


def get_db():
    if "db" not in g:
        conn = sqlite3.connect(current_app.config["DATABASE_PATH"])
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


def close_db(_error=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db():
    database_path = current_app.config["DATABASE_PATH"]
    database_path.parent.mkdir(parents=True, exist_ok=True)
    current_app.config["UPLOAD_FOLDER"].mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    existing = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'interviews'"
    ).fetchone()
    if existing:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(interviews)")}
        if "user_id" in columns:
            conn.execute("DROP TABLE interviews")
    conn.execute("DROP TABLE IF EXISTS users")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS interviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            interview_name TEXT,
            score REAL,
            total_questions INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            questions_json TEXT,
            config_json TEXT
        )
        """
    )

    conn.commit()
    conn.close()


def init_app(app):
    app.teardown_appcontext(close_db)
    with app.app_context():
        init_db()
