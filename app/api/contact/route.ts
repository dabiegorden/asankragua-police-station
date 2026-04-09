import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Contact, {
  ContactPriority,
  ContactSource,
  ContactStatus,
  ContactType,
} from "@/models/Contact";

// ─── Role guard — only these roles may read/manage contacts ───────────────────

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

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

// ─── Types ────────────────────────────────────────────────────────────────────

type MongoQuery = Record<string, unknown>;

interface CreateContactBody {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  type?: ContactType;
  priority?: ContactPriority;
  source?: ContactSource;
}

// ─── GET /api/contact ─────────────────────────────────────────────────────────
// Protected — only allowed roles can list contact submissions.

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
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const source = searchParams.get("source");

    const query: MongoQuery = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "all") query.status = status;
    if (priority && priority !== "all") query.priority = priority;
    if (source && source !== "all") query.source = source;

    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .populate(ASSIGNED_POPULATE)
        .populate(READ_BY_POPULATE)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Contact.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get contacts error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contacts" },
      { status: 500 },
    );
  }
}

// ─── POST /api/contact ────────────────────────────────────────────────────────
// Public — the public contact form calls this without authentication.

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectDB();

    const body = (await request.json()) as CreateContactBody;
    const { name, email, phone, subject, message, type, priority, source } =
      body;

    if (
      !name?.trim() ||
      !email?.trim() ||
      !subject?.trim() ||
      !message?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "name, email, subject, and message are required",
        },
        { status: 400 },
      );
    }

    // Capture client metadata for spam/fraud tracking
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded
      ? forwarded.split(",")[0].trim()
      : (request.headers.get("x-real-ip") ?? "unknown");
    const userAgent = request.headers.get("user-agent") ?? "unknown";

    const contact = await Contact.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim(),
      subject: subject.trim(),
      message: message.trim(),
      type: type ?? "general",
      priority: priority ?? "normal",
      source: source ?? "contact-page",
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Message sent successfully",
        contact: {
          _id: contact._id,
          name: contact.name,
          email: contact.email,
          subject: contact.subject,
          status: contact.status,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create contact error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 },
    );
  }
}
