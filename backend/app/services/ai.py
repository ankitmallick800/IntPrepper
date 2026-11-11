import json
import shutil
import subprocess
from pathlib import Path

from flask import current_app

from app.services.json_parse import extract_json

_QUESTION_STEMS = (
    "Explain {topic} the way you would in a {role} interview.",
    "What mistakes do people commonly make with {topic}?",
    "Walk through a practical example of {topic}.",
    "How does {topic} compare with a closely related idea?",
    "How would you debug a problem that involves {topic}?",
    "What tradeoffs would you mention when discussing {topic}?",
    "How would you explain {topic} to a teammate who is new to {role}?",
    "Which follow-up question would you expect about {topic}, and how would you answer it?",
    "Describe a decision that depends on understanding {topic}.",
    "What would you measure to know your approach to {topic} is working?",
)


def ai_configured():
    return bool(current_app.config.get("GROQ_API_KEY"))


def _client():
    api_key = current_app.config.get("GROQ_API_KEY")
    if not api_key:
        return None
    from groq import Groq

    return Groq(api_key=api_key)


def _topics(objectives, interview_name):
    chunks = []
    for part in str(objectives or "").replace("\n", ",").split(","):
        cleaned = part.strip()
        if cleaned:
            chunks.append(cleaned)
    return chunks or [interview_name or "this topic"]


def fallback_questions(interview_name, objectives, num_qs, difficulty):
    topics = _topics(objectives, interview_name)
    role = interview_name or "this role"
    level = {
        "Easy": "At a foundational level, ",
        "Moderate": "With a concrete example, ",
        "Tough": "In depth, ",
        "Mixed": "",
    }.get(difficulty, "")

    questions = []
    index = 0
    while len(questions) < num_qs:
        topic = topics[index % len(topics)]
        stem = _QUESTION_STEMS[index % len(_QUESTION_STEMS)].format(topic=topic, role=role)
        if level:
            stem = stem[0].lower() + stem[1:]
        questions.append(f"{level}{stem}")
        index += 1
    return questions


def generate_questions(interview_name, objectives, num_qs, difficulty):
    client = _client()
    if client is None:
        return {
            "questions": fallback_questions(interview_name, objectives, num_qs, difficulty),
            "source": "fallback",
            "notice": "Add a Groq API key for questions written for this topic.",
        }

    prompt = (
        f"Create {num_qs} unique interview questions for {interview_name} "
        f"based on these topics: {objectives}. "
        f"The difficulty level of the questions should be: {difficulty}. "
        "Make the questions clear, varied, and suitable for interview practice. "
        'Strictly return a valid JSON array of strings (e.g. ["question 1", "question 2"]). '
        "Do not include any markdown formatting, code blocks, or extra text."
    )

    try:
        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=current_app.config["GROQ_CHAT_MODEL"],
        )
        text = completion.choices[0].message.content or ""
        parsed = extract_json(text, expect="array")
        questions = [str(item).strip() for item in parsed if str(item).strip()]
        if not questions:
            raise ValueError("Model returned no questions")
        return {"questions": questions[:num_qs], "source": "groq"}
    except Exception as exc:
        current_app.logger.exception("Question generation failed: %s", exc)
        return {
            "questions": fallback_questions(interview_name, objectives, num_qs, difficulty),
            "source": "fallback",
            "notice": "Groq could not write questions just now, so these are built-in practice questions.",
        }


def _adjust_score(score, difficulty):
    value = float(score)
    if str(difficulty or "").lower() == "easy":
        value = min(10.0, value + 2.0)
    return round(max(0.0, min(10.0, value)), 1)


def unavailable_evaluation():
    return {
        "score": 0,
        "feedback": "AI scoring is off until GROQ_API_KEY is set. Your answer was still saved.",
        "strengths": [],
        "improvements": ["Add a Groq API key in the project .env file to turn on real feedback."],
        "source": "unconfigured",
    }


def evaluate_answer(question, answer, difficulty):
    client = _client()
    if client is None:
        return unavailable_evaluation()

    prompt = (
        "You are an expert interview evaluator. Evaluate this interview answer.\n"
        "The candidate may include a language, a code snippet, and an example along with "
        "what they said or wrote. Grade the snippet as the solution when the question "
        "asks for code, and use the example to judge whether they can apply it.\n\n"
        f"Question: {question}\n"
        f"Candidate's Answer: {answer}\n\n"
        "Provide your evaluation as a valid JSON object with these fields:\n"
        '- "score": a number from 0 to 10\n'
        '- "feedback": a brief 1-2 sentence feedback on the answer quality\n'
        '- "strengths": an array of 1-2 key strengths (empty array if none)\n'
        '- "improvements": an array of 1-2 areas for improvement (empty array if none)\n\n'
        "Return ONLY the JSON object. No markdown, no code blocks, no extra text."
    )

    try:
        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=current_app.config["GROQ_CHAT_MODEL"],
        )
        text = completion.choices[0].message.content or ""
        evaluation = extract_json(text, expect="object")
        if not isinstance(evaluation, dict):
            raise ValueError("Evaluation was not an object")
        evaluation["score"] = _adjust_score(evaluation.get("score", 5), difficulty)
        evaluation["feedback"] = str(evaluation.get("feedback") or "No feedback returned.")
        evaluation["strengths"] = list(evaluation.get("strengths") or [])
        evaluation["improvements"] = list(evaluation.get("improvements") or [])
        evaluation["source"] = "groq"
        return evaluation
    except Exception as exc:
        current_app.logger.exception("Answer evaluation failed: %s", exc)
        return {
            "score": 0,
            "feedback": "The evaluator could not score this answer. Try again in a moment.",
            "strengths": [],
            "improvements": [],
            "source": "error",
        }


def _max_volume_db(media_path):
    """Return the loudest sample in dB, or None when ffmpeg cannot measure it."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-i", str(media_path), "-af", "volumedetect", "-f", "null", "-"],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None

    for line in (result.stderr or "").splitlines():
        if "max_volume:" not in line:
            continue
        raw = line.split("max_volume:", 1)[1].split("dB", 1)[0].strip()
        try:
            return float(raw)
        except ValueError:
            return None
    return None


def _speech_wav(file_path):
    """Turn a browser recording into a 16 kHz mono wav Whisper can time correctly.

    MediaRecorder webm files often have no duration, and a video track makes
    Groq read silence or only a fragment. ffmpeg drops the video and writes a
    normal wav beside the upload.
    """
    source = Path(file_path)
    wav_path = source.with_name(f"{source.stem}_speech.wav")
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(source),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                str(wav_path),
            ],
            capture_output=True,
            timeout=90,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"Could not prepare the recording: {exc}") from exc

    if result.returncode != 0 or not wav_path.exists() or wav_path.stat().st_size < 44:
        current_app.logger.error(
            "ffmpeg could not prepare %s: %s",
            source.name,
            (result.stderr or b"").decode("utf-8", errors="replace")[-400:],
        )
        raise RuntimeError("Could not prepare the recording.")
    return wav_path


def transcribe_audio(file_path, filename):
    client = _client()
    if client is None:
        return "Could not transcribe audio: GROQ_API_KEY is not configured."

    wav_path = None
    try:
        if shutil.which("ffmpeg"):
            wav_path = _speech_wav(file_path)
            loudest = _max_volume_db(wav_path)
            # A live mic sits well above this. The broken recordings were -91 dB.
            if loudest is not None and loudest < -60:
                return (
                    "No speech detected. The microphone recording was silent. "
                    "Watch the wave while you answer and try again."
                )
            payload_name = wav_path.name
            mime = "audio/wav"
            payload = wav_path.read_bytes()
        else:
            # The hosted API does not include ffmpeg. The browser already
            # records microphone-only audio, which Whisper can read directly.
            payload_name = filename
            extension = Path(filename).suffix.lower().lstrip(".")
            mime = {
                "wav": "audio/wav",
                "mp3": "audio/mpeg",
                "m4a": "audio/mp4",
                "mp4": "audio/mp4",
                "ogg": "audio/ogg",
                "webm": "audio/webm",
            }.get(extension, "application/octet-stream")
            payload = Path(file_path).read_bytes()
            if len(payload) < 400:
                return "Could not transcribe audio"

        transcription = client.audio.transcriptions.create(
            file=(payload_name, payload, mime),
            model=current_app.config["GROQ_WHISPER_MODEL"],
            response_format="json",
            language="en",
            temperature=0.0,
        )
        return (transcription.text or "").strip() or "No speech detected."
    except Exception as exc:
        current_app.logger.exception("Transcription failed: %s", exc)
        return f"Error generating transcription: {exc}"
    finally:
        if wav_path is not None:
            wav_path.unlink(missing_ok=True)


def dump_json(value):
    if value is None:
        return None
    return json.dumps(value)
