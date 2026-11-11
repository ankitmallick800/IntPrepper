import json


def extract_json(text, expect="array"):
    if not text or not str(text).strip():
        raise json.JSONDecodeError("empty", "", 0)

    raw = str(text).strip()
    opener, closer = ("[", "]") if expect == "array" else ("{", "}")
    start = raw.find(opener)
    end = raw.rfind(closer) + 1
    if start != -1 and end > start:
        return json.loads(raw[start:end])
    return json.loads(raw)
