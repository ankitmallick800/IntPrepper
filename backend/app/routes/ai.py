from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from werkzeug.utils import secure_filename

from app.services.ai import evaluate_answer, generate_questions, transcribe_audio
from app.services.tts import synthesize_speech

bp = Blueprint("ai", __name__)


def _body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@bp.post("/generate-questions")
def generate_questions_route():
    data = _body()
    interview_name = str(data.get("interviewName") or "").strip()
    objectives = str(data.get("objectives") or "").strip()
    difficulty = str(data.get("difficulty") or "Mixed").strip() or "Mixed"

    if not interview_name or not objectives or data.get("numQs") in (None, ""):
        return jsonify({"error": "Topic, key topics, and question count are required."}), 400

    try:
        num_qs = int(data.get("numQs"))
    except (TypeError, ValueError):
        return jsonify({"error": "Question count must be a whole number."}), 400

    if num_qs < 1 or num_qs > 15:
        return jsonify({"error": "Choose between 1 and 15 questions."}), 400

    result = generate_questions(interview_name, objectives, num_qs, difficulty)
    return jsonify(result)


@bp.post("/evaluate-answer")
def evaluate_answer_route():
    data = _body()
    question = str(data.get("question") or "").strip()
    answer = str(data.get("answer") or "").strip()
    difficulty = str(data.get("difficulty") or "mixed")

    if not question or not answer:
        return jsonify({"error": "Question and answer are required."}), 400

    evaluation = evaluate_answer(question, answer, difficulty)
    return jsonify({"evaluation": evaluation})


@bp.post("/upload-audio")
def upload_audio():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file was uploaded."}), 400

    upload = request.files["audio"]
    if not upload.filename:
        return jsonify({"error": "The uploaded file has no name."}), 400

    extension = upload.filename.rsplit(".", 1)[-1].lower() if "." in upload.filename else ""
    if extension not in current_app.config["ALLOWED_EXTENSIONS"]:
        return jsonify({"error": "Upload a webm, wav, mp3, m4a, ogg, or mp4 recording."}), 400

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    filename = secure_filename(f"answer_{stamp}.{extension}")
    destination = current_app.config["UPLOAD_FOLDER"] / filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    upload.save(destination)

    transcript = transcribe_audio(destination, filename)
    return jsonify(
        {
            "message": "Audio uploaded successfully.",
            "file": filename,
            "transcription": transcript,
        }
    )


@bp.post("/generate-audio")
def generate_audio():
    text = str(_body().get("text") or "").strip()
    if not text:
        return jsonify({"error": "No text was provided."}), 400
    if len(text) > 2500:
        return jsonify({"error": "Text is too long to speak in one request."}), 400

    audio, error = synthesize_speech(text)
    if error:
        payload, status = error
        return jsonify(payload), status
    return audio, 200, {"Content-Type": "audio/mpeg"}
