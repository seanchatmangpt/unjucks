/**
 * CAS Test Helpers and Utilities
 * 
 * These utilities support the CAS BDD step definitions with:
 * - Performance measurement and validation
 * - RDF parsing and variable extraction  
 * - Hash validation and comparison utilities
 * - Test data generation and cleanup
 */

import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';

// =============================================================================
// Performance Measurement Utilities
// =============================================================================

/**
 * Performance measurement record
 * @typedef {Object} PerformanceMeasurement
 * @property {string} operation - Operation name
 * @property {number} duration - Duration in milliseconds
 * @property {number} timestamp - Timestamp
 * @property {Record<string, any>} [metadata] - Optional metadata
 */

/**
 * Performance tracker for BDD testing
 */
export class PerformanceTracker {
  constructor() {
    /** @private @type {PerformanceMeasurement[]} */
    this.measurements = [];
    /** @private @type {Map<string, number>} */
    this.startTimes = new Map();
  }

  /**
   * Start timing an operation
   * @param {string} operation - Operation name
   * @param {Record<string, any>} [metadata] - Optional metadata
   * @returns {void}
   */
  start(operation, metadata) {
    this.startTimes.set(operation, performance.now());
  }

  /**
   * End timing an operation and record measurement
   * @param {string} operation - Operation name
   * @param {Record<string, any>} [metadata] - Optional metadata
   * @returns {PerformanceMeasurement} - The measurement record
   */
  end(operation, metadata) {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      throw new Error(`No start time recorded for operation: ${operation}`);
    }

    /** @type {PerformanceMeasurement} */
    const measurement = {
      operation,
      duration: performance.now() - startTime,
      timestamp: Date.now(),
      metadata
    };

    this.measurements.push(measurement);
    this.startTimes.delete(operation);
    return measurement;
  }

  /**
   * Get all measurements or measurements for specific operation
   * @param {string} [operation] - Operation name filter
   * @returns {PerformanceMeasurement[]} - Array of measurements
   */
  getMeasurements(operation) {
    if (!operation) return [...this.measurements];
    return this.measurements.filter(m => m.operation === operation);
  }

  /**
   * Calculate average duration for an operation
   * @param {string} operation - Operation name
   * @returns {number} - Average duration in milliseconds
   */
  getAverageDuration(operation) {
    const measurements = this.getMeasurements(operation);
    if (measurements.length === 0) return 0;
    
    const totalDuration = measurements.reduce((sum, m) => sum + m.duration, 0);
    return totalDuration / measurements.length;
  }

  /**
   * Calculate percentile for operation durations
   * @param {string} operation - Operation name
   * @param {number} percentile - Percentile (0-1)
   * @returns {number} - Percentile value in milliseconds
   */
  getPercentile(operation, percentile) {
    const measurements = this.getMeasurements(operation);
    if (measurements.length === 0) return 0;

    const durations = measurements.map(m => m.duration).sort((a, b) => a - b);
    const index = Math.ceil(durations.length * percentile) - 1;
    return durations[Math.max(0, index)];
  }

  /**
   * Clear all measurements and timing data
   * @returns {void}
   */
  clear() {
    this.measurements = [];
    this.startTimes.clear();
  }

  /**
   * Get comprehensive statistics for an operation
   * @param {string} [operation] - Operation name filter
   * @returns {Object} - Statistics object
   */
  getStats(operation) {
    const measurements = this.getMeasurements(operation);
    if (measurements.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const durations = measurements.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: durations.length,
      avg: sum / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p50: this._percentile(durations, 0.5),
      p95: this._percentile(durations, 0.95),
      p99: this._percentile(durations, 0.99)
    };
  }

  /**
   * Calculate percentile from sorted array
   * @private
   * @param {number[]} sortedArray - Sorted array of numbers
   * @param {number} percentile - Percentile (0-1)
   * @returns {number} - Percentile value
   */
  _percentile(sortedArray, percentile) {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)];
  }
}

// =============================================================================
// RDF Parsing and Variable Extraction
// =============================================================================

/**
 * RDF triple representation
 * @typedef {Object} RDFTriple
 * @property {string} subject - Triple subject
 * @property {string} predicate - Triple predicate
 * @property {string} object - Triple object
 */

/**
 * Extracted variable from RDF
 * @typedef {Object} ExtractedVariable
 * @property {string} name - Variable name
 * @property {string} value - Variable value
 * @property {string} [type] - Variable type
 * @property {boolean} [required] - Whether variable is required
 */

/**
 * Simple RDF parser for test purposes
 */
export class SimpleRDFParser {
  /**
   * Parse simple RDF Turtle format and extract triples
   * Note: This is a simplified parser for test purposes
   * @param {string} rdfContent - RDF content in Turtle format
   * @returns {RDFTriple[]} - Array of RDF triples
   */
  static parseTriples(rdfContent) {
    /** @type {RDFTriple[]} */
    const triples = [];
    const lines = rdfContent.split('\n');
    let currentSubject = '';

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed.startsWith('@') || trimmed === '') {
        continue;
      }

      // Handle subject lines (start with a URI or prefixed name)
      if (trimmed.match(/^[a-zA-Z0-9:_-]+\s+/)) {
        const parts = trimmed.split(/\s+/);
        currentSubject = parts[0];
        
        // Parse predicate-object pairs on the same line
        const remainder = trimmed.substring(parts[0].length).trim();
        this._parsePredicateObjects(currentSubject, remainder, triples);
      }
      // Handle continuation lines (start with predicate)
      else if (currentSubject && trimmed.match(/^[a-zA-Z0-9:_-]+/)) {
        this._parsePredicateObjects(currentSubject, trimmed, triples);
      }
    }

    return triples;
  }

  /**
   * Parse predicate-object pairs from content
   * @private
   * @param {string} subject - Triple subject
   * @param {string} content - Content to parse
   * @param {RDFTriple[]} triples - Array to add triples to
   * @returns {void}
   */
  static _parsePredicateObjects(subject, content, triples) {
    // Simple parsing - split by semicolon for multiple predicate-object pairs
    const pairs = content.split(';');
    
    for (const pair of pairs) {
      const trimmedPair = pair.trim();
      if (trimmedPair === '' || trimmedPair === '.') continue;

      // Split predicate and object
      const spaceIndex = trimmedPair.indexOf(' ');
      if (spaceIndex === -1) continue;

      const predicate = trimmedPair.substring(0, spaceIndex).trim();
      const object = trimmedPair.substring(spaceIndex + 1).trim()
        .replace(/\s*\.\s*$/, '') // Remove trailing dot
        .replace(/^"/, '').replace(/"$/, ''); // Remove quotes

      triples.push({ subject, predicate, object });
    }
  }

  /**
   * Extract template variables from RDF triples
   * @param {RDFTriple[]} triples - Array of RDF triples
   * @returns {Record<string, string>} - Extracted variables
   */
  static extractVariables(triples) {
    /** @type {Record<string, string>} */
    const variables = {};

    for (const triple of triples) {
      // Extract property names and values
      if (triple.predicate.includes('className')) {
        variables.className = triple.object;
      }
      else if (triple.predicate.includes('tableName')) {
        variables.tableName = triple.object;
      }
      else if (triple.predicate.includes('description')) {
        variables.description = triple.object;
      }
      else if (triple.predicate.includes('propertyName')) {
        variables.propertyName = triple.object;
      }
      else if (triple.predicate.includes('propertyType')) {
        variables.propertyType = triple.object;
      }
      else if (triple.predicate.includes('required')) {
        variables.required = triple.object;
      }
      else if (triple.predicate.includes('generateService')) {
        variables.generateService = triple.object;
      }
      else if (triple.predicate.includes('generateController')) {
        variables.generateController = triple.object;
      }
      else if (triple.predicate.includes('generateTests')) {
        variables.generateTests = triple.object;
      }
    }

    return variables;
  }

  /**
   * Extract all properties from an entity definition
   * @param {RDFTriple[]} triples - Array of RDF triples
   * @param {string} entitySubject - Entity subject to extract properties for
   * @returns {ExtractedVariable[]} - Array of extracted variables
   */
  static extractEntityProperties(triples, entitySubject) {
    /** @type {ExtractedVariable[]} */
    const properties = [];
    const propertySubjects = triples
      .filter(t => t.subject === entitySubject && t.predicate.includes('hasProperty'))
      .map(t => t.object);

    for (const propSubject of propertySubjects) {
      const propTriples = triples.filter(t => t.subject === propSubject);
      /** @type {any} */
      const property = { name: '', value: '' };

      for (const triple of propTriples) {
        if (triple.predicate.includes('propertyName')) {
          property.name = triple.object;
          property.value = triple.object;
        }
        else if (triple.predicate.includes('propertyType')) {
          property.type = triple.object;
        }
        else if (triple.predicate.includes('required')) {
          property.required = triple.object === 'true';
        }
      }

      if (property.name) {
        properties.push(property);
      }
    }

    return properties;
  }
}

// =============================================================================
// Hash Validation and Comparison Utilities
// =============================================================================

/**
 * Hash validation and comparison utilities
 */
export class HashValidator {
  /**
   * Calculate SHA-256 hash for any content
   * @param {string | Buffer} content - Content to hash
   * @returns {string} - Hex-encoded hash
   */
  static sha256(content) {
    const hash = createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }

  /**
   * Compare two pieces of content and return detailed diff info
   * @param {string | Buffer} content1 - First content
   * @param {string | Buffer} content2 - Second content
   * @returns {Object} - Comparison result
   */
  static compareContent(content1, content2) {
    const hash1 = this.sha256(content1);
    const hash2 = this.sha256(content2);
    const size1 = Buffer.isBuffer(content1) ? content1.length : Buffer.byteLength(content1);
    const size2 = Buffer.isBuffer(content2) ? content2.length : Buffer.byteLength(content2);

    const result = {
      identical: hash1 === hash2,
      hash1,
      hash2,
      sizeDiff: size2 - size1
    };

    // If not identical and both are strings, provide basic diff info
    if (!result.identical && typeof content1 === 'string' && typeof content2 === 'string') {
      const maxLength = Math.min(200, Math.max(content1.length, content2.length));
      result.contentDiff = {
        content1Preview: content1.substring(0, maxLength),
        content2Preview: content2.substring(0, maxLength)
      };
    }

    return result;
  }

  /**
   * Validate that multiple hashes are identical (for deterministic testing)
   * @param {string[]} hashes - Array of hashes to validate
   * @returns {Object} - Validation result
   */
  static validateIdenticalHashes(hashes) {
    const uniqueHashes = [...new Set(hashes)];
    /** @type {Record<string, number>} */
    const duplicateCounts = {};
    
    hashes.forEach(hash => {
      duplicateCounts[hash] = (duplicateCounts[hash] || 0) + 1;
    });

    return {
      allIdentical: uniqueHashes.length === 1,
      uniqueHashes,
      duplicateCounts
    };
  }

  /**
   * Generate a set of known test hashes for validation
   * @returns {Record<string, string>} - Test hashes
   */
  static generateTestHashes() {
    return {
      empty: this.sha256(''),
      test: this.sha256('test'),
      hello: this.sha256('Hello, World!'),
      unicode: this.sha256('Hello 🌍 Unicode! 中文 العربية'),
      numbers: this.sha256('1234567890'),
      longString: this.sha256('a'.repeat(10000))
    };
  }
}

// =============================================================================
// Test Data Generation Utilities
// =============================================================================

/**
 * Test data generation utilities
 */
export class TestDataGenerator {
  /**
   * Generate variable combinations for template testing
   * @returns {Array<Record<string, any>>} - Array of variable combinations
   */
  static generateVariableCombinations() {
    return [
      { name: 'Component1', withProps: true, withTimestamp: true },
      { name: 'Component2', withProps: false, withTimestamp: true },
      { name: 'Component3', withProps: true, withTimestamp: false },
      { name: 'Service1', type: 'service', methods: ['create', 'update', 'delete'] },
      { name: 'Entity1', fields: [
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' }
      ]}
    ];
  }

  /**
   * Generate content of varying sizes for performance testing
   * @returns {Array<{size: number, content: string, label: string}>} - Content with size info
   */
  static generateContentSizes() {
    return [
      { size: 10, content: 'x'.repeat(10), label: 'tiny' },
      { size: 100, content: 'x'.repeat(100), label: 'small' },
      { size: 1000, content: 'x'.repeat(1000), label: 'medium' },
      { size: 10000, content: 'x'.repeat(10000), label: 'large' },
      { size: 100000, content: 'x'.repeat(100000), label: 'xlarge' }
    ];
  }

  /**
   * Generate realistic template content for testing
   * @param {number} [count=10] - Number of templates to generate
   * @returns {Array<{name: string, content: string}>} - Array of template definitions
   */
  static generateRealisticTemplates(count = 10) {
    const templates = [];
    
    for (let i = 0; i < count; i++) {
      templates.push({
        name: `template-${i}`,
        content: `/**
 * Generated Template ${i}
 * Hash: {{kgen.staticHash}}
 * Timestamp: {{kgen.staticTimestamp}}
 */

export interface Component${i}Props {
  id: string;
  title: string;
${Array.from({ length: 3 }, (_, j) => `  field${j}: string;`).join('\n')}
}

export const Component${i}: React.FC<Component${i}Props> = (props) => {
  return (
    <div className="component-${i}">
      <h1>{props.title}</h1>
${Array.from({ length: 3 }, (_, j) => `      <p>{props.field${j}}</p>`).join('\n')}
    </div>
  );
};

export default Component${i};`
      });
    }
    
    return templates;
  }
}

// =============================================================================
// File System and Cleanup Utilities
// =============================================================================

/**
 * File system helper utilities for testing
 */
export class FileSystemHelper {
  /**
   * Create a temporary workspace for testing
   * @param {string} [prefix='cas-test'] - Prefix for workspace name
   * @returns {Promise<string>} - Path to created workspace
   */
  static async createTempWorkspace(prefix = 'cas-test') {
    const tempDir = path.join(process.cwd(), 'test-temp', `${prefix}-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Clean up temporary workspace
   * @param {string} workspacePath - Path to workspace to clean up
   * @returns {Promise<void>}
   */
  static async cleanupWorkspace(workspacePath) {
    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn(`Failed to cleanup workspace ${workspacePath}:`, error);
    }
  }

  /**
   * Verify file exists and has expected content hash
   * @param {string} filePath - Path to file to verify
   * @param {string} expectedHash - Expected content hash
   * @returns {Promise<boolean>} - Whether file matches expected hash
   */
  static async verifyFileHash(filePath, expectedHash) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const actualHash = HashValidator.sha256(content);
      return actualHash === expectedHash;
    } catch {
      return false;
    }
  }

  /**
   * Write content to file atomically
   * @param {string} filePath - Target file path
   * @param {string} content - Content to write
   * @returns {Promise<void>}
   */
  static async writeFileAtomic(filePath, content) {
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, filePath);
  }
}

// =============================================================================
// Cache Performance Testing Utilities  
// =============================================================================

/**
 * Cache testing helper utilities
 */
export class CacheTestHelper {
  /**
   * Generate cache access patterns for performance testing
   * @param {number} operations - Number of operations to generate
   * @param {number} hitRatio - Expected hit ratio (0-1)
   * @returns {Array<{type: 'store'|'retrieve', key?: string, content?: string}>} - Access pattern
   */
  static generateAccessPattern(operations, hitRatio) {
    const pattern = [];
    const storedKeys = [];
    
    // First, store some initial content
    const initialStores = Math.floor(operations * 0.1);
    for (let i = 0; i < initialStores; i++) {
      const key = `initial-${i}`;
      pattern.push({ type: 'store', key, content: `initial content ${i}` });
      storedKeys.push(key);
    }
    
    // Then generate mixed store/retrieve operations
    for (let i = initialStores; i < operations; i++) {
      if (storedKeys.length > 0 && Math.random() < hitRatio) {
        // Cache hit - retrieve existing content
        const randomKey = storedKeys[Math.floor(Math.random() * storedKeys.length)];
        pattern.push({ type: 'retrieve', key: randomKey });
      } else {
        // Cache miss - store new content
        const key = `new-${i}`;
        pattern.push({ type: 'store', key, content: `new content ${i}` });
        storedKeys.push(key);
      }
    }
    
    return pattern;
  }

  /**
   * Validate cache performance meets expectations
   * @param {any} metrics - Cache metrics to validate
   * @param {number} expectedHitRate - Expected hit rate (0-1)
   * @param {number} [tolerance=0.05] - Tolerance for validation
   * @returns {Object} - Validation result
   */
  static validateCachePerformance(metrics, expectedHitRate, tolerance = 0.05) {
    const actualHitRate = metrics.hitRate / 100; // Convert from percentage
    const valid = Math.abs(actualHitRate - expectedHitRate) <= tolerance;
    
    return {
      valid,
      actualHitRate: actualHitRate * 100,
      message: valid 
        ? `Cache hit rate ${actualHitRate * 100}% meets expectation`
        : `Cache hit rate ${actualHitRate * 100}% does not meet expected ${expectedHitRate * 100}%`
    };
  }
}

// Export all utilities
export default {
  PerformanceTracker,
  SimpleRDFParser,
  HashValidator,
  TestDataGenerator,
  FileSystemHelper,
  CacheTestHelper
};