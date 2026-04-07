import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Vehicle from "@/models/Vehicle";

async function getVehicleById(request, { params }) {
  const { id } = await params;

  try {
    await connectDB();

    const vehicle = await Vehicle.findById(id)
      .populate("currentDriver", "firstName lastName badgeNumber email")
      .populate(
        "assignmentHistory.assignedTo",
        "firstName lastName badgeNumber",
      )
      .populate("fuelHistory.filledBy", "firstName lastName");

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error("Get vehicle error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vehicle" },
      { status: 500 },
    );
  }
}

async function updateVehicle(request, { params }) {
  const { id } = await params;

  try {
    await connectDB();

    const body = await request.json();
    const { action, ...updateData } = body;

    const vehicle = await Vehicle.findById(id);

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    if (action === "add-maintenance") {
      vehicle.maintenanceHistory.push({
        date: new Date(updateData.date),
        type: updateData.maintenanceType,
        description: updateData.description,
        cost: updateData.cost,
        performedBy: updateData.performedBy,
        mileageAtService: updateData.mileageAtService,
      });
    } else if (action === "add-fuel") {
      vehicle.fuelHistory.push({
        amount: updateData.amount,
        cost: updateData.cost,
        mileage: updateData.mileage,
        filledBy: request.user._id,
      });
      vehicle.fuelLevel = updateData.newFuelLevel || vehicle.fuelLevel;
    } else if (action === "assign-driver") {
      vehicle.currentDriver = updateData.driverId;
      vehicle.status = "in-use";
      vehicle.assignmentHistory.push({
        assignedTo: updateData.driverId,
        assignedDate: new Date(),
        purpose: updateData.purpose,
        startMileage: vehicle.mileage,
      });
    } else if (action === "return-vehicle") {
      const lastAssignment =
        vehicle.assignmentHistory[vehicle.assignmentHistory.length - 1];
      if (lastAssignment && !lastAssignment.returnedDate) {
        lastAssignment.returnedDate = new Date();
        lastAssignment.endMileage = updateData.endMileage;
      }
      vehicle.currentDriver = null;
      vehicle.status = "available";
      vehicle.mileage = updateData.endMileage || vehicle.mileage;
    } else {
      // Regular update
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] !== undefined) {
          vehicle[key] = updateData[key];
        }
      });
    }

    await vehicle.save();

    const updatedVehicle = await Vehicle.findById(id)
      .populate("currentDriver", "firstName lastName badgeNumber email")
      .populate(
        "assignmentHistory.assignedTo",
        "firstName lastName badgeNumber",
      )
      .populate("fuelHistory.filledBy", "firstName lastName");

    return NextResponse.json({
      message: "Vehicle updated successfully",
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error("Update vehicle error:", error);
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 },
    );
  }
}

async function deleteVehicle(request, { params }) {
  const { id } = await params;

  try {
    await connectDB();

    const vehicle = await Vehicle.findById(id);

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    await Vehicle.findByIdAndDelete(id);

    return NextResponse.json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    console.error("Delete vehicle error:", error);
    return NextResponse.json(
      { error: "Failed to delete vehicle" },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getVehicleById);
export const PUT = requireRole(["admin", "officer"])(updateVehicle);
export const DELETE = requireRole(["admin"])(deleteVehicle);
