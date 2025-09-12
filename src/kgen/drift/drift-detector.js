/**
 * CAS-Powered Drift Detection Engine
 * 
 * Uses Content-Addressed Storage for precise drift detection:
 * - CID-based content comparison
 * - Semantic RDF graph analysis
 * - Performance-optimized caching
 */

import { cas } from '../cas/cas-core.js';
import { canonicalProcessor } from '../rdf/canonical-processor-cas.js';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

/**
 * Drift Detection Engine with CAS integration
 */
export class DriftDetector {
  constructor(options = {}) {
    this.options = {
      baselinePath: options.baselinePath || '.kgen/baselines',
      extensions: options.extensions || ['.ttl', '.rdf', '.n3', '.jsonld'],
      trackMetadata: options.trackMetadata !== false,
      enableSemanticComparison: options.enableSemanticComparison !== false,
      cacheResults: options.cacheResults !== false,
      ...options
    };
    
    this.baselines = new Map();
    this.driftHistory = new Map();
    this.metrics = {
      comparisons: 0,
      driftsDetected: 0,
      cacheHits: 0,
      processingTime: 0
    };
  }

  /**
   * Create baseline for drift detection
   * @param {string} filePath - File to baseline
   * @param {Object} options - Baseline options
   * @returns {Promise<{cid, baseline}>} Baseline data
   */
  async createBaseline(filePath, options = {}) {
    const startTime = performance.now();
    
    try {
      const content = await readFile(filePath, 'utf8');
      const stats = await stat(filePath);
      
      // Generate CID for content
      const cid = await cas.generateCID(content);
      
      // For RDF files, also generate canonical representation
      let canonicalData = null;
      if (this._isRDFFile(filePath)) {
        canonicalData = await canonicalProcessor.parseAndAddress(content, {
          format: this._detectRDFFormat(filePath)
        });
      }
      
      const baseline = {
        filePath,
        contentCID: cid.toString(),
        canonicalCID: canonicalData?.canonicalCID,
        fileSize: stats.size,
        lastModified: stats.mtime.toISOString(),
        createdAt: this.getDeterministicDate().toISOString(),
        metadata: {
          quadCount: canonicalData?.quadCount || 0,
          format: canonicalData ? this._detectRDFFormat(filePath) : 'text',
          processingTime: performance.now() - startTime
        }
      };
      
      // Store baseline
      this.baselines.set(filePath, baseline);
      
      // Cache for future comparisons
      if (this.options.cacheResults) {
        await cas.store(JSON.stringify(baseline), { algorithm: 'sha256' });
      }
      
      return { cid, baseline };
      
    } catch (error) {
      throw new Error(`Failed to create baseline for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Detect drift by comparing current state to baseline
   * @param {string} filePath - File to check for drift
   * @param {Object} options - Detection options
   * @returns {Promise<{hasDrift, details}>} Drift detection result
   */
  async detectDrift(filePath, options = {}) {
    const startTime = performance.now();
    this.metrics.comparisons++;
    
    try {
      const baseline = this.baselines.get(filePath) || options.baseline;
      if (!baseline) {
        throw new Error(`No baseline found for ${filePath}. Create one first.`);
      }
      
      // Check cache for recent comparison
      const cacheKey = `drift:${filePath}:${baseline.contentCID}`;
      if (this.options.cacheResults) {
        const cached = await cas.retrieve(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          return JSON.parse(new TextDecoder().decode(cached));
        }
      }
      
      // Read current content
      const currentContent = await readFile(filePath, 'utf8');
      const currentStats = await stat(filePath);
      
      // Quick check: file size and modification time
      const quickDrift = {
        sizeChanged: currentStats.size !== baseline.fileSize,
        modTimeChanged: currentStats.mtime.toISOString() !== baseline.lastModified
      };
      
      // Generate CID for current content
      const currentCID = await cas.generateCID(currentContent);
      const cidDrift = !currentCID.equals(baseline.contentCID);
      
      let semanticDrift = null;
      let canonicalComparison = null;
      
      // For RDF files, perform semantic comparison
      if (this._isRDFFile(filePath) && this.options.enableSemanticComparison) {
        // Get original content for semantic comparison
        const baselineContent = await this._getBaselineContent(baseline);
        
        if (baselineContent) {
          canonicalComparison = await canonicalProcessor.compareGraphs(
            baselineContent,
            currentContent
          );
          
          semanticDrift = !canonicalComparison.identical;
        }
      }
      
      const hasDrift = cidDrift || quickDrift.sizeChanged;
      
      const driftResult = {
        hasDrift,
        filePath,
        timestamp: this.getDeterministicDate().toISOString(),
        baseline: {
          cid: baseline.contentCID,
          canonicalCID: baseline.canonicalCID,
          createdAt: baseline.createdAt
        },
        current: {
          cid: currentCID.toString(),
          canonicalCID: canonicalComparison?.cid2,
          fileSize: currentStats.size,
          lastModified: currentStats.mtime.toISOString()
        },
        driftTypes: {
          content: cidDrift,
          size: quickDrift.sizeChanged,
          modTime: quickDrift.modTimeChanged,
          semantic: semanticDrift
        },
        details: {
          sizeDelta: currentStats.size - baseline.fileSize,
          modTimeDelta: currentStats.mtime.getTime() - new Date(baseline.lastModified).getTime(),
          semanticDetails: canonicalComparison?.details,
          processingTime: performance.now() - startTime
        }
      };
      
      // Track drift in history
      if (hasDrift) {
        this.metrics.driftsDetected++;
        this._recordDrift(filePath, driftResult);
      }
      
      // Cache result
      if (this.options.cacheResults) {
        await cas.store(JSON.stringify(driftResult), { algorithm: 'sha256' });
      }
      
      this.metrics.processingTime += performance.now() - startTime;
      
      return driftResult;
      
    } catch (error) {
      throw new Error(`Drift detection failed for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Scan directory for drifted files
   * @param {string} directory - Directory to scan
   * @param {Object} options - Scan options
   * @returns {Promise<{drifted, clean, errors}>} Scan results
   */
  async scanForDrift(directory, options = {}) {
    const pattern = options.pattern || `**/*{${this.options.extensions.join(',')}}`;
    const files = await glob(pattern, { 
      cwd: directory,
      absolute: true,
      ignore: options.ignore || ['node_modules/**', '.git/**']
    });
    
    const results = {
      drifted: [],
      clean: [],
      errors: [],
      summary: {
        totalFiles: files.length,
        driftedCount: 0,
        cleanCount: 0,
        errorCount: 0
      }
    };
    
    // Process files in batches for performance
    const batchSize = options.batchSize || 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchPromises = batch.map(async (file) => {
        try {
          const driftResult = await this.detectDrift(file, options);
          
          if (driftResult.hasDrift) {
            results.drifted.push(driftResult);
            results.summary.driftedCount++;
          } else {
            results.clean.push({
              filePath: file,
              cid: driftResult.current.cid,
              status: 'clean'
            });
            results.summary.cleanCount++;
          }
        } catch (error) {
          results.errors.push({
            filePath: file,
            error: error.message
          });
          results.summary.errorCount++;
        }
      });
      
      await Promise.all(batchPromises);
    }
    
    return results;
  }

  /**
   * Get drift history for a file
   * @param {string} filePath - File path
   * @returns {Array} Drift history
   */
  getDriftHistory(filePath) {
    return this.driftHistory.get(filePath) || [];
  }

  /**
   * Discover artifacts in a file or directory
   * @param {string} targetPath - File or directory path
   * @param {Object} options - Discovery options
   * @returns {Promise<Array<string>>} List of artifact paths
   */
  async discoverArtifacts(targetPath, options = {}) {
    const stats = await stat(targetPath);
    
    if (stats.isFile()) {
      return [targetPath];
    }
    
    if (stats.isDirectory()) {
      const extensions = options.extensions || this.options.extensions || ['.ttl', '.rdf', '.n3', '.jsonld', '.js', '.ts', '.json'];
      const pattern = `**/*{${extensions.join(',')}}`;
      
      return await glob(pattern, {
        cwd: targetPath,
        absolute: true,
        ignore: ['node_modules/**', '.git/**', '**/*.test.*', '**/*.spec.*']
      });
    }
    
    return [];
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance statistics
   */
  getMetrics() {
    const casMetrics = cas.getMetrics();
    
    return {
      detector: this.metrics,
      cas: casMetrics,
      efficiency: {
        cacheHitRate: this.metrics.comparisons > 0 
          ? this.metrics.cacheHits / this.metrics.comparisons 
          : 0,
        averageProcessingTime: this.metrics.comparisons > 0
          ? this.metrics.processingTime / this.metrics.comparisons
          : 0
      }
    };
  }

  // Private methods

  _isRDFFile(filePath) {
    const ext = filePath.toLowerCase().split('.').pop();
    return this.options.extensions.includes(`.${ext}`);
  }

  _detectRDFFormat(filePath) {
    const ext = filePath.toLowerCase().split('.').pop();
    const formatMap = {
      'ttl': 'turtle',
      'n3': 'n3',
      'nt': 'ntriples',
      'rdf': 'rdfxml',
      'jsonld': 'jsonld'
    };
    return formatMap[ext] || 'turtle';
  }

  async _getBaselineContent(baseline) {
    // In a full implementation, this would retrieve the original content
    // For now, we'll need to store content or reconstruct it
    // This is a placeholder that should be implemented based on storage strategy
    return null;
  }

  _recordDrift(filePath, driftResult) {
    if (!this.driftHistory.has(filePath)) {
      this.driftHistory.set(filePath, []);
    }
    
    const history = this.driftHistory.get(filePath);
    history.push({
      timestamp: driftResult.timestamp,
      driftTypes: driftResult.driftTypes,
      details: driftResult.details
    });
    
    // Keep only recent drift history (last 100 entries)
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }
}

// Export singleton instance
export const driftDetector = new DriftDetector();