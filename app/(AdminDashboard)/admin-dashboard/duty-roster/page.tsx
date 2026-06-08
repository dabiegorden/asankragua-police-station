"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Clock,
  Archive,
  Send,
  X,
  Loader2,
  Shield,
  Users,
  Calendar,
  RefreshCw,
  Building2,
  AlertTriangle,
  FileText,
  Filter,
  Printer,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useStation } from "@/context/StationContext";

// ─── Types ─────────────────────────────────────────────────────────────────

type RosterStatus = "draft" | "published" | "archived";

interface RosterEntry {
  _id?: string;
  serialNumber: number;
  section: string;
  officerName: string;
  officerUserId?: string | null;
  rank: string;
  serviceNumber?: string;
  phoneNumber?: string;
  dutyTime?: string;
  remarks?: string;
}

interface DutyRoster {
  _id: string;
  rosterNumber: string;
  stationId: string;
  referenceNumber?: string;
  districtCommander?: string;
  stationOfficer?: string;
  startDate: string;
  endDate: string;
  entries: RosterEntry[];
  generalRemarks?: string;
  status: RosterStatus;
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

interface RosterFormData {
  stationId: string;
  referenceNumber: string;
  districtCommander: string;
  stationOfficer: string;
  startDate: string;
  endDate: string;
  entries: RosterEntry[];
  generalRemarks: string;
  status: RosterStatus;
}

// ─── Constants ─────────────────────────────────────────────────────────────

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

const COMMON_SECTIONS = [
  "STATION OFFICER",
  "STATION CID",
  "CHARGE OFFICE COUNTER NCO/SUPERVISOR",
  "STATION ORDERLY",
  "AMENFIMAN RURAL BANK (OLD)",
  "UPPER AMENFIMAN RURAL BANK",
  "REPUBLIC BANK (HFC) (24/7)",
  "FIASEMAN RURAL BANK",
  "AMENFIMAN RURAL BANK (NEW) (24/7)",
  "AHOBRASEYE CO-OP CREDIT UNION",
  "MAXI GOODS MALL",
  "SHELL FUEL STATION",
  "ABOI-NKWANTA SNAP CHECK",
  "EXAMINATION DUTY",
  "BAWDIE BARRIER",
  "AKROPONG BARRIER",
  "COURT WARRANT OFFICER",
  "ATTACHMENT DIV/PATROLS",
  "24 HOUR ECONOMY PATROLS",
  "OPERATIONS (NHO)",
  "ANNUAL LEAVE",
  "OTHER",
];

const STATUS_META: Record<
  RosterStatus,
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

// ─── RBAC helpers ───────────────────────────────────────────────────────────
//
// Delete rules (mirrors the backend DELETE handler):
//   - admin        → can delete any roster (draft, published, archived)
//   - dc           → can delete any roster (draft, published, archived)
//   - so / nco     → can delete draft and archived rosters;
//                    cannot delete published rosters (backend enforces this;
//                    we hide the button so the user isn't confused)
//
// Edit rules:
//   - archived rosters cannot be edited by anyone
//   - all other roles that have write access can edit non-archived rosters

function canDeleteRoster(roster: DutyRoster, userRole: string): boolean {
  if (!["admin", "dc", "so", "nco"].includes(userRole)) return false;
  if (userRole === "admin" || userRole === "dc") return true;
  // so / nco: only draft or archived — published is off-limits
  return roster.status !== "published";
}

function canEditRoster(roster: DutyRoster, userRole: string): boolean {
  if (roster.status === "archived") return false;
  return ["admin", "dc", "so", "nco"].includes(userRole);
}

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

function fmtDateLong(d: string) {
  return new Date(d)
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function nextWeekISO() {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

function emptyEntry(idx: number): RosterEntry {
  return {
    serialNumber: idx + 1,
    section: "STATION OFFICER",
    officerName: "",
    rank: "Constable",
    serviceNumber: "",
    phoneNumber: "",
    dutyTime: "6:00AM–6:00PM",
    remarks: "",
  };
}

// ─── Shared input styles ────────────────────────────────────────────────────

const inp =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all";

const sel =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer";

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

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RosterStatus }) {
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

// ─── Entry Row (collapsible) ─────────────────────────────────────────────────

function EntryRow({
  entry,
  idx,
  onChange,
  onRemove,
  canEdit,
}: {
  entry: RosterEntry;
  idx: number;
  onChange: (patch: Partial<RosterEntry>) => void;
  onRemove: () => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(idx < 2);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
          style={{ background: "#1e40af" }}
        >
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-blue-700 uppercase truncate">
            {entry.section}
          </p>
          <p className="text-sm font-semibold text-slate-800 truncate">
            {entry.officerName || (
              <span className="text-slate-400 font-normal italic">
                Officer name…
              </span>
            )}
          </p>
          <p className="text-[11px] text-slate-500">
            {entry.rank}
            {entry.dutyTime ? ` · ${entry.dutyTime}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
          <FL label="Section / Duty Post" required>
            <select
              className={sel}
              value={
                COMMON_SECTIONS.includes(entry.section)
                  ? entry.section
                  : "OTHER"
              }
              onChange={(e) => {
                if (e.target.value !== "OTHER")
                  onChange({ section: e.target.value });
                else onChange({ section: "" });
              }}
              disabled={!canEdit}
            >
              {COMMON_SECTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </FL>
          {(!COMMON_SECTIONS.includes(entry.section) ||
            entry.section === "OTHER" ||
            entry.section === "") && (
            <FL label="Custom Section Name" required>
              <input
                className={inp}
                value={entry.section === "OTHER" ? "" : entry.section}
                onChange={(e) => onChange({ section: e.target.value })}
                placeholder="Enter custom section name"
                disabled={!canEdit}
              />
            </FL>
          )}
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
              placeholder="e.g. NO. 12875"
              disabled={!canEdit}
            />
          </FL>
          <FL label="Phone Number">
            <input
              className={inp}
              value={entry.phoneNumber || ""}
              onChange={(e) => onChange({ phoneNumber: e.target.value })}
              placeholder="e.g. 0244990611"
              disabled={!canEdit}
            />
          </FL>
          <FL label="Duty Time">
            <input
              className={inp}
              value={entry.dutyTime || ""}
              onChange={(e) => onChange({ dutyTime: e.target.value })}
              placeholder="e.g. 6:00AM–6:00PM"
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

// ─── Print / PDF template ──────────────────────────────────────────────────

function buildPrintHTML(roster: DutyRoster): string {
  const sectionMap = new Map<string, RosterEntry[]>();
  for (const e of roster.entries) {
    if (!sectionMap.has(e.section)) sectionMap.set(e.section, []);
    sectionMap.get(e.section)!.push(e);
  }

  const tableRows = Array.from(sectionMap.entries())
    .map(([section, entries]) => {
      const sectionHeaderRow = `
        <tr class="section-row">
          <td colspan="5" class="section-cell">${section}</td>
        </tr>`;

      const entryRows = entries
        .map(
          (e) => `
          <tr class="entry-row">
            <td class="cell num-cell">${e.serialNumber}</td>
            <td class="cell name-cell">${e.rank ? e.rank.toUpperCase() + " " : ""}${
              e.serviceNumber
                ? `<span class="svc">${e.serviceNumber}</span> `
                : ""
            }${e.officerName.toUpperCase()}</td>
            <td class="cell phone-cell">${e.phoneNumber || "—"}</td>
            <td class="cell time-cell">${e.dutyTime || "—"}</td>
            <td class="cell remark-cell">${e.remarks || ""}</td>
          </tr>`,
        )
        .join("");

      return sectionHeaderRow + entryRows;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Duty Roster — ${roster.rosterNumber} | ${roster.stationId.toUpperCase()}</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4 portrait; margin: 14mm 12mm 14mm 12mm; }
    body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; color: #000; background: #fff; }
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0;
      background: #1e3a8a; color: #fff;
      padding: 10px 24px; display: flex; align-items: center;
      justify-content: space-between; z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .print-bar-title { font-size: 14px; font-weight: 700; }
    .print-bar-sub { font-size: 11px; opacity: 0.75; }
    .print-btn {
      background: #fff; color: #1e3a8a; border: none;
      border-radius: 8px; padding: 8px 20px; font-size: 13px;
      font-weight: 700; cursor: pointer;
    }
    .page-wrap { padding-top: 60px; }
    @media print { .print-bar { display: none !important; } .page-wrap { padding-top: 0; } }
    .doc-header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 8px; margin-bottom: 6px; }
    .header-left { font-size: 9.5pt; line-height: 1.7; }
    .header-center { text-align: center; }
    .header-center img { width: 64px; height: 64px; object-fit: contain; display: block; margin: 0 auto 3px; }
    .header-center .org-name { font-weight: bold; font-size: 11pt; letter-spacing: 0.03em; }
    .header-center .station-name { font-size: 10pt; font-weight: bold; }
    .header-right { font-size: 9.5pt; line-height: 1.7; text-align: right; }
    .doc-title { text-align: center; font-size: 11.5pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin: 8px 0 2px; letter-spacing: 0.04em; }
    .doc-subtitle { text-align: center; font-size: 9pt; margin-bottom: 8px; color: #333; }
    .roster-table { width: 100%; border-collapse: collapse; border: 1.5pt solid #000; }
    .roster-table th, .roster-table td { border: 1pt solid #000; padding: 3pt 5pt; vertical-align: top; }
    .roster-table thead tr { background: #1e3a8a; }
    .roster-table thead th { color: #fff; font-size: 8.5pt; font-weight: bold; text-align: left; letter-spacing: 0.04em; border-color: #1e3a8a; padding: 4pt 5pt; }
    .section-row .section-cell { font-weight: bold; font-size: 10pt; text-transform: uppercase; text-decoration: underline; background: #f0f4ff; padding: 4pt 5pt; letter-spacing: 0.02em; }
    .entry-row td { font-size: 10pt; line-height: 1.45; }
    .entry-row:nth-child(even) { background: #fafafa; }
    .num-cell { width: 28pt; font-weight: bold; text-align: center; color: #1e3a8a; }
    .name-cell { min-width: 160pt; }
    .phone-cell { width: 80pt; font-family: "Courier New", monospace; font-size: 9pt; }
    .time-cell { width: 90pt; text-align: center; font-size: 9.5pt; }
    .remark-cell { width: 80pt; font-size: 9pt; color: #444; }
    .svc { font-family: "Courier New", monospace; font-size: 9pt; }
    .general-remarks { margin-top: 10px; font-size: 9.5pt; border: 1pt solid #000; padding: 5pt 8pt; }
    .general-remarks strong { text-decoration: underline; }
    .doc-footer { margin-top: 22px; display: flex; justify-content: flex-end; }
    .signature-block { text-align: center; min-width: 170pt; }
    .signature-line { border-top: 1pt solid #000; width: 170pt; margin-bottom: 4pt; }
    .sig-name { font-weight: bold; font-size: 10.5pt; text-transform: uppercase; }
    .sig-title { font-size: 9.5pt; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="print-bar">
    <div>
      <div class="print-bar-title">Duty Roster — ${roster.rosterNumber}</div>
      <div class="print-bar-sub">${roster.stationId.toUpperCase()} &nbsp;·&nbsp; ${fmtDateLong(roster.startDate)} to ${fmtDateLong(roster.endDate)}</div>
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="page-wrap">
    <div class="doc-header">
      <div class="header-left">
        ${roster.referenceNumber ? `<div>${roster.referenceNumber}</div>` : ""}
        <div>DISTRICT COMMANDER</div>
        <div>${roster.stationId.toUpperCase()} POLICE STATION</div>
      </div>
      <div class="header-center">
        <img src="/assets/officer.jpg" alt="Ghana Police Service" onerror="this.style.display='none'" />
        <div class="org-name">GHANA POLICE SERVICE</div>
        <div class="station-name">${roster.stationId.toUpperCase()}</div>
      </div>
      <div class="header-right">
        <div>DATE: ${fmtDateLong(roster.createdAt)}</div>
        ${roster.rosterNumber ? `<div>ROSTER NO: <strong>${roster.rosterNumber}</strong></div>` : ""}
      </div>
    </div>
    <div class="doc-title">
      DUTY ROSTER FROM ${fmtDateLong(roster.startDate)} TO ${fmtDateLong(roster.endDate)}
    </div>
    ${roster.stationOfficer ? `<div class="doc-subtitle">Compiled by: ${roster.stationOfficer}</div>` : ""}
    <table class="roster-table">
      <thead>
        <tr>
          <th style="width:28pt">#</th>
          <th>OFFICER NAME / RANK / SERVICE NO.</th>
          <th style="width:80pt">TELEPHONE</th>
          <th style="width:90pt">DUTY TIME</th>
          <th style="width:80pt">REMARKS</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    ${roster.generalRemarks ? `<div class="general-remarks"><strong>General Remarks:</strong> ${roster.generalRemarks}</div>` : ""}
    <div class="doc-footer">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="sig-name">${roster.stationOfficer || "________________________________"}</div>
        <div class="sig-title">C/INSPR. ${roster.stationId.toUpperCase().substring(0, 3)}/STN</div>
        <div class="sig-title">STATION OFFICER</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function openPrint(roster: DutyRoster) {
  const html = buildPrintHTML(roster);
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked — please allow pop-ups and try again.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ─── Create / Edit form ──────────────────────────────────────────────────────

function RosterForm({
  initial,
  onSave,
  onClose,
  userStation,
  userRole,
  activeStationId,
}: {
  initial?: DutyRoster;
  onSave: () => void;
  onClose: () => void;
  userStation?: string | null;
  userRole: string;
  activeStationId?: string | null;
}) {
  const isEdit = !!initial;
  // Archived rosters cannot be edited by anyone
  const canEdit = !initial || initial.status !== "archived";

  // Station ID logic:
  // nco / so → always their own station (read-only)
  // dc / admin → can pick freely (dc will usually have activeStationId from context)
  const defaultStationId =
    initial?.stationId || activeStationId || userStation || "";

  const stationIsFixed = ["nco", "so"].includes(userRole) && !!userStation;

  const [form, setForm] = useState<RosterFormData>({
    stationId: defaultStationId,
    referenceNumber: initial?.referenceNumber || "",
    districtCommander: initial?.districtCommander || "",
    stationOfficer: initial?.stationOfficer || "",
    startDate: initial ? initial.startDate.split("T")[0] : todayISO(),
    endDate: initial ? initial.endDate.split("T")[0] : nextWeekISO(),
    entries: initial?.entries || [emptyEntry(0)],
    generalRemarks: initial?.generalRemarks || "",
    status: initial?.status || "draft",
  });
  const [saving, setSaving] = useState(false);

  function patch<K extends keyof RosterFormData>(
    key: K,
    val: RosterFormData[K],
  ) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  function patchEntry(idx: number, p: Partial<RosterEntry>) {
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
    if (!form.stationId || !form.startDate || !form.endDate) {
      toast.error("Station, start date and end date are required");
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      toast.error("End date must be after start date");
      return;
    }
    const bad = form.entries.filter((e) => !e.officerName.trim());
    if (bad.length) {
      toast.error("All entries need an officer name");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api(`/api/duty-roster/${initial!._id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        toast.success("Roster updated");
      } else {
        await api("/api/duty-roster", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Roster created");
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Header info ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <FL label="Station ID" required>
          <input
            className={inp}
            value={form.stationId}
            onChange={(e) => patch("stationId", e.target.value)}
            placeholder="e.g. asankragua"
            disabled={stationIsFixed || !canEdit}
          />
        </FL>
        <FL label="Reference Number">
          <input
            className={inp}
            value={form.referenceNumber}
            onChange={(e) => patch("referenceNumber", e.target.value)}
            placeholder="e.g. ASA.67/VOL.10/239"
            disabled={!canEdit}
          />
        </FL>
        <FL label="District Commander / CO">
          <input
            className={inp}
            value={form.districtCommander}
            onChange={(e) => patch("districtCommander", e.target.value)}
            placeholder="Name of DC / CO"
            disabled={!canEdit}
          />
        </FL>
        <FL label="Station Officer (Compiling)">
          <input
            className={inp}
            value={form.stationOfficer}
            onChange={(e) => patch("stationOfficer", e.target.value)}
            placeholder="C/INSPR. name"
            disabled={!canEdit}
          />
        </FL>
        <FL label="Start Date" required>
          <input
            type="date"
            className={inp}
            max={new Date().toISOString().split("T")[0]}
            value={form.startDate}
            onChange={(e) => patch("startDate", e.target.value)}
            disabled={!canEdit}
          />
        </FL>
        <FL label="End Date" required>
          <input
            type="date"
            className={inp}
            min={form.startDate || undefined}
            max={new Date().toISOString().split("T")[0]}
            value={form.endDate}
            onChange={(e) => patch("endDate", e.target.value)}
            disabled={!canEdit}
          />
        </FL>
        <FL label="Status">
          <select
            className={sel}
            value={form.status}
            onChange={(e) => patch("status", e.target.value as RosterStatus)}
            disabled={!canEdit || form.status === "archived"}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            {isEdit && <option value="archived">Archived</option>}
          </select>
        </FL>
      </div>

      {/* ── Entries summary ── */}
      <div className="flex items-center gap-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Users size={14} className="text-blue-600 shrink-0" />
        <p className="text-xs font-semibold text-slate-700">
          {form.entries.length} officer assignment
          {form.entries.length !== 1 ? "s" : ""} in this roster
        </p>
      </div>

      {/* ── Entry list ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">
            Duty Assignments ({form.entries.length})
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
          placeholder="Any general remarks for this roster…"
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
            {isEdit ? "Save Changes" : "Create Roster"}
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Roster detail view ───────────────────────────────────────────────────────

function RosterDetail({
  roster,
  onRefresh,
  onClose,
  userRole,
}: {
  roster: DutyRoster;
  onRefresh: () => void;
  onClose: () => void;
  userRole: string;
}) {
  const [acting, setActing] = useState(false);

  async function doAction(action: "publish" | "archive") {
    setActing(true);
    try {
      await api(`/api/duty-roster/${roster._id}`, {
        method: "PUT",
        body: JSON.stringify({ action }),
      });
      const labels: Record<string, string> = {
        publish: "published",
        archive: "archived",
      };
      toast.success(`Roster ${labels[action]}`);
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  }

  // Group by section for preview table
  const sections = roster.entries.reduce<Record<string, RosterEntry[]>>(
    (acc, e) => {
      if (!acc[e.section]) acc[e.section] = [];
      acc[e.section].push(e);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {/* Blue header card */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)",
        }}
      >
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={13} className="opacity-60" />
                <span className="text-[10px] font-bold opacity-60 uppercase tracking-[0.15em]">
                  Ghana Police Service · Duty Roster
                </span>
              </div>
              <p className="text-2xl font-black tracking-tight">
                {roster.rosterNumber}
              </p>
              <p className="text-sm opacity-75 mt-1">
                {fmtDate(roster.startDate)} — {fmtDate(roster.endDate)}
              </p>
              {roster.referenceNumber && (
                <p className="text-xs opacity-60 mt-0.5">
                  {roster.referenceNumber}
                </p>
              )}
            </div>
            <div className="text-right text-xs opacity-80 space-y-1">
              <p className="font-black text-base">
                {roster.stationId.toUpperCase()}
              </p>
              {roster.districtCommander && (
                <p>
                  DC:{" "}
                  <span className="font-semibold">
                    {roster.districtCommander}
                  </span>
                </p>
              )}
              {roster.stationOfficer && (
                <p>
                  C/INSPR:{" "}
                  <span className="font-semibold">{roster.stationOfficer}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <div
              className="rounded-xl px-4 py-2 text-center"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              <p className="text-xl font-black leading-none">
                {roster.entries.length}
              </p>
              <p className="text-[10px] opacity-70 mt-0.5">Officers</p>
            </div>
            <div
              className="rounded-xl px-4 py-2 text-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <p className="text-xl font-black leading-none">
                {Object.keys(sections).length}
              </p>
              <p className="text-[10px] opacity-70 mt-0.5">Sections</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <StatusBadge status={roster.status} />
        <div className="flex gap-2 flex-wrap">
          {/* Print / Preview — always available */}
          <button
            onClick={() => openPrint(roster)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "#374151" }}
          >
            <Printer size={11} /> Preview &amp; Print
          </button>

          {/* Publish: draft → published */}
          {roster.status === "draft" &&
            ["nco", "so", "dc", "admin"].includes(userRole) && (
              <button
                onClick={() => doAction("publish")}
                disabled={acting}
                className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ background: "#15803d" }}
              >
                <CheckCircle2 size={11} /> Publish Roster
              </button>
            )}

          {/* Archive */}
          {roster.status !== "archived" &&
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

      {/* Published notice */}
      {roster.status === "published" && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={14} className="text-green-600 shrink-0" />
          <p className="text-xs text-green-700 font-medium">
            This roster has been published and is the active duty schedule for{" "}
            <span className="font-bold">{roster.stationId.toUpperCase()}</span>.
          </p>
        </div>
      )}

      {/* Entries preview table */}
      <div>
        <p className="text-sm font-bold text-slate-800 mb-3">
          Duty Assignments
          <span className="ml-2 text-xs font-semibold text-slate-400">
            ({roster.entries.length} officers)
          </span>
        </p>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "#1e3a8a" }}>
                  {[
                    "#",
                    "Section / Post",
                    "Officer",
                    "Rank",
                    "Svc No.",
                    "Phone",
                    "Duty Time",
                    "Remarks",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2.5 font-semibold text-blue-100 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.entries.map((entry, idx) => (
                  <tr
                    key={entry._id || idx}
                    className="border-t border-slate-100 transition-colors"
                    style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}
                  >
                    <td className="px-3 py-2 font-bold text-blue-700">
                      {entry.serialNumber}
                    </td>
                    <td className="px-3 py-2 font-semibold text-blue-800 text-[10px] uppercase">
                      {entry.section}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      {entry.officerName}
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {entry.rank}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400">
                      {entry.serviceNumber || "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">
                      {entry.phoneNumber || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {entry.dutyTime || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-400 text-[10px]">
                      {entry.remarks || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {roster.generalRemarks && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">
            General Remarks
          </p>
          <p className="text-sm text-slate-700">{roster.generalRemarks}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-[11px] text-slate-400">
        <p>
          Created by{" "}
          <span className="font-semibold text-slate-600">
            {roster.createdBy?.fullName || "—"}
          </span>
        </p>
        <p>{fmtDate(roster.createdAt)}</p>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteDialog({
  roster,
  onConfirm,
  onClose,
}: {
  roster: DutyRoster;
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
              Delete roster {roster.rosterNumber}?
            </p>
            <p className="text-xs text-red-600 mt-1">This cannot be undone.</p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
          <p>
            <span className="font-semibold">Roster:</span> {roster.rosterNumber}
          </p>
          <p>
            <span className="font-semibold">Period:</span>{" "}
            {fmtDate(roster.startDate)} — {fmtDate(roster.endDate)}
          </p>
          <p>
            <span className="font-semibold">Station:</span>{" "}
            {roster.stationId.toUpperCase()}
          </p>
          <p>
            <span className="font-semibold">Officers:</span>{" "}
            {roster.entries.length}
          </p>
          <p>
            <span className="font-semibold">Status:</span>{" "}
            {STATUS_META[roster.status].label}
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

export default function DutyRosterPage() {
  const authUser = getAuthUser();
  const userRole: string = authUser?.role ?? "nco";
  const userStation: string | null = authUser?.stationId ?? null;

  // StationContext is populated for dc / admin from the sidebar picker.
  // For nco / so its selectedStation will be null and stationParam will be null
  // — that's fine because the API ignores the query param for those roles anyway.
  const { selectedStation, stationParam } = useStation();

  const [rosters, setRosters] = useState<DutyRoster[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [viewRoster, setViewRoster] = useState<DutyRoster | null>(null);
  const [editRoster, setEditRoster] = useState<DutyRoster | null>(null);
  const [deleteRoster, setDeleteRoster] = useState<DutyRoster | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRosters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(search && { search }),
        // Pass stationId for dc / admin only — API ignores it for nco / so
        ...(["dc", "admin"].includes(userRole) && stationParam
          ? { stationId: stationParam }
          : {}),
      });
      const data = await api<{ rosters: DutyRoster[]; pagination: Pagination }>(
        `/api/duty-roster?${params}`,
      );
      setRosters(data.rosters);
      setPagination(data.pagination);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load rosters",
      );
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, stationParam, userRole]);

  useEffect(() => {
    fetchRosters();
  }, [fetchRosters]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, stationParam]);

  function handleSearchChange(val: string) {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setSearch(val), 350);
  }

  async function refreshDetail() {
    if (!viewRoster) return;
    try {
      const data = await api<{ roster: DutyRoster }>(
        `/api/duty-roster/${viewRoster._id}`,
      );
      setViewRoster(data.roster);
      fetchRosters();
    } catch {
      /* silent */
    }
  }

  async function handleDelete(roster: DutyRoster) {
    try {
      await api(`/api/duty-roster/${roster._id}`, { method: "DELETE" });
      toast.success("Roster deleted");
      setDeleteRoster(null);
      fetchRosters();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const draftCount = rosters.filter((r) => r.status === "draft").length;
  const publishedCount = rosters.filter((r) => r.status === "published").length;
  const archivedCount = rosters.filter((r) => r.status === "archived").length;

  // The station ID to pre-fill in the create/edit form
  const activeStationId = ["dc", "admin"].includes(userRole)
    ? (stationParam ?? userStation)
    : userStation;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "#1e40af" }}
              >
                <FileText size={14} className="text-white" />
              </div>
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">
                Ghana Police Service
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Duty Roster
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Weekly duty assignment register — manage &amp; print official
              rosters
            </p>

            {/* Show active station for dc / admin */}
            {selectedStation && ["dc", "admin"].includes(userRole) && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Building2 size={12} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700 uppercase">
                  {selectedStation.name}
                </span>
              </div>
            )}
            {/* Show own station for nco / so */}
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
              onClick={fetchRosters}
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
              <Plus size={14} /> New Roster
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FileText size={18} />}
            label="Total Rosters"
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
            icon={<CheckCircle2 size={18} />}
            label="Published"
            value={publishedCount}
            sub="Active rosters"
            accent="#16a34a"
          />
          <StatCard
            icon={<Archive size={18} />}
            label="Archived"
            value={archivedCount}
            sub="Historical records"
            accent="#94a3b8"
          />
        </div>

        {/* ── Search + filters ── */}
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
                placeholder="Search roster number, station, officer…"
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
              {statusFilter !== "all" && (
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
                  <option value="archived">Archived</option>
                </select>
                {statusFilter !== "all" && (
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>

          {/* Station indicator for dc / admin */}
          {["dc", "admin"].includes(userRole) && (
            <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <Building2 size={12} className="text-blue-600 shrink-0" />
              <p className="text-xs text-blue-700">
                {selectedStation ? (
                  <>
                    Showing rosters for:{" "}
                    <span className="font-bold">{selectedStation.name}</span>
                    <span className="ml-1 text-blue-500 font-mono text-[10px]">
                      ({selectedStation.id})
                    </span>
                  </>
                ) : (
                  <span className="font-semibold">
                    Showing rosters from all stations
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* ── Roster list ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-blue-700" />
              <span className="font-bold text-slate-800 text-sm">
                Duty Rosters
                {pagination && (
                  <span className="ml-2 text-xs font-semibold text-slate-400">
                    ({pagination.total} total)
                  </span>
                )}
              </span>
            </div>
            {!loading && rosters.length > 0 && (
              <p className="text-xs text-slate-400">
                Showing {rosters.length} of {pagination?.total ?? 0}
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 size={28} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-400 font-medium">
                Loading rosters…
              </p>
            </div>
          ) : rosters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <FileText size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                No rosters found
              </p>
              <p className="text-xs text-slate-400">
                {search || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first duty roster to get started"}
              </p>
              {!search && statusFilter === "all" && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl"
                  style={{ background: "#1e40af" }}
                >
                  <Plus size={13} /> New Roster
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {rosters.map((roster) => (
                <div
                  key={roster._id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/70 transition-colors group"
                >
                  <div
                    className="w-1 h-14 rounded-full shrink-0"
                    style={{
                      background:
                        roster.status === "published"
                          ? "#22c55e"
                          : roster.status === "archived"
                            ? "#94a3b8"
                            : "#cbd5e1",
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1.5">
                      <span className="font-mono font-black text-blue-700 text-xs">
                        {roster.rosterNumber}
                      </span>
                      <StatusBadge status={roster.status} />
                      {/* Show station label for dc / admin cross-station view */}
                      {["dc", "admin"].includes(userRole) && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-full">
                          {roster.stationId}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {fmtDate(roster.startDate)} —{" "}
                        {fmtDate(roster.endDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 size={10} /> {roster.stationId.toUpperCase()}
                      </span>
                      {roster.districtCommander && (
                        <span className="flex items-center gap-1">
                          <Shield size={10} /> DC: {roster.districtCommander}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users size={10} /> {roster.entries.length} officers
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                    {/* Print — always available */}
                    <button
                      onClick={() => openPrint(roster)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                      title="Preview & Print"
                    >
                      <Printer size={15} />
                    </button>

                    {/* View detail */}
                    <button
                      onClick={() => setViewRoster(roster)}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-all"
                      title="View"
                    >
                      <Eye size={15} />
                    </button>

                    {/* Edit — not for archived */}
                    {canEditRoster(roster, userRole) && (
                      <button
                        onClick={() => setEditRoster(roster)}
                        className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
                        title="Edit"
                      >
                        <Edit size={15} />
                      </button>
                    )}

                    {/* Quick publish — only for drafts */}
                    {roster.status === "draft" &&
                      ["nco", "so", "dc", "admin"].includes(userRole) && (
                        <button
                          onClick={async () => {
                            try {
                              await api(`/api/duty-roster/${roster._id}`, {
                                method: "PUT",
                                body: JSON.stringify({ action: "publish" }),
                              });
                              toast.success("Roster published");
                              fetchRosters();
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to publish",
                              );
                            }
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all"
                          title="Publish"
                        >
                          <Send size={15} />
                        </button>
                      )}

                    {/* ── Delete button ──────────────────────────────────────
                        Visible to:
                          admin → any roster (draft, published, archived)
                          dc    → any roster (draft, published, archived)
                          so    → draft and archived only (not published)
                          nco   → draft and archived only (not published)
                        Hidden to: all other roles
                    ─────────────────────────────────────────────────────── */}
                    {canDeleteRoster(roster, userRole) && (
                      <button
                        onClick={() => setDeleteRoster(roster)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
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

      {/* ── Modals ── */}
      {createOpen && (
        <Modal
          title="New Duty Roster"
          wide
          onClose={() => setCreateOpen(false)}
        >
          <RosterForm
            onSave={fetchRosters}
            onClose={() => setCreateOpen(false)}
            userStation={userStation}
            userRole={userRole}
            activeStationId={activeStationId}
          />
        </Modal>
      )}

      {editRoster && (
        <Modal
          title={`Edit — ${editRoster.rosterNumber}`}
          wide
          onClose={() => setEditRoster(null)}
        >
          <RosterForm
            initial={editRoster}
            onSave={fetchRosters}
            onClose={() => setEditRoster(null)}
            userStation={userStation}
            userRole={userRole}
            activeStationId={activeStationId}
          />
        </Modal>
      )}

      {viewRoster && (
        <Modal
          title={`Duty Roster — ${viewRoster.rosterNumber}`}
          wide
          onClose={() => setViewRoster(null)}
        >
          <RosterDetail
            roster={viewRoster}
            onRefresh={refreshDetail}
            onClose={() => setViewRoster(null)}
            userRole={userRole}
          />
        </Modal>
      )}

      {deleteRoster && (
        <DeleteDialog
          roster={deleteRoster}
          onConfirm={() => handleDelete(deleteRoster)}
          onClose={() => setDeleteRoster(null)}
        />
      )}
    </div>
  );
}
