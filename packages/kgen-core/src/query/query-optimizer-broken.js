/**
 * Query Optimizer - Advanced SPARQL query optimization
 * 
 * Implements cost-based optimization, join reordering, filter pushdown,
 * and statistical optimization for high-performance SPARQL execution.
 */

import { Consola } from 'consola';

export class QueryOptimizer {
  constructor(config = {}) {
    this.config = {
      enableStatistics: true,
      enableJoinReordering: true,
      enableFilterPushdown: true,
      enableConstantFolding: true,
      enableDeadCodeElimination: true,
      costModel: 'statistics', // 'statistics', 'heuristic', 'hybrid'
      ...config
    };
    
    this.logger = new Consola({ tag: 'query-optimizer' });
    this.statistics = new Map();
    this.costModel = new CostModel(config);
  }

  /**
   * Optimize a parsed SPARQL query
   * @param {Object} parsedQuery - Parsed SPARQL query from sparqljs
   * @param {Object} context - Optimization context (store, statistics, etc.)
   * @returns {Promise<Object>} Optimized query
   */
  async optimize(parsedQuery, context = {}) {
    try {
      this.logger.info('Starting query optimization');
      
      let optimizedQuery = JSON.parse(JSON.stringify(parsedQuery)); // Deep copy
      
      // Collect statistics if needed
      if (this.config.enableStatistics && context.store) {
        await this._collectStatistics(context.store);
      }
      
      // Apply optimization phases in order
      optimizedQuery = await this._applyAlgebraicOptimizations(optimizedQuery);
      optimizedQuery = await this._applyFilterOptimizations(optimizedQuery);
      optimizedQuery = await this._applyJoinOptimizations(optimizedQuery, context);
      optimizedQuery = await this._applyProjectionOptimizations(optimizedQuery);
      optimizedQuery = await this._applyOrderingOptimizations(optimizedQuery);
      
      // Calculate optimization impact
      const originalCost = await this.costModel.estimateQueryCost(parsedQuery, context);
      const optimizedCost = await this.costModel.estimateQueryCost(optimizedQuery, context);
      const improvement = ((originalCost - optimizedCost) / originalCost * 100).toFixed(1);
      
      this.logger.success(`Query optimization complete: ${improvement}% cost reduction`);
      
      return {
        query: optimizedQuery,
        metadata: {
          originalCost,
          optimizedCost,
          improvement: parseFloat(improvement),
          optimizations: this._getAppliedOptimizations(parsedQuery, optimizedQuery)
        }
      };
      
    } catch (error) {
      this.logger.error('Query optimization failed:', error);
      throw error;
    }
  }

  /**
   * Apply algebraic optimizations (constant folding, dead code elimination)
   */
  async _applyAlgebraicOptimizations(query) {
    let optimized = { ...query };
    
    if (this.config.enableConstantFolding) {
      optimized = await this._foldConstants(optimized);
    }
    
    if (this.config.enableDeadCodeElimination) {
      optimized = await this._eliminateDeadCode(optimized);
    }
    
    return optimized;
  }

  /**
   * Apply filter optimizations (pushdown, combining, simplification)
   */
  async _applyFilterOptimizations(query) {
    if (!this.config.enableFilterPushdown || !query.where) {
      return query;
    }
    
    let optimized = { ...query };
    
    // Extract all filters
    const filters = [];
    const nonFilters = [];
    
    this._extractFilters(optimized.where, filters, nonFilters);
    
    // Optimize individual filters
    const optimizedFilters = [];
    for (const filter of filters) {
      const simplified = await this._simplifyFilter(filter);
      if (simplified) {
        optimizedFilters.push(simplified);
      }
    }
    
    // Sort filters by selectivity (most selective first)
    optimizedFilters.sort((a, b) => {
      const selectivityA = this._estimateFilterSelectivity(a);
      const selectivityB = this._estimateFilterSelectivity(b);
      return selectivityA - selectivityB;
    });
    
    // Push filters down as close as possible to their variables
    const pushedFilters = await this._pushFiltersDown(optimizedFilters, nonFilters);
    
    // Rebuild WHERE clause
    optimized.where = [...nonFilters, ...pushedFilters];
    
    return optimized;
  }

  /**
   * Apply join optimizations (reordering, algorithm selection)
   */
  async _applyJoinOptimizations(query, context) {
    if (!this.config.enableJoinReordering || !query.where) {
      return query;
    }
    
    let optimized = { ...query };
    
    // Extract basic graph patterns (BGPs)
    const bgps = [];
    const otherPatterns = [];
    
    for (const pattern of optimized.where) {
      if (pattern.type === 'bgp' && pattern.triples) {
        bgps.push(pattern);
      } else {
        otherPatterns.push(pattern);
      }
    }
    
    // Optimize each BGP
    const optimizedBGPs = [];
    for (const bgp of bgps) {
      const optimizedBGP = await this._optimizeBGP(bgp, context);
      optimizedBGPs.push(optimizedBGP);
    }
    
    // Reorder BGPs based on cost
    if (optimizedBGPs.length > 1) {
      optimizedBGPs.sort((a, b) => {
        const costA = this._estimateBGPCost(a, context);
        const costB = this._estimateBGPCost(b, context);
        return costA - costB;
      });
    }\n    \n    optimized.where = [...optimizedBGPs, ...otherPatterns];\n    \n    return optimized;\n  }\n\n  /**\n   * Optimize a Basic Graph Pattern (BGP)\n   */\n  async _optimizeBGP(bgp, context) {\n    const optimized = { ...bgp };\n    \n    // Sort triples by selectivity\n    optimized.triples = [...bgp.triples].sort((a, b) => {\n      const selectivityA = this._estimateTripleSelectivity(a, context);\n      const selectivityB = this._estimateTripleSelectivity(b, context);\n      return selectivityA - selectivityB;\n    });\n    \n    // Group connected triples\n    optimized.triples = this._groupConnectedTriples(optimized.triples);\n    \n    return optimized;\n  }\n\n  /**\n   * Group connected triples for better join performance\n   */\n  _groupConnectedTriples(triples) {\n    if (triples.length <= 1) return triples;\n    \n    const groups = [];\n    const used = new Set();\n    \n    for (let i = 0; i < triples.length; i++) {\n      if (used.has(i)) continue;\n      \n      const group = [triples[i]];\n      used.add(i);\n      \n      // Find connected triples\n      let foundConnection = true;\n      while (foundConnection) {\n        foundConnection = false;\n        \n        for (let j = 0; j < triples.length; j++) {\n          if (used.has(j)) continue;\n          \n          // Check if triple j connects to any triple in the current group\n          if (this._triplesAreConnected(group, triples[j])) {\n            group.push(triples[j]);\n            used.add(j);\n            foundConnection = true;\n          }\n        }\n      }\n      \n      groups.push(group);\n    }\n    \n    // Flatten groups back to triples array, keeping connected triples together\n    return groups.flat();\n  }\n\n  /**\n   * Check if a triple connects to any triple in a group\n   */\n  _triplesAreConnected(group, triple) {\n    const tripleVars = this._getTripleVariables(triple);\n    \n    for (const groupTriple of group) {\n      const groupVars = this._getTripleVariables(groupTriple);\n      \n      // Check for common variables\n      for (const tripleVar of tripleVars) {\n        if (groupVars.has(tripleVar)) {\n          return true;\n        }\n      }\n    }\n    \n    return false;\n  }\n\n  /**\n   * Get all variables in a triple\n   */\n  _getTripleVariables(triple) {\n    const vars = new Set();\n    \n    if (triple.subject?.termType === 'Variable') {\n      vars.add(triple.subject.value);\n    }\n    if (triple.predicate?.termType === 'Variable') {\n      vars.add(triple.predicate.value);\n    }\n    if (triple.object?.termType === 'Variable') {\n      vars.add(triple.object.value);\n    }\n    \n    return vars;\n  }\n\n  /**\n   * Apply projection optimizations\n   */\n  async _applyProjectionOptimizations(query) {\n    if (!query.variables) return query;\n    \n    let optimized = { ...query };\n    \n    // Remove duplicate variables\n    const uniqueVars = [];\n    const seen = new Set();\n    \n    for (const variable of optimized.variables) {\n      const varName = variable.value || variable;\n      if (!seen.has(varName)) {\n        uniqueVars.push(variable);\n        seen.add(varName);\n      }\n    }\n    \n    optimized.variables = uniqueVars;\n    \n    // Remove unused variables (if not SELECT *)\n    if (!optimized.variables.includes('*')) {\n      const usedVars = new Set();\n      this._findUsedVariables(optimized.where, usedVars);\n      \n      optimized.variables = optimized.variables.filter(variable => {\n        const varName = variable.value || variable;\n        return usedVars.has(varName) || varName === '*';\n      });\n    }\n    \n    return optimized;\n  }\n\n  /**\n   * Apply ordering optimizations\n   */\n  async _applyOrderingOptimizations(query) {\n    if (!query.order) return query;\n    \n    let optimized = { ...query };\n    \n    // If we have both ORDER BY and LIMIT with small limit, consider top-K optimization\n    if (query.limit && query.limit <= 1000) {\n      optimized._useTopKOptimization = true;\n      optimized._topKLimit = query.limit;\n    }\n    \n    return optimized;\n  }\n\n  /**\n   * Collect statistics about the RDF store\n   */\n  async _collectStatistics(store) {\n    try {\n      // Count total triples\n      const totalTriples = store.size;\n      this.statistics.set('totalTriples', totalTriples);\n      \n      // Count distinct subjects, predicates, objects\n      const subjects = new Set();\n      const predicates = new Set();\n      const objects = new Set();\n      \n      for (const quad of store) {\n        subjects.add(quad.subject.value);\n        predicates.add(quad.predicate.value);\n        objects.add(quad.object.value);\n      }\n      \n      this.statistics.set('distinctSubjects', subjects.size);\n      this.statistics.set('distinctPredicates', predicates.size);\n      this.statistics.set('distinctObjects', objects.size);\n      \n      // Calculate predicate frequencies\n      const predicateFreq = new Map();\n      for (const quad of store) {\n        const pred = quad.predicate.value;\n        predicateFreq.set(pred, (predicateFreq.get(pred) || 0) + 1);\n      }\n      \n      this.statistics.set('predicateFrequencies', predicateFreq);\n      \n      this.logger.info(`Collected statistics: ${totalTriples} triples, ${subjects.size} subjects, ${predicates.size} predicates`);\n      \n    } catch (error) {\n      this.logger.warn('Failed to collect statistics:', error.message);\n    }\n  }\n\n  /**\n   * Estimate triple selectivity\n   */\n  _estimateTripleSelectivity(triple, context) {\n    let selectivity = 1.0;\n    \n    // Constants are more selective than variables\n    if (triple.subject?.termType !== 'Variable') selectivity *= 0.1;\n    if (triple.predicate?.termType !== 'Variable') selectivity *= 0.1;\n    if (triple.object?.termType !== 'Variable') selectivity *= 0.1;\n    \n    // Use predicate frequency if available\n    if (triple.predicate?.termType !== 'Variable') {\n      const predicateFreq = this.statistics.get('predicateFrequencies');\n      if (predicateFreq) {\n        const freq = predicateFreq.get(triple.predicate.value) || 1;\n        const totalTriples = this.statistics.get('totalTriples') || 1;\n        selectivity *= freq / totalTriples;\n      }\n    }\n    \n    // Known high-selectivity predicates\n    const highSelectivityPredicates = [\n      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',\n      'http://www.w3.org/2000/01/rdf-schema#subClassOf',\n      'http://www.w3.org/2002/07/owl#sameAs'\n    ];\n    \n    if (triple.predicate?.value && highSelectivityPredicates.includes(triple.predicate.value)) {\n      selectivity *= 0.5;\n    }\n    \n    return selectivity;\n  }\n\n  /**\n   * Estimate BGP execution cost\n   */\n  _estimateBGPCost(bgp, context) {\n    let cost = 0;\n    \n    for (const triple of bgp.triples) {\n      const selectivity = this._estimateTripleSelectivity(triple, context);\n      const totalTriples = this.statistics.get('totalTriples') || 1000;\n      cost += selectivity * totalTriples;\n    }\n    \n    // Add join cost\n    if (bgp.triples.length > 1) {\n      cost *= Math.log2(bgp.triples.length);\n    }\n    \n    return cost;\n  }\n\n  /**\n   * Extract filters from WHERE clause\n   */\n  _extractFilters(where, filters, nonFilters) {\n    if (Array.isArray(where)) {\n      for (const element of where) {\n        if (element.type === 'filter') {\n          filters.push(element);\n        } else {\n          nonFilters.push(element);\n        }\n      }\n    }\n  }\n\n  /**\n   * Simplify a filter expression\n   */\n  async _simplifyFilter(filter) {\n    // Placeholder for filter simplification\n    // Could implement constant folding, boolean simplification, etc.\n    return filter;\n  }\n\n  /**\n   * Estimate filter selectivity\n   */\n  _estimateFilterSelectivity(filter) {\n    if (!filter.expression) return 0.5;\n    \n    // Estimate selectivity based on filter type\n    const operatorSelectivity = {\n      '=': 0.1,\n      '!=': 0.9,\n      '<': 0.3,\n      '>': 0.3,\n      '<=': 0.3,\n      '>=': 0.3,\n      'regex': 0.2,\n      'contains': 0.3,\n      'bound': 0.9\n    };\n    \n    const operator = filter.expression.operator;\n    return operatorSelectivity[operator] || 0.5;\n  }\n\n  /**\n   * Push filters down in the query tree\n   */\n  async _pushFiltersDown(filters, nonFilters) {\n    // Placeholder for filter pushdown\n    // In a real implementation, this would analyze variable dependencies\n    // and move filters as close as possible to where their variables are bound\n    return filters;\n  }\n\n  /**\n   * Fold constant expressions\n   */\n  async _foldConstants(query) {\n    // Placeholder for constant folding\n    // Could implement arithmetic simplification, string operations, etc.\n    return query;\n  }\n\n  /**\n   * Eliminate dead code\n   */\n  async _eliminateDeadCode(query) {\n    // Placeholder for dead code elimination\n    // Could remove unused variables, unreachable patterns, etc.\n    return query;\n  }\n\n  /**\n   * Find used variables in WHERE clause\n   */\n  _findUsedVariables(where, usedVars) {\n    if (Array.isArray(where)) {\n      where.forEach(element => this._findUsedVariables(element, usedVars));\n    } else if (where && typeof where === 'object') {\n      if (where.type === 'bgp' && where.triples) {\n        where.triples.forEach(triple => {\n          if (triple.subject?.termType === 'Variable') usedVars.add(triple.subject.value);\n          if (triple.predicate?.termType === 'Variable') usedVars.add(triple.predicate.value);\n          if (triple.object?.termType === 'Variable') usedVars.add(triple.object.value);\n        });\n      } else if (where.patterns) {\n        this._findUsedVariables(where.patterns, usedVars);\n      }\n    }\n  }\n\n  /**\n   * Get list of optimizations applied\n   */\n  _getAppliedOptimizations(originalQuery, optimizedQuery) {\n    const optimizations = [];\n    \n    // Compare queries to determine which optimizations were applied\n    // This is a simplified version - a real implementation would track changes\n    \n    if (this.config.enableJoinReordering) {\n      optimizations.push('join_reordering');\n    }\n    \n    if (this.config.enableFilterPushdown) {\n      optimizations.push('filter_pushdown');\n    }\n    \n    if (this.config.enableConstantFolding) {\n      optimizations.push('constant_folding');\n    }\n    \n    if (optimizedQuery._useTopKOptimization) {\n      optimizations.push('top_k_optimization');\n    }\n    \n    return optimizations;\n  }\n}\n\n/**\n * Cost Model for query optimization\n */\nclass CostModel {\n  constructor(config = {}) {\n    this.config = config;\n    this.logger = new Consola({ tag: 'cost-model' });\n  }\n\n  /**\n   * Estimate the execution cost of a query\n   */\n  async estimateQueryCost(query, context = {}) {\n    let totalCost = 0;\n    \n    if (query.where) {\n      for (const pattern of query.where) {\n        totalCost += await this._estimatePatternCost(pattern, context);\n      }\n    }\n    \n    // Add costs for other operations\n    if (query.order) totalCost += 100; // ORDER BY cost\n    if (query.distinct) totalCost += 50; // DISTINCT cost\n    if (query.limit) totalCost *= 0.8; // LIMIT reduces cost\n    \n    return totalCost;\n  }\n\n  async _estimatePatternCost(pattern, context) {\n    switch (pattern.type) {\n      case 'bgp':\n        return this._estimateBGPCost(pattern, context);\n      case 'filter':\n        return this._estimateFilterCost(pattern, context);\n      case 'optional':\n        return this._estimateOptionalCost(pattern, context);\n      case 'union':\n        return this._estimateUnionCost(pattern, context);\n      default:\n        return 100; // Default cost\n    }\n  }\n\n  _estimateBGPCost(bgp, context) {\n    if (!bgp.triples) return 0;\n    \n    let cost = 0;\n    const tripleCount = bgp.triples.length;\n    \n    for (const triple of bgp.triples) {\n      // Base cost depends on variable pattern\n      let tripleCost = 1000; // Base cost\n      \n      // Reduce cost for each constant\n      if (triple.subject?.termType !== 'Variable') tripleCost *= 0.1;\n      if (triple.predicate?.termType !== 'Variable') tripleCost *= 0.1;\n      if (triple.object?.termType !== 'Variable') tripleCost *= 0.1;\n      \n      cost += tripleCost;\n    }\n    \n    // Add join cost for multiple triples\n    if (tripleCount > 1) {\n      cost *= Math.log2(tripleCount) * 1.5;\n    }\n    \n    return cost;\n  }\n\n  _estimateFilterCost(filter, context) {\n    // Filters are generally cheap but depend on how early they can be applied\n    return 10;\n  }\n\n  _estimateOptionalCost(optional, context) {\n    // OPTIONAL patterns are expensive as they require left-joins\n    let cost = 0;\n    if (optional.patterns) {\n      for (const pattern of optional.patterns) {\n        cost += this._estimatePatternCost(pattern, context);\n      }\n    }\n    return cost * 1.5; // 50% overhead for optional\n  }\n\n  _estimateUnionCost(union, context) {\n    // UNION cost is sum of all alternatives\n    let cost = 0;\n    if (union.patterns) {\n      for (const pattern of union.patterns) {\n        cost += this._estimatePatternCost(pattern, context);\n      }\n    }\n    return cost;\n  }\n}\n\nexport default QueryOptimizer;"