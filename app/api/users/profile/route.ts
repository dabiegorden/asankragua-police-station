import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { uploadProfilePhoto } from "@/utils/uploadImage";
import { requireAuth } from "@/middleware/auth";

export async function PATCH(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    await connectDB();

    const contentType = req.headers.get("content-type") || "";
    let updates: Record<string, string> = {};

    if (contentType.includes("multipart/form-data")) {
      // Handle form data (with optional photo upload)
      const formData = await req.formData();

      const fullName = formData.get("fullName") as string | null;
      const password = formData.get("password") as string | null;
      const photo = formData.get("profilePhoto") as File | null;

      if (fullName) updates.fullName = fullName;

      if (password) {
        if (password.length < 6) {
          return NextResponse.json(
            { error: "Password must be at least 6 characters" },
            { status: 400 },
          );
        }
        updates.password = await bcrypt.hash(password, 10);
      }

      if (photo && photo.size > 0) {
        const photoUrl = await uploadProfilePhoto(photo, user!.userId);
        updates.profilePhoto = photoUrl;
      }
    } else {
      // Handle JSON body (no photo)
      const body = await req.json();
      const { fullName, password } = body;

      if (fullName) updates.fullName = fullName;

      if (password) {
        if (password.length < 6) {
          return NextResponse.json(
            { error: "Password must be at least 6 characters" },
            { status: 400 },
          );
        }
        updates.password = await bcrypt.hash(password, 10);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields provided to update" },
        { status: 400 },
      );
    }

    // Fix: Replace { new: true } with { returnDocument: 'after' }
    const updatedUser = await User.findByIdAndUpdate(
      user!.userId,
      { $set: updates },
      { returnDocument: "after", select: "-password" },
    );

    return NextResponse.json({
      message: "Profile updated",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
