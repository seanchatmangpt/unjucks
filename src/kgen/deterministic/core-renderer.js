/**
 * KGEN Deterministic Renderer - Core Implementation
 * 
 * Provides byte-for-byte identical output for same inputs by:
 * - Removing all non-deterministic elements
 * - Consistent object key sorting
 * - Hash-based unique identifiers
 * - Content-addressed caching
 * - Reproducible template processing
 */

import crypto from 'crypto';
import nunjucks from 'nunjucks';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { consola } from 'consola';
// Fallback gray-matter implementation for missing dependency
const grayMatter = {
  default: (content) => {
    // Simple frontmatter parser fallback
    if (content.startsWith('---\n')) {
      const endIndex = content.indexOf('\n---\n', 4);
      if (endIndex !== -1) {
        const frontmatter = content.slice(4, endIndex);
        const body = content.slice(endIndex + 5);
        try {
          const data = JSON.parse(`{${frontmatter.replace(/(\w+):\s*(.+)/g, '"$1": "$2"').replace(/"/g, '"')}}`);
          return { data, content: body };
        } catch {
          return { data: {}, content };
        }
      }
    }
    return { data: {}, content };
  }
};

export class DeterministicRenderer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Core determinism settings
      staticBuildTime: options.staticBuildTime || '2024-01-01T00:00:00.000Z',
      enableCaching: options.enableCaching !== false,
      cacheDir: options.cacheDir || '.kgen/cache',
      
      // Template settings
      templatesDir: options.templatesDir || '_templates',
      outputDir: options.outputDir || './generated',
      
      // Determinism enforcement
      sortObjectKeys: options.sortObjectKeys !== false,
      removeTimestamps: options.removeTimestamps !== false,
      useContentAddressing: options.useContentAddressing !== false,
      
      // RDF integration
      rdfNamespaces: options.rdfNamespaces || {},
      enableSemanticEnrichment: options.enableSemanticEnrichment === true,
      
      // Error handling
      strictMode: options.strictMode !== false,
      ...options
    };
    
    this.logger = consola.withTag('deterministic-renderer');
    this.cache = new Map();
    this.environment = null;
    
    // Content hash mapping for reproducible builds
    this.contentHashMap = new Map();
    
    // Initialize deterministic Nunjucks environment
    this._initializeEnvironment();
  }
  
  /**
   * Initialize deterministic Nunjucks environment with custom filters
   */
  _initializeEnvironment() {
    // Create fresh environment to avoid global state pollution
    this.environment = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(this.config.templatesDir, {
        watch: false, // Disable file watching for determinism
        noCache: !this.config.enableCaching
      }),
      {
        autoescape: false,
        trimBlocks: true,
        lstripBlocks: true
      }
    );
    
    // Register deterministic filters
    this._registerDeterministicFilters();
    
    // Register deterministic globals
    this._registerDeterministicGlobals();
  }
  
  /**
   * Register deterministic filters that replace non-deterministic ones
   */
  _registerDeterministicFilters() {
    // Register filters using addFilter method instead of accessing getFilters()
    
    // Replace date filter with static build time
    this.environment.addFilter('date', (date, format) => {
      if (!date || date === 'now') {
        date = this.config.staticBuildTime;
      }
      return this._formatDate(date, format);
    });
    
    // Replace random() with deterministic hash-based generation
    this.environment.addFilter('random', (seed = '') => {
      const hash = crypto.createHash('sha256')
        .update(seed.toString())
        .digest('hex');
      return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
    });
    
    // Hash-based unique ID generator
    this.environment.addFilter('hash', (input, length = 8) => {
      if (typeof input === 'object') {
        input = JSON.stringify(this._sortObjectKeys(input));
      }
      return crypto.createHash('sha256')
        .update(input.toString())
        .digest('hex')
        .substring(0, length);
    });
    
    // Content-addressed identifier
    this.environment.addFilter('contentId', (input) => {
      const content = typeof input === 'object' 
        ? JSON.stringify(this._sortObjectKeys(input))
        : input.toString();
      return crypto.createHash('sha256').update(content).digest('hex');
    });
    
    // Deterministic slug generation
    this.environment.addFilter('slug', (input) => {
      return input.toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    });
    
    // Sort array deterministically
    this.environment.addFilter('sort', (array, key) => {
      if (!Array.isArray(array)) return array;
      
      return [...array].sort((a, b) => {
        const aVal = key ? a[key] : a;
        const bVal = key ? b[key] : b;
        
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });
    });
    
    // Sort object keys
    this.environment.addFilter('sortKeys', (obj) => {
      return this._sortObjectKeys(obj);
    });
    
    // Remove non-deterministic metadata
    this.environment.addFilter('stripMetadata', (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      const stripped = { ...obj };
      delete stripped.createdAt;
      delete stripped.updatedAt;
      delete stripped.timestamp;
      delete stripped.id; // Remove auto-generated IDs
      
      return this._sortObjectKeys(stripped);
    });
    
    // Canonical JSON stringification
    this.environment.addFilter('canonical', (obj) => {
      return JSON.stringify(this._sortObjectKeys(obj), null, 2);
    });
    
    // RDF namespace resolution
    this.environment.addFilter('namespace', (uri) => {
      for (const [prefix, namespace] of Object.entries(this.config.rdfNamespaces)) {
        if (uri.startsWith(namespace)) {
          return uri.replace(namespace, `${prefix}:`);
        }
      }
      return uri;
    });
    
    // Base64 encoding (deterministic)
    this.environment.addFilter('base64', (input) => {
      return Buffer.from(input.toString()).toString('base64');
    });
    
    // Semantic context enrichment
    this.environment.addFilter('semantic', (input, context = {}) => {
      if (!this.config.enableSemanticEnrichment) {
        return input;
      }
      
      return this._enrichWithSemanticContext(input, context);
    });
  }
  
  /**
   * Register deterministic global variables
   */
  _registerDeterministicGlobals() {
    // Register global variables using addGlobal method
    
    // Static build information
    this.environment.addGlobal('BUILD_TIME', this.config.staticBuildTime);
    this.environment.addGlobal('BUILD_HASH', crypto.createHash('sha256')
      .update(this.config.staticBuildTime)
      .digest('hex').substring(0, 8));
    
    // Deterministic utilities
    this.environment.addGlobal('hash', (input) => crypto.createHash('sha256')
      .update(input.toString())
      .digest('hex'));
    
    this.environment.addGlobal('uuid', (namespace = 'default') => {
      return crypto.createHash('sha256')
        .update(`uuid-${namespace}-${this.config.staticBuildTime}`)
        .digest('hex').substring(0, 32);
    });
  }
  
  /**
   * Render template with deterministic output
   */
  async render(templatePath, context = {}, options = {}) {
    try {
      // Normalize and validate input
      const normalizedContext = this._normalizeContext(context);
      const templateKey = this._getTemplateKey(templatePath, normalizedContext);
      
      // Check cache for existing render
      if (this.config.enableCaching && this.cache.has(templateKey)) {
        this.logger.debug(`Cache hit for template: ${templatePath}`);
        return this.cache.get(templateKey);
      }
      
      // Load and parse template with frontmatter
      const templateContent = await this._loadTemplate(templatePath);
      const { data: frontmatter, content: template } = grayMatter.default(templateContent);
      
      // Merge frontmatter with context
      const enrichedContext = this._mergeContext(normalizedContext, frontmatter);
      
      // Render template
      const rendered = this.environment.renderString(template, enrichedContext);
      
      // Post-process for determinism
      const deterministicOutput = this._postProcessForDeterminism(rendered, options);
      
      // Create render result
      const result = {
        content: deterministicOutput,
        contentHash: crypto.createHash('sha256').update(deterministicOutput).digest('hex'),
        templatePath,
        frontmatter,
        context: enrichedContext,
        renderedAt: this.config.staticBuildTime,
        deterministic: true,
        metadata: {
          templateHash: crypto.createHash('sha256').update(template).digest('hex'),
          contextHash: crypto.createHash('sha256').update(JSON.stringify(enrichedContext)).digest('hex'),
          engineVersion: this._getEngineVersion()
        }
      };
      
      // Cache result
      if (this.config.enableCaching) {
        this.cache.set(templateKey, result);
      }
      
      this.emit('template:rendered', { templatePath, result });
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to render template ${templatePath}:`, error);
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
   * Render multiple templates in batch
   */
  async renderBatch(templates, globalContext = {}) {
    const results = [];
    
    for (const templateConfig of templates) {
      const { path: templatePath, context = {}, options = {} } = templateConfig;
      const mergedContext = { ...globalContext, ...context };
      
      const result = await this.render(templatePath, mergedContext, options);
      results.push({
        template: templatePath,
        ...result
      });
    }
    
    return {
      templates: results,
      batchHash: crypto.createHash('sha256')
        .update(JSON.stringify(results.map(r => r.contentHash)))
        .digest('hex'),
      totalTemplates: results.length,
      successfulRenders: results.filter(r => !r.error).length,
      renderedAt: this.config.staticBuildTime
    };
  }
  
  /**
   * Validate template reproducibility
   */
  async validateReproducibility(templatePath, context = {}, iterations = 3) {
    const renders = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = await this.render(templatePath, context);
      renders.push(result);
    }
    
    // Check if all renders are identical
    const firstHash = renders[0].contentHash;
    const allIdentical = renders.every(r => r.contentHash === firstHash);
    
    return {
      reproducible: allIdentical,
      iterations,
      contentHash: firstHash,
      variations: allIdentical ? 0 : new Set(renders.map(r => r.contentHash)).size,
      renders: renders.map(r => ({
        contentHash: r.contentHash,
        length: r.content.length
      }))
    };
  }
  
  /**
   * Get template analysis for debugging non-determinism
   */
  async analyzeTemplate(templatePath) {
    try {
      const templateContent = await this._loadTemplate(templatePath);
      const { data: frontmatter, content: template } = grayMatter.default(templateContent);
      
      // Find potentially non-deterministic patterns
      const nonDeterministicPatterns = [
        { pattern: /\{\{\s*now\s*\}\}/, issue: 'Dynamic timestamp' },
        { pattern: /\{\{\s*random\(\s*\)\s*\}\}/, issue: 'Random function without seed' },
        { pattern: /Date\.now\(\)/, issue: 'JavaScript this.getDeterministicTimestamp()' },
        { pattern: /Math\.random\(\)/, issue: 'JavaScript Math.random()' },
        { pattern: /process\.env/, issue: 'Environment variable access' },
        { pattern: /new Date\(\)/, issue: 'Dynamic date creation' }
      ];
      
      const issues = [];
      for (const { pattern, issue } of nonDeterministicPatterns) {
        const matches = template.match(pattern);
        if (matches) {
          issues.push({
            issue,
            matches: matches.length,
            pattern: pattern.toString()
          });
        }
      }
      
      // Extract variables
      const variables = this._extractTemplateVariables(template);
      
      return {
        templatePath,
        frontmatter,
        variables,
        issues,
        deterministicScore: Math.max(0, 100 - (issues.length * 20)),
        recommendations: this._generateDeterministicRecommendations(issues),
        templateHash: crypto.createHash('sha256').update(template).digest('hex')
      };
      
    } catch (error) {
      return {
        templatePath,
        error: error.message,
        deterministicScore: 0
      };
    }
  }
  
  /**
   * Clear render cache
   */
  clearCache() {
    this.cache.clear();
    this.contentHashMap.clear();
    this.logger.info('Render cache cleared');
  }
  
  /**
   * Get render statistics
   */
  getStatistics() {
    return {
      cacheSize: this.cache.size,
      contentHashMapSize: this.contentHashMap.size,
      templatesDir: this.config.templatesDir,
      staticBuildTime: this.config.staticBuildTime,
      deterministicFeatures: {
        sortObjectKeys: this.config.sortObjectKeys,
        removeTimestamps: this.config.removeTimestamps,
        useContentAddressing: this.config.useContentAddressing,
        enableCaching: this.config.enableCaching
      }
    };
  }
  
  // Private helper methods
  
  async _loadTemplate(templatePath) {
    try {
      const fullPath = path.resolve(this.config.templatesDir, templatePath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(`Template not found: ${templatePath}`);
    }
  }
  
  _normalizeContext(context) {
    // Deep clone to avoid mutations
    const normalized = JSON.parse(JSON.stringify(context));
    
    // Sort all object keys recursively for consistency
    if (this.config.sortObjectKeys) {
      return this._sortObjectKeys(normalized);
    }
    
    return normalized;
  }
  
  _sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._sortObjectKeys(item));
    }
    
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this._sortObjectKeys(obj[key]);
    });
    
    return sorted;
  }
  
  _getTemplateKey(templatePath, context) {
    const contextHash = crypto.createHash('sha256')
      .update(JSON.stringify(context))
      .digest('hex');
    
    return `${templatePath}:${contextHash}`;
  }
  
  _mergeContext(context, frontmatter) {
    return {
      ...frontmatter,
      ...context,
      // Ensure deterministic merge order
      __merged: true,
      __mergeHash: crypto.createHash('sha256')
        .update(JSON.stringify({ context, frontmatter }))
        .digest('hex').substring(0, 8)
    };
  }
  
  _postProcessForDeterminism(content, options = {}) {
    let processed = content;
    
    // Remove trailing whitespace for consistency
    processed = processed.replace(/\s+$/gm, '');
    
    // Normalize line endings
    processed = processed.replace(/\r\n/g, '\n');
    
    // Remove empty lines at end
    processed = processed.replace(/\n+$/, '\n');
    
    return processed;
  }
  
  _formatDate(date, format) {
    // Simple date formatting - in production, use a deterministic date library
    const d = new Date(date);
    if (format === 'iso') {
      return d.toISOString();
    }
    if (format === 'date') {
      return d.toISOString().split('T')[0];
    }
    return d.toISOString();
  }
  
  _extractTemplateVariables(template) {
    const variables = new Set();
    
    // Extract {{ variable }} patterns
    const varRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:\|[^}]*)?\}\}/g;
    let match;
    while ((match = varRegex.exec(template)) !== null) {
      variables.add(match[1].split('.')[0]);
    }
    
    return Array.from(variables).sort();
  }
  
  _generateDeterministicRecommendations(issues) {
    const recommendations = [];
    
    for (const issue of issues) {
      switch (issue.issue) {
        case 'Dynamic timestamp':
          recommendations.push('Use {{ BUILD_TIME }} or a static timestamp instead of {{ now }}');
          break;
        case 'Random function without seed':
          recommendations.push('Use {{ variable | hash }} for deterministic randomness');
          break;
        case 'JavaScript this.getDeterministicTimestamp()':
          recommendations.push('Replace this.getDeterministicTimestamp() with BUILD_TIME global');
          break;
        case 'JavaScript Math.random()':
          recommendations.push('Use hash-based randomness with seed');
          break;
        case 'Environment variable access':
          recommendations.push('Pass environment variables through context');
          break;
        case 'Dynamic date creation':
          recommendations.push('Use static build time or context-provided dates');
          break;
      }
    }
    
    return recommendations;
  }
  
  _enrichWithSemanticContext(input, context) {
    // Placeholder for semantic enrichment
    // Would integrate with RDF/semantic processing
    return input;
  }
  
  _getEngineVersion() {
    return '1.0.0';
  }
}

/**
 * Factory function for creating deterministic renderers
 */
export function createDeterministicRenderer(options = {}) {
  return new DeterministicRenderer(options);
}

export default DeterministicRenderer;