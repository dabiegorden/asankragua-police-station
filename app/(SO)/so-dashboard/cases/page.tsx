"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ArrowUpRight,
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  Scale,
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
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent";
const selectCls = `${inputCls} cursor-pointer`;

// ─── Progress Messages ────────────────────────────────────────────────────────

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
  const [toRole, setToRole] = useState("cid");
  const [sending, setSending] = useState(false);

  const reachableRoles = ["nco", "cid", "so", "dc"].filter((r) => {
    if (r === currentRole) return false;
    if (r === "nco" && !caseItem.loggedBy) return false;
    if (r === "cid" && !caseItem.assignedOfficer) return false;
    if (r === "dc" && !caseItem.assignedDC) return false;
    return true;
  });

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
                  className={`max-w-xs rounded-xl px-4 py-2.5 ${isMine ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-900"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold ${isMine ? "text-purple-200" : "text-gray-500"}`}
                    >
                      {m.fromUser?.fullName || ROLE_LABELS[m.fromRole]}
                    </span>
                    <ChevronRight
                      size={10}
                      className={isMine ? "text-purple-300" : "text-gray-400"}
                    />
                    <span
                      className={`text-xs ${isMine ? "text-purple-200" : "text-gray-500"}`}
                    >
                      {ROLE_LABELS[m.toRole] || m.toRole}
                    </span>
                  </div>
                  <p className="text-sm leading-snug">{m.content}</p>
                  <p
                    className={`text-xs mt-1 ${isMine ? "text-purple-200" : "text-gray-400"}`}
                  >
                    {new Date(m.sentAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

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
              className="bg-purple-600 hover:bg-purple-700 text-white px-3"
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

// ─── Return to CID Modal ──────────────────────────────────────────────────────

function ReturnToCIDModal({
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
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!directive.trim()) {
      toast.error("A directive is required when returning a case");
      return;
    }
    setLoading(true);
    try {
      await api(`/api/cases/${caseItem._id}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "so-return",
          soDirective: directive,
          note,
        }),
      });
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
      <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
        <p className="text-xs font-mono text-purple-600 mb-1">
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
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-600 mb-1">
            CID SUBMISSION NOTE
          </p>
          <p className="text-sm text-amber-800">{caseItem.cidSubmissionNote}</p>
        </div>
      )}

      <Field label="Directive for Investigator *">
        <textarea
          className={inputCls}
          rows={4}
          value={directive}
          onChange={(e) => setDirective(e.target.value)}
          placeholder="Clearly state what further action is required..."
          style={{ resize: "vertical" }}
          required
        />
      </Field>

      <Field label="Internal Note (optional)">
        <textarea
          className={inputCls}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any internal notes to attach..."
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
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-1" />
          )}
          Return to CID
        </Button>
      </div>
    </form>
  );
}

// ─── Forward to DC Modal ──────────────────────────────────────────────────────

function ForwardToDCModal({
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
      await api(`/api/cases/${caseItem._id}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "so-forward",
          assignedDC: selected,
          soReviewNote: reviewNote,
          note,
        }),
      });
      toast.success("Case forwarded to District Commander — notification sent");
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
        <p className="text-xs font-mono text-purple-600 mb-1">
          {caseItem.caseNumber}
        </p>
        <p className="font-semibold text-gray-900 text-sm">{caseItem.title}</p>
        {caseItem.assignedOfficer && (
          <p className="text-xs text-gray-500 mt-1">
            Investigated by: {caseItem.assignedOfficer.fullName}
          </p>
        )}
      </div>

      {caseItem.cidSubmissionNote && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-600 mb-1">
            CID SUBMISSION NOTE
          </p>
          <p className="text-sm text-amber-800">{caseItem.cidSubmissionNote}</p>
        </div>
      )}

      <Field label="Assign District Commander *">
        <select
          className={selectCls}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
        >
          <option value="">— Select District Commander —</option>
          {commanders.map((c) => (
            <option key={c._id} value={c._id}>
              {c.fullName} ({c.email})
            </option>
          ))}
        </select>
      </Field>

      <Field label="SO Review Note (optional)">
        <textarea
          className={inputCls}
          rows={3}
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          placeholder="Summary of your review findings for the Commander..."
          style={{ resize: "vertical" }}
        />
      </Field>

      <Field label="Internal Note (optional)">
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
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <ArrowUpRight className="h-4 w-4 mr-1" />
          )}
          Forward to Commander
        </Button>
      </div>
    </form>
  );
}

// ─── Case Detail Modal ────────────────────────────────────────────────────────

function DetailModal({
  caseItem,
  currentRole,
  onRefresh,
  onClose,
}: {
  caseItem: CaseData;
  currentRole: string;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"info" | "notes" | "messages" | "suspects">(
    "info",
  );
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
    {
      id: "suspects",
      label: `Suspects (${caseItem.suspects.length})`,
      icon: <ShieldAlert size={13} />,
    },
  ] as const;

  return (
    <div className="space-y-4">
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
                ? "border-purple-600 text-purple-600"
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
            <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-600 mb-1">
                CID SUBMISSION NOTE
              </p>
              <p className="text-sm text-amber-800">
                {caseItem.cidSubmissionNote}
              </p>
            </div>
          )}
          {caseItem.soDirective && (
            <div className="col-span-2 bg-orange-50 border border-orange-100 rounded-lg p-3">
              <p className="text-xs font-bold text-orange-500 mb-1">
                YOUR DIRECTIVE (RETURNED TO CID)
              </p>
              <p className="text-sm text-orange-800">{caseItem.soDirective}</p>
            </div>
          )}
          {caseItem.soReviewNote && (
            <div className="col-span-2 bg-purple-50 border border-purple-100 rounded-lg p-3">
              <p className="text-xs font-bold text-purple-500 mb-1">
                YOUR REVIEW NOTE
              </p>
              <p className="text-sm text-purple-800">{caseItem.soReviewNote}</p>
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
                    <span className="text-xs font-semibold text-purple-600">
                      {n.addedBy?.fullName || "Unknown"}
                      {n.roleSnapshot && (
                        <span className="ml-1 font-normal text-gray-400">
                          ({ROLE_LABELS[n.roleSnapshot] || n.roleSnapshot})
                        </span>
                      )}
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
              placeholder="Add a review note..."
              style={{ resize: "vertical" }}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={addingNote || !noteContent.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white"
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

      {/* Tab: Suspects & Witnesses */}
      {tab === "suspects" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Suspects ({caseItem.suspects.length})
            </p>
            {caseItem.suspects.length === 0 ? (
              <p className="text-gray-400 text-sm">No suspects recorded.</p>
            ) : (
              <div className="space-y-2">
                {caseItem.suspects.map((s, i) => (
                  <div
                    key={i}
                    className="bg-red-50 border border-red-100 rounded-lg p-3"
                  >
                    <p className="font-semibold text-sm text-gray-900">
                      {s.name}
                      {s.age && (
                        <span className="ml-2 text-gray-500 font-normal text-xs">
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
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Witnesses ({caseItem.witnesses.length})
            </p>
            {caseItem.witnesses.length === 0 ? (
              <p className="text-gray-400 text-sm">No witnesses recorded.</p>
            ) : (
              <div className="space-y-2">
                {caseItem.witnesses.map((w, i) => (
                  <div
                    key={i}
                    className="bg-green-50 border border-green-100 rounded-lg p-3"
                  >
                    <p className="font-semibold text-sm text-gray-900">
                      {w.name}
                      {w.phone && (
                        <span className="ml-2 text-gray-500 font-normal text-xs">
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
                ))}
              </div>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SoCasesPage() {
  const currentRole = "so";

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
  const returnedCount = cases.filter((c) => c.soDirective).length;
  const unreadCount = cases.reduce(
    (acc, c) =>
      acc + c.progressMessages.filter((m) => m.toRole === currentRole).length,
    0,
  );

  return (
    <div className="space-y-6 pt-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">
            Station Officer
          </p>
          <h1 className="text-3xl font-bold text-gray-900">Case Reviews</h1>
        </div>
        <Button variant="outline" onClick={fetchCases}>
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cases</p>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs text-gray-500 mt-1">Assigned to you</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Scale className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Awaiting Review
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {awaitingReview}
                </p>
                <p className="text-xs text-gray-500 mt-1">Submitted by CID</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Forwarded to DC
                </p>
                <p className="text-2xl font-bold text-pink-600">
                  {forwardedCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">At Commander stage</p>
              </div>
              <div className="h-12 w-12 bg-pink-100 rounded-full flex items-center justify-center">
                <ArrowUpRight className="h-6 w-6 text-pink-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {unreadCount > 0 ? "Unread Messages" : "Returned to CID"}
                </p>
                <p className="text-2xl font-bold">
                  {unreadCount > 0 ? unreadCount : returnedCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {unreadCount > 0
                    ? "Awaiting your attention"
                    : "With active directives"}
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                {unreadCount > 0 ? (
                  <MessageSquare className="h-6 w-6 text-orange-500" />
                ) : (
                  <RotateCcw className="h-6 w-6 text-orange-500" />
                )}
              </div>
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
            <Scale className="h-5 w-5 text-purple-600" />
            <span>Cases Under Review ({total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No cases assigned to you for review.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => {
                const s = STATUS_MAP[c.status] || STATUS_MAP.open;
                const p =
                  PRIORITY_MAP[c.priority] || "bg-blue-100 text-blue-800";
                const canReview = c.status === "under_review";
                const unread = c.progressMessages.filter(
                  (m) => m.toRole === currentRole,
                ).length;

                return (
                  <div
                    key={c._id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      canReview
                        ? "bg-purple-50 border-purple-200"
                        : "bg-gray-50 border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    {/* Priority stripe */}
                    <div
                      className={`w-1 h-12 rounded-full shrink-0 ${
                        c.priority === "Felony"
                          ? "bg-red-500"
                          : c.priority === "Misdemeanour"
                            ? "bg-orange-400"
                            : "bg-purple-400"
                      }`}
                    />

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-purple-600">
                          {c.caseNumber}
                        </span>
                        <Badge className={p} variant="secondary">
                          {c.priority}
                        </Badge>
                        <Badge className={s.color} variant="secondary">
                          {s.label}
                        </Badge>
                        {canReview && (
                          <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={9} /> Needs Review
                          </span>
                        )}
                        {unread > 0 && (
                          <span className="inline-flex items-center gap-1 bg-pink-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
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

                    {/* Date */}
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
                      {canReview && (
                        <>
                          <Button
                            size="sm"
                            className="h-8 px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs"
                            title="Return to CID"
                            onClick={() => setReturnCase(c)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Return
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs"
                            title="Forward to District Commander"
                            onClick={() => setForwardCase(c)}
                          >
                            <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
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
                        ? "bg-purple-600 text-white"
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

      {returnCase && (
        <Modal
          title={`Return to CID — ${returnCase.caseNumber}`}
          onClose={() => setReturnCase(null)}
        >
          <ReturnToCIDModal
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
          <ForwardToDCModal
            caseItem={forwardCase}
            onSuccess={fetchCases}
            onClose={() => setForwardCase(null)}
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
            onRefresh={refreshDetail}
            onClose={() => setDetailCase(null)}
          />
        </Modal>
      )}
    </div>
  );
}
