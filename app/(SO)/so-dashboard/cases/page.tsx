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
  STATUS_MAP,
  PRIORITY_BADGE,
  PRIORITY_LEFT,
  ROLE_LABELS,
  CATEGORIES,
  formatBytes,
} from "@/components/cases/shared";

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-xl"} max-h-[92vh] border border-gray-200`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
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
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1"
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
        className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
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

// ─── CID ↔ SO Thread ─────────────────────────────────────────────────────────
function SOThread({
  caseItem,
  userRole,
  onRefresh,
}: {
  caseItem: CaseData;
  userRole: string;
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

  if (!caseItem.assignedOfficer) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <MessageSquare size={24} className="mb-2 opacity-40" />
        <p className="text-xs">No CID officer assigned yet.</p>
      </div>
    );
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
                    {new Date(m.sentAt).toLocaleString()}
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
    </div>
  );
}

// ─── Return to CID Modal ──────────────────────────────────────────────────────
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
  const [note, setNote] = useState("");
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
            action: "so-return",
            soDirective: directive.trim(),
            note,
          }),
        });
      }
      toast.success("Case returned to CID — notification sent");
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs font-bold text-yellow-700 uppercase mb-1">
            CID Submission Note
          </p>
          <p className="text-sm text-gray-700">{caseItem.cidSubmissionNote}</p>
        </div>
      )}
      <FormField label="Directive for Investigator *">
        <textarea
          className={inputCls}
          rows={4}
          value={directive}
          onChange={(e) => setDirective(e.target.value)}
          placeholder="Clearly state what further action is required..."
          style={{ resize: "vertical" }}
          required
        />
      </FormField>
      <FormField label="Internal Note (optional)">
        <textarea
          className={inputCls}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Additional notes..."
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
          disabled={loading}
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

// ─── Forward to DC Modal ──────────────────────────────────────────────────────
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
  const [reviewNote, setReviewNote] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("action", "so-forward");
        fd.append("assignedDC", selected);
        if (reviewNote) fd.append("soReviewNote", reviewNote);
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
            action: "so-forward",
            assignedDC: selected,
            soReviewNote: reviewNote,
            note,
          }),
        });
      }
      toast.success("Forwarded to District Commander — notification sent");
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
      <FormField label="SO Review Note (optional)">
        <textarea
          className={inputCls}
          rows={3}
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          placeholder="Summary for the Commander..."
          style={{ resize: "vertical" }}
        />
      </FormField>
      <FormField label="Internal Note (optional)">
        <textarea
          className={inputCls}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Additional notes..."
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
          disabled={loading || !selected}
          className="bg-blue-600 hover:bg-blue-700 text-white"
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

// ─── Detail Modal ─────────────────────────────────────────────────────────────
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
  const [tab, setTab] = useState<"info" | "thread" | "notes" | "parties">(
    "info",
  );
  const [noteContent, setNC] = useState("");
  const [noteFiles, setNF] = useState<File[]>([]);
  const [addingNote, setAN] = useState(false);

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

  const threadUnread = (caseItem.threadMessages || []).filter(
    (m) =>
      m.thread === "cid_so" &&
      m.fromRole !== "so" &&
      !m.readBy?.includes(userId),
  ).length;
  const TABS = [
    { id: "info", label: "Info" },
    {
      id: "thread",
      label: `CID Chat${threadUnread > 0 ? ` (${threadUnread})` : ""}`,
    },
    { id: "notes", label: `Notes (${caseItem.notes.length})` },
    { id: "parties", label: "Parties" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <p className="text-xs font-mono font-bold text-blue-600 mb-1">
            {caseItem.caseNumber}
          </p>
          <h3 className="text-base font-bold text-gray-900">
            {caseItem.title}
          </h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {caseItem.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={caseItem.status} />
          <PriorityBadge priority={caseItem.priority} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Location", val: caseItem.location },
              {
                label: "Date Occurred",
                val: new Date(caseItem.dateOccurred).toLocaleDateString(),
              },
              { label: "Reported By", val: caseItem.reportedBy.name },
              { label: "Category", val: caseItem.category, cap: true },
              ...(caseItem.loggedBy
                ? [{ label: "Logged By", val: caseItem.loggedBy.fullName }]
                : []),
              ...(caseItem.assignedOfficer
                ? [
                    {
                      label: "CID Investigator",
                      val: caseItem.assignedOfficer.fullName,
                    },
                  ]
                : []),
            ].map(({ label, val, cap }) => (
              <div
                key={label}
                className="bg-gray-50 rounded-lg p-3 border border-gray-100"
              >
                <p className="text-xs text-gray-400 mb-1">{label}</p>
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
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-bold text-yellow-700 uppercase mb-1">
                CID Submission Note
              </p>
              <p className="text-sm text-gray-700">
                {caseItem.cidSubmissionNote}
              </p>
            </div>
          )}
          {caseItem.soDirective && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs font-bold text-orange-700 uppercase mb-1">
                Your Directive (Returned to CID)
              </p>
              <p className="text-sm text-gray-700">{caseItem.soDirective}</p>
            </div>
          )}
          {caseItem.soReviewNote && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-xs font-bold text-purple-700 uppercase mb-1">
                Your Review Note
              </p>
              <p className="text-sm text-gray-700">{caseItem.soReviewNote}</p>
            </div>
          )}
        </div>
      )}

      {tab === "thread" && (
        <SOThread
          caseItem={caseItem}
          userRole={userRole}
          onRefresh={onRefresh}
        />
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
                      {new Date(n.addedAt).toLocaleString()}
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
              placeholder="Add a review note..."
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
              <p className="text-gray-400 text-xs">None recorded.</p>
            ) : (
              caseItem.suspects.map((s, i) => (
                <div
                  key={i}
                  className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2"
                >
                  <p className="font-semibold text-sm">
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
                  <p className="font-semibold text-sm">
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

      <div className="flex justify-end border-t border-gray-100 pt-3">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

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
            <Scale size={16} className="text-blue-600" />
            <span className="text-sm font-semibold text-blue-600">
              Station Officer
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Case Reviews</h1>
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
          label="Total Cases"
          value={total}
          sub="Assigned to you"
          icon={<Scale className="h-6 w-6 text-blue-600" />}
          iconBg="bg-blue-100"
        />
        <StatCard
          label="Awaiting Review"
          value={awaitingReview}
          sub="Submitted by CID"
          icon={<Clock className="h-6 w-6 text-purple-600" />}
          iconBg="bg-purple-100"
          valueColor="text-purple-600"
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
          icon={<MessageSquare className="h-6 w-6 text-yellow-600" />}
          iconBg="bg-yellow-100"
          valueColor={unreadCount > 0 ? "text-yellow-600" : "text-gray-900"}
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
            <Scale size={16} className="text-blue-600" />
            Cases Under Review ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
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
                const unread = (c.threadMessages || []).filter(
                  (m) =>
                    m.thread === "cid_so" &&
                    m.fromRole !== "so" &&
                    !m.readBy?.includes(userId),
                ).length;

                return (
                  <div
                    key={c._id}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${canReview ? "bg-purple-50 border-purple-200" : "bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm"}`}
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
                        {canReview && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                            <CheckCircle2 size={9} />
                            Needs Review
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
                        {new Date(c.createdAt).toLocaleDateString()}
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
                            <RotateCcw size={12} className="mr-1" />
                            Return
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setForwardCase(c)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3"
                          >
                            <ArrowUpRight size={12} className="mr-1" />
                            Forward
                          </Button>
                        </>
                      )}
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
            userRole={userRole}
            onRefresh={refreshDetail}
            onClose={() => setDetailCase(null)}
          />
        </Modal>
      )}
    </div>
  );
}
