import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Schedule, { ISchedule } from "@/models/Schedule";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

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
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const query: Record<string, unknown> = {};

    if (type && type !== "all") query.type = type;
    if (status && status !== "all") query.status = status;
    if (startDate && endDate) {
      query.startDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [schedules, total] = await Promise.all([
      Schedule.find(query)
        .populate("assignedPersonnel", "firstName lastName badgeNumber rank")
        .populate("createdBy", "firstName lastName badgeNumber")
        .populate("relatedCase", "caseNumber title status")
        .populate("vehicleAssigned", "vehicleNumber licensePlate make model")
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(limit),
      Schedule.countDocuments(query),
    ]);

    return NextResponse.json({
      schedules,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Get schedules error:", err);
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 },
    );
  }
}

interface CreateScheduleBody extends Pick<
  ISchedule,
  "title" | "type" | "location"
> {
  description?: string;
  startDate: string;
  endDate: string;
  assignedPersonnel?: string[];
  priority?: ISchedule["priority"];
  relatedCase?: string;
  vehicleAssigned?: string;
  recurrence?: ISchedule["recurrence"];
  notes?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const body = (await request.json()) as CreateScheduleBody;
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
      notes,
    } = body;

    if (!title || !type || !startDate || !endDate || !location) {
      return NextResponse.json(
        { error: "Required fields: title, type, startDate, endDate, location" },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 },
      );
    }
    if (end <= start) {
      return NextResponse.json(
        { error: "End date must be after start date" },
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
      description: description ?? "",
      type,
      startDate: start,
      endDate: end,
      assignedPersonnel: assignedPersonnel ?? [],
      location,
      priority: priority ?? "medium",
      createdBy: user.userId,
      relatedCase: sanitizedRelatedCase,
      vehicleAssigned: sanitizedVehicleAssigned,
      recurrence: recurrence ?? { type: "none", interval: 1 },
      notes: notes ?? "",
      status: "scheduled",
    });

    await newSchedule.save();

    const populated = await Schedule.findById(newSchedule._id)
      .populate("assignedPersonnel", "firstName lastName badgeNumber rank")
      .populate("createdBy", "firstName lastName badgeNumber")
      .populate("relatedCase", "caseNumber title status")
      .populate("vehicleAssigned", "vehicleNumber licensePlate make model");

    return NextResponse.json(
      { message: "Schedule created successfully", schedule: populated },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create schedule error:", err);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 },
    );
  }
}
