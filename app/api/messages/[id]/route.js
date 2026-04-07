import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";

async function getMessageById(request, { params }) {
  const { id } = await params;

  try {
    await connectDB();

    const message = await Message.findById(id)
      .populate("sender", "firstName lastName badgeNumber email")
      .populate("recipients.user", "firstName lastName badgeNumber email")
      .populate("relatedCase", "caseNumber title status");

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check if user has access to this message
    const userId = request.user._id;
    const isRecipient = message.recipients.some(
      (recipient) => recipient.user._id.toString() === userId.toString(),
    );
    const isSender = message.sender._id.toString() === userId.toString();

    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Mark as read if user is recipient
    if (isRecipient) {
      const recipientIndex = message.recipients.findIndex(
        (recipient) => recipient.user._id.toString() === userId.toString(),
      );

      if (
        recipientIndex !== -1 &&
        !message.recipients[recipientIndex].readStatus
      ) {
        message.recipients[recipientIndex].readStatus = true;
        message.recipients[recipientIndex].readAt = new Date();
        await message.save();
      }
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Get message error:", error);
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 },
    );
  }
}

async function deleteMessage(request, { params }) {
  const { id } = await params;

  try {
    await connectDB();

    const message = await Message.findById(id);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const userId = request.user._id;

    // Check if user has access to delete this message
    const isRecipient = message.recipients.some(
      (recipient) => recipient.user.toString() === userId.toString(),
    );
    const isSender = message.sender.toString() === userId.toString();

    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (isSender) {
      // If sender, mark as deleted
      message.isDeleted = true;
    } else {
      // If recipient, add to deletedBy array
      if (!message.deletedBy.includes(userId)) {
        message.deletedBy.push(userId);
      }
    }

    await message.save();

    return NextResponse.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getMessageById);
export const DELETE = requireAuth(deleteMessage);
