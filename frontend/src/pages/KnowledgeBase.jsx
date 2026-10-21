import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Trash2, Layers, Database, Search, UploadCloud, FileText, Image as ImageIcon, Mic } from "lucide-react";
import api from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { ModalityIcon } from "@/components/ModalityIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

function fmtSize(bytes) {
    if (!bytes) return "—";
    const u = ["B", "KB", "MB"];
    let i = 0, n = bytes;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)}${u[i]}`;
}

const STATUS_STYLE = {
    indexed: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    failed: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    queued: "text-zinc-400 border-[#1A1A24] bg-zinc-800/60",
    parsing: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10 animate-pulse",
    embedding: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10 animate-pulse",
};

export default function KnowledgeBase() {
    const [docs, setDocs] = useState([]);
    const [collections, setCollections] = useState([]);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState([]);

    const load = useCallback(async () => {
        try {
            const params = filter !== "all" ? { collection: filter } : {};
            const [d, c] = await Promise.all([
                api.get("/documents", { params }),
                api.get("/documents/collections"),
            ]);
            setDocs(d.data?.documents || []);
            setCollections(c.data?.collections || []);
        } catch (err) {
            setDocs([]);
            setCollections([]);
            toast.error("Failed to load knowledge base items: " + (err.response?.data?.detail || err.message));
        }
    }, [filter]);

    useEffect(() => { load(); }, [load]);


    const toggle = (id) =>
        setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const toggleAll = () =>
        setSelected((s) => (s.length === filteredDocs.length ? [] : filteredDocs.map((d) => d.id)));

    const reindex = async (id) => {
        await api.post(`/documents/${id}/reindex`);
        toast.success("Re-indexing started");
        load();
    };
    const del = async (id) => {
        await api.delete(`/documents/${id}`);
        toast.success("Deleted");
        setSelected((s) => s.filter((x) => x !== id));
        load();
    };
    const bulkDelete = async () => {
        const { data } = await api.post("/documents/bulk-delete", { ids: selected });
        toast.success(`Deleted ${data.deleted} document(s)`);
        setSelected([]);
        load();
    };

    const filteredDocs = docs.filter(d => (d.filename || "").toLowerCase().includes(search.toLowerCase()));

    return (
        <AppShell>
            <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 font-mono text-[10px] font-extrabold text-indigo-400">
                            <Database size={13} /> Multimodal Index Corpus
                        </div>
                        <h1 className="font-heading text-3xl font-black tracking-tight text-white">Knowledge Base</h1>
                        <p className="text-xs sm:text-sm text-zinc-400">
                            {docs.length} indexed files • manage collections, re-index vectors, and perform bulk operations.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
                            <Input
                                placeholder="Filter documents…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 w-44 sm:w-56 rounded-xl border-[#1A1A24] bg-[#0E0E14] pl-8 font-mono text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={filter} onValueChange={setFilter}>
                                <SelectTrigger data-testid="collection-filter" className="h-9 w-44 rounded-xl border-[#1A1A24] bg-[#0E0E14] font-mono text-xs text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-[#1A1A24] bg-[#0E0E14] text-white">
                                    <SelectItem value="all">all collections</SelectItem>
                                    {collections.map((c) => (
                                        <SelectItem key={c.name} value={c.name}>{c.name} ({c.count})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={load} variant="outline" size="icon" data-testid="refresh-kb" aria-label="Refresh knowledge base" className="h-9 w-9 rounded-xl border-[#1A1A24] bg-[#0E0E14] text-zinc-300 hover:bg-[#12121A]">
                                <RefreshCw size={14} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Bulk Action Ribbon */}
                {selected.length > 0 && (
                    <div className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 shadow-xl">
                        <span className="font-mono text-xs font-bold text-rose-300">
                            {selected.length} item(s) selected
                        </span>
                        <Button onClick={bulkDelete} size="sm" data-testid="bulk-delete-button" className="h-8 gap-1.5 rounded-xl bg-rose-600 font-bold text-white hover:bg-rose-500 shadow-md">
                            <Trash2 size={14} /> Delete Selected
                        </Button>
                    </div>
                )}

                {/* Linear Data Table & Empty State Enhancement (Addressing Screenshot 3) */}
                <div className="overflow-x-auto rounded-2xl border border-[#1A1A24] bg-[#0E0E14] shadow-2xl">
                    <table className="w-full min-w-[760px] text-xs">
                        <thead>
                            <tr className="border-b border-[#1A1A24] bg-[#121218] font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                <th className="w-10 px-4 py-3.5 text-center">
                                    <Checkbox checked={filteredDocs.length > 0 && selected.length === filteredDocs.length} onCheckedChange={toggleAll} aria-label="Select all documents" data-testid="select-all" />
                                </th>
                                <th className="px-3 py-3.5 text-left">Modality</th>
                                <th className="px-3 py-3.5 text-left">Filename</th>
                                <th className="px-3 py-3.5 text-left">Collection</th>
                                <th className="px-3 py-3.5 text-right">Size</th>
                                <th className="px-3 py-3.5 text-right">Chunks</th>
                                <th className="px-3 py-3.5 text-left">Status</th>
                                <th className="px-4 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1A1A24]">
                            {filteredDocs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center">
                                        {/* Rich Interactive Empty State Card */}
                                        <div className="mx-auto max-w-md space-y-4 py-6">
                                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-xl">
                                                <Database size={28} />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-heading text-lg font-bold text-white">No documents in corpus</h3>
                                                <p className="font-mono text-xs text-zinc-400">
                                                    Your knowledge base is empty. Upload documents, image diagrams, or audio recordings to begin.
                                                </p>
                                            </div>
                                            <div className="flex justify-center gap-2 font-mono text-[11px]">
                                                <span className="rounded-lg bg-zinc-800/80 px-2.5 py-1 text-zinc-300 flex items-center gap-1">
                                                    <FileText size={12} className="text-indigo-400" /> PDF / DOCX
                                                </span>
                                                <span className="rounded-lg bg-zinc-800/80 px-2.5 py-1 text-zinc-300 flex items-center gap-1">
                                                    <ImageIcon size={12} className="text-amber-400" /> PNG / JPG
                                                </span>
                                                <span className="rounded-lg bg-zinc-800/80 px-2.5 py-1 text-zinc-300 flex items-center gap-1">
                                                    <Mic size={12} className="text-emerald-400" /> WAV / MP3
                                                </span>
                                            </div>
                                            <div className="pt-2">
                                                <Link
                                                    to="/ingest"
                                                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 font-mono text-xs font-bold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 transition-all"
                                                >
                                                    <UploadCloud size={15} /> Go to Ingest Portal
                                                </Link>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredDocs.map((d) => (
                                    <tr key={d.id} className="transition-colors hover:bg-[#12121A]/70" data-testid={`kb-row-${d.id}`}>
                                        <td className="px-4 py-3.5 text-center">
                                            <Checkbox checked={selected.includes(d.id)} onCheckedChange={() => toggle(d.id)} aria-label={`Select ${d.filename}`} data-testid={`select-${d.id}`} />
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <ModalityIcon modality={d.modality} size={16} showLabel />
                                        </td>
                                        <td className="max-w-[240px] truncate px-3 py-3.5 font-mono text-xs font-bold text-white">
                                            {d.filename}
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-300">
                                                {d.collection}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3.5 text-right font-mono text-xs text-zinc-400">{fmtSize(d.size)}</td>
                                        <td className="px-3 py-3.5 text-right font-mono text-xs font-bold text-indigo-300">{d.chunk_count || 0}</td>
                                        <td className="px-3 py-3.5">
                                            <Badge variant="outline" className={`font-mono text-[9px] font-extrabold uppercase rounded-md px-2 py-0.5 ${STATUS_STYLE[d.status] || ""}`}>
                                                {d.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => reindex(d.id)}
                                                    title="Re-index"
                                                    aria-label={`Re-index ${d.filename}`}
                                                    data-testid={`reindex-${d.id}`}
                                                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-indigo-500/20 hover:text-indigo-400"
                                                >
                                                    <RefreshCw size={14} />
                                                </button>
                                                <button
                                                    onClick={() => del(d.id)}
                                                    title="Delete"
                                                    aria-label={`Delete ${d.filename}`}
                                                    data-testid={`delete-${d.id}`}
                                                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Collection Summary Pills */}
                {collections.length > 0 && (
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-4 space-y-2 shadow-xl">
                        <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                            <Layers size={15} className="text-indigo-400" /> Workspace Collection Summary
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {collections.map((c) => (
                                <span key={c.name} className="rounded-xl border border-[#1A1A24] bg-[#14141A] px-3 py-1 font-mono text-xs text-zinc-300">
                                    {c.name} <strong className="text-indigo-400 font-bold ml-1">• {c.count}</strong>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
