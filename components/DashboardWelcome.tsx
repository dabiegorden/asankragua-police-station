"use client";

import { useEffect, useState } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { getCurrentUser, type ClientUser } from "@/lib/clientUser";
import { getStationName } from "@/lib/stations";
import { ROLE_LABELS } from "@/constants/roles";

/**
 * Personalised welcome banner shown at the top of every role dashboard.
 * Greets the logged-in officer and clearly displays the police station they
 * belong to, so the station they are operating under is unmistakable.
 */
export default function DashboardWelcome() {
  const [user, setUser] = useState<ClientUser | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const firstName = user?.fullName?.split(" ")[0] || "Officer";
  const roleLabel = user?.role ? ROLE_LABELS[user.role] : "";

  // The District Commander oversees every station and the super admin manages
  // the whole system — neither belongs to a single station, so we show their
  // district-wide remit instead of a station name.
  const isOverseer =
    user?.role === "dc" || (user?.role === "admin" && !user?.stationId);
  const stationCaption = isOverseer ? "Oversight" : "Your Station";
  const stationName = isOverseer
    ? user?.role === "dc"
      ? "All Stations · District Command"
      : "All Stations · Super Admin"
    : getStationName(user?.stationId);

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-blue-100">
            Welcome to the Asankragua Police Dashboard
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
            Welcome back, {firstName}
          </h2>
          {roleLabel && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-blue-100">
              <ShieldCheck className="h-4 w-4" />
              {roleLabel}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-start rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
          <Building2 className="h-5 w-5 text-white" />
          <div className="leading-tight">
            <p className="text-[10px] font-medium uppercase tracking-wider text-blue-100">
              {stationCaption}
            </p>
            <p className="text-sm font-semibold">
              {stationName || "All Stations"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
