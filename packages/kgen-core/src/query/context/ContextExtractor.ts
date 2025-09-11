/**
 * Context Extraction Engine for Template Rendering
 * 
 * Extracts semantic context from knowledge graphs for dynamic template generation
 */

import { 
  ContextExtractionResult, 
  EntityContext, 
  PropertyContext, 
  ClassContext,
  RelationshipContext,
  TemporalContext,
  SpatialContext,
  ProvenanceContext,
  QueryResults,
  Binding
} from '../types/index.js';
import { EventEmitter } from 'events';
import { Store, Quad, DataFactory } from 'n3';

const { namedNode, literal } = DataFactory;

export interface ContextExtractionOptions {
  maxEntities: number;
  maxProperties: number;
  maxRelationships: number;
  includeProvenance: boolean;
  includeTemporal: boolean;
  includeSpatial: boolean;
  includeStatistics: boolean;
  entityImportanceThreshold: number;
  propertyUsageThreshold: number;
  relationshipWeightThreshold: number;
}

export interface EntityImportanceMetrics {
  degreeScore: number;
  centralityScore: number;
  provenanceScore: number;
  temporalScore: number;
  combinedScore: number;
}

export class ContextExtractor extends EventEmitter {
  private store: Store;
  private options: ContextExtractionOptions;
  private entityCache: Map<string, EntityContext> = new Map();
  private propertyCache: Map<string, PropertyContext> = new Map();
  private classCache: Map<string, ClassContext> = new Map();

  constructor(store: Store, options: Partial<ContextExtractionOptions> = {}) {
    super();
    this.store = store;
    
    this.options = {
      maxEntities: 1000,
      maxProperties: 200,
      maxRelationships: 5000,
      includeProvenance: true,
      includeTemporal: true,
      includeSpatial: true,
      includeStatistics: true,
      entityImportanceThreshold: 0.1,
      propertyUsageThreshold: 5,
      relationshipWeightThreshold: 0.05,
      ...options
    };
  }

  /**
   * Extract comprehensive context for template rendering
   */
  async extractContext(
    focusEntities?: string[],
    extractionOptions?: Partial<ContextExtractionOptions>
  ): Promise<ContextExtractionResult> {
    const startTime = Date.now();
    const opts = { ...this.options, ...extractionOptions };

    try {
      this.emit('extraction:started', { focusEntities, options: opts });

      // Extract different types of context in parallel
      const [
        entities,
        properties,
        classes,
        relationships,
        temporal,
        spatial,
        provenance
      ] = await Promise.all([
        this.extractEntityContext(focusEntities, opts),
        this.extractPropertyContext(opts),
        this.extractClassContext(opts),
        this.extractRelationshipContext(focusEntities, opts),
        opts.includeTemporal ? this.extractTemporalContext(opts) : [],
        opts.includeSpatial ? this.extractSpatialContext(opts) : [],
        opts.includeProvenance ? this.extractProvenanceContext(focusEntities, opts) : []
      ]);

      const result: ContextExtractionResult = {
        entities,
        properties,
        classes,
        relationships,
        temporal,
        spatial,
        provenance
      };

      const executionTime = Date.now() - startTime;
      
      this.emit('extraction:completed', {
        result,
        executionTime,
        entityCount: entities.length,
        propertyCount: properties.length,
        relationshipCount: relationships.length
      });

      return result;

    } catch (error) {
      this.emit('extraction:error', { error, focusEntities });
      throw error;
    }
  }

  /**
   * Extract context for specific entity types
   */
  async extractEntityTypeContext(
    entityTypes: string[],
    extractionOptions?: Partial<ContextExtractionOptions>
  ): Promise<ContextExtractionResult> {
    const entities = await this.getEntitiesByType(entityTypes);
    return this.extractContext(entities.map(e => e.uri), extractionOptions);
  }

  /**
   * Extract context for entities matching SPARQL pattern
   */
  async extractPatternContext(
    sparqlPattern: string,
    extractionOptions?: Partial<ContextExtractionOptions>
  ): Promise<ContextExtractionResult> {
    const entities = await this.getEntitiesByPattern(sparqlPattern);
    return this.extractContext(entities.map(e => e.uri), extractionOptions);
  }

  /**
   * Get context summary for quick template decisions
   */
  async getContextSummary(focusEntities?: string[]): Promise<Record<string, any>> {
    const context = await this.extractContext(focusEntities, {
      maxEntities: 100,
      maxProperties: 50,
      maxRelationships: 200,
      includeProvenance: false,
      includeTemporal: false,
      includeSpatial: false,
      includeStatistics: false
    });

    return {
      entityCount: context.entities.length,
      propertyCount: context.properties.length,
      classCount: context.classes.length,
      relationshipCount: context.relationships.length,
      topEntities: context.entities
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 10)
        .map(e => ({ uri: e.uri, label: e.label, importance: e.importance })),
      topProperties: context.properties
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10)
        .map(p => ({ uri: p.uri, label: p.label, frequency: p.frequency })),
      mainClasses: context.classes
        .sort((a, b) => b.instances - a.instances)
        .slice(0, 10)
        .map(c => ({ uri: c.uri, label: c.label, instances: c.instances }))
    };
  }

  // Private extraction methods

  private async extractEntityContext(
    focusEntities?: string[],
    options?: ContextExtractionOptions
  ): Promise<EntityContext[]> {
    const entities: EntityContext[] = [];
    const entityUris = new Set<string>();

    // Get focus entities if specified
    if (focusEntities) {
      for (const uri of focusEntities) {
        entityUris.add(uri);
      }
    } else {
      // Discover important entities
      const discovered = await this.discoverImportantEntities(options!.maxEntities);
      discovered.forEach(uri => entityUris.add(uri));
    }

    // Extract context for each entity
    for (const uri of Array.from(entityUris).slice(0, options!.maxEntities)) {
      try {
        const entityContext = await this.getEntityContext(uri);
        
        if (entityContext.importance >= options!.entityImportanceThreshold) {
          entities.push(entityContext);
        }
      } catch (error) {
        this.emit('entity:extraction_error', { uri, error });
      }
    }

    return entities.sort((a, b) => b.importance - a.importance);
  }

  private async getEntityContext(uri: string): Promise<EntityContext> {
    // Check cache first
    if (this.entityCache.has(uri)) {
      return this.entityCache.get(uri)!;
    }

    const entity = namedNode(uri);
    const context: EntityContext = {
      uri,
      types: [],
      properties: {},
      incomingRelations: [],
      outgoingRelations: [],
      importance: 0
    };

    // Get entity types
    const typeQuads = this.store.getQuads(entity, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null);
    context.types = typeQuads.map(q => q.object.value);

    // Get entity label
    const labelQuads = this.store.getQuads(entity, namedNode('http://www.w3.org/2000/01/rdf-schema#label'), null);
    if (labelQuads.length > 0) {
      context.label = labelQuads[0].object.value;
    }

    // Get all properties of the entity
    const outgoingQuads = this.store.getQuads(entity, null, null);
    for (const quad of outgoingQuads) {
      const predicate = quad.predicate.value;
      if (!context.properties[predicate]) {
        context.properties[predicate] = [];
      }
      context.properties[predicate].push(this.quadObjectToValue(quad));
      
      if (!context.outgoingRelations.includes(predicate)) {
        context.outgoingRelations.push(predicate);
      }
    }

    // Get incoming relations
    const incomingQuads = this.store.getQuads(null, null, entity);
    for (const quad of incomingQuads) {
      const predicate = quad.predicate.value;
      if (!context.incomingRelations.includes(predicate)) {
        context.incomingRelations.push(predicate);
      }
    }

    // Calculate importance score
    context.importance = this.calculateEntityImportance(uri, context);

    // Cache the result
    this.entityCache.set(uri, context);
    
    return context;
  }

  private async extractPropertyContext(options: ContextExtractionOptions): Promise<PropertyContext[]> {
    const propertyStats = new Map<string, {
      frequency: number;
      distinctSubjects: Set<string>;
      distinctObjects: Set<string>;
      examples: any[];
    }>();

    // Analyze all triples to get property usage statistics
    const quads = this.store.getQuads();
    
    for (const quad of quads) {
      const predicate = quad.predicate.value;
      
      if (!propertyStats.has(predicate)) {
        propertyStats.set(predicate, {
          frequency: 0,
          distinctSubjects: new Set(),
          distinctObjects: new Set(),
          examples: []
        });
      }
      
      const stats = propertyStats.get(predicate)!;
      stats.frequency++;
      stats.distinctSubjects.add(quad.subject.value);
      stats.distinctObjects.add(quad.object.value);
      
      // Store examples (up to 10)
      if (stats.examples.length < 10) {
        stats.examples.push(this.quadObjectToValue(quad));
      }
    }

    const properties: PropertyContext[] = [];

    for (const [uri, stats] of propertyStats.entries()) {
      if (stats.frequency >= options.propertyUsageThreshold) {
        const property: PropertyContext = {
          uri,
          domain: [],
          range: [],
          frequency: stats.frequency,
          distinctValues: stats.distinctObjects.size,
          examples: stats.examples
        };

        // Get property metadata
        const propertyEntity = namedNode(uri);
        
        // Get label
        const labelQuads = this.store.getQuads(propertyEntity, namedNode('http://www.w3.org/2000/01/rdf-schema#label'), null);
        if (labelQuads.length > 0) {
          property.label = labelQuads[0].object.value;
        }

        // Get domain
        const domainQuads = this.store.getQuads(propertyEntity, namedNode('http://www.w3.org/2000/01/rdf-schema#domain'), null);
        property.domain = domainQuads.map(q => q.object.value);

        // Get range
        const rangeQuads = this.store.getQuads(propertyEntity, namedNode('http://www.w3.org/2000/01/rdf-schema#range'), null);
        property.range = rangeQuads.map(q => q.object.value);

        properties.push(property);
      }
    }

    return properties
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, options.maxProperties);
  }

  private async extractClassContext(options: ContextExtractionOptions): Promise<ClassContext[]> {
    const classStats = new Map<string, {
      instances: number;
      properties: Set<string>;
    }>();

    // Count instances and properties for each class
    const typeQuads = this.store.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null);
    
    for (const quad of typeQuads) {
      const classUri = quad.object.value;
      const instance = quad.subject.value;
      
      if (!classStats.has(classUri)) {
        classStats.set(classUri, {
          instances: 0,
          properties: new Set()
        });
      }
      
      const stats = classStats.get(classUri)!;
      stats.instances++;
      
      // Get properties used by this instance
      const instanceQuads = this.store.getQuads(quad.subject, null, null);
      for (const instanceQuad of instanceQuads) {
        stats.properties.add(instanceQuad.predicate.value);
      }
    }

    const classes: ClassContext[] = [];

    for (const [uri, stats] of classStats.entries()) {
      const classContext: ClassContext = {
        uri,
        superClasses: [],
        subClasses: [],
        instances: stats.instances,
        properties: Array.from(stats.properties)
      };

      // Get class metadata
      const classEntity = namedNode(uri);
      
      // Get label
      const labelQuads = this.store.getQuads(classEntity, namedNode('http://www.w3.org/2000/01/rdf-schema#label'), null);
      if (labelQuads.length > 0) {
        classContext.label = labelQuads[0].object.value;
      }

      // Get superclasses
      const superClassQuads = this.store.getQuads(classEntity, namedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'), null);
      classContext.superClasses = superClassQuads.map(q => q.object.value);

      // Get subclasses
      const subClassQuads = this.store.getQuads(null, namedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'), classEntity);
      classContext.subClasses = subClassQuads.map(q => q.subject.value);

      classes.push(classContext);
    }

    return classes.sort((a, b) => b.instances - a.instances);
  }

  private async extractRelationshipContext(
    focusEntities?: string[],
    options?: ContextExtractionOptions
  ): Promise<RelationshipContext[]> {
    const relationships: RelationshipContext[] = [];
    const relationshipCounts = new Map<string, number>();

    // Get all relationships, optionally filtered by focus entities
    const quads = focusEntities 
      ? this.getQuadsForEntities(focusEntities)
      : this.store.getQuads();

    for (const quad of quads) {
      const relationKey = `${quad.subject.value}|${quad.predicate.value}|${quad.object.value}`;
      relationshipCounts.set(relationKey, (relationshipCounts.get(relationKey) || 0) + 1);

      const relationship: RelationshipContext = {
        predicate: quad.predicate.value,
        subject: quad.subject.value,
        object: quad.object.value,
        weight: 1.0, // Will be calculated below
        confidence: 1.0 // Will be calculated below
      };

      // Extract temporal information if available
      const temporal = this.extractTemporalFromQuad(quad);
      if (temporal) {
        relationship.temporal = temporal;
      }

      relationships.push(relationship);
    }

    // Calculate weights and confidence scores
    const totalRelationships = relationships.length;
    
    for (const relationship of relationships) {
      const relationKey = `${relationship.subject}|${relationship.predicate}|${relationship.object}`;
      const count = relationshipCounts.get(relationKey) || 1;
      
      relationship.weight = count / totalRelationships;
      relationship.confidence = Math.min(1.0, count / 10.0); // Simple confidence model
    }

    // Filter by weight threshold and limit
    return relationships
      .filter(r => r.weight >= options!.relationshipWeightThreshold)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, options!.maxRelationships);
  }

  private async extractTemporalContext(options: ContextExtractionOptions): Promise<TemporalContext[]> {
    const temporalContexts: TemporalContext[] = [];
    
    // Look for temporal properties
    const temporalPredicates = [
      'http://www.w3.org/ns/prov#startedAtTime',
      'http://www.w3.org/ns/prov#endedAtTime',
      'http://www.w3.org/ns/prov#generatedAtTime',
      'http://purl.org/dc/terms/created',
      'http://purl.org/dc/terms/modified',
      'http://purl.org/dc/terms/date'
    ];

    for (const predicate of temporalPredicates) {
      const quads = this.store.getQuads(null, namedNode(predicate), null);
      
      for (const quad of quads) {
        const temporal: TemporalContext = {
          timepoint: new Date(quad.object.value),
          precision: this.determineDatePrecision(quad.object.value)
        };
        
        temporalContexts.push(temporal);
      }
    }

    return temporalContexts.sort((a, b) => {
      const timeA = a.timepoint || a.interval?.start;
      const timeB = b.timepoint || b.interval?.start;
      if (!timeA || !timeB) return 0;
      return timeB.getTime() - timeA.getTime();
    });
  }

  private async extractSpatialContext(options: ContextExtractionOptions): Promise<SpatialContext[]> {
    const spatialContexts: SpatialContext[] = [];
    
    // Look for spatial properties
    const spatialQuads = this.store.getQuads(null, namedNode('http://www.w3.org/2003/01/geo/wgs84_pos#lat'), null);
    
    for (const latQuad of spatialQuads) {
      const subject = latQuad.subject;
      const longitude = this.store.getQuads(subject, namedNode('http://www.w3.org/2003/01/geo/wgs84_pos#long'), null);
      
      if (longitude.length > 0) {
        const spatial: SpatialContext = {
          location: {
            latitude: parseFloat(latQuad.object.value),
            longitude: parseFloat(longitude[0].object.value)
          },
          precision: 0.001, // Default precision
          source: 'geo:wgs84_pos'
        };
        
        // Get region if available
        const regionQuads = this.store.getQuads(subject, namedNode('http://www.geonames.org/ontology#parentFeature'), null);
        if (regionQuads.length > 0) {
          spatial.region = regionQuads[0].object.value;
        }
        
        spatialContexts.push(spatial);
      }
    }

    return spatialContexts;
  }

  private async extractProvenanceContext(
    focusEntities?: string[],
    options?: ContextExtractionOptions
  ): Promise<ProvenanceContext[]> {
    const provenanceContexts: ProvenanceContext[] = [];
    
    // Look for provenance relationships
    const provenancePredicates = [
      'http://www.w3.org/ns/prov#wasDerivedFrom',
      'http://www.w3.org/ns/prov#wasGeneratedBy',
      'http://www.w3.org/ns/prov#wasAssociatedWith',
      'http://www.w3.org/ns/prov#wasInfluencedBy'
    ];

    for (const predicate of provenancePredicates) {
      const quads = focusEntities
        ? this.getQuadsForEntitiesAndPredicate(focusEntities, predicate)
        : this.store.getQuads(null, namedNode(predicate), null);
      
      for (const quad of quads) {
        const context: ProvenanceContext = {
          entity: quad.subject.value,
          activity: '',
          agent: '',
          timestamp: new Date(),
          derivation: [],
          influence: []
        };

        // Get related provenance information
        this.enrichProvenanceContext(context, quad.subject.value);
        
        provenanceContexts.push(context);
      }
    }

    return provenanceContexts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Helper methods

  private async discoverImportantEntities(maxEntities: number): Promise<string[]> {
    const entityScores = new Map<string, number>();

    // Score entities based on degree (number of connections)
    const quads = this.store.getQuads();
    
    for (const quad of quads) {
      // Score subjects
      if (quad.subject.termType === 'NamedNode') {
        const score = entityScores.get(quad.subject.value) || 0;
        entityScores.set(quad.subject.value, score + 1);
      }
      
      // Score objects (if they are URIs)
      if (quad.object.termType === 'NamedNode') {
        const score = entityScores.get(quad.object.value) || 0;
        entityScores.set(quad.object.value, score + 0.5);
      }
    }

    // Return top entities by score
    return Array.from(entityScores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxEntities)
      .map(([uri]) => uri);
  }

  private calculateEntityImportance(uri: string, context: EntityContext): number {
    const metrics: EntityImportanceMetrics = {
      degreeScore: 0,
      centralityScore: 0,
      provenanceScore: 0,
      temporalScore: 0,
      combinedScore: 0
    };

    // Calculate degree score (number of connections)
    metrics.degreeScore = (context.incomingRelations.length + context.outgoingRelations.length) / 100;

    // Calculate centrality score (simplified - based on property diversity)
    metrics.centralityScore = Object.keys(context.properties).length / 50;

    // Calculate provenance score (if entity has provenance information)
    const hasProvenance = context.properties['http://www.w3.org/ns/prov#wasDerivedFrom'] ||
                         context.properties['http://www.w3.org/ns/prov#wasGeneratedBy'];
    metrics.provenanceScore = hasProvenance ? 0.3 : 0;

    // Calculate temporal score (if entity has temporal information)
    const hasTemporal = context.properties['http://www.w3.org/ns/prov#generatedAtTime'] ||
                       context.properties['http://purl.org/dc/terms/created'];
    metrics.temporalScore = hasTemporal ? 0.2 : 0;

    // Combine scores with weights
    metrics.combinedScore = 
      metrics.degreeScore * 0.4 +
      metrics.centralityScore * 0.3 +
      metrics.provenanceScore * 0.2 +
      metrics.temporalScore * 0.1;

    return Math.min(1.0, metrics.combinedScore);
  }

  private quadObjectToValue(quad: Quad): any {
    if (quad.object.termType === 'Literal') {
      const datatype = quad.object.datatype?.value;
      
      if (datatype) {
        switch (datatype) {
          case 'http://www.w3.org/2001/XMLSchema#integer':
          case 'http://www.w3.org/2001/XMLSchema#int':
            return parseInt(quad.object.value);
          case 'http://www.w3.org/2001/XMLSchema#decimal':
          case 'http://www.w3.org/2001/XMLSchema#double':
          case 'http://www.w3.org/2001/XMLSchema#float':
            return parseFloat(quad.object.value);
          case 'http://www.w3.org/2001/XMLSchema#boolean':
            return quad.object.value === 'true';
          case 'http://www.w3.org/2001/XMLSchema#dateTime':
            return new Date(quad.object.value);
          default:
            return quad.object.value;
        }
      }
      
      return quad.object.value;
    }
    
    return quad.object.value;
  }

  private getQuadsForEntities(entityUris: string[]): Quad[] {
    const quads: Quad[] = [];
    
    for (const uri of entityUris) {
      const entity = namedNode(uri);
      quads.push(...this.store.getQuads(entity, null, null));
      quads.push(...this.store.getQuads(null, null, entity));
    }
    
    return quads;
  }

  private getQuadsForEntitiesAndPredicate(entityUris: string[], predicate: string): Quad[] {
    const quads: Quad[] = [];
    const pred = namedNode(predicate);
    
    for (const uri of entityUris) {
      const entity = namedNode(uri);
      quads.push(...this.store.getQuads(entity, pred, null));
      quads.push(...this.store.getQuads(null, pred, entity));
    }
    
    return quads;
  }

  private extractTemporalFromQuad(quad: Quad): TemporalContext | null {
    // Check if the quad contains temporal information
    const temporalPredicates = [
      'http://www.w3.org/ns/prov#startedAtTime',
      'http://www.w3.org/ns/prov#endedAtTime',
      'http://www.w3.org/ns/prov#generatedAtTime'
    ];

    if (temporalPredicates.includes(quad.predicate.value) && 
        quad.object.termType === 'Literal') {
      try {
        return {
          timepoint: new Date(quad.object.value),
          precision: this.determineDatePrecision(quad.object.value)
        };
      } catch {
        return null;
      }
    }

    return null;
  }

  private determineDatePrecision(dateString: string): 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' {
    if (dateString.includes('T') && dateString.includes(':')) {
      if (dateString.includes('.') || dateString.endsWith('Z')) {
        return 'second';
      } else if (dateString.split(':').length >= 3) {
        return 'second';
      } else if (dateString.split(':').length >= 2) {
        return 'minute';
      } else {
        return 'hour';
      }
    } else if (dateString.split('-').length >= 3) {
      return 'day';
    } else if (dateString.split('-').length >= 2) {
      return 'month';
    } else {
      return 'year';
    }
  }

  private enrichProvenanceContext(context: ProvenanceContext, entityUri: string): void {
    const entity = namedNode(entityUri);

    // Get activity
    const activityQuads = this.store.getQuads(entity, namedNode('http://www.w3.org/ns/prov#wasGeneratedBy'), null);
    if (activityQuads.length > 0) {
      context.activity = activityQuads[0].object.value;
    }

    // Get agent
    const agentQuads = this.store.getQuads(entity, namedNode('http://www.w3.org/ns/prov#wasAssociatedWith'), null);
    if (agentQuads.length > 0) {
      context.agent = agentQuads[0].object.value;
    }

    // Get derivation chain
    const derivationQuads = this.store.getQuads(entity, namedNode('http://www.w3.org/ns/prov#wasDerivedFrom'), null);
    context.derivation = derivationQuads.map(q => q.object.value);

    // Get influences
    const influenceQuads = this.store.getQuads(entity, namedNode('http://www.w3.org/ns/prov#wasInfluencedBy'), null);
    context.influence = influenceQuads.map(q => q.object.value);

    // Get timestamp
    const timestampQuads = this.store.getQuads(entity, namedNode('http://www.w3.org/ns/prov#generatedAtTime'), null);
    if (timestampQuads.length > 0) {
      try {
        context.timestamp = new Date(timestampQuads[0].object.value);
      } catch {
        context.timestamp = new Date();
      }
    }
  }

  private async getEntitiesByType(entityTypes: string[]): Promise<Array<{ uri: string; type: string }>> {
    const entities: Array<{ uri: string; type: string }> = [];
    
    for (const type of entityTypes) {
      const typeQuads = this.store.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(type));
      
      for (const quad of typeQuads) {
        entities.push({
          uri: quad.subject.value,
          type: type
        });
      }
    }
    
    return entities;
  }

  private async getEntitiesByPattern(sparqlPattern: string): Promise<Array<{ uri: string }>> {
    // This would require a SPARQL engine - simplified implementation
    // In a real implementation, this would execute the SPARQL pattern
    return [];
  }
}

export default ContextExtractor;