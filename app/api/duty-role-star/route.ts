// src/app/api/duty-role-star/route.ts
// Duty Role Star — list (GET) and create (POST)
// Station scoping mirrors the Cases module exactly:
//   nco  → own station only (stationId match)
//   so   → own station only (stationId match)
//   dc   → defaults to own station; honours ?stationId= override
//   admin → all stations unless ?stationId= is supplied

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import DutyRoleStar from "@/models/DutyRoleStar";
import User from "@/models/User";
import { requireRole } from "@/middleware/auth";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;

// ─── Shared populate helper ────────────────────────────────────────────────

function populateStar(
  query:
    | ReturnType<typeof DutyRoleStar.find>
    | ReturnType<typeof DutyRoleStar.findById>,
) {
  return (query as any)
    .populate("createdBy", "fullName email role stationId")
    .populate("approvedBy", "fullName email role")
    .populate("starOfficerUserId", "fullName role")
    .populate("commandingOfficerUserId", "fullName role")
    .populate("entries.officerUserId", "fullName role");
}

/**
 * Returns all User _id strings that belong to a given station.
 * Used when we need to scope by users at a station (kept for parity
 * even though duty stars are scoped directly by stationId string).
 */
async function getStationUserIds(stationId: string): Promise<string[]> {
  const users = await User.find({ stationId }).select("_id").lean();
  return users.map((u) => u._id.toString());
}

// ─── GET /api/duty-role-star ───────────────────────────────────────────────

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
    const shift = searchParams.get("shift") || "";
    const stationIdParam = searchParams.get("stationId") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";

    const filter: Record<string, unknown> = {};

    // ── Role-based station scoping (mirrors Cases GET exactly) ─────────────

    switch (user.role) {
      case "nco":
      case "so": {
        // NCO and SO see only their own station — hard scoped, no override
        if (!user.stationId) {
          return NextResponse.json({
            stars: [],
            pagination: { page, limit, total: 0, pages: 0 },
          });
        }
        filter.stationId = user.stationId.toLowerCase();
        break;
      }

      case "dc": {
        // DC defaults to their own station; a ?stationId= param lets them
        // view another station (same pattern as the Cases module)
        const targetStation = stationIdParam || user.stationId || null;
        if (!targetStation) {
          // DC has no stationId at all — return empty rather than leaking all
          return NextResponse.json({
            stars: [],
            pagination: { page, limit, total: 0, pages: 0 },
          });
        }
        filter.stationId = targetStation.toLowerCase();
        break;
      }

      case "admin": {
        // Admin sees all unless a specific station is requested
        if (stationIdParam) {
          filter.stationId = stationIdParam.toLowerCase();
        }
        break;
      }
    }

    // ── Additional filters ─────────────────────────────────────────────────

    if (status && status !== "all") filter.status = status;
    if (shift && shift !== "all") filter.shift = shift;

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        dateFilter.$lte = to;
      }
      filter.dutyDate = dateFilter;
    }

    if (search) {
      filter.$or = [
        { starNumber: { $regex: search, $options: "i" } },
        { starOfficer: { $regex: search, $options: "i" } },
        { commandingOfficer: { $regex: search, $options: "i" } },
        { stationId: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [stars, total] = await Promise.all([
      populateStar(
        DutyRoleStar.find(filter).sort({ dutyDate: -1, createdAt: -1 }),
      )
        .skip(skip)
        .limit(limit),
      DutyRoleStar.countDocuments(filter),
    ]);

    return NextResponse.json({
      stars,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("GET /duty-role-star error:", err);
    return NextResponse.json(
      { error: "Failed to fetch duty stars" },
      { status: 500 },
    );
  }
}

// ─── POST /api/duty-role-star ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, error } = requireRole(req, [...ALLOWED_ROLES]);
  if (error) return error;

  try {
    await connectDB();

    const body = await req.json();
    const {
      stationId,
      dutyDate,
      shift,
      starOfficer,
      starOfficerUserId,
      commandingOfficer,
      commandingOfficerUserId,
      entries,
      generalRemarks,
      status,
    } = body;

    if (!stationId || !dutyDate || !starOfficer || !commandingOfficer) {
      return NextResponse.json(
        {
          error:
            "stationId, dutyDate, starOfficer, and commandingOfficer are required",
        },
        { status: 400 },
      );
    }

    // NCO and SO can only create stars for their own station
    if (
      (user.role === "nco" || user.role === "so") &&
      user.stationId &&
      stationId.toLowerCase() !== user.stationId.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "You can only create duty stars for your own station" },
        { status: 403 },
      );
    }

    // DC can only create for their own station (or a station they are scoped to)
    if (user.role === "dc" && user.stationId) {
      if (stationId.toLowerCase() !== user.stationId.toLowerCase()) {
        return NextResponse.json(
          {
            error:
              "District Commanders can only create duty stars for their assigned station",
          },
          { status: 403 },
        );
      }
    }

    const normalisedEntries = (entries || []).map(
      (e: Record<string, unknown>, idx: number) => ({
        ...e,
        serialNumber: idx + 1,
        present: e.present !== undefined ? e.present : true,
      }),
    );

    const newStar = new DutyRoleStar({
      stationId: stationId.toLowerCase(),
      dutyDate: new Date(dutyDate),
      shift: shift || "full-day",
      starOfficer,
      starOfficerUserId: starOfficerUserId || null,
      commandingOfficer,
      commandingOfficerUserId: commandingOfficerUserId || null,
      entries: normalisedEntries,
      generalRemarks: generalRemarks || "",
      status: status || "draft",
      createdBy: user.userId,
    });

    await newStar.save();

    const populated = await populateStar(DutyRoleStar.findById(newStar._id));

    return NextResponse.json(
      { message: "Duty star created successfully", star: populated },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /duty-role-star error:", err);
    return NextResponse.json(
      { error: "Failed to create duty star" },
      { status: 500 },
    );
  }
}
