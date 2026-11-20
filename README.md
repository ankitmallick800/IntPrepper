<img width="1834" height="926" alt="image" src="https://github.com/user-attachments/assets/959b2f99-7ba8-4180-863f-c4df62dd5bb6" />
<img width="1835" height="976" alt="image" src="https://github.com/user-attachments/assets/4765725a-36a5-44c9-8ef7-2e7953224a65" />
<img width="1832" height="973" alt="image" src="https://github.com/user-attachments/assets/2c251bcd-1d4e-44d4-8aae-06cfb1ef94e9" />
<img width="1906" height="817" alt="image" src="https://github.com/user-attachments/assets/f1f75065-fb9c-4502-8cb4-f03468ae28a0" />



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

The live app is [https://intprepper.vercel.app](https://intprepper.vercel.app). That address serves the site and the API together.

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
