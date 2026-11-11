import json
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.services.ai import dump_json


def _parse_created_at(value):
    if not value:
        return None
    raw = str(value).replace("T", " ").replace("Z", "")
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw[:26], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def serialize_interview(row):
    item = dict(row)
    questions_raw = item.pop("questions_json", None)
    config_raw = item.pop("config_json", None)

    try:
        item["questions"] = json.loads(questions_raw) if questions_raw else []
    except (TypeError, json.JSONDecodeError):
        item["questions"] = []

    try:
        item["config"] = json.loads(config_raw) if config_raw else None
    except (TypeError, json.JSONDecodeError):
        item["config"] = None

    return item


def list_interviews():
    rows = get_db().execute(
        "SELECT * FROM interviews ORDER BY created_at DESC, id DESC"
    ).fetchall()
    return [serialize_interview(row) for row in rows]


def save_interview(interview_name, score, total_questions, questions, config):
    db = get_db()
    questions_json = dump_json(questions)
    config_json = dump_json(config)
    numeric_score = float(score or 0)

    recent = db.execute(
        """
        SELECT id, questions_json, created_at
        FROM interviews
        WHERE interview_name = ? AND ABS(COALESCE(score, 0) - ?) < 0.001
        ORDER BY id DESC
        LIMIT 1
        """,
        (interview_name, numeric_score),
    ).fetchone()

    if recent and recent["questions_json"] == questions_json:
        created = _parse_created_at(recent["created_at"])
        if created and datetime.now(timezone.utc) - created < timedelta(seconds=20):
            return recent["id"]

    cursor = db.execute(
        """
        INSERT INTO interviews
            (interview_name, score, total_questions, questions_json, config_json)
        VALUES (?, ?, ?, ?, ?)
        """,
        (interview_name, numeric_score, total_questions, questions_json, config_json),
    )
    db.commit()
    return cursor.lastrowid


def delete_interview(interview_id):
    db = get_db()
    row = db.execute("SELECT id FROM interviews WHERE id = ?", (interview_id,)).fetchone()
    if row is None:
        return False
    db.execute("DELETE FROM interviews WHERE id = ?", (interview_id,))
    db.commit()
    return True


def clear_interviews():
    db = get_db()
    db.execute("DELETE FROM interviews")
    db.commit()
