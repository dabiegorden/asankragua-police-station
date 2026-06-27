import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { sendLoginOtpEmail } from "@/lib/email";

// One-time login code lifetime (minutes)
const OTP_TTL_MINUTES = 10;

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // OTP fields are select:false — explicitly include them.
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+loginOtp +loginOtpExpires +loginOtpAttempts")
      .exec();

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is inactive. Contact admin." },
        { status: 403 },
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Credentials are valid — generate and email a one-time login code.
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.loginOtp = await bcrypt.hash(otp, 10);
    user.loginOtpExpires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    user.loginOtpAttempts = 0;
    await user.save();

    const emailResult = await sendLoginOtpEmail({
      recipientEmail: user.email,
      recipientName: user.fullName,
      role: user.role,
      otp,
      expiresInMinutes: OTP_TTL_MINUTES,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: "Could not send verification code. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      message: "Verification code sent to your email",
      otpRequired: true,
      email: user.email,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
