/**
 * KGEN Core Canonical JSON Serialization
 * 
 * Provides deterministic object serialization for reproducible builds:
 * - Recursive object key sorting
 * - Consistent whitespace normalization
 * - Cross-platform line ending normalization
 * - Content-addressed serialization
 * - Deep object comparison utilities
 */

import crypto from 'crypto';

/**
 * Canonicalize object by sorting all keys recursively
 * This ensures consistent serialization across platforms and runs
 */
export function canonicalizeObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => canonicalizeObject(item));
  }
  
  // Handle Date objects - convert to ISO string for determinism
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Handle regular expressions
  if (obj instanceof RegExp) {
    return obj.toString();
  }
  
  // Handle objects
  const canonicalized = {};
  const keys = Object.keys(obj).sort(); // Alphabetical key sorting
  
  for (const key of keys) {
    canonicalized[key] = canonicalizeObject(obj[key]);
  }
  
  return canonicalized;
}

/**
 * Serialize object to canonical JSON string
 */
export function canonicalStringify(obj, options = {}) {
  const {
    space = null,
    replacer = null,
    excludeUndefined = true,
    excludeFunctions = true,
    sortArrays = false
  } = options;
  
  // Pre-process object to handle special cases
  const processedObj = _preprocessForSerialization(obj, {
    excludeUndefined,
    excludeFunctions,
    sortArrays
  });
  
  // Canonicalize the object
  const canonicalized = canonicalizeObject(processedObj);
  
  // Serialize with consistent formatting
  return JSON.stringify(canonicalized, replacer, space);
}

/**
 * Parse JSON with normalization
 */
export function canonicalParse(jsonString) {
  const parsed = JSON.parse(jsonString);
  return canonicalizeObject(parsed);
}

/**
 * Generate deterministic hash from object
 */
export function objectHash(obj, algorithm = 'sha256') {
  const canonical = canonicalStringify(obj);
  return crypto.createHash(algorithm).update(canonical, 'utf8').digest('hex');
}

/**
 * Compare two objects for deep equality after canonicalization
 */
export function deepEqual(obj1, obj2) {
  const canonical1 = canonicalizeObject(obj1);
  const canonical2 = canonicalizeObject(obj2);
  
  return JSON.stringify(canonical1) === JSON.stringify(canonical2);
}

/**
 * Normalize string content for consistent serialization
 */
export function normalizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }
  
  return str
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove trailing whitespace from each line
    .replace(/[ \t]+$/gm, '')
    // Normalize multiple consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim leading and trailing whitespace
    .trim();
}

/**
 * Create content-addressed key for object
 */
export function contentKey(obj, keyLength = 16) {
  const hash = objectHash(obj);
  return hash.substring(0, keyLength);
}

/**
 * Merge objects canonically (deterministic merge order)
 */
export function canonicalMerge(...objects) {
  const merged = {};
  
  // Sort objects by their hash for deterministic merge order
  const sortedObjects = objects
    .map(obj => ({ obj, hash: objectHash(obj) }))
    .sort((a, b) => a.hash.localeCompare(b.hash))
    .map(item => item.obj);
  
  // Merge in sorted order
  for (const obj of sortedObjects) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.assign(merged, obj);
    }
  }
  
  return canonicalizeObject(merged);
}

/**
 * Extract and sort all keys from nested object
 */
export function extractKeys(obj, prefix = '') {
  const keys = new Set();
  
  function traverse(current, path) {
    if (current && typeof current === 'object') {
      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          traverse(item, `${path}[${index}]`);
        });
      } else {
        Object.keys(current).forEach(key => {
          const fullPath = path ? `${path}.${key}` : key;
          keys.add(fullPath);
          traverse(current[key], fullPath);
        });
      }
    }
  }
  
  traverse(obj, prefix);
  return Array.from(keys).sort();
}

/**
 * Remove temporal/non-deterministic data from object
 */
export function stripTemporal(obj) {
  const temporalKeys = new Set([
    'timestamp', 'createdAt', 'updatedAt', 'modifiedAt', 'lastModified',
    'date', 'datetime', 'time', 'now', 'currentTime', 'buildTime',
    'id', 'uuid', 'guid', 'random', 'nonce', '_id'
  ]);
  
  function strip(current) {
    if (current === null || typeof current !== 'object') {
      return current;
    }
    
    if (Array.isArray(current)) {
      return current.map(item => strip(item));
    }
    
    const stripped = {};
    
    for (const [key, value] of Object.entries(current)) {
      // Skip temporal keys
      if (temporalKeys.has(key.toLowerCase())) {
        continue;
      }
      
      // Skip keys ending with temporal suffixes
      const lowerKey = key.toLowerCase();
      const temporalSuffixes = ['at', 'time', 'date', 'id'];
      const hasTemporalSuffix = temporalSuffixes.some(suffix => lowerKey.endsWith(suffix));
      
      if (!hasTemporalSuffix) {
        stripped[key] = strip(value);
      }
    }
    
    return stripped;
  }
  
  return canonicalizeObject(strip(obj));
}

/**
 * Validate object for deterministic properties
 */
export function validateDeterministic(obj) {
  const issues = [];
  const warnings = [];
  
  function validate(current, path = '') {
    if (current === null || typeof current !== 'object') {
      return;
    }
    
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        validate(item, `${path}[${index}]`);
      });
      return;
    }
    
    for (const [key, value] of Object.entries(current)) {
      const fullPath = path ? `${path}.${key}` : key;
      
      // Check for temporal keys
      const temporalKeys = [
        'timestamp', 'createdAt', 'updatedAt', 'modifiedAt', 'lastModified',
        'date', 'datetime', 'time', 'now', 'currentTime', 'buildTime'
      ];
      
      if (temporalKeys.includes(key.toLowerCase())) {
        warnings.push(`Temporal key detected: ${fullPath}`);
      }
      
      // Check for functions
      if (typeof value === 'function') {
        issues.push(`Function detected: ${fullPath}`);
      }
      
      // Check for undefined values
      if (value === undefined) {
        warnings.push(`Undefined value: ${fullPath}`);
      }
      
      // Check for potentially random IDs
      if (typeof value === 'string' && key.toLowerCase().includes('id')) {
        if (value.length === 36 && value.includes('-')) {
          warnings.push(`Possible UUID detected: ${fullPath}`);
        }
      }
      
      // Recursively validate
      validate(value, fullPath);
    }
  }
  
  validate(obj);
  
  return {
    deterministic: issues.length === 0,
    issues,
    warnings,
    score: Math.max(0, 100 - (issues.length * 20 + warnings.length * 5))
  };
}

/**
 * Create diff between two canonicalized objects
 */
export function canonicalDiff(obj1, obj2) {
  const canon1 = canonicalizeObject(obj1);
  const canon2 = canonicalizeObject(obj2);
  
  const keys1 = extractKeys(canon1);
  const keys2 = extractKeys(canon2);
  const allKeys = new Set([...keys1, ...keys2]);
  
  const differences = [];
  
  for (const key of allKeys) {
    const value1 = _getNestedValue(canon1, key);
    const value2 = _getNestedValue(canon2, key);
    
    if (value1 !== value2) {
      differences.push({
        key,
        value1,
        value2,
        type: value1 === undefined ? 'added' : 
              value2 === undefined ? 'removed' : 'changed'
      });
    }
  }
  
  return {
    identical: differences.length === 0,
    differences,
    hash1: objectHash(canon1),
    hash2: objectHash(canon2)
  };
}

// Private helper functions

function _preprocessForSerialization(obj, options) {
  const { excludeUndefined, excludeFunctions, sortArrays } = options;
  
  function process(current) {
    if (current === null) {
      return null;
    }
    
    if (current === undefined && excludeUndefined) {
      return undefined; // Will be filtered out later
    }
    
    if (typeof current === 'function' && excludeFunctions) {
      return undefined; // Will be filtered out later
    }
    
    if (typeof current !== 'object') {
      return current;
    }
    
    if (Array.isArray(current)) {
      let processed = current.map(item => process(item));
      
      if (sortArrays) {
        processed = processed.sort((a, b) => {
          const aStr = JSON.stringify(a);
          const bStr = JSON.stringify(b);
          return aStr.localeCompare(bStr);
        });
      }
      
      return processed;
    }
    
    const processed = {};
    
    for (const [key, value] of Object.entries(current)) {
      const processedValue = process(value);
      
      if (processedValue !== undefined) {
        processed[key] = processedValue;
      }
    }
    
    return processed;
  }
  
  return process(obj);
}

function _getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    // Handle array notation like [0]
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayKey, index] = arrayMatch;
      const array = current[arrayKey];
      return Array.isArray(array) ? array[parseInt(index, 10)] : undefined;
    }
    
    return current[key];
  }, obj);
}

/**
 * Benchmark canonicalization performance
 */
export function benchmarkCanonicalization(testObj, iterations = 1000) {
  const startTime = process.hrtime.bigint();
  
  for (let i = 0; i < iterations; i++) {
    canonicalStringify(testObj);
  }
  
  const endTime = process.hrtime.bigint();
  const totalTime = Number(endTime - startTime) / 1e6; // Convert to milliseconds
  
  return {
    iterations,
    totalTime,
    averageTime: totalTime / iterations,
    operationsPerSecond: Math.round((iterations / totalTime) * 1000)
  };
}

export default {
  canonicalizeObject,
  canonicalStringify,
  canonicalParse,
  objectHash,
  deepEqual,
  normalizeString,
  contentKey,
  canonicalMerge,
  extractKeys,
  stripTemporal,
  validateDeterministic,
  canonicalDiff,
  benchmarkCanonicalization
};