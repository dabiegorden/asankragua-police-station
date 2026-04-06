import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipients: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        readStatus: {
          type: Boolean,
          default: false,
        },
        readAt: Date,
      },
    ],
    subject: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "general",
        "urgent",
        "announcement",
        "case-related",
        "administrative",
      ],
      default: "general",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    attachments: [
      {
        filename: String,
        url: String,
        fileType: String,
        size: Number,
      },
    ],
    relatedCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Message ||
  mongoose.model("Message", MessageSchema);
