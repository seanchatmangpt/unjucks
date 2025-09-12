/**
 * KGEN Drift Detection System
 * Transforms SHACL validation into file artifact drift detection with CI/CD integration
 * 
 * Features:
 * - File artifact vs expected output comparison
 * - Baseline artifact storage and comparison
 * - Non-zero exit codes for CI/CD integration
 * - Drift reporting with detailed changes
 * - Fast fingerprinting and comparison algorithms
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { performance } from 'perf_hooks';
import consola from 'consola';
import { Parser, Store } from 'n3';
import { KGenValidationEngine } from '../validation/index.js';

export class DriftDetector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Exit codes for CI/CD integration
      exitCodes: {
        success: 0,
        drift: 3,        // Non-zero exit code for drift detection
        error: 1
      },
      
      // Drift detection settings
      drift: {
        tolerance: config.tolerance || 0.95,
        algorithm: config.algorithm || 'semantic-hash',
        enableBaseline: config.enableBaseline !== false,
        autoUpdate: config.autoUpdate || false,
        ignorePaths: config.ignorePaths || ['.git', 'node_modules', '.cache'],
        includePatterns: config.includePatterns || ['*.js', '*.ts', '*.ttl', '*.json', '*.md']
      },
      
      // Storage paths
      storage: {
        baselinePath: config.baselinePath || './.kgen/baselines',
        reportsPath: config.reportsPath || './.kgen/drift-reports',
        fingerprintsPath: config.fingerprintsPath || './.kgen/fingerprints'
      },
      
      // Performance tuning
      performance: {
        maxConcurrency: config.maxConcurrency || 4,
        chunkSize: config.chunkSize || 1000,
        cacheSize: config.cacheSize || 1000
      },
      
      ...config
    };

    // Internal state
    this.baselines = new Map();
    this.fingerprints = new Map();
    this.cache = new Map();
    this.stats = {
      filesProcessed: 0,
      driftDetected: 0,
      baselinesCreated: 0,
      baselinesUpdated: 0,
      totalProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    // Reuse SHACL validation engine for constraint checking
    this.validationEngine = new KGenValidationEngine({
      exitCodes: { violations: 0 }, // Don't exit on violations, just report
      validation: { strictMode: false }
    });
    
    this.status = 'uninitialized';
  }

  /**
   * Initialize the drift detection system
   */
  async initialize() {
    try {
      this.status = 'initializing';
      
      // Ensure storage directories exist
      await fs.ensureDir(this.config.storage.baselinePath);
      await fs.ensureDir(this.config.storage.reportsPath);
      await fs.ensureDir(this.config.storage.fingerprintsPath);
      
      // Initialize validation engine
      await this.validationEngine.initialize();
      
      // Load existing baselines and fingerprints
      await this.loadBaselines();
      await this.loadFingerprints();
      
      this.status = 'ready';
      consola.success('✅ Drift Detection System initialized');
      
      this.emit('initialized');
      return { success: true, status: this.status };
      
    } catch (error) {
      this.status = 'error';
      consola.error('❌ Drift Detection initialization failed:', error);
      throw error;
    }
  }

  /**
   * Main drift detection method - detects drift between current artifacts and expected/baseline
   */
  async detectArtifactDrift(options = {}) {
    const detectionId = crypto.randomUUID();
    const startTime = performance.now();
    
    try {
      consola.start(`🔍 Starting artifact drift detection ${detectionId.slice(0, 8)}...`);
      
      const results = {
        detectionId,
        timestamp: this.getDeterministicDate().toISOString(),
        options,
        driftDetected: false,
        exitCode: this.config.exitCodes.success,
        summary: {
          totalFiles: 0,
          filesWithDrift: 0,
          newFiles: 0,
          deletedFiles: 0,
          modifiedFiles: 0,
          totalDifferences: 0
        },
        artifacts: [],
        differences: [],
        recommendations: []
      };

      // Step 1: Discover artifacts to check
      const artifactPaths = await this.discoverArtifacts(options.targetPath || process.cwd(), options);
      results.summary.totalFiles = artifactPaths.length;
      
      // Step 2: Process each artifact for drift
      const processPromises = [];
      for (let i = 0; i < artifactPaths.length; i += this.config.performance.chunkSize) {
        const chunk = artifactPaths.slice(i, i + this.config.performance.chunkSize);
        processPromises.push(this.processArtifactChunk(chunk, options));
      }
      
      const chunkResults = await Promise.all(processPromises);
      
      // Step 3: Aggregate results
      for (const chunkResult of chunkResults) {
        results.artifacts.push(...chunkResult.artifacts);
        results.differences.push(...chunkResult.differences);
        
        results.summary.filesWithDrift += chunkResult.summary.filesWithDrift;
        results.summary.newFiles += chunkResult.summary.newFiles;
        results.summary.deletedFiles += chunkResult.summary.deletedFiles;
        results.summary.modifiedFiles += chunkResult.summary.modifiedFiles;
        results.summary.totalDifferences += chunkResult.summary.totalDifferences;
      }
      
      // Step 4: Determine if drift detected
      results.driftDetected = results.summary.filesWithDrift > 0 || 
                              results.summary.newFiles > 0 || 
                              results.summary.deletedFiles > 0;
      
      // Step 5: Generate recommendations
      results.recommendations = this.generateDriftRecommendations(results);
      
      // Step 6: Set exit code for CI/CD
      results.exitCode = results.driftDetected ? 
        this.config.exitCodes.drift : 
        this.config.exitCodes.success;
      
      // Step 7: Generate detailed report
      const reportPath = await this.generateDriftReport(results);
      results.reportPath = reportPath;
      
      // Update statistics
      const processingTime = performance.now() - startTime;
      this.updateStats(results, processingTime);
      
      consola.success(`✅ Drift detection completed in ${processingTime.toFixed(2)}ms`);
      if (results.driftDetected) {
        consola.warn(`⚠️  Drift detected in ${results.summary.filesWithDrift} files`);
      }
      
      this.emit('drift-detection-completed', results);
      return results;
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      consola.error(`❌ Drift detection ${detectionId.slice(0, 8)} failed:`, error);
      
      const errorResult = {
        detectionId,
        timestamp: this.getDeterministicDate().toISOString(),
        error: error.message,
        exitCode: this.config.exitCodes.error,
        processingTime
      };
      
      this.emit('drift-detection-error', errorResult);
      return errorResult;
    }
  }

  /**
   * Fast artifact fingerprinting using semantic hashing
   */
  async generateArtifactFingerprint(filePath, content = null) {
    try {
      const cacheKey = `fingerprint:${filePath}`;
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        this.stats.cacheHits++;
        return this.cache.get(cacheKey);
      }
      
      this.stats.cacheMisses++;
      
      // Read content if not provided
      if (content === null) {
        if (!await fs.pathExists(filePath)) {
          return null;
        }
        content = await fs.readFile(filePath, 'utf8');
      }
      
      const ext = path.extname(filePath).toLowerCase();
      let fingerprint = {
        path: filePath,
        size: content.length,
        hash: crypto.createHash('sha256').update(content).digest('hex'),
        timestamp: this.getDeterministicDate().toISOString(),
        type: this.getFileType(ext),
        semanticHash: null
      };
      
      // Generate semantic hash based on file type
      switch (ext) {
        case '.ttl':
        case '.rdf':
        case '.owl':
          fingerprint.semanticHash = await this.generateRDFSemanticHash(content);
          break;
        case '.json':
          fingerprint.semanticHash = await this.generateJSONSemanticHash(content);
          break;
        case '.js':
        case '.ts':
          fingerprint.semanticHash = await this.generateCodeSemanticHash(content);
          break;
        default:
          fingerprint.semanticHash = this.generateContentHash(content);
      }
      
      // Cache result
      if (this.cache.size >= this.config.performance.cacheSize) {
        // Simple LRU eviction
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, fingerprint);
      
      return fingerprint;
      
    } catch (error) {
      consola.warn(`⚠️  Failed to generate fingerprint for ${filePath}:`, error.message);
      return {
        path: filePath,
        error: error.message,
        hash: null,
        timestamp: this.getDeterministicDate().toISOString()
      };
    }
  }

  /**
   * RDF semantic hashing - reuses SHACL validation parsing
   */
  async generateRDFSemanticHash(content) {
    try {
      // Use validation engine's RDF parsing
      const store = await this.validationEngine.parseRDF(content, 'turtle');
      
      // Create normalized triples for semantic comparison
      const normalizedTriples = Array.from(store).map(quad => ({
        subject: this.normalizeRDFTerm(quad.subject),
        predicate: this.normalizeRDFTerm(quad.predicate),
        object: this.normalizeRDFTerm(quad.object)
      })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      
      const semanticContent = JSON.stringify(normalizedTriples);
      return crypto.createHash('sha256').update(semanticContent).digest('hex');
      
    } catch (error) {
      // Fallback to content hash if RDF parsing fails
      return this.generateContentHash(content);
    }
  }

  /**
   * JSON semantic hashing
   */
  async generateJSONSemanticHash(content) {
    try {
      const parsed = JSON.parse(content);
      const normalized = JSON.stringify(parsed, Object.keys(parsed).sort());
      return crypto.createHash('sha256').update(normalized).digest('hex');
    } catch (error) {
      return this.generateContentHash(content);
    }
  }

  /**
   * Code semantic hashing (basic AST-like approach)
   */
  async generateCodeSemanticHash(content) {
    // Simple approach: normalize whitespace and comments
    const normalized = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '')          // Remove line comments
      .replace(/\s+/g, ' ')              // Normalize whitespace
      .trim();
    
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Content-based hash (fallback)
   */
  generateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Compare two artifact fingerprints
   */
  compareFingerprints(baseline, current) {
    if (!baseline || !current) {
      return {
        identical: false,
        similarity: 0,
        differences: [{
          type: baseline ? 'file-deleted' : 'file-added',
          severity: 'major',
          description: baseline ? 'File no longer exists' : 'New file detected'
        }]
      };
    }
    
    const differences = [];
    let similarity = 1.0;
    
    // Content hash comparison
    if (baseline.hash !== current.hash) {
      differences.push({
        type: 'content-changed',
        severity: 'major',
        description: 'File content has changed',
        baseline: baseline.hash,
        current: current.hash
      });
    }
    
    // Semantic hash comparison (more important)
    if (baseline.semanticHash !== current.semanticHash) {
      differences.push({
        type: 'semantic-change',
        severity: 'critical',
        description: 'Semantic meaning of file has changed',
        baseline: baseline.semanticHash,
        current: current.semanticHash
      });
      similarity *= 0.5; // Major impact on similarity
    }
    
    // Size comparison
    if (baseline.size !== current.size) {
      const sizeChange = Math.abs(current.size - baseline.size) / baseline.size;
      if (sizeChange > 0.1) { // 10% size change threshold
        differences.push({
          type: 'size-changed',
          severity: sizeChange > 0.5 ? 'major' : 'minor',
          description: `File size changed by ${(sizeChange * 100).toFixed(1)}%`,
          baseline: baseline.size,
          current: current.size
        });
        similarity *= Math.max(0.1, 1 - sizeChange);
      }
    }
    
    return {
      identical: differences.length === 0,
      similarity,
      differences
    };
  }

  /**
   * Process a chunk of artifacts for drift detection
   */
  async processArtifactChunk(artifactPaths, options) {
    const results = {
      artifacts: [],
      differences: [],
      summary: {
        filesWithDrift: 0,
        newFiles: 0,
        deletedFiles: 0,
        modifiedFiles: 0,
        totalDifferences: 0
      }
    };
    
    const promises = artifactPaths.map(async (artifactPath) => {
      try {
        const artifact = await this.processArtifact(artifactPath, options);
        results.artifacts.push(artifact);
        
        if (artifact.driftDetected) {
          results.summary.filesWithDrift++;
          results.differences.push(...artifact.differences);
          results.summary.totalDifferences += artifact.differences.length;
          
          // Categorize drift type
          if (artifact.status === 'new') {
            results.summary.newFiles++;
          } else if (artifact.status === 'deleted') {
            results.summary.deletedFiles++;
          } else if (artifact.status === 'modified') {
            results.summary.modifiedFiles++;
          }
        }
        
        return artifact;
      } catch (error) {
        consola.warn(`⚠️  Failed to process artifact ${artifactPath}:`, error.message);
        return {
          path: artifactPath,
          error: error.message,
          driftDetected: false,
          differences: []
        };
      }
    });
    
    await Promise.all(promises);
    return results;
  }

  /**
   * Process a single artifact for drift detection
   */
  async processArtifact(artifactPath, options) {
    const artifact = {
      path: artifactPath,
      driftDetected: false,
      status: 'unchanged',
      differences: [],
      fingerprint: null,
      baseline: null,
      similarity: 1.0,
      recommendations: []
    };
    
    try {
      // Generate current fingerprint
      artifact.fingerprint = await this.generateArtifactFingerprint(artifactPath);
      
      // Compare with expected data if provided
      if (options.expectedData && options.expectedData[artifactPath]) {
        const expectedFingerprint = await this.generateArtifactFingerprint(
          artifactPath, 
          options.expectedData[artifactPath]
        );
        
        const comparison = this.compareFingerprints(expectedFingerprint, artifact.fingerprint);
        artifact.similarity = comparison.similarity;
        artifact.differences = comparison.differences;
        artifact.driftDetected = !comparison.identical;
        
        if (artifact.driftDetected) {
          artifact.status = 'modified';
        }
      }
      
      // Compare with baseline if available
      const baselineKey = this.getBaselineKey(artifactPath);
      if (this.baselines.has(baselineKey)) {
        artifact.baseline = this.baselines.get(baselineKey);
        
        const baselineComparison = this.compareFingerprints(
          artifact.baseline.fingerprint, 
          artifact.fingerprint
        );
        
        if (!baselineComparison.identical) {
          artifact.driftDetected = true;
          artifact.status = 'modified';
          artifact.similarity = Math.min(artifact.similarity, baselineComparison.similarity);
          artifact.differences.push(...baselineComparison.differences);
        }
      } else if (this.config.drift.enableBaseline && artifact.fingerprint) {
        // No baseline exists - this is a new file
        artifact.driftDetected = true;
        artifact.status = 'new';
        artifact.differences.push({
          type: 'new-file',
          severity: 'minor',
          description: 'File has no baseline - treating as new'
        });
        
        // Auto-create baseline if enabled
        if (this.config.drift.autoUpdate) {
          await this.updateBaseline(artifactPath, artifact.fingerprint);
          artifact.recommendations.push('Baseline auto-created for new file');
        }
      }
      
      // Check if similarity is below tolerance
      if (artifact.similarity < this.config.drift.tolerance) {
        artifact.driftDetected = true;
        artifact.differences.push({
          type: 'similarity-threshold',
          severity: 'major',
          description: `Similarity ${artifact.similarity.toFixed(3)} below threshold ${this.config.drift.tolerance}`,
          threshold: this.config.drift.tolerance,
          actual: artifact.similarity
        });
      }
      
      this.stats.filesProcessed++;
      return artifact;
      
    } catch (error) {
      artifact.error = error.message;
      artifact.driftDetected = true;
      artifact.status = 'error';
      return artifact;
    }
  }

  /**
   * Discover artifacts to check for drift
   */
  async discoverArtifacts(targetPath, options = {}) {
    const artifacts = [];
    const stats = await fs.stat(targetPath);
    
    if (stats.isFile()) {
      // Single file
      artifacts.push(targetPath);
    } else if (stats.isDirectory()) {
      // Directory - recursive discovery
      artifacts.push(...await this.discoverDirectoryArtifacts(targetPath, options));
    }
    
    return artifacts.filter(this.shouldProcessArtifact.bind(this));
  }

  /**
   * Recursively discover artifacts in directory
   */
  async discoverDirectoryArtifacts(dirPath, options = {}) {
    const artifacts = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip ignored directories
        if (this.shouldSkipDirectory(entry.name)) {
          continue;
        }
        
        // Recursive discovery
        artifacts.push(...await this.discoverDirectoryArtifacts(fullPath, options));
      } else if (entry.isFile()) {
        artifacts.push(fullPath);
      }
    }
    
    return artifacts;
  }

  /**
   * Check if artifact should be processed
   */
  shouldProcessArtifact(artifactPath) {
    const filename = path.basename(artifactPath);
    const ext = path.extname(filename);
    
    // Check include patterns
    if (this.config.drift.includePatterns.length > 0) {
      const included = this.config.drift.includePatterns.some(pattern => {
        return filename.includes(pattern.replace('*', '')) || 
               ext === pattern.replace('*', '');
      });
      if (!included) return false;
    }
    
    // Check ignore paths
    for (const ignorePath of this.config.drift.ignorePaths) {
      if (artifactPath.includes(ignorePath)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if directory should be skipped
   */
  shouldSkipDirectory(dirName) {
    return this.config.drift.ignorePaths.includes(dirName);
  }

  /**
   * Baseline management
   */
  async updateBaseline(artifactPath, fingerprint) {
    const key = this.getBaselineKey(artifactPath);
    
    const baseline = {
      path: artifactPath,
      fingerprint,
      timestamp: this.getDeterministicDate().toISOString(),
      version: '1.0.0'
    };
    
    this.baselines.set(key, baseline);
    await this.saveBaselines();
    
    if (fingerprint) {
      this.stats.baselinesUpdated++;
    } else {
      this.stats.baselinesCreated++;
    }
    
    this.emit('baseline-updated', { key, baseline });
  }

  getBaselineKey(artifactPath) {
    return crypto.createHash('md5').update(artifactPath).digest('hex');
  }

  async loadBaselines() {
    const baselinePath = path.join(this.config.storage.baselinePath, 'baselines.json');
    if (await fs.pathExists(baselinePath)) {
      const data = await fs.readJson(baselinePath);
      this.baselines = new Map(Object.entries(data));
    }
  }

  async saveBaselines() {
    const baselinePath = path.join(this.config.storage.baselinePath, 'baselines.json');
    const data = Object.fromEntries(this.baselines);
    await fs.writeJson(baselinePath, data, { spaces: 2 });
  }

  async loadFingerprints() {
    const fingerprintPath = path.join(this.config.storage.fingerprintsPath, 'fingerprints.json');
    if (await fs.pathExists(fingerprintPath)) {
      const data = await fs.readJson(fingerprintPath);
      this.fingerprints = new Map(Object.entries(data));
    }
  }

  async saveFingerprints() {
    const fingerprintPath = path.join(this.config.storage.fingerprintsPath, 'fingerprints.json');
    const data = Object.fromEntries(this.fingerprints);
    await fs.writeJson(fingerprintPath, data, { spaces: 2 });
  }

  /**
   * Generate comprehensive drift report
   */
  async generateDriftReport(results) {
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    const reportFilename = `drift-report-${timestamp}.json`;
    const reportPath = path.join(this.config.storage.reportsPath, reportFilename);

    const report = {
      metadata: {
        kgenVersion: '1.0.0',
        detectionId: results.detectionId,
        timestamp: results.timestamp,
        algorithm: this.config.drift.algorithm,
        tolerance: this.config.drift.tolerance,
        configuration: this.config
      },
      summary: results.summary,
      exitCode: results.exitCode,
      driftDetected: results.driftDetected,
      artifacts: results.artifacts,
      differences: results.differences,
      recommendations: results.recommendations,
      statistics: this.getStats(),
      cicdIntegration: {
        exitCode: results.exitCode,
        shouldFail: results.driftDetected && results.exitCode !== 0,
        message: this.generateCICDMessage(results)
      }
    };

    // Add human-readable summary
    report.humanReadable = this.generateHumanReadableSummary(results);

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Also generate text summary
    const textSummary = this.generateTextSummary(results);
    const textReportPath = reportPath.replace('.json', '.txt');
    await fs.writeFile(textReportPath, textSummary);

    return reportPath;
  }

  /**
   * Generate CI/CD friendly message
   */
  generateCICDMessage(results) {
    if (!results.driftDetected) {
      return '✅ No artifact drift detected - all files match expected state';
    }

    const messages = [
      `❌ Artifact drift detected in ${results.summary.filesWithDrift} files`,
      `   - New files: ${results.summary.newFiles}`,
      `   - Modified files: ${results.summary.modifiedFiles}`,
      `   - Deleted files: ${results.summary.deletedFiles}`,
      `   - Total differences: ${results.summary.totalDifferences}`
    ];

    if (results.exitCode === this.config.exitCodes.drift) {
      messages.push(`🚨 Failing CI/CD build (exit code: ${results.exitCode})`);
    }

    return messages.join('\n');
  }

  /**
   * Generate drift recommendations
   */
  generateDriftRecommendations(results) {
    const recommendations = [];
    
    if (results.summary.newFiles > 0) {
      recommendations.push({
        type: 'new-files',
        priority: 'medium',
        message: `Consider updating baselines for ${results.summary.newFiles} new files`,
        action: 'kgen artifact baseline update'
      });
    }
    
    if (results.summary.modifiedFiles > 0) {
      recommendations.push({
        type: 'modified-files',
        priority: 'high',
        message: `Review changes in ${results.summary.modifiedFiles} modified files`,
        action: 'Check if modifications are intentional and update baselines if needed'
      });
    }
    
    if (results.summary.deletedFiles > 0) {
      recommendations.push({
        type: 'deleted-files',
        priority: 'high',
        message: `Verify if ${results.summary.deletedFiles} deleted files should be removed`,
        action: 'Clean up baselines for deleted files or restore missing files'
      });
    }
    
    if (results.summary.totalDifferences > 100) {
      recommendations.push({
        type: 'mass-changes',
        priority: 'critical',
        message: `Large number of differences (${results.summary.totalDifferences}) detected`,
        action: 'Consider if this is due to a major refactor or migration'
      });
    }
    
    return recommendations;
  }

  generateTextSummary(results) {
    const lines = [
      '='.repeat(60),
      'KGEN ARTIFACT DRIFT DETECTION REPORT',
      '='.repeat(60),
      `Detection ID: ${results.detectionId}`,
      `Timestamp: ${results.timestamp}`,
      `Exit Code: ${results.exitCode}`,
      '',
      'SUMMARY:',
      `- Total Files: ${results.summary.totalFiles}`,
      `- Files with Drift: ${results.summary.filesWithDrift}`,
      `- New Files: ${results.summary.newFiles}`,
      `- Modified Files: ${results.summary.modifiedFiles}`,
      `- Deleted Files: ${results.summary.deletedFiles}`,
      `- Total Differences: ${results.summary.totalDifferences}`,
      '',
      `DRIFT DETECTED: ${results.driftDetected ? 'YES' : 'NO'}`,
      ''
    ];

    if (results.driftDetected && results.artifacts.length > 0) {
      lines.push('FILES WITH DRIFT:');
      results.artifacts
        .filter(a => a.driftDetected)
        .slice(0, 10)
        .forEach(artifact => {
          lines.push(`  - ${artifact.path} (${artifact.status}): ${artifact.differences.length} differences`);
        });
      
      if (results.summary.filesWithDrift > 10) {
        lines.push(`  ... and ${results.summary.filesWithDrift - 10} more files`);
      }
      lines.push('');
    }

    if (results.recommendations.length > 0) {
      lines.push('RECOMMENDATIONS:');
      results.recommendations.forEach(rec => {
        lines.push(`  - [${rec.priority.toUpperCase()}] ${rec.message}`);
      });
      lines.push('');
    }

    lines.push('='.repeat(60));
    return lines.join('\n');
  }

  generateHumanReadableSummary(results) {
    let summary = `Drift Detection ${results.detectionId.slice(0, 8)} `;
    
    if (!results.driftDetected) {
      summary += '✅ PASSED - No drift detected';
    } else {
      summary += `❌ FAILED - Drift detected in ${results.summary.filesWithDrift} files`;
    }

    summary += `\n\nProcessed ${results.summary.totalFiles} files:\n`;
    summary += `- New: ${results.summary.newFiles}\n`;
    summary += `- Modified: ${results.summary.modifiedFiles}\n`;
    summary += `- Deleted: ${results.summary.deletedFiles}\n`;
    summary += `- Total Differences: ${results.summary.totalDifferences}\n`;

    return summary;
  }

  /**
   * Utility methods
   */
  normalizeRDFTerm(term) {
    return {
      type: term.termType,
      value: term.value,
      datatype: term.datatype?.value,
      language: term.language
    };
  }

  getFileType(ext) {
    const types = {
      '.ttl': 'rdf',
      '.rdf': 'rdf',
      '.owl': 'rdf',
      '.n3': 'rdf',
      '.json': 'json',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.md': 'markdown',
      '.txt': 'text',
      '.yml': 'yaml',
      '.yaml': 'yaml'
    };
    return types[ext] || 'unknown';
  }

  updateStats(results, processingTime) {
    this.stats.totalProcessingTime += processingTime;
    if (results.driftDetected) {
      this.stats.driftDetected++;
    }
  }

  getStats() {
    return {
      ...this.stats,
      cacheEfficiency: this.stats.cacheHits > 0 ? 
        (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100 : 0,
      averageProcessingTime: this.stats.filesProcessed > 0 ? 
        this.stats.totalProcessingTime / this.stats.filesProcessed : 0
    };
  }

  /**
   * Health check and shutdown
   */
  async healthCheck() {
    return {
      status: this.status,
      stats: this.getStats(),
      config: this.config,
      baselinesLoaded: this.baselines.size,
      fingerprintsLoaded: this.fingerprints.size,
      cacheSize: this.cache.size
    };
  }

  async shutdown() {
    this.status = 'shutting-down';
    
    // Save state
    await this.saveBaselines();
    await this.saveFingerprints();
    
    // Shutdown validation engine
    await this.validationEngine.shutdown();
    
    // Clear caches
    this.baselines.clear();
    this.fingerprints.clear();
    this.cache.clear();
    
    this.removeAllListeners();
    this.status = 'shutdown';
    
    consola.info('🛑 Drift Detection System shutdown complete');
  }
}

// Export exit codes for CLI integration
export const DriftExitCodes = {
  SUCCESS: 0,
  DRIFT_DETECTED: 3,
  ERROR: 1
};

export default DriftDetector;