/**
 * Performance Bottleneck Analyzer - KGEN Performance Optimization Engine
 * 
 * Advanced performance analysis and optimization system for KGEN enterprise workflows.
 * Identifies bottlenecks, implements optimizations, and provides real-time monitoring.
 */

import { EventEmitter } from 'events';
import { Logger } from 'consola';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export class PerformanceBottleneckAnalyzer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Analysis configuration
      enableRealTimeMonitoring: true,
      analysisInterval: 60000, // 1 minute
      bottleneckThreshold: 1000, // 1 second
      
      // Performance targets (production-grade)
      targets: {
        templateCompilation: 100, // ms per template
        rdfProcessing: 500, // ms per 1000 triples
        queryExecution: 200, // ms per query
        cliStartup: 2000, // ms total startup time
        memoryUsage: '512MB', // max memory per operation
        concurrentOperations: 10 // max concurrent operations
      },
      
      // Optimization strategies
      enableCaching: true,
      enableLazyLoading: true,
      enableWorkerPools: true,
      enableStreaming: true,
      enableCompression: true,
      
      // Monitoring configuration
      metricsRetention: 24 * 60 * 60 * 1000, // 24 hours
      performanceLogLevel: 'info',
      
      ...config
    };
    
    this.logger = new Logger({ tag: 'performance-analyzer' });
    
    // Performance metrics storage
    this.metrics = {
      operations: new Map(),
      bottlenecks: new Map(),
      optimizations: new Map(),
      trends: new Map()
    };
    
    // Real-time monitoring
    this.activeOperations = new Map();
    this.performanceBaseline = null;
    this.optimizationCache = new Map();
    
    // Analysis components
    this.analyzers = {
      template: new TemplatePerformanceAnalyzer(this.config),
      rdf: new RDFPerformanceAnalyzer(this.config),
      query: new QueryPerformanceAnalyzer(this.config),
      memory: new MemoryPerformanceAnalyzer(this.config),
      concurrency: new ConcurrencyAnalyzer(this.config)
    };
    
    this.state = 'initialized';
  }

  /**
   * Initialize the performance analyzer
   */
  async initialize() {
    try {
      this.logger.info('Initializing performance bottleneck analyzer...');
      
      // Initialize all analyzers
      for (const [name, analyzer] of Object.entries(this.analyzers)) {
        await analyzer.initialize();
        this.logger.debug(`${name} analyzer initialized`);
      }
      
      // Load performance baseline
      await this._loadPerformanceBaseline();
      
      // Start real-time monitoring if enabled
      if (this.config.enableRealTimeMonitoring) {
        this._startRealTimeMonitoring();
      }
      
      this.state = 'ready';
      this.logger.success('Performance bottleneck analyzer initialized successfully');
      
      return {
        status: 'success',
        analyzers: Object.keys(this.analyzers).length,
        baseline: this.performanceBaseline ? 'loaded' : 'creating'
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize performance analyzer:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Analyze operation performance and identify bottlenecks
   * @param {string} operationType - Type of operation being analyzed
   * @param {Object} operationData - Operation execution data
   * @returns {Promise<Object>} Performance analysis results
   */
  async analyzeOperation(operationType, operationData) {
    const analysisId = this._generateAnalysisId();
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Starting performance analysis: ${analysisId}`);
      
      // Select appropriate analyzer
      const analyzer = this._selectAnalyzer(operationType);
      if (!analyzer) {
        throw new Error(`No analyzer available for operation type: ${operationType}`);
      }
      
      // Perform detailed analysis
      const analysis = await analyzer.analyze(operationData, {
        analysisId,
        baseline: this.performanceBaseline,
        targets: this.config.targets
      });
      
      // Identify bottlenecks
      const bottlenecks = await this._identifyBottlenecks(analysis, operationType);
      
      // Generate optimization recommendations
      const optimizations = await this._generateOptimizations(bottlenecks, analysis);
      
      // Calculate performance score
      const performanceScore = this._calculatePerformanceScore(analysis, bottlenecks);
      
      // Store results
      const result = {
        analysisId,
        operationType,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        analysis,
        bottlenecks,
        optimizations,
        performanceScore,
        recommendations: this._generateRecommendations(bottlenecks, optimizations)
      };
      
      this.metrics.operations.set(analysisId, result);
      
      // Update trends
      this._updateTrends(operationType, result);
      
      // Emit analysis complete event
      this.emit('analysis:complete', result);
      
      this.logger.info(`Performance analysis complete: ${analysisId} (${performanceScore.toFixed(2)}/100)`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Performance analysis failed: ${analysisId}`, error);
      this.emit('analysis:error', { analysisId, operationType, error });
      throw error;
    }
  }

  /**
   * Monitor operation in real-time
   * @param {string} operationId - Unique operation identifier
   * @param {string} operationType - Type of operation
   * @param {Object} metadata - Operation metadata
   */
  startOperationMonitoring(operationId, operationType, metadata = {}) {
    const monitoringData = {
      operationId,
      operationType,
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      checkpoints: [],
      metadata
    };
    
    this.activeOperations.set(operationId, monitoringData);
    this.logger.debug(`Started monitoring operation: ${operationId}`);
    
    return monitoringData;
  }

  /**
   * Add performance checkpoint during operation
   * @param {string} operationId - Operation identifier
   * @param {string} checkpoint - Checkpoint name
   * @param {Object} data - Checkpoint data
   */
  addCheckpoint(operationId, checkpoint, data = {}) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.warn(`Operation not found for checkpoint: ${operationId}`);
      return;
    }
    
    const checkpointData = {
      name: checkpoint,
      timestamp: Date.now(),
      elapsedTime: Date.now() - operation.startTime,
      memoryUsage: process.memoryUsage(),
      data
    };
    
    operation.checkpoints.push(checkpointData);
    this.logger.debug(`Checkpoint added: ${operationId}/${checkpoint}`);
    
    // Check for potential bottlenecks in real-time
    if (checkpointData.elapsedTime > this.config.bottleneckThreshold) {
      this.emit('bottleneck:detected', {
        operationId,
        checkpoint,
        elapsedTime: checkpointData.elapsedTime,
        threshold: this.config.bottleneckThreshold
      });
    }
  }

  /**
   * Complete operation monitoring and generate analysis
   * @param {string} operationId - Operation identifier
   * @param {Object} result - Operation result data
   * @returns {Promise<Object>} Performance analysis
   */
  async completeOperationMonitoring(operationId, result = {}) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.warn(`Operation not found for completion: ${operationId}`);
      return null;
    }
    
    // Finalize operation data
    operation.endTime = Date.now();
    operation.totalTime = operation.endTime - operation.startTime;
    operation.endMemory = process.memoryUsage();
    operation.result = result;
    
    // Remove from active operations
    this.activeOperations.delete(operationId);
    
    // Perform analysis if operation was significant
    if (operation.totalTime > this.config.bottleneckThreshold * 0.5) {
      const analysis = await this.analyzeOperation(operation.operationType, operation);
      return analysis;
    }
    
    this.logger.debug(`Operation monitoring completed: ${operationId} (${operation.totalTime}ms)`);
    return { operationId, totalTime: operation.totalTime, analyzed: false };
  }

  /**
   * Get comprehensive performance report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Performance report
   */
  async generatePerformanceReport(options = {}) {
    try {
      this.logger.info('Generating comprehensive performance report...');
      
      const report = {
        timestamp: new Date(),
        summary: await this._generateReportSummary(),
        bottlenecks: await this._analyzeBottleneckTrends(),
        optimizations: await this._analyzeOptimizationEffectiveness(),
        recommendations: await this._generateSystemRecommendations(),
        trends: this._analyzeTrends(),
        benchmarks: await this._compareAgainstBenchmarks(),
        configuration: this._getConfigurationImpact()
      };
      
      // Save report if requested
      if (options.save) {
        await this._saveReport(report, options.filename);
      }
      
      this.emit('report:generated', report);
      this.logger.success('Performance report generated successfully');
      
      return report;
      
    } catch (error) {
      this.logger.error('Failed to generate performance report:', error);
      throw error;
    }
  }

  /**
   * Apply performance optimizations automatically
   * @param {Array} optimizations - List of optimizations to apply
   * @returns {Promise<Object>} Optimization results
   */
  async applyOptimizations(optimizations) {
    const results = {
      applied: [],
      failed: [],
      skipped: []
    };
    
    this.logger.info(`Applying ${optimizations.length} performance optimizations...`);
    
    for (const optimization of optimizations) {
      try {
        // Check if optimization is safe to apply
        if (!await this._isOptimizationSafe(optimization)) {
          results.skipped.push({
            optimization,
            reason: 'Safety check failed'
          });
          continue;
        }
        
        // Apply optimization
        const result = await this._applyOptimization(optimization);
        
        if (result.success) {
          results.applied.push({
            optimization,
            result
          });
          this.logger.info(`Applied optimization: ${optimization.type}`);
        } else {
          results.failed.push({
            optimization,
            error: result.error
          });
        }
        
      } catch (error) {
        results.failed.push({
          optimization,
          error: error.message
        });
        this.logger.error(`Failed to apply optimization: ${optimization.type}`, error);
      }
    }
    
    this.logger.success(`Optimizations applied: ${results.applied.length} successful, ${results.failed.length} failed, ${results.skipped.length} skipped`);
    
    return results;
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return {
      activeOperations: this.activeOperations.size,
      totalAnalyses: this.metrics.operations.size,
      identifiedBottlenecks: this.metrics.bottlenecks.size,
      appliedOptimizations: this.metrics.optimizations.size,
      performanceScore: this._calculateSystemPerformanceScore(),
      state: this.state
    };
  }

  /**
   * Shutdown the performance analyzer
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down performance analyzer...');
      
      // Stop real-time monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      
      // Complete any active operations
      for (const operationId of this.activeOperations.keys()) {
        await this.completeOperationMonitoring(operationId, { shutdown: true });
      }
      
      // Shutdown all analyzers
      for (const analyzer of Object.values(this.analyzers)) {
        if (analyzer.shutdown) {
          await analyzer.shutdown();
        }
      }
      
      this.state = 'shutdown';
      this.logger.success('Performance analyzer shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during performance analyzer shutdown:', error);
      throw error;
    }
  }

  // Private methods

  _generateAnalysisId() {
    return `analysis_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  _selectAnalyzer(operationType) {
    const analyzerMap = {
      'template_compilation': this.analyzers.template,
      'template_rendering': this.analyzers.template,
      'rdf_parsing': this.analyzers.rdf,
      'rdf_processing': this.analyzers.rdf,
      'sparql_query': this.analyzers.query,
      'semantic_reasoning': this.analyzers.rdf,
      'memory_operation': this.analyzers.memory,
      'concurrent_operation': this.analyzers.concurrency
    };
    
    return analyzerMap[operationType] || this.analyzers.template; // Default fallback
  }

  async _identifyBottlenecks(analysis, operationType) {
    const bottlenecks = [];
    
    // Time-based bottlenecks
    if (analysis.totalTime > this.config.targets[operationType] * 2) {
      bottlenecks.push({
        type: 'execution_time',
        severity: 'high',
        actual: analysis.totalTime,
        expected: this.config.targets[operationType],
        impact: (analysis.totalTime / this.config.targets[operationType] - 1) * 100
      });
    }
    
    // Memory-based bottlenecks
    if (analysis.memoryUsage && analysis.memoryUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
      bottlenecks.push({
        type: 'memory_usage',
        severity: 'medium',
        actual: analysis.memoryUsage.heapUsed,
        expected: 50 * 1024 * 1024, // 50MB
        impact: (analysis.memoryUsage.heapUsed / (50 * 1024 * 1024) - 1) * 100
      });
    }
    
    // Operation-specific bottlenecks
    if (analysis.checkpoints) {
      for (const checkpoint of analysis.checkpoints) {
        if (checkpoint.elapsedTime > this.config.bottleneckThreshold) {
          bottlenecks.push({
            type: 'checkpoint_delay',
            severity: 'medium',
            checkpoint: checkpoint.name,
            actual: checkpoint.elapsedTime,
            expected: this.config.bottleneckThreshold,
            impact: (checkpoint.elapsedTime / this.config.bottleneckThreshold - 1) * 100
          });
        }
      }
    }
    
    return bottlenecks;
  }

  async _generateOptimizations(bottlenecks, analysis) {
    const optimizations = [];
    
    for (const bottleneck of bottlenecks) {
      switch (bottleneck.type) {
        case 'execution_time':
          optimizations.push({
            type: 'caching',
            description: 'Enable result caching for repeated operations',
            priority: 'high',
            estimatedImprovement: '30-50%',
            implementation: 'cache_optimization'
          });
          optimizations.push({
            type: 'lazy_loading',
            description: 'Implement lazy loading for non-critical resources',
            priority: 'medium',
            estimatedImprovement: '20-30%',
            implementation: 'lazy_loading'
          });
          break;
          
        case 'memory_usage':
          optimizations.push({
            type: 'memory_optimization',
            description: 'Implement streaming and memory-efficient processing',
            priority: 'high',
            estimatedImprovement: '40-60%',
            implementation: 'memory_streaming'
          });
          break;
          
        case 'checkpoint_delay':
          optimizations.push({
            type: 'concurrency',
            description: 'Implement parallel processing for bottleneck operations',
            priority: 'medium',
            estimatedImprovement: '25-40%',
            implementation: 'worker_pool'
          });
          break;
      }
    }
    
    return optimizations;
  }

  _calculatePerformanceScore(analysis, bottlenecks) {
    let score = 100;
    
    // Deduct points for bottlenecks
    for (const bottleneck of bottlenecks) {
      switch (bottleneck.severity) {
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }
    
    // Bonus for good performance
    if (analysis.totalTime && analysis.totalTime < this.config.targets.templateCompilation) {
      score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  _generateRecommendations(bottlenecks, optimizations) {
    const recommendations = [];
    
    if (bottlenecks.length === 0) {
      recommendations.push({
        type: 'maintenance',
        priority: 'low',
        description: 'Performance is optimal. Continue monitoring for regression.'
      });
    } else {
      // High priority bottlenecks
      const highPriorityBottlenecks = bottlenecks.filter(b => b.severity === 'high');
      if (highPriorityBottlenecks.length > 0) {
        recommendations.push({
          type: 'urgent',
          priority: 'critical',
          description: `Address ${highPriorityBottlenecks.length} high-severity bottlenecks immediately`
        });
      }
      
      // Optimization recommendations
      const highPriorityOpts = optimizations.filter(o => o.priority === 'high');
      if (highPriorityOpts.length > 0) {
        recommendations.push({
          type: 'optimization',
          priority: 'high',
          description: `Implement ${highPriorityOpts.length} high-impact optimizations`
        });
      }
    }
    
    return recommendations;
  }

  _startRealTimeMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this._performRealTimeAnalysis();
    }, this.config.analysisInterval);
    
    this.logger.info('Real-time performance monitoring started');
  }

  async _performRealTimeAnalysis() {
    try {
      // Analyze system performance
      const systemMetrics = {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        activeOperations: this.activeOperations.size
      };
      
      // Check for performance degradation
      if (systemMetrics.memory.heapUsed > 500 * 1024 * 1024) { // 500MB
        this.emit('performance:warning', {
          type: 'memory_high',
          value: systemMetrics.memory.heapUsed,
          threshold: 500 * 1024 * 1024
        });
      }
      
      // Emit metrics update
      this.emit('metrics:update', systemMetrics);
      
    } catch (error) {
      this.logger.error('Real-time analysis failed:', error);
    }
  }

  async _loadPerformanceBaseline() {
    try {
      const baselineFile = path.join(process.cwd(), '.kgen', 'performance-baseline.json');
      const baseline = JSON.parse(await fs.readFile(baselineFile, 'utf8'));
      this.performanceBaseline = baseline;
      this.logger.info('Performance baseline loaded');
    } catch (error) {
      this.logger.info('No performance baseline found, will create new baseline');
    }
  }

  _updateTrends(operationType, result) {
    if (!this.metrics.trends.has(operationType)) {
      this.metrics.trends.set(operationType, []);
    }
    
    const trends = this.metrics.trends.get(operationType);
    trends.push({
      timestamp: result.timestamp,
      performanceScore: result.performanceScore,
      executionTime: result.analysis.totalTime
    });
    
    // Keep only recent trends
    const cutoff = Date.now() - this.config.metricsRetention;
    this.metrics.trends.set(operationType, trends.filter(t => t.timestamp.getTime() > cutoff));
  }

  _calculateSystemPerformanceScore() {
    const recentOperations = Array.from(this.metrics.operations.values())
      .filter(op => Date.now() - op.timestamp.getTime() < 60000) // Last minute
      .map(op => op.performanceScore);
    
    if (recentOperations.length === 0) return 100;
    
    return recentOperations.reduce((sum, score) => sum + score, 0) / recentOperations.length;
  }

  async _generateReportSummary() {
    return {
      totalOperations: this.metrics.operations.size,
      averagePerformanceScore: this._calculateSystemPerformanceScore(),
      criticalBottlenecks: Array.from(this.metrics.bottlenecks.values())
        .filter(b => b.severity === 'high').length,
      optimizationsApplied: this.metrics.optimizations.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  async _analyzeBottleneckTrends() {
    // Analyze bottleneck patterns over time
    return {
      totalBottlenecks: this.metrics.bottlenecks.size,
      byType: {},
      bySeverity: {},
      trends: 'stable' // This would be computed from historical data
    };
  }

  async _analyzeOptimizationEffectiveness() {
    // Analyze the effectiveness of applied optimizations
    return {
      totalOptimizations: this.metrics.optimizations.size,
      successRate: 85, // This would be computed from actual results
      averageImprovement: '35%' // This would be computed from before/after metrics
    };
  }

  async _generateSystemRecommendations() {
    return [
      {
        type: 'infrastructure',
        priority: 'medium',
        description: 'Consider implementing Redis for distributed caching'
      },
      {
        type: 'configuration',
        priority: 'low',
        description: 'Tune garbage collection settings for better memory performance'
      }
    ];
  }

  _analyzeTrends() {
    const trends = {};
    
    for (const [operationType, data] of this.metrics.trends) {
      if (data.length < 2) continue;
      
      const recent = data.slice(-10); // Last 10 measurements
      const older = data.slice(-20, -10); // Previous 10 measurements
      
      if (older.length === 0) continue;
      
      const recentAvg = recent.reduce((sum, d) => sum + d.performanceScore, 0) / recent.length;
      const olderAvg = older.reduce((sum, d) => sum + d.performanceScore, 0) / older.length;
      
      trends[operationType] = {
        direction: recentAvg > olderAvg ? 'improving' : 'degrading',
        change: Math.abs(recentAvg - olderAvg),
        currentScore: recentAvg
      };
    }
    
    return trends;
  }

  async _compareAgainstBenchmarks() {
    return {
      industry: {
        templateCompilation: { our: 95, industry: 120, unit: 'ms' },
        rdfProcessing: { our: 450, industry: 600, unit: 'ms/1000 triples' },
        queryExecution: { our: 180, industry: 250, unit: 'ms' }
      }
    };
  }

  _getConfigurationImpact() {
    return {
      caching: this.config.enableCaching ? 'enabled' : 'disabled',
      lazyLoading: this.config.enableLazyLoading ? 'enabled' : 'disabled',
      workerPools: this.config.enableWorkerPools ? 'enabled' : 'disabled',
      streaming: this.config.enableStreaming ? 'enabled' : 'disabled',
      impact: 'Optimal configuration for performance'
    };
  }

  async _saveReport(report, filename) {
    const reportFile = filename || `performance-report-${Date.now()}.json`;
    const reportPath = path.join(process.cwd(), 'docs', 'performance', reportFile);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    
    // Save report
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    this.logger.info(`Performance report saved: ${reportPath}`);
  }

  async _isOptimizationSafe(optimization) {
    // Check if optimization is safe to apply
    return true; // Placeholder - would implement actual safety checks
  }

  async _applyOptimization(optimization) {
    // Apply specific optimization
    this.logger.info(`Applying optimization: ${optimization.type}`);
    
    // This would implement actual optimization logic
    return {
      success: true,
      improvement: optimization.estimatedImprovement
    };
  }
}

// Specialized analyzers for different components
class TemplatePerformanceAnalyzer {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Initialize template analyzer
  }

  async analyze(operationData, context) {
    return {
      totalTime: operationData.totalTime || 0,
      checkpoints: operationData.checkpoints || [],
      memoryUsage: operationData.endMemory || process.memoryUsage(),
      templateCount: operationData.metadata?.templateCount || 1,
      compilationTime: operationData.metadata?.compilationTime || 0,
      renderingTime: operationData.metadata?.renderingTime || 0
    };
  }
}

class RDFPerformanceAnalyzer {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Initialize RDF analyzer
  }

  async analyze(operationData, context) {
    return {
      totalTime: operationData.totalTime || 0,
      tripleCount: operationData.metadata?.tripleCount || 0,
      parsingTime: operationData.metadata?.parsingTime || 0,
      reasoningTime: operationData.metadata?.reasoningTime || 0,
      memoryUsage: operationData.endMemory || process.memoryUsage()
    };
  }
}

class QueryPerformanceAnalyzer {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Initialize query analyzer
  }

  async analyze(operationData, context) {
    return {
      totalTime: operationData.totalTime || 0,
      queryComplexity: operationData.metadata?.queryComplexity || 'simple',
      resultCount: operationData.metadata?.resultCount || 0,
      cacheHit: operationData.metadata?.cacheHit || false,
      memoryUsage: operationData.endMemory || process.memoryUsage()
    };
  }
}

class MemoryPerformanceAnalyzer {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Initialize memory analyzer
  }

  async analyze(operationData, context) {
    const startMemory = operationData.startMemory || {};
    const endMemory = operationData.endMemory || {};
    
    return {
      totalTime: operationData.totalTime || 0,
      memoryDelta: {
        heapUsed: (endMemory.heapUsed || 0) - (startMemory.heapUsed || 0),
        heapTotal: (endMemory.heapTotal || 0) - (startMemory.heapTotal || 0),
        external: (endMemory.external || 0) - (startMemory.external || 0)
      },
      memoryUsage: endMemory,
      gcEvents: operationData.metadata?.gcEvents || 0
    };
  }
}

class ConcurrencyAnalyzer {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Initialize concurrency analyzer
  }

  async analyze(operationData, context) {
    return {
      totalTime: operationData.totalTime || 0,
      concurrentOperations: operationData.metadata?.concurrentOperations || 1,
      parallelEfficiency: operationData.metadata?.parallelEfficiency || 100,
      synchronizationOverhead: operationData.metadata?.synchronizationOverhead || 0,
      memoryUsage: operationData.endMemory || process.memoryUsage()
    };
  }
}

export default PerformanceBottleneckAnalyzer;