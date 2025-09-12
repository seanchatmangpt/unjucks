/**
 * KGEN Core Deterministic Random Generation
 * 
 * Migrated and enhanced from unjucks/src/utils/deterministic-id-generator.js
 * Provides seeded, reproducible random generation including:
 * - Deterministic UUID generation (content-addressed)
 * - Seeded random number generation
 * - Deterministic ID generation for various use cases
 * - Cross-platform reproducible randomness
 */

import crypto from 'crypto';

/**
 * Deterministic Random Generator using crypto hash functions
 */
export class DeterministicRandom {
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'sha256';
    this.seed = options.seed || 'kgen-core-deterministic-v1.0.0';
    this.truncateLength = options.truncateLength || 16;
    this.separator = options.separator || '_';
    
    // Pre-compute seed hash for performance
    this.seedHash = crypto.createHash(this.algorithm).update(this.seed, 'utf8').digest('hex');
  }
  
  /**
   * Generate deterministic random number (0-1) based on content
   */
  random(content = '') {
    const combined = `${this.seedHash}-${content}`;
    const hash = crypto.createHash(this.algorithm).update(combined, 'utf8').digest('hex');
    
    // Use first 8 hex characters for random number
    const hexValue = hash.substring(0, 8);
    return parseInt(hexValue, 16) / 0xffffffff;
  }
  
  /**
   * Generate deterministic integer in range [min, max]
   */
  randomInt(min, max, content = '') {
    const randomValue = this.random(content);
    return Math.floor(randomValue * (max - min + 1)) + min;
  }
  
  /**
   * Generate deterministic float in range [min, max)
   */
  randomFloat(min, max, content = '') {
    const randomValue = this.random(content);
    return randomValue * (max - min) + min;
  }
  
  /**
   * Generate deterministic hex string of specified length
   */
  randomHex(length, content = '') {
    const combined = `${this.seedHash}-hex-${content}`;
    const hash = crypto.createHash(this.algorithm).update(combined, 'utf8').digest('hex');
    return hash.substring(0, length);
  }
  
  /**
   * Generate deterministic UUID (v4 style but deterministic)
   */
  uuid(namespace = 'default', content = '') {
    const combined = `${this.seedHash}-uuid-${namespace}-${content}`;
    const hash = crypto.createHash(this.algorithm).update(combined, 'utf8').digest('hex');
    
    // Format as UUID v4 but deterministic
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      '4' + hash.substring(13, 16), // Version 4 indicator
      ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20), // Variant bits
      hash.substring(20, 32)
    ].join('-');
  }
  
  /**
   * Generate content-addressed UUID based on input
   */
  contentUuid(input) {
    const normalized = this._normalizeInput(input);
    const combined = `${this.seedHash}-content-uuid-${normalized}`;
    const hash = crypto.createHash(this.algorithm).update(combined, 'utf8').digest('hex');
    
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      '5' + hash.substring(13, 16), // Version 5 (namespace-based)
      ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20),
      hash.substring(20, 32)
    ].join('-');
  }
  
  /**
   * Generate deterministic ID with prefix
   */
  id(prefix, ...inputs) {
    const normalizedInputs = inputs.map(input => this._normalizeInput(input));
    const content = [prefix, ...normalizedInputs].join(':');
    const hash = this.randomHex(this.truncateLength, content);
    
    return `${prefix}${this.separator}${hash}`;
  }
  
  /**
   * Choose random element from array deterministically
   */
  choice(array, content = '') {
    if (!Array.isArray(array) || array.length === 0) {
      return undefined;
    }
    
    const index = this.randomInt(0, array.length - 1, content);
    return array[index];
  }
  
  /**
   * Shuffle array deterministically (returns new array)
   */
  shuffle(array, content = '') {
    if (!Array.isArray(array)) {
      return array;
    }
    
    const result = [...array];
    
    // Fisher-Yates shuffle with deterministic randomness
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i, `${content}-shuffle-${i}`);
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  }
  
  /**
   * Generate deterministic sample from array
   */
  sample(array, count, content = '') {
    if (!Array.isArray(array) || count <= 0) {
      return [];
    }
    
    const shuffled = this.shuffle(array, `${content}-sample`);
    return shuffled.slice(0, Math.min(count, array.length));
  }
  
  /**
   * Generate deterministic boolean
   */
  boolean(probability = 0.5, content = '') {
    return this.random(content) < probability;
  }
  
  /**
   * Generate deterministic string from character set
   */
  string(length, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', content = '') {
    let result = '';
    
    for (let i = 0; i < length; i++) {
      const charIndex = this.randomInt(0, charset.length - 1, `${content}-str-${i}`);
      result += charset[charIndex];
    }
    
    return result;
  }
  
  /**
   * Normalize input for consistent hashing
   */
  _normalizeInput(input) {
    if (input === null || input === undefined) {
      return '';
    }
    
    if (typeof input === 'object') {
      // Sort object keys for consistency
      const sorted = this._sortObjectKeys(input);
      return JSON.stringify(sorted);
    }
    
    return String(input);
  }
  
  /**
   * Sort object keys recursively for deterministic hashing
   */
  _sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._sortObjectKeys(item));
    }
    
    const sorted = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      sorted[key] = this._sortObjectKeys(obj[key]);
    }
    
    return sorted;
  }
}

/**
 * Specialized ID generators for different use cases
 */
export class DeterministicIdGenerator extends DeterministicRandom {
  /**
   * Generate CCPA compliant request ID
   */
  ccpaRequestId(type, consumerId, requestData = {}) {
    return this.id('ccpa', type, consumerId, 
      requestData.requestType || '', 
      requestData.purpose || ''
    );
  }
  
  /**
   * Generate GDPR compliant request ID
   */
  gdprRequestId(type, subjectId, requestData = {}) {
    return this.id('gdpr', type, subjectId, 
      requestData.scope || '', 
      requestData.legalBasis || ''
    );
  }
  
  /**
   * Generate SOC2 test ID
   */
  soc2TestId(controlId, testType, testData = {}) {
    return this.id('soc2', controlId, testType, 
      testData.frequency || ''
    );
  }
  
  /**
   * Generate evidence ID for compliance
   */
  evidenceId(controlId, evidenceType, source) {
    return this.id('evidence', controlId, evidenceType, source);
  }
  
  /**
   * Generate assessment ID for risk assessments
   */
  assessmentId(riskType, scope, criteria = {}) {
    const sortedCriteria = Object.keys(criteria).sort()
      .map(k => `${k}:${criteria[k]}`).join(',');
    return this.id('assessment', riskType, scope, sortedCriteria);
  }
  
  /**
   * Generate audit trail entry ID
   */
  auditId(action, userId, resource) {
    return this.id('audit', action, userId, resource);
  }
  
  /**
   * Generate sale ID for CCPA compliance
   */
  saleId(consumerId, thirdParty, categories = []) {
    const sortedCategories = Array.isArray(categories) ? categories.sort() : [];
    return this.id('sale', consumerId, thirdParty, ...sortedCategories);
  }
  
  /**
   * Generate consent ID for GDPR compliance
   */
  consentId(subjectId, purposes = [], context = {}) {
    const sortedPurposes = Array.isArray(purposes) ? purposes.sort() : [];
    return this.id('consent', subjectId, ...sortedPurposes, context.legalBasis || '');
  }
  
  /**
   * Generate archive ID for data retention
   */
  archiveId(dataType, retentionPolicy, source) {
    return this.id('archive', dataType, retentionPolicy, source);
  }
  
  /**
   * Generate legal hold ID
   */
  legalHoldId(holdType, scope, legalBasis) {
    return this.id('legalhold', holdType, scope, legalBasis);
  }
  
  /**
   * Generate template processing ID
   */
  templateId(templatePath, contextHash) {
    return this.id('template', templatePath, contextHash);
  }
  
  /**
   * Generate artifact ID for generated outputs
   */
  artifactId(templatePath, outputPath, contentHash) {
    return this.id('artifact', templatePath, outputPath, contentHash);
  }
  
  /**
   * Generate session ID for processing sessions
   */
  sessionId(userId, timestamp, operation) {
    return this.id('session', userId, timestamp, operation);
  }
}

/**
 * Global deterministic random instances for convenience
 */
export const deterministicRandom = new DeterministicRandom();
export const deterministicId = new DeterministicIdGenerator();

/**
 * Factory functions for creating custom instances
 */
export function createDeterministicRandom(seed, options = {}) {
  return new DeterministicRandom({ seed, ...options });
}

export function createDeterministicIdGenerator(seed, options = {}) {
  return new DeterministicIdGenerator({ seed, ...options });
}

/**
 * Convenience functions using the global instance
 */
export function randomFloat(min = 0, max = 1, content = '') {
  return deterministicRandom.randomFloat(min, max, content);
}

export function randomInt(min, max, content = '') {
  return deterministicRandom.randomInt(min, max, content);
}

export function uuid(namespace, content) {
  return deterministicRandom.uuid(namespace, content);
}

export function contentUuid(input) {
  return deterministicRandom.contentUuid(input);
}

export function randomHex(length, content = '') {
  return deterministicRandom.randomHex(length, content);
}

export function choice(array, content = '') {
  return deterministicRandom.choice(array, content);
}

export function shuffle(array, content = '') {
  return deterministicRandom.shuffle(array, content);
}

export function sample(array, count, content = '') {
  return deterministicRandom.sample(array, count, content);
}

export function boolean(probability = 0.5, content = '') {
  return deterministicRandom.boolean(probability, content);
}

export function randomString(length, charset, content = '') {
  return deterministicRandom.string(length, charset, content);
}

/**
 * Validate deterministic randomness by testing reproducibility
 */
export function validateDeterministicRandom(iterations = 100) {
  const generator = new DeterministicRandom({ seed: 'test-seed' });
  const testCases = [
    () => generator.random('test'),
    () => generator.randomInt(1, 100, 'test'),
    () => generator.uuid('test', 'content'),
    () => generator.randomHex(16, 'test')
  ];
  
  const results = {};
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const values = new Set();
    
    // Generate the same value multiple times
    for (let j = 0; j < iterations; j++) {
      values.add(JSON.stringify(testCase()));
    }
    
    results[`test${i}`] = {
      deterministic: values.size === 1,
      uniqueValues: values.size,
      expectedUnique: 1
    };
  }
  
  const allDeterministic = Object.values(results).every(r => r.deterministic);
  
  return {
    deterministic: allDeterministic,
    iterations,
    testResults: results,
    message: allDeterministic 
      ? `✅ All tests passed: ${iterations} iterations produced identical results`
      : `❌ Deterministic failure detected across ${iterations} iterations`
  };
}

export default {
  DeterministicRandom,
  DeterministicIdGenerator,
  deterministicRandom,
  deterministicId,
  createDeterministicRandom,
  createDeterministicIdGenerator,
  randomFloat,
  randomInt,
  uuid,
  contentUuid,
  randomHex,
  choice,
  shuffle,
  sample,
  boolean,
  randomString,
  validateDeterministicRandom
};