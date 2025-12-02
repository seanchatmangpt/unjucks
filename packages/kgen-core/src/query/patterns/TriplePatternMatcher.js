/**
 * High-Performance Triple Pattern Matching Engine
 * 
 * Optimized pattern matching for large RDF graphs with indexing and caching
 */

import { TriplePattern, TripleComponent, Binding, Index, PatternMatch } from '../types/index.js';
import { EventEmitter } from 'events';
import { Store, Quad, Term, DataFactory } from 'n3';

const { namedNode, literal, blankNode, variable } = DataFactory;

export 

export 

export class TriplePatternMatcher extends EventEmitter {
  private store
  private indexes
  private statistics> = new Map();
  private indexEnabled = true;
  private indexSize = 0;

  constructor(store= true) {
    super();
    this.store = store;
    this.indexEnabled = enableIndexes;
    
    this.indexes = {
      spo),
      pos), 
      ops),
      sop),
      pso),
      osp)
    };

    if (enableIndexes) {
      this.buildIndexes();
    }
  }

  /**
   * Match a single triple pattern against the store
   */
  async matchPattern(
    pattern,
    bindings= [{}],
    options= {}
  )> {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      // Apply existing bindings to pattern
      const boundPattern = this.applyBindings(pattern, bindings[0] || {});
      
      // Choose optimal matching strategy
      const strategy = this.selectMatchingStrategy(boundPattern);
      
      // Execute pattern matching
      const matches = await this.executePatternMatch(boundPattern, strategy, options);
      
      // Calculate statistics
      const cost = this.getDeterministicTimestamp() - startTime;
      const selectivity = this.calculateSelectivity(boundPattern, matches.length);
      
      // Update statistics
      if (options.enableStatistics) {
        this.updatePatternStatistics(pattern, cost, selectivity, matches.length);
      }

      const result= {
        pattern,
        bindings,
        cost,
        selectivity
      };

      this.emit('pattern{
        pattern,
        resultCount,
        executionTime,
        strategy
      });

      return result;

    } catch (error) {
      this.emit('pattern{ pattern, error });
      throw error;
    }
  }

  /**
   * Match multiple patterns with join optimization
   */
  async matchPatterns(
    patterns,
    options= {}
  )> {
    if (patterns.length === 0) return [{}];
    if (patterns.length === 1) {
      const match = await this.matchPattern(patterns[0], [{}], options);
      return match.bindings;
    }

    // Order patterns by estimated selectivity
    const orderedPatterns = this.orderPatternsBySelectivity(patterns);
    
    let currentBindings= [{}];
    
    for (const pattern of orderedPatterns) {
      const matches = await this.matchPattern(pattern, currentBindings, options);
      currentBindings = this.joinBindings(currentBindings, matches.bindings);
      
      // Early termination if no results
      if (currentBindings.length === 0) {
        break;
      }
      
      // Limit intermediate results to prevent memory issues
      if (options.maxResults && currentBindings.length > options.maxResults * 10) {
        currentBindings = currentBindings.slice(0, options.maxResults * 10);
      }
    }

    // Apply final result limit
    if (options.maxResults && currentBindings.length > options.maxResults) {
      currentBindings = currentBindings.slice(0, options.maxResults);
    }

    return currentBindings;
  }

  /**
   * Get pattern matching statistics
   */
  getPatternStatistics(pattern?> {
    if (pattern) {
      const key = this.getPatternKey(pattern);
      const stats = this.statistics.get(key);
      return new Map(stats ? [[key, stats]] : []);
    }
    return new Map(this.statistics);
  }

  /**
   * Build or rebuild all indexes
   */
  buildIndexes(){
    const startTime = this.getDeterministicTimestamp();
    
    // Clear existing indexes
    Object.values(this.indexes).forEach(index => index.clear());
    this.indexSize = 0;
    
    // Build indexes from store
    const quads = this.store.getQuads();
    
    for (const quad of quads) {
      this.addQuadToIndexes(quad);
      this.indexSize++;
    }
    
    const buildTime = this.getDeterministicTimestamp() - startTime;
    
    this.emit('indexes{
      indexSize,
      buildTime,
      quadCount
    });
  }

  /**
   * Add a quad to all indexes
   */
  addQuadToIndexes(quad{
    const s = quad.subject.value;
    const p = quad.predicate.value;
    const o = quad.object.value;

    // SPO index
    this.addToNestedMap(this.indexes.spo, s, p, o);
    
    // POS index
    this.addToNestedMap(this.indexes.pos, p, o, s);
    
    // OPS index  
    this.addToNestedMap(this.indexes.ops, o, p, s);
    
    // SOP index
    this.addToNestedMap(this.indexes.sop, s, o, p);
    
    // PSO index
    this.addToNestedMap(this.indexes.pso, p, s, o);
    
    // OSP index
    this.addToNestedMap(this.indexes.osp, o, s, p);
  }

  /**
   * Remove a quad from all indexes
   */
  removeQuadFromIndexes(quad{
    const s = quad.subject.value;
    const p = quad.predicate.value;
    const o = quad.object.value;

    // Remove from all indexes
    this.removeFromNestedMap(this.indexes.spo, s, p, o);
    this.removeFromNestedMap(this.indexes.pos, p, o, s);
    this.removeFromNestedMap(this.indexes.ops, o, p, s);
    this.removeFromNestedMap(this.indexes.sop, s, o, p);
    this.removeFromNestedMap(this.indexes.pso, p, s, o);
    this.removeFromNestedMap(this.indexes.osp, o, s, p);
  }

  /**
   * Get index size information
   */
  getIndexInfo()> {
    return {
      enabled,
      size,
      spoSize,
      posSize,
      opsSize,
      sopSize,
      psoSize,
      ospSize,
      memoryEstimate)
    };
  }

  // Private methods

  private applyBindings(pattern{
    const applyToComponent = (component=> {
      if (component.type === 'variable' && bindings[component.value]) {
        const binding = bindings[component.value];
        return {
          type,
          value,
          datatype,
          language
        };
      }
      return component;
    };

    return {
      subject),
      predicate),
      object),
      graph) : undefined
    };
  }

  private selectMatchingStrategy(pattern{
    const sVar = pattern.subject.type === 'variable';
    const pVar = pattern.predicate.type === 'variable';
    const oVar = pattern.object.type === 'variable';

    // Select index based on binding pattern (most specific first)
    if (!sVar && !pVar && !oVar) return 'spo'; // All bound
    if (!sVar && !pVar && oVar) return 'spo';  // S,P bound
    if (!pVar && !oVar && sVar) return 'pos';  // P,O bound
    if (!oVar && !sVar && pVar) return 'osp';  // O,S bound
    if (!sVar && pVar && oVar) return 'spo';   // S bound
    if (sVar && !pVar && oVar) return 'pso';   // P bound
    if (sVar && pVar && !oVar) return 'ops';   // O bound
    
    return 'spo'; // Default to SPO scan
  }

  private async executePatternMatch(
    pattern,
    strategy,
    options
  )> {
    if (!this.indexEnabled) {
      return this.scanStoreForPattern(pattern, options);
    }

    const matches= [];
    const maxResults = options.maxResults || 10000;

    try {
      switch (strategy) {
        case 'spo':
          return this.matchUsingSPOIndex(pattern, options);
        case 'pos':
          return this.matchUsingPOSIndex(pattern, options);
        case 'ops':
          return this.matchUsingOPSIndex(pattern, options);
        case 'sop':
          return this.matchUsingSOPIndex(pattern, options);
        case 'pso':
          return this.matchUsingPSOIndex(pattern, options);
        case 'osp':
          return this.matchUsingOSPIndex(pattern, options);
        default, options);
      }
    } catch (error) {
      // Fallback to store scan if index lookup fails
      return this.scanStoreForPattern(pattern, options);
    }
  }

  private matchUsingSPOIndex(pattern{
    const matches= [];
    const maxResults = options.maxResults || 10000;

    if (pattern.subject.type === 'variable') {
      // Subject is variable - iterate over all subjects
      for (const [s, pMap] of this.indexes.spo.entries()) {
        if (matches.length >= maxResults) break;
        
        const binding = this.matchPredicateObject(pattern, s, pMap, 'subject');
        if (binding) {
          matches.push(...binding);
        }
      }
    } else {
      // Subject is bound - use it
      const pMap = this.indexes.spo.get(pattern.subject.value);
      if (pMap) {
        const binding = this.matchPredicateObject(pattern, pattern.subject.value, pMap, 'subject');
        if (binding) {
          matches.push(...binding);
        }
      }
    }

    return matches.slice(0, maxResults);
  }

  private matchUsingPOSIndex(pattern{
    const matches= [];
    const maxResults = options.maxResults || 10000;

    if (pattern.predicate.type === 'variable') {
      // Predicate is variable - iterate over all predicates
      for (const [p, oMap] of this.indexes.pos.entries()) {
        if (matches.length >= maxResults) break;
        
        const binding = this.matchObjectSubject(pattern, p, oMap, 'predicate');
        if (binding) {
          matches.push(...binding);
        }
      }
    } else {
      // Predicate is bound - use it
      const oMap = this.indexes.pos.get(pattern.predicate.value);
      if (oMap) {
        const binding = this.matchObjectSubject(pattern, pattern.predicate.value, oMap, 'predicate');
        if (binding) {
          matches.push(...binding);
        }
      }
    }

    return matches.slice(0, maxResults);
  }

  private matchUsingOPSIndex(pattern{
    const matches= [];
    const maxResults = options.maxResults || 10000;

    if (pattern.object.type === 'variable') {
      // Object is variable - iterate over all objects
      for (const [o, pMap] of this.indexes.ops.entries()) {
        if (matches.length >= maxResults) break;
        
        const binding = this.matchPredicateSubject(pattern, o, pMap, 'object');
        if (binding) {
          matches.push(...binding);
        }
      }
    } else {
      // Object is bound - use it
      const pMap = this.indexes.ops.get(pattern.object.value);
      if (pMap) {
        const binding = this.matchPredicateSubject(pattern, pattern.object.value, pMap, 'object');
        if (binding) {
          matches.push(...binding);
        }
      }
    }

    return matches.slice(0, maxResults);
  }

  private matchUsingSOPIndex(pattern{
    // Similar to SPO but with different ordering
    return this.matchUsingSPOIndex(pattern, options);
  }

  private matchUsingPSOIndex(pattern{
    // Similar to POS but with different ordering
    return this.matchUsingPOSIndex(pattern, options);
  }

  private matchUsingOSPIndex(pattern{
    // Similar to OPS but with different ordering
    return this.matchUsingOPSIndex(pattern, options);
  }

  private matchPredicateObject(
    pattern,
    subjectValue,
    pMap>>,
    boundComponent
  ){
    const matches= [];

    if (pattern.predicate.type === 'variable') {
      // Predicate is variable - iterate over all predicates for this subject
      for (const [p, oSet] of pMap.entries()) {
        const objectMatches = this.matchObjectInSet(pattern, p, oSet, boundComponent, subjectValue);
        matches.push(...objectMatches);
      }
    } else {
      // Predicate is bound - use it
      const oSet = pMap.get(pattern.predicate.value);
      if (oSet) {
        const objectMatches = this.matchObjectInSet(pattern, pattern.predicate.value, oSet, boundComponent, subjectValue);
        matches.push(...objectMatches);
      }
    }

    return matches.length > 0 ? matches
  }

  private matchObjectSubject(
    pattern,
    predicateValue,
    oMap>>,
    boundComponent
  ){
    const matches= [];

    if (pattern.object.type === 'variable') {
      // Object is variable - iterate over all objects for this predicate
      for (const [o, sSet] of oMap.entries()) {
        const subjectMatches = this.matchSubjectInSet(pattern, predicateValue, o, sSet, boundComponent);
        matches.push(...subjectMatches);
      }
    } else {
      // Object is bound - use it
      const sSet = oMap.get(pattern.object.value);
      if (sSet) {
        const subjectMatches = this.matchSubjectInSet(pattern, predicateValue, pattern.object.value, sSet, boundComponent);
        matches.push(...subjectMatches);
      }
    }

    return matches.length > 0 ? matches
  }

  private matchPredicateSubject(
    pattern,
    objectValue,
    pMap>>,
    boundComponent
  ){
    const matches= [];

    if (pattern.predicate.type === 'variable') {
      // Predicate is variable - iterate over all predicates for this object
      for (const [p, sSet] of pMap.entries()) {
        const subjectMatches = this.matchSubjectInSet(pattern, p, objectValue, sSet, boundComponent);
        matches.push(...subjectMatches);
      }
    } else {
      // Predicate is bound - use it
      const sSet = pMap.get(pattern.predicate.value);
      if (sSet) {
        const subjectMatches = this.matchSubjectInSet(pattern, pattern.predicate.value, objectValue, sSet, boundComponent);
        matches.push(...subjectMatches);
      }
    }

    return matches.length > 0 ? matches
  }

  private matchObjectInSet(
    pattern,
    predicateValue,
    objectSet>,
    boundComponent,
    subjectValue
  ){
    const matches= [];

    if (pattern.object.type === 'variable') {
      // Object is variable - add all objects in set
      for (const o of objectSet) {
        const binding= {};
        
        if (pattern.subject.type === 'variable' && boundComponent !== 'subject') {
          binding[pattern.subject.value] = { type, value
        }
        if (pattern.predicate.type === 'variable') {
          binding[pattern.predicate.value] = { type, value
        }
        binding[pattern.object.value] = { type, value
        
        matches.push(binding);
      }
    } else {
      // Object is bound - check if it exists in set
      if (objectSet.has(pattern.object.value)) {
        const binding= {};
        
        if (pattern.subject.type === 'variable' && boundComponent !== 'subject') {
          binding[pattern.subject.value] = { type, value
        }
        if (pattern.predicate.type === 'variable') {
          binding[pattern.predicate.value] = { type, value
        }
        
        matches.push(binding);
      }
    }

    return matches;
  }

  private matchSubjectInSet(
    pattern,
    predicateValue,
    objectValue,
    subjectSet>,
    boundComponent
  ){
    const matches= [];

    if (pattern.subject.type === 'variable') {
      // Subject is variable - add all subjects in set
      for (const s of subjectSet) {
        const binding= {};
        
        binding[pattern.subject.value] = { type, value
        if (pattern.predicate.type === 'variable' && boundComponent !== 'predicate') {
          binding[pattern.predicate.value] = { type, value
        }
        if (pattern.object.type === 'variable' && boundComponent !== 'object') {
          binding[pattern.object.value] = { type, value
        }
        
        matches.push(binding);
      }
    } else {
      // Subject is bound - check if it exists in set
      if (subjectSet.has(pattern.subject.value)) {
        const binding= {};
        
        if (pattern.predicate.type === 'variable' && boundComponent !== 'predicate') {
          binding[pattern.predicate.value] = { type, value
        }
        if (pattern.object.type === 'variable' && boundComponent !== 'object') {
          binding[pattern.object.value] = { type, value
        }
        
        matches.push(binding);
      }
    }

    return matches;
  }

  private scanStoreForPattern(pattern{
    const matches= [];
    const maxResults = options.maxResults || 10000;

    // Convert pattern to N3 terms for querying
    const subject = pattern.subject.type === 'variable' ? null);
    const predicate = pattern.predicate.type === 'variable' ? null);
    const object = pattern.object.type === 'variable' ? null);

    const quads = this.store.getQuads(subject, predicate, object);

    for (const quad of quads) {
      if (matches.length >= maxResults) break;

      const binding= {};
      
      if (pattern.subject.type === 'variable') {
        binding[pattern.subject.value] = this.termToBindingValue(quad.subject);
      }
      if (pattern.predicate.type === 'variable') {
        binding[pattern.predicate.value] = this.termToBindingValue(quad.predicate);
      }
      if (pattern.object.type === 'variable') {
        binding[pattern.object.value] = this.termToBindingValue(quad.object);
      }
      
      matches.push(binding);
    }

    return matches;
  }

  private createTerm(component{
    switch (component.type) {
      case 'uri':
        return namedNode(component.value);
      case 'literal':
        return literal(component.value, component.datatype || component.language);
      case 'blank':
        return blankNode(component.value);
      default);
    }
  }

  private termToBindingValue(term{
    if (term.termType === 'NamedNode') {
      return { type, value
    } else if (term.termType === 'Literal') {
      return {
        type,
        value,
        datatype,
        language
      };
    } else if (term.termType === 'BlankNode') {
      return { type, value
    }
    return { type, value
  }

  private orderPatternsBySelectivity(patterns{
    return patterns.sort((a, b) => {
      const aSelectivity = this.estimatePatternSelectivity(a);
      const bSelectivity = this.estimatePatternSelectivity(b);
      return aSelectivity - bSelectivity;
    });
  }

  private estimatePatternSelectivity(pattern{
    let selectivity = 1.0;

    // Constants are more selective than variables
    if (pattern.subject.
    if (pattern.predicate.
    if (pattern.object.

    return selectivity;
  }

  private joinBindings(left{
    const result= [];

    for (const leftBinding of left) {
      for (const rightBinding of right) {
        const merged = this.mergeBindings(leftBinding, rightBinding);
        if (merged) {
          result.push(merged);
        }
      }
    }

    return result;
  }

  private mergeBindings(left{
    const merged= { ...left };

    for (const [variable, value] of Object.entries(right)) {
      if (merged[variable]) {
        // Check for conflicts
        if (merged[variable].value !== value.value || merged[variable].
          return null; // Conflict - bindings cannot be merged
        }
      } else {
        merged[variable] = value;
      }
    }

    return merged;
  }

  private calculateSelectivity(pattern{
    // Estimate total possible results for comparison
    const totalTriples = this.indexSize || this.store.size;
    return totalTriples > 0 ? resultCount / totalTriples
  }

  private updatePatternStatistics(
    pattern,
    cost,
    selectivity,
    resultCount
  ){
    const key = this.getPatternKey(pattern);
    const existing = this.statistics.get(key) || {
      executionCount,
      totalCost,
      totalResults,
      bestSelectivity
    };

    existing.executionCount++;
    existing.totalCost += cost;
    existing.totalResults += resultCount;
    existing.averageCost = existing.totalCost / existing.executionCount;
    existing.averageResults = existing.totalResults / existing.executionCount;
    existing.bestSelectivity = Math.min(existing.bestSelectivity, selectivity);
    existing.lastExecuted = this.getDeterministicTimestamp();

    this.statistics.set(key, existing);
  }

  private getPatternKey(pattern{
    const s = pattern.subject.type === 'variable' ? '?s' : pattern.subject.value;
    const p = pattern.predicate.type === 'variable' ? '?p' : pattern.predicate.value;
    const o = pattern.object.type === 'variable' ? '?o' : pattern.object.value;
    return `${s}|${p}|${o}`;
  }

  private addToNestedMap(
    map>>>,
    key1,
    key2,
    value
  ){
    if (!map.has(key1)) {
      map.set(key1, new Map());
    }
    
    const innerMap = map.get(key1)!;
    if (!innerMap.has(key2)) {
      innerMap.set(key2, new Set());
    }
    
    innerMap.get(key2)!.add(value);
  }

  private removeFromNestedMap(
    map>>>,
    key1,
    key2,
    value
  ){
    const innerMap = map.get(key1);
    if (!innerMap) return;
    
    const valueSet = innerMap.get(key2);
    if (!valueSet) return;
    
    valueSet.delete(value);
    
    // Clean up empty structures
    if (valueSet.size === 0) {
      innerMap.delete(key2);
      if (innerMap.size === 0) {
        map.delete(key1);
      }
    }
  }

  private estimateIndexMemory(){
    let totalSize = 0;
    
    for (const index of Object.values(this.indexes)) {
      for (const [key1, innerMap] of index.entries()) {
        totalSize += key1.length * 2; // UTF-16 encoding
        for (const [key2, valueSet] of innerMap.entries()) {
          totalSize += key2.length * 2;
          for (const value of valueSet) {
            totalSize += value.length * 2;
          }
          totalSize += 24; // Set overhead
        }
        totalSize += 24; // Map overhead
      }
      totalSize += 24; // Outer Map overhead
    }
    
    return totalSize;
  }
}

export default TriplePatternMatcher;