import mongoose from "mongoose";

const EvidenceSchema = new mongoose.Schema(
  {
    evidenceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      required: true,
    },
    type: {
      type: String,
      enum: ["physical", "digital", "document", "photograph", "video", "audio"],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    collectionDate: {
      type: Date,
      default: Date.now,
    },
    collectionLocation: {
      type: String,
      required: true,
    },
    storageLocation: {
      type: String,
      required: true,
    },
    files: [
      {
        filename: String,
        url: String,
        fileType: String,
        uploadDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    chainOfCustody: [
      {
        handledBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        action: {
          type: String,
          enum: [
            "collected",
            "transferred",
            "analyzed",
            "returned",
            "disposed",
          ],
        },
        date: {
          type: Date,
          default: Date.now,
        },
        location: String,
        notes: String,
        signature: String,
      },
    ],
    analysisResults: [
      {
        analysisType: String,
        performedBy: String,
        date: Date,
        results: String,
        reportFile: String,
      },
    ],
    status: {
      type: String,
      enum: [
        "collected",
        "in-analysis",
        "analyzed",
        "court-ready",
        "returned",
        "disposed",
      ],
      default: "collected",
    },
    tags: [String],
    notes: String,
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.Evidence ||
  mongoose.model("Evidence", EvidenceSchema);
