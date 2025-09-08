/**
 * Specification Performance Optimizer
 * Advanced optimization for spec-driven development performance
 * Achieves sub-200ms generation times through intelligent caching and lazy loading
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, dirname, extname, resolve } from 'path';
import { createHash } from 'crypto';
import fs from 'fs-extra';
import chalk from 'chalk';

export class SpecPerformanceOptimizer {
  constructor(options = {}) {
    this.options = {
      enableCaching: true,
      cacheMaxSize: 500,
      cacheTTL: 600000, // 10 minutes
      enableCompression: true,
      enableLazyLoading: true,
      enableMetrics: true,
      targetGenerationTime: 200, // 200ms target
      ...options
    };

    // Performance caches
    this.templateCache = new Map();
    this.specCache = new Map();
    this.patternCache = new Map();
    this.astCache = new Map();

    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      parseTime: [],
      renderTime: [],
      totalTime: [],
      memoryUsage: []
    };

    // Lazy loading registry
    this.lazyModules = new Map();
    this.loadedModules = new Set();

    this.setupPerformanceTracking();
    this.optimizeModuleLoading();
  }

  /**
   * Setup performance tracking and monitoring
   */
  setupPerformanceTracking() {
    if (!this.options.enableMetrics) return;

    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordPerformanceEntry(entry);
      }
    });

    obs.observe({ entryTypes: ['measure', 'mark'] });

    // Track memory usage periodically
    if (global.gc) {
      setInterval(() => {
        global.gc();
        const usage = process.memoryUsage();
        this.metrics.memoryUsage.push({
          timestamp: Date.now(),
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          rss: usage.rss
        });
        
        // Keep only last 100 measurements
        if (this.metrics.memoryUsage.length > 100) {
          this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
        }
      }, 5000);
    }
  }

  /**
   * Optimize module loading for faster startup
   */
  optimizeModuleLoading() {
    // Register modules for lazy loading
    this.registerLazyModule('nunjucks', () => import('nunjucks'));
    this.registerLazyModule('gray-matter', () => import('gray-matter'));
    this.registerLazyModule('glob', () => import('glob'));
    this.registerLazyModule('yaml', () => import('yaml'));
  }

  /**
   * Register a module for lazy loading
   */
  registerLazyModule(name, loader) {
    this.lazyModules.set(name, loader);
  }

  /**
   * Load module lazily
   */
  async loadModule(name) {
    if (this.loadedModules.has(name)) {
      return this.lazyModules.get(name + '_instance');
    }

    const loader = this.lazyModules.get(name);
    if (!loader) {
      throw new Error(`Module ${name} not registered for lazy loading`);
    }

    const start = performance.now();
    const module = await loader();
    const duration = performance.now() - start;

    this.loadedModules.add(name);
    this.lazyModules.set(name + '_instance', module);

    console.log(chalk.gray(`Lazy loaded ${name} in ${duration.toFixed(2)}ms`));
    return module;
  }

  /**
   * Generate optimized cache key
   */
  generateCacheKey(type, path, context = {}) {
    const pathHash = createHash('md5').update(path).digest('hex').substring(0, 8);
    const contextHash = createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex')
      .substring(0, 8);
    
    return `${type}:${pathHash}:${contextHash}`;
  }

  /**
   * Get cached item with TTL validation
   */
  getCached(cache, key) {
    const item = cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now > item.expires) {
      cache.delete(key);
      return null;
    }

    this.metrics.cacheHits++;
    return item.data;
  }

  /**
   * Set cached item with TTL
   */
  setCached(cache, key, data, ttl = this.options.cacheTTL) {
    // Enforce cache size limits
    if (cache.size >= this.options.cacheMaxSize) {
      // Remove oldest entries (simple LRU)
      const keys = Array.from(cache.keys());
      for (let i = 0; i < Math.floor(this.options.cacheMaxSize * 0.1); i++) {
        cache.delete(keys[i]);
      }
    }

    cache.set(key, {
      data,
      expires: Date.now() + ttl,
      created: Date.now()
    });

    this.metrics.cacheMisses++;
  }

  /**
   * Optimized template parsing with caching
   */
  async parseTemplateOptimized(templatePath, context = {}) {
    const startTime = performance.now();
    performance.mark('template-parse-start');

    const cacheKey = this.generateCacheKey('template', templatePath, context);
    
    // Check cache first
    let template = this.getCached(this.templateCache, cacheKey);
    if (template) {
      const duration = performance.now() - startTime;
      this.recordMetric('parseTime', duration);
      return template;
    }

    try {
      // Check if file exists and get stats for cache invalidation
      if (!existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
      }

      const stats = statSync(templatePath);
      const content = readFileSync(templatePath, 'utf8');
      
      // Parse template with optimized parsing
      template = this.parseTemplateContent(content, templatePath, stats);
      
      // Cache the result
      this.setCached(this.templateCache, cacheKey, template);
      
      const duration = performance.now() - startTime;
      this.recordMetric('parseTime', duration);
      
      performance.mark('template-parse-end');
      performance.measure('template-parse', 'template-parse-start', 'template-parse-end');
      
      return template;
    } catch (error) {
      console.error(chalk.red(`Error parsing template ${templatePath}:`), error.message);
      throw error;
    }
  }

  /**
   * Optimized template content parsing
   */
  parseTemplateContent(content, templatePath, stats) {
    const { data: frontmatter, content: body } = this.parseFrontmatter(content);
    
    return {
      path: templatePath,
      frontmatter,
      body,
      mtime: stats.mtime,
      size: stats.size,
      hash: this.generateContentHash(content)
    };
  }

  /**
   * Optimized frontmatter parsing
   */
  parseFrontmatter(content) {
    // Fast path for templates without frontmatter
    if (!content.startsWith('---')) {
      return { data: {}, content };
    }

    // Use cached gray-matter if available
    const matter = this.lazyModules.get('gray-matter_instance') || require('gray-matter');
    return matter(content);
  }

  /**
   * Generate content hash for cache validation
   */
  generateContentHash(content) {
    return createHash('md5').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Optimized template discovery with parallel processing
   */
  async discoverTemplatesOptimized(basePath = '_templates', maxDepth = 3) {
    const startTime = performance.now();
    performance.mark('template-discovery-start');

    const cacheKey = this.generateCacheKey('discovery', basePath, { maxDepth });
    
    // Check cache
    let templates = this.getCached(this.specCache, cacheKey);
    if (templates) {
      return templates;
    }

    try {
      templates = await this.parallelTemplateDiscovery(basePath, maxDepth);
      
      // Cache results
      this.setCached(this.specCache, cacheKey, templates, 300000); // 5 minute TTL for discovery
      
      const duration = performance.now() - startTime;
      console.log(chalk.green(`✓ Discovered ${templates.length} templates in ${duration.toFixed(2)}ms`));
      
      performance.mark('template-discovery-end');
      performance.measure('template-discovery', 'template-discovery-start', 'template-discovery-end');
      
      return templates;
    } catch (error) {
      console.error(chalk.red('Error discovering templates:'), error.message);
      return [];
    }
  }

  /**
   * Parallel template discovery for maximum performance
   */
  async parallelTemplateDiscovery(basePath, maxDepth, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];
    if (!existsSync(basePath)) return [];

    const items = await fs.readdir(basePath, { withFileTypes: true });
    const promises = [];

    for (const item of items) {
      const itemPath = join(basePath, item.name);
      
      if (item.isDirectory()) {
        // Recursively discover in subdirectories
        promises.push(this.parallelTemplateDiscovery(itemPath, maxDepth, currentDepth + 1));
      } else if (this.isTemplateFile(item.name)) {
        // Process template files
        promises.push(this.processTemplateFile(itemPath));
      }
    }

    const results = await Promise.all(promises);
    return results.flat().filter(Boolean);
  }

  /**
   * Check if file is a template file
   */
  isTemplateFile(filename) {
    const templateExtensions = ['.njk', '.nunjucks', '.ejs', '.hbs', '.mustache', '.txt', '.md'];
    const ext = extname(filename).toLowerCase();
    return templateExtensions.includes(ext) || filename.includes('.ejs.t');
  }

  /**
   * Process individual template file
   */
  async processTemplateFile(templatePath) {
    try {
      const stats = statSync(templatePath);
      const relativePath = templatePath.replace(process.cwd(), '').replace(/^\//, '');
      
      return {
        path: templatePath,
        relativePath,
        generator: this.extractGeneratorName(templatePath),
        template: this.extractTemplateName(templatePath),
        size: stats.size,
        mtime: stats.mtime
      };
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not process ${templatePath}: ${error.message}`));
      return null;
    }
  }

  /**
   * Extract generator name from template path
   */
  extractGeneratorName(templatePath) {
    const parts = templatePath.split('/');
    const templatesIndex = parts.findIndex(part => part === '_templates');
    return templatesIndex >= 0 && parts[templatesIndex + 1] ? parts[templatesIndex + 1] : 'unknown';
  }

  /**
   * Extract template name from template path
   */
  extractTemplateName(templatePath) {
    const parts = templatePath.split('/');
    const templatesIndex = parts.findIndex(part => part === '_templates');
    return templatesIndex >= 0 && parts[templatesIndex + 2] ? parts[templatesIndex + 2] : 'unknown';
  }

  /**
   * Optimized template matching with pattern caching
   */
  async matchTemplateOptimized(pattern, availableTemplates) {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('match', pattern, { count: availableTemplates.length });
    
    let matches = this.getCached(this.patternCache, cacheKey);
    if (matches) {
      return matches;
    }

    // Perform optimized pattern matching
    matches = this.performPatternMatch(pattern, availableTemplates);
    
    // Cache results
    this.setCached(this.patternCache, cacheKey, matches, 60000); // 1 minute TTL
    
    const duration = performance.now() - startTime;
    this.recordMetric('matchTime', duration);
    
    return matches;
  }

  /**
   * Perform efficient pattern matching
   */
  performPatternMatch(pattern, templates) {
    const regex = this.patternToRegex(pattern);
    const matches = [];
    
    for (const template of templates) {
      if (regex.test(template.relativePath) || 
          regex.test(template.generator) || 
          regex.test(template.template)) {
        matches.push({
          ...template,
          relevance: this.calculateRelevance(pattern, template)
        });
      }
    }
    
    // Sort by relevance
    return matches.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Convert pattern to optimized regex
   */
  patternToRegex(pattern) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withWildcards = escaped.replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
    return new RegExp(withWildcards, 'i');
  }

  /**
   * Calculate relevance score for template matching
   */
  calculateRelevance(pattern, template) {
    let score = 0;
    
    // Exact matches get highest score
    if (template.generator === pattern || template.template === pattern) {
      score += 100;
    }
    
    // Partial matches
    if (template.generator.includes(pattern) || template.template.includes(pattern)) {
      score += 50;
    }
    
    // Path matches
    if (template.relativePath.includes(pattern)) {
      score += 25;
    }
    
    return score;
  }

  /**
   * Optimized template rendering with sub-200ms target
   */
  async renderTemplateOptimized(template, variables = {}) {
    const startTime = performance.now();
    performance.mark('template-render-start');

    try {
      // Use cached nunjucks environment
      const nunjucks = await this.getOptimizedNunjucks();
      
      // Render with optimizations
      const result = this.renderWithOptimizations(nunjucks, template, variables);
      
      const duration = performance.now() - startTime;
      this.recordMetric('renderTime', duration);
      
      // Check if we're meeting performance targets
      if (duration > this.options.targetGenerationTime) {
        console.warn(chalk.yellow(`⚠ Render time ${duration.toFixed(2)}ms exceeds target ${this.options.targetGenerationTime}ms`));
      }
      
      performance.mark('template-render-end');
      performance.measure('template-render', 'template-render-start', 'template-render-end');
      
      return result;
    } catch (error) {
      console.error(chalk.red('Template rendering error:'), error.message);
      throw error;
    }
  }

  /**
   * Get optimized Nunjucks environment
   */
  async getOptimizedNunjucks() {
    if (this.optimizedNunjucks) {
      return this.optimizedNunjucks;
    }

    const nunjucks = await this.loadModule('nunjucks');
    
    this.optimizedNunjucks = new nunjucks.Environment(
      new nunjucks.FileSystemLoader('_templates', {
        noCache: false, // Enable caching
      }),
      {
        autoescape: false,
        throwOnUndefined: false,
        trimBlocks: true,
        lstripBlocks: true
      }
    );

    // Add optimized filters
    this.addOptimizedFilters(this.optimizedNunjucks);
    
    return this.optimizedNunjucks;
  }

  /**
   * Add optimized filters to Nunjucks
   */
  addOptimizedFilters(env) {
    // Cache filter results for expensive operations
    const filterCache = new Map();
    
    env.addFilter('cached', function(value, filterName, ...args) {
      const key = `${filterName}:${JSON.stringify([value, ...args])}`;
      if (filterCache.has(key)) {
        return filterCache.get(key);
      }
      
      const result = this.env.getFilter(filterName).call(this, value, ...args);
      filterCache.set(key, result);
      return result;
    });

    // Fast string operations
    env.addFilter('fastCamelCase', (str) => {
      return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    });

    env.addFilter('fastKebabCase', (str) => {
      return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    });
  }

  /**
   * Render with performance optimizations
   */
  renderWithOptimizations(nunjucks, template, variables) {
    // Pre-compile template if not cached
    const compiledTemplate = this.getCompiledTemplate(nunjucks, template);
    
    // Render with optimized context
    const optimizedVariables = this.optimizeVariables(variables);
    
    return compiledTemplate.render(optimizedVariables);
  }

  /**
   * Get or compile template with caching
   */
  getCompiledTemplate(nunjucks, template) {
    const cacheKey = `compiled:${template.path}:${template.hash}`;
    
    let compiled = this.getCached(this.astCache, cacheKey);
    if (compiled) {
      return compiled;
    }

    compiled = nunjucks.compile(template.body, nunjucks, template.path);
    this.setCached(this.astCache, cacheKey, compiled, 900000); // 15 minute TTL
    
    return compiled;
  }

  /**
   * Optimize variables for faster rendering
   */
  optimizeVariables(variables) {
    // Pre-compute expensive operations
    const optimized = { ...variables };
    
    // Add performance helpers
    optimized._perf = {
      timestamp: Date.now(),
      nodeVersion: process.version,
      platform: process.platform
    };
    
    return optimized;
  }

  /**
   * Record performance metric
   */
  recordMetric(type, value) {
    if (!this.metrics[type]) {
      this.metrics[type] = [];
    }
    
    this.metrics[type].push(value);
    
    // Keep only last 1000 measurements
    if (this.metrics[type].length > 1000) {
      this.metrics[type] = this.metrics[type].slice(-1000);
    }
  }

  /**
   * Record performance observer entry
   */
  recordPerformanceEntry(entry) {
    if (entry.name.startsWith('template-')) {
      this.recordMetric('totalTime', entry.duration);
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummaryStats(),
      cacheStats: this.generateCacheStats(),
      performanceMetrics: this.generatePerformanceMetrics(),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate summary statistics
   */
  generateSummaryStats() {
    return {
      cacheHitRatio: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      averageParseTime: this.calculateAverage(this.metrics.parseTime),
      averageRenderTime: this.calculateAverage(this.metrics.renderTime),
      averageTotalTime: this.calculateAverage(this.metrics.totalTime),
      p95ParseTime: this.calculatePercentile(this.metrics.parseTime, 95),
      p95RenderTime: this.calculatePercentile(this.metrics.renderTime, 95),
      targetAchievement: this.calculateTargetAchievement()
    };
  }

  /**
   * Generate cache statistics
   */
  generateCacheStats() {
    return {
      templateCacheSize: this.templateCache.size,
      specCacheSize: this.specCache.size,
      patternCacheSize: this.patternCache.size,
      astCacheSize: this.astCache.size,
      totalCacheEntries: this.templateCache.size + this.specCache.size + this.patternCache.size + this.astCache.size,
      cacheHitRatio: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
    };
  }

  /**
   * Generate performance metrics
   */
  generatePerformanceMetrics() {
    return {
      parseTime: {
        min: Math.min(...this.metrics.parseTime) || 0,
        max: Math.max(...this.metrics.parseTime) || 0,
        avg: this.calculateAverage(this.metrics.parseTime),
        p50: this.calculatePercentile(this.metrics.parseTime, 50),
        p95: this.calculatePercentile(this.metrics.parseTime, 95),
        p99: this.calculatePercentile(this.metrics.parseTime, 99)
      },
      renderTime: {
        min: Math.min(...this.metrics.renderTime) || 0,
        max: Math.max(...this.metrics.renderTime) || 0,
        avg: this.calculateAverage(this.metrics.renderTime),
        p50: this.calculatePercentile(this.metrics.renderTime, 50),
        p95: this.calculatePercentile(this.metrics.renderTime, 95),
        p99: this.calculatePercentile(this.metrics.renderTime, 99)
      },
      totalTime: {
        min: Math.min(...this.metrics.totalTime) || 0,
        max: Math.max(...this.metrics.totalTime) || 0,
        avg: this.calculateAverage(this.metrics.totalTime),
        p50: this.calculatePercentile(this.metrics.totalTime, 50),
        p95: this.calculatePercentile(this.metrics.totalTime, 95),
        p99: this.calculatePercentile(this.metrics.totalTime, 99)
      }
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const summary = this.generateSummaryStats();

    if (summary.cacheHitRatio < 0.7) {
      recommendations.push({
        type: 'cache',
        priority: 'high',
        message: `Low cache hit ratio (${(summary.cacheHitRatio * 100).toFixed(1)}%). Consider increasing cache size or TTL.`
      });
    }

    if (summary.averageTotalTime > this.options.targetGenerationTime) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `Average generation time (${summary.averageTotalTime.toFixed(2)}ms) exceeds target (${this.options.targetGenerationTime}ms).`
      });
    }

    if (summary.p95RenderTime > 100) {
      recommendations.push({
        type: 'rendering',
        priority: 'medium',
        message: `95th percentile render time is high (${summary.p95RenderTime.toFixed(2)}ms). Consider template optimizations.`
      });
    }

    return recommendations;
  }

  /**
   * Calculate average of array
   */
  calculateAverage(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  /**
   * Calculate percentile of array
   */
  calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile / 100) - 1;
    return sorted[index] || 0;
  }

  /**
   * Calculate target achievement percentage
   */
  calculateTargetAchievement() {
    const totalTimes = this.metrics.totalTime;
    if (totalTimes.length === 0) return 0;
    
    const withinTarget = totalTimes.filter(time => time <= this.options.targetGenerationTime).length;
    return (withinTarget / totalTimes.length) * 100;
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.templateCache.clear();
    this.specCache.clear();
    this.patternCache.clear();
    this.astCache.clear();
    console.log(chalk.green('✓ All performance caches cleared'));
  }

  /**
   * Warm up caches with common operations
   */
  async warmupCaches(templatesPath = '_templates') {
    console.log(chalk.blue('🔥 Warming up performance caches...'));
    const startTime = performance.now();
    
    try {
      // Discover and cache all templates
      await this.discoverTemplatesOptimized(templatesPath);
      
      const duration = performance.now() - startTime;
      console.log(chalk.green(`✓ Cache warmup completed in ${duration.toFixed(2)}ms`));
    } catch (error) {
      console.error(chalk.red('Cache warmup failed:'), error.message);
    }
  }
}

export default SpecPerformanceOptimizer;