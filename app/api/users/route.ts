// src/app/api/users/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireRole } from "@/middleware/auth";

// GET all users with filtering and search
export async function GET(req: NextRequest) {
  const { user, error } = requireRole(req, ["admin"]);
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const isActive = searchParams.get("isActive") || "";

    // Build filter query
    const filter: any = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { stationId: { $regex: search, $options: "i" } },
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (isActive !== "") {
      filter.isActive = isActive === "true";
    }

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

// POST - Create new user
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

    // Validate role
    const validRoles = ["admin", "nco", "cid", "so", "dc"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if email already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role,
      stationId: stationId || null,
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
