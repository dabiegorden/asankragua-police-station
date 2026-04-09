import mongoose, { Document, Model, Schema } from "mongoose";

// ─── Sub-document interfaces ───────────────────────────────────────────────

export interface IEmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
}

export interface IAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface ICertification {
  name?: string;
  issuedBy?: string;
  dateIssued?: Date;
  expiryDate?: Date;
}

export interface IAssignment {
  caseId?: mongoose.Types.ObjectId;
  assignedDate?: Date;
  status?: "active" | "completed";
}

// ─── Main document interface ───────────────────────────────────────────────

export interface IPersonnel extends Document {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: "District Commander" | "Station Officer" | "Counter NCO" | "Counter SO";
  badgeNumber?: string | null;
  rank:
    | "Constable"
    | "Lance Corporal"
    | "Sergeant"
    | "Inspector"
    | "Chief Inspector"
    | "Aspol"
    | "Desupol"
    | "Supol"
    | "Chief Supol"
    | "Acpol"
    | "Dipol"
    | "Cop"
    | "Superintendent";
  specialization:
    | "General"
    | "Traffic"
    | "Criminal Investigation"
    | "Cybercrime"
    | "Narcotics"
    | "K9 Unit";
  phoneNumber: string;
  emergencyContact?: IEmergencyContact;
  address?: IAddress;
  dateOfBirth: Date;
  dateJoined?: Date;
  profileImage?: string | null;
  shift: "morning" | "afternoon" | "night";
  status: "active" | "on-leave" | "suspended" | "retired" | "Sick";
  department?: string;
  certifications?: ICertification[];
  assignments?: IAssignment[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ────────────────────────────────────────────────────────────────

const PersonnelSchema = new Schema<IPersonnel>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    username: { type: String, required: true, unique: true, trim: true },
    role: {
      type: String,
      enum: [
        "District Commander",
        "Station Officer",
        "Counter NCO",
        "Counter SO",
      ],
      required: true,
    },
    badgeNumber: { type: String, unique: true, sparse: true, default: null },
    rank: {
      type: String,
      enum: [
        "Constable",
        "Lance Corporal",
        "Sergeant",
        "Inspector",
        "Chief Inspector",
        "Aspol",
        "Desupol",
        "Supol",
        "Chief Supol",
        "Acpol",
        "Dipol",
        "Cop",
        "Superintendent",
      ],
      required: true,
    },
    specialization: {
      type: String,
      enum: [
        "General",
        "Traffic",
        "Criminal Investigation",
        "Cybercrime",
        "Narcotics",
        "K9 Unit",
      ],
      default: "General",
    },
    phoneNumber: { type: String, required: true },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
    },
    dateOfBirth: { type: Date, required: true },
    dateJoined: { type: Date, default: Date.now },
    profileImage: { type: String, default: null },
    shift: {
      type: String,
      enum: ["morning", "afternoon", "night"],
      default: "morning",
    },
    status: {
      type: String,
      enum: ["active", "on-leave", "suspended", "retired", "Sick"],
      default: "active",
    },
    department: { type: String, default: "General" },
    certifications: [
      {
        name: String,
        issuedBy: String,
        dateIssued: Date,
        expiryDate: Date,
      },
    ],
    assignments: [
      {
        caseId: { type: Schema.Types.ObjectId, ref: "Case" },
        assignedDate: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["active", "completed"],
          default: "active",
        },
      },
    ],
  },
  { timestamps: true },
);

const Personnel: Model<IPersonnel> =
  (mongoose.models.Personnel as Model<IPersonnel>) ??
  mongoose.model<IPersonnel>("Personnel", PersonnelSchema);

export default Personnel;
