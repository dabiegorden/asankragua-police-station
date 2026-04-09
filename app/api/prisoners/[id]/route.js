import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Prisoner from "@/models/Prisoner";
import { requireAuth } from "@/middleware/auth";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"];

async function getPrisonerById(request, { params }) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await connectDB();
    const prisoner = await Prisoner.findById(id)
      .populate("caseId", "caseNumber title status")
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

async function updatePrisoner(request, { params }) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await connectDB();
    const body = await request.json();
    const { action, ...updateData } = body;

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
        {
          error: "Invalid cellNumber. Must be either 'Male' or 'Female'",
        },
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
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }

    if (action === "release") {
      prisoner.status = "Bailed";
      prisoner.releaseDetails = {
        releaseDate: new Date(),
        releaseType: updateData.releaseType,
        releasedBy: user._id,
        bailAmount: updateData.bailAmount,
        notes: updateData.notes,
      };
    } else if (action === "add-visitor") {
      prisoner.visitorLog.push({
        visitorName: updateData.visitorName,
        relationship: updateData.relationship,
        visitDate: new Date(),
        duration: updateData.duration,
        notes: updateData.notes,
      });
    } else {
      // Handle nested updates for arrestDetails, address, emergencyContact, medicalInfo
      if (updateData.arrestDetails) {
        prisoner.arrestDetails = {
          ...prisoner.arrestDetails,
          ...updateData.arrestDetails,
          arrestDate: updateData.arrestDetails.arrestDate
            ? new Date(updateData.arrestDetails.arrestDate)
            : prisoner.arrestDetails.arrestDate,
        };
      }
      if (updateData.address) {
        prisoner.address = {
          ...prisoner.address,
          ...updateData.address,
        };
      }
      if (updateData.emergencyContact) {
        prisoner.emergencyContact = {
          ...prisoner.emergencyContact,
          ...updateData.emergencyContact,
        };
      }
      if (updateData.medicalInfo) {
        prisoner.medicalInfo = {
          ...prisoner.medicalInfo,
          ...updateData.medicalInfo,
        };
      }
      // Handle top-level fields
      Object.keys(updateData).forEach((key) => {
        if (
          updateData[key] !== undefined &&
          ![
            "arrestDetails",
            "address",
            "emergencyContact",
            "medicalInfo",
          ].includes(key)
        ) {
          prisoner[key] = updateData[key];
        }
      });
    }

    await prisoner.save();

    const updatedPrisoner = await Prisoner.findById(id)
      .populate("caseId", "caseNumber title status")
      .populate("releaseDetails.releasedBy", "firstName lastName badgeNumber");

    return NextResponse.json({
      message: "Person detained updated successfully",
      prisoner: updatedPrisoner,
    });
  } catch (err) {
    console.error("Update prisoner error:", err);
    if (err.name === "ValidationError") {
      const errors = Object.keys(err.errors).map(
        (key) => err.errors[key].message,
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

async function deletePrisoner(request, { params }) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
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

export const GET = getPrisonerById;
export const PUT = updatePrisoner;
export const DELETE = deletePrisoner;
