import mongoose from "mongoose";

const PrisonerSchema = new mongoose.Schema(
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
        type: String,
        required: true,
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
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
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
        type: mongoose.Schema.Types.ObjectId,
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

export default mongoose.models.Prisoner ||
  mongoose.model("Prisoner", PrisonerSchema);
