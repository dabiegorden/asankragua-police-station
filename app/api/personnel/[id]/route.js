import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Personnel from "@/models/Personnel.js";

async function getPersonnelById(request, { params }) {
  const { id } = await params;
  try {
    await connectDB();
    const personnel = await Personnel.findById(id).populate(
      "assignments.caseId",
      "caseNumber title status",
    );
    if (!personnel) {
      return NextResponse.json(
        { error: "Personnel not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ personnel });
  } catch (error) {
    console.error("Get personnel by ID error:", error);
    return NextResponse.json(
      { error: "Failed to fetch personnel" },
      { status: 500 },
    );
  }
}

async function updatePersonnel(request, { params }) {
  const { id } = await params;
  try {
    await connectDB();
    const body = await request.json();
    const updateData = { ...body };

    const personnel = await Personnel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!personnel) {
      return NextResponse.json(
        { error: "Personnel not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      message: "Personnel updated successfully",
      personnel,
    });
  } catch (error) {
    console.error("Update personnel error:", error);
    return NextResponse.json(
      { error: "Failed to update personnel" },
      { status: 500 },
    );
  }
}

async function deletePersonnel(request, { params }) {
  const { id } = await params;
  try {
    await connectDB();
    const personnel = await Personnel.findById(id);
    if (!personnel) {
      return NextResponse.json(
        { error: "Personnel not found" },
        { status: 404 },
      );
    }
    await Personnel.findByIdAndDelete(id);
    return NextResponse.json({ message: "Personnel deleted successfully" });
  } catch (error) {
    console.error("Delete personnel error:", error);
    return NextResponse.json(
      { error: "Failed to delete personnel" },
      { status: 500 },
    );
  }
}

export const GET = getPersonnelById;
export const PUT = updatePersonnel;
export const DELETE = deletePersonnel;
