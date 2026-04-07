import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Vehicle from "@/models/Vehicle";

// GET /api/vehicles
async function getVehicles(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page")) || 1;
    const limit = Number.parseInt(searchParams.get("limit")) || 10;
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { vehicleNumber: { $regex: search, $options: "i" } },
        { licensePlate: { $regex: search, $options: "i" } },
        { make: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const vehicles = await Vehicle.find(query)
      .populate("currentDriver", "firstName lastName badgeNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Vehicle.countDocuments(query);

    return NextResponse.json({
      vehicles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get vehicles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vehicles" },
      { status: 500 },
    );
  }
}

// POST /api/vehicles
async function createVehicle(request) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      licensePlate,
      make,
      model,
      year,
      color,
      type,
      mileage,
      fuelLevel,
      insuranceDetails,
      registrationDetails,
      equipment,
      notes,
    } = body;

    if (!licensePlate || !make || !model || !year || !color || !type) {
      return NextResponse.json(
        { error: "All required fields must be provided" },
        { status: 400 },
      );
    }

    const existingVehicle = await Vehicle.findOne({ licensePlate });
    if (existingVehicle) {
      return NextResponse.json(
        { error: "Vehicle with this license plate already exists" },
        { status: 400 },
      );
    }

    // ✅ Generate vehicle number manually
    const yearNow = new Date().getFullYear();
    const count = await Vehicle.countDocuments();
    const vehicleNumber = `VEH-${yearNow}-${String(count + 1).padStart(
      4,
      "0",
    )}`;

    const newVehicle = new Vehicle({
      vehicleNumber,
      licensePlate,
      make,
      model,
      year,
      color,
      type,
      mileage: mileage || 0,
      fuelLevel: fuelLevel || 100,
      insuranceDetails,
      registrationDetails,
      equipment: equipment || [],
      notes,
    });

    await newVehicle.save();

    return NextResponse.json(
      {
        message: "Vehicle created successfully",
        vehicle: newVehicle,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create vehicle error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
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

export const GET = requireAuth(getVehicles);
export const POST = requireRole(["admin", "officer"])(createVehicle);
