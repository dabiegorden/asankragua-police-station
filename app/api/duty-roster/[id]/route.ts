// src/app/api/duty-roster/[id]/route.ts
// Single Duty Roster — GET, PUT (full update + actions), DELETE
//
// Status flow: draft → published (final). No approval step.
// Actions available via PUT ?action=:
//   publish  — nco | so | admin (marks roster as finalised / active)
//   archive  — so | dc | admin
// RBAC:
//   nco / so → own station only
//   dc        → all stations (read + write)
//   admin     → all stations

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole } from "@/middleware/auth";
import DutyRoster from "@/models/Dutyroster";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;

type RouteContext = { params: Promise<{ id: string }> };

function populateRoster(query: ReturnType<typeof DutyRoster.findById>) {
  return (query as any)
    .populate("createdBy", "fullName email role stationId")
    .populate("entries.officerUserId", "fullName role");
}

/**
 * Returns true when a user may access a roster belonging to `rosterStationId`.
 *  - admin / dc → always
 *  - nco / so   → only their own station
 */
function canAccessStation(
  user: { role: string; stationId?: string | null },
  rosterStationId: string,
): boolean {
  if (user.role === "admin" || user.role === "dc") return true;
  if (!user.stationId) return false;
  return rosterStationId.toLowerCase() === user.stationId.toLowerCase();
}

// ─── GET /api/duty-roster/[id] ─────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { user, error } = requireRole(req, [...ALLOWED_ROLES]);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();
    const roster = await populateRoster(DutyRoster.findById(id));
    if (!roster) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }
    if (!canAccessStation(user, (roster as any).stationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ roster });
  } catch (err) {
    console.error("GET /duty-roster/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch roster" },
      { status: 500 },
    );
  }
}

// ─── PUT /api/duty-roster/[id] ─────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { user, error } = requireRole(req, [...ALLOWED_ROLES]);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

    const body = await req.json();
    const { action } = body;

    const roster = await DutyRoster.findById(id);
    if (!roster) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    if (!canAccessStation(user, roster.stationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── publish ────────────────────────────────────────────────────────────
    // Publishing is the final step — no approval needed.
    if (action === "publish") {
      if (!["nco", "so", "dc", "admin"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (roster.status === "archived") {
        return NextResponse.json(
          { error: "Cannot publish an archived roster" },
          { status: 400 },
        );
      }
      roster.status = "published";
      await roster.save();
      return NextResponse.json({
        message: "Roster published",
        roster: await populateRoster(DutyRoster.findById(id)),
      });
    }

    // ── archive ────────────────────────────────────────────────────────────
    if (action === "archive") {
      if (!["admin", "so", "dc"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      roster.status = "archived";
      await roster.save();
      return NextResponse.json({
        message: "Roster archived",
        roster: await populateRoster(DutyRoster.findById(id)),
      });
    }

    // ── full update ────────────────────────────────────────────────────────
    // Published rosters can still be edited (they are the final record);
    // archived rosters cannot be edited.
    if (roster.status === "archived") {
      return NextResponse.json(
        { error: "Archived rosters cannot be edited" },
        { status: 400 },
      );
    }

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

    // Prevent nco / so from moving a roster to a different station
    if (stationId && !["admin", "dc"].includes(user.role)) {
      if (stationId.toLowerCase() !== roster.stationId.toLowerCase()) {
        return NextResponse.json(
          { error: "You cannot move a roster to a different station" },
          { status: 403 },
        );
      }
    }

    if (stationId) roster.stationId = stationId.toLowerCase();
    if (referenceNumber !== undefined) roster.referenceNumber = referenceNumber;
    if (districtCommander !== undefined)
      roster.districtCommander = districtCommander;
    if (stationOfficer !== undefined) roster.stationOfficer = stationOfficer;
    if (startDate) roster.startDate = new Date(startDate);
    if (endDate) roster.endDate = new Date(endDate);
    if (generalRemarks !== undefined) roster.generalRemarks = generalRemarks;

    // Only allow transitioning to draft or published via a normal update
    if (status && !["archived"].includes(status))
      roster.status = status as "draft" | "published";

    if (entries) {
      roster.entries = entries.map(
        (e: Record<string, unknown>, idx: number) => ({
          ...e,
          serialNumber: idx + 1,
        }),
      );
    }

    await roster.save();
    return NextResponse.json({
      message: "Roster updated",
      roster: await populateRoster(DutyRoster.findById(id)),
    });
  } catch (err) {
    console.error("PUT /duty-roster/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update roster" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/duty-roster/[id] ─────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { user, error } = requireRole(req, [...ALLOWED_ROLES]);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

    const roster = await DutyRoster.findById(id);
    if (!roster) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    if (!canAccessStation(user, roster.stationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only admin can delete a published roster
    if (roster.status === "published" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Only admin can delete published rosters" },
        { status: 403 },
      );
    }

    await DutyRoster.findByIdAndDelete(id);
    return NextResponse.json({ message: "Roster deleted successfully" });
  } catch (err) {
    console.error("DELETE /duty-roster/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete roster" },
      { status: 500 },
    );
  }
}
