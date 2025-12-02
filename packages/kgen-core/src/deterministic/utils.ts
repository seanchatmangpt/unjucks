/**
 * Utility functions for deterministic operations
 */

import * as crypto from 'crypto';

/**
 * Deep sort object keys recursively for deterministic JSON serialization
 */
export function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  const sortedObj: any = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    sortedObj[key] = sortObjectKeys(obj[key]);
  }
  
  return sortedObj;
}

/**
 * Create a deterministic hash from any value
 */
export function createDeterministicHash(value: any, algorithm: string = 'sha256'): string {
  const normalizedValue = normalizeForHashing(value);
  const serialized = JSON.stringify(normalizedValue);
  return crypto.createHash(algorithm).update(serialized).digest('hex');
}

/**
 * Normalize a value for consistent hashing
 */
export function normalizeForHashing(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  if (value instanceof RegExp) {
    return {
      __type: 'RegExp',
      source: value.source,
      flags: value.flags
    };
  }
  
  if (Buffer.isBuffer(value)) {
    return {
      __type: 'Buffer',
      data: value.toString('base64')
    };
  }
  
  if (Array.isArray(value)) {
    return value.map(normalizeForHashing).sort((a, b) => {
      const aStr = JSON.stringify(a);
      const bStr = JSON.stringify(b);
      return aStr.localeCompare(bStr);
    });
  }
  
  if (typeof value === 'object') {
    const normalized: any = {};
    const keys = Object.keys(value).sort();
    
    for (const key of keys) {
      // Skip functions and symbols as they're not serializable
      if (typeof value[key] === 'function' || typeof value[key] === 'symbol') {
        continue;
      }
      normalized[key] = normalizeForHashing(value[key]);
    }
    
    return normalized;
  }
  
  // For functions, symbols, etc., return a stable representation
  return {
    __type: typeof value,
    __value: String(value)
  };
}

/**
 * Stable JSON serialization with sorted keys
 */
export function stableStringify(obj: any, space?: string | number): string {
  return JSON.stringify(sortObjectKeys(obj), null, space);
}

/**
 * Create a deterministic ID from multiple inputs
 */
export function createDeterministicId(...inputs: any[]): string {
  const combined = inputs.map(normalizeForHashing);
  return createDeterministicHash(combined).substring(0, 8);
}

/**
 * Sort an array of paths in a deterministic way
 */
export function sortPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    // Split paths into components
    const aParts = a.split('/').filter(Boolean);
    const bParts = b.split('/').filter(Boolean);
    
    // Compare component by component
    const maxLength = Math.max(aParts.length, bParts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || '';
      const bPart = bParts[i] || '';
      
      if (aPart !== bPart) {
        return aPart.localeCompare(bPart);
      }
    }
    
    // If all components are equal, shorter path comes first
    return aParts.length - bParts.length;
  });
}

/**
 * Remove non-deterministic fields from an object
 */
export function stripNonDeterministic(obj: any, fieldsToStrip: string[] = []): any {
  const defaultFieldsToStrip = [
    'timestamp',
    'created',
    'modified',
    'updated',
    'id',
    'uuid',
    'guid',
    '_id',
    'createdAt',
    'updatedAt',
    'modifiedAt',
    'version',
    'etag',
    'lastModified',
    'buildTime',
    'buildDate'
  ];
  
  const allFieldsToStrip = [...defaultFieldsToStrip, ...fieldsToStrip];
  
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => stripNonDeterministic(item, fieldsToStrip));
  }
  
  const cleaned: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (allFieldsToStrip.includes(key)) {
      continue;
    }
    
    cleaned[key] = stripNonDeterministic(value, fieldsToStrip);
  }
  
  return cleaned;
}

/**
 * Merge objects in a deterministic way
 */
export function deterministicMerge(...objects: any[]): any {
  const result: any = {};
  
  for (const obj of objects) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          result[key] = value;
        }
      }
    }
  }
  
  return sortObjectKeys(result);
}

/**
 * Compare two values for deterministic equality
 */
export function deterministicEquals(a: any, b: any): boolean {
  const hashA = createDeterministicHash(a);
  const hashB = createDeterministicHash(b);
  return hashA === hashB;
}

/**
 * Generate a deterministic UUID v5 from inputs
 */
export function createDeterministicUUID(namespace: string, ...inputs: any[]): string {
  const combined = [namespace, ...inputs];
  const hash = createDeterministicHash(combined, 'sha1');
  
  // Format as UUID v5
  const uuid = [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16), // Version 5
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20), // Variant
    hash.substring(20, 32)
  ].join('-');
  
  return uuid;
}

/**
 * Create a deterministic filename from content and metadata
 */
export function createDeterministicFilename(
  content: string | Buffer,
  metadata: any = {},
  extension: string = ''
): string {
  const contentHash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 16);
    
  const metadataHash = createDeterministicHash(metadata).substring(0, 8);
  
  const filename = `${contentHash}-${metadataHash}`;
  return extension ? `${filename}.${extension.replace(/^\./, '')}` : filename;
}