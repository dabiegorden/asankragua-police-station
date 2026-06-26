// src/app/api/users/by-role/route.ts
// Returns minimal user info for referral dropdowns — station-scoped.
// NCO / CID / SO only see users at their own station.
// DC sees their own station by default (pass ?stationId= to override).
// Admin sees all unless filtered.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/middleware/auth";
import { resolveScopeStation } from "@/lib/stationScope";

export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    const requestedStation = searchParams.get("stationId");

    const query: Record<string, unknown> = { isActive: true };

    if (role) {
      const roles = role.split(",").map((r) => r.trim());
      query.role = { $in: roles };
    }

    // The District Commander is a district-level oversight role and is not
    // pinned to any single station. When a station-bound user (e.g. the SO)
    // looks up DCs to refer a case upward, station scoping must NOT apply —
    // otherwise the dropdown comes back empty. Skip scoping for DC-only lookups.
    const requestedRoles = role
      ? role.split(",").map((r) => r.trim())
      : [];
    const isDcOnlyLookup =
      requestedRoles.length > 0 && requestedRoles.every((r) => r === "dc");

    // Station scoping (centralised rules):
    //   nco / cid / so / station-admin → hard-locked to their own station
    //   dc                             → all stations (own by default, ?stationId= to filter)
    //   super admin                    → all stations
    const scope = isDcOnlyLookup
      ? null
      : resolveScopeStation(user, requestedStation);

    if (scope === undefined) {
      // A station-bound user with no station attached: see nobody.
      return NextResponse.json({ users: [] });
    }
    if (scope) {
      // A concrete station: restrict to it.
      query.stationId = scope;
    }
    // scope === null → no station filter (DC / super admin see everyone)

    const users = await User.find(query)
      .select("_id fullName email role stationId")
      .sort({ fullName: 1 });

    return NextResponse.json({ users });
  } catch (err) {
    console.error("Get users by role error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
