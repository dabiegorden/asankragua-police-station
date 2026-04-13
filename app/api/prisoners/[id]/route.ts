// app/api/prisoners/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Prisoner, {
  IPrisoner,
  IArrestDetails,
  IAddress,
  IEmergencyContact,
  IMedicalInfo,
  IReleaseDetails,
} from "@/models/Prisoner";
import mongoose from "mongoose";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

type RouteContext = { params: Promise<{ id: string }> };

// ─── Update body types ─────────────────────────────────────────────────────
interface UpdatePrisonerArrestDetails {
  arrestDate?: string;
  arrestLocation?: string;
  arrestingOfficer?: string;
  otherArrestingOfficer?: string;
  charges?: Array<{ charge: string; severity?: "misdemeanor" | "felony" }>;
}

interface UpdatePrisonerBody extends Partial<Omit<IPrisoner, "dateOfBirth" | "arrestDetails">> {
  dateOfBirth?: string;
  arrestDetails?: UpdatePrisonerArrestDetails;
  address?: IAddress;
  emergencyContact?: IEmergencyContact;
  medicalInfo?: IMedicalInfo;
  action?: "release" | "add-visitor";
  releaseType?: "bail" | "court-order" | "charges-dropped" | "sentence-completed";
  bailAmount?: number;
  notes?: string;
  visitorName?: string;
  relationship?: string;
  duration?: number;
  otherCase?: string;
}

// ─── GET /api/prisoners/[id] ───────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const prisoner = await Prisoner.findById(id)
      .populate("caseId", "caseNumber title status")
      .populate("arrestDetails.arrestingOfficer", "fullName email role")
      .populate("releaseDetails.releasedBy", "firstName lastName badgeNumber");

    if (!prisoner) {
      return NextResponse.json(
        { error: "Person detained not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ prisoner });
  } catch (err) {
    console.error("Get prisoner by ID error:", err);
    return NextResponse.json(
      { error: "Failed to fetch prisoner" },
      { status: 500 },
    );
  }
}

// ─── PUT /api/prisoners/[id] ───────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const body = (await request.json()) as UpdatePrisonerBody;
    const { action, otherCase, ...updateData } = body;

    const prisoner = await Prisoner.findById(id);
    if (!prisoner) {
      return NextResponse.json(
        { error: "Person detained not found" },
        { status: 404 },
      );
    }

    // Validate cellNumber if provided
    if (
      updateData.cellNumber &&
      !["Male", "Female"].includes(updateData.cellNumber)
    ) {
      return NextResponse.json(
        { error: "Invalid cellNumber. Must be either 'Male' or 'Female'" },
        { status: 400 },
      );
    }

    // Validate status if provided
    if (
      updateData.status &&
      !["Jailed", "Bailed", "Remanded", "Transferred"].includes(
        updateData.status,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Must be one of: Jailed, Bailed, Remanded, Transferred",
        },
        { status: 400 },
      );
    }

    // Convert dates if present
    if (updateData.dateOfBirth) {
      (updateData as Record<string, unknown>).dateOfBirth = new Date(
        updateData.dateOfBirth,
      );
    }

    if (action === "release") {
      prisoner.status = "Bailed";
      prisoner.releaseDetails = {
        releaseDate: new Date(),
        releaseType: updateData.releaseType,
        releasedBy: user.userId,
        bailAmount: updateData.bailAmount,
        notes: updateData.notes,
      } as unknown as IReleaseDetails;
    } else if (action === "add-visitor") {
      prisoner.visitorLog = prisoner.visitorLog || [];
      prisoner.visitorLog.push({
        visitorName: updateData.visitorName,
        relationship: updateData.relationship,
        visitDate: new Date(),
        duration: updateData.duration,
        notes: updateData.notes,
      });
    } else {
      // Handle arrestDetails update
      if (updateData.arrestDetails) {
        const ad = updateData.arrestDetails;
        const hasOfficerId =
          ad.arrestingOfficer && ad.arrestingOfficer !== "others";
        const hasOtherOfficer = !!ad.otherArrestingOfficer?.trim();

        const currentArrestDetails = prisoner.arrestDetails as IArrestDetails;

        prisoner.arrestDetails = {
          ...currentArrestDetails,
          ...ad,
          arrestDate: ad.arrestDate
            ? new Date(ad.arrestDate)
            : currentArrestDetails.arrestDate,
          arrestingOfficer: hasOfficerId
            ? (ad.arrestingOfficer as unknown as mongoose.Types.ObjectId)
            : null,
          otherArrestingOfficer: hasOfficerId
            ? ""
            : (ad.otherArrestingOfficer?.trim() ??
              currentArrestDetails.otherArrestingOfficer ??
              ""),
        } as IArrestDetails;
      }

      // Handle caseId / otherCase update
      if ("caseId" in updateData) {
        const newCaseId = updateData.caseId as unknown as string | mongoose.Types.ObjectId | null;
        if (newCaseId === "others") {
          prisoner.caseId = null;
          prisoner.otherCase = otherCase?.trim() ?? "";
        } else if (!newCaseId || newCaseId === "none") {
          prisoner.caseId = null;
          prisoner.otherCase = "";
        } else {
          prisoner.caseId = newCaseId as unknown as mongoose.Types.ObjectId;
          prisoner.otherCase = "";
        }
        delete (updateData as Record<string, unknown>).caseId;
      }

      // Handle remaining nested objects
      if (updateData.address) {
        prisoner.address = {
          ...(prisoner.address as IAddress),
          ...updateData.address,
        };
        delete updateData.address;
      }
      if (updateData.emergencyContact) {
        prisoner.emergencyContact = {
          ...(prisoner.emergencyContact as IEmergencyContact),
          ...updateData.emergencyContact,
        };
        delete updateData.emergencyContact;
      }
      if (updateData.medicalInfo) {
        prisoner.medicalInfo = {
          ...(prisoner.medicalInfo as IMedicalInfo),
          ...updateData.medicalInfo,
        };
        delete updateData.medicalInfo;
      }

      // Apply remaining top-level fields
      const NESTED = ["arrestDetails", "address", "emergencyContact", "medicalInfo"];
      Object.keys(updateData).forEach((key) => {
        if (
          updateData[key as keyof typeof updateData] !== undefined &&
          !NESTED.includes(key)
        ) {
          (prisoner as unknown as Record<string, unknown>)[key] =
            updateData[key as keyof typeof updateData];
        }
      });
    }

    await prisoner.save();

    const updatedPrisoner = await Prisoner.findById(id)
      .populate("caseId", "caseNumber title status")
      .populate("arrestDetails.arrestingOfficer", "fullName email role")
      .populate("releaseDetails.releasedBy", "firstName lastName badgeNumber");

    return NextResponse.json({
      message: "Person detained updated successfully",
      prisoner: updatedPrisoner,
    });
  } catch (err) {
    console.error("Update prisoner error:", err);
    if (err instanceof Error && err.name === "ValidationError") {
      const validationError = err as mongoose.Error.ValidationError;
      const errors = Object.keys(validationError.errors).map(
        (key) => validationError.errors[key].message,
      );
      return NextResponse.json(
        { error: `Validation failed: ${errors.join(", ")}` },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update person detained" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/prisoners/[id] ────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const prisoner = await Prisoner.findByIdAndDelete(id);

    if (!prisoner) {
      return NextResponse.json(
        { error: "Person detained not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Person detained record deleted successfully",
    });
  } catch (err) {
    console.error("Delete prisoner error:", err);
    return NextResponse.json(
      { error: "Failed to delete person detained" },
      { status: 500 },
    );
  }
}