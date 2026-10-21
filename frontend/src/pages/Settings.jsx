import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, Loader2, Settings2, Sliders, Cpu, ShieldCheck, Database, KeyRound, User, Server, HardDrive, Check } from "lucide-react";
import api from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

function SectionCard({ title, desc, Icon, children }) {
    return (
        <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-[#1A1A24] pb-4">
                <div className="p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                    <Icon size={18} />
                </div>
                <div>
                    <h3 className="font-mono text-sm font-bold text-white">{title}</h3>
                    <p className="font-mono text-xs text-zinc-400">{desc}</p>
                </div>
            </div>
            {children}
        </div>
    );
}

function SettingField({ label, desc, children }) {
    return (
        <div className="space-y-2 py-1">
            <div className="flex justify-between items-baseline">
                <label className="font-mono text-xs font-bold text-zinc-200">{label}</label>
            </div>
            {children}
            {desc && <p className="font-mono text-[11px] text-zinc-500 leading-relaxed">{desc}</p>}
        </div>
    );
}

export default function Settings() {
    const { user } = useAuth();
    const [s, setS] = useState(null);
    const [tab, setTab] = useState("rag");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get("/settings").then(({ data }) => setS(data)).catch(() => {});
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            await api.put("/settings", s);
            toast.success("Pipeline configuration saved successfully!");
        } catch {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (!s) return (
        <AppShell>
            <div className="p-8 font-mono text-xs text-zinc-400 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-indigo-400" /> Loading workspace configuration parameters…
            </div>
        </AppShell>
    );

    const set = (k, v) => setS({ ...s, [k]: v });
    const rrfTextPct = Math.round((s.rrf_text_weight / (s.rrf_text_weight + s.rrf_visual_weight || 1)) * 100);

    return (
        <AppShell>
            <div className="mx-auto max-w-4xl px-4 sm:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1A1A24] pb-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 font-mono text-[11px] font-extrabold text-indigo-300 shadow-lg">
                            <Settings2 size={14} className="text-indigo-400" />
                            <span>Workspace Engine Hyperparameters</span>
                        </div>
                        <h1 className="font-heading text-4xl font-black tracking-tight text-white">System Settings</h1>
                        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl leading-relaxed">
                            Fine-tune text chunking boundaries, vector candidate retrieval thresholds, local Ollama model options, and security settings.
                        </p>
                    </div>

                    <Button
                        onClick={save}
                        disabled={saving}
                        data-testid="save-settings-button"
                        className="h-11 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 font-bold text-xs text-white shadow-xl shadow-indigo-500/20 hover:opacity-95 transition-all gap-2"
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save Configuration
                    </Button>
                </div>

                {/* Navigation Tabs Ribbon */}
                <div className="flex flex-wrap items-center gap-2 border-b border-[#1A1A24] pb-4">
                    {[
                        { id: "rag", label: "RAG & Chunking Parameters", Icon: Sliders },
                        { id: "model", label: "Model & Inference Engine", Icon: Cpu },
                        { id: "security", label: "Security & Datastores", Icon: ShieldCheck },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 rounded-2xl px-4.5 py-2.5 font-mono text-xs font-bold transition-all ${
                                tab === t.id
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400"
                                    : "bg-[#0E0E14] text-zinc-400 hover:text-white border border-[#1A1A24] hover:bg-[#12121A]"
                            }`}
                        >
                            <t.Icon size={15} />
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab 1: RAG & Chunking Parameters */}
                {tab === "rag" && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <SectionCard title="Document Chunking & Token Boundaries" desc="Configure text splitting boundaries prior to embedding into ChromaDB." Icon={Sliders}>
                            <SettingField label={`Chunk Size (${s.chunk_size} characters)`} desc="Number of characters per document snippet chunk. Higher values preserve context, lower values sharpen target retrieval.">
                                <Slider value={[s.chunk_size]} min={200} max={2000} step={50} onValueChange={([v]) => set("chunk_size", v)} data-testid="slider-chunk-size" />
                            </SettingField>

                            <SettingField label={`Chunk Overlap (${s.chunk_overlap} characters)`} desc="Context overlap between adjacent chunks to maintain sentence continuity across splitting boundaries.">
                                <Slider value={[s.chunk_overlap]} min={0} max={400} step={10} onValueChange={([v]) => set("chunk_overlap", v)} data-testid="slider-overlap" />
                            </SettingField>
                        </SectionCard>

                        <SectionCard title="Vector Candidate Retrieval & RRF Weights" desc="Balance nearest-neighbor vector search candidate selection and fusion path weights." Icon={Database}>
                            <SettingField label={`Top-K Candidate Retrieval (${s.top_k} vectors)`} desc="Number of top nearest-neighbor chunks selected from each vector path before applying RRF rank fusion.">
                                <Slider value={[s.top_k]} min={1} max={15} step={1} onValueChange={([v]) => set("top_k", v)} data-testid="slider-topk" />
                            </SettingField>

                            <SettingField label={`RRF Path Weights (${rrfTextPct}% Text / ${100 - rrfTextPct}% Visual)`} desc="Relative preference assigned to MiniLM (Text) vs CLIP (Visual) paths during Reciprocal Rank Fusion.">
                                <div className="space-y-3.5 pt-2">
                                    <div className="flex items-center gap-4">
                                        <span className="w-28 font-mono text-xs font-bold text-[#818CF8]">Text ({s.rrf_text_weight.toFixed(1)})</span>
                                        <Slider value={[s.rrf_text_weight]} min={0} max={3} step={0.1} onValueChange={([v]) => set("rrf_text_weight", v)} data-testid="slider-rrf-text" className="flex-1" />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="w-28 font-mono text-xs font-bold text-[#FBBF24]">Visual ({s.rrf_visual_weight.toFixed(1)})</span>
                                        <Slider value={[s.rrf_visual_weight]} min={0} max={3} step={0.1} onValueChange={([v]) => set("rrf_visual_weight", v)} data-testid="slider-rrf-visual" className="flex-1" />
                                    </div>
                                </div>
                            </SettingField>
                        </SectionCard>
                    </motion.div>
                )}

                {/* Tab 2: Model & Inference Engine */}
                {tab === "model" && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <SectionCard title="Active Local LLM Engine" desc="Choose which local inference server generates offline cited answers." Icon={Cpu}>
                            <SettingField label="Inference Engine Provider" desc="Select LM Studio (OpenAI-compatible server) or Ollama.">
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => set("local_llm_provider", "lm_studio")}
                                        className={`flex items-center justify-center gap-2 rounded-xl p-3 font-mono text-xs font-bold transition-all border ${
                                            (s.local_llm_provider || "lm_studio") === "lm_studio"
                                                ? "bg-indigo-600/20 text-indigo-300 border-indigo-500 shadow-md"
                                                : "bg-[#12121A] text-zinc-400 border-[#1A1A24] hover:text-white"
                                        }`}
                                    >
                                        <Sparkles size={14} className="text-indigo-400" />
                                        <span>LM Studio (Active)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => set("local_llm_provider", "ollama")}
                                        className={`flex items-center justify-center gap-2 rounded-xl p-3 font-mono text-xs font-bold transition-all border ${
                                            s.local_llm_provider === "ollama"
                                                ? "bg-amber-600/20 text-amber-300 border-amber-500 shadow-md"
                                                : "bg-[#12121A] text-zinc-400 border-[#1A1A24] hover:text-white"
                                        }`}
                                    >
                                        <Server size={14} className="text-amber-400" />
                                        <span>Ollama</span>
                                    </button>
                                </div>
                            </SettingField>
                        </SectionCard>

                        {/* LM Studio Configuration */}
                        {(s.local_llm_provider || "lm_studio") === "lm_studio" && (
                            <SectionCard title="LM Studio Configuration" desc="Connect to LM Studio's local server (OpenAI-compatible /v1 API)." Icon={Sparkles}>
                                <SettingField label="LM Studio Server Endpoint" desc="Default local port is 1234. Make sure 'Local Server' is started in LM Studio.">
                                    <Input
                                        value={s.lm_studio_host || "http://localhost:1234/v1"}
                                        onChange={(e) => set("lm_studio_host", e.target.value)}
                                        data-testid="input-lmstudio-host"
                                        className="h-11 rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 shadow-inner"
                                    />
                                </SettingField>

                                <SettingField label="Configured Model Identifier" desc="Model ID currently loaded in LM Studio (e.g. qwen2.5-coder-3b, qwen3.5-4b, etc.).">
                                    <Input
                                        value={s.lm_studio_model || "qwen2.5-coder-3b"}
                                        onChange={(e) => set("lm_studio_model", e.target.value)}
                                        data-testid="input-lmstudio-model"
                                        className="h-11 rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 shadow-inner"
                                    />
                                </SettingField>

                                <div className="pt-2 flex items-center gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={async () => {
                                            try {
                                                const { data } = await api.post("/system/lmstudio/test", {
                                                    host: s.lm_studio_host || "http://localhost:1234/v1",
                                                    model: s.lm_studio_model || "qwen2.5-coder-3b"
                                                });
                                                if (data.reachable) {
                                                    toast.success(`Connected to LM Studio! (${data.available_models?.length || 0} models available)`);
                                                } else {
                                                    toast.error("LM Studio not reachable at " + (s.lm_studio_host || "http://localhost:1234/v1"));
                                                }
                                            } catch {
                                                toast.error("Test request failed");
                                            }
                                        }}
                                        className="h-10 rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-indigo-300 hover:bg-[#1A1A26] gap-2"
                                    >
                                        <Cpu size={14} /> Test LM Studio Connection
                                    </Button>
                                </div>
                            </SectionCard>
                        )}

                        {/* Ollama Configuration */}
                        {s.local_llm_provider === "ollama" && (
                            <SectionCard title="Local Ollama Generation Model" desc="Local model identifier used for offline generation when Ollama engine is reachable." Icon={Cpu}>
                                <SettingField label="Ollama Server Endpoint" desc="Default local port is 11434.">
                                    <Input
                                        value={s.ollama_host || "http://localhost:11434"}
                                        onChange={(e) => set("ollama_host", e.target.value)}
                                        data-testid="input-ollama-host"
                                        className="h-11 rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 shadow-inner"
                                    />
                                </SettingField>

                                <SettingField label="Configured Ollama Model Identifier" desc="Model tag pulled in local Ollama instance (e.g. mistral:7b, llama3:8b, phi3:mini).">
                                    <Input
                                        value={s.ollama_model || "mistral:7b"}
                                        onChange={(e) => set("ollama_model", e.target.value)}
                                        data-testid="input-ollama-model"
                                        className="h-11 rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 shadow-inner"
                                    />
                                </SettingField>
                            </SectionCard>
                        )}

                        <SectionCard title="Whisper Speech Recognition Model" desc="Local speech-to-text model parameters for offline audio files." Icon={Server}>
                            <SettingField label="Whisper Model Size" desc="Faster-whisper model weight size used for CPU transcription (tiny, base, small, medium).">
                                <Input
                                    value="base"
                                    disabled
                                    className="h-11 rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-zinc-400"
                                />
                            </SettingField>
                        </SectionCard>
                    </motion.div>
                )}

                {/* Tab 3: Security & Datastores */}
                {tab === "security" && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <SectionCard title="User Account & Security Role" desc="Active user credentials and system permission role." Icon={User}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs p-3 rounded-xl bg-[#12121A] border border-[#1A1A24]">
                                <div>
                                    <span className="text-zinc-500 block">User Name:</span>
                                    <span className="font-bold text-white text-sm">{user?.name || "User"}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 block">Email Address:</span>
                                    <span className="font-bold text-white text-sm">{user?.email}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 block">System Role:</span>
                                    <span className="font-bold text-indigo-400 uppercase">{user?.role}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 block">Primary Database:</span>
                                    <span className="font-bold text-emerald-400">MongoDB Local Store</span>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="ChromaDB Persistence Path" desc="Local vector database storage directory location." Icon={HardDrive}>
                            <Input
                                value="./data/chroma"
                                disabled
                                className="h-11 rounded-xl border-[#1A1A24] bg-[#12121A] font-mono text-xs text-zinc-400"
                            />
                        </SectionCard>
                    </motion.div>
                )}
            </div>
        </AppShell>
    );
}
