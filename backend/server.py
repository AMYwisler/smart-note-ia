"""
Smart Notes IA - Backend
FastAPI server with AI-powered note classification, urgency detection, OCR, and reminders.
Uses Google Gemini (free tier) for text generation and vision/OCR.
"""
import os
import json
import logging
import uuid
import re
import base64
import secrets
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
import bcrypt
import jwt

from google import genai
from google.genai import types

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ----- Config -----
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-in-env-64-hex-chars')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRES_DAYS = 30  # long-lived mobile token, stored in expo-secure-store
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
RESEND_FROM = os.environ.get('RESEND_FROM', 'Smart Notes IA <onboarding@resend.dev>')
APP_PUBLIC_URL = os.environ.get('APP_PUBLIC_URL', '')  # used in reset email, e.g. https://smart-notes.example.com
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.0-flash')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Gemini client (only initialised if key is provided)
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

app = FastAPI(title="Smart Notes IA")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ----- Constants -----
CATEGORIES = [
    "Devis", "Travaux", "Personnel", "Administratif", "Urgent", "Divers"
]

URGENT_KEYWORDS = [
    "amende", "avocat", "tribunal", "urgent", "demain", "échéance",
    "impôts", "retard", "paiement immédiat", "immédiat", "asap"
]

# Keyword → category mapping used as a deterministic post-processing safety net
# (so even if Gemini answers "Personnel" for everything, we still tag correctly).
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Urgent": [
        "amende", "tribunal", "avocat", "urgent", "asap", "immédiat",
        "huissier", "saisie", "mise en demeure", "contentieux", "retard",
    ],
    "Devis": [
        "devis", "estimation", "chiffrage", "proposition commerciale",
    ],
    "Administratif": [
        "impôt", "impots", "tva", "nationalité", "nationalite", "douane",
        "préfecture", "prefecture", "carte d'identité", "carte didentite",
        "passeport", "permis", "sécurité sociale", "securite sociale",
        "caf", "pôle emploi", "pole emploi", "déclaration", "declaration",
        "autorisation", "cgpn", "prévoyance", "prevoyance", "arrêt maladie",
        "arret maladie", "formation", "attestation", "contrat administratif",
        "mairie", "ameli", "urssaf",
    ],
    "Travaux": [
        "travaux", "chantier", "peinture", "rampe", "clôture", "cloture",
        "rénovation", "renovation", "carrelage", "plomberie", "électricité",
        "electricite", "toiture", "fenêtre", "fenetre", "porte", "escalier",
        "géomètre", "geometre", "voiture", "moteur", "ford", "nacell",
        "nacelle", "véhicule", "vehicule", "pavillon", "rampe d'escalier",
        "pneu", "carrosserie", "menuiserie", "isolation",
    ],
    "Personnel": [
        "maman", "papa", "frère", "frere", "soeur", "sœur", "fils", "fille",
        "famille", "anniversaire", "cadeau", "rdv", "rendez-vous", "médecin",
        "medecin", "dentiste", "santé", "sante", "courses", "école", "ecole",
        "vacances", "ami", "ami(e)", "épouse", "mari", "divorce", "hébergement",
        "hebergement", "enfant",
    ],
}


def _heuristic_category(text: str) -> str:
    """
    Return the best matching category based on keyword presence, used as a safety
    net when the LLM defaults to 'Personnel' or 'Divers'.
    Order of priority: Urgent > Devis > Administratif > Travaux > Personnel > Divers.
    """
    low = text.lower()
    for cat in ("Urgent", "Devis", "Administratif", "Travaux", "Personnel"):
        for kw in CATEGORY_KEYWORDS.get(cat, []):
            if kw in low:
                return cat
    return "Divers"


# Remap legacy category names (from the previous 13-category palette) onto the new 6.
LEGACY_CATEGORY_MAP: dict[str, str] = {
    "Famille": "Personnel",
    "Santé": "Personnel",
    "Finances": "Administratif",
    "Banque": "Administratif",
    "Clients": "Administratif",
    "Fournisseurs": "Administratif",
    "Juridique": "Urgent",
    "Véhicules": "Travaux",
}


def _remap_categories(cats: list) -> list:
    """Map legacy categories to the new palette and de-duplicate while preserving order."""
    if not isinstance(cats, list):
        return ["Divers"]
    out: list[str] = []
    for c in cats:
        if not isinstance(c, str):
            continue
        new = LEGACY_CATEGORY_MAP.get(c, c)
        if new in CATEGORIES and new not in out:
            out.append(new)
    return out or ["Divers"]

# ----- Models -----
class NoteBase(BaseModel):
    content: str = ""
    image_base64: Optional[str] = None  # data URL or raw base64 (with mime)
    image_mime: Optional[str] = None    # e.g. image/jpeg


class NoteCreate(NoteBase):
    pass


class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None  # owner of the note
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
    comments: str = ""  # User-editable free-form notes / précisions
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class NoteUpdate(BaseModel):
    status: Optional[str] = None
    urgent: Optional[bool] = None
    title: Optional[str] = None
    content: Optional[str] = None
    reminder_date: Optional[str] = None
    categories: Optional[List[str]] = None
    comments: Optional[str] = None


# ----- Auth Models -----
class UserPublic(BaseModel):
    id: str
    email: str
    created_at: str


class RegisterPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class ForgotPayload(BaseModel):
    email: EmailStr


class ResetPayload(BaseModel):
    token: str
    password: str = Field(min_length=6, max_length=128)


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


# ----- Auth helpers -----
def _hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def _send_reset_email(email: str, reset_link: str) -> None:
    """Send reset email via Resend if RESEND_API_KEY is set, otherwise log the link."""
    if not RESEND_API_KEY:
        logger.info("[Password reset] %s → %s", email, reset_link)
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client_http:
            r = await client_http.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": RESEND_FROM,
                    "to": [email],
                    "subject": "Réinitialiser votre mot de passe — Smart Notes IA",
                    "html": (
                        f"<p>Bonjour,</p>"
                        f"<p>Vous avez demandé à réinitialiser votre mot de passe.</p>"
                        f"<p>Cliquez sur ce lien (valable 1h) :</p>"
                        f'<p><a href="{reset_link}">{reset_link}</a></p>'
                        f"<p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.</p>"
                    ),
                },
            )
            if r.status_code >= 400:
                logger.warning("Resend error %s: %s", r.status_code, r.text)
    except Exception:
        logger.exception("Resend send failed")


# ----- AI Service -----
def _strip_data_url(b64: str) -> tuple[str, str]:
    """Return (clean_base64, mime). Accepts raw or data URL."""
    if b64.startswith("data:"):
        m = re.match(r"data:([^;]+);base64,(.+)", b64)
        if m:
            return m.group(2), m.group(1)
    return b64, "image/jpeg"


async def run_ocr(image_base64: str, mime: str = "image/jpeg") -> str:
    """Use Gemini vision to extract text from an image (invoice/receipt/quote)."""
    if not gemini_client:
        raise HTTPException(500, "GEMINI_API_KEY not configured")

    clean_b64, detected_mime = _strip_data_url(image_base64)
    if mime in (None, "", "image/jpeg") and detected_mime:
        mime = detected_mime

    try:
        image_bytes = base64.b64decode(clean_b64)
    except Exception:
        logger.exception("Invalid image base64")
        return ""

    prompt = (
        "Tu es un OCR expert. Extrais TOUT le texte visible dans cette image "
        "(devis, facture, ticket, document) en conservant la structure. "
        "Retourne uniquement le texte extrait, sans commentaire."
    )

    try:
        response = await gemini_client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime),
                prompt,
            ],
        )
        return (response.text or "").strip()
    except Exception:
        logger.exception("OCR failed")
        return ""


def _heuristic_urgent(text: str) -> bool:
    low = text.lower()
    return any(kw in low for kw in URGENT_KEYWORDS)


def _fallback_item(text: str) -> dict:
    cat = _heuristic_category(text)
    urgent_flag = _heuristic_urgent(text) or cat == "Urgent"
    cats = [cat]
    if urgent_flag and "Urgent" not in cats:
        cats.append("Urgent")
    return {
        "content": text,
        "title": (text[:60] or "Note").strip(),
        "summary": text[:200],
        "categories": cats[:2],
        "urgent": urgent_flag,
        "reminder_date": None,
        "amount": None,
    }


_LIST_MARKER_RE = re.compile(r"^\s*(?:[-*•·–—]+|\d+[\.\)])\s+")


def _detect_list_lines(text: str) -> Optional[List[str]]:
    """
    If the user input looks like a bullet/line-separated list (typical "in vrac" capture),
    return a clean list of one item per line. Otherwise return None (so we fall back to
    prose-level AI splitting).

    Heuristic:
    - Split on newlines, drop blanks.
    - At least 3 non-empty lines.
    - Either >= 40% of the lines start with a bullet marker (-, *, •, 1., etc.),
      OR average line length is short (< 110 chars) and most lines are < 200 chars.
    """
    lines_raw = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if len(lines_raw) < 3:
        return None

    bullet_count = sum(1 for ln in lines_raw if _LIST_MARKER_RE.match(ln))
    bullet_ratio = bullet_count / len(lines_raw)
    avg_len = sum(len(ln) for ln in lines_raw) / len(lines_raw)
    short_lines_ratio = sum(1 for ln in lines_raw if len(ln) < 200) / len(lines_raw)

    looks_like_list = bullet_ratio >= 0.4 or (avg_len < 110 and short_lines_ratio >= 0.85)
    if not looks_like_list:
        return None

    cleaned = []
    for ln in lines_raw:
        # Remove leading bullet/marker and surrounding whitespace
        ln = _LIST_MARKER_RE.sub("", ln).strip()
        # Skip pure header words like "TODO" of < 4 chars
        if not ln or len(ln) < 2:
            continue
        cleaned.append(ln)
    return cleaned if len(cleaned) >= 3 else None


# Strict JSON schema for Gemini structured output
NOTES_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "items": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "content": {"type": "STRING"},
                    "title": {"type": "STRING"},
                    "summary": {"type": "STRING"},
                    "categories": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                    },
                    "urgent": {"type": "BOOLEAN"},
                    "reminder_date": {"type": "STRING", "nullable": True},
                    "amount": {"type": "NUMBER", "nullable": True},
                },
                "required": ["content", "title", "summary", "categories", "urgent"],
            },
        }
    },
    "required": ["items"],
}


async def classify_note(text: str, allow_split: bool = True) -> list[dict]:
    """
    Use Gemini to:
    - Detect if the input contains MULTIPLE distinct notes (different topics/tasks).
    - For each detected note, return: content, title, summary, categories, urgency, reminder date, amount.
    Returns a list of items (1 or more).
    """
    if not gemini_client or not text.strip():
        return [_fallback_item(text)]

    today = datetime.now(timezone.utc).date()
    today_iso = today.isoformat()
    weekday_fr = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][today.weekday()]

    # Detect bullet/line-separated list: each line MUST become its own note
    list_lines = _detect_list_lines(text) if allow_split else None

    if list_lines:
        numbered = "\n".join(f"{i+1}. {ln}" for i, ln in enumerate(list_lines))
        user_payload = (
            f"Voici une LISTE de {len(list_lines)} éléments déjà séparés ligne par ligne. "
            f"Tu DOIS retourner EXACTEMENT {len(list_lines)} éléments dans 'items', "
            f"un par ligne, DANS LE MÊME ORDRE. NE FUSIONNE JAMAIS deux lignes.\n\n"
            f"LISTE :\n{numbered}"
        )
        split_instruction = (
            "MODE LISTE : L'utilisateur a saisi une LISTE. Chaque ligne numérotée ci-dessous est UNE NOTE DISTINCTE.\n"
            f"- Tu DOIS retourner EXACTEMENT {len(list_lines)} éléments dans 'items', dans le même ordre que la liste.\n"
            "- INTERDICTION ABSOLUE de fusionner plusieurs lignes en un seul élément, même si elles partagent un mot (ex: 'Devis').\n"
            "- INTERDICTION ABSOLUE d'inventer des éléments supplémentaires.\n"
            "- Pour chaque ligne, fais un titre clair, une catégorie pertinente, et détecte les dates/montants éventuels.\n"
        )
    else:
        user_payload = text
        if allow_split:
            split_instruction = (
                "RÈGLE DE DÉCOUPAGE (TRÈS IMPORTANTE) :\n"
                "- L'utilisateur écrit souvent PLUSIEURS notes/tâches/idées en vrac dans un seul bloc.\n"
                "- Tu DOIS identifier CHAQUE idée, sujet ou tâche distinct(e) et créer UN ÉLÉMENT SÉPARÉ pour chacun(e).\n"
                "- Une nouvelle phrase qui parle d'un AUTRE sujet, d'une AUTRE personne, d'une AUTRE catégorie, d'une AUTRE échéance "
                "= un nouvel élément.\n"
                "- Exemple 1 : 'rappel rdv médecin mardi. payer la facture EDF avant vendredi. acheter cadeau anniversaire papa' "
                "= 3 éléments distincts (Santé / Finances / Famille).\n"
                "- Exemple 2 (LISTE) : 'Devis Nadir\\nDevis Tiberghien\\nDevis Rachid' = 3 éléments distincts "
                "(un par devis, JAMAIS regroupés sous 'Devis divers').\n"
                "- Si TOUT le texte parle vraiment du MÊME sujet, alors UN SEUL élément.\n"
                "- Ne fusionne JAMAIS deux sujets différents en un seul élément, même s'ils sont collés.\n"
            )
        else:
            split_instruction = "Considère TOUT le texte comme UNE SEULE note. Retourne un seul élément."

    system = (
        "Tu es une IA qui organise des notes en français pour un particulier (gestion familiale, administrative, pro).\n"
        f"Date d'aujourd'hui : {today_iso} ({weekday_fr}).\n"
        f"Catégories autorisées (utilise UNIQUEMENT ces 6 valeurs exactes) : {', '.join(CATEGORIES)}.\n\n"
        f"{split_instruction}\n"
        "RÈGLES DE CATÉGORIE (TRÈS STRICTES, applique-les avant tout) :\n"
        "- Si le texte contient le mot 'devis' (ou estimation, chiffrage) → catégorie 'Devis'.\n"
        "- Si le texte contient 'amende', 'avocat', 'tribunal', 'huissier', 'urgent', 'asap', 'mise en demeure' → catégorie 'Urgent'.\n"
        "- Si le texte parle d'impôts, TVA, nationalité, douane, préfecture, CAF, sécurité sociale, "
        "permis, passeport, attestation, prévoyance, arrêt maladie, formation, autorisation, mairie, CGPN → catégorie 'Administratif'.\n"
        "- Si le texte parle de travaux, peinture, clôture, carrelage, plomberie, rénovation, escalier, rampe, "
        "voiture, moteur, véhicule, pneu, géomètre, chantier → catégorie 'Travaux'.\n"
        "- Si le texte parle de famille (maman, papa, frère, sœur, enfant, conjoint, hébergement, divorce), de santé "
        "(rdv médecin, dentiste, médicament), de courses, vacances, anniversaire, cadeau → catégorie 'Personnel'.\n"
        "- Si rien ne correspond clairement → catégorie 'Divers'.\n"
        "- Tu peux mettre 1 ou 2 catégories MAX. La 1ère doit être la plus pertinente.\n\n"
        "Pour CHAQUE élément, remplis :\n"
        "- content : le texte original concernant cette note (garde les mots de l'utilisateur).\n"
        "- title : titre court 3-8 mots, clair et descriptif.\n"
        "- summary : résumé en 1 phrase courte.\n"
        "- categories : 1 à 2 catégories de la liste autorisée.\n"
        "- urgent : true si présence de 'amende', 'avocat', 'tribunal', 'urgent', 'demain', 'échéance', "
        "'impôts', 'retard', 'paiement immédiat', OU délai très court (≤ 2 jours).\n"
        "- reminder_date : DÉTECTE TOUTE DATE OU ÉCHÉANCE et convertis-la en ISO YYYY-MM-DD. "
        "Exemples : 'demain' → date de demain, 'lundi prochain', 'dans 3 jours', 'vendredi', 'avant jeudi', "
        "'le 15 mars', '20/04/2026', 'la semaine prochaine', 'fin du mois'. "
        "Si AUCUNE date n'est détectée, mets null.\n"
        "- amount : montant en euros si mentionné (ex: '450€', '1200 euros'), sinon null.\n"
    )

    try:
        response = await gemini_client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=[user_payload],
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_schema=NOTES_RESPONSE_SCHEMA,
                temperature=0.1,
                max_output_tokens=8192,
            ),
        )
        raw = (response.text or "").strip()
        # Strip code fences in case the model still adds them
        raw = re.sub(r"^```(?:json)?", "", raw).strip()
        raw = re.sub(r"```$", "", raw).strip()
        data = json.loads(raw)

        items_raw = data.get("items") or []
        if not isinstance(items_raw, list) or not items_raw:
            # If we expected a list and got nothing, fall back to one-note-per-line classification
            if list_lines:
                logger.warning("List mode: empty items returned, using fallback per-line.")
                return [_fallback_item(ln) for ln in list_lines]
            return [_fallback_item(text)]

        # Safety net for list mode: if Gemini still merged items, restore one-per-line
        if list_lines and len(items_raw) < len(list_lines):
            logger.warning(
                "List mode: Gemini returned %d items but %d lines were expected. Falling back to per-line.",
                len(items_raw), len(list_lines),
            )
            items_raw = [
                {
                    "content": ln,
                    "title": ln[:60],
                    "summary": ln[:200],
                    "categories": ["Personnel"],
                    "urgent": _heuristic_urgent(ln),
                    "reminder_date": None,
                    "amount": None,
                }
                for ln in list_lines
            ]

        results: list[dict] = []
        for item in items_raw:
            if not isinstance(item, dict):
                continue
            content = str(item.get("content") or "").strip() or text
            cats = [c for c in (item.get("categories") or []) if c in CATEGORIES]
            # Apply keyword heuristic: if the LLM defaulted to Personnel/Divers but the
            # text clearly matches another category, override the primary category.
            heur = _heuristic_category(content)
            if heur != "Divers":
                if not cats or cats[0] in ("Personnel", "Divers") and heur not in cats:
                    cats = [heur] + [c for c in cats if c != heur]
            if not cats:
                cats = [heur]
            urgent_flag = bool(item.get("urgent", False)) or _heuristic_urgent(content) or ("Urgent" in cats)
            if urgent_flag and "Urgent" not in cats:
                cats.append("Urgent")
            cats = cats[:2]  # max 2 categories
            reminder = item.get("reminder_date")
            # Normalise reminder_date: only keep if it looks like ISO YYYY-MM-DD
            if reminder and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(reminder)):
                reminder = None
            results.append({
                "content": content,
                "title": str(item.get("title") or content[:60] or "Note").strip(),
                "summary": str(item.get("summary") or content[:200]).strip(),
                "categories": cats,
                "urgent": urgent_flag,
                "reminder_date": reminder,
                "amount": item.get("amount"),
            })

        return results or [_fallback_item(text)]
    except Exception as e:
        logger.exception("Classification failed: %s", e)
        if list_lines:
            return [_fallback_item(ln) for ln in list_lines]
        return [_fallback_item(text)]


# ----- Routes -----
@api_router.get("/")
async def root():
    return {"message": "Smart Notes IA API", "version": "2.0"}


# ----- Auth Routes -----
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(payload: RegisterPayload):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Cet email est déjà utilisé")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": _hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)

    # If this is the FIRST user in the system, adopt any orphan notes (legacy data).
    total_users = await db.users.count_documents({})
    if total_users == 1:
        orphan_filter = {"$or": [{"user_id": {"$exists": False}}, {"user_id": None}]}
        await db.notes.update_many(orphan_filter, {"$set": {"user_id": user_id}})

    token = _create_access_token(user_id, email)
    return AuthResponse(
        token=token,
        user=UserPublic(id=user_id, email=email, created_at=user_doc["created_at"]),
    )


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginPayload):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not _verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = _create_access_token(user["id"], user["email"])
    return AuthResponse(
        token=token,
        user=UserPublic(id=user["id"], email=user["email"], created_at=user["created_at"]),
    )


@api_router.get("/auth/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return UserPublic(
        id=current_user["id"],
        email=current_user["email"],
        created_at=current_user["created_at"],
    )


@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPayload, request: Request):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    # Always respond 200 to avoid leaking whether the email exists
    if user:
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.password_reset_tokens.insert_one({
            "token": reset_token,
            "user_id": user["id"],
            "expires_at": expires_at,
            "used": False,
            "created_at": datetime.now(timezone.utc),
        })
        base_url = APP_PUBLIC_URL or str(request.base_url).rstrip("/")
        reset_link = f"{base_url}/reset-password?token={reset_token}"
        await _send_reset_email(email, reset_link)
    return {"ok": True, "message": "Si cet email existe, un lien vient d'être envoyé."}


@api_router.post("/auth/reset-password")
async def reset_password(payload: ResetPayload):
    record = await db.password_reset_tokens.find_one({"token": payload.token, "used": False})
    if not record:
        raise HTTPException(status_code=400, detail="Lien invalide ou déjà utilisé")
    expires_at = record.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Lien expiré")
    new_hash = _hash_password(payload.password)
    await db.users.update_one({"id": record["user_id"]}, {"$set": {"password_hash": new_hash}})
    await db.password_reset_tokens.update_one({"token": payload.token}, {"$set": {"used": True}})
    return {"ok": True, "message": "Mot de passe mis à jour"}


@api_router.delete("/auth/account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    await db.notes.delete_many({"user_id": uid})
    await db.password_reset_tokens.delete_many({"user_id": uid})
    await db.users.delete_one({"id": uid})
    return {"ok": True, "message": "Compte supprimé"}


@api_router.post("/notes", response_model=List[Note])
async def create_note(payload: NoteCreate, current_user: dict = Depends(get_current_user)):
    ocr_text = None
    full_text = payload.content or ""

    # If image provided, run OCR first
    has_image = bool(payload.image_base64)
    if has_image:
        mime = payload.image_mime or "image/jpeg"
        ocr_text = await run_ocr(payload.image_base64, mime)
        if ocr_text:
            full_text = (full_text + "\n\n" + ocr_text).strip() if full_text else ocr_text

    if not full_text.strip():
        raise HTTPException(400, "Empty note: provide content or image")

    # Only split when no image attached. With an image, the document = one note.
    items = await classify_note(full_text, allow_split=not has_image)

    created: list[Note] = []
    for idx, ai in enumerate(items):
        note = Note(
            user_id=current_user["id"],
            content=ai["content"] if not has_image else (payload.content or ""),
            ocr_text=ocr_text if idx == 0 else None,  # OCR only on first note
            image_base64=payload.image_base64 if idx == 0 else None,
            image_mime=payload.image_mime if idx == 0 else None,
            title=ai["title"],
            summary=ai["summary"],
            categories=ai["categories"],
            urgent=ai["urgent"],
            reminder_date=ai["reminder_date"],
            amount=ai["amount"],
        )
        await db.notes.insert_one(note.model_dump())
        created.append(note)

    return created


@api_router.get("/notes", response_model=List[Note])
async def list_notes(
    category: Optional[str] = None,
    status: Optional[str] = None,
    urgent: Optional[bool] = None,
    q: Optional[str] = None,
    sort: Optional[str] = "recent",  # recent | oldest | urgent | reminder | category
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    query: dict = {"user_id": current_user["id"]}
    if category:
        query["categories"] = category
    # Special status values:
    # - "active" = not done (default UX): hide completed notes from main list
    # - "todo" / "in_progress" / "done" = exact match
    if status == "active":
        query["status"] = {"$ne": "done"}
    elif status:
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

    sort_spec: list = [("created_at", -1)]
    if sort == "oldest":
        sort_spec = [("created_at", 1)]
    elif sort == "urgent":
        sort_spec = [("urgent", -1), ("created_at", -1)]
    elif sort == "reminder":
        # Notes with reminder first (ascending), then those without
        sort_spec = [("reminder_date", 1), ("created_at", -1)]
    elif sort == "category":
        sort_spec = [("categories", 1), ("created_at", -1)]

    cursor = db.notes.find(query, {"_id": 0}).sort(sort_spec).limit(limit)
    docs = await cursor.to_list(limit)
    notes = [Note(**d) for d in docs]

    # For "reminder" sort, push notes without reminder to the end (Mongo sorts null first)
    if sort == "reminder":
        with_rem = [n for n in notes if n.reminder_date]
        without_rem = [n for n in notes if not n.reminder_date]
        notes = with_rem + without_rem

    return notes


@api_router.get("/notes/{note_id}", response_model=Note)
async def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.notes.find_one({"id": note_id, "user_id": current_user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Note not found")
    return Note(**doc)


@api_router.patch("/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, payload: NoteUpdate, current_user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    if "status" in updates and updates["status"] not in ("todo", "in_progress", "done"):
        raise HTTPException(400, "Invalid status")
    if "categories" in updates:
        updates["categories"] = _remap_categories(updates["categories"]) or ["Divers"]
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.notes.update_one(
        {"id": note_id, "user_id": current_user["id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Note not found")
    doc = await db.notes.find_one({"id": note_id, "user_id": current_user["id"]}, {"_id": 0})
    return Note(**doc)


@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.notes.delete_one({"id": note_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Note not found")
    return {"ok": True}


@api_router.get("/dashboard")
async def dashboard(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    today = datetime.now(timezone.utc).date()
    today_iso = today.isoformat()
    seven_days = (today + timedelta(days=7)).isoformat()

    # Urgent open notes
    urgent_today = await db.notes.find(
        {"user_id": uid, "urgent": True, "status": {"$ne": "done"}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    # Upcoming reminders (next 7 days)
    upcoming = await db.notes.find(
        {
            "user_id": uid,
            "reminder_date": {"$gte": today_iso, "$lte": seven_days},
            "status": {"$ne": "done"},
        },
        {"_id": 0},
    ).sort("reminder_date", 1).to_list(50)

    # Overdue tasks
    overdue = await db.notes.find(
        {
            "user_id": uid,
            "reminder_date": {"$lt": today_iso, "$ne": None},
            "status": {"$ne": "done"},
        },
        {"_id": 0},
    ).sort("reminder_date", 1).to_list(50)

    # Stats per category
    pipeline = [
        {"$match": {"user_id": uid, "status": {"$ne": "done"}}},
        {"$unwind": "$categories"},
        {"$group": {"_id": "$categories", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    cat_stats = await db.notes.aggregate(pipeline).to_list(50)
    by_category = [{"category": c["_id"], "count": c["count"]} for c in cat_stats]

    todo_count = await db.notes.count_documents({"user_id": uid, "status": "todo"})
    in_progress_count = await db.notes.count_documents({"user_id": uid, "status": "in_progress"})
    done_count = await db.notes.count_documents({"user_id": uid, "status": "done"})
    total = await db.notes.count_documents({"user_id": uid})

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


@app.on_event("startup")
async def setup_indexes_and_migrate():
    """Create indexes and run one-shot migrations."""
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.notes.create_index([("user_id", 1), ("created_at", -1)])
        await db.password_reset_tokens.create_index("token", unique=True)
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        logger.exception("Index creation failed (non-fatal).")


@app.on_event("startup")
async def migrate_legacy_categories():
    """One-shot migration: remap old categories ('Famille', 'Santé', ...) onto the new palette."""
    try:
        legacy_names = list(LEGACY_CATEGORY_MAP.keys())
        cursor = db.notes.find({"categories": {"$in": legacy_names}}, {"_id": 0})
        migrated = 0
        async for doc in cursor:
            new_cats = _remap_categories(doc.get("categories") or [])
            await db.notes.update_one(
                {"id": doc["id"]},
                {"$set": {"categories": new_cats, "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            migrated += 1
        if migrated:
            logger.info("Migrated %d notes to the new category palette.", migrated)
    except Exception:
        logger.exception("Category migration failed (non-fatal).")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
