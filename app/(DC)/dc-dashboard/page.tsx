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
  AlertTriangle,
  Activity,
  FileCheck,
  FileClock,
  ShieldAlert,
  User,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useStation } from "@/context/StationContext";
import DashboardWelcome from "@/components/DashboardWelcome";

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
  assignedOfficer?: { _id: string; fullName: string; email: string };
  assignedSO?: { _id: string; fullName: string; email: string };
  soReviewNote?: string;
  currentStage?: string;
}

interface DcStats {
  totalAssigned: number;
  awaitingReview: number;
  closedByMe: number;
  suspendedByMe: number;
  withSONote: number;
  byPriority: { felony: number; misdemeanour: number; summaryOffence: number };
  byCategory: Record<string, number>;
  avgReviewTime: number;
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

function getStatusColor(s: string) {
  return STATUS_COLORS[s] ?? "bg-slate-100 text-slate-700 border-slate-200";
}
function getPriorityColor(p: string) {
  return PRIORITY_COLORS[p] ?? "bg-slate-100 text-slate-700 border-slate-200";
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon,
  iconBg,
  highlight,
}: {
  title: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`hover:shadow-md transition-shadow ${highlight ? "ring-2 ring-indigo-300" : ""}`}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

const DcDashboardPage = () => {
  const {
    selectedStation,
    stationParam,
    loading: stationLoading,
  } = useStation();

  const [stats, setStats] = useState<DcStats>(DEFAULT_STATS);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(
    async (silent = false) => {
      if (stationLoading) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        // Build the stationId query param
        const stationQuery = stationParam ? `&stationId=${stationParam}` : "";

        let allCases: RecentCase[] = [];
        let page = 1;
        const limit = 100;

        while (true) {
          const res = await fetch(
            `/api/cases?page=${page}&limit=${limit}${stationQuery}`,
            { credentials: "include" },
          );

          if (!res.ok) {
            toast.error("Failed to load case data.");
            return;
          }

          const { cases, pagination } = await res.json();
          allCases = allCases.concat(cases);
          if (page >= pagination.pages) break;
          page++;
        }

        let totalReviewTime = 0;
        let reviewedCount = 0;

        allCases.forEach((c) => {
          if (
            c.submittedForReviewAt &&
            c.dcReviewedAt &&
            (c.status === "closed" || c.status === "suspended")
          ) {
            const days = Math.floor(
              (new Date(c.dcReviewedAt).getTime() -
                new Date(c.submittedForReviewAt).getTime()) /
                86400000,
            );
            if (days >= 0) {
              totalReviewTime += days;
              reviewedCount++;
            }
          }
        });

        setStats({
          totalAssigned: allCases.length,
          awaitingReview: allCases.filter(
            (c) => c.status === "commander_review",
          ).length,
          closedByMe: allCases.filter((c) => c.status === "closed").length,
          suspendedByMe: allCases.filter((c) => c.status === "suspended")
            .length,
          withSONote: allCases.filter((c) => !!c.soReviewNote).length,
          byPriority: {
            felony: allCases.filter((c) => c.priority === "Felony").length,
            misdemeanour: allCases.filter((c) => c.priority === "Misdemeanour")
              .length,
            summaryOffence: allCases.filter(
              (c) => c.priority === "Summary Offence",
            ).length,
          },
          byCategory: allCases.reduce(
            (acc, c) => {
              acc[c.category] = (acc[c.category] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
          avgReviewTime:
            reviewedCount > 0 ? Math.round(totalReviewTime / reviewedCount) : 0,
        });

        const sorted = [...allCases].sort((a, b) => {
          const aU = a.status === "commander_review" ? 0 : 1;
          const bU = b.status === "commander_review" ? 0 : 1;
          if (aU !== bU) return aU - bU;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });

        setRecentCases(sorted.slice(0, 6));
      } catch {
        toast.error("Failed to fetch dashboard data.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [stationParam, stationLoading],
  );

  // Re-fetch whenever the selected station changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || stationLoading) {
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
    <div className="space-y-8 pt-6 pb-16 max-w-7xl mx-auto">
      <DashboardWelcome />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
            District Commander
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Command Dashboard
          </h1>
          {selectedStation && (
            <div className="flex items-center gap-1.5 mt-1">
              <Building2 size={12} className="text-amber-600" />
              <p className="text-sm text-amber-700 font-medium">
                {selectedStation.name}
              </p>
            </div>
          )}
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

      {/* Alert banner */}
      {stats.awaitingReview > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
          <Shield className="h-5 w-5 text-indigo-500 shrink-0" />
          <div>
            <p className="font-semibold text-indigo-700 text-sm">
              {stats.awaitingReview} case{stats.awaitingReview !== 1 ? "s" : ""}{" "}
              awaiting your review
              {selectedStation ? ` at ${selectedStation.name}` : ""}
            </p>
            <p className="text-xs text-indigo-500 mt-0.5">
              Escalated by Station Officers for final decision.
            </p>
          </div>
        </div>
      )}

      {/* Primary stats */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Review Queue
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Cases"
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

      {/* Secondary stats */}
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

      {/* Breakdowns */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Cases by Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(
                [
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
                ] as const
              ).map(({ label, key, color }) => {
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
                        className={`h-full rounded-full ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

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
                        className={`h-full rounded-full ${color}`}
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

      {/* Category breakdown */}
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

      {/* Recent cases */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            Recent Cases
            {selectedStation && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                — {selectedStation.name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentCases.length > 0 ? (
              recentCases.map((c) => (
                <div
                  key={c._id}
                  className={`flex items-start justify-between p-3 rounded-lg ${
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
                          <User size={8} /> SO: {c.assignedSO.fullName}
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
                <p className="text-sm">No cases found for this station.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DcDashboardPage;
