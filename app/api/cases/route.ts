// src/app/api/cases/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import { requireAuth } from "@/middleware/auth";

// ─── Permission helpers ───────────────────────────────────────────────────────

/** Roles that can create / edit / delete cases */
const CAN_MUTATE = ["nco", "so", "admin"];

export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const stage = searchParams.get("stage");

    const query: Record<string, unknown> = {};

    // ── Role-scoped visibility ────────────────────────────────────────────────
    switch (user!.role) {
      case "nco":
        // Sees cases they logged OR still in NCO stage
        query.$or = [{ loggedBy: user!.userId }, { currentStage: "nco" }];
        break;
      case "cid":
        // Only cases assigned to this CID officer
        query.assignedOfficer = user!.userId;
        break;
      case "so":
        // Cases assigned to this SO or currently at SO stage
        query.$or = [{ assignedSO: user!.userId }, { currentStage: "so" }];
        break;
      case "dc":
      case "admin":
        // Full visibility
        break;
    }

    if (status && status !== "all") query.status = status;
    if (category && category !== "all") query.category = category;
    if (stage && stage !== "all") query.currentStage = stage;

    if (search) {
      const rx = { $regex: search, $options: "i" };
      const searchClause = {
        $or: [
          { caseNumber: rx },
          { title: rx },
          { description: rx },
          { "reportedBy.name": rx },
        ],
      };
      if (query.$or) {
        query.$and = [{ $or: query.$or }, searchClause];
        delete query.$or;
      } else {
        Object.assign(query, searchClause);
      }
    }

    const skip = (page - 1) * limit;
    const cases = await Case.find(query)
      .populate("loggedBy", "fullName email role")
      .populate("assignedOfficer", "fullName email role")
      .populate("assignedSO", "fullName email role")
      .populate("assignedDC", "fullName email role")
      .populate("notes.addedBy", "fullName role")
      .populate("progressMessages.fromUser", "fullName role")
      .populate("progressMessages.toUser", "fullName role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Case.countDocuments(query);

    return NextResponse.json({
      cases,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("GET /cases error:", err);
    return NextResponse.json(
      { error: "Failed to fetch cases" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  // NCO and SO (and admin) can create cases
  if (!CAN_MUTATE.includes(user!.role)) {
    return NextResponse.json(
      { error: "Only NCO or Station Officers can log new cases" },
      { status: 403 },
    );
  }

  try {
    await connectDB();

    const body = await req.json();
    const {
      title,
      description,
      category,
      priority,
      reportedBy,
      location,
      dateOccurred,
      suspects,
      witnesses,
      notes,
    } = body;

    if (
      !title ||
      !description ||
      !category ||
      !reportedBy?.name ||
      !location ||
      !dateOccurred
    ) {
      return NextResponse.json(
        {
          error:
            "Required: title, description, category, reportedBy.name, location, dateOccurred",
        },
        { status: 400 },
      );
    }

    const newCase = new Case({
      title,
      description,
      category,
      priority: priority || "Summary Offence",
      reportedBy,
      location,
      dateOccurred: new Date(dateOccurred),
      suspects: suspects || [],
      witnesses: witnesses || [],
      loggedBy: user!.userId,
      currentStage: "nco",
      status: "open",
    });

    if (notes?.trim()) {
      newCase.notes.push({
        content: notes.trim(),
        addedBy: user!.userId,
        roleSnapshot: user!.role,
        addedAt: new Date(),
      });
    }

    await newCase.save();

    const populated = await populateCase(newCase._id.toString());
    return NextResponse.json(
      { message: "Case created successfully", case: populated },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /cases error:", err);
    return NextResponse.json(
      { error: "Failed to create case" },
      { status: 500 },
    );
  }
}

// ─── Shared populate helper (exported for [id]/route.ts) ─────────────────────
export async function populateCase(id: string) {
  return Case.findById(id)
    .populate("loggedBy", "fullName email role")
    .populate("assignedOfficer", "fullName email role")
    .populate("assignedSO", "fullName email role")
    .populate("assignedDC", "fullName email role")
    .populate("notes.addedBy", "fullName role")
    .populate("progressMessages.fromUser", "fullName role")
    .populate("progressMessages.toUser", "fullName role");
}
