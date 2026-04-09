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
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Star,
  Shield,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  CaseData,
  Pagination,
  UserRef,
  Attachment,
  STATUS_MAP,
  PRIORITY_STRIPE,
  PRIORITY_BADGE,
  ROLE_LABELS,
  CATEGORIES,
  formatBytes,
} from "@/components/cases/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Base styles ──────────────────────────────────────────────────────────────
const inputBase = `w-full bg-background border rounded-lg px-3 py-2.5 text-sm text-foreground
   placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition`;
const labelBase =
  "block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5";

// ─── Pill badge ───────────────────────────────────────────────────────────────
function Pill({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${className}`}
    >
      {children}
    </Badge>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
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
        className={`bg-card border rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-xl"} max-h-[92vh]`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="font-bold text-foreground text-sm tracking-wide">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelBase}>{label}</label>
      {children}
    </div>
  );
}

// ─── Attachment display ───────────────────────────────────────────────────────
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
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1 transition-colors"
        >
          <Download size={11} />
          {a.originalName || `file-${i + 1}`}
          {a.bytes && (
            <span className="text-primary/70">{formatBytes(a.bytes)}</span>
          )}
        </a>
      ))}
    </div>
  );
}

// ─── File attachment picker ───────────────────────────────────────────────────
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
      <label className={labelBase}>Attachments (optional)</label>
      <div
        onClick={() => ref.current?.click()}
        className="flex items-center gap-3 border border-dashed rounded-lg px-4 py-3 cursor-pointer hover:border-primary/50 transition-colors group"
      >
        <Paperclip
          size={14}
          className="text-muted-foreground group-hover:text-primary transition-colors"
        />
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
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
              className="flex items-center justify-between text-xs text-muted-foreground bg-muted rounded-lg px-3 py-1.5"
            >
              <span className="truncate">{f.name}</span>
              <button
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive ml-2 shrink-0"
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

// ─── DC broadcast / thread message panel ─────────────────────────────────────
// DC can message any participant — NCO, CID, or SO
function DCThreadPanel({
  caseItem,
  userId,
  onRefresh,
}: {
  caseItem: CaseData;
  userId: string;
  onRefresh: () => void;
}) {
  const [content, setContent] = useState("");
  const [toRole, setToRole] = useState("so");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const msgs = (caseItem.threadMessages || [])
    .filter((m) => m.thread === "dc")
    .sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  // Build selectable recipients based on who's been assigned
  const recipients: { role: string; label: string }[] = [];
  if (caseItem.loggedBy)
    recipients.push({
      role: "nco",
      label: `NCO — ${caseItem.loggedBy.fullName}`,
    });
  if (caseItem.assignedOfficer)
    recipients.push({
      role: "cid",
      label: `CID — ${caseItem.assignedOfficer.fullName}`,
    });
  if (caseItem.assignedSO)
    recipients.push({
      role: "so",
      label: `SO — ${caseItem.assignedSO.fullName}`,
    });

  useEffect(() => {
    if (recipients.length > 0 && !recipients.find((r) => r.role === toRole)) {
      setToRole(recipients[0].role);
    }
  }, [recipients.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !toRole) return;
    setSending(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("action", "send-message");
        fd.append("thread", "dc");
        fd.append("content", content.trim());
        fd.append("toRole", toRole);
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
            thread: "dc",
            content: content.trim(),
            toRole,
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
    <div className="flex flex-col h-72">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare size={28} className="mb-2 opacity-40" />
            <p className="text-xs">
              No DC messages sent yet. Use this to communicate with the team.
            </p>
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.fromRole === "dc";
            return (
              <div
                key={m._id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] rounded-xl px-4 py-2.5 ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                    >
                      {m.fromUser?.fullName || ROLE_LABELS[m.fromRole]}
                    </span>
                    <ChevronRight
                      size={10}
                      className={
                        mine
                          ? "text-primary-foreground/60"
                          : "text-muted-foreground/60"
                      }
                    />
                    <span
                      className={`text-xs ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                    >
                      {ROLE_LABELS[m.toRole || ""] || m.toRole}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{m.content}</p>
                  <AttachmentList attachments={m.attachments} />
                  <p
                    className={`text-xs mt-1.5 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
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

      {recipients.length > 0 ? (
        <form onSubmit={send} className="border-t pt-3 mt-3 space-y-2">
          <FilePicker files={files} onChange={setFiles} />
          <div className="flex gap-2">
            <select
              className={`${inputBase} shrink-0 w-48`}
              value={toRole}
              onChange={(e) => setToRole(e.target.value)}
            >
              {recipients.map((r) => (
                <option key={r.role} value={r.role} className="bg-background">
                  {r.label}
                </option>
              ))}
            </select>
            <input
              className={`${inputBase} flex-1`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Send directive or message…"
            />
            <Button
              type="submit"
              disabled={sending || !content.trim()}
              size="sm"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground text-center pt-3 border-t">
          No participants assigned yet to message.
        </p>
      )}
    </div>
  );
}

// ─── DC Close / Suspend modals ────────────────────────────────────────────────
function DCActionModal({
  caseItem,
  action,
  onSuccess,
  onClose,
}: {
  caseItem: CaseData;
  action: "dc-close" | "dc-suspend";
  onSuccess: () => void;
  onClose: () => void;
}) {
  const isClose = action === "dc-close";
  const [dcNote, setDcNote] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("action", action);
        if (dcNote) fd.append("dcNote", dcNote);
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
          body: JSON.stringify({ action, dcNote, note }),
        });
      }
      toast.success(isClose ? "Case closed successfully" : "Case suspended");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div
        className={`${isClose ? "bg-emerald-500/5 border-emerald-500/20" : "bg-orange-500/5 border-orange-500/20"} border rounded-xl p-4`}
      >
        <div className="flex items-start gap-3">
          {isClose ? (
            <CheckCircle2
              size={16}
              className="text-emerald-600 shrink-0 mt-0.5"
            />
          ) : (
            <TrendingDown
              size={16}
              className="text-orange-600 shrink-0 mt-0.5"
            />
          )}
          <div>
            <p
              className={`font-bold text-sm ${isClose ? "text-emerald-700" : "text-orange-700"}`}
            >
              {isClose ? "Close This Case" : "Suspend This Case"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {caseItem.caseNumber} — {caseItem.title}
            </p>
          </div>
        </div>
      </div>

      {/* Full case summary for DC review */}
      <div className="space-y-2">
        {caseItem.ncoReferralNote && (
          <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-3">
            <p className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">
              NCO Referral Note
            </p>
            <p className="text-xs text-foreground">
              {caseItem.ncoReferralNote}
            </p>
          </div>
        )}
        {caseItem.cidSubmissionNote && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
              CID Submission Note
            </p>
            <p className="text-xs text-foreground">
              {caseItem.cidSubmissionNote}
            </p>
          </div>
        )}
        {caseItem.soReviewNote && (
          <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
            <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-1">
              SO Review Note
            </p>
            <p className="text-xs text-foreground">{caseItem.soReviewNote}</p>
          </div>
        )}
      </div>

      <Field label={`${isClose ? "Closure" : "Suspension"} Note (optional)`}>
        <textarea
          className={inputBase}
          rows={4}
          value={dcNote}
          onChange={(e) => setDcNote(e.target.value)}
          placeholder={
            isClose
              ? "Final decision notes, outcome, verdict..."
              : "Reason for suspension, conditions for re-opening..."
          }
          style={{ resize: "vertical" }}
        />
      </Field>

      <Field label="Internal Note (optional)">
        <textarea
          className={inputBase}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Additional internal notes..."
          style={{ resize: "vertical" }}
        />
      </Field>

      <FilePicker files={files} onChange={setFiles} />

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          variant={isClose ? "default" : "destructive"}
        >
          {loading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-2" />
          )}
          {isClose ? (
            <>
              <CheckCircle2 size={14} className="mr-1.5" /> Close Case
            </>
          ) : (
            <>
              <TrendingDown size={14} className="mr-1.5" /> Suspend Case
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
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
    "info" | "dc_msgs" | "all_msgs" | "notes" | "parties"
  >("info");
  const [noteContent, setNC] = useState("");
  const [noteFiles, setNF] = useState<File[]>([]);
  const [addingNote, setAN] = useState(false);

  const s = STATUS_MAP[caseItem.status] || STATUS_MAP.open;

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

  // DC sees all thread messages
  const allThreadMsgs = (caseItem.threadMessages || []).sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );

  const tabs = [
    { id: "info", label: "Info" },
    { id: "dc_msgs", label: "DC Comms" },
    { id: "all_msgs", label: `All Threads (${allThreadMsgs.length})` },
    { id: "notes", label: `Notes (${caseItem.notes.length})` },
    { id: "parties", label: "Parties" },
  ] as const;

  const THREAD_BADGE: Record<string, string> = {
    nco_cid: "text-sky-600 bg-sky-50 border-sky-200",
    cid_so: "text-amber-600 bg-amber-50 border-amber-200",
    dc: "text-primary bg-primary/10 border-primary/20",
  };
  const THREAD_LABEL: Record<string, string> = {
    nco_cid: "NCO ↔ CID",
    cid_so: "CID ↔ SO",
    dc: "DC Comms",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1">
          <p className="text-xs font-mono text-primary mb-1">
            {caseItem.caseNumber}
          </p>
          <h3 className="text-base font-bold text-foreground">
            {caseItem.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
            {caseItem.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Pill className={s.color}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </Pill>
          <Pill className={PRIORITY_BADGE[caseItem.priority] || ""}>
            {caseItem.priority}
          </Pill>
        </div>
      </div>

      <div className="flex gap-0.5 bg-muted rounded-lg p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit py-1.5 px-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                icon: <MapPin size={11} />,
                label: "Location",
                val: caseItem.location,
              },
              {
                icon: <Calendar size={11} />,
                label: "Date Occurred",
                val: new Date(caseItem.dateOccurred).toLocaleDateString(),
              },
              {
                icon: <User size={11} />,
                label: "Reported By",
                val: caseItem.reportedBy.name,
              },
              {
                icon: <FileText size={11} />,
                label: "Category",
                val: caseItem.category,
                cap: true,
              },
              ...(caseItem.loggedBy
                ? [
                    {
                      icon: <User size={11} />,
                      label: "Logged By (NCO)",
                      val: caseItem.loggedBy.fullName,
                    },
                  ]
                : []),
              ...(caseItem.assignedOfficer
                ? [
                    {
                      icon: <Users size={11} />,
                      label: "CID Officer",
                      val: caseItem.assignedOfficer.fullName,
                    },
                  ]
                : []),
              ...(caseItem.assignedSO
                ? [
                    {
                      icon: <Shield size={11} />,
                      label: "Station Officer",
                      val: caseItem.assignedSO.fullName,
                    },
                  ]
                : []),
            ].map(({ icon, label, val, cap }) => (
              <div key={label} className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                  {icon}
                  <span>{label}</span>
                </div>
                <p
                  className={`text-foreground text-sm font-medium ${cap ? "capitalize" : ""}`}
                >
                  {val}
                </p>
              </div>
            ))}
          </div>
          {/* Full paper trail */}
          <div className="space-y-2">
            {caseItem.ncoReferralNote && (
              <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-3">
                <p className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">
                  NCO Referral Note
                </p>
                <p className="text-sm text-foreground">
                  {caseItem.ncoReferralNote}
                </p>
              </div>
            )}
            {caseItem.cidSubmissionNote && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
                  CID Submission Note
                </p>
                <p className="text-sm text-foreground">
                  {caseItem.cidSubmissionNote}
                </p>
              </div>
            )}
            {caseItem.soDirective && (
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">
                  SO Directive (Returned to CID)
                </p>
                <p className="text-sm text-foreground">
                  {caseItem.soDirective}
                </p>
              </div>
            )}
            {caseItem.soReviewNote && (
              <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
                <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-1">
                  SO Review Note
                </p>
                <p className="text-sm text-foreground">
                  {caseItem.soReviewNote}
                </p>
              </div>
            )}
            {caseItem.dcNote && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                  DC Final Note
                </p>
                <p className="text-sm text-foreground">{caseItem.dcNote}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "dc_msgs" && (
        <DCThreadPanel
          caseItem={caseItem}
          userId={userId}
          onRefresh={onRefresh}
        />
      )}

      {/* All threads read-only view for DC */}
      {tab === "all_msgs" && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {allThreadMsgs.length === 0 ? (
            <p className="text-muted-foreground text-xs text-center py-8">
              No messages across any thread.
            </p>
          ) : (
            allThreadMsgs.map((m) => (
              <div key={m._id} className="bg-muted/50 rounded-lg p-3 border">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Pill className={THREAD_BADGE[m.thread] || ""}>
                      {THREAD_LABEL[m.thread] || m.thread}
                    </Pill>
                    <span className="text-xs font-semibold text-foreground">
                      {m.fromUser?.fullName || ROLE_LABELS[m.fromRole]}
                    </span>
                    <ChevronRight size={10} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABELS[m.toRole || ""] || m.toRole}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.sentAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {m.content}
                </p>
                <AttachmentList attachments={m.attachments} />
              </div>
            ))
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-3">
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {caseItem.notes.length === 0 ? (
              <p className="text-muted-foreground text-xs text-center py-8">
                No notes yet.
              </p>
            ) : (
              caseItem.notes.map((n) => (
                <div key={n._id} className="bg-muted/50 rounded-lg p-3 border">
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-xs font-semibold text-primary">
                      {n.addedBy?.fullName || "Unknown"}
                      {n.roleSnapshot && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({ROLE_LABELS[n.roleSnapshot] || n.roleSnapshot})
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(n.addedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {n.content}
                  </p>
                  <AttachmentList attachments={n.attachments} />
                </div>
              ))
            )}
          </div>
          <form onSubmit={addNote} className="border-t pt-3 space-y-3">
            <textarea
              className={inputBase}
              rows={2}
              value={noteContent}
              onChange={(e) => setNC(e.target.value)}
              placeholder="Add a commander note..."
              style={{ resize: "vertical" }}
            />
            <FilePicker files={noteFiles} onChange={setNF} />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={addingNote || !noteContent.trim()}
                size="sm"
                className="gap-2"
              >
                {addingNote ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <StickyNote size={12} />
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
            <p className={labelBase}>Suspects ({caseItem.suspects.length})</p>
            {caseItem.suspects.length === 0 ? (
              <p className="text-muted-foreground text-xs">None recorded.</p>
            ) : (
              caseItem.suspects.map((s, i) => (
                <div
                  key={i}
                  className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-2"
                >
                  <p className="font-semibold text-sm text-foreground">
                    {s.name}
                    {s.age && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Age {s.age}
                      </span>
                    )}
                  </p>
                  {s.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.description}
                    </p>
                  )}
                  {s.address && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      📍 {s.address}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          <div>
            <p className={labelBase}>Witnesses ({caseItem.witnesses.length})</p>
            {caseItem.witnesses.length === 0 ? (
              <p className="text-muted-foreground text-xs">None recorded.</p>
            ) : (
              caseItem.witnesses.map((w, i) => (
                <div
                  key={i}
                  className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 mb-2"
                >
                  <p className="font-semibold text-sm text-foreground">
                    {w.name}
                    {w.phone && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {w.phone}
                      </span>
                    )}
                  </p>
                  {w.statement && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">
                      "{w.statement}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end border-t pt-3">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center ${iconBg}`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function DCCasesPage() {
  const userId = "CURRENT_USER_ID";
  const userRole = "dc";

  const [cases, setCases] = useState<CaseData[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);

  const [detailCase, setDetailCase] = useState<CaseData | null>(null);
  const [actionCase, setActionCase] = useState<{
    case: CaseData;
    action: "dc-close" | "dc-suspend";
  } | null>(null);

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
  const commanderReview = cases.filter(
    (c) => c.status === "commander_review",
  ).length;
  const closedCount = cases.filter((c) => c.status === "closed").length;
  const suspendedCount = cases.filter((c) => c.status === "suspended").length;
  const activeCount = cases.filter(
    (c) => !["closed", "suspended"].includes(c.status),
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={14} className="text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-widest">
                District Commander
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Command Overview
            </h1>
          </div>
          <Button
            onClick={fetchCases}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Cases"
            value={total}
            sub="Full district view"
            icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            label="Awaiting Decision"
            value={commanderReview}
            sub="Forwarded to you"
            icon={<Clock className="h-5 w-5 text-rose-600" />}
            iconBg="bg-rose-100"
          />
          <StatCard
            label="Active Cases"
            value={activeCount}
            sub="In progress"
            icon={<Shield className="h-5 w-5 text-sky-600" />}
            iconBg="bg-sky-100"
          />
          <StatCard
            label="Resolved"
            value={closedCount + suspendedCount}
            sub={`${closedCount} closed · ${suspendedCount} suspended`}
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-100"
          />
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  className={`${inputBase} pl-9`}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search all cases…"
                />
              </div>
              <select
                className={`${inputBase} min-w-40`}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all" className="bg-background">
                  All Statuses
                </option>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <option key={k} value={k} className="bg-background">
                    {v.label}
                  </option>
                ))}
              </select>
              <select
                className={`${inputBase} min-w-36`}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all" className="bg-background">
                  All Categories
                </option>
                {CATEGORIES.map((c) => (
                  <option
                    key={c}
                    value={c}
                    className="bg-background capitalize"
                  >
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText size={16} className="text-muted-foreground" />
              District Cases ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : cases.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No cases in the district.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cases.map((c) => {
                  const s = STATUS_MAP[c.status] || STATUS_MAP.open;
                  const canDecide = c.status === "commander_review";
                  const dcMsgCount = (c.threadMessages || []).filter(
                    (m) => m.thread === "dc",
                  ).length;

                  return (
                    <div
                      key={c._id}
                      className={`flex items-center gap-3 p-4 bg-muted/40 rounded-xl border hover:border-border transition-all group ${canDecide ? "border-primary/30" : ""}`}
                    >
                      <div
                        className={`w-0.5 h-10 rounded-full shrink-0 ${PRIORITY_STRIPE[c.priority] || "bg-muted-foreground/30"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <span className="text-xs font-mono font-bold text-primary">
                            {c.caseNumber}
                          </span>
                          <Pill className={PRIORITY_BADGE[c.priority] || ""}>
                            {c.priority}
                          </Pill>
                          <Pill className={s.color}>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${s.dot}`}
                            />
                            {s.label}
                          </Pill>
                          {canDecide && (
                            <Pill className="text-primary bg-primary/10 border-primary/20">
                              <Star size={9} className="fill-primary" />
                              Decision Required
                            </Pill>
                          )}
                          {dcMsgCount > 0 && (
                            <Pill className="text-primary bg-primary/10 border-primary/20">
                              <MessageSquare size={9} />
                              {dcMsgCount} DC msgs
                            </Pill>
                          )}
                        </div>
                        <p className="font-bold text-foreground text-sm truncate">
                          {c.title}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground capitalize">
                            {c.category}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            📍 {c.location}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            👤 {c.reportedBy.name}
                          </span>
                          {c.assignedSO && (
                            <span className="text-xs text-muted-foreground">
                              ⚖️ SO: {c.assignedSO.fullName}
                            </span>
                          )}
                          {c.assignedOfficer && (
                            <span className="text-xs text-muted-foreground">
                              🔍 {c.assignedOfficer.fullName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          {c.notes.length} note{c.notes.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          title="View"
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailCase(c)}
                          className="h-9 w-9"
                        >
                          <Eye size={15} />
                        </Button>
                        {canDecide && (
                          <>
                            <Button
                              onClick={() =>
                                setActionCase({ case: c, action: "dc-close" })
                              }
                              size="sm"
                              className="gap-1.5"
                            >
                              <CheckCircle2 size={12} /> Close
                            </Button>
                            <Button
                              onClick={() =>
                                setActionCase({ case: c, action: "dc-suspend" })
                              }
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                            >
                              <TrendingDown size={12} /> Suspend
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
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(p)}
                      className="w-8 h-8 text-xs font-bold"
                    >
                      {p}
                    </Button>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
      {actionCase && (
        <Modal
          title={`${actionCase.action === "dc-close" ? "Close" : "Suspend"} Case — ${actionCase.case.caseNumber}`}
          onClose={() => setActionCase(null)}
        >
          <DCActionModal
            caseItem={actionCase.case}
            action={actionCase.action}
            onSuccess={() => {
              fetchCases();
              setActionCase(null);
            }}
            onClose={() => setActionCase(null)}
          />
        </Modal>
      )}
    </div>
  );
}
