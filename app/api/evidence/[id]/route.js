import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Evidence from "@/models/Evidence";

async function getEvidenceById(request, { params }) {
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
  } catch (error) {
    console.error("Get evidence error:", error);
    return NextResponse.json(
      { error: "Failed to fetch evidence" },
      { status: 500 },
    );
  }
}

async function updateEvidence(request, { params }) {
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

    if (action === "add-custody-entry") {
      evidence.chainOfCustody.push({
        handledBy: request.user._id,
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
      // Regular update
      Object.keys(updateData).forEach((key) => {
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
  } catch (error) {
    console.error("Update evidence error:", error);
    return NextResponse.json(
      { error: "Failed to update evidence" },
      { status: 500 },
    );
  }
}

async function deleteEvidence(request, { params }) {
  const { id } = await params;

  try {
    await connectDB();

    const evidence = await Evidence.findById(id);

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 },
      );
    }

    await Evidence.findByIdAndDelete(id);

    return NextResponse.json({ message: "Evidence deleted successfully" });
  } catch (error) {
    console.error("Delete evidence error:", error);
    return NextResponse.json(
      { error: "Failed to delete evidence" },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getEvidenceById);
export const PUT = requireRole(["admin", "officer"])(updateEvidence);
export const DELETE = requireRole(["admin"])(deleteEvidence);
