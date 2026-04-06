import mongoose from "mongoose";

const rifleBookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      required: true,
      unique: true,
    },
    typeOfRifle: {
      type: String,
      required: true,
    },
    rifleNumber: {
      type: String,
      required: true,
    },
    ammunitionType: {
      type: String,
      required: true,
    },
    numberOfAmmunition: {
      type: Number,
      required: true,
      min: 0,
    },
    dateOfBooking: {
      type: Date,
      required: true,
      default: Date.now,
    },
    typeOfDuty: {
      type: String,
      required: true,
    },
    returnDate: {
      type: Date,
      required: false,
    },
    serialNumber: {
      type: String,
      required: true,
      unique: true,
    },
    nameOfPersonnel: {
      type: String,
      required: true,
    },
    receivedBy: {
      type: String,
      required: true,
    },
    issuedBy: {
      type: String,
      required: true,
    },
    sdNumber: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "returned", "overdue"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

const RifleBooking =
  mongoose.models.RifleBooking ||
  mongoose.model("RifleBooking", rifleBookingSchema);

export default RifleBooking;
