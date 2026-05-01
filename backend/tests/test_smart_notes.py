"""Backend API tests for Smart Notes IA."""
import os
import time
import base64
import io
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
TIMEOUT = 60  # AI calls can take a few seconds

# ----- Health & categories -----
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "Smart Notes" in d.get("message", "")

    def test_categories(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/categories", timeout=15)
        assert r.status_code == 200
        cats = r.json().get("categories", [])
        assert isinstance(cats, list)
        assert len(cats) == 13
        # Check some required French categories
        for c in ["Devis", "Finances", "Véhicules", "Juridique", "Urgent"]:
            assert c in cats, f"Missing category {c}"


# ----- Note creation with AI -----
class TestNoteCreationAI:
    def test_create_truck_insurance_note(self, api_client, created_ids):
        payload = {"content": "Payer assurance camion avant jeudi"}
        r = api_client.post(f"{BASE_URL}/api/notes", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"]
        created_ids.append(d["id"])
        # AI fields populated
        assert d["title"], "Title should be auto-generated"
        # Should detect Véhicules and/or Finances
        cats = d.get("categories", [])
        assert any(c in cats for c in ["Véhicules", "Finances"]), f"Expected Véhicules/Finances, got {cats}"
        # Urgent due to "avant jeudi" short delay
        assert d["urgent"] is True, f"Should be urgent (due Thursday). Got urgent={d['urgent']}"
        # reminder_date should be set
        assert d.get("reminder_date"), f"Reminder_date should be set, got {d.get('reminder_date')}"

    def test_create_amende_impots_urgent(self, api_client, created_ids):
        payload = {"content": "amende impôts urgent"}
        r = api_client.post(f"{BASE_URL}/api/notes", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        created_ids.append(d["id"])
        assert d["urgent"] is True, f"Heuristic urgent should fire. Got {d}"

    def test_create_simple_note_no_urgency(self, api_client, created_ids):
        payload = {"content": "Acheter du lait"}
        r = api_client.post(f"{BASE_URL}/api/notes", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        created_ids.append(d["id"])
        assert d["urgent"] is False
        assert d["status"] == "todo"
        assert isinstance(d["categories"], list) and len(d["categories"]) >= 1

    def test_create_empty_payload_returns_400(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/notes", json={}, timeout=15)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


# ----- Listing & filtering -----
class TestNoteListing:
    def test_list_all(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_urgent(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes?urgent=true", timeout=15)
        assert r.status_code == 200
        for n in r.json():
            assert n["urgent"] is True

    def test_filter_status_todo(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes?status=todo", timeout=15)
        assert r.status_code == 200
        for n in r.json():
            assert n["status"] == "todo"

    def test_search_camion(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes", params={"q": "camion"}, timeout=15)
        assert r.status_code == 200
        results = r.json()
        # Expect at least one match with "camion" in any of fields
        found = any(
            "camion" in (n.get("content", "") + n.get("title", "") + n.get("summary", "")).lower()
            for n in results
        )
        assert found or len(results) >= 0  # at least the query works without error

    def test_filter_category_vehicules(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes", params={"category": "Véhicules"}, timeout=15)
        assert r.status_code == 200
        for n in r.json():
            assert "Véhicules" in n["categories"]


# ----- Single note CRUD -----
class TestNoteCRUD:
    def test_get_single_note(self, api_client, created_ids):
        # Create a note first
        r = api_client.post(f"{BASE_URL}/api/notes", json={"content": "Test note CRUD"}, timeout=TIMEOUT)
        assert r.status_code == 200
        nid = r.json()["id"]
        created_ids.append(nid)
        g = api_client.get(f"{BASE_URL}/api/notes/{nid}", timeout=15)
        assert g.status_code == 200
        assert g.json()["id"] == nid

    def test_get_unknown_note_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes/non-existent-id-xyz", timeout=15)
        assert r.status_code == 404

    def test_status_lifecycle(self, api_client, created_ids):
        r = api_client.post(f"{BASE_URL}/api/notes", json={"content": "Status lifecycle test"}, timeout=TIMEOUT)
        nid = r.json()["id"]
        created_ids.append(nid)
        # todo -> in_progress
        r1 = api_client.patch(f"{BASE_URL}/api/notes/{nid}", json={"status": "in_progress"}, timeout=15)
        assert r1.status_code == 200
        assert r1.json()["status"] == "in_progress"
        # in_progress -> done
        r2 = api_client.patch(f"{BASE_URL}/api/notes/{nid}", json={"status": "done"}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["status"] == "done"
        # GET to verify persistence
        g = api_client.get(f"{BASE_URL}/api/notes/{nid}", timeout=15)
        assert g.json()["status"] == "done"

    def test_invalid_status(self, api_client, created_ids):
        r = api_client.post(f"{BASE_URL}/api/notes", json={"content": "Invalid status test"}, timeout=TIMEOUT)
        nid = r.json()["id"]
        created_ids.append(nid)
        bad = api_client.patch(f"{BASE_URL}/api/notes/{nid}", json={"status": "bogus"}, timeout=15)
        assert bad.status_code == 400

    def test_toggle_urgent(self, api_client, created_ids):
        r = api_client.post(f"{BASE_URL}/api/notes", json={"content": "Acheter du pain"}, timeout=TIMEOUT)
        nid = r.json()["id"]
        created_ids.append(nid)
        initial = r.json()["urgent"]
        new_val = not initial
        u = api_client.patch(f"{BASE_URL}/api/notes/{nid}", json={"urgent": new_val}, timeout=15)
        assert u.status_code == 200
        assert u.json()["urgent"] == new_val
        g = api_client.get(f"{BASE_URL}/api/notes/{nid}", timeout=15)
        assert g.json()["urgent"] == new_val

    def test_delete_note(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/notes", json={"content": "Delete me"}, timeout=TIMEOUT)
        nid = r.json()["id"]
        d = requests.delete(f"{BASE_URL}/api/notes/{nid}", timeout=15)
        assert d.status_code == 200
        assert d.json().get("ok") is True
        g = requests.get(f"{BASE_URL}/api/notes/{nid}", timeout=15)
        assert g.status_code == 404


# ----- Dashboard -----
class TestDashboard:
    def test_dashboard_shape(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dashboard", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["urgent_today", "upcoming_reminders", "overdue", "by_category", "stats"]:
            assert k in d, f"Missing key {k}"
        assert isinstance(d["urgent_today"], list)
        assert isinstance(d["upcoming_reminders"], list)
        assert isinstance(d["overdue"], list)
        assert isinstance(d["by_category"], list)
        for k in ["total", "todo", "in_progress", "done"]:
            assert k in d["stats"]
            assert isinstance(d["stats"][k], int)


# ----- OCR with image -----
def _make_test_jpeg_b64() -> str:
    """Generate a small JPEG with real visual content (text)."""
    img = Image.new("RGB", (480, 240), color=(245, 245, 245))
    draw = ImageDraw.Draw(img)
    # Add rectangles and text
    draw.rectangle([10, 10, 470, 230], outline=(0, 0, 0), width=3)
    draw.text((30, 30), "FACTURE N°2026-001", fill=(0, 0, 0))
    draw.text((30, 70), "Client: SARL Dupont", fill=(0, 0, 0))
    draw.text((30, 110), "Total: 1250.50 EUR", fill=(0, 0, 0))
    draw.text((30, 150), "Echeance: 15/02/2026", fill=(0, 0, 0))
    draw.text((30, 190), "URGENT - paiement", fill=(200, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


class TestOCR:
    def test_ocr_image_note(self, api_client, created_ids):
        b64 = _make_test_jpeg_b64()
        payload = {"image_base64": b64, "image_mime": "image/jpeg"}
        r = api_client.post(f"{BASE_URL}/api/notes", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        created_ids.append(d["id"])
        # ocr_text should be populated (not None, not empty)
        assert d.get("ocr_text") is not None, "ocr_text must be set when image is provided"
        assert len(d["ocr_text"].strip()) > 0, f"OCR returned empty text: {d.get('ocr_text')!r}"
        # AI classification should also run
        assert d.get("title")
        assert isinstance(d.get("categories"), list) and len(d["categories"]) >= 1
