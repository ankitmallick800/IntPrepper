import requests
from flask import current_app


def synthesize_speech(text):
    api_key = current_app.config.get("ELEVENLABS_API_KEY")
    if not api_key:
        return None, ({"error": "ElevenLabs API key is not configured."}, 503)

    voice_id = current_app.config["ELEVENLABS_VOICE_ID"]
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key,
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.5},
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=60)
    except requests.RequestException as exc:
        return None, ({"error": f"Could not reach ElevenLabs: {exc}"}, 502)

    if response.status_code != 200:
        return None, ({"error": f"ElevenLabs API error: {response.text}"}, response.status_code)

    return response.content, None
