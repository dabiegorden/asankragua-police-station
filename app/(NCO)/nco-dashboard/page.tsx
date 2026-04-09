"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Users,
  Car,
  Shield,
  Clock,
  TrendingUp,
  MessageSquare,
  Loader2,
  Package,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import type { IDashboardStats } from "@/app/api/dashboard/stats/route";

// ─── Local types ──────────────────────────────────────────────────────────

interface RecentCase {
  _id: string;
  title: string;
  caseNumber: string;
  status: string;
  category: string;
  priority: string;
  createdAt: string;
}

interface RecentContact {
  _id: string;
  name: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800 border-emerald-200",
  referring: "bg-sky-100 text-sky-800 border-sky-200",
  investigating: "bg-amber-100 text-amber-800 border-amber-200",
  under_review: "bg-violet-100 text-violet-800 border-violet-200",
  commander_review: "bg-indigo-100 text-indigo-800 border-indigo-200",
  closed: "bg-slate-100 text-slate-700 border-slate-200",
  suspended: "bg-red-100 text-red-800 border-red-200",
  new: "bg-sky-100 text-sky-800 border-sky-200",
  "in-progress": "bg-amber-100 text-amber-800 border-amber-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-50 text-green-700 border-green-200",
  normal: "bg-blue-50 text-blue-700 border-blue-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  urgent: "bg-red-100 text-red-800 border-red-200",
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

// ─── Stat card component ──────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ title, value, sub, icon, iconBg }: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">
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

// ─── Default stats ────────────────────────────────────────────────────────

const DEFAULT_STATS: IDashboardStats = {
  totalUsers: 0,
  activeUsers: 0,
  inactiveUsers: 0,
  usersByRole: { admin: 0, nco: 0, cid: 0, so: 0, dc: 0 },
  totalCases: 0,
  activeCases: 0,
  closedCases: 0,
  suspendedCases: 0,
  casesByStage: { nco: 0, cid: 0, so: 0, dc: 0 },
  casesByPriority: { felony: 0, misdemeanour: 0, summaryOffence: 0 },
  totalPersonnel: 0,
  activePersonnel: 0,
  personnelOnLeave: 0,
  totalPrisoners: 0,
  jailedPrisoners: 0,
  bailedPrisoners: 0,
  remandedPrisoners: 0,
  totalVehicles: 0,
  availableVehicles: 0,
  vehiclesInUse: 0,
  vehiclesInMaintenance: 0,
  totalRifleBookings: 0,
  activeRifleBookings: 0,
  returnedRifleBookings: 0,
  overdueRifleBookings: 0,
  totalContacts: 0,
  newContacts: 0,
  inProgressContacts: 0,
  resolvedContacts: 0,
  urgentContacts: 0,
};

// ─── Dashboard component ──────────────────────────────────────────────────

const NcoDashboard = () => {
  const [stats, setStats] = useState<IDashboardStats>(DEFAULT_STATS);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [recentContacts, setRecentContacts] = useState<RecentContact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const token = getToken();
      const authHeaders: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [statsRes, casesRes, contactsRes] = await Promise.all([
        fetch("/api/dashboard/stats", { headers: authHeaders }),
        fetch("/api/cases?limit=5", { headers: authHeaders }),
        fetch("/api/contact?limit=5"),
      ]);

      if (statsRes.ok) {
        const { stats: fetchedStats }: { stats: IDashboardStats } =
          await statsRes.json();
        setStats(fetchedStats);
      } else {
        toast.error("Failed to load dashboard statistics");
      }

      if (casesRes.ok) {
        const { cases }: { cases: RecentCase[] } = await casesRes.json();
        setRecentCases(cases);
      }

      if (contactsRes.ok) {
        const { contacts }: { contacts: RecentContact[] } =
          await contactsRes.json();
        setRecentContacts(contacts);
      }
    } catch {
      toast.error("Failed to fetch dashboard data. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-12 pb-16 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time summary of station operations
          </p>
        </div>
        <Button
          onClick={() => fetchDashboardData(true)}
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

      {/* ── Primary stats: Cases & People ─────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Cases &amp; People
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Cases"
            value={stats.totalCases}
            sub={`${stats.activeCases} active · ${stats.closedCases} closed`}
            icon={<FileText className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            title="Personnel"
            value={stats.totalPersonnel}
            sub={`${stats.activePersonnel} active · ${stats.personnelOnLeave} on leave`}
            icon={<Users className="h-5 w-5 text-green-600" />}
            iconBg="bg-green-100"
          />
          <StatCard
            title="Prisoners"
            value={stats.totalPrisoners}
            sub={`${stats.jailedPrisoners} jailed · ${stats.remandedPrisoners} remanded`}
            icon={<Shield className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-100"
          />
          <StatCard
            title="Vehicles"
            value={stats.totalVehicles}
            sub={`${stats.availableVehicles} available · ${stats.vehiclesInUse} in use`}
            icon={<Car className="h-5 w-5 text-purple-600" />}
            iconBg="bg-purple-100"
          />
        </div>
      </section>

      {/* ── Secondary stats ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Operations
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Rifle Bookings"
            value={stats.totalRifleBookings}
            sub={`${stats.activeRifleBookings} active · ${stats.overdueRifleBookings} overdue`}
            icon={<Package className="h-5 w-5 text-indigo-600" />}
            iconBg="bg-indigo-100"
          />
          <StatCard
            title="Active Cases"
            value={stats.activeCases}
            sub={`${stats.suspendedCases} suspended`}
            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-100"
          />
          <StatCard
            title="Contact Messages"
            value={stats.totalContacts}
            sub={`${stats.newContacts} new · ${stats.urgentContacts} urgent`}
            icon={<MessageSquare className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-100"
          />
          <StatCard
            title="System Users"
            value={stats.totalUsers}
            sub={`${stats.activeUsers} active · ${stats.inactiveUsers} inactive`}
            icon={<UserCheck className="h-5 w-5 text-cyan-600" />}
            iconBg="bg-cyan-100"
          />
        </div>
      </section>

      {/* ── Case breakdown ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Stage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Cases by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(
                [
                  { label: "NCO", key: "nco", color: "bg-sky-500" },
                  { label: "CID", key: "cid", color: "bg-amber-500" },
                  {
                    label: "Station Officer",
                    key: "so",
                    color: "bg-violet-500",
                  },
                  {
                    label: "District Commander",
                    key: "dc",
                    color: "bg-rose-500",
                  },
                ] as {
                  label: string;
                  key: keyof IDashboardStats["casesByStage"];
                  color: string;
                }[]
              ).map(({ label, key, color }) => {
                const count = stats.casesByStage[key];
                const pct =
                  stats.totalCases > 0 ? (count / stats.totalCases) * 100 : 0;
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
              {(
                [
                  { label: "Felony", key: "felony", color: "bg-red-500" },
                  {
                    label: "Misdemeanour",
                    key: "misdemeanour",
                    color: "bg-orange-400",
                  },
                  {
                    label: "Summary Offence",
                    key: "summaryOffence",
                    color: "bg-blue-400",
                  },
                ] as {
                  label: string;
                  key: keyof IDashboardStats["casesByPriority"];
                  color: string;
                }[]
              ).map(({ label, key, color }) => {
                const count = stats.casesByPriority[key];
                const pct =
                  stats.totalCases > 0 ? (count / stats.totalCases) * 100 : 0;
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
      </section>

      {/* ── Recent activity ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Cases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCases.length > 0 ? (
                recentCases.map((caseItem) => (
                  <div
                    key={caseItem._id}
                    className="flex items-start justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {caseItem.title}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {caseItem.caseNumber}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <Badge
                          className={`text-[10px] border ${getStatusColor(caseItem.status)}`}
                          variant="outline"
                        >
                          {caseItem.status}
                        </Badge>
                        <Badge
                          className={`text-[10px] border ${getPriorityColor(caseItem.priority)}`}
                          variant="outline"
                        >
                          {caseItem.priority}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {caseItem.category}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap ml-3 pt-0.5">
                      {new Date(caseItem.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                  <FileText className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No recent cases</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Recent Contact Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentContacts.length > 0 ? (
                recentContacts.map((contact) => (
                  <div
                    key={contact._id}
                    className="flex items-start justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                        {contact.subject}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <Badge
                          className={`text-[10px] border ${getStatusColor(contact.status)}`}
                          variant="outline"
                        >
                          {contact.status}
                        </Badge>
                        <Badge
                          className={`text-[10px] border ${getPriorityColor(contact.priority)}`}
                          variant="outline"
                        >
                          {contact.priority}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap ml-3 pt-0.5">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                  <MessageSquare className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No recent messages</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: <FileText className="h-5 w-5" />, label: "New Case" },
              { icon: <Users className="h-5 w-5" />, label: "Add Personnel" },
              { icon: <Car className="h-5 w-5" />, label: "Add Vehicle" },
              { icon: <Package className="h-5 w-5" />, label: "Rifle Booking" },
            ].map(({ icon, label }) => (
              <Button
                key={label}
                variant="outline"
                className="h-20 flex flex-col gap-2 bg-transparent hover:bg-muted/50 transition-colors"
              >
                {icon}
                <span className="text-xs font-medium">{label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NcoDashboard;
