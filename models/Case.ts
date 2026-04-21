// src/models/Case.ts
// Digital Case Book — updated schema with caseBookEntries + auditLog

import mongoose from "mongoose";

// ─── Attachment sub-schema ────────────────────────────────────────────────────
const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    originalName: { type: String },
    resourceType: {
      type: String,
      enum: ["image", "video", "raw", "auto"],
      default: "auto",
    },
    format: { type: String },
    bytes: { type: Number },
  },
  { _id: false },
);

// ─── Internal note ────────────────────────────────────────────────────────────
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

// ─── Digital Case Book Entry ──────────────────────────────────────────────────
//
// This is the heart of the Digital Case Book feature.
// Each officer adds one or more formal entries at their stage before forwarding.
//
//  stage       — workflow stage when entry was made
//  entryType   — classification of the entry for PDF formatting
//  content     — the officer's formal remark / finding / directive
//  isEditable  — always false after save (audit integrity)
//
const CaseBookEntrySchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ["nco", "cid", "so", "dc"],
    required: true,
  },
  entryType: {
    type: String,
    enum: [
      "remark", // general officer remark
      "referral", // NCO → CID forwarding note
      "investigation_start", // CID acknowledgement
      "findings", // CID formal findings before submitting to SO
      "directive", // SO directive sent back to CID
      "review", // SO review note before forwarding to DC
      "decision", // DC final decision
    ],
    default: "remark",
  },
  content: { type: String, required: true },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  roleSnapshot: { type: String, required: true },
  attachments: { type: [AttachmentSchema], default: [] },
  addedAt: { type: Date, default: Date.now },
  isEditable: { type: Boolean, default: false }, // immutable after creation
});

// ─── Audit Log Entry ──────────────────────────────────────────────────────────
//
// Immutable record of every workflow action. Never deleted.
//
const AuditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      "case_created",
      "casebook_entry_added",
      "note_added",
      "referred_to_cid",
      "investigation_started",
      "submitted_to_so",
      "returned_to_cid",
      "forwarded_to_dc",
      "case_closed",
      "case_suspended",
      "case_updated",
    ],
    required: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  performedAt: { type: Date, default: Date.now },
  fromStage: { type: String, default: null },
  toStage: { type: String, default: null },
  details: { type: String },
});

// ─── Scoped thread message ────────────────────────────────────────────────────
const ThreadMessageSchema = new mongoose.Schema({
  thread: { type: String, enum: ["nco_cid", "cid_so", "dc"], required: true },
  content: { type: String, required: true },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  fromRole: { type: String, required: true },
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

    // ── Workflow ──────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "open",
        "referred",
        "investigating",
        "under_review",
        "commander_review",
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

    // ── Reporter ──────────────────────────────────────────────────────────────
    reportedBy: {
      name: { type: String, required: true },
      phone: String,
      email: String,
      address: String,
    },

    // ── Assigned officers ─────────────────────────────────────────────────────
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedSO: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedDC: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ── Incident details ──────────────────────────────────────────────────────
    location: { type: String, required: true },
    dateReported: { type: Date, default: Date.now },
    dateOccurred: { type: Date, required: true },

    // ── Parties ───────────────────────────────────────────────────────────────
    evidence: [{ type: mongoose.Schema.Types.ObjectId, ref: "Evidence" }],
    suspects: [
      { name: String, age: Number, description: String, address: String },
    ],
    witnesses: [{ name: String, phone: String, statement: String }],

    // ── Attachments ───────────────────────────────────────────────────────────
    attachments: { type: [AttachmentSchema], default: [] },

    // ── Internal notes ────────────────────────────────────────────────────────
    notes: [NoteSchema],

    // ── DIGITAL CASE BOOK entries (NEW) ───────────────────────────────────────
    // Formal, immutable, stage-ordered entries from each officer.
    // These are the primary content of the exportable PDF case book.
    caseBookEntries: [CaseBookEntrySchema],

    // ── Audit trail (NEW) ─────────────────────────────────────────────────────
    auditLog: [AuditLogSchema],

    // ── Scoped thread messages ────────────────────────────────────────────────
    threadMessages: [ThreadMessageSchema],

    // ── Handoff notes ─────────────────────────────────────────────────────────
    ncoReferralNote: String,
    cidSubmissionNote: String,
    soReviewNote: String,
    soDirective: String,
    dcNote: String,

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
      this.caseNumber = `RO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    }
  }
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
CaseSchema.index({ "threadMessages.thread": 1 });
CaseSchema.index({ status: 1, currentStage: 1 });
CaseSchema.index({ "caseBookEntries.stage": 1 });
CaseSchema.index({ "auditLog.action": 1 });

export default mongoose.models.Case || mongoose.model("Case", CaseSchema);
