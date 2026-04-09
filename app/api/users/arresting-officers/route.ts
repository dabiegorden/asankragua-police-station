// src/app/api/users/arresting-officers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/middleware/auth";

// Roles that can make arrests
const ARRESTING_ROLES = ["nco", "cid", "so", "dc"];

export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    await connectDB();

    const users = await User.find({
      isActive: true,
      role: { $in: ARRESTING_ROLES },
    })
      .select("_id fullName email role stationId")
      .sort({ fullName: 1 });

    return NextResponse.json({ users });
  } catch (err) {
    console.error("Get arresting officers error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
