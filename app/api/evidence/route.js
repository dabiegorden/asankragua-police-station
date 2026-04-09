import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Evidence from "@/models/Evidence";

// Roles allowed to manage evidence (same as personnel)
const ALLOWED_ROLES = ["admin", "nco", "so", "dc"];

async function getEvidence(request) {
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
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const caseId = searchParams.get("caseId");
    const search = searchParams.get("search");

    const query = {};

    if (type && type !== "all") query.type = type;
    if (status && status !== "all") query.status = status;
    if (caseId && caseId !== "all") query.caseId = caseId;

    if (search) {
      query.$or = [
        { evidenceNumber: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [evidence, total] = await Promise.all([
      Evidence.find(query)
        .populate("caseId", "caseNumber title status")
        .populate("collectedBy", "firstName lastName badgeNumber")
        .populate("chainOfCustody.handledBy", "firstName lastName badgeNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Evidence.countDocuments(query),
    ]);

    return NextResponse.json({
      evidence,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get evidence error:", err);
    return NextResponse.json(
      { error: "Failed to fetch evidence" },
      { status: 500 },
    );
  }
}

async function createEvidence(request) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
        {
          error:
            "Required fields: caseId, type, description, location, collectionLocation, storageLocation",
        },
        { status: 400 },
      );
    }

    // Generate evidenceNumber manually
    const year = new Date().getFullYear();
    const count = await Evidence.countDocuments();
    const evidenceNumber = `EVD-${year}-${String(count + 1).padStart(4, "0")}`;

    const newEvidence = new Evidence({
      evidenceNumber,
      caseId,
      type,
      description,
      location,
      collectedBy: user._id,
      collectionLocation,
      storageLocation,
      status: status || "collected",
      files: files || [],
      tags: tags || [],
      notes: notes || "",
      chainOfCustody: [
        {
          handledBy: user._id,
          action: "collected",
          location: collectionLocation,
          notes: "Initial collection",
        },
      ],
    });

    await newEvidence.save();

    const populatedEvidence = await Evidence.findById(newEvidence._id)
      .populate("caseId", "caseNumber title status")
      .populate("collectedBy", "firstName lastName badgeNumber")
      .populate("chainOfCustody.handledBy", "firstName lastName badgeNumber");

    return NextResponse.json(
      {
        message: "Evidence created successfully",
        evidence: populatedEvidence,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create evidence error:", err);
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
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

export const GET = getEvidence;
export const POST = createEvidence;
