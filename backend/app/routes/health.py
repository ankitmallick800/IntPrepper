from flask import Blueprint, current_app, jsonify

from app.services.ai import ai_configured

bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "app": "IntPrepper",
            "ai_configured": ai_configured(),
            "tts_configured": bool(current_app.config.get("ELEVENLABS_API_KEY")),
        }
    )
