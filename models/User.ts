import mongoose, { Document, Model, Schema } from "mongoose";

export type UserRole = "admin" | "nco" | "cid" | "so" | "dc";

export interface IUser extends Document {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  stationId?: string;
  profilePhoto?: string; // Cloudinary URL
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  toSafeObject(): Omit<IUser, "password">;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["admin", "nco", "cid", "so", "dc"],
      required: [true, "Role is required"],
    },
    stationId: {
      type: String,
      default: null,
    },
    profilePhoto: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Returns user data without the password field
UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
