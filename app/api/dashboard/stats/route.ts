// src/app/api/dashboard/stats/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Case from "@/models/Case";
import Personnel from "@/models/Personnel";
import Prisoner from "@/models/Prisoner";
import Vehicle from "@/models/Vehicle";
import RifleBooking from "@/models/RifleBooking";
import Contact from "@/models/Contact";
import { requireRole } from "@/middleware/auth";

// ─── Response shape ────────────────────────────────────────────────────────

export interface IDashboardStats {
  // Users
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: {
    admin: number;
    nco: number;
    cid: number;
    so: number;
    dc: number;
  };

  // Cases
  totalCases: number;
  activeCases: number;
  closedCases: number;
  suspendedCases: number;
  casesByStage: {
    nco: number;
    cid: number;
    so: number;
    dc: number;
  };
  casesByPriority: {
    felony: number;
    misdemeanour: number;
    summaryOffence: number;
  };

  // Personnel
  totalPersonnel: number;
  activePersonnel: number;
  personnelOnLeave: number;

  // Prisoners
  totalPrisoners: number;
  jailedPrisoners: number;
  bailedPrisoners: number;
  remandedPrisoners: number;

  // Vehicles
  totalVehicles: number;
  availableVehicles: number;
  vehiclesInUse: number;
  vehiclesInMaintenance: number;

  // Rifle Bookings
  totalRifleBookings: number;
  activeRifleBookings: number;
  returnedRifleBookings: number;
  overdueRifleBookings: number;

  // Contacts
  totalContacts: number;
  newContacts: number;
  inProgressContacts: number;
  resolvedContacts: number;
  urgentContacts: number;
}

// ─── GET handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { user, error } = requireRole(req, ["admin", "nco", "so", "dc"]);
  if (error) return error;

  try {
    await connectDB();

    const now = new Date();

    const [
      // Users
      totalUsers,
      activeUsers,
      inactiveUsers,
      adminUsers,
      ncoUsers,
      cidUsers,
      soUsers,
      dcUsers,

      // Cases
      totalCases,
      closedCases,
      suspendedCases,
      ncoStageCases,
      cidStageCases,
      soStageCases,
      dcStageCases,
      felonyCases,
      misdemeanourCases,
      summaryOffenceCases,

      // Personnel
      totalPersonnel,
      activePersonnel,
      personnelOnLeave,

      // Prisoners
      totalPrisoners,
      jailedPrisoners,
      bailedPrisoners,
      remandedPrisoners,

      // Vehicles
      totalVehicles,
      availableVehicles,
      vehiclesInUse,
      vehiclesInMaintenance,

      // Rifle Bookings
      totalRifleBookings,
      activeRifleBookings,
      returnedRifleBookings,
      overdueRifleBookings,

      // Contacts
      totalContacts,
      newContacts,
      inProgressContacts,
      resolvedContacts,
      urgentContacts,
    ] = await Promise.all([
      // ── Users ──────────────────────────────────────────────────────────
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "nco" }),
      User.countDocuments({ role: "cid" }),
      User.countDocuments({ role: "so" }),
      User.countDocuments({ role: "dc" }),

      // ── Cases ──────────────────────────────────────────────────────────
      Case.countDocuments(),
      Case.countDocuments({ status: "closed" }),
      Case.countDocuments({ status: "suspended" }),
      Case.countDocuments({ currentStage: "nco" }),
      Case.countDocuments({ currentStage: "cid" }),
      Case.countDocuments({ currentStage: "so" }),
      Case.countDocuments({ currentStage: "dc" }),
      Case.countDocuments({ priority: "Felony" }),
      Case.countDocuments({ priority: "Misdemeanour" }),
      Case.countDocuments({ priority: "Summary Offence" }),

      // ── Personnel ──────────────────────────────────────────────────────
      Personnel.countDocuments(),
      Personnel.countDocuments({ status: "active" }),
      Personnel.countDocuments({ status: "on-leave" }),

      // ── Prisoners ──────────────────────────────────────────────────────
      Prisoner.countDocuments(),
      Prisoner.countDocuments({ status: "Jailed" }),
      Prisoner.countDocuments({ status: "Bailed" }),
      Prisoner.countDocuments({ status: "Remanded" }),

      // ── Vehicles ───────────────────────────────────────────────────────
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ status: "available" }),
      Vehicle.countDocuments({ status: "in-use" }),
      Vehicle.countDocuments({ status: "maintenance" }),

      // ── Rifle Bookings ─────────────────────────────────────────────────
      RifleBooking.countDocuments(),
      RifleBooking.countDocuments({ status: "active" }),
      RifleBooking.countDocuments({ status: "returned" }),
      RifleBooking.countDocuments({ status: "overdue" }),

      // ── Contacts ───────────────────────────────────────────────────────
      Contact.countDocuments(),
      Contact.countDocuments({ status: "new" }),
      Contact.countDocuments({ status: "in-progress" }),
      Contact.countDocuments({ status: "resolved" }),
      Contact.countDocuments({ priority: "urgent" }),
    ]);

    // Derive active cases (everything that isn't closed or suspended)
    const activeCases = totalCases - closedCases - suspendedCases;

    const stats: IDashboardStats = {
      // Users
      totalUsers,
      activeUsers,
      inactiveUsers,
      usersByRole: {
        admin: adminUsers,
        nco: ncoUsers,
        cid: cidUsers,
        so: soUsers,
        dc: dcUsers,
      },

      // Cases
      totalCases,
      activeCases,
      closedCases,
      suspendedCases,
      casesByStage: {
        nco: ncoStageCases,
        cid: cidStageCases,
        so: soStageCases,
        dc: dcStageCases,
      },
      casesByPriority: {
        felony: felonyCases,
        misdemeanour: misdemeanourCases,
        summaryOffence: summaryOffenceCases,
      },

      // Personnel
      totalPersonnel,
      activePersonnel,
      personnelOnLeave,

      // Prisoners
      totalPrisoners,
      jailedPrisoners,
      bailedPrisoners,
      remandedPrisoners,

      // Vehicles
      totalVehicles,
      availableVehicles,
      vehiclesInUse,
      vehiclesInMaintenance,

      // Rifle Bookings
      totalRifleBookings,
      activeRifleBookings,
      returnedRifleBookings,
      overdueRifleBookings,

      // Contacts
      totalContacts,
      newContacts,
      inProgressContacts,
      resolvedContacts,
      urgentContacts,
    };

    return NextResponse.json({ stats });
  } catch (err) {
    console.error("[dashboard/stats]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
