import mongoose from "mongoose";

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const NoteSchema = new mongoose.Schema({
  content: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  roleSnapshot: { type: String }, // e.g. "nco", "cid"
  addedAt: { type: Date, default: Date.now },
});

/**
 * progressMessages — bidirectional thread between any roles on the case.
 * CID sends progress to NCO. SO sends instructions to CID. DC responds to SO. etc.
 */
const ProgressMessageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  fromRole: { type: String, required: true },
  toRole: { type: String, required: true }, // target role: "nco" | "cid" | "so" | "dc"
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional specific target
  sentAt: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const CaseSchema = new mongoose.Schema(
  {
    caseNumber: { type: String, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
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

    // ── Workflow ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "open", // NCO logged, not referred
        "referred", // NCO → CID
        "investigating", // CID working
        "under_review", // CID → SO
        "commander_review", // SO → DC
        "closed",
        "suspended",
      ],
      default: "open",
    },
    currentStage: {
      type: String,
      enum: ["nco", "cid", "so", "dc"],
      default: "nco",
    },

    // ── People ────────────────────────────────────────────────────────────────
    reportedBy: {
      name: { type: String, required: true },
      phone: String,
      email: String,
      address: String,
    },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // CID
    assignedSO: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedDC: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ── Location / dates ──────────────────────────────────────────────────────
    location: { type: String, required: true },
    dateReported: { type: Date, default: Date.now },
    dateOccurred: { type: Date, required: true },

    // ── Related records ───────────────────────────────────────────────────────
    evidence: [{ type: mongoose.Schema.Types.ObjectId, ref: "Evidence" }],
    suspects: [
      { name: String, age: Number, description: String, address: String },
    ],
    witnesses: [{ name: String, phone: String, statement: String }],

    // ── Internal notes (any role can add) ─────────────────────────────────────
    notes: [NoteSchema],

    // ── Cross-role progress messages ──────────────────────────────────────────
    progressMessages: [ProgressMessageSchema],

    // ── Phase handoff notes ───────────────────────────────────────────────────
    ncoReferralNote: String, // NCO → CID
    cidSubmissionNote: String, // CID → SO
    soReviewNote: String, // SO → DC
    soDirective: String, // SO back → CID
    dcNote: String, // DC final

    // ── Timestamps ────────────────────────────────────────────────────────────
    referredAt: Date,
    investigationStartedAt: Date,
    submittedForReviewAt: Date,
    soReviewedAt: Date,
    dcReviewedAt: Date,
    closedAt: Date,
  },
  { timestamps: true },
);

// Auto-generate case number
CaseSchema.pre("save", async function () {
  if (this.isNew && !this.caseNumber) {
    try {
      const year = new Date().getFullYear();
      const count = await mongoose.model("Case").countDocuments({
        caseNumber: { $regex: `^RO-${year}-` },
      });
      this.caseNumber = `RO-${year}-${String(count + 1).padStart(4, "0")}`;
    } catch {
      this.caseNumber = `RO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    }
  }
});

export default mongoose.models.Case || mongoose.model("Case", CaseSchema);
