import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Evidence from "@/models/Evidence";

async function getEvidence(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page")) || 1;
    const limit = Number.parseInt(searchParams.get("limit")) || 10;
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const caseId = searchParams.get("caseId");
    const search = searchParams.get("search");

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (caseId) query.caseId = caseId;
    if (search) {
      query.$or = [
        { evidenceNumber: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const evidence = await Evidence.find(query)
      .populate("caseId", "caseNumber title")
      .populate("collectedBy", "firstName lastName badgeNumber")
      .populate("chainOfCustody.handledBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Evidence.countDocuments(query);

    return NextResponse.json({
      evidence,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get evidence error:", error);
    return NextResponse.json(
      { error: "Failed to fetch evidence" },
      { status: 500 },
    );
  }
}

async function createEvidence(request) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      caseId,
      type,
      description,
      location,
      collectionLocation,
      storageLocation,
      files,
      tags,
      notes,
      status,
    } = body;

    if (
      !caseId ||
      !type ||
      !description ||
      !location ||
      !collectionLocation ||
      !storageLocation
    ) {
      return NextResponse.json(
        { error: "All required fields must be provided" },
        { status: 400 },
      );
    }

    // ✅ Generate evidenceNumber manually
    const year = new Date().getFullYear();
    const count = await Evidence.countDocuments();
    const evidenceNumber = `EVD-${year}-${String(count + 1).padStart(4, "0")}`;

    console.log("[v0] Creating evidence with data:", {
      type,
      status: status || "collected",
      evidenceNumber,
    });

    const newEvidence = new Evidence({
      evidenceNumber,
      caseId,
      type,
      description,
      location,
      collectedBy: request.user._id,
      collectionLocation,
      storageLocation,
      status: status || "collected",
      files: files || [],
      tags: tags || [],
      notes,
      chainOfCustody: [
        {
          handledBy: request.user._id,
          action: "collected",
          location: collectionLocation,
          notes: "Initial collection",
        },
      ],
    });

    await newEvidence.save();
    console.log("[v0] Evidence created successfully");

    const populatedEvidence = await Evidence.findById(newEvidence._id)
      .populate("caseId", "caseNumber title")
      .populate("collectedBy", "firstName lastName badgeNumber")
      .populate("chainOfCustody.handledBy", "firstName lastName");

    return NextResponse.json(
      {
        message: "Evidence record created successfully",
        evidence: populatedEvidence,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create evidence error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return NextResponse.json(
        { error: `Validation failed: ${errors.join(", ")}` },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create evidence record" },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getEvidence);
export const POST = requireRole(["admin", "officer"])(createEvidence);
