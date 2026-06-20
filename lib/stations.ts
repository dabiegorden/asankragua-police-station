// lib/stations.ts
// Single source of truth for the police stations under the Asankragua District
// Command. Safe to import from both client and server code (no server-only deps).

export interface Station {
  id: string;
  name: string;
}

// All stations under the Asankragua District Command.
// Add or remove entries here as the community grows.
export const ASANKRAGUA_STATIONS: Station[] = [
  { id: "asankragua", name: "Asankragua Police Station" },
  { id: "asankra-breman", name: "Asankra-Breman Police Station" },
  { id: "sumpre", name: "Sumpre Police Station" },
  { id: "samrebio", name: "Samrebio Police Station" },
];

/** Resolve a human-readable station name from its id. */
export function getStationName(stationId?: string | null): string {
  if (!stationId) return "";
  const match = ASANKRAGUA_STATIONS.find((s) => s.id === stationId);
  return match ? match.name : stationId;
}
