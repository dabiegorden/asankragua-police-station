import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: "admin" | "nco" | "cid" | "so" | "dc";
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("JWT VERIFY ERROR:", error);
    return null;
  }
}

export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: "30d" });
}
