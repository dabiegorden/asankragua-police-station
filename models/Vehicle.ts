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

    // ── Dispatch history (replaces legacy assignmentHistory) ──────────────
    dispatchHistory: [
      {
        // Who took the vehicle (linked User, optional)
        dispatchedTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        // Manual driver details (all optional)
        driverDetails: {
          name: { type: String, default: "" },
          badgeNumber: { type: String, default: "" },
          phone: { type: String, default: "" },
          email: { type: String, default: "" },
          rank: { type: String, default: "" },
          unit: { type: String, default: "" },
        },
        // Operation / destination info
        destination: { type: String, default: "" },
        operationName: { type: String, default: "" },
        operationType: {
          type: String,
          enum: [
            "patrol",
            "escort",
            "investigation",
            "emergency",
            "transport",
            "training",
            "other",
          ],
          default: "patrol",
        },
        purpose: { type: String, default: "" },
        // Times & mileage
        dispatchedDate: { type: Date, default: Date.now },
        expectedReturnDate: { type: Date, default: null },
        returnedDate: { type: Date, default: null },
        startMileage: { type: Number, default: 0 },
        endMileage: { type: Number, default: null },
        // Dispatched by
        dispatchedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        notes: { type: String, default: "" },
      },
    ],

    // ── Legacy assignment history (kept for backward-compat) ──────────────
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

    // ── Return history ────────────────────────────────────────────────────
    returnHistory: [
      {
        returnedDate: { type: Date, default: Date.now },
        location: { type: String, required: true },
        driverName: { type: String, required: true },
        duty: { type: String, required: true },
        fuelLevelOnReturn: { type: String },
        returnTime: { type: String },
        conditionNotes: { type: String },
        endMileage: { type: Number, default: null },
        returnedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // ── Maintenance history ───────────────────────────────────────────────
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

    // ── Fuel history ──────────────────────────────────────────────────────
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

    // ── Equipment ─────────────────────────────────────────────────────────
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
