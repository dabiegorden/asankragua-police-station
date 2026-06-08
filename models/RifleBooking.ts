import mongoose, { Document, Model, Schema } from "mongoose";

// ─── Sub-document interfaces ───────────────────────────────────────────────

export interface IInsurance {
  policyNumber?: string;
  provider?: string;
  coverageStartDate?: Date;
  coverageEndDate?: Date;
  notes?: string;
}

export interface IWeaponReturn {
  // ── Booking snapshot (captured/editable at return time) ──────────────────
  typeOfRifle?: string;
  rifleNumber?: string;
  serialNumber?: string;
  sdNumber?: string;
  ammunitionType?: string;
  numberOfAmmunition?: number;
  dateOfBooking?: Date;
  typeOfDuty?: string;
  nameOfPersonnel?: string;
  issuedBy?: string;
  receivedBy?: string;
  // ── Return-specific fields ────────────────────────────────────────────────
  returnedBy?: string;
  /** Officer who receives the weapon back at the armoury */
  returnReceivedBy?: string;
  returnDate?: Date;
  ammunitionReturned?: number;
  conditionOnReturn?: "good" | "damaged" | "lost";
  notes?: string;
}

// ─── Main document interface ───────────────────────────────────────────────

export interface IRifleBooking extends Document {
  stationId: string;
  bookingNumber: string;
  typeOfRifle: string;
  rifleNumber: string;
  serialNumber: string;
  sdNumber: string;
  ammunitionType: string;
  numberOfAmmunition: number;
  dateOfBooking: Date;
  typeOfDuty: string;
  nameOfPersonnel: string;
  issuedBy: string;
  receivedBy: string;
  /** Insurance / issuance details for the weapon taken out on duty */
  insurance?: IInsurance;
  /**
   * Return details — populated when the weapon comes back from the duty post.
   * Includes a snapshot of the core booking fields (as they stood at return
   * time) so the return record is self-contained.
   */
  weaponReturn?: IWeaponReturn;
  status: "active" | "returned" | "overdue";
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ────────────────────────────────────────────────────────────────

const InsuranceSchema = new Schema<IInsurance>(
  {
    policyNumber: { type: String },
    provider: { type: String },
    coverageStartDate: { type: Date },
    coverageEndDate: { type: Date },
    notes: { type: String },
  },
  { _id: false },
);

const WeaponReturnSchema = new Schema<IWeaponReturn>(
  {
    // ── Booking snapshot fields ────────────────────────────────────────────
    typeOfRifle: { type: String },
    rifleNumber: { type: String },
    serialNumber: { type: String },
    sdNumber: { type: String },
    ammunitionType: { type: String },
    numberOfAmmunition: { type: Number, min: 0 },
    dateOfBooking: { type: Date },
    typeOfDuty: { type: String },
    nameOfPersonnel: { type: String },
    issuedBy: { type: String },
    receivedBy: { type: String },
    // ── Return-specific fields ─────────────────────────────────────────────
    returnedBy: { type: String },
    returnReceivedBy: { type: String },
    returnDate: { type: Date },
    ammunitionReturned: { type: Number, min: 0 },
    conditionOnReturn: {
      type: String,
      enum: ["good", "damaged", "lost"],
    },
    notes: { type: String },
  },
  { _id: false },
);

const RifleBookingSchema = new Schema<IRifleBooking>(
  {
    stationId: { type: String, required: true, index: true },
    bookingNumber: { type: String, required: true, unique: true },
    typeOfRifle: { type: String, required: true },
    rifleNumber: { type: String, required: true },
    serialNumber: { type: String, required: true, unique: true },
    sdNumber: { type: String, required: true },
    ammunitionType: { type: String, required: true },
    numberOfAmmunition: { type: Number, required: true, min: 0 },
    dateOfBooking: { type: Date, required: true, default: Date.now },
    typeOfDuty: { type: String, required: true },
    nameOfPersonnel: { type: String, required: true },
    issuedBy: { type: String, required: true },
    receivedBy: { type: String, required: true },
    insurance: { type: InsuranceSchema, default: {} },
    weaponReturn: { type: WeaponReturnSchema, default: {} },
    status: {
      type: String,
      enum: ["active", "returned", "overdue"],
      default: "active",
    },
  },
  { timestamps: true },
);

const RifleBooking: Model<IRifleBooking> =
  (mongoose.models.RifleBooking as Model<IRifleBooking>) ??
  mongoose.model<IRifleBooking>("RifleBooking", RifleBookingSchema);

export default RifleBooking;
