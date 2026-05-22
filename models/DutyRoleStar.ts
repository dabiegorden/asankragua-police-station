// src/models/DutyRoleStar.ts
// Duty Role Star — daily duty assignment register for Ghana Police Service stations.

import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ─── Sub-document interfaces ───────────────────────────────────────────────

export interface IDutyEntry {
  _id?: Types.ObjectId;
  serialNumber: number;
  officerName: string;
  officerUserId?: Types.ObjectId | null;
  rank: string;
  serviceNumber?: string;
  dutyPost: string;
  dutyType:
    | "Guard"
    | "Patrol"
    | "Office"
    | "Court"
    | "Escort"
    | "Traffic"
    | "Investigation"
    | "Reserve"
    | "Other";
  shiftStart: string;
  shiftEnd: string;
  remarks?: string;
  present: boolean;
}

export interface IDutyRoleStar extends Document {
  starNumber: string;
  stationId: string;
  dutyDate: Date;
  shift: "morning" | "afternoon" | "night" | "full-day";
  starOfficer: string;
  starOfficerUserId?: Types.ObjectId | null;
  commandingOfficer: string;
  commandingOfficerUserId?: Types.ObjectId | null;
  totalStrength: number;
  absentCount: number;
  status: "draft" | "published" | "approved" | "archived";
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date;
  entries: IDutyEntry[];
  generalRemarks?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ───────────────────────────────────────────────────────────

const DutyEntrySchema = new Schema<IDutyEntry>(
  {
    serialNumber: { type: Number, required: true },
    officerName: { type: String, required: true, trim: true },
    officerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rank: { type: String, required: true, trim: true },
    serviceNumber: { type: String, trim: true },
    dutyPost: { type: String, required: true, trim: true },
    dutyType: {
      type: String,
      required: true,
      enum: [
        "Guard",
        "Patrol",
        "Office",
        "Court",
        "Escort",
        "Traffic",
        "Investigation",
        "Reserve",
        "Other",
      ],
      default: "Guard",
    },
    shiftStart: { type: String, required: true },
    shiftEnd: { type: String, required: true },
    remarks: { type: String, trim: true },
    present: { type: Boolean, default: true },
  },
  { _id: true },
);

const DutyRoleStarSchema = new Schema<IDutyRoleStar>(
  {
    starNumber: { type: String, unique: true },
    stationId: { type: String, required: true, trim: true, lowercase: true },
    dutyDate: { type: Date, required: true },
    shift: {
      type: String,
      enum: ["morning", "afternoon", "night", "full-day"],
      required: true,
      default: "full-day",
    },
    starOfficer: { type: String, required: true, trim: true },
    starOfficerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    commandingOfficer: { type: String, required: true, trim: true },
    commandingOfficerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    totalStrength: { type: Number, default: 0 },
    absentCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "published", "approved", "archived"],
      default: "draft",
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date },
    entries: { type: [DutyEntrySchema], default: [] },
    generalRemarks: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// ─── Auto-generate star number + recompute counts ──────────────────────────

DutyRoleStarSchema.pre("save", async function () {
  if (this.isNew && !this.starNumber) {
    try {
      const year = new Date().getFullYear();
      const count = await mongoose
        .model("DutyRoleStar")
        .countDocuments({ starNumber: { $regex: `^DRS-${year}-` } });
      this.starNumber = `DRS-${year}-${String(count + 1).padStart(4, "0")}`;
    } catch {
      this.starNumber = `DRS-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    }
  }
  this.totalStrength = this.entries.length;
  this.absentCount = this.entries.filter((e) => !e.present).length;
});

// ─── Indexes ───────────────────────────────────────────────────────────────

DutyRoleStarSchema.index({ stationId: 1, dutyDate: -1 });
DutyRoleStarSchema.index({ status: 1 });
DutyRoleStarSchema.index({ createdBy: 1 });

// ─── Model ─────────────────────────────────────────────────────────────────

const DutyRoleStar: Model<IDutyRoleStar> =
  (mongoose.models.DutyRoleStar as Model<IDutyRoleStar>) ??
  mongoose.model<IDutyRoleStar>("DutyRoleStar", DutyRoleStarSchema);

export default DutyRoleStar;
