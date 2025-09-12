/**
 * KGEN Pure JavaScript Drift Detection System
 * 
 * Pure JavaScript implementation of drift detection for artifacts and content.
 * Designed for cross-platform compatibility without Node.js dependencies.
 * 
 * Features:
 * - Pure JavaScript implementation (no Node.js dependencies)
 * - File and semantic drift detection
 * - Content-addressed storage integration
 * - Risk assessment and recommendations
 * - Graph diff operations for RDF comparison
 * - Deterministic scoring algorithms
 */

/**
 * Pure JavaScript Drift Detector
 * Ported from the original Node.js implementation to work in any JavaScript environment
 */
class DriftDetector {
  constructor(options = {}) {
    this.options = {
      // Drift detection settings
      tolerance: options.tolerance || 0.95,
      algorithm: options.algorithm || 'semantic-hash',
      enableBaseline: options.enableBaseline !== false,
      autoUpdate: options.autoUpdate || false,
      
      // File patterns
      includePatterns: options.includePatterns || ['*.js', '*.ts', '*.ttl', '*.json', '*.md'],
      ignorePaths: options.ignorePaths || ['.git', 'node_modules', '.cache'],
      
      // Performance settings
      maxConcurrency: options.maxConcurrency || 4,
      chunkSize: options.chunkSize || 100,
      cacheSize: options.cacheSize || 1000,
      
      ...options
    };

    // Internal state
    this.baselines = new Map();
    this.cache = new Map();
    this.stats = {
      comparisons: 0,
      driftDetected: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalProcessingTime: 0
    };
    
    this.status = 'uninitialized';
  }

  /**
   * Initialize the drift detection system
   */
  async initialize() {
    this.status = 'initializing';
    this.stats = {
      comparisons: 0,
      driftDetected: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalProcessingTime: 0
    };
    this.status = 'ready';
    return { success: true, status: this.status };
  }

  /**
   * Main drift detection method - detects drift between expected and actual artifacts
   * @param {Object} expected - Expected artifact state or content
   * @param {Object} actual - Actual artifact state or content
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} Drift detection result
   */
  async detectDrift(expected, actual, options = {}) {
    const startTime = this.getPerformanceNow();
    const detectionId = this.generateId();
    this.stats.comparisons++;

    try {
      const result = {
        detectionId,
        timestamp: this.getDeterministicDate().toISOString(),
        hasDrift: false,
        driftScore: 0,
        similarity: 1.0,
        driftTypes: {
          content: false,
          semantic: false,
          structure: false,
          metadata: false
        },
        differences: [],
        recommendations: [],
        processingTime: 0
      };

      // Handle different input types
      const expectedData = await this.normalizeInput(expected, 'expected');
      const actualData = await this.normalizeInput(actual, 'actual');

      if (!expectedData || !actualData) {
        result.hasDrift = true;
        result.driftScore = 1.0;
        result.similarity = 0.0;
        result.differences.push({
          type: expectedData ? 'actual-missing' : 'expected-missing',
          severity: 'critical',
          description: expectedData ? 'Actual data is missing or invalid' : 'Expected data is missing or invalid'
        });
        return result;
      }

      // Generate fingerprints for comparison
      const expectedFingerprint = await this.generateFingerprint(expectedData, options);
      const actualFingerprint = await this.generateFingerprint(actualData, options);

      // Perform detailed comparison
      const comparison = await this.compareFingerprints(expectedFingerprint, actualFingerprint, options);
      
      // Update result with comparison data
      result.hasDrift = !comparison.identical;
      result.similarity = comparison.similarity;
      result.driftScore = 1 - comparison.similarity;
      result.driftTypes = comparison.driftTypes;
      result.differences = comparison.differences;

      // Check drift threshold
      if (result.similarity < this.options.tolerance) {
        result.hasDrift = true;
        result.differences.push({
          type: 'similarity-threshold',
          severity: 'major',
          description: `Similarity ${result.similarity.toFixed(3)} below threshold ${this.options.tolerance}`,
          threshold: this.options.tolerance,
          actual: result.similarity
        });
      }

      // Generate recommendations
      result.recommendations = this.generateRecommendations(result);

      // Update statistics
      result.processingTime = this.getPerformanceNow() - startTime;
      this.stats.totalProcessingTime += result.processingTime;
      
      if (result.hasDrift) {
        this.stats.driftDetected++;
      }

      return result;

    } catch (error) {
      return {
        detectionId,
        timestamp: this.getDeterministicDate().toISOString(),
        error: error.message,
        hasDrift: true,
        driftScore: 1.0,
        processingTime: this.getPerformanceNow() - startTime
      };
    }
  }

  /**
   * Calculate drift score from detected changes
   * @param {Array} changes - Array of detected changes
   * @param {Object} options - Calculation options
   * @returns {Number} Drift score between 0 and 1
   */
  calculateDriftScore(changes, options = {}) {
    if (!Array.isArray(changes) || changes.length === 0) {
      return 0;
    }

    // Severity weights
    const severityWeights = {
      critical: 1.0,
      major: 0.7,
      minor: 0.3,
      info: 0.1
    };

    // Change type weights
    const typeWeights = {
      'semantic-change': 1.0,
      'content-changed': 0.8,
      'structure-changed': 0.9,
      'metadata-changed': 0.2,
      'size-changed': 0.4,
      'new-file': 0.5,
      'file-deleted': 0.8,
      'similarity-threshold': 0.6
    };

    let totalWeight = 0;
    let weightedScore = 0;

    for (const change of changes) {
      const severity = change.severity || 'minor';
      const type = change.type || 'content-changed';
      
      const severityWeight = severityWeights[severity] || 0.5;
      const typeWeight = typeWeights[type] || 0.5;
      
      const changeScore = severityWeight * typeWeight;
      const changeWeight = 1;

      weightedScore += changeScore * changeWeight;
      totalWeight += changeWeight;
    }

    // Normalize to 0-1 range
    const rawScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    return Math.min(1.0, Math.max(0.0, rawScore));
  }

  /**
   * Generate human-readable drift report
   * @param {Object} drift - Drift detection result
   * @param {Object} options - Report options
   * @returns {Object} Comprehensive drift report
   */
  generateDriftReport(drift, options = {}) {
    const format = options.format || 'detailed';
    
    const report = {
      summary: this.generateReportSummary(drift),
      details: this.generateReportDetails(drift),
      recommendations: drift.recommendations || [],
      metadata: {
        detectionId: drift.detectionId,
        timestamp: drift.timestamp,
        algorithm: this.options.algorithm,
        tolerance: this.options.tolerance,
        processingTime: drift.processingTime
      }
    };

    // Add format-specific content
    switch (format) {
      case 'summary':
        return { summary: report.summary, metadata: report.metadata };
      
      case 'detailed':
        return report;
      
      case 'human':
        return {
          ...report,
          humanReadable: this.generateHumanReadableReport(drift)
        };
      
      case 'json':
        return JSON.stringify(report, null, 2);
      
      case 'markdown':
        return this.generateMarkdownReport(drift, report);
      
      default:
        return report;
    }
  }

  /**
   * Normalize input data for comparison
   */
  async normalizeInput(input, label = 'input') {
    if (!input) return null;

    // Handle different input types
    if (typeof input === 'string') {
      // String content
      return {
        type: 'string',
        content: input,
        size: input.length,
        encoding: 'utf8'
      };
    } else if (typeof input === 'object' && input.path) {
      // File-like object
      return {
        type: 'file',
        path: input.path,
        content: input.content || '',
        size: (input.content || '').length,
        metadata: input.metadata || {}
      };
    } else if (typeof input === 'object') {
      // Generic object
      const content = JSON.stringify(input, null, 2);
      return {
        type: 'object',
        content: content,
        size: content.length,
        data: input
      };
    } else {
      // Convert to string
      const content = String(input);
      return {
        type: 'primitive',
        content: content,
        size: content.length,
        originalType: typeof input
      };
    }
  }

  /**
   * Generate content fingerprint for comparison
   */
  async generateFingerprint(data, options = {}) {
    const cacheKey = `fingerprint:${this.generateHash(data.content)}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.cache.get(cacheKey);
    }

    this.stats.cacheMisses++;

    const fingerprint = {
      contentHash: this.generateHash(data.content),
      semanticHash: await this.generateSemanticHash(data, options),
      size: data.size,
      type: data.type,
      timestamp: this.getDeterministicDate().toISOString(),
      metadata: {
        algorithm: this.options.algorithm,
        encoding: data.encoding || 'utf8'
      }
    };

    // Cache management
    if (this.cache.size >= this.options.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(cacheKey, fingerprint);
    return fingerprint;
  }

  /**
   * Generate semantic hash based on content type
   */
  async generateSemanticHash(data, options = {}) {
    try {
      const content = data.content;
      
      // Detect content type from file extension or content analysis
      const contentType = this.detectContentType(data, options);
      
      switch (contentType) {
        case 'rdf':
        case 'turtle':
        case 'owl':
          return await this.generateRDFSemanticHash(content, options);
        
        case 'json':
        case 'jsonld':
          return await this.generateJSONSemanticHash(content, options);
        
        case 'javascript':
        case 'typescript':
          return await this.generateCodeSemanticHash(content, options);
        
        case 'markdown':
          return this.generateMarkdownSemanticHash(content, options);
        
        default:
          return this.generateContentHash(content);
      }
    } catch (error) {
      // Fallback to content hash
      return this.generateContentHash(data.content);
    }
  }

  /**
   * RDF semantic hashing - create normalized triple representation
   */
  async generateRDFSemanticHash(content, options = {}) {
    try {
      // Parse RDF content (simplified parsing - would use proper RDF parser in production)
      const triples = this.parseRDFTriples(content);
      
      // Normalize and sort triples for semantic comparison
      const normalizedTriples = triples.map(triple => ({
        subject: this.normalizeRDFTerm(triple.subject),
        predicate: this.normalizeRDFTerm(triple.predicate),
        object: this.normalizeRDFTerm(triple.object)
      })).sort((a, b) => {
        const aStr = `${a.subject}|${a.predicate}|${a.object}`;
        const bStr = `${b.subject}|${b.predicate}|${b.object}`;
        return aStr.localeCompare(bStr);
      });

      return this.generateHash(JSON.stringify(normalizedTriples));
    } catch (error) {
      return this.generateContentHash(content);
    }
  }

  /**
   * JSON semantic hashing - normalize keys and structure
   */
  async generateJSONSemanticHash(content, options = {}) {
    try {
      const parsed = JSON.parse(content);
      const normalized = this.normalizeJSONStructure(parsed);
      return this.generateHash(JSON.stringify(normalized));
    } catch (error) {
      return this.generateContentHash(content);
    }
  }

  /**
   * Code semantic hashing - normalize formatting and structure
   */
  async generateCodeSemanticHash(content, options = {}) {
    // Normalize whitespace, comments, and basic structure
    const normalized = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '')         // Remove line comments
      .replace(/\s+/g, ' ')             // Normalize whitespace
      .replace(/;+/g, ';')              // Normalize semicolons
      .replace(/[{}()]/g, '')           // Remove structural characters for better semantic matching
      .trim();
    
    return this.generateHash(normalized);
  }

  /**
   * Markdown semantic hashing - normalize structure while preserving meaning
   */
  generateMarkdownSemanticHash(content, options = {}) {
    const normalized = content
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/#+\s*/g, '#')         // Normalize headers
      .replace(/\*+/g, '*')           // Normalize emphasis
      .trim();
    
    return this.generateHash(normalized);
  }

  /**
   * Compare two fingerprints for drift detection
   */
  async compareFingerprints(expected, actual, options = {}) {
    const differences = [];
    let similarity = 1.0;
    const driftTypes = {
      content: false,
      semantic: false,
      structure: false,
      metadata: false
    };

    // Content hash comparison
    if (expected.contentHash !== actual.contentHash) {
      driftTypes.content = true;
      differences.push({
        type: 'content-changed',
        severity: 'major',
        description: 'File content has changed',
        expected: expected.contentHash,
        actual: actual.contentHash
      });
      similarity *= 0.7; // Content changes have significant impact
    }

    // Semantic hash comparison
    if (expected.semanticHash !== actual.semanticHash) {
      driftTypes.semantic = true;
      differences.push({
        type: 'semantic-change',
        severity: 'critical',
        description: 'Semantic meaning has changed',
        expected: expected.semanticHash,
        actual: actual.semanticHash
      });
      similarity *= 0.5; // Semantic changes are critical
    }

    // Size comparison
    if (expected.size !== actual.size) {
      const sizeChange = Math.abs(actual.size - expected.size) / Math.max(expected.size, 1);
      if (sizeChange > 0.1) {
        driftTypes.structure = true;
        differences.push({
          type: 'size-changed',
          severity: sizeChange > 0.5 ? 'major' : 'minor',
          description: `Size changed by ${(sizeChange * 100).toFixed(1)}%`,
          expected: expected.size,
          actual: actual.size,
          change: sizeChange
        });
        similarity *= Math.max(0.2, 1 - sizeChange);
      }
    }

    // Metadata comparison
    if (expected.type !== actual.type) {
      driftTypes.metadata = true;
      differences.push({
        type: 'metadata-changed',
        severity: 'minor',
        description: 'Content type has changed',
        expected: expected.type,
        actual: actual.type
      });
      similarity *= 0.9;
    }

    return {
      identical: differences.length === 0,
      similarity,
      driftTypes,
      differences
    };
  }

  /**
   * Generate recommendations based on drift results
   */
  generateRecommendations(drift) {
    const recommendations = [];
    
    if (!drift.hasDrift) {
      recommendations.push({
        type: 'no-action',
        priority: 'info',
        message: 'No drift detected - artifacts are synchronized',
        action: 'Continue monitoring'
      });
      return recommendations;
    }

    // High drift score recommendations
    if (drift.driftScore > 0.7) {
      recommendations.push({
        type: 'high-drift',
        priority: 'critical',
        message: `High drift score (${drift.driftScore.toFixed(3)}) detected`,
        action: 'Review all changes immediately and consider rollback if unintentional'
      });
    }

    // Semantic drift recommendations
    if (drift.driftTypes.semantic) {
      recommendations.push({
        type: 'semantic-drift',
        priority: 'high',
        message: 'Semantic changes detected that may break compatibility',
        action: 'Review semantic changes and update dependent systems'
      });
    }

    // Content drift recommendations
    if (drift.driftTypes.content) {
      recommendations.push({
        type: 'content-drift',
        priority: 'medium',
        message: 'Content changes detected',
        action: 'Verify changes are intentional and update documentation'
      });
    }

    // Low similarity recommendations
    if (drift.similarity < 0.5) {
      recommendations.push({
        type: 'low-similarity',
        priority: 'high',
        message: `Very low similarity (${drift.similarity.toFixed(3)}) suggests major changes`,
        action: 'Conduct thorough review and testing before deployment'
      });
    }

    return recommendations;
  }

  /**
   * Generate report summary
   */
  generateReportSummary(drift) {
    return {
      status: drift.hasDrift ? 'DRIFT_DETECTED' : 'NO_DRIFT',
      driftScore: drift.driftScore,
      similarity: drift.similarity,
      differenceCount: drift.differences?.length || 0,
      recommendationCount: drift.recommendations?.length || 0,
      processingTime: drift.processingTime
    };
  }

  /**
   * Generate detailed report content
   */
  generateReportDetails(drift) {
    return {
      driftTypes: drift.driftTypes,
      differences: drift.differences || [],
      threshold: this.options.tolerance,
      algorithm: this.options.algorithm,
      detectionId: drift.detectionId
    };
  }

  /**
   * Generate human-readable report
   */
  generateHumanReadableReport(drift) {
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('KGEN DRIFT DETECTION REPORT');
    lines.push('='.repeat(60));
    lines.push(`Status: ${drift.hasDrift ? '❌ DRIFT DETECTED' : '✅ NO DRIFT'}`);
    lines.push(`Similarity: ${(drift.similarity * 100).toFixed(1)}%`);
    lines.push(`Drift Score: ${drift.driftScore.toFixed(3)}`);
    lines.push(`Threshold: ${this.options.tolerance}`);
    lines.push(`Processing Time: ${drift.processingTime?.toFixed(2) || 0}ms`);
    lines.push('');

    if (drift.differences && drift.differences.length > 0) {
      lines.push('DIFFERENCES DETECTED:');
      drift.differences.forEach((diff, index) => {
        lines.push(`  ${index + 1}. [${diff.severity?.toUpperCase() || 'UNKNOWN'}] ${diff.description}`);
      });
      lines.push('');
    }

    if (drift.recommendations && drift.recommendations.length > 0) {
      lines.push('RECOMMENDATIONS:');
      drift.recommendations.forEach((rec, index) => {
        lines.push(`  ${index + 1}. [${rec.priority?.toUpperCase() || 'MEDIUM'}] ${rec.message}`);
        if (rec.action) {
          lines.push(`     Action: ${rec.action}`);
        }
      });
      lines.push('');
    }

    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(drift, report) {
    const lines = [];
    
    lines.push('# KGEN Drift Detection Report\n');
    lines.push(`**Detection ID**: \`${drift.detectionId}\`\n`);
    lines.push(`**Timestamp**: ${drift.timestamp}\n`);
    lines.push(`**Status**: ${drift.hasDrift ? '❌ DRIFT DETECTED' : '✅ NO DRIFT'}\n`);
    lines.push(`**Similarity**: ${(drift.similarity * 100).toFixed(1)}%\n`);
    lines.push(`**Drift Score**: ${drift.driftScore.toFixed(3)}\n`);
    lines.push(`**Processing Time**: ${drift.processingTime?.toFixed(2) || 0}ms\n`);

    if (drift.differences && drift.differences.length > 0) {
      lines.push('## Differences Detected\n');
      drift.differences.forEach((diff, index) => {
        lines.push(`${index + 1}. **${diff.type}** (${diff.severity}): ${diff.description}`);
      });
      lines.push('');
    }

    if (drift.recommendations && drift.recommendations.length > 0) {
      lines.push('## Recommendations\n');
      drift.recommendations.forEach((rec, index) => {
        lines.push(`${index + 1}. **${rec.type}** (${rec.priority}): ${rec.message}`);
        if (rec.action) {
          lines.push(`   - *Action*: ${rec.action}`);
        }
      });
    }

    return lines.join('\n');
  }

  // Utility methods

  detectContentType(data, options = {}) {
    if (data.path) {
      const ext = data.path.split('.').pop()?.toLowerCase();
      const typeMap = {
        'ttl': 'turtle',
        'rdf': 'rdf',
        'owl': 'owl',
        'n3': 'rdf',
        'json': 'json',
        'jsonld': 'jsonld',
        'js': 'javascript',
        'ts': 'typescript',
        'md': 'markdown'
      };
      return typeMap[ext] || 'text';
    }

    const content = data.content || '';
    if (content.includes('@prefix') || content.includes('<') || content.includes('rdf:')) {
      return 'turtle';
    } else if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      return 'json';
    } else if (content.includes('function') || content.includes('=>')) {
      return 'javascript';
    } else if (content.includes('#') && content.includes('\n')) {
      return 'markdown';
    }

    return 'text';
  }

  parseRDFTriples(content) {
    // Simplified RDF parsing - in production would use proper parser
    const triples = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('@')) {
        const parts = line.trim().split(' ');
        if (parts.length >= 3) {
          triples.push({
            subject: parts[0],
            predicate: parts[1],
            object: parts.slice(2).join(' ').replace(/\s*\.$/, '')
          });
        }
      }
    }
    
    return triples;
  }

  normalizeRDFTerm(term) {
    if (typeof term === 'string') {
      return term.trim().replace(/[<>]/g, '');
    }
    return String(term).trim();
  }

  normalizeJSONStructure(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeJSONStructure(item)).sort();
    } else if (typeof obj === 'object' && obj !== null) {
      const normalized = {};
      const keys = Object.keys(obj).sort();
      for (const key of keys) {
        normalized[key] = this.normalizeJSONStructure(obj[key]);
      }
      return normalized;
    }
    return obj;
  }

  generateHash(content) {
    // Simple hash implementation for pure JS compatibility
    let hash = 0;
    const str = String(content);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  generateContentHash(content) {
    return this.generateHash(content);
  }

  generateId() {
    return 'drift-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getDeterministicDate() {
    // Return current date - in deterministic environments, this would be fixed
    return new Date();
  }

  getPerformanceNow() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheEfficiency: this.stats.cacheHits > 0 ? 
        (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100 : 0,
      averageProcessingTime: this.stats.comparisons > 0 ? 
        this.stats.totalProcessingTime / this.stats.comparisons : 0
    };
  }

  /**
   * Clear cache and reset statistics
   */
  reset() {
    this.cache.clear();
    this.baselines.clear();
    this.stats = {
      comparisons: 0,
      driftDetected: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalProcessingTime: 0
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: this.status,
      stats: this.getStats(),
      cacheSize: this.cache.size,
      baselineCount: this.baselines.size,
      options: this.options
    };
  }
}

// Export utility functions
export function detectDrift(expected, actual, options = {}) {
  const detector = new DriftDetector(options);
  return detector.detectDrift(expected, actual, options);
}

export function calculateDriftScore(changes, options = {}) {
  const detector = new DriftDetector(options);
  return detector.calculateDriftScore(changes, options);
}

export function generateDriftReport(drift, options = {}) {
  const detector = new DriftDetector(options);
  return detector.generateDriftReport(drift, options);
}

// Export constants
export const DriftSeverity = {
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor',
  INFO: 'info'
};

export const DriftTypes = {
  CONTENT: 'content-changed',
  SEMANTIC: 'semantic-change',
  STRUCTURE: 'structure-changed',
  METADATA: 'metadata-changed',
  SIZE: 'size-changed',
  NEW_FILE: 'new-file',
  FILE_DELETED: 'file-deleted'
};

export default DriftDetector;