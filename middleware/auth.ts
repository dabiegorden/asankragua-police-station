import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JWTPayload } from "@/lib/jwt";

export type AuthenticatedRequest = NextRequest & {
  user?: JWTPayload;
};

// Extracts and verifies JWT from cookies or Authorization header
export function getAuthUser(req: NextRequest): JWTPayload | null {
  // Try cookie first
  const tokenFromCookie = req.cookies.get("token")?.value;
  // Fall back to Bearer token
  const authHeader = req.headers.get("authorization");
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const token = tokenFromCookie || tokenFromHeader;
  if (!token) return null;

  return verifyToken(token);
}

// Use inside route handlers to protect routes
export function requireAuth(req: NextRequest): {
  user: JWTPayload | null;
  error: NextResponse | null;
} {
  const user = getAuthUser(req);
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, error: null };
}

// Use to restrict route to specific roles
export function requireRole(
  req: NextRequest,
  allowedRoles: JWTPayload["role"][],
): { user: JWTPayload | null; error: NextResponse | null } {
  const { user, error } = requireAuth(req);
  if (error) return { user: null, error };

  if (!allowedRoles.includes(user!.role)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, error: null };
}
