// src/app/api/users/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireRole } from "@/middleware/auth";
import { isSuperAdmin } from "@/lib/stationScope";

// GET single user by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = requireRole(req, ["admin"]);
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params; // Await the params Promise
    const dbUser = await User.findById(id).select("-password");

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: dbUser });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH - Update user
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = requireRole(req, ["admin"]);
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params; // Await the params Promise

    const target = await User.findById(id);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Station admins may only manage accounts within their own station and may
    // not create/upgrade administrators or district commanders.
    const superAdmin = isSuperAdmin(user);
    if (!superAdmin) {
      if (!user.stationId || target.stationId !== user.stationId) {
        return NextResponse.json(
          { error: "You can only manage users at your own station" },
          { status: 403 },
        );
      }
    }

    const body = await req.json();
    const { fullName, email, password, role, stationId, isActive } = body;

    if (!superAdmin) {
      if (role && (role === "admin" || role === "dc")) {
        return NextResponse.json(
          { error: "Only the super admin can assign administrator or district commander roles" },
          { status: 403 },
        );
      }
      // Prevent a station admin from moving a user to another station.
      if (stationId !== undefined && stationId !== user.stationId) {
        return NextResponse.json(
          { error: "You cannot move users to another station" },
          { status: 403 },
        );
      }
    }

    const updates: any = {};

    if (fullName) updates.fullName = fullName;
    if (email) {
      // Check if email is already taken by another user
      const existing = await User.findOne({
        email,
        _id: { $ne: id }, // Use the awaited id
      });
      if (existing) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 409 },
        );
      }
      updates.email = email;
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 },
        );
      }
      updates.password = await bcrypt.hash(password, 10);
    }

    if (role) {
      const validRoles = ["admin", "nco", "cid", "so", "dc"];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updates.role = role;
    }

    if (stationId !== undefined) updates.stationId = stationId;
    if (isActive !== undefined) updates.isActive = isActive;

    // The DC oversees every station and is never tied to one.
    const effectiveRole = role ?? target.role;
    if (effectiveRole === "dc") updates.stationId = null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields provided to update" },
        { status: 400 },
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      id, // Use the awaited id
      { $set: updates },
      { new: true, select: "-password" },
    );

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = requireRole(req, ["admin"]);
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params; // Await the params Promise

    // Prevent admin from deleting themselves
    if (user!.userId === id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 403 },
      );
    }

    const target = await User.findById(id);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Station admins can only delete accounts at their own station and never
    // other administrators / district commanders.
    if (!isSuperAdmin(user)) {
      if (!user.stationId || target.stationId !== user.stationId) {
        return NextResponse.json(
          { error: "You can only manage users at your own station" },
          { status: 403 },
        );
      }
      if (target.role === "admin" || target.role === "dc") {
        return NextResponse.json(
          { error: "Only the super admin can remove administrators or district commanders" },
          { status: 403 },
        );
      }
    }

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
