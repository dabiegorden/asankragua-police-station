"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Archive,
  Send,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Shield,
  Users,
  Calendar,
  Star,
  RefreshCw,
  UserCheck,
  UserX,
  Building2,
  AlertTriangle,
  FileText,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

import { useStation } from "@/context/StationContext";

// ─── Types ─────────────────────────────────────────────────────────────────

type ShiftType = "morning" | "afternoon" | "night" | "full-day";
type DutyType =
  | "Guard"
  | "Patrol"
  | "Office"
  | "Court"
  | "Escort"
  | "Traffic"
  | "Investigation"
  | "Reserve"
  | "Other";
type StarStatus = "draft" | "published" | "approved" | "archived";

interface DutyEntry {
  _id?: string;
  serialNumber: number;
  officerName: string;
  officerUserId?: string | null;
  rank: string;
  serviceNumber?: string;
  dutyPost: string;
  dutyType: DutyType;
  shiftStart: string;
  shiftEnd: string;
  remarks?: string;
  present: boolean;
}

interface DutyStar {
  _id: string;
  starNumber: string;
  stationId: string;
  dutyDate: string;
  shift: ShiftType;
  starOfficer: string;
  commandingOfficer: string;
  totalStrength: number;
  absentCount: number;
  status: StarStatus;
  approvedBy?: { fullName: string; role: string } | null;
  approvedAt?: string;
  entries: DutyEntry[];
  generalRemarks?: string;
  createdBy: { fullName: string; email: string; role: string };
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface StarFormData {
  stationId: string;
  dutyDate: string;
  shift: ShiftType;
  starOfficer: string;
  commandingOfficer: string;
  entries: DutyEntry[];
  generalRemarks: string;
  status: StarStatus;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DUTY_TYPES: DutyType[] = [
  "Guard",
  "Patrol",
  "Office",
  "Court",
  "Escort",
  "Traffic",
  "Investigation",
  "Reserve",
  "Other",
];

const SHIFTS: {
  value: ShiftType;
  label: string;
  time: string;
  color: string;
}[] = [
  { value: "morning", label: "Morning", time: "06:00–14:00", color: "#d97706" },
  {
    value: "afternoon",
    label: "Afternoon",
    time: "14:00–22:00",
    color: "#ea580c",
  },
  { value: "night", label: "Night", time: "22:00–06:00", color: "#4f46e5" },
  {
    value: "full-day",
    label: "Full Day",
    time: "06:00–18:00",
    color: "#0d9488",
  },
];

const RANKS = [
  "Inspector General",
  "Deputy Inspector General",
  "Commissioner",
  "Deputy Commissioner",
  "Assistant Commissioner",
  "Chief Superintendent",
  "Superintendent",
  "Deputy Superintendent",
  "Assistant Superintendent",
  "Chief Inspector",
  "Inspector",
  "Sergeant",
  "Corporal",
  "Lance Corporal",
  "Constable",
];

const STATUS_META: Record<
  StarStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  draft: {
    label: "Draft",
    bg: "#f1f5f9",
    text: "#475569",
    border: "#cbd5e1",
    dot: "#94a3b8",
  },
  published: {
    label: "Published",
    bg: "#eff6ff",
    text: "#1d4ed8",
    border: "#bfdbfe",
    dot: "#3b82f6",
  },
  approved: {
    label: "Approved",
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#bbf7d0",
    dot: "#22c55e",
  },
  archived: {
    label: "Archived",
    bg: "#f8fafc",
    text: "#64748b",
    border: "#e2e8f0",
    dot: "#94a3b8",
  },
};

// ─── Auth helpers ───────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function getAuthUser(): {
  role: string;
  stationId?: string | null;
  fullName?: string;
  userId?: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function api<T = unknown>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function emptyEntry(idx: number): DutyEntry {
  return {
    serialNumber: idx + 1,
    officerName: "",
    rank: "Constable",
    serviceNumber: "",
    dutyPost: "",
    dutyType: "Guard",
    shiftStart: "06:00",
    shiftEnd: "18:00",
    remarks: "",
    present: true,
  };
}

// ─── Shared input styles ────────────────────────────────────────────────────

const inp =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all";

const sel =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer";

// ─── Field label wrapper ────────────────────────────────────────────────────

function FL({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${accent}18` }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">
          {value}
        </p>
        <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

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
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col w-full ${
          wide ? "sm:max-w-5xl" : "sm:max-w-2xl"
        } max-h-[95vh] border border-slate-100`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded-full bg-blue-600" />
            <h2 className="font-bold text-slate-800 text-sm tracking-tight">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StarStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
      style={{ background: m.bg, color: m.text, borderColor: m.border }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{ background: m.dot }}
      />
      {m.label}
    </span>
  );
}

// ─── Shift badge ─────────────────────────────────────────────────────────────

function ShiftBadge({ shift }: { shift: ShiftType }) {
  const s = SHIFTS.find((x) => x.value === shift)!;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${s.color}15`, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ─── Entry row ───────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  idx,
  onChange,
  onRemove,
  canEdit,
}: {
  entry: DutyEntry;
  idx: number;
  onChange: (patch: Partial<DutyEntry>) => void;
  onRemove: () => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(idx === 0);

  return (
    <div
      className="border rounded-xl overflow-hidden transition-all"
      style={{
        borderColor: entry.present ? "#e2e8f0" : "#fecaca",
        background: entry.present ? "white" : "#fff7f7",
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ background: entry.present ? "#f8fafc" : "#fff1f1" }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
          style={{ background: "#1e40af" }}
        >
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {entry.officerName || (
              <span className="text-slate-400 font-normal italic">
                Officer name…
              </span>
            )}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {entry.rank} · {entry.dutyPost || "—"} · {entry.dutyType}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={
              entry.present
                ? { background: "#dcfce7", color: "#15803d" }
                : { background: "#fee2e2", color: "#dc2626" }
            }
          >
            {entry.present ? "Present" : "Absent"}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-slate-300 hover:text-red-400 p-0.5 rounded transition-colors"
            >
              <X size={12} />
            </button>
          )}
          {open ? (
            <ChevronUp size={13} className="text-slate-400" />
          ) : (
            <ChevronDown size={13} className="text-slate-400" />
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 py-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-slate-100">
          <FL label="Full Name" required>
            <input
              className={inp}
              value={entry.officerName}
              onChange={(e) => onChange({ officerName: e.target.value })}
              placeholder="e.g. Kwame Mensah"
              disabled={!canEdit}
            />
          </FL>
          <FL label="Rank" required>
            <select
              className={sel}
              value={entry.rank}
              onChange={(e) => onChange({ rank: e.target.value })}
              disabled={!canEdit}
            >
              {RANKS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </FL>
          <FL label="Service / Badge No.">
            <input
              className={inp}
              value={entry.serviceNumber || ""}
              onChange={(e) => onChange({ serviceNumber: e.target.value })}
              placeholder="Optional"
              disabled={!canEdit}
            />
          </FL>
          <FL label="Duty Post" required>
            <input
              className={inp}
              value={entry.dutyPost}
              onChange={(e) => onChange({ dutyPost: e.target.value })}
              placeholder="e.g. Main Gate"
              disabled={!canEdit}
            />
          </FL>
          <FL label="Duty Type" required>
            <select
              className={sel}
              value={entry.dutyType}
              onChange={(e) =>
                onChange({ dutyType: e.target.value as DutyType })
              }
              disabled={!canEdit}
            >
              {DUTY_TYPES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </FL>
          <FL label="Attendance">
            <select
              className={sel}
              value={entry.present ? "yes" : "no"}
              onChange={(e) => onChange({ present: e.target.value === "yes" })}
            >
              <option value="yes">Present</option>
              <option value="no">Absent</option>
            </select>
          </FL>
          <FL label="Shift Start">
            <input
              type="time"
              className={inp}
              value={entry.shiftStart}
              onChange={(e) => onChange({ shiftStart: e.target.value })}
              disabled={!canEdit}
            />
          </FL>
          <FL label="Shift End">
            <input
              type="time"
              className={inp}
              value={entry.shiftEnd}
              onChange={(e) => onChange({ shiftEnd: e.target.value })}
              disabled={!canEdit}
            />
          </FL>
          <FL label="Remarks">
            <input
              className={inp}
              value={entry.remarks || ""}
              onChange={(e) => onChange({ remarks: e.target.value })}
              placeholder="Optional"
              disabled={!canEdit}
            />
          </FL>
        </div>
      )}
    </div>
  );
}

// ─── Create / Edit form ──────────────────────────────────────────────────────

function StarForm({
  initial,
  onSave,
  onClose,
  userStation,
  userRole,
  // activeStationId: the station currently selected in the context (for DC/admin)
  activeStationId,
}: {
  initial?: DutyStar;
  onSave: () => void;
  onClose: () => void;
  userStation?: string | null;
  userRole: string;
  activeStationId?: string | null;
}) {
  const isEdit = !!initial;
  const canEdit = !initial || initial.status !== "approved";

  // Determine the default stationId for the form:
  // - For NCO/SO/DC the station is fixed to their own (or the context station for DC).
  // - Admin can type freely.
  const defaultStationId =
    initial?.stationId ||
    (["dc"].includes(userRole)
      ? activeStationId || userStation || ""
      : userStation || "");

  const stationIsFixed = ["nco", "so"].includes(userRole) && !!userStation;

  // DC: station is fixed to whichever station is selected in the context
  const dcStationIsFixed =
    userRole === "dc" && !!(activeStationId || userStation);

  const [form, setForm] = useState<StarFormData>({
    stationId: defaultStationId,
    dutyDate: initial ? initial.dutyDate.split("T")[0] : todayISO(),
    shift: initial?.shift || "full-day",
    starOfficer: initial?.starOfficer || "",
    commandingOfficer: initial?.commandingOfficer || "",
    entries: initial?.entries || [emptyEntry(0)],
    generalRemarks: initial?.generalRemarks || "",
    status: initial?.status || "draft",
  });
  const [saving, setSaving] = useState(false);

  function patch<K extends keyof StarFormData>(key: K, val: StarFormData[K]) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  function patchEntry(idx: number, p: Partial<DutyEntry>) {
    setForm((prev) => {
      const entries = [...prev.entries];
      entries[idx] = { ...entries[idx], ...p };
      return { ...prev, entries };
    });
  }

  function addEntry() {
    setForm((prev) => ({
      ...prev,
      entries: [...prev.entries, emptyEntry(prev.entries.length)],
    }));
  }

  function removeEntry(idx: number) {
    setForm((prev) => ({
      ...prev,
      entries: prev.entries
        .filter((_, i) => i !== idx)
        .map((e, i) => ({ ...e, serialNumber: i + 1 })),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.stationId ||
      !form.dutyDate ||
      !form.starOfficer ||
      !form.commandingOfficer
    ) {
      toast.error(
        "Station, date, star officer and commanding officer are required",
      );
      return;
    }
    const bad = form.entries.filter(
      (e) => !e.officerName.trim() || !e.dutyPost.trim(),
    );
    if (bad.length) {
      toast.error("All entries need an officer name and duty post");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api(`/api/duty-role-star/${initial!._id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        toast.success("Duty star updated");
      } else {
        await api("/api/duty-role-star", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Duty star created");
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const presentCount = form.entries.filter((e) => e.present).length;
  const absentCount = form.entries.length - presentCount;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <FL label="Station ID" required>
          <input
            className={inp}
            value={form.stationId}
            onChange={(e) => patch("stationId", e.target.value)}
            placeholder="e.g. asankragua"
            disabled={stationIsFixed || dcStationIsFixed || !canEdit}
          />
        </FL>
        <FL label="Duty Date" required>
          <input
            type="date"
            className={inp}
            value={form.dutyDate}
            onChange={(e) => patch("dutyDate", e.target.value)}
            disabled={!canEdit}
          />
        </FL>
        <FL label="Shift" required>
          <select
            className={sel}
            value={form.shift}
            onChange={(e) => patch("shift", e.target.value as ShiftType)}
            disabled={!canEdit}
          >
            {SHIFTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({s.time})
              </option>
            ))}
          </select>
        </FL>
        <FL label="Star Officer (compiled by)" required>
          <input
            className={inp}
            value={form.starOfficer}
            onChange={(e) => patch("starOfficer", e.target.value)}
            placeholder="NCO compiling the star"
            disabled={!canEdit}
          />
        </FL>
        <FL label="Commanding Officer" required>
          <input
            className={inp}
            value={form.commandingOfficer}
            onChange={(e) => patch("commandingOfficer", e.target.value)}
            placeholder="SO / DC name"
            disabled={!canEdit}
          />
        </FL>
        <FL label="Status">
          <select
            className={sel}
            value={form.status}
            onChange={(e) => patch("status", e.target.value as StarStatus)}
            disabled={!canEdit || form.status === "approved"}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            {isEdit && <option value="archived">Archived</option>}
          </select>
        </FL>
      </div>

      <div className="flex items-center gap-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Users size={14} className="text-blue-600 shrink-0" />
        <div className="flex gap-5 text-xs font-semibold">
          <span className="text-slate-600">
            Total: <span className="text-slate-900">{form.entries.length}</span>
          </span>
          <span className="text-green-700">Present: {presentCount}</span>
          <span className="text-red-600">Absent: {absentCount}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">
            Duty Entries ({form.entries.length})
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={addEntry}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition-all"
            >
              <Plus size={12} /> Add Officer
            </button>
          )}
        </div>

        {form.entries.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-xl py-12 text-center">
            <Users size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">
              No officers added yet
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={addEntry}
                className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                + Add First Officer
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {form.entries.map((entry, idx) => (
              <EntryRow
                key={idx}
                entry={entry}
                idx={idx}
                onChange={(p) => patchEntry(idx, p)}
                onRemove={() => removeEntry(idx)}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </div>

      <FL label="General Remarks">
        <textarea
          className={inp}
          rows={2}
          value={form.generalRemarks}
          onChange={(e) => patch("generalRemarks", e.target.value)}
          placeholder="Any general remarks for this duty star…"
          style={{ resize: "vertical" }}
          disabled={!canEdit}
        />
      </FL>

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
        >
          Cancel
        </button>
        {canEdit && (
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-50"
            style={{ background: "#1e40af" }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? "Save Changes" : "Create Duty Star"}
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function StarDetail({
  star,
  onRefresh,
  onClose,
  userRole,
}: {
  star: DutyStar;
  onRefresh: () => void;
  onClose: () => void;
  userRole: string;
}) {
  const [acting, setActing] = useState(false);

  async function doAction(action: "publish" | "approve" | "archive") {
    setActing(true);
    try {
      await api(`/api/duty-role-star/${star._id}`, {
        method: "PUT",
        body: JSON.stringify({ action }),
      });
      const labels = {
        publish: "published",
        approve: "approved",
        archive: "archived",
      };
      toast.success(`Duty star ${labels[action]}`);
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  }

  async function toggleAttendance(entryId: string, present: boolean) {
    try {
      await api(`/api/duty-role-star/${star._id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "mark-attendance", entryId, present }),
      });
      toast.success(`Marked as ${present ? "present" : "absent"}`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const shiftCfg = SHIFTS.find((s) => s.value === star.shift);
  const presentCount = star.entries.filter((e) => e.present).length;

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 80%, white 1px, transparent 1px), radial-gradient(circle at 70% 20%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star size={13} className="opacity-60 fill-white" />
                <span className="text-[10px] font-bold opacity-60 uppercase tracking-[0.15em]">
                  Ghana Police Service · Duty Role Star
                </span>
              </div>
              <p className="text-2xl font-black tracking-tight">
                {star.starNumber}
              </p>
              <p className="text-sm opacity-75 mt-1">
                {fmtDate(star.dutyDate)} · {shiftCfg?.label} ({shiftCfg?.time})
              </p>
            </div>
            <div className="text-right text-xs opacity-80 space-y-1">
              <p className="font-black text-base">
                {star.stationId.toUpperCase()}
              </p>
              <p>
                Star Officer:{" "}
                <span className="font-semibold">{star.starOfficer}</span>
              </p>
              <p>
                Commanding:{" "}
                <span className="font-semibold">{star.commandingOfficer}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            {[
              {
                label: "Total Strength",
                value: star.totalStrength,
                bg: "rgba(255,255,255,0.2)",
              },
              {
                label: "Present",
                value: presentCount,
                bg: "rgba(34,197,94,0.3)",
              },
              {
                label: "Absent",
                value: star.absentCount,
                bg: "rgba(239,68,68,0.3)",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl px-4 py-2 text-center"
                style={{ background: s.bg }}
              >
                <p className="text-xl font-black leading-none">{s.value}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <StatusBadge status={star.status} />
        <div className="flex gap-2 flex-wrap">
          {star.status === "draft" &&
            ["nco", "so", "admin"].includes(userRole) && (
              <button
                onClick={() => doAction("publish")}
                disabled={acting}
                className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ background: "#1d4ed8" }}
              >
                <Send size={11} /> Publish
              </button>
            )}
          {star.status === "published" &&
            ["so", "dc", "admin"].includes(userRole) && (
              <button
                onClick={() => doAction("approve")}
                disabled={acting}
                className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ background: "#15803d" }}
              >
                <CheckCircle2 size={11} /> Approve
              </button>
            )}
          {star.status !== "archived" &&
            ["so", "dc", "admin"].includes(userRole) && (
              <button
                onClick={() => doAction("archive")}
                disabled={acting}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                <Archive size={11} /> Archive
              </button>
            )}
          {acting && (
            <Loader2
              size={14}
              className="animate-spin text-slate-400 self-center"
            />
          )}
        </div>
      </div>

      {star.status === "approved" && star.approvedBy && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={14} className="text-green-600 shrink-0" />
          <p className="text-xs text-green-700">
            Approved by{" "}
            <span className="font-bold">{star.approvedBy.fullName}</span>
            {star.approvedAt && ` on ${fmtDate(star.approvedAt)}`}
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-800">
            Duty Assignments
            <span className="ml-2 text-xs font-semibold text-slate-400">
              ({star.entries.length} officers)
            </span>
          </p>
          <div className="flex gap-2 text-[10px] font-semibold">
            <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              {presentCount} present
            </span>
            <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {star.absentCount} absent
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "#1e3a8a" }}>
                  {[
                    "#",
                    "Officer",
                    "Rank",
                    "Svc No.",
                    "Post",
                    "Duty",
                    "Hours",
                    "Status",
                    "Remarks",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2.5 font-semibold text-blue-100 whitespace-nowrap first:w-8"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {star.entries.map((entry, idx) => (
                  <tr
                    key={entry._id || idx}
                    className="border-t border-slate-100 transition-colors"
                    style={{
                      background: !entry.present
                        ? "#fff7f7"
                        : idx % 2 === 0
                          ? "white"
                          : "#f8fafc",
                    }}
                  >
                    <td className="px-3 py-2.5 font-bold text-blue-700">
                      {entry.serialNumber}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                      {entry.officerName}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {entry.rank}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-400">
                      {entry.serviceNumber || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                      {entry.dutyPost}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                        {entry.dutyType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                      {entry.shiftStart}–{entry.shiftEnd}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() =>
                          entry._id &&
                          toggleAttendance(entry._id, !entry.present)
                        }
                        className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border text-[10px] transition-colors cursor-pointer"
                        style={
                          entry.present
                            ? {
                                background: "#dcfce7",
                                color: "#15803d",
                                borderColor: "#86efac",
                              }
                            : {
                                background: "#fee2e2",
                                color: "#dc2626",
                                borderColor: "#fca5a5",
                              }
                        }
                        title="Click to toggle"
                      >
                        {entry.present ? (
                          <>
                            <UserCheck size={9} /> P
                          </>
                        ) : (
                          <>
                            <UserX size={9} /> A
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 max-w-30 truncate">
                      {entry.remarks || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {star.generalRemarks && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">
            General Remarks
          </p>
          <p className="text-sm text-slate-700">{star.generalRemarks}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-[11px] text-slate-400">
        <p>
          Created by{" "}
          <span className="font-semibold text-slate-600">
            {star.createdBy?.fullName || "—"}
          </span>
        </p>
        <p>{fmtDate(star.createdAt)}</p>
      </div>
    </div>
  );
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function DeleteDialog({
  star,
  onConfirm,
  onClose,
}: {
  star: DutyStar;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Confirm Deletion" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              Delete duty star {star.starNumber}?
            </p>
            <p className="text-xs text-red-600 mt-1">
              This action cannot be undone. All officer assignments will be
              permanently removed.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
          <p>
            <span className="font-semibold">Star:</span> {star.starNumber}
          </p>
          <p>
            <span className="font-semibold">Date:</span>{" "}
            {fmtDate(star.dutyDate)}
          </p>
          <p>
            <span className="font-semibold">Officers:</span>{" "}
            {star.totalStrength}
          </p>
          <p>
            <span className="font-semibold">Status:</span>{" "}
            {STATUS_META[star.status].label}
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all"
            style={{ background: "#dc2626" }}
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function DutyRoleStarPage() {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const authUser = getAuthUser();
  const userRole: string = authUser?.role ?? "nco";
  const userStation: string | null = authUser?.stationId ?? null;

  // ── Station context (shared with Cases, used by DC / admin) ──────────────
  // stationParam is the ?stationId= value that the StationProvider manages.
  // For nco/so the API ignores this param anyway (hard-scoped server-side).
  const { selectedStation, stationParam } = useStation();

  const [stars, setStars] = useState<DutyStar[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [viewStar, setViewStar] = useState<DutyStar | null>(null);
  const [editStar, setEditStar] = useState<DutyStar | null>(null);
  const [deleteStar, setDeleteStar] = useState<DutyStar | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  // Mirrors the Cases fetchCases exactly:
  //   - passes stationParam for DC / admin so the backend scopes by station
  //   - nco / so ignore stationParam server-side anyway
  const fetchStars = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(shiftFilter !== "all" && { shift: shiftFilter }),
        ...(search && { search }),
        // Pass the context-selected station for DC/admin — same pattern as Cases
        ...(stationParam && { stationId: stationParam }),
      });

      const data = await api<{ stars: DutyStar[]; pagination: Pagination }>(
        `/api/duty-role-star?${params}`,
      );
      setStars(data.stars);
      setPagination(data.pagination);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load duty stars",
      );
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, shiftFilter, search, stationParam]); // ← stationParam drives re-fetch

  useEffect(() => {
    fetchStars();
  }, [fetchStars]);

  // Reset to page 1 when any filter or the selected station changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, shiftFilter, stationParam]);

  function handleSearchChange(val: string) {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setSearch(val), 350);
  }

  async function refreshDetail() {
    if (!viewStar) return;
    try {
      const data = await api<{ star: DutyStar }>(
        `/api/duty-role-star/${viewStar._id}`,
      );
      setViewStar(data.star);
      fetchStars();
    } catch {
      /* silent */
    }
  }

  async function handleDelete(star: DutyStar) {
    try {
      await api(`/api/duty-role-star/${star._id}`, { method: "DELETE" });
      toast.success("Duty star deleted");
      setDeleteStar(null);
      fetchStars();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // Stats over current page
  const draftCount = stars.filter((s) => s.status === "draft").length;
  const publishedCount = stars.filter((s) => s.status === "published").length;
  const approvedCount = stars.filter((s) => s.status === "approved").length;

  // The active station id to pass down to forms (so they pre-fill correctly)
  // For DC/admin: use context station. For NCO/SO: use their own station.
  const activeStationId = ["dc", "admin"].includes(userRole)
    ? (stationParam ?? userStation)
    : userStation;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "#1e40af" }}
              >
                <Star size={14} className="text-white fill-white" />
              </div>
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">
                Ghana Police Service
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Duty Role Star
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Daily duty assignment register — track officer deployments &amp;
              attendance
            </p>
            {/* Station context banner — shown for DC / admin when a station is selected */}
            {selectedStation && ["dc", "admin"].includes(userRole) && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Building2 size={12} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700 uppercase">
                  {selectedStation.name}
                </span>
              </div>
            )}
            {/* NCO / SO: show their own station */}
            {userStation && ["nco", "so"].includes(userRole) && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Building2 size={12} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700 uppercase">
                  {userStation}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={fetchStars}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 px-3 py-2 border border-slate-200 rounded-xl hover:bg-white transition-all"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />{" "}
              Refresh
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2 rounded-xl transition-all hover:opacity-90 shadow-sm"
              style={{
                background: "linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)",
              }}
            >
              <Plus size={14} /> New Duty Star
            </button>
          </div>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FileText size={18} />}
            label="Total Stars"
            value={pagination?.total ?? 0}
            sub="Visible to you"
            accent="#1d4ed8"
          />
          <StatCard
            icon={<Clock size={18} />}
            label="Draft"
            value={draftCount}
            sub="Pending publish"
            accent="#64748b"
          />
          <StatCard
            icon={<Send size={18} />}
            label="Published"
            value={publishedCount}
            sub="Awaiting approval"
            accent="#3b82f6"
          />
          <StatCard
            icon={<CheckCircle2 size={18} />}
            label="Approved"
            value={approvedCount}
            sub="Finalised records"
            accent="#16a34a"
          />
        </div>

        {/* ── Search + filters ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className={`${inp} pl-8`}
                defaultValue={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search star number, officer, station…"
              />
            </div>

            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 border rounded-xl transition-all ${
                showFilters
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter size={12} /> Filters
              {(statusFilter !== "all" || shiftFilter !== "all") && (
                <span className="w-2 h-2 rounded-full bg-blue-500 ml-0.5" />
              )}
            </button>

            {showFilters && (
              <>
                <select
                  className={`${sel} w-38`}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="approved">Approved</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  className={`${sel} w-40`}
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value)}
                >
                  <option value="all">All Shifts</option>
                  {SHIFTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>

                {(statusFilter !== "all" || shiftFilter !== "all") && (
                  <button
                    onClick={() => {
                      setStatusFilter("all");
                      setShiftFilter("all");
                    }}
                    className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>

          {/* Active station context banner for DC / admin */}
          {selectedStation && ["dc", "admin"].includes(userRole) && (
            <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <Building2 size={12} className="text-blue-600 shrink-0" />
              <p className="text-xs text-blue-700">
                Showing duty stars for:{" "}
                <span className="font-bold">{selectedStation.name}</span>
                <span className="ml-1 text-blue-500 font-mono text-[10px]">
                  ({selectedStation.id})
                </span>
              </p>
            </div>
          )}
        </div>

        {/* ── Stars list ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-blue-700 fill-blue-700" />
              <span className="font-bold text-slate-800 text-sm">
                Duty Stars
                {pagination && (
                  <span className="ml-2 text-xs font-semibold text-slate-400">
                    ({pagination.total} total)
                  </span>
                )}
              </span>
            </div>
            {!loading && stars.length > 0 && (
              <p className="text-xs text-slate-400">
                Showing {stars.length} of {pagination?.total ?? 0}
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 size={28} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-400 font-medium">
                Loading duty stars…
              </p>
            </div>
          ) : stars.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Star size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                No duty stars found
              </p>
              <p className="text-xs text-slate-400">
                {search || statusFilter !== "all" || shiftFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : selectedStation
                    ? `No duty stars at ${selectedStation.name} yet`
                    : "Create your first duty star to get started"}
              </p>
              {!search && statusFilter === "all" && shiftFilter === "all" && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl"
                  style={{ background: "#1e40af" }}
                >
                  <Plus size={13} /> New Duty Star
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {stars.map((star) => {
                const shiftCfg = SHIFTS.find((s) => s.value === star.shift);
                const presentCount = star.entries.filter(
                  (e) => e.present,
                ).length;
                const attendPct =
                  star.totalStrength > 0
                    ? Math.round((presentCount / star.totalStrength) * 100)
                    : 100;

                return (
                  <div
                    key={star._id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/70 transition-colors group"
                  >
                    <div
                      className="w-1 h-14 rounded-full shrink-0"
                      style={{
                        background:
                          star.status === "approved"
                            ? "#22c55e"
                            : star.status === "published"
                              ? "#3b82f6"
                              : star.status === "archived"
                                ? "#94a3b8"
                                : "#cbd5e1",
                      }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        <span className="font-mono font-black text-blue-700 text-xs">
                          {star.starNumber}
                        </span>
                        <StatusBadge status={star.status} />
                        <ShiftBadge shift={star.shift} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={10} /> {fmtDate(star.dutyDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 size={10} /> {star.stationId.toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Shield size={10} /> CO: {star.commandingOfficer}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={10} />
                          {star.totalStrength} on parade
                          <span
                            className="ml-1 font-semibold"
                            style={{
                              color: attendPct < 80 ? "#dc2626" : "#16a34a",
                            }}
                          >
                            ({attendPct}% present)
                          </span>
                        </span>
                      </div>
                      {star.totalStrength > 0 && (
                        <div className="mt-2 h-1 w-48 max-w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${attendPct}%`,
                              background:
                                attendPct < 80 ? "#ef4444" : "#22c55e",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setViewStar(star)}
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-all"
                        title="View"
                      >
                        <Eye size={15} />
                      </button>
                      {star.status !== "approved" && (
                        <button
                          onClick={() => setEditStar(star)}
                          className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
                          title="Edit"
                        >
                          <Edit size={15} />
                        </button>
                      )}
                      {["admin", "nco", "so"].includes(userRole) &&
                        star.status !== "approved" && (
                          <button
                            onClick={() => setDeleteStar(star)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.pages} ·{" "}
                {pagination.total} records
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                {Array.from(
                  { length: Math.min(5, pagination.pages) },
                  (_, i) => {
                    const start = Math.max(
                      1,
                      Math.min(page - 2, pagination.pages - 4),
                    );
                    const n = start + i;
                    if (n > pagination.pages) return null;
                    return (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className="w-8 h-7 text-xs font-semibold rounded-lg transition-all"
                        style={
                          n === page
                            ? { background: "#1e40af", color: "white" }
                            : { background: "transparent", color: "#64748b" }
                        }
                      >
                        {n}
                      </button>
                    );
                  },
                )}
                <button
                  onClick={() =>
                    setPage((p) => Math.min(p + 1, pagination.pages))
                  }
                  disabled={page === pagination.pages}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}

      {createOpen && (
        <Modal
          title="New Duty Role Star"
          wide
          onClose={() => setCreateOpen(false)}
        >
          <StarForm
            onSave={fetchStars}
            onClose={() => setCreateOpen(false)}
            userStation={userStation}
            userRole={userRole}
            activeStationId={activeStationId}
          />
        </Modal>
      )}

      {editStar && (
        <Modal
          title={`Edit — ${editStar.starNumber}`}
          wide
          onClose={() => setEditStar(null)}
        >
          <StarForm
            initial={editStar}
            onSave={fetchStars}
            onClose={() => setEditStar(null)}
            userStation={userStation}
            userRole={userRole}
            activeStationId={activeStationId}
          />
        </Modal>
      )}

      {viewStar && (
        <Modal
          title={`Duty Star — ${viewStar.starNumber}`}
          wide
          onClose={() => setViewStar(null)}
        >
          <StarDetail
            star={viewStar}
            onRefresh={refreshDetail}
            onClose={() => setViewStar(null)}
            userRole={userRole}
          />
        </Modal>
      )}

      {deleteStar && (
        <DeleteDialog
          star={deleteStar}
          onConfirm={() => handleDelete(deleteStar)}
          onClose={() => setDeleteStar(null)}
        />
      )}
    </div>
  );
}
