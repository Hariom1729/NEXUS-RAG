import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessagesSquare, UploadCloud, Database, BarChart3, Cpu, Settings2,
    ShieldCheck, LogOut, Hexagon, GitCompareArrows, ChevronRight, Menu, X, Sparkles, Command,
    BrainCircuit, ScanEye
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

const NAV = [
    { to: "/chat", label: "Chat Studio", Icon: MessagesSquare, testid: "nav-chat" },
    { to: "/ingest", label: "Ingest Portal", Icon: UploadCloud, testid: "nav-ingest" },
    { to: "/knowledge", label: "Knowledge Base", Icon: Database, testid: "nav-knowledge" },
    { to: "/playground", label: "Neural Playground", Icon: BrainCircuit, testid: "nav-playground" },
    { to: "/inspector", label: "Vector Inspector", Icon: ScanEye, testid: "nav-inspector" },
    { to: "/dashboard", label: "Explainability", Icon: BarChart3, testid: "nav-dashboard" },
    { to: "/compare", label: "Vector Compare", Icon: GitCompareArrows, testid: "nav-compare" },
    { to: "/system", label: "System Status", Icon: Cpu, testid: "nav-system" },
    { to: "/settings", label: "Settings", Icon: Settings2, testid: "nav-settings" },
];

export function AppShell({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState(null);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        api.get("/system/status").then(({ data }) => setStatus(data)).catch(() => {});
    }, []);

    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const onLogout = async () => {
        await logout();
        navigate("/login");
    };

    const vectors = status
        ? (status.vector_store.text_vectors || 0) + (status.vector_store.visual_vectors || 0)
        : null;

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#030305] text-[#F4F4F5] mesh-cyberpunk p-0 sm:p-3 sm:gap-3">
            {/* Floating Glass Capsule Dock Sidebar (Desktop) */}
            <aside className="hidden md:flex w-64 shrink-0 flex-col rounded-3xl border border-[#1A1A24] bg-[#0A0A0F]/85 backdrop-blur-2xl shadow-2xl z-20 overflow-hidden">
                {/* Brand Capsule Header */}
                <div className="flex items-center justify-between px-5 h-16 border-b border-[#1A1A24]/70 bg-gradient-to-r from-indigo-500/10 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-lg shadow-indigo-500/30">
                            <Hexagon strokeWidth={2.5} size={20} />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-heading font-black tracking-tight text-sm text-white flex items-center gap-1.5">
                                NEXUS-RAG
                                <span className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-1.5 py-0.2 font-mono text-[9px] font-black text-white shadow-sm">
                                    AI
                                </span>
                            </span>
                            <span className="font-mono text-[10px] text-zinc-500">Offline Multi-Modal Engine</span>
                        </div>
                    </div>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
                    <div className="px-3 pb-2 flex items-center justify-between font-mono text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-500">
                        <span>Workspace Dock</span>
                        <Command size={11} className="text-zinc-600" />
                    </div>
                    {NAV.map(({ to, label, Icon, testid }) => (
                        <NavLink
                            key={to}
                            to={to}
                            data-testid={testid}
                            className={({ isActive }) =>
                                `relative group flex items-center justify-between rounded-2xl px-3.5 py-2 text-xs font-bold transition-all duration-250 ${
                                    isActive
                                        ? "bg-gradient-to-r from-indigo-600/25 via-purple-600/15 to-transparent text-white border-l-3 border-indigo-400 shadow-xl shadow-indigo-500/15"
                                        : "text-zinc-400 hover:bg-[#12121A] hover:text-zinc-100"
                                }`
                            }
                        >
                            <div className="flex items-center gap-3">
                                <Icon size={16} strokeWidth={2} className="transition-transform duration-200 group-hover:scale-110 text-indigo-400" />
                                <span>{label}</span>
                            </div>
                            <ChevronRight size={13} className="opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-60 group-hover:translate-x-0 text-zinc-400" />
                        </NavLink>
                    ))}

                    {user?.role === "admin" && (
                        <>
                            <div className="my-2 border-t border-[#1A1A24]/60" />
                            <div className="px-3 pb-1.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-500">
                                Management
                            </div>
                            <NavLink
                                to="/admin"
                                data-testid="nav-admin"
                                className={({ isActive }) =>
                                    `relative group flex items-center justify-between rounded-2xl px-3.5 py-2 text-xs font-bold transition-all duration-250 ${
                                        isActive
                                            ? "bg-gradient-to-r from-amber-500/25 via-amber-500/10 to-transparent text-white border-l-3 border-amber-400 shadow-xl shadow-amber-500/15"
                                            : "text-zinc-400 hover:bg-[#12121A] hover:text-zinc-100"
                                    }`
                                }
                            >
                                <div className="flex items-center gap-3">
                                    <ShieldCheck size={16} strokeWidth={2} className="text-amber-400" />
                                    <span>Admin Panel</span>
                                </div>
                                <ChevronRight size={13} className="opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-60 group-hover:translate-x-0 text-zinc-400" />
                            </NavLink>
                        </>
                    )}
                </nav>

                {/* Offline Status Card */}
                <div className="mx-3 mb-3 rounded-2xl border border-[#1A1A24] bg-gradient-to-b from-[#12121A] to-[#0A0A0F] p-3.5 shadow-2xl" data-testid="offline-status-card">
                    <div className="flex items-center justify-between border-b border-[#1A1A24]/60 pb-2.5">
                        <div className="flex items-center gap-2">
                            <span className="status-dot-live h-2.5 w-2.5 rounded-full bg-emerald-400" />
                            <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                                Offline Engine Active
                            </span>
                        </div>
                        <Sparkles size={13} className="text-indigo-400 animate-pulse" />
                    </div>
                    <div className="mt-2.5 space-y-1.5 font-mono text-[11px]">
                        <div className="flex justify-between items-center text-zinc-400">
                            <span>HNSW Vectors:</span>
                            <span className="text-white font-extrabold bg-zinc-800/80 px-2 py-0.5 rounded-md text-[10px]">
                                {vectors !== null ? `${vectors}` : "active"}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-zinc-400">
                            <span>LLM Core:</span>
                            <span className="text-indigo-400 font-extrabold truncate max-w-[110px]">
                                {status?.llm_backend?.mode === "ollama" ? "mistral:7b" : "cloud · fallback"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* User Profile Capsule */}
                <div className="border-t border-[#1A1A24] p-3 bg-[#07070A]">
                    <div className="flex items-center gap-3 rounded-2xl bg-[#12121A] border border-[#1A1A24] p-2.5 transition-colors hover:border-zinc-700">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 font-heading text-sm font-black text-white shadow-md">
                            {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-white">{user?.name || "User"}</p>
                            <p className="truncate font-mono text-[10px] text-zinc-400">{user?.email}</p>
                        </div>
                        <button
                            onClick={onLogout}
                            data-testid="logout-button"
                            className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                            title="Logout"
                            aria-label="Log out"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden sm:rounded-3xl border-0 sm:border border-[#1A1A24] bg-[#0A0A0F]/70 backdrop-blur-xl shadow-2xl">
                {/* Mobile Top Header */}
                <header className="flex md:hidden items-center justify-between border-b border-[#1A1A24] bg-[#0A0A0F] px-4 h-14 z-30">
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="rounded-xl border border-[#1A1A24] p-1.5 text-zinc-400 hover:text-white"
                            aria-label="Toggle menu"
                        >
                            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <div className="flex items-center gap-2">
                            <Hexagon className="text-indigo-400" size={20} strokeWidth={2.5} />
                            <span className="font-heading font-black tracking-tight text-white">NEXUS-RAG</span>
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        data-testid="logout-button-mobile"
                        className="rounded-xl p-1.5 text-zinc-400 hover:text-rose-400 transition-colors"
                        aria-label="Log out"
                    >
                        <LogOut size={18} />
                    </button>
                </header>

                {/* Mobile Drawer */}
                <AnimatePresence>
                    {mobileOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden border-b border-[#1A1A24] bg-[#0A0A0F] px-4 py-3 space-y-1 z-20 shadow-2xl"
                        >
                            {NAV.map(({ to, label, Icon }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold ${
                                            isActive
                                                ? "bg-indigo-500/20 text-indigo-400"
                                                : "text-zinc-400 hover:bg-[#12121A] hover:text-white"
                                        }`
                                    }
                                >
                                    <Icon size={16} />
                                    <span>{label}</span>
                                </NavLink>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Page Render Container */}
                <motion.main
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="min-h-0 flex-1 overflow-y-auto bg-[#030305]"
                >
                    {children}
                </motion.main>
            </div>
        </div>
    );
}
