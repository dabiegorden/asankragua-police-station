import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Personnel, { IPersonnel } from "@/models/Personnel";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// Next.js App Router passes params as a Promise in newer versions
type RouteContext = { params: Promise<{ id: string }> };

// ─── Partial update body — all fields optional ─────────────────────────────
type UpdatePersonnelBody = Partial<
  Omit<IPersonnel, "dateOfBirth" | "dateJoined" | "createdAt" | "updatedAt"> & {
    dateOfBirth: string;
    dateJoined: string;
  }
>;

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const personnel = await Personnel.findById(id).populate(
      "assignments.caseId",
      "caseNumber title status"
    );

    if (!personnel) {
      return NextResponse.json({ error: "Personnel not found" }, { status: 404 });
    }

    return NextResponse.json({ personnel });
  } catch (err) {
    console.error("Get personnel by ID error:", err);
    return NextResponse.json(
      { error: "Failed to fetch personnel" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const body = (await request.json()) as UpdatePersonnelBody;

    // Coerce empty badge string to null so sparse unique index is not violated
    if (body.badgeNumber === ("" as string)) {
      (body as Record<string, unknown>).badgeNumber = null;
    }

    if (body.dateOfBirth) {
      (body as Record<string, unknown>).dateOfBirth = new Date(body.dateOfBirth);
    }
    if (body.dateJoined) {
      (body as Record<string, unknown>).dateJoined = new Date(body.dateJoined);
    }

    const personnel = await Personnel.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!personnel) {
      return NextResponse.json({ error: "Personnel not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Personnel updated successfully", personnel });
  } catch (err) {
    console.error("Update personnel error:", err);
    return NextResponse.json(
      { error: "Failed to update personnel" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const personnel = await Personnel.findByIdAndDelete(id);

    if (!personnel) {
      return NextResponse.json({ error: "Personnel not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Personnel deleted successfully" });
  } catch (err) {
    console.error("Delete personnel error:", err);
    return NextResponse.json(
      { error: "Failed to delete personnel" },
      { status: 500 }
    );
  }
}