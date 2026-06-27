import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { generateToken } from "@/lib/jwt";

const MAX_OTP_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
        { status: 400 },
      );
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+loginOtp +loginOtpExpires +loginOtpAttempts")
      .exec();

    if (!user || !user.loginOtp || !user.loginOtpExpires) {
      return NextResponse.json(
        { error: "No pending verification. Please sign in again." },
        { status: 400 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is inactive. Contact admin." },
        { status: 403 },
      );
    }

    if (user.loginOtpExpires.getTime() < Date.now()) {
      user.loginOtp = null;
      user.loginOtpExpires = null;
      user.loginOtpAttempts = 0;
      await user.save();
      return NextResponse.json(
        { error: "Verification code has expired. Please sign in again." },
        { status: 401 },
      );
    }

    if ((user.loginOtpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      user.loginOtp = null;
      user.loginOtpExpires = null;
      user.loginOtpAttempts = 0;
      await user.save();
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please sign in again." },
        { status: 429 },
      );
    }

    const isValid = await bcrypt.compare(String(otp).trim(), user.loginOtp);
    if (!isValid) {
      user.loginOtpAttempts = (user.loginOtpAttempts ?? 0) + 1;
      await user.save();
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 401 },
      );
    }

    // Success — clear the OTP and issue the session token.
    user.loginOtp = null;
    user.loginOtpExpires = null;
    user.loginOtpAttempts = 0;
    await user.save();

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      stationId: user.stationId ?? null,
    });

    const response = NextResponse.json({
      message: "Login successful",
      user: user.toSafeObject(),
      token,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
