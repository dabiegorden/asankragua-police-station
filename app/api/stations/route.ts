// src/app/api/stations/route.ts
// Returns the list of police stations in the Asankragua community.
// The DC uses this to populate a station-selector dropdown.

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/middleware/auth";

// All stations under the Asankragua District Command.
// Add or remove entries here as the community grows.
export const ASANKRAGUA_STATIONS = [
  { id: "asankragua", name: "Asankragua Police Station" },
  { id: "asankra-breman", name: "Asankra-Breman Police Station" },
  { id: "sumpre", name: "Sumpre Police Station" },
  { id: "samrebio", name: "Samrebio Police Station" },
];

export async function GET(req: NextRequest) {
  const { user, error } = requireRole(req, ["dc", "admin"]);
  if (error) return error;

  return NextResponse.json({ stations: ASANKRAGUA_STATIONS });
}
