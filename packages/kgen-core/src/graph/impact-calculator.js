/**
 * Impact Calculator - Change impact analysis for graph modifications
 * 
 * Analyzes the impact of changes to RDF graphs, calculating blast radius,
 * affected artifacts, and change propagation for efficient change management.
 */

import { Parser, Store, DataFactory } from 'n3';
import consola from 'consola';

const { namedNode, literal, defaultGraph } = DataFactory;

export class ImpactCalculator {
  constructor(config = {}) {
    this.config = {
      maxBlastRadius: 5,
      includeInverseRelationships: true,
      calculateArtifactImpact: true,
      weightedImpactScoring: true,
      enableSemanticAnalysis: true,
      impactThreshold: 0.1,
      ...config
    };
    
    this.logger = consola.withTag('impact-calculator');
    this.parser = new Parser();
    
    // Impact weight configuration
    this.impactWeights = {
      structuralPredicates: 1.0,  // rdf:type, rdfs:subClassOf, etc.
      dataPredicates: 0.5,       // data properties
      annotationPredicates: 0.2, // labels, comments
      directRelations: 1.0,      // direct property connections
      inverseRelations: 0.7,     // inverse relationships
      hierarchicalRelations: 0.9 // class/property hierarchies
    };
  }

  /**
   * Calculate comprehensive change impact
   * @param {string} originalTTL - Original TTL content
   * @param {string} modifiedTTL - Modified TTL content
   * @param {Object} options - Impact calculation options
   * @returns {Promise<Object>} Comprehensive impact analysis
   */
  async calculateChangeImpact(originalTTL, modifiedTTL, options = {}) {
    try {
      this.logger.debug('Calculating comprehensive change impact');
      
      const startTime = Date.now();
      const analysisOptions = { ...this.config, ...options };
      
      // Parse TTL contents
      const [originalQuads, modifiedQuads] = await Promise.all([
        this._parseTTL(originalTTL),
        this._parseTTL(modifiedTTL)
      ]);
      
      // Calculate basic changes
      const changes = this._calculateChanges(originalQuads, modifiedQuads);
      
      // Build graph representations
      const originalGraph = this._buildGraphRepresentation(originalQuads);
      const modifiedGraph = this._buildGraphRepresentation(modifiedQuads);
      
      // Calculate blast radius for each changed subject
      const blastRadiusAnalysis = await this._calculateBlastRadius(
        changes, originalGraph, modifiedGraph, analysisOptions
      );
      
      // Analyze semantic impact
      const semanticImpact = analysisOptions.enableSemanticAnalysis 
        ? await this._analyzeSemanticImpact(changes, originalGraph, modifiedGraph, analysisOptions)
        : null;
      
      // Calculate artifact impact if enabled
      const artifactImpact = analysisOptions.calculateArtifactImpact && analysisOptions.artifactMappings
        ? this._calculateArtifactImpact(blastRadiusAnalysis, analysisOptions.artifactMappings)
        : null;
      
      // Generate impact score
      const impactScore = this._calculateOverallImpactScore(
        changes, blastRadiusAnalysis, semanticImpact, analysisOptions
      );
      
      // Risk assessment
      const riskAssessment = this._assessChangeRisk(
        changes, blastRadiusAnalysis, semanticImpact, analysisOptions
      );
      
      const processingTime = Date.now() - startTime;
      
      const impactAnalysis = {
        summary: {
          totalChanges: changes.added.length + changes.removed.length,
          changedSubjects: changes.changedSubjects.size,
          impactRadius: blastRadiusAnalysis.maxRadius,
          impactScore: impactScore.overall,
          riskLevel: riskAssessment.level,
          processingTime
        },
        changes,
        blastRadius: blastRadiusAnalysis,
        semanticImpact,
        artifactImpact,
        impactScore,
        riskAssessment,
        recommendations: this._generateRecommendations(
          changes, blastRadiusAnalysis, riskAssessment, analysisOptions
        ),
        metadata: {
          originalTriples: originalQuads.length,
          modifiedTriples: modifiedQuads.length,
          analysisOptions,
          calculatedAt: new Date().toISOString()
        }
      };
      
      this.logger.success(`Impact analysis completed: ${impactScore.overall.toFixed(2)} score, ${riskAssessment.level} risk (${processingTime}ms)`);
      return impactAnalysis;
      
    } catch (error) {
      this.logger.error('Failed to calculate change impact:', error);
      throw error;
    }
  }

  /**
   * Calculate blast radius for specific subjects
   * @param {Array<string>} subjectUris - Subject URIs to analyze
   * @param {string} ttlContent - TTL content to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Blast radius analysis
   */
  async calculateSubjectBlastRadius(subjectUris, ttlContent, options = {}) {
    try {
      this.logger.debug(`Calculating blast radius for ${subjectUris.length} subjects`);
      
      const quads = await this._parseTTL(ttlContent);
      const graph = this._buildGraphRepresentation(quads);
      
      const blastRadius = {
        subjects: [],
        maxRadius: 0,
        totalAffected: 0
      };
      
      for (const subjectUri of subjectUris) {
        const subjectBlast = await this._calculateSubjectBlastRadius(
          subjectUri, graph, options
        );
        
        blastRadius.subjects.push({
          subject: subjectUri,
          ...subjectBlast
        });
        
        blastRadius.maxRadius = Math.max(blastRadius.maxRadius, subjectBlast.radius);
        blastRadius.totalAffected += subjectBlast.affectedSubjects.length;
      }
      
      return blastRadius;
      
    } catch (error) {
      this.logger.error('Failed to calculate subject blast radius:', error);
      throw error;
    }
  }

  /**
   * Assess risk level for proposed changes
   * @param {Object} changes - Change analysis result
   * @param {Object} options - Risk assessment options
   * @returns {Object} Risk assessment
   */
  assessChangeRisk(changes, options = {}) {
    try {
      this.logger.debug('Assessing change risk');
      
      const riskFactors = {
        structural: 0,
        scale: 0,
        semantic: 0,
        connectivity: 0
      };
      
      // Structural risk (changes to fundamental predicates)
      riskFactors.structural = this._assessStructuralRisk(changes);
      
      // Scale risk (number of changes)
      riskFactors.scale = this._assessScaleRisk(changes);
      
      // Semantic risk (changes to ontology structure)
      riskFactors.semantic = this._assessSemanticRisk(changes);
      
      // Connectivity risk (changes to highly connected entities)
      riskFactors.connectivity = this._assessConnectivityRisk(changes);
      
      // Calculate overall risk
      const overallRisk = this._calculateOverallRisk(riskFactors, options);
      
      return {
        level: overallRisk.level,
        score: overallRisk.score,
        factors: riskFactors,
        recommendations: this._generateRiskRecommendations(riskFactors, overallRisk)
      };
      
    } catch (error) {
      this.logger.error('Failed to assess change risk:', error);
      throw error;
    }
  }

  /**
   * Calculate dependency impact for subjects
   * @param {Array<string>} subjectUris - Subject URIs
   * @param {string} ttlContent - TTL content
   * @param {Object} options - Dependency analysis options
   * @returns {Promise<Object>} Dependency impact analysis
   */
  async calculateDependencyImpact(subjectUris, ttlContent, options = {}) {
    try {
      this.logger.debug(`Calculating dependency impact for ${subjectUris.length} subjects`);
      
      const quads = await this._parseTTL(ttlContent);
      const graph = this._buildGraphRepresentation(quads);
      
      const dependencyAnalysis = {
        dependencies: new Map(),
        dependents: new Map(),
        circularDependencies: [],
        criticalPaths: []
      };
      
      // Analyze dependencies for each subject
      for (const subjectUri of subjectUris) {
        const deps = this._findDependencies(subjectUri, graph, options);
        const dependents = this._findDependents(subjectUri, graph, options);
        
        dependencyAnalysis.dependencies.set(subjectUri, deps);
        dependencyAnalysis.dependents.set(subjectUri, dependents);
      }
      
      // Detect circular dependencies
      dependencyAnalysis.circularDependencies = this._detectCircularDependencies(
        dependencyAnalysis.dependencies
      );
      
      // Identify critical paths
      dependencyAnalysis.criticalPaths = this._identifyCriticalPaths(
        dependencyAnalysis.dependencies, dependencyAnalysis.dependents
      );
      
      return {
        dependencies: Object.fromEntries(dependencyAnalysis.dependencies),
        dependents: Object.fromEntries(dependencyAnalysis.dependents),
        circularDependencies: dependencyAnalysis.circularDependencies,
        criticalPaths: dependencyAnalysis.criticalPaths,
        summary: {
          totalDependencies: Array.from(dependencyAnalysis.dependencies.values())
            .reduce((sum, deps) => sum + deps.length, 0),
          totalDependents: Array.from(dependencyAnalysis.dependents.values())
            .reduce((sum, deps) => sum + deps.length, 0),
          circularDependencyCount: dependencyAnalysis.circularDependencies.length,
          criticalPathCount: dependencyAnalysis.criticalPaths.length
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to calculate dependency impact:', error);
      throw error;
    }
  }

  /**
   * Generate change impact report
   * @param {Object} impactAnalysis - Impact analysis result
   * @param {Object} options - Report options
   * @returns {Object} Formatted impact report
   */
  generateImpactReport(impactAnalysis, options = {}) {
    try {
      this.logger.debug('Generating impact report');
      
      const report = {
        executiveSummary: this._generateExecutiveSummary(impactAnalysis),
        detailedAnalysis: {
          changeBreakdown: this._formatChangeBreakdown(impactAnalysis.changes),
          blastRadiusAnalysis: this._formatBlastRadiusAnalysis(impactAnalysis.blastRadius),
          riskAssessment: this._formatRiskAssessment(impactAnalysis.riskAssessment)
        },
        actionItems: this._generateActionItems(impactAnalysis),
        mitigationStrategies: this._generateMitigationStrategies(impactAnalysis),
        validationChecklist: this._generateValidationChecklist(impactAnalysis),
        metadata: {
          reportGenerated: new Date().toISOString(),
          analysisDate: impactAnalysis.metadata.calculatedAt,
          reportOptions: options
        }
      };
      
      if (impactAnalysis.artifactImpact) {
        report.detailedAnalysis.artifactImpact = 
          this._formatArtifactImpact(impactAnalysis.artifactImpact);
      }
      
      return report;
      
    } catch (error) {
      this.logger.error('Failed to generate impact report:', error);
      throw error;
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

  _calculateChanges(originalQuads, modifiedQuads) {
    const originalQuadStrings = new Map(originalQuads.map(q => [this._quadToString(q), q]));
    const modifiedQuadStrings = new Map(modifiedQuads.map(q => [this._quadToString(q), q]));
    
    const added = [];
    const removed = [];
    const changedSubjects = new Set();
    
    // Find added quads
    for (const [quadString, quad] of modifiedQuadStrings) {
      if (!originalQuadStrings.has(quadString)) {
        added.push(quad);
        changedSubjects.add(quad.subject.value);
      }
    }
    
    // Find removed quads
    for (const [quadString, quad] of originalQuadStrings) {
      if (!modifiedQuadStrings.has(quadString)) {
        removed.push(quad);
        changedSubjects.add(quad.subject.value);
      }
    }
    
    return {
      added,
      removed,
      changedSubjects
    };
  }

  _buildGraphRepresentation(quads) {
    const graph = {
      subjects: new Map(),
      predicates: new Map(),
      adjacency: new Map(),
      inverseAdjacency: new Map()
    };
    
    // Build subject and predicate maps
    for (const quad of quads) {
      const subject = quad.subject.value;
      const predicate = quad.predicate.value;
      const object = this._termToValue(quad.object);
      
      // Subject map
      if (!graph.subjects.has(subject)) {
        graph.subjects.set(subject, { properties: new Map(), inDegree: 0, outDegree: 0 });
      }
      const subjectData = graph.subjects.get(subject);
      
      if (!subjectData.properties.has(predicate)) {
        subjectData.properties.set(predicate, []);
      }
      subjectData.properties.get(predicate).push(object);
      subjectData.outDegree++;
      
      // Predicate map
      if (!graph.predicates.has(predicate)) {
        graph.predicates.set(predicate, { subjects: new Set(), objects: new Set(), count: 0 });
      }
      const predicateData = graph.predicates.get(predicate);
      predicateData.subjects.add(subject);
      predicateData.objects.add(object);
      predicateData.count++;
      
      // Adjacency (for traversal)
      if (!graph.adjacency.has(subject)) {
        graph.adjacency.set(subject, new Set());
      }
      if (quad.object.termType === 'NamedNode') {
        graph.adjacency.get(subject).add(object);
        
        // Update in-degree for object if it's a subject
        if (graph.subjects.has(object)) {
          graph.subjects.get(object).inDegree++;
        }
      }
      
      // Inverse adjacency
      if (quad.object.termType === 'NamedNode') {
        if (!graph.inverseAdjacency.has(object)) {
          graph.inverseAdjacency.set(object, new Set());
        }
        graph.inverseAdjacency.get(object).add(subject);
      }
    }
    
    return graph;
  }

  async _calculateBlastRadius(changes, originalGraph, modifiedGraph, options) {
    const maxRadius = options.maxBlastRadius || this.config.maxBlastRadius;
    const blastRadius = {
      affectedSubjects: new Map(),
      impactLevels: new Map(),
      maxRadius: 0
    };
    
    // Initialize with directly changed subjects
    for (const subject of changes.changedSubjects) {
      blastRadius.affectedSubjects.set(subject, {
        subject,
        distance: 0,
        impact: 1.0,
        reason: 'direct_change',
        path: [subject]
      });
      blastRadius.impactLevels.set(0, (blastRadius.impactLevels.get(0) || 0) + 1);
    }
    
    // Propagate impact through graph
    const queue = Array.from(changes.changedSubjects).map(s => ({ subject: s, distance: 0, impact: 1.0, path: [s] }));
    const visited = new Set();
    
    while (queue.length > 0) {
      const current = queue.shift();
      
      if (visited.has(current.subject) || current.distance >= maxRadius) {
        continue;
      }
      
      visited.add(current.subject);
      blastRadius.maxRadius = Math.max(blastRadius.maxRadius, current.distance);
      
      // Find connected subjects
      const connections = this._findConnectedSubjects(current.subject, originalGraph, options);
      
      for (const connection of connections) {
        if (!visited.has(connection.target) && current.distance < maxRadius - 1) {
          const impactDecay = this._calculateImpactDecay(current.distance + 1, connection.weight);
          const newImpact = current.impact * impactDecay;
          
          if (newImpact >= options.impactThreshold) {
            const newPath = [...current.path, connection.target];
            
            blastRadius.affectedSubjects.set(connection.target, {
              subject: connection.target,
              distance: current.distance + 1,
              impact: newImpact,
              reason: connection.reason,
              path: newPath,
              predicate: connection.predicate
            });
            
            const level = current.distance + 1;
            blastRadius.impactLevels.set(level, (blastRadius.impactLevels.get(level) || 0) + 1);
            
            queue.push({
              subject: connection.target,
              distance: current.distance + 1,
              impact: newImpact,
              path: newPath
            });
          }
        }
      }
    }
    
    return {
      affectedSubjects: Object.fromEntries(blastRadius.affectedSubjects),
      impactLevels: Object.fromEntries(blastRadius.impactLevels),
      maxRadius: blastRadius.maxRadius,
      totalAffected: blastRadius.affectedSubjects.size
    };
  }

  async _calculateSubjectBlastRadius(subjectUri, graph, options) {
    const maxRadius = options.maxRadius || this.config.maxBlastRadius;
    const affectedSubjects = [];
    const visited = new Set();
    const queue = [{ subject: subjectUri, distance: 0, path: [subjectUri] }];
    
    while (queue.length > 0) {
      const current = queue.shift();
      
      if (visited.has(current.subject) || current.distance >= maxRadius) {
        continue;
      }
      
      visited.add(current.subject);
      
      if (current.distance > 0) {
        affectedSubjects.push({
          subject: current.subject,
          distance: current.distance,
          path: current.path
        });
      }
      
      // Find connected subjects
      const connections = this._findConnectedSubjects(current.subject, graph, options);
      
      for (const connection of connections) {
        if (!visited.has(connection.target) && current.distance < maxRadius - 1) {
          queue.push({
            subject: connection.target,
            distance: current.distance + 1,
            path: [...current.path, connection.target]
          });
        }
      }
    }
    
    return {
      affectedSubjects,
      radius: Math.max(...affectedSubjects.map(a => a.distance), 0)
    };
  }

  async _analyzeSemanticImpact(changes, originalGraph, modifiedGraph, options) {
    const semanticImpact = {
      ontologyChanges: [],
      hierarchyChanges: [],
      schemaChanges: [],
      instanceChanges: []
    };
    
    // Analyze ontology changes
    const ontologyPredicates = [
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      'http://www.w3.org/2000/01/rdf-schema#subPropertyOf'
    ];
    
    for (const quad of [...changes.added, ...changes.removed]) {
      if (ontologyPredicates.includes(quad.predicate.value)) {
        const changeType = changes.added.includes(quad) ? 'added' : 'removed';
        
        semanticImpact.ontologyChanges.push({
          type: changeType,
          subject: quad.subject.value,
          predicate: quad.predicate.value,
          object: this._termToValue(quad.object),
          impact: this._classifySemanticImpact(quad.predicate.value)
        });
      }
    }
    
    // Analyze hierarchy changes
    semanticImpact.hierarchyChanges = this._analyzeHierarchyChanges(changes, originalGraph, modifiedGraph);
    
    return semanticImpact;
  }

  _calculateArtifactImpact(blastRadiusAnalysis, artifactMappings) {
    const artifactImpact = {
      affected: new Map(),
      summary: {
        totalArtifacts: 0,
        affectedArtifacts: 0,
        highImpactArtifacts: 0
      }
    };
    
    // Map affected subjects to artifacts
    for (const [subject, impactData] of Object.entries(blastRadiusAnalysis.affectedSubjects)) {
      const subjectArtifacts = artifactMappings.subjectToArtifacts[subject];
      
      if (subjectArtifacts) {
        for (const artifact of subjectArtifacts) {
          if (!artifactImpact.affected.has(artifact.id)) {
            artifactImpact.affected.set(artifact.id, {
              artifact,
              impact: 0,
              affectedSubjects: [],
              maxDistance: 0
            });
          }
          
          const artifactData = artifactImpact.affected.get(artifact.id);
          artifactData.impact = Math.max(artifactData.impact, impactData.impact);
          artifactData.affectedSubjects.push(subject);
          artifactData.maxDistance = Math.max(artifactData.maxDistance, impactData.distance);
        }
      }
    }
    
    // Calculate summary
    artifactImpact.summary.affectedArtifacts = artifactImpact.affected.size;
    artifactImpact.summary.highImpactArtifacts = 
      Array.from(artifactImpact.affected.values()).filter(a => a.impact > 0.7).length;
    
    return {
      affected: Object.fromEntries(artifactImpact.affected),
      summary: artifactImpact.summary
    };
  }

  _calculateOverallImpactScore(changes, blastRadiusAnalysis, semanticImpact, options) {
    const scores = {
      scale: this._calculateScaleScore(changes),
      structure: this._calculateStructureScore(changes, semanticImpact),
      connectivity: this._calculateConnectivityScore(blastRadiusAnalysis),
      semantic: this._calculateSemanticScore(semanticImpact)
    };
    
    // Weighted overall score
    const weights = options.impactWeights || {
      scale: 0.2,
      structure: 0.3,
      connectivity: 0.3,
      semantic: 0.2
    };
    
    const overall = Object.entries(scores).reduce((sum, [key, score]) => {
      return sum + (score * weights[key]);
    }, 0);
    
    return {
      overall,
      breakdown: scores,
      weights
    };
  }

  _assessChangeRisk(changes, blastRadiusAnalysis, semanticImpact, options) {
    const riskFactors = {
      scale: this._assessScaleRisk(changes),
      structural: this._assessStructuralRisk(changes),
      semantic: this._assessSemanticRisk(changes),
      connectivity: this._assessConnectivityRisk(changes)
    };
    
    // Calculate overall risk score (0-1)
    const weights = { scale: 0.2, structural: 0.4, semantic: 0.2, connectivity: 0.2 };
    const overallScore = Object.entries(riskFactors).reduce((sum, [key, score]) => {
      return sum + (score * weights[key]);
    }, 0);
    
    // Classify risk level
    let level;
    if (overallScore < 0.3) level = 'low';
    else if (overallScore < 0.6) level = 'medium';
    else if (overallScore < 0.8) level = 'high';
    else level = 'critical';
    
    return {
      level,
      score: overallScore,
      factors: riskFactors
    };
  }

  _generateRecommendations(changes, blastRadiusAnalysis, riskAssessment, options) {
    const recommendations = [];
    
    // Risk-based recommendations
    if (riskAssessment.level === 'high' || riskAssessment.level === 'critical') {
      recommendations.push({
        type: 'validation',
        priority: 'high',
        message: 'Extensive testing required due to high risk level',
        actions: ['Run comprehensive test suite', 'Perform staging validation', 'Consider phased rollout']
      });
    }
    
    // Blast radius recommendations
    if (blastRadiusAnalysis.totalAffected > 10) {
      recommendations.push({
        type: 'impact',
        priority: 'medium',
        message: `Large impact radius affecting ${blastRadiusAnalysis.totalAffected} subjects`,
        actions: ['Review affected components', 'Validate dependent systems', 'Update documentation']
      });
    }
    
    // Change scale recommendations
    if (changes.added.length + changes.removed.length > 100) {
      recommendations.push({
        type: 'process',
        priority: 'medium',
        message: 'Large number of changes detected',
        actions: ['Consider breaking into smaller releases', 'Increase review process', 'Plan rollback strategy']
      });
    }
    
    return recommendations;
  }

  _findConnectedSubjects(subjectUri, graph, options) {
    const connections = [];
    
    // Forward connections (subject as subject)
    const adjacentSubjects = graph.adjacency.get(subjectUri) || new Set();
    for (const target of adjacentSubjects) {
      connections.push({
        target,
        weight: this.impactWeights.directRelations,
        reason: 'forward_relation',
        direction: 'outbound'
      });
    }
    
    // Inverse connections (subject as object)
    if (options.includeInverseRelationships) {
      const inverseSubjects = graph.inverseAdjacency.get(subjectUri) || new Set();
      for (const target of inverseSubjects) {
        connections.push({
          target,
          weight: this.impactWeights.inverseRelations,
          reason: 'inverse_relation',
          direction: 'inbound'
        });
      }
    }
    
    return connections;
  }

  _calculateImpactDecay(distance, weight) {
    // Exponential decay with weight modifier
    return weight * Math.pow(0.7, distance - 1);
  }

  _classifySemanticImpact(predicate) {
    const impactLevels = {
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': 'high',
      'http://www.w3.org/2000/01/rdf-schema#subClassOf': 'high',
      'http://www.w3.org/2000/01/rdf-schema#subPropertyOf': 'high',
      'http://www.w3.org/2000/01/rdf-schema#domain': 'medium',
      'http://www.w3.org/2000/01/rdf-schema#range': 'medium'
    };
    
    return impactLevels[predicate] || 'low';
  }

  _analyzeHierarchyChanges(changes, originalGraph, modifiedGraph) {
    const hierarchyChanges = [];
    
    const hierarchyPredicates = [
      'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      'http://www.w3.org/2000/01/rdf-schema#subPropertyOf'
    ];
    
    for (const quad of [...changes.added, ...changes.removed]) {
      if (hierarchyPredicates.includes(quad.predicate.value)) {
        hierarchyChanges.push({
          type: changes.added.includes(quad) ? 'hierarchy_added' : 'hierarchy_removed',
          child: quad.subject.value,
          parent: quad.object.value,
          predicate: quad.predicate.value
        });
      }
    }
    
    return hierarchyChanges;
  }

  _calculateScaleScore(changes) {
    const totalChanges = changes.added.length + changes.removed.length;
    
    if (totalChanges < 10) return 0.1;
    if (totalChanges < 50) return 0.3;
    if (totalChanges < 100) return 0.6;
    if (totalChanges < 500) return 0.8;
    return 1.0;
  }

  _calculateStructureScore(changes, semanticImpact) {
    if (!semanticImpact) return 0.2;
    
    const ontologyChanges = semanticImpact.ontologyChanges?.length || 0;
    const hierarchyChanges = semanticImpact.hierarchyChanges?.length || 0;
    
    const structuralChanges = ontologyChanges + hierarchyChanges;
    
    if (structuralChanges === 0) return 0.1;
    if (structuralChanges < 5) return 0.4;
    if (structuralChanges < 10) return 0.7;
    return 1.0;
  }

  _calculateConnectivityScore(blastRadiusAnalysis) {
    const totalAffected = blastRadiusAnalysis.totalAffected || 0;
    const maxRadius = blastRadiusAnalysis.maxRadius || 0;
    
    const connectivityScore = (totalAffected / 100) + (maxRadius / 10);
    return Math.min(connectivityScore, 1.0);
  }

  _calculateSemanticScore(semanticImpact) {
    if (!semanticImpact) return 0.1;
    
    const ontologyChanges = semanticImpact.ontologyChanges?.length || 0;
    const highImpactChanges = semanticImpact.ontologyChanges?.filter(c => c.impact === 'high').length || 0;
    
    const semanticScore = (ontologyChanges / 20) + (highImpactChanges / 10);
    return Math.min(semanticScore, 1.0);
  }

  _assessScaleRisk(changes) {
    const totalChanges = changes.added.length + changes.removed.length;
    return Math.min(totalChanges / 100, 1.0);
  }

  _assessStructuralRisk(changes) {
    const structuralPredicates = [
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      'http://www.w3.org/2000/01/rdf-schema#subPropertyOf'
    ];
    
    const structuralChanges = [...changes.added, ...changes.removed]
      .filter(quad => structuralPredicates.includes(quad.predicate.value)).length;
    
    return Math.min(structuralChanges / 10, 1.0);
  }

  _assessSemanticRisk(changes) {
    // Count changes to semantic elements (classes, properties, ontology structure)
    const semanticPredicates = [
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'http://www.w3.org/2000/01/rdf-schema#domain',
      'http://www.w3.org/2000/01/rdf-schema#range'
    ];
    
    const semanticChanges = [...changes.added, ...changes.removed]
      .filter(quad => semanticPredicates.includes(quad.predicate.value)).length;
    
    return Math.min(semanticChanges / 15, 1.0);
  }

  _assessConnectivityRisk(changes) {
    // This would require analyzing graph connectivity
    // For now, return a basic assessment based on changed subjects
    return Math.min(changes.changedSubjects.size / 20, 1.0);
  }

  _calculateOverallRisk(riskFactors, options) {
    const weights = {
      structural: 0.4,
      scale: 0.2,
      semantic: 0.2,
      connectivity: 0.2,
      ...options.riskWeights
    };
    
    const score = Object.entries(riskFactors).reduce((sum, [key, factor]) => {
      return sum + (factor * weights[key]);
    }, 0);
    
    let level;
    if (score < 0.3) level = 'low';
    else if (score < 0.6) level = 'medium';
    else if (score < 0.8) level = 'high';
    else level = 'critical';
    
    return { level, score };
  }

  _generateRiskRecommendations(riskFactors, overallRisk) {
    const recommendations = [];
    
    if (riskFactors.structural > 0.7) {
      recommendations.push('Review structural changes for ontology consistency');
    }
    
    if (riskFactors.scale > 0.7) {
      recommendations.push('Consider breaking large changes into smaller batches');
    }
    
    if (riskFactors.semantic > 0.7) {
      recommendations.push('Validate semantic integrity after changes');
    }
    
    if (overallRisk.level === 'critical') {
      recommendations.push('Critical risk detected - consider rollback plan');
    }
    
    return recommendations;
  }

  _findDependencies(subjectUri, graph, options) {
    // Find what this subject depends on
    const dependencies = [];
    const subjectData = graph.subjects.get(subjectUri);
    
    if (subjectData) {
      for (const [predicate, objects] of subjectData.properties) {
        for (const object of objects) {
          if (graph.subjects.has(object)) {
            dependencies.push({
              target: object,
              predicate,
              type: 'property_dependency'
            });
          }
        }
      }
    }
    
    return dependencies;
  }

  _findDependents(subjectUri, graph, options) {
    // Find what depends on this subject
    const dependents = [];
    const inverseConnections = graph.inverseAdjacency.get(subjectUri) || new Set();
    
    for (const dependent of inverseConnections) {
      dependents.push({
        target: dependent,
        type: 'inverse_dependency'
      });
    }
    
    return dependents;
  }

  _detectCircularDependencies(dependencies) {
    const visited = new Set();
    const path = new Set();
    const circularDeps = [];
    
    const dfs = (subject, currentPath) => {
      if (path.has(subject)) {
        // Found cycle
        const cycleStart = currentPath.indexOf(subject);
        circularDeps.push(currentPath.slice(cycleStart));
        return;
      }
      
      if (visited.has(subject)) return;
      
      visited.add(subject);
      path.add(subject);
      currentPath.push(subject);
      
      const subjectDeps = dependencies.get(subject) || [];
      for (const dep of subjectDeps) {
        dfs(dep.target, [...currentPath]);
      }
      
      path.delete(subject);
      currentPath.pop();
    };
    
    for (const subject of dependencies.keys()) {
      if (!visited.has(subject)) {
        dfs(subject, []);
      }
    }
    
    return circularDeps;
  }

  _identifyCriticalPaths(dependencies, dependents) {
    const criticalPaths = [];
    
    // Find subjects with high connectivity (many dependents)
    for (const [subject, deps] of dependents) {
      if (deps.length > 5) {  // Threshold for "critical"
        criticalPaths.push({
          subject,
          dependentCount: deps.length,
          type: 'high_dependency_subject'
        });
      }
    }
    
    return criticalPaths;
  }

  _generateExecutiveSummary(impactAnalysis) {
    const summary = {
      riskLevel: impactAnalysis.riskAssessment.level,
      impactScore: Math.round(impactAnalysis.impactScore.overall * 100) / 100,
      totalChanges: impactAnalysis.summary.totalChanges,
      affectedSubjects: impactAnalysis.summary.changedSubjects,
      blastRadius: impactAnalysis.summary.impactRadius,
      keyFindings: []
    };
    
    // Generate key findings
    if (summary.riskLevel === 'high' || summary.riskLevel === 'critical') {
      summary.keyFindings.push(`High risk level (${summary.riskLevel}) detected`);
    }
    
    if (summary.blastRadius > 3) {
      summary.keyFindings.push(`Wide impact radius (${summary.blastRadius} levels) identified`);
    }
    
    if (summary.totalChanges > 100) {
      summary.keyFindings.push(`Large scale change (${summary.totalChanges} modifications)`);
    }
    
    return summary;
  }

  _formatChangeBreakdown(changes) {
    return {
      added: changes.added.length,
      removed: changes.removed.length,
      changedSubjects: changes.changedSubjects.size,
      details: {
        addedTriples: changes.added.map(q => this._quadToString(q)).slice(0, 10),
        removedTriples: changes.removed.map(q => this._quadToString(q)).slice(0, 10),
        moreAvailable: (changes.added.length + changes.removed.length) > 20
      }
    };
  }

  _formatBlastRadiusAnalysis(blastRadius) {
    return {
      maxRadius: blastRadius.maxRadius,
      totalAffected: blastRadius.totalAffected,
      impactDistribution: blastRadius.impactLevels,
      highestImpactSubjects: Object.values(blastRadius.affectedSubjects)
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 10)
        .map(s => ({ subject: s.subject, impact: s.impact, distance: s.distance }))
    };
  }

  _formatRiskAssessment(riskAssessment) {
    return {
      level: riskAssessment.level,
      score: Math.round(riskAssessment.score * 100) / 100,
      factors: riskAssessment.factors,
      recommendations: riskAssessment.recommendations || []
    };
  }

  _formatArtifactImpact(artifactImpact) {
    return {
      summary: artifactImpact.summary,
      affectedArtifacts: Object.entries(artifactImpact.affected)
        .sort(([,a], [,b]) => b.impact - a.impact)
        .slice(0, 20)
        .map(([id, data]) => ({
          id,
          name: data.artifact.name,
          impact: Math.round(data.impact * 100) / 100,
          affectedSubjectCount: data.affectedSubjects.length,
          maxDistance: data.maxDistance
        }))
    };
  }

  _generateActionItems(impactAnalysis) {
    const actionItems = [];
    
    if (impactAnalysis.riskAssessment.level === 'high' || impactAnalysis.riskAssessment.level === 'critical') {
      actionItems.push({
        priority: 'high',
        action: 'Conduct thorough testing',
        description: 'High risk changes require comprehensive validation'
      });
    }
    
    if (impactAnalysis.summary.impactRadius > 2) {
      actionItems.push({
        priority: 'medium',
        action: 'Review affected components',
        description: 'Validate all components within the blast radius'
      });
    }
    
    return actionItems;
  }

  _generateMitigationStrategies(impactAnalysis) {
    const strategies = [];
    
    if (impactAnalysis.riskAssessment.level === 'critical') {
      strategies.push({
        strategy: 'Phased Rollout',
        description: 'Deploy changes in phases to minimize risk'
      });
    }
    
    if (impactAnalysis.blastRadius.totalAffected > 10) {
      strategies.push({
        strategy: 'Canary Deployment',
        description: 'Test with limited subset before full deployment'
      });
    }
    
    return strategies;
  }

  _generateValidationChecklist(impactAnalysis) {
    const checklist = [
      'Validate all affected subjects are functioning correctly',
      'Confirm no unintended side effects in dependent systems',
      'Verify semantic consistency is maintained'
    ];
    
    if (impactAnalysis.artifactImpact) {
      checklist.push('Test all affected artifacts for proper functionality');
    }
    
    return checklist;
  }

  _termToValue(term) {
    return term.value;
  }

  _quadToString(quad) {
    const subject = quad.subject.value;
    const predicate = quad.predicate.value;
    const object = this._termToValue(quad.object);
    
    return `${subject} ${predicate} ${object}`;
  }
}

export default ImpactCalculator;