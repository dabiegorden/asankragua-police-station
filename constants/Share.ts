// src/components/cases/shared.ts
// Shared types, helpers, and constants for the Digital Case Book system

// ─── API helper ───────────────────────────────────────────────────────────────
export async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type UserRef = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  badgeNumber?: string;
};

export type Attachment = {
  url: string;
  publicId: string;
  originalName?: string;
  resourceType?: string;
  format?: string;
  bytes?: number;
};

export type Note = {
  _id: string;
  content: string;
  addedBy?: UserRef;
  roleSnapshot: string;
  attachments?: Attachment[];
  addedAt: string;
};

// ─── Digital Case Book entry ──────────────────────────────────────────────────
export type CaseBookEntry = {
  _id: string;
  stage: "nco" | "cid" | "so" | "dc";
  entryType:
    | "remark"
    | "referral"
    | "investigation_start"
    | "findings"
    | "directive"
    | "review"
    | "decision";
  content: string;
  addedBy?: UserRef;
  roleSnapshot: string;
  attachments?: Attachment[];
  addedAt: string;
  isEditable: boolean;
};

// ─── Audit log entry ──────────────────────────────────────────────────────────
export type AuditEntry = {
  _id: string;
  action: string;
  performedBy?: UserRef;
  performedAt: string;
  fromStage?: string;
  toStage?: string;
  details?: string;
};

export type ThreadMessage = {
  _id: string;
  thread: "nco_cid" | "cid_so" | "dc";
  content: string;
  fromUser?: UserRef;
  fromRole: string;
  toRole?: string;
  attachments?: Attachment[];
  readBy?: string[];
  sentAt: string;
};

export type CaseData = {
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
  loggedBy?: UserRef;
  assignedOfficer?: UserRef;
  assignedSO?: UserRef;
  assignedDC?: UserRef;
  location: string;
  dateReported: string;
  dateOccurred: string;
  suspects: {
    name: string;
    age?: number;
    description?: string;
    address?: string;
  }[];
  witnesses: { name: string; phone?: string; statement?: string }[];
  attachments?: Attachment[];
  notes: Note[];
  caseBookEntries: CaseBookEntry[];
  auditLog: AuditEntry[];
  threadMessages: ThreadMessage[];
  ncoReferralNote?: string;
  cidSubmissionNote?: string;
  soReviewNote?: string;
  soDirective?: string;
  dcNote?: string;
  referredAt?: string;
  investigationStartedAt?: string;
  submittedForReviewAt?: string;
  soReviewedAt?: string;
  dcReviewedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────
export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: {
    label: "Open",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  referred: {
    label: "Referred to CID",
    color: "text-blue-700 bg-blue-50 border-blue-200",
  },
  investigating: {
    label: "Investigating",
    color: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  under_review: {
    label: "Under Review",
    color: "text-purple-700 bg-purple-50 border-purple-200",
  },
  commander_review: {
    label: "Commander Review",
    color: "text-amber-700 bg-amber-50 border-amber-200",
  },
  closed: {
    label: "Closed",
    color: "text-gray-600 bg-gray-100 border-gray-200",
  },
  suspended: {
    label: "Suspended",
    color: "text-orange-700 bg-orange-50 border-orange-200",
  },
};

export const PRIORITY_BADGE: Record<string, string> = {
  Felony: "text-red-700 bg-red-50 border-red-200",
  Misdemeanour: "text-yellow-700 bg-yellow-50 border-yellow-200",
  "Summary Offence": "text-gray-600 bg-gray-50 border-gray-200",
};

export const PRIORITY_LEFT: Record<string, string> = {
  Felony: "bg-red-500",
  Misdemeanour: "bg-yellow-400",
  "Summary Offence": "bg-gray-300",
};

export const ROLE_LABELS: Record<string, string> = {
  nco: "NCO / Station Orderly",
  cid: "CID Investigator",
  so: "Station Officer",
  dc: "District Commander",
  admin: "Administrator",
};

export const ROLE_SHORT: Record<string, string> = {
  nco: "NCO",
  cid: "CID",
  so: "SO",
  dc: "DC",
  admin: "ADMIN",
};

export const STAGE_COLORS: Record<
  string,
  { bg: string; text: string; border: string; badge: string }
> = {
  nco: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    badge: "bg-blue-600",
  },
  cid: {
    bg: "bg-indigo-50",
    text: "text-indigo-800",
    border: "border-indigo-200",
    badge: "bg-indigo-600",
  },
  so: {
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-200",
    badge: "bg-purple-600",
  },
  dc: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    badge: "bg-amber-600",
  },
};

export const ENTRY_TYPE_LABELS: Record<string, string> = {
  remark: "Remark",
  referral: "Referral Note",
  investigation_start: "Investigation Commenced",
  findings: "Investigation Findings",
  directive: "Directive",
  review: "Review Notes",
  decision: "Final Decision",
};

export const CATEGORIES = [
  "theft",
  "assault",
  "fraud",
  "domestic",
  "traffic",
  "drug",
  "other",
];

// ─── Utilities ────────────────────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── Stage workflow order ─────────────────────────────────────────────────────
export const STAGE_ORDER = ["nco", "cid", "so", "dc"];

export function getStageIndex(stage: string): number {
  return STAGE_ORDER.indexOf(stage);
}

// Group case book entries by stage in workflow order
export function groupEntriesByStage(
  entries: CaseBookEntry[],
): Record<string, CaseBookEntry[]> {
  const grouped: Record<string, CaseBookEntry[]> = {
    nco: [],
    cid: [],
    so: [],
    dc: [],
  };
  entries.forEach((e) => {
    if (grouped[e.stage]) grouped[e.stage].push(e);
  });
  return grouped;
}
