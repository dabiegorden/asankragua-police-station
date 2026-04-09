import mongoose, { Document, Model, Schema } from "mongoose";

// ─── Sub-document interfaces ───────────────────────────────────────────────

export interface IAttendee {
  user?: mongoose.Types.ObjectId;
  status?: "pending" | "accepted" | "declined";
  responseDate?: Date;
}

export interface IRecurrence {
  type: "none" | "daily" | "weekly" | "monthly";
  interval?: number;
  endDate?: Date;
}

// ─── Main document interface ───────────────────────────────────────────────

export interface ISchedule extends Document {
  title: string;
  description?: string;
  type:
    | "shift"
    | "patrol"
    | "training"
    | "meeting"
    | "court"
    | "investigation"
    | "other";
  startDate: Date;
  endDate: Date;
  location: string;
  assignedPersonnel?: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  relatedCase?: mongoose.Types.ObjectId;
  vehicleAssigned?: mongoose.Types.ObjectId;
  recurrence?: IRecurrence;
  attendees?: IAttendee[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ────────────────────────────────────────────────────────────────

const ScheduleSchema = new Schema<ISchedule>(
  {
    title: { type: String, required: true },
    description: { type: String },
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
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    location: { type: String, required: true },
    assignedPersonnel: [{ type: Schema.Types.ObjectId, ref: "Personnel" }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Personnel",
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
    relatedCase: { type: Schema.Types.ObjectId, ref: "Case" },
    vehicleAssigned: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    recurrence: {
      type: {
        type: String,
        enum: ["none", "daily", "weekly", "monthly"],
        default: "none",
      },
      interval: { type: Number, default: 1 },
      endDate: Date,
    },
    attendees: [
      {
        user: { type: Schema.Types.ObjectId, ref: "Personnel" },
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
  { timestamps: true },
);

const Schedule: Model<ISchedule> =
  (mongoose.models.Schedule as Model<ISchedule>) ??
  mongoose.model<ISchedule>("Schedule", ScheduleSchema);

export default Schedule;
