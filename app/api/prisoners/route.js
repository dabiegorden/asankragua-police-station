import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Prisoner from "@/models/Prisoner";

async function getPrisoners(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page")) || 1;
    const limit = Number.parseInt(searchParams.get("limit")) || 10;
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { prisonerNumber: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const prisoners = await Prisoner.find(query)
      .populate("caseId", "caseNumber title")
      .populate("releaseDetails.releasedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Prisoner.countDocuments(query);

    return NextResponse.json({
      prisoners,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get prisoners error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prisoners" },
      { status: 500 },
    );
  }
}

async function createPrisoner(request) {
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

    console.log("[v0] Creating prisoner with data:", {
      arrestingOfficer: arrestDetails.arrestingOfficer,
      status,
      cellNumber,
    });

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
    console.log("[v0] Prisoner created successfully");

    const populatedPrisoner = await Prisoner.findById(newPrisoner._id).populate(
      "caseId",
      "caseNumber title",
    );

    return NextResponse.json(
      {
        message: "Person detained record created successfully",
        prisoner: populatedPrisoner,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create prisoner error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
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

export const GET = requireAuth(getPrisoners);
export const POST = requireRole(["admin", "officer"])(createPrisoner);
