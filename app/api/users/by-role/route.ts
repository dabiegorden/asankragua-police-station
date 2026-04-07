// src/app/api/users/by-role/route.ts
// Public-ish route (still auth-protected but accessible to all authenticated roles)
// Returns minimal user info needed for referral dropdowns

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

    const query: Record<string, unknown> = { isActive: true };
    if (role) {
      // Support comma-separated roles: ?role=cid,so
      const roles = role.split(",").map((r) => r.trim());
      query.role = { $in: roles };
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
