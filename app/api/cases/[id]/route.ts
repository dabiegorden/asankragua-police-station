// src/app/api/cases/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import User from "@/models/User";
import { requireAuth } from "@/middleware/auth";
import { sendCaseAssignmentEmail } from "@/lib/email";
import { parseAttachments } from "@/lib/parseAttachments";

type Params = { params: Promise<{ id: string }> };

// ─── Shared populate ──────────────────────────────────────────────────────────
async function populateCase(id: string) {
  return Case.findById(id)
    .populate("loggedBy", "fullName email role")
    .populate("assignedOfficer", "fullName email role")
    .populate("assignedSO", "fullName email role")
    .populate("assignedDC", "fullName email role")
    .populate("notes.addedBy", "fullName role")
    .populate("threadMessages.fromUser", "fullName role");
}

// ─── Thread access guard ──────────────────────────────────────────────────────
//
// Returns true when the requesting user is allowed to POST into a given thread.
//
//  "nco_cid"  → loggedBy (NCO/SO) + assignedOfficer (CID) + admin
//  "cid_so"   → assignedOfficer (CID) + assignedSO (SO) + admin
//  "dc"       → assignedDC (DC) + admin (DC can target anyone)
//
function canAccessThread(
  thread: "nco_cid" | "cid_so" | "dc",
  userId: string,
  userRole: string,
  caseData: any,
): boolean {
  if (userRole === "admin") return true;

  const matches = (field: any) => field?.toString() === userId;

  switch (thread) {
    case "nco_cid":
      return matches(caseData.loggedBy) || matches(caseData.assignedOfficer);
    case "cid_so":
      return matches(caseData.assignedOfficer) || matches(caseData.assignedSO);
    case "dc":
      return matches(caseData.assignedDC);
    default:
      return false;
  }
}

// ─── GET — single case ────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();
    const caseData = await populateCase(id);
    if (!caseData)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });

    // Filter threadMessages so each role only sees the threads they belong to
    const filtered = caseData.toObject();

    if (!["admin", "dc"].includes(user!.role)) {
      filtered.threadMessages = filtered.threadMessages.filter((msg: any) => {
        if (user!.role === "nco" || user!.role === "so") {
          return msg.thread === "nco_cid";
        }
        if (user!.role === "cid") {
          return msg.thread === "nco_cid" || msg.thread === "cid_so";
        }
        return true;
      });
    }

    return NextResponse.json({ case: filtered });
  } catch (err) {
    console.error("GET /cases/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch case" },
      { status: 500 },
    );
  }
}

// ─── PUT — all case actions ───────────────────────────────────────────────────
//
// Accepts multipart/form-data (with optional file attachments) or JSON.
// Every action is dispatched via the `action` field.
//
// Actions:
//   add-note          — any role; optional file attachments
//   send-message      — scoped thread message; optional file attachments
//   mark-read         — mark thread messages as read
//   nco-refer         — NCO/SO refers case to CID
//   cid-start         — CID accepts and begins investigation
//   cid-submit        — CID submits findings to SO
//   so-return         — SO sends case back to CID with a directive
//   so-forward        — SO forwards case to District Commander
//   dc-close          — DC closes the case
//   dc-suspend        — DC suspends the case
//   update            — generic field update (nco/so/admin/dc)
//
export async function PUT(req: NextRequest, { params }: Params) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

    // ── Parse body (multipart or JSON) ────────────────────────────────────────
    const contentType = req.headers.get("content-type") || "";
    let data: Record<string, any> = {};
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
            data[key] = JSON.parse(val);
          } catch {
            data[key] = val;
          }
        }
      }
      const files = formData.getAll("attachments") as File[];
      if (files.length > 0) {
        uploadedAttachments = await parseAttachments(files, "cases");
      }
    } else {
      const body = await req.json();
      const { action, ...rest } = body;
      data = { action, ...rest };
    }

    const { action } = data;

    const caseData = await Case.findById(id);
    if (!caseData)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });

    // ══════════════════════════════════════════════════════════════════════════
    // add-note  — any authenticated role; optional file attachments
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
        attachments: uploadedAttachments,
        addedAt: new Date(),
      });

      await caseData.save();
      return NextResponse.json({
        message: "Note added",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // send-message  — scoped thread communication with optional attachments
    //
    // Body:
    //   thread  : "nco_cid" | "cid_so" | "dc"
    //   content : string
    //   toRole  : string (required for DC thread, optional otherwise)
    //
    // Access rules are enforced by canAccessThread().
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "send-message") {
      const thread = data.thread as "nco_cid" | "cid_so" | "dc";

      if (!thread || !["nco_cid", "cid_so", "dc"].includes(thread)) {
        return NextResponse.json(
          {
            error: 'thread must be one of: "nco_cid", "cid_so", "dc"',
          },
          { status: 400 },
        );
      }

      if (!data.content?.trim()) {
        return NextResponse.json(
          { error: "Message content is required" },
          { status: 400 },
        );
      }

      if (!canAccessThread(thread, user!.userId, user!.role, caseData)) {
        return NextResponse.json(
          { error: "You are not a participant of this communication thread" },
          { status: 403 },
        );
      }

      // For DC thread the sender must specify which role they're addressing
      if (thread === "dc" && !data.toRole) {
        return NextResponse.json(
          {
            error: "toRole is required for DC thread messages",
          },
          { status: 400 },
        );
      }

      caseData.threadMessages.push({
        thread,
        content: data.content.trim(),
        fromUser: user!.userId,
        fromRole: user!.role,
        toRole: data.toRole || null,
        attachments: uploadedAttachments,
        sentAt: new Date(),
        readBy: [user!.userId],
      });

      await caseData.save();

      // ── Optionally notify the recipient via email ─────────────────────────
      try {
        let recipientId: string | null = null;

        if (thread === "nco_cid") {
          // CID → NCO direction
          if (user!.role === "cid") {
            recipientId = caseData.loggedBy?.toString() || null;
          } else {
            recipientId = caseData.assignedOfficer?.toString() || null;
          }
        } else if (thread === "cid_so") {
          if (user!.role === "so") {
            recipientId = caseData.assignedOfficer?.toString() || null;
          } else {
            recipientId = caseData.assignedSO?.toString() || null;
          }
        } else if (thread === "dc" && data.toRole) {
          const roleToField: Record<string, string> = {
            nco: "loggedBy",
            cid: "assignedOfficer",
            so: "assignedSO",
          };
          const field = roleToField[data.toRole];
          if (field) recipientId = (caseData as any)[field]?.toString() || null;
        }

        if (recipientId) {
          const recipient = await User.findById(recipientId).select(
            "fullName email role",
          );
          const sender = await User.findById(user!.userId).select("fullName");
          if (recipient) {
            await sendCaseAssignmentEmail({
              recipientEmail: recipient.email,
              recipientName: recipient.fullName,
              role: recipient.role,
              caseNumber: caseData.caseNumber,
              caseTitle: caseData.title,
              caseCategory: caseData.category,
              casePriority: caseData.priority,
              caseDescription: caseData.description,
              assignedBy: sender?.fullName || user!.role.toUpperCase(),
              caseId: caseData._id.toString(),
              notes: `MESSAGE: ${data.content.trim()}`,
            });
          }
        }
      } catch (emailErr) {
        console.error("Email notification failed (non-fatal):", emailErr);
      }

      return NextResponse.json({
        message: "Message sent",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // mark-read  — mark thread messages as read for the current user
    // Body: { thread: "nco_cid" | "cid_so" | "dc" }
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "mark-read") {
      const thread = data.thread;
      if (!thread) {
        return NextResponse.json(
          { error: "thread is required" },
          { status: 400 },
        );
      }

      caseData.threadMessages.forEach((msg: any) => {
        if (
          msg.thread === thread &&
          !msg.readBy.some((u: any) => u.toString() === user!.userId)
        ) {
          msg.readBy.push(user!.userId);
        }
      });

      await caseData.save();
      return NextResponse.json({ message: "Messages marked as read" });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // nco-refer  — NCO or SO refers case to a CID investigator
    // Body: { assignedOfficer: string, ncoReferralNote?: string, note?: string }
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "nco-refer") {
      if (!["nco", "so", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only NCO or Station Officers can refer cases to CID" },
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
          attachments: uploadedAttachments,
          addedAt: new Date(),
        });
      }

      await caseData.save();

      const loggedByUser = await User.findById(user!.userId).select("fullName");
      await sendCaseAssignmentEmail({
        recipientEmail: cid.email,
        recipientName: cid.fullName,
        role: "cid",
        caseNumber: caseData.caseNumber,
        caseTitle: caseData.title,
        caseCategory: caseData.category,
        casePriority: caseData.priority,
        caseDescription: caseData.description,
        assignedBy: loggedByUser?.fullName || "NCO/SO Officer",
        caseId: caseData._id.toString(),
        notes: data.ncoReferralNote,
      }).catch((e: Error) => console.error("Email error (non-fatal):", e));

      return NextResponse.json({
        message: "Case referred to CID",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // cid-start  — CID accepts and begins investigation
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
          attachments: uploadedAttachments,
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
    // cid-submit  — CID submits findings to a Station Officer
    // Body: { assignedSO: string, cidSubmissionNote?: string, note?: string }
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "cid-submit") {
      if (!["cid", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only CID can submit for SO review" },
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
          attachments: uploadedAttachments,
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
      }).catch((e: Error) => console.error("Email error (non-fatal):", e));

      return NextResponse.json({
        message: "Submitted to Station Officer",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // so-return  — SO returns case to CID with a directive for further action
    // Body: { soDirective: string, note?: string }
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "so-return") {
      if (!["so", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only Station Officer can return cases to CID" },
          { status: 403 },
        );
      }
      if (!data.soDirective?.trim()) {
        return NextResponse.json(
          { error: "Provide a directive for the CID investigator" },
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
          attachments: uploadedAttachments,
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
          }).catch((e: Error) => console.error("Email error (non-fatal):", e));
        }
      }

      return NextResponse.json({
        message: "Case returned to CID with directive",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // so-forward  — SO forwards case to District Commander
    // Body: { assignedDC: string, soReviewNote?: string, note?: string }
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "so-forward") {
      if (!["so", "admin"].includes(user!.role)) {
        return NextResponse.json(
          { error: "Only Station Officer can forward to District Commander" },
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
          attachments: uploadedAttachments,
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
      }).catch((e: Error) => console.error("Email error (non-fatal):", e));

      return NextResponse.json({
        message: "Forwarded to District Commander",
        case: await populateCase(id),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // dc-close
    // Body: { dcNote?: string, note?: string }
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
          attachments: uploadedAttachments,
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
    // dc-suspend
    // Body: { dcNote?: string, note?: string }
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
          attachments: uploadedAttachments,
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
    // update  — generic field edit (nco / so / dc / admin)
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "update" || !action) {
      if (!["nco", "so", "dc", "admin"].includes(user!.role)) {
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
        if (data[key] !== undefined) (caseData as any)[key] = data[key];
      });

      // Append any newly uploaded attachments to the case
      if (uploadedAttachments.length > 0) {
        caseData.attachments.push(...uploadedAttachments);
      }

      await caseData.save();
      return NextResponse.json({
        message: "Case updated",
        case: await populateCase(id),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
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

  if (!["nco", "so", "dc", "admin"].includes(user!.role)) {
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

    // NCO can only delete cases they logged
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
