import { NextResponse, NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import { resolveCreateStation } from "@/lib/stationScope";
import Vehicle from "@/models/Vehicle";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"];

// ── GET /api/vehicles ──────────────────────────────────────────────────────
async function getVehicles(request: NextRequest) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1") || 1;
    const limit = parseInt(searchParams.get("limit") || "10") || 10;
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const stationId = searchParams.get("stationId");

    const query: Record<string, any> = {};

    // Station scoping
    switch (user.role) {
      case "nco":
      case "so":
        if (!user.stationId) return NextResponse.json({ vehicles: [], pagination: { page, limit, total: 0, pages: 0 } });
        query.stationId = user.stationId;
        break;
      case "dc": {
        // DC oversees all stations; only narrows when a station is requested.
        if (stationId) query.stationId = stationId;
        break;
      }
      case "admin":
        if (user.stationId) query.stationId = user.stationId;
        else if (stationId) query.stationId = stationId;
        break;
    }

    if (status && status !== "all") query.status = status;
    if (type && type !== "all") query.type = type;
    if (search) {
      query.$or = [
        { vehicleNumber: { $regex: search, $options: "i" } },
        { licensePlate: { $regex: search, $options: "i" } },
        { make: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [vehicles, total] = await Promise.all([
      Vehicle.find(query)
        .populate("currentDriver", "firstName lastName badgeNumber")
        .populate(
          "dispatchHistory.dispatchedTo",
          "firstName lastName badgeNumber",
        )
        .populate("dispatchHistory.dispatchedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vehicle.countDocuments(query),
    ]);

    return NextResponse.json({
      vehicles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get vehicles error:", err);
    return NextResponse.json(
      { error: "Failed to fetch vehicles" },
      { status: 500 },
    );
  }
}

// ── POST /api/vehicles ─────────────────────────────────────────────────────
async function createVehicle(request: NextRequest) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const body = await request.json();
    const {
      licensePlate,
      make,
      model,
      type,
      typeOther,
      mileage,
      fuelLevel,
      status,
      equipment,
      notes,
    } = body;

    const resolvedStationId = resolveCreateStation(user, body.stationId);

    if (!resolvedStationId) {
      return NextResponse.json({ error: "No station associated with this account" }, { status: 400 });
    }

    if (!licensePlate || !make || !model || !type) {
      return NextResponse.json(
        { error: "Required fields: licensePlate, make, model, type" },
        { status: 400 },
      );
    }

    const existing = await Vehicle.findOne({ licensePlate });
    if (existing) {
      return NextResponse.json(
        { error: "Vehicle with this license plate already exists" },
        { status: 400 },
      );
    }

    const yearNow = new Date().getFullYear();
    const count = await Vehicle.countDocuments();
    const vehicleNumber = `VEH-${yearNow}-${String(count + 1).padStart(4, "0")}`;

    const newVehicle = new Vehicle({
      stationId: resolvedStationId,
      vehicleNumber,
      licensePlate,
      make,
      model,
      type,
      typeOther: type === "other" ? typeOther || "" : "",
      mileage: mileage || 0,
      fuelLevel: fuelLevel || "",
      status: status || "available",
      equipment: equipment || [],
      notes: notes || "",
    });

    await newVehicle.save();

    return NextResponse.json(
      { message: "Vehicle created successfully", vehicle: newVehicle },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create vehicle error:", err);
    if (err instanceof Error && err.name === "ValidationError") {
      const messages = Object.values((err as any).errors).map(
        (e: any) => e.message,
      );
      return NextResponse.json(
        { error: `Validation failed: ${messages.join(", ")}` },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create vehicle" },
      { status: 500 },
    );
  }
}

export const GET = getVehicles;
export const POST = createVehicle;
