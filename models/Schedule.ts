import mongoose from "mongoose";

const ScheduleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    type: {
      type: String,
      enum: [
        "shift",
        "patrol",
        "training",
        "meeting",
        "court",
        "investigation",
        "other",
      ],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    assignedPersonnel: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "in-progress", "completed", "cancelled"],
      default: "scheduled",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    relatedCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
    },
    vehicleAssigned: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
    },
    recurrence: {
      type: {
        type: String,
        enum: ["none", "daily", "weekly", "monthly"],
        default: "none",
      },
      interval: {
        type: Number,
        default: 1,
      },
      endDate: Date,
    },
    attendees: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "declined"],
          default: "pending",
        },
        responseDate: Date,
      },
    ],
    notes: String,
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Schedule ||
  mongoose.model("Schedule", ScheduleSchema);
