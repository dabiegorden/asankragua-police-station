import mongoose from "mongoose";

const PersonnelSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
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
    badgeNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
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
    phoneNumber: {
      type: String,
      required: true,
    },
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
    dateOfBirth: {
      type: Date,
      required: true,
    },
    dateJoined: {
      type: Date,
      default: Date.now,
    },
    profileImage: {
      type: String,
      default: null,
    },
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
    department: {
      type: String,
      default: "General",
    },
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
        caseId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Case",
        },
        assignedDate: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["active", "completed"],
          default: "active",
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.Personnel ||
  mongoose.model("Personnel", PersonnelSchema);
