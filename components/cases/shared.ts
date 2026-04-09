// src/components/cases/shared.ts
// Shared types, constants, and helpers for all case management pages

export interface UserRef {
  _id: string;
  fullName: string;
  email: string;
  role: string;
}

export interface Attachment {
  url: string;
  publicId: string;
  originalName?: string;
  resourceType?: string;
  format?: string;
  bytes?: number;
}

export interface Note {
  _id: string;
  content: string;
  addedBy: UserRef;
  roleSnapshot?: string;
  attachments?: Attachment[];
  addedAt: string;
}

export interface ThreadMessage {
  _id: string;
  thread: "nco_cid" | "cid_so" | "dc";
  content: string;
  fromUser: UserRef;
  fromRole: string;
  toRole?: string;
  attachments?: Attachment[];
  readBy?: string[];
  sentAt: string;
}

export interface CaseData {
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
  threadMessages: ThreadMessage[];
  attachments?: Attachment[];
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

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const STATUS_MAP: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  open: {
    label: "Open",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    dot: "bg-emerald-400",
  },
  referred: {
    label: "Referred to CID",
    color: "text-sky-400 bg-sky-400/10 border-sky-400/20",
    dot: "bg-sky-400",
  },
  investigating: {
    label: "Investigating",
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    dot: "bg-amber-400",
  },
  under_review: {
    label: "Under Review",
    color: "text-violet-400 bg-violet-400/10 border-violet-400/20",
    dot: "bg-violet-400",
  },
  commander_review: {
    label: "Commander Review",
    color: "text-pink-400 bg-pink-400/10 border-pink-400/20",
    dot: "bg-pink-400",
  },
  closed: {
    label: "Closed",
    color: "text-slate-400 bg-slate-400/10 border-slate-400/20",
    dot: "bg-slate-400",
  },
  suspended: {
    label: "Suspended",
    color: "text-red-400 bg-red-400/10 border-red-400/20",
    dot: "bg-red-400",
  },
};

export const PRIORITY_STRIPE: Record<string, string> = {
  Felony: "bg-red-500",
  Misdemeanour: "bg-orange-400",
  "Summary Offence": "bg-sky-500",
};

export const PRIORITY_BADGE: Record<string, string> = {
  Felony: "text-red-400 bg-red-400/10 border-red-400/20",
  Misdemeanour: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  "Summary Offence": "text-sky-400 bg-sky-400/10 border-sky-400/20",
};

export const ROLE_LABELS: Record<string, string> = {
  nco: "NCO / Station Orderly",
  cid: "CID Investigator",
  so: "Station Officer",
  dc: "District Commander",
  admin: "Administrator",
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

export async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
