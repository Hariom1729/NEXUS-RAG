"""Fixed-size character chunking with overlap."""


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 120):
    text = (text or "").strip()
    if not text:
        return []
    if chunk_size <= 0:
        chunk_size = 800
    if overlap >= chunk_size:
        overlap = chunk_size // 4
    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = end - overlap
    return chunks
