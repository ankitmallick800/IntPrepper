"""Print saved interview sessions."""

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATABASE = ROOT / "data" / "intprepper.db"


def main():
    if not DATABASE.exists():
        print(f"No database at {DATABASE}")
        return 1

    with sqlite3.connect(DATABASE) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT id, interview_name, ROUND(score, 2) AS score, total_questions, created_at
            FROM interviews
            ORDER BY id DESC
            """
        ).fetchall()
        print(f"Interviews ({len(rows)})")
        for row in rows:
            print(
                f"{row['id']:>4}  {row['created_at']}  {row['interview_name']}  "
                f"score {row['score']}  questions {row['total_questions']}"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
