import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Message, {
  IMessage,
  IPersonnelRef,
  IRecipient,
  MessagePriority,
  MessageType,
} from "@/models/Message";

// ─── Role guard ───────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// ─── Shared populate config ───────────────────────────────────────────────────
// Always pull firstName, lastName, email, badgeNumber from Personnel so the
// frontend can render "From" and "To" without extra look-ups.

const SENDER_POPULATE = {
  path: "sender",
  select: "firstName lastName email badgeNumber",
};
const RECIPIENT_POPULATE = {
  path: "recipients.user",
  select: "firstName lastName email badgeNumber",
};
const CASE_POPULATE = { path: "relatedCase", select: "caseNumber title" };

// ─── Type helpers ─────────────────────────────────────────────────────────────

type MongoQuery = Record<string, unknown>;

interface CreateMessageBody {
  /** Array of Personnel ObjectId strings */
  recipients: string[];
  subject: string;
  content: string;
  type?: MessageType;
  priority?: MessagePriority;
  attachments?: IMessage["attachments"];
  /** Personnel ObjectId string or "none" / "" */
  relatedCase?: string | null;
}

// ─── GET /api/messages ────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10));
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const folder = (searchParams.get("folder") ?? "inbox") as
      | "inbox"
      | "sent"
      | "deleted";

    const userId = user.userId;

    // ── Folder-based query ──────────────────────────────────────────────────
    let query: MongoQuery = {};

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

    if (type && type !== "all") {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find(query)
        .populate(SENDER_POPULATE)
        .populate(RECIPIENT_POPULATE)
        .populate(CASE_POPULATE)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<PopulatedMessage[]>(),
      Message.countDocuments(query),
    ]);

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get messages error:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}

// ─── POST /api/messages ───────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const body = (await request.json()) as CreateMessageBody;
    const {
      recipients,
      subject,
      content,
      type,
      priority,
      attachments,
      relatedCase,
    } = body;

    if (
      !recipients ||
      recipients.length === 0 ||
      !subject?.trim() ||
      !content?.trim()
    ) {
      return NextResponse.json(
        { error: "recipients, subject, and content are required" },
        { status: 400 },
      );
    }

    const newMessage = new Message({
      sender: user.userId,
      recipients: recipients.map((uid) => ({ user: uid })),
      subject: subject.trim(),
      content: content.trim(),
      type: type ?? "general",
      priority: priority ?? "medium",
      attachments: attachments ?? [],
      relatedCase: relatedCase && relatedCase !== "none" ? relatedCase : null,
    });

    await newMessage.save();

    const populated = await Message.findById(newMessage._id)
      .populate(SENDER_POPULATE)
      .populate(RECIPIENT_POPULATE)
      .populate(CASE_POPULATE)
      .lean<PopulatedMessage>();

    return NextResponse.json(
      { message: "Message sent successfully", messageData: populated },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create message error:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}

// ─── Populated message shape (used by lean()) ────────────────────────────────

export interface PopulatedRecipient {
  user: IPersonnelRef;
  readStatus: boolean;
  readAt?: Date;
}

export interface PopulatedMessage {
  _id: string;
  sender: IPersonnelRef;
  recipients: PopulatedRecipient[];
  subject: string;
  content: string;
  type: MessageType;
  priority: MessagePriority;
  attachments: IMessage["attachments"];
  relatedCase: { _id: string; caseNumber: string; title: string } | null;
  isDeleted: boolean;
  deletedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}
