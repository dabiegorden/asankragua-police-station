"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  PenLine,
  Eraser,
  Loader2,
  FileSignature,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SignCaseBookDialogProps {
  caseId: string;
  caseNumber: string;
  /** Render-prop-free trigger: pass classes to style the default trigger button */
  triggerClassName?: string;
  triggerLabel?: string;
  size?: "sm" | "md" | "lg";
  /** Render the trigger as a compact icon-only quick action */
  iconOnly?: boolean;
}

type BusyAction = "print" | "download" | null;

// ─────────────────────────────────────────────────────────────────────────────
// Signature pad — lightweight canvas drawing (mouse + touch), no dependency
// ─────────────────────────────────────────────────────────────────────────────
function useSignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  const pos = (e: PointerEvent | React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasInk.current = true;
    if (isEmpty) setIsEmpty(false);
  };

  const end = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasInk.current = false;
    setIsEmpty(true);
  };

  const toDataUrl = (): string | null => {
    if (!hasInk.current || !canvasRef.current) return null;
    // White background so the signature reads on any viewer.
    const src = canvasRef.current;
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext("2d");
    if (!ctx) return src.toDataURL("image/png");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    return out.toDataURL("image/png");
  };

  return {
    canvasRef,
    isEmpty,
    setupCanvas,
    start,
    move,
    end,
    clear,
    toDataUrl,
  };
}

export function SignCaseBookDialog({
  caseId,
  caseNumber,
  triggerClassName = "",
  triggerLabel = "Print & Sign",
  size = "sm",
  iconOnly = false,
}: SignCaseBookDialogProps) {
  const [open, setOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const busy = busyAction !== null;
  const pad = useSignaturePad();

  const sizeClasses = {
    sm: "h-7 px-2.5 text-xs gap-1.5",
    md: "h-9 px-4 text-sm gap-2",
    lg: "h-11 px-5 text-base gap-2.5",
  }[size];
  const iconSize = { sm: 12, md: 14, lg: 16 }[size];

  // Initialise the canvas once the dialog has painted.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => pad.setupCanvas(), 50);
      return () => clearTimeout(t);
    }
  }, [open, pad]);

  async function fetchSignedBlob(): Promise<Blob> {
    const dataUrl = pad.toDataUrl();
    if (!dataUrl) throw new Error("Please draw your signature first");

    const res = await fetch(`/api/cases/${caseId}/pdf`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatureDataUrl: dataUrl }),
    });

    if (!res.ok) {
      try {
        const err = await res.json();
        throw new Error(err.error || `Server error ${res.status}`);
      } catch {
        throw new Error(`Signed PDF generation failed (${res.status})`);
      }
    }
    return res.blob();
  }

  async function handleDownload() {
    if (busy) return;
    setBusyAction("download");
    try {
      const blob = await fetchSignedBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CaseBook-${caseNumber}-signed-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Signed case book downloaded successfully");
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download signed PDF",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePrint() {
    if (busy) return;
    setBusyAction("print");
    try {
      const blob = await fetchSignedBlob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        // Popup blocked — fall back to opening in a hidden frame.
        const frame = document.createElement("iframe");
        frame.style.display = "none";
        frame.src = url;
        document.body.appendChild(frame);
        frame.onload = () => frame.contentWindow?.print();
      } else {
        win.addEventListener("load", () => win.print());
      }
      toast.success("Opening signed case book for printing");
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to prepare print",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <button
            type="button"
            title={`Sign and print/download case book — ${caseNumber}`}
            className={[
              "inline-flex items-center justify-center rounded-lg transition-colors",
              "p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50",
              triggerClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <FileSignature size={15} />
          </button>
        ) : (
          <button
            type="button"
            title={`Sign and print/download case book — ${caseNumber}`}
            className={[
              "inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-200 select-none",
              "bg-blue-600 hover:bg-blue-700 text-white border-blue-600",
              sizeClasses,
              triggerClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <FileSignature size={iconSize} />
            <span>{triggerLabel}</span>
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-blue-600" />
            Sign Case Book — {caseNumber}
          </DialogTitle>
          <DialogDescription>
            Draw your signature below. It will be stamped onto your signature
            line in the official case book before you print or download it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="relative rounded-lg border-2 border-dashed border-gray-300 bg-white">
            <canvas
              ref={pad.canvasRef}
              onPointerDown={pad.start}
              onPointerMove={pad.move}
              onPointerUp={pad.end}
              onPointerLeave={pad.end}
              className="h-44 w-full touch-none rounded-lg"
            />
            {pad.isEmpty && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-gray-300">
                  Sign here
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Use your mouse, trackpad, or finger to sign.
            </p>
            <button
              type="button"
              onClick={pad.clear}
              disabled={pad.isEmpty || busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            disabled={pad.isEmpty || busy}
          >
            {busyAction === "print" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Print
          </Button>
          <Button
            type="button"
            onClick={handleDownload}
            disabled={pad.isEmpty || busy}
          >
            {busyAction === "download" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSignature className="h-4 w-4" />
            )}
            Download Signed PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
