// src/models/Case.ts

import mongoose from "mongoose";

// ─── Attachment sub-schema ────────────────────────────────────────────────────
// Reused across notes, messages, and the case itself
const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true }, // Cloudinary secure URL
    publicId: { type: String, required: true }, // Cloudinary public_id (for deletion)
    originalName: { type: String },
    resourceType: {
      type: String,
      enum: ["image", "video", "raw", "auto"],
      default: "auto",
    },
    format: { type: String }, // e.g. "pdf", "jpg"
    bytes: { type: Number },
  },
  { _id: false },
);

// ─── Internal note (any authenticated role, visible to all on the case) ───────
const NoteSchema = new mongoose.Schema({
  content: { type: String, required: true },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  roleSnapshot: { type: String, required: true },
  attachments: { type: [AttachmentSchema], default: [] },
  addedAt: { type: Date, default: Date.now },
});

// ─── Scoped communication thread message ──────────────────────────────────────
//
// thread field controls who can read the message:
//   "nco_cid"  → only the NCO/SO who logged it + the assigned CID officer
//   "cid_so"   → only the assigned CID officer + the assigned SO
//   "dc"       → DC can message any participant; all parties on the case see it
//
const ThreadMessageSchema = new mongoose.Schema({
  thread: {
    type: String,
    enum: ["nco_cid", "cid_so", "dc"],
    required: true,
  },
  content: { type: String, required: true },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  fromRole: { type: String, required: true },
  // For DC messages: explicit target role
  toRole: { type: String, default: null },
  attachments: { type: [AttachmentSchema], default: [] },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  sentAt: { type: Date, default: Date.now },
});

// ─── Main Case schema ─────────────────────────────────────────────────────────
const CaseSchema = new mongoose.Schema(
  {
    caseNumber: { type: String, unique: true },

    title: { type: String, required: true, trim: true },
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

    // ── Workflow stage & status ───────────────────────────────────────────────
    //
    // status  — overall lifecycle label shown in the UI
    // currentStage — whose court the ball is in right now
    //
    status: {
      type: String,
      enum: [
        "open", // NCO/SO logged, not yet referred
        "referred", // referred to CID
        "investigating", // CID accepted & started
        "under_review", // CID submitted to SO
        "commander_review", // SO forwarded to DC
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

    // ── Reporter (civilian) ───────────────────────────────────────────────────
    reportedBy: {
      name: { type: String, required: true },
      phone: String,
      email: String,
      address: String,
    },

    // ── Assigned officers ─────────────────────────────────────────────────────
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // NCO or SO who created the case
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // CID investigator
    assignedSO: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Station Officer
    assignedDC: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // District Commander

    // ── Incident details ──────────────────────────────────────────────────────
    location: { type: String, required: true },
    dateReported: { type: Date, default: Date.now },
    dateOccurred: { type: Date, required: true },

    // ── Evidence & parties ────────────────────────────────────────────────────
    evidence: [{ type: mongoose.Schema.Types.ObjectId, ref: "Evidence" }],
    suspects: [
      { name: String, age: Number, description: String, address: String },
    ],
    witnesses: [{ name: String, phone: String, statement: String }],

    // ── Case-level file attachments (uploaded when creating / editing a case) ─
    attachments: { type: [AttachmentSchema], default: [] },

    // ── Internal notes (visible to all authenticated users on the case) ───────
    notes: [NoteSchema],

    // ── Scoped thread messages ────────────────────────────────────────────────
    //    Each message carries its own `thread` tag so a single array powers
    //    all three communication channels without extra collections.
    threadMessages: [ThreadMessageSchema],

    // ── Handoff notes (preserved per stage for the paper trail) ──────────────
    ncoReferralNote: String, // NCO → CID
    cidSubmissionNote: String, // CID → SO
    soReviewNote: String, // SO → DC
    soDirective: String, // SO sends back to CID with instructions
    dcNote: String, // DC final decision note

    // ── Stage timestamps ──────────────────────────────────────────────────────
    referredAt: Date,
    investigationStartedAt: Date,
    submittedForReviewAt: Date,
    soReviewedAt: Date,
    dcReviewedAt: Date,
    closedAt: Date,
  },
  { timestamps: true },
);

// ─── Auto-generate case number (RO-YYYY-NNNN) ────────────────────────────────
CaseSchema.pre("save", async function () {
  if (this.isNew && !this.caseNumber) {
    try {
      const year = new Date().getFullYear();
      const count = await mongoose.model("Case").countDocuments({
        caseNumber: { $regex: `^RO-${year}-` },
      });
      this.caseNumber = `RO-${year}-${String(count + 1).padStart(4, "0")}`;
    } catch {
      this.caseNumber = `RO-${new Date().getFullYear()}-${Date.now()
        .toString()
        .slice(-4)}`;
    }
  }
});

// ─── Index for fast thread queries ───────────────────────────────────────────
CaseSchema.index({ "threadMessages.thread": 1 });
CaseSchema.index({ status: 1, currentStage: 1 });

export default mongoose.models.Case || mongoose.model("Case", CaseSchema);
