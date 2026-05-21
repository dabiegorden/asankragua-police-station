// src/app/api/users/by-role/route.ts
// Returns minimal user info for referral dropdowns — station-scoped.
// NCO / CID / SO only see users at their own station.
// DC sees their own station by default (pass ?stationId= to override).
// Admin sees all unless filtered.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/middleware/auth";

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

    // Station scoping
    switch (user.role) {
      case "nco":
      case "cid":
      case "so":
        // These roles can only see users within their own station
        if (!user.stationId) {
          return NextResponse.json({ users: [] });
        }
        query.stationId = user.stationId;
        break;

      case "dc":
        // DC defaults to their station; can override with ?stationId=
        query.stationId = requestedStation || user.stationId || undefined;
        break;

      case "admin":
        // Admin sees all unless a stationId filter is passed
        if (requestedStation) query.stationId = requestedStation;
        break;
    }

    const users = await User.find(query)
      .select("_id fullName email role stationId")
      .sort({ fullName: 1 });

    return NextResponse.json({ users });
  } catch (err) {
    console.error("Get users by role error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
