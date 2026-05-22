// src/app/api/duty-role-star/[id]/route.ts
// Single Duty Role Star — GET, PUT (full update + actions), DELETE
// Station-access guards mirror the Cases module:
//   nco / so → own station only
//   dc       → own station only (no cross-station access on individual records)
//   admin    → unrestricted

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import DutyRoleStar from "@/models/DutyRoleStar";
import { requireRole } from "@/middleware/auth";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;

type RouteContext = { params: Promise<{ id: string }> };

function populateStar(query: ReturnType<typeof DutyRoleStar.findById>) {
  return (query as any)
    .populate("createdBy", "fullName email role stationId")
    .populate("approvedBy", "fullName email role")
    .populate("starOfficerUserId", "fullName role")
    .populate("commandingOfficerUserId", "fullName role")
    .populate("entries.officerUserId", "fullName role");
}

/**
 * Returns true if the requesting user is allowed to access a star
 * belonging to the given stationId.
 *
 * Rules (same as Cases):
 *   nco / so → must match their own stationId
 *   dc       → must match their own stationId
 *   admin    → always allowed
 */
function canAccessStation(
  user: { role: string; stationId?: string | null },
  starStationId: string,
): boolean {
  if (user.role === "admin") return true;
  if (!user.stationId) return false; // role-scoped users with no station get nothing
  return starStationId.toLowerCase() === user.stationId.toLowerCase();
}

// ─── GET /api/duty-role-star/[id] ─────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { user, error } = requireRole(req, [...ALLOWED_ROLES]);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

    const star = await populateStar(DutyRoleStar.findById(id));
    if (!star) {
      return NextResponse.json(
        { error: "Duty star not found" },
        { status: 404 },
      );
    }

    // Station access guard for all non-admin roles
    if (
      user.role !== "admin" &&
      !canAccessStation(user, (star as any).stationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ star });
  } catch (err) {
    console.error("GET /duty-role-star/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch duty star" },
      { status: 500 },
    );
  }
}

// ─── PUT /api/duty-role-star/[id] ─────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { user, error } = requireRole(req, [...ALLOWED_ROLES]);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

    const body = await req.json();
    const { action } = body;

    const star = await DutyRoleStar.findById(id);
    if (!star) {
      return NextResponse.json(
        { error: "Duty star not found" },
        { status: 404 },
      );
    }

    // Station access guard for all non-admin roles
    if (user.role !== "admin" && !canAccessStation(user, star.stationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── publish ────────────────────────────────────────────────────────────
    if (action === "publish") {
      if (!["nco", "so", "admin"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (star.status === "approved" || star.status === "archived") {
        return NextResponse.json(
          { error: "Cannot publish an approved or archived duty star" },
          { status: 400 },
        );
      }
      star.status = "published";
      await star.save();
      return NextResponse.json({
        message: "Duty star published",
        star: await populateStar(DutyRoleStar.findById(id)),
      });
    }

    // ── approve ────────────────────────────────────────────────────────────
    if (action === "approve") {
      if (!["so", "dc", "admin"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      star.status = "approved";
      star.approvedBy = user.userId as any;
      star.approvedAt = new Date();
      await star.save();
      return NextResponse.json({
        message: "Duty star approved",
        star: await populateStar(DutyRoleStar.findById(id)),
      });
    }

    // ── archive ────────────────────────────────────────────────────────────
    if (action === "archive") {
      if (!["admin", "so", "dc"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      star.status = "archived";
      await star.save();
      return NextResponse.json({
        message: "Duty star archived",
        star: await populateStar(DutyRoleStar.findById(id)),
      });
    }

    // ── mark-attendance ────────────────────────────────────────────────────
    if (action === "mark-attendance") {
      const { entryId, present } = body;
      if (entryId === undefined || present === undefined) {
        return NextResponse.json(
          { error: "entryId and present are required" },
          { status: 400 },
        );
      }
      const entry = star.entries.find((e) => String(e._id) === String(entryId));
      if (!entry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      entry.present = present;
      star.absentCount = star.entries.filter((e) => !e.present).length;
      await star.save();
      return NextResponse.json({
        message: "Attendance updated",
        star: await populateStar(DutyRoleStar.findById(id)),
      });
    }

    // ── full update ────────────────────────────────────────────────────────
    if (star.status === "approved") {
      return NextResponse.json(
        { error: "Approved duty stars cannot be edited" },
        { status: 400 },
      );
    }

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

    // Prevent NCO / SO / DC from re-assigning a star to a different station
    if (stationId && user.role !== "admin") {
      if (stationId.toLowerCase() !== star.stationId.toLowerCase()) {
        return NextResponse.json(
          { error: "You cannot move a duty star to a different station" },
          { status: 403 },
        );
      }
    }

    if (stationId) star.stationId = stationId.toLowerCase();
    if (dutyDate) star.dutyDate = new Date(dutyDate);
    if (shift) star.shift = shift;
    if (starOfficer) star.starOfficer = starOfficer;
    if (starOfficerUserId !== undefined)
      star.starOfficerUserId = starOfficerUserId || null;
    if (commandingOfficer) star.commandingOfficer = commandingOfficer;
    if (commandingOfficerUserId !== undefined)
      star.commandingOfficerUserId = commandingOfficerUserId || null;
    if (generalRemarks !== undefined) star.generalRemarks = generalRemarks;
    if (status && !["approved", "archived"].includes(status))
      star.status = status;

    if (entries) {
      star.entries = entries.map((e: Record<string, unknown>, idx: number) => ({
        ...e,
        serialNumber: idx + 1,
        present: e.present !== undefined ? e.present : true,
      }));
      // Recompute absent count after entry update
      star.absentCount = star.entries.filter((e) => !e.present).length;
    }

    await star.save();
    return NextResponse.json({
      message: "Duty star updated",
      star: await populateStar(DutyRoleStar.findById(id)),
    });
  } catch (err) {
    console.error("PUT /duty-role-star/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update duty star" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/duty-role-star/[id] ──────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { user, error } = requireRole(req, [...ALLOWED_ROLES]);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

    const star = await DutyRoleStar.findById(id);
    if (!star) {
      return NextResponse.json(
        { error: "Duty star not found" },
        { status: 404 },
      );
    }

    // Station access guard for all non-admin roles
    if (user.role !== "admin" && !canAccessStation(user, star.stationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only admin can delete approved records
    if (star.status === "approved" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Only admin can delete approved duty stars" },
        { status: 403 },
      );
    }

    await DutyRoleStar.findByIdAndDelete(id);
    return NextResponse.json({ message: "Duty star deleted successfully" });
  } catch (err) {
    console.error("DELETE /duty-role-star/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete duty star" },
      { status: 500 },
    );
  }
}
