/**
 * @file Critical Path Identifier
 * @module unjucks-v4/dark-matter/critical-path
 * @description Identifies 20% of queries causing 80% of performance issues
 */

import { EventEmitter } from 'events';

/**
 * Critical Path Identifier - Identifies critical queries (20% causing 80% of latency)
 * 
 * @class CriticalPathIdentifier
 * @extends EventEmitter
 */
export class CriticalPathIdentifier extends EventEmitter {
  /**
   * Create a new CriticalPathIdentifier instance
   * @param {Object} options - Identifier options
   */
  constructor(options = {}) {
    super();
    
    this.config = {
      percentile: options.percentile || 0.8, // 80% threshold
      minExecutions: options.minExecutions || 10,
      ...options
    };

    this.executionLog = new Map(); // queryId -> { executions: [], totalTime: 0 }
  }

  /**
   * Log query execution
   * @param {string} queryId - Query identifier
   * @param {string} query - SPARQL query
   * @param {number} executionTime - Execution time in ms
   * @param {Object} metadata - Optional metadata
   */
  logExecution(queryId, query, executionTime, metadata = {}) {
    if (!this.executionLog.has(queryId)) {
      this.executionLog.set(queryId, {
        query,
        executions: [],
        totalTime: 0,
        metadata
      });
    }

    const entry = this.executionLog.get(queryId);
    entry.executions.push(executionTime);
    entry.totalTime += executionTime;
    entry.avgTime = entry.totalTime / entry.executions.length;
    entry.maxTime = Math.max(...entry.executions);
    entry.minTime = Math.min(...entry.executions);

    this.emit('execution:logged', { queryId, executionTime });
  }

  /**
   * Identify critical queries (20% causing 80% of latency)
   * @returns {Object} Critical path analysis
   */
  identify() {
    if (this.executionLog.size === 0) {
      throw new Error('No execution data available for critical path analysis');
    }

    try {
      this.emit('identify:start');

      // Calculate total execution time
      let totalExecutionTime = 0;
      const queries = [];

      for (const [queryId, entry] of this.executionLog.entries()) {
        totalExecutionTime += entry.totalTime;
        queries.push({
          queryId,
          query: entry.query,
          totalTime: entry.totalTime,
          avgTime: entry.avgTime,
          maxTime: entry.maxTime,
          executionCount: entry.executions.length,
          metadata: entry.metadata
        });
      }

      // Sort by total execution time (descending)
      queries.sort((a, b) => b.totalTime - a.totalTime);

      // Identify critical queries (20% causing 80% of latency)
      const criticalThreshold = totalExecutionTime * this.config.percentile;
      let cumulativeTime = 0;
      const criticalQueries = [];

      for (const query of queries) {
        cumulativeTime += query.totalTime;
        criticalQueries.push(query);
        
        if (cumulativeTime >= criticalThreshold) {
          break;
        }
      }

      const metrics = {
        totalQueries: queries.length,
        criticalQueryCount: criticalQueries.length,
        criticalQueryPercentage: (criticalQueries.length / queries.length) * 100,
        totalExecutionTime,
        criticalExecutionTime: cumulativeTime,
        impactRatio: cumulativeTime / totalExecutionTime,
        avgExecutionTime: totalExecutionTime / queries.length,
        p50: this._calculatePercentile(queries.map(q => q.avgTime), 0.5),
        p90: this._calculatePercentile(queries.map(q => q.avgTime), 0.9),
        p99: this._calculatePercentile(queries.map(q => q.avgTime), 0.99)
      };

      const result = {
        criticalQueries,
        metrics,
        timestamp: Date.now()
      };

      this.emit('identify:complete', result);
      return result;

    } catch (error) {
      this.emit('identify:error', { error });
      throw new Error(`Critical path identification failed: ${error.message}`);
    }
  }

  /**
   * Calculate percentile
   * @private
   * @param {Array<number>} values - Values
   * @param {number} percentile - Percentile (0-1)
   * @returns {number} Percentile value
   */
  _calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Clear execution logs
   */
  clearLogs() {
    this.executionLog.clear();
    this.emit('logs:cleared');
  }

  /**
   * Get report
   * @returns {string} Markdown report
   */
  getReport() {
    try {
      const analysis = this.identify();
      let report = '# Critical Path Analysis Report\n\n';
      report += `## Summary\n\n`;
      report += `- **Total Queries**: ${analysis.metrics.totalQueries}\n`;
      report += `- **Critical Queries (20%)**: ${analysis.metrics.criticalQueryCount}\n`;
      report += `- **Critical Query Percentage**: ${analysis.metrics.criticalQueryPercentage.toFixed(1)}%\n`;
      report += `- **Total Execution Time**: ${analysis.metrics.totalExecutionTime.toFixed(2)}ms\n`;
      report += `- **Critical Execution Time**: ${analysis.metrics.criticalExecutionTime.toFixed(2)}ms\n`;
      report += `- **Impact Ratio**: ${(analysis.metrics.impactRatio * 100).toFixed(1)}%\n\n`;
      
      report += `## Critical Queries\n\n`;
      analysis.criticalQueries.forEach((query, index) => {
        report += `### ${index + 1}. ${query.queryId}\n\n`;
        report += `- **Total Time**: ${query.totalTime.toFixed(2)}ms\n`;
        report += `- **Avg Time**: ${query.avgTime.toFixed(2)}ms\n`;
        report += `- **Max Time**: ${query.maxTime.toFixed(2)}ms\n`;
        report += `- **Execution Count**: ${query.executionCount}\n\n`;
      });

      return report;
    } catch (error) {
      return `# Critical Path Analysis Report\n\n*Error: ${error.message}*\n`;
    }
  }
}


