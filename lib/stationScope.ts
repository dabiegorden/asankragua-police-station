// lib/stationScope.ts
// Centralised station-scoping rules so every API route enforces the same model.
//
// Roles & station visibility:
//   nco / so         → hard-locked to their own station (never overrideable)
//   dc               → defaults to own station, may inspect another via ?stationId=
//   admin (station)  → an admin WITH a stationId is a STATION ADMIN, hard-locked
//                      to that station exactly like nco/so
//   admin (super)    → an admin WITHOUT a stationId is the SUPER ADMIN, sees all
//                      stations and may optionally filter via ?stationId=

export interface ScopeUser {
  role: string;
  stationId?: string | null;
}

/** The main super administrator: role "admin" with no station attached. */
export function isSuperAdmin(user: ScopeUser): boolean {
  return user.role === "admin" && !user.stationId;
}

/** A per-station administrator: role "admin" assigned to a specific station. */
export function isStationAdmin(user: ScopeUser): boolean {
  return user.role === "admin" && !!user.stationId;
}

/**
 * Resolve the station value a list query should be filtered by.
 * Returns:
 *   - a stationId string  → filter results to that station
 *   - null                → no station filter (super admin sees everything)
 *   - undefined           → caller should return an EMPTY result set
 *                           (a station-bound user with no station attached)
 */
export function resolveScopeStation(
  user: ScopeUser,
  requestedStationId?: string | null,
): string | null | undefined {
  switch (user.role) {
    case "nco":
    case "so":
      return user.stationId ? user.stationId : undefined;
    case "dc":
      // The DC oversees every station by default and only narrows the view
      // when a specific station is explicitly requested.
      return requestedStationId || null;
    case "admin":
      // Station admin: hard-locked to own station. Super admin: optional filter.
      if (user.stationId) return user.stationId;
      return requestedStationId || null;
    default:
      return user.stationId ?? null;
  }
}

/**
 * Resolve the station a newly-created record should belong to.
 * Only the DC and the super admin may direct a record to an arbitrary station;
 * everyone else (including station admins) is pinned to their own station.
 * Returns null when no station can be resolved.
 */
export function resolveCreateStation(
  user: ScopeUser,
  bodyStationId?: string | null,
): string | null {
  const canChoose = user.role === "dc" || isSuperAdmin(user);
  if (canChoose && bodyStationId) return bodyStationId;
  return user.stationId ?? null;
}
