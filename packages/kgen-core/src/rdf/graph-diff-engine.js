/**
 * Advanced Graph Diff Engine for KGEN Knowledge Compilation
 * 
 * Provides sophisticated diff analysis with:
 * - Semantic change detection
 * - Subject impact analysis  
 * - Artifact mapping
 * - Change risk assessment
 */

import { consola } from 'consola';
import { createHash } from 'crypto';
import fs from 'fs/promises';

export class GraphDiffEngine {
  constructor(options = {}) {
    this.logger = consola.withTag('graph-diff');
    this.options = {
      maxTriplesToAnalyze: options.maxTriplesToAnalyze || 10000,
      enableSubjectIndex: options.enableSubjectIndex !== false,
      enableArtifactMapping: options.enableArtifactMapping !== false,
      ...options
    };
    
    // Subject to artifact mapping index
    this.subjectIndex = new Map();
    this.artifactMappers = new Map();
    
    this.stats = {
      diffsCalculated: 0,
      subjectsAnalyzed: 0,
      artifactsMapped: 0
    };
  }

  /**
   * Calculate comprehensive diff between two graph processors
   * @param {GraphProcessor} baseGraph - Original graph
   * @param {GraphProcessor} targetGraph - Modified graph
   * @param {Object} options - Diff options
   * @returns {Promise<Object>} Detailed diff result
   */
  async calculateDiff(baseGraph, targetGraph, options = {}) {
    try {
      const startTime = Date.now();
      this.logger.debug('Calculating graph diff with impact analysis');
      
      // Get canonical N-Triples representations
      const baseTriples = new Set(baseGraph._toCanonicalNTriples(baseGraph.store.getQuads()));
      const targetTriples = new Set(targetGraph._toCanonicalNTriples(targetGraph.store.getQuads()));
      
      // Calculate basic changes
      const added = [...targetTriples].filter(t => !baseTriples.has(t));
      const removed = [...baseTriples].filter(t => !targetTriples.has(t));
      const unchanged = [...baseTriples].filter(t => targetTriples.has(t));
      
      // Analyze impacted subjects
      const impactedSubjects = await this._analyzeImpactedSubjects(added, removed);
      
      // Calculate artifact impact
      const artifactImpact = await this._calculateArtifactImpact(impactedSubjects, options);
      
      // Assess change risk
      const riskAssessment = await this._assessChangeRisk(added, removed, impactedSubjects);
      
      // Build comprehensive diff result
      const diff = {
        id: `diff_${Date.now()}`,
        timestamp: new Date().toISOString(),
        calculationTime: Date.now() - startTime,
        
        // Graph metadata
        metadata: {
          baseGraph: {
            id: baseGraph.id || 'unknown',
            hash: baseGraph.calculateContentHash(),
            size: baseTriples.size
          },
          targetGraph: {
            id: targetGraph.id || 'unknown', 
            hash: targetGraph.calculateContentHash(),
            size: targetTriples.size
          }
        },
        
        // Change statistics
        changes: {
          added: added.length,
          removed: removed.length,
          modified: 0, // TODO: Implement modification detection
          unchanged: unchanged.length,
          total: added.length + removed.length,
          netChange: targetTriples.size - baseTriples.size
        },
        
        // Change metrics
        metrics: {
          changePercentage: baseTriples.size > 0 ? 
            ((added.length + removed.length) / baseTriples.size) * 100 : 0,
          stability: unchanged.length / Math.max(baseTriples.size, targetTriples.size),
          growthRate: baseTriples.size > 0 ? 
            ((targetTriples.size - baseTriples.size) / baseTriples.size) * 100 : 0
        },
        
        // Detailed triple data (limited for performance)
        triples: options.includeTriples !== false ? {
          added: added.slice(0, options.maxTriples || 100),
          removed: removed.slice(0, options.maxTriples || 100),
          addedCount: added.length,
          removedCount: removed.length,
          truncated: added.length > (options.maxTriples || 100) || 
                    removed.length > (options.maxTriples || 100)
        } : null,
        
        // Impact analysis
        impact: {
          subjects: {
            impacted: Array.from(impactedSubjects),
            total: impactedSubjects.size
          },
          artifacts: artifactImpact,
          risk: riskAssessment
        }
      };
      
      this.stats.diffsCalculated++;
      this.logger.success(`Diff calculated in ${diff.calculationTime}ms: ${diff.changes.total} changes`);
      
      return diff;
      
    } catch (error) {
      this.logger.error('Failed to calculate graph diff:', error);
      throw error;
    }
  }

  /**
   * Register artifact mapper for specific subject patterns
   * @param {string} pattern - Subject pattern (regex or URI prefix)
   * @param {Function} mapper - Mapping function (subject, graph) => artifacts[]
   */
  registerArtifactMapper(pattern, mapper) {
    this.artifactMappers.set(pattern, mapper);
    this.logger.debug(`Registered artifact mapper for pattern: ${pattern}`);
  }

  /**
   * Build subject-to-artifact index from multiple graphs
   * @param {Array<GraphProcessor>} graphs - Graphs to index
   * @returns {Promise<Map>} Subject index
   */
  async buildSubjectIndex(graphs) {
    try {
      this.logger.info(`Building subject index for ${graphs.length} graphs`);
      
      const index = new Map();
      
      for (const graph of graphs) {
        const subjects = graph.getSubjects();
        
        for (const subject of subjects) {
          const subjectUri = subject.value;
          
          if (!index.has(subjectUri)) {
            index.set(subjectUri, new Set());
          }
          
          // Apply registered artifact mappers
          const artifacts = await this._mapSubjectToArtifacts(subjectUri, graph);
          
          for (const artifact of artifacts) {
            index.get(subjectUri).add(artifact);
          }
        }
      }
      
      // Convert sets to arrays for serialization
      this.subjectIndex = new Map();
      for (const [subject, artifacts] of index) {
        this.subjectIndex.set(subject, Array.from(artifacts));
      }
      
      this.stats.subjectsAnalyzed = index.size;
      this.stats.artifactsMapped = Array.from(this.subjectIndex.values())
        .reduce((sum, artifacts) => sum + artifacts.length, 0);
      
      this.logger.success(`Subject index built: ${this.subjectIndex.size} subjects`);
      return this.subjectIndex;
      
    } catch (error) {
      this.logger.error('Failed to build subject index:', error);
      throw error;
    }
  }

  /**
   * Save subject index to file
   * @param {string} filePath - Path to save index
   */
  async saveSubjectIndex(filePath) {
    try {
      const data = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        subjects: Object.fromEntries(this.subjectIndex),
        stats: {
          totalSubjects: this.subjectIndex.size,
          totalMappings: this.stats.artifactsMapped
        }
      };
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      this.logger.info(`Subject index saved to: ${filePath}`);
      
    } catch (error) {
      this.logger.error('Failed to save subject index:', error);
      throw error;
    }
  }

  /**
   * Load subject index from file
   * @param {string} filePath - Path to load index from
   */
  async loadSubjectIndex(filePath) {
    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      
      this.subjectIndex = new Map(Object.entries(data.subjects));
      this.logger.info(`Subject index loaded: ${this.subjectIndex.size} subjects`);
      
    } catch (error) {
      this.logger.error('Failed to load subject index:', error);
      throw error;
    }
  }

  /**
   * Get processing statistics
   * @returns {Object} Processing stats
   */
  getStats() {
    return {
      ...this.stats,
      indexStats: {
        subjects: this.subjectIndex.size,
        totalMappings: this.stats.artifactsMapped,
        registeredMappers: this.artifactMappers.size
      }
    };
  }

  // Private methods

  async _analyzeImpactedSubjects(addedTriples, removedTriples) {
    const subjects = new Set();
    
    const extractSubject = (triple) => {
      const match = triple.match(/^(<[^>]+>|_:[^\s]+)/);
      return match ? match[1] : null;
    };
    
    // Extract subjects from added triples
    for (const triple of addedTriples) {
      const subject = extractSubject(triple);
      if (subject) {
        subjects.add(subject);
      }
    }
    
    // Extract subjects from removed triples
    for (const triple of removedTriples) {
      const subject = extractSubject(triple);
      if (subject) {
        subjects.add(subject);
      }
    }
    
    return subjects;
  }

  async _calculateArtifactImpact(impactedSubjects, options = {}) {
    const impact = {
      artifacts: [],
      estimatedRebuildRequired: false,
      riskLevel: 'low'
    };
    
    if (!this.options.enableArtifactMapping) {
      return impact;
    }
    
    const affectedArtifacts = new Set();
    
    // Map subjects to artifacts using the index
    for (const subject of impactedSubjects) {
      if (this.subjectIndex.has(subject)) {
        for (const artifact of this.subjectIndex.get(subject)) {
          affectedArtifacts.add(artifact);
        }
      }
    }
    
    impact.artifacts = Array.from(affectedArtifacts);
    impact.estimatedRebuildRequired = impact.artifacts.length > 0;
    
    // Calculate risk level based on number of affected artifacts
    if (impact.artifacts.length > 20) {
      impact.riskLevel = 'high';
    } else if (impact.artifacts.length > 5) {
      impact.riskLevel = 'medium';
    }
    
    return impact;
  }

  async _assessChangeRisk(addedTriples, removedTriples, impactedSubjects) {
    const assessment = {
      level: 'low',
      factors: [],
      score: 0,
      recommendations: []
    };
    
    let riskScore = 0;
    
    // High number of changes
    if (addedTriples.length + removedTriples.length > 100) {
      riskScore += 3;
      assessment.factors.push('high_change_volume');
    }
    
    // Many subjects impacted
    if (impactedSubjects.size > 50) {
      riskScore += 2;
      assessment.factors.push('many_subjects_impacted');
    }
    
    // More removals than additions (potential data loss)
    if (removedTriples.length > addedTriples.length * 2) {
      riskScore += 2;
      assessment.factors.push('potential_data_loss');
    }
    
    // Core ontology changes (detect by common prefixes)
    const corePatterns = ['rdf:', 'rdfs:', 'owl:', 'xsd:'];
    const hasCoreChanges = [...addedTriples, ...removedTriples]
      .some(triple => corePatterns.some(pattern => triple.includes(pattern)));
    
    if (hasCoreChanges) {
      riskScore += 4;
      assessment.factors.push('core_ontology_changes');
    }
    
    // Determine risk level
    assessment.score = riskScore;
    if (riskScore >= 6) {
      assessment.level = 'high';
      assessment.recommendations.push('Full regression testing recommended');
      assessment.recommendations.push('Review changes with stakeholders');
    } else if (riskScore >= 3) {
      assessment.level = 'medium';
      assessment.recommendations.push('Integration testing recommended');
      assessment.recommendations.push('Backup current state before deployment');
    } else {
      assessment.recommendations.push('Standard testing procedures sufficient');
    }
    
    return assessment;
  }

  async _mapSubjectToArtifacts(subjectUri, graph) {
    const artifacts = [];
    
    // Apply registered mappers
    for (const [pattern, mapper] of this.artifactMappers) {
      try {
        if (this._matchesPattern(subjectUri, pattern)) {
          const mappedArtifacts = await mapper(subjectUri, graph);
          if (Array.isArray(mappedArtifacts)) {
            artifacts.push(...mappedArtifacts);
          }
        }
      } catch (error) {
        this.logger.warn(`Mapper failed for pattern ${pattern}:`, error);
      }
    }
    
    // Default mapping if no custom mappers matched
    if (artifacts.length === 0) {
      artifacts.push(...this._defaultArtifactMapping(subjectUri));
    }
    
    return artifacts;
  }

  _matchesPattern(subject, pattern) {
    if (typeof pattern === 'string') {
      // Simple prefix matching
      return subject.startsWith(pattern);
    } else if (pattern instanceof RegExp) {
      // Regex matching
      return pattern.test(subject);
    }
    return false;
  }

  _defaultArtifactMapping(subjectUri) {
    const artifacts = [];
    
    try {
      // Remove angle brackets if present
      const cleanUri = subjectUri.replace(/^<|>$/g, '');
      const url = new URL(cleanUri);
      const pathParts = url.pathname.split('/').filter(p => p);
      
      if (pathParts.length > 0) {
        // Generate potential artifact paths based on URI structure
        const baseName = pathParts[pathParts.length - 1];
        const pathPrefix = pathParts.slice(0, -1).join('/');
        
        artifacts.push(`src/${pathPrefix}/${baseName}.js`);
        artifacts.push(`src/${pathPrefix}/${baseName}.ts`);
        artifacts.push(`templates/${pathPrefix}/${baseName}.njk`);
        artifacts.push(`docs/${pathPrefix}/${baseName}.md`);
      }
    } catch {
      // If URI parsing fails, create hash-based mapping
      const hash = createHash('md5').update(subjectUri).digest('hex').substring(0, 8);
      artifacts.push(`generated/${hash}.js`);
    }
    
    return artifacts;
  }
}

export default GraphDiffEngine;