import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Download, FileSpreadsheet } from "lucide-react";

function csvEscape(v) {
    const s = String(v ?? "").replace(/\r?\n/g, " ").trim();
    return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function tableToCsv(tableEl) {
    return Array.from(tableEl.querySelectorAll("tr"))
        .map((tr) => Array.from(tr.children).map((c) => csvEscape(c.innerText)).join(","))
        .join("\n");
}

function tableToTsv(tableEl) {
    return Array.from(tableEl.querySelectorAll("tr"))
        .map((tr) => Array.from(tr.children).map((c) => c.innerText.replace(/\s+/g, " ").trim()).join("\t"))
        .join("\n");
}

function MdTable({ children }) {
    const ref = useRef(null);
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        if (!ref.current) return;
        try {
            await navigator.clipboard.writeText(tableToTsv(ref.current)); // pastes cleanly into Excel / Google Sheets
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard blocked */ }
    };
    const downloadCsv = () => {
        if (!ref.current) return;
        const blob = new Blob(["\uFEFF" + tableToCsv(ref.current)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `extracted_data_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="my-4 overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#0B0B14] shadow-2xl backdrop-blur-xl">
            {/* Attractive Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 bg-gradient-to-r from-[#141424] via-[#10101C] to-[#0A0A12] px-4 py-2.5 font-mono text-xs">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
                        <FileSpreadsheet size={13} />
                    </div>
                    <span className="font-semibold text-white tracking-wide">Structured Extracted Data</span>
                    <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                        Interactive Table
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={copy}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-zinc-300 hover:text-white hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-all text-[11px]"
                        title="Copy table to paste into Excel or Sheets"
                    >
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copied ? "Copied Excel" : "Copy Table"}</span>
                    </button>
                    <button
                        onClick={downloadCsv}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-emerald-300 hover:bg-emerald-500/25 hover:text-white hover:border-emerald-500/60 transition-all font-bold text-[11px] shadow-sm shadow-emerald-500/10"
                        title="Download extracted data as a CSV spreadsheet"
                    >
                        <Download size={12} />
                        <span>Download CSV</span>
                    </button>
                </div>
            </div>
            {/* Scrollable Table View */}
            <div className="overflow-x-auto">
                <table ref={ref} className="w-full border-collapse text-xs sm:text-sm">{children}</table>
            </div>
        </div>
    );
}

function CodeBlock({ language, text }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard blocked */ }
    };
    return (
        <div className="my-3 overflow-hidden rounded-xl border border-[#2A2A3A] bg-[#0A0A10]">
            <div className="flex items-center justify-between border-b border-[#2A2A3A] bg-[#12121A] px-3 py-1.5 font-mono text-[10px] text-zinc-400">
                <span>{language || "code"}</span>
                <button onClick={copy} className="flex items-center gap-1 hover:text-white">
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />} {copied ? "Copied" : "Copy code"}
                </button>
            </div>
            <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-zinc-200"><code>{text}</code></pre>
        </div>
    );
}

const components = {
    table: MdTable,
    thead: ({ children }) => <thead className="bg-[#141424] text-indigo-300">{children}</thead>,
    th: ({ children, style }) => (
        <th style={style} className="border-b border-indigo-500/30 px-4 py-3 text-left font-bold text-indigo-200 tracking-wider uppercase text-[11px]">{children}</th>
    ),
    td: ({ children, style }) => (
        <td style={style} className="border-t border-white/5 px-4 py-3 align-middle text-zinc-200 text-xs sm:text-sm">{children}</td>
    ),
    tr: ({ children }) => <tr className="even:bg-white/[0.02] hover:bg-indigo-500/[0.05] transition-colors">{children}</tr>,
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children }) => {
        const text = String(children ?? "");
        const match = /language-(\w+)/.exec(className || "");
        if (match || text.includes("\n")) {
            return <CodeBlock language={match?.[1]} text={text.replace(/\n$/, "")} />;
        }
        return <code className="rounded bg-indigo-950/50 border border-indigo-500/30 px-1.5 py-0.5 font-mono text-[0.85em] text-indigo-300">{children}</code>;
    },
    h1: ({ children }) => <h1 className="mb-2.5 mt-4 text-xl font-bold text-white flex items-center gap-2">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-2 mt-3.5 text-lg font-bold text-white border-b border-white/10 pb-1.5">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm sm:text-base font-semibold text-indigo-300">{children}</h3>,
    p: ({ children }) => <p className="my-2 leading-relaxed text-zinc-200">{children}</p>,
    ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1 text-zinc-300">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1 text-zinc-300">{children}</ol>,
    a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">{children}</a>,
    blockquote: ({ children }) => <blockquote className="my-3 border-l-3 border-indigo-500/80 bg-indigo-950/20 rounded-r-xl px-4 py-2.5 text-zinc-200 shadow-sm">{children}</blockquote>,
    hr: () => <hr className="my-3 border-white/10" />,
    strong: ({ children }) => <strong className="font-semibold text-white bg-indigo-500/10 px-1 py-0.5 rounded text-indigo-200">{children}</strong>,
};

export function Markdown({ children }) {
    return (
        <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children || ""}</ReactMarkdown>
        </div>
    );
}

export default Markdown;
