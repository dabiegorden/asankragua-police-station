// src/app/api/cases/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import User from "@/models/User";
import { requireAuth } from "@/middleware/auth";
import { sendCaseAssignmentEmail } from "@/lib/email";
import { parseAttachments } from "@/lib/parseAttachments";

type Params = { params: Promise<{ id: string }> };

async function populateCase(id: string) {
  return Case.findById(id)
    .populate("loggedBy", "fullName email role")
    .populate("assignedOfficer", "fullName email role")
    .populate("assignedSO", "fullName email role")
    .populate("assignedDC", "fullName email role")
    .populate("notes.addedBy", "fullName role")
    .populate("threadMessages.fromUser", "fullName role");
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

    const filtered = caseData.toObject();

    // Filter thread messages by role visibility
    if (!["admin", "dc"].includes(user.role)) {
      filtered.threadMessages = filtered.threadMessages.filter((msg: any) => {
        if (user.role === "nco" || user.role === "so")
          return msg.thread === "nco_cid";
        if (user.role === "cid")
          return msg.thread === "nco_cid" || msg.thread === "cid_so";
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
// Workflow:  NCO logs → NCO refers to CID → CID investigates → CID submits to SO
//            → SO reviews → SO returns to CID (with directive) OR SO forwards to DC
//            → DC closes or suspends
//
// Actions:
//   add-note      — any authenticated role
//   send-message  — scoped thread message
//   mark-read     — mark thread messages as read
//   nco-refer     — NCO refers case to CID officer
//   cid-start     — CID accepts and begins investigation
//   cid-submit    — CID submits findings to SO (SO must be selected)
//   so-return     — SO returns case to CID with directive
//   so-forward    — SO forwards case to DC
//   dc-close      — DC closes the case
//   dc-suspend    — DC suspends the case
//   update        — generic field edit (nco/so/admin)
//
export async function PUT(req: NextRequest, { params }: Params) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

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
      if (files.length > 0)
        uploadedAttachments = await parseAttachments(files, "cases");
    } else {
      data = await req.json();
    }

    const { action } = data;
    const caseData = await Case.findById(id);
    if (!caseData)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });

    // ── add-note ──────────────────────────────────────────────────────────────
    if (action === "add-note") {
      if (!data.content?.trim())
        return NextResponse.json(
          { error: "Note content is required" },
          { status: 400 },
        );

      caseData.notes.push({
        content: data.content.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        attachments: uploadedAttachments,
        addedAt: new Date(),
      });

      await caseData.save();
      return NextResponse.json({
        message: "Note added",
        case: await populateCase(id),
      });
    }

    // ── send-message ──────────────────────────────────────────────────────────
    if (action === "send-message") {
      const thread = data.thread as "nco_cid" | "cid_so" | "dc";
      if (!thread || !["nco_cid", "cid_so", "dc"].includes(thread))
        return NextResponse.json(
          { error: 'thread must be one of: "nco_cid", "cid_so", "dc"' },
          { status: 400 },
        );

      if (!data.content?.trim())
        return NextResponse.json(
          { error: "Message content is required" },
          { status: 400 },
        );

      if (thread === "dc" && !data.toRole)
        return NextResponse.json(
          { error: "toRole is required for DC thread messages" },
          { status: 400 },
        );

      caseData.threadMessages.push({
        thread,
        content: data.content.trim(),
        fromUser: user.userId,
        fromRole: user.role,
        toRole: data.toRole || null,
        attachments: uploadedAttachments,
        sentAt: new Date(),
        readBy: [user.userId],
      });

      await caseData.save();

      // Email notification (non-fatal)
      try {
        let recipientId: string | null = null;
        if (thread === "nco_cid") {
          recipientId =
            user.role === "cid"
              ? caseData.loggedBy?.toString() || null
              : caseData.assignedOfficer?.toString() || null;
        } else if (thread === "cid_so") {
          recipientId =
            user.role === "so"
              ? caseData.assignedOfficer?.toString() || null
              : caseData.assignedSO?.toString() || null;
        } else if (thread === "dc" && data.toRole) {
          const m: Record<string, string> = {
            nco: "loggedBy",
            cid: "assignedOfficer",
            so: "assignedSO",
          };
          const f = m[data.toRole];
          if (f) recipientId = (caseData as any)[f]?.toString() || null;
        }
        if (recipientId) {
          const recipient = await User.findById(recipientId).select(
            "fullName email role",
          );
          const sender = await User.findById(user.userId).select("fullName");
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
              assignedBy: sender?.fullName || user.role.toUpperCase(),
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

    // ── mark-read ─────────────────────────────────────────────────────────────
    if (action === "mark-read") {
      if (!data.thread)
        return NextResponse.json(
          { error: "thread is required" },
          { status: 400 },
        );

      caseData.threadMessages.forEach((msg: any) => {
        if (
          msg.thread === data.thread &&
          !msg.readBy.some((u: any) => u.toString() === user.userId)
        ) {
          msg.readBy.push(user.userId);
        }
      });

      await caseData.save();
      return NextResponse.json({ message: "Messages marked as read" });
    }

    // ── nco-refer: NCO assigns case to a CID investigator ────────────────────
    if (action === "nco-refer") {
      if (!["nco", "so", "admin"].includes(user.role))
        return NextResponse.json(
          { error: "Only NCO or Station Officers can refer cases to CID" },
          { status: 403 },
        );

      if (!data.assignedOfficer)
        return NextResponse.json(
          { error: "Select a CID investigator" },
          { status: 400 },
        );

      const cid = await User.findById(data.assignedOfficer);
      if (!cid || cid.role !== "cid")
        return NextResponse.json(
          { error: "Selected user is not a CID officer" },
          { status: 400 },
        );

      caseData.assignedOfficer = data.assignedOfficer;
      caseData.currentStage = "cid";
      caseData.status = "referred";
      caseData.referredAt = new Date();
      if (data.ncoReferralNote) caseData.ncoReferralNote = data.ncoReferralNote;
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user.userId,
          roleSnapshot: user.role,
          attachments: uploadedAttachments,
          addedAt: new Date(),
        });
      }

      await caseData.save();

      // Email the CID officer
      const loggedByUser = await User.findById(user.userId).select("fullName");
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

    // ── cid-start: CID accepts and begins investigation ───────────────────────
    if (action === "cid-start") {
      if (!["cid", "admin"].includes(user.role))
        return NextResponse.json(
          { error: "Only CID can start investigation" },
          { status: 403 },
        );

      caseData.status = "investigating";
      caseData.investigationStartedAt = new Date();
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user.userId,
          roleSnapshot: user.role,
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

    // ── cid-submit: CID submits findings to a Station Officer ─────────────────
    if (action === "cid-submit") {
      if (!["cid", "admin"].includes(user.role))
        return NextResponse.json(
          { error: "Only CID can submit for SO review" },
          { status: 403 },
        );

      if (!data.assignedSO)
        return NextResponse.json(
          { error: "Select a Station Officer" },
          { status: 400 },
        );

      const so = await User.findById(data.assignedSO);
      if (!so || so.role !== "so")
        return NextResponse.json(
          { error: "Selected user is not a Station Officer" },
          { status: 400 },
        );

      caseData.assignedSO = data.assignedSO;
      caseData.currentStage = "so";
      caseData.status = "under_review";
      caseData.submittedForReviewAt = new Date();
      if (data.cidSubmissionNote)
        caseData.cidSubmissionNote = data.cidSubmissionNote;
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user.userId,
          roleSnapshot: user.role,
          attachments: uploadedAttachments,
          addedAt: new Date(),
        });
      }

      await caseData.save();

      // Email the SO
      const cidUser = await User.findById(user.userId).select("fullName");
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

    // ── so-return: SO returns case to CID with a directive ────────────────────
    if (action === "so-return") {
      if (!["so", "admin"].includes(user.role))
        return NextResponse.json(
          { error: "Only Station Officer can return cases to CID" },
          { status: 403 },
        );

      if (!data.soDirective?.trim())
        return NextResponse.json(
          { error: "Provide a directive for the CID investigator" },
          { status: 400 },
        );

      caseData.soDirective = data.soDirective;
      caseData.currentStage = "cid";
      caseData.status = "investigating";
      caseData.soReviewedAt = new Date();
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user.userId,
          roleSnapshot: user.role,
          attachments: uploadedAttachments,
          addedAt: new Date(),
        });
      }

      await caseData.save();

      // Email the CID officer
      if (caseData.assignedOfficer) {
        const cid = await User.findById(caseData.assignedOfficer);
        const soUser = await User.findById(user.userId).select("fullName");
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

    // ── so-forward: SO forwards case to District Commander ────────────────────
    if (action === "so-forward") {
      if (!["so", "admin"].includes(user.role))
        return NextResponse.json(
          { error: "Only Station Officer can forward to District Commander" },
          { status: 403 },
        );

      if (!data.assignedDC)
        return NextResponse.json(
          { error: "Select a District Commander" },
          { status: 400 },
        );

      const dc = await User.findById(data.assignedDC);
      if (!dc || dc.role !== "dc")
        return NextResponse.json(
          { error: "Selected user is not a District Commander" },
          { status: 400 },
        );

      caseData.assignedDC = data.assignedDC;
      caseData.currentStage = "dc";
      caseData.status = "commander_review";
      caseData.soReviewedAt = new Date();
      if (data.soReviewNote) caseData.soReviewNote = data.soReviewNote;
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user.userId,
          roleSnapshot: user.role,
          attachments: uploadedAttachments,
          addedAt: new Date(),
        });
      }

      await caseData.save();

      // Email the DC
      const soUser = await User.findById(user.userId).select("fullName");
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

    // ── dc-close ──────────────────────────────────────────────────────────────
    if (action === "dc-close") {
      if (!["dc", "admin"].includes(user.role))
        return NextResponse.json(
          { error: "Only District Commander can close cases" },
          { status: 403 },
        );

      caseData.status = "closed";
      caseData.dcReviewedAt = new Date();
      caseData.closedAt = new Date();
      if (data.dcNote) caseData.dcNote = data.dcNote;
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user.userId,
          roleSnapshot: user.role,
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

    // ── dc-suspend ────────────────────────────────────────────────────────────
    if (action === "dc-suspend") {
      if (!["dc", "admin"].includes(user.role))
        return NextResponse.json(
          { error: "Only District Commander can suspend cases" },
          { status: 403 },
        );

      caseData.status = "suspended";
      caseData.dcReviewedAt = new Date();
      if (data.dcNote) caseData.dcNote = data.dcNote;
      if (data.note?.trim()) {
        caseData.notes.push({
          content: data.note.trim(),
          addedBy: user.userId,
          roleSnapshot: user.role,
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

    // ── update — generic field edit ───────────────────────────────────────────
    if (action === "update" || !action) {
      if (!["nco", "so", "dc", "admin"].includes(user.role))
        return NextResponse.json(
          { error: "You do not have permission to edit cases" },
          { status: 403 },
        );

      const ALLOWED = [
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
      ALLOWED.forEach((key) => {
        if (data[key] !== undefined) (caseData as any)[key] = data[key];
      });
      if (uploadedAttachments.length > 0)
        caseData.attachments.push(...uploadedAttachments);

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

  if (!["nco", "so", "dc", "admin"].includes(user.role))
    return NextResponse.json(
      { error: "You do not have permission to delete cases" },
      { status: 403 },
    );

  const { id } = await params;

  try {
    await connectDB();
    const caseData = await Case.findById(id);
    if (!caseData)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });

    if (user.role === "nco" && caseData.loggedBy?.toString() !== user.userId)
      return NextResponse.json(
        { error: "NCO can only delete cases they logged" },
        { status: 403 },
      );

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
