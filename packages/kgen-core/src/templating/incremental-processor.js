/**
 * KGEN Incremental Template Processor
 * 
 * Processes templates incrementally based on dependency changes,
 * minimizing unnecessary recompilation and rendering.
 * 
 * @author KGEN Advanced Enhancement Swarm - Agent #7
 * @version 2.0.0
 */

import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * Processing states
 */
export const ProcessingState = {
  IDLE: 'idle',
  ANALYZING: 'analyzing',
  COMPILING: 'compiling',
  RENDERING: 'rendering',
  WRITING: 'writing',
  COMPLETED: 'completed',
  ERROR: 'error'
};

/**
 * Change impact levels
 */
export const ImpactLevel = {
  LOW: 'low',       // Minimal impact, localized changes
  MEDIUM: 'medium', // Moderate impact, affects related templates
  HIGH: 'high',     // High impact, affects many templates
  CRITICAL: 'critical' // Critical impact, requires full rebuild
};

/**
 * Processing priorities
 */
export const Priority = {
  IMMEDIATE: 0,  // Process immediately
  HIGH: 1,       // High priority
  NORMAL: 2,     // Normal priority
  LOW: 3,        // Low priority
  BATCH: 4       // Process in batch
};

/**
 * Incremental Template Processor
 */
export class IncrementalTemplateProcessor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      templatesDir: options.templatesDir || '_templates',
      outputDir: options.outputDir || 'src',
      batchSize: options.batchSize || 10,
      maxConcurrency: options.maxConcurrency || 4,
      enableParallel: options.enableParallel !== false,
      enableOptimizations: options.enableOptimizations !== false,
      stateFile: options.stateFile || '.kgen/incremental-state.json',
      debounceTime: options.debounceTime || 100,
      progressReporting: options.progressReporting !== false,
      ...options
    };

    // Processing state
    this.state = ProcessingState.IDLE;
    this.processingQueue = new Map();
    this.activeJobs = new Map();
    this.completedJobs = new Map();
    
    // Dependencies
    this.dependencyGraph = options.dependencyGraph;
    this.compiler = options.compiler;
    this.renderer = options.renderer;
    this.memoizationSystem = options.memoizationSystem;

    // State tracking
    this.lastProcessedHashes = new Map();
    this.outputFileHashes = new Map();
    this.processingSemaphore = new ProcessingSemaphore(this.options.maxConcurrency);
    
    // Debouncing
    this.debounceTimers = new Map();
    
    // Statistics
    this.stats = {
      totalProcessed: 0,
      incrementalSaves: 0,
      fullRebuild: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      templatesSkipped: 0,
      parallelJobs: 0,
      queueSize: 0
    };

    // Load previous state
    this.loadState();
  }

  /**
   * Process template changes incrementally
   */
  async processChanges(changes) {
    if (!Array.isArray(changes)) {
      changes = [changes];
    }

    this.emit('processingStarted', { changes });

    try {
      // Analyze impact of changes
      const analysis = await this.analyzeChanges(changes);
      
      // Group changes by impact and priority
      const grouped = this.groupChangesByPriority(analysis);
      
      // Process changes in order of priority
      const results = [];
      for (const [priority, changeGroup] of grouped) {
        const groupResults = await this.processChangeGroup(changeGroup, priority);
        results.push(...groupResults);
      }

      // Update state
      await this.saveState();

      this.emit('processingCompleted', { results, stats: this.getStats() });
      
      return results;

    } catch (error) {
      this.state = ProcessingState.ERROR;
      this.emit('processingError', { error, changes });
      throw error;
    }
  }

  /**
   * Analyze changes to determine impact
   */
  async analyzeChanges(changes) {
    this.state = ProcessingState.ANALYZING;
    
    const analysis = {
      changes: [],
      impactLevel: ImpactLevel.LOW,
      affectedTemplates: new Set(),
      requiredActions: new Set()
    };

    for (const change of changes) {
      const changeAnalysis = await this.analyzeChange(change);
      analysis.changes.push(changeAnalysis);
      
      // Merge affected templates
      for (const template of changeAnalysis.affectedTemplates) {
        analysis.affectedTemplates.add(template);
      }
      
      // Update overall impact level
      if (this.getImpactPriority(changeAnalysis.impactLevel) > 
          this.getImpactPriority(analysis.impactLevel)) {
        analysis.impactLevel = changeAnalysis.impactLevel;
      }
      
      // Merge required actions
      for (const action of changeAnalysis.requiredActions) {
        analysis.requiredActions.add(action);
      }
    }

    this.emit('analysisCompleted', analysis);
    
    return analysis;
  }

  /**
   * Analyze individual change
   */
  async analyzeChange(change) {
    const {
      templatePath,
      changeType,
      previousHash,
      currentHash
    } = change;

    const analysis = {
      templatePath,
      changeType,
      impactLevel: ImpactLevel.LOW,
      affectedTemplates: new Set([templatePath]),
      requiredActions: new Set(['compile', 'render']),
      priority: Priority.NORMAL
    };

    try {
      // Get template dependencies
      if (this.dependencyGraph) {
        const dependents = this.dependencyGraph.getDependents(templatePath);
        for (const dependent of dependents) {
          analysis.affectedTemplates.add(dependent);
        }
        
        // Determine impact level based on number of dependents
        if (dependents.length === 0) {
          analysis.impactLevel = ImpactLevel.LOW;
        } else if (dependents.length < 5) {
          analysis.impactLevel = ImpactLevel.MEDIUM;
        } else if (dependents.length < 20) {
          analysis.impactLevel = ImpactLevel.HIGH;
        } else {
          analysis.impactLevel = ImpactLevel.CRITICAL;
        }
      }

      // Analyze content changes if hashes are available
      if (previousHash && currentHash && previousHash !== currentHash) {
        const contentAnalysis = await this.analyzeContentChanges(templatePath, previousHash, currentHash);
        if (contentAnalysis.requiresFullRebuild) {
          analysis.impactLevel = ImpactLevel.CRITICAL;
          analysis.requiredActions.add('fullRebuild');
        }
      }

      // Set priority based on impact
      analysis.priority = this.determinePriority(analysis);

    } catch (error) {
      console.warn(`Change analysis failed for ${templatePath}: ${error.message}`);
      // Default to high impact for safety
      analysis.impactLevel = ImpactLevel.HIGH;
      analysis.priority = Priority.HIGH;
    }

    return analysis;
  }

  /**
   * Analyze content changes between versions
   */
  async analyzeContentChanges(templatePath, previousHash, currentHash) {
    const analysis = {
      requiresFullRebuild: false,
      changedSections: [],
      addedDependencies: [],
      removedDependencies: []
    };

    try {
      // This is a simplified analysis - in production, you'd do more sophisticated diff analysis
      const fullPath = join(this.options.templatesDir, templatePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Check if template structure changed (includes, extends, etc.)
      const structuralElements = [
        /\{\%\s*extends\s+/g,
        /\{\%\s*include\s+/g,
        /\{\%\s*import\s+/g,
        /\{\%\s*block\s+/g
      ];

      for (const pattern of structuralElements) {
        if (pattern.test(content)) {
          analysis.requiresFullRebuild = true;
          break;
        }
      }

    } catch (error) {
      // If we can't analyze, assume full rebuild needed
      analysis.requiresFullRebuild = true;
    }

    return analysis;
  }

  /**
   * Group changes by processing priority
   */
  groupChangesByPriority(analysis) {
    const grouped = new Map();

    for (const change of analysis.changes) {
      if (!grouped.has(change.priority)) {
        grouped.set(change.priority, []);
      }
      grouped.get(change.priority).push(change);
    }

    // Sort by priority (lower number = higher priority)
    return new Map([...grouped.entries()].sort((a, b) => a[0] - b[0]));
  }

  /**
   * Process a group of changes with the same priority
   */
  async processChangeGroup(changes, priority) {
    const results = [];

    if (this.options.enableParallel && changes.length > 1) {
      // Process in parallel
      const batches = this.createBatches(changes, this.options.batchSize);
      
      for (const batch of batches) {
        const batchPromises = batch.map(change => 
          this.processingSemaphore.acquire(() => this.processSingleChange(change))
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error('Processing failed:', result.reason);
          }
        }
      }
    } else {
      // Process sequentially
      for (const change of changes) {
        try {
          const result = await this.processSingleChange(change);
          results.push(result);
        } catch (error) {
          console.error(`Processing failed for ${change.templatePath}:`, error);
        }
      }
    }

    return results;
  }

  /**
   * Process a single template change
   */
  async processSingleChange(change) {
    const startTime = performance.now();
    const { templatePath } = change;

    try {
      // Check if we can skip processing
      if (await this.canSkipProcessing(change)) {
        this.stats.templatesSkipped++;
        return {
          templatePath,
          action: 'skipped',
          reason: 'No changes detected',
          processingTime: performance.now() - startTime
        };
      }

      const jobId = `${templatePath}-${this.getDeterministicTimestamp()}`;
      this.activeJobs.set(jobId, {
        templatePath,
        startTime,
        state: ProcessingState.COMPILING
      });

      this.emit('jobStarted', { jobId, templatePath });

      // Compile template if needed
      let compiled = null;
      if (change.requiredActions.has('compile') || change.requiredActions.has('fullRebuild')) {
        this.state = ProcessingState.COMPILING;
        
        const templateContent = await fs.readFile(
          join(this.options.templatesDir, templatePath), 
          'utf-8'
        );
        
        compiled = await this.compiler.compileTemplate(templatePath, templateContent);
        
        // Invalidate memoization cache
        if (this.memoizationSystem) {
          await this.memoizationSystem.invalidateByDependency(templatePath);
        }
      }

      // Render template if needed
      let rendered = null;
      if (change.requiredActions.has('render')) {
        this.state = ProcessingState.RENDERING;
        
        // Get context for rendering - this would come from your context provider
        const context = await this.getTemplateContext(templatePath);
        
        rendered = await this.renderer.render(templatePath, context);
      }

      // Write output if needed
      let written = null;
      if (rendered && rendered.outputPath) {
        this.state = ProcessingState.WRITING;
        written = await this.writeOutput(rendered);
      }

      const processingTime = performance.now() - startTime;
      this.updateStats(processingTime);

      // Update hashes for next incremental check
      if (rendered && rendered.content) {
        const contentHash = this.createHash(rendered.content);
        this.outputFileHashes.set(templatePath, contentHash);
      }

      const result = {
        templatePath,
        action: 'processed',
        compiled: !!compiled,
        rendered: !!rendered,
        written: !!written,
        processingTime
      };

      this.activeJobs.delete(jobId);
      this.completedJobs.set(jobId, result);

      this.emit('jobCompleted', { jobId, result });

      return result;

    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      const result = {
        templatePath,
        action: 'error',
        error: error.message,
        processingTime
      };

      this.emit('jobError', { templatePath, error });
      
      return result;
    }
  }

  /**
   * Check if processing can be skipped
   */
  async canSkipProcessing(change) {
    const { templatePath } = change;

    try {
      // Check if template file exists
      const fullPath = join(this.options.templatesDir, templatePath);
      if (!existsSync(fullPath)) {
        return false;
      }

      // Check content hash
      const content = await fs.readFile(fullPath, 'utf-8');
      const currentHash = this.createHash(content);
      const lastHash = this.lastProcessedHashes.get(templatePath);

      if (lastHash === currentHash) {
        // Check if output still exists and is up to date
        const outputExists = await this.checkOutputExists(templatePath);
        if (outputExists) {
          return true;
        }
      }

      // Update hash for future checks
      this.lastProcessedHashes.set(templatePath, currentHash);
      
      return false;

    } catch (error) {
      // If we can't determine, process it to be safe
      return false;
    }
  }

  /**
   * Check if output file exists and is up to date
   */
  async checkOutputExists(templatePath) {
    // This would check if the expected output file exists
    // Implementation depends on your output structure
    try {
      const expectedOutputPath = this.getExpectedOutputPath(templatePath);
      if (!expectedOutputPath) return false;
      
      return existsSync(expectedOutputPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get expected output path for template
   */
  getExpectedOutputPath(templatePath) {
    // This would derive the expected output path
    // Implementation depends on your naming conventions
    const outputPath = templatePath.replace(/\.(njk|j2)$/, '');
    return join(this.options.outputDir, outputPath);
  }

  /**
   * Get template context
   */
  async getTemplateContext(templatePath) {
    // This would get the appropriate context for the template
    // Implementation depends on your context management
    return {};
  }

  /**
   * Write rendered output
   */
  async writeOutput(rendered) {
    if (!rendered.outputPath) {
      throw new Error('No output path specified');
    }

    // Ensure output directory exists
    await fs.mkdir(dirname(rendered.outputPath), { recursive: true });

    // Write content
    await fs.writeFile(rendered.outputPath, rendered.content);

    return {
      path: rendered.outputPath,
      size: rendered.content.length
    };
  }

  /**
   * Create batches for parallel processing
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Determine processing priority
   */
  determinePriority(analysis) {
    switch (analysis.impactLevel) {
      case ImpactLevel.CRITICAL:
        return Priority.IMMEDIATE;
      case ImpactLevel.HIGH:
        return Priority.HIGH;
      case ImpactLevel.MEDIUM:
        return Priority.NORMAL;
      case ImpactLevel.LOW:
      default:
        return Priority.LOW;
    }
  }

  /**
   * Get impact priority for comparison
   */
  getImpactPriority(impact) {
    switch (impact) {
      case ImpactLevel.LOW: return 1;
      case ImpactLevel.MEDIUM: return 2;
      case ImpactLevel.HIGH: return 3;
      case ImpactLevel.CRITICAL: return 4;
      default: return 1;
    }
  }

  /**
   * Create content hash
   */
  createHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Update processing statistics
   */
  updateStats(processingTime) {
    this.stats.totalProcessed++;
    this.stats.totalProcessingTime += processingTime;
    this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.totalProcessed;
  }

  /**
   * Load processing state
   */
  async loadState() {
    try {
      if (existsSync(this.options.stateFile)) {
        const state = JSON.parse(await fs.readFile(this.options.stateFile, 'utf-8'));
        
        if (state.hashes) {
          this.lastProcessedHashes = new Map(Object.entries(state.hashes));
        }
        
        if (state.outputHashes) {
          this.outputFileHashes = new Map(Object.entries(state.outputHashes));
        }
        
        if (state.stats) {
          this.stats = { ...this.stats, ...state.stats };
        }
      }
    } catch (error) {
      console.warn(`Failed to load incremental state: ${error.message}`);
    }
  }

  /**
   * Save processing state
   */
  async saveState() {
    try {
      const state = {
        hashes: Object.fromEntries(this.lastProcessedHashes),
        outputHashes: Object.fromEntries(this.outputFileHashes),
        stats: this.stats,
        savedAt: this.getDeterministicDate().toISOString()
      };

      await fs.mkdir(dirname(this.options.stateFile), { recursive: true });
      await fs.writeFile(this.options.stateFile, JSON.stringify(state, null, 2));

    } catch (error) {
      console.warn(`Failed to save incremental state: ${error.message}`);
    }
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.processingQueue.size,
      activeJobs: this.activeJobs.size,
      completedJobs: this.completedJobs.size,
      state: this.state
    };
  }

  /**
   * Clear state and reset
   */
  async reset() {
    this.lastProcessedHashes.clear();
    this.outputFileHashes.clear();
    this.processingQueue.clear();
    this.activeJobs.clear();
    this.completedJobs.clear();
    
    this.stats = {
      totalProcessed: 0,
      incrementalSaves: 0,
      fullRebuild: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      templatesSkipped: 0,
      parallelJobs: 0,
      queueSize: 0
    };

    // Delete state file
    try {
      if (existsSync(this.options.stateFile)) {
        await fs.unlink(this.options.stateFile);
      }
    } catch (error) {
      console.warn(`Failed to delete state file: ${error.message}`);
    }
  }

  /**
   * Stop processing and cleanup
   */
  async stop() {
    this.state = ProcessingState.IDLE;
    
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Save final state
    await this.saveState();
  }
}

/**
 * Processing Semaphore for concurrency control
 */
class ProcessingSemaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }

  async acquire(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.current >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.current++;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.current--;
      this.process();
    }
  }
}

/**
 * Factory function to create incremental processor
 */
export function createIncrementalProcessor(options = {}) {
  return new IncrementalTemplateProcessor(options);
}

export default IncrementalTemplateProcessor;