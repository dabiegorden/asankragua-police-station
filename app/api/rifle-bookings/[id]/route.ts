import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import RifleBooking, { IInsurance, IWeaponReturn } from "@/models/RifleBooking";

// ─── Role guard ────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// Next.js App Router — params arrive as a Promise in v13+
type RouteContext = { params: Promise<{ id: string }> };

// ─── Partial update body ───────────────────────────────────────────────────

interface UpdateRifleBookingBody {
  typeOfRifle?: string;
  rifleNumber?: string;
  serialNumber?: string;
  sdNumber?: string;
  ammunitionType?: string;
  numberOfAmmunition?: number;
  dateOfBooking?: string;
  typeOfDuty?: string;
  nameOfPersonnel?: string;
  issuedBy?: string;
  receivedBy?: string;
  insurance?: Partial<IInsurance>;
  weaponReturn?: Partial<IWeaponReturn>;
  status?: "active" | "returned" | "overdue";
}

// ─── GET /api/rifle-bookings/[id] ─────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const booking = await RifleBooking.findById(id);

    if (!booking) {
      return NextResponse.json(
        { error: "Rifle booking not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ booking });
  } catch (err) {
    console.error("Get rifle booking error:", err);
    return NextResponse.json(
      { error: "Failed to fetch rifle booking" },
      { status: 500 },
    );
  }
}

// ─── PUT /api/rifle-bookings/[id] ─────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const body = (await request.json()) as UpdateRifleBookingBody;

    // Coerce date strings to Date objects where present
    const updatePayload: Record<string, unknown> = { ...body };

    if (body.dateOfBooking) {
      updatePayload.dateOfBooking = new Date(body.dateOfBooking);
    }

    if (body.weaponReturn?.returnDate) {
      updatePayload.weaponReturn = {
        ...body.weaponReturn,
        returnDate: new Date(body.weaponReturn.returnDate),
      };
    }

    if (body.insurance?.coverageStartDate) {
      (updatePayload.insurance as Record<string, unknown>).coverageStartDate =
        new Date(body.insurance.coverageStartDate);
    }

    if (body.insurance?.coverageEndDate) {
      (updatePayload.insurance as Record<string, unknown>).coverageEndDate =
        new Date(body.insurance.coverageEndDate);
    }

    const booking = await RifleBooking.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true },
    );

    if (!booking) {
      return NextResponse.json(
        { error: "Rifle booking not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Rifle booking updated successfully",
      booking,
    });
  } catch (err) {
    console.error("Update rifle booking error:", err);
    const mongoErr = err as {
      code?: number;
      name?: string;
      errors?: Record<string, { message: string }>;
    };
    if (mongoErr.code === 11000) {
      return NextResponse.json(
        { error: "Serial number already exists" },
        { status: 400 },
      );
    }
    if (mongoErr.name === "ValidationError" && mongoErr.errors) {
      const messages = Object.values(mongoErr.errors).map((e) => e.message);
      return NextResponse.json({ error: messages.join(", ") }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update rifle booking" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/rifle-bookings/[id] ──────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const booking = await RifleBooking.findByIdAndDelete(id);

    if (!booking) {
      return NextResponse.json(
        { error: "Rifle booking not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Rifle booking deleted successfully" });
  } catch (err) {
    console.error("Delete rifle booking error:", err);
    return NextResponse.json(
      { error: "Failed to delete rifle booking" },
      { status: 500 },
    );
  }
}
