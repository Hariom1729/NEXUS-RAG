"""Seed / demo data ingestion for NEXUS-RAG.

Generates a small mixed corpus (PDF + image + text-as-PDF) and ingests it through
the real pipeline via the API for the admin user, so the demo never starts empty.

Usage:
    python scripts/seed_data.py
"""
import os
import io
import time
import sys
import requests

BASE = os.environ.get("SEED_BASE_URL", "http://localhost:8001")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@nexusrag.ai")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

SAMPLES_DIR = "/tmp/nexus_seed"
os.makedirs(SAMPLES_DIR, exist_ok=True)


def make_pdf(path, title, body):
    import pymupdf
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((60, 70), title, fontsize=18)
    y = 110
    for line in body.split("\n"):
        page.insert_text((60, y), line, fontsize=12)
        y += 22
    doc.save(path)
    doc.close()


def make_image(path, caption):
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (700, 360), (18, 18, 26))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 680, 340], outline=(129, 140, 248), width=3)
    d.text((45, 60), "NEXUS-RAG", fill=(129, 140, 248))
    d.text((45, 120), caption, fill=(237, 237, 237))
    d.text((45, 220), "Text path: SentenceTransformers  |  Visual path: CLIP", fill=(251, 191, 36))
    img.save(path)


def build_samples():
    files = []
    p1 = f"{SAMPLES_DIR}/architecture_overview.pdf"
    make_pdf(p1, "NEXUS-RAG Architecture Overview",
             "NEXUS-RAG is an offline multimodal retrieval augmented generation system.\n"
             "Documents, images and audio are embedded into a shared semantic space.\n"
             "ChromaDB stores vectors using HNSW indexing with cosine similarity.\n"
             "Reciprocal Rank Fusion merges the text and visual retrieval paths.\n"
             "Mistral-7B served via Ollama generates grounded, cited answers.")
    files.append(p1)

    p2 = f"{SAMPLES_DIR}/retrieval_pipeline.pdf"
    make_pdf(p2, "Retrieval Pipeline",
             "A user query is embedded by MiniLM for the text path.\n"
             "The same query is embedded by CLIP for the visual path.\n"
             "Top-K results from each path are fused with RRF (k=60).\n"
             "The fused context is injected into the LLM prompt with source tags.\n"
             "Latency is measured across embedding, retrieval and generation stages.")
    files.append(p2)

    p3 = f"{SAMPLES_DIR}/privacy_and_offline.pdf"
    make_pdf(p3, "Privacy and Offline Operation",
             "All embeddings and vector storage run locally on the host.\n"
             "No document content leaves the machine during retrieval.\n"
             "The system operates with zero internet dependency at inference time\n"
             "when the local Ollama server hosts the Mistral-7B model.")
    files.append(p3)

    img = f"{SAMPLES_DIR}/system_diagram.png"
    make_image(img, "Dual-modality embedding + RRF fusion diagram")
    files.append(img)
    return files


def main():
    print(f"→ Logging in as {ADMIN_EMAIL}")
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    r.raise_for_status()
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    files = build_samples()
    print(f"→ Uploading {len(files)} sample files")
    multipart = [("files", (os.path.basename(f), open(f, "rb"))) for f in files]
    r = requests.post(f"{BASE}/api/documents/upload", headers=headers,
                      files=multipart, data={"collection": "demo"})
    r.raise_for_status()
    uploaded = r.json()["uploaded"]
    ids = [u["id"] for u in uploaded if u.get("id")]
    print(f"→ Queued {len(ids)} files. Waiting for ingestion…")

    for _ in range(40):
        time.sleep(1.5)
        docs = requests.get(f"{BASE}/api/documents", headers=headers).json()["documents"]
        pending = [d for d in docs if d["id"] in ids and d["status"] not in ("indexed", "failed")]
        if not pending:
            break

    docs = requests.get(f"{BASE}/api/documents", headers=headers).json()["documents"]
    for d in docs:
        if d["id"] in ids:
            print(f"   • {d['filename']:32s} {d['status']:8s} chunks={d.get('chunk_count')}")
    print("✓ Seed complete.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print("Seed failed:", e)
        sys.exit(1)
