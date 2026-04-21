// src/app/(dashboard)/cases/nco/page.tsx
// NCO Case Management — Digital Case Book Edition + PDF Export

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Plus,
  Search,
  Eye,
  Send,
  Pencil,
  Trash2,
  Loader2,
  MessageSquare,
  StickyNote,
  Users,
  Clock,
  TrendingUp,
  ArrowRight,
  X,
  AlertTriangle,
  MapPin,
  Calendar,
  User,
  ChevronRight,
  Paperclip,
  Download,
  Shield,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  History,
  ClipboardList,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  api,
  CaseData,
  Pagination,
  UserRef,
  Attachment,
  CaseBookEntry,
  AuditEntry,
  STATUS_MAP,
  PRIORITY_BADGE,
  PRIORITY_LEFT,
  ROLE_LABELS,
  ROLE_SHORT,
  STAGE_COLORS,
  ENTRY_TYPE_LABELS,
  CATEGORIES,
  STAGE_ORDER,
  formatBytes,
  formatDateTime,
  formatDate,
  groupEntriesByStage,
} from "@/constants/Share";
import {
  CaseBookPDFButton,
  CaseBookExportCard,
} from "@/components/Casebookpdfbutton";

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components
// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition";

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || STATUS_MAP.open;
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}
    >
      {s.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${PRIORITY_BADGE[priority] || ""}`}
    >
      {priority}
    </span>
  );
}

function Modal({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col w-full ${wide ? "sm:max-w-4xl" : "sm:max-w-xl"} max-h-[92vh] border border-gray-200`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function AttachmentList({ attachments }: { attachments?: Attachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1 transition-colors"
        >
          <Download size={11} />
          {a.originalName || `file-${i + 1}`}
          {a.bytes && (
            <span className="text-blue-400">{formatBytes(a.bytes)}</span>
          )}
        </a>
      ))}
    </div>
  );
}

function FilePicker({
  files,
  onChange,
}: {
  files: File[];
  onChange: (f: File[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        Attachments (optional)
      </label>
      <div
        onClick={() => ref.current?.click()}
        className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors group"
      >
        <Paperclip
          size={14}
          className="text-gray-400 group-hover:text-blue-500"
        />
        <span className="text-xs text-gray-500">
          {files.length > 0
            ? `${files.length} file(s) selected`
            : "Click to attach files"}
        </span>
        <input
          ref={ref}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onChange(Array.from(e.target.files || []))}
        />
      </div>
      {files.length > 0 && (
        <div className="mt-2 space-y-1">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-md px-3 py-1.5 border border-gray-100"
            >
              <span className="truncate">{f.name}</span>
              <button
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 ml-2"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Tab (shown inside DetailModal)
// ─────────────────────────────────────────────────────────────────────────────

function ExportTab({ caseItem }: { caseItem: CaseData }) {
  const byStage = groupEntriesByStage(caseItem.caseBookEntries || []);
  const counts = {
    nco: byStage.nco?.length || 0,
    cid: byStage.cid?.length || 0,
    so: byStage.so?.length || 0,
    dc: byStage.dc?.length || 0,
  };
  const total = counts.nco + counts.cid + counts.so + counts.dc;

  const auditCount = caseItem.auditLog?.length || 0;
  const suspectCount = caseItem.suspects?.length || 0;
  const witnessCount = caseItem.witnesses?.length || 0;

  return (
    <div className="space-y-4">
      {/* Stage entry counts */}
      <div className="bg-linear-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={14} className="text-blue-600" />
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
            Case Book Summary
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center mb-4">
          {[
            {
              label: "NCO",
              count: counts.nco,
              color: "text-blue-700",
              bg: "bg-blue-50",
            },
            {
              label: "CID",
              count: counts.cid,
              color: "text-indigo-700",
              bg: "bg-indigo-50",
            },
            {
              label: "SO",
              count: counts.so,
              color: "text-purple-700",
              bg: "bg-purple-50",
            },
            {
              label: "DC",
              count: counts.dc,
              color: "text-amber-700",
              bg: "bg-amber-50",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`${s.bg} rounded-lg p-2.5 border border-white`}
            >
              <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xs text-gray-400">
                {s.count === 1 ? "entry" : "entries"}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-600">
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <span className="font-semibold">{auditCount}</span> audit events
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <span className="font-semibold">{suspectCount}</span> suspects
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <span className="font-semibold">{witnessCount}</span> witnesses
          </div>
        </div>
      </div>

      {/* Export card with download button */}
      <CaseBookExportCard
        caseId={caseItem._id}
        caseNumber={caseItem.caseNumber}
        caseTitle={caseItem.title}
        caseStatus={caseItem.status}
        entryCount={total}
      />

      {/* What's included */}
      <div className="text-xs text-gray-500 space-y-1.5 bg-gray-50 rounded-xl p-4 border border-gray-100">
        <p className="font-semibold text-gray-700 mb-2 text-sm">
          PDF document includes:
        </p>
        {[
          "Ghana Police Service official header with case number",
          "Case details — title, description, category, priority, location, dates",
          "Reporter and all assigned officer information",
          "Workflow progress timeline (NCO → CID → SO → DC)",
          "All formal case book entries with role labels and timestamps",
          "Official handoff notes between stages (referral, findings, directives)",
          "Suspects and witnesses list",
          "Full immutable audit trail of every action",
          "Stage timestamps (when each stage was completed)",
          "Signature blocks for all four officers",
          "CONFIDENTIAL watermark and certification footer",
          "Page headers and footers on every page",
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <CheckCircle2
              size={12}
              className="text-green-500 shrink-0 mt-0.5"
            />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          The exported PDF is an official document. Handle it in accordance with
          your station's document security policy.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Digital Case Book View
// ─────────────────────────────────────────────────────────────────────────────

function CaseBookStageSection({
  stage,
  entries,
  caseData,
}: {
  stage: "nco" | "cid" | "so" | "dc";
  entries: CaseBookEntry[];
  caseData: CaseData;
}) {
  const colors = STAGE_COLORS[stage];
  const stageLabel = ROLE_LABELS[stage];
  const stageOfficer =
    stage === "nco"
      ? caseData.loggedBy
      : stage === "cid"
        ? caseData.assignedOfficer
        : stage === "so"
          ? caseData.assignedSO
          : stage === "dc"
            ? caseData.assignedDC
            : undefined;
  const isActive = caseData.currentStage === stage;
  const isPast =
    STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(caseData.currentStage);

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden ${isActive ? `${colors.border} ring-2 ring-offset-1 ring-blue-300` : isPast ? "border-gray-200" : "border-dashed border-gray-200 opacity-50"}`}
    >
      <div
        className={`flex items-center justify-between px-5 py-3 ${isActive ? colors.bg : isPast ? "bg-gray-50" : "bg-white"}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${isActive ? colors.badge : isPast ? "bg-gray-400" : "bg-gray-200"}`}
          >
            {stage.toUpperCase()}
          </div>
          <div>
            <p
              className={`text-sm font-bold ${isActive ? colors.text : isPast ? "text-gray-700" : "text-gray-400"}`}
            >
              {stageLabel}
            </p>
            {stageOfficer && (
              <p className="text-xs text-gray-500">{stageOfficer.fullName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPast && (
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <CheckCircle2 size={12} className="text-green-500" /> Completed
            </span>
          )}
          {isActive && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}
            >
              Active Stage
            </span>
          )}
          {!isActive && !isPast && (
            <span className="text-xs text-gray-400">Pending</span>
          )}
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">
        {entries.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-3">
            {isActive
              ? "No entries yet. Add a remark to document your findings."
              : "No entries recorded."}
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry._id}
              className={`rounded-lg border p-4 ${colors.bg} ${colors.border}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${colors.badge}`}
                  >
                    {ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType}
                  </span>
                  <span className={`text-xs font-semibold ${colors.text}`}>
                    {entry.addedBy?.fullName || "Officer"}
                    <span className="ml-1 font-normal text-gray-500">
                      ({ROLE_SHORT[entry.roleSnapshot] || entry.roleSnapshot})
                    </span>
                  </span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {formatDateTime(entry.addedAt)}
                </span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {entry.content}
              </p>
              <AttachmentList attachments={entry.attachments} />
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <CheckCircle2 size={10} className="text-green-400" /> Entry
                locked — cannot be edited
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DigitalCaseBook({
  caseItem,
  userRole,
  onAddEntry,
}: {
  caseItem: CaseData;
  userRole: string;
  onAddEntry: () => void;
}) {
  const grouped = groupEntriesByStage(caseItem.caseBookEntries);
  const canAddEntry =
    (userRole === "nco" || userRole === "so") &&
    caseItem.currentStage === "nco";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-900 to-blue-700 rounded-xl p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={14} className="opacity-70" />
              <span className="text-xs font-semibold opacity-70 uppercase tracking-widest">
                Digital Case Book
              </span>
            </div>
            <p className="text-lg font-bold">{caseItem.caseNumber}</p>
            <p className="text-sm opacity-80 mt-0.5">{caseItem.title}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right text-xs opacity-70 space-y-0.5">
              <p>Reported: {formatDate(caseItem.dateReported)}</p>
              <p>Location: {caseItem.location}</p>
            </div>
            {/* PDF download in case book header */}
            <CaseBookPDFButton
              caseId={caseItem._id}
              caseNumber={caseItem.caseNumber}
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 hover:border-white/50"
            />
          </div>
        </div>
        {/* Workflow progress */}
        <div className="mt-4 flex items-center gap-0">
          {STAGE_ORDER.map((stage, idx) => {
            const past =
              STAGE_ORDER.indexOf(stage) <
              STAGE_ORDER.indexOf(caseItem.currentStage);
            const current = stage === caseItem.currentStage;
            return (
              <div key={stage} className="flex items-center flex-1">
                <div
                  className={`flex-1 h-1.5 ${idx === 0 ? "rounded-l-full" : ""} ${idx === 3 ? "rounded-r-full" : ""} ${past || current ? "bg-white" : "bg-white/20"}`}
                />
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${current ? "bg-white text-blue-800 border-white" : past ? "bg-white/80 text-blue-700 border-white/80" : "bg-transparent text-white/50 border-white/30"}`}
                >
                  {stage.toUpperCase().charAt(0)}
                </div>
                {idx < 3 && (
                  <div
                    className={`flex-1 h-1.5 ${past ? "bg-white" : "bg-white/20"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          {STAGE_ORDER.map((stage) => (
            <span
              key={stage}
              className={`text-xs ${stage === caseItem.currentStage ? "text-white font-bold" : "text-white/50"}`}
            >
              {ROLE_SHORT[stage]}
            </span>
          ))}
        </div>
      </div>

      {/* Stage sections */}
      {(STAGE_ORDER as ("nco" | "cid" | "so" | "dc")[]).map((stage) => (
        <CaseBookStageSection
          key={stage}
          stage={stage}
          entries={grouped[stage] || []}
          caseData={caseItem}
        />
      ))}

      {canAddEntry && (
        <Button
          onClick={onAddEntry}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <ClipboardList size={14} /> Add Case Book Entry
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Case Book Entry Modal
// ─────────────────────────────────────────────────────────────────────────────

function AddCaseBookEntryModal({
  caseItem,
  onSuccess,
  onClose,
}: {
  caseItem: CaseData;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [entryType, setType] = useState("remark");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("action", "add-casebook-entry");
        fd.append("content", content.trim());
        fd.append("entryType", entryType);
        fd.append("stage", "nco");
        files.forEach((f) => fd.append("attachments", f));
        const res = await fetch(`/api/cases/${caseItem._id}`, {
          method: "PUT",
          credentials: "include",
          body: fd,
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        await api(`/api/cases/${caseItem._id}`, {
          method: "PUT",
          body: JSON.stringify({
            action: "add-casebook-entry",
            content: content.trim(),
            entryType,
            stage: "nco",
          }),
        });
      }
      toast.success("Case book entry added");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={14} className="text-blue-600" />
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
            Digital Case Book Entry
          </span>
        </div>
        <p className="text-xs text-gray-600">
          This entry is permanent and cannot be edited after submission. It will
          appear in the case book and any exported PDF.
        </p>
      </div>
      <FormField label="Entry Type">
        <select
          className={inputCls}
          value={entryType}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="remark">General Remark</option>
          <option value="referral">Referral Note</option>
        </select>
      </FormField>
      <FormField label="Entry Content *">
        <textarea
          className={inputCls}
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter your official case book remark..."
          style={{ resize: "vertical" }}
          required
        />
      </FormField>
      <FilePicker files={files} onChange={setFiles} />
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          Once submitted, this entry cannot be modified.
        </p>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !content.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin mr-2" />
          ) : (
            <ClipboardList size={14} className="mr-2" />
          )}
          Add Entry
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Trail
// ─────────────────────────────────────────────────────────────────────────────

function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {entries.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">
          No audit records yet.
        </p>
      ) : (
        [...entries].reverse().map((e) => (
          <div key={e._id} className="flex items-start gap-3 text-xs">
            <div className="w-6 h-6 bg-gray-100 border border-gray-200 rounded-full flex items-center justify-center text-gray-500 shrink-0 mt-0.5">
              <History size={10} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 font-medium">
                {e.details || e.action.replace(/_/g, " ")}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-gray-400">
                <span>{e.performedBy?.fullName || "System"}</span>
                <span>·</span>
                <span>{formatDateTime(e.performedAt)}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Thread Panel (NCO ↔ CID)
// ─────────────────────────────────────────────────────────────────────────────

function ThreadPanel({
  caseItem,
  onRefresh,
}: {
  caseItem: CaseData;
  onRefresh: () => void;
}) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgs = (caseItem.threadMessages || [])
    .filter((m) => m.thread === "nco_cid")
    .sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    );
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("action", "send-message");
        fd.append("thread", "nco_cid");
        fd.append("content", content.trim());
        fd.append("toRole", "cid");
        files.forEach((f) => fd.append("attachments", f));
        const res = await fetch(`/api/cases/${caseItem._id}`, {
          method: "PUT",
          credentials: "include",
          body: fd,
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        await api(`/api/cases/${caseItem._id}`, {
          method: "PUT",
          body: JSON.stringify({
            action: "send-message",
            thread: "nco_cid",
            content: content.trim(),
            toRole: "cid",
          }),
        });
      }
      setContent("");
      setFiles([]);
      toast.success("Message sent");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-64">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare size={24} className="mb-2 opacity-40" />
            <p className="text-xs">No messages yet.</p>
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.fromRole === "nco" || m.fromRole === "so";
            return (
              <div
                key={m._id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-xl px-4 py-2.5 ${mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold ${mine ? "text-blue-200" : "text-gray-500"}`}
                    >
                      {m.fromUser?.fullName || ROLE_LABELS[m.fromRole]}
                    </span>
                    <ChevronRight
                      size={10}
                      className={mine ? "text-blue-300" : "text-gray-400"}
                    />
                    <span
                      className={`text-xs ${mine ? "text-blue-200" : "text-gray-500"}`}
                    >
                      {ROLE_LABELS[m.toRole || ""] || m.toRole}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{m.content}</p>
                  <AttachmentList attachments={m.attachments} />
                  <p
                    className={`text-xs mt-1.5 ${mine ? "text-blue-300" : "text-gray-400"}`}
                  >
                    {formatDateTime(m.sentAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      {caseItem.assignedOfficer ? (
        <form
          onSubmit={send}
          className="border-t border-gray-100 pt-3 mt-3 space-y-2"
        >
          <FilePicker files={files} onChange={setFiles} />
          <div className="flex gap-2">
            <input
              className={`${inputCls} flex-1`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Message CID Investigator..."
            />
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors disabled:opacity-40"
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="border-t border-gray-100 pt-3 mt-3 text-center text-xs text-gray-400">
          Refer this case to CID first to enable messaging.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Case Form (Create / Edit)
// ─────────────────────────────────────────────────────────────────────────────

function CaseForm({
  initial,
  onSuccess,
  onClose,
}: {
  initial?: Partial<CaseData> & { _id?: string };
  onSuccess: () => void;
  onClose: () => void;
}) {
  const isEdit = !!initial?._id;
  const [form, setForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    category: initial?.category || "other",
    priority: initial?.priority || "Summary Offence",
    location: initial?.location || "",
    dateOccurred: initial?.dateOccurred
      ? initial.dateOccurred.slice(0, 10)
      : "",
    notes: "",
    reportedBy: {
      name: initial?.reportedBy?.name || "",
      phone: initial?.reportedBy?.phone || "",
      email: initial?.reportedBy?.email || "",
      address: initial?.reportedBy?.address || "",
    },
  });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setRB = (k: string, v: string) =>
    setForm((f) => ({ ...f, reportedBy: { ...f.reportedBy, [k]: v } }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (typeof v === "object") fd.append(k, JSON.stringify(v));
          else fd.append(k, v as string);
        });
        files.forEach((f) => fd.append("attachments", f));
        const url = isEdit ? `/api/cases/${initial!._id}` : "/api/cases";
        if (isEdit) fd.append("action", "update");
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          credentials: "include",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
      } else {
        const payload = isEdit ? { action: "update", ...form } : form;
        await api(isEdit ? `/api/cases/${initial!._id}` : "/api/cases", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
      }
      toast.success(isEdit ? "Case updated" : "Case logged successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Case Title *">
        <input
          className={inputCls}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Brief incident description"
          required
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Category *">
          <select
            className={inputCls}
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Priority *">
          <select
            className={inputCls}
            value={form.priority}
            onChange={(e) => set("priority", e.target.value)}
          >
            {["Felony", "Misdemeanour", "Summary Offence"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField label="Description *">
        <textarea
          className={inputCls}
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Detailed description of the incident..."
          required
          style={{ resize: "vertical" }}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Location *">
          <input
            className={inputCls}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Incident location"
            required
          />
        </FormField>
        <FormField label="Date Occurred *">
          <input
            className={inputCls}
            type="date"
            value={form.dateOccurred}
            onChange={(e) => set("dateOccurred", e.target.value)}
            required
          />
        </FormField>
      </div>
      <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Reporter Information
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Full Name *">
            <input
              className={inputCls}
              value={form.reportedBy.name}
              onChange={(e) => setRB("name", e.target.value)}
              placeholder="Reporter's name"
              required
            />
          </FormField>
          <FormField label="Phone">
            <input
              className={inputCls}
              value={form.reportedBy.phone}
              onChange={(e) => setRB("phone", e.target.value)}
              placeholder="Contact number"
            />
          </FormField>
          <FormField label="Email">
            <input
              className={inputCls}
              type="email"
              value={form.reportedBy.email}
              onChange={(e) => setRB("email", e.target.value)}
              placeholder="Email address"
            />
          </FormField>
          <FormField label="Address">
            <input
              className={inputCls}
              value={form.reportedBy.address}
              onChange={(e) => setRB("address", e.target.value)}
              placeholder="Home address"
            />
          </FormField>
        </div>
      </div>
      {!isEdit && (
        <FormField label="Initial Case Book Remark (optional)">
          <textarea
            className={inputCls}
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Official initial remarks — this will be added to the digital case book..."
            style={{ resize: "vertical" }}
          />
        </FormField>
      )}
      <FilePicker files={files} onChange={setFiles} />
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
          {isEdit ? "Save Changes" : "Log Case"}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Refer to CID Modal
// ─────────────────────────────────────────────────────────────────────────────

function ReferModal({
  caseItem,
  onSuccess,
  onClose,
}: {
  caseItem: CaseData;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [officers, setOfficers] = useState<UserRef[]>([]);
  const [selected, setSelected] = useState("");
  const [referNote, setReferNote] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/api/users/by-role?role=cid")
      .then((d) => setOfficers(d.users))
      .catch(() => toast.error("Failed to load CID officers"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast.error("Select a CID officer");
      return;
    }
    if (!referNote.trim()) {
      toast.error("A case book remark is required before referring");
      return;
    }
    setLoading(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("action", "nco-refer");
        fd.append("assignedOfficer", selected);
        fd.append("ncoReferralNote", referNote);
        if (note) fd.append("note", note);
        files.forEach((f) => fd.append("attachments", f));
        const res = await fetch(`/api/cases/${caseItem._id}`, {
          method: "PUT",
          credentials: "include",
          body: fd,
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        await api(`/api/cases/${caseItem._id}`, {
          method: "PUT",
          body: JSON.stringify({
            action: "nco-refer",
            assignedOfficer: selected,
            ncoReferralNote: referNote,
            note,
          }),
        });
      }
      toast.success("Case referred to CID — notification sent");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-mono font-bold text-blue-700 mb-1">
          {caseItem.caseNumber}
        </p>
        <p className="font-semibold text-gray-900 text-sm">{caseItem.title}</p>
        <div className="flex gap-2 mt-2">
          <PriorityBadge priority={caseItem.priority} />
          <StatusBadge status={caseItem.status} />
        </div>
      </div>
      <FormField label="Assign CID Investigator *">
        <select
          className={inputCls}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
        >
          <option value="">— Select CID Officer —</option>
          {officers.map((o) => (
            <option key={o._id} value={o._id}>
              {o.fullName} ({o.email})
            </option>
          ))}
        </select>
      </FormField>
      <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-blue-600" />
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">
            Case Book Entry Required *
          </p>
        </div>
        <p className="text-xs text-gray-600">
          Your referral remarks will be permanently recorded in the digital case
          book.
        </p>
        <textarea
          className={inputCls}
          rows={4}
          value={referNote}
          onChange={(e) => setReferNote(e.target.value)}
          placeholder="State your referral reasons, initial findings, and instructions for the CID investigator..."
          style={{ resize: "vertical" }}
          required
        />
      </div>
      <FormField label="Additional Internal Note (optional)">
        <textarea
          className={inputCls}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any other notes (not in case book)..."
          style={{ resize: "vertical" }}
        />
      </FormField>
      <FilePicker files={files} onChange={setFiles} />
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !selected || !referNote.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin mr-2" />
          ) : (
            <Send size={14} className="mr-2" />
          )}
          Refer to CID
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Modal — with Export tab
// ─────────────────────────────────────────────────────────────────────────────

function DetailModal({
  caseItem,
  userId,
  userRole,
  onRefresh,
  onClose,
}: {
  caseItem: CaseData;
  userId: string;
  userRole: string;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<
    "casebook" | "info" | "thread" | "notes" | "parties" | "audit" | "export"
  >("casebook");
  const [noteContent, setNC] = useState("");
  const [noteFiles, setNF] = useState<File[]>([]);
  const [addingNote, setAN] = useState(false);
  const [addEntryOpen, setAddEntryOpen] = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setAN(true);
    try {
      if (noteFiles.length > 0) {
        const fd = new FormData();
        fd.append("action", "add-note");
        fd.append("content", noteContent.trim());
        noteFiles.forEach((f) => fd.append("attachments", f));
        const res = await fetch(`/api/cases/${caseItem._id}`, {
          method: "PUT",
          credentials: "include",
          body: fd,
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        await api(`/api/cases/${caseItem._id}`, {
          method: "PUT",
          body: JSON.stringify({ action: "add-note", content: noteContent }),
        });
      }
      setNC("");
      setNF([]);
      toast.success("Note added");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAN(false);
    }
  }

  const unreadCount = (caseItem.threadMessages || []).filter(
    (m) =>
      m.thread === "nco_cid" &&
      m.fromRole === "cid" &&
      !m.readBy?.includes(userId),
  ).length;

  const TABS = [
    { id: "casebook", label: "📖 Case Book" },
    { id: "info", label: "Info" },
    {
      id: "thread",
      label: `Messages${unreadCount > 0 ? ` (${unreadCount})` : ""}`,
    },
    { id: "notes", label: `Notes (${caseItem.notes.length})` },
    {
      id: "parties",
      label: `Parties (${caseItem.suspects.length + caseItem.witnesses.length})`,
    },
    { id: "audit", label: `Audit (${caseItem.auditLog?.length || 0})` },
    { id: "export", label: "⬇ Export" },
  ] as const;

  return (
    <div className="space-y-4">
      {addEntryOpen && (
        <AddCaseBookEntryModal
          caseItem={caseItem}
          onSuccess={onRefresh}
          onClose={() => setAddEntryOpen(false)}
        />
      )}

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <p className="text-xs font-mono font-bold text-blue-600 mb-1">
            {caseItem.caseNumber}
          </p>
          <h3 className="text-base font-bold text-gray-900">
            {caseItem.title}
          </h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
            {caseItem.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={caseItem.status} />
          <PriorityBadge priority={caseItem.priority} />
        </div>
      </div>

      {caseItem.soDirective && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">
              SO Directive — Further Action Required
            </p>
            <p className="text-sm text-red-800">{caseItem.soDirective}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "casebook" && (
        <DigitalCaseBook
          caseItem={caseItem}
          userRole={userRole}
          onAddEntry={() => setAddEntryOpen(true)}
        />
      )}

      {tab === "info" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                icon: <MapPin size={12} />,
                label: "Location",
                val: caseItem.location,
              },
              {
                icon: <Calendar size={12} />,
                label: "Date Occurred",
                val: formatDate(caseItem.dateOccurred),
              },
              {
                icon: <User size={12} />,
                label: "Reported By",
                val: caseItem.reportedBy.name,
              },
              {
                icon: <FileText size={12} />,
                label: "Category",
                val: caseItem.category,
                cap: true,
              },
              ...(caseItem.loggedBy
                ? [
                    {
                      icon: <User size={12} />,
                      label: "Logged By",
                      val: caseItem.loggedBy.fullName,
                    },
                  ]
                : []),
              ...(caseItem.assignedOfficer
                ? [
                    {
                      icon: <Users size={12} />,
                      label: "CID Officer",
                      val: caseItem.assignedOfficer.fullName,
                    },
                  ]
                : []),
            ].map(({ icon, label, val, cap }) => (
              <div
                key={label}
                className="bg-gray-50 rounded-lg p-3 border border-gray-100"
              >
                <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                  {icon}
                  <span>{label}</span>
                </div>
                <p
                  className={`text-gray-800 text-sm font-medium ${cap ? "capitalize" : ""}`}
                >
                  {val}
                </p>
              </div>
            ))}
          </div>
          {caseItem.attachments?.length ? (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">
                Attachments
              </p>
              <AttachmentList attachments={caseItem.attachments} />
            </div>
          ) : null}
        </div>
      )}

      {tab === "thread" && (
        <ThreadPanel caseItem={caseItem} onRefresh={onRefresh} />
      )}

      {tab === "notes" && (
        <div className="space-y-3">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {caseItem.notes.length === 0 ? (
              <p className="text-gray-400 text-xs text-center py-6">
                No notes yet.
              </p>
            ) : (
              caseItem.notes.map((n) => (
                <div
                  key={n._id}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-blue-700">
                      {n.addedBy?.fullName || "Unknown"}
                      {n.roleSnapshot && (
                        <span className="ml-1 font-normal text-gray-400">
                          ({ROLE_LABELS[n.roleSnapshot]})
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDateTime(n.addedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{n.content}</p>
                  <AttachmentList attachments={n.attachments} />
                </div>
              ))
            )}
          </div>
          <form
            onSubmit={addNote}
            className="border-t border-gray-100 pt-3 space-y-3"
          >
            <textarea
              className={inputCls}
              rows={2}
              value={noteContent}
              onChange={(e) => setNC(e.target.value)}
              placeholder="Add a note..."
              style={{ resize: "vertical" }}
            />
            <FilePicker files={noteFiles} onChange={setNF} />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={addingNote || !noteContent.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {addingNote ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : (
                  <StickyNote size={12} className="mr-1" />
                )}
                Add Note
              </Button>
            </div>
          </form>
        </div>
      )}

      {tab === "parties" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Suspects ({caseItem.suspects.length})
            </p>
            {caseItem.suspects.length === 0 ? (
              <p className="text-gray-400 text-xs">No suspects recorded.</p>
            ) : (
              caseItem.suspects.map((s, i) => (
                <div
                  key={i}
                  className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2"
                >
                  <p className="font-semibold text-sm text-gray-900">
                    {s.name}
                    {s.age && (
                      <span className="ml-2 text-xs text-gray-500">
                        Age {s.age}
                      </span>
                    )}
                  </p>
                  {s.description && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {s.description}
                    </p>
                  )}
                  {s.address && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      📍 {s.address}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Witnesses ({caseItem.witnesses.length})
            </p>
            {caseItem.witnesses.length === 0 ? (
              <p className="text-gray-400 text-xs">No witnesses recorded.</p>
            ) : (
              caseItem.witnesses.map((w, i) => (
                <div
                  key={i}
                  className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2"
                >
                  <p className="font-semibold text-sm text-gray-900">
                    {w.name}
                    {w.phone && (
                      <span className="ml-2 text-xs text-gray-500">
                        {w.phone}
                      </span>
                    )}
                  </p>
                  {w.statement && (
                    <p className="text-xs text-gray-600 mt-0.5 italic">
                      "{w.statement}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "audit" && <AuditTrail entries={caseItem.auditLog || []} />}

      {/* ── NEW: Export Tab ── */}
      {tab === "export" && <ExportTab caseItem={caseItem} />}

      {/* Footer — always shows PDF button */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <CaseBookPDFButton
          caseId={caseItem._id}
          caseNumber={caseItem.caseNumber}
          size="sm"
        />
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  valueColor,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{label}</p>
            <p
              className={`text-2xl font-bold mt-1 ${valueColor || "text-gray-900"}`}
            >
              {value}
            </p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
          </div>
          <div
            className={`h-12 w-12 ${iconBg} rounded-full flex items-center justify-center shrink-0`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function NCOCasesPage() {
  const userId = "CURRENT_USER_ID"; // Replace with auth hook
  const userRole = "nco";

  const [cases, setCases] = useState<CaseData[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editCase, setEditCase] = useState<CaseData | null>(null);
  const [referCase, setReferCase] = useState<CaseData | null>(null);
  const [detailCase, setDetailCase] = useState<CaseData | null>(null);
  const [deleteCase, setDeleteCase] = useState<CaseData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        page: String(page),
        limit: "10",
        ...(status !== "all" && { status }),
        ...(category !== "all" && { category }),
        ...(search && { search }),
      });
      const d = await api(`/api/cases?${p}`);
      setCases(d.cases);
      setPagination(d.pagination);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, status, category, search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  async function refreshDetail() {
    if (!detailCase) return;
    try {
      const d = await api(`/api/cases/${detailCase._id}`);
      setDetailCase(d.case);
      fetchCases();
    } catch {}
  }

  async function handleDelete() {
    if (!deleteCase) return;
    setDeleting(true);
    try {
      await api(`/api/cases/${deleteCase._id}`, { method: "DELETE" });
      toast.success("Case deleted");
      setDeleteCase(null);
      fetchCases();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const total = pagination?.total || 0;
  const openCount = cases.filter((c) => c.status === "open").length;
  const refCount = cases.filter((c) => c.status === "referred").length;
  const activeCount = cases.filter((c) =>
    ["referred", "investigating", "under_review", "commander_review"].includes(
      c.status,
    ),
  ).length;

  return (
    <div className="space-y-6 pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className="text-blue-600" />
            <span className="text-sm font-semibold text-blue-600">
              NCO / Station Orderly
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Case Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Digital Case Book System — all entries are permanently recorded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchCases}
            className="flex items-center gap-2"
          >
            <RefreshCw size={13} /> Refresh
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus size={14} /> Log New Case
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Cases"
          value={total}
          sub={`${openCount} open · ${refCount} referred`}
          icon={<FileText className="h-6 w-6 text-blue-600" />}
          iconBg="bg-blue-100"
        />
        <StatCard
          label="Open"
          value={openCount}
          sub="Awaiting referral"
          icon={<Clock className="h-6 w-6 text-green-600" />}
          iconBg="bg-green-100"
          valueColor="text-green-600"
        />
        <StatCard
          label="Referred to CID"
          value={refCount}
          sub="Under investigation"
          icon={<ArrowRight className="h-6 w-6 text-blue-600" />}
          iconBg="bg-blue-100"
          valueColor="text-blue-600"
        />
        <StatCard
          label="Active"
          value={activeCount}
          sub="In workflow"
          icon={<TrendingUp className="h-6 w-6 text-purple-600" />}
          iconBg="bg-purple-100"
          valueColor="text-purple-600"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className={`${inputCls} pl-9`}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search case number, title, reporter…"
              />
            </div>
            <select
              className={`${inputCls} min-w-40`}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <select
              className={`${inputCls} min-w-36`}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Cases List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText size={16} className="text-gray-500" />
            Cases ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                No cases found. Log a new case to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cases.map((c) => {
                const canRefer =
                  c.status === "open" && c.currentStage === "nco";
                const canEdit = ["open", "suspended"].includes(c.status);
                const unread = (c.threadMessages || []).filter(
                  (m) =>
                    m.thread === "nco_cid" &&
                    m.fromRole === "cid" &&
                    !m.readBy?.includes(userId),
                ).length;
                const bookEntries = (c.caseBookEntries || []).length;

                return (
                  <div
                    key={c._id}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all"
                  >
                    <div
                      className={`w-1 h-12 rounded-full shrink-0 ${PRIORITY_LEFT[c.priority] || "bg-gray-300"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-blue-600">
                          {c.caseNumber}
                        </span>
                        <PriorityBadge priority={c.priority} />
                        <StatusBadge status={c.status} />
                        {bookEntries > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <BookOpen size={9} />
                            {bookEntries} entries
                          </span>
                        )}
                        {unread > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-600 text-white">
                            <MessageSquare size={9} />
                            {unread} new
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {c.title}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-0.5">
                        <span className="text-xs text-gray-500 capitalize">
                          {c.category}
                        </span>
                        <span className="text-xs text-gray-400">
                          📍 {c.location}
                        </span>
                        <span className="text-xs text-gray-400">
                          👤 {c.reportedBy.name}
                        </span>
                        {c.assignedOfficer && (
                          <span className="text-xs text-gray-400">
                            🔍 {c.assignedOfficer.fullName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-gray-400">
                        {formatDate(c.createdAt)}
                      </p>
                      <p className="text-xs text-gray-300 mt-0.5">
                        {c.notes.length} notes
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setDetailCase(c)}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <Eye size={15} />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => setEditCase(c)}
                          className="p-2 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {canRefer && (
                        <Button
                          size="sm"
                          onClick={() => setReferCase(c)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3"
                        >
                          <Send size={12} className="mr-1" /> Refer
                        </Button>
                      )}
                      {/* ── PDF download button per row ── */}
                      <CaseBookPDFButton
                        caseId={c._id}
                        caseNumber={c.caseNumber}
                        size="sm"
                        iconOnly
                      />
                      <button
                        onClick={() => setDeleteCase(c)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center gap-1 mt-6">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
                (p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${p === page ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {createOpen && (
        <Modal title="Log New Case" onClose={() => setCreateOpen(false)}>
          <CaseForm
            onSuccess={fetchCases}
            onClose={() => setCreateOpen(false)}
          />
        </Modal>
      )}
      {editCase && (
        <Modal
          title={`Edit — ${editCase.caseNumber}`}
          onClose={() => setEditCase(null)}
        >
          <CaseForm
            initial={editCase}
            onSuccess={() => {
              fetchCases();
              setEditCase(null);
            }}
            onClose={() => setEditCase(null)}
          />
        </Modal>
      )}
      {referCase && (
        <Modal
          title={`Refer to CID — ${referCase.caseNumber}`}
          onClose={() => setReferCase(null)}
        >
          <ReferModal
            caseItem={referCase}
            onSuccess={fetchCases}
            onClose={() => setReferCase(null)}
          />
        </Modal>
      )}
      {detailCase && (
        <Modal
          title={`Case — ${detailCase.caseNumber}`}
          wide
          onClose={() => setDetailCase(null)}
        >
          <DetailModal
            caseItem={detailCase}
            userId={userId}
            userRole={userRole}
            onRefresh={refreshDetail}
            onClose={() => setDetailCase(null)}
          />
        </Modal>
      )}
      {deleteCase && (
        <Modal title="Confirm Delete" onClose={() => setDeleteCase(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle
                size={16}
                className="text-red-500 shrink-0 mt-0.5"
              />
              <div>
                <p className="font-semibold text-red-800 text-sm">
                  This cannot be undone.
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Delete case{" "}
                  <span className="font-mono text-red-700">
                    {deleteCase.caseNumber}
                  </span>{" "}
                  — <em>{deleteCase.title}</em>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteCase(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? (
                  <Loader2 size={14} className="animate-spin mr-2" />
                ) : (
                  <Trash2 size={14} className="mr-2" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
