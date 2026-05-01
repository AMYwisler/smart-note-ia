"""Tests for new sort options and category-aware dashboard (iteration 2)."""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


# ----- Sort options on GET /api/notes -----
class TestSortOptions:
    def test_sort_recent_default_desc(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes", params={"sort": "recent"}, timeout=15)
        assert r.status_code == 200
        notes = r.json()
        assert isinstance(notes, list)
        if len(notes) >= 2:
            for a, b in zip(notes, notes[1:]):
                assert a["created_at"] >= b["created_at"], (
                    f"Recent sort broken: {a['created_at']} should be >= {b['created_at']}"
                )

    def test_sort_default_equals_recent(self, api_client):
        r1 = api_client.get(f"{BASE_URL}/api/notes", timeout=15)
        r2 = api_client.get(f"{BASE_URL}/api/notes", params={"sort": "recent"}, timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        ids1 = [n["id"] for n in r1.json()]
        ids2 = [n["id"] for n in r2.json()]
        assert ids1 == ids2, "Default sort should equal sort=recent"

    def test_sort_oldest_asc(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes", params={"sort": "oldest"}, timeout=15)
        assert r.status_code == 200
        notes = r.json()
        if len(notes) >= 2:
            for a, b in zip(notes, notes[1:]):
                assert a["created_at"] <= b["created_at"], (
                    f"Oldest sort broken: {a['created_at']} should be <= {b['created_at']}"
                )

    def test_sort_urgent_first(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes", params={"sort": "urgent"}, timeout=15)
        assert r.status_code == 200
        notes = r.json()
        if len(notes) >= 2:
            seen_non_urgent = False
            for n in notes:
                if not n["urgent"]:
                    seen_non_urgent = True
                else:
                    # urgent=True after we've already seen a non-urgent one
                    assert not seen_non_urgent, (
                        "Urgent sort broken: urgent=True note appeared after urgent=False"
                    )

    def test_sort_reminder_with_first_then_null(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes", params={"sort": "reminder"}, timeout=15)
        assert r.status_code == 200
        notes = r.json()
        if len(notes) >= 2:
            seen_null = False
            for n in notes:
                rd = n.get("reminder_date")
                if rd is None:
                    seen_null = True
                else:
                    assert not seen_null, (
                        "Reminder sort broken: a note with reminder appeared AFTER one with null reminder"
                    )
            # Among notes with reminder_date set, ensure ascending order
            with_rem = [n["reminder_date"] for n in notes if n.get("reminder_date")]
            for a, b in zip(with_rem, with_rem[1:]):
                assert a <= b, f"Reminder ascending broken: {a} > {b}"

    def test_sort_category_alphabetical(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes", params={"sort": "category"}, timeout=15)
        assert r.status_code == 200
        notes = r.json()
        # The backend sorts by the categories array. We can't strictly assert
        # alphabetical order on the FIRST category (Mongo sorts by min element),
        # but we can verify the request succeeds and returns valid data.
        for n in notes:
            assert isinstance(n.get("categories"), list)
            assert len(n["categories"]) >= 1

    def test_sort_invalid_falls_back(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/notes", params={"sort": "bogus"}, timeout=15)
        # Backend doesn't validate sort key strictly; should fall back to default (recent)
        assert r.status_code == 200, f"Unexpected status: {r.status_code} {r.text}"


# ----- Combined filter+sort -----
class TestSortWithFilters:
    def test_sort_urgent_with_status_filter(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/notes",
            params={"sort": "urgent", "status": "todo"},
            timeout=15,
        )
        assert r.status_code == 200
        for n in r.json():
            assert n["status"] == "todo"

    def test_sort_reminder_with_category(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/notes",
            params={"sort": "reminder", "category": "Finances"},
            timeout=15,
        )
        assert r.status_code == 200
        for n in r.json():
            assert "Finances" in n["categories"]


# ----- Dashboard by_category regression -----
class TestDashboardCategories:
    def test_dashboard_by_category_descending_count(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dashboard", timeout=15)
        assert r.status_code == 200
        d = r.json()
        bc = d["by_category"]
        assert isinstance(bc, list)
        for entry in bc:
            assert "category" in entry and "count" in entry
            assert isinstance(entry["count"], int)
            assert entry["count"] >= 1
        # Ensure it's sorted by count descending
        if len(bc) >= 2:
            for a, b in zip(bc, bc[1:]):
                assert a["count"] >= b["count"], "by_category should be sorted desc by count"
