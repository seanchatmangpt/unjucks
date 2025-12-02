/**
 * Drift Detection System
 * 
 * Uses lock file as baseline for detecting changes in:
 * - Template files and dependencies
 * - Rule files and reasoning logic
 * - Configuration changes
 * - Generated artifacts
 * 
 * Provides semantic-aware drift detection with RDF/Turtle understanding
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';
import { createHash } from 'crypto';
import { LockManager } from './lock-manager.js';
import { ConfigLoader } from './config-loader.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';

const execAsync = promisify(exec);

/**
 * Drift detection severity levels
 */
const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Drift types for categorization
 */
const DRIFT_TYPES = {
  TEMPLATE_ADDED: 'template-added',
  TEMPLATE_REMOVED: 'template-removed',
  TEMPLATE_MODIFIED: 'template-modified',
  RULE_ADDED: 'rule-added',
  RULE_REMOVED: 'rule-removed',
  RULE_MODIFIED: 'rule-modified',
  CONFIG_CHANGED: 'config-changed',
  ARTIFACT_ORPHANED: 'artifact-orphaned',
  DEPENDENCY_MISSING: 'dependency-missing',
  SEMANTIC_INCONSISTENCY: 'semantic-inconsistency'
};

/**
 * Drift detection and analysis class
 */
export class DriftDetector {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.lockManager = options.lockManager || new LockManager({ projectRoot: this.projectRoot });
    this.configLoader = options.configLoader || new ConfigLoader({ cwd: this.projectRoot });
    this.semanticAnalysis = options.semanticAnalysis !== false;
    this.strictMode = options.strictMode || false;
  }

  /**
   * Detect drift by comparing current state with lock file baseline
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} Drift analysis result
   */
  async detect(options = {}) {
    const includeDetails = options.details !== false;
    const checkArtifacts = options.artifacts !== false;
    
    // Load current configuration and lock file
    const [config, lockFile] = await Promise.all([
      this.configLoader.load(),
      this.lockManager.load()
    ]);
    
    if (!lockFile) {
      return {
        status: 'no-baseline',
        severity: SEVERITY.WARNING,
        message: 'No lock file found - unable to detect drift',
        drift: [],
        recommendations: [
          'Generate initial lock file with: kgen lock generate',
          'Commit lock file to version control for baseline tracking'
        ]
      };
    }
    
    // Compare current state with baseline
    const comparison = await this.lockManager.compare({ config });
    
    if (comparison.status === 'clean') {
      return {
        status: 'clean',
        severity: SEVERITY.INFO,
        message: 'No drift detected - all files match baseline',
        drift: [],
        baseline: lockFile.timestamp,
        lastCheck: new Date().toISOString()
      };
    }
    
    // Analyze detected changes
    const analysis = await this.analyzeChanges(comparison.changes, lockFile, config, {
      includeDetails,
      checkArtifacts
    });
    
    // Calculate overall severity
    const severity = this.calculateSeverity(analysis.drift);
    
    return {
      status: 'drift',
      severity,
      message: `Drift detected: ${analysis.drift.length} changes found`,
      drift: analysis.drift,
      summary: analysis.summary,
      recommendations: analysis.recommendations,
      baseline: lockFile.timestamp,
      lastCheck: new Date().toISOString(),
      ...(includeDetails && { details: analysis.details })
    };
  }

  /**
   * Analyze changes to provide detailed drift information
   * @param {Array} changes - Raw changes from comparison
   * @param {Object} lockFile - Baseline lock file
   * @param {Object} config - Current configuration
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeChanges(changes, lockFile, config, options = {}) {
    const drift = [];
    const summary = {
      total: changes.length,
      byType: {},
      bySeverity: {}
    };
    const recommendations = [];
    const details = {};
    
    for (const change of changes) {
      const analysis = await this.analyzeChange(change, lockFile, config);
      drift.push(analysis);
      
      // Update summary
      summary.byType[analysis.type] = (summary.byType[analysis.type] || 0) + 1;
      summary.bySeverity[analysis.severity] = (summary.bySeverity[analysis.severity] || 0) + 1;
      
      // Collect recommendations
      if (analysis.recommendations) {
        recommendations.push(...analysis.recommendations);
      }
      
      // Store details
      if (options.includeDetails && analysis.details) {
        details[`${analysis.type}-${analysis.file || 'global'}`] = analysis.details;
      }
    }
    
    // Add semantic analysis if enabled
    if (this.semanticAnalysis) {
      const semanticAnalysis = await this.performSemanticAnalysis(drift, lockFile);
      if (semanticAnalysis.inconsistencies.length > 0) {
        drift.push(...semanticAnalysis.inconsistencies);
        recommendations.push(...semanticAnalysis.recommendations);
      }
    }
    
    // Check for orphaned artifacts
    if (options.checkArtifacts) {
      const orphanedAnalysis = await this.checkOrphanedArtifacts(lockFile, config);
      if (orphanedAnalysis.orphaned.length > 0) {
        drift.push(...orphanedAnalysis.orphaned);
        recommendations.push(...orphanedAnalysis.recommendations);
      }
    }
    
    // Deduplicate recommendations
    const uniqueRecommendations = [...new Set(recommendations)];
    
    return {
      drift,
      summary,
      recommendations: uniqueRecommendations,
      details
    };
  }

  /**
   * Analyze individual change for detailed information
   * @param {Object} change - Change to analyze
   * @param {Object} lockFile - Baseline lock file
   * @param {Object} config - Current configuration
   * @returns {Promise<Object>} Change analysis
   */
  async analyzeChange(change, lockFile, config) {
    const analysis = {
      type: this.determineChangeType(change),
      severity: SEVERITY.WARNING,
      file: change.file,
      description: '',
      impact: [],
      recommendations: [],
      timestamp: new Date().toISOString()
    };
    
    switch (change.type) {
      case 'added':
        analysis.description = `New file added: ${change.file}`;
        analysis.severity = SEVERITY.INFO;
        analysis.impact = await this.analyzeAddedFileImpact(change.file, config);
        analysis.recommendations = [
          'Review new file for consistency with project standards',
          'Update lock file to include new baseline'
        ];
        break;
        
      case 'removed':
        analysis.description = `File removed: ${change.file}`;
        analysis.severity = SEVERITY.WARNING;
        analysis.impact = await this.analyzeRemovedFileImpact(change.file, lockFile);
        analysis.recommendations = [
          'Verify file removal was intentional',
          'Check for dependent files that may be affected',
          'Update lock file to reflect removal'
        ];
        break;
        
      case 'modified':
        analysis.description = `File modified: ${change.file}`;
        analysis.severity = SEVERITY.WARNING;
        analysis.impact = await this.analyzeModifiedFileImpact(change, lockFile, config);
        analysis.recommendations = [
          'Review changes for semantic correctness',
          'Test affected generation pipelines',
          'Update lock file with new baseline'
        ];
        
        // Add hash information
        analysis.details = {
          oldHash: change.oldHash,
          newHash: change.newHash,
          hashChanged: change.oldHash !== change.newHash
        };
        break;
        
      case 'integrity':
        analysis.description = `Integrity hash mismatch for ${change.category}`;
        analysis.severity = SEVERITY.ERROR;
        analysis.impact = [`${change.category} integrity compromised`];
        analysis.recommendations = [
          'Investigate cause of integrity mismatch',
          'Verify all files in category are correct',
          'Regenerate lock file if changes are valid'
        ];
        break;
    }
    
    return analysis;
  }

  /**
   * Determine drift type from change information
   * @param {Object} change - Change object
   * @returns {string} Drift type
   */
  determineChangeType(change) {
    if (!change.file) {
      return DRIFT_TYPES.CONFIG_CHANGED;
    }
    
    const file = change.file.toLowerCase();
    
    if (file.includes('template')) {
      switch (change.type) {
        case 'added': return DRIFT_TYPES.TEMPLATE_ADDED;
        case 'removed': return DRIFT_TYPES.TEMPLATE_REMOVED;
        case 'modified': return DRIFT_TYPES.TEMPLATE_MODIFIED;
      }
    }
    
    if (file.includes('rule') || file.endsWith('.n3')) {
      switch (change.type) {
        case 'added': return DRIFT_TYPES.RULE_ADDED;
        case 'removed': return DRIFT_TYPES.RULE_REMOVED;
        case 'modified': return DRIFT_TYPES.RULE_MODIFIED;
      }
    }
    
    return change.type;
  }

  /**
   * Analyze impact of added file
   * @param {string} filePath - Added file path
   * @param {Object} config - Current configuration
   * @returns {Promise<Array>} Impact description
   */
  async analyzeAddedFileImpact(filePath, config) {
    const impact = [];
    const fullPath = resolve(this.projectRoot, filePath);
    
    try {
      if (filePath.includes('template')) {
        impact.push('New template available for generation');
        
        // Check if it's referenced in config
        if (config.generate?.defaultTemplate && filePath.includes(config.generate.defaultTemplate)) {
          impact.push('May affect default template behavior');
        }
      }
      
      if (filePath.endsWith('.n3') || filePath.includes('rule')) {
        impact.push('New reasoning rule added');
        impact.push('May affect semantic analysis and validation');
      }
      
      if (filePath.endsWith('.ttl') || filePath.endsWith('.jsonld')) {
        impact.push('New RDF graph data added');
        impact.push('May affect generated artifacts');
      }
      
      // Check file size for performance impact
      const stats = statSync(fullPath);
      if (stats.size > 1024 * 1024) { // 1MB
        impact.push('Large file may impact performance');
      }
    } catch (error) {
      impact.push('Unable to analyze file (access error)');
    }
    
    return impact;
  }

  /**
   * Analyze impact of removed file
   * @param {string} filePath - Removed file path
   * @param {Object} lockFile - Baseline lock file
   * @returns {Promise<Array>} Impact description
   */
  async analyzeRemovedFileImpact(filePath, lockFile) {
    const impact = [];
    
    // Check if file had dependencies
    if (lockFile.dependencies) {
      const dependents = this.findDependents(filePath, lockFile.dependencies);
      if (dependents.length > 0) {
        impact.push(`${dependents.length} dependent files may be affected`);
        impact.push('Dependent files: ' + dependents.join(', '));
      }
    }
    
    // Check file type impact
    if (filePath.includes('template')) {
      impact.push('Template removal may break generation pipelines');
    }
    
    if (filePath.endsWith('.n3') || filePath.includes('rule')) {
      impact.push('Rule removal may affect semantic validation');
    }
    
    return impact;
  }

  /**
   * Analyze impact of modified file
   * @param {Object} change - Change information
   * @param {Object} lockFile - Baseline lock file
   * @param {Object} config - Current configuration
   * @returns {Promise<Array>} Impact description
   */
  async analyzeModifiedFileImpact(change, lockFile, config) {
    const impact = [];
    const filePath = change.file;
    
    // Basic impact based on file type
    if (filePath.includes('template')) {
      impact.push('Template modification may change generated artifacts');
    }
    
    if (filePath.endsWith('.n3') || filePath.includes('rule')) {
      impact.push('Rule modification may affect reasoning and validation');
    }
    
    if (filePath.endsWith('.ttl') || filePath.endsWith('.jsonld')) {
      impact.push('RDF data modification may affect semantic analysis');
    }
    
    // Semantic analysis for RDF files
    if (this.semanticAnalysis && (filePath.endsWith('.ttl') || filePath.endsWith('.n3'))) {
      try {
        const semanticImpact = await this.analyzeSemanticChanges(filePath);
        impact.push(...semanticImpact);
      } catch (error) {
        impact.push('Unable to perform semantic analysis');
      }
    }
    
    return impact;
  }

  /**
   * Perform semantic analysis on drift
   * @param {Array} drift - Detected drift items
   * @param {Object} lockFile - Baseline lock file
   * @returns {Promise<Object>} Semantic analysis result
   */
  async performSemanticAnalysis(drift, lockFile) {
    const inconsistencies = [];
    const recommendations = [];
    
    // Group changes by semantic domain
    const rdfChanges = drift.filter(d => 
      d.file && (d.file.endsWith('.ttl') || d.file.endsWith('.n3') || d.file.endsWith('.jsonld'))
    );
    
    // Check for ontology consistency
    if (rdfChanges.length > 0) {
      const ontologyCheck = await this.checkOntologyConsistency(rdfChanges);
      if (!ontologyCheck.consistent) {
        inconsistencies.push({
          type: DRIFT_TYPES.SEMANTIC_INCONSISTENCY,
          severity: SEVERITY.ERROR,
          description: 'Ontology consistency issues detected',
          issues: ontologyCheck.issues,
          recommendations: ontologyCheck.recommendations
        });
      }
    }
    
    return {
      inconsistencies,
      recommendations
    };
  }

  /**
   * Check for orphaned artifacts
   * @param {Object} lockFile - Baseline lock file
   * @param {Object} config - Current configuration
   * @returns {Promise<Object>} Orphaned artifacts analysis
   */
  async checkOrphanedArtifacts(lockFile, config) {
    const orphaned = [];
    const recommendations = [];
    
    // Check if generated artifacts directory exists
    const outputDir = config.directories?.out || './dist';
    
    try {
      const outputExists = existsSync(outputDir);
      if (outputExists) {
        // Find artifacts that may be orphaned
        const artifacts = await glob('**/*', {
          cwd: outputDir,
          ignore: ['node_modules/**', '.git/**'],
          nodir: true
        });
        
        // Simple heuristic: if artifacts exist but no templates have changed,
        // they might be orphaned
        const templateChanges = lockFile.templates && Object.keys(lockFile.templates).length;
        
        if (artifacts.length > 0 && !templateChanges) {
          orphaned.push({
            type: DRIFT_TYPES.ARTIFACT_ORPHANED,
            severity: SEVERITY.WARNING,
            description: `${artifacts.length} artifacts may be orphaned`,
            files: artifacts.slice(0, 10), // Limit to first 10
            recommendations: [
              'Verify artifacts are still needed',
              'Consider cleaning output directory',
              'Regenerate to ensure consistency'
            ]
          });
        }
      }
    } catch (error) {
      // Ignore errors accessing output directory
    }
    
    return {
      orphaned,
      recommendations
    };
  }

  /**
   * Calculate overall severity from drift items
   * @param {Array} drift - Drift items
   * @returns {string} Overall severity
   */
  calculateSeverity(drift) {
    if (drift.some(d => d.severity === SEVERITY.CRITICAL)) {
      return SEVERITY.CRITICAL;
    }
    if (drift.some(d => d.severity === SEVERITY.ERROR)) {
      return SEVERITY.ERROR;
    }
    if (drift.some(d => d.severity === SEVERITY.WARNING)) {
      return SEVERITY.WARNING;
    }
    return SEVERITY.INFO;
  }

  /**
   * Find files that depend on the given file
   * @param {string} filePath - File to find dependents for
   * @param {Object} dependencies - Dependencies structure from lock file
   * @returns {Array} Dependent file paths
   */
  findDependents(filePath, dependencies) {
    const dependents = [];
    
    // Check template dependencies
    if (dependencies.templates) {
      for (const [template, deps] of Object.entries(dependencies.templates)) {
        if (deps.includes(filePath)) {
          dependents.push(template);
        }
      }
    }
    
    // Check rule dependencies
    if (dependencies.rules) {
      for (const [rule, deps] of Object.entries(dependencies.rules)) {
        if (deps.includes(filePath)) {
          dependents.push(rule);
        }
      }
    }
    
    return dependents;
  }

  /**
   * Analyze semantic changes in RDF files
   * @param {string} filePath - File path to analyze
   * @returns {Promise<Array>} Semantic impact description
   */
  async analyzeSemanticChanges(filePath) {
    const impact = [];
    
    try {
      // Basic heuristics for semantic impact
      const fullPath = resolve(this.projectRoot, filePath);
      const content = readFileSync(fullPath, 'utf8');
      
      // Count triples (rough estimate)
      const tripleCount = (content.match(/\s+\./g) || []).length;
      if (tripleCount > 100) {
        impact.push('Large RDF modification may have significant semantic impact');
      }
      
      // Check for ontology imports
      if (content.includes('@prefix') || content.includes('owl:imports')) {
        impact.push('Ontology structure changes detected');
      }
      
      // Check for SHACL shapes
      if (content.includes('sh:') || content.includes('NodeShape')) {
        impact.push('SHACL validation rules modified');
      }
      
    } catch (error) {
      impact.push('Unable to analyze semantic changes');
    }
    
    return impact;
  }

  /**
   * Check ontology consistency across changes
   * @param {Array} rdfChanges - RDF file changes
   * @returns {Promise<Object>} Consistency check result
   */
  async checkOntologyConsistency(rdfChanges) {
    // Simplified consistency check
    // In a real implementation, this would use a proper RDF reasoner
    
    const issues = [];
    const recommendations = [];
    
    // Check for common issues
    for (const change of rdfChanges) {
      if (change.type === DRIFT_TYPES.RULE_REMOVED) {
        issues.push(`Reasoning rule removed: ${change.file}`);
        recommendations.push('Verify rule removal does not break inference chains');
      }
      
      if (change.file && change.file.includes('ontology')) {
        issues.push(`Core ontology modified: ${change.file}`);
        recommendations.push('Validate ontology consistency with reasoning engine');
      }
    }
    
    return {
      consistent: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Generate drift report
   * @param {Object} driftResult - Drift detection result
   * @param {Object} options - Report options
   * @returns {Object} Formatted drift report
   */
  generateReport(driftResult, options = {}) {
    const format = options.format || 'json';
    const verbose = options.verbose || false;
    
    const report = {
      title: 'KGEN Drift Detection Report',
      timestamp: new Date().toISOString(),
      status: driftResult.status,
      severity: driftResult.severity,
      summary: {
        message: driftResult.message,
        totalChanges: driftResult.drift?.length || 0,
        baseline: driftResult.baseline,
        lastCheck: driftResult.lastCheck
      },
      findings: driftResult.drift || [],
      recommendations: driftResult.recommendations || []
    };
    
    if (verbose && driftResult.details) {
      report.details = driftResult.details;
    }
    
    if (driftResult.summary) {
      report.breakdown = driftResult.summary;
    }
    
    return report;
  }
}

/**
 * Default drift detector instance
 */
export const driftDetector = new DriftDetector();

/**
 * Convenience function to detect drift
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} Drift analysis result
 */
export async function detectDrift(options = {}) {
  const detector = new DriftDetector(options);
  return detector.detect(options);
}

/**
 * Export constants for external use
 */
export { SEVERITY, DRIFT_TYPES };
