import { useState } from "react";
import { FileSpreadsheet, FileText, FileType2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BACKEND_URL, getToken } from "@/lib/api";

const ICONS = { xlsx: FileSpreadsheet, csv: FileSpreadsheet, docx: FileText, pdf: FileType2 };
const COLORS = { xlsx: "text-emerald-400", csv: "text-emerald-400", docx: "text-sky-400", pdf: "text-rose-400" };

function fmtSize(n) {
    if (!n) return "";
    return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export function FileCard({ file }) {
    const [busy, setBusy] = useState(false);
    if (!file) return null;
    const Icon = ICONS[file.filetype] || FileText;

    const download = async () => {
        setBusy(true);
        try {
            const resp = await fetch(`${BACKEND_URL || ""}${file.url}`, {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (!resp.ok) throw new Error(resp.status === 404 ? "File no longer exists" : "Download failed");
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.display_name || file.filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="my-2 flex max-w-md items-center gap-3 rounded-xl border border-[#2A2A3A] bg-[#12121A] p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#1A1A28]">
                <Icon size={22} className={COLORS[file.filetype] || "text-indigo-400"} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-100">{file.display_name}</div>
                <div className="font-mono text-[10px] uppercase text-zinc-500">{file.filetype} · {fmtSize(file.size_bytes)}</div>
            </div>
            <button
                onClick={download}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download
            </button>
        </div>
    );
}

export default FileCard;
