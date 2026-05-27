import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Vehicle from "@/models/Vehicle";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"];

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Helper: fully populate a vehicle document
async function populateVehicle(id: string) {
  return Vehicle.findById(id)
    .populate("currentDriver", "firstName lastName badgeNumber email")
    .populate(
      "dispatchHistory.dispatchedTo",
      "firstName lastName badgeNumber email",
    )
    .populate("dispatchHistory.dispatchedBy", "firstName lastName")
    .populate("assignmentHistory.assignedTo", "firstName lastName badgeNumber")
    .populate("fuelHistory.filledBy", "firstName lastName")
    .populate("returnHistory.returnedBy", "firstName lastName");
}

// ── GET /api/vehicles/[id] ─────────────────────────────────────────────────
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
    const vehicle = await populateVehicle(id);
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

// ── PUT /api/vehicles/[id] ─────────────────────────────────────────────────
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

    // ── Dispatch vehicle to an operation ───────────────────────────────────
    if (action === "dispatch-vehicle") {
      const {
        // linked user (optional)
        dispatchedToUserId,
        // manual driver details (all optional)
        driverName,
        driverBadgeNumber,
        driverPhone,
        driverEmail,
        driverRank,
        driverUnit,
        // operation info (all optional)
        destination,
        operationName,
        operationType,
        purpose,
        expectedReturnDate,
        notes: dispatchNotes,
      } = updateData;

      vehicle.dispatchHistory.push({
        dispatchedTo: dispatchedToUserId || null,
        driverDetails: {
          name: driverName || "",
          badgeNumber: driverBadgeNumber || "",
          phone: driverPhone || "",
          email: driverEmail || "",
          rank: driverRank || "",
          unit: driverUnit || "",
        },
        destination: destination || "",
        operationName: operationName || "",
        operationType: operationType || "patrol",
        purpose: purpose || "",
        dispatchedDate: new Date(),
        expectedReturnDate: expectedReturnDate
          ? new Date(expectedReturnDate)
          : null,
        startMileage: vehicle.mileage,
        dispatchedBy: user.userId,
        notes: dispatchNotes || "",
      });

      // If a linked user was supplied, track them as current driver
      if (dispatchedToUserId) {
        vehicle.currentDriver = dispatchedToUserId;
      }
      vehicle.status = "in-use";
    }

    // ── Return vehicle ─────────────────────────────────────────────────────
    else if (action === "return-vehicle") {
      const {
        location,
        driverName,
        duty,
        fuelLevelOnReturn,
        returnTime,
        conditionNotes,
        endMileage,
      } = updateData;

      if (!location || !driverName || !duty) {
        return NextResponse.json(
          {
            error:
              "location, driverName and duty are required to return a vehicle",
          },
          { status: 400 },
        );
      }

      // Close the last open dispatch record
      const lastDispatch =
        vehicle.dispatchHistory[vehicle.dispatchHistory.length - 1];
      if (lastDispatch && !lastDispatch.returnedDate) {
        lastDispatch.returnedDate = new Date();
        if (endMileage) lastDispatch.endMileage = endMileage;
      }

      // Close legacy assignment record if present
      const lastAssignment =
        vehicle.assignmentHistory[vehicle.assignmentHistory.length - 1];
      if (lastAssignment && !lastAssignment.returnedDate) {
        lastAssignment.returnedDate = new Date();
        if (endMileage) lastAssignment.endMileage = endMileage;
      }

      vehicle.returnHistory.push({
        returnedDate: new Date(),
        location,
        driverName,
        duty,
        fuelLevelOnReturn: fuelLevelOnReturn || "",
        returnTime: returnTime || "",
        conditionNotes: conditionNotes || "",
        endMileage: endMileage || null,
        returnedBy: user.userId,
      });

      vehicle.currentDriver = null;
      vehicle.status = "available";
      if (endMileage) vehicle.mileage = endMileage;
    }

    // ── Add maintenance record ─────────────────────────────────────────────
    else if (action === "add-maintenance") {
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
    }

    // ── Add fuel record ────────────────────────────────────────────────────
    else if (action === "add-fuel") {
      vehicle.fuelHistory.push({
        amount: updateData.amount,
        cost: updateData.cost,
        mileage: updateData.mileage,
        filledBy: user.userId,
      });
      if (updateData.newFuelLevel !== undefined) {
        vehicle.fuelLevel = updateData.newFuelLevel;
      }
    }

    // ── Legacy assign-driver (kept for backward-compat) ───────────────────
    else if (action === "assign-driver") {
      vehicle.currentDriver = updateData.driverId;
      vehicle.status = "in-use";
      vehicle.assignmentHistory.push({
        assignedTo: updateData.driverId,
        assignedDate: new Date(),
        purpose: updateData.purpose || "Patrol duty",
        startMileage: vehicle.mileage,
      });
    }

    // ── Generic field update ───────────────────────────────────────────────
    else {
      const PROTECTED = [
        "_id",
        "vehicleNumber",
        "dispatchHistory",
        "returnHistory",
        "assignmentHistory",
        "fuelHistory",
        "maintenanceHistory",
      ];
      Object.keys(updateData).forEach((key) => {
        if (!PROTECTED.includes(key) && updateData[key] !== undefined) {
          vehicle[key] = updateData[key];
        }
      });
    }

    await vehicle.save();
    const updatedVehicle = await populateVehicle(id);

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

// ── DELETE /api/vehicles/[id] ──────────────────────────────────────────────
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
