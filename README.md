# IntPrepper

Practice interviews one question at a time. IntPrepper generates questions for a topic you choose, times each answer, transcribes spoken replies, and stores the score with feedback.

## Layout

```
backend/          Flask API (interviews and AI)
  app/            application package
    routes/       HTTP endpoints
    services/     question generation, scoring, transcription, storage
  scripts/        small maintenance commands
  tests/          API smoke test
frontend/         React + Vite app
  src/features/   screens grouped by area
  src/api/        one client for every API call
data/             SQLite database and uploads
```

The API lives at `http://127.0.0.1:5000`. The Vite dev server proxies `/api` to it, so the browser talks to one origin.

The published app is at [https://ankitmallick800.github.io/IntPrepper/](https://ankitmallick800.github.io/IntPrepper/). That site calls the API at [https://intprepper.vercel.app](https://intprepper.vercel.app).

## Run it

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cp .env.example .env

# terminal 1
.venv/bin/python backend/run.py

# terminal 2
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. There is no account. Start an interview from the home page.

## AI keys

Set `GROQ_API_KEY` for generated questions, Whisper transcription, and answer scoring. Set `ELEVEN_LABS_API_KEY` only if you want server-side speech. Without Groq, setup still starts a round using built-in practice questions and the results page explains that scoring is off.

## Checks

```bash
.venv/bin/python backend/tests/test_smoke.py
.venv/bin/python backend/scripts/inspect_db.py
cd frontend && npm run build
```
