"use client";
import { useState } from "react";
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
import { toast } from "sonner";
import {
  FileText,
  Download,
  BarChart3,
  TrendingUp,
  Users,
  Package,
} from "lucide-react";

const Reports = () => {
  const [reportType, setReportType] = useState("");
  const [dateRange, setDateRange] = useState({
    from: "",
    to: "",
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const reportTypes = [
    { value: "cases", label: "Cases Report", icon: FileText },
    { value: "personnel", label: "Personnel Report", icon: Users },
    { value: "incidents", label: "Incidents Report", icon: TrendingUp },
    { value: "performance", label: "Performance Report", icon: BarChart3 },
    { value: "rifle-bookings", label: "Rifle Bookings Report", icon: Package },
  ];

  const getToken = () => localStorage.getItem("token");

  const generateReport = async () => {
    if (!reportType || !dateRange.from || !dateRange.to) {
      toast.error("Please select report type and date range");
      return;
    }

    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: reportType,
          dateRange,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[v0] Report data received:", data);
        setReportData(data);
        toast.success("Report generated successfully");
      } else {
        toast.error("Failed to generate report");
      }
    } catch (error) {
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!reportType || !dateRange.from || !dateRange.to) {
      toast.error("Please generate a report first");
      return;
    }

    try {
      const token = getToken();
      const response = await fetch("/api/reports/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: reportType,
          dateRange,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `${reportType}-report-${
          new Date().toISOString().split("T")[0]
        }.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("Report downloaded successfully");
      } else {
        toast.error("Failed to download report");
      }
    } catch (error) {
      toast.error("Failed to download report");
    }
  };

  const renderSummaryCards = () => {
    if (!reportData || !reportData.summary) return null;

    const { summary } = reportData;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {summary.active}
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {summary.pending}
                </p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-600">
                  {summary.completed}
                </p>
              </div>
              <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderReportTable = () => {
    if (!reportData || !reportData.data) return null;

    const data = Array.isArray(reportData.data) ? reportData.data : [];

    if (data.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">
              No data available for the selected period
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Report Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {reportType === "cases" && (
                    <>
                      <th className="text-left p-2">Case Number</th>
                      <th className="text-left p-2">Title</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-left p-2">Date Created</th>
                    </>
                  )}
                  {reportType === "personnel" && (
                    <>
                      <th className="text-left p-2">Employee ID</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Rank</th>
                      <th className="text-left p-2">Specialization</th>
                      <th className="text-left p-2">Status</th>
                    </>
                  )}
                  {(reportType === "incidents" ||
                    reportType === "performance") && (
                    <>
                      <th className="text-left p-2">ID</th>
                      <th className="text-left p-2">Title</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Date</th>
                    </>
                  )}
                  {reportType === "rifle-bookings" && (
                    <>
                      <th className="text-left p-2">Booking Number</th>
                      <th className="text-left p-2">Personnel</th>
                      <th className="text-left p-2">Rifle Type</th>
                      <th className="text-left p-2">Serial Number</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Booking Date</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 50).map((item, index) => (
                  <tr
                    key={item._id || index}
                    className="border-b hover:bg-gray-50"
                  >
                    {reportType === "cases" && (
                      <>
                        <td className="p-2 font-mono text-sm">
                          {item.caseNumber}
                        </td>
                        <td className="p-2">{item.title}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              item.status === "open"
                                ? "bg-green-100 text-green-800"
                                : item.status === "investigating"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : item.status === "closed"
                                    ? "bg-gray-100 text-gray-800"
                                    : "bg-red-100 text-red-800"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-2">{item.category}</td>
                        <td className="p-2">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                      </>
                    )}
                    {reportType === "personnel" && (
                      <>
                        <td className="p-2 font-mono text-sm">
                          {item.employeeId}
                        </td>
                        <td className="p-2">
                          {item.user
                            ? `${item.user.firstName} ${item.user.lastName}`
                            : "N/A"}
                        </td>
                        <td className="p-2">{item.rank}</td>
                        <td className="p-2">{item.specialization}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              item.status === "active"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </>
                    )}
                    {(reportType === "incidents" ||
                      reportType === "performance") && (
                      <>
                        <td className="p-2 font-mono text-sm">{item._id}</td>
                        <td className="p-2">{item.title || "N/A"}</td>
                        <td className="p-2">{item.status || "N/A"}</td>
                        <td className="p-2">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                      </>
                    )}
                    {reportType === "rifle-bookings" && (
                      <>
                        <td className="p-2 font-mono text-sm">
                          {item.bookingNumber}
                        </td>
                        <td className="p-2">{item.nameOfPersonnel}</td>
                        <td className="p-2">{item.typeOfRifle}</td>
                        <td className="p-2">{item.serialNumber}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              item.status === "active"
                                ? "bg-green-100 text-green-800"
                                : item.status === "overdue"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-2">
                          {new Date(item.dateOfBooking).toLocaleDateString()}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 50 && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                Showing first 50 records. Download PDF for complete report.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 pt-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Reports</h1>
      </div>

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center space-x-2">
                        <type.icon className="w-4 h-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange({ ...dateRange, from: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange({ ...dateRange, to: e.target.value })
                }
              />
            </div>

            <div className="flex items-end space-x-2">
              <Button
                onClick={generateReport}
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Generating..." : "Generate Report"}
              </Button>
              <Button
                variant="outline"
                onClick={downloadPDF}
                disabled={!reportData}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {reportData && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              {reportTypes.find((t) => t.value === reportType)?.label}
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({new Date(dateRange.from).toLocaleDateString()} -{" "}
                {new Date(dateRange.to).toLocaleDateString()})
              </span>
            </h2>
            <Button onClick={downloadPDF} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>

          {renderSummaryCards()}
          {renderReportTable()}

          {/* Charts for cases report */}
          {reportType === "cases" && reportData.charts && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Monthly Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reportData.charts.monthly?.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm">
                          {item._id.month}/{item._id.year}
                        </span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">By Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reportData.charts.byType?.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm capitalize">{item._id}</span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">By Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reportData.charts.byStatus?.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm capitalize">{item._id}</span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts for rifle bookings report */}
          {reportType === "rifle-bookings" && reportData.charts && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Monthly Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reportData.charts.monthly?.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm">
                          {item._id.month}/{item._id.year}
                        </span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">By Rifle Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reportData.charts.byRifleType?.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm capitalize">{item._id}</span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">By Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reportData.charts.byStatus?.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm capitalize">{item._id}</span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
