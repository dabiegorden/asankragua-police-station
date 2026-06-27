"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Search,
  Eye,
  Send,
  Loader2,
  MessageSquare,
  StickyNote,
  Users,
  Clock,
  X,
  MapPin,
  Calendar,
  User,
  ChevronRight,
  Paperclip,
  Download,
  RefreshCw,
  ArrowUpRight,
  AlertTriangle,
  RotateCcw,
  Scale,
  CheckCircle2,
  BookOpen,
  History,
  ClipboardList,
  Shield,
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
  SignCaseBookDialog,
} from "@/components/Casebookpdfbutton";
import AutoTextarea from "@/components/AutoTextarea";

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components
// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition";

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
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1"
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
        className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors"
      >
        <Paperclip size={14} className="text-gray-400" />
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
                {e.fromStage && e.toStage && e.fromStage !== e.toStage && (
                  <>
                    <span>·</span>
                    <span>
                      {e.fromStage.toUpperCase()} → {e.toStage.toUpperCase()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Digital Case Book — Stage Section
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
          : caseData.assignedDC;
  const isActive = caseData.currentStage === stage;
  const isPast =
    STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(caseData.currentStage);

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden ${
        isActive
          ? `${colors.border} ring-2 ring-offset-1 ring-purple-300`
          : isPast
            ? "border-gray-200"
            : "border-dashed border-gray-200 opacity-50"
      }`}
    >
      <div
        className={`flex items-center justify-between px-5 py-3 ${
          isActive ? colors.bg : isPast ? "bg-gray-50" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
              isActive ? colors.badge : isPast ? "bg-gray-400" : "bg-gray-200"
            }`}
          >
            {stage.toUpperCase().charAt(0)}
          </div>
          <div>
            <p
              className={`text-sm font-bold ${
                isActive
                  ? colors.text
                  : isPast
                    ? "text-gray-700"
                    : "text-gray-400"
              }`}
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
              ? "No entries yet. Add a review entry before forwarding."
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

// ─────────────────────────────────────────────────────────────────────────────
// Digital Case Book (SO view)
// ─────────────────────────────────────────────────────────────────────────────

function DigitalCaseBook({
  caseItem,
  onAddEntry,
}: {
  caseItem: CaseData;
  onAddEntry: () => void;
}) {
  const grouped = groupEntriesByStage(caseItem.caseBookEntries);
  const isSOStage = caseItem.currentStage === "so";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-linear-to-r from-purple-900 to-purple-700 rounded-xl p-5 text-white">
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
            <CaseBookPDFButton
              caseId={caseItem._id}
              caseNumber={caseItem.caseNumber}
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 hover:border-white/50"
            />
          </div>
        </div>
        {/* Progress */}
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
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                    current
                      ? "bg-white text-purple-800 border-white"
                      : past
                        ? "bg-white/80 text-purple-700 border-white/80"
                        : "bg-transparent text-white/50 border-white/30"
                  }`}
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

      {/* CID Submission Note */}
      {caseItem.cidSubmissionNote && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">
            CID Submission Findings
          </p>
          <p className="text-sm text-gray-700">{caseItem.cidSubmissionNote}</p>
        </div>
      )}

      {(STAGE_ORDER as ("nco" | "cid" | "so" | "dc")[]).map((stage) => (
        <CaseBookStageSection
          key={stage}
          stage={stage}
          entries={grouped[stage] || []}
          caseData={caseItem}
        />
      ))}

      {isSOStage && (
        <Button
          onClick={onAddEntry}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
        >
          <ClipboardList size={14} /> Add Review Entry to Case Book
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Case Book Entry Modal (SO)
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
  const [entryType, setType] = useState("review");
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
        fd.append("stage", "so");
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
            stage: "so",
          }),
        });
      }
      toast.success("Review entry added to case book");
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
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={14} className="text-purple-600" />
          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
            SO Case Book Entry
          </span>
        </div>
        <p className="text-xs text-gray-600">
          Document your review observations. This entry is permanent and will
          appear in the official case book and any exported PDF.
        </p>
      </div>
      <FormField label="Entry Type">
        <select
          className={inputCls}
          value={entryType}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="review">Review Notes</option>
          <option value="directive">Directive</option>
          <option value="remark">General Remark</option>
        </select>
      </FormField>
      <FormField label="Entry Content *">
        <AutoTextarea
          className={inputCls}
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Document your review observations, assessment of findings, directives, or recommendations..."
          style={{ resize: "vertical" }}
          required
        />
      </FormField>
      <FilePicker files={files} onChange={setFiles} />
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          Once submitted, this entry cannot be modified. Ensure all details are
          accurate before proceeding.
        </p>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !content.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white"
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
// Export Tab (SO)
// ─────────────────────────────────────────────────────────────────────────────

function ExportTab({ caseItem }: { caseItem: CaseData }) {
  const byStage = groupEntriesByStage(caseItem.caseBookEntries || []);
  const counts = {
    nco: byStage.nco?.length || 0,
    cid: byStage.cid?.length || 0,
    so: byStage.so?.length || 0,
    dc: byStage.dc?.length || 0,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="bg-linear-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={14} className="text-purple-600" />
          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
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
            <span className="font-semibold">
              {caseItem.auditLog?.length || 0}
            </span>{" "}
            audit events
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <span className="font-semibold">
              {caseItem.suspects?.length || 0}
            </span>{" "}
            suspects
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <span className="font-semibold">
              {caseItem.witnesses?.length || 0}
            </span>{" "}
            witnesses
          </div>
        </div>
      </div>

      <CaseBookExportCard
        caseId={caseItem._id}
        caseNumber={caseItem.caseNumber}
        caseTitle={caseItem.title}
        caseStatus={caseItem.status}
        entryCount={total}
      />

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
          "Official handoff notes between stages",
          "Suspects and witnesses list",
          "Full immutable audit trail",
          "Signature blocks for all four officers",
          "CONFIDENTIAL watermark and certification footer",
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
// Thread: CID ↔ SO
// ─────────────────────────────────────────────────────────────────────────────

function ThreadBox({
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
    .filter((m) => m.thread === "cid_so")
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
        fd.append("thread", "cid_so");
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
            thread: "cid_so",
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
            const mine = m.fromRole === "so";
            return (
              <div
                key={m._id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                    mine
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold ${mine ? "text-purple-200" : "text-gray-500"}`}
                    >
                      {m.fromUser?.fullName || ROLE_LABELS[m.fromRole]}
                    </span>
                    <ChevronRight
                      size={10}
                      className={mine ? "text-purple-300" : "text-gray-400"}
                    />
                    <span
                      className={`text-xs ${mine ? "text-purple-200" : "text-gray-500"}`}
                    >
                      {ROLE_LABELS[m.toRole || ""] || m.toRole}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{m.content}</p>
                  <AttachmentList attachments={m.attachments} />
                  <p
                    className={`text-xs mt-1.5 ${mine ? "text-purple-300" : "text-gray-400"}`}
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
            className="shrink-0 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors disabled:opacity-40"
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Return to CID Modal
// ─────────────────────────────────────────────────────────────────────────────

function ReturnModal({
  caseItem,
  onSuccess,
  onClose,
}: {
  caseItem: CaseData;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [directive, setDirective] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!directive.trim()) {
      toast.error("Directive is required");
      return;
    }
    setLoading(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("action", "so-return");
        fd.append("soDirective", directive.trim());
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
            action: "so-return",
            soDirective: directive.trim(),
          }),
        });
      }
      toast.success("Case returned to CID with directive");
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
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-xs font-mono font-bold text-orange-700 mb-1">
          {caseItem.caseNumber}
        </p>
        <p className="font-semibold text-gray-900 text-sm">{caseItem.title}</p>
        {caseItem.assignedOfficer && (
          <p className="text-xs text-gray-500 mt-1">
            Investigator: {caseItem.assignedOfficer.fullName}
          </p>
        )}
      </div>

      {caseItem.cidSubmissionNote && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <p className="text-xs font-bold text-indigo-700 uppercase mb-1">
            CID Submission Findings
          </p>
          <p className="text-sm text-gray-700">{caseItem.cidSubmissionNote}</p>
        </div>
      )}

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-purple-600" />
          <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">
            Directive (Added to Case Book) *
          </p>
        </div>
        <AutoTextarea
          className={inputCls}
          rows={5}
          value={directive}
          onChange={(e) => setDirective(e.target.value)}
          placeholder="Clearly state what further action is required from the CID Investigator. This will be permanently recorded in the case book."
          style={{ resize: "vertical" }}
          required
        />
      </div>

      <FilePicker files={files} onChange={setFiles} />

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          This directive will be permanently locked in the case book once
          submitted.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !directive.trim()}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin mr-2" />
          ) : (
            <RotateCcw size={14} className="mr-2" />
          )}
          Return to CID
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Forward to DC Modal
// ─────────────────────────────────────────────────────────────────────────────

function ForwardDCModal({
  caseItem,
  onSuccess,
  onClose,
}: {
  caseItem: CaseData;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [commanders, setCommanders] = useState<UserRef[]>([]);
  const [selected, setSelected] = useState("");
  const [forwardNote, setForwardNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const hasSOEntries = (caseItem.caseBookEntries || []).some(
    (e) => e.stage === "so",
  );

  useEffect(() => {
    api("/api/users/by-role?role=dc")
      .then((d) => setCommanders(d.users))
      .catch(() => toast.error("Failed to load District Commanders"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast.error("Select a District Commander");
      return;
    }
    if (!forwardNote.trim()) {
      toast.error("Forward note is required");
      return;
    }
    setLoading(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("action", "so-forward");
        fd.append("assignedDC", selected);
        fd.append("soForwardNote", forwardNote.trim());
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
            action: "so-forward",
            assignedDC: selected,
            soForwardNote: forwardNote.trim(),
          }),
        });
      }
      toast.success("Case forwarded to District Commander");
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
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p className="text-xs font-mono font-bold text-purple-700 mb-1">
          {caseItem.caseNumber}
        </p>
        <p className="font-semibold text-gray-900 text-sm">{caseItem.title}</p>
        {caseItem.assignedOfficer && (
          <p className="text-xs text-gray-500 mt-1">
            Investigated by: {caseItem.assignedOfficer.fullName}
          </p>
        )}
      </div>

      {!hasSOEntries && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            You have not added any case book entries yet. Add your review
            findings in the Case Book tab before forwarding.
          </p>
        </div>
      )}

      <FormField label="Assign District Commander *">
        <select
          className={inputCls}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
        >
          <option value="">— Select Commander —</option>
          {commanders.map((c) => (
            <option key={c._id} value={c._id}>
              {c.fullName} ({c.email})
            </option>
          ))}
        </select>
      </FormField>

      <div className="border border-purple-200 rounded-xl p-4 bg-purple-50 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-purple-600" />
          <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">
            SO Review Entry (Case Book) *
          </p>
        </div>
        <p className="text-xs text-gray-600">
          Your review note will be permanently recorded as 'Review Notes' in the
          case book.
        </p>
        <AutoTextarea
          className={inputCls}
          rows={5}
          value={forwardNote}
          onChange={(e) => setForwardNote(e.target.value)}
          placeholder="Summarise your review: assessment of CID findings, additional observations, recommendation for the District Commander..."
          style={{ resize: "vertical" }}
          required
        />
      </div>

      <FilePicker files={files} onChange={setFiles} />

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          This review note will be permanently locked once forwarded.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !selected || !forwardNote.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin mr-2" />
          ) : (
            <ArrowUpRight size={14} className="mr-2" />
          )}
          Forward to Commander
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Modal
// ─────────────────────────────────────────────────────────────────────────────

function DetailModal({
  caseItem,
  userId,
  onRefresh,
  onClose,
}: {
  caseItem: CaseData;
  userId: string;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<
    "casebook" | "info" | "thread" | "notes" | "parties" | "audit" | "export"
  >("casebook");
  const [noteContent, setNC] = useState("");
  const [noteFiles, setNF] = useState<File[]>([]);
  const [addingNote, setAN] = useState(false);
  const [addEntryOpen, setOpen] = useState(false);

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

  const cidUnread = (caseItem.threadMessages || []).filter(
    (m) =>
      m.thread === "cid_so" &&
      m.fromRole !== "so" &&
      !m.readBy?.includes(userId),
  ).length;

  const TABS = [
    { id: "casebook", label: "📖 Case Book" },
    { id: "info", label: "Info" },
    {
      id: "thread",
      label: `CID Chat${cidUnread > 0 ? ` (${cidUnread})` : ""}`,
    },
    { id: "notes", label: `Notes (${caseItem.notes.length})` },
    { id: "parties", label: "Parties" },
    { id: "audit", label: `Audit (${caseItem.auditLog?.length || 0})` },
    { id: "export", label: "⬇ Export" },
  ] as const;

  return (
    <div className="space-y-4">
      {addEntryOpen && (
        <AddCaseBookEntryModal
          caseItem={caseItem}
          onSuccess={onRefresh}
          onClose={() => setOpen(false)}
        />
      )}

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <p className="text-xs font-mono font-bold text-purple-600 mb-1">
            {caseItem.caseNumber}
          </p>
          <h3 className="text-base font-bold text-gray-900">
            {caseItem.title}
          </h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap">
            {caseItem.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={caseItem.status} />
          <PriorityBadge priority={caseItem.priority} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "casebook" && (
        <DigitalCaseBook caseItem={caseItem} onAddEntry={() => setOpen(true)} />
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
                      label: "Logged By (NCO)",
                      val: caseItem.loggedBy.fullName,
                    },
                  ]
                : []),
              ...(caseItem.assignedOfficer
                ? [
                    {
                      icon: <Users size={12} />,
                      label: "CID Investigator",
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
          {caseItem.ncoReferralNote && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-700 uppercase mb-1">
                NCO Referral Note
              </p>
              <p className="text-sm text-gray-700">
                {caseItem.ncoReferralNote}
              </p>
            </div>
          )}
          {caseItem.cidSubmissionNote && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <p className="text-xs font-bold text-indigo-700 uppercase mb-1">
                CID Submission Findings
              </p>
              <p className="text-sm text-gray-700">
                {caseItem.cidSubmissionNote}
              </p>
            </div>
          )}
          {caseItem.soDirective && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs font-bold text-orange-700 uppercase mb-1">
                Your Directive (Sent to CID)
              </p>
              <p className="text-sm text-gray-700">{caseItem.soDirective}</p>
            </div>
          )}
        </div>
      )}

      {tab === "thread" && (
        <ThreadBox caseItem={caseItem} onRefresh={onRefresh} />
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
                    <span className="text-xs font-semibold text-purple-700">
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
            <AutoTextarea
              className={inputCls}
              rows={2}
              value={noteContent}
              onChange={(e) => setNC(e.target.value)}
              placeholder="Add review note..."
              style={{ resize: "vertical" }}
            />
            <FilePicker files={noteFiles} onChange={setNF} />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={addingNote || !noteContent.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white"
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
              <p className="text-gray-400 text-xs">None recorded.</p>
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
                </div>
              ))
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Witnesses ({caseItem.witnesses.length})
            </p>
            {caseItem.witnesses.length === 0 ? (
              <p className="text-gray-400 text-xs">None recorded.</p>
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
      {tab === "export" && <ExportTab caseItem={caseItem} />}

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

export default function SOCasesPage() {
  const userId = "CURRENT_USER_ID";
  const userRole = "so";

  const [cases, setCases] = useState<CaseData[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [returnCase, setReturnCase] = useState<CaseData | null>(null);
  const [forwardCase, setForwardCase] = useState<CaseData | null>(null);
  const [detailCase, setDetailCase] = useState<CaseData | null>(null);

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

  const total = pagination?.total || 0;
  const awaitingReview = cases.filter(
    (c) => c.status === "under_review",
  ).length;
  const forwardedCount = cases.filter(
    (c) => c.status === "commander_review",
  ).length;
  const directiveCount = cases.filter(
    (c) => !!c.soDirective && c.currentStage === "cid",
  ).length;
  const unreadCount = cases.reduce(
    (acc, c) =>
      acc +
      (c.threadMessages || []).filter(
        (m) =>
          m.thread === "cid_so" &&
          m.fromRole !== "so" &&
          !m.readBy?.includes(userId),
      ).length,
    0,
  );

  return (
    <div className="space-y-6 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale size={16} className="text-purple-600" />
            <span className="text-sm font-semibold text-purple-600">
              Station Officer
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Case Reviews</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Digital Case Book System — review and forward cases
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchCases}
          className="flex items-center gap-2"
        >
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Assigned Cases"
          value={total}
          sub="All cases"
          icon={<Scale className="h-6 w-6 text-purple-600" />}
          iconBg="bg-purple-100"
        />
        <StatCard
          label="Awaiting Review"
          value={awaitingReview}
          sub="Submitted by CID"
          icon={<Clock className="h-6 w-6 text-yellow-600" />}
          iconBg="bg-yellow-100"
          valueColor="text-yellow-600"
        />
        <StatCard
          label="Forwarded to DC"
          value={forwardedCount}
          sub="At Commander stage"
          icon={<ArrowUpRight className="h-6 w-6 text-orange-600" />}
          iconBg="bg-orange-100"
          valueColor="text-orange-600"
        />
        <StatCard
          label="Unread Messages"
          value={unreadCount}
          sub="From CID"
          icon={<MessageSquare className="h-6 w-6 text-indigo-600" />}
          iconBg="bg-indigo-100"
          valueColor={unreadCount > 0 ? "text-indigo-600" : "text-gray-900"}
        />
      </div>

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
                placeholder="Search cases…"
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale size={16} className="text-purple-600" />
            Cases Under Review ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-purple-600" />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Scale size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No cases assigned to you for review.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cases.map((c) => {
                const canReview = c.status === "under_review";
                const bookEntries = (c.caseBookEntries || []).filter(
                  (e) => e.stage === "so",
                ).length;
                const unread = (c.threadMessages || []).filter(
                  (m) =>
                    m.thread === "cid_so" &&
                    m.fromRole !== "so" &&
                    !m.readBy?.includes(userId),
                ).length;

                return (
                  <div
                    key={c._id}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${canReview ? "bg-purple-50 border-purple-200" : "bg-white border-gray-200 hover:border-purple-200 hover:shadow-sm"}`}
                  >
                    <div
                      className={`w-1 h-12 rounded-full shrink-0 ${PRIORITY_LEFT[c.priority] || "bg-gray-300"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-purple-600">
                          {c.caseNumber}
                        </span>
                        <PriorityBadge priority={c.priority} />
                        <StatusBadge status={c.status} />
                        {canReview && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                            <CheckCircle2 size={9} /> Needs Review
                          </span>
                        )}
                        {bookEntries > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            <BookOpen size={9} /> {bookEntries} entries
                          </span>
                        )}
                        {unread > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-600 text-white">
                            <MessageSquare size={9} /> {unread} new
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
                      {canReview && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => setReturnCase(c)}
                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-8 px-3"
                          >
                            <RotateCcw size={12} className="mr-1" /> Return
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setForwardCase(c)}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 px-3"
                          >
                            <ArrowUpRight size={12} className="mr-1" /> Forward
                          </Button>
                        </>
                      )}
                      <CaseBookPDFButton
                        caseId={c._id}
                        caseNumber={c.caseNumber}
                        size="sm"
                        iconOnly
                      />
                      {/* ── Print & Sign quick action per row ── */}
                      <SignCaseBookDialog
                        caseId={c._id}
                        caseNumber={c.caseNumber}
                        iconOnly
                      />
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
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${p === page ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {returnCase && (
        <Modal
          title={`Return to CID — ${returnCase.caseNumber}`}
          onClose={() => setReturnCase(null)}
        >
          <ReturnModal
            caseItem={returnCase}
            onSuccess={fetchCases}
            onClose={() => setReturnCase(null)}
          />
        </Modal>
      )}
      {forwardCase && (
        <Modal
          title={`Forward to Commander — ${forwardCase.caseNumber}`}
          onClose={() => setForwardCase(null)}
        >
          <ForwardDCModal
            caseItem={forwardCase}
            onSuccess={fetchCases}
            onClose={() => setForwardCase(null)}
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
            onRefresh={refreshDetail}
            onClose={() => setDetailCase(null)}
          />
        </Modal>
      )}
    </div>
  );
}
