/**
 * Enhanced RDF Processor
 * 
 * Integrates canonical processing and indexing to replace the naive
 * implementations in bin/kgen.mjs with semantically-aware, deterministic
 * RDF graph processing.
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { CanonicalRDFProcessor } from './canonical-processor.js';
import { GraphIndexer } from './graph-indexer.js';
import { RDFProcessor } from './index.js';

/**
 * Enhanced RDF Processor that replaces StandaloneKGen methods
 */
export class EnhancedRDFProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Processing modes
      enableCanonicalization: config.enableCanonicalization !== false,
      enableIndexing: config.enableIndexing !== false,
      enableValidation: config.enableValidation !== false,
      
      // Performance options
      cacheResults: config.cacheResults !== false,
      maxConcurrentFiles: config.maxConcurrentFiles || 5,
      batchSize: config.batchSize || 1000,
      
      // Output options
      includeMetadata: config.includeMetadata !== false,
      verboseOutput: config.verboseOutput !== false,
      
      ...config
    };
    
    // Initialize sub-processors
    this.canonicalProcessor = new CanonicalRDFProcessor({
      cacheResults: this.config.cacheResults,
      enableValidation: this.config.enableValidation
    });
    
    this.indexer = new GraphIndexer({
      enableFullTextIndex: this.config.enableFullTextIndex !== false,
      enableTypeIndex: this.config.enableTypeIndex !== false
    });
    
    this.rdfProcessor = new RDFProcessor({
      namespaces: this.config.namespaces
    });
    
    this.logger = consola.withTag('enhanced-rdf');
    
    // Setup event forwarding
    this.setupEventForwarding();
  }
  
  /**
   * Initialize all processors
   */
  async initialize() {
    await this.rdfProcessor.initialize();
    this.logger.success('Enhanced RDF Processor initialized');
  }
  
  /**
   * Setup event forwarding from sub-processors
   */
  setupEventForwarding() {
    this.canonicalProcessor.on('hash-generated', (data) => {
      this.emit('hash-generated', data);
    });
    
    this.indexer.on('indexing-complete', (data) => {
      this.emit('indexing-complete', data);
    });
  }
  
  /**
   * Enhanced graph hash - replaces naive content hash in bin/kgen.mjs
   */
  async graphHash(filePath, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate file exists
      await fs.access(filePath);
      
      // Parse RDF content
      const parseResult = await this.parseRDFFile(filePath, options);
      
      if (!parseResult.valid) {
        return {
          success: false,
          error: `Invalid RDF: ${parseResult.errors.map(e => e.message).join(', ')}`,
          file: filePath
        };
      }
      
      // Generate canonical hash
      const hashResult = await this.canonicalProcessor.generateCanonicalHash(
        parseResult.quads,
        options
      );
      
      const result = {
        success: true,
        file: filePath,
        hash: hashResult.hash,
        canonicalHash: hashResult.hash, // Semantic hash
        contentHash: this.generateSimpleHash(parseResult.content), // Original approach for comparison
        tripleCount: hashResult.count,
        format: parseResult.format,
        size: parseResult.content.length,
        parseTime: parseResult.parseTime,
        hashTime: hashResult.metadata.processingTime,
        totalTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
      
      if (this.config.includeMetadata) {
        result.metadata = {
          canonicalization: hashResult.metadata,
          parsing: {
            errors: parseResult.errors,
            prefixes: parseResult.prefixes
          },
          validation: {
            valid: parseResult.valid,
            tripleValidations: hashResult.count
          }
        };
      }
      
      if (this.config.verboseOutput) {
        this.logger.info(`Generated canonical hash for ${filePath}: ${result.hash}`);
      }
      
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        file: filePath,
        timestamp: new Date().toISOString()
      };
      
      this.logger.error(`Hash generation failed for ${filePath}:`, error);
      return result;
    }
  }
  
  /**
   * Enhanced graph diff - replaces naive line diff in bin/kgen.mjs
   */
  async graphDiff(file1, file2, options = {}) {
    const startTime = Date.now();
    
    try {
      // Parse both files
      const [parse1, parse2] = await Promise.all([
        this.parseRDFFile(file1, options),
        this.parseRDFFile(file2, options)
      ]);
      
      // Check for parsing errors
      if (!parse1.valid || !parse2.valid) {
        return {
          success: false,
          error: 'One or both files contain invalid RDF',
          file1,
          file2,
          parseErrors: {
            file1: parse1.errors,
            file2: parse2.errors
          }
        };
      }
      
      // Perform semantic comparison
      const comparison = await this.canonicalProcessor.compareGraphs(
        parse1.quads,
        parse2.quads,
        {
          checkSemanticEquivalence: options.checkSemanticEquivalence !== false,
          ...options
        }
      );
      
      const result = {
        success: true,
        file1,
        file2,
        identical: comparison.identical,
        semanticallyEquivalent: comparison.semanticallyEquivalent,
        differences: comparison.differences,
        summary: {
          file1Triples: parse1.quads.length,
          file2Triples: parse2.quads.length,
          addedTriples: comparison.added.length,
          removedTriples: comparison.removed.length,
          commonTriples: comparison.common,
          processingTime: Date.now() - startTime
        },
        timestamp: new Date().toISOString()
      };
      
      // Include detailed changes if requested
      if (options.includeChanges && !comparison.identical) {
        result.changes = {
          added: comparison.added.slice(0, options.maxChanges || 50).map(quad => 
            this.canonicalProcessor.quadToCanonicalString(quad)
          ),
          removed: comparison.removed.slice(0, options.maxChanges || 50).map(quad => 
            this.canonicalProcessor.quadToCanonicalString(quad)
          )
        };
      }
      
      if (this.config.verboseOutput) {
        this.logger.info(`Compared ${file1} and ${file2}: ${comparison.identical ? 'identical' : `${comparison.differences} differences`}`);
      }
      
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        file1,
        file2,
        timestamp: new Date().toISOString()
      };
      
      this.logger.error(`Graph comparison failed:`, error);
      return result;
    }
  }
  
  /**
   * Enhanced graph index - replaces naive triple extraction in bin/kgen.mjs
   */
  async graphIndex(filePath, options = {}) {
    const startTime = Date.now();
    
    try {
      // Parse RDF file
      const parseResult = await this.parseRDFFile(filePath, options);
      
      if (!parseResult.valid) {
        return {
          success: false,
          error: `Invalid RDF: ${parseResult.errors.map(e => e.message).join(', ')}`,
          file: filePath
        };
      }
      
      // Create fresh indexer for this file
      const fileIndexer = new GraphIndexer(this.config);
      
      // Index the quads
      const indexResult = await fileIndexer.indexQuads(parseResult.quads, options);
      
      // Generate comprehensive report
      const report = fileIndexer.generateReport();
      
      const result = {
        success: true,
        file: filePath,
        triples: parseResult.quads.length,
        format: parseResult.format,
        indexing: {
          indexed: indexResult.indexed,
          processingTime: indexResult.processingTime,
          totalTime: Date.now() - startTime
        },
        statistics: {
          subjects: report.summary.statistics.uniqueSubjects,
          predicates: report.summary.statistics.uniquePredicates,
          objects: report.summary.statistics.uniqueObjects,
          literals: report.summary.statistics.literalCount,
          uris: report.summary.statistics.uriCount,
          blankNodes: report.summary.statistics.blankNodeCount
        },
        timestamp: new Date().toISOString()
      };
      
      // Include sample data if requested
      if (options.includeSamples) {
        const topPredicates = report.topPredicates.slice(0, 10);
        const languages = Object.entries(report.languageDistribution).slice(0, 5);
        const datatypes = Object.entries(report.datatypeDistribution).slice(0, 5);
        
        result.samples = {
          topPredicates: topPredicates.map(p => p.predicate),
          languages: languages.map(([lang, count]) => ({ language: lang, count })),
          datatypes: datatypes.map(([dt, count]) => ({ datatype: dt, count }))
        };
      }
      
      // Include full report in metadata if requested
      if (this.config.includeMetadata) {
        result.metadata = {
          fullReport: report,
          parsing: {
            parseTime: parseResult.parseTime,
            errors: parseResult.errors,
            prefixes: parseResult.prefixes
          }
        };
      }
      
      if (this.config.verboseOutput) {
        this.logger.info(`Indexed ${filePath}: ${result.triples} triples, ${result.statistics.subjects} subjects`);
      }
      
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        file: filePath,
        timestamp: new Date().toISOString()
      };
      
      this.logger.error(`Graph indexing failed for ${filePath}:`, error);
      return result;
    }
  }
  
  /**
   * Parse RDF file with enhanced error handling
   */
  async parseRDFFile(filePath, options = {}) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const format = this.detectFormat(filePath) || options.format || 'turtle';
      
      const parseResult = await this.canonicalProcessor.parseRDF(content, format, {
        continueOnError: options.continueOnError !== false,
        skipInvalid: options.skipInvalid !== false,
        ...options
      });
      
      return {
        ...parseResult,
        content,
        filePath
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error],
        content: '',
        filePath,
        quads: []
      };
    }
  }
  
  /**
   * Detect RDF format from file extension
   */
  detectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const formatMap = {
      '.ttl': 'turtle',
      '.turtle': 'turtle',
      '.n3': 'n3',
      '.nt': 'ntriples',
      '.nq': 'nquads',
      '.rdf': 'rdfxml',
      '.xml': 'rdfxml',
      '.jsonld': 'jsonld',
      '.json': 'jsonld'
    };
    
    return formatMap[ext] || 'turtle';
  }
  
  /**
   * Generate simple content hash for comparison with naive approach
   */
  generateSimpleHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  /**
   * Query indexed graph data
   */
  async queryGraph(filePath, query, options = {}) {
    try {
      const parseResult = await this.parseRDFFile(filePath, options);
      
      if (!parseResult.valid) {
        return {
          success: false,
          error: 'Invalid RDF file',
          query
        };
      }
      
      // Index the file data
      const fileIndexer = new GraphIndexer(this.config);
      await fileIndexer.indexQuads(parseResult.quads);
      
      let results;
      
      if (typeof query === 'string') {
        // Text search
        results = fileIndexer.searchText(query, options);
      } else if (query.type) {
        // Type search
        results = fileIndexer.findByType(query.type, options);
      } else if (query.language) {
        // Language search
        results = fileIndexer.findByLanguage(query.language, options);
      } else {
        // Pattern query
        results = await fileIndexer.query(query, options);
      }
      
      return {
        success: true,
        file: filePath,
        query,
        results: results.results,
        count: results.count,
        hasMore: results.hasMore,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        file: filePath,
        query
      };
    }
  }
  
  /**
   * Batch process multiple files
   */
  async processBatch(filePaths, operation, options = {}) {
    const results = [];
    const concurrency = Math.min(this.config.maxConcurrentFiles, filePaths.length);
    
    // Process files in batches to avoid overwhelming the system
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const batch = filePaths.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (filePath) => {
        try {
          let result;
          
          switch (operation) {
            case 'hash':
              result = await this.graphHash(filePath, options);
              break;
            case 'index':
              result = await this.graphIndex(filePath, options);
              break;
            default:
              result = { success: false, error: `Unknown operation: ${operation}`, file: filePath };
          }
          
          return result;
        } catch (error) {
          return {
            success: false,
            error: error.message,
            file: filePath
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Emit progress
      this.emit('batch-progress', {
        processed: results.length,
        total: filePaths.length,
        percentage: Math.round((results.length / filePaths.length) * 100)
      });
    }
    
    return {
      results,
      summary: {
        total: filePaths.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };
  }
  
  /**
   * Get processor status and metrics
   */
  getStatus() {
    return {
      canonical: this.canonicalProcessor.getMetrics(),
      indexer: this.indexer.getIndexSummary(),
      config: this.config
    };
  }
  
  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    await this.rdfProcessor.shutdown();
    this.canonicalProcessor.reset();
    this.indexer.clear();
    this.removeAllListeners();
    
    this.logger.info('Enhanced RDF Processor shutdown complete');
  }
}

export default EnhancedRDFProcessor;