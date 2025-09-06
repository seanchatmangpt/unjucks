/**
 * Ontology Completeness Quality Gate
 * Validates semantic completeness and consistency for enterprise ontologies
 * Fortune 5 quality standards for semantic knowledge management
 */

import { Store, DataFactory, NamedNode, Literal, Quad } from 'n3';
import { ValidationContext, ValidationResult, ValidationError, ValidationWarning, PerformanceMetrics } from '../semantic-validator';

const { namedNode, literal, quad } = DataFactory;

// Ontology Completeness Criteria
interface CompletenessMetrics {
  classCount: number;
  propertyCount: number;
  instanceCount: number;
  axiomCount: number;
  annotationCount: number;
  definitionCoverage: number;
  hierarchyDepth: number;
  relationshipDensity: number;
  semanticRichness: number;
}

interface QualityGateResult {
  passed: boolean;
  score: number;
  metrics: CompletenessMetrics;
  violations: ValidationError[];
  recommendations: ValidationWarning[];
  performanceMetrics: PerformanceMetrics;
}

export class OntologyCompletenessGate {
  private store: Store;
  private completenessThresholds: CompletenessThresholds;

  constructor(store: Store, thresholds?: CompletenessThresholds) {
    this.store = store;
    this.completenessThresholds = thresholds || this.getDefaultThresholds();
  }

  /**
   * Execute ontology completeness quality gate
   */
  async executeQualityGate(context: ValidationContext): Promise<QualityGateResult> {
    const startTime = performance.now();
    
    // Calculate ontology metrics
    const metrics = await this.calculateCompletenessMetrics();
    
    // Validate completeness criteria
    const violations: ValidationError[] = [];
    const recommendations: ValidationWarning[] = [];

    // Class completeness validation
    const classViolations = await this.validateClassCompleteness(metrics);
    violations.push(...classViolations);

    // Property completeness validation
    const propertyViolations = await this.validatePropertyCompleteness(metrics);
    violations.push(...propertyViolations);

    // Instance completeness validation
    const instanceViolations = await this.validateInstanceCompleteness(metrics);
    violations.push(...instanceViolations);

    // Semantic richness validation
    const richnessViolations = await this.validateSemanticRichness(metrics);
    violations.push(...richnessViolations);

    // Hierarchy completeness validation
    const hierarchyViolations = await this.validateHierarchyCompleteness(metrics);
    violations.push(...hierarchyViolations);

    // Relationship density validation
    const relationshipViolations = await this.validateRelationshipDensity(metrics);
    violations.push(...relationshipViolations);

    // Annotation completeness validation
    const annotationRecommendations = await this.validateAnnotationCompleteness(metrics);
    recommendations.push(...annotationRecommendations);

    // Calculate overall completeness score
    const score = this.calculateCompletenessScore(metrics, violations);
    const passed = score >= this.completenessThresholds.minimumScore && violations.length === 0;

    const endTime = performance.now();
    const performanceMetrics: PerformanceMetrics = {
      validationDurationMs: endTime - startTime,
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
      quadCount: this.store.size,
      throughputQPS: this.store.size / ((endTime - startTime) / 1000),
      ontologyLoadTimeMs: 0,
      reasoningTimeMs: 0
    };

    return {
      passed,
      score,
      metrics,
      violations,
      recommendations,
      performanceMetrics
    };
  }

  /**
   * Calculate comprehensive ontology completeness metrics
   */
  private async calculateCompletenessMetrics(): Promise<CompletenessMetrics> {
    const classCount = this.countClasses();
    const propertyCount = this.countProperties();
    const instanceCount = this.countInstances();
    const axiomCount = this.countAxioms();
    const annotationCount = this.countAnnotations();
    const definitionCoverage = await this.calculateDefinitionCoverage();
    const hierarchyDepth = await this.calculateHierarchyDepth();
    const relationshipDensity = await this.calculateRelationshipDensity();
    const semanticRichness = await this.calculateSemanticRichness();

    return {
      classCount,
      propertyCount,
      instanceCount,
      axiomCount,
      annotationCount,
      definitionCoverage,
      hierarchyDepth,
      relationshipDensity,
      semanticRichness
    };
  }

  /**
   * Count ontology classes
   */
  private countClasses(): number {
    const classQuads = this.store.getQuads(
      null,
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://www.w3.org/2002/07/owl#Class'),
      null
    );
    
    // Also count RDFS classes
    const rdfsClassQuads = this.store.getQuads(
      null,
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://www.w3.org/2000/01/rdf-schema#Class'),
      null
    );

    return new Set([...classQuads.map(q => q.subject.value), ...rdfsClassQuads.map(q => q.subject.value)]).size;
  }

  /**
   * Count ontology properties
   */
  private countProperties(): number {
    const objectProps = this.store.getQuads(
      null,
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://www.w3.org/2002/07/owl#ObjectProperty'),
      null
    );

    const dataProps = this.store.getQuads(
      null,
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://www.w3.org/2002/07/owl#DatatypeProperty'),
      null
    );

    const annotationProps = this.store.getQuads(
      null,
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://www.w3.org/2002/07/owl#AnnotationProperty'),
      null
    );

    return new Set([
      ...objectProps.map(q => q.subject.value),
      ...dataProps.map(q => q.subject.value),
      ...annotationProps.map(q => q.subject.value)
    ]).size;
  }

  /**
   * Count ontology instances
   */
  private countInstances(): number {
    const allSubjects = this.store.getSubjects(null, null, null);
    const classes = new Set(this.store.getSubjects(
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://www.w3.org/2002/07/owl#Class'),
      null
    ).map(s => s.value));

    const instances = allSubjects.filter(subject => {
      const types = this.store.getObjects(
        subject,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        null
      );
      
      return types.some(type => {
        const typeValue = type.value;
        return !classes.has(typeValue) && 
               !typeValue.includes('owl#') && 
               !typeValue.includes('rdf-schema#');
      });
    });

    return instances.length;
  }

  /**
   * Count logical axioms
   */
  private countAxioms(): number {
    const axiomPredicates = [
      'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      'http://www.w3.org/2000/01/rdf-schema#subPropertyOf',
      'http://www.w3.org/2002/07/owl#equivalentClass',
      'http://www.w3.org/2002/07/owl#equivalentProperty',
      'http://www.w3.org/2002/07/owl#disjointWith',
      'http://www.w3.org/2002/07/owl#inverseOf',
      'http://www.w3.org/2000/01/rdf-schema#domain',
      'http://www.w3.org/2000/01/rdf-schema#range'
    ];

    let axiomCount = 0;
    for (const predicate of axiomPredicates) {
      axiomCount += this.store.getQuads(null, namedNode(predicate), null, null).length;
    }

    return axiomCount;
  }

  /**
   * Count annotations
   */
  private countAnnotations(): number {
    const annotationPredicates = [
      'http://www.w3.org/2000/01/rdf-schema#label',
      'http://www.w3.org/2000/01/rdf-schema#comment',
      'http://www.w3.org/2002/07/owl#versionInfo',
      'http://purl.org/dc/terms/description',
      'http://www.w3.org/2004/02/skos/core#definition',
      'http://www.w3.org/2004/02/skos/core#example'
    ];

    let annotationCount = 0;
    for (const predicate of annotationPredicates) {
      annotationCount += this.store.getQuads(null, namedNode(predicate), null, null).length;
    }

    return annotationCount;
  }

  /**
   * Calculate definition coverage percentage
   */
  private async calculateDefinitionCoverage(): Promise<number> {
    const totalEntities = this.countClasses() + this.countProperties();
    
    if (totalEntities === 0) return 0;

    const definedEntities = new Set();
    
    // Count entities with rdfs:comment
    const commentQuads = this.store.getQuads(
      null,
      namedNode('http://www.w3.org/2000/01/rdf-schema#comment'),
      null,
      null
    );
    commentQuads.forEach(q => definedEntities.add(q.subject.value));

    // Count entities with skos:definition
    const definitionQuads = this.store.getQuads(
      null,
      namedNode('http://www.w3.org/2004/02/skos/core#definition'),
      null,
      null
    );
    definitionQuads.forEach(q => definedEntities.add(q.subject.value));

    return (definedEntities.size / totalEntities) * 100;
  }

  /**
   * Calculate maximum hierarchy depth
   */
  private async calculateHierarchyDepth(): Promise<number> {
    const subClassQuads = this.store.getQuads(
      null,
      namedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
      null,
      null
    );

    if (subClassQuads.length === 0) return 0;

    // Build hierarchy map
    const hierarchy = new Map<string, string[]>();
    const childToParent = new Map<string, string>();

    for (const quad of subClassQuads) {
      const child = quad.subject.value;
      const parent = (quad.object as NamedNode).value;
      
      childToParent.set(child, parent);
      
      if (!hierarchy.has(parent)) {
        hierarchy.set(parent, []);
      }
      hierarchy.get(parent)!.push(child);
    }

    // Find root classes (classes with no parents)
    const allChildren = new Set(Array.from(childToParent.keys()));
    const allParents = new Set(Array.from(childToParent.values()));
    const roots = Array.from(allParents).filter(p => !allChildren.has(p));

    // Calculate depth from each root
    let maxDepth = 0;
    for (const root of roots) {
      const depth = this.calculateNodeDepth(root, hierarchy, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  /**
   * Calculate relationship density (relationships per entity)
   */
  private async calculateRelationshipDensity(): Promise<number> {
    const totalEntities = this.countClasses() + this.countProperties() + this.countInstances();
    const totalRelationships = this.countAxioms();
    
    return totalEntities > 0 ? totalRelationships / totalEntities : 0;
  }

  /**
   * Calculate semantic richness score
   */
  private async calculateSemanticRichness(): Promise<number> {
    let richness = 0;
    
    // Points for different types of axioms
    const axiomTypes = [
      { predicate: 'http://www.w3.org/2000/01/rdf-schema#subClassOf', points: 1 },
      { predicate: 'http://www.w3.org/2002/07/owl#equivalentClass', points: 2 },
      { predicate: 'http://www.w3.org/2002/07/owl#disjointWith', points: 2 },
      { predicate: 'http://www.w3.org/2000/01/rdf-schema#domain', points: 1 },
      { predicate: 'http://www.w3.org/2000/01/rdf-schema#range', points: 1 },
      { predicate: 'http://www.w3.org/2002/07/owl#inverseOf', points: 2 }
    ];

    for (const axiomType of axiomTypes) {
      const count = this.store.getQuads(null, namedNode(axiomType.predicate), null, null).length;
      richness += count * axiomType.points;
    }

    // Normalize by total entities
    const totalEntities = this.countClasses() + this.countProperties();
    return totalEntities > 0 ? richness / totalEntities : 0;
  }

  /**
   * Validate class completeness
   */
  private async validateClassCompleteness(metrics: CompletenessMetrics): Promise<ValidationError[]> {
    const violations: ValidationError[] = [];

    if (metrics.classCount < this.completenessThresholds.minimumClasses) {
      violations.push({
        code: 'INSUFFICIENT_CLASSES',
        message: `Ontology has ${metrics.classCount} classes, minimum required: ${this.completenessThresholds.minimumClasses}`,
        severity: 'high',
        location: 'ontology-structure',
        remediation: 'Add more domain classes to improve ontology coverage'
      });
    }

    return violations;
  }

  /**
   * Validate property completeness
   */
  private async validatePropertyCompleteness(metrics: CompletenessMetrics): Promise<ValidationError[]> {
    const violations: ValidationError[] = [];

    if (metrics.propertyCount < this.completenessThresholds.minimumProperties) {
      violations.push({
        code: 'INSUFFICIENT_PROPERTIES',
        message: `Ontology has ${metrics.propertyCount} properties, minimum required: ${this.completenessThresholds.minimumProperties}`,
        severity: 'high',
        location: 'ontology-structure',
        remediation: 'Add more domain properties to improve semantic expressiveness'
      });
    }

    const classPropertyRatio = metrics.propertyCount / Math.max(metrics.classCount, 1);
    if (classPropertyRatio < this.completenessThresholds.minimumClassPropertyRatio) {
      violations.push({
        code: 'LOW_PROPERTY_CLASS_RATIO',
        message: `Property-to-class ratio ${classPropertyRatio.toFixed(2)} is below threshold ${this.completenessThresholds.minimumClassPropertyRatio}`,
        severity: 'medium',
        location: 'ontology-balance',
        remediation: 'Add more properties to better describe class relationships'
      });
    }

    return violations;
  }

  /**
   * Validate instance completeness
   */
  private async validateInstanceCompleteness(metrics: CompletenessMetrics): Promise<ValidationError[]> {
    const violations: ValidationError[] = [];

    if (metrics.instanceCount < this.completenessThresholds.minimumInstances) {
      violations.push({
        code: 'INSUFFICIENT_INSTANCES',
        message: `Ontology has ${metrics.instanceCount} instances, minimum required: ${this.completenessThresholds.minimumInstances}`,
        severity: 'medium',
        location: 'ontology-population',
        remediation: 'Add more instance data to validate ontology design'
      });
    }

    return violations;
  }

  /**
   * Validate semantic richness
   */
  private async validateSemanticRichness(metrics: CompletenessMetrics): Promise<ValidationError[]> {
    const violations: ValidationError[] = [];

    if (metrics.semanticRichness < this.completenessThresholds.minimumSemanticRichness) {
      violations.push({
        code: 'LOW_SEMANTIC_RICHNESS',
        message: `Semantic richness score ${metrics.semanticRichness.toFixed(2)} is below threshold ${this.completenessThresholds.minimumSemanticRichness}`,
        severity: 'high',
        location: 'semantic-expressiveness',
        remediation: 'Add more complex axioms (equivalence, disjointness, inverse properties)'
      });
    }

    return violations;
  }

  /**
   * Validate hierarchy completeness
   */
  private async validateHierarchyCompleteness(metrics: CompletenessMetrics): Promise<ValidationError[]> {
    const violations: ValidationError[] = [];

    if (metrics.hierarchyDepth < this.completenessThresholds.minimumHierarchyDepth) {
      violations.push({
        code: 'SHALLOW_HIERARCHY',
        message: `Hierarchy depth ${metrics.hierarchyDepth} is below minimum ${this.completenessThresholds.minimumHierarchyDepth}`,
        severity: 'medium',
        location: 'ontology-structure',
        remediation: 'Develop deeper class hierarchies for better conceptual organization'
      });
    }

    if (metrics.hierarchyDepth > this.completenessThresholds.maximumHierarchyDepth) {
      violations.push({
        code: 'OVERLY_DEEP_HIERARCHY',
        message: `Hierarchy depth ${metrics.hierarchyDepth} exceeds maximum ${this.completenessThresholds.maximumHierarchyDepth}`,
        severity: 'medium',
        location: 'ontology-structure',
        remediation: 'Consider flattening overly deep hierarchies for maintainability'
      });
    }

    return violations;
  }

  /**
   * Validate relationship density
   */
  private async validateRelationshipDensity(metrics: CompletenessMetrics): Promise<ValidationError[]> {
    const violations: ValidationError[] = [];

    if (metrics.relationshipDensity < this.completenessThresholds.minimumRelationshipDensity) {
      violations.push({
        code: 'LOW_RELATIONSHIP_DENSITY',
        message: `Relationship density ${metrics.relationshipDensity.toFixed(2)} is below threshold ${this.completenessThresholds.minimumRelationshipDensity}`,
        severity: 'medium',
        location: 'ontology-connectivity',
        remediation: 'Add more relationships between entities to improve semantic connectivity'
      });
    }

    return violations;
  }

  /**
   * Validate annotation completeness
   */
  private async validateAnnotationCompleteness(metrics: CompletenessMetrics): Promise<ValidationWarning[]> {
    const warnings: ValidationWarning[] = [];

    if (metrics.definitionCoverage < this.completenessThresholds.minimumDefinitionCoverage) {
      warnings.push({
        code: 'LOW_DEFINITION_COVERAGE',
        message: `Definition coverage ${metrics.definitionCoverage.toFixed(1)}% is below recommended ${this.completenessThresholds.minimumDefinitionCoverage}%`,
        location: 'documentation',
        suggestion: 'Add definitions (rdfs:comment or skos:definition) for more entities'
      });
    }

    const annotationDensity = metrics.annotationCount / Math.max(metrics.classCount + metrics.propertyCount, 1);
    if (annotationDensity < this.completenessThresholds.minimumAnnotationDensity) {
      warnings.push({
        code: 'SPARSE_ANNOTATIONS',
        message: `Annotation density ${annotationDensity.toFixed(2)} is below recommended ${this.completenessThresholds.minimumAnnotationDensity}`,
        location: 'documentation',
        suggestion: 'Add more labels, comments, and documentation for better usability'
      });
    }

    return warnings;
  }

  /**
   * Calculate overall completeness score
   */
  private calculateCompletenessScore(metrics: CompletenessMetrics, violations: ValidationError[]): number {
    let score = 100;

    // Deduct for violations
    for (const violation of violations) {
      switch (violation.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    // Bonus for exceeding thresholds
    if (metrics.definitionCoverage > 90) score += 5;
    if (metrics.semanticRichness > this.completenessThresholds.minimumSemanticRichness * 1.5) score += 5;
    if (metrics.relationshipDensity > this.completenessThresholds.minimumRelationshipDensity * 2) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate node depth in hierarchy
   */
  private calculateNodeDepth(node: string, hierarchy: Map<string, string[]>, visited: Set<string>): number {
    if (visited.has(node)) return 0; // Cycle detection
    
    visited.add(node);
    const children = hierarchy.get(node) || [];
    
    if (children.length === 0) {
      visited.delete(node);
      return 1;
    }
    
    let maxChildDepth = 0;
    for (const child of children) {
      const childDepth = this.calculateNodeDepth(child, hierarchy, visited);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
    
    visited.delete(node);
    return maxChildDepth + 1;
  }

  /**
   * Get default completeness thresholds
   */
  private getDefaultThresholds(): CompletenessThresholds {
    return {
      minimumScore: 75,
      minimumClasses: 10,
      minimumProperties: 5,
      minimumInstances: 0, // Optional for schema-only ontologies
      minimumDefinitionCoverage: 80,
      minimumSemanticRichness: 2.0,
      minimumHierarchyDepth: 2,
      maximumHierarchyDepth: 8,
      minimumRelationshipDensity: 1.5,
      minimumClassPropertyRatio: 1.0,
      minimumAnnotationDensity: 2.0
    };
  }
}

interface CompletenessThresholds {
  minimumScore: number;
  minimumClasses: number;
  minimumProperties: number;
  minimumInstances: number;
  minimumDefinitionCoverage: number;
  minimumSemanticRichness: number;
  minimumHierarchyDepth: number;
  maximumHierarchyDepth: number;
  minimumRelationshipDensity: number;
  minimumClassPropertyRatio: number;
  minimumAnnotationDensity: number;
}