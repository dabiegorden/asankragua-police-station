import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import Evidence from "@/models/Evidence";

async function getMessages(request) {
  try {
    await conne();

    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page")) || 1;
    const limit = Number.parseInt(searchParams.get("limit")) || 10;
    const type = searchParams.get("type");
    const folder = searchParams.get("folder") || "inbox"; // inbox, sent, deleted

    const userId = request.user._id;

    // Build query based on folder
    let query = {};

    if (folder === "inbox") {
      query = {
        "recipients.user": userId,
        isDeleted: false,
        deletedBy: { $ne: userId },
      };
    } else if (folder === "sent") {
      query = {
        sender: userId,
        isDeleted: false,
      };
    } else if (folder === "deleted") {
      query = {
        $or: [
          { "recipients.user": userId, deletedBy: userId },
          { sender: userId, isDeleted: true },
        ],
      };
    }

    if (type) {
      query.type = type;
    }

    const skip = (page - 1) * limit;

    const messages = await Message.find(query)
      .populate("sender", "firstName lastName badgeNumber")
      .populate("recipients.user", "firstName lastName badgeNumber")
      .populate("relatedCase", "caseNumber title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments(query);

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}

async function createMessage(request) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      recipients,
      subject,
      content,
      type,
      priority,
      attachments,
      relatedCase,
    } = body;

    // Validation
    if (!recipients || recipients.length === 0 || !subject || !content) {
      return NextResponse.json(
        { error: "Recipients, subject, and content are required" },
        { status: 400 },
      );
    }

    const newMessage = new Message({
      sender: request.user._id,
      recipients: recipients.map((userId) => ({ user: userId })),
      subject,
      content,
      type: type || "general",
      priority: priority || "medium",
      attachments: attachments || [],
      relatedCase,
    });

    await newMessage.save();

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "firstName lastName badgeNumber")
      .populate("recipients.user", "firstName lastName badgeNumber")
      .populate("relatedCase", "caseNumber title");

    return NextResponse.json(
      {
        message: "Message sent successfully",
        messageData: populatedMessage,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getMessages);
export const POST = requireAuth(createMessage);
