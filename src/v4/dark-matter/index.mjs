/**
 * @file Dark Matter Module Exports
 * @module unjucks-v4/dark-matter
 */

import { QueryAnalyzer } from './query-analyzer.mjs';
import { CriticalPathIdentifier } from './critical-path.mjs';
import { DarkMatterOptimizer } from './optimizer.mjs';
import { EdgeCaseValidator } from './edge-case-validator.mjs';

/**
 * Dark Matter Query System - Integrated 80/20 query optimization
 * 
 * @class DarkMatterQuerySystem
 */
export class DarkMatterQuerySystem {
  /**
   * Create a new DarkMatterQuerySystem instance
   * @param {Object} options - System options
   */
  constructor(options = {}) {
    this.analyzer = new QueryAnalyzer(options.analyzer);
    this.criticalPath = new CriticalPathIdentifier(options.criticalPath);
    this.optimizer = new DarkMatterOptimizer(options.optimizer);
    this.edgeCaseValidator = new EdgeCaseValidator(options.validator);
    
    this.config = {
      enableAutoOptimization: options.enableAutoOptimization !== false,
      complexityThreshold: options.complexityThreshold || 100,
      ...options
    };
  }

  /**
   * Analyze and optimize query
   * @param {string} query - SPARQL query
   * @param {string} queryId - Optional query identifier
   * @returns {Object} Analysis and optimization result
   */
  async analyzeAndOptimize(query, queryId = null) {
    const analysis = this.analyzer.analyze(query, queryId);
    const optimization = this.optimizer.optimize(query, analysis);
    
    return {
      analysis,
      optimization,
      shouldOptimize: !optimization.skipped
    };
  }

  /**
   * Process query execution with logging
   * @param {string} query - SPARQL query
   * @param {number} executionTime - Execution time in ms
   * @param {string} queryId - Optional query identifier
   * @returns {Object} Processing result
   */
  processExecution(query, executionTime, queryId = null) {
    const analysis = this.analyzer.analyze(query, queryId);
    const id = queryId || analysis.queryId;
    
    // Log execution for critical path analysis
    this.criticalPath.logExecution(id, query, executionTime, {
      complexity: analysis.complexity.score,
      expensiveOps: analysis.expensiveOperations.length
    });
    
    // Auto-optimize if enabled
    let optimization = null;
    if (this.config.enableAutoOptimization && analysis.isComplex) {
      optimization = this.optimizer.optimize(query, analysis);
    }
    
    return {
      queryId: id,
      analysis,
      optimization,
      logged: true
    };
  }

  /**
   * Get comprehensive statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      analyzer: this.analyzer.getStats(),
      criticalPath: this.criticalPath.identify().metrics,
      optimizer: this.optimizer.getStats()
    };
  }
}

// Export all components
export {
  QueryAnalyzer,
  CriticalPathIdentifier,
  DarkMatterOptimizer,
  EdgeCaseValidator
};


