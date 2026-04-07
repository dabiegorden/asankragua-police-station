import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Schedule from "@/models/Schedule";
import mongoose from "mongoose";

async function getSchedules(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page")) || 1;
    const limit = Number.parseInt(searchParams.get("limit")) || 10;
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate && endDate) {
      query.startDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const skip = (page - 1) * limit;

    const schedules = await Schedule.find(query)
      .populate("assignedPersonnel", "firstName lastName badgeNumber")
      .populate("createdBy", "firstName lastName")
      .populate("relatedCase", "caseNumber title")
      .populate("vehicleAssigned", "vehicleNumber licensePlate")
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Schedule.countDocuments(query);

    return NextResponse.json({
      schedules,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get schedules error:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 },
    );
  }
}

async function createSchedule(request) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      title,
      description,
      type,
      startDate,
      endDate,
      assignedPersonnel,
      location,
      priority,
      relatedCase,
      vehicleAssigned,
      recurrence,
    } = body;

    if (!title || !type || !startDate || !endDate || !location) {
      return NextResponse.json(
        { error: "All required fields must be provided" },
        { status: 400 },
      );
    }

    const sanitizedVehicleAssigned =
      vehicleAssigned && mongoose.Types.ObjectId.isValid(vehicleAssigned)
        ? new mongoose.Types.ObjectId(vehicleAssigned)
        : undefined;

    const sanitizedRelatedCase =
      relatedCase && mongoose.Types.ObjectId.isValid(relatedCase)
        ? new mongoose.Types.ObjectId(relatedCase)
        : undefined;

    const newSchedule = new Schedule({
      title,
      description,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      assignedPersonnel: assignedPersonnel || [],
      location,
      priority: priority || "medium",
      createdBy: request.user._id,
      relatedCase: sanitizedRelatedCase,
      vehicleAssigned: sanitizedVehicleAssigned,
      recurrence,
    });

    await newSchedule.save();

    const populatedSchedule = await Schedule.findById(newSchedule._id)
      .populate("assignedPersonnel", "firstName lastName badgeNumber")
      .populate("createdBy", "firstName lastName")
      .populate("relatedCase", "caseNumber title")
      .populate("vehicleAssigned", "vehicleNumber licensePlate");

    return NextResponse.json(
      {
        message: "Schedule created successfully",
        schedule: populatedSchedule,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create schedule error:", error);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getSchedules);
export const POST = requireRole(["admin", "officer"])(createSchedule);
