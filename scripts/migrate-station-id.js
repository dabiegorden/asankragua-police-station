/**
 * One-time migration: backfill stationId = "asankragua" on all existing
 * Personnel, Prisoner, Vehicle, RifleBooking, and Schedule documents
 * that were created before the stationId field was added.
 *
 * Run with:  node scripts/migrate-station-id.js
 */

require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");

const MONGODB_URL = process.env.MONGODB_URL;
if (!MONGODB_URL) {
  console.error("ERROR: MONGODB_URL is not set in .env");
  process.exit(1);
}

// We use the default station because the system was originally
// a single-station setup for Asankragua.
const DEFAULT_STATION = "asankragua";

const COLLECTIONS = [
  "personnels",
  "prisoners",
  "vehicles",
  "riflebookings",
  "schedules",
];

async function run() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URL, { bufferCommands: false });
  console.log("Connected.\n");

  for (const col of COLLECTIONS) {
    const collection = mongoose.connection.collection(col);

    // Count documents that need backfilling
    const needsMigration = await collection.countDocuments({
      stationId: { $exists: false },
    });

    if (needsMigration === 0) {
      console.log(`${col}: nothing to migrate.`);
      continue;
    }

    const result = await collection.updateMany(
      { stationId: { $exists: false } },
      { $set: { stationId: DEFAULT_STATION } },
    );

    console.log(
      `${col}: updated ${result.modifiedCount} / ${needsMigration} documents → stationId="${DEFAULT_STATION}"`,
    );
  }

  console.log("\nMigration complete.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
