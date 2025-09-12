/**
 * KGEN Enhanced Template Engine
 * 
 * Migrated from UNJUCKS with enhanced filter pipeline, RDF data loading,
 * and deterministic rendering capabilities. Removes non-deterministic elements
 * and adds content-addressed caching for consistent builds.
 */

import nunjucks from 'nunjucks';
import path from 'path';
import crypto from 'crypto';
import { existsSync } from 'fs';
import { FrontmatterParser } from './frontmatter-parser.js';
import { createDeterministicFilters } from './deterministic-filters.js';
import { RDFFilters } from './rdf-filters.js';

/**
 * Enhanced Template Engine for KGEN with Deterministic Rendering
 */
export class TemplateEngine {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || '_templates',
      autoescape: false, // Disabled for code generation
      throwOnUndefined: options.throwOnUndefined || false,
      trimBlocks: true, // Enabled for cleaner output
      lstripBlocks: true, // Enabled for cleaner output
      enableCache: options.enableCache !== false,
      enableFilters: options.enableFilters !== false,
      enableRDF: options.enableRDF || false,
      deterministic: options.deterministic !== false,
      contentAddressing: options.contentAddressing !== false,
      debug: options.debug || false,
      ...options
    };

    // Initialize Nunjucks environment with enhanced settings
    this.env = this.createNunjucksEnvironment();
    
    // Initialize frontmatter parser
    this.frontmatterParser = new FrontmatterParser(false); // Disable semantic validation for performance
    
    // Initialize filter systems
    this.filterCatalog = null;
    this.rdfFilters = null;
    
    if (this.options.enableFilters) {
      this.initializeFilterPipeline();
    }
    
    // Initialize content-addressed caching
    this.templateCache = new Map();
    this.renderCache = new Map();
    
    // Track comprehensive statistics for deterministic behavior verification
    this.stats = {
      renders: 0,
      errors: 0,
      totalRenderTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      templatesRendered: new Set(),
      variablesUsed: new Set(),
      filtersUsed: new Set(),
      deterministicHashes: new Map()
    };
  }

  /**
   * Create and configure Nunjucks environment for deterministic rendering
   */
  createNunjucksEnvironment() {
    // Create file system loader
    const loader = new nunjucks.FileSystemLoader(this.options.templatesDir, {
      watch: false, // Disable watching for consistent behavior
      noCache: !this.options.enableCache
    });

    // Create environment with optimized settings
    const env = new nunjucks.Environment(loader, {
      autoescape: this.options.autoescape,
      throwOnUndefined: this.options.throwOnUndefined,
      trimBlocks: this.options.trimBlocks,
      lstripBlocks: this.options.lstripBlocks
    });

    // Add deterministic global functions
    this.addGlobalFunctions(env);

    return env;
  }

  /**
   * Initialize the enhanced filter pipeline with deterministic behavior
   */
  initializeFilterPipeline() {
    try {
      // Create deterministic filter collection
      this.filterCatalog = createDeterministicFilters({
        enableCache: this.options.enableCache,
        deterministic: this.options.deterministic
      });
      
      // Register deterministic filters with Nunjucks
      this.registerFiltersWithNunjucks();
      
      // Initialize RDF filters if enabled
      if (this.options.enableRDF) {
        this.rdfFilters = new RDFFilters({
          prefixes: this.options.rdfPrefixes,
          baseUri: this.options.baseUri
        });
        this.registerRDFFilters();
      }
      
      // Add filter usage tracking
      this.wrapFiltersForTracking();
      
    } catch (error) {
      console.error('Failed to initialize filter pipeline:', error);
      if (this.options.throwOnError) {
        throw new Error(`Filter pipeline initialization failed: ${error.message}`);
      }
    }
  }
  
  /**
   * Register deterministic filters with Nunjucks environment
   */
  registerFiltersWithNunjucks() {
    if (!this.filterCatalog) return;
    
    for (const [name, filter] of Object.entries(this.filterCatalog)) {
      this.env.addFilter(name, (...args) => {
        this.stats.filtersUsed.add(name);
        return filter(...args);
      });
    }
  }
  
  /**
   * Register RDF filters with Nunjucks environment
   */
  registerRDFFilters() {
    if (!this.rdfFilters) return;
    
    const filters = this.rdfFilters.getAllFilters();
    for (const [name, filter] of Object.entries(filters)) {
      this.env.addFilter(name, (...args) => {
        this.stats.filtersUsed.add(name);
        return filter(...args);
      });
    }
  }
  
  /**
   * Wrap filters for usage tracking and performance monitoring
   */
  wrapFiltersForTracking() {
    const originalAddFilter = this.env.addFilter.bind(this.env);
    
    this.env.addFilter = (name, fn) => {
      const wrappedFn = (...args) => {
        this.stats.filtersUsed.add(name);
        return fn(...args);
      };
      return originalAddFilter(name, wrappedFn);
    };
  }

  /**
   * Add global functions optimized for deterministic code generation
   */
  addGlobalFunctions(env) {
    // Add deterministic timestamp (can be overridden with fixed value)
    env.addGlobal('timestamp', () => {
      return this.options.fixedTimestamp || this.getDeterministicDate().toISOString();
    });
    
    // Add deterministic environment detection
    env.addGlobal('env', {
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',
      nodeVersion: process.version,
      platform: process.platform,
      kgenVersion: '2.0.0' // Fixed version for deterministic builds
    });

    // Add conditional rendering helper
    env.addGlobal('renderIf', (condition, content) => {
      return condition ? content : '';
    });

    // Add template existence check
    env.addGlobal('templateExists', (templatePath) => {
      return this.templateExists(templatePath);
    });
    
    // Add template inclusion with error handling
    env.addGlobal('includeTemplate', (templatePath, context = {}) => {
      try {
        return this.render(templatePath, context);
      } catch (error) {
        console.warn(`Failed to include template ${templatePath}:`, error.message);
        return `<!-- Template inclusion failed: ${templatePath} -->`;
      }
    });
    
    // Add dynamic filter application
    env.addGlobal('applyFilter', (value, filterName, ...args) => {
      if (!this.filterCatalog || !this.filterCatalog[filterName]) {
        console.warn(`Unknown filter: ${filterName}`);
        return value;
      }
      
      this.stats.filtersUsed.add(filterName);
      return this.filterCatalog[filterName](value, ...args);
    });
    
    // Add filter chain application
    env.addGlobal('chain', (value, ...filters) => {
      return filters.reduce((result, filterSpec) => {
        let filterName, args = [];
        
        if (typeof filterSpec === 'string') {
          filterName = filterSpec;
        } else if (Array.isArray(filterSpec)) {
          [filterName, ...args] = filterSpec;
        } else {
          return result;
        }
        
        if (this.filterCatalog && this.filterCatalog[filterName]) {
          this.stats.filtersUsed.add(filterName);
          return this.filterCatalog[filterName](result, ...args);
        }
        
        return result;
      }, value);
    });
    
    // Add deterministic hash generation
    env.addGlobal('contentHash', (content) => {
      return this.createContentHash(content);
    });
  }

  /**
   * Parse template content and extract frontmatter
   * @param {string} templateContent - Raw template content
   * @returns {Promise<Object>} Parsed template with frontmatter and content
   */
  async parseTemplate(templateContent) {
    const result = await this.frontmatterParser.parse(templateContent, false);
    
    // Extract variables from template content for dependency tracking
    const variables = this.extractVariables(result.content);
    
    return {
      ...result,
      variables: Array.from(variables)
    };
  }

  /**
   * Extract variable names from template content
   * @param {string} templateContent - Template content to analyze
   * @returns {Set<string>} Set of variable names used in template
   */
  extractVariables(templateContent) {
    const variables = new Set();
    
    // Match Nunjucks variables: {{ variable }}, {{ variable.property }}, {{ variable | filter }}
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s*\|.*?)?\s*\}\}/g;
    let match;
    
    while ((match = variablePattern.exec(templateContent)) !== null) {
      const varName = match[1].split('.')[0]; // Get root variable name
      variables.add(varName);
    }
    
    // Match Nunjucks control structures: {% if variable %}, {% for item in items %}
    const controlPattern = /\{\%\s*(?:if|elif)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    const forPattern = /\{\%\s*for\s+[a-zA-Z_][a-zA-Z0-9_.]*\s+in\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    
    // Handle if/elif conditions
    while ((match = controlPattern.exec(templateContent)) !== null) {
      const varName = match[1].split('.')[0];
      variables.add(varName);
    }
    
    // Handle for loops - extract the iterable variable
    while ((match = forPattern.exec(templateContent)) !== null) {
      const iterableVar = match[1].split('.')[0];
      variables.add(iterableVar);
    }
    
    return variables;
  }

  /**
   * Validate template dependencies
   * @param {Array<string>} templateVariables - Variables used in template
   * @param {Object} context - Available context variables
   * @returns {Object} Validation result
   */
  validateDependencies(templateVariables, context) {
    const missing = [];
    const available = Object.keys(context);
    
    for (const variable of templateVariables) {
      if (!(variable in context)) {
        missing.push(variable);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      available,
      used: templateVariables
    };
  }

  /**
   * Render template with context - core rendering method
   * @param {string} templatePath - Path to template file
   * @param {Object} context - Template context variables
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Rendered result with metadata
   */
  async render(templatePath, context = {}, options = {}) {
    const startTime = performance.now();
    this.stats.renders++;

    try {
      // Read and parse template
      const templateContent = this.env.getTemplate(templatePath).tmplStr;
      const parsed = await this.parseTemplate(templateContent);
      
      // Validate dependencies if requested
      let validation = null;
      if (options.validateDependencies) {
        validation = this.validateDependencies(parsed.variables, context);
        if (!validation.valid && options.throwOnMissingVariables) {
          throw new Error(`Missing template variables: ${validation.missing.join(', ')}`);
        }
      }
      
      // Track variables used
      parsed.variables.forEach(v => this.stats.variablesUsed.add(v));
      
      // Create deterministic context
      const renderContext = this.createRenderContext(context, parsed.frontmatter, templatePath);
      
      // Render only the template content (without frontmatter)
      const renderedContent = this.env.renderString(parsed.content, renderContext);
      
      // Process output path if defined in frontmatter
      let outputPath = null;
      if (parsed.frontmatter.to) {
        outputPath = this.env.renderString(parsed.frontmatter.to, renderContext);
      }
      
      // Calculate render time
      const renderTime = performance.now() - startTime;
      this.stats.totalRenderTime += renderTime;
      this.stats.templatesRendered.add(templatePath);
      
      return {
        content: renderedContent,
        frontmatter: parsed.frontmatter,
        outputPath,
        metadata: {
          renderTime,
          templatePath,
          variablesUsed: parsed.variables,
          validation
        }
      };
      
    } catch (error) {
      this.stats.errors++;
      const renderTime = performance.now() - startTime;
      
      if (options.throwOnError !== false) {
        throw new Error(`Template rendering failed for ${templatePath}: ${error.message}`);
      }
      
      return {
        content: `<!-- Template rendering error: ${error.message} -->`,
        frontmatter: {},
        outputPath: null,
        metadata: {
          renderTime,
          templatePath,
          error: error.message,
          variablesUsed: []
        }
      };
    }
  }

  /**
   * Render template from string content
   * @param {string} templateString - Template content as string
   * @param {Object} context - Template context variables
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Rendered result
   */
  async renderString(templateString, context = {}, options = {}) {
    const startTime = performance.now();
    this.stats.renders++;

    try {
      // Parse template content
      const parsed = await this.parseTemplate(templateString);
      
      // Create render context
      const renderContext = this.createRenderContext(context, parsed.frontmatter, 'inline-template');
      
      // Render content
      const renderedContent = this.env.renderString(parsed.content, renderContext);
      
      const renderTime = performance.now() - startTime;
      this.stats.totalRenderTime += renderTime;
      
      return {
        content: renderedContent,
        frontmatter: parsed.frontmatter,
        metadata: {
          renderTime,
          variablesUsed: parsed.variables
        }
      };
      
    } catch (error) {
      this.stats.errors++;
      
      if (options.throwOnError !== false) {
        throw new Error(`String template rendering failed: ${error.message}`);
      }
      
      return {
        content: `<!-- Template rendering error: ${error.message} -->`,
        frontmatter: {},
        metadata: {
          error: error.message
        }
      };
    }
  }

  /**
   * Create deterministic render context with enhanced metadata
   * @param {Object} userContext - User-provided context
   * * @param {Object} frontmatter - Template frontmatter
   * @returns {Object} Enhanced context for rendering
   */
  createRenderContext(userContext, frontmatter, templatePath) {
    // Create deterministic timestamp if not provided (sorted for consistency)
    const timestamp = this.options.fixedTimestamp || 
                     userContext.timestamp || 
                     this.getDeterministicDate().toISOString();
    
    // Create deterministic context with sorted keys
    const sortedContext = this.sortObjectKeys(userContext);
    
    return {
      ...sortedContext,
      timestamp,
      frontmatter: this.sortObjectKeys(frontmatter),
      _kgen: {
        version: '2.0.0',
        renderTime: timestamp,
        deterministic: this.options.deterministic,
        templatePath,
        contentAddressing: this.options.contentAddressing,
        filtersEnabled: this.options.enableFilters,
        rdfEnabled: this.options.enableRDF,
        filterCatalog: this.filterCatalog ? Object.keys(this.filterCatalog).sort() : []
      }
    };
  }
  
  /**
   * Sort object keys recursively for deterministic output
   * @param {any} obj - Object to sort
   * @returns {any} Object with sorted keys
   */
  sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }
    
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj = {};
    
    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObjectKeys(obj[key]);
    }
    
    return sortedObj;
  }
  
  /**
   * Create content-addressed hash for caching and deterministic builds
   * @param {string} content - Content to hash
   * @returns {string} SHA-256 hash
   */
  createContentHash(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
  
  /**
   * Get or create cached template render
   * @param {string} cacheKey - Cache key
   * @param {Function} renderFn - Function to execute if cache miss
   * @returns {any} Cached or fresh result
   */
  getCachedRender(cacheKey, renderFn) {
    if (!this.options.enableCache) {
      return renderFn();
    }
    
    if (this.renderCache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.renderCache.get(cacheKey);
    }
    
    this.stats.cacheMisses++;
    const result = renderFn();
    this.renderCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Check if a template exists
   * @param {string} templatePath - Path to template
   * @returns {boolean} True if template exists
   */
  templateExists(templatePath) {
    try {
      const fullPath = path.join(this.options.templatesDir, templatePath);
      return existsSync(fullPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get operation mode from frontmatter
   * @param {Object} frontmatter - Template frontmatter
   * @returns {Object} Operation mode configuration
   */
  getOperationMode(frontmatter) {
    return this.frontmatterParser.getOperationMode(frontmatter);
  }

  /**
   * Check if generation should be skipped
   * @param {Object} frontmatter - Template frontmatter
   * @param {Object} variables - Template variables
   * @returns {boolean} True if should skip
   */
  shouldSkip(frontmatter, variables) {
    return this.frontmatterParser.shouldSkip(frontmatter, variables);
  }

  /**
   * Clear template cache for deterministic rendering
   */
  clearCache() {
    if (this.env.loaders) {
      this.env.loaders.forEach(loader => {
        if (loader.cache) {
          loader.cache = {};
        }
      });
    }
  }

  /**
   * Get comprehensive rendering statistics
   * @returns {Object} Detailed rendering statistics
   */
  getStats() {
    const baseStats = {
      renders: this.stats.renders,
      errors: this.stats.errors,
      errorRate: this.stats.errors / Math.max(this.stats.renders, 1),
      totalRenderTime: this.stats.totalRenderTime,
      avgRenderTime: this.stats.totalRenderTime / Math.max(this.stats.renders, 1),
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      cacheHitRate: this.stats.cacheHits / Math.max(this.stats.cacheHits + this.stats.cacheMisses, 1),
      templatesRendered: Array.from(this.stats.templatesRendered).sort(),
      variablesUsed: Array.from(this.stats.variablesUsed).sort(),
      filtersUsed: Array.from(this.stats.filtersUsed).sort(),
      uniqueTemplates: this.stats.templatesRendered.size,
      uniqueVariables: this.stats.variablesUsed.size,
      uniqueFilters: this.stats.filtersUsed.size
    };
    
    return baseStats;
  }

  /**
   * Reset statistics and caches for clean testing
   */
  resetStats() {
    this.stats = {
      renders: 0,
      errors: 0,
      totalRenderTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      templatesRendered: new Set(),
      variablesUsed: new Set(),
      filtersUsed: new Set(),
      deterministicHashes: new Map()
    };
    
    // Clear caches
    this.templateCache.clear();
    this.renderCache.clear();
  }
  
  /**
   * Update RDF store with new triples (if RDF is enabled)
   * @param {Array} triples - RDF triples to load
   */
  updateRDFStore(triples) {
    if (this.rdfFilters && Array.isArray(triples)) {
      this.rdfFilters.updateStore(triples);
    }
  }
  
  /**
   * Clear RDF store
   */
  clearRDFStore() {
    if (this.rdfFilters) {
      this.rdfFilters.clearStore();
    }
  }
  
  /**
   * Get available filters catalog
   * @returns {Object} Available filters by category
   */
  getAvailableFilters() {
    const filters = {
      deterministic: this.filterCatalog ? Object.keys(this.filterCatalog).sort() : [],
      rdf: this.rdfFilters ? Object.keys(this.rdfFilters.getAllFilters()).sort() : [],
      total: 0
    };
    
    filters.total = filters.deterministic.length + filters.rdf.length;
    return filters;
  }
  
  /**
   * Add custom filter with deterministic behavior
   * @param {string} name - Filter name
   * @param {Function} fn - Filter function
   * @param {Object} options - Filter options
   */
  addFilter(name, fn, options = {}) {
    // Wrap filter to ensure deterministic behavior
    const deterministicFn = (...args) => {
      this.stats.filtersUsed.add(name);
      
      // Sort object arguments for consistency
      const sortedArgs = args.map(arg => 
        typeof arg === 'object' && arg !== null ? this.sortObjectKeys(arg) : arg
      );
      
      return fn(...sortedArgs);
    };
    
    this.env.addFilter(name, deterministicFn);
    
    if (!this.filterCatalog) {
      this.filterCatalog = {};
    }
    this.filterCatalog[name] = deterministicFn;
  }
  
  /**
   * Clear all caches for deterministic rendering
   */
  clearCache() {
    // Clear Nunjucks cache
    if (this.env.loaders) {
      this.env.loaders.forEach(loader => {
        if (loader.cache) {
          loader.cache = {};
        }
      });
    }
    
    // Clear internal caches
    this.templateCache.clear();
    this.renderCache.clear();
    
    // Clear RDF cache if available
    if (this.rdfFilters) {
      this.rdfFilters.queryCache.clear();
    }
  }
  
  /**
   * Get comprehensive environment information
   * @returns {Object} Environment details
   */
  getEnvironment() {
    return {
      templatesDir: this.options.templatesDir,
      options: this.sortObjectKeys(this.options),
      nunjucksVersion: nunjucks.version || 'unknown',
      kgenVersion: '2.0.0',
      deterministic: this.options.deterministic,
      filtersEnabled: this.options.enableFilters,
      rdfEnabled: this.options.enableRDF,
      contentAddressing: this.options.contentAddressing,
      availableFilters: this.getAvailableFilters(),
      cacheSize: {
        templates: this.templateCache.size,
        renders: this.renderCache.size
      }
    };
  }
}

/**
 * Factory function to create a KGEN template engine instance
 * @param {Object} options - Engine configuration options
 * @returns {TemplateEngine} Template engine instance
 */
export function createTemplateEngine(options = {}) {
  return new TemplateEngine(options);
}

export default TemplateEngine;