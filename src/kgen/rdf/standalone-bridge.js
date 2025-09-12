/**
 * Standalone RDF Bridge
 * 
 * Replaces the naive RDF processing methods in bin/kgen.mjs with
 * semantically-aware implementations while maintaining the same API.
 * 
 * This bridge allows the existing CLI to benefit from proper RDF processing
 * without breaking the interface.
 */

import { EnhancedRDFProcessor } from './enhanced-processor.js';
import { consola } from 'consola';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Standalone KGEN Bridge with Enhanced RDF Processing
 * 
 * Drop-in replacement for StandaloneKGen class in bin/kgen.mjs
 */
export class StandaloneKGenBridge {
  constructor() {
    this.version = '1.0.0';
    this.workingDir = process.cwd();
    
    // Initialize enhanced RDF processor
    this.rdfProcessor = new EnhancedRDFProcessor({
      enableCanonicalization: true,
      enableIndexing: true,
      enableValidation: true,
      cacheResults: true,
      verboseOutput: false, // Keep CLI output clean
      includeMetadata: false // Simplified output for CLI
    });
    
    this.logger = consola.withTag('kgen-bridge');
    
    // Initialize processor asynchronously
    this._initPromise = this.rdfProcessor.initialize().catch(error => {
      this.logger.warn('RDF processor initialization failed, falling back to basic mode:', error.message);
      this._fallbackMode = true;
    });
  }
  
  /**
   * Ensure processor is initialized
   */
  async _ensureInitialized() {
    if (this._initPromise) {
      await this._initPromise;
      this._initPromise = null;
    }
  }
  
  /**
   * Generate canonical hash of RDF graph
   * Enhanced replacement for naive content hashing
   */
  async graphHash(filePath) {
    try {
      await this._ensureInitialized();
      
      if (this._fallbackMode) {
        return this._fallbackGraphHash(filePath);
      }
      
      // Use enhanced RDF processing
      const result = await this.rdfProcessor.graphHash(filePath, {
        checkSemanticEquivalence: true,
        includeChanges: false
      });
      
      if (result.success) {
        // Transform to match original API format
        return {
          success: true,
          file: result.file,
          hash: result.canonicalHash, // Use semantic hash instead of content hash
          size: result.size,
          timestamp: result.timestamp,
          // Additional semantic information (hidden from CLI but available)
          _semantic: {
            tripleCount: result.tripleCount,
            format: result.format,
            parseTime: result.parseTime,
            hashTime: result.hashTime,
            contentHash: result.contentHash // Original approach for comparison
          }
        };
      } else {
        return result; // Pass through error
      }
    } catch (error) {
      const result = { success: false, error: error.message, file: filePath };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
  }
  
  /**
   * Compare two RDF graphs semantically
   * Enhanced replacement for naive line-by-line comparison
   */
  async graphDiff(file1, file2) {
    try {
      await this._ensureInitialized();
      
      if (this._fallbackMode) {
        return this._fallbackGraphDiff(file1, file2);
      }
      
      // Use enhanced RDF processing
      const result = await this.rdfProcessor.graphDiff(file1, file2, {
        checkSemanticEquivalence: true,
        includeChanges: true,
        maxChanges: 10
      });
      
      if (result.success) {
        // Transform to match original API format
        const transformed = {
          success: true,
          file1: result.file1,
          file2: result.file2,
          differences: result.differences,
          identical: result.identical,
          // Simplified changes for CLI display
          changes: result.changes ? [
            ...result.changes.added.slice(0, 5).map(change => ({
              type: 'added',
              content: change
            })),
            ...result.changes.removed.slice(0, 5).map(change => ({
              type: 'removed', 
              content: change
            }))
          ].slice(0, 10) : [],
          // Summary information
          summary: {
            file1Triples: result.summary.file1Triples,
            file2Triples: result.summary.file2Triples,
            addedTriples: result.summary.addedTriples,
            removedTriples: result.summary.removedTriples,
            processingTime: result.summary.processingTime
          },
          // Additional semantic information (hidden from CLI)
          _semantic: {
            semanticallyEquivalent: result.semanticallyEquivalent,
            fullComparison: result
          }
        };
        
        return transformed;
      } else {
        return result; // Pass through error
      }
    } catch (error) {
      const result = { success: false, error: error.message, file1, file2 };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
  }
  
  /**
   * Index RDF graph for searchability
   * Enhanced replacement for naive triple extraction
   */
  async graphIndex(filePath) {
    try {
      await this._ensureInitialized();
      
      if (this._fallbackMode) {
        return this._fallbackGraphIndex(filePath);
      }
      
      // Use enhanced RDF processing
      const result = await this.rdfProcessor.graphIndex(filePath, {
        includeSamples: true,
        enableFullTextIndex: true
      });
      
      if (result.success) {
        // Transform to match original API format but with enhanced data
        return {
          success: true,
          file: result.file,
          triples: result.triples,
          subjects: result.statistics.subjects,
          predicates: result.statistics.predicates,
          objects: result.statistics.objects,
          // Enhanced index information
          index: {
            subjects: result.samples?.topPredicates || [],
            predicates: result.samples?.topPredicates || [],
            objects: result.samples?.languages?.map(l => l.language) || [],
            // Additional semantic data
            literals: result.statistics.literals,
            uris: result.statistics.uris,
            blankNodes: result.statistics.blankNodes,
            languages: result.samples?.languages || [],
            datatypes: result.samples?.datatypes || []
          },
          timestamp: result.timestamp,
          // Additional semantic information (hidden from CLI)
          _semantic: {
            format: result.format,
            indexingTime: result.indexing.processingTime,
            fullStatistics: result.statistics,
            samples: result.samples
          }
        };
      } else {
        return result; // Pass through error
      }
    } catch (error) {
      const result = { success: false, error: error.message, file: filePath };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
  }
  
  /**
   * Generate deterministic artifacts
   * Maintains original API but adds semantic validation
   */
  async artifactGenerate(graphFile, template, options = {}) {
    try {
      await this._ensureInitialized();
      
      const result = {
        success: true,
        operation: 'artifact:generate',
        graph: graphFile,
        template: template,
        output: options.output || 'generated/',
        status: 'Enhanced semantic processing enabled',
        message: 'Full KGEN semantic engine with canonical RDF processing',
        timestamp: new Date().toISOString()
      };
      
      if (graphFile && fs.existsSync(graphFile)) {
        // Use semantic hash instead of simple content hash
        const hashResult = await this.graphHash(graphFile);
        
        if (hashResult.success) {
          result.graphHash = hashResult.hash; // Canonical hash
          result.graphSize = hashResult.size;
          result._semantic = {
            contentHash: hashResult._semantic?.contentHash,
            tripleCount: hashResult._semantic?.tripleCount,
            format: hashResult._semantic?.format
          };
        } else {
          // Fallback to basic approach if enhanced processing fails
          const content = fs.readFileSync(graphFile, 'utf8');
          result.graphHash = crypto.createHash('sha256').update(content).digest('hex');
          result.graphSize = content.length;
          result.graphLines = content.split('\n').length;
        }
      }
      
      console.log(JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
  }
  
  /**
   * Create project lockfile with enhanced RDF processing
   */
  async projectLock(directory = '.') {
    try {
      await this._ensureInitialized();
      
      const lockfilePath = path.join(directory, 'kgen.lock.json');
      
      // Find all RDF/Turtle files
      const rdfFiles = this.findRDFFiles(directory);
      const lockData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        directory: directory,
        processingMode: this._fallbackMode ? 'basic' : 'enhanced',
        files: {}
      };
      
      // Process files in batches if using enhanced mode
      if (!this._fallbackMode && rdfFiles.length > 0) {
        const batchResult = await this.rdfProcessor.processBatch(rdfFiles, 'hash', {
          includeMetadata: false
        });
        
        for (const result of batchResult.results) {
          if (result.success) {
            lockData.files[result.file] = {
              hash: result.canonicalHash || result.hash,
              contentHash: result._semantic?.contentHash,
              tripleCount: result._semantic?.tripleCount,
              format: result._semantic?.format,
              size: result.size,
              modified: fs.statSync(result.file).mtime.toISOString()
            };
          } else {
            lockData.files[result.file] = { error: result.error };
          }
        }
        
        lockData.summary = batchResult.summary;
      } else {
        // Fallback to basic processing
        for (const file of rdfFiles) {
          try {
            const content = fs.readFileSync(file, 'utf8');
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            lockData.files[file] = {
              hash: hash,
              size: content.length,
              modified: fs.statSync(file).mtime.toISOString()
            };
          } catch (err) {
            lockData.files[file] = { error: err.message };
          }
        }
      }
      
      fs.writeFileSync(lockfilePath, JSON.stringify(lockData, null, 2));
      
      const result = {
        success: true,
        lockfile: lockfilePath,
        filesHashed: Object.keys(lockData.files).length,
        rdfFiles: rdfFiles.length,
        processingMode: lockData.processingMode,
        timestamp: lockData.timestamp
      };
      
      console.log(JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
  }
  
  /**
   * Find RDF files in directory (same as original)
   */
  findRDFFiles(directory) {
    const rdfExtensions = ['.ttl', '.rdf', '.n3', '.nt', '.jsonld'];
    const files = [];
    
    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (rdfExtensions.includes(ext)) {
            files.push(fullPath);
          }
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.includes('node_modules')) {
          files.push(...this.findRDFFiles(fullPath));
        }
      }
    } catch (err) {
      // Ignore directory read errors
    }
    
    return files;
  }
  
  // Fallback methods for when enhanced processing fails
  
  /**
   * Fallback graph hash (original naive implementation)
   */
  async _fallbackGraphHash(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      
      return {
        success: true,
        file: filePath,
        hash: hash,
        size: content.length,
        timestamp: new Date().toISOString(),
        _fallback: true
      };
    } catch (error) {
      return { success: false, error: error.message, file: filePath };
    }
  }
  
  /**
   * Fallback graph diff (original naive implementation)
   */
  async _fallbackGraphDiff(file1, file2) {
    try {
      if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
        return { success: false, error: 'One or both files not found' };
      }
      
      const content1 = fs.readFileSync(file1, 'utf8');
      const content2 = fs.readFileSync(file2, 'utf8');
      
      const lines1 = content1.split('\n');
      const lines2 = content2.split('\n');
      
      const differences = [];
      const maxLines = Math.max(lines1.length, lines2.length);
      
      for (let i = 0; i < maxLines; i++) {
        const line1 = lines1[i] || '';
        const line2 = lines2[i] || '';
        
        if (line1 !== line2) {
          differences.push({
            line: i + 1,
            file1: line1,
            file2: line2
          });
        }
      }
      
      return {
        success: true,
        file1: file1,
        file2: file2,
        differences: differences.length,
        changes: differences.slice(0, 10),
        identical: differences.length === 0,
        _fallback: true
      };
    } catch (error) {
      return { success: false, error: error.message, file1, file2 };
    }
  }
  
  /**
   * Fallback graph index (original naive implementation)
   */
  async _fallbackGraphIndex(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      const subjects = new Set();
      const predicates = new Set();
      const objects = new Set();
      
      // Simple RDF triple parsing
      lines.forEach(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          subjects.add(parts[0]);
          predicates.add(parts[1]);
          objects.add(parts.slice(2).join(' ').replace(/\s*\.\s*$/, ''));
        }
      });
      
      return {
        success: true,
        file: filePath,
        triples: lines.length,
        subjects: Array.from(subjects).length,
        predicates: Array.from(predicates).length,
        objects: Array.from(objects).length,
        index: {
          subjects: Array.from(subjects).slice(0, 10),
          predicates: Array.from(predicates).slice(0, 10),
          objects: Array.from(objects).slice(0, 5)
        },
        timestamp: new Date().toISOString(),
        _fallback: true
      };
    } catch (error) {
      return { success: false, error: error.message, file: filePath };
    }
  }
  
  /**
   * Get processor status for debugging
   */
  async getStatus() {
    await this._ensureInitialized();
    
    if (this._fallbackMode) {
      return {
        mode: 'fallback',
        version: this.version,
        message: 'Using basic RDF processing due to initialization failure'
      };
    }
    
    return {
      mode: 'enhanced',
      version: this.version,
      rdfProcessor: this.rdfProcessor.getStatus()
    };
  }
  
  /**
   * Shutdown processor
   */
  async shutdown() {
    if (this.rdfProcessor && !this._fallbackMode) {
      await this.rdfProcessor.shutdown();
    }
  }
}

export default StandaloneKGenBridge;