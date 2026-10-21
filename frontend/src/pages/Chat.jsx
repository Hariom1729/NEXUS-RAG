import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, SendHorizonal, Trash2, Sparkles, Clock, Layers, Loader2, MessageSquareText, History,
    Bot, Search, FileText, Image as ImageIcon, Mic, Cpu, ArrowUpRight, Paperclip, PanelLeftClose, PanelLeftOpen,
    Download, FileCode, Check, Copy, Share2, Square, X, Maximize2, UploadCloud, FileSpreadsheet
} from "lucide-react";


import api, { API, getToken } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { ModalityIcon } from "@/components/ModalityIcon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Markdown } from "@/components/Markdown";
import { FileCard } from "@/components/FileCard";

function SourceCard({ src, index }) {
    const [open, setOpen] = useState(false);
    const [img, setImg] = useState(null);
    const docId = (src.id || "").split(":")[0];

    const toggle = async () => {
        setOpen((o) => !o);
        if (!open && src.modality === "image" && !img && docId) {
            try {
                const { data } = await api.get(`/documents/${docId}`);
                setImg(data.image_preview);
            } catch { /* ignore */ }
        }
    };

    const getScoreColor = (score) => {
        if (score >= 0.75) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
        if (score >= 0.5) return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="w-full rounded-2xl border border-[#1A1A24] bg-[#0E0E14] transition-all hover:border-indigo-500/40 shadow-xl"
            data-testid={`source-card-${index}`}
        >
            <button
                onClick={toggle}
                aria-expanded={open}
                aria-label={`${open ? "Collapse" : "Expand"} source ${index + 1}: ${src.filename}`}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-zinc-800 font-mono text-[10px] font-bold text-zinc-300">
                    S{index + 1}
                </span>
                <ModalityIcon modality={src.modality} size={16} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-zinc-200">{src.filename}</span>
                {src.page != null && (
                    <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                        p.{src.page}
                    </span>
                )}
                <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-extrabold ${getScoreColor(src.score)}`}>
                    {(src.score * 100).toFixed(0)}% match
                </span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-[#1A1A24] bg-[#08080C]"
                    >
                        <div className="p-4 space-y-3">
                            {img && (
                                <div className="relative overflow-hidden rounded-xl border border-[#1A1A24]">
                                    <img src={img} alt={src.filename} className="max-h-52 w-full object-cover" />
                                </div>
                            )}
                            <p className="font-mono text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap bg-[#12121A] p-3.5 rounded-xl border border-[#1A1A24]">
                                {src.snippet || "(no text preview available)"}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function LatencyBadge({ latency }) {
    if (!latency) return null;
    const items = [
        ["Embed", latency.embedding_ms],
        ["Retrieve", latency.retrieval_ms],
        ["Generate", latency.generation_ms],
        ["Total", latency.total_ms],
    ];
    return (
        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="latency-badge">
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1 font-bold">
                <Clock size={11} /> Performance:
            </span>
            {items.map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5 rounded-lg border border-[#1A1A24] bg-[#12121A] px-2.5 py-1 font-mono text-[10px] text-zinc-400">
                    <span className="text-zinc-500">{k}:</span>
                    <span className="font-bold text-indigo-300">{v ?? "—"}ms</span>
                </span>
            ))}
        </div>
    );
}

// Download/Export Helper Functions
function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function extractMarkdownTablesToCsv(text) {
    if (!text) return null;
    const lines = text.split("\n");
    const tableRows = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
            if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue; // skip |---|
            const cells = trimmed
                .slice(1, -1)
                .split("|")
                .map((c) => c.trim().replace(/"/g, '""'));
            tableRows.push(cells.map((c) => `"${c}"`).join(","));
        }
    }
    return tableRows.length > 0 ? tableRows.join("\n") : null;
}

function extractDataToCsv(text) {
    const tableCsv = extractMarkdownTablesToCsv(text);
    if (tableCsv) return tableCsv;

    // Structured lines fallback: lines with "Key: Value" or bullet points
    const lines = (text || "").split("\n");
    const rows = [["Category / Field", "Extracted Details"]];
    for (const l of lines) {
        const trimmed = l.trim();
        if (!trimmed) continue;
        if (trimmed.includes(":") && !trimmed.startsWith("http")) {
            const idx = trimmed.indexOf(":");
            const key = trimmed.slice(0, idx).replace(/^[-*#\d.]+\s*/, "").trim();
            const val = trimmed.slice(idx + 1).trim();
            if (key && val && key.length < 50) {
                rows.push([key, val]);
                continue;
            }
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
            const clean = trimmed.replace(/^[-*#\d.]+\s*/, "").trim();
            rows.push(["Item", clean]);
        }
    }
    if (rows.length > 1) {
        return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    const nonBlank = lines.filter((l) => l.trim().length > 0);
    return `"Extracted Line"\n` + nonBlank.map((l) => `"${l.replace(/"/g, '""')}"`).join("\n");
}

function exportMessageAsFile(msg, format) {
    const text = msg.content || "";
    const citations = (msg.sources || []).map((s, idx) => `[S${idx + 1}] ${s.filename} (${(s.score * 100).toFixed(0)}% match)`).join("\n");
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
        const csvContent = extractDataToCsv(text);
        downloadFile("\uFEFF" + csvContent, `nexus_extracted_data_${dateStr}.csv`, "text/csv;charset=utf-8");
        toast.success("Downloaded extracted data as CSV spreadsheet");
    } else if (format === "txt") {
        const body = `NEXUS-RAG AI RESPONSE\nDate: ${dateStr}\n\n${text}\n\nSOURCES & CITATIONS:\n${citations || "None"}`;
        downloadFile(body, `nexus_response_${dateStr}.txt`, "text/plain");
        toast.success("Downloaded response as TXT file");
    } else if (format === "md") {
        const body = `# NEXUS-RAG AI Response\n*Generated on: ${dateStr}*\n\n${text}\n\n### Grounded Sources\n${citations || "None"}`;
        downloadFile(body, `nexus_response_${dateStr}.md`, "text/markdown");
        toast.success("Downloaded response as Markdown file");
    } else if (format === "pdf" || format === "doc") {
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            toast.error("Please allow popups to export document");
            return;
        }
        printWindow.document.write(`
            <html>
            <head>
                <title>NEXUS-RAG Grounded Response Report</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
                    h1 { font-size: 22px; color: #4F46E5; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 6px; }
                    .meta { font-size: 11px; color: #6B7280; margin-bottom: 24px; font-family: monospace; }
                    .content { font-size: 13px; line-height: 1.6; margin-bottom: 28px; white-space: pre-wrap; font-family: -apple-system, sans-serif; }
                    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
                    th { background: #4F46E5; color: #FFF; text-align: left; padding: 8px 12px; border: 1px solid #4338CA; font-weight: 600; text-transform: uppercase; font-size: 11px; }
                    td { padding: 8px 12px; border: 1px solid #E5E7EB; vertical-align: top; }
                    tr:nth-child(even) { background: #F9FAFB; }
                    .sources { background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; margin-top: 24px; }
                    .sources h3 { font-size: 12px; margin: 0 0 8px; color: #374151; font-weight: bold; text-transform: uppercase; }
                    .source-item { font-family: monospace; font-size: 11px; color: #4B5563; margin-bottom: 4px; }
                </style>
            </head>
            <body>
                <h1>NEXUS-RAG AI Grounded Answer</h1>
                <div class="meta">Exported on: ${dateStr} • Grounded Offline Retrieval • ChromaDB + Local Engine</div>
                <div class="content">${text}</div>
                <div class="sources">
                    <h3>Retrieved Sources & Citations</h3>
                    ${(msg.sources || []).map((s, idx) => `<div class="source-item">[S${idx + 1}] ${s.filename} - ${(s.score * 100).toFixed(0)}% match</div>`).join("") || "<div>No citations</div>"}
                </div>
                <script>window.onload = function() { window.print(); };</script>
            </body>
            </html>
        `);
        printWindow.document.close();
        toast.success("Opened document export print view");
    }
}

function copyResponseToClipboard(msg) {
    if (!msg?.content) return;
    navigator.clipboard.writeText(msg.content);
    toast.success("Copied AI response to clipboard!");
}

function shareResponse(msg) {
    if (!msg?.content) return;
    const shareText = `NEXUS-RAG AI Grounded Answer:\n\n${msg.content}\n\nRetrieved Grounded Offline Engine`;
    if (navigator.share) {
        navigator.share({ title: "NEXUS-RAG Answer", text: shareText }).catch(() => {});
    } else {
        navigator.clipboard.writeText(shareText);
        toast.success("Shared AI response copied to clipboard!");
    }
}

function shareFullThread(messages) {
    if (!messages || messages.length === 0) return;
    const fullText = messages.map(m => `[${m.role.toUpperCase()}]:\n${m.content}`).join("\n\n------------------------------\n\n");
    const shareText = `NEXUS-RAG Conversation Thread:\n\n${fullText}`;
    if (navigator.share) {
        navigator.share({ title: "NEXUS-RAG Full Chat Thread", text: shareText }).catch(() => {});
    } else {
        navigator.clipboard.writeText(shareText);
        toast.success("Full chat thread copied to clipboard!");
    }
}

function ConversationList({ conversations, convId, onOpen, onNew, onDelete }) {

    const [search, setSearch] = useState("");
    const filtered = conversations.filter(c => (c.title || "").toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col h-full bg-[#08080C]">
            <div className="p-3 border-b border-[#1A1A24] space-y-2.5">
                <Button
                    onClick={onNew}
                    data-testid="new-chat-button"
                    className="w-full justify-start gap-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-xs font-extrabold text-white shadow-lg shadow-indigo-500/20 hover:opacity-95 transition-all h-10"
                >
                    <Plus size={16} /> New Chat Studio
                </Button>
                <div className="relative">
                    <Search size={13} className="absolute left-3 top-2.5 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Filter chat history…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-8 rounded-lg border border-[#1A1A24] bg-[#12121A] pl-8 pr-2.5 font-mono text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
                <p className="px-2 pb-1.5 font-mono text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">History</p>
                {filtered.length === 0 && (
                    <p className="px-2 py-4 text-center font-mono text-xs text-zinc-500">No chats found.</p>
                )}
                {filtered.map((c) => (
                    <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpen(c.id)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(c.id); }
                        }}
                        data-testid={`conversation-${c.id}`}
                        className={`group flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-all ${
                            c.id === convId
                                ? "bg-indigo-500/20 text-white font-bold border-l-3 border-indigo-400"
                                : "text-zinc-400 hover:bg-[#12121A] hover:text-zinc-200"
                        }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <MessageSquareText size={14} className="shrink-0 text-indigo-400" />
                            <span className="truncate">{c.title}</span>
                        </div>
                        <button
                            onClick={(e) => onDelete(c.id, e)}
                            aria-label={`Delete conversation "${c.title}"`}
                            className="shrink-0 rounded-md p-1 opacity-0 transition-opacity hover:bg-rose-500/20 hover:text-rose-400 group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Chat() {
    const [conversations, setConversations] = useState([]);
    const [convId, setConvId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const abortRef = useRef(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true); // Desktop sidebar toggle
    const [listening, setListening] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);
    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const scrollRef = useRef(null);

    const loadConversations = async () => {
        try {
            const { data } = await api.get("/chat/conversations");
            setConversations(data.conversations);
        } catch { /* ignore */ }
    };

    useEffect(() => { loadConversations(); }, []);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const openConversation = async (id) => {
        setConvId(id);
        setHistoryOpen(false);
        try {
            const { data } = await api.get(`/chat/conversations/${id}/messages`);
            setMessages(data.messages);
        } catch { toast.error("Failed to load conversation"); }
    };

    const newChat = () => { setConvId(null); setMessages([]); setHistoryOpen(false); };

    const deleteConversation = async (id, e) => {
        e.stopPropagation();
        await api.delete(`/chat/conversations/${id}`);
        if (id === convId) newChat();
        loadConversations();
    };

    // 100% Reliable Web Speech API Voice Assistance
    const toggleListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Voice recognition is not supported in your web browser.");
            return;
        }
        if (listening) {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch { /* ignore */ }
            }
            setListening(false);
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            recognition.continuous = false; // Single phrase capture for 100% reliability
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;
            recognition.lang = "en-US";

            const baseInput = input;

            recognition.onstart = () => {
                setListening(true);
                toast.info("🎙️ Voice Assistant Active — Speak query now!");
            };

            recognition.onresult = (event) => {
                let currentSpeech = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    currentSpeech += event.results[i][0].transcript;
                }
                if (currentSpeech.trim()) {
                    const combined = baseInput ? `${baseInput} ${currentSpeech.trim()}` : currentSpeech.trim();
                    setInput(combined);
                }
            };

            recognition.onerror = (e) => {
                setListening(false);
                if (e.error !== "no-speech" && e.error !== "aborted") {
                    toast.error("Voice assistant note: " + e.error);
                }
            };

            recognition.onend = () => {
                setListening(false);
            };

            recognition.start();
        } catch (err) {
            setListening(false);
            toast.error("Could not start microphone: " + err.message);
        }
    };


    // ChatGPT & Antigravity style attachment manager
    const addFilesToAttachments = async (selectedFiles) => {
        const files = Array.from(selectedFiles || []);
        if (files.length === 0) return;

        const newItems = files.map((file) => {
            const isImg = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
            return {
                id: Math.random().toString(36).slice(2, 10),
                file,
                name: file.name,
                size: file.size,
                type: file.type,
                isImage: isImg,
                previewUrl: isImg ? URL.createObjectURL(file) : null,
                uploading: true,
                uploaded: false,
                error: null,
                docId: null,
            };
        });

        setAttachments((prev) => [...prev, ...newItems]);

        // Background ingest into knowledge base (ChromaDB + Vision Model)
        for (const item of newItems) {
            const fd = new FormData();
            fd.append("files", item.file);
            fd.append("collection", "default");

            try {
                const { data } = await api.post("/documents/upload", fd, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                const uploaded = data.uploaded || [];
                const doc = uploaded[0];
                if (doc && doc.id) {
                    setAttachments((prev) =>
                        prev.map((a) =>
                            a.id === item.id
                                ? { ...a, uploading: false, uploaded: true, docId: doc.id }
                                : a
                        )
                    );
                } else {
                    setAttachments((prev) =>
                        prev.map((a) =>
                            a.id === item.id
                                ? { ...a, uploading: false, error: doc?.error || "Upload failed" }
                                : a
                        )
                    );
                }
            } catch (err) {
                setAttachments((prev) =>
                    prev.map((a) =>
                        a.id === item.id
                            ? { ...a, uploading: false, error: err.response?.data?.detail || err.message }
                            : a
                    )
                );
            }
        }
    };

    const removeAttachment = (id) => {
        setAttachments((prev) => {
            const item = prev.find((a) => a.id === id);
            if (item && item.previewUrl) {
                try { URL.revokeObjectURL(item.previewUrl); } catch { /* ignore */ }
            }
            return prev.filter((a) => a.id !== id);
        });
    };

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const pastedFiles = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === "file") {
                const f = items[i].getAsFile();
                if (f) pastedFiles.push(f);
            }
        }
        if (pastedFiles.length > 0) {
            e.preventDefault();
            addFilesToAttachments(pastedFiles);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            addFilesToAttachments(e.dataTransfer.files);
        }
    };

    const parseLegacyAttachment = (content) => {
        if (!content) return null;
        const match = content.match(/\[Attached file:\s*([^\]]+)\]/i);
        return match ? match[1].trim() : null;
    };

    const cleanUserContent = (text) => {
        if (!text) return "";
        return text.replace(/\[Attached file:\s*[^\]]+\]/gi, "").trim();
    };

    const send = async () => {
        const question = input.trim();
        const hasAttachments = attachments.length > 0;
        if ((!question && !hasAttachments) || streaming) return;

        // If any attachment is actively uploading, give a quick notification
        if (attachments.some((a) => a.uploading)) {
            toast.info("Ingesting attachment in background... Ready in a moment.");
            return;
        }

        const currentAttachments = [...attachments];
        const effectiveQuestion = question || (hasAttachments ? `Analyze and explain this attached ${currentAttachments[0].name}.` : "");

        setInput("");
        setAttachments([]);
        setStreaming(true);

        const userMsg = {
            role: "user",
            content: effectiveQuestion,
            attachments: currentAttachments.map((a) => ({
                name: a.name,
                size: a.size,
                isImage: a.isImage,
                previewUrl: a.previewUrl,
                docId: a.docId,
            })),
        };
        const assistant = { role: "assistant", content: "", sources: [], latency: null };
        setMessages((m) => [...m, userMsg, assistant]);

        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const resp = await fetch(`${API}/chat/stream`, {
                method: "POST",
                signal: controller.signal,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
                body: JSON.stringify({
                    question: effectiveQuestion,
                    conversation_id: convId,
                    attachments: currentAttachments.map((a) => ({
                        name: a.name,
                        size: a.size,
                        doc_id: a.docId,
                        is_image: a.isImage,
                    })),
                }),
            });
            if (!resp.ok || !resp.body) throw new Error("Stream failed");
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let firstConv = convId;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop();
                for (const part of parts) {
                    if (!part.startsWith("data: ")) continue;
                    let obj;
                    try { obj = JSON.parse(part.slice(6)); } catch { continue; }
                    if (obj.type === "meta") {
                        firstConv = obj.conversation_id;
                        setConvId(obj.conversation_id);
                        setMessages((m) => {
                            const copy = [...m];
                            copy[copy.length - 1] = { ...copy[copy.length - 1], sources: obj.sources, latency: obj.latency };
                            return copy;
                        });
                    } else if (obj.type === "token") {
                        setMessages((m) => {
                            const copy = [...m];
                            copy[copy.length - 1] = {
                                ...copy[copy.length - 1],
                                content: copy[copy.length - 1].content + obj.content,
                            };
                            return copy;
                        });
                    } else if (obj.type === "file") {
                        const { type: _t, ...fileMeta } = obj;
                        setMessages((m) => {
                            const copy = [...m];
                            copy[copy.length - 1] = { ...copy[copy.length - 1], file: fileMeta };
                            return copy;
                        });
                    } else if (obj.type === "done") {
                        setMessages((m) => {
                            const copy = [...m];
                            const last = copy[copy.length - 1];
                            copy[copy.length - 1] = {
                                ...last,
                                // server sends the cleaned text (file directive stripped)
                                content: typeof obj.content === "string" ? obj.content : last.content,
                                latency: obj.latency, backend: obj.backend,
                            };
                            return copy;
                        });
                    } else if (obj.type === "error") {
                        toast.error(obj.message || "Generation error");
                    }
                }
            }
            if (!convId && firstConv) loadConversations();
        } catch (err) {
            if (err.name !== "AbortError") toast.error("Streaming failed: " + err.message);
        } finally {
            abortRef.current = null;
            setStreaming(false);
        }
    };

    const onKey = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    };

    const promptPresets = [
        {
            title: "Extract Data to Table (CSV)",
            desc: "Extract document entities, metrics & download CSV",
            query: "Extract all key data, entities, and metrics from the attached document into a structured Markdown table with columns so I can download it as CSV.",
            Icon: FileSpreadsheet,
            color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        },
        {
            title: "Summarize PDF Documents",
            desc: "Extract key findings & executive summaries",
            query: "Summarize key findings in PDF documents",
            Icon: FileText,
            color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
        },
        {
            title: "Compare Image Layouts",
            desc: "Analyze visual diagrams vs text chunks",
            query: "Compare visual image layout vs text chunks",
            Icon: ImageIcon,
            color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        },
        {
            title: "Inspect Match Scores",
            desc: "Verify grounded source match confidence",
            query: "Extract citations and confidence scores",
            Icon: Cpu,
            color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
        },
    ];

    return (
        <AppShell>
            <div className="relative flex h-full overflow-hidden bg-[#030306]">
                {/* Desktop Expandable/Collapsible History Sidebar */}
                <AnimatePresence initial={false}>
                    {showSidebar && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 256, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="hidden lg:flex shrink-0 flex-col border-r border-[#1A1A24] overflow-hidden"
                        >
                            <ConversationList
                                conversations={conversations}
                                convId={convId}
                                onOpen={openConversation}
                                onNew={newChat}
                                onDelete={deleteConversation}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Drawer Sheet */}
                <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                    <SheetContent side="left" className="flex w-72 flex-col border-[#1A1A24] bg-[#08080C] p-0 lg:hidden">
                        <SheetHeader className="border-b border-[#1A1A24] px-4 py-4">
                            <SheetTitle className="font-heading text-base text-white">Conversations</SheetTitle>
                        </SheetHeader>
                        <ConversationList
                            conversations={conversations}
                            convId={convId}
                            onOpen={openConversation}
                            onNew={newChat}
                            onDelete={deleteConversation}
                        />
                    </SheetContent>
                </Sheet>

                {/* Centered AI Studio Console */}
                <div
                    className="relative flex min-w-0 flex-1 flex-col justify-between overflow-hidden"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* ChatGPT / Antigravity Full Drag Overlay */}
                    <AnimatePresence>
                        {isDragging && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 pointer-events-none"
                            >
                                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-indigo-500/80 bg-indigo-950/30 p-10 text-center shadow-2xl space-y-3 max-w-md">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/50 animate-bounce">
                                        <UploadCloud size={32} />
                                    </div>
                                    <h3 className="font-heading text-lg font-bold text-white">Drop images or documents here</h3>
                                    <p className="text-xs text-zinc-400 font-mono">Qwen2.5-VL will visually inspect diagrams and index them into knowledge base</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Floating Controls Bar */}
                    <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none flex items-center justify-between">
                        {/* Left Floating Capsule: Toggle Sidebar Button */}
                        <div className="pointer-events-auto">
                            <button
                                onClick={() => setShowSidebar(!showSidebar)}
                                title={showSidebar ? "Collapse History Sidebar" : "Expand History Sidebar"}
                                className="hidden lg:flex items-center gap-2 rounded-2xl border border-[#1A1A24] bg-[#0E0E14]/80 backdrop-blur-xl px-3.5 py-2 font-mono text-xs font-bold text-zinc-300 shadow-2xl hover:border-indigo-500/50 hover:bg-[#12121A] hover:text-white transition-all group"
                            >
                                {showSidebar ? (
                                    <PanelLeftClose size={15} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                                ) : (
                                    <PanelLeftOpen size={15} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                                )}
                                <span>{showSidebar ? "Hide History" : "Show History"}</span>
                            </button>

                            <button
                                onClick={() => setHistoryOpen(true)}
                                data-testid="mobile-history-button"
                                aria-label="Open conversation history"
                                className="flex lg:hidden items-center gap-2 rounded-2xl border border-[#1A1A24] bg-[#0E0E14]/80 backdrop-blur-xl px-3.5 py-2 text-xs font-bold text-zinc-300 shadow-xl hover:bg-[#12121A]"
                            >
                                <History size={15} className="text-indigo-400" /> History
                            </button>
                        </div>

                        {/* Right Floating Capsule: New Chat + Share Chat + Full Thread Export */}
                        <div className="pointer-events-auto flex items-center gap-2">
                            {messages.length > 0 && (
                                <>
                                    <button
                                        onClick={() => shareFullThread(messages)}
                                        title="Share full conversation history"
                                        className="flex items-center gap-1.5 rounded-2xl border border-[#1A1A24] bg-[#0E0E14]/80 backdrop-blur-xl px-3 py-2 font-mono text-xs font-bold text-zinc-300 hover:text-white hover:border-indigo-500/50 transition-all shadow-xl"
                                    >
                                        <Share2 size={14} className="text-indigo-400" />
                                        <span>Share Chat</span>
                                    </button>

                                    <button
                                        onClick={() => exportMessageAsFile({ content: messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n") }, "pdf")}
                                        title="Export full conversation thread as document"
                                        className="flex items-center gap-1.5 rounded-2xl border border-[#1A1A24] bg-[#0E0E14]/80 backdrop-blur-xl px-3 py-2 font-mono text-xs font-bold text-zinc-300 hover:text-white hover:border-indigo-500/50 transition-all shadow-xl"
                                    >
                                        <Download size={14} className="text-indigo-400" />
                                        <span>Export Thread</span>
                                    </button>
                                </>
                            )}

                            <button
                                onClick={newChat}
                                data-testid="new-chat-button-top"
                                aria-label="Start new chat"
                                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-2 text-xs font-extrabold text-white shadow-xl shadow-indigo-500/25 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <Plus size={15} strokeWidth={2.5} />
                                <span>New Chat</span>
                            </button>
                        </div>
                    </div>

                    {/* Messages Container */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto pt-14">
                        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-6">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 hero-glow-halo relative z-10">
                                    {/* Refined Glowing Badge */}
                                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 font-mono text-[11px] font-extrabold text-indigo-300 shadow-xl shadow-indigo-500/10">
                                        <Sparkles size={14} className="animate-pulse text-indigo-400" />
                                        <span>NEXUS Multi-Modal Engine</span>
                                    </div>

                                    {/* Elegant Headline & Subtitle */}
                                    <div className="space-y-2 max-w-xl">
                                        <h2 className="font-heading text-4xl font-black tracking-tight text-white">
                                            Ask your knowledge base
                                        </h2>
                                        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-lg mx-auto">
                                            Grounded offline retrieval across your ingested documents, images, and audio recordings.
                                        </p>
                                    </div>

                                    {/* Ultra-Clean Sleek Preset Action Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full pt-4">
                                        {promptPresets.map((preset, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setInput(preset.query)}
                                                className="group flex items-center justify-between rounded-2xl border border-[#1A1A24] bg-[#0E0E14]/80 p-3.5 text-left transition-all hover:border-indigo-500/40 hover:bg-[#12121A] shadow-xl hover:-translate-y-0.5"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl border ${preset.color}`}>
                                                        <preset.Icon size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                                                            {preset.title}
                                                        </p>
                                                        <p className="text-[11px] text-zinc-400 truncate max-w-[210px]">
                                                            {preset.desc}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ArrowUpRight size={16} className="text-zinc-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-2" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {messages.map((m, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                                        >
                                            {m.role === "user" ? (
                                                <div className="flex flex-col items-end gap-2 max-w-[85%] sm:max-w-[75%] ml-auto">
                                                    {/* Attachments Shelf in Message Bubble */}
                                                    {m.attachments && m.attachments.length > 0 ? (
                                                        <div className="flex flex-wrap justify-end gap-2.5">
                                                            {m.attachments.map((att, attIdx) => {
                                                                const isImg = att.isImage || att.is_image || att.modality === "image" || (att.name && /\.(png|jpe?g|webp|gif|bmp)$/i.test(att.name));
                                                                const imgUrl = att.previewUrl || (att.docId || att.doc_id ? `${API}/documents/${att.docId || att.doc_id}` : null);
                                                                return (
                                                                    <div key={attIdx} className="group relative">
                                                                        {isImg && (att.previewUrl || att.docId || att.doc_id) ? (
                                                                            <div
                                                                                onClick={() => setLightboxImage(att.previewUrl || imgUrl)}
                                                                                className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/60 shadow-xl cursor-pointer hover:border-indigo-400/80 transition-all hover:scale-[1.01]"
                                                                                title="Click to view full image"
                                                                            >
                                                                                <img
                                                                                    src={att.previewUrl || imgUrl}
                                                                                    alt={att.name || "uploaded"}
                                                                                    className="max-h-60 max-w-xs sm:max-w-sm rounded-2xl object-cover"
                                                                                    onError={(e) => {
                                                                                        e.target.style.display = "none";
                                                                                    }}
                                                                                />
                                                                                <div className="absolute inset-0 flex items-end justify-between p-2.5 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    <span className="truncate text-[11px] font-mono text-zinc-200 max-w-[180px]">{att.name}</span>
                                                                                    <span className="flex items-center gap-1 text-[10px] bg-indigo-600/90 text-white px-2 py-0.5 rounded-md font-mono shadow-md">
                                                                                        <Maximize2 size={10} /> Expand
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-[#12121C] px-3.5 py-2.5 text-xs shadow-xl">
                                                                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                                                                    {isImg ? <ImageIcon size={16} /> : <FileText size={16} />}
                                                                                </div>
                                                                                <div className="flex flex-col text-left">
                                                                                    <span className="font-semibold text-white truncate max-w-[180px]">{att.name}</span>
                                                                                    <span className="text-[10px] text-zinc-400 font-mono">
                                                                                        {att.size ? `${(att.size / 1024).toFixed(0)} KB` : (isImg ? "Image" : "Document")}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : parseLegacyAttachment(m.content) ? (
                                                        <div className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-[#12121C] px-3.5 py-2.5 text-xs shadow-xl">
                                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                                                <FileText size={16} />
                                                            </div>
                                                            <div className="flex flex-col text-left">
                                                                <span className="font-semibold text-white truncate max-w-[180px]">{parseLegacyAttachment(m.content)}</span>
                                                                <span className="text-[10px] text-indigo-400 font-mono">Attached Document</span>
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    {/* User Prompt Text */}
                                                    {cleanUserContent(m.content) && (
                                                        <div
                                                            className="rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-3 text-xs sm:text-sm text-white shadow-xl font-semibold leading-relaxed"
                                                            data-testid="user-message"
                                                        >
                                                            {cleanUserContent(m.content)}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-full space-y-3.5" data-testid="assistant-message">
                                                    {/* AI Response Card with Integrated Response Export Buttons */}
                                                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 text-xs sm:text-sm leading-relaxed text-zinc-200 shadow-xl space-y-3">
                                                        <div className="flex items-center justify-between border-b border-[#1A1A24]/80 pb-3">
                                                            <div className="flex items-center gap-2">
                                                                <Bot size={18} className="text-indigo-400" />
                                                                <span className="font-mono text-xs font-bold text-white">NEXUS AI Answer</span>
                                                            </div>

                                                            {/* Response Format Export Options */}
                                                            <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                                                <button
                                                                    onClick={() => exportMessageAsFile(m, "csv")}
                                                                    className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-300 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors font-bold"
                                                                    title="Export extracted data / tables as CSV spreadsheet"
                                                                >
                                                                    <FileSpreadsheet size={11} className="text-emerald-400" /> CSV
                                                                </button>
                                                                <button
                                                                    onClick={() => exportMessageAsFile(m, "pdf")}
                                                                    className="flex items-center gap-1 rounded-lg border border-[#1A1A24] bg-[#12121A] px-2 py-1 text-zinc-300 hover:text-white hover:border-indigo-500/40 transition-colors"
                                                                    title="Export response as PDF document"
                                                                >
                                                                    <Download size={11} className="text-indigo-400" /> PDF
                                                                </button>
                                                                <button
                                                                    onClick={() => exportMessageAsFile(m, "txt")}
                                                                    className="flex items-center gap-1 rounded-lg border border-[#1A1A24] bg-[#12121A] px-2 py-1 text-zinc-300 hover:text-white hover:border-indigo-500/40 transition-colors"
                                                                    title="Export response as TXT file"
                                                                >
                                                                    <FileText size={11} className="text-indigo-400" /> TXT
                                                                </button>
                                                                <button
                                                                    onClick={() => exportMessageAsFile(m, "md")}
                                                                    className="flex items-center gap-1 rounded-lg border border-[#1A1A24] bg-[#12121A] px-2 py-1 text-zinc-300 hover:text-white hover:border-indigo-500/40 transition-colors"
                                                                    title="Export response as Markdown file"
                                                                >
                                                                    <FileCode size={11} className="text-indigo-400" /> MD
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            {m.content ? <Markdown>{m.content}</Markdown> : (streaming && i === messages.length - 1 ? (
                                                                <span className="flex items-center gap-2 font-mono text-xs text-indigo-400">
                                                                    <Loader2 className="animate-spin" size={14} /> Generating grounded response…
                                                                </span>
                                                            ) : "")}
                                                            {streaming && i === messages.length - 1 && m.content && <span className="stream-caret" />}
                                                        </div>
                                                        {m.file && <FileCard file={m.file} />}
                                                        {/* Clean minimal Source Badge Pill Footer */}
                                                        {m.sources?.length > 0 && (
                                                            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10px] text-zinc-400">
                                                                <span className="text-indigo-400 font-bold flex items-center gap-1">
                                                                    <Layers size={11} /> Cited Sources ({m.sources.length}):
                                                                </span>
                                                                {m.sources.map((s, idx) => (
                                                                    <span key={s.id + idx} className="rounded-md border border-[#1A1A24] bg-[#121218] px-2 py-0.5 text-zinc-300">
                                                                        {s.filename} {s.page ? `(p.${s.page})` : ""}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {m.latency && <LatencyBadge latency={m.latency} />}

                                                        {/* End of Response Options: Copy Response & Share Response Footer */}
                                                        {m.content && (
                                                            <div className="flex flex-wrap items-center justify-between border-t border-[#1A1A24]/80 pt-3 mt-2 font-mono text-xs gap-2">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <button
                                                                        onClick={() => exportMessageAsFile(m, "csv")}
                                                                        className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300 hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/20 transition-all shadow-md font-semibold"
                                                                        title="Export extracted tables / structured data to CSV spreadsheet"
                                                                    >
                                                                        <FileSpreadsheet size={13} className="text-emerald-400" />
                                                                        <span>Export CSV</span>
                                                                    </button>

                                                                    <button
                                                                        onClick={() => copyResponseToClipboard(m)}
                                                                        className="flex items-center gap-1.5 rounded-xl border border-[#1A1A24] bg-[#12121A] px-3 py-1.5 text-zinc-300 hover:text-white hover:border-indigo-500/40 hover:bg-[#1A1A24] transition-all shadow-md"
                                                                        title="Copy entire AI response text to clipboard"
                                                                    >
                                                                        <Copy size={13} className="text-indigo-400" />
                                                                        <span>Copy Response</span>
                                                                    </button>

                                                                    <button
                                                                        onClick={() => shareResponse(m)}
                                                                        className="flex items-center gap-1.5 rounded-xl border border-[#1A1A24] bg-[#12121A] px-3 py-1.5 text-zinc-300 hover:text-white hover:border-indigo-500/40 hover:bg-[#1A1A24] transition-all shadow-md"
                                                                        title="Share AI response snippet"
                                                                    >
                                                                        <Share2 size={13} className="text-indigo-400" />
                                                                        <span>Share Response</span>
                                                                    </button>
                                                                </div>

                                                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                                                                    <span className="hidden sm:inline">Download:</span>
                                                                    <button
                                                                        onClick={() => exportMessageAsFile(m, "csv")}
                                                                        className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300 hover:text-white hover:border-emerald-500/50 transition-colors font-bold"
                                                                        title="Download extracted data as CSV"
                                                                    >
                                                                        <FileSpreadsheet size={10} className="text-emerald-400" /> CSV
                                                                    </button>
                                                                    <button
                                                                        onClick={() => exportMessageAsFile(m, "pdf")}
                                                                        className="flex items-center gap-1 rounded-lg border border-[#1A1A24] bg-[#12121A] px-2 py-0.5 text-zinc-300 hover:text-white hover:border-indigo-500/40 transition-colors"
                                                                        title="Download as PDF"
                                                                    >
                                                                        <Download size={10} className="text-indigo-400" /> PDF
                                                                    </button>
                                                                    <button
                                                                        onClick={() => exportMessageAsFile(m, "txt")}
                                                                        className="flex items-center gap-1 rounded-lg border border-[#1A1A24] bg-[#12121A] px-2 py-0.5 text-zinc-300 hover:text-white hover:border-indigo-500/40 transition-colors"
                                                                        title="Download as TXT"
                                                                    >
                                                                        <FileText size={10} className="text-indigo-400" /> TXT
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Floating Compact Prompt Console — ChatGPT / Antigravity Style */}
                    <div className="px-4 sm:px-6 pb-6 pt-2 bg-transparent z-20">
                        <div className="mx-auto flex flex-col w-full max-w-3xl rounded-2xl border border-[#1A1A24] bg-[#0A0A0F]/95 backdrop-blur-2xl p-2.5 focus-within:border-indigo-500/60 shadow-2xl transition-all glow-animated-border">
                            {/* Hidden File Input for Search Bar Attachment Button */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={(e) => {
                                    addFilesToAttachments(e.target?.files);
                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                                className="hidden"
                                accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp,.gif,.bmp,.wav,.mp3"
                            />

                            {/* ChatGPT / Antigravity Style Attachment Preview Shelf */}
                            <AnimatePresence>
                                {attachments.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: 6 }}
                                        animate={{ opacity: 1, height: "auto", y: 0 }}
                                        exit={{ opacity: 0, height: 0, y: 6 }}
                                        className="flex flex-wrap items-center gap-2.5 pb-2.5 mb-2 border-b border-white/5 overflow-x-auto"
                                    >
                                        {attachments.map((att) => (
                                            <div
                                                key={att.id}
                                                className="group relative flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#14141F]/90 p-1.5 pr-3 text-xs text-zinc-200 shadow-md backdrop-blur-md transition-all hover:border-indigo-500/40"
                                            >
                                                {att.isImage && att.previewUrl ? (
                                                    <div
                                                        onClick={() => setLightboxImage(att.previewUrl)}
                                                        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40 cursor-pointer"
                                                        title="Click to zoom preview"
                                                    >
                                                        <img
                                                            src={att.previewUrl}
                                                            alt={att.name}
                                                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                        />
                                                        {att.uploading && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                                                                <Loader2 className="animate-spin text-indigo-400" size={14} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-indigo-500/10 text-indigo-400">
                                                        <FileText size={18} />
                                                    </div>
                                                )}

                                                <div className="flex flex-col min-w-0 max-w-[140px] sm:max-w-[180px]">
                                                    <span className="truncate font-medium text-white text-[11px] sm:text-xs">
                                                        {att.name}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                                        <span>{(att.size / 1024).toFixed(0)} KB</span>
                                                        {att.uploading ? (
                                                            <span className="text-indigo-400 font-mono flex items-center gap-1 animate-pulse">
                                                                <Loader2 size={10} className="animate-spin" /> Ingesting…
                                                            </span>
                                                        ) : att.uploaded ? (
                                                            <span className="flex items-center gap-0.5 text-emerald-400 font-mono">
                                                                <Check size={11} strokeWidth={2.5} /> Ready
                                                            </span>
                                                        ) : att.error ? (
                                                            <span className="text-rose-400 font-mono truncate max-w-[90px]">Failed</span>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                {/* Remove attachment button (like ChatGPT) */}
                                                <button
                                                    type="button"
                                                    onClick={() => removeAttachment(att.id)}
                                                    title="Remove attachment"
                                                    className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 border border-white/20 hover:bg-rose-500 hover:text-white transition-all shadow-md group-hover:scale-110"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Action Row: Paperclip + Mic + Textarea + Send */}
                            <div className="flex items-center gap-2 w-full">
                                {/* Quick File Attachment Icon Button */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Attach document or image"
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1A1A24] bg-[#12121A] text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-[#1A1A24] transition-all disabled:opacity-40"
                                >
                                    <Paperclip size={16} />
                                </button>

                                {/* Mic Assistance Voice Button */}
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    title={listening ? "Voice Assistant Listening... Speak query" : "Voice Query Assistance"}
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${
                                        listening
                                            ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse shadow-lg shadow-rose-500/20"
                                            : "border-[#1A1A24] bg-[#12121A] text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-[#1A1A24]"
                                    }`}
                                >
                                    <Mic size={16} />
                                </button>

                                {/* Text Input Console */}
                                <Textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={onKey}
                                    onPaste={handlePaste}
                                    data-testid="chat-input"
                                    aria-label="Ask a question about your documents"
                                    rows={1}
                                    placeholder={
                                        attachments.length > 0
                                            ? "Ask something about the attached file(s) or hit enter…"
                                            : "Ask any question across your ingested files or attach a document…"
                                    }
                                    className="max-h-28 min-h-[38px] flex-1 resize-none border-0 bg-transparent text-xs sm:text-sm text-white placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 py-2"
                                />

                                {/* Send Button */}
                                <Button
                                    onClick={streaming ? () => abortRef.current?.abort() : send}
                                    disabled={!streaming && !input.trim() && attachments.length === 0}
                                    data-testid="send-button"
                                    aria-label={streaming ? "Stop generating" : "Send message"}
                                    className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white hover:opacity-95 disabled:opacity-40 transition-all shadow-lg shadow-indigo-500/20 p-0 flex items-center justify-center"
                                >
                                    {streaming ? <Square size={14} fill="currentColor" /> : <SendHorizonal size={16} />}
                                </Button>
                            </div>
                        </div>
                        <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-between font-mono text-[10px] text-zinc-500/80 px-2">
                            <span>Grounded offline generation • Enter to send • Drag & drop or paste files</span>
                            <span className="hidden sm:inline text-indigo-400/90 font-bold">ChromaDB + Qwen2.5-VL</span>
                        </div>
                    </div>
                </div>

                {/* Full-Screen Lightbox Modal for Images (ChatGPT/Antigravity Style) */}
                <AnimatePresence>
                    {lightboxImage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 sm:p-8 cursor-pointer"
                            onClick={() => setLightboxImage(null)}
                        >
                            <button
                                onClick={() => setLightboxImage(null)}
                                className="absolute top-5 right-5 sm:top-6 sm:right-6 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/90 text-white border border-white/20 hover:bg-rose-600 transition-colors shadow-2xl z-20 cursor-pointer"
                                title="Close preview"
                            >
                                <X size={20} />
                            </button>
                            <motion.div
                                initial={{ scale: 0.95 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.95 }}
                                className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-white/20 shadow-2xl bg-black/80"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <img
                                    src={lightboxImage}
                                    alt="Enlarged view"
                                    className="max-h-[85vh] max-w-[85vw] object-contain rounded-2xl"
                                />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AppShell>
    );
}
