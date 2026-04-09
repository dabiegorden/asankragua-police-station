import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JWTPayload } from "@/lib/jwt";

export type AuthenticatedRequest = NextRequest & {
  user?: JWTPayload;
};

type AuthResult =
  | { user: JWTPayload; error: null }
  | { user: null; error: NextResponse };

export function getAuthUser(req: NextRequest): JWTPayload | null {
  const tokenFromCookie = req.cookies.get("token")?.value;
  const authHeader = req.headers.get("authorization");
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const token = tokenFromCookie ?? tokenFromHeader;
  if (!token) return null;

  return verifyToken(token);
}

export function requireAuth(req: NextRequest): AuthResult {
  const user = getAuthUser(req);
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, error: null };
}

export function requireRole(
  req: NextRequest,
  allowedRoles: JWTPayload["role"][],
): AuthResult {
  const result = requireAuth(req);
  if (result.error) return result;

  if (!allowedRoles.includes(result.user.role)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user: result.user, error: null };
}
