import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScanEye, Search, Database, Layers, RefreshCw, FileText, Image as ImageIcon, Mic, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { ModalityIcon } from "@/components/ModalityIcon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Inspector() {
    const [docs, setDocs] = useState([]);
    const [search, setSearch] = useState("");
    const [modalityFilter, setModalityFilter] = useState("all");
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/documents");
            setDocs(data.documents);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const filtered = docs.filter((d) => {
        const matchesSearch = (d.filename || "").toLowerCase().includes(search.toLowerCase());
        const matchesModality = modalityFilter === "all" || d.modality === modalityFilter;
        return matchesSearch && matchesModality;
    });

    const totalChunks = docs.reduce((acc, d) => acc + (d.chunk_count || 0), 0);
    const textDocsCount = docs.filter(d => d.modality === "document").length;
    const imageDocsCount = docs.filter(d => d.modality === "image").length;
    const audioDocsCount = docs.filter(d => d.modality === "audio").length;

    return (
        <AppShell>
            <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 font-mono text-[10px] font-extrabold text-indigo-400">
                            <ScanEye size={13} /> Deep Vector Chunk & Metadata Inspector
                        </div>
                        <h1 className="font-heading text-3xl font-black tracking-tight text-white">Vector Inspector</h1>
                        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
                            Inspect raw document chunks, cosine distance scores, metadata attributes, and collection indexes in ChromaDB.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Button onClick={load} disabled={loading} variant="outline" className="h-9 gap-2 rounded-xl border-[#1A1A24] bg-[#0E0E14] font-mono text-xs text-zinc-300 hover:bg-[#12121A]">
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Index
                        </Button>
                    </div>
                </div>

                {/* Corpus Stats Bar */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-4 shadow-xl space-y-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">Total Index Chunks</span>
                        <p className="text-2xl font-black text-indigo-400">{totalChunks}</p>
                    </div>
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-4 shadow-xl space-y-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">Text Files</span>
                        <p className="text-2xl font-black text-purple-400">{textDocsCount}</p>
                    </div>
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-4 shadow-xl space-y-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">Visual Files</span>
                        <p className="text-2xl font-black text-amber-400">{imageDocsCount}</p>
                    </div>
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-4 shadow-xl space-y-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">Audio Files</span>
                        <p className="text-2xl font-black text-emerald-400">{audioDocsCount}</p>
                    </div>
                </div>

                {/* Search & Modality Filter Ribbon */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-3 shadow-xl">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3.5 top-3 text-zinc-500" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter document chunks by filename or collection…"
                            className="h-10 border-0 bg-transparent pl-9 font-mono text-xs text-white placeholder:text-zinc-500 focus-visible:ring-0"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                        {[
                            { id: "all", label: "All Modalities" },
                            { id: "document", label: "📄 Document" },
                            { id: "image", label: "🖼️ Image" },
                            { id: "audio", label: "🎙️ Audio" },
                        ].map((m) => (
                            <button
                                key={m.id}
                                onClick={() => setModalityFilter(m.id)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                                    modalityFilter === m.id
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : "bg-[#12121A] text-zinc-400 hover:text-white border border-[#1A1A24]"
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Vector Chunk Cards Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.length === 0 ? (
                        <div className="col-span-full rounded-2xl border border-dashed border-[#1A1A24] bg-[#0E0E14]/60 p-14 text-center space-y-2">
                            <Database className="mx-auto text-zinc-500" size={32} />
                            <p className="font-mono text-xs text-zinc-400">No document vector chunks match the selected filters.</p>
                        </div>
                    ) : (
                        filtered.map((d) => (
                            <motion.div
                                key={d.id}
                                whileHover={{ y: -3 }}
                                className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-xl space-y-3 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <ModalityIcon modality={d.modality} size={18} showLabel />
                                        <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-300">
                                            {d.collection}
                                        </span>
                                    </div>
                                    <h3 className="font-mono text-xs font-bold text-white truncate">{d.filename}</h3>
                                </div>

                                <div className="rounded-xl bg-[#08080C] p-3 border border-[#1A1A24] space-y-1.5 font-mono text-[11px]">
                                    <div className="flex justify-between text-zinc-400">
                                        <span>Status:</span>
                                        <span className="text-emerald-400 font-bold uppercase">{d.status}</span>
                                    </div>
                                    <div className="flex justify-between text-zinc-400">
                                        <span>Indexed Chunks:</span>
                                        <span className="text-indigo-300 font-bold">{d.chunk_count || 0}</span>
                                    </div>
                                    <div className="flex justify-between text-zinc-400">
                                        <span>Vector Engine:</span>
                                        <span className="text-zinc-300">ChromaDB HNSW</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500 pt-1">
                                    <span>ID: {d.id.slice(0, 8)}…</span>
                                    <span className="text-indigo-400 font-bold">Cosine Space</span>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </AppShell>
    );
}
