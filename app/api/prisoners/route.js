import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Prisoner from "@/models/Prisoner";

// Roles allowed to manage prisoners (same as personnel management)
const ALLOWED_ROLES = ["admin", "nco", "so", "dc"];

async function getPrisoners(request) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const status = searchParams.get("status");
    const cellNumber = searchParams.get("cellNumber");
    const search = searchParams.get("search");

    const query = {};

    if (status && status !== "all") query.status = status;
    if (cellNumber && cellNumber !== "all") query.cellNumber = cellNumber;

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { prisonerNumber: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [prisoners, total] = await Promise.all([
      Prisoner.find(query)
        .populate("caseId", "caseNumber title status")
        .populate("releaseDetails.releasedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Prisoner.countDocuments(query),
    ]);

    return NextResponse.json({
      prisoners,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get prisoners error:", err);
    return NextResponse.json(
      { error: "Failed to fetch prisoners" },
      { status: 500 },
    );
  }
}

async function createPrisoner(request) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const body = await request.json();
    const {
      firstName,
      lastName,
      middleName,
      dateOfBirth,
      gender,
      nationality,
      address,
      phoneNumber,
      emergencyContact,
      arrestDetails,
      caseId,
      cellNumber,
      status,
      briefNote,
      medicalInfo,
      personalEffects,
      mugshot,
    } = body;

    // Validate top-level required fields
    if (!firstName || !lastName || !dateOfBirth || !gender || !arrestDetails) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: firstName, lastName, dateOfBirth, gender, arrestDetails",
        },
        { status: 400 },
      );
    }

    // Validate nested arrest details
    if (
      !arrestDetails.arrestDate ||
      !arrestDetails.arrestLocation ||
      !arrestDetails.arrestingOfficer
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required arrest details: arrestDate, arrestLocation, arrestingOfficer",
        },
        { status: 400 },
      );
    }

    // Validate cellNumber
    if (!cellNumber || !["Male", "Female"].includes(cellNumber)) {
      return NextResponse.json(
        {
          error: "Invalid cellNumber. Must be either 'Male' or 'Female'",
        },
        { status: 400 },
      );
    }

    // Validate status
    if (
      !status ||
      !["Jailed", "Bailed", "Remanded", "Transferred"].includes(status)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Must be one of: Jailed, Bailed, Remanded, Transferred",
        },
        { status: 400 },
      );
    }

    // Generate prisoner number
    const year = new Date().getFullYear();
    const count = await Prisoner.countDocuments();
    const prisonerNumber = `PRS-${year}-${String(count + 1).padStart(4, "0")}`;

    const newPrisoner = new Prisoner({
      prisonerNumber,
      firstName,
      lastName,
      middleName,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      nationality: nationality || "Ghanaian",
      address: address || {},
      phoneNumber,
      emergencyContact: emergencyContact || {},
      arrestDetails: {
        ...arrestDetails,
        arrestDate: new Date(arrestDetails.arrestDate),
      },
      caseId: caseId || null,
      cellNumber,
      status,
      briefNote: briefNote || "",
      medicalInfo: medicalInfo || {},
      personalEffects: personalEffects || [],
      mugshot: mugshot || null,
    });

    await newPrisoner.save();

    const populatedPrisoner = await Prisoner.findById(newPrisoner._id)
      .populate("caseId", "caseNumber title")
      .populate("releaseDetails.releasedBy", "firstName lastName");

    return NextResponse.json(
      {
        message: "Person detained record created successfully",
        prisoner: populatedPrisoner,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create prisoner error:", err);
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      return NextResponse.json(
        { error: `Validation failed: ${errors.join(", ")}` },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create person detained record" },
      { status: 500 },
    );
  }
}

export const GET = getPrisoners;
export const POST = createPrisoner;
