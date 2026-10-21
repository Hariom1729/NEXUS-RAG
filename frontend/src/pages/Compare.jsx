import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    GitCompareArrows, Search, Loader2, ArrowRight, Sliders, Zap, Layers, Sparkles, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Mic, Cpu, Check, Activity, BarChart2
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import api from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { ModalityIcon } from "@/components/ModalityIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

const RRF_K = 60;
function rrfFuse(textHits, visualHits, wText, wVisual, topK) {
    const scores = {};
    const store = {};
    const contrib = {};
    textHits.forEach((h, rank) => {
        scores[h.id] = (scores[h.id] || 0) + wText * (1 / (RRF_K + rank + 1));
        store[h.id] = h;
        contrib[h.id] = { ...(contrib[h.id] || {}), text_rank: rank + 1 };
    });
    visualHits.forEach((h, rank) => {
        scores[h.id] = (scores[h.id] || 0) + wVisual * (1 / (RRF_K + rank + 1));
        if (!store[h.id]) store[h.id] = h;
        contrib[h.id] = { ...(contrib[h.id] || {}), visual_rank: rank + 1 };
    });
    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topK)
        .map(([id, sc]) => ({ ...store[id], rrf_score: sc, ...contrib[id] }));
}

function HitRow({ hit, i, color, mode }) {
    const [open, setOpen] = useState(false);
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-[#1A1A24]/60 last:border-0 hover:bg-[#12121A]/90 transition-all rounded-xl"
            data-testid={`compare-${mode}-${i}`}
        >
            <div
                onClick={() => setOpen(!open)}
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none"
            >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-800 font-mono text-xs font-black text-white shadow-md">
                    #{i + 1}
                </span>
                <ModalityIcon modality={hit.modality} size={16} />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-bold text-zinc-200">{hit.filename}</p>
                    {hit.metadata?.page && (
                        <span className="font-mono text-[9px] text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                            p.{hit.metadata.page}
                        </span>
                    )}
                </div>

                {mode === "fused" ? (
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                            {hit.text_rank ? `Text #${hit.text_rank}` : "—"} · {hit.visual_rank ? `Visual #${hit.visual_rank}` : "—"}
                        </span>
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400">
                            RRF: {hit.rrf_score.toFixed(4)}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5">
                        <div className="w-20 h-2 rounded-full bg-zinc-800/80 overflow-hidden hidden sm:block">
                            <div className="h-full rounded-full transition-all" style={{ width: `${(hit.score * 100).toFixed(0)}%`, background: color }} />
                        </div>
                        <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700" style={{ color }}>
                            {(hit.score * 100).toFixed(0)}% match
                        </span>
                    </div>
                )}

                {open ? <ChevronUp size={15} className="text-indigo-400" /> : <ChevronDown size={15} className="text-zinc-500" />}
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-[#08080C] px-4 py-3.5 border-t border-[#1A1A24]/60 space-y-2 font-mono text-xs rounded-b-xl"
                    >
                        <div className="flex items-center justify-between text-[10px] font-bold text-indigo-400">
                            <span>EXTRACTED VECTOR CHUNK PREVIEW</span>
                            <span className="text-zinc-500">ID: {hit.id?.slice(0, 16)}…</span>
                        </div>
                        <p className="text-zinc-300 leading-relaxed bg-[#12121A] p-3.5 rounded-xl border border-[#1A1A24] whitespace-pre-wrap">
                            {hit.document || "(No text content preview available)"}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function Column({ title, subtitle, color, hits, mode }) {
    return (
        <div className="flex-1 rounded-2xl border border-[#1A1A24] bg-[#0E0E14] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#1A1A24] px-5 py-4 bg-[#121218]/90">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: color }} />
                        <span className="font-mono text-xs font-black uppercase tracking-wider text-white" style={{ color }}>{title}</span>
                    </div>
                    <p className="font-mono text-[10px] text-zinc-400">{subtitle}</p>
                </div>
                <span className="font-mono text-[10px] font-extrabold text-zinc-300 bg-zinc-800/90 border border-zinc-700 px-2.5 py-1 rounded-lg shadow-sm">
                    {hits.length} Candidates
                </span>
            </div>
            <div className="flex-1 divide-y divide-[#1A1A24] p-1">
                <AnimatePresence initial={false}>
                    {hits.length === 0 ? (
                        <div className="px-4 py-16 text-center space-y-2">
                            <Layers className="mx-auto text-zinc-600" size={24} />
                            <p className="font-mono text-xs text-zinc-500">No vector matches retrieved</p>
                        </div>
                    ) : (
                        hits.map((h, i) => <HitRow key={h.id || i} hit={h} i={i} color={color} mode={mode} />)
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function Compare() {
    const [question, setQuestion] = useState("");
    const [loading, setLoading] = useState(false);
    const [textHits, setTextHits] = useState([]);
    const [visualHits, setVisualHits] = useState([]);
    const [wText, setWText] = useState(1.0);
    const [wVisual, setWVisual] = useState(1.0);
    const [topK, setTopK] = useState(5);
    const [latency, setLatency] = useState(null);

    const run = async (overrideQuery) => {
        const q = (overrideQuery || question).trim();
        if (!q) return;
        setQuestion(q);
        setLoading(true);
        try {
            const { data } = await api.post("/chat/retrieve", {
                question: q, top_k: topK, rrf_text_weight: wText, rrf_visual_weight: wVisual,
            });
            setTextHits(data.text);
            setVisualHits(data.visual);
            setLatency(data.latency);
        } catch (e) {
            toast.error(e.response?.data?.detail || "Retrieval failed");
        } finally {
            setLoading(false);
        }
    };

    const fused = rrfFuse(textHits, visualHits, wText, wVisual, topK);
    const pctText = Math.round((wText / (wText + wVisual || 1)) * 100);

    const chartData = fused.map((f, i) => ({
        name: `#${i + 1} ${f.filename.slice(0, 12)}…`,
        RRF_Score: parseFloat((f.rrf_score * 100).toFixed(2)),
    }));

    const queryPresets = [
        "Architecture diagrams & system specifications",
        "Document contracts and compliance rules",
        "Visual layouts and image page elements",
        "Audio transcripts and Whisper STT speech",
    ];

    return (
        <AppShell>
            <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 space-y-6">
                {/* Hero Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1A1A24] pb-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 font-mono text-[11px] font-extrabold text-indigo-300 shadow-lg">
                            <GitCompareArrows size={14} className="text-indigo-400" />
                            <span>Multi-Modal Dual Vector Fusion Matrix</span>
                        </div>
                        <h1 className="font-heading text-4xl font-black tracking-tight text-white">Vector Compare Studio</h1>
                        <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
                            Analyze SentenceTransformers (384-d Text) vs CLIP (512-d Visual) vector search paths side-by-side. Adjust RRF weights in real time to inspect candidate re-ranking.
                        </p>
                    </div>

                    {/* Presets */}
                    <div className="space-y-1.5">
                        <span className="font-mono text-[10px] uppercase font-bold text-zinc-500 block">Sample Test Queries:</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {queryPresets.map((qp, i) => (
                                <button
                                    key={i}
                                    onClick={() => run(qp)}
                                    className="rounded-xl border border-[#1A1A24] bg-[#0E0E14] px-3 py-1.5 font-mono text-[10px] font-bold text-zinc-300 hover:border-indigo-500/50 hover:text-white hover:bg-[#12121A] transition-all shadow-sm"
                                >
                                    {qp.split(" ")[0]} {qp.split(" ")[1]}…
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Input Search Console */}
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-4 top-4 text-zinc-500" />
                        <Input
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && run()}
                            placeholder="Enter a test query to compare vector paths (e.g. 'architecture diagrams or system requirements')…"
                            data-testid="compare-query-input"
                            className="h-12 pl-11 rounded-2xl border-[#1A1A24] bg-[#0E0E14] text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-indigo-500/20 shadow-xl font-mono"
                        />
                    </div>
                    <Button
                        onClick={() => run()}
                        disabled={loading || !question.trim()}
                        data-testid="compare-run-button"
                        className="h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 px-6 text-xs font-bold text-white shadow-xl shadow-indigo-500/20 hover:opacity-95 transition-all gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />} Execute Retrieval
                    </Button>
                </div>

                {/* Interactive Hyperparameters Matrix */}
                <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#1A1A24] pb-3">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-white">
                            <Sliders size={16} className="text-indigo-400" />
                            <span>Dynamic Fusion Weighting Parameters</span>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                            Reciprocal Rank Fusion (k=60)
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-[#818CF8]">Text Weight (MiniLM)</span>
                                <span className="font-mono text-xs font-extrabold text-white bg-indigo-500/20 px-2.5 py-0.5 rounded-md border border-indigo-500/40">
                                    {wText.toFixed(1)}
                                </span>
                            </div>
                            <Slider value={[wText]} min={0} max={3} step={0.1} onValueChange={([v]) => setWText(v)} data-testid="compare-weight-text" />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-[#FBBF24]">Visual Weight (CLIP)</span>
                                <span className="font-mono text-xs font-extrabold text-white bg-amber-500/20 px-2.5 py-0.5 rounded-md border border-amber-500/40">
                                    {wVisual.toFixed(1)}
                                </span>
                            </div>
                            <Slider value={[wVisual]} min={0} max={3} step={0.1} onValueChange={([v]) => setWVisual(v)} data-testid="compare-weight-visual" />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-zinc-400">Top-K Cutoff</span>
                                <span className="font-mono text-xs font-extrabold text-white bg-zinc-800 px-2.5 py-0.5 rounded-md">
                                    {topK} Candidates
                                </span>
                            </div>
                            <Slider value={[topK]} min={1} max={10} step={1} onValueChange={([v]) => setTopK(v)} data-testid="compare-topk" />
                        </div>
                    </div>

                    {/* Dynamic Ratio Bar */}
                    <div className="pt-2">
                        <div className="flex items-center justify-between font-mono text-[10px] mb-1.5">
                            <span className="text-[#818CF8] font-bold">{pctText}% Text Preference</span>
                            <span className="text-[#FBBF24] font-bold">{100 - pctText}% Visual Preference</span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#FBBF24]/30">
                            <motion.div layout className="absolute inset-y-0 left-0 bg-[#818CF8]" style={{ width: `${pctText}%` }} />
                        </div>
                    </div>
                </div>

                {/* Triple Column Vector Path Matrix */}
                {textHits.length === 0 && visualHits.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#1A1A24] bg-[#0E0E14]/60 p-16 text-center space-y-3">
                        <GitCompareArrows className="mx-auto text-indigo-400 animate-pulse" size={36} />
                        <p className="font-mono text-xs font-bold text-white">No query results executed yet</p>
                        <p className="font-mono text-xs text-zinc-500 max-w-md mx-auto">
                            Enter a search query or click one of the preset sample query tags above to run side-by-side vector fusion.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                            <Column title="Text Path · MiniLM" subtitle="SentenceTransformers 384-d" color="#818CF8" hits={textHits} mode="text" />
                            <Column title="Visual Path · CLIP" subtitle="ViT-B-32 Image Embeddings" color="#FBBF24" hits={visualHits} mode="visual" />
                            <div className="flex items-center justify-center lg:flex-col py-2">
                                <div className="h-10 w-10 rounded-2xl border border-[#1A1A24] bg-[#121218] flex items-center justify-center text-zinc-300 shadow-xl">
                                    <ArrowRight size={18} className="text-indigo-400" />
                                </div>
                            </div>
                            <Column title="Fused Output · RRF" subtitle="Reciprocal Rank Fusion" color="#F43F5E" hits={fused} mode="fused" />
                        </div>

                        {/* RRF Score Distribution Chart */}
                        {chartData.length > 0 && (
                            <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-2xl space-y-3">
                                <div className="flex items-center justify-between border-b border-[#1A1A24] pb-3">
                                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                                        <BarChart2 size={16} className="text-rose-400" /> RRF Fusion Score Distribution
                                    </p>
                                    <span className="font-mono text-[10px] text-zinc-400">Relative rank weight distribution</span>
                                </div>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid stroke="#1A1A24" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" stroke="#71717A" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                                        <YAxis stroke="#71717A" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                                        <Tooltip contentStyle={{ background: "#0E0E14", border: "1px solid #1A1A24", borderRadius: 12, fontSize: 11, fontFamily: "JetBrains Mono", color: "#FFF" }} />
                                        <Bar dataKey="RRF_Score" fill="#F43F5E" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                )}

                {latency && (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1A1A24] bg-[#0E0E14] px-5 py-3 font-mono text-xs text-zinc-400 shadow-xl">
                        <span className="flex items-center gap-2 text-white font-bold">
                            <Activity size={15} className="text-amber-400" /> Latency Breakdown:
                        </span>
                        <div className="flex flex-wrap gap-4">
                            <span>Embedding: <strong className="text-white">{latency.embedding_ms}ms</strong></span>
                            <span>Retrieval: <strong className="text-white">{latency.retrieval_ms}ms</strong></span>
                            <span className="text-emerald-400 font-bold">Client RRF: Instant (0ms)</span>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
