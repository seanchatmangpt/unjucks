/**
 * SHACL Validator - Validates RDF/TTL data against SHACL shapes
 * Production-ready SHACL validation with comprehensive constraint checking
 */

import { Store, Parser, DataFactory, Quad, NamedNode, Literal, BlankNode } from 'n3';
import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import {
  ValidationResult,
  ValidationError,
  ValidationConfig,
  ShaclValidationReport,
  ShaclValidationResult,
  Validator,
  ValidationItem,
  ValidationMetadata,
  ValidationStatistics
} from './types/validation.js';

/**
 * SHACL constraint types
 */
interface ShaclShape {
  id: string;
  targetClass?: string;
  targetNode?: string[];
  targetSubjectsOf?: string;
  targetObjectsOf?: string;
  property: ShaclPropertyShape[];
  closed?: boolean;
  ignoredProperties?: string[];
  severity: 'Violation' | 'Warning' | 'Info';
  message?: string;
}

interface ShaclPropertyShape {
  path: string;
  datatype?: string;
  nodeKind?: 'IRI' | 'BlankNode' | 'Literal' | 'BlankNodeOrIRI' | 'BlankNodeOrLiteral' | 'IRIOrLiteral';
  minCount?: number;
  maxCount?: number;
  minInclusive?: number;
  maxInclusive?: number;
  minExclusive?: number;
  maxExclusive?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  flags?: string;
  in?: string[];
  hasValue?: string;
  class?: string;
  node?: string;
  qualifiedValueShape?: string;
  qualifiedMinCount?: number;
  qualifiedMaxCount?: number;
  severity: 'Violation' | 'Warning' | 'Info';
  message?: string;
}

/**
 * High-performance SHACL validator
 */
export class ShaclValidator implements Validator {
  public readonly name = 'shacl-validator';
  public readonly version = '1.0.0';
  public readonly type = 'rdf' as const;

  private shaclStore: Store;
  private dataStore: Store;
  private parser: Parser;
  private shapes: Map<string, ShaclShape>;
  private namespaces: Record<string, string>;

  constructor() {
    this.shaclStore = new Store();
    this.dataStore = new Store();
    this.parser = new Parser();
    this.shapes = new Map();
    this.namespaces = {
      'sh': 'http://www.w3.org/ns/shacl#',
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'xsd': 'http://www.w3.org/2001/XMLSchema#'
    };
  }

  /**
   * Validate data against SHACL shapes
   */
  async validate(content: string, config?: ValidationConfig): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // Parse data content
      const dataQuads = await this.parseRdfContent(content);
      this.dataStore.addQuads(dataQuads);

      // Load SHACL shapes if provided
      if (config?.shaclShapes && config.shaclShapes.length > 0) {
        await this.loadShaclShapes(config.shaclShapes);
      } else {
        // Try to find shapes in the data itself
        this.extractInlineShapes(dataQuads);
      }

      // Perform SHACL validation
      const report = await this.validateAgainstShapes();
      
      // Convert SHACL results to validation errors
      for (const result of report.results) {
        const error: ValidationError = {
          type: 'shape_violation',
          message: result.resultMessage,
          code: `SHACL_${result.sourceConstraintComponent.replace(/.*#/, '').toUpperCase()}`,
          severity: result.resultSeverity === 'Violation' ? 'error' : 
                   result.resultSeverity === 'Warning' ? 'warning' : 'info',
          location: {
            triple: {
              subject: result.focusNode,
              predicate: result.resultPath || '',
              object: result.value || ''
            }
          },
          context: {
            focusNode: result.focusNode,
            sourceShape: result.sourceShape,
            sourceConstraintComponent: result.sourceConstraintComponent,
            detail: result.detail
          },
          suggestion: this.generateSuggestion(result)
        };

        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      }

      const duration = performance.now() - startTime;
      const statistics = this.generateStatistics(dataQuads, report, duration);

      return {
        isValid: !report.results.some(r => r.resultSeverity === 'Violation'),
        errors,
        warnings,
        metadata: {
          timestamp: new Date(),
          validator: this.name,
          version: this.version,
          duration,
          resourcesValidated: dataQuads.length,
          statistics
        }
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      
      return {
        isValid: false,
        errors: [{
          type: 'validation_error',
          message: `SHACL validation failed: ${(error as Error).message}`,
          code: 'SHACL_VALIDATION_ERROR',
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
   * Load SHACL shapes from files or strings
   */
  async loadShaclShapes(shapeSources: string[]): Promise<void> {
    for (const source of shapeSources) {
      let content: string;
      
      if (source.startsWith('@prefix') || source.includes('<http')) {
        // Inline SHACL content
        content = source;
      } else {
        // File path
        try {
          content = await fs.readFile(source, 'utf-8');
        } catch (error) {
          throw new Error(`Failed to load SHACL shapes from ${source}: ${(error as Error).message}`);
        }
      }

      const shapeQuads = await this.parseRdfContent(content);
      this.shaclStore.addQuads(shapeQuads);
      this.parseShapesFromQuads(shapeQuads);
    }
  }

  /**
   * Check if validator supports the given format
   */
  supportsFormat(format: string): boolean {
    return ['turtle', 'ttl', 'rdf', 'rdf-xml', 'json-ld', 'n-triples'].includes(format.toLowerCase());
  }

  /**
   * Parse RDF content into quads
   */
  private async parseRdfContent(content: string): Promise<Quad[]> {
    return new Promise((resolve, reject) => {
      const quads: Quad[] = [];
      
      this.parser.parse(content, (error, quad) => {
        if (error) {
          reject(new Error(`RDF parsing error: ${error.message}`));
          return;
        }
        
        if (quad) {
          quads.push(quad);
        } else {
          resolve(quads);
        }
      });
    });
  }

  /**
   * Extract inline SHACL shapes from data
   */
  private extractInlineShapes(quads: Quad[]): void {
    const shapeQuads = quads.filter(quad => 
      quad.object.value === this.namespaces.sh + 'NodeShape' ||
      quad.object.value === this.namespaces.sh + 'PropertyShape'
    );
    
    if (shapeQuads.length > 0) {
      this.shaclStore.addQuads(shapeQuads);
      this.parseShapesFromQuads(shapeQuads);
    }
  }

  /**
   * Parse SHACL shapes from quads
   */
  private parseShapesFromQuads(quads: Quad[]): void {
    const nodeShapes = this.findNodeShapes(quads);
    
    for (const nodeShapeQuad of nodeShapes) {
      const shape = this.parseNodeShape(nodeShapeQuad.subject, quads);
      if (shape) {
        this.shapes.set(shape.id, shape);
      }
    }
  }

  /**
   * Find all node shapes in quads
   */
  private findNodeShapes(quads: Quad[]): Quad[] {
    return quads.filter(quad =>
      quad.predicate.value === this.namespaces.rdf + 'type' &&
      quad.object.value === this.namespaces.sh + 'NodeShape'
    );
  }

  /**
   * Parse a single node shape
   */
  private parseNodeShape(subject: NamedNode | BlankNode, quads: Quad[]): ShaclShape | null {
    const shapeQuads = quads.filter(q => q.subject.equals(subject));
    if (shapeQuads.length === 0) return null;

    const shape: ShaclShape = {
      id: subject.value,
      property: [],
      severity: 'Violation'
    };

    for (const quad of shapeQuads) {
      switch (quad.predicate.value) {
        case this.namespaces.sh + 'targetClass':
          shape.targetClass = quad.object.value;
          break;
        case this.namespaces.sh + 'targetNode':
          if (!shape.targetNode) shape.targetNode = [];
          shape.targetNode.push(quad.object.value);
          break;
        case this.namespaces.sh + 'targetSubjectsOf':
          shape.targetSubjectsOf = quad.object.value;
          break;
        case this.namespaces.sh + 'targetObjectsOf':
          shape.targetObjectsOf = quad.object.value;
          break;
        case this.namespaces.sh + 'property':
          const propertyShape = this.parsePropertyShape(quad.object, quads);
          if (propertyShape) {
            shape.property.push(propertyShape);
          }
          break;
        case this.namespaces.sh + 'closed':
          shape.closed = quad.object.value === 'true';
          break;
        case this.namespaces.sh + 'severity':
          shape.severity = quad.object.value.replace(/.*#/, '') as any;
          break;
        case this.namespaces.sh + 'message':
          shape.message = quad.object.value;
          break;
      }
    }

    return shape;
  }

  /**
   * Parse a property shape
   */
  private parsePropertyShape(subject: NamedNode | BlankNode | Literal, quads: Quad[]): ShaclPropertyShape | null {
    if (subject.termType === 'Literal') return null;
    
    const propertyQuads = quads.filter(q => q.subject.equals(subject));
    if (propertyQuads.length === 0) return null;

    const propertyShape: ShaclPropertyShape = {
      path: '',
      severity: 'Violation'
    };

    for (const quad of propertyQuads) {
      switch (quad.predicate.value) {
        case this.namespaces.sh + 'path':
          propertyShape.path = quad.object.value;
          break;
        case this.namespaces.sh + 'datatype':
          propertyShape.datatype = quad.object.value;
          break;
        case this.namespaces.sh + 'nodeKind':
          propertyShape.nodeKind = quad.object.value.replace(/.*#/, '') as any;
          break;
        case this.namespaces.sh + 'minCount':
          propertyShape.minCount = parseInt(quad.object.value);
          break;
        case this.namespaces.sh + 'maxCount':
          propertyShape.maxCount = parseInt(quad.object.value);
          break;
        case this.namespaces.sh + 'minInclusive':
          propertyShape.minInclusive = parseFloat(quad.object.value);
          break;
        case this.namespaces.sh + 'maxInclusive':
          propertyShape.maxInclusive = parseFloat(quad.object.value);
          break;
        case this.namespaces.sh + 'minLength':
          propertyShape.minLength = parseInt(quad.object.value);
          break;
        case this.namespaces.sh + 'maxLength':
          propertyShape.maxLength = parseInt(quad.object.value);
          break;
        case this.namespaces.sh + 'pattern':
          propertyShape.pattern = quad.object.value;
          break;
        case this.namespaces.sh + 'class':
          propertyShape.class = quad.object.value;
          break;
        case this.namespaces.sh + 'hasValue':
          propertyShape.hasValue = quad.object.value;
          break;
        case this.namespaces.sh + 'severity':
          propertyShape.severity = quad.object.value.replace(/.*#/, '') as any;
          break;
        case this.namespaces.sh + 'message':
          propertyShape.message = quad.object.value;
          break;
      }
    }

    return propertyShape.path ? propertyShape : null;
  }

  /**
   * Validate data against all loaded shapes
   */
  private async validateAgainstShapes(): Promise<ShaclValidationReport> {
    const results: ShaclValidationResult[] = [];
    
    for (const [shapeId, shape] of this.shapes) {
      const focusNodes = this.findFocusNodes(shape);
      
      for (const focusNode of focusNodes) {
        const shapeResults = await this.validateNodeAgainstShape(focusNode, shape);
        results.push(...shapeResults);
      }
    }

    return {
      conforms: !results.some(r => r.resultSeverity === 'Violation'),
      results,
      shapesGraph: '', // Could be serialized shapes
      dataGraph: '', // Could be serialized data
      metadata: {
        timestamp: new Date(),
        validator: this.name,
        version: this.version,
        duration: 0,
        resourcesValidated: results.length,
        statistics: { totalTriples: 0, validTriples: 0, invalidTriples: 0 }
      }
    };
  }

  /**
   * Find focus nodes for a shape
   */
  private findFocusNodes(shape: ShaclShape): string[] {
    const focusNodes = new Set<string>();

    // Target class
    if (shape.targetClass) {
      const typeQuads = this.dataStore.getQuads(
        null,
        DataFactory.namedNode(this.namespaces.rdf + 'type'),
        DataFactory.namedNode(shape.targetClass),
        null
      );
      typeQuads.forEach(quad => focusNodes.add(quad.subject.value));
    }

    // Target nodes
    if (shape.targetNode) {
      shape.targetNode.forEach(node => focusNodes.add(node));
    }

    // Target subjects of
    if (shape.targetSubjectsOf) {
      const subjectQuads = this.dataStore.getQuads(
        null,
        DataFactory.namedNode(shape.targetSubjectsOf),
        null,
        null
      );
      subjectQuads.forEach(quad => focusNodes.add(quad.subject.value));
    }

    // Target objects of
    if (shape.targetObjectsOf) {
      const objectQuads = this.dataStore.getQuads(
        null,
        DataFactory.namedNode(shape.targetObjectsOf),
        null,
        null
      );
      objectQuads.forEach(quad => {
        if (quad.object.termType === 'NamedNode') {
          focusNodes.add(quad.object.value);
        }
      });
    }

    return Array.from(focusNodes);
  }

  /**
   * Validate a single node against a shape
   */
  private async validateNodeAgainstShape(focusNode: string, shape: ShaclShape): Promise<ShaclValidationResult[]> {
    const results: ShaclValidationResult[] = [];

    // Validate property shapes
    for (const propertyShape of shape.property) {
      const propertyResults = await this.validatePropertyShape(focusNode, propertyShape, shape);
      results.push(...propertyResults);
    }

    // Check closed constraint
    if (shape.closed) {
      const closedResults = this.validateClosedConstraint(focusNode, shape);
      results.push(...closedResults);
    }

    return results;
  }

  /**
   * Validate a property shape
   */
  private async validatePropertyShape(focusNode: string, propertyShape: ShaclPropertyShape, nodeShape: ShaclShape): Promise<ShaclValidationResult[]> {
    const results: ShaclValidationResult[] = [];
    
    // Get values for the property path
    const values = this.getValuesForPath(focusNode, propertyShape.path);
    
    // Cardinality constraints
    if (propertyShape.minCount !== undefined && values.length < propertyShape.minCount) {
      results.push({
        focusNode,
        resultPath: propertyShape.path,
        resultSeverity: propertyShape.severity,
        resultMessage: propertyShape.message || `Property ${propertyShape.path} has ${values.length} values, but minimum is ${propertyShape.minCount}`,
        sourceConstraintComponent: this.namespaces.sh + 'MinCountConstraintComponent',
        sourceShape: nodeShape.id
      });
    }

    if (propertyShape.maxCount !== undefined && values.length > propertyShape.maxCount) {
      results.push({
        focusNode,
        resultPath: propertyShape.path,
        resultSeverity: propertyShape.severity,
        resultMessage: propertyShape.message || `Property ${propertyShape.path} has ${values.length} values, but maximum is ${propertyShape.maxCount}`,
        sourceConstraintComponent: this.namespaces.sh + 'MaxCountConstraintComponent',
        sourceShape: nodeShape.id
      });
    }

    // Validate each value
    for (const value of values) {
      const valueResults = await this.validateValue(focusNode, propertyShape, nodeShape, value);
      results.push(...valueResults);
    }

    return results;
  }

  /**
   * Get values for a property path
   */
  private getValuesForPath(focusNode: string, path: string): string[] {
    const quads = this.dataStore.getQuads(
      DataFactory.namedNode(focusNode),
      DataFactory.namedNode(path),
      null,
      null
    );
    
    return quads.map(quad => quad.object.value);
  }

  /**
   * Validate a single property value
   */
  private async validateValue(focusNode: string, propertyShape: ShaclPropertyShape, nodeShape: ShaclShape, value: string): Promise<ShaclValidationResult[]> {
    const results: ShaclValidationResult[] = [];
    const quad = this.dataStore.getQuads(
      DataFactory.namedNode(focusNode),
      DataFactory.namedNode(propertyShape.path),
      null,
      null
    ).find(q => q.object.value === value);

    if (!quad) return results;

    // Node kind constraint
    if (propertyShape.nodeKind) {
      if (!this.validateNodeKind(quad.object, propertyShape.nodeKind)) {
        results.push({
          focusNode,
          resultPath: propertyShape.path,
          resultSeverity: propertyShape.severity,
          resultMessage: `Value ${value} does not match required node kind: ${propertyShape.nodeKind}`,
          sourceConstraintComponent: this.namespaces.sh + 'NodeKindConstraintComponent',
          sourceShape: nodeShape.id,
          value
        });
      }
    }

    // Datatype constraint
    if (propertyShape.datatype && quad.object.termType === 'Literal') {
      const literal = quad.object as Literal;
      if (!literal.datatype || literal.datatype.value !== propertyShape.datatype) {
        results.push({
          focusNode,
          resultPath: propertyShape.path,
          resultSeverity: propertyShape.severity,
          resultMessage: `Value ${value} does not match required datatype: ${propertyShape.datatype}`,
          sourceConstraintComponent: this.namespaces.sh + 'DatatypeConstraintComponent',
          sourceShape: nodeShape.id,
          value
        });
      }
    }

    // Pattern constraint
    if (propertyShape.pattern) {
      const flags = propertyShape.flags || '';
      const regex = new RegExp(propertyShape.pattern, flags);
      if (!regex.test(value)) {
        results.push({
          focusNode,
          resultPath: propertyShape.path,
          resultSeverity: propertyShape.severity,
          resultMessage: `Value ${value} does not match pattern: ${propertyShape.pattern}`,
          sourceConstraintComponent: this.namespaces.sh + 'PatternConstraintComponent',
          sourceShape: nodeShape.id,
          value
        });
      }
    }

    // Length constraints
    if (propertyShape.minLength !== undefined && value.length < propertyShape.minLength) {
      results.push({
        focusNode,
        resultPath: propertyShape.path,
        resultSeverity: propertyShape.severity,
        resultMessage: `Value ${value} has length ${value.length}, but minimum is ${propertyShape.minLength}`,
        sourceConstraintComponent: this.namespaces.sh + 'MinLengthConstraintComponent',
        sourceShape: nodeShape.id,
        value
      });
    }

    if (propertyShape.maxLength !== undefined && value.length > propertyShape.maxLength) {
      results.push({
        focusNode,
        resultPath: propertyShape.path,
        resultSeverity: propertyShape.severity,
        resultMessage: `Value ${value} has length ${value.length}, but maximum is ${propertyShape.maxLength}`,
        sourceConstraintComponent: this.namespaces.sh + 'MaxLengthConstraintComponent',
        sourceShape: nodeShape.id,
        value
      });
    }

    // Numeric range constraints
    if (quad.object.termType === 'Literal') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        if (propertyShape.minInclusive !== undefined && numValue < propertyShape.minInclusive) {
          results.push({
            focusNode,
            resultPath: propertyShape.path,
            resultSeverity: propertyShape.severity,
            resultMessage: `Value ${value} is less than minimum inclusive value ${propertyShape.minInclusive}`,
            sourceConstraintComponent: this.namespaces.sh + 'MinInclusiveConstraintComponent',
            sourceShape: nodeShape.id,
            value
          });
        }

        if (propertyShape.maxInclusive !== undefined && numValue > propertyShape.maxInclusive) {
          results.push({
            focusNode,
            resultPath: propertyShape.path,
            resultSeverity: propertyShape.severity,
            resultMessage: `Value ${value} is greater than maximum inclusive value ${propertyShape.maxInclusive}`,
            sourceConstraintComponent: this.namespaces.sh + 'MaxInclusiveConstraintComponent',
            sourceShape: nodeShape.id,
            value
          });
        }
      }
    }

    // Has value constraint
    if (propertyShape.hasValue && value !== propertyShape.hasValue) {
      results.push({
        focusNode,
        resultPath: propertyShape.path,
        resultSeverity: propertyShape.severity,
        resultMessage: `Value ${value} does not match required value: ${propertyShape.hasValue}`,
        sourceConstraintComponent: this.namespaces.sh + 'HasValueConstraintComponent',
        sourceShape: nodeShape.id,
        value
      });
    }

    // Class constraint
    if (propertyShape.class && quad.object.termType === 'NamedNode') {
      const hasType = this.dataStore.getQuads(
        quad.object,
        DataFactory.namedNode(this.namespaces.rdf + 'type'),
        DataFactory.namedNode(propertyShape.class),
        null
      ).length > 0;

      if (!hasType) {
        results.push({
          focusNode,
          resultPath: propertyShape.path,
          resultSeverity: propertyShape.severity,
          resultMessage: `Value ${value} is not an instance of required class: ${propertyShape.class}`,
          sourceConstraintComponent: this.namespaces.sh + 'ClassConstraintComponent',
          sourceShape: nodeShape.id,
          value
        });
      }
    }

    return results;
  }

  /**
   * Validate node kind constraint
   */
  private validateNodeKind(term: any, nodeKind: string): boolean {
    switch (nodeKind) {
      case 'IRI':
        return term.termType === 'NamedNode';
      case 'BlankNode':
        return term.termType === 'BlankNode';
      case 'Literal':
        return term.termType === 'Literal';
      case 'BlankNodeOrIRI':
        return term.termType === 'BlankNode' || term.termType === 'NamedNode';
      case 'BlankNodeOrLiteral':
        return term.termType === 'BlankNode' || term.termType === 'Literal';
      case 'IRIOrLiteral':
        return term.termType === 'NamedNode' || term.termType === 'Literal';
      default:
        return true;
    }
  }

  /**
   * Validate closed constraint
   */
  private validateClosedConstraint(focusNode: string, shape: ShaclShape): ShaclValidationResult[] {
    const results: ShaclValidationResult[] = [];
    
    if (!shape.closed) return results;

    // Get all properties used by the focus node
    const nodeQuads = this.dataStore.getQuads(
      DataFactory.namedNode(focusNode),
      null,
      null,
      null
    );

    // Get allowed properties from property shapes
    const allowedProperties = new Set<string>();
    shape.property.forEach(prop => allowedProperties.add(prop.path));
    
    // Add ignored properties if specified
    if (shape.ignoredProperties) {
      shape.ignoredProperties.forEach(prop => allowedProperties.add(prop));
    }

    // Check for unexpected properties
    for (const quad of nodeQuads) {
      if (!allowedProperties.has(quad.predicate.value)) {
        results.push({
          focusNode,
          resultPath: quad.predicate.value,
          resultSeverity: shape.severity,
          resultMessage: shape.message || `Unexpected property ${quad.predicate.value} on closed shape`,
          sourceConstraintComponent: this.namespaces.sh + 'ClosedConstraintComponent',
          sourceShape: shape.id,
          value: quad.object.value
        });
      }
    }

    return results;
  }

  /**
   * Generate suggestion for SHACL validation result
   */
  private generateSuggestion(result: ShaclValidationResult): string {
    const component = result.sourceConstraintComponent.replace(/.*#/, '');
    
    switch (component) {
      case 'MinCountConstraintComponent':
        return `Add more values for property ${result.resultPath}`;
      case 'MaxCountConstraintComponent':
        return `Remove excess values for property ${result.resultPath}`;
      case 'DatatypeConstraintComponent':
        return `Use the correct datatype for property ${result.resultPath}`;
      case 'PatternConstraintComponent':
        return `Ensure the value matches the required pattern`;
      case 'NodeKindConstraintComponent':
        return `Use the correct node type (IRI, Literal, or BlankNode)`;
      case 'ClassConstraintComponent':
        return `Ensure the value is an instance of the required class`;
      default:
        return 'Check the constraint requirements in the SHACL shape';
    }
  }

  /**
   * Generate validation statistics
   */
  private generateStatistics(dataQuads: Quad[], report: ShaclValidationReport, duration: number): ValidationStatistics {
    const violations = report.results.filter(r => r.resultSeverity === 'Violation').length;
    
    return {
      totalTriples: dataQuads.length,
      validTriples: dataQuads.length - violations,
      invalidTriples: violations,
      shapesEvaluated: this.shapes.size,
      constraintsChecked: report.results.length,
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
 * Create a SHACL validator with predefined shapes
 */
export function createShaclValidator(shapePaths?: string[]): ShaclValidator {
  const validator = new ShaclValidator();
  
  if (shapePaths && shapePaths.length > 0) {
    validator.loadShaclShapes(shapePaths).catch(console.error);
  }
  
  return validator;
}

/**
 * Common SHACL shapes for typical validation scenarios
 */
export const CommonShapes = {
  /**
   * Basic person shape with required name and optional email
   */
  PERSON_SHAPE: `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:PersonShape
    a sh:NodeShape ;
    sh:targetClass foaf:Person ;
    sh:property [
        sh:path foaf:name ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:minLength 1 ;
        sh:message "Person must have exactly one non-empty name"
    ] ;
    sh:property [
        sh:path foaf:mbox ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" ;
        sh:message "Email must be a valid email address"
    ] .
  `,

  /**
   * Organization shape with required name and type
   */
  ORGANIZATION_SHAPE: `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:OrganizationShape
    a sh:NodeShape ;
    sh:targetClass foaf:Organization ;
    sh:property [
        sh:path foaf:name ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Organization must have a name"
    ] ;
    sh:property [
        sh:path ex:organizationType ;
        sh:minCount 1 ;
        sh:in ( "company" "non-profit" "government" "educational" ) ;
        sh:message "Organization must have a valid type"
    ] .
  `
};