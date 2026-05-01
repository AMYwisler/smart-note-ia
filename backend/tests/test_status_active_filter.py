"""Iteration 3: tests for status='active' filter (hide done notes from main list)
and DELETE /api/notes/{id} regression."""
import os
import requests
import pytest

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
TIMEOUT = 60


def _create_simple(content: str) -> str:
    r = requests.post(f"{BASE_URL}/api/notes", json={"content": content}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    # POST returns a list of notes (multi-split). Use first.
    assert isinstance(data, list) and len(data) >= 1
    return data[0]["id"]


class TestStatusActiveFilter:
    """status='active' must return notes where status != 'done'."""

    def test_active_excludes_done(self):
        # Create 2 notes, mark one as done
        a = _create_simple("TEST_active_a Acheter du sel")
        b = _create_simple("TEST_active_b Acheter du poivre")
        try:
            # Mark b as done
            r = requests.patch(f"{BASE_URL}/api/notes/{b}", json={"status": "done"}, timeout=15)
            assert r.status_code == 200
            assert r.json()["status"] == "done"

            # status=active should include a but NOT b
            la = requests.get(f"{BASE_URL}/api/notes", params={"status": "active"}, timeout=15)
            assert la.status_code == 200
            ids = [n["id"] for n in la.json()]
            assert a in ids, "Active list should contain non-done note"
            assert b not in ids, "Active list must NOT contain done note"
            for n in la.json():
                assert n["status"] != "done", f"status=active returned a done note: {n}"
        finally:
            requests.delete(f"{BASE_URL}/api/notes/{a}", timeout=10)
            requests.delete(f"{BASE_URL}/api/notes/{b}", timeout=10)

    def test_done_returns_only_done(self):
        a = _create_simple("TEST_done_filter_a")
        try:
            requests.patch(f"{BASE_URL}/api/notes/{a}", json={"status": "done"}, timeout=15)
            r = requests.get(f"{BASE_URL}/api/notes", params={"status": "done"}, timeout=15)
            assert r.status_code == 200
            data = r.json()
            assert any(n["id"] == a for n in data)
            for n in data:
                assert n["status"] == "done"
        finally:
            requests.delete(f"{BASE_URL}/api/notes/{a}", timeout=10)

    def test_no_status_returns_all(self):
        a = _create_simple("TEST_all_a")
        b = _create_simple("TEST_all_b")
        try:
            requests.patch(f"{BASE_URL}/api/notes/{b}", json={"status": "done"}, timeout=15)
            r = requests.get(f"{BASE_URL}/api/notes", timeout=15)
            assert r.status_code == 200
            ids = [n["id"] for n in r.json()]
            assert a in ids
            assert b in ids, "When no status filter, done notes must be included"
        finally:
            requests.delete(f"{BASE_URL}/api/notes/{a}", timeout=10)
            requests.delete(f"{BASE_URL}/api/notes/{b}", timeout=10)

    def test_status_todo_filter(self):
        a = _create_simple("TEST_todo_a")
        try:
            r = requests.get(f"{BASE_URL}/api/notes", params={"status": "todo"}, timeout=15)
            assert r.status_code == 200
            for n in r.json():
                assert n["status"] == "todo"
        finally:
            requests.delete(f"{BASE_URL}/api/notes/{a}", timeout=10)


class TestDeleteRegression:
    def test_delete_then_404(self):
        nid = _create_simple("TEST_delete_target")
        d = requests.delete(f"{BASE_URL}/api/notes/{nid}", timeout=15)
        assert d.status_code == 200
        assert d.json().get("ok") is True
        g = requests.get(f"{BASE_URL}/api/notes/{nid}", timeout=15)
        assert g.status_code == 404

    def test_delete_unknown_returns_404(self):
        d = requests.delete(f"{BASE_URL}/api/notes/non-existent-zzz", timeout=15)
        assert d.status_code == 404
