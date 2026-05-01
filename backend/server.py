"""
Smart Notes IA - Backend
FastAPI server with AI-powered note classification, urgency detection, OCR, and reminders.
"""
import os
import json
import logging
import uuid
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ----- Config -----
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Smart Notes IA")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ----- Constants -----
CATEGORIES = [
    "Devis", "Finances", "Juridique", "Famille", "Véhicules", "Travaux",
    "Clients", "Fournisseurs", "Banque", "Administratif", "Santé",
    "Personnel", "Urgent"
]

URGENT_KEYWORDS = [
    "amende", "avocat", "tribunal", "urgent", "demain", "échéance",
    "impôts", "retard", "paiement immédiat", "immédiat", "asap"
]

# ----- Models -----
class NoteBase(BaseModel):
    content: str = ""
    image_base64: Optional[str] = None  # data URL or raw base64 (with mime)
    image_mime: Optional[str] = None    # e.g. image/jpeg


class NoteCreate(NoteBase):
    pass


class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str = ""
    ocr_text: Optional[str] = None
    image_base64: Optional[str] = None
    image_mime: Optional[str] = None
    title: str = ""
    summary: str = ""
    categories: List[str] = Field(default_factory=list)
    urgent: bool = False
    status: str = "todo"  # todo | in_progress | done
    reminder_date: Optional[str] = None  # ISO string
    amount: Optional[float] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class NoteUpdate(BaseModel):
    status: Optional[str] = None
    urgent: Optional[bool] = None
    content: Optional[str] = None
    reminder_date: Optional[str] = None
    categories: Optional[List[str]] = None


# ----- AI Service -----
def _strip_data_url(b64: str) -> tuple[str, str]:
    """Return (clean_base64, mime). Accepts raw or data URL."""
    if b64.startswith("data:"):
        m = re.match(r"data:([^;]+);base64,(.+)", b64)
        if m:
            return m.group(2), m.group(1)
    return b64, "image/jpeg"


async def run_ocr(image_base64: str, mime: str = "image/jpeg") -> str:
    """Use GPT-5.2 vision to extract text from an image (invoice/receipt/quote)."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

    clean_b64, detected_mime = _strip_data_url(image_base64)
    if mime in (None, "", "image/jpeg") and detected_mime:
        mime = detected_mime

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ocr-{uuid.uuid4()}",
        system_message=(
            "Tu es un OCR expert. Extrais TOUT le texte visible dans l'image "
            "(devis, facture, ticket, document) en conservant la structure. "
            "Retourne uniquement le texte extrait, sans commentaire."
        ),
    ).with_model("openai", "gpt-5.2")

    image_content = ImageContent(image_base64=clean_b64)
    msg = UserMessage(
        text="Extrais tout le texte de cette image.",
        file_contents=[image_content],
    )
    try:
        response = await chat.send_message(msg)
        return str(response).strip()
    except Exception as e:
        logger.exception("OCR failed")
        return ""


def _heuristic_urgent(text: str) -> bool:
    low = text.lower()
    return any(kw in low for kw in URGENT_KEYWORDS)


async def classify_note(text: str) -> dict:
    """Use GPT-5.2 to classify note: categories, urgency, title, summary, reminder date, amount."""
    if not EMERGENT_LLM_KEY or not text.strip():
        return {
            "title": (text[:60] or "Note").strip(),
            "summary": text[:200],
            "categories": ["Personnel"],
            "urgent": _heuristic_urgent(text),
            "reminder_date": None,
            "amount": None,
        }

    today = datetime.now(timezone.utc).date().isoformat()
    system = (
        "Tu es une IA qui organise des notes en français. "
        f"Aujourd'hui = {today}. "
        f"Catégories possibles: {', '.join(CATEGORIES)}. "
        "Réponds UNIQUEMENT avec un JSON strict (pas de markdown) avec ces clés: "
        "title (string court 3-8 mots), "
        "summary (string 1 phrase), "
        "categories (array de 1 à 3 catégories de la liste), "
        "urgent (bool, true si mots: amende, avocat, tribunal, urgent, demain, échéance, impôts, retard, paiement immédiat, OU si délai très court), "
        "reminder_date (string ISO YYYY-MM-DD ou null si aucune date détectée. "
        "Détecte: 'demain', 'lundi prochain', 'dans 3 jours', 'vendredi', 'avant jeudi', dates explicites), "
        "amount (number en euros ou null)."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"classify-{uuid.uuid4()}",
        system_message=system,
    ).with_model("openai", "gpt-5.2")

    try:
        response = await chat.send_message(UserMessage(text=text))
        raw = str(response).strip()
        # Strip code fences if present
        raw = re.sub(r"^```(?:json)?", "", raw).strip()
        raw = re.sub(r"```$", "", raw).strip()
        data = json.loads(raw)

        # Validate categories
        cats = [c for c in data.get("categories", []) if c in CATEGORIES]
        if not cats:
            cats = ["Personnel"]

        urgent_flag = bool(data.get("urgent", False)) or _heuristic_urgent(text)

        return {
            "title": str(data.get("title") or text[:60] or "Note").strip(),
            "summary": str(data.get("summary") or text[:200]).strip(),
            "categories": cats,
            "urgent": urgent_flag,
            "reminder_date": data.get("reminder_date"),
            "amount": data.get("amount"),
        }
    except Exception as e:
        logger.exception("Classification failed: %s", e)
        return {
            "title": (text[:60] or "Note").strip(),
            "summary": text[:200],
            "categories": ["Personnel"],
            "urgent": _heuristic_urgent(text),
            "reminder_date": None,
            "amount": None,
        }


# ----- Routes -----
@api_router.get("/")
async def root():
    return {"message": "Smart Notes IA API", "version": "1.0"}


@api_router.post("/notes", response_model=Note)
async def create_note(payload: NoteCreate):
    ocr_text = None
    full_text = payload.content or ""

    # If image provided, run OCR first
    if payload.image_base64:
        mime = payload.image_mime or "image/jpeg"
        ocr_text = await run_ocr(payload.image_base64, mime)
        if ocr_text:
            full_text = (full_text + "\n\n" + ocr_text).strip() if full_text else ocr_text

    if not full_text.strip():
        raise HTTPException(400, "Empty note: provide content or image")

    ai = await classify_note(full_text)

    note = Note(
        content=payload.content or "",
        ocr_text=ocr_text,
        image_base64=payload.image_base64,
        image_mime=payload.image_mime,
        title=ai["title"],
        summary=ai["summary"],
        categories=ai["categories"],
        urgent=ai["urgent"],
        reminder_date=ai["reminder_date"],
        amount=ai["amount"],
    )
    await db.notes.insert_one(note.model_dump())
    return note


@api_router.get("/notes", response_model=List[Note])
async def list_notes(
    category: Optional[str] = None,
    status: Optional[str] = None,
    urgent: Optional[bool] = None,
    q: Optional[str] = None,
    limit: int = 200,
):
    query: dict = {}
    if category:
        query["categories"] = category
    if status:
        query["status"] = status
    if urgent is not None:
        query["urgent"] = urgent
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"summary": {"$regex": q, "$options": "i"}},
            {"content": {"$regex": q, "$options": "i"}},
            {"ocr_text": {"$regex": q, "$options": "i"}},
        ]

    cursor = db.notes.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(limit)
    return [Note(**d) for d in docs]


@api_router.get("/notes/{note_id}", response_model=Note)
async def get_note(note_id: str):
    doc = await db.notes.find_one({"id": note_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Note not found")
    return Note(**doc)


@api_router.patch("/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, payload: NoteUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    if "status" in updates and updates["status"] not in ("todo", "in_progress", "done"):
        raise HTTPException(400, "Invalid status")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.notes.update_one({"id": note_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Note not found")
    doc = await db.notes.find_one({"id": note_id}, {"_id": 0})
    return Note(**doc)


@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str):
    result = await db.notes.delete_one({"id": note_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Note not found")
    return {"ok": True}


@api_router.get("/dashboard")
async def dashboard():
    today = datetime.now(timezone.utc).date()
    today_iso = today.isoformat()
    seven_days = (today + timedelta(days=7)).isoformat()

    # Urgent open notes
    urgent_today = await db.notes.find(
        {"urgent": True, "status": {"$ne": "done"}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    # Upcoming reminders (next 7 days)
    upcoming = await db.notes.find(
        {
            "reminder_date": {"$gte": today_iso, "$lte": seven_days},
            "status": {"$ne": "done"},
        },
        {"_id": 0},
    ).sort("reminder_date", 1).to_list(50)

    # Overdue tasks
    overdue = await db.notes.find(
        {
            "reminder_date": {"$lt": today_iso, "$ne": None},
            "status": {"$ne": "done"},
        },
        {"_id": 0},
    ).sort("reminder_date", 1).to_list(50)

    # Stats per category
    pipeline = [
        {"$match": {"status": {"$ne": "done"}}},
        {"$unwind": "$categories"},
        {"$group": {"_id": "$categories", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    cat_stats = await db.notes.aggregate(pipeline).to_list(50)
    by_category = [{"category": c["_id"], "count": c["count"]} for c in cat_stats]

    todo_count = await db.notes.count_documents({"status": "todo"})
    in_progress_count = await db.notes.count_documents({"status": "in_progress"})
    done_count = await db.notes.count_documents({"status": "done"})
    total = await db.notes.count_documents({})

    return {
        "urgent_today": [Note(**n).model_dump() for n in urgent_today],
        "upcoming_reminders": [Note(**n).model_dump() for n in upcoming],
        "overdue": [Note(**n).model_dump() for n in overdue],
        "by_category": by_category,
        "stats": {
            "total": total,
            "todo": todo_count,
            "in_progress": in_progress_count,
            "done": done_count,
        },
    }


@api_router.get("/categories")
async def list_categories():
    return {"categories": CATEGORIES}


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
