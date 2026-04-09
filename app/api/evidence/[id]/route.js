import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Evidence from "@/models/Evidence";
import { requireAuth } from "@/middleware/auth";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"];

async function getEvidenceById(request, { params }) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await connectDB();
    const evidence = await Evidence.findById(id)
      .populate("caseId", "caseNumber title status")
      .populate("collectedBy", "firstName lastName badgeNumber email")
      .populate("chainOfCustody.handledBy", "firstName lastName badgeNumber");

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ evidence });
  } catch (err) {
    console.error("Get evidence by ID error:", err);
    return NextResponse.json(
      { error: "Failed to fetch evidence" },
      { status: 500 },
    );
  }
}

async function updateEvidence(request, { params }) {
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

    const evidence = await Evidence.findById(id);
    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 },
      );
    }

    // Handle special actions
    if (action === "add-custody-entry") {
      evidence.chainOfCustody.push({
        handledBy: user._id,
        action: updateData.custodyAction,
        location: updateData.location,
        notes: updateData.notes,
      });
    } else if (action === "add-analysis") {
      evidence.analysisResults.push({
        analysisType: updateData.analysisType,
        performedBy: updateData.performedBy,
        date: new Date(updateData.date),
        results: updateData.results,
        reportFile: updateData.reportFile,
      });
    } else {
      // Regular update - only allow certain fields to be updated
      const allowedUpdates = [
        "description",
        "location",
        "storageLocation",
        "status",
        "tags",
        "notes",
      ];
      allowedUpdates.forEach((key) => {
        if (updateData[key] !== undefined) {
          evidence[key] = updateData[key];
        }
      });
    }

    await evidence.save();

    const updatedEvidence = await Evidence.findById(id)
      .populate("caseId", "caseNumber title status")
      .populate("collectedBy", "firstName lastName badgeNumber email")
      .populate("chainOfCustody.handledBy", "firstName lastName badgeNumber");

    return NextResponse.json({
      message: "Evidence updated successfully",
      evidence: updatedEvidence,
    });
  } catch (err) {
    console.error("Update evidence error:", err);
    return NextResponse.json(
      { error: "Failed to update evidence" },
      { status: 500 },
    );
  }
}

async function deleteEvidence(request, { params }) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  // Only admin can delete evidence
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await connectDB();
    const evidence = await Evidence.findByIdAndDelete(id);
    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ message: "Evidence deleted successfully" });
  } catch (err) {
    console.error("Delete evidence error:", err);
    return NextResponse.json(
      { error: "Failed to delete evidence" },
      { status: 500 },
    );
  }
}

export const GET = getEvidenceById;
export const PUT = updateEvidence;
export const DELETE = deleteEvidence;
