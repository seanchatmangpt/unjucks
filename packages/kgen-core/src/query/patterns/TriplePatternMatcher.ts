/**
 * High-Performance Triple Pattern Matching Engine
 * 
 * Optimized pattern matching for large RDF graphs with indexing and caching
 */

import { TriplePattern, TripleComponent, Binding, Index, PatternMatch } from '../types/index.js';
import { EventEmitter } from 'events';
import { Store, Quad, Term, DataFactory } from 'n3';

const { namedNode, literal, blankNode, variable } = DataFactory;

export interface TripleIndex {
  spo: Map<string, Map<string, Set<string>>>;  // Subject -> Predicate -> Object
  pos: Map<string, Map<string, Set<string>>>;  // Predicate -> Object -> Subject
  ops: Map<string, Map<string, Set<string>>>;  // Object -> Predicate -> Subject
  sop: Map<string, Map<string, Set<string>>>;  // Subject -> Object -> Predicate
  pso: Map<string, Map<string, Set<string>>>;  // Predicate -> Subject -> Object
  osp: Map<string, Map<string, Set<string>>>;  // Object -> Subject -> Predicate
}

export interface MatchingOptions {
  maxResults?: number;
  enableStatistics?: boolean;
  useIndex?: boolean;
  orderBy?: 'selectivity' | 'cost' | 'none';
  timeout?: number;
}

export class TriplePatternMatcher extends EventEmitter {
  private store: Store;
  private indexes: TripleIndex;
  private statistics: Map<string, any> = new Map();
  private indexEnabled = true;
  private indexSize = 0;

  constructor(store: Store, enableIndexes = true) {
    super();
    this.store = store;
    this.indexEnabled = enableIndexes;
    
    this.indexes = {
      spo: new Map(),
      pos: new Map(), 
      ops: new Map(),
      sop: new Map(),
      pso: new Map(),
      osp: new Map()
    };

    if (enableIndexes) {
      this.buildIndexes();
    }
  }

  /**
   * Match a single triple pattern against the store
   */
  async matchPattern(
    pattern: TriplePattern,
    bindings: Binding[] = [{}],
    options: MatchingOptions = {}
  ): Promise<PatternMatch> {
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

      const result: PatternMatch = {
        pattern,
        bindings: matches,
        cost,
        selectivity
      };

      this.emit('pattern:matched', {
        pattern,
        resultCount: matches.length,
        executionTime: cost,
        strategy
      });

      return result;

    } catch (error) {
      this.emit('pattern:error', { pattern, error });
      throw error;
    }
  }

  /**
   * Match multiple patterns with join optimization
   */
  async matchPatterns(
    patterns: TriplePattern[],
    options: MatchingOptions = {}
  ): Promise<Binding[]> {
    if (patterns.length === 0) return [{}];
    if (patterns.length === 1) {
      const match = await this.matchPattern(patterns[0], [{}], options);
      return match.bindings;
    }

    // Order patterns by estimated selectivity
    const orderedPatterns = this.orderPatternsBySelectivity(patterns);
    
    let currentBindings: Binding[] = [{}];
    
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
  getPatternStatistics(pattern?: TriplePattern): Map<string, any> {
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
  buildIndexes(): void {
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
    
    this.emit('indexes:built', {
      indexSize: this.indexSize,
      buildTime,
      quadCount: quads.length
    });
  }

  /**
   * Add a quad to all indexes
   */
  addQuadToIndexes(quad: Quad): void {
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
  removeQuadFromIndexes(quad: Quad): void {
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
  getIndexInfo(): Record<string, any> {
    return {
      enabled: this.indexEnabled,
      size: this.indexSize,
      spoSize: this.indexes.spo.size,
      posSize: this.indexes.pos.size,
      opsSize: this.indexes.ops.size,
      sopSize: this.indexes.sop.size,
      psoSize: this.indexes.pso.size,
      ospSize: this.indexes.osp.size,
      memoryEstimate: this.estimateIndexMemory()
    };
  }

  // Private methods

  private applyBindings(pattern: TriplePattern, bindings: Binding): TriplePattern {
    const applyToComponent = (component: TripleComponent): TripleComponent => {
      if (component.type === 'variable' && bindings[component.value]) {
        const binding = bindings[component.value];
        return {
          type: binding.type as 'uri' | 'literal' | 'blank',
          value: binding.value,
          datatype: binding.datatype,
          language: binding.language
        };
      }
      return component;
    };

    return {
      subject: applyToComponent(pattern.subject),
      predicate: applyToComponent(pattern.predicate),
      object: applyToComponent(pattern.object),
      graph: pattern.graph ? applyToComponent(pattern.graph) : undefined
    };
  }

  private selectMatchingStrategy(pattern: TriplePattern): string {
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
    pattern: TriplePattern,
    strategy: string,
    options: MatchingOptions
  ): Promise<Binding[]> {
    if (!this.indexEnabled) {
      return this.scanStoreForPattern(pattern, options);
    }

    const matches: Binding[] = [];
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
        default:
          return this.scanStoreForPattern(pattern, options);
      }
    } catch (error) {
      // Fallback to store scan if index lookup fails
      return this.scanStoreForPattern(pattern, options);
    }
  }

  private matchUsingSPOIndex(pattern: TriplePattern, options: MatchingOptions): Binding[] {
    const matches: Binding[] = [];
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
      // Subject is bound - use it as key
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

  private matchUsingPOSIndex(pattern: TriplePattern, options: MatchingOptions): Binding[] {
    const matches: Binding[] = [];
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
      // Predicate is bound - use it as key
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

  private matchUsingOPSIndex(pattern: TriplePattern, options: MatchingOptions): Binding[] {
    const matches: Binding[] = [];
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
      // Object is bound - use it as key
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

  private matchUsingSOPIndex(pattern: TriplePattern, options: MatchingOptions): Binding[] {
    // Similar to SPO but with different ordering
    return this.matchUsingSPOIndex(pattern, options);
  }

  private matchUsingPSOIndex(pattern: TriplePattern, options: MatchingOptions): Binding[] {
    // Similar to POS but with different ordering
    return this.matchUsingPOSIndex(pattern, options);
  }

  private matchUsingOSPIndex(pattern: TriplePattern, options: MatchingOptions): Binding[] {
    // Similar to OPS but with different ordering
    return this.matchUsingOPSIndex(pattern, options);
  }

  private matchPredicateObject(
    pattern: TriplePattern,
    subjectValue: string,
    pMap: Map<string, Set<string>>,
    boundComponent: string
  ): Binding[] | null {
    const matches: Binding[] = [];

    if (pattern.predicate.type === 'variable') {
      // Predicate is variable - iterate over all predicates for this subject
      for (const [p, oSet] of pMap.entries()) {
        const objectMatches = this.matchObjectInSet(pattern, p, oSet, boundComponent, subjectValue);
        matches.push(...objectMatches);
      }
    } else {
      // Predicate is bound - use it as key
      const oSet = pMap.get(pattern.predicate.value);
      if (oSet) {
        const objectMatches = this.matchObjectInSet(pattern, pattern.predicate.value, oSet, boundComponent, subjectValue);
        matches.push(...objectMatches);
      }
    }

    return matches.length > 0 ? matches : null;
  }

  private matchObjectSubject(
    pattern: TriplePattern,
    predicateValue: string,
    oMap: Map<string, Set<string>>,
    boundComponent: string
  ): Binding[] | null {
    const matches: Binding[] = [];

    if (pattern.object.type === 'variable') {
      // Object is variable - iterate over all objects for this predicate
      for (const [o, sSet] of oMap.entries()) {
        const subjectMatches = this.matchSubjectInSet(pattern, predicateValue, o, sSet, boundComponent);
        matches.push(...subjectMatches);
      }
    } else {
      // Object is bound - use it as key
      const sSet = oMap.get(pattern.object.value);
      if (sSet) {
        const subjectMatches = this.matchSubjectInSet(pattern, predicateValue, pattern.object.value, sSet, boundComponent);
        matches.push(...subjectMatches);
      }
    }

    return matches.length > 0 ? matches : null;
  }

  private matchPredicateSubject(
    pattern: TriplePattern,
    objectValue: string,
    pMap: Map<string, Set<string>>,
    boundComponent: string
  ): Binding[] | null {
    const matches: Binding[] = [];

    if (pattern.predicate.type === 'variable') {
      // Predicate is variable - iterate over all predicates for this object
      for (const [p, sSet] of pMap.entries()) {
        const subjectMatches = this.matchSubjectInSet(pattern, p, objectValue, sSet, boundComponent);
        matches.push(...subjectMatches);
      }
    } else {
      // Predicate is bound - use it as key
      const sSet = pMap.get(pattern.predicate.value);
      if (sSet) {
        const subjectMatches = this.matchSubjectInSet(pattern, pattern.predicate.value, objectValue, sSet, boundComponent);
        matches.push(...subjectMatches);
      }
    }

    return matches.length > 0 ? matches : null;
  }

  private matchObjectInSet(
    pattern: TriplePattern,
    predicateValue: string,
    objectSet: Set<string>,
    boundComponent: string,
    subjectValue: string
  ): Binding[] {
    const matches: Binding[] = [];

    if (pattern.object.type === 'variable') {
      // Object is variable - add all objects in set
      for (const o of objectSet) {
        const binding: Binding = {};
        
        if (pattern.subject.type === 'variable' && boundComponent !== 'subject') {
          binding[pattern.subject.value] = { type: 'uri', value: subjectValue };
        }
        if (pattern.predicate.type === 'variable') {
          binding[pattern.predicate.value] = { type: 'uri', value: predicateValue };
        }
        binding[pattern.object.value] = { type: 'uri', value: o };
        
        matches.push(binding);
      }
    } else {
      // Object is bound - check if it exists in set
      if (objectSet.has(pattern.object.value)) {
        const binding: Binding = {};
        
        if (pattern.subject.type === 'variable' && boundComponent !== 'subject') {
          binding[pattern.subject.value] = { type: 'uri', value: subjectValue };
        }
        if (pattern.predicate.type === 'variable') {
          binding[pattern.predicate.value] = { type: 'uri', value: predicateValue };
        }
        
        matches.push(binding);
      }
    }

    return matches;
  }

  private matchSubjectInSet(
    pattern: TriplePattern,
    predicateValue: string,
    objectValue: string,
    subjectSet: Set<string>,
    boundComponent: string
  ): Binding[] {
    const matches: Binding[] = [];

    if (pattern.subject.type === 'variable') {
      // Subject is variable - add all subjects in set
      for (const s of subjectSet) {
        const binding: Binding = {};
        
        binding[pattern.subject.value] = { type: 'uri', value: s };
        if (pattern.predicate.type === 'variable' && boundComponent !== 'predicate') {
          binding[pattern.predicate.value] = { type: 'uri', value: predicateValue };
        }
        if (pattern.object.type === 'variable' && boundComponent !== 'object') {
          binding[pattern.object.value] = { type: 'uri', value: objectValue };
        }
        
        matches.push(binding);
      }
    } else {
      // Subject is bound - check if it exists in set
      if (subjectSet.has(pattern.subject.value)) {
        const binding: Binding = {};
        
        if (pattern.predicate.type === 'variable' && boundComponent !== 'predicate') {
          binding[pattern.predicate.value] = { type: 'uri', value: predicateValue };
        }
        if (pattern.object.type === 'variable' && boundComponent !== 'object') {
          binding[pattern.object.value] = { type: 'uri', value: objectValue };
        }
        
        matches.push(binding);
      }
    }

    return matches;
  }

  private scanStoreForPattern(pattern: TriplePattern, options: MatchingOptions): Binding[] {
    const matches: Binding[] = [];
    const maxResults = options.maxResults || 10000;

    // Convert pattern to N3 terms for querying
    const subject = pattern.subject.type === 'variable' ? null : this.createTerm(pattern.subject);
    const predicate = pattern.predicate.type === 'variable' ? null : this.createTerm(pattern.predicate);
    const object = pattern.object.type === 'variable' ? null : this.createTerm(pattern.object);

    const quads = this.store.getQuads(subject, predicate, object);

    for (const quad of quads) {
      if (matches.length >= maxResults) break;

      const binding: Binding = {};
      
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

  private createTerm(component: TripleComponent): Term {
    switch (component.type) {
      case 'uri':
        return namedNode(component.value);
      case 'literal':
        return literal(component.value, component.datatype || component.language);
      case 'blank':
        return blankNode(component.value);
      default:
        return variable(component.value);
    }
  }

  private termToBindingValue(term: Term): any {
    if (term.termType === 'NamedNode') {
      return { type: 'uri', value: term.value };
    } else if (term.termType === 'Literal') {
      return {
        type: 'literal',
        value: term.value,
        datatype: term.datatype?.value,
        language: term.language
      };
    } else if (term.termType === 'BlankNode') {
      return { type: 'bnode', value: term.value };
    }
    return { type: 'uri', value: term.value };
  }

  private orderPatternsBySelectivity(patterns: TriplePattern[]): TriplePattern[] {
    return patterns.sort((a, b) => {
      const aSelectivity = this.estimatePatternSelectivity(a);
      const bSelectivity = this.estimatePatternSelectivity(b);
      return aSelectivity - bSelectivity;
    });
  }

  private estimatePatternSelectivity(pattern: TriplePattern): number {
    let selectivity = 1.0;

    // Constants are more selective than variables
    if (pattern.subject.type !== 'variable') selectivity *= 0.1;
    if (pattern.predicate.type !== 'variable') selectivity *= 0.2;
    if (pattern.object.type !== 'variable') selectivity *= 0.1;

    return selectivity;
  }

  private joinBindings(left: Binding[], right: Binding[]): Binding[] {
    const result: Binding[] = [];

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

  private mergeBindings(left: Binding, right: Binding): Binding | null {
    const merged: Binding = { ...left };

    for (const [variable, value] of Object.entries(right)) {
      if (merged[variable]) {
        // Check for conflicts
        if (merged[variable].value !== value.value || merged[variable].type !== value.type) {
          return null; // Conflict - bindings cannot be merged
        }
      } else {
        merged[variable] = value;
      }
    }

    return merged;
  }

  private calculateSelectivity(pattern: TriplePattern, resultCount: number): number {
    // Estimate total possible results for comparison
    const totalTriples = this.indexSize || this.store.size;
    return totalTriples > 0 ? resultCount / totalTriples : 0;
  }

  private updatePatternStatistics(
    pattern: TriplePattern,
    cost: number,
    selectivity: number,
    resultCount: number
  ): void {
    const key = this.getPatternKey(pattern);
    const existing = this.statistics.get(key) || {
      executionCount: 0,
      totalCost: 0,
      totalResults: 0,
      bestSelectivity: 1.0
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

  private getPatternKey(pattern: TriplePattern): string {
    const s = pattern.subject.type === 'variable' ? '?s' : pattern.subject.value;
    const p = pattern.predicate.type === 'variable' ? '?p' : pattern.predicate.value;
    const o = pattern.object.type === 'variable' ? '?o' : pattern.object.value;
    return `${s}|${p}|${o}`;
  }

  private addToNestedMap(
    map: Map<string, Map<string, Set<string>>>,
    key1: string,
    key2: string,
    value: string
  ): void {
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
    map: Map<string, Map<string, Set<string>>>,
    key1: string,
    key2: string,
    value: string
  ): void {
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

  private estimateIndexMemory(): number {
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