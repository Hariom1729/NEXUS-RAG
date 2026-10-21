import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Hexagon, ShieldCheck, WifiOff, Database, Loader2, ArrowRight, KeyRound, Cpu, Layers } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
    const { login, register, formatApiErrorDetail } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState("login");
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === "login") await login(form.email, form.password);
            else await register(form.name, form.email, form.password);
            navigate("/chat");
        } catch (err) {
            toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
        } finally {
            setLoading(false);
        }
    };

    const fillAdmin = () => {
        setForm({ name: "", email: "admin@nexusrag.ai", password: "admin123" });
        toast.info("Admin credentials quick-filled!");
    };

    return (
        <div className="flex min-h-screen w-full bg-[#030305] text-foreground mesh-cyberpunk selection:bg-indigo-500/30 selection:text-white overflow-hidden p-0 sm:p-4">
            {/* Holographic Portal Container */}
            <div className="relative flex w-full flex-col lg:flex-row rounded-none sm:rounded-3xl border-0 sm:border border-[#1A1A24] bg-[#0A0A0F]/85 backdrop-blur-2xl shadow-2xl overflow-hidden">
                {/* Left Column — Holographic Architectural Portal */}
                <div className="relative flex w-full lg:w-7/12 flex-col justify-between overflow-hidden p-8 sm:p-12 bg-gradient-to-br from-[#0A0A0F] via-[#101018] to-[#030305] border-b lg:border-b-0 lg:border-r border-[#1A1A24]">
                    {/* Ambient Glowing Orbs */}
                    <div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
                    <div className="absolute bottom-1/4 right-0 h-96 w-96 rounded-full bg-pink-600/15 blur-3xl pointer-events-none" />

                    {/* Brand Banner */}
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 text-white shadow-xl shadow-indigo-500/30">
                            <Hexagon strokeWidth={2.5} size={24} />
                        </div>
                        <div>
                            <span className="font-heading text-2xl font-black tracking-tight text-white block">NEXUS-RAG</span>
                            <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest">Offline Multimodal Engine</span>
                        </div>
                    </div>

                    {/* Holographic Target Feature Visual */}
                    <div className="relative z-10 my-auto max-w-xl space-y-8 py-10">
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-1.5 font-mono text-xs font-bold text-indigo-300 shadow-md">
                            <Cpu size={15} className="text-indigo-400" /> Grounded Dual-Modality Vector Search
                        </div>

                        <h1 className="font-heading text-4xl sm:text-5xl font-black leading-tight tracking-tight text-white">
                            Private Multimodal Knowledge Engine.
                        </h1>

                        <p className="text-xs sm:text-sm leading-relaxed text-zinc-400">
                            Ingest PDF, DOCX, image previews, and audio recordings into isolated vector collections with <span className="text-indigo-300 font-bold">MiniLM</span> & <span className="text-amber-300 font-bold">CLIP</span>. Query local LLMs completely offline with cited context grounding.
                        </p>

                        {/* Feature Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                            {[
                                { title: "Offline First", desc: "Local HNSW & Ollama", icon: WifiOff, color: "text-indigo-400" },
                                { title: "Dual Embedding", desc: "Text & Visual RRF", icon: Layers, color: "text-amber-400" },
                                { title: "Private Engine", desc: "Zero Cloud Leakage", icon: ShieldCheck, color: "text-emerald-400" },
                            ].map((item, idx) => (
                                <div key={idx} className="rounded-2xl border border-[#1A1A24] bg-[#12121A]/80 p-4 backdrop-blur-xl shadow-xl">
                                    <item.icon size={20} className={`${item.color} mb-2`} />
                                    <h4 className="font-heading text-xs font-bold text-white">{item.title}</h4>
                                    <p className="font-mono text-[10px] text-zinc-500 mt-0.5">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Credits */}
                    <div className="relative z-10 flex items-center justify-between border-t border-[#1A1A24]/60 pt-6 font-mono text-[11px] text-zinc-500">
                        <span>B.E. CSE CAPSTONE PROJECT</span>
                        <div className="flex gap-4">
                            <span>ChromaDB v1.5</span>
                            <span>•</span>
                            <span>Mistral-7B / Qwen2.5</span>
                        </div>
                    </div>
                </div>

                {/* Right Column — Form Console */}
                <div className="flex w-full lg:w-5/12 items-center justify-center p-6 sm:p-12 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="w-full max-w-md"
                    >
                        {/* Mode Switch Tabs */}
                        <div className="mb-6 flex rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-1.5 shadow-inner">
                            <button
                                type="button"
                                onClick={() => setMode("login")}
                                className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all ${
                                    mode === "login"
                                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
                                        : "text-zinc-400 hover:text-white"
                                }`}
                            >
                                Sign In
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode("register")}
                                className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all ${
                                    mode === "register"
                                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
                                        : "text-zinc-400 hover:text-white"
                                }`}
                            >
                                Create Account
                            </button>
                        </div>

                        {/* Header */}
                        <div className="space-y-1.5 text-center lg:text-left">
                            <h2 className="font-heading text-3xl font-black tracking-tight text-white">
                                {mode === "login" ? "Welcome back" : "Create account"}
                            </h2>
                            <p className="text-xs text-zinc-400">
                                {mode === "login"
                                    ? "Enter your credentials to access your private offline workspace."
                                    : "Initialize a isolated user profile for local document ingestion."}
                            </p>
                        </div>

                        {/* Quick Admin Fill Pill */}
                        {mode === "login" && (
                            <div className="mt-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 flex items-center justify-between shadow-xl">
                                <div className="flex items-center gap-2.5">
                                    <KeyRound size={16} className="text-indigo-400" />
                                    <span className="font-mono text-xs font-bold text-indigo-300">Default Admin Account</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={fillAdmin}
                                    className="rounded-xl bg-indigo-600 px-3.5 py-1 font-mono text-[11px] font-extrabold text-white hover:bg-indigo-500 transition-colors shadow-md"
                                >
                                    Quick Fill
                                </button>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={submit} className="mt-6 space-y-4" data-testid="auth-form">
                            <AnimatePresence mode="wait">
                                {mode === "register" && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-1.5"
                                    >
                                        <Label htmlFor="name" className="text-xs font-bold text-zinc-300">Full Name</Label>
                                        <Input
                                            id="name"
                                            data-testid="auth-name-input"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="Dr. Alex Vance"
                                            className="h-11 rounded-xl border-[#1A1A24] bg-[#12121A] text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-indigo-500/20"
                                            required
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-xs font-bold text-zinc-300">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    data-testid="auth-email-input"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="user@nexusrag.ai"
                                    className="h-11 rounded-xl border-[#1A1A24] bg-[#12121A] text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-indigo-500/20"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="text-xs font-bold text-zinc-300">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    data-testid="auth-password-input"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    placeholder="••••••••"
                                    className="h-11 rounded-xl border-[#1A1A24] bg-[#12121A] text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-indigo-500/20"
                                    required
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                data-testid="auth-submit-button"
                                className="mt-6 w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-xs font-extrabold text-white shadow-xl shadow-indigo-500/25 hover:opacity-95 transition-all"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin text-white" size={18} />
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        {mode === "login" ? "Sign In to Workspace" : "Create Workspace Profile"}
                                        <ArrowRight size={15} />
                                    </span>
                                )}
                            </Button>
                        </form>

                        {/* Mode Switcher */}
                        <div className="mt-6 text-center">
                            <button
                                type="button"
                                data-testid="auth-toggle-mode"
                                onClick={() => setMode(mode === "login" ? "register" : "login")}
                                className="text-xs text-zinc-400 hover:text-indigo-400 transition-colors font-bold"
                            >
                                {mode === "login"
                                    ? "Need an account? Register here"
                                    : "Already registered? Log in instead"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
