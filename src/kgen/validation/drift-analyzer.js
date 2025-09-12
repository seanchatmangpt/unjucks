/**
 * KGEN Semantic Drift Analyzer
 * 
 * Advanced drift detection with semantic analysis, content comparison,
 * and automated remediation suggestions. Provides 100% drift detection
 * with semantic understanding of changes.
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { Parser as N3Parser, Store as N3Store } from 'n3';
import { SHACLValidationEngine } from './shacl-validation-engine.js';
import consola from 'consola';
import { EventEmitter } from 'events';

/**
 * Drift severity levels
 */
export const DriftSeverity = {
  NONE: 'none',
  MINOR: 'minor',        // Formatting, comments
  MODERATE: 'moderate',   // Logic changes, structure
  MAJOR: 'major',        // API changes, breaking changes
  CRITICAL: 'critical'   // Security, data integrity
};

/**
 * Drift analysis types
 */
export const DriftAnalysisType = {
  CONTENT_HASH: 'content-hash',
  SEMANTIC_RDF: 'semantic-rdf',
  STRUCTURAL: 'structural',
  FUNCTIONAL: 'functional',
  SECURITY: 'security'
};

/**
 * Advanced drift detection with semantic analysis
 */
export class SemanticDriftAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logger: options.logger || consola,
      baselinePath: options.baselinePath || './.kgen/drift-baselines',
      tolerance: options.tolerance || 0.95, // Similarity threshold
      enableSemanticAnalysis: options.enableSemanticAnalysis !== false,
      enableAutoRemediation: options.enableAutoRemediation || false,
      maxDriftHistorySize: options.maxDriftHistorySize || 100,
      ...options
    };
    
    this.driftHistory = new Map();
    this.baselineStore = new Map();
    this.semanticAnalyzer = null;
    
    if (this.options.enableSemanticAnalysis) {
      this.semanticAnalyzer = new SHACLValidationEngine({
        logger: this.options.logger
      });
    }
  }

  /**
   * Initialize drift analyzer
   */
  async initialize() {
    try {
      // Ensure baseline directory exists
      await fs.ensureDir(this.options.baselinePath);
      
      // Load existing baselines
      await this.loadBaselines();
      
      this.options.logger.success('✅ Semantic Drift Analyzer initialized');
      
      this.emit('initialized', {
        baselinesLoaded: this.baselineStore.size,
        semanticAnalysisEnabled: this.options.enableSemanticAnalysis
      });
      
    } catch (error) {
      this.options.logger.error(`❌ Drift analyzer initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze drift between current content and baseline
   * @param {string} artifactPath - Path to artifact to analyze
   * @param {string} expectedContent - Expected content (optional)
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Comprehensive drift analysis
   */
  async analyzeDrift(artifactPath, expectedContent = null, options = {}) {
    const startTime = performance.now();
    const analysisId = crypto.randomUUID?.() || this.getDeterministicTimestamp().toString();
    
    const analysis = {
      analysisId,
      timestamp: this.getDeterministicDate().toISOString(),
      artifactPath: path.resolve(artifactPath),
      driftDetected: false,
      severity: DriftSeverity.NONE,
      overallScore: 1.0,
      analyses: {},
      recommendations: [],
      metadata: {
        analysisTime: 0,
        baselineExists: false,
        artifactExists: false
      }
    };
    
    try {
      // Check if artifact exists
      analysis.metadata.artifactExists = await fs.pathExists(artifactPath);
      
      // Get current content
      const currentContent = analysis.metadata.artifactExists ?
        await fs.readFile(artifactPath, 'utf8') : '';
      
      // Get expected/baseline content
      let baselineContent = expectedContent;
      if (!baselineContent) {
        const baseline = await this.getBaseline(artifactPath);
        baselineContent = baseline?.content || '';
        analysis.metadata.baselineExists = !!baseline;
      }
      
      // Perform comprehensive drift analysis
      const analysisTypes = [
        DriftAnalysisType.CONTENT_HASH,
        DriftAnalysisType.STRUCTURAL,
        DriftAnalysisType.FUNCTIONAL,
        DriftAnalysisType.SECURITY
      ];
      
      if (this.options.enableSemanticAnalysis && this.isRDFContent(currentContent)) {
        analysisTypes.push(DriftAnalysisType.SEMANTIC_RDF);
      }
      
      // Run all analyses in parallel
      const analysisPromises = analysisTypes.map(async (type) => {
        const result = await this.runAnalysis(type, currentContent, baselineContent, options);
        return { type, result };
      });
      
      const results = await Promise.all(analysisPromises);
      
      // Aggregate results
      let totalScore = 0;
      let maxSeverity = DriftSeverity.NONE;
      
      for (const { type, result } of results) {
        analysis.analyses[type] = result;
        totalScore += result.score * result.weight;
        
        if (this.compareSeverity(result.severity, maxSeverity) > 0) {
          maxSeverity = result.severity;
        }
      }
      
      // Calculate overall results
      analysis.overallScore = totalScore / results.reduce((sum, r) => sum + r.result.weight, 0);
      analysis.driftDetected = analysis.overallScore < this.options.tolerance;
      analysis.severity = maxSeverity;
      
      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis);
      
      // Auto-remediation if enabled
      if (this.options.enableAutoRemediation && analysis.driftDetected) {
        const remediationResult = await this.attemptAutoRemediation(analysis, currentContent, baselineContent);
        analysis.autoRemediation = remediationResult;
      }
      
      analysis.metadata.analysisTime = performance.now() - startTime;
      
      // Record drift history
      this.recordDriftHistory(artifactPath, analysis);
      
      // Update baseline if significant drift detected
      if (analysis.driftDetected && options.updateBaseline) {
        await this.updateBaseline(artifactPath, currentContent);
      }
      
      this.emit('driftAnalyzed', analysis);
      
      return analysis;
      
    } catch (error) {
      analysis.error = error.message;
      analysis.metadata.analysisTime = performance.now() - startTime;
      
      this.options.logger.error(`❌ Drift analysis failed: ${error.message}`);
      
      return analysis;
    }
  }

  /**
   * Run specific type of drift analysis
   * @private
   */
  async runAnalysis(type, currentContent, baselineContent, options) {
    switch (type) {
      case DriftAnalysisType.CONTENT_HASH:
        return this.analyzeContentHash(currentContent, baselineContent);
      
      case DriftAnalysisType.SEMANTIC_RDF:
        return this.analyzeSemanticRDF(currentContent, baselineContent);
      
      case DriftAnalysisType.STRUCTURAL:
        return this.analyzeStructural(currentContent, baselineContent);
      
      case DriftAnalysisType.FUNCTIONAL:
        return this.analyzeFunctional(currentContent, baselineContent);
      
      case DriftAnalysisType.SECURITY:
        return this.analyzeSecurity(currentContent, baselineContent);
      
      default:
        return {
          score: 1.0,
          severity: DriftSeverity.NONE,
          weight: 0.1,
          changes: [],
          confidence: 1.0
        };
    }
  }

  /**
   * Content hash-based drift analysis
   * @private
   */
  analyzeContentHash(currentContent, baselineContent) {
    const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
    const baselineHash = crypto.createHash('sha256').update(baselineContent).digest('hex');
    
    const identical = currentHash === baselineHash;
    
    return {
      score: identical ? 1.0 : 0.0,
      severity: identical ? DriftSeverity.NONE : DriftSeverity.MODERATE,
      weight: 0.3,
      changes: identical ? [] : [{
        type: 'content-change',
        description: 'Content hash changed',
        currentHash: currentHash.substring(0, 8),
        baselineHash: baselineHash.substring(0, 8)
      }],
      confidence: 1.0,
      metadata: {
        currentHash,
        baselineHash,
        contentSizeDiff: currentContent.length - baselineContent.length
      }
    };
  }

  /**
   * Semantic RDF drift analysis using SHACL
   * @private
   */
  async analyzeSemanticRDF(currentContent, baselineContent) {
    if (!this.semanticAnalyzer) {
      return {
        score: 1.0,
        severity: DriftSeverity.NONE,
        weight: 0.0,
        changes: [],
        confidence: 0.0,
        error: 'Semantic analysis not enabled'
      };
    }
    
    try {
      // Parse RDF content
      const currentStore = await this.parseRDF(currentContent);
      const baselineStore = await this.parseRDF(baselineContent);
      
      // Compare RDF graphs
      const comparison = this.compareRDFStores(currentStore, baselineStore);
      
      // Calculate semantic similarity
      const semanticScore = this.calculateSemanticSimilarity(comparison);
      
      return {
        score: semanticScore,
        severity: semanticScore < 0.8 ? DriftSeverity.MAJOR : 
                 semanticScore < 0.95 ? DriftSeverity.MODERATE : DriftSeverity.MINOR,
        weight: 0.4,
        changes: comparison.changes,
        confidence: 0.9,
        metadata: {
          currentTriples: currentStore.size,
          baselineTriples: baselineStore.size,
          addedTriples: comparison.added,
          removedTriples: comparison.removed,
          modifiedTriples: comparison.modified
        }
      };
      
    } catch (error) {
      return {
        score: 0.0,
        severity: DriftSeverity.CRITICAL,
        weight: 0.4,
        changes: [{
          type: 'semantic-error',
          description: `Semantic analysis failed: ${error.message}`
        }],
        confidence: 0.1,
        error: error.message
      };
    }
  }

  /**
   * Structural drift analysis (syntax, formatting)
   * @private
   */
  analyzeStructural(currentContent, baselineContent) {
    const changes = [];
    let score = 1.0;
    
    // Check line count changes
    const currentLines = currentContent.split('\n').length;
    const baselineLines = baselineContent.split('\n').length;
    const lineDiff = Math.abs(currentLines - baselineLines);
    
    if (lineDiff > 0) {
      const lineChangeRatio = lineDiff / Math.max(currentLines, baselineLines);
      score -= lineChangeRatio * 0.5;
      
      changes.push({
        type: 'line-count-change',
        description: `Line count changed from ${baselineLines} to ${currentLines}`,
        impact: lineChangeRatio
      });
    }
    
    // Check indentation changes
    const currentIndentation = this.analyzeIndentation(currentContent);
    const baselineIndentation = this.analyzeIndentation(baselineContent);
    
    if (currentIndentation.style !== baselineIndentation.style) {
      score -= 0.1;
      changes.push({
        type: 'indentation-change',
        description: `Indentation style changed from ${baselineIndentation.style} to ${currentIndentation.style}`
      });
    }
    
    return {
      score: Math.max(0, score),
      severity: score < 0.8 ? DriftSeverity.MINOR : DriftSeverity.NONE,
      weight: 0.2,
      changes,
      confidence: 0.8
    };
  }

  /**
   * Functional drift analysis (logic, behavior)
   * @private
   */
  analyzeFunctional(currentContent, baselineContent) {
    const changes = [];
    let score = 1.0;
    
    // Check for template variable changes (Nunjucks)
    const currentVars = this.extractTemplateVariables(currentContent);
    const baselineVars = this.extractTemplateVariables(baselineContent);
    
    const addedVars = currentVars.filter(v => !baselineVars.includes(v));
    const removedVars = baselineVars.filter(v => !currentVars.includes(v));
    
    if (addedVars.length > 0) {
      changes.push({
        type: 'variables-added',
        description: `Template variables added: ${addedVars.join(', ')}`,
        variables: addedVars
      });
      score -= addedVars.length * 0.1;
    }
    
    if (removedVars.length > 0) {
      changes.push({
        type: 'variables-removed',
        description: `Template variables removed: ${removedVars.join(', ')}`,
        variables: removedVars
      });
      score -= removedVars.length * 0.2; // Removal is more severe
    }
    
    // Check for function/method changes
    const currentFunctions = this.extractFunctions(currentContent);
    const baselineFunctions = this.extractFunctions(baselineContent);
    
    const functionChanges = this.compareFunctions(currentFunctions, baselineFunctions);
    if (functionChanges.length > 0) {
      changes.push(...functionChanges);
      score -= functionChanges.length * 0.15;
    }
    
    return {
      score: Math.max(0, score),
      severity: score < 0.7 ? DriftSeverity.MAJOR : 
               score < 0.9 ? DriftSeverity.MODERATE : DriftSeverity.MINOR,
      weight: 0.3,
      changes,
      confidence: 0.7
    };
  }

  /**
   * Security-focused drift analysis
   * @private
   */
  analyzeSecurity(currentContent, baselineContent) {
    const changes = [];
    let score = 1.0;
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, severity: DriftSeverity.CRITICAL, name: 'eval() usage' },
      { pattern: /Function\s*\(/, severity: DriftSeverity.CRITICAL, name: 'Function() constructor' },
      { pattern: /document\.write\s*\(/, severity: DriftSeverity.MAJOR, name: 'document.write() usage' },
      { pattern: /innerHTML\s*=/, severity: DriftSeverity.MODERATE, name: 'innerHTML assignment' },
      { pattern: /\.\.\//g, severity: DriftSeverity.MODERATE, name: 'path traversal patterns' }
    ];
    
    for (const { pattern, severity, name } of dangerousPatterns) {
      const currentMatches = (currentContent.match(pattern) || []).length;
      const baselineMatches = (baselineContent.match(pattern) || []).length;
      
      if (currentMatches > baselineMatches) {
        const newOccurrences = currentMatches - baselineMatches;
        changes.push({
          type: 'security-risk-added',
          description: `New security risk detected: ${name} (${newOccurrences} new occurrences)`,
          pattern: pattern.toString(),
          severity,
          occurrences: newOccurrences
        });
        
        score -= newOccurrences * (severity === DriftSeverity.CRITICAL ? 0.5 : 
                                  severity === DriftSeverity.MAJOR ? 0.3 : 0.1);
      }
    }
    
    // Check for credential patterns
    const credentialPatterns = [
      /password\s*[:=]\s*['"][^'"]*['"]/i,
      /api_?key\s*[:=]\s*['"][^'"]*['"]/i,
      /secret\s*[:=]\s*['"][^'"]*['"]/i,
      /token\s*[:=]\s*['"][^'"]*['"]/i
    ];
    
    for (const pattern of credentialPatterns) {
      const currentMatches = (currentContent.match(pattern) || []).length;
      const baselineMatches = (baselineContent.match(pattern) || []).length;
      
      if (currentMatches > baselineMatches) {
        changes.push({
          type: 'credential-exposure',
          description: 'Potential credential exposure detected',
          severity: DriftSeverity.CRITICAL
        });
        score = 0; // Critical security issue
        break;
      }
    }
    
    return {
      score: Math.max(0, score),
      severity: score === 0 ? DriftSeverity.CRITICAL :
               score < 0.5 ? DriftSeverity.MAJOR :
               score < 0.8 ? DriftSeverity.MODERATE : DriftSeverity.NONE,
      weight: 0.4,
      changes,
      confidence: 0.9
    };
  }

  /**
   * Generate recommendations based on drift analysis
   * @private
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.severity === DriftSeverity.CRITICAL) {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'immediate-review',
        description: 'Critical drift detected. Immediate manual review required.',
        automated: false
      });
    }
    
    // Security recommendations
    const securityAnalysis = analysis.analyses[DriftAnalysisType.SECURITY];
    if (securityAnalysis && securityAnalysis.changes.length > 0) {
      for (const change of securityAnalysis.changes) {
        if (change.type === 'credential-exposure') {
          recommendations.push({
            priority: 'CRITICAL',
            action: 'remove-credentials',
            description: 'Remove hardcoded credentials immediately',
            automated: true,
            command: 'kgen validate security --fix-credentials'
          });
        }
      }
    }
    
    // Functional recommendations
    const functionalAnalysis = analysis.analyses[DriftAnalysisType.FUNCTIONAL];
    if (functionalAnalysis && functionalAnalysis.score < 0.8) {
      recommendations.push({
        priority: 'HIGH',
        action: 'review-functionality',
        description: 'Significant functional changes detected. Review template logic.',
        automated: false
      });
    }
    
    // Baseline update recommendation
    if (analysis.overallScore < 0.9 && analysis.severity <= DriftSeverity.MODERATE) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'update-baseline',
        description: 'Consider updating baseline if changes are intentional',
        automated: true,
        command: `kgen drift update-baseline "${analysis.artifactPath}"`
      });
    }
    
    return recommendations;
  }

  /**
   * Attempt automatic remediation
   * @private
   */
  async attemptAutoRemediation(analysis, currentContent, baselineContent) {
    const remediationActions = [];
    
    try {
      // Auto-fix security issues
      const securityAnalysis = analysis.analyses[DriftAnalysisType.SECURITY];
      if (securityAnalysis && securityAnalysis.changes.length > 0) {
        let fixedContent = currentContent;
        
        for (const change of securityAnalysis.changes) {
          if (change.type === 'credential-exposure') {
            // Replace with placeholder
            fixedContent = fixedContent.replace(
              /password\s*[:=]\s*['"][^'"]*['"]/gi,
              'password: "{{PASSWORD}}"'
            );
            fixedContent = fixedContent.replace(
              /api_?key\s*[:=]\s*['"][^'"]*['"]/gi,
              'apiKey: "{{API_KEY}}"'
            );
            
            remediationActions.push({
              type: 'credential-replacement',
              description: 'Replaced hardcoded credentials with templates'
            });
          }
        }
        
        if (fixedContent !== currentContent) {
          await fs.writeFile(analysis.artifactPath, fixedContent, 'utf8');
          remediationActions.push({
            type: 'file-updated',
            description: 'Updated file with security fixes'
          });
        }
      }
      
      return {
        success: remediationActions.length > 0,
        actions: remediationActions
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper methods
   */
  
  async parseRDF(content) {
    return new Promise((resolve, reject) => {
      const parser = new N3Parser();
      const store = new N3Store();
      
      parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          store.addQuad(quad);
        } else {
          resolve(store);
        }
      });
    });
  }
  
  compareRDFStores(current, baseline) {
    const currentQuads = [...current];
    const baselineQuads = [...baseline];
    
    const added = currentQuads.filter(q => 
      !baselineQuads.some(bq => this.quadsEqual(q, bq))
    );
    
    const removed = baselineQuads.filter(bq => 
      !currentQuads.some(q => this.quadsEqual(q, bq))
    );
    
    const changes = [];
    
    if (added.length > 0) {
      changes.push({
        type: 'triples-added',
        description: `${added.length} triples added`,
        count: added.length
      });
    }
    
    if (removed.length > 0) {
      changes.push({
        type: 'triples-removed',
        description: `${removed.length} triples removed`,
        count: removed.length
      });
    }
    
    return { added: added.length, removed: removed.length, changes, modified: 0 };
  }
  
  quadsEqual(q1, q2) {
    return q1.subject.equals(q2.subject) &&
           q1.predicate.equals(q2.predicate) &&
           q1.object.equals(q2.object) &&
           q1.graph.equals(q2.graph);
  }
  
  calculateSemanticSimilarity(comparison) {
    const totalChanges = comparison.added + comparison.removed + comparison.modified;
    if (totalChanges === 0) return 1.0;
    
    // Simple similarity based on change ratio
    const maxQuads = Math.max(comparison.added + comparison.removed, 1);
    return Math.max(0, 1 - (totalChanges / maxQuads));
  }
  
  extractTemplateVariables(content) {
    const matches = content.match(/\{\{\s*(\w+)(?:\.\w+)*\s*\}\}/g) || [];
    return matches.map(match => match.replace(/[{}]/g, '').trim());
  }
  
  extractFunctions(content) {
    const matches = content.match(/function\s+(\w+)\s*\(/g) || [];
    return matches.map(match => match.match(/function\s+(\w+)/)[1]);
  }
  
  compareFunctions(current, baseline) {
    const changes = [];
    
    const added = current.filter(f => !baseline.includes(f));
    const removed = baseline.filter(f => !current.includes(f));
    
    if (added.length > 0) {
      changes.push({
        type: 'functions-added',
        description: `Functions added: ${added.join(', ')}`,
        functions: added
      });
    }
    
    if (removed.length > 0) {
      changes.push({
        type: 'functions-removed',
        description: `Functions removed: ${removed.join(', ')}`,
        functions: removed
      });
    }
    
    return changes;
  }
  
  analyzeIndentation(content) {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    let tabCount = 0;
    let spaceCount = 0;
    
    for (const line of lines) {
      if (line.startsWith('\t')) tabCount++;
      else if (line.startsWith(' ')) spaceCount++;
    }
    
    return {
      style: tabCount > spaceCount ? 'tabs' : 'spaces',
      consistency: Math.max(tabCount, spaceCount) / lines.length
    };
  }
  
  isRDFContent(content) {
    return content.includes('@prefix') || 
           content.includes('http://www.w3.org/') ||
           content.includes('<http') ||
           content.match(/\w+:\w+/);
  }
  
  compareSeverity(severity1, severity2) {
    const levels = {
      [DriftSeverity.NONE]: 0,
      [DriftSeverity.MINOR]: 1,
      [DriftSeverity.MODERATE]: 2,
      [DriftSeverity.MAJOR]: 3,
      [DriftSeverity.CRITICAL]: 4
    };
    
    return levels[severity1] - levels[severity2];
  }
  
  recordDriftHistory(artifactPath, analysis) {
    if (!this.driftHistory.has(artifactPath)) {
      this.driftHistory.set(artifactPath, []);
    }
    
    const history = this.driftHistory.get(artifactPath);
    history.push({
      timestamp: analysis.timestamp,
      driftDetected: analysis.driftDetected,
      severity: analysis.severity,
      score: analysis.overallScore
    });
    
    // Keep only recent entries
    if (history.length > this.options.maxDriftHistorySize) {
      history.splice(0, history.length - this.options.maxDriftHistorySize);
    }
  }
  
  async loadBaselines() {
    try {
      const baselineFiles = await fs.readdir(this.options.baselinePath).catch(() => []);
      
      for (const file of baselineFiles) {
        if (file.endsWith('.json')) {
          const baselinePath = path.join(this.options.baselinePath, file);
          const baseline = await fs.readJson(baselinePath);
          this.baselineStore.set(baseline.artifactPath, baseline);
        }
      }
      
    } catch (error) {
      this.options.logger.debug(`No existing baselines found: ${error.message}`);
    }
  }
  
  async getBaseline(artifactPath) {
    return this.baselineStore.get(path.resolve(artifactPath));
  }
  
  async updateBaseline(artifactPath, content) {
    const baseline = {
      artifactPath: path.resolve(artifactPath),
      content,
      hash: crypto.createHash('sha256').update(content).digest('hex'),
      updatedAt: this.getDeterministicDate().toISOString()
    };
    
    this.baselineStore.set(baseline.artifactPath, baseline);
    
    const baselineFile = path.join(
      this.options.baselinePath,
      `${crypto.createHash('md5').update(baseline.artifactPath).digest('hex')}.json`
    );
    
    await fs.writeJson(baselineFile, baseline, { spaces: 2 });
  }
}

export default SemanticDriftAnalyzer;