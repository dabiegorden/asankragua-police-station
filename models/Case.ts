import mongoose from "mongoose";

const CaseSchema = new mongoose.Schema(
  {
    caseNumber: {
      type: String,
      unique: true,
      // Don't mark as required since we generate it automatically
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
        "theft",
        "assault",
        "fraud",
        "domestic",
        "traffic",
        "drug",
        "other",
      ],
      required: true,
    },
    priority: {
      type: String,
      enum: ["Felony", "Misdemeanour", "Summary Offence"],
      default: "Summary Offence",
    },
    status: {
      type: String,
      enum: ["open", "investigating", "closed", "suspended"],
      default: "open",
    },
    reportedBy: {
      name: { type: String, required: true },
      phone: { type: String },
      email: { type: String },
      address: { type: String },
    },
    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    location: {
      type: String,
      required: true,
    },
    dateReported: {
      type: Date,
      default: Date.now,
    },
    dateOccurred: {
      type: Date,
      required: true,
    },
    evidence: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Evidence",
      },
    ],
    suspects: [
      {
        name: String,
        age: Number,
        description: String,
        address: String,
      },
    ],
    witnesses: [
      {
        name: String,
        phone: String,
        statement: String,
      },
    ],
    notes: [
      {
        content: String,
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Generate case number before saving
CaseSchema.pre("save", async function (next) {
  if (this.isNew && !this.caseNumber) {
    try {
      const year = new Date().getFullYear();

      // Count existing cases for this year to generate sequential number
      const count = await mongoose.model("Case").countDocuments({
        caseNumber: { $regex: `^RO-${year}-` },
      });

      this.caseNumber = `RO-${year}-${String(count + 1).padStart(4, "0")}`;
    } catch (error) {
      console.error("Error generating case number:", error);
      // Fallback: use timestamp
      const timestamp = Date.now().toString().slice(-4);
      this.caseNumber = `RO-${new Date().getFullYear()}-${timestamp}`;
    }
  }
  next();
});

export default mongoose.models.Case || mongoose.model("Case", CaseSchema);
