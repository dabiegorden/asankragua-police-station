import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Vehicle from "@/models/Vehicle";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"];

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getVehicleById(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    await connectDB();

    const vehicle = await Vehicle.findById(id)
      .populate("currentDriver", "firstName lastName badgeNumber email")
      .populate(
        "assignmentHistory.assignedTo",
        "firstName lastName badgeNumber",
      )
      .populate("fuelHistory.filledBy", "firstName lastName")
      .populate("returnHistory.returnedBy", "firstName lastName");

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    return NextResponse.json({ vehicle });
  } catch (err) {
    console.error("Get vehicle by ID error:", err);
    return NextResponse.json(
      { error: "Failed to fetch vehicle" },
      { status: 500 },
    );
  }
}

async function updateVehicle(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
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
        nextServiceDue: updateData.nextServiceDue
          ? new Date(updateData.nextServiceDue)
          : undefined,
      });
    } else if (action === "add-fuel") {
      vehicle.fuelHistory.push({
        amount: updateData.amount,
        cost: updateData.cost,
        mileage: updateData.mileage,
        filledBy: user.userId,
      });
      if (updateData.newFuelLevel !== undefined) {
        vehicle.fuelLevel = updateData.newFuelLevel;
      }
    } else if (action === "assign-driver") {
      vehicle.currentDriver = updateData.driverId;
      vehicle.status = "in-use";
      vehicle.assignmentHistory.push({
        assignedTo: updateData.driverId,
        assignedDate: new Date(),
        purpose: updateData.purpose || "Patrol duty",
        startMileage: vehicle.mileage,
      });
    } else if (action === "return-vehicle") {
      // Update last open assignment
      const lastAssignment =
        vehicle.assignmentHistory[vehicle.assignmentHistory.length - 1];
      if (lastAssignment && !lastAssignment.returnedDate) {
        lastAssignment.returnedDate = new Date();
        lastAssignment.endMileage = updateData.endMileage;
      }
      vehicle.currentDriver = null;
      vehicle.status = "available";
      if (updateData.endMileage) {
        vehicle.mileage = updateData.endMileage;
      }

      // Log a full return record
      vehicle.returnHistory.push({
        returnedDate: new Date(),
        location: updateData.location,
        driverName: updateData.driverName,
        duty: updateData.duty,
        fuelLevelOnReturn: updateData.fuelLevelOnReturn || "",
        returnTime: updateData.returnTime || "",
        conditionNotes: updateData.conditionNotes || "",
        returnedBy: user.userId,
      });
    } else {
      // Regular field update
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
      .populate("fuelHistory.filledBy", "firstName lastName")
      .populate("returnHistory.returnedBy", "firstName lastName");

    return NextResponse.json({
      message: "Vehicle updated successfully",
      vehicle: updatedVehicle,
    });
  } catch (err) {
    console.error("Update vehicle error:", err);
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 },
    );
  }
}

async function deleteVehicle(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    await connectDB();

    const vehicle = await Vehicle.findByIdAndDelete(id);
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Vehicle deleted successfully" });
  } catch (err) {
    console.error("Delete vehicle error:", err);
    return NextResponse.json(
      { error: "Failed to delete vehicle" },
      { status: 500 },
    );
  }
}

export const GET = getVehicleById;
export const PUT = updateVehicle;
export const DELETE = deleteVehicle;
