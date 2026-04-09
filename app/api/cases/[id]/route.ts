// src/app/api/cases/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import User from "@/models/User";
import { requireAuth } from "@/middleware/auth";
import { sendCaseAssignmentEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// ─── Permission helpers ───────────────────────────────────────────────────────

/** Who can edit / delete cases */
const CAN_MUTATE = ["nco", "so", "admin", "dc"];

// ─── Shared populate ─────────────────────────────────────────────────────────

async function populateCase(id: string) {
  return Case.findById(id)
    .populate("loggedBy", "fullName email role")
    .populate("assignedOfficer", "fullName email role")
    .populate("assignedSO", "fullName email role")
    .populate("assignedDC", "fullName email role")
    .populate("notes.addedBy", "fullName role")
    .populate("progressMessages.fromUser", "fullName role")
    .populate("progressMessages.toUser", "fullName role");
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();
    const caseData = await populateCase(id);
    if (!caseData)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    return NextResponse.json({ case: caseData });
  } catch (err) {
    console.error("GET /cases/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch case" },
      { status: 500 },
    );
  }
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: Params) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

    const body = await req.json();
    const { action, ...data } = body;

    const caseData = await Case.findById(id);
    if (!caseData)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: add-note  — any authenticated role
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "add-note") {
      if (!data.content?.trim()) {
        return NextResponse.json(
          { error: "Note content is required" },
          { status: 400 },
        );
      }
      caseData.notes.push({
        content: data.content.trim(),
        addedBy: user!.userId,
        roleSnapshot: user!.role,
        addedAt: new Date(),
      });
      await caseData.save();
      return NextResponse.json({
        message: "Note added",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: send-progress  — any role, sends a message to another role
    // Body: { toRole: "nco"|"cid"|"so"|"dc", content: string, toUser?: string }
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "send-progress") {
      if (!data.content?.trim()) {
        return NextResponse.json(
          { error: "Message content is required" },
          { status: 400 },
        );
      }
      if (!data.toRole) {
        return NextResponse.json(
          { error: "toRole is required" },
          { status: 400 },
        );
      }

      // Resolve the target user if not provided (pick first assigned person for that role)
      let toUserId = data.toUser || null;
      if (!toUserId) {
        const roleToField: Record<string, string> = {
          nco: "loggedBy",
          cid: "assignedOfficer",
          so: "assignedSO",
          dc: "assignedDC",
        };
        const field = roleToField[data.toRole];
        if (field) toUserId = (caseData as any)[field]?.toString() || null;
      }

      caseData.progressMessages.push({
        content: data.content.trim(),
        fromUser: user!.userId,
        fromRole: user!.role,
        toRole: data.toRole,
        toUser: toUserId || undefined,
        sentAt: new Date(),
      });

      await caseData.save();

      // Email the target user if we know who they are
      if (toUserId) {
        const target = await User.findById(toUserId).select(
          "fullName email role",
        );
        const sender = await User.findById(user!.userId).select("fullName");
        if (target) {
          await sendCaseAssignmentEmail({
            recipientEmail: target.email,
            recipientName: target.fullName,
            role: target.role,
            caseNumber: caseData.caseNumber,
            caseTitle: caseData.title,
            caseCategory: caseData.category,
            casePriority: caseData.priority,
            caseDescription: caseData.description,
            assignedBy: sender?.fullName || user!.role.toUpperCase(),
            caseId: caseData._id.toString(),
            notes: `PROGRESS UPDATE: ${data.content.trim()}`,
          });
        }
      }

      return NextResponse.json({
        message: "Progress message sent",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: nco-refer  — NCO refers case to CID
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "nco-refer") {
      if (!["nco", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only NCO can refer cases" },
          { status: 403 },
        );
      }
      if (!data.assignedOfficer) {
        return NextResponse.json(
          { error: "Select a CID investigator" },
          { status: 400 },
        );
      }

      const cid = await User.findById(data.assignedOfficer);
      if (!cid || cid.role !== "cid") {
        return NextResponse.json(
          { error: "Selected user is not a CID officer" },
          { status: 400 },
        );
      }

      caseData.assignedOfficer = data.assignedOfficer;
      caseData.currentStage = "cid";
      caseData.status = "referred";
      caseData.referredAt = new Date();
      if (data.ncoReferralNote) caseData.ncoReferralNote = data.ncoReferralNote;
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user!.userId,
          roleSnapshot: user!.role,
          addedAt: new Date(),
        });
      }

      await caseData.save();

      const ncoUser = await User.findById(user!.userId).select("fullName");
      await sendCaseAssignmentEmail({
        recipientEmail: cid.email,
        recipientName: cid.fullName,
        role: "cid",
        caseNumber: caseData.caseNumber,
        caseTitle: caseData.title,
        caseCategory: caseData.category,
        casePriority: caseData.priority,
        caseDescription: caseData.description,
        assignedBy: ncoUser?.fullName || "NCO Officer",
        caseId: caseData._id.toString(),
        notes: data.ncoReferralNote,
      });

      return NextResponse.json({
        message: "Case referred to CID",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: cid-start  — CID begins investigation
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "cid-start") {
      if (!["cid", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only CID can start investigation" },
          { status: 403 },
        );
      }

      caseData.status = "investigating";
      caseData.investigationStartedAt = new Date();
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user!.userId,
          roleSnapshot: user!.role,
          addedAt: new Date(),
        });
      }

      await caseData.save();
      return NextResponse.json({
        message: "Investigation started",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: cid-submit  — CID submits findings to SO
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "cid-submit") {
      if (!["cid", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only CID can submit for review" },
          { status: 403 },
        );
      }
      if (!data.assignedSO) {
        return NextResponse.json(
          { error: "Select a Station Officer" },
          { status: 400 },
        );
      }

      const so = await User.findById(data.assignedSO);
      if (!so || so.role !== "so") {
        return NextResponse.json(
          { error: "Selected user is not a Station Officer" },
          { status: 400 },
        );
      }

      caseData.assignedSO = data.assignedSO;
      caseData.currentStage = "so";
      caseData.status = "under_review";
      caseData.submittedForReviewAt = new Date();
      if (data.cidSubmissionNote)
        caseData.cidSubmissionNote = data.cidSubmissionNote;
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user!.userId,
          roleSnapshot: user!.role,
          addedAt: new Date(),
        });
      }

      await caseData.save();

      const cidUser = await User.findById(user!.userId).select("fullName");
      await sendCaseAssignmentEmail({
        recipientEmail: so.email,
        recipientName: so.fullName,
        role: "so",
        caseNumber: caseData.caseNumber,
        caseTitle: caseData.title,
        caseCategory: caseData.category,
        casePriority: caseData.priority,
        caseDescription: caseData.description,
        assignedBy: cidUser?.fullName || "CID Investigator",
        caseId: caseData._id.toString(),
        notes: data.cidSubmissionNote,
      });

      return NextResponse.json({
        message: "Submitted to Station Officer",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: so-return  — SO sends case back to CID with directive
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "so-return") {
      if (!["so", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only Station Officer can return cases" },
          { status: 403 },
        );
      }
      if (!data.soDirective?.trim()) {
        return NextResponse.json(
          { error: "Provide a directive for the investigator" },
          { status: 400 },
        );
      }

      caseData.soDirective = data.soDirective;
      caseData.currentStage = "cid";
      caseData.status = "investigating";
      caseData.soReviewedAt = new Date();
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user!.userId,
          roleSnapshot: user!.role,
          addedAt: new Date(),
        });
      }

      await caseData.save();

      if (caseData.assignedOfficer) {
        const cid = await User.findById(caseData.assignedOfficer);
        const soUser = await User.findById(user!.userId).select("fullName");
        if (cid) {
          await sendCaseAssignmentEmail({
            recipientEmail: cid.email,
            recipientName: cid.fullName,
            role: "cid",
            caseNumber: caseData.caseNumber,
            caseTitle: caseData.title,
            caseCategory: caseData.category,
            casePriority: caseData.priority,
            caseDescription: caseData.description,
            assignedBy: soUser?.fullName || "Station Officer",
            caseId: caseData._id.toString(),
            notes: `FURTHER ACTION REQUIRED: ${data.soDirective}`,
          });
        }
      }

      return NextResponse.json({
        message: "Case returned to CID with directive",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: so-forward  — SO forwards to District Commander
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "so-forward") {
      if (!["so", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only Station Officer can forward to DC" },
          { status: 403 },
        );
      }
      if (!data.assignedDC) {
        return NextResponse.json(
          { error: "Select a District Commander" },
          { status: 400 },
        );
      }

      const dc = await User.findById(data.assignedDC);
      if (!dc || dc.role !== "dc") {
        return NextResponse.json(
          { error: "Selected user is not a District Commander" },
          { status: 400 },
        );
      }

      caseData.assignedDC = data.assignedDC;
      caseData.currentStage = "dc";
      caseData.status = "commander_review";
      caseData.soReviewedAt = new Date();
      if (data.soReviewNote) caseData.soReviewNote = data.soReviewNote;
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user!.userId,
          roleSnapshot: user!.role,
          addedAt: new Date(),
        });
      }

      await caseData.save();

      const soUser = await User.findById(user!.userId).select("fullName");
      await sendCaseAssignmentEmail({
        recipientEmail: dc.email,
        recipientName: dc.fullName,
        role: "dc",
        caseNumber: caseData.caseNumber,
        caseTitle: caseData.title,
        caseCategory: caseData.category,
        casePriority: caseData.priority,
        caseDescription: caseData.description,
        assignedBy: soUser?.fullName || "Station Officer",
        caseId: caseData._id.toString(),
        notes: data.soReviewNote,
      });

      return NextResponse.json({
        message: "Forwarded to District Commander",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: dc-close
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "dc-close") {
      if (!["dc", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only District Commander can close cases" },
          { status: 403 },
        );
      }

      caseData.status = "closed";
      caseData.dcReviewedAt = new Date();
      caseData.closedAt = new Date();
      if (data.dcNote) caseData.dcNote = data.dcNote;
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user!.userId,
          roleSnapshot: user!.role,
          addedAt: new Date(),
        });
      }

      await caseData.save();
      return NextResponse.json({
        message: "Case closed",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: dc-suspend
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "dc-suspend") {
      if (!["dc", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only District Commander can suspend cases" },
          { status: 403 },
        );
      }

      caseData.status = "suspended";
      caseData.dcReviewedAt = new Date();
      if (data.dcNote) caseData.dcNote = data.dcNote;
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user!.userId,
          roleSnapshot: user!.role,
          addedAt: new Date(),
        });
      }

      await caseData.save();
      return NextResponse.json({
        message: "Case suspended",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Generic field update — NCO, SO, admin only
    // ══════════════════════════════════════════════════════════════════════════
    if (!CAN_MUTATE.includes(user!.role)) {
      return NextResponse.json(
        { error: "You do not have permission to edit cases" },
        { status: 403 },
      );
    }

    const ALLOWED_FIELDS = [
      "title",
      "description",
      "category",
      "priority",
      "location",
      "dateOccurred",
      "reportedBy",
      "suspects",
      "witnesses",
    ];

    ALLOWED_FIELDS.forEach((key) => {
      if (data[key] !== undefined) {
        (caseData as any)[key] = data[key];
      }
    });

    await caseData.save();
    return NextResponse.json({
      message: "Case updated",
      case: await populateCase(id),
    });
  } catch (err) {
    console.error("PUT /cases/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update case" },
      { status: 500 },
    );
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  // Only NCO, SO, admin can delete
  if (!CAN_MUTATE.includes(user!.role)) {
    return NextResponse.json(
      { error: "You do not have permission to delete cases" },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    await connectDB();

    const caseData = await Case.findById(id);
    if (!caseData)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });

    // NCO can only delete their own; SO & admin can delete any
    if (
      user!.role === "nco" &&
      caseData.loggedBy?.toString() !== user!.userId
    ) {
      return NextResponse.json(
        { error: "NCO can only delete cases they logged" },
        { status: 403 },
      );
    }

    await Case.findByIdAndDelete(id);
    return NextResponse.json({ message: "Case deleted successfully" });
  } catch (err) {
    console.error("DELETE /cases/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete case" },
      { status: 500 },
    );
  }
}
