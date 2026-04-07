// src/app/api/dashboard/stats/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireRole } from "@/middleware/auth";

export async function GET(req: NextRequest) {
  const { user, error } = requireRole(req, ["admin"]);
  if (error) return error;

  try {
    await connectDB();

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      adminUsers,
      ncoUsers,
      cidUsers,
      soUsers,
      dcUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "nco" }),
      User.countDocuments({ role: "cid" }),
      User.countDocuments({ role: "so" }),
      User.countDocuments({ role: "dc" }),
    ]);

    const stats = {
      totalUsers,
      activeUsers,
      inactiveUsers,
      usersByRole: {
        admin: adminUsers,
        nco: ncoUsers,
        cid: cidUsers,
        so: soUsers,
        dc: dcUsers,
      },
    };

    return NextResponse.json({ stats });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
