// src/app/api/cases/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import { requireAuth } from "@/middleware/auth";
import { parseAttachments } from "@/lib/parseAttachments";
import mongoose from "mongoose";

console.log("DB STATE:", mongoose.connection.readyState);

// ─── Shared populate ──────────────────────────────────────────────────────────
export async function populateCase(id: string) {
  return Case.findById(id)
    .populate("loggedBy", "fullName email role")
    .populate("assignedOfficer", "fullName email role")
    .populate("assignedSO", "fullName email role")
    .populate("assignedDC", "fullName email role")
    .populate("notes.addedBy", "fullName role")
    .populate("threadMessages.fromUser", "fullName role");
}

// ─── GET — list cases (role-scoped) ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  if (error) {
    console.error("AUTH ERROR:", error);
    return error;
  }

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const stage = searchParams.get("stage");

    const query: Record<string, unknown> = {};

    // ── Role-scoped visibility ────────────────────────────────────────────────
    switch (user.role) {
      case "nco":
        // NCO sees cases they logged OR cases still at NCO stage
        query.$or = [{ loggedBy: user.userId }, { currentStage: "nco" }];
        break;
      case "cid":
        // CID only sees cases assigned to them
        query.assignedOfficer = user.userId;
        break;
      case "so":
        // SO sees cases assigned to them or at SO stage
        query.$or = [{ assignedSO: user.userId }, { currentStage: "so" }];
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
    const [cases, total] = await Promise.all([
      Case.find(query)
        .populate("loggedBy", "fullName email role")
        .populate("assignedOfficer", "fullName email role")
        .populate("assignedSO", "fullName email role")
        .populate("assignedDC", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Case.countDocuments(query),
    ]);

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

// ─── POST — create new case ───────────────────────────────────────────────────
// Accepts multipart/form-data OR application/json.
// File fields: attachments[] (optional)
export async function POST(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  // Only NCO, SO, and admin can log new cases
  if (!["nco", "so", "admin", "dc"].includes(user.role)) {
    return NextResponse.json(
      { error: "Only NCO or Station Officers can log new cases" },
      { status: 403 },
    );
  }

  try {
    await connectDB();

    const contentType = req.headers.get("content-type") || "";
    let fields: Record<string, unknown> = {};
    let uploadedAttachments: {
      url: string;
      publicId: string;
      originalName?: string;
      resourceType?: string;
      format?: string;
      bytes?: number;
    }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      // Extract scalar fields
      for (const [key, val] of formData.entries()) {
        if (typeof val === "string") {
          try {
            fields[key] = JSON.parse(val); // handles arrays / objects sent as JSON strings
          } catch {
            fields[key] = val;
          }
        }
      }

      // Upload any attached files to Cloudinary
      const files = formData.getAll("attachments") as File[];
      if (files.length > 0) {
        uploadedAttachments = await parseAttachments(files, "cases");
      }
    } else {
      fields = await req.json();
    }

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
      notes: initialNote,
    } = fields as Record<string, any>;

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
      attachments: uploadedAttachments,
    });

    if (typeof initialNote === "string" && initialNote.trim()) {
      newCase.notes.push({
        content: initialNote.trim(),
        addedBy: user!.userId,
        roleSnapshot: user!.role,
        addedAt: new Date(),
        attachments: [],
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
