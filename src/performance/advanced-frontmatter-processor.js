/**
 * ADVANCED FRONTMATTER PROCESSOR
 * High-performance frontmatter parsing with YAML, TOML, and JSON support
 * Target: <5ms parsing for complex frontmatter
 */

const yaml = require('yaml');
const path = require('path');
const { performance } = require('perf_hooks');

/**
 * TOML parser implementation (lightweight alternative to external dependency)
 */
class SimpleTOMLParser {
  static parse(tomlString) {
    const result = {};
    const lines = tomlString.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    
    let currentSection = result;
    let currentSectionName = '';
    
    for (const line of lines) {
      // Section headers [section]
      if (line.startsWith('[') && line.endsWith(']')) {
        currentSectionName = line.slice(1, -1).trim();
        currentSection = result[currentSectionName] = {};
        continue;
      }
      
      // Key-value pairs
      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = line.slice(0, equalIndex).trim();
      let value = line.slice(equalIndex + 1).trim();
      
      // Parse value types
      currentSection[key] = this.parseValue(value);
    }
    
    return result;
  }
  
  static parseValue(value) {
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }
    
    // Array (basic support)
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value.slice(1, -1).split(',').map(item => this.parseValue(item.trim()));
      return items;
    }
    
    // Return as string
    return value;
  }
}

/**
 * Advanced frontmatter processor with multi-format support
 */
class AdvancedFrontmatterProcessor {
  constructor(options = {}) {
    this.enableCaching = options.enableCaching !== false;
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
    this.maxCacheSize = options.maxCacheSize || 500;
    
    // Performance cache
    this.parseCache = new Map();
    this.cacheTimestamps = new Map();
    
    // Supported formats
    this.parsers = {
      yaml: this.parseYAML.bind(this),
      yml: this.parseYAML.bind(this),
      toml: this.parseTOML.bind(this),
      json: this.parseJSON.bind(this)
    };
    
    // Performance metrics
    this.metrics = {
      parseTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      formatUsage: new Map()
    };
  }

  /**
   * Parse frontmatter from template content
   * Supports YAML, TOML, and JSON formats
   */
  parseFrontmatter(content, filePath = 'unknown') {
    const startTime = performance.now();
    
    try {
      if (!content || typeof content !== 'string') {
        return { data: {}, content: content || '', format: null };
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(content);
      if (this.enableCaching) {
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          return cached;
        }
        this.metrics.cacheMisses++;
      }

      const result = this.detectAndParse(content);
      
      // Cache result
      if (this.enableCaching) {
        this.setCachedResult(cacheKey, result);
      }
      
      // Update metrics
      const duration = performance.now() - startTime;
      this.metrics.parseTimes.push(duration);
      
      if (result.format) {
        const count = this.metrics.formatUsage.get(result.format) || 0;
        this.metrics.formatUsage.set(result.format, count + 1);
      }
      
      // Performance warning
      if (duration > 5) {
        console.warn(`⚠️ Frontmatter parsing exceeded 5ms target: ${filePath} (${duration.toFixed(2)}ms)`);
      }
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metrics.parseTimes.push(duration);
      
      throw new Error(`Frontmatter parsing failed for '${filePath}': ${error.message}`);
    }
  }

  /**
   * Detect frontmatter format and parse accordingly
   */
  detectAndParse(content) {
    // No frontmatter
    if (!content.startsWith('---') && !content.startsWith('+++') && !content.startsWith('{')) {
      return { data: {}, content, format: null };
    }

    // YAML frontmatter (---)
    if (content.startsWith('---')) {
      return this.parseYAMLFrontmatter(content);
    }
    
    // TOML frontmatter (+++)
    if (content.startsWith('+++')) {
      return this.parseTOMLFrontmatter(content);
    }
    
    // JSON frontmatter (starts with {)
    if (content.startsWith('{')) {
      return this.parseJSONFrontmatter(content);
    }

    // No recognized frontmatter format
    return { data: {}, content, format: null };
  }

  /**
   * Parse YAML frontmatter
   */
  parseYAMLFrontmatter(content) {
    const endMarker = content.indexOf('---', 3);
    if (endMarker === -1) {
      return { data: {}, content, format: null };
    }

    const frontmatterStr = content.slice(3, endMarker).trim();
    const bodyContent = content.slice(endMarker + 3).trim();
    
    try {
      const data = this.parseYAML(frontmatterStr);
      return { data, content: bodyContent, format: 'yaml' };
    } catch (error) {
      throw new Error(`YAML frontmatter parsing error: ${error.message}`);
    }
  }

  /**
   * Parse TOML frontmatter  
   */
  parseTOMLFrontmatter(content) {
    const endMarker = content.indexOf('+++', 3);
    if (endMarker === -1) {
      return { data: {}, content, format: null };
    }

    const frontmatterStr = content.slice(3, endMarker).trim();
    const bodyContent = content.slice(endMarker + 3).trim();
    
    try {
      const data = this.parseTOML(frontmatterStr);
      return { data, content: bodyContent, format: 'toml' };
    } catch (error) {
      throw new Error(`TOML frontmatter parsing error: ${error.message}`);
    }
  }

  /**
   * Parse JSON frontmatter
   */
  parseJSONFrontmatter(content) {
    // Find the end of JSON object
    let braceCount = 0;
    let endIndex = -1;
    
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      
      if (braceCount === 0 && i > 0) {
        endIndex = i;
        break;
      }
    }
    
    if (endIndex === -1) {
      return { data: {}, content, format: null };
    }

    const frontmatterStr = content.slice(0, endIndex + 1);
    const bodyContent = content.slice(endIndex + 1).trim();
    
    try {
      const data = this.parseJSON(frontmatterStr);
      return { data, content: bodyContent, format: 'json' };
    } catch (error) {
      throw new Error(`JSON frontmatter parsing error: ${error.message}`);
    }
  }

  /**
   * Parse YAML with performance optimizations
   */
  parseYAML(yamlString) {
    try {
      // Use fast YAML parser with optimized settings
      return yaml.parse(yamlString, {
        mapAsMap: false,
        maxAliasCount: 100,
        prettyErrors: false
      });
    } catch (error) {
      throw new Error(`YAML parsing error: ${error.message}`);
    }
  }

  /**
   * Parse TOML with lightweight parser
   */
  parseTOML(tomlString) {
    try {
      return SimpleTOMLParser.parse(tomlString);
    } catch (error) {
      throw new Error(`TOML parsing error: ${error.message}`);
    }
  }

  /**
   * Parse JSON with error handling
   */
  parseJSON(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`JSON parsing error: ${error.message}`);
    }
  }

  /**
   * Generate cache key for content
   */
  generateCacheKey(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content.slice(0, 1000)).digest('hex'); // First 1KB for speed
  }

  /**
   * Get cached parsing result
   */
  getCachedResult(key) {
    if (!this.parseCache.has(key)) {
      return null;
    }
    
    const timestamp = this.cacheTimestamps.get(key);
    if (timestamp && Date.now() - timestamp > this.cacheTTL) {
      this.parseCache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    
    return this.parseCache.get(key);
  }

  /**
   * Set cached parsing result
   */
  setCachedResult(key, result) {
    // Evict old entries if at capacity
    if (this.parseCache.size >= this.maxCacheSize) {
      this.evictOldestCacheEntry();
    }
    
    this.parseCache.set(key, result);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Evict oldest cache entry
   */
  evictOldestCacheEntry() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.parseCache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }
  }

  /**
   * Validate frontmatter data against schema
   */
  validateFrontmatter(data, schema) {
    const errors = [];
    
    if (!schema || typeof schema !== 'object') {
      return errors;
    }

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      // Required field validation
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          type: 'required',
          message: `Required field '${field}' is missing`
        });
        continue;
      }
      
      if (value === undefined || value === null) continue;
      
      // Type validation
      if (rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          errors.push({
            field,
            type: 'type_mismatch',
            message: `Field '${field}' must be of type '${rules.type}', got '${actualType}'`,
            expected: rules.type,
            actual: actualType
          });
        }
      }
      
      // Format validation for strings
      if (rules.format && typeof value === 'string') {
        const formats = {
          email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          url: /^https?:\/\/.+/,
          date: /^\d{4}-\d{2}-\d{2}$/,
          datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        };
        
        if (formats[rules.format] && !formats[rules.format].test(value)) {
          errors.push({
            field,
            type: 'format',
            message: `Field '${field}' does not match expected format '${rules.format}'`,
            format: rules.format,
            value
          });
        }
      }
      
      // Range validation for numbers
      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push({
            field,
            type: 'min_value',
            message: `Field '${field}' must be at least ${rules.min}`,
            min: rules.min,
            value
          });
        }
        
        if (rules.max !== undefined && value > rules.max) {
          errors.push({
            field,
            type: 'max_value',
            message: `Field '${field}' must be at most ${rules.max}`,
            max: rules.max,
            value
          });
        }
      }
      
      // Array validation
      if (Array.isArray(value) && rules.items) {
        for (let i = 0; i < value.length; i++) {
          const itemErrors = this.validateFrontmatter({ item: value[i] }, { item: rules.items });
          for (const itemError of itemErrors) {
            errors.push({
              field: `${field}[${i}]`,
              type: itemError.type,
              message: itemError.message.replace('item', `${field}[${i}]`)
            });
          }
        }
      }
    }
    
    return errors;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const parseTimes = this.metrics.parseTimes;
    const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0;
    
    const calculateStats = (times) => {
      if (times.length === 0) return { avg: 0, p95: 0, max: 0, min: 0 };
      
      const sorted = [...times].sort((a, b) => a - b);
      return {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        max: sorted[sorted.length - 1] || 0,
        min: sorted[0] || 0,
        count: times.length
      };
    };

    return {
      parsing: {
        ...calculateStats(parseTimes),
        target: 5,
        compliance: parseTimes.filter(t => t <= 5).length / parseTimes.length || 1
      },
      caching: {
        hitRate: cacheHitRate,
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        size: this.parseCache.size,
        maxSize: this.maxCacheSize
      },
      formats: Object.fromEntries(this.metrics.formatUsage)
    };
  }

  /**
   * Clear all caches and reset metrics
   */
  reset() {
    this.parseCache.clear();
    this.cacheTimestamps.clear();
    this.metrics = {
      parseTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      formatUsage: new Map()
    };
  }

  /**
   * Health check for performance compliance
   */
  healthCheck() {
    const metrics = this.getPerformanceMetrics();
    const status = {
      healthy: true,
      issues: [],
      compliance: metrics.parsing.compliance * 100,
      cachePerformance: metrics.caching.hitRate * 100
    };

    if (status.compliance < 95) {
      status.healthy = false;
      status.issues.push(`Frontmatter parsing performance below 95% compliance (${status.compliance.toFixed(1)}%)`);
    }

    if (this.enableCaching && status.cachePerformance < 70) {
      status.healthy = false;
      status.issues.push(`Cache hit rate below 70% (${status.cachePerformance.toFixed(1)}%)`);
    }

    return status;
  }
}

module.exports = { AdvancedFrontmatterProcessor, SimpleTOMLParser };