// src/app/api/auth/register/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { fullName, email, password, role, stationId } = await req.json();

    if (!fullName || !email || !password || !role) {
      return NextResponse.json(
        { error: "fullName, email, password, and role are required" },
        { status: 400 },
      );
    }

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
      stationId: stationId || null,
    });

    return NextResponse.json(
      { message: "User created", user: newUser.toSafeObject() },
      { status: 201 },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
