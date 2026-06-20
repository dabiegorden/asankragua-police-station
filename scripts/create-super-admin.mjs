// scripts/create-super-admin.mjs
//
// One-time bootstrap for the SUPER ADMIN account.
//
// The super admin is simply an `admin` user with NO station attached. Once it
// exists, it can log in at /login and create the per-station administrators
// (and everyone else) from the Users management page.
//
// Usage (Node 20.6+):
//   node --env-file=.env scripts/create-super-admin.mjs "Full Name" email@example.com "Password123"
//
// Or via the npm script:
//   npm run seed:superadmin -- "Full Name" email@example.com "Password123"
//
// You can also supply values through env vars instead of CLI args:
//   SUPERADMIN_NAME, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
//
// Re-running with the same email updates that account (and clears its station,
// guaranteeing it stays a super admin).

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URL = process.env.MONGODB_URL;
if (!MONGODB_URL) {
  console.error("✖  MONGODB_URL is not set. Run with: node --env-file=.env ...");
  process.exit(1);
}

const [, , argName, argEmail, argPassword] = process.argv;

const fullName = argName || process.env.SUPERADMIN_NAME || "Super Administrator";
const email = (argEmail || process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
const password = argPassword || process.env.SUPERADMIN_PASSWORD || "";

if (!email || !password) {
  console.error(
    "✖  Email and password are required.\n" +
      '   Example: npm run seed:superadmin -- "Jane Doe" jane@police.gov "StrongPass123"',
  );
  process.exit(1);
}
if (password.length < 6) {
  console.error("✖  Password must be at least 6 characters.");
  process.exit(1);
}

// Minimal schema mirroring models/User.ts (collection: "users").
const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "nco", "cid", "so", "dc"], required: true },
    stationId: { type: String, default: null },
    profilePhoto: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function main() {
  await mongoose.connect(MONGODB_URL, { bufferCommands: false });
  const hashed = await bcrypt.hash(password, 10);

  const result = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        fullName,
        email,
        password: hashed,
        role: "admin",
        stationId: null, // no station ⇒ SUPER ADMIN
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log("✔  Super admin ready.");
  console.log(`   Name : ${result.fullName}`);
  console.log(`   Email: ${result.email}`);
  console.log(`   Role : ${result.role} (no station = super admin)`);
  console.log("\n   Log in at /login with this email and the password you set.");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("✖  Failed to create super admin:", err.message);
  process.exit(1);
});
