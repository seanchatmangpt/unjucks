/**
 * Semantic Drift Analyzer - Enhanced drift detection with semantic analysis
 * 
 * Provides semantic-aware drift detection that distinguishes between:
 * - Cosmetic changes (formatting, comments, ordering)
 * - Semantic changes (meaningful structural or logical changes)
 * 
 * Features:
 * - RDF graph diffing for semantic comparison
 * - SHACL-based significance analysis
 * - Git integration for change tracking
 * - CI/CD exit codes (0/1/2/3)
 * - Performance optimization with CAS
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Store, Parser, Writer, DataFactory } from 'n3';
// SHACL validation is optional - will be loaded dynamically

const { namedNode, literal, defaultGraph, quad } = DataFactory;

export class SemanticDriftAnalyzer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Thresholds for semantic drift detection
      semanticThreshold: config.semanticThreshold || 0.1, // 10% semantic change threshold
      truePositiveThreshold: config.truePositiveThreshold || 0.9, // ≥90% true positive SNR
      
      // Analysis modes
      enableSemanticAnalysis: config.enableSemanticAnalysis !== false,
      enableSHACLValidation: config.enableSHACLValidation !== false,
      enableGitIntegration: config.enableGitIntegration !== false,
      
      // Performance options
      enableCAS: config.enableCAS !== false,
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB limit
      analysisTimeout: config.analysisTimeout || 30000, // 30s timeout
      
      // Exit codes
      exitCodes: {
        noChange: 0,
        nonSemanticChange: 1,
        analysisError: 2,
        semanticDrift: 3
      },
      
      ...config
    };
    
    this.logger = consola.withTag('semantic-drift');
    this.store = new Store();
    this.parser = new Parser();
    this.shaclValidator = null;
    this.casCache = new Map();
    
    // Performance tracking
    this.metrics = {
      totalAnalyses: 0,
      semanticDriftsDetected: 0,
      falsePositives: 0,
      truePositives: 0,
      analysisTime: 0
    };
  }

  /**
   * Initialize the analyzer with SHACL shapes for semantic significance
   */
  async initialize() {
    try {
      this.logger.info('Initializing Semantic Drift Analyzer...');
      
      // Load SHACL shapes for semantic drift detection
      await this.loadSemanticSignificanceShapes();
      
      this.logger.success('Semantic Drift Analyzer initialized');
      return { status: 'success', config: this.config };
    } catch (error) {
      this.logger.error('Failed to initialize Semantic Drift Analyzer:', error);
      throw error;
    }
  }

  /**
   * Analyze semantic drift between current and expected states
   */
  async analyzeSemanticDrift(artifactPath, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    this.metrics.totalAnalyses++;
    
    try {
      const analysis = {
        artifact: {
          path: artifactPath,
          name: path.basename(artifactPath)
        },
        drift: {
          detected: false,
          type: 'none', // none, cosmetic, semantic
          significance: 0.0, // 0-1 score
          reasons: [],
          changes: []
        },
        git: {
          enabled: this.config.enableGitIntegration,
          changes: []
        },
        semantic: {
          enabled: this.config.enableSemanticAnalysis,
          graphDiff: null,
          shaclViolations: []
        },
        performance: {
          casHit: false,
          analysisTime: 0
        },
        exitCode: this.config.exitCodes.noChange,
        timestamp: this.getDeterministicDate().toISOString()
      };

      // Check file existence and size
      const stats = await fs.stat(artifactPath);
      if (stats.size > this.config.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${this.config.maxFileSize})`);
      }

      // CAS optimization - check if file content has changed
      if (this.config.enableCAS) {
        const casResult = await this.checkCASCache(artifactPath);
        if (casResult.hit) {
          analysis.performance.casHit = true;
          analysis.exitCode = this.config.exitCodes.noChange;
          this.logger.info(`CAS hit: no changes detected in ${artifactPath}`);
          return analysis;
        }
      }

      // Git-based change detection
      if (this.config.enableGitIntegration) {
        analysis.git.changes = await this.getGitChanges(artifactPath);
        if (analysis.git.changes.length === 0) {
          analysis.exitCode = this.config.exitCodes.noChange;
          return analysis;
        }
      }

      // Load baseline and current content
      const { baseline, current } = await this.loadArtifactVersions(artifactPath, options);
      
      if (this.config.enableGitIntegration || options.baseline) {
        this.logger.debug(`Loaded baseline: ${baseline ? baseline.length + ' chars' : 'null'}`);
        this.logger.debug(`Loaded current: ${current ? current.length + ' chars' : 'null'}`);
      }
      
      if (!baseline) {
        analysis.drift.reasons.push('No baseline available for comparison');
        analysis.exitCode = this.config.exitCodes.analysisError;
        return analysis;
      }

      // Detect file format and perform appropriate analysis
      const format = this.detectFormat(artifactPath);
      
      if (this.isSemanticFormat(format)) {
        // Semantic analysis for RDF/structured formats
        const semanticResult = await this.performSemanticAnalysis(baseline, current, format);
        analysis.semantic.graphDiff = semanticResult;
        
        if (semanticResult.significance > this.config.semanticThreshold) {
          analysis.drift.detected = true;
          analysis.drift.type = 'semantic';
          analysis.drift.significance = semanticResult.significance;
          analysis.drift.reasons.push(...semanticResult.reasons);
          analysis.drift.changes = semanticResult.changes;
          analysis.exitCode = this.config.exitCodes.semanticDrift;
          
          this.metrics.semanticDriftsDetected++;
          this.logger.warn(`Semantic drift detected: ${semanticResult.significance.toFixed(3)} significance`);
        } else if (semanticResult.hasChanges) {
          // Non-semantic changes (cosmetic)
          analysis.drift.detected = true;
          analysis.drift.type = 'cosmetic';
          analysis.drift.significance = semanticResult.significance;
          analysis.drift.reasons.push('Cosmetic changes detected');
          analysis.exitCode = this.config.exitCodes.nonSemanticChange;
        }

        // SHACL validation for constraint violations
        if (this.config.enableSHACLValidation && this.shaclValidator) {
          analysis.semantic.shaclViolations = await this.validateSemanticConstraints(
            current, 
            semanticResult.changes
          );
          
          if (analysis.semantic.shaclViolations.length > 0) {
            analysis.drift.detected = true;
            analysis.drift.type = 'semantic';
            analysis.exitCode = this.config.exitCodes.semanticDrift;
          }
        }
      } else {
        // Text-based structural analysis for non-RDF files
        const structuralResult = await this.performStructuralAnalysis(baseline, current);
        
        if (structuralResult.significance > this.config.semanticThreshold) {
          analysis.drift.detected = true;
          analysis.drift.type = 'structural';
          analysis.drift.significance = structuralResult.significance;
          analysis.drift.reasons.push(...structuralResult.reasons);
          analysis.exitCode = this.config.exitCodes.semanticDrift;
        } else if (structuralResult.hasChanges) {
          // Non-structural changes (cosmetic)
          analysis.drift.detected = true;
          analysis.drift.type = 'cosmetic';
          analysis.drift.significance = structuralResult.significance;
          analysis.drift.reasons.push('Cosmetic changes detected');
          analysis.exitCode = this.config.exitCodes.nonSemanticChange;
        }
      }

      // Update performance metrics
      analysis.performance.analysisTime = this.getDeterministicTimestamp() - startTime;
      this.metrics.analysisTime += analysis.performance.analysisTime;
      
      // Update CAS cache
      if (this.config.enableCAS) {
        await this.updateCASCache(artifactPath, current);
      }

      return analysis;

    } catch (error) {
      this.logger.error(`Semantic drift analysis failed for ${artifactPath}:`, error);
      
      return {
        artifact: { path: artifactPath, name: path.basename(artifactPath) },
        drift: { detected: false, type: 'error', reasons: [error.message] },
        error: error.message,
        exitCode: this.config.exitCodes.analysisError,
        timestamp: this.getDeterministicDate().toISOString()
      };
    }
  }

  /**
   * Perform semantic analysis on RDF/structured content
   */
  async performSemanticAnalysis(baseline, current, format) {
    try {
      // Parse both versions as RDF
      const baselineQuads = await this.parseRDF(baseline, format);
      const currentQuads = await this.parseRDF(current, format);

      // Perform graph diff
      const graphDiff = this.compareRDFGraphs(baselineQuads, currentQuads);
      
      // Calculate semantic significance
      const significance = this.calculateSemanticSignificance(graphDiff);
      
      // Analyze types of changes
      const changes = this.categorizeSemanticChanges(graphDiff);
      
      // Generate reasons for changes
      const reasons = this.generateChangeReasons(changes);

      return {
        hasChanges: graphDiff.added.length > 0 || graphDiff.removed.length > 0,
        significance,
        changes,
        reasons,
        graphDiff,
        baseline: { tripleCount: baselineQuads.length },
        current: { tripleCount: currentQuads.length }
      };
    } catch (error) {
      this.logger.error('Semantic analysis failed:', error);
      return {
        hasChanges: true,
        significance: 1.0, // Assume significant if we can't analyze
        changes: [{ type: 'parse_error', description: error.message }],
        reasons: [`Parse error: ${error.message}`],
        error: error.message
      };
    }
  }

  /**
   * Perform structural analysis on non-RDF content
   */
  async performStructuralAnalysis(baseline, current) {
    const changes = {
      lineChanges: 0,
      structuralChanges: 0,
      semanticChanges: 0,
      variableChanges: 0,
      valueChanges: 0
    };

    const baselineLines = baseline.split('\n');
    const currentLines = current.split('\n');
    
    // Simple line-based diff
    const maxLines = Math.max(baselineLines.length, currentLines.length);
    let significantChanges = 0;
    
    for (let i = 0; i < maxLines; i++) {
      const baselineLine = baselineLines[i] || '';
      const currentLine = currentLines[i] || '';
      
      if (baselineLine !== currentLine) {
        changes.lineChanges++;
        
        // Heuristics for different types of changes
        if (this.isStructuralChange(baselineLine, currentLine)) {
          changes.structuralChanges++;
          significantChanges += 2; // Structural changes are very significant
        } else if (this.isVariableChange(baselineLine, currentLine)) {
          changes.variableChanges++;
          significantChanges += 1.5; // Variable changes are highly significant
        } else if (this.isValueChange(baselineLine, currentLine)) {
          changes.valueChanges++;
          significantChanges += 1; // Value changes are moderately significant
        } else if (this.isSemanticChange(baselineLine, currentLine)) {
          changes.semanticChanges++;
          significantChanges += 0.8; // Other semantic changes
        }
      }
    }

    const significance = Math.min(significantChanges / Math.max(baselineLines.length * 2, 1), 1.0);
    
    const reasons = [];
    if (changes.structuralChanges > 0) reasons.push(`Structural changes: ${changes.structuralChanges}`);
    if (changes.variableChanges > 0) reasons.push(`Variable changes: ${changes.variableChanges}`);
    if (changes.valueChanges > 0) reasons.push(`Value changes: ${changes.valueChanges}`);
    if (changes.semanticChanges > 0) reasons.push(`Semantic changes: ${changes.semanticChanges}`);
    if (reasons.length === 0 && changes.lineChanges > 0) reasons.push('Minor formatting changes');
    
    return {
      hasChanges: changes.lineChanges > 0,
      significance,
      changes: [changes],
      reasons
    };
  }

  /**
   * Compare RDF graphs and return differences
   */
  compareRDFGraphs(baselineQuads, currentQuads) {
    const baselineSet = new Set(baselineQuads.map(q => this.quadToString(q)));
    const currentSet = new Set(currentQuads.map(q => this.quadToString(q)));

    const added = currentQuads.filter(q => !baselineSet.has(this.quadToString(q)));
    const removed = baselineQuads.filter(q => !currentSet.has(this.quadToString(q)));
    const common = baselineQuads.filter(q => currentSet.has(this.quadToString(q)));

    return {
      added,
      removed,
      common: common.length,
      identical: added.length === 0 && removed.length === 0
    };
  }

  /**
   * Calculate semantic significance of changes
   */
  calculateSemanticSignificance(graphDiff) {
    if (graphDiff.identical) return 0.0;

    const totalChanges = graphDiff.added.length + graphDiff.removed.length;
    const totalTriples = graphDiff.common + totalChanges;
    
    if (totalTriples === 0) return 0.0;

    // Weight changes by semantic importance
    let weightedChanges = 0;
    
    // Analyze added triples
    for (const quad of graphDiff.added) {
      weightedChanges += this.getTripleWeight(quad);
    }
    
    // Analyze removed triples  
    for (const quad of graphDiff.removed) {
      weightedChanges += this.getTripleWeight(quad);
    }

    return Math.min(weightedChanges / totalTriples, 1.0);
  }

  /**
   * Get semantic weight of a triple
   */
  getTripleWeight(quad) {
    const predicate = quad.predicate.value;
    
    // High importance predicates
    const highImportance = [
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      'http://www.w3.org/2002/07/owl#sameAs',
      'http://www.w3.org/2002/07/owl#equivalentClass'
    ];
    
    // Medium importance predicates
    const mediumImportance = [
      'http://www.w3.org/2000/01/rdf-schema#label',
      'http://www.w3.org/2000/01/rdf-schema#comment',
      'http://purl.org/dc/elements/1.1/title'
    ];
    
    if (highImportance.includes(predicate)) return 1.0;
    if (mediumImportance.includes(predicate)) return 0.5;
    return 0.3; // Default weight
  }

  /**
   * Categorize semantic changes by type
   */
  categorizeSemanticChanges(graphDiff) {
    const changes = {
      typeChanges: [],
      propertyChanges: [],
      relationshipChanges: [],
      literalChanges: []
    };

    // Analyze added triples
    for (const quad of graphDiff.added) {
      const category = this.categorizeTriple(quad, 'added');
      changes[category.type].push(category);
    }

    // Analyze removed triples
    for (const quad of graphDiff.removed) {
      const category = this.categorizeTriple(quad, 'removed');  
      changes[category.type].push(category);
    }

    return changes;
  }

  /**
   * Categorize a single triple
   */
  categorizeTriple(quad, changeType) {
    const predicate = quad.predicate.value;
    
    if (predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
      return {
        type: 'typeChanges',
        changeType,
        description: `${changeType} type: ${quad.object.value}`,
        subject: quad.subject.value,
        impact: 'high'
      };
    }
    
    if (quad.object.termType === 'Literal') {
      return {
        type: 'literalChanges',
        changeType,
        description: `${changeType} literal value`,
        predicate: predicate,
        impact: 'medium'
      };
    }
    
    return {
      type: 'relationshipChanges',
      changeType,
      description: `${changeType} relationship`,
      predicate: predicate,
      impact: 'medium'
    };
  }

  /**
   * Generate human-readable reasons for changes
   */
  generateChangeReasons(changes) {
    const reasons = [];
    
    if (changes.typeChanges.length > 0) {
      reasons.push(`${changes.typeChanges.length} type changes detected`);
    }
    
    if (changes.propertyChanges.length > 0) {
      reasons.push(`${changes.propertyChanges.length} property changes detected`);
    }
    
    if (changes.relationshipChanges.length > 0) {
      reasons.push(`${changes.relationshipChanges.length} relationship changes detected`);
    }
    
    if (changes.literalChanges.length > 0) {
      reasons.push(`${changes.literalChanges.length} literal value changes detected`);
    }

    return reasons.length > 0 ? reasons : ['Unspecified semantic changes'];
  }

  /**
   * Get git changes for a file
   */
  async getGitChanges(filePath) {
    if (!this.config.enableGitIntegration) return [];
    
    try {
      // Get git diff for the file
      const gitDiff = execSync(`git diff HEAD~1 HEAD -- "${filePath}"`, { 
        encoding: 'utf8',
        timeout: 5000 
      });
      
      if (!gitDiff.trim()) return [];

      // Parse git diff to extract changes
      const changes = [];
      const lines = gitDiff.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          changes.push({ type: 'addition', content: line.substring(1) });
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          changes.push({ type: 'deletion', content: line.substring(1) });
        }
      }

      return changes;
    } catch (error) {
      this.logger.debug(`Git diff failed for ${filePath}:`, error.message);
      return [];
    }
  }

  /**
   * Load SHACL shapes for semantic significance detection
   */
  async loadSemanticSignificanceShapes() {
    if (!this.config.enableSHACLValidation) return;

    try {
      // Try to load SHACL validator dynamically
      let SHACLValidator = null;
      try {
        const shaclModule = await import('rdf-validate-shacl');
        SHACLValidator = shaclModule.default || shaclModule.SHACLValidator;
      } catch (error) {
        this.logger.warn('SHACL validation not available:', error.message);
        return;
      }

      // Define SHACL shapes for semantic drift detection
      const shapesGraph = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix kgen: <http://kgen.ai/ontology#> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        kgen:SemanticDriftShape a sh:NodeShape ;
          sh:targetClass kgen:Artifact ;
          sh:property [
            sh:path rdf:type ;
            sh:severity sh:Violation ;
            sh:message "Type changes indicate semantic drift" ;
          ] ;
          sh:property [
            sh:path rdfs:subClassOf ;
            sh:severity sh:Violation ;
            sh:message "Subclass changes indicate structural drift" ;
          ] .

        kgen:SignificantChangeShape a sh:NodeShape ;
          sh:targetNode kgen:SemanticChange ;
          sh:property [
            sh:path kgen:changeType ;
            sh:in ( kgen:TypeChange kgen:PropertyChange kgen:StructuralChange ) ;
            sh:severity sh:Warning ;
          ] .
      `;

      const shapesQuads = await this.parseRDF(shapesGraph, 'turtle');
      const shapesStore = new Store(shapesQuads);
      
      this.shaclValidator = new SHACLValidator(shapesStore);
      this.logger.success('SHACL shapes loaded for semantic drift detection');
    } catch (error) {
      this.logger.warn('Failed to load SHACL shapes:', error.message);
    }
  }

  /**
   * Validate semantic constraints using SHACL
   */
  async validateSemanticConstraints(content, changes) {
    if (!this.shaclValidator) return [];

    try {
      const quads = await this.parseRDF(content, 'turtle');
      const dataStore = new Store(quads);
      
      const report = this.shaclValidator.validate(dataStore);
      
      return report.results.map(violation => ({
        severity: violation.severity?.value || 'Violation',
        message: violation.message?.value || 'Constraint violation',
        focusNode: violation.focusNode?.value,
        path: violation.path?.value,
        sourceShape: violation.sourceShape?.value
      }));
    } catch (error) {
      this.logger.debug('SHACL validation failed:', error.message);
      return [];
    }
  }

  /**
   * Check CAS cache for unchanged files
   */
  async checkCASCache(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const cached = this.casCache.get(filePath);
    
    if (cached && cached.hash === hash) {
      return { hit: true, hash };
    }
    
    return { hit: false, hash };
  }

  /**
   * Update CAS cache
   */
  async updateCASCache(filePath, content) {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    this.casCache.set(filePath, { hash, timestamp: this.getDeterministicTimestamp() });
  }

  /**
   * Load artifact versions (baseline and current)
   */
  async loadArtifactVersions(artifactPath, options) {
    let baseline = null;
    let current = null;

    try {
      current = await fs.readFile(artifactPath, 'utf8');

      // Try to load from attestation first
      const attestationPath = `${artifactPath}.attest.json`;
      try {
        const attestationContent = await fs.readFile(attestationPath, 'utf8');
        const attestation = JSON.parse(attestationContent);
        
        if (attestation.baseline?.content) {
          baseline = attestation.baseline.content;
        }
      } catch {}

      // Fallback to git previous version
      if (!baseline && this.config.enableGitIntegration) {
        try {
          baseline = execSync(`git show HEAD~1:"${artifactPath}"`, { 
            encoding: 'utf8',
            timeout: 5000 
          });
        } catch {}
      }

      // Fallback to provided baseline
      if (!baseline && options.baseline) {
        if (typeof options.baseline === 'string') {
          baseline = options.baseline;
          // Using provided baseline for analysis
        }
      }

    } catch (error) {
      this.logger.error(`Failed to load artifact versions: ${error.message}`);
    }

    return { baseline, current };
  }

  /**
   * Parse RDF content
   */
  async parseRDF(content, format) {
    return new Promise((resolve, reject) => {
      const quads = [];
      this.parser.parse(content, (error, quad, prefixes) => {
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

  /**
   * Convert quad to string for comparison
   */
  quadToString(quad) {
    return `${quad.subject.value} ${quad.predicate.value} ${quad.object.value}`;
  }

  /**
   * Detect format from file extension
   */
  detectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const formatMap = {
      '.ttl': 'turtle',
      '.turtle': 'turtle', 
      '.n3': 'n3',
      '.nt': 'ntriples',
      '.rdf': 'rdfxml',
      '.jsonld': 'jsonld'
    };
    return formatMap[ext] || 'text';
  }

  /**
   * Check if format supports semantic analysis
   */
  isSemanticFormat(format) {
    return ['turtle', 'n3', 'ntriples', 'rdfxml', 'jsonld'].includes(format);
  }

  /**
   * Check if a line change is structural
   */
  isStructuralChange(baselineLine, currentLine) {
    // Heuristics for structural significance
    const structuralPatterns = [
      /class\s+\w+/,      // Class definitions
      /function\s+\w+/,   // Function definitions  
      /interface\s+\w+/,  // Interface definitions
      /import\s+/,        // Import statements
      /export\s+/,        // Export statements
      /@\w+/,            // Decorators/annotations
      /^\s*\{/,          // Opening braces
      /^\s*\}/           // Closing braces
    ];

    return structuralPatterns.some(pattern => 
      pattern.test(baselineLine) || pattern.test(currentLine)
    );
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const avgAnalysisTime = this.metrics.totalAnalyses > 0 
      ? this.metrics.analysisTime / this.metrics.totalAnalyses 
      : 0;

    const truePositiveRate = this.metrics.truePositives > 0
      ? this.metrics.truePositives / (this.metrics.truePositives + this.metrics.falsePositives)
      : 0;

    return {
      ...this.metrics,
      averageAnalysisTime: Math.round(avgAnalysisTime),
      truePositiveRate: Math.round(truePositiveRate * 1000) / 10, // Percentage with 1 decimal
      targetSNR: this.config.truePositiveThreshold * 100,
      meetsSNRTarget: truePositiveRate >= this.config.truePositiveThreshold
    };
  }

  /**
   * Reset analyzer state
   */
  reset() {
    this.casCache.clear();
    this.store.removeQuads(this.store.getQuads());
    this.metrics = {
      totalAnalyses: 0,
      semanticDriftsDetected: 0,
      falsePositives: 0,
      truePositives: 0,
      analysisTime: 0
    };
  }

  /**
   * Check if a line change is a variable name change
   */
  isVariableChange(baselineLine, currentLine) {
    // For now, return false as a placeholder - could be enhanced
    return false;
  }

  /**
   * Check if a line change is a value change
   */
  isValueChange(baselineLine, currentLine) {
    // Detect value changes in assignments
    const valuePatterns = [
      /=\s*["']([^"']+)["']/,  // String values
      /=\s*(\d+)/,             // Numeric values
      /=\s*(true|false)/,      // Boolean values
    ];

    for (const pattern of valuePatterns) {
      const baseMatch = baselineLine.match(pattern);
      const currentMatch = currentLine.match(pattern);
      
      if (baseMatch && currentMatch && baseMatch[1] !== currentMatch[1]) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if a line change is semantic (broader definition)
   */
  isSemanticChange(baselineLine, currentLine) {
    // Any substantive content change (not just whitespace/comments)
    const baseContent = baselineLine.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim();
    const currentContent = currentLine.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim();
    
    return baseContent !== currentContent && baseContent.length > 0 && currentContent.length > 0;
  }
}

export default SemanticDriftAnalyzer;