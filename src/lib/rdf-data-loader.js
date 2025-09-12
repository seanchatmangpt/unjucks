import { readFileSync } from "node:fs";
import { TurtleParser } from "./turtle-parser.js";

/**
 * @typedef {Object} RDFDataSource
 * @property {'file' | 'inline' | 'uri'} type - Source type
 * @property {string} [source] - Source path/content/uri (for compatibility)
 * @property {string} [path] - File path (BDD test interface)
 * @property {string} [content] - Inline content (BDD test interface)
 * @property {string} [uri] - URI source
 * @property {Object} [options] - Parse options
 */

/**
 * @typedef {Object} CacheEntry
 * @property {Object} data - Cached data
 * @property {number} timestamp - Cache timestamp
 * @property {number} ttl - Time to live
 */

/**
 * @typedef {Object} RDFDataLoaderOptions
 * @property {string} [baseUri] - Base URI for resolving relative URIs
 * @property {number} [defaultTTL=300000] - Default TTL for cache entries in milliseconds (5 minutes)
 * @property {number} [maxCacheSize=100] - Maximum cache size
 * @property {boolean} [enableCleanup=true] - Enable cache cleanup on interval
 * @property {number} [cleanupInterval=60000] - Cache cleanup interval in milliseconds (1 minute)
 * @property {boolean} [cacheEnabled=true] - Enable cache functionality
 */

/**
 * @typedef {Object} RDFDataLoadResult
 * @property {boolean} success - Success flag
 * @property {string} [source] - Source identifier
 * @property {string} [error] - Error message
 * @property {string[]} errors - Error array
 * @property {Object} data - Parsed data
 * @property {Array} triples - RDF triples
 * @property {Object} prefixes - Namespace prefixes
 * @property {Object} stats - Parse statistics
 * @property {Array} [namedGraphs] - Named graphs
 */

/**
 * RDFDataLoader loads RDF data from multiple sources with caching support
 * Designed for BDD test compatibility with real implementation - NO MOCKS OR PLACEHOLDERS
 */
export class RDFDataLoader {
  constructor(options = {}) {
    this.cache = new Map();
    this.options = {
      baseUri: options.baseUri ?? "",
      cacheEnabled: options.cacheEnabled ?? true,
      defaultTTL: options.defaultTTL ?? 5 * 60 * 1000, // 5 minutes
      maxCacheSize: options.maxCacheSize ?? 100,
      enableCleanup: options.enableCleanup ?? true,
      cleanupInterval: options.cleanupInterval ?? 60 * 1000, // 1 minute
    };

    this.parser = new TurtleParser();

    // Start cleanup timer if enabled
    if (this.options.enableCleanup) {
      this.startCleanupTimer();
    }
  }

  /**
   * Load RDF data from a specified source
   * Supports BDD test interface: { type: 'file', path: string } | { type: 'inline', content: string }
   * @param {RDFDataSource | {type: 'file', path: string} | {type: 'inline', content: string}} source - Data source
   * @returns {Promise<Object>}
   */
  async loadFromSource(source) {
    // Convert different source formats to internal format
    let normalizedSource;
    if ("path" in source) {
      normalizedSource = {
        type: "file",
        path: source.path,
        source: source.path,
      };
    } else if ("content" in source) {
      normalizedSource = {
        type: "inline",
        content: source.content,
        source: source.content,
      };
    } else {
      normalizedSource = source;
    }

    const cacheKey = this.generateCacheKey(normalizedSource);

    // Check cache first
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && !this.isExpired(cachedEntry)) {
      const cachedData = cachedEntry.data;
      return {
        ...cachedData,
        success: true,
        source: cacheKey,
        error: undefined,
        errors: [],
        data: cachedData  // Ensure data field is present for tests
      };
    }

    // Load data based on source type
    let content;
    switch (normalizedSource.type) {
      case "file":
        const filePath = normalizedSource.path || normalizedSource.source;
        if (!filePath) {
          throw new Error("File path is required for file source");
        }
        content = await this.loadFromFile(filePath);
        break;

      case "inline":
        const inlineContent =
          normalizedSource.content || normalizedSource.source;
        if (!inlineContent) {
          throw new Error("Content is required for inline source");
        }
        content = inlineContent;
        break;

      case "uri":
        const uri = normalizedSource.uri || normalizedSource.source;
        if (!uri) {
          throw new Error("URI is required for URI source");
        }
        content = await this.loadFromURI(uri);
        break;

      default:
        throw new Error(
          `Unsupported source type: ${normalizedSource.type}`
        );
    }

    // Parse the content using TurtleParser
    const parseOptions = normalizedSource.options || {};
    if (parseOptions && Object.keys(parseOptions).length > 0) {
      this.parser = new TurtleParser(parseOptions);
    }

    try {
      const result = await this.parser.parse(content);

      // Add subjects property for test compatibility
      const subjects = {};
      for (const triple of result.triples) {
        const subjectUri = triple.subject.value;
        if (!subjects[subjectUri]) {
          subjects[subjectUri] = {
            uri: subjectUri,
            properties: {}
          };
        }
        
        const predicateUri = triple.predicate.value;
        const simplePredicate = predicateUri.split(/[#\/]/).pop() || predicateUri;
        
        if (!subjects[subjectUri].properties[simplePredicate]) {
          subjects[subjectUri].properties[simplePredicate] = [];
        }
        
        subjects[subjectUri].properties[simplePredicate].push(triple.object.value);
      }
      
      const enrichedResult = {
        ...result,
        subjects
      };

      // Cache the result
      this.cacheResult(cacheKey, enrichedResult);

      // Return with success flag for test compatibility
      return {
        ...enrichedResult,
        success: true,
        source: cacheKey,
        error: undefined,
        errors: [],
        data: enrichedResult,
        metadata: {
          tripleCount: enrichedResult.triples.length,
          loadTime: enrichedResult.stats.parseTime,
          subjects: Object.keys(enrichedResult.subjects).length
        }
      };
    } catch (parseError) {
      console.warn('RDF Parse Error:', parseError.message, { cacheKey });
      
      // Return failure for malformed data with detailed error info
      const failureResult = {
        success: false,
        source: cacheKey,
        error: parseError.message,
        errors: [{
          type: 'parse_error',
          message: parseError.message,
          code: 'RDF_PARSE_ERROR',
          severity: 'error',
          line: parseError.line,
          column: parseError.column,
          originalError: parseError.originalError
        }],
        data: {
          triples: [],
          prefixes: {},
          stats: { tripleCount: 0, prefixCount: 0, subjectCount: 0, predicateCount: 0, parseTime: 0 },
          namedGraphs: [],
          subjects: {}
        },
        metadata: {
          tripleCount: 0,
          loadTime: 0,
          subjects: 0,
          errorDetails: {
            type: parseError.name || 'TurtleParseError',
            line: parseError.line,
            column: parseError.column
          }
        }
      };
      
      return failureResult;
    }
  }

  /**
   * Load from frontmatter configuration
   * @param {Object} frontmatter - Frontmatter configuration
   * @returns {Promise<RDFDataLoadResult>}
   */
  async loadFromFrontmatter(frontmatter) {
    const sources = Array.isArray(frontmatter.rdfSources)
      ? frontmatter.rdfSources
      : frontmatter.rdf ? (Array.isArray(frontmatter.rdf) ? frontmatter.rdf : [frontmatter.rdf]) : [];
      
    if (sources.length === 0) {
      return {
        success: false,
        error: 'No RDF sources specified',
        errors: ['No RDF sources specified'],
        data: { triples: [], prefixes: {}, stats: { tripleCount: 0, prefixCount: 0, subjectCount: 0, predicateCount: 0, parseTime: 0 }, namedGraphs: [] },
        metadata: { sources: 0 }
      };
    }
    
    const results = [];
    const errors = [];

    for (const source of sources) {
      try {
        const result = await this.loadFromSource(source);
        results.push(result);
      } catch (error) {
        console.error(`Failed to load source: ${error}`);
        errors.push(`Failed to load source: ${error.message}`);
      }
    }

    // Check if any sources loaded successfully
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) {
      return {
        success: false,
        error: 'All sources failed to load',
        errors,
        data: { triples: [], prefixes: {}, stats: { tripleCount: 0, prefixCount: 0, subjectCount: 0, predicateCount: 0, parseTime: 0 }, namedGraphs: [] },
        metadata: { sources: sources.length, sourceCount: sources.length }
      };
    }

    // Merge results
    const merged = {
      triples: successfulResults.flatMap((r) => r.triples || r.data.triples),
      prefixes: Object.assign({}, ...successfulResults.map((r) => r.prefixes || r.data.prefixes)),
      stats: {
        tripleCount: successfulResults.reduce((sum, r) => sum + ((r.stats || r.data.stats).tripleCount), 0),
        prefixCount: Object.keys(
          Object.assign({}, ...successfulResults.map((r) => r.prefixes || r.data.prefixes))
        ).length,
        subjectCount: 0,
        predicateCount: 0,
        parseTime: successfulResults.reduce((sum, r) => sum + ((r.stats || r.data.stats).parseTime), 0),
        namedGraphCount: 0,
      },
      namedGraphs: [],
    };

    // Extract variables if specified in frontmatter
    const variables = {};
    if (frontmatter.variables && Array.isArray(frontmatter.variables)) {
      // Extract variable values from RDF data
      for (const varName of frontmatter.variables) {
        // Try to find matching subjects
        const subjectUri = `http://example.org/${varName}`;
        const subject = merged.triples.find(t => t.subject.value.includes(varName));
        if (subject) {
          const subjectData = this.createSubjectData(merged.triples, subject.subject.value);
          variables[varName] = subjectData;
        }
      }
    }

    return {
      ...merged,
      success: true,
      source: "frontmatter",
      error: undefined,
      errors,
      data: merged,
      variables,
      metadata: { sources: sources.length, sourceCount: sources.length }
    };
  }

  /**
   * Create template context from parsed RDF data
   * @param {Object} data - Parsed RDF data
   * @param {Object} variables - Template variables
   * @returns {Object}
   */
  createTemplateContext(data, variables = {}) {
    const context = {
      subjects: {},
      prefixes: data.prefixes,
      triples: data.triples,
      stats: data.stats,
      $rdf: {
        subjects: {},
        getByType: (typeUri) => {
          const results = [];
          const expandedTypeUri = this.expandTypeUri(typeUri);
          
          for (const triple of data.triples) {
            if (triple.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
              const objectValue = triple.object.value;
              if (objectValue === expandedTypeUri || 
                  objectValue === typeUri ||
                  objectValue.endsWith(typeUri.split(':').pop() || typeUri)) {
                results.push({ uri: triple.subject.value });
              }
            }
          }
          return results;
        }
      },
      ...variables
    };

    // Group triples by subject for easier template access
    for (const triple of data.triples) {
      const subjectUri = triple.subject.value;
      if (!context.subjects[subjectUri]) {
        context.subjects[subjectUri] = {
          uri: subjectUri,
          properties: {},
        };
      }

      // Also add to $rdf.subjects
      if (!context.$rdf.subjects[subjectUri]) {
        context.$rdf.subjects[subjectUri] = {
          uri: subjectUri,
          properties: {},
        };
      }

      const predicateUri = triple.predicate.value;
      const simplePredicate = predicateUri.split(/[#/]/).pop() || predicateUri;

      if (!context.subjects[subjectUri].properties[simplePredicate]) {
        context.subjects[subjectUri].properties[simplePredicate] = [];
      }

      if (!context.$rdf.subjects[subjectUri].properties[predicateUri]) {
        context.$rdf.subjects[subjectUri].properties[predicateUri] = [];
      }

      context.subjects[subjectUri].properties[simplePredicate].push(
        triple.object.value
      );
      context.$rdf.subjects[subjectUri].properties[predicateUri].push(
        triple.object
      );
    }

    return context;
  }

  /**
   * Load RDF data from a file
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>}
   */
  async loadFromFile(filePath) {
    try {
      return readFileSync(filePath, "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to read RDF file ${filePath}: ${error.message}`
      );
    }
  }

  /**
   * Load RDF data from a URI (HTTP/HTTPS)
   * @param {string} uri - URI to load from
   * @returns {Promise<string>}
   */
  async loadFromURI(uri) {
    // Validate URI format
    try {
      new URL(uri);
    } catch (error) {
      throw new Error(`Invalid URI format: ${uri}`);
    }
    
    const maxRetries = this.options.maxRetries || 3;
    const httpTimeout = this.options.httpTimeout || 30000;
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), httpTimeout);
        
        const response = await fetch(uri, {
          headers: {
            'Accept': 'text/turtle, application/rdf+xml, text/n3, application/n-triples, application/ld+json, application/trig',
            'User-Agent': 'Unjucks-RDF-Loader/1.0',
          },
          signal: controller.signal,
          redirect: 'follow',
          timeout: httpTimeout
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        const content = await response.text();
        
        // Validate content is not empty
        if (!content || content.trim().length === 0) {
          throw new Error(`Empty response from URI: ${uri}`);
        }
        
        // Log successful fetch for debugging
        console.debug(`Successfully fetched RDF from ${uri}, content-type: ${contentType}, size: ${content.length}`);
        
        return content;
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt + 1}/${maxRetries} failed for URI ${uri}:`, error.message);
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff: wait 1s, 2s, 4s...
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    const errorMessage = lastError.name === 'AbortError' 
      ? `Request timeout after ${httpTimeout}ms for URI: ${uri}`
      : `Failed to fetch URI ${uri} after ${maxRetries} attempts: ${lastError.message}`;
    throw new Error(errorMessage);
  }

  /**
   * Generate a cache key for a data source
   * @param {RDFDataSource} source - Data source
   * @returns {string}
   */
  generateCacheKey(source) {
    const parts = [source.type];

    switch (source.type) {
      case "file":
        const filePath = source.path || source.source || "";
        parts.push(filePath);
        break;
      case "inline":
        // For inline content, hash the content to avoid very long keys
        const content = source.content || source.source || "";
        const hash = this.simpleHash(content);
        parts.push(`inline-${hash}`);
        break;
      case "uri":
        const uri = source.uri || source.source || "";
        parts.push(uri);
        break;
    }

    // Include options in cache key if present
    if (source.options) {
      const optionsHash = this.simpleHash(JSON.stringify(source.options));
      parts.push(`opts-${optionsHash}`);
    }

    return parts.join(":");
  }

  /**
   * Simple hash function for generating cache keys
   * @param {string} str - String to hash
   * @returns {string}
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache a parsing result
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   */
  cacheResult(key, data) {
    // Enforce cache size limit
    if (this.cache.size >= this.options.maxCacheSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: this.getDeterministicTimestamp(),
      ttl: this.options.defaultTTL,
    });
  }

  /**
   * Check if a cache entry is expired
   * @param {CacheEntry} entry - Cache entry
   * @returns {boolean}
   */
  isExpired(entry) {
    return this.getDeterministicTimestamp() - entry.timestamp > entry.ttl;
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  cleanupExpiredEntries() {
    const now = this.getDeterministicTimestamp();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Start the cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.options.cleanupInterval);

    // Ensure cleanup timer doesn't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop the cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Get cache statistics
   * @returns {{size: number, maxSize: number, hitCount: number, missCount: number}}
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      hitCount: 0, // Could be tracked if needed
      missCount: 0, // Could be tracked if needed
    };
  }

  /**
   * Load multiple sources concurrently
   * @param {RDFDataSource[]} sources - Array of data sources
   * @returns {Promise<Object[]>}
   */
  async loadFromSources(sources) {
    return Promise.all(sources.map((source) => this.loadFromSource(source)));
  }

  /**
   * Load and merge multiple sources into a single result
   * @param {RDFDataSource[]} sources - Array of data sources
   * @returns {Promise<Object>}
   */
  async loadAndMerge(sources) {
    const results = await this.loadFromSources(sources);

    // Merge all results
    const mergedTriples = results.flatMap((result) => result.triples);
    const mergedPrefixes = Object.assign(
      {},
      ...results.map((result) => result.prefixes)
    );
    const mergedNamedGraphs = Array.from(
      new Set(results.flatMap((result) => result.namedGraphs || []))
    );

    return {
      triples: mergedTriples,
      prefixes: mergedPrefixes,
      namedGraphs: mergedNamedGraphs,
      stats: {
        tripleCount: mergedTriples.length,
        namedGraphCount: mergedNamedGraphs.length,
        prefixCount: Object.keys(mergedPrefixes).length,
        subjectCount: new Set(mergedTriples.map((t) => t.subject.value)).size,
        predicateCount: new Set(mergedTriples.map((t) => t.predicate.value))
          .size,
        parseTime: 0,
      },
    };
  }

  /**
   * Create subject data object from triples
   * @param {Array} triples - All triples
   * @param {string} subjectUri - Subject URI
   * @returns {Object}
   */
  createSubjectData(triples, subjectUri) {
    const subjectTriples = triples.filter(t => t.subject.value === subjectUri);
    const data = { uri: subjectUri };
    
    for (const triple of subjectTriples) {
      const predicate = triple.predicate.value;
      const localName = predicate.split(/[#/]/).pop() || predicate;
      
      if (!data[localName]) {
        data[localName] = [];
      }
      
      data[localName].push(triple.object.value);
    }
    
    // Simplify single-value arrays
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length === 1) {
        data[key] = value[0];
      }
    }
    
    return data;
  }

  /**
   * Get cache statistics with additional metadata
   * @returns {Object}
   */
  getCacheStats() {
    const keys = Array.from(this.cache.keys());
    const now = this.getDeterministicTimestamp();
    let expiredCount = 0;
    let totalSize = 0;
    
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry) {
        if (now - entry.timestamp > entry.ttl) {
          expiredCount++;
        }
        totalSize += JSON.stringify(entry).length;
      }
    }
    
    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      expiredEntries: expiredCount,
      totalSizeBytes: totalSize,
      keys: keys.slice(0, 10), // Only show first 10 keys to avoid spam
      cacheEnabled: this.options.cacheEnabled,
      defaultTTL: this.options.defaultTTL,
      hitCount: this.hitCount || 0,
      missCount: this.missCount || 0,
      hitRate: this.hitCount && this.missCount ? 
        (this.hitCount / (this.hitCount + this.missCount) * 100).toFixed(2) + '%' : 'N/A'
    };
  }

  /**
   * Clean up cache and return number of items removed
   * @returns {number}
   */
  cleanupCache() {
    const initialSize = this.cache.size;
    this.cleanupExpiredEntries();
    return initialSize - this.cache.size;
  }

  /**
   * Expand type URI using common prefixes
   * @param {string} typeUri - Type URI to expand
   * @returns {string}
   */
  expandTypeUri(typeUri) {
    const prefixes = {
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'owl': 'http://www.w3.org/2002/07/owl#',
      'foaf': 'http://xmlns.com/foaf/0.1/',
      'schema': 'http://schema.org/',
      'ex': 'http://example.org/'
    };
    
    if (typeUri.includes(':') && !typeUri.startsWith('http')) {
      const [prefix, localName] = typeUri.split(':', 2);
      const namespace = prefixes[prefix];
      if (namespace) {
        return namespace + localName;
      }
    }
    
    return typeUri;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopCleanupTimer();
    this.clearCache();
  }
}

/**
 * Convenience function to load RDF data from a source
 * @param {RDFDataSource} source - Data source
 * @param {RDFDataLoaderOptions} [options] - Loader options
 * @returns {Promise<Object>}
 */
export async function loadRDFData(source, options) {
  const loader = new RDFDataLoader(options);
  return loader.loadFromSource(source);
}

/**
 * Convenience function to load RDF data from multiple sources
 * @param {RDFDataSource[]} sources - Data sources
 * @param {RDFDataLoaderOptions} [options] - Loader options
 * @returns {Promise<Object[]>}
 */
export async function loadMultipleRDFData(sources, options) {
  const loader = new RDFDataLoader(options);
  return loader.loadFromSources(sources);
}

export default RDFDataLoader;