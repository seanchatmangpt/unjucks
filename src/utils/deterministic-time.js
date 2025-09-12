/**
 * Deterministic Timestamp Utilities
 * 
 * Provides deterministic timestamps for reproducible builds
 */

/**
 * Get deterministic timestamp (milliseconds)
 * Uses SOURCE_DATE_EPOCH if set, otherwise a fixed timestamp
 */
export function getDeterministicTimestamp() {
  const sourceEpoch = process.env.SOURCE_DATE_EPOCH;
  
  if (sourceEpoch) {
    return parseInt(sourceEpoch) * 1000;
  }
  
  // Default to 2024-01-01T00:00:00.000Z for reproducible builds
  return 1704067200000;
}

/**
 * Get deterministic Date object
 * Uses SOURCE_DATE_EPOCH if set, otherwise a fixed date
 */
export function getDeterministicDate() {
  return new Date(getDeterministicTimestamp());
}

/**
 * Get deterministic ISO string
 * Uses SOURCE_DATE_EPOCH if set, otherwise a fixed date string
 */
export function getDeterministicISOString() {
  return getDeterministicDate().toISOString();
}

/**
 * Create timestamp that respects SOURCE_DATE_EPOCH for reproducible builds
 */
export function getReproducibleTimestamp() {
  const sourceEpoch = process.env.SOURCE_DATE_EPOCH;
  
  if (sourceEpoch) {
    return new Date(parseInt(sourceEpoch) * 1000).toISOString();
  }
  
  // In production, use current time
  // In tests/builds with SOURCE_DATE_EPOCH, use fixed time
  return new Date().toISOString();
}

/**
 * Get build-time timestamp that's deterministic in CI but current in dev
 */
export function getBuildTimestamp() {
  // Check if we're in a build environment
  if (process.env.CI || process.env.NODE_ENV === 'production' || process.env.SOURCE_DATE_EPOCH) {
    return getDeterministicISOString();
  }
  
  // In development, use current timestamp
  return new Date().toISOString();
}
