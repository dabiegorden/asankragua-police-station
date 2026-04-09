import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ─── Enum types ───────────────────────────────────────────────────────────────

export type ContactType =
  | "general"
  | "complaint"
  | "suggestion"
  | "emergency"
  | "other";
export type ContactPriority = "low" | "normal" | "high" | "urgent";
export type ContactStatus = "new" | "in-progress" | "resolved" | "closed";
export type ContactSource =
  | "contact-page"
  | "phone"
  | "email"
  | "walk-in"
  | "homepage";

// ─── Populated personnel ref ──────────────────────────────────────────────────

export interface IPersonnelRef {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
}

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface IResponse {
  _id?: Types.ObjectId;
  message: string;
  respondedBy: Types.ObjectId | IPersonnelRef;
  respondedAt: Date;
}

// ─── Main document interface ──────────────────────────────────────────────────

export interface IContact extends Document {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  type: ContactType;
  priority: ContactPriority;
  status: ContactStatus;
  source: ContactSource;
  assignedTo?: Types.ObjectId | IPersonnelRef | null;
  isRead: boolean;
  readBy?: Types.ObjectId | IPersonnelRef | null;
  readAt?: Date;
  responses: IResponse[];
  notes: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const ResponseSchema = new Schema<IResponse>(
  {
    message: { type: String, required: true },
    respondedBy: {
      type: Schema.Types.ObjectId,
      ref: "Personnel",
      required: true,
    },
    respondedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const ContactSchema = new Schema<IContact>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "general",
        "complaint",
        "suggestion",
        "emergency",
        "other",
      ] satisfies ContactType[],
      default: "general",
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"] satisfies ContactPriority[],
      default: "normal",
    },
    status: {
      type: String,
      enum: [
        "new",
        "in-progress",
        "resolved",
        "closed",
      ] satisfies ContactStatus[],
      default: "new",
    },
    source: {
      type: String,
      enum: [
        "contact-page",
        "phone",
        "email",
        "walk-in",
        "homepage",
      ] satisfies ContactSource[],
      default: "contact-page",
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "Personnel",
      default: null,
    },
    isRead: { type: Boolean, default: false },
    readBy: {
      type: Schema.Types.ObjectId,
      ref: "Personnel",
      default: null,
    },
    readAt: { type: Date },
    responses: { type: [ResponseSchema], default: [] },
    notes: { type: String, default: "" },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

ContactSchema.index({ status: 1, createdAt: -1 });
ContactSchema.index({ priority: 1 });
ContactSchema.index({ email: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

const Contact: Model<IContact> =
  (mongoose.models.Contact as Model<IContact>) ||
  mongoose.model<IContact>("Contact", ContactSchema);

export default Contact;
