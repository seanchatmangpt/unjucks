/**
 * Diff Analyzer - Delta calculation with blast radius analysis
 * 
 * Provides comprehensive graph diff analysis, calculating changes
 * between graph versions and determining impact radius.
 */

import { Parser, Store, DataFactory } from 'n3';
import consola from 'consola';

const { namedNode, literal, defaultGraph } = DataFactory;

export class DiffAnalyzer {
  constructor(config = {}) {
    this.config = {
      includeBlankNodes: true,
      includeGraphContext: true,
      calculateBlastRadius: true,
      maxBlastRadius: 10,
      includeSemanticDiff: true,
      diffGranularity: 'triple', // 'triple', 'subject', 'predicate'
      ...config
    };
    
    this.logger = consola.withTag('diff-analyzer');
    this.parser = new Parser();
  }

  /**
   * Calculate comprehensive diff between two TTL files
   * @param {string} ttl1 - Original TTL content
   * @param {string} ttl2 - Modified TTL content
   * @param {Object} options - Diff options
   * @returns {Promise<Object>} Comprehensive diff report
   */
  async calculateDiff(ttl1, ttl2, options = {}) {
    try {
      this.logger.debug('Calculating comprehensive graph diff');
      
      const startTime = this.getDeterministicTimestamp();
      const diffOptions = { ...this.config, ...options };
      
      // Parse both TTL contents
      const [quads1, quads2] = await Promise.all([
        this._parseTTL(ttl1, 'original'),
        this._parseTTL(ttl2, 'modified')
      ]);
      
      this.logger.debug(`Parsed ${quads1.length} vs ${quads2.length} triples`);
      
      // Calculate basic diff
      const basicDiff = this._calculateBasicDiff(quads1, quads2, diffOptions);
      
      // Calculate semantic diff if enabled
      const semanticDiff = diffOptions.includeSemanticDiff 
        ? await this._calculateSemanticDiff(quads1, quads2, diffOptions)
        : null;
      
      // Calculate blast radius if enabled
      const blastRadius = diffOptions.calculateBlastRadius
        ? await this._calculateBlastRadius(basicDiff, quads1, quads2, diffOptions)
        : null;
      
      // Analyze impact patterns
      const impactAnalysis = await this._analyzeImpactPatterns(basicDiff, diffOptions);
      
      const processingTime = this.getDeterministicTimestamp() - startTime;
      
      const diffReport = {
        summary: {
          totalChanges: basicDiff.added.length + basicDiff.removed.length + basicDiff.modified.length,
          addedTriples: basicDiff.added.length,
          removedTriples: basicDiff.removed.length,
          modifiedTriples: basicDiff.modified.length,
          unchangedTriples: basicDiff.unchanged.length,
          processingTime
        },
        changes: {
          added: basicDiff.added,
          removed: basicDiff.removed,
          modified: basicDiff.modified,
          unchanged: diffOptions.includeUnchanged ? basicDiff.unchanged : []
        },
        semanticDiff,
        blastRadius,
        impactAnalysis,
        metadata: {
          original: {
            tripleCount: quads1.length,
            subjectCount: new Set(quads1.map(q => q.subject.value)).size,
            predicateCount: new Set(quads1.map(q => q.predicate.value)).size
          },
          modified: {
            tripleCount: quads2.length,
            subjectCount: new Set(quads2.map(q => q.subject.value)).size,
            predicateCount: new Set(quads2.map(q => q.predicate.value)).size
          },
          options: diffOptions
        }
      };
      
      this.logger.success(`Diff calculated: ${diffReport.summary.totalChanges} changes (${processingTime}ms)`);
      return diffReport;
      
    } catch (error) {
      this.logger.error('Failed to calculate diff:', error);
      throw error;
    }
  }

  /**
   * Calculate subject-level diff
   * @param {string} ttl1 - Original TTL content
   * @param {string} ttl2 - Modified TTL content
   * @param {Object} options - Diff options
   * @returns {Promise<Object>} Subject-level diff report
   */
  async calculateSubjectDiff(ttl1, ttl2, options = {}) {
    try {
      this.logger.debug('Calculating subject-level diff');
      
      const [quads1, quads2] = await Promise.all([
        this._parseTTL(ttl1, 'original'),
        this._parseTTL(ttl2, 'modified')
      ]);
      
      // Group quads by subject
      const subjects1 = this._groupQuadsBySubject(quads1);
      const subjects2 = this._groupQuadsBySubject(quads2);
      
      const allSubjects = new Set([...subjects1.keys(), ...subjects2.keys()]);
      const subjectChanges = {
        added: [],
        removed: [],
        modified: [],
        unchanged: []
      };
      
      for (const subject of allSubjects) {
        const quads1ForSubject = subjects1.get(subject) || [];
        const quads2ForSubject = subjects2.get(subject) || [];
        
        if (quads1ForSubject.length === 0) {
          // New subject
          subjectChanges.added.push({
            subject,
            triples: quads2ForSubject.length,
            quads: quads2ForSubject
          });
        } else if (quads2ForSubject.length === 0) {
          // Removed subject
          subjectChanges.removed.push({
            subject,
            triples: quads1ForSubject.length,
            quads: quads1ForSubject
          });
        } else {
          // Compare subject's triples
          const subjectDiff = this._calculateBasicDiff(quads1ForSubject, quads2ForSubject, options);
          
          if (subjectDiff.added.length > 0 || subjectDiff.removed.length > 0) {
            subjectChanges.modified.push({
              subject,
              changes: {
                added: subjectDiff.added.length,
                removed: subjectDiff.removed.length,
                modified: subjectDiff.modified.length
              },
              details: subjectDiff
            });
          } else {
            subjectChanges.unchanged.push({
              subject,
              triples: quads1ForSubject.length
            });
          }
        }
      }
      
      return {
        summary: {
          totalSubjects: allSubjects.size,
          addedSubjects: subjectChanges.added.length,
          removedSubjects: subjectChanges.removed.length,
          modifiedSubjects: subjectChanges.modified.length,
          unchangedSubjects: subjectChanges.unchanged.length
        },
        subjects: subjectChanges
      };
      
    } catch (error) {
      this.logger.error('Failed to calculate subject diff:', error);
      throw error;
    }
  }

  /**
   * Calculate predicate-level diff
   * @param {string} ttl1 - Original TTL content
   * @param {string} ttl2 - Modified TTL content
   * @param {Object} options - Diff options
   * @returns {Promise<Object>} Predicate-level diff report
   */
  async calculatePredicateDiff(ttl1, ttl2, options = {}) {
    try {
      this.logger.debug('Calculating predicate-level diff');
      
      const [quads1, quads2] = await Promise.all([
        this._parseTTL(ttl1, 'original'),
        this._parseTTL(ttl2, 'modified')
      ]);
      
      // Group quads by predicate
      const predicates1 = this._groupQuadsByPredicate(quads1);
      const predicates2 = this._groupQuadsByPredicate(quads2);
      
      const allPredicates = new Set([...predicates1.keys(), ...predicates2.keys()]);
      const predicateChanges = {
        added: [],
        removed: [],
        modified: [],
        unchanged: []
      };
      
      for (const predicate of allPredicates) {
        const quads1ForPredicate = predicates1.get(predicate) || [];
        const quads2ForPredicate = predicates2.get(predicate) || [];
        
        if (quads1ForPredicate.length === 0) {
          // New predicate
          predicateChanges.added.push({
            predicate,
            triples: quads2ForPredicate.length,
            uniqueSubjects: new Set(quads2ForPredicate.map(q => q.subject.value)).size
          });
        } else if (quads2ForPredicate.length === 0) {
          // Removed predicate
          predicateChanges.removed.push({
            predicate,
            triples: quads1ForPredicate.length,
            uniqueSubjects: new Set(quads1ForPredicate.map(q => q.subject.value)).size
          });
        } else {
          // Compare predicate usage
          const predicateDiff = this._calculateBasicDiff(quads1ForPredicate, quads2ForPredicate, options);
          
          if (predicateDiff.added.length > 0 || predicateDiff.removed.length > 0) {
            predicateChanges.modified.push({
              predicate,
              changes: {
                added: predicateDiff.added.length,
                removed: predicateDiff.removed.length,
                net: predicateDiff.added.length - predicateDiff.removed.length
              },
              details: predicateDiff
            });
          } else {
            predicateChanges.unchanged.push({
              predicate,
              triples: quads1ForPredicate.length
            });
          }
        }
      }
      
      return {
        summary: {
          totalPredicates: allPredicates.size,
          addedPredicates: predicateChanges.added.length,
          removedPredicates: predicateChanges.removed.length,
          modifiedPredicates: predicateChanges.modified.length,
          unchangedPredicates: predicateChanges.unchanged.length
        },
        predicates: predicateChanges
      };
      
    } catch (error) {
      this.logger.error('Failed to calculate predicate diff:', error);
      throw error;
    }
  }

  /**
   * Calculate change impact for specific subjects
   * @param {Object} diffResult - Diff result from calculateDiff
   * @param {Array<string>} targetSubjects - Subjects to analyze
   * @returns {Object} Impact analysis for target subjects
   */
  analyzeSubjectImpact(diffResult, targetSubjects) {
    try {
      this.logger.debug(`Analyzing impact on ${targetSubjects.length} subjects`);
      
      const targetSubjectSet = new Set(targetSubjects);
      const impact = {
        directlyAffected: [],
        indirectlyAffected: [],
        unaffected: [],
        impactSummary: {}
      };
      
      // Analyze direct impact
      const allChanges = [...diffResult.changes.added, ...diffResult.changes.removed, ...diffResult.changes.modified];
      
      for (const change of allChanges) {
        const subjectUri = change.subject?.value || change.quad?.subject?.value;
        if (targetSubjectSet.has(subjectUri)) {
          impact.directlyAffected.push({
            subject: subjectUri,
            changeType: change.type || 'unknown',
            change
          });
        }
      }
      
      // Analyze indirect impact through blast radius
      if (diffResult.blastRadius) {
        for (const affected of diffResult.blastRadius.affectedSubjects || []) {
          if (targetSubjectSet.has(affected.subject) && 
              !impact.directlyAffected.find(d => d.subject === affected.subject)) {
            impact.indirectlyAffected.push({
              subject: affected.subject,
              distance: affected.distance,
              reason: affected.reason
            });
          }
        }
      }
      
      // Identify unaffected subjects
      const affectedSubjects = new Set([
        ...impact.directlyAffected.map(i => i.subject),
        ...impact.indirectlyAffected.map(i => i.subject)
      ]);
      
      impact.unaffected = targetSubjects.filter(s => !affectedSubjects.has(s));
      
      // Generate summary
      impact.impactSummary = {
        totalTargets: targetSubjects.length,
        directlyAffected: impact.directlyAffected.length,
        indirectlyAffected: impact.indirectlyAffected.length,
        unaffected: impact.unaffected.length,
        impactPercentage: Math.round(((impact.directlyAffected.length + impact.indirectlyAffected.length) / targetSubjects.length) * 100)
      };
      
      return impact;
      
    } catch (error) {
      this.logger.error('Failed to analyze subject impact:', error);
      throw error;
    }
  }

  // Private methods

  async _parseTTL(ttlContent, label = '') {
    return new Promise((resolve, reject) => {
      const quads = [];
      
      this.parser.parse(ttlContent, (error, quad, prefixes) => {
        if (error) {
          reject(new Error(`Failed to parse ${label} TTL: ${error.message}`));
        } else if (quad) {
          quads.push(quad);
        } else {
          resolve(quads);
        }
      });
    });
  }

  _calculateBasicDiff(quads1, quads2, options) {
    // Create string representations for comparison
    const quadStrings1 = new Map(quads1.map(q => [this._quadToString(q), q]));
    const quadStrings2 = new Map(quads2.map(q => [this._quadToString(q), q]));
    
    const added = [];
    const removed = [];
    const modified = [];
    const unchanged = [];
    
    // Find added quads
    for (const [quadString, quad] of quadStrings2) {
      if (!quadStrings1.has(quadString)) {
        added.push({
          type: 'added',
          quad,
          quadString,
          subject: quad.subject,
          predicate: quad.predicate,
          object: quad.object
        });
      } else {
        unchanged.push({
          type: 'unchanged',
          quad,
          quadString
        });
      }
    }
    
    // Find removed quads
    for (const [quadString, quad] of quadStrings1) {
      if (!quadStrings2.has(quadString)) {
        removed.push({
          type: 'removed',
          quad,
          quadString,
          subject: quad.subject,
          predicate: quad.predicate,
          object: quad.object
        });
      }
    }
    
    // TODO: Implement modified quad detection (for now, treating as remove + add)
    
    return {
      added,
      removed,
      modified,
      unchanged
    };
  }

  async _calculateSemanticDiff(quads1, quads2, options) {
    try {
      // Analyze semantic changes
      const semanticChanges = {
        classChanges: [],
        propertyChanges: [],
        individualChanges: [],
        ontologyChanges: []
      };
      
      // Identify class changes
      const classes1 = this._extractClasses(quads1);
      const classes2 = this._extractClasses(quads2);
      semanticChanges.classChanges = this._compareMaps(classes1, classes2, 'class');
      
      // Identify property changes
      const properties1 = this._extractProperties(quads1);
      const properties2 = this._extractProperties(quads2);
      semanticChanges.propertyChanges = this._compareMaps(properties1, properties2, 'property');
      
      // Identify individual changes
      const individuals1 = this._extractIndividuals(quads1);
      const individuals2 = this._extractIndividuals(quads2);
      semanticChanges.individualChanges = this._compareMaps(individuals1, individuals2, 'individual');
      
      return semanticChanges;
      
    } catch (error) {
      this.logger.warn('Failed to calculate semantic diff:', error);
      return null;
    }
  }

  async _calculateBlastRadius(basicDiff, quads1, quads2, options) {
    try {
      const maxRadius = options.maxBlastRadius || this.config.maxBlastRadius;
      const blastRadius = {
        affectedSubjects: [],
        impactPaths: [],
        radius: 0
      };
      
      // Create adjacency maps for graph traversal
      const adjacencyMap = this._buildAdjacencyMap([...quads1, ...quads2]);
      
      // Start with directly changed subjects
      const changedSubjects = new Set();
      const allChanges = [...basicDiff.added, ...basicDiff.removed, ...basicDiff.modified];
      
      for (const change of allChanges) {
        const subject = change.subject?.value || change.quad?.subject?.value;
        if (subject) {
          changedSubjects.add(subject);
        }
      }
      
      // Propagate impact through graph
      const visited = new Set();
      const queue = Array.from(changedSubjects).map(s => ({ subject: s, distance: 0, path: [s] }));
      
      while (queue.length > 0 && blastRadius.radius < maxRadius) {
        const current = queue.shift();
        
        if (visited.has(current.subject)) continue;
        visited.add(current.subject);
        
        blastRadius.affectedSubjects.push({
          subject: current.subject,
          distance: current.distance,
          path: current.path,
          reason: current.distance === 0 ? 'direct_change' : 'indirect_impact'
        });
        
        blastRadius.radius = Math.max(blastRadius.radius, current.distance);
        
        // Add connected subjects to queue
        const neighbors = adjacencyMap.get(current.subject) || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && current.distance < maxRadius - 1) {
            queue.push({
              subject: neighbor,
              distance: current.distance + 1,
              path: [...current.path, neighbor]
            });
          }
        }
      }
      
      // Extract impact paths
      blastRadius.impactPaths = blastRadius.affectedSubjects
        .filter(a => a.distance > 1)
        .map(a => ({
          target: a.subject,
          distance: a.distance,
          path: a.path
        }));
      
      return blastRadius;
      
    } catch (error) {
      this.logger.warn('Failed to calculate blast radius:', error);
      return null;
    }
  }

  async _analyzeImpactPatterns(basicDiff, options) {
    try {
      const patterns = {
        dominantChangeType: null,
        affectedNamespaces: new Set(),
        affectedPredicates: new Map(),
        structuralChanges: [],
        dataChanges: []
      };
      
      // Analyze change types
      const changeTypes = {
        added: basicDiff.added.length,
        removed: basicDiff.removed.length,
        modified: basicDiff.modified.length
      };
      
      patterns.dominantChangeType = Object.entries(changeTypes)
        .sort(([,a], [,b]) => b - a)[0][0];
      
      // Analyze affected namespaces and predicates
      const allChanges = [...basicDiff.added, ...basicDiff.removed, ...basicDiff.modified];
      
      for (const change of allChanges) {
        const subject = change.subject?.value || change.quad?.subject?.value;
        const predicate = change.predicate?.value || change.quad?.predicate?.value;
        
        if (subject) {
          const namespace = this._extractNamespace(subject);
          if (namespace) patterns.affectedNamespaces.add(namespace);
        }
        
        if (predicate) {
          const count = patterns.affectedPredicates.get(predicate) || 0;
          patterns.affectedPredicates.set(predicate, count + 1);
          
          // Classify as structural or data change
          if (this._isStructuralPredicate(predicate)) {
            patterns.structuralChanges.push(change);
          } else {
            patterns.dataChanges.push(change);
          }
        }
      }
      
      return {
        ...patterns,
        affectedNamespaces: Array.from(patterns.affectedNamespaces),
        affectedPredicates: Object.fromEntries(patterns.affectedPredicates),
        changeDistribution: changeTypes
      };
      
    } catch (error) {
      this.logger.warn('Failed to analyze impact patterns:', error);
      return null;
    }
  }

  _groupQuadsBySubject(quads) {
    const subjects = new Map();
    
    for (const quad of quads) {
      const subject = quad.subject.value;
      if (!subjects.has(subject)) {
        subjects.set(subject, []);
      }
      subjects.get(subject).push(quad);
    }
    
    return subjects;
  }

  _groupQuadsByPredicate(quads) {
    const predicates = new Map();
    
    for (const quad of quads) {
      const predicate = quad.predicate.value;
      if (!predicates.has(predicate)) {
        predicates.set(predicate, []);
      }
      predicates.get(predicate).push(quad);
    }
    
    return predicates;
  }

  _extractClasses(quads) {
    const classes = new Map();
    const typeUri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const classUri = 'http://www.w3.org/2000/01/rdf-schema#Class';
    const owlClassUri = 'http://www.w3.org/2002/07/owl#Class';
    
    for (const quad of quads) {
      if (quad.predicate.value === typeUri && 
          (quad.object.value === classUri || quad.object.value === owlClassUri)) {
        classes.set(quad.subject.value, { uri: quad.subject.value, type: 'class' });
      }
    }
    
    return classes;
  }

  _extractProperties(quads) {
    const properties = new Map();
    const typeUri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const propertyTypes = [
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
      'http://www.w3.org/2002/07/owl#ObjectProperty',
      'http://www.w3.org/2002/07/owl#DatatypeProperty'
    ];
    
    for (const quad of quads) {
      if (quad.predicate.value === typeUri && propertyTypes.includes(quad.object.value)) {
        properties.set(quad.subject.value, { uri: quad.subject.value, type: 'property' });
      }
    }
    
    return properties;
  }

  _extractIndividuals(quads) {
    const individuals = new Map();
    const typeUri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    
    for (const quad of quads) {
      if (quad.predicate.value === typeUri) {
        individuals.set(quad.subject.value, { uri: quad.subject.value, type: quad.object.value });
      }
    }
    
    return individuals;
  }

  _compareMaps(map1, map2, type) {
    const changes = {
      added: [],
      removed: [],
      modified: []
    };
    
    // Find added items
    for (const [key, value] of map2) {
      if (!map1.has(key)) {
        changes.added.push({ type, uri: key, ...value });
      }
    }
    
    // Find removed items
    for (const [key, value] of map1) {
      if (!map2.has(key)) {
        changes.removed.push({ type, uri: key, ...value });
      }
    }
    
    return changes;
  }

  _buildAdjacencyMap(quads) {
    const adjacency = new Map();
    
    for (const quad of quads) {
      const subject = quad.subject.value;
      const object = quad.object.value;
      
      // Add forward relationship
      if (!adjacency.has(subject)) {
        adjacency.set(subject, new Set());
      }
      adjacency.get(subject).add(object);
      
      // Add backward relationship for bidirectional traversal
      if (!adjacency.has(object)) {
        adjacency.set(object, new Set());
      }
      adjacency.get(object).add(subject);
    }
    
    return adjacency;
  }

  _extractNamespace(uri) {
    const lastHash = uri.lastIndexOf('#');
    const lastSlash = uri.lastIndexOf('/');
    
    if (lastHash > lastSlash) {
      return uri.substring(0, lastHash + 1);
    } else if (lastSlash >= 0) {
      return uri.substring(0, lastSlash + 1);
    }
    
    return null;
  }

  _isStructuralPredicate(predicate) {
    const structuralPredicates = [
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      'http://www.w3.org/2000/01/rdf-schema#subPropertyOf',
      'http://www.w3.org/2000/01/rdf-schema#domain',
      'http://www.w3.org/2000/01/rdf-schema#range',
      'http://www.w3.org/2002/07/owl#equivalentClass',
      'http://www.w3.org/2002/07/owl#equivalentProperty'
    ];
    
    return structuralPredicates.includes(predicate);
  }

  _quadToString(quad) {
    const subject = this._termToString(quad.subject);
    const predicate = this._termToString(quad.predicate);
    const object = this._termToString(quad.object);
    const graph = quad.graph.equals(defaultGraph()) ? '' : this._termToString(quad.graph);
    
    return graph ? `${subject} ${predicate} ${object} ${graph}` : `${subject} ${predicate} ${object}`;
  }

  _termToString(term) {
    switch (term.termType) {
      case 'NamedNode':
        return `<${term.value}>`;
      case 'BlankNode':
        return term.value;
      case 'Literal':
        let result = `"${term.value.replace(/["\\]/g, '\\$&')}"`;
        if (term.language) {
          result += `@${term.language}`;
        } else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
          result += `^^<${term.datatype.value}>`;
        }
        return result;
      case 'DefaultGraph':
        return '';
      default:
        return term.value;
    }
  }
}

export default DiffAnalyzer;