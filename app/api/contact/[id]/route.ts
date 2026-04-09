import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Contact, {
  ContactPriority,
  ContactSource,
  ContactStatus,
} from "@/models/Contact";
import { Types } from "mongoose";

// ─── Role guard ───────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// Next.js App Router params are a Promise in v13+
type RouteContext = { params: Promise<{ id: string }> };

// ─── Shared populate config ───────────────────────────────────────────────────

const ASSIGNED_POPULATE = {
  path: "assignedTo",
  select: "firstName lastName email",
};
const READ_BY_POPULATE = { path: "readBy", select: "firstName lastName" };
const RESPONSES_POPULATE = {
  path: "responses.respondedBy",
  select: "firstName lastName",
};

// ─── Update body type ─────────────────────────────────────────────────────────

interface UpdateContactBody {
  status?: ContactStatus;
  priority?: ContactPriority;
  source?: ContactSource;
  assignedTo?: string | null;
  notes?: string;
  /** Plain-text response to append to the responses array */
  response?: string;
}

// ─── GET /api/contact/[id] ────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const contact = await Contact.findById(id)
      .populate(ASSIGNED_POPULATE)
      .populate(READ_BY_POPULATE)
      .populate(RESPONSES_POPULATE);

    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 },
      );
    }

    // Auto-mark as read on first open
    if (!contact.isRead) {
      contact.isRead = true;
      contact.readBy = user.userId as unknown as Types.ObjectId;
      contact.readAt = new Date();
      await contact.save();
    }

    // Re-fetch with populated readBy after possible mutation
    const populated = await Contact.findById(id)
      .populate(ASSIGNED_POPULATE)
      .populate(READ_BY_POPULATE)
      .populate(RESPONSES_POPULATE)
      .lean();

    return NextResponse.json({ success: true, contact: populated });
  } catch (err) {
    console.error("Get contact by ID error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contact" },
      { status: 500 },
    );
  }
}

// ─── PUT /api/contact/[id] ────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const body = (await request.json()) as UpdateContactBody;
    const { status, priority, source, assignedTo, notes, response } = body;

    const contact = await Contact.findById(id);
    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 },
      );
    }

    // Apply validated field updates
    const VALID_STATUS: ContactStatus[] = [
      "new",
      "in-progress",
      "resolved",
      "closed",
    ];
    const VALID_PRIORITY: ContactPriority[] = [
      "low",
      "normal",
      "high",
      "urgent",
    ];
    const VALID_SOURCE: ContactSource[] = [
      "contact-page",
      "phone",
      "email",
      "walk-in",
      "homepage",
    ];

    if (status && VALID_STATUS.includes(status)) contact.status = status;
    if (priority && VALID_PRIORITY.includes(priority))
      contact.priority = priority;
    if (source && VALID_SOURCE.includes(source)) contact.source = source;

    if (assignedTo !== undefined) {
      contact.assignedTo =
        assignedTo && assignedTo !== "unassigned"
          ? (assignedTo as unknown as Types.ObjectId)
          : null;
    }

    if (notes !== undefined) contact.notes = notes;

    // Append new response authored by the current user
    if (response?.trim()) {
      contact.responses.push({
        message: response.trim(),
        respondedBy: user.userId as unknown as Types.ObjectId,
        respondedAt: new Date(),
      });
    }

    await contact.save();

    const updated = await Contact.findById(id)
      .populate(ASSIGNED_POPULATE)
      .populate(READ_BY_POPULATE)
      .populate(RESPONSES_POPULATE)
      .lean();

    return NextResponse.json({
      success: true,
      message: "Contact updated successfully",
      contact: updated,
    });
  } catch (err) {
    console.error("Update contact error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update contact" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/contact/[id] ─────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (err) {
    console.error("Delete contact error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete contact" },
      { status: 500 },
    );
  }
}
