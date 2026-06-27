"use client";

import { useState } from "react";
import { FileDown, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { SignCaseBookDialog } from "@/components/SignCaseBookDialog";

export { SignCaseBookDialog };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DownloadState = "idle" | "loading" | "success" | "error";

interface CaseBookPDFButtonProps {
  /** MongoDB _id of the case */
  caseId: string;
  /** Human-readable case number, e.g. "RO-2024-0012" — used in the filename */
  caseNumber: string;
  /** Optional CSS class overrides */
  className?: string;
  /** Button size variant */
  size?: "sm" | "md" | "lg";
  /** Show as icon-only (no text label) */
  iconOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Download helper
// ─────────────────────────────────────────────────────────────────────────────

async function downloadCaseBookPDF(
  caseId: string,
  caseNumber: string,
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/pdf`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    // Try to parse a JSON error body
    try {
      const err = await res.json();
      throw new Error(err.error || `Server error ${res.status}`);
    } catch {
      throw new Error(`PDF generation failed (${res.status})`);
    }
  }

  // Stream the blob and trigger browser download
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  // Try to get the filename from Content-Disposition header
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";\n]+)"?/);
  a.download = match?.[1] || `CaseBook-${caseNumber}-${Date.now()}.pdf`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CaseBookPDFButton({
  caseId,
  caseNumber,
  className = "",
  size = "md",
  iconOnly = false,
}: CaseBookPDFButtonProps) {
  const [state, setState] = useState<DownloadState>("idle");

  const sizeClasses = {
    sm: "h-7 px-2.5 text-xs gap-1.5",
    md: "h-9 px-4 text-sm gap-2",
    lg: "h-11 px-5 text-base gap-2.5",
  }[size];

  const iconSize = { sm: 12, md: 14, lg: 16 }[size];

  async function handleClick() {
    if (state === "loading") return;
    setState("loading");
    try {
      await downloadCaseBookPDF(caseId, caseNumber);
      setState("success");
      toast.success("Case book PDF downloaded successfully");
      // Reset after 2 s
      setTimeout(() => setState("idle"), 2000);
    } catch (err: any) {
      setState("error");
      toast.error(err.message || "Failed to download PDF");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const icon =
    state === "loading" ? (
      <Loader2 size={iconSize} className="animate-spin" />
    ) : state === "success" ? (
      <CheckCircle2 size={iconSize} />
    ) : state === "error" ? (
      <AlertTriangle size={iconSize} />
    ) : (
      <FileDown size={iconSize} />
    );

  const label =
    state === "loading"
      ? "Generating…"
      : state === "success"
        ? "Downloaded!"
        : state === "error"
          ? "Retry Download"
          : "Export PDF";

  const stateClasses =
    state === "success"
      ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
      : state === "error"
        ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
        : state === "loading"
          ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
          : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300";

  const exportButton = (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      title={`Export full case book as PDF — ${caseNumber}`}
      className={[
        "inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-200 select-none",
        sizeClasses,
        stateClasses,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  );

  // Compact icon-only row actions stay as a single button; everywhere else we
  // pair the plain export with the "Print & Sign" flow so officers can add
  // their signature before printing or downloading.
  if (iconOnly) return exportButton;

  return (
    <span className="inline-flex items-center gap-2">
      {exportButton}
      <SignCaseBookDialog caseId={caseId} caseNumber={caseNumber} size={size} />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Larger "Export Case Book" card for detail views
// ─────────────────────────────────────────────────────────────────────────────

interface CaseBookExportCardProps {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  caseStatus: string;
  entryCount?: number;
}

export function CaseBookExportCard({
  caseId,
  caseNumber,
  caseTitle,
  caseStatus,
  entryCount = 0,
}: CaseBookExportCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-linear-to-br from-slate-50 to-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <FileDown size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Export Digital Case Book
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {caseNumber} · {caseTitle}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {entryCount} case book {entryCount === 1 ? "entry" : "entries"} ·
              Status:{" "}
              <span className="capitalize">
                {caseStatus.replace(/_/g, " ")}
              </span>
            </p>
          </div>
        </div>
        <CaseBookPDFButton caseId={caseId} caseNumber={caseNumber} size="sm" />
      </div>
      <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
        Generates a professional, officially formatted PDF with all case book
        entries, officer remarks, audit trail, and signature blocks. Use{" "}
        <span className="font-medium text-gray-500">Print &amp; Sign</span> to
        add your signature before printing or downloading.
      </p>
    </div>
  );
}
