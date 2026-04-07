import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Contact from "@/models/Contact";
// import { verifyToken } from "@/utils/jwt";
import { getTokenFromHeaders, verifyToken } from "@/utils/jwt";

const VALID_SOURCES = ["contact-page", "homepage", "phone", "email", "walk-in"];
const VALID_STATUS = ["new", "in-progress", "resolved", "closed"];
const VALID_PRIORITY = ["low", "normal", "high", "urgent"];

export async function GET(request, { params }) {
  try {
    await connectDB();

    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 401 },
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const contact = await Contact.findById(id)
      .populate("assignedTo", "firstName lastName email")
      .populate("readBy", "firstName lastName")
      .populate("responses.respondedBy", "firstName lastName");

    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 },
      );
    }

    // Mark as read if not already
    if (!contact.isRead) {
      contact.isRead = true;
      contact.readBy = decoded.userId;
      contact.readAt = new Date();
      await contact.save();
    }

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error("Error fetching contact:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contact" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    await connectDB();

    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 401 },
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const {
      status,
      assignedTo,
      notes,
      response,
      source, // optional: if updating the source
      priority, // optional: if updating the priority
    } = body;

    const contact = await Contact.findById(id);
    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 },
      );
    }

    // Validated updates
    if (status && VALID_STATUS.includes(status)) contact.status = status;
    if (priority && VALID_PRIORITY.includes(priority))
      contact.priority = priority;
    if (source && VALID_SOURCES.includes(source)) contact.source = source;
    if (assignedTo) contact.assignedTo = assignedTo;
    if (notes !== undefined) contact.notes = notes;

    if (response) {
      contact.responses.push({
        message: response,
        respondedBy: decoded.userId,
      });
    }

    await contact.save();

    const updatedContact = await Contact.findById(id)
      .populate("assignedTo", "firstName lastName email")
      .populate("responses.respondedBy", "firstName lastName");

    return NextResponse.json({
      success: true,
      message: "Contact updated successfully",
      contact: updatedContact,
    });
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update contact" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await connectDB();

    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Access denied. No token found." },
        { status: 401 },
      );
    }

    const decoded = verifyToken(token);
    // console.log("Decoded Token:", decoded);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token." },
        { status: 401 },
      );
    }

    const { id } = await params;
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
  } catch (error) {
    console.error("Error deleting contact:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete contact" },
      { status: 500 },
    );
  }
}
