// src/app/api/duty-roster/route.ts
// Duty Roster — list (GET) and create (POST)
//
// RBAC (mirrors User model roles: admin | nco | so | dc):
//   nco / so → own station only (stationId match, never overrideable)
//   dc        → can see ALL stations; honours ?stationId= filter if supplied
//   admin     → all stations unless ?stationId= is supplied
//
// Status flow: draft → published (final). No approval step.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole } from "@/middleware/auth";
import DutyRoster from "@/models/Dutyroster";
import { saveWithUniqueNumber } from "@/lib/sequence";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;

function populateRoster(
  query:
    | ReturnType<typeof DutyRoster.find>
    | ReturnType<typeof DutyRoster.findById>,
) {
  return (query as any)
    .populate("createdBy", "fullName email role stationId")
    .populate("entries.officerUserId", "fullName role");
}

// ─── GET /api/duty-roster ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { user, error } = requireRole(req, [...ALLOWED_ROLES]);
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const stationIdParam = searchParams.get("stationId") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";

    const filter: Record<string, unknown> = {};

    // ── Role-based station scoping ──────────────────────────────────────────
    // nco and so are hard-locked to their own station — no override possible.
    // dc sees all stations by default but can filter to one via ?stationId=.
    // admin sees all stations unless a ?stationId= filter is provided.
    switch (user.role) {
      case "nco":
      case "so": {
        if (!user.stationId) {
          return NextResponse.json({
            rosters: [],
            pagination: { page, limit, total: 0, pages: 0 },
          });
        }
        // Hard-lock: ignore any stationId query param entirely
        filter.stationId = user.stationId.toLowerCase();
        break;
      }

      case "dc": {
        // DC can see every station; optionally filter to one
        if (stationIdParam) {
          filter.stationId = stationIdParam.toLowerCase();
        }
        // No stationId param → no station filter → sees all stations
        break;
      }

      case "admin": {
        // Station admin is locked to its own station; super admin may filter.
        if (user.stationId) {
          filter.stationId = user.stationId.toLowerCase();
        } else if (stationIdParam) {
          filter.stationId = stationIdParam.toLowerCase();
        }
        break;
      }
    }

    if (status && status !== "all") filter.status = status;

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        dateFilter.$lte = to;
      }
      filter.startDate = dateFilter;
    }

    if (search) {
      filter.$or = [
        { rosterNumber: { $regex: search, $options: "i" } },
        { stationId: { $regex: search, $options: "i" } },
        { districtCommander: { $regex: search, $options: "i" } },
        { stationOfficer: { $regex: search, $options: "i" } },
        { referenceNumber: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [rosters, total] = await Promise.all([
      populateRoster(
        DutyRoster.find(filter).sort({ startDate: -1, createdAt: -1 }),
      )
        .skip(skip)
        .limit(limit),
      DutyRoster.countDocuments(filter),
    ]);

    return NextResponse.json({
      rosters,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("GET /duty-roster error:", err);
    return NextResponse.json(
      { error: "Failed to fetch duty rosters" },
      { status: 500 },
    );
  }
}

// ─── POST /api/duty-roster ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, error } = requireRole(req, [...ALLOWED_ROLES]);
  if (error) return error;

  try {
    await connectDB();

    const body = await req.json();
    const {
      stationId,
      referenceNumber,
      districtCommander,
      stationOfficer,
      startDate,
      endDate,
      entries,
      generalRemarks,
      status,
    } = body;

    if (!stationId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "stationId, startDate, and endDate are required" },
        { status: 400 },
      );
    }

    // ── Station guard: nco / so / station-admin locked to own station ─────
    if (
      (user.role === "nco" || user.role === "so" || user.role === "admin") &&
      user.stationId &&
      stationId.toLowerCase() !== user.stationId.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "You can only create rosters for your own station" },
        { status: 403 },
      );
    }

    // ── dc can create for any station (no restriction needed) ─────────────

    const normalisedEntries = (entries || []).map(
      (e: Record<string, unknown>, idx: number) => ({
        ...e,
        serialNumber: idx + 1,
      }),
    );

    const newRoster = new DutyRoster({
      stationId: stationId.toLowerCase(),
      referenceNumber: referenceNumber || "",
      districtCommander: districtCommander || "",
      stationOfficer: stationOfficer || "",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      entries: normalisedEntries,
      generalRemarks: generalRemarks || "",
      // Only allow draft or published on creation; archived is not valid here
      status: status === "published" || status === "draft" ? status : "draft",
      createdBy: user.userId,
    });

    await saveWithUniqueNumber(newRoster, "rosterNumber", "DR");

    const populated = await populateRoster(DutyRoster.findById(newRoster._id));

    return NextResponse.json(
      { message: "Duty roster created successfully", roster: populated },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /duty-roster error:", err);
    return NextResponse.json(
      { error: "Failed to create duty roster" },
      { status: 500 },
    );
  }
}
