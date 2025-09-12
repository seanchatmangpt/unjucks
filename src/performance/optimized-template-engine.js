/**
 * ALPHA-7 OPTIMIZED TEMPLATE ENGINE
 * High-performance template system with advanced features and caching
 * Performance targets: <10ms rendering, <5ms variable extraction, <50ms validation
 */

const nunjucks = require('nunjucks');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { performance } = require('perf_hooks');

/**
 * Performance-optimized template cache with LRU eviction
 */
class HighPerformanceTemplateCache {
  constructor(maxSize = 1000, ttl = 300000) { // 5 minute TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
    this.accessTimes = new Map();
    this.hitCount = 0;
    this.missCount = 0;
    this.renderCount = 0;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      this.missCount++;
      return null;
    }

    this.accessTimes.set(key, Date.now());
    this.hitCount++;
    return entry.data;
  }

  set(key, value, metadata = {}) {
    // Evict LRU if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data: value,
      metadata,
      timestamp: Date.now()
    });
    this.accessTimes.set(key, Date.now());
  }

  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, time] of this.accessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
      hitCount: this.hitCount,
      missCount: this.missCount,
      renderCount: this.renderCount
    };
  }

  clear() {
    this.cache.clear();
    this.accessTimes.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.renderCount = 0;
  }
}

/**
 * High-performance template engine with advanced features
 */
class OptimizedTemplateEngine {
  constructor(options = {}) {
    this.templateDir = options.templateDir || path.join(__dirname, '../templates');
    this.enableCaching = options.enableCaching !== false;
    this.enableInheritance = options.enableInheritance !== false;
    this.enableMacros = options.enableMacros !== false;
    this.enablePerformanceProfiler = options.enablePerformanceProfiler === true;
    
    // Performance caching
    this.templateCache = new HighPerformanceTemplateCache(
      options.cacheSize || 1000,
      options.cacheTTL || 300000
    );
    this.variableCache = new Map();
    this.compiledTemplateCache = new Map();
    
    // Template registry for inheritance
    this.templates = new Map();
    this.baseTemplates = new Map();
    this.macros = new Map();
    
    // Performance metrics
    this.metrics = {
      renderingTimes: [],
      variableExtractionTimes: [],
      validationTimes: [],
      cacheMisses: 0,
      cacheHits: 0
    };
    
    // Initialize Nunjucks environment with optimized settings
    this.env = nunjucks.configure([this.templateDir], {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
      throwOnUndefined: false,
      web: {
        useCache: true,
        async: false
      }
    });
    
    this.addPerformanceFilters();
    this.addAdvancedFilters();
  }

  /**
   * Add performance-optimized custom filters
   */
  addPerformanceFilters() {
    // Cached date formatter
    const dateFormatCache = new Map();
    this.env.addFilter('dateFormat', (date, format = 'YYYY-MM-DD') => {
      if (!date) return '';
      const cacheKey = `${date}_${format}`;
      
      if (dateFormatCache.has(cacheKey)) {
        return dateFormatCache.get(cacheKey);
      }
      
      const formatted = new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: format.includes('MM') ? '2-digit' : 'long',
        day: 'numeric'
      });
      
      dateFormatCache.set(cacheKey, formatted);
      return formatted;
    });

    // Fast string transformation filters
    this.env.addFilter('pascalCase', (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/(?:^|[-_\s])(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '');
    });

    this.env.addFilter('camelCase', (str) => {
      if (typeof str !== 'string') return str;
      const pascal = str.replace(/(?:^|[-_\s])(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '');
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    });

    this.env.addFilter('kebabCase', (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_\s]/g, '-').toLowerCase();
    });

    this.env.addFilter('snakeCase', (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[-\s]/g, '_').toLowerCase();
    });

    // Performance hash filter with caching
    const hashCache = new Map();
    this.env.addFilter('hash', (value, algorithm = 'sha256') => {
      const key = `${value}_${algorithm}`;
      if (hashCache.has(key)) {
        return hashCache.get(key);
      }
      
      const hash = crypto.createHash(algorithm).update(String(value)).digest('hex');
      hashCache.set(key, hash);
      return hash;
    });
  }

  /**
   * Add advanced template features
   */
  addAdvancedFilters() {
    // Template inclusion with caching
    this.env.addFilter('include_template', async (templateName, context = {}) => {
      const includeKey = `include_${templateName}_${crypto.createHash('md5').update(JSON.stringify(context)).digest('hex')}`;
      
      if (this.enableCaching) {
        const cached = this.templateCache.get(includeKey);
        if (cached) {
          return cached;
        }
      }
      
      try {
        const result = await this.render(templateName, context);
        
        if (this.enableCaching) {
          this.templateCache.set(includeKey, result);
        }
        
        return result;
      } catch (error) {
        return `<!-- Include error: ${error.message} -->`;
      }
    });

    // Macro execution filter
    this.env.addFilter('exec_macro', (macroName, ...args) => {
      if (this.macros.has(macroName)) {
        const macro = this.macros.get(macroName);
        try {
          return macro.apply(this, args);
        } catch (error) {
          return `<!-- Macro error: ${error.message} -->`;
        }
      }
      return `<!-- Macro not found: ${macroName} -->`;
    });

    // Advanced JSON operations
    this.env.addFilter('jsonPath', (obj, path) => {
      if (!obj || typeof obj !== 'object') return null;
      
      const parts = path.split('.');
      let current = obj;
      
      for (const part of parts) {
        if (current === null || current === undefined) return null;
        current = current[part];
      }
      
      return current;
    });
  }

  /**
   * High-performance template rendering with sub-10ms target
   */
  async render(templateName, context = {}, options = {}) {
    const startTime = performance.now();
    const renderKey = `render_${templateName}_${crypto.createHash('md5').update(JSON.stringify(context)).digest('hex')}`;
    
    try {
      // Check cache first
      if (this.enableCaching && !options.noCache) {
        const cached = this.templateCache.get(renderKey);
        if (cached) {
          this.templateCache.renderCount++;
          return cached;
        }
      }

      // Load and compile template with caching
      let compiled = this.compiledTemplateCache.get(templateName);
      if (!compiled) {
        const template = await this.loadTemplate(templateName);
        compiled = this.env.compile(template.content);
        this.compiledTemplateCache.set(templateName, compiled);
      }

      // Enhanced context with performance optimizations
      const enhancedContext = {
        ...this.getDefaultData(),
        ...context,
        $template: {
          name: templateName,
          renderStart: startTime,
          cached: false
        }
      };

      // Fast rendering
      const result = compiled.render(enhancedContext);
      
      // Cache result
      if (this.enableCaching) {
        this.templateCache.set(renderKey, result, {
          templateName,
          renderTime: performance.now() - startTime,
          contextSize: JSON.stringify(context).length
        });
      }

      const duration = performance.now() - startTime;
      this.metrics.renderingTimes.push(duration);
      
      // Performance alert if over target
      if (duration > 10) {
        console.warn(`⚠️ Template rendering exceeded 10ms target: ${templateName} (${duration.toFixed(2)}ms)`);
      }

      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metrics.renderingTimes.push(duration);
      
      throw new Error(`Template rendering failed for '${templateName}': ${error.message}`);
    }
  }

  /**
   * Optimized variable extraction with <5ms target
   */
  extractVariables(templateContent, templateName = 'unknown') {
    const startTime = performance.now();
    
    try {
      // Check cache
      const contentHash = crypto.createHash('md5').update(templateContent).digest('hex');
      const cacheKey = `vars_${contentHash}`;
      
      if (this.variableCache.has(cacheKey)) {
        return this.variableCache.get(cacheKey);
      }

      const variables = new Set();
      
      if (!templateContent || typeof templateContent !== 'string') {
        return Array.from(variables);
      }

      // Optimized regex patterns with better performance
      const patterns = [
        // Variable expressions {{ variable }}
        /{{\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)/g,
        // For loop variables {% for item in items %}
        /{%\s*for\s+\w+\s+in\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        // Conditional variables {% if variable %}
        /{%\s*(?:if|elif)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        // Set statements {% set var = value %}
        /{%\s*set\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
      ];

      // Fast extraction using optimized loops
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(templateContent)) !== null) {
          const fullExpression = match[1];
          const rootVar = fullExpression.split('.')[0];
          
          if (rootVar && this.isValidVariableName(rootVar)) {
            variables.add(rootVar);
          }
        }
      }

      const result = Array.from(variables);
      
      // Cache result
      this.variableCache.set(cacheKey, result);
      
      const duration = performance.now() - startTime;
      this.metrics.variableExtractionTimes.push(duration);
      
      // Performance alert if over target
      if (duration > 5) {
        console.warn(`⚠️ Variable extraction exceeded 5ms target: ${templateName} (${duration.toFixed(2)}ms)`);
      }

      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metrics.variableExtractionTimes.push(duration);
      
      throw new Error(`Variable extraction failed for '${templateName}': ${error.message}`);
    }
  }

  /**
   * Advanced template validation with <50ms target
   */
  async validateTemplate(templatePath, options = {}) {
    const startTime = performance.now();
    
    try {
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const templateName = path.basename(templatePath, path.extname(templatePath));
      
      const validation = {
        valid: true,
        errors: [],
        warnings: [],
        performance: {
          renderingScore: 0,
          complexityScore: 0,
          cacheabilityScore: 0
        },
        features: {
          hasInheritance: false,
          hasMacros: false,
          hasIncludes: false,
          hasComplexLogic: false
        },
        variables: [],
        metrics: {}
      };

      // Extract variables with performance measurement
      validation.variables = this.extractVariables(templateContent, templateName);
      
      // Syntax validation
      try {
        this.env.compile(templateContent);
      } catch (syntaxError) {
        validation.valid = false;
        validation.errors.push({
          type: 'syntax',
          message: syntaxError.message,
          line: this.extractLineNumber(syntaxError.message)
        });
      }

      // Performance analysis
      validation.performance = this.analyzeTemplatePerformance(templateContent);
      
      // Feature detection
      validation.features = this.detectTemplateFeatures(templateContent);
      
      // Complexity analysis
      validation.metrics = this.calculateTemplateMetrics(templateContent);
      
      // Recommendations
      validation.recommendations = this.generateOptimizationRecommendations(validation);

      const duration = performance.now() - startTime;
      this.metrics.validationTimes.push(duration);
      
      // Performance alert if over target
      if (duration > 50) {
        console.warn(`⚠️ Template validation exceeded 50ms target: ${templateName} (${duration.toFixed(2)}ms)`);
      }

      return validation;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metrics.validationTimes.push(duration);
      
      throw new Error(`Template validation failed: ${error.message}`);
    }
  }

  /**
   * Analyze template performance characteristics
   */
  analyzeTemplatePerformance(content) {
    let renderingScore = 100;
    let complexityScore = 100;
    let cacheabilityScore = 100;

    // Penalize complex operations
    const complexPatterns = [
      { pattern: /{%\s*for\s+.*%}.*?{%\s*endfor\s*%}/gs, penalty: 10, name: 'nested loops' },
      { pattern: /{{\s*.*\|.*\|.*}}/g, penalty: 5, name: 'chained filters' },
      { pattern: /{%\s*if\s+.*and.*or.*%}/g, penalty: 8, name: 'complex conditionals' },
      { pattern: /{%\s*macro\s+/g, penalty: 3, name: 'macro definitions' }
    ];

    for (const { pattern, penalty, name } of complexPatterns) {
      const matches = content.match(pattern) || [];
      if (matches.length > 0) {
        renderingScore -= matches.length * penalty;
        complexityScore -= matches.length * (penalty / 2);
      }
    }

    // Cacheability factors
    if (content.includes('now()') || content.includes('random()')) {
      cacheabilityScore -= 50; // Non-deterministic functions hurt cacheability
    }
    
    if (content.length > 10000) {
      renderingScore -= 20; // Large templates are slower
    }

    return {
      renderingScore: Math.max(0, renderingScore),
      complexityScore: Math.max(0, complexityScore),
      cacheabilityScore: Math.max(0, cacheabilityScore)
    };
  }

  /**
   * Detect template features
   */
  detectTemplateFeatures(content) {
    return {
      hasInheritance: /\{%\s*extends\s+/.test(content),
      hasMacros: /\{%\s*macro\s+/.test(content),
      hasIncludes: /\{%\s*include\s+/.test(content),
      hasComplexLogic: /\{%\s*for\s+.*\{%\s*for\s+/.test(content) || /\{%\s*if\s+.*\{%\s*if\s+/.test(content)
    };
  }

  /**
   * Calculate template metrics
   */
  calculateTemplateMetrics(content) {
    const lines = content.split('\n');
    const variables = this.extractVariables(content);
    
    return {
      lines: lines.length,
      variables: variables.length,
      loops: (content.match(/{%\s*for\s+/g) || []).length,
      conditionals: (content.match(/{%\s*if\s+/g) || []).length,
      filters: (content.match(/\|/g) || []).length,
      includes: (content.match(/{%\s*include\s+/g) || []).length,
      macros: (content.match(/{%\s*macro\s+/g) || []).length,
      size: content.length
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations(validation) {
    const recommendations = [];

    if (validation.performance.renderingScore < 70) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        message: 'Template has complex rendering patterns that may impact performance',
        suggestion: 'Consider simplifying nested loops and complex conditionals'
      });
    }

    if (validation.performance.cacheabilityScore < 50) {
      recommendations.push({
        type: 'caching',
        severity: 'medium', 
        message: 'Template contains non-deterministic elements that hurt cacheability',
        suggestion: 'Avoid using random() and now() functions in templates'
      });
    }

    if (validation.variables.length > 20) {
      recommendations.push({
        type: 'complexity',
        severity: 'medium',
        message: 'Template has many variables which may indicate high complexity',
        suggestion: 'Consider breaking template into smaller, reusable components'
      });
    }

    if (validation.metrics.size > 50000) {
      recommendations.push({
        type: 'size',
        severity: 'high',
        message: 'Template file is very large and may impact performance',
        suggestion: 'Split large template into smaller templates with includes'
      });
    }

    return recommendations;
  }

  /**
   * Load template with caching and inheritance support
   */
  async loadTemplate(templateName) {
    const templateKey = `template_${templateName}`;
    
    if (this.templates.has(templateKey)) {
      return this.templates.get(templateKey);
    }

    const templatePath = path.resolve(this.templateDir, `${templateName}.njk`);
    
    try {
      const content = await fs.readFile(templatePath, 'utf8');
      const template = {
        name: templateName,
        path: templatePath,
        content,
        size: content.length,
        modified: (await fs.stat(templatePath)).mtime
      };

      // Parse frontmatter if present
      if (content.startsWith('---')) {
        const frontmatterEnd = content.indexOf('---', 3);
        if (frontmatterEnd !== -1) {
          const frontmatterYaml = content.slice(3, frontmatterEnd);
          try {
            const yaml = require('yaml');
            template.frontmatter = yaml.parse(frontmatterYaml);
            template.content = content.slice(frontmatterEnd + 3).trim();
          } catch (error) {
            // Ignore frontmatter parsing errors
          }
        }
      }

      this.templates.set(templateKey, template);
      return template;
      
    } catch (error) {
      throw new Error(`Template not found: ${templateName}`);
    }
  }

  /**
   * Register macro for reuse
   */
  registerMacro(name, fn) {
    if (typeof fn !== 'function') {
      throw new Error('Macro must be a function');
    }
    
    this.macros.set(name, fn);
  }

  /**
   * Validate variable name
   */
  isValidVariableName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // Must start with letter, $, or _
    if (!/^[a-zA-Z_$]/.test(name)) return false;
    
    // Must contain only valid characters
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) return false;
    
    // Exclude reserved words and common filters
    const reserved = [
      'default', 'length', 'first', 'last', 'random', 'sort', 'reverse',
      'join', 'upper', 'lower', 'title', 'trim', 'safe', 'escape',
      'replace', 'split', 'slice', 'round', 'abs', 'min', 'max',
      'pascalCase', 'camelCase', 'kebabCase', 'snakeCase', 'capitalize',
      'dateFormat', 'hash', 'jsonPath'
    ];
    
    return !reserved.includes(name.toLowerCase());
  }

  /**
   * Extract line number from error message
   */
  extractLineNumber(errorMessage) {
    const match = errorMessage.match(/line (\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Get default template data
   */
  getDefaultData() {
    return {
      currentDate: new Date().toISOString().split('T')[0],
      currentYear: new Date().getFullYear(),
      currentDateTime: new Date().toISOString(),
      templateEngine: 'OptimizedTemplateEngine/1.0',
      performance: {
        cacheEnabled: this.enableCaching,
        renderCount: this.templateCache.renderCount
      }
    };
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics() {
    const renderTimes = this.metrics.renderingTimes;
    const varTimes = this.metrics.variableExtractionTimes;
    const validationTimes = this.metrics.validationTimes;
    
    const calculateStats = (times) => {
      if (times.length === 0) return { avg: 0, p95: 0, max: 0, min: 0 };
      
      const sorted = [...times].sort((a, b) => a - b);
      return {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        max: sorted[sorted.length - 1] || 0,
        min: sorted[0] || 0
      };
    };

    return {
      templateCount: this.templates.size,
      cacheStats: this.templateCache.getStats(),
      performance: {
        rendering: {
          ...calculateStats(renderTimes),
          target: 10,
          compliance: renderTimes.filter(t => t <= 10).length / renderTimes.length || 1
        },
        variableExtraction: {
          ...calculateStats(varTimes),
          target: 5,
          compliance: varTimes.filter(t => t <= 5).length / varTimes.length || 1
        },
        validation: {
          ...calculateStats(validationTimes),
          target: 50,
          compliance: validationTimes.filter(t => t <= 50).length / validationTimes.length || 1
        }
      },
      features: {
        cacheEnabled: this.enableCaching,
        inheritanceEnabled: this.enableInheritance,
        macrosEnabled: this.enableMacros,
        macroCount: this.macros.size
      }
    };
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.templateCache.clear();
    this.variableCache.clear();
    this.compiledTemplateCache.clear();
    this.templates.clear();
  }

  /**
   * Health check for performance compliance
   */
  healthCheck() {
    const metrics = this.getPerformanceMetrics();
    const status = {
      healthy: true,
      issues: [],
      scores: {
        rendering: metrics.performance.rendering.compliance * 100,
        variableExtraction: metrics.performance.variableExtraction.compliance * 100,
        validation: metrics.performance.validation.compliance * 100,
        caching: metrics.cacheStats.hitRate * 100
      }
    };

    if (status.scores.rendering < 90) {
      status.healthy = false;
      status.issues.push('Template rendering performance below 90% compliance');
    }

    if (status.scores.variableExtraction < 95) {
      status.healthy = false;
      status.issues.push('Variable extraction performance below 95% compliance');
    }

    if (status.scores.validation < 85) {
      status.healthy = false;
      status.issues.push('Template validation performance below 85% compliance');
    }

    if (status.scores.caching < 80 && this.enableCaching) {
      status.healthy = false;
      status.issues.push('Cache hit rate below 80%');
    }

    return status;
  }
}

module.exports = { OptimizedTemplateEngine, HighPerformanceTemplateCache };