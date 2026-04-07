import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import RifleBooking from "@/models/RifleBooking";

// GET - Fetch all rifle bookings with pagination
export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page")) || 1;
    const limit = Number.parseInt(searchParams.get("limit")) || 10;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const query = {};

    if (search) {
      query.$or = [
        { bookingNumber: { $regex: search, $options: "i" } },
        { serialNumber: { $regex: search, $options: "i" } },
        { nameOfPersonnel: { $regex: search, $options: "i" } },
        { rifleNumber: { $regex: search, $options: "i" } },
        { sdNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const bookings = await RifleBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await RifleBooking.countDocuments(query);

    return NextResponse.json({
      bookings,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch rifle bookings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rifle bookings" },
      { status: 500 },
    );
  }
}

// POST - Create a new rifle booking
export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      typeOfRifle,
      rifleNumber,
      ammunitionType,
      numberOfAmmunition,
      dateOfBooking,
      typeOfDuty,
      returnDate,
      serialNumber,
      nameOfPersonnel,
      receivedBy,
      issuedBy,
      sdNumber,
    } = body;

    if (
      !typeOfRifle ||
      !rifleNumber ||
      !ammunitionType ||
      numberOfAmmunition === undefined ||
      !dateOfBooking ||
      !typeOfDuty ||
      !serialNumber ||
      !nameOfPersonnel ||
      !receivedBy ||
      !issuedBy ||
      !sdNumber
    ) {
      return NextResponse.json(
        { error: "All required fields must be provided" },
        { status: 400 },
      );
    }

    // Generate booking number
    const year = new Date().getFullYear();
    const count = await RifleBooking.countDocuments();
    const bookingNumber = `RB-${year}-${String(count + 1).padStart(4, "0")}`;

    console.log("[v0] Creating rifle booking with data:", {
      bookingNumber,
      serialNumber,
      nameOfPersonnel,
      returnDate: returnDate || "Not yet recorded",
    });

    // Validate return date if provided
    if (returnDate && new Date(returnDate) <= new Date(dateOfBooking)) {
      return NextResponse.json(
        { error: "Return date must be after booking date" },
        { status: 400 },
      );
    }

    // Determine status based on return date
    let status = "active";
    if (returnDate) {
      const today = new Date();
      const returnDateObj = new Date(returnDate);
      if (today > returnDateObj) {
        status = "overdue";
      } else {
        status = "returned";
      }
    }

    const newBooking = new RifleBooking({
      bookingNumber,
      typeOfRifle,
      rifleNumber,
      ammunitionType,
      numberOfAmmunition,
      dateOfBooking: new Date(dateOfBooking),
      typeOfDuty,
      returnDate: returnDate ? new Date(returnDate) : null,
      serialNumber,
      nameOfPersonnel,
      receivedBy,
      issuedBy,
      sdNumber,
      status,
    });

    await newBooking.save();
    console.log("[v0] Rifle booking created successfully");

    return NextResponse.json(
      {
        message: "Rifle booking created successfully",
        booking: newBooking,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create rifle booking error:", error);
    if (error.code === 11000) {
      return NextResponse.json(
        { error: "Serial number already exists" },
        { status: 400 },
      );
    }
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create rifle booking" },
      { status: 500 },
    );
  }
}
