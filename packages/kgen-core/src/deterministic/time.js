/**
 * KGEN Core Deterministic Timestamp System
 * 
 * Migrated and enhanced from unjucks/src/utils/deterministic-time.js
 * Provides deterministic timestamps for reproducible builds with:
 * - SOURCE_DATE_EPOCH support for LaTeX/reproducible builds
 * - Static timestamp fallback (2024-01-01T00:00:00.000Z)
 * - Git commit timestamp integration
 * - Cross-platform consistency
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Core deterministic timestamp configuration
 */
const DETERMINISTIC_CONFIG = {
  // Fixed timestamp for reproducible builds (epoch for determinism)
  STATIC_BUILD_TIME: '2024-01-01T00:00:00.000Z',
  STATIC_TIMESTAMP_MS: 1704067200000, // 2024-01-01T00:00:00.000Z
  
  // Git integration
  GIT_TIMEOUT: 5000, // 5 seconds max for git operations
  
  // Environment variable names
  SOURCE_DATE_EPOCH_VAR: 'SOURCE_DATE_EPOCH',
  BUILD_TIMESTAMP_VAR: 'BUILD_TIMESTAMP',
  KGEN_DETERMINISTIC_VAR: 'KGEN_DETERMINISTIC_TIME'
};

/**
 * Get deterministic timestamp (milliseconds)
 * Priority: SOURCE_DATE_EPOCH > KGEN_DETERMINISTIC_TIME > Git commit > Static fallback
 */
export function getDeterministicTimestamp() {
  // 1. Check SOURCE_DATE_EPOCH (standard for reproducible builds)
  const sourceEpoch = process.env[DETERMINISTIC_CONFIG.SOURCE_DATE_EPOCH_VAR];
  if (sourceEpoch) {
    const timestamp = parseInt(sourceEpoch, 10);
    if (!isNaN(timestamp)) {
      return timestamp * 1000; // Convert seconds to milliseconds
    }
  }
  
  // 2. Check KGEN_DETERMINISTIC_TIME override
  const kgenTime = process.env[DETERMINISTIC_CONFIG.KGEN_DETERMINISTIC_VAR];
  if (kgenTime) {
    const date = new Date(kgenTime);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }
  
  // 3. Check BUILD_TIMESTAMP
  const buildTime = process.env[DETERMINISTIC_CONFIG.BUILD_TIMESTAMP_VAR];
  if (buildTime) {
    const date = new Date(buildTime);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }
  
  // 4. Fallback to static timestamp for reproducible builds
  return DETERMINISTIC_CONFIG.STATIC_TIMESTAMP_MS;
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
 * Get Git commit timestamp (async)
 * Used for git-based deterministic timestamps
 */
export async function getGitCommitTimestamp(commitHash = 'HEAD') {
  try {
    const { stdout } = await execAsync(
      `git log -1 --format="%ct" ${commitHash}`, 
      { timeout: DETERMINISTIC_CONFIG.GIT_TIMEOUT }
    );
    
    const timestamp = parseInt(stdout.trim(), 10);
    if (!isNaN(timestamp)) {
      return timestamp * 1000; // Convert to milliseconds
    }
  } catch (error) {
    // Git not available or command failed - use static fallback
  }
  
  return DETERMINISTIC_CONFIG.STATIC_TIMESTAMP_MS;
}

/**
 * Get Git commit date (async)
 */
export async function getGitCommitDate(commitHash = 'HEAD') {
  const timestamp = await getGitCommitTimestamp(commitHash);
  return new Date(timestamp);
}

/**
 * Create timestamp that respects SOURCE_DATE_EPOCH for LaTeX/reproducible builds
 * This is the primary function for LaTeX integration
 */
export function getReproducibleTimestamp() {
  const sourceEpoch = process.env[DETERMINISTIC_CONFIG.SOURCE_DATE_EPOCH_VAR];
  
  if (sourceEpoch) {
    const timestamp = parseInt(sourceEpoch, 10);
    if (!isNaN(timestamp)) {
      return new Date(timestamp * 1000).toISOString();
    }
  }
  
  // In production/CI, use static time for reproducibility
  if (process.env.CI || process.env.NODE_ENV === 'production') {
    return DETERMINISTIC_CONFIG.STATIC_BUILD_TIME;
  }
  
  // In development, still use static time for consistency
  return DETERMINISTIC_CONFIG.STATIC_BUILD_TIME;
}

/**
 * Get build-time timestamp that's deterministic in CI but current in dev
 * Enhanced for KGEN use cases
 */
export function getBuildTimestamp() {
  // Always prioritize SOURCE_DATE_EPOCH for reproducible builds
  if (process.env[DETERMINISTIC_CONFIG.SOURCE_DATE_EPOCH_VAR]) {
    return getReproducibleTimestamp();
  }
  
  // Check if we're in a build environment
  if (process.env.CI || 
      process.env.NODE_ENV === 'production' || 
      process.env.BUILD_TIMESTAMP ||
      process.env.GITHUB_ACTIONS ||
      process.env.KGEN_DETERMINISTIC_MODE) {
    return DETERMINISTIC_CONFIG.STATIC_BUILD_TIME;
  }
  
  // Even in development, use static timestamp for consistency
  return DETERMINISTIC_CONFIG.STATIC_BUILD_TIME;
}

/**
 * Set SOURCE_DATE_EPOCH for child processes and LaTeX
 * This ensures LaTeX documents get reproducible timestamps
 */
export function setSourceDateEpoch(timestamp) {
  let epochSeconds;
  
  if (typeof timestamp === 'number') {
    // Assume milliseconds if > 1e10, otherwise seconds
    epochSeconds = timestamp > 1e10 ? Math.floor(timestamp / 1000) : timestamp;
  } else if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    epochSeconds = Math.floor(date.getTime() / 1000);
  } else if (timestamp instanceof Date) {
    epochSeconds = Math.floor(timestamp.getTime() / 1000);
  } else {
    // Use current deterministic timestamp
    epochSeconds = Math.floor(getDeterministicTimestamp() / 1000);
  }
  
  process.env[DETERMINISTIC_CONFIG.SOURCE_DATE_EPOCH_VAR] = epochSeconds.toString();
  return epochSeconds;
}

/**
 * Get current SOURCE_DATE_EPOCH value
 */
export function getSourceDateEpoch() {
  const sourceEpoch = process.env[DETERMINISTIC_CONFIG.SOURCE_DATE_EPOCH_VAR];
  return sourceEpoch ? parseInt(sourceEpoch, 10) : null;
}

/**
 * Clear SOURCE_DATE_EPOCH (for testing)
 */
export function clearSourceDateEpoch() {
  delete process.env[DETERMINISTIC_CONFIG.SOURCE_DATE_EPOCH_VAR];
}

/**
 * Initialize deterministic time system with git integration
 */
export async function initializeDeterministicTime(options = {}) {
  const config = {
    useGitTimestamp: options.useGitTimestamp !== false,
    commitHash: options.commitHash || 'HEAD',
    fallbackToStatic: options.fallbackToStatic !== false,
    setSourceDateEpoch: options.setSourceDateEpoch !== false,
    ...options
  };
  
  let timestamp = DETERMINISTIC_CONFIG.STATIC_TIMESTAMP_MS;
  let source = 'static';
  
  // Check existing environment variables first
  if (process.env[DETERMINISTIC_CONFIG.SOURCE_DATE_EPOCH_VAR]) {
    const sourceEpoch = parseInt(process.env[DETERMINISTIC_CONFIG.SOURCE_DATE_EPOCH_VAR], 10);
    if (!isNaN(sourceEpoch)) {
      timestamp = sourceEpoch * 1000;
      source = 'SOURCE_DATE_EPOCH';
    }
  } else if (config.useGitTimestamp) {
    try {
      const gitTimestamp = await getGitCommitTimestamp(config.commitHash);
      if (gitTimestamp !== DETERMINISTIC_CONFIG.STATIC_TIMESTAMP_MS) {
        timestamp = gitTimestamp;
        source = 'git';
        
        // Set SOURCE_DATE_EPOCH for child processes if requested
        if (config.setSourceDateEpoch) {
          setSourceDateEpoch(timestamp);
        }
      }
    } catch (error) {
      // Git failed, use static fallback
    }
  }
  
  return {
    timestamp,
    date: new Date(timestamp),
    isoString: new Date(timestamp).toISOString(),
    source,
    sourceEpochSet: !!process.env[DETERMINISTIC_CONFIG.SOURCE_DATE_EPOCH_VAR],
    config: DETERMINISTIC_CONFIG
  };
}

/**
 * Format timestamp for LaTeX SOURCE_DATE_EPOCH compatibility
 */
export function formatForLaTeX(timestamp = getDeterministicTimestamp()) {
  const date = new Date(timestamp);
  
  return {
    // ISO format for general use
    iso: date.toISOString(),
    
    // SOURCE_DATE_EPOCH format (seconds since epoch)
    sourceEpoch: Math.floor(date.getTime() / 1000),
    
    // LaTeX-friendly formats
    latex: {
      year: date.getUTCFullYear(),
      month: (date.getUTCMonth() + 1).toString().padStart(2, '0'),
      day: date.getUTCDate().toString().padStart(2, '0'),
      
      // Common LaTeX date format
      date: `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`,
      
      // LaTeX datetime
      datetime: `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}:${date.getUTCSeconds().toString().padStart(2, '0')}`
    }
  };
}

/**
 * Validate deterministic time configuration
 */
export function validateTimeConfiguration() {
  const issues = [];
  const info = {};
  
  // Check SOURCE_DATE_EPOCH
  const sourceEpoch = process.env[DETERMINISTIC_CONFIG.SOURCE_DATE_EPOCH_VAR];
  if (sourceEpoch) {
    const timestamp = parseInt(sourceEpoch, 10);
    if (isNaN(timestamp)) {
      issues.push(`Invalid SOURCE_DATE_EPOCH value: ${sourceEpoch}`);
    } else {
      info.sourceEpoch = {
        value: timestamp,
        date: new Date(timestamp * 1000).toISOString()
      };
    }
  }
  
  // Check timezone (should be UTC for reproducibility)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone !== 'UTC') {
    issues.push(`Non-UTC timezone detected: ${timezone}. This may affect reproducibility.`);
  }
  
  info.timezone = timezone;
  info.locale = Intl.DateTimeFormat().resolvedOptions().locale;
  
  // Get current deterministic timestamp
  const currentTimestamp = getDeterministicTimestamp();
  info.deterministic = {
    timestamp: currentTimestamp,
    date: new Date(currentTimestamp).toISOString(),
    source: sourceEpoch ? 'SOURCE_DATE_EPOCH' : 'static'
  };
  
  return {
    valid: issues.length === 0,
    issues,
    info,
    recommendations: issues.length > 0 ? [
      'Set TZ=UTC environment variable',
      'Use SOURCE_DATE_EPOCH for reproducible builds',
      'Ensure consistent Node.js version across environments'
    ] : []
  };
}

// Export configuration for external use
export const DETERMINISTIC_TIME_CONFIG = DETERMINISTIC_CONFIG;

export default {
  getDeterministicTimestamp,
  getDeterministicDate,
  getDeterministicISOString,
  getReproducibleTimestamp,
  getBuildTimestamp,
  getGitCommitTimestamp,
  getGitCommitDate,
  setSourceDateEpoch,
  getSourceDateEpoch,
  clearSourceDateEpoch,
  initializeDeterministicTime,
  formatForLaTeX,
  validateTimeConfiguration,
  DETERMINISTIC_TIME_CONFIG
};