import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Schedule from "@/models/Schedule";

async function getScheduleById(request, { params }) {
  const { id } = await params;

  try {
    await connectDB();

    const schedule = await Schedule.findById(id)
      .populate("assignedPersonnel", "firstName lastName badgeNumber email")
      .populate("createdBy", "firstName lastName badgeNumber")
      .populate("relatedCase", "caseNumber title status")
      .populate("vehicleAssigned", "vehicleNumber licensePlate make model")
      .populate("attendees.user", "firstName lastName badgeNumber");

    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("Get schedule error:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 },
    );
  }
}

async function updateSchedule(request, { params }) {
  const { id } = await params;

  try {
    await connectDB();
    const body = await request.json();
    const { action, ...updateData } = body;

    const schedule = await Schedule.findById(id);
    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 },
      );
    }

    if (action === "respond-invitation") {
      const attendeeIndex = schedule.attendees.findIndex(
        (attendee) => attendee.user.toString() === request.user._id.toString(),
      );

      if (attendeeIndex !== -1) {
        schedule.attendees[attendeeIndex].status = updateData.response;
        schedule.attendees[attendeeIndex].responseDate = new Date();
      }
    } else {
      Object.keys(updateData).forEach((key) => {
        const value = updateData[key];

        // Skip undefined values
        if (value === undefined) return;

        // Safely handle ObjectId fields
        if (["relatedCase", "vehicleAssigned"].includes(key)) {
          if (value && mongoose.Types.ObjectId.isValid(value)) {
            schedule[key] = value;
          } else {
            schedule[key] = undefined; // Or null if you prefer
          }
          return;
        }

        if (["startDate", "endDate"].includes(key)) {
          schedule[key] = new Date(value);
          return;
        }

        schedule[key] = value;
      });
    }

    await schedule.save();

    const updatedSchedule = await Schedule.findById(id)
      .populate("assignedPersonnel", "firstName lastName badgeNumber email")
      .populate("createdBy", "firstName lastName badgeNumber")
      .populate("relatedCase", "caseNumber title status")
      .populate("vehicleAssigned", "vehicleNumber licensePlate make model")
      .populate("attendees.user", "firstName lastName badgeNumber");

    return NextResponse.json({
      message: "Schedule updated successfully",
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error("Update schedule error:", error);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 },
    );
  }
}

async function deleteSchedule(request, { params }) {
  const { id } = await params;

  try {
    await connectDB();
    const schedule = await Schedule.findById(id);

    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 },
      );
    }

    if (
      request.user.role !== "admin" &&
      schedule.createdBy.toString() !== request.user._id.toString()
    ) {
      return NextResponse.json(
        { error: "Insufficient permissions to delete this schedule" },
        { status: 403 },
      );
    }

    await Schedule.findByIdAndDelete(id);
    return NextResponse.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Delete schedule error:", error);
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getScheduleById);
export const PUT = requireRole(["admin", "officer"])(updateSchedule);
export const DELETE = requireRole(["admin", "officer"])(deleteSchedule);
