// src/app/api/users/arresting-officers/route.ts
// Returns only active officers who can make arrests — station-scoped.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/middleware/auth";
import { resolveScopeStation } from "@/lib/stationScope";

const ARRESTING_ROLES = ["nco", "cid", "so", "dc"];

export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const requestedStation = searchParams.get("stationId");

    // Apply the centralised station-scoping rules so this dropdown only ever
    // lists officers from the relevant station (station-bound users — including
    // station admins — are hard-locked to their own station).
    const scopeStation = resolveScopeStation(user, requestedStation);

    // A station-bound user with no station attached should see no officers.
    if (scopeStation === undefined) {
      return NextResponse.json({ users: [] });
    }

    const query: Record<string, unknown> = {
      isActive: true,
      role: { $in: ARRESTING_ROLES },
    };

    // null → no station filter (super admin / DC viewing all stations).
    if (scopeStation !== null) {
      query.stationId = scopeStation;
    }

    const users = await User.find(query)
      .select("_id fullName email role stationId")
      .sort({ fullName: 1 });

    return NextResponse.json({ users });
  } catch (err) {
    console.error("Get arresting officers error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
