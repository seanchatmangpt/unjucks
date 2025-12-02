/**
 * @file Query Analyzer
 * @module unjucks-v4/dark-matter/query-analyzer
 * @description Analyzes SPARQL query complexity and identifies expensive operations
 */

import { EventEmitter } from 'events';

/**
 * Query Analyzer - Analyzes SPARQL query complexity
 * 
 * @class QueryAnalyzer
 * @extends EventEmitter
 */
export class QueryAnalyzer extends EventEmitter {
  /**
   * Create a new QueryAnalyzer instance
   * @param {Object} options - Analyzer options
   */
  constructor(options = {}) {
    super();
    this.config = options;
    this.stats = {
      totalAnalyzed: 0,
      complexQueries: 0,
      simpleQueries: 0
    };
  }

  /**
   * Analyze SPARQL query
   * @param {string} query - SPARQL query string
   * @param {string} queryId - Optional query identifier
   * @returns {Object} Analysis result
   */
  analyze(query, queryId = null) {
    if (!query || typeof query !== 'string') {
      throw new Error('SPARQL query string is required');
    }

    const id = queryId || this._generateQueryId(query);
    
    try {
      this.emit('analyze:start', { queryId: id });

      const complexity = this._calculateComplexity(query);
      const expensiveOps = this._identifyExpensiveOperations(query);
      const queryType = this._identifyQueryType(query);

      const analysis = {
        queryId: id,
        query,
        queryType,
        complexity,
        expensiveOperations: expensiveOps,
        isComplex: complexity.score >= 100,
        recommendations: this._generateRecommendations(complexity, expensiveOps)
      };

      // Update statistics
      this.stats.totalAnalyzed++;
      if (analysis.isComplex) {
        this.stats.complexQueries++;
      } else {
        this.stats.simpleQueries++;
      }

      this.emit('analyze:complete', analysis);
      return analysis;

    } catch (error) {
      this.emit('analyze:error', { queryId: id, error });
      throw new Error(`Query analysis failed: ${error.message}`);
    }
  }

  /**
   * Calculate query complexity score
   * @private
   * @param {string} query - SPARQL query
   * @returns {Object} Complexity metrics
   */
  _calculateComplexity(query) {
    const metrics = {
      triplePatterns: (query.match(/[?]\w+\s+[?]\w+\s+[?]\w+/g) || []).length,
      filters: (query.match(/FILTER/gi) || []).length,
      optional: (query.match(/OPTIONAL/gi) || []).length,
      unions: (query.match(/UNION/gi) || []).length,
      subqueries: (query.match(/\{[\s\S]*\{[\s\S]*\}[\s\S]*\}/g) || []).length,
      aggregations: (query.match(/(COUNT|SUM|AVG|MIN|MAX|GROUP BY)/gi) || []).length,
      orderBy: (query.match(/ORDER BY/gi) || []).length,
      limit: (query.match(/LIMIT/gi) || []).length
    };

    // Calculate complexity score (weighted)
    const score = 
      metrics.triplePatterns * 10 +
      metrics.filters * 15 +
      metrics.optional * 20 +
      metrics.unions * 25 +
      metrics.subqueries * 30 +
      metrics.aggregations * 20 +
      metrics.orderBy * 5;

    return {
      ...metrics,
      score,
      level: score < 50 ? 'simple' : score < 100 ? 'medium' : 'complex'
    };
  }

  /**
   * Identify expensive operations
   * @private
   * @param {string} query - SPARQL query
   * @returns {Array} Array of expensive operations
   */
  _identifyExpensiveOperations(query) {
    const expensive = [];
    
    if (query.match(/UNION/gi)) expensive.push('UNION');
    if (query.match(/OPTIONAL/gi)) expensive.push('OPTIONAL');
    if (query.match(/\{[\s\S]*\{[\s\S]*\}[\s\S]*\}/g)) expensive.push('SUBQUERY');
    if (query.match(/(COUNT|SUM|AVG|MIN|MAX)/gi)) expensive.push('AGGREGATION');
    if (query.match(/FILTER.*REGEX/gi)) expensive.push('REGEX_FILTER');
    if (query.match(/ORDER BY/gi)) expensive.push('ORDER_BY');
    
    return expensive;
  }

  /**
   * Identify query type
   * @private
   * @param {string} query - SPARQL query
   * @returns {string} Query type
   */
  _identifyQueryType(query) {
    const upper = query.trim().toUpperCase();
    if (upper.startsWith('SELECT')) return 'SELECT';
    if (upper.startsWith('ASK')) return 'ASK';
    if (upper.startsWith('CONSTRUCT')) return 'CONSTRUCT';
    if (upper.startsWith('DESCRIBE')) return 'DESCRIBE';
    return 'UNKNOWN';
  }

  /**
   * Generate optimization recommendations
   * @private
   * @param {Object} complexity - Complexity metrics
   * @param {Array} expensiveOps - Expensive operations
   * @returns {Array} Recommendations
   */
  _generateRecommendations(complexity, expensiveOps) {
    const recommendations = [];
    
    if (complexity.score >= 100) {
      recommendations.push('Consider query optimization - complexity score is high');
    }
    if (expensiveOps.includes('UNION')) {
      recommendations.push('UNION operations are expensive - consider alternative patterns');
    }
    if (expensiveOps.includes('REGEX_FILTER')) {
      recommendations.push('REGEX filters are slow - use string functions when possible');
    }
    if (complexity.subqueries > 0) {
      recommendations.push('Subqueries detected - consider flattening if possible');
    }
    
    return recommendations;
  }

  /**
   * Generate query ID
   * @private
   * @param {string} query - SPARQL query
   * @returns {string} Query ID
   */
  _generateQueryId(query) {
    const hash = query.split('').reduce((acc, char) => {
      acc = ((acc << 5) - acc) + char.charCodeAt(0);
      return acc & acc;
    }, 0);
    return `q_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get analyzer statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      complexQueryRatio: this.stats.totalAnalyzed > 0 
        ? this.stats.complexQueries / this.stats.totalAnalyzed 
        : 0,
      avgComplexity: 0 // Would need to track this
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalAnalyzed: 0,
      complexQueries: 0,
      simpleQueries: 0
    };
  }
}


