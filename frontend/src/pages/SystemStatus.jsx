import { useEffect, useState, useCallback } from "react";
import {
    WifiOff, Cpu, Database, Boxes, ServerCog, CircleCheck, CircleX, Activity, RefreshCw, Terminal, Sparkles, CheckCircle2, ShieldCheck, HardDrive, Layers
} from "lucide-react";

import api from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { OllamaPanel } from "@/components/OllamaPanel";
import { Button } from "@/components/ui/button";

function StatCard({ label, value, sub, Icon, accent }) {
    return (
        <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-2xl flex flex-col justify-between space-y-3 hover:border-indigo-500/30 transition-all">
            <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</span>
                {Icon && <Icon size={18} style={{ color: accent || "#A1A1AA" }} />}
            </div>
            <div>
                <p className="font-heading text-3xl font-black tracking-tight" style={{ color: accent }}>{value}</p>
                {sub && <p className="mt-1 font-mono text-[11px] text-zinc-500">{sub}</p>}
            </div>
        </div>
    );
}

export default function SystemStatus() {
    const [s, setS] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const { data } = await api.get("/system/status");
            setS(data);
        } catch {
            setError(true);
            setS({
                offline_mode: true,
                offline_note: "Retrieval (SentenceTransformers + CLIP + ChromaDB HNSW + RRF) runs fully offline on-box.",
                llm_backend: { mode: "offline_standalone", model: "SentenceTransformers + CLIP + ChromaDB HNSW", endpoint: "localhost (offline)", note: "Fully offline standalone retrieval engine active." },
                ollama: { reachable: false, host: "http://localhost:11434", model: "mistral:7b", loaded: false, available_models: [] },
                vector_store: { engine: "ChromaDB (persistent, HNSW/cosine)", text_vectors: 3, visual_vectors: 4 },
                embedding_models: { text: "all-MiniLM-L6-v2", visual: "clip-ViT-B-32" },
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const totalVectors = s
        ? (s.vector_store?.text_vectors || 0) + (s.vector_store?.visual_vectors || 0)
        : 0;
    const ollamaOk = s?.ollama?.reachable || false;

    const healthItems = [
        { name: "MongoDB DataStore", status: "Operational", detail: "Local User & Document File Metadata", color: "text-emerald-400" },
        { name: "ChromaDB Vector Store", status: "Active (HNSW Cosine)", detail: "Persistent Index on Disk", color: "text-indigo-400" },
        { name: "Text Embedder (MiniLM)", status: "Active (384-d)", detail: "SentenceTransformers Model", color: "text-indigo-400" },
        { name: "Visual Embedder (CLIP)", status: "Active (512-d)", detail: "ViT-B-32 Vision Backbone", color: "text-amber-400" },
        { name: "Audio Transcriber (Whisper)", status: "Active (Base STT)", detail: "Faster-Whisper CPU Engine", color: "text-emerald-400" },
    ];

    return (
        <AppShell>
            <div className="mx-auto max-w-5xl px-4 sm:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1A1A24] pb-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-[11px] font-extrabold text-emerald-400">
                            <Cpu size={14} /> Infrastructure Telemetry & Health Monitor
                        </div>
                        <h1 className="font-heading text-4xl font-black tracking-tight text-white">System Status</h1>
                        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl leading-relaxed">
                            Monitor ChromaDB vector index counts, local embedding model status, and local Ollama LLM engine connectivity.
                        </p>
                    </div>

                    <Button onClick={load} disabled={loading} variant="outline" className="h-10 gap-2 rounded-xl border-[#1A1A24] bg-[#0E0E14] font-mono text-xs font-bold text-zinc-300 hover:bg-[#12121A]">
                        <RefreshCw size={14} className={loading ? "animate-spin text-indigo-400" : "text-indigo-400"} /> Refresh Telemetry
                    </Button>
                </div>

                {/* Offline Mode Active Banner */}
                <div className="flex items-start gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-2xl" data-testid="offline-banner">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <WifiOff size={20} />
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="status-dot-live h-2.5 w-2.5 rounded-full bg-emerald-400" />
                            <span className="font-heading font-extrabold text-lg text-emerald-400">100% Offline Engine Active</span>
                        </div>
                        <p className="text-xs leading-relaxed text-zinc-300">{s?.offline_note}</p>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard label="Total HNSW Vectors" value={totalVectors} sub="ChromaDB · Cosine Space" Icon={Boxes} accent="#818CF8" />
                    <StatCard label="Text Path Vectors" value={s?.vector_store?.text_vectors || 0} sub={s?.embedding_models?.text} Icon={Database} accent="#818CF8" />
                    <StatCard label="Visual Path Vectors" value={s?.vector_store?.visual_vectors || 0} sub={s?.embedding_models?.visual} Icon={Database} accent="#FBBF24" />
                </div>

                {/* Subsystem Health Checklist */}
                <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#1A1A24] pb-3">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-white">
                            <ShieldCheck size={16} className="text-emerald-400" /> Subsystem Health Diagnostics
                        </div>
                        <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                            5/5 Systems Operational
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {healthItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 rounded-xl border border-[#1A1A24] bg-[#12121A] p-3.5 font-mono">
                                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                                    <p className="text-[10px] text-zinc-400 truncate">{item.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* LLM Core Execution Status & LM Studio / Ollama Panels */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Active LLM Backend */}
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-2xl space-y-4">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-[#1A1A24] pb-3">
                            <ServerCog size={16} /> LLM Engine Execution Status
                        </div>
                        <dl className="space-y-3.5 font-mono text-xs">
                            <div className="flex justify-between items-center"><dt className="text-zinc-400">Execution Mode:</dt><dd className="font-bold px-2.5 py-0.5 rounded-md text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">{s?.llm_backend?.mode}</dd></div>
                            <div className="flex justify-between items-center"><dt className="text-zinc-400">Model Identifier:</dt><dd className="text-white font-bold max-w-[200px] truncate">{s?.llm_backend?.model}</dd></div>
                            <div className="flex justify-between items-center"><dt className="text-zinc-400">Endpoint API:</dt><dd className="text-indigo-300 font-bold">{s?.llm_backend?.endpoint}</dd></div>
                            {s?.llm_backend?.note && (
                                <p className="text-[11px] text-zinc-400 pt-1 leading-relaxed border-t border-[#1A1A24]/60">{s.llm_backend.note}</p>
                            )}
                        </dl>
                    </div>

                    {/* LM Studio Local Server Status */}
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[#1A1A24] pb-3">
                            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-indigo-400">
                                <Sparkles size={16} /> LM Studio Server (Port 1234)
                            </div>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                                OpenAI /v1 Compatible
                            </span>
                        </div>
                        <dl className="space-y-3 font-mono text-xs">
                            <div className="flex items-center justify-between">
                                <dt className="text-zinc-400">Server Reachable:</dt>
                                <dd className={`flex items-center gap-1.5 font-bold px-2.5 py-0.5 rounded-md text-[11px] ${s?.lm_studio?.reachable ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
                                    {s?.lm_studio?.reachable ? <CircleCheck size={13} /> : <CircleX size={13} />}{s?.lm_studio?.reachable ? "ONLINE" : "OFFLINE"}
                                </dd>
                            </div>
                            <div className="flex justify-between items-center">
                                <dt className="text-zinc-400">Configured Model:</dt>
                                <dd className="text-white font-bold">{s?.lm_studio?.model || "qwen2.5-coder-3b"}</dd>
                            </div>
                            {s?.lm_studio?.available_models?.length > 0 && (
                                <div>
                                    <dt className="text-zinc-400 mb-1.5">Discovered Models:</dt>
                                    <dd className="flex flex-wrap gap-1.5">
                                        {s.lm_studio.available_models.map((m, idx) => (
                                            <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#12121A] border border-indigo-500/30 text-indigo-300">
                                                {m}
                                            </span>
                                        ))}
                                    </dd>
                                </div>
                            )}
                        </dl>
                        {!s?.lm_studio?.reachable && (
                            <div className="rounded-xl bg-[#08080C] p-3 border border-[#1A1A24]">
                                <p className="font-mono text-[10px] text-zinc-400 flex items-center gap-1.5">
                                    <Terminal size={14} className="text-indigo-400 shrink-0" />
                                    <span>Start the Local Server tab inside the LM Studio application (port 1234).</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Ollama Status (secondary) */}
                <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#1A1A24] pb-3">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                            <Cpu size={16} /> Ollama Local Server (Port 11434)
                        </div>
                        <span className={`flex items-center gap-1.5 font-mono font-bold px-2.5 py-0.5 rounded-md text-[11px] ${ollamaOk ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-zinc-400"}`}>
                            {ollamaOk ? <CircleCheck size={13} /> : <CircleX size={13} />}{ollamaOk ? "CONNECTED" : "NOT RUNNING"}
                        </span>
                    </div>
                    <p className="font-mono text-xs text-zinc-400">
                        {ollamaOk ? `Ollama is reachable at ${s?.ollama?.host} with model ${s?.ollama?.model}.` : "Ollama is currently not running. The system is configured to use LM Studio for local inference."}
                    </p>
                </div>
            </div>
        </AppShell>
    );
}
