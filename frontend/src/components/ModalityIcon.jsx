import { FileText, Image as ImageIcon, AudioLines, File } from "lucide-react";

const MAP = {
    document: { Icon: FileText, color: "#818CF8", label: "DOC" },
    image: { Icon: ImageIcon, color: "#FBBF24", label: "IMG" },
    audio: { Icon: AudioLines, color: "#34D399", label: "AUD" },
};

export function ModalityIcon({ modality, size = 16, showLabel = false, className = "" }) {
    const conf = MAP[modality] || { Icon: File, color: "#A1A1AA", label: "?" };
    const { Icon, color, label } = conf;
    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`} data-testid={`modality-${modality}`}>
            <Icon size={size} style={{ color }} strokeWidth={2} />
            {showLabel && (
                <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color }}>
                    {label}
                </span>
            )}
        </span>
    );
}
