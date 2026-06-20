// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireRole } from "@/middleware/auth";
import {
  resolveScopeStation,
  resolveCreateStation,
  isSuperAdmin,
} from "@/lib/stationScope";

export async function GET(req: NextRequest) {
  const { user, error } = requireRole(req, ["admin", "nco", "so", "dc"]);
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const isActive = searchParams.get("isActive") || "";
    // DC can pass ?stationId= to filter users at a specific station
    const stationId = searchParams.get("stationId") || "";

    const filter: any = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { stationId: { $regex: search, $options: "i" } },
      ];
    }

    if (role) filter.role = role;
    if (isActive !== "") filter.isActive = isActive === "true";

    // Station scoping: station-bound roles (nco/so/station-admin) are locked to
    // their own station; dc defaults to own but may filter; super admin sees all.
    const scopeStation = resolveScopeStation(user, stationId);
    if (scopeStation === undefined) {
      return NextResponse.json({
        users: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      });
    }
    if (scopeStation) filter.stationId = scopeStation;

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = requireRole(req, ["admin"]);
  if (error) return error;

  try {
    await connectDB();
    const { fullName, email, password, role, stationId, isActive } =
      await req.json();

    if (!fullName || !email || !password || !role) {
      return NextResponse.json(
        { error: "fullName, email, password, and role are required" },
        { status: 400 },
      );
    }

    const validRoles = ["admin", "nco", "cid", "so", "dc"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Only the super admin may create administrator or district-commander
    // accounts. A station admin can only manage accounts within its own station.
    if ((role === "admin" || role === "dc") && !isSuperAdmin(user)) {
      return NextResponse.json(
        { error: "Only the super admin can create administrators or district commanders" },
        { status: 403 },
      );
    }

    // Resolve the station: super admin may assign any station; a station admin
    // is pinned to its own station regardless of the submitted value.
    const resolvedStationId = isSuperAdmin(user)
      ? stationId || null
      : resolveCreateStation(user, stationId);

    // Admins and district commanders are not tied to a single station
    // (the DC oversees every station); all other roles require one.
    if (role !== "admin" && role !== "dc" && !resolvedStationId) {
      return NextResponse.json(
        { error: "A station must be assigned for this role" },
        { status: 400 },
      );
    }

    // Force the DC to be stationless regardless of any submitted value.
    const finalStationId = role === "dc" ? null : resolvedStationId;

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role,
      stationId: finalStationId,
      isActive: isActive !== undefined ? isActive : true,
    });

    return NextResponse.json(
      { message: "User created successfully", user: newUser.toSafeObject() },
      { status: 201 },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
