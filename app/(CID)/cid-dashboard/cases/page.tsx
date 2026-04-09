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
  UserPlus,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  CaseData,
  Pagination,
  UserRef,
  ThreadMessage,
  Note,
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

// ─── Thread chat panel ────────────────────────────────────────────────────────
function ThreadPanel({
  caseItem,
  userId,
  userRole,
  thread,
  onRefresh,
}: {
  caseItem: CaseData;
  userId: string;
  userRole: string;
  thread: "nco_cid" | "cid_so" | "dc";
  onRefresh: () => void;
}) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const msgs = (caseItem.threadMessages || [])
    .filter((m) => m.thread === thread)
    .sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const otherRoleLabel =
    thread === "nco_cid"
      ? userRole === "nco" || userRole === "so"
        ? "CID Investigator"
        : "NCO / Station Orderly"
      : thread === "cid_so"
        ? userRole === "cid"
          ? "Station Officer"
          : "CID Investigator"
        : "All Parties";

  const toRoleForThread =
    thread === "nco_cid"
      ? userRole === "nco" || userRole === "so"
        ? "cid"
        : "nco"
      : thread === "cid_so"
        ? userRole === "cid"
          ? "so"
          : "cid"
        : undefined;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("action", "send-message");
        fd.append("thread", thread);
        fd.append("content", content.trim());
        if (toRoleForThread) fd.append("toRole", toRoleForThread);
        files.forEach((f) => fd.append("attachments", f));
        const res = await fetch(`/api/cases/${caseItem._id}`, {
          method: "PUT",
          credentials: "include",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
      } else {
        await api(`/api/cases/${caseItem._id}`, {
          method: "PUT",
          body: JSON.stringify({
            action: "send-message",
            thread,
            content: content.trim(),
            toRole: toRoleForThread,
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

  const canSend = (() => {
    if (thread === "nco_cid")
      return (
        ((userRole === "nco" || userRole === "so") &&
          !!caseItem.assignedOfficer) ||
        userRole === "cid"
      );
    if (thread === "cid_so")
      return (userRole === "cid" && !!caseItem.assignedSO) || userRole === "so";
    if (thread === "dc") return userRole === "dc" || userRole === "admin";
    return false;
  })();

  return (
    <div className="flex flex-col h-64">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare size={28} className="mb-2 opacity-40" />
            <p className="text-xs">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.fromUser?._id === userId || m.fromRole === userRole;
            return (
              <div
                key={m._id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-xl px-4 py-2.5 ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
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
                      {m.toRole ? ROLE_LABELS[m.toRole] : otherRoleLabel}
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

      {canSend && (
        <form onSubmit={send} className="border-t pt-3 mt-3 space-y-2">
          <FilePicker files={files} onChange={setFiles} />
          <div className="flex gap-2">
            <input
              className={`${inputBase} flex-1`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Message ${otherRoleLabel}...`}
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
      )}
    </div>
  );
}

// ─── Add suspects/witnesses modal ─────────────────────────────────────────────
function AddPartiesModal({
  caseItem,
  onSuccess,
  onClose,
}: {
  caseItem: CaseData;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [suspects, setSuspects] = useState([
    { name: "", age: "", description: "", address: "" },
  ]);
  const [witnesses, setWitnesses] = useState([
    { name: "", phone: "", statement: "" },
  ]);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validSuspects = suspects.filter((s) => s.name.trim());
    const validWitnesses = witnesses.filter((w) => w.name.trim());

    if (validSuspects.length === 0 && validWitnesses.length === 0) {
      toast.error("Add at least one suspect or witness");
      return;
    }

    setLoading(true);
    try {
      await api(`/api/cases/${caseItem._id}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "add-parties",
          suspects: validSuspects.map((s) => ({
            ...s,
            age: s.age ? parseInt(s.age) : undefined,
          })),
          witnesses: validWitnesses,
        }),
      });
      toast.success("Parties added");
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
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs font-mono text-primary mb-1">
            {caseItem.caseNumber}
          </p>
          <p className="font-bold text-foreground text-sm">{caseItem.title}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className={labelBase}>Suspects</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSuspects([
                ...suspects,
                { name: "", age: "", description: "", address: "" },
              ])
            }
          >
            Add Suspect
          </Button>
        </div>
        {suspects.map((s, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name *">
                <input
                  className={inputBase}
                  value={s.name}
                  onChange={(e) => {
                    const n = [...suspects];
                    n[i].name = e.target.value;
                    setSuspects(n);
                  }}
                  placeholder="Suspect name"
                />
              </Field>
              <Field label="Age">
                <input
                  className={inputBase}
                  type="number"
                  value={s.age}
                  onChange={(e) => {
                    const n = [...suspects];
                    n[i].age = e.target.value;
                    setSuspects(n);
                  }}
                  placeholder="Age"
                />
              </Field>
            </div>
            <Field label="Description">
              <input
                className={inputBase}
                value={s.description}
                onChange={(e) => {
                  const n = [...suspects];
                  n[i].description = e.target.value;
                  setSuspects(n);
                }}
                placeholder="Physical description, clothing, etc."
              />
            </Field>
            <Field label="Address">
              <input
                className={inputBase}
                value={s.address}
                onChange={(e) => {
                  const n = [...suspects];
                  n[i].address = e.target.value;
                  setSuspects(n);
                }}
                placeholder="Known address"
              />
            </Field>
            {suspects.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSuspects(suspects.filter((_, j) => j !== i))}
                className="text-destructive"
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className={labelBase}>Witnesses</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setWitnesses([
                ...witnesses,
                { name: "", phone: "", statement: "" },
              ])
            }
          >
            Add Witness
          </Button>
        </div>
        {witnesses.map((w, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name *">
                <input
                  className={inputBase}
                  value={w.name}
                  onChange={(e) => {
                    const n = [...witnesses];
                    n[i].name = e.target.value;
                    setWitnesses(n);
                  }}
                  placeholder="Witness name"
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputBase}
                  value={w.phone}
                  onChange={(e) => {
                    const n = [...witnesses];
                    n[i].phone = e.target.value;
                    setWitnesses(n);
                  }}
                  placeholder="Contact number"
                />
              </Field>
            </div>
            <Field label="Statement">
              <textarea
                className={inputBase}
                rows={2}
                value={w.statement}
                onChange={(e) => {
                  const n = [...witnesses];
                  n[i].statement = e.target.value;
                  setWitnesses(n);
                }}
                placeholder="Witness statement..."
                style={{ resize: "vertical" }}
              />
            </Field>
            {witnesses.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setWitnesses(witnesses.filter((_, j) => j !== i))
                }
                className="text-destructive"
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-2" />
          )}
          Add Parties
        </Button>
      </div>
    </form>
  );
}

// ─── Submit to SO modal ───────────────────────────────────────────────────────
function SubmitSOModal({
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
  const [submissionNote, setSubmissionNote] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/api/users/by-role?role=so")
      .then((d) => setOfficers(d.users))
      .catch(() => toast.error("Failed to load Station Officers"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast.error("Select a Station Officer");
      return;
    }
    setLoading(true);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("action", "cid-submit");
        fd.append("assignedSO", selected);
        if (submissionNote) fd.append("cidSubmissionNote", submissionNote);
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
            action: "cid-submit",
            assignedSO: selected,
            cidSubmissionNote: submissionNote,
            note,
          }),
        });
      }
      toast.success("Case submitted to Station Officer");
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
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs font-mono text-primary mb-1">
            {caseItem.caseNumber}
          </p>
          <p className="font-bold text-foreground text-sm">{caseItem.title}</p>
          <Pill className={PRIORITY_BADGE[caseItem.priority] || ""}>
            {caseItem.priority}
          </Pill>
        </CardContent>
      </Card>

      <Field label="Assign Station Officer *">
        <select
          className={inputBase}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
        >
          <option value="" className="bg-background">
            — Select Officer —
          </option>
          {officers.map((o) => (
            <option key={o._id} value={o._id} className="bg-background">
              {o.fullName} ({o.email})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Submission Note (optional)">
        <textarea
          className={inputBase}
          rows={3}
          value={submissionNote}
          onChange={(e) => setSubmissionNote(e.target.value)}
          placeholder="Summary of investigation findings..."
          style={{ resize: "vertical" }}
        />
      </Field>

      <Field label="Additional Note (optional)">
        <textarea
          className={inputBase}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any other notes..."
          style={{ resize: "vertical" }}
        />
      </Field>

      <FilePicker files={files} onChange={setFiles} />

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !selected} className="gap-2">
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          Submit to SO
        </Button>
      </div>
    </form>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
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
    "info" | "thread_nco" | "thread_so" | "notes" | "parties"
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

  const ncoUnread = (caseItem.threadMessages || []).filter(
    (m) =>
      m.thread === "nco_cid" &&
      m.fromRole !== userRole &&
      !m.readBy?.includes(userId),
  ).length;

  const soUnread = (caseItem.threadMessages || []).filter(
    (m) =>
      m.thread === "cid_so" &&
      m.fromRole !== userRole &&
      !m.readBy?.includes(userId),
  ).length;

  const tabs = [
    { id: "info", label: "Info" },
    {
      id: "thread_nco",
      label: `NCO Chat${ncoUnread > 0 ? ` (${ncoUnread})` : ""}`,
    },
    {
      id: "thread_so",
      label: `SO Chat${soUnread > 0 ? ` (${soUnread})` : ""}`,
    },
    { id: "notes", label: `Notes (${caseItem.notes.length})` },
    {
      id: "parties",
      label: `Parties (${caseItem.suspects.length + caseItem.witnesses.length})`,
    },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
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

      {/* Tabs */}
      <div className="flex gap-0.5 bg-muted rounded-lg p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 whitespace-nowrap py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
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
                      label: "Logged By",
                      val: caseItem.loggedBy.fullName,
                    },
                  ]
                : []),
              ...(caseItem.assignedSO
                ? [
                    {
                      icon: <Users size={11} />,
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

          {/* Handoff notes */}
          {caseItem.ncoReferralNote && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                NCO Referral Note
              </p>
              <p className="text-sm text-foreground">
                {caseItem.ncoReferralNote}
              </p>
            </div>
          )}
          {caseItem.soDirective && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
              <p className="text-xs font-bold text-destructive uppercase tracking-wider mb-1">
                SO Directive
              </p>
              <p className="text-sm text-foreground">{caseItem.soDirective}</p>
            </div>
          )}
          {caseItem.attachments?.length ? (
            <div>
              <p className={labelBase}>Case Attachments</p>
              <AttachmentList attachments={caseItem.attachments} />
            </div>
          ) : null}
        </div>
      )}

      {/* Tab: NCO Thread */}
      {tab === "thread_nco" && (
        <ThreadPanel
          caseItem={caseItem}
          userId={userId}
          userRole={userRole}
          thread="nco_cid"
          onRefresh={onRefresh}
        />
      )}

      {/* Tab: SO Thread */}
      {tab === "thread_so" && (
        <div>
          {!caseItem.assignedSO ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare size={28} className="mb-2 opacity-40" />
              <p className="text-xs text-center">
                Submit this case to a Station Officer first.
              </p>
            </div>
          ) : (
            <ThreadPanel
              caseItem={caseItem}
              userId={userId}
              userRole={userRole}
              thread="cid_so"
              onRefresh={onRefresh}
            />
          )}
        </div>
      )}

      {/* Tab: Notes */}
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
              placeholder="Add investigation note..."
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

      {/* Tab: Parties */}
      {tab === "parties" && (
        <div className="space-y-4">
          <div>
            <p className={labelBase}>Suspects ({caseItem.suspects.length})</p>
            {caseItem.suspects.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No suspects recorded.
              </p>
            ) : (
              <div className="space-y-2">
                {caseItem.suspects.map((s, i) => (
                  <div
                    key={i}
                    className="bg-destructive/5 border border-destructive/20 rounded-lg p-3"
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
                ))}
              </div>
            )}
          </div>
          <div>
            <p className={labelBase}>Witnesses ({caseItem.witnesses.length})</p>
            {caseItem.witnesses.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No witnesses recorded.
              </p>
            ) : (
              <div className="space-y-2">
                {caseItem.witnesses.map((w, i) => (
                  <div
                    key={i}
                    className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3"
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
                ))}
              </div>
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
export default function CIDCasesPage() {
  const userId = "CURRENT_USER_ID";
  const userRole = "cid";

  const [cases, setCases] = useState<CaseData[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);

  const [addPartiesCase, setAddPartiesCase] = useState<CaseData | null>(null);
  const [submitCase, setSubmitCase] = useState<CaseData | null>(null);
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
  const investigating = cases.filter(
    (c) => c.status === "investigating",
  ).length;
  const returnedCount = cases.filter((c) => c.status === "referred").length;
  const unreadCount = cases.reduce(
    (acc, c) =>
      acc +
      (c.threadMessages || []).filter(
        (m) =>
          (m.thread === "nco_cid" || m.thread === "cid_so") &&
          m.fromRole !== "cid" &&
          !m.readBy?.includes(userId),
      ).length,
    0,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={14} className="text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-widest">
                CID Investigator
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              My Investigations
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

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Assigned"
            value={total}
            sub="Cases assigned to you"
            icon={<FileText className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            label="Investigating"
            value={investigating}
            sub="Active investigations"
            icon={<Clock className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-100"
          />
          <StatCard
            label="Returned by SO"
            value={returnedCount}
            sub="Need further action"
            icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-100"
          />
          <StatCard
            label="Unread Messages"
            value={unreadCount}
            sub="From NCO & SO"
            icon={<MessageSquare className="h-5 w-5 text-sky-600" />}
            iconBg="bg-sky-100"
          />
        </div>

        {/* Filters */}
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
                  placeholder="Search case number, title, reporter…"
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

        {/* Cases list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText size={16} className="text-muted-foreground" />
              My Cases ({total})
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
                <p className="text-sm">No cases assigned to you yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cases.map((c) => {
                  const s = STATUS_MAP[c.status] || STATUS_MAP.open;
                  const canInvestigate = ["referred", "investigating"].includes(
                    c.status,
                  );
                  const canSubmit = c.status === "investigating";
                  const unread = (c.threadMessages || []).filter(
                    (m) =>
                      (m.thread === "nco_cid" || m.thread === "cid_so") &&
                      m.fromRole !== "cid" &&
                      !m.readBy?.includes(userId),
                  ).length;

                  return (
                    <div
                      key={c._id}
                      className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border hover:border-border transition-all group"
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
                          {c.status === "referred" && c.soDirective && (
                            <Pill className="text-destructive bg-destructive/10 border-destructive/20">
                              <AlertTriangle size={9} />
                              SO Directive
                            </Pill>
                          )}
                          {unread > 0 && (
                            <Pill className="text-primary bg-primary/10 border-primary/20">
                              <MessageSquare size={9} />
                              {unread} new
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
                              👮 {c.assignedSO.fullName}
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
                        {canInvestigate && (
                          <Button
                            onClick={() => setAddPartiesCase(c)}
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                          >
                            <UserPlus size={12} /> Parties
                          </Button>
                        )}
                        {canSubmit && (
                          <Button
                            onClick={() => setSubmitCase(c)}
                            size="sm"
                            className="gap-1.5"
                          >
                            <Send size={12} /> Submit
                          </Button>
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

      {/* Modals */}
      {addPartiesCase && (
        <Modal
          title={`Add Parties — ${addPartiesCase.caseNumber}`}
          onClose={() => setAddPartiesCase(null)}
        >
          <AddPartiesModal
            caseItem={addPartiesCase}
            onSuccess={fetchCases}
            onClose={() => setAddPartiesCase(null)}
          />
        </Modal>
      )}
      {submitCase && (
        <Modal
          title={`Submit to SO — ${submitCase.caseNumber}`}
          onClose={() => setSubmitCase(null)}
        >
          <SubmitSOModal
            caseItem={submitCase}
            onSuccess={fetchCases}
            onClose={() => setSubmitCase(null)}
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
