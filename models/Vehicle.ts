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
    year: { type: Number, required: true },
    color: { type: String, required: true },
    type: {
      type: String,
      enum: ["patrol-car", "motorcycle", "van", "truck", "suv", "other"],
      required: true,
    },
    vin: { type: String, unique: true, sparse: true },
    mileage: { type: Number, default: 0 },
    fuelLevel: { type: Number, min: 0, max: 100, default: 100 },
    status: {
      type: String,
      enum: ["available", "in-use", "maintenance", "out-of-service"],
      default: "available",
    },
    currentDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    insuranceDetails: {
      provider: String,
      policyNumber: String,
      expiryDate: Date,
      coverage: String,
    },
    registrationDetails: {
      registrationNumber: String,
      expiryDate: Date,
      registeredTo: String,
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
  { timestamps: true }
);

export default mongoose.models.Vehicle ||
  mongoose.model("Vehicle", VehicleSchema);
