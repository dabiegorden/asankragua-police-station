// lib/clientUser.ts
// Tiny client-side helper to read the authenticated user that the login flow
// persisted in localStorage. Returns null on the server or when not logged in.

export interface ClientUser {
  _id?: string;
  fullName?: string;
  email?: string;
  role?: "admin" | "nco" | "cid" | "so" | "dc";
  stationId?: string | null;
  profilePhoto?: string | null;
}

export function getCurrentUser(): ClientUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as ClientUser) : null;
  } catch {
    return null;
  }
}

/** The main super administrator: role "admin" with no station attached. */
export function isSuperAdminUser(user: ClientUser | null): boolean {
  return !!user && user.role === "admin" && !user.stationId;
}
