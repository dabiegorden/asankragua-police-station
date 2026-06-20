// src/app/api/stations/route.ts
// Returns the list of police stations in the Asankragua community.
// The DC uses this to populate a station-selector dropdown.

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/middleware/auth";
import { ASANKRAGUA_STATIONS } from "@/lib/stations";

// Re-exported for any server modules still importing it from here.
export { ASANKRAGUA_STATIONS };

export async function GET(req: NextRequest) {
  const { error } = requireRole(req, ["dc", "admin", "nco", "so"]);
  if (error) return error;

  return NextResponse.json({ stations: ASANKRAGUA_STATIONS });
}
