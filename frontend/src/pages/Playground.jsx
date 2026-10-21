import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Play, RefreshCw, Sliders, Sparkles, Code2, Cpu, Loader2, Copy, Check, FileText, Download, CheckCircle2, ArrowRight, BookOpen, Briefcase, Zap, HelpCircle } from "lucide-react";
import api, { API, getToken } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

const PERSONAS = [
    {
        id: "academic",
        name: "Academic Researcher",
        icon: BookOpen,
        color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
        desc: "Strict academic rigor with inline [S#] citations",
        system: "You are an academic researcher. Answer strictly using grounded facts from retrieved document chunks. Quote citations in [S1], [S2] format.",
        temp: 0.2,
        topK: 5,
    },
    {
        id: "executive",
        name: "Executive Briefing",
        icon: Briefcase,
        color: "text-purple-400 border-purple-500/30 bg-purple-500/10",
        desc: "High-level bulleted briefing for leadership",
        system: "You are an executive briefing assistant. Provide a concise bulleted executive summary of the retrieved document chunks.",
        temp: 0.4,
        topK: 8,
    },
    {
        id: "tech_spec",
        name: "Technical Spec Extractor",
        icon: Code2,
        color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
        desc: "Extracts API schemas, specs & code blocks",
        system: "Extract technical specifications, API schemas, and code blocks from retrieved context. Output clean markdown.",
        temp: 0.1,
        topK: 5,
    },
    {
        id: "general",
        name: "General Synthesis",
        icon: Zap,
        color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
        desc: "Balanced multi-modal synthesis across documents",
        system: "Synthesize insights across all retrieved text and visual document chunks into an engaging explanatory answer.",
        temp: 0.5,
        topK: 6,
    },
];

export default function Playground() {
    const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
    const [systemPrompt, setSystemPrompt] = useState(PERSONAS[0].system);
    const [userPrompt, setUserPrompt] = useState("Summarize the system requirements and architecture specifications.");
    const [temp, setTemp] = useState(PERSONAS[0].temp);
    const [topK, setTopK] = useState(PERSONAS[0].topK);
    const [wText, setWText] = useState(1.0);
    const [wVisual, setWVisual] = useState(1.0);
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState("");
    const [sources, setSources] = useState([]);
    const [latency, setLatency] = useState(null);
    const [copied, setCopied] = useState(false);

    const applyPersona = (p) => {
        setSelectedPersona(p);
        setSystemPrompt(p.system);
        setTemp(p.temp);
        setTopK(p.topK);
        toast.info(`Activated '${p.name}' simulator persona`);
    };

    const runSandbox = async () => {
        if (!userPrompt.trim() || loading) return;
        setLoading(true);
        setResponse("");
        setSources([]);
        setLatency(null);

        try {
            const resp = await fetch(`${API}/chat/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
                body: JSON.stringify({ question: userPrompt }),
            });
            if (!resp.ok) throw new Error("Simulator execution failed");
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

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
                        setSources(obj.sources || []);
                        setLatency(obj.latency);
                    } else if (obj.type === "token") {
                        setResponse((prev) => prev + obj.content);
                    } else if (obj.type === "done") {
                        setLatency(obj.latency);
                    }
                }
            }
        } catch (e) {
            toast.error("Simulator execution failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const copyResponse = () => {
        navigator.clipboard.writeText(response);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Copied markdown to clipboard!");
    };

    return (
        <AppShell>
            <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 space-y-6">
                {/* Hero Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1A1A24] pb-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 font-mono text-[11px] font-extrabold text-indigo-300 shadow-lg">
                            <BrainCircuit size={14} className="text-indigo-400" />
                            <span>Interactive RAG & Prompt Engineering Simulator</span>
                        </div>
                        <h1 className="font-heading text-4xl font-black tracking-tight text-white">Neural Playground</h1>
                        <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
                            Benchmark how system prompts, AI personas, temperature scaling, and RRF vector weights alter grounded responses in real time.
                        </p>
                    </div>
                </div>

                {/* Plain English Banner Explaining What This Section Is */}
                <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 shadow-2xl flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shrink-0 mt-0.5">
                        <HelpCircle size={20} />
                    </div>
                    <div className="space-y-1 font-mono text-xs">
                        <h4 className="font-bold text-white text-sm">What is the Neural Playground?</h4>
                        <p className="text-zinc-300 leading-relaxed">
                            This section is an **Interactive RAG Simulator Sandbox**. It lets you experiment with different AI system personas (e.g. Academic Researcher, Executive Briefing, Code Extractor), tune temperature creativity, and adjust vector weights to test how the AI synthesizes your document context **before** using those prompts in live chat.
                        </p>
                    </div>
                </div>

                {/* 1-Click Interactive Persona Selection Grid */}
                <div className="space-y-2">
                    <span className="font-mono text-[10px] uppercase font-bold text-zinc-500 block">Select Simulator AI Persona:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {PERSONAS.map((p) => {
                            const IconComponent = p.icon;
                            const active = selectedPersona.id === p.id;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => applyPersona(p)}
                                    className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all shadow-xl ${
                                        active
                                            ? "border-indigo-500 bg-[#12121A] ring-1 ring-indigo-500/50 shadow-indigo-500/10"
                                            : "border-[#1A1A24] bg-[#0E0E14] hover:bg-[#12121A] hover:border-indigo-500/30"
                                    }`}
                                >
                                    <div className={`p-2.5 rounded-xl border ${p.color} shrink-0`}>
                                        <IconComponent size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white">{p.name}</p>
                                        <p className="text-[10px] font-mono text-zinc-400 mt-1 leading-snug">{p.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Split Grid */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Left Controls (5 cols) */}
                    <div className="lg:col-span-5 space-y-5">
                        {/* System Prompt Instructions */}
                        <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-2xl space-y-3">
                            <label className="flex items-center justify-between font-mono text-xs font-bold text-white">
                                <span className="flex items-center gap-2">
                                    <Code2 size={16} className="text-indigo-400" /> Active System Persona Instructions
                                </span>
                            </label>
                            <Textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                rows={4}
                                className="resize-none rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500/20"
                            />
                        </div>

                        {/* Hyperparameter Controls */}
                        <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-2xl space-y-4">
                            <div className="flex items-center gap-2 font-mono text-xs font-bold text-white border-b border-[#1A1A24] pb-3">
                                <Sliders size={16} className="text-indigo-400" /> Simulation Parameters
                            </div>

                            <div className="space-y-3 font-mono text-xs">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Creativity / Temperature</span>
                                        <span className="text-indigo-300 font-bold">{temp.toFixed(2)}</span>
                                    </div>
                                    <Slider value={[temp]} min={0} max={1} step={0.05} onValueChange={([v]) => setTemp(v)} />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Top-K Retrieved Chunks</span>
                                        <span className="text-indigo-300 font-bold">{topK} Chunks</span>
                                    </div>
                                    <Slider value={[topK]} min={1} max={15} step={1} onValueChange={([v]) => setTopK(v)} />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Text Path Weight (MiniLM)</span>
                                        <span className="text-indigo-300 font-bold">{wText.toFixed(1)}</span>
                                    </div>
                                    <Slider value={[wText]} min={0} max={3} step={0.1} onValueChange={([v]) => setWText(v)} />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Visual Path Weight (CLIP)</span>
                                        <span className="text-amber-300 font-bold">{wVisual.toFixed(1)}</span>
                                    </div>
                                    <Slider value={[wVisual]} min={0} max={3} step={0.1} onValueChange={([v]) => setWVisual(v)} />
                                </div>
                            </div>
                        </div>

                        {/* Test Question Box */}
                        <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-2xl space-y-3">
                            <label className="font-mono text-xs font-bold text-white block">Test Simulation Query</label>
                            <Textarea
                                value={userPrompt}
                                onChange={(e) => setUserPrompt(e.target.value)}
                                rows={3}
                                placeholder="Enter prompt to benchmark…"
                                className="resize-none rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500/20"
                            />
                            <Button
                                onClick={runSandbox}
                                disabled={loading || !userPrompt.trim()}
                                className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 font-bold text-xs text-white shadow-xl shadow-indigo-500/20 hover:opacity-95 transition-all gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />} Run Live Simulation
                            </Button>
                        </div>
                    </div>

                    {/* Right Results Console (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col space-y-5">
                        {/* Response Output Card */}
                        <div className="flex-1 rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-6 shadow-2xl flex flex-col justify-between space-y-4 min-h-[420px]">
                            <div className="flex items-center justify-between border-b border-[#1A1A24] pb-3.5">
                                <div className="flex items-center gap-2 font-mono text-xs font-bold text-white">
                                    <Sparkles size={16} className="text-indigo-400" /> Simulated AI Response Stream
                                </div>
                                {response && (
                                    <button
                                        onClick={copyResponse}
                                        className="flex items-center gap-1.5 rounded-lg border border-[#1A1A24] bg-[#12121A] px-2.5 py-1 font-mono text-[10px] text-zinc-300 hover:text-white"
                                    >
                                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        <span>{copied ? "Copied" : "Copy Output"}</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[420px] space-y-3 font-mono text-xs leading-relaxed text-zinc-200 whitespace-pre-wrap">
                                {response ? (
                                    response
                                ) : loading ? (
                                    <div className="flex items-center gap-2 text-indigo-400 py-20 justify-center">
                                        <Loader2 className="animate-spin" size={18} /> Streaming grounded persona simulation…
                                    </div>
                                ) : (
                                    <div className="py-24 text-center text-zinc-500 font-mono text-xs">
                                        Click "Run Live Simulation" to benchmark RAG response generation.
                                    </div>
                                )}
                            </div>

                            {/* Latency Footer */}
                            {latency && (
                                <div className="flex flex-wrap items-center justify-between border-t border-[#1A1A24] pt-3 font-mono text-[10px] text-zinc-400">
                                    <span>Embedding: <strong className="text-indigo-300">{latency.embedding_ms}ms</strong></span>
                                    <span>Retrieval: <strong className="text-indigo-300">{latency.retrieval_ms}ms</strong></span>
                                    <span>Generation: <strong className="text-indigo-300">{latency.generation_ms}ms</strong></span>
                                    <span>Total: <strong className="text-emerald-400 font-bold">{latency.total_ms}ms</strong></span>
                                </div>
                            )}
                        </div>

                        {/* Grounded Sources Card */}
                        {sources.length > 0 && (
                            <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-4 space-y-3 shadow-xl">
                                <div className="flex items-center justify-between font-mono text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
                                    <span>Retrieved Workspace Chunks ({sources.length})</span>
                                    <span className="text-zinc-500">Top Match: {(sources[0]?.score * 100).toFixed(0)}%</span>
                                </div>
                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                    {sources.map((s, i) => (
                                        <div key={i} className="rounded-xl border border-[#1A1A24] bg-[#12121A] p-3 font-mono text-[11px] space-y-1">
                                            <div className="flex justify-between items-center text-white font-bold">
                                                <span className="truncate max-w-[150px]">S{i + 1}: {s.filename}</span>
                                                <span className="text-emerald-400 text-[10px]">{(s.score * 100).toFixed(0)}%</span>
                                            </div>
                                            <p className="text-zinc-400 line-clamp-2 text-[10px]">{s.snippet}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
