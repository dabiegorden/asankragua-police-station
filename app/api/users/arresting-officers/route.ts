// src/app/api/users/arresting-officers/route.ts
// Returns only active officers who can make arrests — station-scoped.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/middleware/auth";

const ARRESTING_ROLES = ["nco", "cid", "so", "dc"];

export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const requestedStation = searchParams.get("stationId");

    const query: Record<string, unknown> = {
      isActive: true,
      role: { $in: ARRESTING_ROLES },
    };

    switch (user.role) {
      case "nco":
      case "cid":
      case "so":
        if (!user.stationId) return NextResponse.json({ users: [] });
        query.stationId = user.stationId;
        break;

      case "dc":
        query.stationId = requestedStation || user.stationId || undefined;
        break;

      case "admin":
        if (requestedStation) query.stationId = requestedStation;
        break;
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
