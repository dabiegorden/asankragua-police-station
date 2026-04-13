import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import Personnel, { IPersonnel } from "@/models/Personnel";

const ALLOWED_ROLES = ["admin", "nco", "so", "dc"] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10));
    const status = searchParams.get("status");
    const rank = searchParams.get("rank");
    const role = searchParams.get("role");
    const search = searchParams.get("search");

    const query: Record<string, unknown> = {};

    if (status && status !== "all") query.status = status;
    if (rank && rank !== "all") query.rank = rank;
    if (role && role !== "all") query.role = role;

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { serviceNumber: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [personnel, total] = await Promise.all([
      Personnel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Personnel.countDocuments(query),
    ]);

    return NextResponse.json({
      personnel,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get personnel error:", err);
    return NextResponse.json(
      { error: "Failed to fetch personnel" },
      { status: 500 },
    );
  }
}

// ─── Request body type ─────────────────────────────────────────────────────

interface CreatePersonnelBody extends Pick<
  IPersonnel,
  | "firstName"
  | "lastName"
  | "email"
  | "username"
  | "role"
  | "rank"
  | "phoneNumber"
> {
  serviceNumber?: string;
  specialization?: IPersonnel["specialization"];
  emergencyContact?: IPersonnel["emergencyContact"];
  address?: IPersonnel["address"];
  dateOfBirth: string;
  dateJoined?: string;
  status?: IPersonnel["status"];
  certifications?: IPersonnel["certifications"];
  profileImage?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { user, error } = requireAuth(request);
  if (error) return error;
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const body = (await request.json()) as CreatePersonnelBody;
    const {
      firstName,
      lastName,
      email,
      username,
      role,
      serviceNumber,
      rank,
      specialization,
      phoneNumber,
      emergencyContact,
      address,
      dateOfBirth,
      dateJoined,
      certifications,
      profileImage,
      status,
    } = body;

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
        {
          error:
            "Required fields: firstName, lastName, email, username, role, rank, phoneNumber, dateOfBirth",
        },
        { status: 400 },
      );
    }

    const existing = await Personnel.findOne({
      $or: [{ email }, { username }],
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email or username already exists" },
        { status: 400 },
      );
    }

    if (serviceNumber) {
      const serviceNumberExists = await Personnel.findOne({ serviceNumber });
      if (serviceNumberExists) {
        return NextResponse.json(
          { error: "Service number already exists" },
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
      serviceNumber: serviceNumber ?? null,
      rank,
      specialization: specialization ?? "General",
      phoneNumber,
      emergencyContact: emergencyContact ?? {},
      address: address ?? {},
      dateOfBirth: new Date(dateOfBirth),
      dateJoined: dateJoined ? new Date(dateJoined) : new Date(),
      status: status ?? "active",
      certifications: certifications ?? [],
      profileImage: profileImage ?? null,
    });

    await newPersonnel.save();

    return NextResponse.json(
      { message: "Personnel created successfully", personnel: newPersonnel },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create personnel error:", err);
    return NextResponse.json(
      { error: "Failed to create personnel record" },
      { status: 500 },
    );
  }
}
