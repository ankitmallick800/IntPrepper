"""Smoke test for the open interview flow.

Run from the backend directory:
    python tests/test_smoke.py
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class ApiSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        root = Path(cls._tmp.name)
        os.environ["DATABASE_PATH"] = str(root / "test.db")
        os.environ["UPLOAD_FOLDER"] = str(root / "uploads")
        os.environ["SECRET_KEY"] = "test-secret"
        os.environ["GROQ_API_KEY"] = ""
        os.environ["ELEVEN_LABS_API_KEY"] = ""

        from importlib import reload

        import app.config as config_module

        reload(config_module)
        from app import create_app

        cls.app = create_app(config_module.Config)
        cls.app.config["TESTING"] = True
        cls.client = cls.app.test_client()

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def test_open_interview_flow(self):
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.get_json()["app"], "IntPrepper")
        self.assertFalse(health.get_json()["ai_configured"])

        self.assertEqual(self.client.post("/api/login", json={"email": "a@b.c", "password": "x"}).status_code, 404)
        self.assertEqual(self.client.post("/api/signup", json={"name": "A", "email": "a@b.c", "password": "secret1"}).status_code, 404)

        questions = self.client.post(
            "/api/generate-questions",
            json={
                "interviewName": "Python Developer",
                "objectives": "lists, dicts",
                "numQs": 3,
                "difficulty": "Moderate",
            },
        )
        self.assertEqual(questions.status_code, 200)
        payload = questions.get_json()
        self.assertEqual(payload["source"], "fallback")
        self.assertEqual(len(payload["questions"]), 3)

        evaluation = self.client.post(
            "/api/evaluate-answer",
            json={"question": "What is a list?", "answer": "An ordered collection.", "difficulty": "Easy"},
        )
        self.assertEqual(evaluation.status_code, 200)
        self.assertEqual(evaluation.get_json()["evaluation"]["source"], "unconfigured")

        body = {
            "interviewName": "Python Developer",
            "score": 7.5,
            "totalQuestions": 1,
            "questions": [{"question": "What is a list?"}],
            "config": {"difficulty": "Easy", "mode": "text"},
        }
        saved = self.client.post("/api/save-interview", json=body)
        again = self.client.post("/api/save-interview", json=body)
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.get_json()["id"], again.get_json()["id"])

        history = self.client.get("/api/interview-history")
        interviews = history.get_json()["interviews"]
        self.assertEqual(len(interviews), 1)
        self.assertEqual(interviews[0]["questions"][0]["question"], "What is a list?")

        removed = self.client.delete(f"/api/interviews/{interviews[0]['id']}")
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(self.client.get("/api/interview-history").get_json()["interviews"], [])


if __name__ == "__main__":
    unittest.main()
