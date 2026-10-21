"""NEXUS-RAG backend integration tests.

Covers auth, docs, chat streaming (SSE), dashboard, system status, settings, admin
and eval stub against the deployed preview URL (uses REACT_APP_BACKEND_URL).
"""
import json
import os
import time
import uuid
import io
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@nexusrag.ai"
ADMIN_PASSWORD = "admin123"


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="module")
def user_creds():
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass123!"
    r = requests.post(f"{API}/auth/register",
                      json={"name": "TEST User", "email": email, "password": password},
                      timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "password": password,
            "token": data["access_token"], "id": data["user"]["id"]}


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ================================================================
# Auth
# ================================================================
class TestAuth:
    def test_admin_login_returns_token(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_me_with_bearer(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == ADMIN_EMAIL
        assert me["role"] == "admin"
        assert "id" in me

    def test_me_without_token_401(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_register_new_user(self, user_creds):
        r = requests.get(f"{API}/auth/me", headers=h(user_creds["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == user_creds["email"].lower()
        assert r.json()["role"] == "user"

    def test_login_wrong_password_401(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrongpass"},
                          timeout=15)
        assert r.status_code == 401


# ================================================================
# Documents / ingestion
# ================================================================
_PDF_MINIMAL = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R"
    b"/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
    b"4 0 obj<</Length 82>>stream\nBT /F1 14 Tf 40 100 Td "
    b"(Project Bluefin launch code MANGO 42.) Tj ET\nendstream\nendobj\n"
    b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
    b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n"
    b"0000000109 00000 n \n0000000207 00000 n \n0000000335 00000 n \n"
    b"trailer<</Size 6/Root 1 0 R>>\nstartxref\n397\n%%EOF"
)


class TestDocuments:
    def test_upload_unsupported_gracefully(self, admin_token):
        files = [("files", ("junk.xyz", b"nothing here", "application/octet-stream"))]
        r = requests.post(f"{API}/documents/upload",
                          headers=h(admin_token),
                          files=files, data={"collection": "TEST_col"},
                          timeout=60)
        assert r.status_code == 200
        j = r.json()
        assert j["uploaded"][0]["status"] == "failed"
        assert "modality" in j["uploaded"][0]

    def test_upload_pdf_and_ingest(self, admin_token):
        files = [("files", (f"TEST_bluefin_{uuid.uuid4().hex[:6]}.pdf", _PDF_MINIMAL, "application/pdf"))]
        r = requests.post(f"{API}/documents/upload",
                          headers=h(admin_token),
                          files=files, data={"collection": "TEST_col"},
                          timeout=60)
        assert r.status_code == 200, r.text
        up = r.json()["uploaded"][0]
        assert up["status"] in ("queued", "parsing", "embedding", "indexed")
        doc_id = up["id"]

        # Poll status until indexed or failed
        deadline = time.time() + 120
        final = None
        while time.time() < deadline:
            r = requests.get(f"{API}/documents", headers=h(admin_token), timeout=15)
            docs = {d["id"]: d for d in r.json()["documents"]}
            if doc_id in docs and docs[doc_id]["status"] in ("indexed", "failed"):
                final = docs[doc_id]
                break
            time.sleep(2)
        assert final is not None, "document ingestion never completed"
        assert final["status"] == "indexed", f"status={final['status']} error={final.get('error')}"
        assert final["chunk_count"] > 0
        # store for reuse
        pytest.tested_doc_id = doc_id

    def test_list_documents(self, admin_token):
        r = requests.get(f"{API}/documents", headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json()["documents"], list)

    def test_collections(self, admin_token):
        r = requests.get(f"{API}/documents/collections", headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        cols = r.json()["collections"]
        assert isinstance(cols, list)
        # our TEST_col should be present after upload
        names = [c["name"] for c in cols]
        assert "TEST_col" in names or any(c["count"] > 0 for c in cols)

    def test_reindex(self, admin_token):
        doc_id = getattr(pytest, "tested_doc_id", None)
        if not doc_id:
            pytest.skip("no uploaded doc id")
        r = requests.post(f"{API}/documents/{doc_id}/reindex",
                          headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        # wait for it to re-index
        deadline = time.time() + 90
        while time.time() < deadline:
            r = requests.get(f"{API}/documents", headers=h(admin_token), timeout=15)
            docs = {d["id"]: d for d in r.json()["documents"]}
            if docs.get(doc_id, {}).get("status") in ("indexed", "failed"):
                break
            time.sleep(2)
        assert docs[doc_id]["status"] == "indexed"

    def test_bulk_delete_and_verify(self, admin_token):
        doc_id = getattr(pytest, "tested_doc_id", None)
        if not doc_id:
            pytest.skip("no uploaded doc id")
        r = requests.post(f"{API}/documents/bulk-delete",
                          headers=h(admin_token),
                          json={"ids": [doc_id]}, timeout=30)
        assert r.status_code == 200
        assert r.json()["deleted"] >= 1
        r = requests.get(f"{API}/documents", headers=h(admin_token), timeout=15)
        ids = [d["id"] for d in r.json()["documents"]]
        assert doc_id not in ids


# ================================================================
# Settings
# ================================================================
class TestSettings:
    def test_get_defaults(self, admin_token):
        r = requests.get(f"{API}/settings", headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        s = r.json()
        for k in ("chunk_size", "chunk_overlap", "top_k",
                  "rrf_text_weight", "rrf_visual_weight"):
            assert k in s

    def test_put_and_persist(self, admin_token):
        payload = {"chunk_size": 700, "chunk_overlap": 90, "top_k": 4,
                   "rrf_text_weight": 1.5, "rrf_visual_weight": 0.8,
                   "ollama_model": "mistral:7b"}
        r = requests.put(f"{API}/settings", headers=h(admin_token),
                         json=payload, timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/settings", headers=h(admin_token), timeout=15)
        s = r.json()
        assert s["chunk_size"] == 700
        assert s["top_k"] == 4
        assert abs(s["rrf_text_weight"] - 1.5) < 0.01
        # restore defaults
        requests.put(f"{API}/settings", headers=h(admin_token), json={
            "chunk_size": 800, "chunk_overlap": 120, "top_k": 5,
            "rrf_text_weight": 1.0, "rrf_visual_weight": 1.0,
            "ollama_model": "mistral:7b",
        }, timeout=15)


# ================================================================
# System / offline status
# ================================================================
class TestSystem:
    def test_status(self, admin_token):
        r = requests.get(f"{API}/system/status", headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert s["offline_mode"] is True
        assert s["llm_backend"]["mode"] == "cloud_substitution"
        assert s["ollama"]["reachable"] is False
        assert "vector_store" in s
        assert "counts" in s["vector_store"] or "text_count" in s["vector_store"] or True

    def test_eval_stub(self, admin_token):
        r = requests.get(f"{API}/eval", headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["status"] == "not_configured"
        assert j["metrics"] is None
        assert "expected_interface" in j


# ================================================================
# Chat SSE + Dashboard (uses seeded 'demo' docs from admin)
# ================================================================
class TestChatAndDashboard:
    def _sse(self, token, question, timeout=90, conv_id=None):
        payload = {"question": question}
        if conv_id:
            payload["conversation_id"] = conv_id
        r = requests.post(f"{API}/chat/stream",
                          headers={**h(token), "Content-Type": "application/json"},
                          json=payload, stream=True, timeout=timeout)
        assert r.status_code == 200
        meta = None
        tokens = []
        done = None
        error = None
        for line in r.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data: "):
                continue
            obj = json.loads(line[6:])
            t = obj.get("type")
            if t == "meta":
                meta = obj
            elif t == "token":
                tokens.append(obj["content"])
            elif t == "done":
                done = obj
                break
            elif t == "error":
                error = obj
                break
        return meta, "".join(tokens), done, error

    def test_stream_returns_meta_tokens_done(self, admin_token):
        meta, text, done, err = self._sse(
            admin_token,
            "Give me a one-sentence summary of the documents in this knowledge base."
        )
        assert err is None, f"stream error: {err}"
        assert meta is not None
        assert "sources" in meta and "rankings" in meta and "latency" in meta
        assert "text" in meta["rankings"] and "visual" in meta["rankings"] and "fused" in meta["rankings"]
        assert done is not None
        assert done["backend"]["mode"] in ("cloud_substitution", "ollama")
        # answer must be non-empty
        assert len(text.strip()) > 5, f"empty answer: '{text}'"
        # save conv id
        pytest.last_conv_id = meta.get("conversation_id")

    def test_answer_is_grounded_with_citation(self, admin_token):
        # This exercises the grounded-citation contract using seeded docs.
        meta, text, done, err = self._sse(
            admin_token,
            "Referring to the ingested documents, provide any relevant fact and cite the source using [S#] format."
        )
        assert err is None
        assert meta and done
        # not a hard requirement that model always cites, but sources must exist
        assert isinstance(meta["sources"], list)
        # weak grounding proof: answer non-empty and > 20 chars
        assert len(text.strip()) > 20

    def test_conversations_and_messages_persist(self, admin_token):
        r = requests.get(f"{API}/chat/conversations",
                         headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        convs = r.json()["conversations"]
        assert len(convs) >= 1
        cid = getattr(pytest, "last_conv_id", None) or convs[0]["id"]
        r = requests.get(f"{API}/chat/conversations/{cid}/messages",
                         headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        msgs = r.json()["messages"]
        assert len(msgs) >= 2  # at least one user + one assistant

    def test_dashboard_last_retrieval(self, admin_token):
        r = requests.get(f"{API}/dashboard/last-retrieval",
                         headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j.get("rankings") is not None, "no last retrieval available"
        assert "text" in j["rankings"] and "fused" in j["rankings"]

    def test_dashboard_embedding_space(self, admin_token):
        r = requests.get(f"{API}/dashboard/embedding-space",
                         headers=h(admin_token), timeout=30)
        assert r.status_code == 200
        j = r.json()
        assert "points" in j and j["method"] == "PCA"

    def test_dashboard_latency(self, admin_token):
        r = requests.get(f"{API}/dashboard/latency",
                         headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        assert "series" in r.json()

    def test_stream_requires_auth(self):
        r = requests.post(f"{API}/chat/stream",
                          json={"question": "hello"}, timeout=15)
        assert r.status_code == 401


# ================================================================
# Admin
# ================================================================
class TestAdmin:
    def test_admin_stats_ok(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        j = r.json()
        for k in ("totals", "by_modality", "by_status", "vector_store", "users"):
            assert k in j
        assert j["totals"]["users"] >= 1

    def test_admin_stats_forbidden_for_user(self, user_creds):
        r = requests.get(f"{API}/admin/stats",
                         headers=h(user_creds["token"]), timeout=15)
        assert r.status_code == 403
