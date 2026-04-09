import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ─── Populated shape for sender / recipient users ─────────────────────────────

export interface IPersonnelRef {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  badgeNumber?: string;
}

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface IRecipient {
  user: Types.ObjectId | IPersonnelRef;
  readStatus: boolean;
  readAt?: Date;
}

export interface IAttachment {
  filename: string;
  url: string;
  fileType: string;
  size: number;
}

// ─── Enum types ───────────────────────────────────────────────────────────────

export type MessageType =
  | "general"
  | "urgent"
  | "announcement"
  | "case-related"
  | "administrative";

export type MessagePriority = "low" | "medium" | "high" | "urgent";

// ─── Main document interface ──────────────────────────────────────────────────

export interface IMessage extends Document {
  sender: Types.ObjectId | IPersonnelRef;
  recipients: IRecipient[];
  subject: string;
  content: string;
  type: MessageType;
  priority: MessagePriority;
  attachments: IAttachment[];
  relatedCase: Types.ObjectId | IRelatedCase | null;
  isDeleted: boolean;
  deletedBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IRelatedCase {
  _id: Types.ObjectId;
  caseNumber: string;
  title: string;
  status?: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const RecipientSchema = new Schema<IRecipient>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readStatus: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  { _id: false },
);

const AttachmentSchema = new Schema<IAttachment>(
  {
    filename: { type: String, required: true },
    url: { type: String, required: true },
    fileType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const MessageSchema = new Schema<IMessage>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipients: {
      type: [RecipientSchema],
      required: true,
      validate: {
        validator: (v: IRecipient[]) => Array.isArray(v) && v.length > 0,
        message: "At least one recipient is required",
      },
    },
    subject: {
      type: String,
      required: true,
      trim: true,
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
      ] satisfies MessageType[],
      default: "general",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"] satisfies MessagePriority[],
      default: "medium",
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
    relatedCase: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

MessageSchema.index({ "recipients.user": 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ isDeleted: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

const Message: Model<IMessage> =
  (mongoose.models.Message as Model<IMessage>) ||
  mongoose.model<IMessage>("Message", MessageSchema);

export default Message;
