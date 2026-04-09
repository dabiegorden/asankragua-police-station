"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Clock,
  TrendingUp,
  MessageSquare,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Layers,
  Microscope,
  CheckCircle2,
  PlayCircle,
  ArrowUpRight,
  ShieldAlert,
  Activity,
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
  soDirective?: string;
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
      className={`hover:shadow-md transition-shadow duration-200 ${highlight ? "ring-2 ring-red-300" : ""}`}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p
              className={`text-2xl font-bold tracking-tight ${highlight ? "text-red-600" : ""}`}
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

// ─── CID-specific stats interface ────────────────────────────────────────────

interface CidStats {
  totalAssigned: number;
  awaitingStart: number;
  investigating: number;
  submittedForReview: number;
  closedByMe: number;
  withDirective: number;
  unreadMessages: number;
  byPriority: {
    felony: number;
    misdemeanour: number;
    summaryOffence: number;
  };
  byCategory: Record<string, number>;
}

const DEFAULT_STATS: CidStats = {
  totalAssigned: 0,
  awaitingStart: 0,
  investigating: 0,
  submittedForReview: 0,
  closedByMe: 0,
  withDirective: 0,
  unreadMessages: 0,
  byPriority: { felony: 0, misdemeanour: 0, summaryOffence: 0 },
  byCategory: {},
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

const CidDashboardPage = () => {
  const [stats, setStats] = useState<CidStats>(DEFAULT_STATS);
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

      const casesRes = await fetch("/api/cases?limit=50", {
        headers: authHeaders,
        credentials: "include",
      });

      if (casesRes.ok) {
        const { cases }: { cases: RecentCase[] } = await casesRes.json();

        // Compute CID-specific stats from cases
        const computed: CidStats = {
          totalAssigned: cases.length,
          awaitingStart: cases.filter((c) => c.status === "referred").length,
          investigating: cases.filter((c) => c.status === "investigating")
            .length,
          submittedForReview: cases.filter((c) =>
            ["under_review", "commander_review"].includes(c.status),
          ).length,
          closedByMe: cases.filter((c) => c.status === "closed").length,
          withDirective: cases.filter((c) => (c as any).soDirective).length,
          unreadMessages: 0,
          byPriority: {
            felony: cases.filter((c) => c.priority === "Felony").length,
            misdemeanour: cases.filter((c) => c.priority === "Misdemeanour")
              .length,
            summaryOffence: cases.filter(
              (c) => c.priority === "Summary Offence",
            ).length,
          },
          byCategory: cases.reduce(
            (acc, c) => {
              acc[c.category] = (acc[c.category] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
        };

        setStats(computed);
        setRecentCases(cases.slice(0, 6));
      } else {
        toast.error("Failed to load case data");
      }
    } catch {
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
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  const activeCases = stats.awaitingStart + stats.investigating;
  const categoryEntries = Object.entries(stats.byCategory).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="space-y-8 pt-12 pb-16 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">
            Investigator / CID
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Investigation Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Overview of your assigned cases and investigation workload
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

      {/* SO Directive alert banner */}
      {stats.withDirective > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="font-semibold text-red-700 text-sm">
              {stats.withDirective} case
              {stats.withDirective !== 1 ? "s" : ""} require further action
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              The Station Officer has issued directives — review and continue
              investigations.
            </p>
          </div>
        </div>
      )}

      {/* ── Primary stats ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          My Caseload
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Assigned"
            value={stats.totalAssigned}
            sub={`${activeCases} active · ${stats.closedByMe} closed`}
            icon={<FileText className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-100"
          />
          <StatCard
            title="Awaiting Start"
            value={stats.awaitingStart}
            sub="Referred cases not yet started"
            icon={<Clock className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            title="Investigating"
            value={stats.investigating}
            sub="Actively under investigation"
            icon={<Microscope className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-100"
          />
          <StatCard
            title="SO Directives"
            value={stats.withDirective}
            sub="Cases returned for further work"
            icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
            iconBg="bg-red-100"
            highlight={stats.withDirective > 0}
          />
        </div>
      </section>

      {/* ── Secondary stats ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Workflow
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Submitted for Review"
            value={stats.submittedForReview}
            sub="At SO or Commander stage"
            icon={<ArrowUpRight className="h-5 w-5 text-violet-600" />}
            iconBg="bg-violet-100"
          />
          <StatCard
            title="Closed Cases"
            value={stats.closedByMe}
            sub="Successfully concluded"
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-100"
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
            title="Active Cases"
            value={activeCases}
            sub="In your investigation queue"
            icon={<Activity className="h-5 w-5 text-orange-600" />}
            iconBg="bg-orange-100"
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

        {/* By Stage */}
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
                  label: "Awaiting Start",
                  value: stats.awaitingStart,
                  color: "bg-sky-500",
                },
                {
                  label: "Investigating",
                  value: stats.investigating,
                  color: "bg-amber-500",
                },
                {
                  label: "Under Review",
                  value: stats.submittedForReview,
                  color: "bg-violet-500",
                },
                {
                  label: "Closed",
                  value: stats.closedByMe,
                  color: "bg-emerald-500",
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
                  <p className="text-xl font-bold text-amber-600">{count}</p>
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
            <Microscope className="h-5 w-5 text-amber-600" />
            Recent Assigned Cases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentCases.length > 0 ? (
              recentCases.map((c) => (
                <div
                  key={c._id}
                  className={`flex items-start justify-between p-3 rounded-lg transition-colors ${
                    (c as any).soDirective
                      ? "bg-red-50 border border-red-100"
                      : "bg-muted/40 hover:bg-muted/70"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{c.title}</p>
                      {(c as any).soDirective && (
                        <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                          <AlertTriangle size={8} /> Directive
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
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap ml-3 pt-0.5">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <Microscope className="h-8 w-8 opacity-30" />
                <p className="text-sm">No cases assigned to you yet</p>
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
                icon: <PlayCircle className="h-5 w-5" />,
                label: "Start Investigation",
                desc: `${stats.awaitingStart} pending`,
              },
              {
                icon: <MessageSquare className="h-5 w-5" />,
                label: "Send Progress",
                desc: "Update NCO",
              },
              {
                icon: <ArrowUpRight className="h-5 w-5" />,
                label: "Submit to SO",
                desc: `${stats.investigating} ready`,
              },
              {
                icon: <TrendingUp className="h-5 w-5" />,
                label: "My Cases",
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

export default CidDashboardPage;
