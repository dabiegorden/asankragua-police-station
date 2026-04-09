"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Shield,
  Layers,
  TrendingUp,
  AlertTriangle,
  Activity,
  FileCheck,
  FileClock,
  ShieldAlert,
  User,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentCase {
  _id: string;
  title: string;
  caseNumber: string;
  status: string;
  category: string;
  priority: string;
  createdAt: string;
  dcReviewedAt?: string;
  submittedForReviewAt?: string;
  assignedOfficer?: {
    _id: string;
    fullName: string;
    email: string;
  };
  assignedSO?: {
    _id: string;
    fullName: string;
    email: string;
  };
  assignedDC?: {
    _id: string;
    fullName: string;
    email: string;
  };
  soReviewNote?: string;
  currentStage?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800 border-emerald-200",
  referred: "bg-sky-100 text-sky-800 border-sky-200",
  investigating: "bg-amber-100 text-amber-800 border-amber-200",
  under_review: "bg-violet-100 text-violet-800 border-violet-200",
  commander_review: "bg-indigo-100 text-indigo-800 border-indigo-200",
  closed: "bg-slate-100 text-slate-700 border-slate-200",
  suspended: "bg-red-100 text-red-800 border-red-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  Felony: "bg-red-100 text-red-800 border-red-200",
  Misdemeanour: "bg-orange-100 text-orange-700 border-orange-200",
  "Summary Offence": "bg-blue-50 text-blue-700 border-blue-200",
};

function getStatusColor(status: string): string {
  return (
    STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700 border-slate-200"
  );
}

function getPriorityColor(priority: string): string {
  return (
    PRIORITY_COLORS[priority] ?? "bg-slate-100 text-slate-700 border-slate-200"
  );
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr);
    return user._id || user.id || null;
  } catch {
    return null;
  }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  highlight?: boolean;
}

function StatCard({
  title,
  value,
  sub,
  icon,
  iconBg,
  highlight,
}: StatCardProps) {
  return (
    <Card
      className={`hover:shadow-md transition-shadow duration-200 ${highlight ? "ring-2 ring-indigo-300" : ""}`}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p
              className={`text-2xl font-bold tracking-tight ${highlight ? "text-indigo-600" : ""}`}
            >
              {value.toLocaleString()}
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

// ─── DC-specific stats interface ─────────────────────────────────────────────

interface DcStats {
  totalAssigned: number;
  awaitingReview: number;
  closedByMe: number;
  suspendedByMe: number;
  withSONote: number;
  byPriority: {
    felony: number;
    misdemeanour: number;
    summaryOffence: number;
  };
  byCategory: Record<string, number>;
  avgReviewTime: number; // in days
}

const DEFAULT_STATS: DcStats = {
  totalAssigned: 0,
  awaitingReview: 0,
  closedByMe: 0,
  suspendedByMe: 0,
  withSONote: 0,
  byPriority: { felony: 0, misdemeanour: 0, summaryOffence: 0 },
  byCategory: {},
  avgReviewTime: 0,
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

const DcDashboardPage = () => {
  const [stats, setStats] = useState<DcStats>(DEFAULT_STATS);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const token = getToken();
      const authHeaders: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // DC has full visibility — fetch all cases across all pages
      let allCases: RecentCase[] = [];
      let page = 1;
      const limit = 100;

      while (true) {
        const res = await fetch(`/api/cases?page=${page}&limit=${limit}`, {
          headers: authHeaders,
          credentials: "include",
        });

        if (!res.ok) {
          const msg = await res.text();
          console.error("Cases fetch error:", msg);
          toast.error("Failed to load case data. Please try again.");
          return;
        }

        const {
          cases,
          pagination,
        }: { cases: RecentCase[]; pagination: { pages: number } } =
          await res.json();

        allCases = allCases.concat(cases);

        if (page >= pagination.pages) break;
        page++;
      }

      // DC sees everything — no client-side filtering
      const dcCases = allCases;

      // Compute avg review time using actual decision timestamp, not now()
      let totalReviewTime = 0;
      let reviewedCount = 0;

      dcCases.forEach((c) => {
        if (
          c.submittedForReviewAt &&
          c.dcReviewedAt &&
          (c.status === "closed" || c.status === "suspended")
        ) {
          const submitted = new Date(c.submittedForReviewAt).getTime();
          const decided = new Date(c.dcReviewedAt).getTime();
          const days = Math.floor(
            (decided - submitted) / (1000 * 60 * 60 * 24),
          );
          if (days >= 0) {
            totalReviewTime += days;
            reviewedCount++;
          }
        }
      });

      const computed: DcStats = {
        totalAssigned: dcCases.length,
        awaitingReview: dcCases.filter((c) => c.status === "commander_review")
          .length,
        closedByMe: dcCases.filter((c) => c.status === "closed").length,
        suspendedByMe: dcCases.filter((c) => c.status === "suspended").length,
        withSONote: dcCases.filter((c) => !!c.soReviewNote).length,
        byPriority: {
          felony: dcCases.filter((c) => c.priority === "Felony").length,
          misdemeanour: dcCases.filter((c) => c.priority === "Misdemeanour")
            .length,
          summaryOffence: dcCases.filter(
            (c) => c.priority === "Summary Offence",
          ).length,
        },
        byCategory: dcCases.reduce(
          (acc, c) => {
            acc[c.category] = (acc[c.category] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        avgReviewTime:
          reviewedCount > 0 ? Math.round(totalReviewTime / reviewedCount) : 0,
      };

      setStats(computed);

      // Show the 6 most urgent: commander_review first, then by newest createdAt
      const sorted = [...dcCases].sort((a, b) => {
        const aUrgent = a.status === "commander_review" ? 0 : 1;
        const bUrgent = b.status === "commander_review" ? 0 : 1;
        if (aUrgent !== bUrgent) return aUrgent - bUrgent;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      setRecentCases(sorted.slice(0, 6));
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      toast.error("Failed to fetch dashboard data. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  const categoryEntries = Object.entries(stats.byCategory).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="space-y-8 pt-12 pb-16 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
            District Commander
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Command Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Overview of cases requiring your review and final decisions
          </p>
        </div>
        <Button
          onClick={() => fetchData(true)}
          variant="outline"
          disabled={refreshing}
          className="w-fit gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Awaiting review alert banner */}
      {stats.awaitingReview > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
          <Shield className="h-5 w-5 text-indigo-500 shrink-0" />
          <div>
            <p className="font-semibold text-indigo-700 text-sm">
              {stats.awaitingReview} case
              {stats.awaitingReview !== 1 ? "s" : ""} awaiting your review
            </p>
            <p className="text-xs text-indigo-500 mt-0.5">
              Cases have been escalated by Station Officers for final decision.
            </p>
          </div>
        </div>
      )}

      {/* ── Primary stats ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          My Review Queue
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Assigned"
            value={stats.totalAssigned}
            sub={`${stats.awaitingReview} pending review`}
            icon={<Shield className="h-5 w-5 text-indigo-600" />}
            iconBg="bg-indigo-100"
          />
          <StatCard
            title="Awaiting Review"
            value={stats.awaitingReview}
            sub="Requires final decision"
            icon={<FileClock className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-100"
            highlight={stats.awaitingReview > 0}
          />
          <StatCard
            title="Cases Closed"
            value={stats.closedByMe}
            sub="Successfully concluded"
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-100"
          />
          <StatCard
            title="Cases Suspended"
            value={stats.suspendedByMe}
            sub="Administratively suspended"
            icon={<XCircle className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-100"
          />
        </div>
      </section>

      {/* ── Secondary stats ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Performance Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="SO Review Notes"
            value={stats.withSONote}
            sub="Cases with SO recommendations"
            icon={<FileCheck className="h-5 w-5 text-violet-600" />}
            iconBg="bg-violet-100"
          />
          <StatCard
            title="Avg. Review Time"
            value={stats.avgReviewTime}
            sub="Days to final decision"
            icon={<Clock className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            title="Felony Cases"
            value={stats.byPriority.felony}
            sub="Highest priority"
            icon={<ShieldAlert className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-100"
            highlight={stats.byPriority.felony > 0}
          />
          <StatCard
            title="Total Decisions"
            value={stats.closedByMe + stats.suspendedByMe}
            sub="Closed + Suspended"
            icon={<Activity className="h-5 w-5 text-slate-600" />}
            iconBg="bg-slate-100"
          />
        </div>
      </section>

      {/* ── Breakdowns ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Priority */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Cases by Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  label: "Felony",
                  key: "felony" as const,
                  color: "bg-red-500",
                },
                {
                  label: "Misdemeanour",
                  key: "misdemeanour" as const,
                  color: "bg-orange-400",
                },
                {
                  label: "Summary Offence",
                  key: "summaryOffence" as const,
                  color: "bg-amber-400",
                },
              ].map(({ label, key, color }) => {
                const count = stats.byPriority[key];
                const pct =
                  stats.totalAssigned > 0
                    ? (count / stats.totalAssigned) * 100
                    : 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{label}</span>
                      <span className="font-medium text-foreground">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Cases by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  label: "Awaiting Review",
                  value: stats.awaitingReview,
                  color: "bg-indigo-500",
                },
                {
                  label: "Closed",
                  value: stats.closedByMe,
                  color: "bg-emerald-500",
                },
                {
                  label: "Suspended",
                  value: stats.suspendedByMe,
                  color: "bg-red-500",
                },
              ].map(({ label, value, color }) => {
                const pct =
                  stats.totalAssigned > 0
                    ? (value / stats.totalAssigned) * 100
                    : 0;
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{label}</span>
                      <span className="font-medium text-foreground">
                        {value}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Category breakdown ──────────────────────────────────────────── */}
      {categoryEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Cases by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {categoryEntries.map(([cat, count]) => (
                <div
                  key={cat}
                  className="bg-muted/40 rounded-lg p-3 text-center hover:bg-muted/70 transition-colors"
                >
                  <p className="text-xl font-bold text-indigo-600">{count}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    {cat}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent cases ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            Recent Cases for Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentCases.length > 0 ? (
              recentCases.map((c) => (
                <div
                  key={c._id}
                  className={`flex items-start justify-between p-3 rounded-lg transition-colors ${
                    c.status === "commander_review"
                      ? "bg-indigo-50 border border-indigo-100"
                      : "bg-muted/40 hover:bg-muted/70"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{c.title}</p>
                      {c.status === "commander_review" && (
                        <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                          <Shield size={8} /> Review
                        </span>
                      )}
                      {c.soReviewNote && (
                        <span className="inline-flex items-center gap-1 bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                          <FileCheck size={8} /> SO Note
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {c.caseNumber}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <Badge
                        className={`text-[10px] border ${getStatusColor(c.status)}`}
                        variant="outline"
                      >
                        {c.status.replace(/_/g, " ")}
                      </Badge>
                      <Badge
                        className={`text-[10px] border ${getPriorityColor(c.priority)}`}
                        variant="outline"
                      >
                        {c.priority}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-[10px] capitalize"
                      >
                        {c.category}
                      </Badge>
                      {c.assignedSO && (
                        <Badge
                          variant="outline"
                          className="text-[10px] flex items-center gap-1"
                        >
                          <User size={8} />
                          SO: {c.assignedSO.fullName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap ml-3 pt-0.5">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <Shield className="h-8 w-8 opacity-30" />
                <p className="text-sm">No cases assigned for review yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                icon: <FileClock className="h-5 w-5" />,
                label: "Review Cases",
                desc: `${stats.awaitingReview} pending`,
              },
              {
                icon: <CheckCircle2 className="h-5 w-5" />,
                label: "Close Case",
                desc: "Final approval",
              },
              {
                icon: <XCircle className="h-5 w-5" />,
                label: "Suspend Case",
                desc: "Administrative action",
              },
              {
                icon: <TrendingUp className="h-5 w-5" />,
                label: "All Cases",
                desc: `${stats.totalAssigned} total`,
              },
            ].map(({ icon, label, desc }) => (
              <Button
                key={label}
                variant="outline"
                className="h-20 flex flex-col gap-1.5 bg-transparent hover:bg-muted/50 transition-colors"
              >
                {icon}
                <span className="text-xs font-medium">{label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {desc}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DcDashboardPage;
