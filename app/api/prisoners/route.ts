// app/api/prisoners/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Prisoner, {
  IPrisoner,
  IArrestDetails,
  IAddress,
  IEmergencyContact,
  IMedicalInfo,
  IPersonalEffect,
} from "@/models/Prisoner";

import mongoose from "mongoose";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// ─── Query params type ─────────────────────────────────────────────────────
interface PrisonerQuery {
  status?: string;
  cellNumber?: string;
  $or?: Array<{
    firstName?: { $regex: string; $options: string };
    lastName?: { $regex: string; $options: string };
    prisonerNumber?: { $regex: string; $options: string };
  }>;
}

// ─── GET /api/prisoners ────────────────────────────────────────────────────
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
    const status = searchParams.get("status");
    const cellNumber = searchParams.get("cellNumber");
    const search = searchParams.get("search");

    const query: PrisonerQuery = {};

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
        .populate("arrestDetails.arrestingOfficer", "fullName email role")
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

// ─── Request body types ────────────────────────────────────────────────────
interface CreatePrisonerArrestDetails {
  arrestDate: string;
  arrestLocation: string;
  arrestingOfficer?: string;
  otherArrestingOfficer?: string;
  charges?: Array<{ charge: string; severity?: "misdemeanor" | "felony" }>;
}

interface CreatePrisonerBody {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  nationality?: string;
  address?: IAddress;
  phoneNumber?: string;
  emergencyContact?: IEmergencyContact;
  arrestDetails: CreatePrisonerArrestDetails;
  caseId?: string;
  otherCase?: string;
  cellNumber: "Male" | "Female";
  status?: "Jailed" | "Bailed" | "Remanded" | "Transferred";
  briefNote?: string;
  medicalInfo?: IMedicalInfo;
  personalEffects?: IPersonalEffect[];
  mugshot?: string;
}

// ─── POST /api/prisoners ───────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const body = (await request.json()) as CreatePrisonerBody;
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
      otherCase,
      cellNumber,
      status,
      briefNote,
      medicalInfo,
      personalEffects,
      mugshot,
    } = body;

    // Validate required fields
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
    if (!arrestDetails.arrestDate || !arrestDetails.arrestLocation) {
      return NextResponse.json(
        {
          error: "Missing required arrest details: arrestDate, arrestLocation",
        },
        { status: 400 },
      );
    }

    // Must have EITHER a known officer id OR an "others" free-text name
    const hasOfficerId =
      arrestDetails.arrestingOfficer &&
      arrestDetails.arrestingOfficer !== "others";
    const hasOtherOfficer = !!arrestDetails.otherArrestingOfficer?.trim();

    if (!hasOfficerId && !hasOtherOfficer) {
      return NextResponse.json(
        {
          error:
            "Please select an arresting officer or provide a name under 'Others'.",
        },
        { status: 400 },
      );
    }

    // Validate cellNumber
    if (!cellNumber || !["Male", "Female"].includes(cellNumber)) {
      return NextResponse.json(
        { error: "Invalid cellNumber. Must be either 'Male' or 'Female'" },
        { status: 400 },
      );
    }

    // Validate status
    if (
      status &&
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
        arrestDate: new Date(arrestDetails.arrestDate),
        arrestLocation: arrestDetails.arrestLocation,
        arrestingOfficer: hasOfficerId ? arrestDetails.arrestingOfficer : null,
        otherArrestingOfficer: hasOfficerId
          ? ""
          : (arrestDetails.otherArrestingOfficer?.trim() ?? ""),
        charges: arrestDetails.charges || [],
      } as IArrestDetails,
      caseId:
        caseId && caseId !== "none" && caseId !== "others" ? caseId : null,
      otherCase: caseId === "others" ? (otherCase?.trim() ?? "") : "",
      cellNumber,
      status: status || "Jailed",
      briefNote: briefNote || "",
      medicalInfo: medicalInfo || {},
      personalEffects: personalEffects || [],
      mugshot: mugshot || null,
    });

    await newPrisoner.save();

    const populatedPrisoner = await Prisoner.findById(newPrisoner._id)
      .populate("caseId", "caseNumber title")
      .populate("arrestDetails.arrestingOfficer", "fullName email role")
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
    if (err instanceof Error && err.name === "ValidationError") {
      const validationError = err as mongoose.Error.ValidationError;
      const errors = Object.values(validationError.errors).map(
        (e: mongoose.Error.ValidatorError | mongoose.Error.CastError) => e.message,
      );
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