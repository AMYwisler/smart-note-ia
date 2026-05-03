"# Smart Notes IA

A FastAPI + React Native (Expo) application that uses Google Gemini (free tier) to:
- OCR images (invoices, quotes, receipts)
- Classify and organise notes (categories, urgency, reminders, amounts)

## Architecture
- **Backend**: FastAPI + MongoDB + Google Gemini (`google-genai` SDK)
- **Frontend**: Expo / React Native (web)

## Deploy backend on Render

1. Push this repo to GitHub.
2. On Render → **New +** → **Blueprint** and select this repo.
   Render will detect `render.yaml` and create the service.
3. In the service settings, set the following environment variables:
   - `MONGO_URL` — your MongoDB Atlas connection string
   - `DB_NAME` — e.g. `smart_notes_ia`
   - `GEMINI_API_KEY` — get one (free) at https://aistudio.google.com/apikey
   - `GEMINI_MODEL` *(optional)* — default `gemini-2.0-flash`
4. Deploy. The public URL will look like:
   `https://smart-notes-ia-backend.onrender.com`

### MongoDB Atlas — required allow-list
In Atlas → **Network Access**, add `0.0.0.0/0` (allow from anywhere) so Render can connect.

## Configure the frontend

In `frontend/.env`, replace the `EXPO_PUBLIC_BACKEND_URL` with your Render URL:

```
EXPO_PUBLIC_BACKEND_URL=https://smart-notes-ia-backend.onrender.com
```

Then rebuild / redeploy the Expo app.

## Local development

Backend:
```bash
cd backend
cp .env.example .env   # then fill in values
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

Frontend:
```bash
cd frontend
yarn install
yarn start
```
"
