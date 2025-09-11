/**
 * Index Builder - Subject-to-artifact mapping and graph indexing
 * 
 * Creates and manages indexes that map RDF subjects to artifacts they influence,
 * enabling efficient impact analysis and change management.
 */

import { Parser, Store, DataFactory } from 'n3';
import crypto from 'crypto';
import consola from 'consola';

const { namedNode, literal, defaultGraph } = DataFactory;

export class IndexBuilder {
  constructor(config = {}) {
    this.config = {
      enableSemanticIndexing: true,
      enablePredicateIndexing: true,
      enableNamespaceIndexing: true,
      enableArtifactMapping: true,
      maxDepthTraversal: 5,
      cacheIndexes: true,
      ...config
    };
    
    this.logger = consola.withTag('index-builder');
    this.parser = new Parser();
    this.indexes = new Map();
    this.artifactMappings = new Map();
  }

  /**
   * Build comprehensive index for TTL file
   * @param {string} ttlContent - TTL content to index
   * @param {Object} options - Index options
   * @returns {Promise<Object>} Complete index structure
   */
  async buildIndex(ttlContent, options = {}) {
    try {
      this.logger.debug('Building comprehensive graph index');
      
      const startTime = Date.now();
      const indexOptions = { ...this.config, ...options };
      
      // Parse TTL content
      const quads = await this._parseTTL(ttlContent);
      this.logger.debug(`Indexing ${quads.length} triples`);
      
      // Create store for efficient querying
      const store = new Store(quads);
      
      // Build different types of indexes
      const indexes = {
        subjects: await this._buildSubjectIndex(store, indexOptions),
        predicates: await this._buildPredicateIndex(store, indexOptions),
        objects: await this._buildObjectIndex(store, indexOptions),
        namespaces: await this._buildNamespaceIndex(store, indexOptions),
        semantic: await this._buildSemanticIndex(store, indexOptions),
        graph: await this._buildGraphIndex(store, indexOptions)
      };
      
      // Build artifact mappings if enabled
      if (indexOptions.enableArtifactMapping) {
        indexes.artifactMappings = await this._buildArtifactMappings(store, indexes, indexOptions);
      }
      
      // Calculate index statistics
      const statistics = this._calculateIndexStatistics(indexes, quads.length);
      
      const processingTime = Date.now() - startTime;
      
      const indexResult = {
        indexes,
        statistics,
        metadata: {
          totalTriples: quads.length,
          processingTime,
          indexedAt: new Date().toISOString(),
          options: indexOptions
        }
      };
      
      // Cache indexes if enabled
      if (indexOptions.cacheIndexes) {
        const indexHash = this._calculateIndexHash(ttlContent);
        this.indexes.set(indexHash, indexResult);
      }
      
      this.logger.success(`Index built with ${statistics.totalEntries} entries (${processingTime}ms)`);
      return indexResult;
      
    } catch (error) {
      this.logger.error('Failed to build index:', error);
      throw error;
    }
  }

  /**
   * Build subject-to-artifact mapping
   * @param {string} ttlContent - TTL content
   * @param {Array<Object>} artifacts - Artifact definitions
   * @param {Object} options - Mapping options
   * @returns {Promise<Object>} Subject-to-artifact mappings
   */
  async buildSubjectToArtifactMapping(ttlContent, artifacts, options = {}) {
    try {
      this.logger.debug(`Building subject-to-artifact mapping for ${artifacts.length} artifacts`);
      
      const quads = await this._parseTTL(ttlContent);
      const store = new Store(quads);
      
      // Extract all subjects
      const subjects = new Set(quads.map(q => q.subject.value));
      
      const mappings = {
        subjectToArtifacts: new Map(),
        artifactToSubjects: new Map(),
        coverage: {
          totalSubjects: subjects.size,
          mappedSubjects: 0,
          totalArtifacts: artifacts.length,
          artifactsWithMappings: 0
        }
      };
      
      // Process each artifact
      for (const artifact of artifacts) {
        const artifactSubjects = new Set();
        
        // Match subjects based on artifact criteria
        for (const subject of subjects) {
          if (await this._subjectMatchesArtifact(store, subject, artifact, options)) {
            artifactSubjects.add(subject);
            
            // Add to subject-to-artifact mapping
            if (!mappings.subjectToArtifacts.has(subject)) {
              mappings.subjectToArtifacts.set(subject, []);
            }
            mappings.subjectToArtifacts.get(subject).push(artifact);
          }
        }
        
        // Store artifact-to-subjects mapping
        if (artifactSubjects.size > 0) {
          mappings.artifactToSubjects.set(artifact.id || artifact.name, Array.from(artifactSubjects));
          mappings.coverage.artifactsWithMappings++;
        }
      }
      
      // Update coverage statistics
      mappings.coverage.mappedSubjects = mappings.subjectToArtifacts.size;
      mappings.coverage.coveragePercentage = Math.round((mappings.coverage.mappedSubjects / mappings.coverage.totalSubjects) * 100);
      
      // Convert Maps to Objects for serialization
      return {
        subjectToArtifacts: Object.fromEntries(
          Array.from(mappings.subjectToArtifacts.entries()).map(([k, v]) => [k, v])
        ),
        artifactToSubjects: Object.fromEntries(mappings.artifactToSubjects),
        coverage: mappings.coverage,
        metadata: {
          createdAt: new Date().toISOString(),
          totalMappings: mappings.subjectToArtifacts.size
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to build subject-to-artifact mapping:', error);
      throw error;
    }
  }

  /**
   * Query index for subjects related to a specific subject
   * @param {Object} indexResult - Previously built index
   * @param {string} subjectUri - Subject URI to query
   * @param {Object} options - Query options
   * @returns {Array} Related subjects with relationship information
   */
  queryRelatedSubjects(indexResult, subjectUri, options = {}) {
    try {
      this.logger.debug(`Querying related subjects for: ${subjectUri}`);
      
      const maxDepth = options.maxDepth || 2;
      const includeInverse = options.includeInverse !== false;
      
      const related = [];
      const visited = new Set();
      const queue = [{ subject: subjectUri, depth: 0, path: [] }];
      
      while (queue.length > 0) {
        const current = queue.shift();
        
        if (visited.has(current.subject) || current.depth >= maxDepth) {
          continue;
        }
        
        visited.add(current.subject);
        
        if (current.depth > 0) {
          related.push({
            subject: current.subject,
            depth: current.depth,
            path: current.path,
            relationshipType: this._classifyRelationship(current.path)
          });
        }
        
        // Find directly connected subjects
        const connections = this._findSubjectConnections(indexResult, current.subject, includeInverse);
        
        for (const connection of connections) {
          if (!visited.has(connection.target)) {
            queue.push({
              subject: connection.target,
              depth: current.depth + 1,
              path: [...current.path, connection]
            });
          }
        }
      }
      
      return related.sort((a, b) => a.depth - b.depth);
      
    } catch (error) {
      this.logger.error('Failed to query related subjects:', error);
      return [];
    }
  }

  /**
   * Find subjects that would be affected by changes to a given subject
   * @param {Object} indexResult - Previously built index
   * @param {string} subjectUri - Subject URI that changed
   * @param {Object} options - Impact analysis options
   * @returns {Object} Impact analysis result
   */
  analyzeChangeImpact(indexResult, subjectUri, options = {}) {
    try {
      this.logger.debug(`Analyzing change impact for: ${subjectUri}`);
      
      const maxRadius = options.maxRadius || 3;
      const includeArtifacts = options.includeArtifacts !== false;
      
      const impact = {
        directlyAffected: [],
        indirectlyAffected: [],
        artifactsAffected: [],
        impactRadius: 0
      };
      
      // Find directly connected subjects
      const directConnections = this._findSubjectConnections(indexResult, subjectUri, true);
      impact.directlyAffected = directConnections.map(conn => ({
        subject: conn.target,
        predicate: conn.predicate,
        direction: conn.direction,
        distance: 1
      }));
      
      // Find indirectly affected subjects
      const visited = new Set([subjectUri]);
      const queue = impact.directlyAffected.map(d => ({ ...d, distance: 1 }));
      
      while (queue.length > 0) {
        const current = queue.shift();
        
        if (current.distance >= maxRadius) continue;
        
        if (visited.has(current.subject)) continue;
        visited.add(current.subject);
        
        const nextLevelConnections = this._findSubjectConnections(indexResult, current.subject, true);
        
        for (const conn of nextLevelConnections) {
          if (!visited.has(conn.target) && conn.target !== subjectUri) {
            const indirectImpact = {
              subject: conn.target,
              predicate: conn.predicate,
              direction: conn.direction,
              distance: current.distance + 1,
              path: [current.subject, conn.target]
            };
            
            impact.indirectlyAffected.push(indirectImpact);
            
            if (current.distance + 1 < maxRadius) {
              queue.push(indirectImpact);
            }
          }
        }
      }
      
      impact.impactRadius = Math.max(
        ...impact.indirectlyAffected.map(i => i.distance),
        0
      );
      
      // Find affected artifacts if mapping is available
      if (includeArtifacts && indexResult.indexes.artifactMappings) {
        const allAffectedSubjects = [
          subjectUri,
          ...impact.directlyAffected.map(d => d.subject),
          ...impact.indirectlyAffected.map(i => i.subject)
        ];
        
        impact.artifactsAffected = this._findArtifactsForSubjects(
          indexResult.indexes.artifactMappings,
          allAffectedSubjects
        );
      }
      
      return impact;
      
    } catch (error) {
      this.logger.error('Failed to analyze change impact:', error);
      throw error;
    }
  }

  /**
   * Search index by various criteria
   * @param {Object} indexResult - Previously built index
   * @param {Object} query - Search query
   * @returns {Array} Search results
   */
  searchIndex(indexResult, query) {
    try {
      this.logger.debug('Searching index with query:', query);
      
      const results = [];
      
      // Search by subject pattern
      if (query.subjectPattern) {
        const subjectMatches = this._searchByPattern(
          indexResult.indexes.subjects,
          query.subjectPattern
        );
        results.push(...subjectMatches);
      }
      
      // Search by predicate
      if (query.predicate) {
        const predicateMatches = this._searchByPredicate(
          indexResult.indexes.predicates,
          query.predicate
        );
        results.push(...predicateMatches);
      }
      
      // Search by namespace
      if (query.namespace) {
        const namespaceMatches = this._searchByNamespace(
          indexResult.indexes.namespaces,
          query.namespace
        );
        results.push(...namespaceMatches);
      }
      
      // Search by semantic type
      if (query.semanticType) {
        const semanticMatches = this._searchBySemanticType(
          indexResult.indexes.semantic,
          query.semanticType
        );
        results.push(...semanticMatches);
      }
      
      // Deduplicate and sort results
      const uniqueResults = this._deduplicateResults(results);
      return this._sortSearchResults(uniqueResults, query);
      
    } catch (error) {
      this.logger.error('Index search failed:', error);
      return [];
    }
  }

  // Private methods

  async _parseTTL(ttlContent) {
    return new Promise((resolve, reject) => {
      const quads = [];
      
      this.parser.parse(ttlContent, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          quads.push(quad);
        } else {
          resolve(quads);
        }
      });
    });
  }

  async _buildSubjectIndex(store, options) {
    const subjectIndex = new Map();
    const subjects = new Set();
    
    // Collect all subjects
    for (const quad of store.getQuads()) {
      subjects.add(quad.subject.value);
    }
    
    // Build index for each subject
    for (const subject of subjects) {
      const subjectQuads = store.getQuads(namedNode(subject), null, null);
      const predicateValues = new Map();
      
      for (const quad of subjectQuads) {
        const predicate = quad.predicate.value;
        if (!predicateValues.has(predicate)) {
          predicateValues.set(predicate, []);
        }
        predicateValues.get(predicate).push(this._termToValue(quad.object));
      }
      
      subjectIndex.set(subject, {
        uri: subject,
        properties: Object.fromEntries(predicateValues),
        tripleCount: subjectQuads.length,
        namespace: this._extractNamespace(subject)
      });
    }
    
    return Object.fromEntries(subjectIndex);
  }

  async _buildPredicateIndex(store, options) {
    const predicateIndex = new Map();
    
    for (const quad of store.getQuads()) {
      const predicate = quad.predicate.value;
      
      if (!predicateIndex.has(predicate)) {
        predicateIndex.set(predicate, {
          uri: predicate,
          subjects: new Set(),
          objects: new Set(),
          count: 0,
          namespace: this._extractNamespace(predicate)
        });
      }
      
      const entry = predicateIndex.get(predicate);
      entry.subjects.add(quad.subject.value);
      entry.objects.add(this._termToValue(quad.object));
      entry.count++;
    }
    
    // Convert Sets to Arrays for serialization
    const serializedIndex = {};
    for (const [predicate, data] of predicateIndex) {
      serializedIndex[predicate] = {
        ...data,
        subjects: Array.from(data.subjects),
        objects: Array.from(data.objects)
      };
    }
    
    return serializedIndex;
  }

  async _buildObjectIndex(store, options) {
    const objectIndex = new Map();
    
    for (const quad of store.getQuads()) {
      const object = this._termToValue(quad.object);
      
      if (!objectIndex.has(object)) {
        objectIndex.set(object, {
          value: object,
          termType: quad.object.termType,
          subjects: new Set(),
          predicates: new Set(),
          count: 0
        });
      }
      
      const entry = objectIndex.get(object);
      entry.subjects.add(quad.subject.value);
      entry.predicates.add(quad.predicate.value);
      entry.count++;
    }
    
    // Convert Sets to Arrays
    const serializedIndex = {};
    for (const [object, data] of objectIndex) {
      serializedIndex[object] = {
        ...data,
        subjects: Array.from(data.subjects),
        predicates: Array.from(data.predicates)
      };
    }
    
    return serializedIndex;
  }

  async _buildNamespaceIndex(store, options) {
    const namespaceIndex = new Map();
    
    for (const quad of store.getQuads()) {
      const subjectNs = this._extractNamespace(quad.subject.value);
      const predicateNs = this._extractNamespace(quad.predicate.value);
      const objectNs = quad.object.termType === 'NamedNode' ? 
        this._extractNamespace(quad.object.value) : null;
      
      for (const ns of [subjectNs, predicateNs, objectNs].filter(Boolean)) {
        if (!namespaceIndex.has(ns)) {
          namespaceIndex.set(ns, {
            namespace: ns,
            subjects: new Set(),
            predicates: new Set(),
            objects: new Set(),
            tripleCount: 0
          });
        }
        
        const entry = namespaceIndex.get(ns);
        
        if (ns === subjectNs) entry.subjects.add(quad.subject.value);
        if (ns === predicateNs) entry.predicates.add(quad.predicate.value);
        if (ns === objectNs) entry.objects.add(quad.object.value);
        
        entry.tripleCount++;
      }
    }
    
    // Convert Sets to Arrays
    const serializedIndex = {};
    for (const [ns, data] of namespaceIndex) {
      serializedIndex[ns] = {
        ...data,
        subjects: Array.from(data.subjects),
        predicates: Array.from(data.predicates),
        objects: Array.from(data.objects)
      };
    }
    
    return serializedIndex;
  }

  async _buildSemanticIndex(store, options) {
    const semanticIndex = {
      classes: {},
      properties: {},
      individuals: {}
    };
    
    const typeUri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    
    // Index classes
    const classTypes = [
      'http://www.w3.org/2000/01/rdf-schema#Class',
      'http://www.w3.org/2002/07/owl#Class'
    ];
    
    for (const classType of classTypes) {
      const classQuads = store.getQuads(null, namedNode(typeUri), namedNode(classType));
      for (const quad of classQuads) {
        const classUri = quad.subject.value;
        semanticIndex.classes[classUri] = {
          uri: classUri,
          type: classType,
          instances: this._findInstances(store, classUri),
          properties: this._findClassProperties(store, classUri)
        };
      }
    }
    
    // Index properties
    const propertyTypes = [
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
      'http://www.w3.org/2002/07/owl#ObjectProperty',
      'http://www.w3.org/2002/07/owl#DatatypeProperty'
    ];
    
    for (const propertyType of propertyTypes) {
      const propertyQuads = store.getQuads(null, namedNode(typeUri), namedNode(propertyType));
      for (const quad of propertyQuads) {
        const propertyUri = quad.subject.value;
        semanticIndex.properties[propertyUri] = {
          uri: propertyUri,
          type: propertyType,
          domain: this._findPropertyDomain(store, propertyUri),
          range: this._findPropertyRange(store, propertyUri),
          usage: this._findPropertyUsage(store, propertyUri)
        };
      }
    }
    
    // Index individuals (instances)
    for (const quad of store.getQuads(null, namedNode(typeUri), null)) {
      if (quad.object.termType === 'NamedNode' && 
          !classTypes.includes(quad.object.value) &&
          !propertyTypes.includes(quad.object.value)) {
        
        const individual = quad.subject.value;
        const type = quad.object.value;
        
        if (!semanticIndex.individuals[individual]) {
          semanticIndex.individuals[individual] = {
            uri: individual,
            types: [],
            properties: this._findIndividualProperties(store, individual)
          };
        }
        
        semanticIndex.individuals[individual].types.push(type);
      }
    }
    
    return semanticIndex;
  }

  async _buildGraphIndex(store, options) {
    const graphs = new Set();
    const graphIndex = {};
    
    // Collect all graph names
    for (const quad of store.getQuads()) {
      if (!quad.graph.equals(defaultGraph())) {
        graphs.add(quad.graph.value);
      }
    }
    
    // Index each graph
    for (const graphUri of graphs) {
      const graphQuads = store.getQuads(null, null, null, namedNode(graphUri));
      graphIndex[graphUri] = {
        uri: graphUri,
        tripleCount: graphQuads.length,
        subjects: [...new Set(graphQuads.map(q => q.subject.value))],
        predicates: [...new Set(graphQuads.map(q => q.predicate.value))]
      };
    }
    
    // Add default graph if it has content
    const defaultGraphQuads = store.getQuads(null, null, null, defaultGraph());
    if (defaultGraphQuads.length > 0) {
      graphIndex[''] = {
        uri: '',
        name: 'default',
        tripleCount: defaultGraphQuads.length,
        subjects: [...new Set(defaultGraphQuads.map(q => q.subject.value))],
        predicates: [...new Set(defaultGraphQuads.map(q => q.predicate.value))]
      };
    }
    
    return graphIndex;
  }

  async _buildArtifactMappings(store, indexes, options) {
    // This would integrate with artifact definitions to create mappings
    // For now, return a basic structure
    return {
      subjectToArtifacts: {},
      artifactToSubjects: {},
      mappingRules: [],
      statistics: {
        totalSubjects: Object.keys(indexes.subjects).length,
        mappedSubjects: 0,
        totalArtifacts: 0,
        artifactsWithMappings: 0
      }
    };
  }

  async _subjectMatchesArtifact(store, subject, artifact, options) {
    try {
      // Check if subject matches artifact criteria
      if (artifact.subjectPattern) {
        const regex = new RegExp(artifact.subjectPattern);
        if (!regex.test(subject)) return false;
      }
      
      if (artifact.namespace) {
        const subjectNs = this._extractNamespace(subject);
        if (subjectNs !== artifact.namespace) return false;
      }
      
      if (artifact.requiredPredicates) {
        for (const predicate of artifact.requiredPredicates) {
          const hasPredicateQuads = store.getQuads(namedNode(subject), namedNode(predicate), null);
          if (hasPredicateQuads.length === 0) return false;
        }
      }
      
      if (artifact.requiredTypes) {
        const typeUri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
        const typeQuads = store.getQuads(namedNode(subject), namedNode(typeUri), null);
        const subjectTypes = typeQuads.map(q => q.object.value);
        
        for (const requiredType of artifact.requiredTypes) {
          if (!subjectTypes.includes(requiredType)) return false;
        }
      }
      
      return true;
      
    } catch (error) {
      this.logger.debug(`Error matching subject ${subject} to artifact:`, error);
      return false;
    }
  }

  _calculateIndexStatistics(indexes, totalTriples) {
    let totalEntries = 0;
    
    const stats = {
      totalTriples,
      totalEntries: 0,
      subjectCount: Object.keys(indexes.subjects || {}).length,
      predicateCount: Object.keys(indexes.predicates || {}).length,
      objectCount: Object.keys(indexes.objects || {}).length,
      namespaceCount: Object.keys(indexes.namespaces || {}).length,
      classCount: Object.keys(indexes.semantic?.classes || {}).length,
      propertyCount: Object.keys(indexes.semantic?.properties || {}).length,
      individualCount: Object.keys(indexes.semantic?.individuals || {}).length,
      graphCount: Object.keys(indexes.graph || {}).length
    };
    
    stats.totalEntries = stats.subjectCount + stats.predicateCount + stats.objectCount;
    
    return stats;
  }

  _calculateIndexHash(ttlContent) {
    return crypto.createHash('sha256').update(ttlContent).digest('hex');
  }

  _findSubjectConnections(indexResult, subjectUri, includeInverse = true) {
    const connections = [];
    
    try {
      const subjectData = indexResult.indexes.subjects[subjectUri];
      if (!subjectData) return connections;
      
      // Forward connections (subject -> predicate -> object)
      for (const [predicate, objects] of Object.entries(subjectData.properties)) {
        for (const object of Array.isArray(objects) ? objects : [objects]) {
          connections.push({
            target: object,
            predicate,
            direction: 'forward',
            type: 'property'
          });
        }
      }
      
      // Inverse connections (find subjects that point to this subject)
      if (includeInverse) {
        for (const [otherSubject, otherData] of Object.entries(indexResult.indexes.subjects)) {
          if (otherSubject === subjectUri) continue;
          
          for (const [predicate, objects] of Object.entries(otherData.properties)) {
            const objectArray = Array.isArray(objects) ? objects : [objects];
            if (objectArray.includes(subjectUri)) {
              connections.push({
                target: otherSubject,
                predicate,
                direction: 'inverse',
                type: 'property'
              });
            }
          }
        }
      }
      
    } catch (error) {
      this.logger.debug(`Error finding connections for ${subjectUri}:`, error);
    }
    
    return connections;
  }

  _classifyRelationship(path) {
    if (path.length === 0) return 'direct';
    
    const lastConnection = path[path.length - 1];
    
    // Classify based on predicate
    if (lastConnection.predicate) {
      if (lastConnection.predicate.includes('subClassOf') || 
          lastConnection.predicate.includes('subPropertyOf')) {
        return 'hierarchical';
      }
      if (lastConnection.predicate.includes('type')) {
        return 'classification';
      }
      if (lastConnection.predicate.includes('part') || 
          lastConnection.predicate.includes('member')) {
        return 'compositional';
      }
    }
    
    return 'associative';
  }

  _findArtifactsForSubjects(artifactMappings, subjects) {
    const artifacts = new Set();
    
    for (const subject of subjects) {
      const subjectArtifacts = artifactMappings.subjectToArtifacts[subject];
      if (subjectArtifacts) {
        for (const artifact of subjectArtifacts) {
          artifacts.add(artifact);
        }
      }
    }
    
    return Array.from(artifacts);
  }

  _extractNamespace(uri) {
    if (!uri) return null;
    
    const lastHash = uri.lastIndexOf('#');
    const lastSlash = uri.lastIndexOf('/');
    
    if (lastHash > lastSlash) {
      return uri.substring(0, lastHash + 1);
    } else if (lastSlash >= 0) {
      return uri.substring(0, lastSlash + 1);
    }
    
    return null;
  }

  _termToValue(term) {
    if (term.termType === 'Literal') {
      return term.value;
    }
    return term.value;
  }

  _findInstances(store, classUri) {
    const typeUri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const instances = store.getQuads(null, namedNode(typeUri), namedNode(classUri));
    return instances.map(q => q.subject.value);
  }

  _findClassProperties(store, classUri) {
    const domainUri = 'http://www.w3.org/2000/01/rdf-schema#domain';
    const domainQuads = store.getQuads(null, namedNode(domainUri), namedNode(classUri));
    return domainQuads.map(q => q.subject.value);
  }

  _findPropertyDomain(store, propertyUri) {
    const domainUri = 'http://www.w3.org/2000/01/rdf-schema#domain';
    const domainQuads = store.getQuads(namedNode(propertyUri), namedNode(domainUri), null);
    return domainQuads.map(q => q.object.value);
  }

  _findPropertyRange(store, propertyUri) {
    const rangeUri = 'http://www.w3.org/2000/01/rdf-schema#range';
    const rangeQuads = store.getQuads(namedNode(propertyUri), namedNode(rangeUri), null);
    return rangeQuads.map(q => q.object.value);
  }

  _findPropertyUsage(store, propertyUri) {
    const usageQuads = store.getQuads(null, namedNode(propertyUri), null);
    return {
      count: usageQuads.length,
      subjects: [...new Set(usageQuads.map(q => q.subject.value))],
      objects: [...new Set(usageQuads.map(q => this._termToValue(q.object)))]
    };
  }

  _findIndividualProperties(store, individualUri) {
    const individualQuads = store.getQuads(namedNode(individualUri), null, null);
    const properties = {};
    
    for (const quad of individualQuads) {
      const predicate = quad.predicate.value;
      if (!properties[predicate]) {
        properties[predicate] = [];
      }
      properties[predicate].push(this._termToValue(quad.object));
    }
    
    return properties;
  }

  _searchByPattern(subjectIndex, pattern) {
    const regex = new RegExp(pattern, 'i');
    const matches = [];
    
    for (const [subject, data] of Object.entries(subjectIndex)) {
      if (regex.test(subject)) {
        matches.push({
          type: 'subject',
          uri: subject,
          data,
          score: 1.0
        });
      }
    }
    
    return matches;
  }

  _searchByPredicate(predicateIndex, predicate) {
    const matches = [];
    const predicateData = predicateIndex[predicate];
    
    if (predicateData) {
      matches.push({
        type: 'predicate',
        uri: predicate,
        data: predicateData,
        score: 1.0
      });
    }
    
    return matches;
  }

  _searchByNamespace(namespaceIndex, namespace) {
    const matches = [];
    const namespaceData = namespaceIndex[namespace];
    
    if (namespaceData) {
      matches.push({
        type: 'namespace',
        uri: namespace,
        data: namespaceData,
        score: 1.0
      });
    }
    
    return matches;
  }

  _searchBySemanticType(semanticIndex, semanticType) {
    const matches = [];
    
    if (semanticType === 'class' && semanticIndex.classes) {
      for (const [classUri, classData] of Object.entries(semanticIndex.classes)) {
        matches.push({
          type: 'class',
          uri: classUri,
          data: classData,
          score: 1.0
        });
      }
    }
    
    return matches;
  }

  _deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = `${result.type}:${result.uri}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  _sortSearchResults(results, query) {
    return results.sort((a, b) => {
      // Sort by score first, then by type
      if (a.score !== b.score) return b.score - a.score;
      return a.type.localeCompare(b.type);
    });
  }
}

export default IndexBuilder;