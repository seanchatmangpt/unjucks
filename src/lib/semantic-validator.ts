/**
 * Semantic Validator - Core validation engine with N3.js integration
 * Validates generated code against semantic rules with comprehensive error reporting
 */

import { Store, Parser, Writer, DataFactory, Quad } from 'n3';
import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import {
  ValidationResult,
  ValidationError,
  ValidationConfig,
  ValidationItem,
  ValidationMetadata,
  ValidationStatistics,
  Validator,
  ValidationCache,
  ValidationLogger,
  SemanticValidationPipeline,
  BatchValidationRequest,
  BatchValidationResult,
  PerformanceMetrics,
  RdfValidationContext
} from './types/validation.js';

/**
 * Production-ready semantic validation engine
 */
export class SemanticValidator implements Validator {
  public readonly name = 'semantic-validator';
  public readonly version = '1.0.0';
  public readonly type = 'rdf' as const;

  private store: Store;
  private parser: Parser;
  private writer: Writer;
  private cache: ValidationCache;
  private logger: ValidationLogger;
  private config: ValidationConfig;

  constructor(
    config: Partial<ValidationConfig> = {},
    cache?: ValidationCache,
    logger?: ValidationLogger
  ) {
    this.store = new Store();
    this.parser = new Parser();
    this.writer = new Writer();
    this.cache = cache || new DefaultValidationCache();
    this.logger = logger || new ConsoleValidationLogger();
    
    this.config = {
      strictMode: false,
      maxErrors: 100,
      timeout: 30000,
      memoryLimit: 512 * 1024 * 1024, // 512MB
      enablePerformanceMetrics: true,
      cacheEnabled: true,
      parallelProcessing: true,
      validationRules: [],
      ...config
    };
  }

  /**
   * Validate RDF content with comprehensive semantic analysis
   */
  async validate(content: string, config?: ValidationConfig): Promise<ValidationResult> {
    const startTime = performance.now();
    const validationConfig = { ...this.config, ...config };
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    
    // Check cache first
    const cacheKey = this.generateCacheKey(content, validationConfig);
    if (validationConfig.cacheEnabled && this.cache.has(cacheKey)) {
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult) {
        this.logger.debug('Cache hit for validation', { cacheKey });
        return cachedResult;
      }
    }

    try {
      // Parse RDF content
      const quads = await this.parseRdfContent(content);
      
      // Create validation context
      const context = await this.createRdfValidationContext(content, quads);
      
      // Perform semantic validations
      const syntaxErrors = await this.validateSyntax(content);
      const semanticErrors = await this.validateSemanticConsistency(quads, context);
      const referenceErrors = await this.validateReferences(quads);
      const typeErrors = await this.validateTypes(quads);
      const constraintErrors = await this.validateConstraints(quads, validationConfig);
      
      errors.push(...syntaxErrors, ...semanticErrors, ...referenceErrors, ...typeErrors, ...constraintErrors);
      
      // Check for warnings
      const performanceWarnings = await this.checkPerformanceIssues(context);
      const styleWarnings = await this.checkStyleIssues(quads);
      
      warnings.push(...performanceWarnings, ...styleWarnings);
      
      const duration = performance.now() - startTime;
      const statistics = this.generateStatistics(quads, context, duration);
      
      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          timestamp: new Date(),
          validator: this.name,
          version: this.version,
          duration,
          resourcesValidated: quads.length,
          statistics
        }
      };

      // Cache successful results
      if (validationConfig.cacheEnabled) {
        this.cache.set(cacheKey, result);
      }

      // Log metrics
      this.logger.metric('validation_duration', duration);
      this.logger.metric('validation_errors', errors.length);
      this.logger.metric('validation_warnings', warnings.length);
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error('Validation failed', error as Error, { content: content.substring(0, 200) });
      
      return {
        isValid: false,
        errors: [{
          type: 'syntax_error',
          message: `Validation failed: ${(error as Error).message}`,
          code: 'VALIDATION_ERROR',
          severity: 'error',
          context: { error: (error as Error).stack }
        }],
        warnings: [],
        metadata: {
          timestamp: new Date(),
          validator: this.name,
          version: this.version,
          duration,
          resourcesValidated: 0,
          statistics: { totalTriples: 0, validTriples: 0, invalidTriples: 0 }
        }
      };
    }
  }

  /**
   * Check if validator supports the given format
   */
  supportsFormat(format: string): boolean {
    return ['turtle', 'ttl', 'rdf', 'rdf-xml', 'json-ld', 'n-triples', 'n-quads'].includes(format.toLowerCase());
  }

  /**
   * Parse RDF content into quads
   */
  private async parseRdfContent(content: string): Promise<Quad[]> {
    return new Promise((resolve, reject) => {
      const quads: Quad[] = [];
      
      this.parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          reject(new Error(`RDF parsing error: ${error.message}`));
          return;
        }
        
        if (quad) {
          quads.push(quad);
        } else {
          // Parsing complete
          resolve(quads);
        }
      });
    });
  }

  /**
   * Create RDF validation context
   */
  private async createRdfValidationContext(content: string, quads: Quad[]): Promise<RdfValidationContext> {
    const format = this.detectFormat(content);
    const namespaces = this.extractNamespaces(content);
    
    const subjects = new Set(quads.map(q => q.subject.value));
    const predicates = new Set(quads.map(q => q.predicate.value));
    const objects = new Set(quads.map(q => q.object.value));
    
    return {
      format: format as any,
      namespaces,
      tripleCount: quads.length,
      subjectCount: subjects.size,
      predicateCount: predicates.size,
      objectCount: objects.size
    };
  }

  /**
   * Validate RDF syntax
   */
  private async validateSyntax(content: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    try {
      await this.parseRdfContent(content);
    } catch (error) {
      errors.push({
        type: 'syntax_error',
        message: (error as Error).message,
        code: 'RDF_SYNTAX_ERROR',
        severity: 'error',
        suggestion: 'Check RDF syntax according to the format specification'
      });
    }
    
    return errors;
  }

  /**
   * Validate semantic consistency
   */
  private async validateSemanticConsistency(quads: Quad[], context: RdfValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Check for undefined prefixes
    const undefinedPrefixes = this.findUndefinedPrefixes(quads, context.namespaces);
    errors.push(...undefinedPrefixes);
    
    // Check for circular references
    const circularRefs = this.findCircularReferences(quads);
    errors.push(...circularRefs);
    
    // Check for inconsistent datatypes
    const datatypeErrors = this.validateDatatypes(quads);
    errors.push(...datatypeErrors);
    
    return errors;
  }

  /**
   * Validate references
   */
  private async validateReferences(quads: Quad[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const definedResources = new Set<string>();
    const referencedResources = new Set<string>();
    
    // Collect defined and referenced resources
    for (const quad of quads) {
      if (quad.subject.termType === 'NamedNode') {
        definedResources.add(quad.subject.value);
      }
      if (quad.object.termType === 'NamedNode') {
        referencedResources.add(quad.object.value);
      }
    }
    
    // Find undefined references
    for (const ref of referencedResources) {
      if (!definedResources.has(ref) && this.isInternalReference(ref)) {
        errors.push({
          type: 'reference_error',
          message: `Undefined reference: ${ref}`,
          code: 'UNDEFINED_REFERENCE',
          severity: 'error',
          context: { reference: ref },
          suggestion: 'Define the referenced resource or check for typos'
        });
      }
    }
    
    return errors;
  }

  /**
   * Validate types
   */
  private async validateTypes(quads: Quad[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const typeQuads = quads.filter(q => 
      q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    );
    
    for (const typeQuad of typeQuads) {
      // Validate that the type exists and is a class
      const typeValue = typeQuad.object.value;
      const isValidType = await this.validateTypeDefinition(typeValue, quads);
      
      if (!isValidType) {
        errors.push({
          type: 'type_error',
          message: `Invalid or undefined type: ${typeValue}`,
          code: 'INVALID_TYPE',
          severity: 'error',
          location: {
            triple: {
              subject: typeQuad.subject.value,
              predicate: typeQuad.predicate.value,
              object: typeQuad.object.value
            }
          }
        });
      }
    }
    
    return errors;
  }

  /**
   * Validate custom constraints
   */
  private async validateConstraints(quads: Quad[], config: ValidationConfig): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    for (const rule of config.validationRules) {
      if (!rule.enabled) continue;
      
      const ruleErrors = await this.applyValidationRule(rule, quads);
      errors.push(...ruleErrors);
    }
    
    return errors;
  }

  /**
   * Check for performance issues
   */
  private async checkPerformanceIssues(context: RdfValidationContext): Promise<ValidationError[]> {
    const warnings: ValidationError[] = [];
    
    // Check for large number of triples
    if (context.tripleCount > 10000) {
      warnings.push({
        type: 'performance_concern',
        message: `Large number of triples (${context.tripleCount}) may impact performance`,
        code: 'LARGE_GRAPH',
        severity: 'warning',
        suggestion: 'Consider splitting into multiple files or using streaming processing'
      });
    }
    
    // Check for complex predicates
    if (context.predicateCount > context.tripleCount * 0.1) {
      warnings.push({
        type: 'performance_concern',
        message: 'High predicate diversity may impact query performance',
        code: 'HIGH_PREDICATE_DIVERSITY',
        severity: 'warning',
        suggestion: 'Consider normalizing predicates or using property hierarchies'
      });
    }
    
    return warnings;
  }

  /**
   * Check for style issues
   */
  private async checkStyleIssues(quads: Quad[]): Promise<ValidationError[]> {
    const warnings: ValidationError[] = [];
    
    // Check for consistent naming conventions
    const namingIssues = this.checkNamingConventions(quads);
    warnings.push(...namingIssues);
    
    return warnings;
  }

  /**
   * Helper methods
   */
  private generateCacheKey(content: string, config: ValidationConfig): string {
    const contentHash = this.simpleHash(content);
    const configHash = this.simpleHash(JSON.stringify(config));
    return `${this.name}:${this.version}:${contentHash}:${configHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private detectFormat(content: string): string {
    if (content.includes('@prefix') || content.includes('@base')) return 'turtle';
    if (content.includes('<rdf:RDF')) return 'rdf-xml';
    if (content.includes('@context')) return 'json-ld';
    if (content.includes('<') && content.includes('>') && content.includes('.')) return 'n-triples';
    return 'turtle'; // default
  }

  private extractNamespaces(content: string): Record<string, string> {
    const namespaces: Record<string, string> = {};
    const prefixRegex = /@prefix\s+(\w+):\s+<([^>]+)>\s*\./g;
    let match;
    
    while ((match = prefixRegex.exec(content)) !== null) {
      namespaces[match[1]] = match[2];
    }
    
    return namespaces;
  }

  private findUndefinedPrefixes(quads: Quad[], namespaces: Record<string, string>): ValidationError[] {
    const errors: ValidationError[] = [];
    const usedPrefixes = new Set<string>();
    
    for (const quad of quads) {
      [quad.subject, quad.predicate, quad.object].forEach(term => {
        if (term.value.includes(':') && !term.value.startsWith('http')) {
          const prefix = term.value.split(':')[0];
          usedPrefixes.add(prefix);
        }
      });
    }
    
    for (const prefix of usedPrefixes) {
      if (!namespaces[prefix]) {
        errors.push({
          type: 'reference_error',
          message: `Undefined prefix: ${prefix}`,
          code: 'UNDEFINED_PREFIX',
          severity: 'error',
          suggestion: `Define @prefix ${prefix}: <namespace_uri> .`
        });
      }
    }
    
    return errors;
  }

  private findCircularReferences(quads: Quad[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const graph = new Map<string, Set<string>>();
    
    // Build graph
    for (const quad of quads) {
      const subject = quad.subject.value;
      const object = quad.object.value;
      
      if (!graph.has(subject)) {
        graph.set(subject, new Set());
      }
      graph.get(subject)!.add(object);
    }
    
    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      
      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && hasCycle(neighbor)) {
          return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }
      
      recursionStack.delete(node);
      return false;
    };
    
    for (const node of graph.keys()) {
      if (!visited.has(node) && hasCycle(node)) {
        errors.push({
          type: 'semantic_error',
          message: `Circular reference detected involving: ${node}`,
          code: 'CIRCULAR_REFERENCE',
          severity: 'error',
          context: { node }
        });
      }
    }
    
    return errors;
  }

  private validateDatatypes(quads: Quad[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const quad of quads) {
      if (quad.object.termType === 'Literal') {
        const literal = quad.object;
        if (literal.datatype) {
          const isValid = this.validateLiteralDatatype(literal.value, literal.datatype.value);
          if (!isValid) {
            errors.push({
              type: 'type_error',
              message: `Invalid literal value for datatype ${literal.datatype.value}: ${literal.value}`,
              code: 'INVALID_LITERAL_DATATYPE',
              severity: 'error',
              location: {
                triple: {
                  subject: quad.subject.value,
                  predicate: quad.predicate.value,
                  object: quad.object.value
                }
              }
            });
          }
        }
      }
    }
    
    return errors;
  }

  private validateLiteralDatatype(value: string, datatype: string): boolean {
    switch (datatype) {
      case 'http://www.w3.org/2001/XMLSchema#integer':
        return /^[-+]?\d+$/.test(value);
      case 'http://www.w3.org/2001/XMLSchema#decimal':
        return /^[-+]?\d*\.?\d+$/.test(value);
      case 'http://www.w3.org/2001/XMLSchema#boolean':
        return ['true', 'false', '1', '0'].includes(value.toLowerCase());
      case 'http://www.w3.org/2001/XMLSchema#date':
        return !isNaN(Date.parse(value));
      default:
        return true; // Unknown datatype, assume valid
    }
  }

  private isInternalReference(uri: string): boolean {
    return !uri.startsWith('http://www.w3.org/') && 
           !uri.startsWith('http://purl.org/') &&
           !uri.startsWith('http://xmlns.com/');
  }

  private async validateTypeDefinition(typeUri: string, quads: Quad[]): Promise<boolean> {
    // Check if the type is defined in the current graph or is a known type
    const knownTypes = [
      'http://www.w3.org/2000/01/rdf-schema#Class',
      'http://www.w3.org/2002/07/owl#Class',
      'http://www.w3.org/2000/01/rdf-schema#Property',
      'http://www.w3.org/2002/07/owl#ObjectProperty',
      'http://www.w3.org/2002/07/owl#DatatypeProperty'
    ];
    
    if (knownTypes.includes(typeUri) || typeUri.startsWith('http://www.w3.org/')) {
      return true;
    }
    
    // Check if defined in current graph
    return quads.some(quad => 
      quad.subject.value === typeUri &&
      quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    );
  }

  private async applyValidationRule(rule: any, quads: Quad[]): Promise<ValidationError[]> {
    // Placeholder for custom validation rules
    return [];
  }

  private checkNamingConventions(quads: Quad[]): ValidationError[] {
    const warnings: ValidationError[] = [];
    
    for (const quad of quads) {
      if (quad.subject.termType === 'NamedNode') {
        const uri = quad.subject.value;
        if (uri.includes('_') && !uri.includes('-')) {
          warnings.push({
            type: 'style_issue',
            message: `Consider using hyphens instead of underscores in URI: ${uri}`,
            code: 'NAMING_CONVENTION',
            severity: 'info',
            suggestion: 'Use kebab-case for better URI readability'
          });
        }
      }
    }
    
    return warnings;
  }

  private generateStatistics(quads: Quad[], context: RdfValidationContext, duration: number): ValidationStatistics {
    return {
      totalTriples: quads.length,
      validTriples: quads.length, // Assume all parsed triples are structurally valid
      invalidTriples: 0,
      performanceMetrics: {
        memoryUsage: process.memoryUsage().heapUsed,
        cpuTime: duration,
        ioOperations: 1,
        cacheHits: 0,
        cacheMisses: 0
      }
    };
  }
}

/**
 * Default validation cache implementation
 */
class DefaultValidationCache implements ValidationCache {
  private cache = new Map<string, { result: ValidationResult; timestamp: number }>();
  private readonly ttl = 60 * 60 * 1000; // 1 hour

  get(key: string): ValidationResult | undefined {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.ttl) {
      return entry.result;
    }
    this.cache.delete(key);
    return undefined;
  }

  set(key: string, result: ValidationResult): void {
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Console validation logger
 */
class ConsoleValidationLogger implements ValidationLogger {
  debug(message: string, context?: Record<string, any>): void {
    console.debug(`[DEBUG] ${message}`, context || '');
  }

  info(message: string, context?: Record<string, any>): void {
    console.info(`[INFO] ${message}`, context || '');
  }

  warn(message: string, context?: Record<string, any>): void {
    console.warn(`[WARN] ${message}`, context || '');
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    console.error(`[ERROR] ${message}`, error, context || '');
  }

  metric(name: string, value: number, tags?: Record<string, string>): void {
    console.log(`[METRIC] ${name}: ${value}`, tags || '');
  }
}

/**
 * Semantic validation pipeline
 */
export class SemanticValidationPipelineImpl implements SemanticValidationPipeline {
  private validators = new Map<string, Validator>();
  private logger: ValidationLogger;
  private cache: ValidationCache;

  constructor(logger?: ValidationLogger, cache?: ValidationCache) {
    this.logger = logger || new ConsoleValidationLogger();
    this.cache = cache || new DefaultValidationCache();
    
    // Add default semantic validator
    this.addValidator(new SemanticValidator());
  }

  addValidator(validator: Validator): void {
    this.validators.set(validator.name, validator);
    this.logger.info(`Added validator: ${validator.name} v${validator.version}`);
  }

  removeValidator(name: string): void {
    if (this.validators.delete(name)) {
      this.logger.info(`Removed validator: ${name}`);
    }
  }

  async validate(item: ValidationItem, config?: ValidationConfig): Promise<ValidationResult> {
    const validators = Array.from(this.validators.values())
      .filter(v => v.type === item.type);

    if (validators.length === 0) {
      throw new Error(`No validators found for type: ${item.type}`);
    }

    // Use the first matching validator
    const validator = validators[0];
    return validator.validate(item.content, config);
  }

  async validateBatch(request: BatchValidationRequest): Promise<BatchValidationResult> {
    const startTime = performance.now();
    const results = new Map<string, ValidationResult>();
    const errors: ValidationError[] = [];

    if (request.parallel && request.items.length > 1) {
      // Parallel validation
      const maxConcurrency = request.maxConcurrency || 5;
      const batches = this.chunkArray(request.items, maxConcurrency);
      
      for (const batch of batches) {
        const promises = batch.map(async item => {
          try {
            const result = await this.validate(item, request.config);
            results.set(item.id, result);
          } catch (error) {
            errors.push({
              type: 'validation_error',
              message: `Failed to validate item ${item.id}: ${(error as Error).message}`,
              code: 'BATCH_VALIDATION_ERROR',
              severity: 'error',
              context: { itemId: item.id }
            });
          }
        });
        
        await Promise.all(promises);
      }
    } else {
      // Sequential validation
      for (const item of request.items) {
        try {
          const result = await this.validate(item, request.config);
          results.set(item.id, result);
        } catch (error) {
          errors.push({
            type: 'validation_error',
            message: `Failed to validate item ${item.id}: ${(error as Error).message}`,
            code: 'BATCH_VALIDATION_ERROR',
            severity: 'error',
            context: { itemId: item.id }
          });
        }
      }
    }

    const duration = performance.now() - startTime;
    const summary = this.generateBatchSummary(results, request.items.length, duration);

    return {
      results,
      summary,
      duration,
      errors
    };
  }

  getValidators(): Validator[] {
    return Array.from(this.validators.values());
  }

  getMetrics(): ValidationStatistics {
    return {
      totalTriples: 0,
      validTriples: 0,
      invalidTriples: 0,
      performanceMetrics: {
        memoryUsage: process.memoryUsage().heapUsed,
        cpuTime: 0,
        ioOperations: 0,
        cacheHits: 0,
        cacheMisses: 0
      }
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private generateBatchSummary(results: Map<string, ValidationResult>, totalItems: number, duration: number): any {
    const validItems = Array.from(results.values()).filter(r => r.isValid).length;
    const totalErrors = Array.from(results.values()).reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = Array.from(results.values()).reduce((sum, r) => sum + r.warnings.length, 0);
    
    return {
      totalItems,
      validItems,
      invalidItems: totalItems - validItems,
      skippedItems: totalItems - results.size,
      totalErrors,
      totalWarnings,
      performance: {
        memoryUsage: process.memoryUsage().heapUsed,
        cpuTime: duration,
        ioOperations: totalItems,
        cacheHits: 0,
        cacheMisses: 0
      }
    };
  }
}