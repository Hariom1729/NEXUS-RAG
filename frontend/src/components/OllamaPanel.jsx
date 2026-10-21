import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Copy, Check, Plug, Loader2, CircleCheck, CircleX, ChevronDown } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const STEPS = [
    { label: "Install Ollama", cmd: "curl -fsSL https://ollama.com/install.sh | sh" },
    { label: "Start the server", cmd: "ollama serve" },
    { label: "Pull Mistral-7B", cmd: "ollama pull mistral:7b" },
];

function CopyRow({ step, i }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard?.writeText(step.cmd);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
    };
    return (
        <div className="rounded-md border border-[#27272A] bg-[#0C0C0E]" data-testid={`ollama-step-${i}`}>
            <div className="flex items-center justify-between px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {i + 1}. {step.label}
                </span>
                <button onClick={copy} className="text-muted-foreground transition-colors hover:text-path-text" data-testid={`ollama-copy-${i}`}>
                    {copied ? <Check size={13} className="text-signal-success" /> : <Copy size={13} />}
                </button>
            </div>
            <pre className="overflow-x-auto border-t border-[#27272A] px-3 py-2 font-mono text-[12px] text-path-text">{step.cmd}</pre>
        </div>
    );
}

export function OllamaPanel({ host: initialHost, model: initialModel, onSwitch }) {
    const [host, setHost] = useState(initialHost || "http://localhost:11434");
    const [model, setModel] = useState(initialModel || "mistral:7b");
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState(null);
    const [guideOpen, setGuideOpen] = useState(true);

    const test = async () => {
        setTesting(true);
        setResult(null);
        try {
            const { data } = await api.post("/system/ollama/test", { host, model });
            setResult(data);
            if (data.reachable) {
                toast.success(data.loaded ? "Ollama reachable — model loaded!" : "Ollama reachable — pull the model");
            } else {
                toast.message("Ollama not reachable from the sandbox", {
                    description: "Run it on your machine, then test again to switch generation fully offline.",
                });
            }
        } catch {
            toast.error("Test failed");
        } finally {
            setTesting(false);
        }
    };

    const saveAndSwitch = async () => {
        try {
            const { data: cur } = await api.get("/settings");
            await api.put("/settings", { ...cur, ollama_host: host, ollama_model: model });
            toast.success("Saved — chat will use this Ollama endpoint when reachable");
            onSwitch?.();
        } catch {
            toast.error("Could not save");
        }
    };

    return (
        <div className="rounded-lg border border-[#27272A] bg-[#16161A] p-5" data-testid="ollama-panel">
            <div className="mb-4 flex items-center gap-2">
                <Terminal size={16} className="text-path-fused" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Live Offline Demo · point at local Mistral-7B
                </span>
            </div>

            {/* Guide */}
            <button
                onClick={() => setGuideOpen((o) => !o)}
                className="mb-3 flex w-full items-center justify-between rounded-md bg-[#0C0C0E] px-3 py-2 text-left"
                data-testid="ollama-guide-toggle"
            >
                <span className="text-sm font-medium">One-click setup guide</span>
                <ChevronDown size={16} className={`transition-transform ${guideOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
                {guideOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mb-4 space-y-2">
                            {STEPS.map((s, i) => <CopyRow key={i} step={s} i={i} />)}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Connection */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ollama host</label>
                    <Input value={host} onChange={(e) => setHost(e.target.value)} data-testid="ollama-host-input"
                        className="h-9 border-[#27272A] bg-[#0C0C0E] font-mono text-xs" />
                </div>
                <div>
                    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Model</label>
                    <Input value={model} onChange={(e) => setModel(e.target.value)} data-testid="ollama-model-input"
                        className="h-9 border-[#27272A] bg-[#0C0C0E] font-mono text-xs" />
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={test} disabled={testing} data-testid="ollama-test-button"
                    className="h-9 gap-2 rounded-full bg-path-fused px-4 text-[#0C0C0E] hover:bg-path-fused/90">
                    {testing ? <Loader2 className="animate-spin" size={15} /> : <Plug size={15} />} Test connection
                </Button>
                {result?.reachable && (
                    <Button onClick={saveAndSwitch} data-testid="ollama-switch-button"
                        className="h-9 gap-2 rounded-full bg-signal-success px-4 text-[#0C0C0E] hover:bg-signal-success/90">
                        <CircleCheck size={15} /> Use this endpoint
                    </Button>
                )}
            </div>

            {result && (
                <div className="mt-4 rounded-md border border-[#27272A] bg-[#0C0C0E] p-3 font-mono text-xs">
                    <div className={`flex items-center gap-1.5 ${result.reachable ? "text-signal-success" : "text-signal-danger"}`}>
                        {result.reachable ? <CircleCheck size={14} /> : <CircleX size={14} />}
                        {result.reachable ? "Reachable" : "Not reachable"} · {result.host}
                    </div>
                    <div className="mt-1.5 text-muted-foreground">
                        model <span className="text-foreground">{result.model}</span> · loaded{" "}
                        <span className={result.loaded ? "text-signal-success" : "text-signal-warning"}>{String(result.loaded)}</span>
                        {result.available_models?.length > 0 && (
                            <> · available: <span className="text-foreground">{result.available_models.join(", ")}</span></>
                        )}
                    </div>
                    {!result.reachable && (
                        <p className="mt-2 leading-relaxed text-muted-foreground">
                            Expected in this sandbox (no GPU). Run the steps above on your own machine — generation then
                            switches to Mistral-7B automatically, fully offline.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
