// models/Prisoner.ts
import mongoose, { Document, Model, Schema } from "mongoose";

// ─── Sub-document interfaces ───────────────────────────────────────────────

export interface IAddress {
  street?: string;
  city?: string;
  region?: string;
}

export interface IEmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
}

export interface ICharge {
  charge?: string;
  severity?: "misdemeanor" | "felony";
}

export interface IArrestDetails {
  arrestDate: Date;
  arrestLocation: string;
  arrestingOfficer?: mongoose.Types.ObjectId | null;
  otherArrestingOfficer?: string;
  charges?: ICharge[];
}

export interface IReleaseDetails {
  releaseDate?: Date;
  releaseType?:
    | "bail"
    | "court-order"
    | "charges-dropped"
    | "sentence-completed";
  releasedBy?: mongoose.Types.ObjectId;
  bailAmount?: number;
  notes?: string;
}

export interface IMedicalInfo {
  allergies?: string[];
  medications?: string[];
  medicalConditions?: string[];
  lastCheckup?: Date;
}

export interface IPersonalEffect {
  item?: string;
  description?: string;
  quantity?: number;
  condition?: string;
}

export interface IVisitorLog {
  visitorName?: string;
  relationship?: string;
  visitDate?: Date;
  duration?: number;
  notes?: string;
}

// ─── Main document interface ───────────────────────────────────────────────

export interface IPrisoner extends Document {
  prisonerNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: Date;
  gender: "male" | "female" | "other";
  nationality?: string;
  address?: IAddress;
  phoneNumber?: string;
  emergencyContact?: IEmergencyContact;
  mugshot?: string | null;
  fingerprints?: string | null;
  arrestDetails: IArrestDetails;
  caseId?: mongoose.Types.ObjectId | null;
  otherCase?: string;
  cellNumber: "Male" | "Female";
  status: "Jailed" | "Bailed" | "Remanded" | "Transferred";
  releaseDetails?: IReleaseDetails;
  briefNote?: string;
  medicalInfo?: IMedicalInfo;
  personalEffects?: IPersonalEffect[];
  visitorLog?: IVisitorLog[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ────────────────────────────────────────────────────────────────

const PrisonerSchema = new Schema<IPrisoner>(
  {
    prisonerNumber: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    middleName: {
      type: String,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    nationality: {
      type: String,
      default: "Ghanaian",
    },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      region: { type: String, default: "" },
    },
    phoneNumber: {
      type: String,
    },
    emergencyContact: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    mugshot: {
      type: String,
      default: null,
    },
    fingerprints: {
      type: String,
      default: null,
    },
    arrestDetails: {
      arrestDate: {
        type: Date,
        required: true,
      },
      arrestLocation: {
        type: String,
        required: true,
      },
      arrestingOfficer: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      otherArrestingOfficer: {
        type: String,
        default: "",
      },
      charges: [
        {
          charge: String,
          severity: {
            type: String,
            enum: ["misdemeanor", "felony"],
          },
        },
      ],
    },
    caseId: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      default: null,
    },
    otherCase: {
      type: String,
      default: "",
    },
    cellNumber: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Jailed", "Bailed", "Remanded", "Transferred"],
      default: "Jailed",
    },
    releaseDetails: {
      releaseDate: Date,
      releaseType: {
        type: String,
        enum: ["bail", "court-order", "charges-dropped", "sentence-completed"],
      },
      releasedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      bailAmount: Number,
      notes: String,
    },
    briefNote: {
      type: String,
      default: "",
    },
    medicalInfo: {
      allergies: { type: [String], default: [] },
      medications: { type: [String], default: [] },
      medicalConditions: { type: [String], default: [] },
      lastCheckup: Date,
    },
    personalEffects: [
      {
        item: String,
        description: String,
        quantity: Number,
        condition: String,
      },
    ],
    visitorLog: [
      {
        visitorName: String,
        relationship: String,
        visitDate: Date,
        duration: Number,
        notes: String,
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Prisoner: Model<IPrisoner> =
  (mongoose.models.Prisoner as Model<IPrisoner>) ??
  mongoose.model<IPrisoner>("Prisoner", PrisonerSchema);

export default Prisoner;
