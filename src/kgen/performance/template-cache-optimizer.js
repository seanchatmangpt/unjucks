/**
 * Template Cache Optimizer - High-Performance Template Compilation Caching
 * 
 * Optimizes template compilation and rendering performance through intelligent caching,
 * pre-compilation, and concurrent processing strategies.
 */

import { EventEmitter } from 'events';
import { Logger } from 'consola';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Worker } from 'worker_threads';

export class TemplateCacheOptimizer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Cache configuration
      cacheSize: '200MB',
      cacheTTL: 30 * 60 * 1000, // 30 minutes
      enablePersistentCache: true,
      cacheDirectory: '.kgen/template-cache',
      
      // Compilation optimization
      enablePreCompilation: true,
      enableLazyCompilation: true,
      enableIncrementalCompilation: true,
      
      // Concurrency settings
      enableWorkerPool: true,
      maxWorkers: Math.max(2, Math.floor(require('os').cpus().length / 2)),
      workerTimeout: 30000,
      
      // Performance targets
      maxCompilationTime: 100, // ms per template
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB per template
      
      // Optimization strategies
      enableTemplateAnalysis: true,
      enableDependencyTracking: true,
      enableHotReload: false, // Development only
      
      ...config
    };
    
    this.logger = new Logger({ tag: 'template-cache-optimizer' });
    
    // Cache storage
    this.compiledTemplates = new Map();
    this.templateMetadata = new Map();
    this.dependencyGraph = new Map();
    this.compilationStats = new Map();
    
    // Worker pool for concurrent compilation
    this.workerPool = [];
    this.availableWorkers = [];
    this.workerTasks = new Map();
    
    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      compilationTime: 0,
      totalCompilations: 0,
      concurrentCompilations: 0,
      memoryUsage: 0
    };
    
    this.state = 'initialized';
  }

  /**
   * Initialize the template cache optimizer
   */
  async initialize() {
    try {
      this.logger.info('Initializing template cache optimizer...');
      
      // Initialize cache directory
      await this._initializeCacheDirectory();
      
      // Load persistent cache if enabled
      if (this.config.enablePersistentCache) {
        await this._loadPersistentCache();
      }
      
      // Initialize worker pool for concurrent processing
      if (this.config.enableWorkerPool) {
        await this._initializeWorkerPool();
      }
      
      // Start cache cleanup routine
      this._startCacheCleanup();
      
      this.state = 'ready';
      this.logger.success('Template cache optimizer initialized successfully');
      
      return {
        status: 'success',
        cacheSize: this.compiledTemplates.size,
        workers: this.workerPool.length
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize template cache optimizer:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Compile template with optimization
   * @param {string} templatePath - Path to template file
   * @param {Object} context - Template context data
   * @param {Object} options - Compilation options
   * @returns {Promise<Object>} Compiled template
   */
  async compileTemplate(templatePath, context = {}, options = {}) {
    const startTime = Date.now();
    const templateId = this._generateTemplateId(templatePath, context);
    
    try {
      this.logger.debug(`Compiling template: ${templatePath}`);
      
      // Check cache first
      const cachedTemplate = this._getCachedTemplate(templateId);
      if (cachedTemplate && !options.forceRecompile) {
        this.metrics.cacheHits++;
        this.emit('cache:hit', { templateId, templatePath });
        return cachedTemplate;
      }
      
      this.metrics.cacheMisses++;
      this.emit('cache:miss', { templateId, templatePath });
      
      // Analyze template for optimization opportunities
      let templateAnalysis = null;
      if (this.config.enableTemplateAnalysis) {
        templateAnalysis = await this._analyzeTemplate(templatePath);
      }
      
      // Compile template based on strategy
      let compiledTemplate;
      if (this.config.enableWorkerPool && this.availableWorkers.length > 0) {
        compiledTemplate = await this._compileWithWorker(templatePath, context, options);
      } else {
        compiledTemplate = await this._compileInMainThread(templatePath, context, options);
      }
      
      // Add metadata
      compiledTemplate.metadata = {
        templateId,
        templatePath,
        compilationTime: Date.now() - startTime,
        timestamp: new Date(),
        analysis: templateAnalysis,
        cacheKey: templateId
      };
      
      // Cache the compiled template
      await this._cacheTemplate(templateId, compiledTemplate);
      
      // Update statistics
      this._updateCompilationStats(templateId, compiledTemplate.metadata);
      
      // Update dependencies if tracking is enabled
      if (this.config.enableDependencyTracking) {
        await this._updateDependencyGraph(templatePath, compiledTemplate);
      }
      
      this.metrics.totalCompilations++;
      this.metrics.compilationTime += compiledTemplate.metadata.compilationTime;
      
      this.emit('template:compiled', {
        templateId,
        templatePath,
        compilationTime: compiledTemplate.metadata.compilationTime
      });
      
      this.logger.debug(`Template compiled: ${templatePath} (${compiledTemplate.metadata.compilationTime}ms)`);
      
      return compiledTemplate;
      
    } catch (error) {
      this.logger.error(`Template compilation failed: ${templatePath}`, error);
      this.emit('compilation:error', { templateId, templatePath, error });
      throw error;
    }
  }

  /**
   * Batch compile multiple templates
   * @param {Array} templatePaths - Array of template paths
   * @param {Object} sharedContext - Shared context for all templates
   * @param {Object} options - Batch compilation options
   * @returns {Promise<Map>} Map of compiled templates
   */
  async batchCompileTemplates(templatePaths, sharedContext = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Batch compiling ${templatePaths.length} templates...`);
      
      const results = new Map();
      const compilationPromises = [];
      
      // Process templates concurrently
      const batchSize = Math.min(templatePaths.length, this.config.maxWorkers || 4);
      
      for (let i = 0; i < templatePaths.length; i += batchSize) {
        const batch = templatePaths.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (templatePath) => {
          try {
            const compiled = await this.compileTemplate(templatePath, sharedContext, options);
            results.set(templatePath, compiled);
            return { templatePath, success: true, compiled };
          } catch (error) {
            results.set(templatePath, { error });
            return { templatePath, success: false, error };
          }
        });
        
        compilationPromises.push(...batchPromises);
        
        // Wait for current batch to complete before starting next
        await Promise.all(batchPromises);
      }
      
      const totalTime = Date.now() - startTime;
      const successful = Array.from(results.values()).filter(r => !r.error).length;
      
      this.logger.success(`Batch compilation completed: ${successful}/${templatePaths.length} successful (${totalTime}ms)`);
      
      this.emit('batch:completed', {
        total: templatePaths.length,
        successful,
        failed: templatePaths.length - successful,
        totalTime
      });
      
      return results;
      
    } catch (error) {
      this.logger.error('Batch compilation failed:', error);
      throw error;
    }
  }

  /**
   * Pre-compile templates based on usage patterns
   * @param {Array} templatePaths - Templates to pre-compile
   * @returns {Promise<Object>} Pre-compilation results
   */
  async preCompileTemplates(templatePaths = []) {
    if (!this.config.enablePreCompilation) {
      this.logger.warn('Pre-compilation is disabled');
      return { status: 'disabled' };
    }
    
    try {
      this.logger.info(`Pre-compiling ${templatePaths.length} templates...`);
      
      const results = await this.batchCompileTemplates(templatePaths, {}, {
        precompilation: true,
        priority: 'low'
      });
      
      // Analyze pre-compilation effectiveness
      const analysis = this._analyzePreCompilationResults(results);
      
      this.logger.success(`Pre-compilation completed with ${analysis.effectiveness}% effectiveness`);
      
      return {
        status: 'completed',
        templates: results.size,
        analysis
      };
      
    } catch (error) {
      this.logger.error('Pre-compilation failed:', error);
      throw error;
    }
  }

  /**
   * Invalidate template cache entry
   * @param {string} templatePath - Template path to invalidate
   * @returns {boolean} True if invalidated
   */
  invalidateTemplate(templatePath) {
    const templateIds = Array.from(this.templateMetadata.keys())
      .filter(id => this.templateMetadata.get(id).templatePath === templatePath);
    
    let invalidated = 0;
    for (const templateId of templateIds) {
      if (this.compiledTemplates.delete(templateId)) {
        this.templateMetadata.delete(templateId);
        invalidated++;
      }
    }
    
    if (invalidated > 0) {
      this.logger.debug(`Invalidated ${invalidated} cache entries for: ${templatePath}`);
      this.emit('cache:invalidated', { templatePath, count: invalidated });
      
      // Also invalidate dependent templates
      if (this.config.enableDependencyTracking) {
        this._invalidateDependentTemplates(templatePath);
      }
    }
    
    return invalidated > 0;
  }

  /**
   * Clear all cached templates
   */
  clearCache() {
    const count = this.compiledTemplates.size;
    
    this.compiledTemplates.clear();
    this.templateMetadata.clear();
    this.dependencyGraph.clear();
    this.compilationStats.clear();
    
    this.logger.info(`Cache cleared: ${count} templates removed`);
    this.emit('cache:cleared', { count });
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStatistics() {
    const memoryUsage = this._calculateMemoryUsage();
    
    return {
      cacheSize: this.compiledTemplates.size,
      hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      averageCompilationTime: this.metrics.compilationTime / this.metrics.totalCompilations || 0,
      memoryUsage,
      workerUtilization: this._calculateWorkerUtilization(),
      dependencyGraphSize: this.dependencyGraph.size,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Optimize cache performance
   * @returns {Promise<Object>} Optimization results
   */
  async optimizeCache() {
    this.logger.info('Optimizing template cache...');
    
    const optimization = {
      before: this.getCacheStatistics(),
      actions: []
    };
    
    // Remove expired templates
    const expired = this._removeExpiredTemplates();
    if (expired > 0) {
      optimization.actions.push(`Removed ${expired} expired templates`);
    }
    
    // Compress frequently used templates
    const compressed = await this._compressTemplates();
    if (compressed > 0) {
      optimization.actions.push(`Compressed ${compressed} templates`);
    }
    
    // Reorganize worker pool if needed
    if (this._shouldReorganizeWorkerPool()) {
      await this._reorganizeWorkerPool();
      optimization.actions.push('Reorganized worker pool');
    }
    
    optimization.after = this.getCacheStatistics();
    optimization.improvement = this._calculateOptimizationImprovement(optimization.before, optimization.after);
    
    this.logger.success(`Cache optimization completed: ${optimization.improvement}% improvement`);
    
    return optimization;
  }

  /**
   * Shutdown the template cache optimizer
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down template cache optimizer...');
      
      // Save persistent cache if enabled
      if (this.config.enablePersistentCache) {
        await this._savePersistentCache();
      }
      
      // Terminate worker pool
      if (this.config.enableWorkerPool) {
        await this._terminateWorkerPool();
      }
      
      // Clear cleanup intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      this.state = 'shutdown';
      this.logger.success('Template cache optimizer shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during template cache optimizer shutdown:', error);
      throw error;
    }
  }

  // Private methods

  _generateTemplateId(templatePath, context) {
    const contextHash = crypto.createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex')
      .substring(0, 8);
    
    const pathHash = crypto.createHash('md5')
      .update(templatePath)
      .digest('hex')
      .substring(0, 8);
    
    return `template_${pathHash}_${contextHash}`;
  }

  _getCachedTemplate(templateId) {
    const cached = this.compiledTemplates.get(templateId);
    if (!cached) return null;
    
    // Check if cache entry is still valid
    const metadata = this.templateMetadata.get(templateId);
    if (!metadata) return null;
    
    const age = Date.now() - metadata.timestamp;
    if (age > this.config.cacheTTL) {
      // Remove expired entry
      this.compiledTemplates.delete(templateId);
      this.templateMetadata.delete(templateId);
      return null;
    }
    
    // Update access time for LRU
    metadata.lastAccessed = new Date();
    this.templateMetadata.set(templateId, metadata);
    
    return cached;
  }

  async _cacheTemplate(templateId, compiledTemplate) {
    // Check cache size limits
    if (this._exceedsCacheSizeLimit()) {
      await this._evictLeastRecentlyUsed();
    }
    
    // Store template and metadata
    this.compiledTemplates.set(templateId, compiledTemplate);
    this.templateMetadata.set(templateId, {
      templateId,
      templatePath: compiledTemplate.metadata.templatePath,
      timestamp: Date.now(),
      lastAccessed: new Date(),
      size: JSON.stringify(compiledTemplate).length,
      accessCount: 0
    });
  }

  async _analyzeTemplate(templatePath) {
    try {
      const content = await fs.readFile(templatePath, 'utf8');
      
      return {
        size: content.length,
        complexity: this._calculateTemplateComplexity(content),
        dependencies: this._extractTemplateDependencies(content),
        variables: this._extractTemplateVariables(content),
        includes: this._extractTemplateIncludes(content)
      };
    } catch (error) {
      this.logger.warn(`Failed to analyze template: ${templatePath}`, error);
      return null;
    }
  }

  _calculateTemplateComplexity(content) {
    // Simple complexity calculation based on control structures
    const patterns = [
      /\{\%\s*for\s+/g,      // for loops
      /\{\%\s*if\s+/g,       // conditionals
      /\{\%\s*set\s+/g,      // variable assignments
      /\{\%\s*macro\s+/g,    // macros
      /\{\%\s*include\s+/g   // includes
    ];
    
    let complexity = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      complexity += matches ? matches.length : 0;
    }
    
    return Math.min(10, Math.max(1, complexity)); // Scale 1-10
  }

  _extractTemplateDependencies(content) {
    const dependencies = [];
    
    // Extract include dependencies
    const includeMatches = content.match(/\{\%\s*include\s+['"]([^'"]+)['"]/g) || [];
    for (const match of includeMatches) {
      const path = match.match(/['"]([^'"]+)['"]/)[1];
      dependencies.push({ type: 'include', path });
    }
    
    // Extract extends dependencies
    const extendsMatches = content.match(/\{\%\s*extends\s+['"]([^'"]+)['"]/g) || [];
    for (const match of extendsMatches) {
      const path = match.match(/['"]([^'"]+)['"]/)[1];
      dependencies.push({ type: 'extends', path });
    }
    
    return dependencies;
  }

  _extractTemplateVariables(content) {
    const variableMatches = content.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
    return variableMatches.map(match => {
      const variable = match.match(/\{\{\s*([^}]+)\s*\}\}/)[1].trim();
      return variable.split('.')[0]; // Get root variable
    }).filter((v, i, arr) => arr.indexOf(v) === i); // Unique
  }

  _extractTemplateIncludes(content) {
    const includeMatches = content.match(/\{\%\s*include\s+['"]([^'"]+)['"]/g) || [];
    return includeMatches.map(match => match.match(/['"]([^'"]+)['"]/)[1]);
  }

  async _compileWithWorker(templatePath, context, options) {
    return new Promise((resolve, reject) => {
      const worker = this._getAvailableWorker();
      if (!worker) {
        // Fallback to main thread if no workers available
        return this._compileInMainThread(templatePath, context, options)
          .then(resolve)
          .catch(reject);
      }
      
      const taskId = crypto.randomBytes(8).toString('hex');
      const timeout = setTimeout(() => {
        this._releaseWorker(worker);
        reject(new Error(`Worker compilation timeout: ${templatePath}`));
      }, this.config.workerTimeout);
      
      worker.once('message', (result) => {
        clearTimeout(timeout);
        this._releaseWorker(worker);
        
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.compiled);
        }
      });
      
      worker.once('error', (error) => {
        clearTimeout(timeout);
        this._releaseWorker(worker);
        reject(error);
      });
      
      worker.postMessage({
        taskId,
        templatePath,
        context,
        options
      });
    });
  }

  async _compileInMainThread(templatePath, context, options) {
    // This would implement actual template compilation
    // For now, return a mock compiled template
    const content = await fs.readFile(templatePath, 'utf8');
    
    return {
      template: content,
      render: (ctx) => content.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
        return ctx[variable.trim()] || match;
      }),
      compiled: true,
      compiledAt: new Date()
    };
  }

  async _initializeCacheDirectory() {
    if (this.config.enablePersistentCache) {
      await fs.mkdir(this.config.cacheDirectory, { recursive: true });
    }
  }

  async _loadPersistentCache() {
    try {
      const cacheFile = path.join(this.config.cacheDirectory, 'templates.cache');
      const data = await fs.readFile(cacheFile, 'utf8');
      const cache = JSON.parse(data);
      
      for (const [templateId, template] of Object.entries(cache.templates || {})) {
        this.compiledTemplates.set(templateId, template);
      }
      
      for (const [templateId, metadata] of Object.entries(cache.metadata || {})) {
        this.templateMetadata.set(templateId, metadata);
      }
      
      this.logger.info(`Loaded ${this.compiledTemplates.size} templates from persistent cache`);
    } catch (error) {
      this.logger.debug('No persistent cache found or failed to load');
    }
  }

  async _savePersistentCache() {
    try {
      const cache = {
        templates: Object.fromEntries(this.compiledTemplates),
        metadata: Object.fromEntries(this.templateMetadata),
        savedAt: new Date().toISOString()
      };
      
      const cacheFile = path.join(this.config.cacheDirectory, 'templates.cache');
      await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2));
      
      this.logger.info('Persistent cache saved successfully');
    } catch (error) {
      this.logger.error('Failed to save persistent cache:', error);
    }
  }

  async _initializeWorkerPool() {
    const workerScript = path.join(__dirname, 'template-compilation-worker.js');
    
    // Create worker script if it doesn't exist
    await this._createWorkerScript(workerScript);
    
    for (let i = 0; i < this.config.maxWorkers; i++) {
      try {
        const worker = new Worker(workerScript);
        worker.on('error', (error) => {
          this.logger.error(`Worker ${i} error:`, error);
        });
        
        this.workerPool.push(worker);
        this.availableWorkers.push(worker);
      } catch (error) {
        this.logger.warn(`Failed to create worker ${i}:`, error);
      }
    }
    
    this.logger.info(`Worker pool initialized with ${this.workerPool.length} workers`);
  }

  async _createWorkerScript(scriptPath) {
    const workerCode = `
const { parentPort } = require('worker_threads');
const fs = require('fs').promises;

parentPort.on('message', async (data) => {
  try {
    const { taskId, templatePath, context, options } = data;
    
    // Simple template compilation (replace with actual implementation)
    const content = await fs.readFile(templatePath, 'utf8');
    const compiled = {
      template: content,
      render: (ctx) => content.replace(/\\{\\{([^}]+)\\}\\}/g, (match, variable) => {
        return ctx[variable.trim()] || match;
      }),
      compiled: true,
      compiledAt: new Date()
    };
    
    parentPort.postMessage({ taskId, compiled });
  } catch (error) {
    parentPort.postMessage({ taskId: data.taskId, error: error.message });
  }
});
`;
    
    await fs.writeFile(scriptPath, workerCode);
  }

  _getAvailableWorker() {
    return this.availableWorkers.shift() || null;
  }

  _releaseWorker(worker) {
    if (this.workerPool.includes(worker)) {
      this.availableWorkers.push(worker);
    }
  }

  async _terminateWorkerPool() {
    for (const worker of this.workerPool) {
      try {
        await worker.terminate();
      } catch (error) {
        this.logger.warn('Failed to terminate worker:', error);
      }
    }
    
    this.workerPool.length = 0;
    this.availableWorkers.length = 0;
  }

  _startCacheCleanup() {
    this.cleanupInterval = setInterval(() => {
      this._performCacheCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  _performCacheCleanup() {
    const expired = this._removeExpiredTemplates();
    if (expired > 0) {
      this.logger.debug(`Cache cleanup: removed ${expired} expired templates`);
    }
  }

  _removeExpiredTemplates() {
    let removed = 0;
    const now = Date.now();
    
    for (const [templateId, metadata] of this.templateMetadata) {
      if (now - metadata.timestamp > this.config.cacheTTL) {
        this.compiledTemplates.delete(templateId);
        this.templateMetadata.delete(templateId);
        removed++;
      }
    }
    
    return removed;
  }

  _exceedsCacheSizeLimit() {
    // Simple size check based on number of entries
    return this.compiledTemplates.size > 1000; // Configurable limit
  }

  async _evictLeastRecentlyUsed() {
    const entries = Array.from(this.templateMetadata.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    const toEvict = Math.ceil(entries.length * 0.1); // Evict 10%
    
    for (let i = 0; i < toEvict; i++) {
      const [templateId] = entries[i];
      this.compiledTemplates.delete(templateId);
      this.templateMetadata.delete(templateId);
    }
  }

  _updateCompilationStats(templateId, metadata) {
    this.compilationStats.set(templateId, {
      compilationTime: metadata.compilationTime,
      timestamp: metadata.timestamp,
      templatePath: metadata.templatePath
    });
  }

  async _updateDependencyGraph(templatePath, compiledTemplate) {
    const dependencies = compiledTemplate.metadata.analysis?.dependencies || [];
    this.dependencyGraph.set(templatePath, dependencies.map(d => d.path));
  }

  _invalidateDependentTemplates(templatePath) {
    let invalidated = 0;
    
    for (const [path, dependencies] of this.dependencyGraph) {
      if (dependencies.includes(templatePath)) {
        this.invalidateTemplate(path);
        invalidated++;
      }
    }
    
    if (invalidated > 0) {
      this.logger.debug(`Invalidated ${invalidated} dependent templates for: ${templatePath}`);
    }
  }

  _analyzePreCompilationResults(results) {
    const successful = Array.from(results.values()).filter(r => !r.error).length;
    const total = results.size;
    
    return {
      effectiveness: Math.round((successful / total) * 100),
      successful,
      failed: total - successful,
      total
    };
  }

  _calculateMemoryUsage() {
    let totalSize = 0;
    
    for (const metadata of this.templateMetadata.values()) {
      totalSize += metadata.size || 0;
    }
    
    return {
      totalBytes: totalSize,
      totalMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      averagePerTemplate: totalSize / this.compiledTemplates.size || 0
    };
  }

  _calculateWorkerUtilization() {
    if (!this.config.enableWorkerPool) return 0;
    
    const activeWorkers = this.workerPool.length - this.availableWorkers.length;
    return Math.round((activeWorkers / this.workerPool.length) * 100);
  }

  async _compressTemplates() {
    // Placeholder for template compression logic
    return 0;
  }

  _shouldReorganizeWorkerPool() {
    const utilization = this._calculateWorkerUtilization();
    return utilization > 90 || utilization < 10;
  }

  async _reorganizeWorkerPool() {
    // Placeholder for worker pool reorganization logic
  }

  _calculateOptimizationImprovement(before, after) {
    const memoryImprovement = (before.memoryUsage.totalMB - after.memoryUsage.totalMB) / before.memoryUsage.totalMB;
    const hitRateImprovement = after.hitRate - before.hitRate;
    
    return Math.round((memoryImprovement + hitRateImprovement) * 50); // Scale to percentage
  }
}

export default TemplateCacheOptimizer;