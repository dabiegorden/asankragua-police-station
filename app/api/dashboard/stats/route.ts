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
import { resolveScopeStation } from "@/lib/stationScope";

export interface IDashboardStats {
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
  totalCases: number;
  activeCases: number;
  closedCases: number;
  suspendedCases: number;
  casesByStage: { nco: number; cid: number; so: number; dc: number };
  casesByPriority: {
    felony: number;
    misdemeanour: number;
    summaryOffence: number;
  };
  totalPersonnel: number;
  activePersonnel: number;
  personnelOnLeave: number;
  totalPrisoners: number;
  jailedPrisoners: number;
  bailedPrisoners: number;
  remandedPrisoners: number;
  totalVehicles: number;
  availableVehicles: number;
  vehiclesInUse: number;
  vehiclesInMaintenance: number;
  totalRifleBookings: number;
  activeRifleBookings: number;
  returnedRifleBookings: number;
  overdueRifleBookings: number;
  totalContacts: number;
  newContacts: number;
  inProgressContacts: number;
  resolvedContacts: number;
  urgentContacts: number;
  scopedToStation: string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { user, error } = requireRole(req, ["admin", "nco", "so", "dc"]);
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const requestedStation = searchParams.get("stationId");

    // Determine effective station scope.
    //   string    → scope to that station
    //   null      → no station filter (super admin / DC sees all stations)
    //   undefined → a station-bound user with no station attached: must see
    //               NOTHING, never fall through to "all stations".
    const scope = resolveScopeStation(user, requestedStation);

    if (scope === undefined) {
      // Force every station-scoped query to match nothing.
      const targetStation = "__no_station__";
      const stationFilter = { stationId: targetStation };
      const caseFilter = { loggedBy: { $in: [] as string[] } };
      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalCases,
        closedCases,
        suspendedCases,
        totalPersonnel,
        activePersonnel,
        personnelOnLeave,
        totalPrisoners,
        jailedPrisoners,
        bailedPrisoners,
        remandedPrisoners,
        totalVehicles,
        availableVehicles,
        vehiclesInUse,
        vehiclesInMaintenance,
        totalRifleBookings,
        activeRifleBookings,
        returnedRifleBookings,
        overdueRifleBookings,
      ] = await Promise.all([
        User.countDocuments({ stationId: targetStation }),
        User.countDocuments({ stationId: targetStation, isActive: true }),
        User.countDocuments({ stationId: targetStation, isActive: false }),
        Case.countDocuments(caseFilter),
        Case.countDocuments({ ...caseFilter, status: "closed" }),
        Case.countDocuments({ ...caseFilter, status: "suspended" }),
        Personnel.countDocuments(stationFilter),
        Personnel.countDocuments({ ...stationFilter, status: "active" }),
        Personnel.countDocuments({ ...stationFilter, status: "on-leave" }),
        Prisoner.countDocuments(stationFilter),
        Prisoner.countDocuments({ ...stationFilter, status: "Jailed" }),
        Prisoner.countDocuments({ ...stationFilter, status: "Bailed" }),
        Prisoner.countDocuments({ ...stationFilter, status: "Remanded" }),
        Vehicle.countDocuments(stationFilter),
        Vehicle.countDocuments({ ...stationFilter, status: "available" }),
        Vehicle.countDocuments({ ...stationFilter, status: "in-use" }),
        Vehicle.countDocuments({ ...stationFilter, status: "maintenance" }),
        RifleBooking.countDocuments(stationFilter),
        RifleBooking.countDocuments({ ...stationFilter, status: "active" }),
        RifleBooking.countDocuments({ ...stationFilter, status: "returned" }),
        RifleBooking.countDocuments({ ...stationFilter, status: "overdue" }),
      ]);

      const emptyStats: IDashboardStats = {
        totalUsers,
        activeUsers,
        inactiveUsers,
        usersByRole: { admin: 0, nco: 0, cid: 0, so: 0, dc: 0 },
        totalCases,
        activeCases: totalCases - closedCases - suspendedCases,
        closedCases,
        suspendedCases,
        casesByStage: { nco: 0, cid: 0, so: 0, dc: 0 },
        casesByPriority: { felony: 0, misdemeanour: 0, summaryOffence: 0 },
        totalPersonnel,
        activePersonnel,
        personnelOnLeave,
        totalPrisoners,
        jailedPrisoners,
        bailedPrisoners,
        remandedPrisoners,
        totalVehicles,
        availableVehicles,
        vehiclesInUse,
        vehiclesInMaintenance,
        totalRifleBookings,
        activeRifleBookings,
        returnedRifleBookings,
        overdueRifleBookings,
        totalContacts: 0,
        newContacts: 0,
        inProgressContacts: 0,
        resolvedContacts: 0,
        urgentContacts: 0,
        scopedToStation: null,
      };
      return NextResponse.json({ stats: emptyStats });
    }

    const targetStation: string | null = scope;

    // Station filter reused for all directly-station-stamped collections.
    const stationFilter: Record<string, unknown> = targetStation
      ? { stationId: targetStation }
      : {};

    // Resolve user IDs for the station (used to scope cases)
    let stationUserIds: string[] | null = null;
    if (targetStation) {
      const stationUsers = await User.find({ stationId: targetStation })
        .select("_id")
        .lean();
      stationUserIds = stationUsers.map((u) => u._id.toString());
    }

    const caseFilter: Record<string, unknown> = {};
    if (stationUserIds) {
      caseFilter.$or = [
        { loggedBy: { $in: stationUserIds } },
        { assignedOfficer: { $in: stationUserIds } },
        { assignedSO: { $in: stationUserIds } },
        { assignedDC: { $in: stationUserIds } },
      ];
    }

    const userFilter: Record<string, unknown> = targetStation
      ? { stationId: targetStation }
      : {};

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      adminUsers,
      ncoUsers,
      cidUsers,
      soUsers,
      dcUsers,
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
      totalPersonnel,
      activePersonnel,
      personnelOnLeave,
      totalPrisoners,
      jailedPrisoners,
      bailedPrisoners,
      remandedPrisoners,
      totalVehicles,
      availableVehicles,
      vehiclesInUse,
      vehiclesInMaintenance,
      totalRifleBookings,
      activeRifleBookings,
      returnedRifleBookings,
      overdueRifleBookings,
      totalContacts,
      newContacts,
      inProgressContacts,
      resolvedContacts,
      urgentContacts,
    ] = await Promise.all([
      User.countDocuments(userFilter),
      User.countDocuments({ ...userFilter, isActive: true }),
      User.countDocuments({ ...userFilter, isActive: false }),
      User.countDocuments({ ...userFilter, role: "admin" }),
      User.countDocuments({ ...userFilter, role: "nco" }),
      User.countDocuments({ ...userFilter, role: "cid" }),
      User.countDocuments({ ...userFilter, role: "so" }),
      User.countDocuments({ ...userFilter, role: "dc" }),

      Case.countDocuments(caseFilter),
      Case.countDocuments({ ...caseFilter, status: "closed" }),
      Case.countDocuments({ ...caseFilter, status: "suspended" }),
      Case.countDocuments({ ...caseFilter, currentStage: "nco" }),
      Case.countDocuments({ ...caseFilter, currentStage: "cid" }),
      Case.countDocuments({ ...caseFilter, currentStage: "so" }),
      Case.countDocuments({ ...caseFilter, currentStage: "dc" }),
      Case.countDocuments({ ...caseFilter, priority: "Felony" }),
      Case.countDocuments({ ...caseFilter, priority: "Misdemeanour" }),
      Case.countDocuments({ ...caseFilter, priority: "Summary Offence" }),

      Personnel.countDocuments(stationFilter),
      Personnel.countDocuments({ ...stationFilter, status: "active" }),
      Personnel.countDocuments({ ...stationFilter, status: "on-leave" }),
      Prisoner.countDocuments(stationFilter),
      Prisoner.countDocuments({ ...stationFilter, status: "Jailed" }),
      Prisoner.countDocuments({ ...stationFilter, status: "Bailed" }),
      Prisoner.countDocuments({ ...stationFilter, status: "Remanded" }),
      Vehicle.countDocuments(stationFilter),
      Vehicle.countDocuments({ ...stationFilter, status: "available" }),
      Vehicle.countDocuments({ ...stationFilter, status: "in-use" }),
      Vehicle.countDocuments({ ...stationFilter, status: "maintenance" }),
      RifleBooking.countDocuments(stationFilter),
      RifleBooking.countDocuments({ ...stationFilter, status: "active" }),
      RifleBooking.countDocuments({ ...stationFilter, status: "returned" }),
      RifleBooking.countDocuments({ ...stationFilter, status: "overdue" }),
      Contact.countDocuments(),
      Contact.countDocuments({ status: "new" }),
      Contact.countDocuments({ status: "in-progress" }),
      Contact.countDocuments({ status: "resolved" }),
      Contact.countDocuments({ priority: "urgent" }),
    ]);

    const activeCases = totalCases - closedCases - suspendedCases;

    const stats: IDashboardStats = {
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
      totalPersonnel,
      activePersonnel,
      personnelOnLeave,
      totalPrisoners,
      jailedPrisoners,
      bailedPrisoners,
      remandedPrisoners,
      totalVehicles,
      availableVehicles,
      vehiclesInUse,
      vehiclesInMaintenance,
      totalRifleBookings,
      activeRifleBookings,
      returnedRifleBookings,
      overdueRifleBookings,
      totalContacts,
      newContacts,
      inProgressContacts,
      resolvedContacts,
      urgentContacts,
      scopedToStation: targetStation,
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
