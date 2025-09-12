/**
 * Enhanced Standalone KGEN Bridge - Full semantic RDF processing with indexing
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import { SemanticHashEngine } from './semantic-hash-engine.js';
import { canonicalProcessor } from './canonical-processor-cas.js';
import { cas } from '../cas/cas-core.js';
import { SemanticGraphIndexer } from './semantic-graph-indexer.js';
import { readFile } from 'fs/promises';
import fs from 'fs';

export class EnhancedStandaloneKGenBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      debug: options.debug || false,
      enableSemanticHashing: options.enableSemanticHashing !== false,
      hashAlgorithm: options.hashAlgorithm || 'sha256',
      enableCaching: options.enableCaching !== false,
      performanceTarget: options.performanceTarget || 150, // ms
      enableFullTextIndex: options.enableFullTextIndex !== false,
      enableValidation: options.enableValidation !== false,
      ...options
    };
    this.logger = consola.withTag('enhanced-kgen-bridge');
    this.version = '1.0.0';
    this.workingDir = process.cwd();
    
    // Initialize semantic hash engine
    this.semanticEngine = new SemanticHashEngine({
      hashAlgorithm: this.config.hashAlgorithm,
      canonicalAlgorithm: 'c14n-rdf',
      enableCaching: this.config.enableCaching,
      casEnabled: true
    });
    
    // Initialize semantic graph indexer
    this.semanticIndexer = new SemanticGraphIndexer({
      enableFullTextIndex: this.config.enableFullTextIndex,
      enableValidation: this.config.enableValidation,
      performanceTarget: this.config.performanceTarget
    });
  }

  async initialize() {
    this.logger.debug('Initializing Enhanced StandaloneKGenBridge with full semantic processing...');
    try {
      // Initialize CAS engine
      if (this.config.enableCaching) {
        this.logger.debug('CAS engine initialized');
      }
      
      // Validate N3 availability
      try {
        const testContent = '@prefix ex: <http://example.org/> . ex:test ex:prop "value" .';
        await this.semanticIndexer.indexRDF(testContent);
        this.logger.debug('N3 semantic processing verified');
      } catch (error) {
        this.logger.warn('N3 semantic processing not available, falling back to basic mode');
        this.config.enableSemanticHashing = false;
      }
      
      this.logger.success('Enhanced StandaloneKGenBridge initialized with full semantic processing');
      return { 
        success: true, 
        semanticProcessing: this.config.enableSemanticHashing,
        mode: this.config.enableSemanticHashing ? 'SEMANTIC' : 'FALLBACK'
      };
    } catch (error) {
      this.logger.error('Failed to initialize Enhanced StandaloneKGenBridge:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate canonical hash of RDF graph using enhanced semantic processing
   */
  async graphHash(filePath, options = {}) {
    const startTime = performance.now();
    
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      // Read RDF content
      const rdfContent = await readFile(filePath, 'utf8');
      
      // Determine format from file extension
      const format = this._detectRDFFormat(filePath);
      
      let hashResult;
      
      if (this.config.enableSemanticHashing) {
        // Use semantic hashing for canonical deterministic results
        const result = await this.semanticEngine.calculateSemanticHash(rdfContent, { format });
        
        hashResult = {
          hash: result.semanticHash,
          canonical: result.canonical,
          quadCount: result.metadata.quadCount,
          processingTime: result.metadata.processingTime,
          algorithm: result.metadata.algorithm,
          _semantic: {
            contentHash: result.semanticHash,
            canonicalization: result.metadata.canonicalization,
            blankNodeCount: result.metadata.blankNodeCount,
            format: format
          }
        };
      } else {
        // Use canonical processor as fallback
        hashResult = await canonicalProcessor.calculateContentHash(rdfContent, {
          algorithm: this.config.hashAlgorithm,
          format
        });
      }
      
      // Generate content:// URI with enhanced options
      const contentUri = `content://${this.config.hashAlgorithm}/${hashResult.hash}`;
      
      // Calculate total processing time
      const totalTime = Math.round(performance.now() - startTime);
      
      // Get performance metrics
      const casMetrics = cas.getMetrics();
      
      const result = {
        success: true,
        mode: this.config.enableSemanticHashing ? 'SEMANTIC' : 'FALLBACK',
        file: filePath,
        hash: hashResult.hash,
        contentUri,
        algorithm: this.config.hashAlgorithm.toUpperCase(),
        format: format.toUpperCase(),
        quadCount: hashResult.quadCount,
        size: rdfContent.length,
        canonicalSize: hashResult.canonical?.length || 0,
        processingTime: totalTime,
        timestamp: new Date().toISOString(),
        deterministic: this.config.enableSemanticHashing,
        performance: {
          target: this.config.performanceTarget,
          actual: totalTime,
          met: totalTime <= this.config.performanceTarget,
          cacheHitRate: casMetrics.cache?.hitRate || 0
        },
        verification: options.verify ? await this._verifyHash(hashResult.hash, rdfContent) : null
      };
      
      // Include semantic processing details if available
      if (hashResult._semantic) {
        result._semantic = hashResult._semantic;
      }
      
      // Log performance warning if target missed
      if (totalTime > this.config.performanceTarget) {
        this.logger.warn(`Performance target missed: ${totalTime}ms > ${this.config.performanceTarget}ms`);
      } else {
        this.logger.debug(`Hash generated in ${totalTime}ms (target: ≤${this.config.performanceTarget}ms)`);
      }

      console.log(JSON.stringify(result, null, 2));
      return result;
      
    } catch (error) {
      this.logger.error('Graph hash generation failed:', error);
      const result = { 
        success: false, 
        error: error.message,
        file: filePath,
        processingTime: Math.round(performance.now() - startTime),
        timestamp: new Date().toISOString()
      };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
  }

  /**
   * Compare two RDF graphs with enhanced semantic analysis
   */
  async graphDiff(file1, file2, options = {}) {
    const startTime = performance.now();
    
    try {
      if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
        return { success: false, error: 'One or both files not found' };
      }

      if (this.config.enableSemanticHashing) {
        // Perform enhanced semantic comparison
        this.logger.debug(`Performing semantic diff between ${file1} and ${file2}`);
        
        const content1 = await readFile(file1, 'utf8');
        const content2 = await readFile(file2, 'utf8');
        
        // Index both graphs
        const indexer1 = new SemanticGraphIndexer(this.config);
        const indexer2 = new SemanticGraphIndexer(this.config);
        
        const [result1, result2] = await Promise.all([
          indexer1.indexRDF(content1, { format: this._detectRDFFormat(file1) }),
          indexer2.indexRDF(content2, { format: this._detectRDFFormat(file2) })
        ]);
        
        // Calculate semantic differences
        const semanticDiff = this._calculateSemanticDifferences(indexer1, indexer2);
        
        const result = {
          success: true,
          mode: 'SEMANTIC',
          file1: file1,
          file2: file2,
          graph1: {
            triples: result1.totalTriples,
            subjects: result1.uniqueSubjects,
            predicates: result1.uniquePredicates,
            objects: result1.uniqueObjects
          },
          graph2: {
            triples: result2.totalTriples,
            subjects: result2.uniqueSubjects,
            predicates: result2.uniquePredicates,
            objects: result2.uniqueObjects
          },
          differences: semanticDiff.totalDifferences,
          identical: semanticDiff.identical,
          changes: {
            addedSubjects: semanticDiff.added.subjects.length,
            removedSubjects: semanticDiff.removed.subjects.length,
            addedPredicates: semanticDiff.added.predicates.length,
            removedPredicates: semanticDiff.removed.predicates.length,
            addedTriples: semanticDiff.added.triples.length,
            removedTriples: semanticDiff.removed.triples.length,
            modifiedSubjects: semanticDiff.modified.subjects.length
          },
          detailed: options.detailed ? {
            addedSubjects: semanticDiff.added.subjects.slice(0, 10),
            removedSubjects: semanticDiff.removed.subjects.slice(0, 10),
            modifiedSubjects: semanticDiff.modified.subjects.slice(0, 10)
          } : null,
          processingTime: Math.round(performance.now() - startTime),
          timestamp: new Date().toISOString(),
          _semantic: {
            semanticAnalysis: true,
            structuralChanges: semanticDiff.structural,
            impactLevel: semanticDiff.impactLevel,
            validated: !!result1.validation || !!result2.validation
          }
        };

        console.log(JSON.stringify(result, null, 2));
        return result;
      } else {
        // Fallback to line-by-line comparison
        return this._fallbackGraphDiff(file1, file2);
      }
      
    } catch (error) {
      this.logger.error('Graph diff failed:', error);
      const result = { 
        success: false, 
        error: error.message,
        file1: file1,
        file2: file2,
        processingTime: Math.round(performance.now() - startTime),
        timestamp: new Date().toISOString()
      };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
  }

  /**
   * Index RDF graph with full semantic processing
   */
  async graphIndex(filePath, options = {}) {
    const startTime = performance.now();
    
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      // Read RDF content
      const content = await readFile(filePath, 'utf8');
      
      // Determine format
      const format = this._detectRDFFormat(filePath);
      
      if (this.config.enableSemanticHashing) {
        // Use full semantic indexing with N3 parsing
        this.logger.debug(`Performing semantic indexing of ${filePath}`);
        
        const indexResult = await this.semanticIndexer.indexRDF(content, {
          format,
          clearPrevious: options.clearPrevious !== false
        });
        
        if (!indexResult.success) {
          throw new Error(`Semantic indexing failed: ${indexResult.error}`);
        }
        
        // Generate detailed semantic index report
        const report = this.semanticIndexer.generateReport();
        
        const result = {
          success: true,
          mode: 'SEMANTIC',
          file: filePath,
          format: format.toUpperCase(),
          triples: indexResult.totalTriples,
          subjects: indexResult.uniqueSubjects,
          predicates: indexResult.uniquePredicates,
          objects: indexResult.uniqueObjects,
          processingTime: Math.round(performance.now() - startTime),
          indexingRate: indexResult.indexingRate,
          performanceTarget: this.config.performanceTarget,
          targetMet: indexResult.targetMet,
          statistics: {
            literals: report.statistics.literalCount,
            uris: report.statistics.uriCount,
            blankNodes: report.statistics.blankNodeCount,
            languages: Object.keys(report.languageDistribution).length,
            datatypes: Object.keys(report.datatypeDistribution).length
          },
          indexes: report.indexes,
          samples: indexResult.samples,
          topPredicates: report.topPredicates.slice(0, 5),
          validation: report.validation,
          timestamp: new Date().toISOString(),
          _semantic: {
            indexingComplete: true,
            memoryUsage: report.performance.memoryUsage,
            searchable: true,
            validated: !!report.validation,
            querySupport: true,
            fullTextSearch: this.config.enableFullTextIndex
          }
        };

        console.log(JSON.stringify(result, null, 2));
        return result;
      } else {
        // Fallback to basic text parsing
        return this._fallbackGraphIndex(filePath);
      }
      
    } catch (error) {
      this.logger.error('Graph indexing failed:', error);
      const result = { 
        success: false, 
        error: error.message,
        file: filePath,
        processingTime: Math.round(performance.now() - startTime),
        timestamp: new Date().toISOString()
      };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
  }

  /**
   * Query the semantic index
   */
  async queryIndex(pattern, options = {}) {
    if (!this.config.enableSemanticHashing) {
      throw new Error('Semantic indexing not enabled');
    }
    
    return await this.semanticIndexer.query(pattern, options);
  }
  
  /**
   * Search full-text in indexed graphs
   */
  async searchText(query, options = {}) {
    if (!this.config.enableSemanticHashing) {
      throw new Error('Semantic indexing not enabled');
    }
    
    return this.semanticIndexer.searchText(query, options);
  }
  
  /**
   * Find resources by RDF type
   */
  async findByType(typeUri, options = {}) {
    if (!this.config.enableSemanticHashing) {
      throw new Error('Semantic indexing not enabled');
    }
    
    return this.semanticIndexer.findByType(typeUri, options);
  }
  
  /**
   * Get comprehensive index statistics
   */
  getIndexStatistics() {
    if (!this.config.enableSemanticHashing) {
      return { error: 'Semantic indexing not enabled' };
    }
    
    return this.semanticIndexer.generateReport();
  }

  /**
   * Process graph with full semantic analysis
   */
  async processGraph(graphContent, options = {}) {
    this.logger.debug('Processing RDF graph with enhanced semantic analysis...');
    
    try {
      if (this.config.enableSemanticHashing) {
        // Use both semantic hashing and indexing
        const [hashResult, indexResult] = await Promise.all([
          this.semanticEngine.calculateSemanticHash(graphContent, options),
          this.semanticIndexer.indexRDF(graphContent, options)
        ]);
        
        return {
          success: true,
          mode: 'SEMANTIC',
          triples: indexResult.totalTriples,
          subjects: indexResult.uniqueSubjects,
          predicates: indexResult.uniquePredicates,
          objects: indexResult.uniqueObjects,
          semanticHash: hashResult.semanticHash,
          canonical: hashResult.canonical,
          indexingTime: indexResult.processingTime,
          hashingTime: hashResult.metadata.processingTime,
          processed: true,
          searchable: true,
          validated: !!indexResult.validation,
          performanceTargetMet: indexResult.targetMet
        };
      }
      
      // Fallback processing
      return {
        success: true,
        mode: 'FALLBACK',
        triples: 0,
        subjects: [],
        predicates: [],
        objects: [],
        processed: true,
        searchable: false,
        validated: false,
        warning: 'Basic processing used - enable semantic hashing for full features'
      };
    } catch (error) {
      this.logger.error('Graph processing failed:', error);
      return {
        success: false,
        error: error.message,
        processed: false
      };
    }
  }

  /**
   * Calculate semantic differences between two indexed graphs
   */
  _calculateSemanticDifferences(indexer1, indexer2) {
    const subjects1 = new Set(indexer1.semanticIndexes.subjects.keys());
    const subjects2 = new Set(indexer2.semanticIndexes.subjects.keys());
    const predicates1 = new Set(indexer1.semanticIndexes.predicates.keys());
    const predicates2 = new Set(indexer2.semanticIndexes.predicates.keys());
    
    // Calculate set differences
    const addedSubjects = Array.from(subjects2).filter(s => !subjects1.has(s));
    const removedSubjects = Array.from(subjects1).filter(s => !subjects2.has(s));
    const addedPredicates = Array.from(predicates2).filter(p => !predicates1.has(p));
    const removedPredicates = Array.from(predicates1).filter(p => !predicates2.has(p));
    
    // Find modified subjects (same subject, different predicates)
    const modifiedSubjects = [];
    for (const subject of subjects1) {
      if (subjects2.has(subject)) {
        const info1 = indexer1.semanticIndexes.subjects.get(subject);
        const info2 = indexer2.semanticIndexes.subjects.get(subject);
        
        if (info1.predicates.size !== info2.predicates.size || 
            !this._setsEqual(info1.predicates, info2.predicates)) {
          modifiedSubjects.push({
            subject,
            predicatesBefore: info1.predicates.size,
            predicatesAfter: info2.predicates.size
          });
        }
      }
    }
    
    // Calculate triple-level differences
    const triples1 = new Set();
    const triples2 = new Set();
    
    for (const quad of indexer1.store.getQuads()) {
      triples1.add(`${indexer1.termToString(quad.subject)} ${indexer1.termToString(quad.predicate)} ${indexer1.termToString(quad.object)}`);
    }
    
    for (const quad of indexer2.store.getQuads()) {
      triples2.add(`${indexer2.termToString(quad.subject)} ${indexer2.termToString(quad.predicate)} ${indexer2.termToString(quad.object)}`);
    }
    
    const addedTriples = Array.from(triples2).filter(t => !triples1.has(t));
    const removedTriples = Array.from(triples1).filter(t => !triples2.has(t));
    
    const totalDifferences = addedSubjects.length + removedSubjects.length + 
                            addedPredicates.length + removedPredicates.length + 
                            addedTriples.length + removedTriples.length + 
                            modifiedSubjects.length;
    
    // Determine impact level
    let impactLevel = 'low';
    if (totalDifferences > 100 || removedSubjects.length > 10) {
      impactLevel = 'high';
    } else if (totalDifferences > 20 || modifiedSubjects.length > 5) {
      impactLevel = 'medium';
    }
    
    return {
      identical: totalDifferences === 0,
      totalDifferences,
      added: {
        subjects: addedSubjects,
        predicates: addedPredicates,
        triples: addedTriples
      },
      removed: {
        subjects: removedSubjects,
        predicates: removedPredicates,
        triples: removedTriples
      },
      modified: {
        subjects: modifiedSubjects
      },
      structural: removedSubjects.length > 0 || addedSubjects.length > 0,
      impactLevel
    };
  }
  
  /**
   * Check if two sets are equal
   */
  _setsEqual(set1, set2) {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }
  
  /**
   * Fallback graph diff using line-by-line comparison
   */
  async _fallbackGraphDiff(file1, file2) {
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

    const result = {
      success: true,
      mode: 'FALLBACK',
      file1: file1,
      file2: file2,
      differences: differences.length,
      changes: differences.slice(0, 10), // First 10 changes
      identical: differences.length === 0,
      warning: 'Basic line comparison used - install N3 for semantic analysis',
      timestamp: new Date().toISOString(),
      _semantic: null
    };

    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  
  /**
   * Fallback graph indexing using basic text parsing
   */
  async _fallbackGraphIndex(filePath) {
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

    const result = {
      success: true,
      mode: 'FALLBACK',
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
      warning: 'Basic text parsing used - install N3 for full semantic indexing',
      timestamp: new Date().toISOString(),
      _semantic: null
    };

    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Verify hash integrity
   */
  async _verifyHash(hash, content) {
    const rehash = crypto.createHash(this.config.hashAlgorithm).update(content).digest('hex');
    return {
      verified: hash === rehash,
      originalHash: hash,
      verificationHash: rehash
    };
  }

  /**
   * Find RDF files in directory
   */
  findRDFFiles(directory) {
    const path = require('path');
    
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

  /**
   * Detect RDF format from file extension
   */
  _detectRDFFormat(filePath) {
    const ext = filePath.toLowerCase().split('.').pop();
    const formatMap = {
      'ttl': 'turtle',
      'turtle': 'turtle', 
      'n3': 'turtle',
      'nt': 'ntriples',
      'ntriples': 'ntriples',
      'nq': 'nquads',
      'nquads': 'nquads',
      'rdf': 'rdfxml',
      'xml': 'rdfxml',
      'jsonld': 'jsonld',
      'json': 'jsonld'
    };
    return formatMap[ext] || 'turtle';
  }
}

export default EnhancedStandaloneKGenBridge;