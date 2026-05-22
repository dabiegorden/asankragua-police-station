"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText,
  Download,
  BarChart3,
  TrendingUp,
  Users,
  Package,
  Loader2,
} from "lucide-react";
import type { ReportType } from "@/app/api/reports/generate/route";

// ─── Local types ──────────────────────────────────────────────────────────

interface DateRange {
  from: string;
  to: string;
}

interface ReportSummary {
  total: number;
  active: number;
  pending: number;
  completed: number;
}

interface AggregateMonthResult {
  _id: { year: number; month: number };
  count: number;
}

interface AggregateGroupResult {
  _id: string | null;
  count: number;
}

interface CaseCharts {
  monthly: AggregateMonthResult[];
  byType: AggregateGroupResult[];
  byStatus: AggregateGroupResult[];
}

interface RifleCharts {
  byRifleType: AggregateGroupResult[];
  byStatus: AggregateGroupResult[];
  monthly: AggregateMonthResult[];
}

// Lean Mongoose documents come back as plain objects
type DataRecord = Record<string, unknown>;

interface ReportData {
  summary: ReportSummary;
  data: DataRecord[] | { cases: DataRecord[]; personnel: DataRecord[] };
  charts?: CaseCharts | RifleCharts;
}

// ─── Static config ────────────────────────────────────────────────────────

interface ReportTypeConfig {
  value: ReportType;
  label: string;
  Icon: React.ElementType;
}

const REPORT_TYPES: ReportTypeConfig[] = [
  { value: "cases", label: "Cases Report", Icon: FileText },
  { value: "personnel", label: "Personnel Report", Icon: Users },
  { value: "incidents", label: "Incidents Report", Icon: TrendingUp },
  { value: "performance", label: "Performance Report", Icon: BarChart3 },
  { value: "rifle-bookings", label: "Rifle Bookings Report", Icon: Package },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function str(val: unknown): string {
  return typeof val === "string" ? val : "N/A";
}

function fmtDate(val: unknown): string {
  if (!val) return "N/A";
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
}

// ─── Sub-components ───────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: number;
  colorClass: string;
  Icon: React.ElementType;
  iconBg: string;
}

function SummaryCard({
  label,
  value,
  colorClass,
  Icon,
  iconBg,
}: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
          </div>
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconBg}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ChartRowProps {
  label: string;
  count: number;
  total: number;
}

function ChartRow({ label, count, total }: ChartRowProps) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="capitalize">{label ?? "Unknown"}</span>
        <span className="font-medium text-foreground">{count}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Status badge helper ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800",
  investigating: "bg-amber-100 text-amber-800",
  closed: "bg-slate-100 text-slate-700",
  suspended: "bg-red-100 text-red-800",
  active: "bg-emerald-100 text-emerald-800",
  returned: "bg-slate-100 text-slate-700",
  overdue: "bg-red-100 text-red-800",
  "on-leave": "bg-amber-100 text-amber-800",
  retired: "bg-slate-100 text-slate-600",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

const Reports = () => {
  const [reportType, setReportType] = useState<ReportType | "">("");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // ── Generate ────────────────────────────────────────────────────────────

  const generateReport = useCallback(async () => {
    if (!reportType || !dateRange.from || !dateRange.to) {
      toast.error("Please select a report type and date range");
      return;
    }

    setGenerating(true);
    try {
      const token = getToken();
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: reportType, dateRange }),
      });

      if (!res.ok) {
        toast.error("Failed to generate report");
        return;
      }

      const data: ReportData = await res.json();
      setReportData(data);
      toast.success("Report generated successfully");
    } catch {
      toast.error("Failed to generate report. Check your connection.");
    } finally {
      setGenerating(false);
    }
  }, [reportType, dateRange]);

  // ── Download ────────────────────────────────────────────────────────────

  const downloadPDF = useCallback(async () => {
    if (!reportType || !dateRange.from || !dateRange.to) {
      toast.error("Please generate a report first");
      return;
    }

    setDownloading(true);
    try {
      const token = getToken();
      const res = await fetch("/api/reports/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: reportType, dateRange }),
      });

      if (!res.ok) {
        toast.error("Failed to download report");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${reportType}-report-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
      toast.success("Report downloaded successfully");
    } catch {
      toast.error("Failed to download report. Check your connection.");
    } finally {
      setDownloading(false);
    }
  }, [reportType, dateRange]);

  // ── Derived data ────────────────────────────────────────────────────────

  const flatData: DataRecord[] = reportData
    ? Array.isArray(reportData.data)
      ? reportData.data
      : ((reportData.data as { cases: DataRecord[] }).cases ?? [])
    : [];

  const caseCharts =
    reportData?.charts && "byType" in reportData.charts
      ? (reportData.charts as CaseCharts)
      : null;

  const rifleCharts =
    reportData?.charts && "byRifleType" in reportData.charts
      ? (reportData.charts as RifleCharts)
      : null;

  const selectedConfig = REPORT_TYPES.find((t) => t.value === reportType);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pt-12 pb-16 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate and download operational reports
          </p>
        </div>
        {reportData && (
          <Button
            onClick={downloadPDF}
            disabled={downloading}
            variant="outline"
            className="gap-2 w-fit"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading ? "Downloading…" : "Download PDF"}
          </Button>
        )}
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="reportType">Report Type</Label>
              <Select
                value={reportType}
                onValueChange={(v) => {
                  setReportType(v as ReportType);
                  setReportData(null);
                }}
              >
                <SelectTrigger id="reportType">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(({ value, label, Icon }) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, from: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, to: e.target.value }))
                }
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={generateReport}
                disabled={generating}
                className="flex-1 gap-2"
              >
                {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                {generating ? "Generating…" : "Generate"}
              </Button>
              <Button
                variant="outline"
                onClick={downloadPDF}
                disabled={!reportData || downloading}
                title="Download PDF"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {reportData && (
        <div className="space-y-6">
          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">
              {selectedConfig?.label}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({new Date(dateRange.from).toLocaleDateString()} –{" "}
                {new Date(dateRange.to).toLocaleDateString()})
              </span>
            </h2>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Total"
              value={reportData.summary.total}
              colorClass="text-foreground"
              Icon={FileText}
              iconBg="bg-blue-100 text-blue-600"
            />
            <SummaryCard
              label="Active"
              value={reportData.summary.active}
              colorClass="text-emerald-600"
              Icon={TrendingUp}
              iconBg="bg-emerald-100 text-emerald-600"
            />
            <SummaryCard
              label="Pending / Overdue"
              value={reportData.summary.pending}
              colorClass="text-amber-600"
              Icon={BarChart3}
              iconBg="bg-amber-100 text-amber-600"
            />
            <SummaryCard
              label="Completed"
              value={reportData.summary.completed}
              colorClass="text-muted-foreground"
              Icon={Users}
              iconBg="bg-slate-100 text-slate-600"
            />
          </div>

          {/* Chart breakdowns */}
          {(caseCharts || rifleCharts) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Monthly */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Monthly Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(caseCharts?.monthly ?? rifleCharts?.monthly ?? []).map(
                    (item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item._id.month}/{item._id.year}
                        </span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ),
                  )}
                </CardContent>
              </Card>

              {/* By type/category */}
              {caseCharts && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">By Category</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {caseCharts.byType.map((item, i) => (
                      <ChartRow
                        key={i}
                        label={item._id ?? "Unknown"}
                        count={item.count}
                        total={reportData.summary.total}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {rifleCharts && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">By Rifle Type</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {rifleCharts.byRifleType.map((item, i) => (
                      <ChartRow
                        key={i}
                        label={item._id ?? "Unknown"}
                        count={item.count}
                        total={reportData.summary.total}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* By status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">By Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(caseCharts?.byStatus ?? rifleCharts?.byStatus ?? []).map(
                    (item, i) => (
                      <ChartRow
                        key={i}
                        label={item._id ?? "Unknown"}
                        count={item.count}
                        total={reportData.summary.total}
                      />
                    ),
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Data table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Report Data</span>
                {flatData.length > 50 && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    Showing first 50 of {flatData.length} records
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {flatData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <FileText className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No data for the selected period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        {reportType === "cases" ||
                        reportType === "incidents" ||
                        reportType === "performance" ? (
                          <>
                            <th className="text-left py-2 px-3 font-medium">
                              Case #
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Title
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Status
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Category
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Priority
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Date
                            </th>
                          </>
                        ) : reportType === "personnel" ? (
                          <>
                            <th className="text-left py-2 px-3 font-medium">
                              Name
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Badge
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Rank
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Specialization
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Shift
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Status
                            </th>
                          </>
                        ) : (
                          <>
                            <th className="text-left py-2 px-3 font-medium">
                              Booking #
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Personnel
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Rifle Type
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Serial #
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Duty
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Status
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Date
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {flatData.slice(0, 50).map((item, index) => (
                        <tr
                          key={(item._id as string) ?? index}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          {(reportType === "cases" ||
                            reportType === "incidents" ||
                            reportType === "performance") && (
                            <>
                              <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                                {str(item.caseNumber)}
                              </td>
                              <td className="py-2 px-3 max-w-50 truncate">
                                {str(item.title)}
                              </td>
                              <td className="py-2 px-3">
                                <StatusBadge status={str(item.status)} />
                              </td>
                              <td className="py-2 px-3 capitalize">
                                {str(item.category)}
                              </td>
                              <td className="py-2 px-3">
                                {str(item.priority)}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">
                                {fmtDate(item.createdAt)}
                              </td>
                            </>
                          )}

                          {reportType === "personnel" && (
                            <>
                              <td className="py-2 px-3 font-medium">
                                {str(item.firstName)} {str(item.lastName)}
                              </td>
                              <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                                {str(item.badgeNumber)}
                              </td>
                              <td className="py-2 px-3">{str(item.rank)}</td>
                              <td className="py-2 px-3">
                                {str(item.specialization)}
                              </td>
                              <td className="py-2 px-3 capitalize">
                                {str(item.shift)}
                              </td>
                              <td className="py-2 px-3">
                                <StatusBadge status={str(item.status)} />
                              </td>
                            </>
                          )}

                          {reportType === "rifle-bookings" && (
                            <>
                              <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                                {str(item.bookingNumber)}
                              </td>
                              <td className="py-2 px-3">
                                {str(item.nameOfPersonnel)}
                              </td>
                              <td className="py-2 px-3">
                                {str(item.typeOfRifle)}
                              </td>
                              <td className="py-2 px-3 font-mono text-xs">
                                {str(item.serialNumber)}
                              </td>
                              <td className="py-2 px-3">
                                {str(item.typeOfDuty)}
                              </td>
                              <td className="py-2 px-3">
                                <StatusBadge status={str(item.status)} />
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">
                                {fmtDate(item.dateOfBooking)}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Reports;
