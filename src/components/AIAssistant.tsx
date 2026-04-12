"use client";

import { useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, ChevronDown, Loader2, CheckCircle, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAPABILITIES, type CapabilityId } from "@/lib/ai-capabilities";

type AssistantState = "idle" | "processing" | "preview" | "error";

interface PreviewData {
  capabilityName: string;
  outputDescription: string;
  data: Record<string, unknown> | null;
  rawResponse: string | null;
}

interface AIAssistantProps {
  // Called when user confirms — receives the parsed data for the page to act on
  onConfirm: (capabilityId: CapabilityId, data: Record<string, unknown>) => void;
  // Optional: restrict which capabilities are available on this page
  allowedCapabilities?: CapabilityId[];
  // Optional: extra context to send with the request (e.g. existing team names)
  context?: Record<string, unknown>;
}

export function AIAssistant({ onConfirm, allowedCapabilities, context }: AIAssistantProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [capabilityId, setCapabilityId] = useState<CapabilityId | "auto">("auto");
  const [state, setState] = useState<AssistantState>("idle");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCapabilityId, setResolvedCapabilityId] = useState<CapabilityId | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const availableCapabilities = allowedCapabilities
    ? Object.values(CAPABILITIES).filter(c => allowedCapabilities.includes(c.id))
    : Object.values(CAPABILITIES).filter(c => c.id !== "general");

  async function handleSubmit() {
    if (!rawText.trim() && !instruction.trim()) return;

    setState("processing");
    setError(null);
    setPreview(null);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          instruction,
          page: pathname,
          capabilityId: capabilityId === "auto" ? undefined : capabilityId,
          context,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        setState("error");
        return;
      }

      setResolvedCapabilityId(json.capabilityId);
      setPreview({
        capabilityName: json.capabilityName,
        outputDescription: json.outputDescription,
        data: json.data,
        rawResponse: json.rawResponse,
      });
      setState("preview");
    } catch {
      setError("Network error — please try again");
      setState("error");
    }
  }

  function handleConfirm() {
    if (!preview?.data || !resolvedCapabilityId) return;
    onConfirm(resolvedCapabilityId, preview.data as Record<string, unknown>);
    reset();
    setOpen(false);
  }

  function reset() {
    setRawText("");
    setInstruction("");
    setCapabilityId("auto");
    setState("idle");
    setPreview(null);
    setError(null);
    setResolvedCapabilityId(null);
  }

  const previewCount = preview?.data
    ? Object.values(preview.data).find(v => Array.isArray(v))?.length ?? null
    : null;

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-full shadow-lg hover:bg-primary/90 transition-all text-sm font-medium"
        >
          <Sparkles size={15} />
          AI Assistant
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-primary" />
              <span className="font-semibold text-sm text-foreground">AI Assistant</span>
            </div>
            <button onClick={() => { setOpen(false); reset(); }} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-3">
            {state === "idle" || state === "error" ? (
              <>
                {/* Capability selector */}
                <div className="relative">
                  <select
                    value={capabilityId}
                    onChange={e => setCapabilityId(e.target.value as CapabilityId | "auto")}
                    className="w-full appearance-none text-xs bg-muted border border-border rounded-lg px-3 py-2 pr-7 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="auto">Auto-detect from page + instruction</option>
                    {availableCapabilities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>

                {/* Paste area */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                    Paste your data
                  </label>
                  <textarea
                    ref={pasteRef}
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder="Paste a fixture list, scorecard, member list, email… anything"
                    className="w-full h-32 text-sm bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                {/* Instruction */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                    What do you want to do?
                  </label>
                  <input
                    type="text"
                    value={instruction}
                    onChange={e => setInstruction(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    placeholder="e.g. Add these as Sabres fixtures for 2025/26"
                    className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!rawText.trim() && !instruction.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles size={14} />
                  Process
                </button>
              </>
            ) : state === "processing" ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 size={28} className="animate-spin text-primary" />
                <p className="text-sm">Thinking…</p>
              </div>
            ) : state === "preview" && preview ? (
              <>
                {/* Preview header */}
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={15} className="text-green-500 shrink-0" />
                  <span className="font-medium text-foreground">
                    {previewCount !== null
                      ? `Found ${previewCount} ${preview.outputDescription}`
                      : `Ready to import ${preview.outputDescription}`}
                  </span>
                </div>

                {/* Preview data */}
                {preview.data && (
                  <div className="bg-muted rounded-lg p-3 max-h-52 overflow-y-auto">
                    <PreviewTable data={preview.data} />
                  </div>
                )}

                {/* Warnings */}
                {preview.data && Array.isArray((preview.data as { warnings?: unknown[] }).warnings) && (preview.data as { warnings: string[] }).warnings.length > 0 && (
                  <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 space-y-0.5">
                    <p className="font-medium mb-1">Warnings:</p>
                    {(preview.data as { warnings: string[] }).warnings.map((w, i) => (
                      <p key={i}>• {w}</p>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Confirm & Import
                  </button>
                  <button
                    onClick={reset}
                    className="flex items-center justify-center w-10 h-10 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Start over"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function PreviewTable({ data }: { data: Record<string, unknown> }) {
  // Find the main array in the data object
  const arrayEntry = Object.entries(data).find(([, v]) => Array.isArray(v));
  if (!arrayEntry) {
    return <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
  }

  const [, rows] = arrayEntry;
  const typedRows = rows as Record<string, unknown>[];
  if (!typedRows.length) return <p className="text-xs text-muted-foreground">No records found</p>;

  const keys = Object.keys(typedRows[0]).filter(k => k !== "holeScores");

  return (
    <table className="w-full text-xs">
      <thead>
        <tr>
          {keys.map(k => (
            <th key={k} className="text-left text-muted-foreground font-medium pb-1.5 pr-3 whitespace-nowrap">
              {k.replace(/([A-Z])/g, ' $1').trim()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {typedRows.slice(0, 10).map((row, i) => (
          <tr key={i} className={cn("border-t border-border/50", i % 2 === 0 ? "" : "bg-background/50")}>
            {keys.map(k => (
              <td key={k} className="py-1 pr-3 text-foreground">
                {row[k] == null ? <span className="text-muted-foreground/50">—</span> : String(row[k])}
              </td>
            ))}
          </tr>
        ))}
        {typedRows.length > 10 && (
          <tr>
            <td colSpan={keys.length} className="pt-1.5 text-muted-foreground text-center">
              +{typedRows.length - 10} more
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
