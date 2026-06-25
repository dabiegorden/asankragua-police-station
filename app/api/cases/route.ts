// src/app/api/cases/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import User from "@/models/User";
import { requireAuth } from "@/middleware/auth";
import { resolveScopeStation } from "@/lib/stationScope";
import { parseAttachments } from "@/lib/parseAttachments";
import { saveWithUniqueNumber } from "@/lib/sequence";

export async function populateCase(id: string) {
  return Case.findById(id)
    .populate("loggedBy", "fullName email role badgeNumber")
    .populate("assignedOfficer", "fullName email role badgeNumber")
    .populate("assignedSO", "fullName email role badgeNumber")
    .populate("assignedDC", "fullName email role badgeNumber")
    .populate("notes.addedBy", "fullName role badgeNumber")
    .populate("caseBookEntries.addedBy", "fullName role badgeNumber")
    .populate("threadMessages.fromUser", "fullName role")
    .populate("auditLog.performedBy", "fullName role badgeNumber");
}

/**
 * Resolves the set of User ObjectIds that belong to a given station.
 * Returns null if no station scope should be applied (admin seeing all).
 */
async function getStationUserIds(stationId: string): Promise<string[]> {
  const stationUsers = await User.find({ stationId }).select("_id").lean();
  return stationUsers.map((u) => u._id.toString());
}

// ─── GET — list cases (station-scoped) ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const stage = searchParams.get("stage");
    const stationId = searchParams.get("stationId");

    const query: Record<string, unknown> = {};

    switch (user.role) {
      case "nco": {
        // NCO sees only cases logged at their own station
        if (!user.stationId) {
          return NextResponse.json({
            cases: [],
            pagination: { page, limit, total: 0, pages: 0 },
          });
        }
        const ids = await getStationUserIds(user.stationId);
        query.$or = [
          { loggedBy: { $in: ids } },
          { currentStage: "nco", loggedBy: { $in: ids } },
        ];
        break;
      }

      case "cid": {
        // CID sees only cases assigned to them (still station-bound because
        // NCO can only refer to CID officers at their own station via by-role)
        query.assignedOfficer = user.userId;
        break;
      }

      case "so": {
        // SO sees only cases at their own station
        if (!user.stationId) {
          return NextResponse.json({
            cases: [],
            pagination: { page, limit, total: 0, pages: 0 },
          });
        }
        const ids = await getStationUserIds(user.stationId);
        query.$or = [{ assignedSO: user.userId }, { loggedBy: { $in: ids } }];
        break;
      }

      case "dc":
      case "admin": {
        // DC defaults to their own station; station admin is locked to its own
        // station; super admin sees all unless ?stationId= filter is supplied.
        const targetStation = resolveScopeStation(user, stationId) ?? null;

        if (targetStation) {
          const ids = await getStationUserIds(targetStation);
          query.$or = [
            { loggedBy: { $in: ids } },
            { assignedOfficer: { $in: ids } },
            { assignedSO: { $in: ids } },
            { assignedDC: { $in: ids } },
          ];
        }
        // Admin with no stationId filter sees everything
        break;
      }
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
        .populate("loggedBy", "fullName email role badgeNumber")
        .populate("assignedOfficer", "fullName email role badgeNumber")
        .populate("assignedSO", "fullName email role badgeNumber")
        .populate("assignedDC", "fullName email role badgeNumber")
        .populate("caseBookEntries.addedBy", "fullName role badgeNumber")
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
export async function POST(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

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
      for (const [key, val] of formData.entries()) {
        if (typeof val === "string") {
          try {
            fields[key] = JSON.parse(val);
          } catch {
            fields[key] = val;
          }
        }
      }
      const files = formData.getAll("attachments") as File[];
      if (files.length > 0)
        uploadedAttachments = await parseAttachments(files, "cases");
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
      loggedBy: user.userId,
      currentStage: "nco",
      status: "open",
      attachments: uploadedAttachments,
    });

    if (typeof initialNote === "string" && initialNote.trim()) {
      newCase.notes.push({
        content: initialNote.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: [],
      });
      newCase.caseBookEntries.push({
        stage: "nco",
        entryType: "remark",
        content: initialNote.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: [],
        isEditable: false,
      });
    }

    newCase.auditLog.push({
      action: "case_created",
      performedBy: user.userId,
      performedAt: new Date(),
      fromStage: null,
      toStage: "nco",
      details: `Case logged by ${user.role.toUpperCase()}`,
    });

    await saveWithUniqueNumber(newCase, "caseNumber", "RO");
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
