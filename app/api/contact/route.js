import { NextResponse } from "next/server";
import Contact from "@/models/Contact";
import { connectDB } from "@/lib/db";

export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page")) || 1;
    const limit = Number.parseInt(searchParams.get("limit")) || 10;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const source = searchParams.get("source");

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (priority && priority !== "all") {
      query.priority = priority;
    }

    if (source && source !== "all") {
      query.source = source;
    }

    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .populate("assignedTo", "firstName lastName email")
        .populate("readBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Contact.countDocuments(query),
    ]);

    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contacts" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();
    const { name, email, phone, subject, message, type, priority, source } =
      body;

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get client IP and user agent
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded
      ? forwarded.split(",")[0]
      : request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const contact = await Contact.create({
      name,
      email,
      phone,
      subject,
      message,
      type: type || "general",
      priority: priority || "normal",
      source: source || "contact-page",
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
      contact: {
        _id: contact._id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        status: contact.status,
      },
    });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 },
    );
  }
}
