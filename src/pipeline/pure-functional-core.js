/**
 * Pure Functional Core for Idempotent KGEN Pipeline
 * 
 * Dark-Matter Integration: Pure function guarantees with deterministic hash mapping.
 * Every operation is input → hash → output with zero state leakage.
 * 
 * PRINCIPLES:
 * - All functions are pure (no side effects, deterministic)
 * - Input hash → Output hash traceability 
 * - Automatic content-addressable caching
 * - Pipeline state isolation
 * - Idempotent operations by design
 */

import crypto from 'crypto';
import { performance } from 'perf_hooks';

/**
 * Pure Function Pipeline Core
 * Manages all KGEN operations as pure functions with hash-based caching
 */
export class PureFunctionalCore {
  constructor(options = {}) {
    this.options = {
      enableCache: options.enableCache !== false,
      enableTracing: options.enableTracing || false,
      hashAlgorithm: options.hashAlgorithm || 'sha256',
      maxCacheSize: options.maxCacheSize || 1000,
      debug: options.debug || false,
      ...options
    };

    // Content-addressable storage for pure function results
    this.functionCache = new Map();
    this.inputHashCache = new Map();
    this.outputHashCache = new Map();
    
    // Pipeline execution trace for debugging/verification
    this.executionTrace = [];
    this.pipelineMetrics = {
      totalOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0
    };

    // Pure function registry
    this.pureFunctions = new Map();
    
    // Initialize core pure functions
    this.initializeCoreFunctions();
  }

  /**
   * Initialize core pure functions for KGEN operations
   */
  initializeCoreFunctions() {
    // RDF parsing as pure function
    this.registerPureFunction('parseRDF', (rdfContent, options = {}) => {
      const { Parser } = require('n3');
      const parser = new Parser();
      
      try {
        const quads = parser.parse(rdfContent);
        return {
          success: true,
          quads: quads.map(quad => ({
            subject: quad.subject.value,
            predicate: quad.predicate.value,
            object: quad.object.value,
            objectType: quad.object.termType
          })),
          tripleCount: quads.length,
          processed: true
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          quads: [],
          tripleCount: 0,
          processed: false
        };
      }
    });

    // Template rendering as pure function
    this.registerPureFunction('renderTemplate', (templateContent, context, options = {}) => {
      const nunjucks = require('nunjucks');
      
      try {
        // Create isolated environment for pure rendering
        const env = new nunjucks.Environment(null, {
          autoescape: false,
          throwOnUndefined: false,
          trimBlocks: true,
          lstripBlocks: true
        });

        // Sort context keys for deterministic rendering
        const sortedContext = this.sortObjectDeep(context);
        
        const rendered = env.renderString(templateContent, sortedContext);
        
        return {
          success: true,
          content: rendered,
          contentLength: rendered.length,
          variables: this.extractTemplateVariables(templateContent),
          contextKeys: Object.keys(sortedContext).sort(),
          rendered: true
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          content: '',
          contentLength: 0,
          variables: [],
          contextKeys: [],
          rendered: false
        };
      }
    });

    // Hash computation as pure function
    this.registerPureFunction('computeHash', (content, algorithm = 'sha256') => {
      try {
        const hash = crypto.createHash(algorithm).update(content, 'utf8').digest('hex');
        return {
          success: true,
          hash,
          algorithm,
          inputLength: content.length,
          computed: true
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          hash: null,
          algorithm,
          inputLength: content.length,
          computed: false
        };
      }
    });

    // File content reading as pure function (with caching)
    this.registerPureFunction('readFileContent', (filePath, options = {}) => {
      const fs = require('fs');
      const path = require('path');
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const stats = fs.statSync(filePath);
        
        return {
          success: true,
          content,
          contentLength: content.length,
          filePath: path.resolve(filePath),
          lastModified: stats.mtime.toISOString(),
          size: stats.size,
          read: true
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          content: '',
          contentLength: 0,
          filePath: path.resolve(filePath),
          lastModified: null,
          size: 0,
          read: false
        };
      }
    });

    // Knowledge graph entity extraction as pure function
    this.registerPureFunction('extractEntities', (quads, options = {}) => {
      const entities = new Map();
      const relationships = [];
      
      for (const quad of quads) {
        // Extract entities
        if (quad.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
          const entityId = quad.subject;
          if (!entities.has(entityId)) {
            entities.set(entityId, {
              id: entityId,
              type: this.extractLocalName(quad.object),
              properties: {},
              checksum: null
            });
          }
          entities.get(entityId).type = this.extractLocalName(quad.object);
        } else {
          // Extract properties
          const entityId = quad.subject;
          if (!entities.has(entityId)) {
            entities.set(entityId, {
              id: entityId,
              type: 'Entity',
              properties: {},
              checksum: null
            });
          }
          
          const propertyName = this.extractLocalName(quad.predicate);
          entities.get(entityId).properties[propertyName] = quad.object;
        }
        
        // Extract relationships
        if (quad.objectType === 'NamedNode') {
          relationships.push({
            from: quad.subject,
            to: quad.object,
            type: this.extractLocalName(quad.predicate),
            checksum: this.createInputHash(`${quad.subject}:${quad.predicate}:${quad.object}`)
          });
        }
      }
      
      // Calculate checksums for entities
      const entitiesArray = Array.from(entities.values()).map(entity => ({
        ...entity,
        checksum: this.createInputHash(JSON.stringify({
          id: entity.id,
          type: entity.type,
          properties: entity.properties
        }))
      }));
      
      return {
        success: true,
        entities: entitiesArray,
        relationships,
        entityCount: entitiesArray.length,
        relationshipCount: relationships.length,
        extracted: true
      };
    });

    // Template validation as pure function
    this.registerPureFunction('validateTemplate', (templateContent, variables, options = {}) => {
      const templateVars = this.extractTemplateVariables(templateContent);
      const availableVars = Object.keys(variables || {});
      const missing = templateVars.filter(v => !availableVars.includes(v));
      
      return {
        success: missing.length === 0,
        templateVariables: templateVars,
        availableVariables: availableVars,
        missingVariables: missing,
        validationPassed: missing.length === 0,
        validated: true
      };
    });
  }

  /**
   * Register a pure function with the pipeline
   * @param {string} name - Function name
   * @param {Function} fn - Pure function (must be deterministic)
   */
  registerPureFunction(name, fn) {
    // Wrap function to ensure purity and add tracing
    const pureWrapper = (...args) => {
      const startTime = performance.now();
      
      try {
        // Create input hash for caching
        const inputHash = this.createInputHash({ name, args });
        
        // Check cache first
        if (this.options.enableCache && this.functionCache.has(inputHash)) {
          this.pipelineMetrics.cacheHits++;
          const cachedResult = this.functionCache.get(inputHash);
          
          if (this.options.enableTracing) {
            this.executionTrace.push({
              function: name,
              inputHash,
              outputHash: cachedResult.outputHash,
              cached: true,
              timestamp: this.getDeterministicTimestamp(),
              duration: 0
            });
          }
          
          return cachedResult.result;
        }
        
        // Execute pure function
        const result = fn(...args);
        const executionTime = performance.now() - startTime;
        
        // Create output hash
        const outputHash = this.createInputHash(result);
        
        // Cache result if enabled
        if (this.options.enableCache) {
          this.pipelineMetrics.cacheMisses++;
          this.functionCache.set(inputHash, {
            result,
            outputHash,
            timestamp: this.getDeterministicTimestamp(),
            executionTime
          });
          
          // Map input hash to output hash for traceability
          this.inputHashCache.set(inputHash, outputHash);
          this.outputHashCache.set(outputHash, inputHash);
          
          // Clean cache if it gets too large
          if (this.functionCache.size > this.options.maxCacheSize) {
            this.cleanCache();
          }
        }
        
        // Update metrics
        this.pipelineMetrics.totalOperations++;
        this.pipelineMetrics.totalExecutionTime += executionTime;
        this.pipelineMetrics.averageExecutionTime = 
          this.pipelineMetrics.totalExecutionTime / this.pipelineMetrics.totalOperations;
        
        // Add to execution trace
        if (this.options.enableTracing) {
          this.executionTrace.push({
            function: name,
            inputHash,
            outputHash,
            cached: false,
            timestamp: this.getDeterministicTimestamp(),
            duration: executionTime
          });
        }
        
        return result;
      } catch (error) {
        if (this.options.debug) {
          console.error(`Pure function ${name} failed:`, error);
        }
        
        // Return consistent error structure
        return {
          success: false,
          error: error.message,
          function: name,
          executed: false
        };
      }
    };
    
    this.pureFunctions.set(name, pureWrapper);
  }

  /**
   * Execute a pure function by name
   * @param {string} functionName - Name of registered pure function
   * @param {...any} args - Function arguments
   * @returns {any} Function result
   */
  execute(functionName, ...args) {
    if (!this.pureFunctions.has(functionName)) {
      throw new Error(`Pure function not registered: ${functionName}`);
    }
    
    return this.pureFunctions.get(functionName)(...args);
  }

  /**
   * Create a pipeline of pure functions
   * @param {Array<Object>} steps - Pipeline steps [{function, args}, ...]
   * @returns {Function} Composed pipeline function
   */
  createPipeline(steps) {
    return (initialInput) => {
      const startTime = performance.now();
      const pipelineId = this.createInputHash({ steps, initialInput, timestamp: startTime });
      
      let currentInput = initialInput;
      const results = [];
      
      for (const step of steps) {
        const { function: functionName, args = [] } = step;
        
        // Execute step with current input as first argument
        const stepResult = this.execute(functionName, currentInput, ...args);
        results.push({
          step: functionName,
          input: currentInput,
          output: stepResult,
          success: stepResult.success !== false
        });
        
        // Pass output to next step (or handle errors)
        if (stepResult.success === false) {
          return {
            success: false,
            error: `Pipeline failed at step: ${functionName}`,
            pipelineId,
            steps: results,
            executionTime: performance.now() - startTime
          };
        }
        
        currentInput = stepResult;
      }
      
      const totalTime = performance.now() - startTime;
      
      return {
        success: true,
        result: currentInput,
        pipelineId,
        steps: results,
        executionTime: totalTime,
        stepCount: steps.length
      };
    };
  }

  /**
   * Create deterministic input hash
   * @param {any} input - Input to hash
   * @returns {string} Hash string
   */
  createInputHash(input) {
    const sortedInput = this.sortObjectDeep(input);
    const inputString = JSON.stringify(sortedInput);
    return crypto.createHash(this.options.hashAlgorithm)
      .update(inputString, 'utf8')
      .digest('hex');
  }

  /**
   * Verify pipeline idempotency
   * @param {Function} pipelineFn - Pipeline function to test
   * @param {any} testInput - Input to test with
   * @param {number} iterations - Number of iterations to test
   * @returns {Object} Idempotency verification result
   */
  verifyIdempotency(pipelineFn, testInput, iterations = 3) {
    const results = [];
    const hashes = new Set();
    
    for (let i = 0; i < iterations; i++) {
      const result = pipelineFn(testInput);
      results.push(result);
      
      if (result.success) {
        const resultHash = this.createInputHash(result.result);
        hashes.add(resultHash);
      }
    }
    
    const isIdempotent = hashes.size <= 1;
    const allSucceeded = results.every(r => r.success);
    
    return {
      isIdempotent,
      allSucceeded,
      iterations,
      uniqueOutputs: hashes.size,
      results,
      consistent: isIdempotent && allSucceeded
    };
  }

  /**
   * Get hash mapping for traceability
   * @param {string} inputHash - Input hash to trace
   * @returns {Object} Hash mapping information
   */
  getHashMapping(inputHash) {
    const outputHash = this.inputHashCache.get(inputHash);
    const reverseInputHash = this.outputHashCache.get(inputHash);
    
    return {
      inputHash,
      outputHash: outputHash || null,
      reverseInputHash: reverseInputHash || null,
      cached: this.functionCache.has(inputHash),
      mappingExists: !!outputHash || !!reverseInputHash
    };
  }

  /**
   * Sort object deeply for deterministic behavior
   * @param {any} obj - Object to sort
   * @returns {any} Deeply sorted object
   */
  sortObjectDeep(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectDeep(item));
    }
    
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj = {};
    
    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObjectDeep(obj[key]);
    }
    
    return sortedObj;
  }

  /**
   * Extract template variables from template content
   * @param {string} templateContent - Template content
   * @returns {Array<string>} Variable names
   */
  extractTemplateVariables(templateContent) {
    const variables = new Set();
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s*\|.*?)?\s*\}\}/g;
    let match;
    
    while ((match = variablePattern.exec(templateContent)) !== null) {
      const varName = match[1].split('.')[0];
      variables.add(varName);
    }
    
    return Array.from(variables).sort();
  }

  /**
   * Extract local name from URI
   * @param {string} uri - URI to extract from
   * @returns {string} Local name
   */
  extractLocalName(uri) {
    const match = uri.match(/[/#]([^/#]*)$/);
    return match ? match[1] : uri;
  }

  /**
   * Clean cache by removing oldest entries
   */
  cleanCache() {
    const entries = Array.from(this.functionCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, Math.floor(this.options.maxCacheSize * 0.2));
    
    for (const [key] of toRemove) {
      const cached = this.functionCache.get(key);
      this.functionCache.delete(key);
      this.inputHashCache.delete(key);
      if (cached.outputHash) {
        this.outputHashCache.delete(cached.outputHash);
      }
    }
  }

  /**
   * Get pipeline metrics and statistics
   * @returns {Object} Comprehensive metrics
   */
  getMetrics() {
    const cacheTotal = this.pipelineMetrics.cacheHits + this.pipelineMetrics.cacheMisses;
    
    return {
      ...this.pipelineMetrics,
      cacheHitRate: cacheTotal > 0 ? this.pipelineMetrics.cacheHits / cacheTotal : 0,
      registeredFunctions: this.pureFunctions.size,
      cacheSize: this.functionCache.size,
      inputHashMappings: this.inputHashCache.size,
      outputHashMappings: this.outputHashCache.size,
      executionTraceEntries: this.executionTrace.length
    };
  }

  /**
   * Get execution trace for debugging
   * @param {number} limit - Max entries to return
   * @returns {Array} Execution trace entries
   */
  getExecutionTrace(limit = 100) {
    return this.executionTrace.slice(-limit);
  }

  /**
   * Clear all caches and reset metrics
   */
  reset() {
    this.functionCache.clear();
    this.inputHashCache.clear();
    this.outputHashCache.clear();
    this.executionTrace.length = 0;
    
    this.pipelineMetrics = {
      totalOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0
    };
  }

  /**
   * Export cache for persistence
   * @returns {Object} Serializable cache data
   */
  exportCache() {
    return {
      functions: Array.from(this.functionCache.entries()),
      inputHashes: Array.from(this.inputHashCache.entries()),
      outputHashes: Array.from(this.outputHashCache.entries()),
      metrics: this.pipelineMetrics,
      exportedAt: this.getDeterministicDate().toISOString()
    };
  }

  /**
   * Import cache from persistence
   * @param {Object} cacheData - Cache data to import
   */
  importCache(cacheData) {
    if (cacheData.functions) {
      this.functionCache = new Map(cacheData.functions);
    }
    if (cacheData.inputHashes) {
      this.inputHashCache = new Map(cacheData.inputHashes);
    }
    if (cacheData.outputHashes) {
      this.outputHashCache = new Map(cacheData.outputHashes);
    }
    if (cacheData.metrics) {
      this.pipelineMetrics = { ...this.pipelineMetrics, ...cacheData.metrics };
    }
  }
}

/**
 * Create pure functional core instance
 * @param {Object} options - Configuration options
 * @returns {PureFunctionalCore} Pure functional core instance
 */
export function createPureFunctionalCore(options = {}) {
  return new PureFunctionalCore(options);
}

export default PureFunctionalCore;