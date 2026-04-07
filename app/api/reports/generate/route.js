import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/utils/jwt";
import Case from "@/models/Case";
import Personnel from "@/models/Personnel";
import RifleBooking from "@/models/RifleBooking";

export async function POST(request) {
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

    const { type, dateRange } = await request.json();
    const { from, to } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: new Date(from),
        $lte: new Date(to),
      },
    };

    let reportData = {};

    console.log("[v0] Generating report:", { type, from, to });

    switch (type) {
      case "cases":
        const cases = await Case.find(dateFilter);
        reportData = {
          summary: {
            total: cases.length,
            active: cases.filter(
              (c) => c.status === "open" || c.status === "investigating",
            ).length,
            pending: cases.filter((c) => c.status === "pending").length,
            completed: cases.filter((c) => c.status === "closed").length,
          },
          data: cases,
          charts: {
            monthly: await getCasesByMonth(from, to),
            byType: await getCasesByType(from, to),
            byStatus: await getCasesByStatus(from, to),
          },
        };
        break;

      case "personnel":
        const personnel = await Personnel.find(dateFilter);
        reportData = {
          summary: {
            total: personnel.length,
            active: personnel.filter((p) => p.status === "active").length,
            pending: personnel.filter((p) => p.status === "pending").length,
            completed: personnel.filter((p) => p.status === "inactive").length,
          },
          data: personnel,
        };
        break;

      case "incidents":
        const incidents = await Case.find({
          ...dateFilter,
          type: { $in: ["assault", "theft", "vandalism", "disturbance"] },
        });
        reportData = {
          summary: {
            total: incidents.length,
            active: incidents.filter((i) => i.status === "open").length,
            pending: incidents.filter((i) => i.status === "investigating")
              .length,
            completed: incidents.filter((i) => i.status === "closed").length,
          },
          data: incidents,
        };
        break;

      case "performance":
        const allCases = await Case.find(dateFilter);
        const allPersonnel = await Personnel.find({ status: "active" });
        reportData = {
          summary: {
            total: allCases.length,
            active: allPersonnel.length,
            pending: allCases.filter((c) => c.status === "investigating")
              .length,
            completed: allCases.filter((c) => c.status === "closed").length,
          },
          data: {
            cases: allCases,
            personnel: allPersonnel,
          },
        };
        break;

      case "rifle-bookings":
        const rifleBookings = await RifleBooking.find(dateFilter);
        reportData = {
          summary: {
            total: rifleBookings.length,
            active: rifleBookings.filter((r) => r.status === "active").length,
            pending: rifleBookings.filter((r) => r.status === "overdue").length,
            completed: rifleBookings.filter((r) => r.status === "returned")
              .length,
          },
          data: rifleBookings,
          charts: {
            byRifleType: await getRifleBookingsByType(from, to),
            byStatus: await getRifleBookingsByStatus(from, to),
            monthly: await getRifleBookingsByMonth(from, to),
          },
        };
        break;

      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 },
        );
    }

    console.log("[v0] Report generated successfully:", {
      type,
      totalRecords: reportData.summary?.total || 0,
    });

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}

async function getCasesByMonth(from, to) {
  const cases = await Case.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);
  return cases;
}

async function getCasesByType(from, to) {
  const cases = await Case.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]);
  return cases;
}

async function getCasesByStatus(from, to) {
  const cases = await Case.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
  return cases;
}

async function getRifleBookingsByType(from, to) {
  const bookings = await RifleBooking.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: "$typeOfRifle",
        count: { $sum: 1 },
      },
    },
  ]);
  return bookings;
}

async function getRifleBookingsByStatus(from, to) {
  const bookings = await RifleBooking.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
  return bookings;
}

async function getRifleBookingsByMonth(from, to) {
  const bookings = await RifleBooking.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);
  return bookings;
}
