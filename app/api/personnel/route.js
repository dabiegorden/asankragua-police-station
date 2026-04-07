import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Personnel from "@/models/Personnel.js";

async function getPersonnel(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page")) || 1;
    const limit = Number.parseInt(searchParams.get("limit")) || 10;
    const status = searchParams.get("status");
    const rank = searchParams.get("rank");
    const role = searchParams.get("role");
    const search = searchParams.get("search");

    // Build query
    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }
    if (rank && rank !== "all") {
      query.rank = rank;
    }
    if (role && role !== "all") {
      query.role = role;
    }
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { badgeNumber: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const personnel = await Personnel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Personnel.countDocuments(query);

    return NextResponse.json({
      personnel,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get personnel error:", error);
    return NextResponse.json(
      { error: "Failed to fetch personnel" },
      { status: 500 },
    );
  }
}

async function createPersonnel(request) {
  try {
    await connectDB();
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      username,
      role,
      badgeNumber,
      rank,
      specialization,
      phoneNumber,
      emergencyContact,
      address,
      dateOfBirth,
      shift,
      department,
      certifications,
      profileImage,
    } = body;

    // Validation
    if (
      !firstName ||
      !lastName ||
      !email ||
      !username ||
      !role ||
      !rank ||
      !phoneNumber ||
      !dateOfBirth
    ) {
      return NextResponse.json(
        { error: "All required fields must be provided" },
        { status: 400 },
      );
    }

    // Check if email or username already exists
    const existingPersonnel = await Personnel.findOne({
      $or: [{ email }, { username }],
    });
    if (existingPersonnel) {
      return NextResponse.json(
        { error: "Email or username already exists" },
        { status: 400 },
      );
    }

    // Check if badge number already exists (if provided)
    if (badgeNumber) {
      const existingBadge = await Personnel.findOne({ badgeNumber });
      if (existingBadge) {
        return NextResponse.json(
          { error: "Badge number already exists" },
          { status: 400 },
        );
      }
    }

    const newPersonnel = new Personnel({
      firstName,
      lastName,
      email,
      username,
      role,
      badgeNumber: badgeNumber || null,
      rank,
      specialization: specialization || "General",
      phoneNumber,
      emergencyContact,
      address,
      dateOfBirth: new Date(dateOfBirth),
      shift: shift || "morning",
      department: department || "General",
      certifications: certifications || [],
      profileImage: profileImage || null,
    });

    await newPersonnel.save();

    return NextResponse.json(
      {
        message: "Personnel record created successfully",
        personnel: newPersonnel,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create personnel error:", error);
    return NextResponse.json(
      { error: "Failed to create personnel record" },
      { status: 500 },
    );
  }
}

export const GET = getPersonnel;
export const POST = createPersonnel;
