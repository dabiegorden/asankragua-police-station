import mongoose from "mongoose";

const VehicleSchema = new mongoose.Schema(
  {
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
    },
    licensePlate: {
      type: String,
      required: true,
      unique: true,
    },
    make: { type: String, required: true },
    model: { type: String, required: true },
    type: {
      type: String,
      enum: ["patrol-car", "motorcycle", "van", "truck", "suv", "other"],
      required: true,
    },
    mileage: { type: Number, default: 0 },
    fuelLevel: { type: String, default: "" },
    status: {
      type: String,
      enum: ["available", "in-use", "maintenance", "out-of-service"],
      default: "available",
    },
    currentDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    maintenanceHistory: [
      {
        date: { type: Date, required: true },
        type: {
          type: String,
          enum: ["routine", "repair", "inspection", "emergency"],
          required: true,
        },
        description: String,
        cost: Number,
        performedBy: String,
        mileageAtService: Number,
        nextServiceDue: Date,
      },
    ],
    fuelHistory: [
      {
        date: { type: Date, default: Date.now },
        amount: Number,
        cost: Number,
        mileage: Number,
        filledBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    assignmentHistory: [
      {
        assignedTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        assignedDate: { type: Date, default: Date.now },
        returnedDate: Date,
        purpose: String,
        startMileage: Number,
        endMileage: Number,
      },
    ],
    returnHistory: [
      {
        returnedDate: { type: Date, default: Date.now },
        location: { type: String, required: true },
        driverName: { type: String, required: true },
        duty: { type: String, required: true },
        fuelLevelOnReturn: { type: String },
        returnTime: { type: String },
        conditionNotes: { type: String },
        returnedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    equipment: [
      {
        name: String,
        serialNumber: String,
        condition: {
          type: String,
          enum: ["excellent", "good", "fair", "poor"],
          default: "good",
        },
      },
    ],
    notes: String,
  },
  { timestamps: true },
);

export default mongoose.models.Vehicle ||
  mongoose.model("Vehicle", VehicleSchema);
