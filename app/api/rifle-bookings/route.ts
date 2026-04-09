import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import RifleBooking, { IInsurance, IWeaponReturn } from "@/models/RifleBooking";

// ─── Role guard ────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// ─── Request body type ─────────────────────────────────────────────────────

interface CreateRifleBookingBody {
  typeOfRifle: string;
  rifleNumber: string;
  serialNumber: string;
  sdNumber: string;
  ammunitionType: string;
  numberOfAmmunition: number;
  dateOfBooking: string;
  typeOfDuty: string;
  nameOfPersonnel: string;
  issuedBy: string;
  receivedBy: string;
  insurance?: Partial<IInsurance>;
  weaponReturn?: Partial<IWeaponReturn>;
  status?: "active" | "returned" | "overdue";
}

// ─── GET /api/rifle-bookings ───────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10));
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const query: Record<string, unknown> = {};

    if (status && status !== "all") query.status = status;

    if (search) {
      query.$or = [
        { bookingNumber: { $regex: search, $options: "i" } },
        { serialNumber: { $regex: search, $options: "i" } },
        { nameOfPersonnel: { $regex: search, $options: "i" } },
        { rifleNumber: { $regex: search, $options: "i" } },
        { sdNumber: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      RifleBooking.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      RifleBooking.countDocuments(query),
    ]);

    return NextResponse.json({
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get rifle bookings error:", err);
    return NextResponse.json(
      { error: "Failed to fetch rifle bookings" },
      { status: 500 },
    );
  }
}

// ─── POST /api/rifle-bookings ──────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const body = (await request.json()) as CreateRifleBookingBody;

    const {
      typeOfRifle,
      rifleNumber,
      serialNumber,
      sdNumber,
      ammunitionType,
      numberOfAmmunition,
      dateOfBooking,
      typeOfDuty,
      nameOfPersonnel,
      issuedBy,
      receivedBy,
      insurance,
      weaponReturn,
      status,
    } = body;

    // ── Required field validation ──────────────────────────────────────────
    if (
      !typeOfRifle ||
      !rifleNumber ||
      !serialNumber ||
      !sdNumber ||
      !ammunitionType ||
      numberOfAmmunition === undefined ||
      !dateOfBooking ||
      !typeOfDuty ||
      !nameOfPersonnel ||
      !issuedBy ||
      !receivedBy
    ) {
      return NextResponse.json(
        {
          error:
            "Required fields: typeOfRifle, rifleNumber, serialNumber, sdNumber, " +
            "ammunitionType, numberOfAmmunition, dateOfBooking, typeOfDuty, " +
            "nameOfPersonnel, issuedBy, receivedBy",
        },
        { status: 400 },
      );
    }

    // ── Duplicate serial check ─────────────────────────────────────────────
    const existing = await RifleBooking.findOne({ serialNumber });
    if (existing) {
      return NextResponse.json(
        { error: "Serial number already exists" },
        { status: 400 },
      );
    }

    // ── Auto-generate booking number ───────────────────────────────────────
    const year = new Date().getFullYear();
    const count = await RifleBooking.countDocuments();
    const bookingNumber = `RB-${year}-${String(count + 1).padStart(4, "0")}`;

    // ── Derive status from weaponReturn if not explicitly supplied ─────────
    let resolvedStatus: "active" | "returned" | "overdue" = status ?? "active";
    if (!status && weaponReturn?.returnDate) {
      const returnDateObj = new Date(weaponReturn.returnDate);
      const today = new Date();
      resolvedStatus = today > returnDateObj ? "overdue" : "returned";
    }

    const newBooking = new RifleBooking({
      bookingNumber,
      typeOfRifle,
      rifleNumber,
      serialNumber,
      sdNumber,
      ammunitionType,
      numberOfAmmunition,
      dateOfBooking: new Date(dateOfBooking),
      typeOfDuty,
      nameOfPersonnel,
      issuedBy,
      receivedBy,
      insurance: insurance ?? {},
      weaponReturn: weaponReturn ?? {},
      status: resolvedStatus,
    });

    await newBooking.save();

    return NextResponse.json(
      { message: "Rifle booking created successfully", booking: newBooking },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create rifle booking error:", err);
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
      { error: "Failed to create rifle booking" },
      { status: 500 },
    );
  }
}
