import { useEffect, useState } from "react";
import {
    ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Users, FileStack, MessagesSquare, Boxes, ShieldCheck, Loader2, Sparkles, Activity } from "lucide-react";
import api from "@/lib/api";
import { AppShell } from "@/components/AppShell";

const MOD_COLORS = { document: "#818CF8", image: "#FBBF24", audio: "#34D399" };
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

function Kpi({ label, value, Icon, accent, sub }) {
    return (
        <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-xl flex flex-col justify-between space-y-3 hover:border-indigo-500/40 transition-all">
            <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</span>
                <Icon size={18} style={{ color: accent }} />
            </div>
            <div>
                <p className="font-heading text-4xl font-black tracking-tight" style={{ color: accent }}>{value}</p>
                {sub && <p className="mt-1 font-mono text-[11px] text-zinc-500">{sub}</p>}
            </div>
        </div>
    );
}

export default function Admin() {
    const [d, setD] = useState(null);

    useEffect(() => { api.get("/admin/stats").then(({ data }) => setD(data)).catch(() => {}); }, []);

    if (!d) return (
        <AppShell>
            <div className="p-8 font-mono text-xs text-zinc-400 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-indigo-400" /> Fetching admin telemetry analytics…
            </div>
        </AppShell>
    );

    const modalityData = Object.entries(d.by_modality || {}).map(([name, value]) => ({ name, value }));
    const statusData = Object.entries(d.by_status || {}).map(([name, value]) => ({ name, value }));
    const totalVectors = (d.vector_store?.text_vectors || 0) + (d.vector_store?.visual_vectors || 0);

    return (
        <AppShell>
            <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 font-mono text-[10px] font-extrabold text-amber-400">
                        <ShieldCheck size={13} /> Top 0.001% Administrator Console
                    </div>
                    <h1 className="font-heading text-3xl font-black tracking-tight text-white">Admin Operations & Analytics</h1>
                    <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
                        Monitor system-wide user profiles, corpus growth metrics, modality distribution, and ChromaDB vector store health.
                    </p>
                </div>

                {/* KPI Bento Cards */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Kpi label="Total Registered Users" value={d.totals.users} sub="Active Profiles" Icon={Users} accent="#818CF8" />
                    <Kpi label="Total Corpus Documents" value={d.totals.documents} sub="Ingested Files" Icon={FileStack} accent="#FBBF24" />
                    <Kpi label="Active Conversations" value={d.totals.conversations} sub="Chat Threads" Icon={MessagesSquare} accent="#F43F5E" />
                    <Kpi label="ChromaDB HNSW Vectors" value={totalVectors} sub="Cosine Space" Icon={Boxes} accent="#34D399" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Modality Pie */}
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-xl space-y-4">
                        <div className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-[#1A1A24] pb-3.5 flex justify-between items-center">
                            <span>Documents by Modality Breakdown</span>
                            <Sparkles size={14} className="text-indigo-400" />
                        </div>
                        {d.totals.documents === 0 ? (
                            <p className="py-16 text-center font-mono text-xs text-zinc-500">No documents ingested in database yet.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie data={modalityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4}>
                                        {modalityData.map((e) => <Cell key={e.name} fill={MOD_COLORS[e.name] || "#818CF8"} stroke="#030305" strokeWidth={2} />)}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                        <div className="flex justify-center gap-6 pt-1">
                            {modalityData.map((e) => (
                                <span key={e.name} className="flex items-center gap-2 font-mono text-xs font-medium text-zinc-300">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: MOD_COLORS[e.name] || "#818CF8" }} />
                                    {e.name}: <strong className="text-white">{e.value}</strong>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Status Distribution Bar */}
                    <div className="rounded-2xl border border-[#1A1A24] bg-[#0E0E14] p-5 shadow-xl space-y-4">
                        <div className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-[#1A1A24] pb-3.5 flex justify-between items-center">
                            <span>Ingestion Pipeline Status Breakdown</span>
                            <Activity size={14} className="text-emerald-400" />
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={statusData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                <CartesianGrid stroke="#1A1A24" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" stroke={AXIS} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                                <YAxis stroke={AXIS} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} allowDecimals={false} />
                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
                                <Bar dataKey="value" fill="#818CF8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* User Table */}
                <div className="overflow-x-auto rounded-2xl border border-[#1A1A24] bg-[#0E0E14] shadow-2xl">
                    <table className="w-full min-w-[560px] text-xs">
                        <thead>
                            <tr className="border-b border-[#1A1A24] bg-[#121218] font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                <th className="px-4 py-3.5 text-left">User Profile</th>
                                <th className="px-4 py-3.5 text-left">Email Address</th>
                                <th className="px-4 py-3.5 text-left">Role</th>
                                <th className="px-4 py-3.5 text-right">Documents</th>
                                <th className="px-4 py-3.5 text-right">Conversations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1A1A24]">
                            {d.users.map((u, i) => (
                                <tr key={i} className="hover:bg-[#12121A]/70 transition-colors" data-testid={`admin-user-${i}`}>
                                    <td className="px-4 py-3.5 font-bold text-white">{u.name || "Anonymous User"}</td>
                                    <td className="px-4 py-3.5 font-mono text-xs text-zinc-400">{u.email}</td>
                                    <td className="px-4 py-3.5">
                                        <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${u.role === "admin" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-zinc-800 text-zinc-400"}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-mono text-indigo-300 font-bold">{u.documents}</td>
                                    <td className="px-4 py-3.5 text-right font-mono text-indigo-300 font-bold">{u.conversations}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppShell>
    );
}
