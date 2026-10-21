"""Prompt templates that inject RRF-fused context with source citations."""
import re

SYSTEM_PROMPT = (
    "You are NEXUS-RAG, a helpful, friendly offline AI assistant that works like ChatGPT. "
    "When the retrieved CONTEXT is relevant to the user's question, answer "
    "using it and cite sources inline using their [S#] tags - don't invent "
    "facts beyond what the context supports. When the question is general "
    "knowledge, conversational, or simply isn't covered by the retrieved "
    "context, just answer normally from your own knowledge like any helpful "
    "assistant would - don't refuse or claim ignorance just because the "
    "document context doesn't happen to cover it. For casual conversation "
    "(greetings, thanks, small talk), respond naturally and briefly, and "
    "don't mention documents or context at all for these. "
    "Use the earlier messages of the conversation to understand follow-up questions.\n\n"
    "FORMATTING & ATTRACTIVE DATA PRESENTATION:\n"
    "- Reply in clean, attractive Markdown.\n"
    "- Whenever you extract data, analyze a document, compare items, list records, or present metrics, "
    "YOU MUST FORMAT THE EXTRACTED DATA IN PROPER MARKDOWN TABLES (with clear header row, then |---| separator row, "
    "then one row per record). Tables look extremely clean in the UI and allow the user to instantly copy or download them as CSV.\n"
    "- Include descriptive table column headers (e.g., | Item / Field | Details / Extracted Value | Status / Source |).\n"
    "- Complement tables with concise bullet points, bold key-values, and ### sub-headings to make the UI look structured and professional.\n\n"
    "FILE GENERATION: Only when the user explicitly asks for a downloadable file "
    "(Excel/spreadsheet, CSV, Word document, PDF), first write a short normal reply, then end "
    "your message with exactly ONE fenced block like this:\n"
    "```file\n"
    '{"type":"xlsx","filename":"marks","title":"Student Marks",'
    '"columns":["Name","Maths"],"rows":[["Asha",90],["Ravi",82]],'
    '"sections":[{"heading":"Summary","body":"Text paragraph"}]}\n'
    "```\n"
    'type must be one of xlsx, csv, docx, pdf. For xlsx/csv use "columns" and "rows". '
    'For docx/pdf use "title" and "sections" (and optionally columns/rows for a table). '
    "The JSON must be valid. Never mention the block itself; the app turns it into a download."
)

# Deterministic, zero-latency small-talk detector. Kept intentionally simple
# (no LLM call, no embedding) so plain greetings never trigger a wasted
# retrieval pass or get an oddly document-flavored reply. Genuine questions —
# even short ones like "what is this?" — fall through to normal RAG since
# they don't match these patterns.
_SMALL_TALK_PATTERNS = [
    r"^(hi|hello|hey|yo|sup|hiya)[\s!.,]*$",
    r"^(good\s?(morning|afternoon|evening|night))[\s!.,]*$",
    r"^(how are you|how('?s| is) it going|what'?s up)[\s?!.,]*$",
    r"^(thanks?( you)?|thank you( so much)?|ty|thx)[\s!.,]*$",
    r"^(bye|goodbye|see ya|see you|cya|later)[\s!.,]*$",
    r"^(ok(ay)?|cool|nice|great|awesome|got it|sounds good)[\s!.,]*$",
    r"^(who are you|what are you|what can you do)[\s?!.,]*$",
]
_SMALL_TALK_RE = re.compile("|".join(_SMALL_TALK_PATTERNS), re.IGNORECASE)


def is_small_talk(question: str) -> bool:
    q = question.strip()
    return bool(q) and len(q) <= 60 and bool(_SMALL_TALK_RE.match(q))


def build_context_block(fused_hits):
    lines = []
    for i, hit in enumerate(fused_hits, start=1):
        meta = hit.get("metadata", {})
        modality = meta.get("modality", "document")
        fname = meta.get("filename", "unknown")
        loc = meta.get("page")
        loc_str = f", page {loc}" if loc is not None else ""
        doc = (hit.get("document") or "").strip()
        lines.append(f"[S{i}] ({modality} · {fname}{loc_str})\n{doc}")
    return "\n\n".join(lines)


def build_user_prompt(question, fused_hits):
    from datetime import datetime
    context = build_context_block(fused_hits)
    has_context = bool(context.strip())
    if not has_context:
        context = "(no relevant documents retrieved for this question)"
    now_str = datetime.now().strftime("%A, %B %d, %Y, %H:%M")
    return (
        f"CURRENT DATE/TIME: {now_str}\n\n"
        f"CONTEXT (from the user's uploaded documents — may or may not be "
        f"relevant to this specific question):\n{context}\n\n"
        f"QUESTION: {question}\n\n"
        "If the context above is relevant to the question, use it and cite "
        "sources as [S#]. When extracting data, facts, comparisons, or structured metrics, format "
        "the information in a clean, comprehensive Markdown table with clear column headers. "
        "If the question is general knowledge, conversational, "
        "or about something the context doesn't cover, answer normally from "
        "your own knowledge instead — don't refuse or claim you lack "
        "information just because it isn't in the retrieved context."
    )
