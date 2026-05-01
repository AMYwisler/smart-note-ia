# Smart Notes IA — PRD

## Vision
Bloc-notes intelligent assisté par IA. L'utilisateur écrit en vrac (texte ou photo de devis/facture) et l'IA classe, détecte les urgences et planifie les rappels automatiquement.

## Stack
- **Frontend**: Expo (React Native) — Android + Web. Expo Router (file-based).
- **Backend**: FastAPI (Python). All routes prefixed with `/api`.
- **Database**: MongoDB (collection `notes` in `smart_notes_ia`).
- **AI**: GPT-5.2 via `emergentintegrations` library + `EMERGENT_LLM_KEY` (text classification + vision OCR in one call).

## Core features (MVP)
1. **Quick capture** — bottom sheet with multiline text input, camera, gallery; "Laisser l'IA organiser" button.
2. **AI auto-classification** — categories: Devis, Finances, Juridique, Famille, Véhicules, Travaux, Clients, Fournisseurs, Banque, Administratif, Santé, Personnel, Urgent (multi-tag).
3. **Urgency detection** — keyword + LLM heuristic, red URGENT badge, urgent_today section.
4. **OCR via GPT-5.2 vision** — extracts text from invoice/quote/receipt photos (base64, JPEG/PNG).
5. **Smart reminders** — "demain", "vendredi", "dans 3 jours", explicit dates → ISO date stored, surfaced in dashboard.
6. **Task status** — todo / in_progress / done segmented control.
7. **Dashboard** — stats (todo/in_progress/done), urgences, en retard, rappels à venir.
8. **Notes list** — filters: status, category, urgent-only.
9. **Search** — full-text on title/summary/content/ocr_text.
10. **Note detail** — categories, status, urgent toggle, reminder, amount, image, OCR text, delete.

## Backend endpoints (`/api`)
- `GET /` — health
- `GET /categories` — list of 13 categories
- `POST /notes` — create (text and/or image_base64); triggers OCR + classification
- `GET /notes?category=&status=&urgent=&q=` — list/filter
- `GET /notes/{id}` — single note
- `PATCH /notes/{id}` — update status/urgent/reminder/categories/content
- `DELETE /notes/{id}` — delete
- `GET /dashboard` — aggregated view (urgent_today, upcoming_reminders, overdue, by_category, stats)

## Frontend routes
- `/(tabs)` — Dashboard / Notes / Search
- `/note/[id]` — Note detail

## Future work
- Local push notifications (expo-notifications) on dev build
- Voice-to-text capture
- Export PDF / CSV per category
- Multi-user with auth
