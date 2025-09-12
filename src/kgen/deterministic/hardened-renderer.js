/**
 * KGEN Hardened Deterministic Renderer
 * 
 * Guarantees byte-identical outputs for identical inputs by:
 * - Eliminating all non-deterministic elements
 * - Using consistent object property ordering
 * - Implementing deterministic UUID/ID generation
 * - Standardizing file path normalization
 * - Content-addressed caching
 * - Git-based versioning
 * - Canonical JSON serialization
 */

import crypto from 'crypto';
import nunjucks from 'nunjucks';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { consola } from 'consola';

export class HardenedDeterministicRenderer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Core deterministic settings - NO timestamps allowed
      deterministicSeed: options.deterministicSeed || 'kgen-v1.0.0',
      staticBuildTime: options.staticBuildTime || '2024-01-01T00:00:00.000Z',
      
      // Template settings
      templatesDir: options.templatesDir || '_templates',
      outputDir: options.outputDir || './generated',
      
      // Determinism enforcement - all enabled by default
      sortObjectKeys: true,
      removeAllTimestamps: true,
      useContentAddressing: true,
      normalizePaths: true,
      canonicalEncoding: 'utf8',
      
      // Security and validation
      strictMode: options.strictMode !== false,
      validateDeterminism: options.validateDeterminism !== false,
      
      // Git-based versioning
      useGitHash: options.useGitHash !== false,
      gitHashLength: options.gitHashLength || 8,
      
      ...options
    };
    
    this.logger = consola.withTag('hardened-deterministic-renderer');
    
    // Deterministic state - NO dynamic state allowed
    this.deterministicSeed = this._computeHash(this.config.deterministicSeed);
    this.contentHashCache = new Map();
    this.renderCache = new Map();
    
    // Git hash for versioning (computed once)
    this.gitHash = null;
    
    // Initialize environment with strict deterministic settings
    this._initializeDeterministicEnvironment();
  }
  
  /**
   * Initialize completely deterministic Nunjucks environment
   */
  _initializeDeterministicEnvironment() {
    // Create isolated environment with no global state
    this.environment = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(this.config.templatesDir, {
        watch: false, // NEVER watch files
        noCache: true // Force fresh reads for determinism
      }),
      {
        autoescape: false,
        trimBlocks: true,
        lstripBlocks: true
      }
    );
    
    // Register only deterministic filters and globals
    this._registerDeterministicFilters();
    this._registerDeterministicGlobals();
    
    // Remove any existing non-deterministic filters
    this._removeNonDeterministicFeatures();
  }
  
  /**
   * Register hardened deterministic filters
   */
  _registerDeterministicFilters() {
    // Deterministic date using static build time only
    this.environment.addFilter('date', (date, format) => {
      // ALWAYS use static build time - no dynamic dates allowed
      const staticDate = new Date(this.config.staticBuildTime);
      return this._formatDateDeterministic(staticDate, format);
    });
    
    // Hash-based pseudo-random with seed
    this.environment.addFilter('random', (seed = '') => {
      const combinedSeed = `${this.deterministicSeed}-${seed}`;
      const hash = this._computeHash(combinedSeed);
      return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
    });
    
    // Deterministic hash generation
    this.environment.addFilter('hash', (input, length = 8) => {
      const canonicalInput = this._canonicalizeInput(input);
      return this._computeHash(canonicalInput).substring(0, length);
    });
    
    // Content-addressed unique identifiers
    this.environment.addFilter('contentId', (input) => {
      const canonicalInput = this._canonicalizeInput(input);
      return this._computeHash(`content-${canonicalInput}`);
    });
    
    // Deterministic UUID with namespace
    this.environment.addFilter('uuid', (namespace = 'default', input = '') => {
      const combinedInput = `${this.deterministicSeed}-${namespace}-${input}`;
      const hash = this._computeHash(combinedInput);
      // Format as UUID v5 style but deterministic
      return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-5${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
    });
    
    // Deterministic slug generation
    this.environment.addFilter('slug', (input) => {
      const str = this._canonicalizeInput(input).toString();
      return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    });
    
    // Canonical object key sorting
    this.environment.addFilter('sortKeys', (obj) => {
      return this._sortObjectKeysRecursive(obj);
    });
    
    // Canonical JSON serialization
    this.environment.addFilter('canonical', (obj) => {
      const sorted = this._sortObjectKeysRecursive(obj);
      return JSON.stringify(sorted, null, 2);
    });
    
    // Deterministic array sorting
    this.environment.addFilter('sort', (array, key) => {
      if (!Array.isArray(array)) return array;
      
      return [...array].sort((a, b) => {
        const aVal = key ? this._getNestedValue(a, key) : a;
        const bVal = key ? this._getNestedValue(b, key) : b;
        
        // Canonical comparison
        const aCanonical = this._canonicalizeInput(aVal);
        const bCanonical = this._canonicalizeInput(bVal);
        
        if (aCanonical < bCanonical) return -1;
        if (aCanonical > bCanonical) return 1;
        return 0;
      });
    });
    
    // Remove all temporal/dynamic information
    this.environment.addFilter('stripTemporal', (obj) => {
      return this._stripTemporalData(obj);
    });
    
    // Normalize file paths across platforms
    this.environment.addFilter('normalizePath', (filePath) => {
      return this._normalizePathDeterministic(filePath);
    });
    
    // Git-based versioning
    this.environment.addFilter('gitVersion', async (input) => {
      const gitHash = await this._getGitHash();
      return `${gitHash}-${this._computeHash(input).substring(0, 8)}`;
    });
    
    // Base64 encoding with consistent line breaks
    this.environment.addFilter('base64', (input) => {
      const canonical = this._canonicalizeInput(input);
      return Buffer.from(canonical, 'utf8').toString('base64');
    });
  }
  
  /**
   * Register deterministic global variables
   */
  _registerDeterministicGlobals() {
    // Static build information - NEVER dynamic
    this.environment.addGlobal('BUILD_TIME', this.config.staticBuildTime);
    this.environment.addGlobal('BUILD_SEED', this.deterministicSeed);
    this.environment.addGlobal('BUILD_HASH', this.deterministicSeed.substring(0, this.config.gitHashLength));
    
    // Deterministic utility functions
    this.environment.addGlobal('hash', (input) => {
      const canonical = this._canonicalizeInput(input);
      return this._computeHash(canonical);
    });
    
    this.environment.addGlobal('uuid', (namespace = 'global') => {
      const combinedInput = `${this.deterministicSeed}-global-${namespace}`;
      const hash = this._computeHash(combinedInput);
      return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-5${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
    });
    
    // Platform-normalized paths
    this.environment.addGlobal('normalizePath', (filePath) => {
      return this._normalizePathDeterministic(filePath);
    });
  }
  
  /**
   * Remove any non-deterministic features from Nunjucks
   */
  _removeNonDeterministicFeatures() {
    // Override any potentially non-deterministic built-ins
    const nonDeterministicFeatures = ['now', 'random', 'Math', 'Date'];
    
    for (const feature of nonDeterministicFeatures) {
      if (this.environment.getGlobal(feature)) {
        this.environment.addGlobal(feature, undefined);
      }
    }
  }
  
  /**
   * Render template with guaranteed deterministic output
   */
  async render(templatePath, context = {}, options = {}) {
    try {
      // Normalize all inputs for consistency
      const normalizedContext = this._normalizeContext(context);
      const normalizedPath = this._normalizePathDeterministic(templatePath);
      
      // Create deterministic cache key
      const cacheKey = this._createCacheKey(normalizedPath, normalizedContext);
      
      // Check cache for identical render
      if (this.renderCache.has(cacheKey)) {
        this.logger.debug(`Deterministic cache hit: ${normalizedPath}`);
        return this.renderCache.get(cacheKey);
      }
      
      // Load template with deterministic parsing
      const templateContent = await this._loadTemplateDeterministic(normalizedPath);
      
      // Parse frontmatter deterministically
      const { data: frontmatter, content: template } = this._parseFrontmatterDeterministic(templateContent);
      
      // Merge context with canonical ordering
      const canonicalContext = this._mergeContextDeterministic(normalizedContext, frontmatter);
      
      // Render with deterministic environment
      const rendered = this.environment.renderString(template, canonicalContext);
      
      // Post-process for byte-identical output
      const deterministicOutput = this._postProcessDeterministic(rendered);
      
      // Compute content hash for verification
      const contentHash = this._computeHash(deterministicOutput);
      
      // Create deterministic result
      const result = {
        content: deterministicOutput,
        contentHash,
        templatePath: normalizedPath,
        context: canonicalContext,
        frontmatter: this._sortObjectKeysRecursive(frontmatter),
        renderedAt: this.config.staticBuildTime, // ALWAYS static
        deterministic: true,
        seed: this.deterministicSeed,
        metadata: {
          templateHash: this._computeHash(template),
          contextHash: this._computeHash(JSON.stringify(canonicalContext)),
          frontmatterHash: this._computeHash(JSON.stringify(frontmatter)),
          engineVersion: '1.0.0-deterministic',
          renderMethod: 'hardened-deterministic'
        }
      };
      
      // Cache result for identical future requests
      this.renderCache.set(cacheKey, result);
      
      // Validate determinism if enabled
      if (this.config.validateDeterminism) {
        await this._validateDeterministicOutput(result, templatePath, context);
      }
      
      this.emit('template:rendered', { templatePath: normalizedPath, result });
      
      return result;
      
    } catch (error) {
      this.logger.error(`Deterministic render failed for ${templatePath}:`, error);
      this.emit('template:error', { templatePath, error });
      
      if (this.config.strictMode) {
        throw error;
      }
      
      return {
        content: '',
        error: error.message,
        templatePath,
        deterministic: false
      };
    }
  }
  
  /**
   * Validate that rendering produces identical output multiple times
   */
  async _validateDeterministicOutput(result, templatePath, context, iterations = 3) {
    const hashes = [result.contentHash];
    
    for (let i = 1; i < iterations; i++) {
      // Clear cache to force re-render
      const cacheKey = this._createCacheKey(templatePath, context);
      this.renderCache.delete(cacheKey);
      
      const rerender = await this.render(templatePath, context);
      hashes.push(rerender.contentHash);
    }
    
    // All hashes must be identical
    const allIdentical = hashes.every(hash => hash === hashes[0]);
    
    if (!allIdentical) {
      const error = new Error(`Non-deterministic output detected for ${templatePath}. Hashes: ${hashes.join(', ')}`);
      this.logger.error(error.message);
      throw error;
    }
    
    return true;
  }
  
  /**
   * Test deterministic rendering with 100 iterations
   */
  async testDeterministicRendering(templatePath, context = {}, iterations = 100) {
    const results = [];
    const hashes = new Set();
    
    this.logger.info(`Testing deterministic rendering: ${iterations} iterations`);
    
    for (let i = 0; i < iterations; i++) {
      // Clear all caches to ensure fresh render
      this.renderCache.clear();
      this.contentHashCache.clear();
      
      const result = await this.render(templatePath, context);
      results.push({
        iteration: i + 1,
        contentHash: result.contentHash,
        contentLength: result.content.length
      });
      
      hashes.add(result.contentHash);
    }
    
    const isDeterministic = hashes.size === 1;
    
    return {
      templatePath,
      iterations,
      deterministic: isDeterministic,
      uniqueHashes: hashes.size,
      contentHash: isDeterministic ? Array.from(hashes)[0] : null,
      results: isDeterministic ? results.slice(0, 5) : results, // Show all if non-deterministic
      validation: {
        passed: isDeterministic,
        message: isDeterministic 
          ? `✅ All ${iterations} renders produced identical output` 
          : `❌ Found ${hashes.size} different outputs across ${iterations} renders`
      }
    };
  }
  
  /**
   * Get performance metrics for deterministic rendering
   */
  async benchmarkDeterministicRendering(templatePath, context = {}, iterations = 10) {
    const startTime = process.hrtime.bigint();
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const iterStartTime = process.hrtime.bigint();
      
      // Clear cache for fresh render
      this.renderCache.clear();
      const result = await this.render(templatePath, context);
      
      const iterEndTime = process.hrtime.bigint();
      const iterTime = Number(iterEndTime - iterStartTime) / 1e6; // Convert to milliseconds
      
      results.push({
        iteration: i + 1,
        renderTime: iterTime,
        contentHash: result.contentHash,
        contentLength: result.content.length
      });
    }
    
    const endTime = process.hrtime.bigint();
    const totalTime = Number(endTime - startTime) / 1e6;
    
    const renderTimes = results.map(r => r.renderTime);
    const avgTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
    const minTime = Math.min(...renderTimes);
    const maxTime = Math.max(...renderTimes);
    
    // Verify all outputs are identical
    const uniqueHashes = new Set(results.map(r => r.contentHash));
    const deterministic = uniqueHashes.size === 1;
    
    return {
      templatePath,
      iterations,
      deterministic,
      performance: {
        totalTime,
        averageTime: avgTime,
        minTime,
        maxTime,
        variance: this._calculateVariance(renderTimes, avgTime)
      },
      validation: {
        uniqueOutputs: uniqueHashes.size,
        contentHash: deterministic ? Array.from(uniqueHashes)[0] : null
      },
      results
    };
  }
  
  // Private helper methods for deterministic operations
  
  async _loadTemplateDeterministic(templatePath) {
    try {
      const fullPath = path.resolve(this.config.templatesDir, templatePath);
      const content = await fs.readFile(fullPath, this.config.canonicalEncoding);
      
      // Normalize line endings for cross-platform consistency
      return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
    } catch (error) {
      throw new Error(`Template not found: ${templatePath}`);
    }
  }
  
  _parseFrontmatterDeterministic(content) {
    // Simple but deterministic frontmatter parser
    if (content.startsWith('---\n')) {
      const endIndex = content.indexOf('\n---\n', 4);
      if (endIndex !== -1) {
        const frontmatterStr = content.slice(4, endIndex);
        const body = content.slice(endIndex + 5);
        
        try {
          // Parse YAML/JSON frontmatter
          const data = this._parseYamlDeterministic(frontmatterStr);
          return { 
            data: this._sortObjectKeysRecursive(data), 
            content: body 
          };
        } catch {
          // Fallback to empty frontmatter on parse error
          return { data: {}, content };
        }
      }
    }
    return { data: {}, content };
  }
  
  _parseYamlDeterministic(yamlStr) {
    // Simple YAML parser for basic key-value pairs
    const lines = yamlStr.split('\n');
    const result = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmed.slice(0, colonIndex).trim();
          const value = trimmed.slice(colonIndex + 1).trim();
          
          // Parse value
          if (value === 'true') result[key] = true;
          else if (value === 'false') result[key] = false;
          else if (value === 'null') result[key] = null;
          else if (/^\d+$/.test(value)) result[key] = parseInt(value, 10);
          else if (/^\d+\.\d+$/.test(value)) result[key] = parseFloat(value);
          else if (value.startsWith('"') && value.endsWith('"')) result[key] = value.slice(1, -1);
          else if (value.startsWith("'") && value.endsWith("'")) result[key] = value.slice(1, -1);
          else result[key] = value;
        }
      }
    }
    
    return result;
  }
  
  _normalizeContext(context) {
    // Deep clone and canonicalize context
    const cloned = JSON.parse(JSON.stringify(context));
    
    // Strip all temporal data
    const stripped = this._stripTemporalData(cloned);
    
    // Sort all object keys recursively
    const sorted = this._sortObjectKeysRecursive(stripped);
    
    return sorted;
  }
  
  _stripTemporalData(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._stripTemporalData(item));
    }
    
    const stripped = {};
    for (const [key, value] of Object.entries(obj)) {
      // Remove all temporal/dynamic keys
      const temporalKeys = [
        'timestamp', 'createdAt', 'updatedAt', 'modifiedAt', 'lastModified',
        'date', 'datetime', 'time', 'now', 'currentTime', 'buildTime',
        'id', 'uuid', 'guid', 'random', 'nonce'
      ];
      
      if (!temporalKeys.includes(key.toLowerCase())) {
        stripped[key] = this._stripTemporalData(value);
      }
    }
    
    return stripped;
  }
  
  _sortObjectKeysRecursive(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._sortObjectKeysRecursive(item));
    }
    
    const sorted = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      sorted[key] = this._sortObjectKeysRecursive(obj[key]);
    }
    
    return sorted;
  }
  
  _canonicalizeInput(input) {
    if (typeof input === 'string') {
      return input.trim();
    }
    
    if (typeof input === 'object' && input !== null) {
      return JSON.stringify(this._sortObjectKeysRecursive(input));
    }
    
    return String(input);
  }
  
  _mergeContextDeterministic(context, frontmatter) {
    // Merge with canonical key ordering
    const merged = {
      ...this._sortObjectKeysRecursive(frontmatter),
      ...this._sortObjectKeysRecursive(context)
    };
    
    // Add deterministic metadata
    merged.__deterministic = {
      seed: this.deterministicSeed,
      buildTime: this.config.staticBuildTime,
      version: '1.0.0-hardened'
    };
    
    return this._sortObjectKeysRecursive(merged);
  }
  
  _postProcessDeterministic(content) {
    let processed = content;
    
    // Normalize whitespace consistently
    processed = processed.replace(/\r\n/g, '\n'); // Windows -> Unix
    processed = processed.replace(/\r/g, '\n'); // Mac -> Unix
    processed = processed.replace(/[ \t]+$/gm, ''); // Remove trailing whitespace
    processed = processed.replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines
    processed = processed.trim(); // Remove leading/trailing whitespace
    
    // Add single final newline for POSIX compliance
    if (processed && !processed.endsWith('\n')) {
      processed += '\n';
    }
    
    return processed;
  }
  
  _normalizePathDeterministic(filePath) {
    if (!filePath) return '';
    
    // Always use forward slashes for cross-platform consistency
    return path.posix.normalize(filePath.replace(/\\/g, '/'));
  }
  
  _createCacheKey(templatePath, context) {
    const normalizedPath = this._normalizePathDeterministic(templatePath);
    const contextHash = this._computeHash(JSON.stringify(context));
    return `${normalizedPath}:${contextHash}`;
  }
  
  _computeHash(input) {
    const canonical = this._canonicalizeInput(input);
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }
  
  async _getGitHash() {
    if (this.gitHash) return this.gitHash;
    
    try {
      if (!this.config.useGitHash) {
        this.gitHash = this.deterministicSeed.substring(0, this.config.gitHashLength);
        return this.gitHash;
      }
      
      // Try to get git commit hash
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('git rev-parse HEAD');
      this.gitHash = stdout.trim().substring(0, this.config.gitHashLength);
      
    } catch (error) {
      // Fallback to deterministic seed
      this.gitHash = this.deterministicSeed.substring(0, this.config.gitHashLength);
    }
    
    return this.gitHash;
  }
  
  _getNestedValue(obj, key) {
    return key.split('.').reduce((current, k) => current && current[k], obj);
  }
  
  _formatDateDeterministic(date, format) {
    // Only use the static build time - no dynamic formatting
    const d = new Date(this.config.staticBuildTime);
    
    switch (format) {
      case 'iso':
        return d.toISOString();
      case 'date':
        return d.toISOString().split('T')[0];
      case 'year':
        return d.getFullYear().toString();
      case 'month':
        return (d.getMonth() + 1).toString().padStart(2, '0');
      case 'day':
        return d.getDate().toString().padStart(2, '0');
      default:
        return d.toISOString();
    }
  }
  
  _calculateVariance(values, mean) {
    const sumSquares = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0);
    return sumSquares / values.length;
  }
  
  // Public API methods
  
  clearCache() {
    this.renderCache.clear();
    this.contentHashCache.clear();
    this.logger.info('Deterministic renderer cache cleared');
  }
  
  getStatistics() {
    return {
      renderCacheSize: this.renderCache.size,
      contentHashCacheSize: this.contentHashCache.size,
      deterministicSeed: this.deterministicSeed,
      staticBuildTime: this.config.staticBuildTime,
      gitHash: this.gitHash,
      config: {
        sortObjectKeys: this.config.sortObjectKeys,
        removeAllTimestamps: this.config.removeAllTimestamps,
        useContentAddressing: this.config.useContentAddressing,
        normalizePaths: this.config.normalizePaths,
        validateDeterminism: this.config.validateDeterminism,
        strictMode: this.config.strictMode
      }
    };
  }
}

/**
 * Factory function for creating hardened deterministic renderers
 */
export function createHardenedDeterministicRenderer(options = {}) {
  return new HardenedDeterministicRenderer(options);
}

export default HardenedDeterministicRenderer;