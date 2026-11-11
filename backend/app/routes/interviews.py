from flask import Blueprint, jsonify, request

from app.services.interviews import clear_interviews, delete_interview, list_interviews, save_interview

bp = Blueprint("interviews", __name__)


def _body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@bp.post("/save-interview")
def save_interview_route():
    data = _body()
    interview_name = str(data.get("interviewName") or "Interview").strip() or "Interview"
    questions = data.get("questions") if isinstance(data.get("questions"), list) else []
    config = data.get("config") if isinstance(data.get("config"), dict) else None

    try:
        score = float(data.get("score") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Score must be a number."}), 400

    total_questions = data.get("totalQuestions")
    try:
        total_questions = int(total_questions if total_questions is not None else len(questions))
    except (TypeError, ValueError):
        total_questions = len(questions)

    interview_id = save_interview(
        interview_name,
        score,
        total_questions,
        questions,
        config,
    )
    return jsonify({"message": "Interview result saved.", "id": interview_id})


@bp.get("/interview-history")
def interview_history():
    return jsonify({"interviews": list_interviews()})


@bp.delete("/interviews/<int:interview_id>")
def delete_interview_route(interview_id):
    if not delete_interview(interview_id):
        return jsonify({"error": "Interview not found."}), 404
    return jsonify({"message": "Interview deleted successfully."})


@bp.post("/interviews/clear")
def clear_interviews_route():
    clear_interviews()
    return jsonify({"message": "All interviews cleared successfully."})
