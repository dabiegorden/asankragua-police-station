// lib/sequence.ts
// Collision-proof sequential reference-number generation.
//
// The naive `countDocuments() + 1` approach breaks in two common situations:
//   1. A record is deleted  → the count drops below the highest suffix, so the
//      next "count + 1" reuses an existing number and triggers an E11000
//      duplicate-key error.
//   2. Two records are created at (almost) the same time → both read the same
//      count and generate the same number.
//
// Instead we derive the next suffix from the HIGHEST existing number for the
// current year, and `saveWithUniqueNumber` retries on duplicate-key errors so
// concurrent inserts simply pick the next free slot instead of crashing.

import type { Model } from "mongoose";

/**
 * Compute the next reference number for the current year, e.g. "RO-2026-0007".
 * Based on the maximum existing suffix (not the document count) so deletions
 * never cause a collision.
 */
export async function generateSequenceNumber(
  model: Model<any>,
  field: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;

  const last = await model
    .findOne({ [field]: { $regex: `^${base}` } })
    .sort({ [field]: -1 })
    .select(field)
    .lean<Record<string, unknown>>();

  let next = 1;
  const lastValue = last?.[field];
  if (typeof lastValue === "string") {
    const match = lastValue.match(/(\d+)\s*$/);
    if (match) next = parseInt(match[1], 10) + 1;
  }

  return `${base}${String(next).padStart(4, "0")}`;
}

/**
 * Save a Mongoose document, guaranteeing a unique value for `field`.
 *
 * - Generates the number if the document does not already have one.
 * - On an E11000 duplicate-key error for `field`, regenerates and retries.
 *   This covers race conditions between concurrent requests.
 *
 * Works both for models that generate the number in a `pre("save")` hook
 * (the field is cleared so the hook re-runs) and for models that rely entirely
 * on this helper.
 */
export async function saveWithUniqueNumber<T>(
  doc: any,
  field: string,
  prefix: string,
  maxRetries = 6,
): Promise<T> {
  const model = doc.constructor as Model<any>;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (!doc[field]) {
        doc[field] = await generateSequenceNumber(model, field, prefix);
      }
      return (await doc.save()) as T;
    } catch (err: any) {
      const isDuplicate =
        err?.code === 11000 &&
        (err?.keyPattern?.[field] !== undefined ||
          err?.keyValue?.[field] !== undefined);

      if (isDuplicate && attempt < maxRetries) {
        // Clear so the next iteration (or the model's pre-save hook) regenerates.
        doc[field] = undefined;
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `Unable to generate a unique ${field} after ${maxRetries} attempts`,
  );
}
