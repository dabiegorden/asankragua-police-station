// src/app/api/reports/generate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import Personnel from "@/models/Personnel";
import RifleBooking from "@/models/RifleBooking";
import { verifyToken } from "@/lib/jwt";

// ─── Types ─────────────────────────────────────────────────────────────────

export type ReportType =
  | "cases"
  | "personnel"
  | "incidents"
  | "performance"
  | "rifle-bookings";

interface DateRange {
  from: string;
  to: string;
}

interface GenerateReportBody {
  type: ReportType;
  dateRange: DateRange;
}

interface AggregateMonthResult {
  _id: { year: number; month: number };
  count: number;
}

interface AggregateGroupResult {
  _id: string | null;
  count: number;
}

interface ReportSummary {
  total: number;
  active: number;
  pending: number;
  completed: number;
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

// ─── Aggregate helpers ──────────────────────────────────────────────────────

async function getCasesByMonth(
  from: string,
  to: string,
): Promise<AggregateMonthResult[]> {
  return Case.aggregate<AggregateMonthResult>([
    { $match: { createdAt: { $gte: new Date(from), $lte: new Date(to) } } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);
}

async function getCasesByCategory(
  from: string,
  to: string,
): Promise<AggregateGroupResult[]> {
  return Case.aggregate<AggregateGroupResult>([
    { $match: { createdAt: { $gte: new Date(from), $lte: new Date(to) } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
}

async function getCasesByStatus(
  from: string,
  to: string,
): Promise<AggregateGroupResult[]> {
  return Case.aggregate<AggregateGroupResult>([
    { $match: { createdAt: { $gte: new Date(from), $lte: new Date(to) } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
}

async function getRifleBookingsByType(
  from: string,
  to: string,
): Promise<AggregateGroupResult[]> {
  return RifleBooking.aggregate<AggregateGroupResult>([
    { $match: { createdAt: { $gte: new Date(from), $lte: new Date(to) } } },
    { $group: { _id: "$typeOfRifle", count: { $sum: 1 } } },
  ]);
}

async function getRifleBookingsByStatus(
  from: string,
  to: string,
): Promise<AggregateGroupResult[]> {
  return RifleBooking.aggregate<AggregateGroupResult>([
    { $match: { createdAt: { $gte: new Date(from), $lte: new Date(to) } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
}

async function getRifleBookingsByMonth(
  from: string,
  to: string,
): Promise<AggregateMonthResult[]> {
  return RifleBooking.aggregate<AggregateMonthResult>([
    { $match: { createdAt: { $gte: new Date(from), $lte: new Date(to) } } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);
}

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectDB();

    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body: GenerateReportBody = await request.json();
    const { type, dateRange } = body;
    const { from, to } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: new Date(from),
        $lte: new Date(to),
      },
    };

    switch (type) {
      case "cases": {
        const cases = await Case.find(dateFilter).lean();
        const [monthly, byType, byStatus] = await Promise.all([
          getCasesByMonth(from, to),
          getCasesByCategory(from, to),
          getCasesByStatus(from, to),
        ]);

        const summary: ReportSummary = {
          total: cases.length,
          active: cases.filter(
            (c) => c.status === "open" || c.status === "investigating",
          ).length,
          pending: cases.filter((c) => c.status === "referred").length,
          completed: cases.filter((c) => c.status === "closed").length,
        };

        const charts: CaseCharts = { monthly, byType, byStatus };
        return NextResponse.json({ summary, data: cases, charts });
      }

      case "personnel": {
        const personnel = await Personnel.find(dateFilter).lean();

        const summary: ReportSummary = {
          total: personnel.length,
          active: personnel.filter((p) => p.status === "active").length,
          pending: personnel.filter((p) => p.status === "on-leave").length,
          completed: personnel.filter(
            (p) => p.status === "retired" || p.status === "suspended",
          ).length,
        };

        return NextResponse.json({ summary, data: personnel });
      }

      case "incidents": {
        const incidentCategories = ["assault", "theft", "domestic", "other"];
        const incidents = await Case.find({
          ...dateFilter,
          category: { $in: incidentCategories },
        }).lean();

        const summary: ReportSummary = {
          total: incidents.length,
          active: incidents.filter((i) => i.status === "open").length,
          pending: incidents.filter((i) => i.status === "investigating").length,
          completed: incidents.filter((i) => i.status === "closed").length,
        };

        return NextResponse.json({ summary, data: incidents });
      }

      case "performance": {
        const [allCases, activePersonnel] = await Promise.all([
          Case.find(dateFilter).lean(),
          Personnel.find({ status: "active" }).lean(),
        ]);

        const summary: ReportSummary = {
          total: allCases.length,
          active: activePersonnel.length,
          pending: allCases.filter((c) => c.status === "investigating").length,
          completed: allCases.filter((c) => c.status === "closed").length,
        };

        return NextResponse.json({
          summary,
          data: { cases: allCases, personnel: activePersonnel },
        });
      }

      case "rifle-bookings": {
        const rifleBookings = await RifleBooking.find(dateFilter).lean();
        const [byRifleType, byStatus, monthly] = await Promise.all([
          getRifleBookingsByType(from, to),
          getRifleBookingsByStatus(from, to),
          getRifleBookingsByMonth(from, to),
        ]);

        const summary: ReportSummary = {
          total: rifleBookings.length,
          active: rifleBookings.filter((r) => r.status === "active").length,
          pending: rifleBookings.filter((r) => r.status === "overdue").length,
          completed: rifleBookings.filter((r) => r.status === "returned")
            .length,
        };

        const charts: RifleCharts = { byRifleType, byStatus, monthly };
        return NextResponse.json({ summary, data: rifleBookings, charts });
      }

      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("[reports/generate]", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
