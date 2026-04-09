import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Message from "@/models/Message";
import type { PopulatedMessage, PopulatedRecipient } from "../route";
import { Types } from "mongoose";

// ─── Role guard ───────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// Next.js App Router params are a Promise in v13+
type RouteContext = { params: Promise<{ id: string }> };

// ─── Shared populate config ───────────────────────────────────────────────────

const SENDER_POPULATE = {
  path: "sender",
  select: "firstName lastName email badgeNumber",
};
const RECIPIENT_POPULATE = {
  path: "recipients.user",
  select: "firstName lastName email badgeNumber",
};
const CASE_POPULATE = {
  path: "relatedCase",
  select: "caseNumber title status",
};

// ─── GET /api/messages/[id] ───────────────────────────────────────────────────

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

    // Fetch without lean first so we can mutate readStatus, then re-fetch lean for response
    const messageDoc = await Message.findById(id);

    if (!messageDoc) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const userId = new Types.ObjectId(user.userId).toString();
    const senderId = messageDoc.sender.toString();
    const isRecipient = messageDoc.recipients.some(
      (r) => r.user.toString() === userId,
    );
    const isSender = senderId === userId;

    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Mark as read for this recipient if not already read
    if (isRecipient) {
      const idx = messageDoc.recipients.findIndex(
        (r) => r.user.toString() === userId,
      );
      if (idx !== -1 && !messageDoc.recipients[idx].readStatus) {
        messageDoc.recipients[idx].readStatus = true;
        messageDoc.recipients[idx].readAt = new Date();
        await messageDoc.save();
      }
    }

    // Return fully populated document
    const message = await Message.findById(id)
      .populate(SENDER_POPULATE)
      .populate(RECIPIENT_POPULATE)
      .populate(CASE_POPULATE)
      .lean<PopulatedMessage>();

    return NextResponse.json({ message });
  } catch (err) {
    console.error("Get message by ID error:", err);
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/messages/[id] ────────────────────────────────────────────────

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

    const message = await Message.findById(id);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const userId = new Types.ObjectId(user.userId);
    const isRecipient = message.recipients.some(
      (r) => r.user.toString() === userId.toString(),
    );
    const isSender = message.sender.toString() === userId.toString();

    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (isSender) {
      // Sender hard-deletes the whole thread for everyone
      message.isDeleted = true;
    } else {
      // Recipient soft-deletes only for themselves
      const alreadyDeleted = message.deletedBy.some(
        (dbId) => dbId.toString() === userId.toString(),
      );
      if (!alreadyDeleted) {
        message.deletedBy.push(userId);
      }
    }

    await message.save();

    return NextResponse.json({ message: "Message deleted successfully" });
  } catch (err) {
    console.error("Delete message error:", err);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 },
    );
  }
}
