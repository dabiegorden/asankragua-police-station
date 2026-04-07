"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  CheckCircle,
  MapPin,
  Calendar,
  User,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRef {
  _id: string;
  fullName: string;
  email: string;
  role: string;
}
interface Note {
  _id: string;
  content: string;
  addedBy: UserRef;
  roleSnapshot?: string;
  addedAt: string;
}
interface ProgressMsg {
  _id: string;
  content: string;
  fromUser: UserRef;
  fromRole: string;
  toRole: string;
  toUser?: UserRef;
  sentAt: string;
}

interface CaseData {
  _id: string;
  caseNumber: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  currentStage: string;
  reportedBy: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  location: string;
  dateOccurred: string;
  dateReported: string;
  createdAt: string;
  loggedBy?: UserRef;
  assignedOfficer?: UserRef;
  assignedSO?: UserRef;
  assignedDC?: UserRef;
  notes: Note[];
  progressMessages: ProgressMsg[];
  ncoReferralNote?: string;
  cidSubmissionNote?: string;
  soReviewNote?: string;
  soDirective?: string;
  dcNote?: string;
  suspects: Array<{
    name: string;
    age?: number;
    description?: string;
    address?: string;
  }>;
  witnesses: Array<{ name: string; phone?: string; statement?: string }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-green-100 text-green-800" },
  referred: { label: "Referred to CID", color: "bg-blue-100 text-blue-800" },
  investigating: {
    label: "Investigating",
    color: "bg-yellow-100 text-yellow-800",
  },
  under_review: {
    label: "Under Review",
    color: "bg-purple-100 text-purple-800",
  },
  commander_review: {
    label: "Commander Review",
    color: "bg-pink-100 text-pink-800",
  },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-800" },
  suspended: { label: "Suspended", color: "bg-red-100 text-red-800" },
};

const PRIORITY_MAP: Record<string, string> = {
  Felony: "bg-red-100 text-red-800",
  Misdemeanour: "bg-orange-100 text-orange-800",
  "Summary Offence": "bg-blue-100 text-blue-800",
};

const ROLE_LABELS: Record<string, string> = {
  nco: "NCO / Station Orderly",
  cid: "Investigator / CID",
  so: "Station Officer",
  dc: "District Commander",
};

const CATEGORIES = [
  "theft",
  "assault",
  "fraud",
  "domestic",
  "traffic",
  "drug",
  "other",
];

// ─── API helper ───────────────────────────────────────────────────────────────

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[90vh]`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const selectCls = `${inputCls} cursor-pointer`;

// ─── Create / Edit Case Form ──────────────────────────────────────────────────

type CaseFormData = {
  title: string;
  description: string;
  category: string;
  priority: string;
  location: string;
  dateOccurred: string;
  notes: string;
  reportedBy: { name: string; phone: string; email: string; address: string };
};

const BLANK_FORM: CaseFormData = {
  title: "",
  description: "",
  category: "other",
  priority: "Summary Offence",
  location: "",
  dateOccurred: "",
  notes: "",
  reportedBy: { name: "", phone: "", email: "", address: "" },
};

function CaseForm({
  initial,
  onSuccess,
  onClose,
}: {
  initial?: Partial<CaseFormData>;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CaseFormData>({ ...BLANK_FORM, ...initial });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof CaseFormData, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setRB = (k: keyof CaseFormData["reportedBy"], v: string) =>
    setForm((f) => ({ ...f, reportedBy: { ...f.reportedBy, [k]: v } }));

  const isEdit = !!initial && !!(initial as any)._id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api(`/api/cases/${(initial as any)._id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        toast.success("Case updated successfully");
      } else {
        await api("/api/cases", { method: "POST", body: JSON.stringify(form) });
        toast.success("Case logged successfully");
      }
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
      <Field label="Case Title *">
        <input
          className={inputCls}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Brief incident description"
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category *">
          <select
            className={selectCls}
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority *">
          <select
            className={selectCls}
            value={form.priority}
            onChange={(e) => set("priority", e.target.value)}
          >
            {["Felony", "Misdemeanour", "Summary Offence"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description *">
        <textarea
          className={inputCls}
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Detailed description..."
          required
          style={{ resize: "vertical" }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Location *">
          <input
            className={inputCls}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Incident location"
            required
          />
        </Field>
        <Field label="Date Occurred *">
          <input
            className={inputCls}
            type="date"
            value={form.dateOccurred}
            onChange={(e) => set("dateOccurred", e.target.value)}
            required
          />
        </Field>
      </div>

      <div className="border border-gray-100 rounded-lg p-4 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Reported By
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *">
            <input
              className={inputCls}
              value={form.reportedBy.name}
              onChange={(e) => setRB("name", e.target.value)}
              placeholder="Full name"
              required
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputCls}
              value={form.reportedBy.phone}
              onChange={(e) => setRB("phone", e.target.value)}
              placeholder="Phone number"
            />
          </Field>
          <Field label="Email">
            <input
              className={inputCls}
              type="email"
              value={form.reportedBy.email}
              onChange={(e) => setRB("email", e.target.value)}
              placeholder="Email"
            />
          </Field>
          <Field label="Address">
            <input
              className={inputCls}
              value={form.reportedBy.address}
              onChange={(e) => setRB("address", e.target.value)}
              placeholder="Home address"
            />
          </Field>
        </div>
      </div>

      {!isEdit && (
        <Field label="Initial Note (optional)">
          <textarea
            className={inputCls}
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Any initial observations..."
            style={{ resize: "vertical" }}
          />
        </Field>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          {isEdit ? "Save Changes" : "Log Case"}
        </Button>
      </div>
    </form>
  );
}

// ─── Refer to CID Modal ───────────────────────────────────────────────────────

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
    setLoading(true);
    try {
      await api(`/api/cases/${caseItem._id}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "nco-refer",
          assignedOfficer: selected,
          ncoReferralNote: referNote,
          note,
        }),
      });
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
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
        <p className="text-xs font-mono text-blue-600 mb-1">
          {caseItem.caseNumber}
        </p>
        <p className="font-semibold text-gray-900 text-sm">{caseItem.title}</p>
      </div>

      <Field label="Assign Investigator (CID) *">
        <select
          className={selectCls}
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
      </Field>

      <Field label="Referral Note (optional)">
        <textarea
          className={inputCls}
          rows={3}
          value={referNote}
          onChange={(e) => setReferNote(e.target.value)}
          placeholder="Instructions for the investigator..."
          style={{ resize: "vertical" }}
        />
      </Field>

      <Field label="Additional Note (optional)">
        <textarea
          className={inputCls}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any other notes to attach..."
          style={{ resize: "vertical" }}
        />
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          Refer to CID
        </Button>
      </div>
    </form>
  );
}

// ─── Progress Message Panel ───────────────────────────────────────────────────

function ProgressMessages({
  caseItem,
  currentRole,
  onRefresh,
}: {
  caseItem: CaseData;
  currentRole: string;
  onRefresh: () => void;
}) {
  const [content, setContent] = useState("");
  const [toRole, setToRole] = useState("");
  const [sending, setSending] = useState(false);

  // Determine which roles are reachable from current case context
  const reachableRoles = ["nco", "cid", "so", "dc"].filter((r) => {
    if (r === currentRole) return false;
    // Only show roles that have been involved in the case
    if (r === "nco" && !caseItem.loggedBy) return false;
    if (r === "cid" && !caseItem.assignedOfficer) return false;
    if (r === "so" && !caseItem.assignedSO) return false;
    if (r === "dc" && !caseItem.assignedDC) return false;
    return true;
  });

  useEffect(() => {
    if (reachableRoles.length && !toRole) setToRole(reachableRoles[0]);
  }, [reachableRoles.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !toRole) return;
    setSending(true);
    try {
      await api(`/api/cases/${caseItem._id}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "send-progress",
          content: content.trim(),
          toRole,
        }),
      });
      setContent("");
      toast.success("Progress message sent");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  const msgs = [...(caseItem.progressMessages || [])].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );

  return (
    <div className="space-y-3">
      {/* Message thread */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {msgs.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">
            No progress messages yet.
          </p>
        ) : (
          msgs.map((m) => {
            const isMine = m.fromRole === currentRole;
            return (
              <div
                key={m._id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs rounded-xl px-4 py-2.5 ${isMine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold ${isMine ? "text-blue-200" : "text-gray-500"}`}
                    >
                      {m.fromUser?.fullName || ROLE_LABELS[m.fromRole]}
                    </span>
                    <ChevronRight
                      size={10}
                      className={isMine ? "text-blue-300" : "text-gray-400"}
                    />
                    <span
                      className={`text-xs ${isMine ? "text-blue-200" : "text-gray-500"}`}
                    >
                      {ROLE_LABELS[m.toRole] || m.toRole}
                    </span>
                  </div>
                  <p className="text-sm leading-snug">{m.content}</p>
                  <p
                    className={`text-xs mt-1 ${isMine ? "text-blue-200" : "text-gray-400"}`}
                  >
                    {new Date(m.sentAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Compose */}
      {reachableRoles.length > 0 && (
        <form
          onSubmit={send}
          className="border-t border-gray-100 pt-3 space-y-2"
        >
          <div className="flex gap-2">
            <select
              className={`${selectCls} shrink-0 w-40`}
              value={toRole}
              onChange={(e) => setToRole(e.target.value)}
            >
              {reachableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <input
              className={`${inputCls} flex-1`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Send a progress update..."
            />
            <Button
              type="submit"
              size="sm"
              disabled={sending || !content.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Case Detail Modal ────────────────────────────────────────────────────────

function DetailModal({
  caseItem,
  currentRole,
  canMutate,
  onRefresh,
  onClose,
}: {
  caseItem: CaseData;
  currentRole: string;
  canMutate: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"info" | "notes" | "messages">("info");
  const [noteContent, setNC] = useState("");
  const [addingNote, setAN] = useState(false);

  const s = STATUS_MAP[caseItem.status] || STATUS_MAP.open;
  const p = PRIORITY_MAP[caseItem.priority] || "bg-blue-100 text-blue-800";

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setAN(true);
    try {
      await api(`/api/cases/${caseItem._id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "add-note", content: noteContent }),
      });
      setNC("");
      toast.success("Note added");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAN(false);
    }
  }

  const tabs = [
    { id: "info", label: "Info", icon: <FileText size={13} /> },
    {
      id: "notes",
      label: `Notes (${caseItem.notes.length})`,
      icon: <StickyNote size={13} />,
    },
    {
      id: "messages",
      label: `Messages (${caseItem.progressMessages.length})`,
      icon: <MessageSquare size={13} />,
    },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={p}>{caseItem.priority}</Badge>
        <Badge className={s.color}>{s.label}</Badge>
        <span className="ml-auto text-xs font-mono text-gray-400">
          {caseItem.caseNumber}
        </span>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          {caseItem.title}
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          {caseItem.description}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {tab === "info" && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            {
              icon: <MapPin size={12} />,
              label: "Location",
              val: caseItem.location,
            },
            {
              icon: <Calendar size={12} />,
              label: "Date Occurred",
              val: new Date(caseItem.dateOccurred).toLocaleDateString(),
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
            ...(caseItem.assignedOfficer
              ? [
                  {
                    icon: <Users size={12} />,
                    label: "CID Officer",
                    val: caseItem.assignedOfficer.fullName,
                  },
                ]
              : []),
            ...(caseItem.loggedBy
              ? [
                  {
                    icon: <User size={12} />,
                    label: "Logged By",
                    val: caseItem.loggedBy.fullName,
                  },
                ]
              : []),
          ].map(({ icon, label, val, cap }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                {icon} {label}
              </div>
              <p
                className={`text-gray-900 font-medium ${cap ? "capitalize" : ""}`}
              >
                {val}
              </p>
            </div>
          ))}

          {/* Phase notes */}
          {caseItem.ncoReferralNote && (
            <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-500 mb-1">
                NCO REFERRAL NOTE
              </p>
              <p className="text-sm text-blue-800">
                {caseItem.ncoReferralNote}
              </p>
            </div>
          )}
          {caseItem.cidSubmissionNote && (
            <div className="col-span-2 bg-yellow-50 border border-yellow-100 rounded-lg p-3">
              <p className="text-xs font-bold text-yellow-600 mb-1">
                CID SUBMISSION NOTE
              </p>
              <p className="text-sm text-yellow-800">
                {caseItem.cidSubmissionNote}
              </p>
            </div>
          )}
          {caseItem.soDirective && (
            <div className="col-span-2 bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs font-bold text-red-500 mb-1">
                SO DIRECTIVE
              </p>
              <p className="text-sm text-red-800">{caseItem.soDirective}</p>
            </div>
          )}
          {caseItem.soReviewNote && (
            <div className="col-span-2 bg-purple-50 border border-purple-100 rounded-lg p-3">
              <p className="text-xs font-bold text-purple-500 mb-1">
                SO REVIEW NOTE
              </p>
              <p className="text-sm text-purple-800">{caseItem.soReviewNote}</p>
            </div>
          )}
          {caseItem.dcNote && (
            <div className="col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-500 mb-1">DC NOTE</p>
              <p className="text-sm text-gray-800">{caseItem.dcNote}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Notes */}
      {tab === "notes" && (
        <div className="space-y-3">
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {caseItem.notes.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">
                No notes yet.
              </p>
            ) : (
              caseItem.notes.map((n) => (
                <div
                  key={n._id}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-blue-600">
                      {n.addedBy?.fullName || "Unknown"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(n.addedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {n.content}
                  </p>
                </div>
              ))
            )}
          </div>
          <form
            onSubmit={addNote}
            className="border-t border-gray-100 pt-3 space-y-2"
          >
            <textarea
              className={inputCls}
              rows={2}
              value={noteContent}
              onChange={(e) => setNC(e.target.value)}
              placeholder="Add a note (optional)..."
              style={{ resize: "vertical" }}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={addingNote || !noteContent.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {addingNote ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <StickyNote className="h-3.5 w-3.5 mr-1" />
                )}
                Add Note
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Progress Messages */}
      {tab === "messages" && (
        <ProgressMessages
          caseItem={caseItem}
          currentRole={currentRole}
          onRefresh={onRefresh}
        />
      )}

      <div className="flex justify-end border-t border-gray-100 pt-3">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NCOCasesPage() {
  // In a real app pull this from auth context; hardcoded to "nco" here
  const currentRole = "nco";
  const canMutate = ["nco", "so", "admin"].includes(currentRole);

  const [cases, setCases] = useState<CaseData[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);

  // Modals
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

  // Stats
  const total = pagination?.total || 0;
  const openCount = cases.filter((c) => c.status === "open").length;
  const refCount = cases.filter((c) => c.status === "referred").length;
  const activeCount = cases.filter((c) =>
    ["referred", "investigating", "under_review", "commander_review"].includes(
      c.status,
    ),
  ).length;

  return (
    <div className="space-y-6 pt-12">
      {/* Page header */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            NCO / Station Orderly
          </p>
          <h1 className="text-3xl font-bold text-gray-900">Case Management</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCases}>
            Refresh
          </Button>
          {canMutate && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Log New Case
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cases</p>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {openCount} open, {refCount} referred
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Open Cases</p>
                <p className="text-2xl font-bold text-green-600">{openCount}</p>
                <p className="text-xs text-gray-500 mt-1">Awaiting referral</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Referred to CID
                </p>
                <p className="text-2xl font-bold text-blue-600">{refCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Under investigation
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Cases
                </p>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-gray-500 mt-1">In workflow</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className={`${inputCls} pl-9`}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by case number, title, reporter..."
              />
            </div>
            <select
              className={`${selectCls} min-w-40`}
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
              className={`${selectCls} min-w-36`}
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

      {/* Cases list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span>Cases ({total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>
                No cases found. {canMutate && "Log a new case to get started."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => {
                const s = STATUS_MAP[c.status] || STATUS_MAP.open;
                const p =
                  PRIORITY_MAP[c.priority] || "bg-blue-100 text-blue-800";
                const canRefer =
                  canMutate && c.status === "open" && c.currentStage === "nco";
                const canEdit =
                  canMutate && ["open", "suspended"].includes(c.status);
                const canDel =
                  canMutate &&
                  (currentRole !== "nco" ||
                    c.loggedBy?._id === c.loggedBy?._id);
                const unread = c.progressMessages.filter(
                  (m) => m.toRole === currentRole,
                ).length;

                return (
                  <div
                    key={c._id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all group"
                  >
                    {/* Priority stripe */}
                    <div
                      className={`w-1 h-12 rounded-full shrink-0 ${
                        c.priority === "Felony"
                          ? "bg-red-500"
                          : c.priority === "Misdemeanour"
                            ? "bg-orange-400"
                            : "bg-blue-400"
                      }`}
                    />

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-blue-600">
                          {c.caseNumber}
                        </span>
                        <Badge className={p} variant="secondary">
                          {c.priority}
                        </Badge>
                        <Badge className={s.color} variant="secondary">
                          {s.label}
                        </Badge>
                        {unread > 0 && (
                          <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
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

                    {/* Date + notes count */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-300 mt-0.5">
                        {c.notes.length} note{c.notes.length !== 1 ? "s" : ""}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="View Details"
                        onClick={() => setDetailCase(c)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          title="Edit"
                          onClick={() => setEditCase(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canRefer && (
                        <Button
                          size="sm"
                          className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          title="Refer to CID"
                          onClick={() => setReferCase(c)}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Refer
                        </Button>
                      )}
                      {canDel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                          onClick={() => setDeleteCase(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center gap-1 mt-6">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
                (p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                      p === page
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Modals ─── */}

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
          title={`Edit Case — ${editCase.caseNumber}`}
          onClose={() => setEditCase(null)}
        >
          <CaseForm
            initial={{ ...editCase, _id: editCase._id } as any}
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
          title={`Refer Case to CID — ${referCase.caseNumber}`}
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
          title={`Case Details — ${detailCase.caseNumber}`}
          onClose={() => setDetailCase(null)}
          wide
        >
          <DetailModal
            caseItem={detailCase}
            currentRole={currentRole}
            canMutate={canMutate}
            onRefresh={refreshDetail}
            onClose={() => setDetailCase(null)}
          />
        </Modal>
      )}

      {deleteCase && (
        <Modal title="Confirm Delete" onClose={() => setDeleteCase(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg p-4">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700 text-sm">
                  This action cannot be undone.
                </p>
                <p className="text-sm text-red-600 mt-1">
                  Are you sure you want to delete case{" "}
                  <strong>{deleteCase.caseNumber}</strong> —{" "}
                  <em>{deleteCase.title}</em>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteCase(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Delete Case
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
