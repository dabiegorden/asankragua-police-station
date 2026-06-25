// src/models/Dutyroster.ts
// Weekly Duty Roster for Ghana Police Service stations.
// One roster covers a week (startDate → endDate).
// Status flow: draft → published (final — no approval step)

import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ─── Sub-document: a single officer assignment ─────────────────────────────

export interface IRosterEntry {
  _id?: Types.ObjectId;
  serialNumber: number;
  /** Display section / duty post heading, e.g. "STATION OFFICER" */
  section: string;
  officerName: string;
  officerUserId?: Types.ObjectId | null;
  rank: string;
  serviceNumber?: string;
  phoneNumber?: string;
  /** Free-text duty time e.g. "6:00AM–6:00PM" or "8:00AM–4:00PM" */
  dutyTime?: string;
  remarks?: string;
}

// ─── Main document ─────────────────────────────────────────────────────────

export interface IDutyRoster extends Document {
  rosterNumber: string;
  stationId: string;
  /** e.g. "ASA.67/VOL.10/239" */
  referenceNumber?: string;
  /** Commanding / District Commander name */
  districtCommander?: string;
  /** Star / compiling officer */
  stationOfficer?: string;
  startDate: Date;
  endDate: Date;
  entries: IRosterEntry[];
  generalRemarks?: string;
  /** draft = being built; published = finalised & active */
  status: "draft" | "published" | "archived";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schema ────────────────────────────────────────────────────────────

const RosterEntrySchema = new Schema<IRosterEntry>(
  {
    serialNumber: { type: Number, required: true },
    section: { type: String, required: true, trim: true },
    officerName: { type: String, required: true, trim: true },
    officerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rank: { type: String, required: true, trim: true },
    serviceNumber: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    dutyTime: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { _id: true },
);

// ─── Main schema ───────────────────────────────────────────────────────────

const DutyRosterSchema = new Schema<IDutyRoster>(
  {
    rosterNumber: { type: String, unique: true },
    stationId: { type: String, required: true, trim: true, lowercase: true },
    referenceNumber: { type: String, trim: true },
    districtCommander: { type: String, trim: true },
    stationOfficer: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    entries: { type: [RosterEntrySchema], default: [] },
    generalRemarks: { type: String, trim: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// ─── Auto-generate roster number ───────────────────────────────────────────

DutyRosterSchema.pre("save", async function () {
  if (this.isNew && !this.rosterNumber) {
    const year = new Date().getFullYear();
    const base = `DR-${year}-`;
    try {
      const last = await mongoose
        .model("DutyRoster")
        .findOne({ rosterNumber: { $regex: `^${base}` } })
        .sort({ rosterNumber: -1 })
        .select("rosterNumber")
        .lean<{ rosterNumber?: string }>();

      let next = 1;
      if (last?.rosterNumber) {
        const match = last.rosterNumber.match(/(\d+)\s*$/);
        if (match) next = parseInt(match[1], 10) + 1;
      }
      this.rosterNumber = `${base}${String(next).padStart(4, "0")}`;
    } catch {
      this.rosterNumber = `${base}${Date.now().toString().slice(-6)}`;
    }
  }
});

// ─── Indexes ───────────────────────────────────────────────────────────────

DutyRosterSchema.index({ stationId: 1, startDate: -1 });
DutyRosterSchema.index({ status: 1 });
DutyRosterSchema.index({ createdBy: 1 });

// ─── Model ─────────────────────────────────────────────────────────────────

const DutyRoster: Model<IDutyRoster> =
  (mongoose.models.DutyRoster as Model<IDutyRoster>) ??
  mongoose.model<IDutyRoster>("DutyRoster", DutyRosterSchema);

export default DutyRoster;
