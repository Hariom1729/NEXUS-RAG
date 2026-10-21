import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileUp, X, CheckCircle2, XCircle, Loader2, FolderPlus, ArrowRight, Layers, FileText, Image as ImageIcon, Mic, Sparkles, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { ModalityIcon } from "@/components/ModalityIcon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STEPS = ["queued", "parsing", "embedding", "indexed"];

function StatusSteps({ status, error }) {
    if (status === "failed") {
        return (
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/30" data-testid="status-failed">
                <XCircle size={14} /> Failed{error ? ` · ${error}` : ""}
            </div>
        );
    }
    const activeIdx = STEPS.indexOf(status);
    return (
        <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
                const done = i < activeIdx || status === "indexed";
                const active = i === activeIdx && status !== "indexed";
                return (
                    <div key={s} className="flex items-center gap-2">
                        <span
                            className={`flex items-center gap-1.5 font-mono text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                                done
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                    : active
                                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse"
                                    : "bg-zinc-800/60 text-zinc-500"
                            }`}
                        >
                            {active && <Loader2 size={11} className="animate-spin" />}
                            {done && s === "indexed" && <CheckCircle2 size={11} />}
                            {s}
                        </span>
                        {i < STEPS.length - 1 && (
                            <span className={`h-0.5 w-3 rounded-full ${done ? "bg-emerald-500" : "bg-zinc-800"}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function Ingest() {
    const [collection, setCollection] = useState("default");
    const [docs, setDocs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const timerRef = useRef(null);

    const fetchDocuments = useCallback(async () => {
        try {
            const { data } = await api.get("/documents");
            const fetchedDocs = data.documents || [];
            setDocs(fetchedDocs);
            return fetchedDocs;
        } catch {
            return [];
        }
    }, []);

    // Active polling mechanism
    useEffect(() => {
        let isMounted = true;
        const checkAndPoll = async () => {
            const currentDocs = await fetchDocuments();
            if (!isMounted) return;
            const hasPending = currentDocs.some(
                (d) => !["indexed", "failed"].includes(d.status)
            );
            if (hasPending) {
                timerRef.current = setTimeout(checkAndPoll, 1000);
            }
        };

        checkAndPoll();

        return () => {
            isMounted = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [fetchDocuments]);

    const manualRefresh = async () => {
        setRefreshing(true);
        await fetchDocuments();
        setRefreshing(false);
        toast.info("Document list updated");
    };

    const onDrop = useCallback(async (accepted) => {
        if (!accepted || !accepted.length) return;
        setUploading(true);
        const fd = new FormData();
        accepted.forEach((f) => fd.append("files", f));
        fd.append("collection", collection || "default");
        try {
            const { data } = await api.post("/documents/upload", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const uploaded = data.uploaded || [];
            const ids = uploaded.filter((u) => u.id).map((u) => u.id);
            const failed = uploaded.filter((u) => !u.id);

            failed.forEach((f) => toast.error(`${f.filename}: ${f.error || "Upload failed"}`));
            if (ids.length) {
                toast.success(`${ids.length} file(s) uploaded! Indexing in background…`);
            }
            await fetchDocuments();
            // Trigger aggressive polling after drop
            if (timerRef.current) clearTimeout(timerRef.current);
            const pollAgain = async () => {
                const updated = await fetchDocuments();
                if (updated.some((d) => !["indexed", "failed"].includes(d.status))) {
                    timerRef.current = setTimeout(pollAgain, 1000);
                }
            };
            timerRef.current = setTimeout(pollAgain, 1000);
        } catch (e) {
            toast.error("Upload failed: " + (e.response?.data?.detail || e.message));
        } finally {
            setUploading(false);
        }
    }, [collection, fetchDocuments]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "text/plain": [".txt"],
            "application/pdf": [".pdf"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
            "image/*": [".png", ".jpg", ".jpeg", ".webp"],
            "audio/*": [".wav", ".mp3", ".m4a"],
        },
    });

    const processing = docs.filter((d) => !["indexed", "failed"].includes(d.status));
    const recent = docs.slice(0, 12);
    const collectionPresets = ["default", "research_papers", "contracts", "technical_docs"];

    return (
        <AppShell>
            <div className="mx-auto max-w-5xl px-4 sm:px-8 py-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 font-mono text-[10px] font-extrabold text-indigo-400">
                            <UploadCloud size={13} /> Multi-Modal Ingestion Portal
                        </div>
                        <h1 className="font-heading text-3xl font-black tracking-tight text-white">Ingest Media & Documents</h1>
                        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
                            Upload PDF, DOCX, TXT, PNG, JPG, or WAV files. The engine automatically routes text, image layouts (CLIP), and audio transcripts (Whisper) into ChromaDB collections.
                        </p>
                    </div>

                    <Button onClick={manualRefresh} disabled={refreshing} variant="outline" className="h-9 gap-2 rounded-xl border-[#1A1A24] bg-[#0E0E14] font-mono text-xs text-zinc-300 hover:bg-[#12121A]">
                        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh List
                    </Button>
                </div>

                {/* Ingestion Architecture Flow Diagram */}
                <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-4 shadow-xl space-y-3">
                    <p className="flex items-center justify-between font-mono text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                        <span className="flex items-center gap-1.5"><Layers size={14} /> Multi-Modal Ingestion Pipeline Architecture</span>
                        <span className="text-zinc-500 font-bold">Automatic Modality Router</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 font-mono text-xs">
                        {[
                            { name: "File Input", sub: "PDF / DOCX / TXT / Img", Icon: FileText, color: "border-indigo-500/40 text-indigo-300" },
                            { name: "Multimodal Extractor", sub: "PyPDF & Whisper", Icon: Sparkles, color: "border-purple-500/40 text-purple-300" },
                            { name: "Dual Vectorizer", sub: "MiniLM & CLIP", Icon: Layers, color: "border-pink-500/40 text-pink-300" },
                            { name: "ChromaDB Store", sub: "HNSW Vector Index", Icon: CheckCircle2, color: "border-emerald-500/40 text-emerald-300" },
                        ].map((node, i) => (
                            <div key={i} className={`flex items-center gap-3 rounded-xl border ${node.color} bg-[#12121A] p-3 shadow-md`}>
                                <node.Icon size={18} />
                                <div>
                                    <p className="font-bold text-white text-xs">{node.name}</p>
                                    <p className="text-[10px] text-zinc-400">{node.sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Collection Input & Presets Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 rounded-2xl border border-[#1A1A24] bg-[#0E0E14] px-4 py-2.5 shadow-xl">
                        <FolderPlus size={18} className="text-indigo-400" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Target Collection:</span>
                        <Input
                            value={collection}
                            onChange={(e) => setCollection(e.target.value)}
                            data-testid="collection-input"
                            className="h-8 w-48 border-0 bg-transparent px-1 font-mono text-xs font-bold text-white focus-visible:ring-0"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                        <span className="text-zinc-500 text-[10px] font-bold uppercase mr-1">Presets:</span>
                        {collectionPresets.map((preset) => (
                            <button
                                key={preset}
                                onClick={() => setCollection(preset)}
                                className={`rounded-xl px-3 py-1 text-[11px] font-bold transition-all ${
                                    collection === preset
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : "bg-[#0E0E14] text-zinc-400 hover:text-white border border-[#1A1A24]"
                                }`}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Holographic Target Portal Dropzone */}
                <div
                    {...getRootProps()}
                    data-testid="dropzone"
                    className={`relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 sm:p-16 text-center transition-all ${
                        isDragActive
                            ? "border-indigo-400 bg-indigo-500/10 scale-[1.01]"
                            : "border-[#1A1A24] bg-[#0E0E14] hover:border-indigo-500/50 hover:bg-[#12121A]"
                    } shadow-2xl portal-pulse`}
                >
                    <input {...getInputProps()} data-testid="file-input" />
                    <motion.div
                        animate={{ y: isDragActive ? -6 : 0 }}
                        className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/40 text-indigo-300 shadow-2xl shadow-indigo-500/30"
                    >
                        {uploading ? <Loader2 className="animate-spin text-indigo-400" size={34} /> : <UploadCloud size={34} />}
                    </motion.div>
                    <h3 className="font-heading text-2xl font-extrabold tracking-tight text-white">
                        {isDragActive ? "Drop files to ingest immediately" : "Drag & drop files here to ingest"}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-zinc-400 max-w-sm">
                        or click to browse local disk — multi-file batch uploads supported
                    </p>
                    {/* File Format Badges */}
                    <div className="mt-6 flex flex-wrap justify-center gap-2 font-mono text-xs">
                        <span className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1 font-bold text-rose-300">.pdf (Text RAG)</span>
                        <span className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 font-bold text-indigo-300">.docx / .txt (Doc RAG)</span>
                        <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-bold text-amber-300">.png / .jpg (CLIP Vision)</span>
                        <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-bold text-emerald-300">.wav / .mp3 (Whisper Audio)</span>
                    </div>
                </div>

                {/* Processing Pipelines */}
                {processing.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-indigo-400">
                            <FileUp size={16} /> Active Ingestion Pipelines ({processing.length})
                        </div>
                        <div className="space-y-3">
                            {processing.map((d) => (
                                <motion.div
                                    key={d.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex flex-col gap-3 rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-4 sm:flex-row sm:items-center sm:justify-between shadow-xl"
                                    data-testid={`processing-${d.id}`}
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <ModalityIcon modality={d.modality} size={18} />
                                        <span className="truncate font-mono text-xs font-bold text-white">{d.filename}</span>
                                    </div>
                                    <StatusSteps status={d.status} error={d.error} />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recently Ingested Grid */}
                <div className="space-y-3 pt-2">
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400">Recently Ingested Documents</p>
                    {recent.length === 0 ? (
                        <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14]/60 p-8 text-center">
                            <p className="font-mono text-xs text-zinc-500">No documents ingested in this workspace yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {recent.map((d) => (
                                <div key={d.id} className="flex items-center justify-between rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-4 shadow-xl hover:border-zinc-700 transition-colors">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <ModalityIcon modality={d.modality} size={18} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-mono text-xs font-bold text-white">{d.filename}</p>
                                            <p className="font-mono text-[10px] text-zinc-500">{d.collection || "default"}</p>
                                        </div>
                                    </div>
                                    {d.status === "indexed" ? (
                                        <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/30">
                                            <CheckCircle2 size={13} /> {d.chunk_count} chunks
                                        </span>
                                    ) : d.status === "failed" ? (
                                        <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/30">
                                            <X size={13} /> Failed
                                        </span>
                                    ) : (
                                        <span className="font-mono text-xs text-indigo-400 animate-pulse">{d.status}…</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
