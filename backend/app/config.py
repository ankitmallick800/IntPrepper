import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
# Vercel functions can write only under /tmp, and that disk is not kept.
DATA_DIR = Path("/tmp/intprepper") if os.getenv("VERCEL") else REPO_ROOT / "data"

load_dotenv(REPO_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    DATABASE_PATH = Path(os.getenv("DATABASE_PATH", DATA_DIR / "intprepper.db"))
    UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", DATA_DIR / "uploads" / "video"))
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
    ELEVENLABS_API_KEY = os.getenv("ELEVEN_LABS_API_KEY", "").strip()
    GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "openai/gpt-oss-20b")
    GROQ_WHISPER_MODEL = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3")
    # Bella. Rachel (21m00Tcm4TlvDq8ikWAM) is a library voice and the free API rejects it.
    ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
    ALLOWED_EXTENSIONS = {"webm", "wav", "mp4", "ogg", "m4a", "mp3"}
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    JSON_SORT_KEYS = False
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,https://localhost:5173,https://127.0.0.1:5173,https://ankitmallick800.github.io",
        ).split(",")
        if origin.strip()
    ]
