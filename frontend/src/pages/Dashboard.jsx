import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
    Tooltip, Legend, BarChart, Bar,
} from "recharts";
import { Activity, GitCompareArrows, ScatterChart as ScatterIcon, Timer, Sparkles, BarChart3, Eye, MessagesSquare } from "lucide-react";
import api from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { ModalityIcon } from "@/components/ModalityIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const AXIS = "#71717A";
const tooltipStyle = {
    background: "#0E0E14",
    border: "1px solid #1A1A24",
    borderRadius: 14,
    fontSize: 12,
    fontFamily: "JetBrains Mono",
    color: "#F4F4F5",
    boxShadow: "0 16px 40px rgba(0,0,0,0.6)"
};

// Simulated Demo Data for instant interactive visual demo when backend corpus is empty
const DEMO_RANKINGS = {
    text: [
        { id: "doc1", filename: "System_Architecture_v2.pdf", modality: "document", score: 0.89 },
        { id: "doc2", filename: "API_Endpoints_Spec.docx", modality: "document", score: 0.76 },
        { id: "doc3", filename: "ChromaDB_HNSW_Config.pdf", modality: "document", score: 0.62 },
    ],
    visual: [
        { id: "img1", filename: "Vector_Flow_Diagram.png", modality: "image", score: 0.94 },
        { id: "doc1", filename: "System_Architecture_v2.pdf", modality: "document", score: 0.71 },
        { id: "img2", filename: "Database_Schema_ERD.jpg", modality: "image", score: 0.58 },
    ],
    fused: [
        { id: "img1", filename: "Vector_Flow_Diagram.png", modality: "image", rrf_score: 0.0322, text_rank: 4, visual_rank: 1 },
        { id: "doc1", filename: "System_Architecture_v2.pdf", modality: "document", rrf_score: 0.0315, text_rank: 1, visual_rank: 2 },
        { id: "doc2", filename: "API_Endpoints_Spec.docx", modality: "document", rrf_score: 0.0161, text_rank: 2, visual_rank: null },
    ],
};

const DEMO_POINTS = [
    { x: -1.2, y: 0.8, path: "text", filename: "Architecture_Overview.pdf" },
    { x: -0.8, y: 1.4, path: "text", filename: "Requirements_Doc.docx" },
    { x: -1.5, y: -0.2, path: "text", filename: "API_Specifications.pdf" },
    { x: 1.1, y: -1.0, path: "visual", filename: "UML_Diagram_v1.png" },
    { x: 0.9, y: -1.5, path: "visual", filename: "Database_ERD.jpg" },
    { x: 1.4, y: -0.6, path: "visual", filename: "System_Topology.png" },
];

const DEMO_LATENCY = [
    { name: "Query 1", embedding_ms: 45, retrieval_ms: 12, generation_ms: 310 },
    { name: "Query 2", embedding_ms: 38, retrieval_ms: 14, generation_ms: 285 },
    { name: "Query 3", embedding_ms: 52, retrieval_ms: 10, generation_ms: 340 },
    { name: "Query 4", embedding_ms: 41, retrieval_ms: 11, generation_ms: 295 },
];

function RankColumn({ title, color, hits, showRank }) {
    return (
        <div className="flex-1 rounded-2xl border border-[#1A1A24] bg-[#0E0E14] shadow-xl flex flex-col">
            <div className="flex items-center gap-2.5 border-b border-[#1A1A24] px-4 py-3.5 bg-[#121218]/90 rounded-t-2xl">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                <span className="font-mono text-xs font-black uppercase tracking-wider" style={{ color }}>{title}</span>
            </div>
            <div className="flex-1 divide-y divide-[#1A1A24]">
                {(!hits || hits.length === 0) && (
                    <p className="px-4 py-8 text-center font-mono text-xs text-zinc-500">No retrieval trace</p>
                )}
                {hits?.map((h, i) => (
                    <div key={h.id + i} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#12121A]/70 transition-colors" data-testid={`rank-${title}-${i}`}>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-800 font-mono text-[10px] font-bold text-zinc-300">
                            {i + 1}
                        </span>
                        <ModalityIcon modality={h.modality} size={16} />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-zinc-200">{h.filename}</span>
                        <span className="font-mono text-xs font-black" style={{ color }}>
                            {showRank === "rrf" ? (h.rrf_score?.toFixed(4) ?? "—") : `${(h.score * 100).toFixed(0)}%`}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [rankings, setRankings] = useState(null);
    const [content, setContent] = useState(null);
    const [points, setPoints] = useState([]);
    const [latency, setLatency] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [showDemo, setShowDemo] = useState(false);

    useEffect(() => {
        (async () => {
            const [lr, es, lat] = await Promise.all([
                api.get("/dashboard/last-retrieval"),
                api.get("/dashboard/embedding-space"),
                api.get("/dashboard/latency"),
            ]);
            if (lr.data.rankings) setRankings(lr.data.rankings);
            if (lr.data.content) setContent(lr.data.content);
            if (es.data.points?.length) setPoints(es.data.points);
            if (lat.data.series?.length) setLatency(lat.data.series.map((s, i) => ({ ...s, name: `q${i + 1}` })));
            setLoaded(true);
        })().catch(() => setLoaded(true));
    }, []);

    // Toggle demo telemetry if backend has no traces yet
    const activeRankings = rankings || (showDemo ? DEMO_RANKINGS : null);
    const activePoints = points.length > 0 ? points : (showDemo ? DEMO_POINTS : []);
    const activeLatency = latency.length > 0 ? latency : (showDemo ? DEMO_LATENCY : []);

    const textPts = activePoints.filter((p) => p.path === "text");
    const visualPts = activePoints.filter((p) => p.path === "visual");

    return (
        <AppShell>
            <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 font-mono text-[10px] font-extrabold text-indigo-400">
                            <BarChart3 size={13} /> Retrieval Telemetry & Visual Analytics
                        </div>
                        <h1 className="font-heading text-3xl font-black tracking-tight text-white">Explainability Dashboard</h1>
                        <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
                            Audit RRF rank scores across text and visual retrieval streams, project vector points via PCA 2D scatter, and monitor query component latencies.
                        </p>
                    </div>

                    {/* Interactive Telemetry Preview Toggle (Addressing Screenshot 4) */}
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setShowDemo(!showDemo)}
                            variant="outline"
                            className={`h-9 gap-2 rounded-xl font-mono text-xs font-bold transition-all ${
                                showDemo
                                    ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
                                    : "border-[#1A1A24] bg-[#0E0E14] text-zinc-300 hover:bg-[#12121A]"
                            }`}
                        >
                            <Eye size={14} /> {showDemo ? "Demo Telemetry Mode ON" : "Preview Demo Telemetry"}
                        </Button>
                    </div>
                </div>

                {!loaded && (
                    <div className="space-y-4" data-testid="dashboard-loading" aria-label="Loading retrieval dashboard">
                        <Skeleton className="h-28 w-full rounded-2xl bg-[#0E0E14]" />
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <Skeleton className="h-72 w-full rounded-2xl bg-[#0E0E14]" />
                            <Skeleton className="h-72 w-full rounded-2xl bg-[#0E0E14]" />
                        </div>
                    </div>
                )}

                {/* Empty State Banner with Interactive Demo Trigger */}
                {loaded && !activeRankings && (
                    <div className="rounded-2xl border border-dashed border-[#1A1A24] bg-[#0E0E14]/60 p-10 text-center space-y-4 shadow-xl">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-xl">
                            <GitCompareArrows size={28} />
                        </div>
                        <div className="space-y-1 max-w-md mx-auto">
                            <h3 className="font-heading text-lg font-bold text-white">No active query traces logged</h3>
                            <p className="font-mono text-xs text-zinc-400">
                                Ask a question in Chat Studio to log real-time RRF rank traces, or click below to enable interactive demo telemetry.
                            </p>
                        </div>
                        <div className="flex justify-center gap-3 pt-1 font-mono text-xs">
                            <Link
                                to="/chat"
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 font-bold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 transition-all"
                            >
                                <MessagesSquare size={15} /> Open Chat Studio
                            </Link>
                            <Button
                                onClick={() => setShowDemo(true)}
                                variant="outline"
                                className="rounded-xl border-[#1A1A24] bg-[#12121A] text-indigo-300 font-bold hover:bg-[#1A1A24]"
                            >
                                <Eye size={15} /> Show Demo Telemetry
                            </Button>
                        </div>
                    </div>
                )}

                {/* Active RRF Rankings Cards */}
                {activeRankings && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-rose-400">
                                <GitCompareArrows size={16} /> Reciprocal Rank Fusion (RRF) Trace
                            </div>
                            {showDemo && !rankings && (
                                <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                                    Simulated Demo Telemetry
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-4 lg:flex-row">
                            <RankColumn title="Text Path · MiniLM" color="#818CF8" hits={activeRankings.text} />
                            <RankColumn title="Visual Path · CLIP" color="#FBBF24" hits={activeRankings.visual} />
                            <RankColumn title="Fused Output · RRF" color="#F43F5E" hits={activeRankings.fused} showRank="rrf" />
                        </div>
                        {(content || showDemo) && (
                            <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-xl space-y-2.5">
                                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                                    <Sparkles size={14} /> Grounded Answer Synthesis
                                </p>
                                <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-300 bg-[#08080C] p-4 rounded-xl border border-[#1A1A24]">
                                    {content || "The dual RRF vector engine retrieved relevant MiniLM text chunks and CLIP visual layout diagrams to construct a fully grounded answer with isolated zero-cloud privacy."}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* 2D Vector Cluster Graph */}
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[#1A1A24] pb-3.5">
                            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-indigo-400">
                                <ScatterIcon size={17} /> 2D Vector Embedding Space (PCA)
                            </div>
                            <span className="font-mono text-[10px] text-zinc-500 font-bold">{activePoints.length} vectors</span>
                        </div>
                        {activePoints.length === 0 ? (
                            <div className="py-16 text-center space-y-3">
                                <p className="font-mono text-xs text-zinc-400">Requires ≥3 vectors to project PCA coordinates.</p>
                                <Button onClick={() => setShowDemo(true)} size="sm" variant="outline" className="rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-indigo-300 font-bold">
                                    <Eye size={14} /> View Demo Scatter Graph
                                </Button>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                                    <CartesianGrid stroke="#1A1A24" strokeDasharray="3 3" />
                                    <XAxis type="number" dataKey="x" stroke={AXIS} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                                    <YAxis type="number" dataKey="y" stroke={AXIS} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                                    <ZAxis range={[60, 60]} />
                                    <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3", stroke: "#3F3F46" }}
                                        formatter={(v, n, p) => [p.payload.filename, p.payload.path]} />
                                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono" }} />
                                    <Scatter name="Text (MiniLM)" data={textPts} fill="#818CF8" />
                                    <Scatter name="Visual (CLIP)" data={visualPts} fill="#FBBF24" />
                                </ScatterChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Latency History */}
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[#1A1A24] pb-3.5">
                            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-rose-400">
                                <Timer size={17} /> Latency Breakdown History (ms)
                            </div>
                            <span className="font-mono text-[10px] text-zinc-500 font-bold">{activeLatency.length} runs</span>
                        </div>
                        {activeLatency.length === 0 ? (
                            <div className="py-16 text-center space-y-3">
                                <p className="font-mono text-xs text-zinc-400">No query latency logs recorded yet.</p>
                                <Button onClick={() => setShowDemo(true)} size="sm" variant="outline" className="rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-rose-300 font-bold">
                                    <Eye size={14} /> View Demo Latency Chart
                                </Button>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={activeLatency} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                                    <CartesianGrid stroke="#1A1A24" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" stroke={AXIS} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                                    <YAxis stroke={AXIS} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
                                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono" }} />
                                    <Bar dataKey="embedding_ms" stackId="a" fill="#818CF8" name="Embed" />
                                    <Bar dataKey="retrieval_ms" stackId="a" fill="#FBBF24" name="Retrieve" />
                                    <Bar dataKey="generation_ms" stackId="a" fill="#F43F5E" name="Generate" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Eval API Footer */}
                <div className="flex items-center gap-3 rounded-2xl border border-[#1A1A24] bg-[#0E0E14] px-5 py-4 shadow-xl">
                    <Activity size={18} className="text-emerald-400 shrink-0" />
                    <p className="font-mono text-xs text-zinc-400">
                        Evaluation suite exposed via API at <span className="text-indigo-400 font-bold">/api/eval</span> — compute Recall@K and MRR metrics on ground-truth evaluation sets.
                    </p>
                </div>
            </div>
        </AppShell>
    );
}
