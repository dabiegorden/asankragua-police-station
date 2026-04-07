import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import RifleBooking from "@/models/RifleBooking";

// GET - Fetch a single rifle booking by ID
export async function GET(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    const booking = await RifleBooking.findById(id);

    if (!booking) {
      return NextResponse.json(
        { error: "Rifle booking not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("Fetch rifle booking error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rifle booking" },
      { status: 500 },
    );
  }
}

// PUT - Update a rifle booking
export async function PUT(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    const booking = await RifleBooking.findById(id);

    if (!booking) {
      return NextResponse.json(
        { error: "Rifle booking not found" },
        { status: 404 },
      );
    }

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
      status,
    } = body;

    // Update fields
    if (typeOfRifle !== undefined) booking.typeOfRifle = typeOfRifle;
    if (rifleNumber !== undefined) booking.rifleNumber = rifleNumber;
    if (ammunitionType !== undefined) booking.ammunitionType = ammunitionType;
    if (numberOfAmmunition !== undefined)
      booking.numberOfAmmunition = numberOfAmmunition;
    if (dateOfBooking !== undefined)
      booking.dateOfBooking = new Date(dateOfBooking);
    if (typeOfDuty !== undefined) booking.typeOfDuty = typeOfDuty;
    if (returnDate !== undefined) booking.returnDate = new Date(returnDate);
    if (serialNumber !== undefined) booking.serialNumber = serialNumber;
    if (nameOfPersonnel !== undefined)
      booking.nameOfPersonnel = nameOfPersonnel;
    if (receivedBy !== undefined) booking.receivedBy = receivedBy;
    if (issuedBy !== undefined) booking.issuedBy = issuedBy;
    if (sdNumber !== undefined) booking.sdNumber = sdNumber;
    if (status !== undefined) booking.status = status;

    // Validate return date is after booking date
    if (booking.returnDate <= booking.dateOfBooking) {
      return NextResponse.json(
        { error: "Return date must be after booking date" },
        { status: 400 },
      );
    }

    await booking.save();

    return NextResponse.json({
      message: "Rifle booking updated successfully",
      booking,
    });
  } catch (error) {
    console.error("Update rifle booking error:", error);
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
      { error: "Failed to update rifle booking" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a rifle booking
export async function DELETE(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    const booking = await RifleBooking.findById(id);

    if (!booking) {
      return NextResponse.json(
        { error: "Rifle booking not found" },
        { status: 404 },
      );
    }

    await RifleBooking.findByIdAndDelete(id);

    return NextResponse.json({
      message: "Rifle booking deleted successfully",
    });
  } catch (error) {
    console.error("Delete rifle booking error:", error);
    return NextResponse.json(
      { error: "Failed to delete rifle booking" },
      { status: 500 },
    );
  }
}
