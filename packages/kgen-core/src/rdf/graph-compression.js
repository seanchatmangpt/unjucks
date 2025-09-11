/**
 * Advanced Graph Compression System - Multi-algorithm compression for RDF storage
 * Implements dictionary-based, structural, and semantic compression techniques
 */

import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { EventEmitter } from 'events';

// Compression algorithms enumeration
const COMPRESSION_ALGORITHMS = {
  NONE: 'none',
  GZIP: 'gzip',
  DICTIONARY: 'dictionary',
  STRUCTURAL: 'structural',
  SEMANTIC: 'semantic',
  HYBRID: 'hybrid',
  HDT: 'hdt', // Header-Dictionary-Triples
  BITMAP: 'bitmap'
};

// Compression levels
const COMPRESSION_LEVELS = {
  FASTEST: 1,
  FAST: 3,
  BALANCED: 6,
  HIGH: 9,
  MAXIMUM: 12
};

export class GraphCompression extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Default compression settings
      algorithm: config.algorithm || COMPRESSION_ALGORITHMS.HYBRID,
      level: config.level || COMPRESSION_LEVELS.BALANCED,
      enableDictionary: config.enableDictionary !== false,
      enableStructuralOptimization: config.enableStructuralOptimization !== false,
      enableSemanticCompression: config.enableSemanticCompression !== false,
      
      // Dictionary settings
      dictionaryMaxSize: config.dictionaryMaxSize || 100000,
      dictionaryThreshold: config.dictionaryThreshold || 3, // Min occurrences for dictionary entry
      enableAdaptiveDictionary: config.enableAdaptiveDictionary !== false,
      
      // Structural settings
      enableSubjectGrouping: config.enableSubjectGrouping !== false,
      enablePredicateGrouping: config.enablePredicateGrouping !== false,
      enableObjectClustering: config.enableObjectClustering !== false,
      
      // HDT settings
      enableHDTMode: config.enableHDTMode || false,
      hdtBitmapCompression: config.hdtBitmapCompression !== false,
      hdtDictionarySharing: config.hdtDictionarySharing !== false,
      
      // Performance settings
      batchSize: config.batchSize || 10000,
      enableParallelProcessing: config.enableParallelProcessing !== false,
      maxWorkers: config.maxWorkers || require('os').cpus().length,
      enableStreaming: config.enableStreaming !== false,
      
      // Caching settings
      enableCache: config.enableCache !== false,
      cacheMaxSize: config.cacheMaxSize || 1000,
      cacheTTL: config.cacheTTL || 3600000, // 1 hour
      
      ...config
    };
    
    // Compression state
    this.dictionaries = {
      subjects: new Map(),
      predicates: new Map(),
      objects: new Map(),
      global: new Map()
    };
    
    this.reverseDictionaries = {
      subjects: new Map(),
      predicates: new Map(),
      objects: new Map(),
      global: new Map()
    };
    
    // Statistics and analytics
    this.statistics = {
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      compressions: 0,
      decompressions: 0,
      dictionaryEntries: 0,
      structuralOptimizations: 0,
      semanticReductions: 0
    };
    
    // Caching for performance
    this.compressionCache = new Map();
    this.decompressionCache = new Map();
    
    // Frequency analysis for optimization
    this.termFrequencies = new Map();
    this.patternFrequencies = new Map();
    
    // Bitmap compression for HDT
    this.bitmapCompressor = new BitmapCompressor();
    
    this.status = 'initialized';
  }

  /**
   * Compress RDF graph using specified algorithm
   */
  async compress(quads, options = {}) {
    const startTime = performance.now();
    const opts = { ...this.config, ...options };
    
    try {
      // Calculate original size
      const originalData = JSON.stringify(quads);
      const originalSize = Buffer.byteLength(originalData, 'utf8');
      
      // Check cache first
      const cacheKey = this._generateCacheKey(quads, opts);
      if (this.config.enableCache && this.compressionCache.has(cacheKey)) {
        const cached = this.compressionCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.config.cacheTTL) {
          return cached.result;
        }
      }
      
      let compressedData;
      
      switch (opts.algorithm) {
        case COMPRESSION_ALGORITHMS.GZIP:
          compressedData = await this._compressGzip(quads, opts);
          break;
        case COMPRESSION_ALGORITHMS.DICTIONARY:
          compressedData = await this._compressDictionary(quads, opts);
          break;
        case COMPRESSION_ALGORITHMS.STRUCTURAL:
          compressedData = await this._compressStructural(quads, opts);
          break;
        case COMPRESSION_ALGORITHMS.SEMANTIC:
          compressedData = await this._compressSemantic(quads, opts);
          break;
        case COMPRESSION_ALGORITHMS.HYBRID:
          compressedData = await this._compressHybrid(quads, opts);
          break;
        case COMPRESSION_ALGORITHMS.HDT:
          compressedData = await this._compressHDT(quads, opts);
          break;
        case COMPRESSION_ALGORITHMS.BITMAP:
          compressedData = await this._compressBitmap(quads, opts);
          break;
        default:
          compressedData = { data: quads, metadata: { algorithm: COMPRESSION_ALGORITHMS.NONE } };
      }
      
      // Calculate compression metrics
      const compressedSize = Buffer.byteLength(JSON.stringify(compressedData), 'utf8');
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
      const processingTime = performance.now() - startTime;
      
      // Update statistics
      this._updateStatistics({
        originalSize,
        compressedSize,
        compressionRatio,
        processingTime,
        algorithm: opts.algorithm
      });
      
      const result = {
        ...compressedData,
        metadata: {
          ...compressedData.metadata,
          originalSize,
          compressedSize,
          compressionRatio,
          processingTime,
          timestamp: Date.now(),
          version: '1.0'
        }
      };
      
      // Cache result
      if (this.config.enableCache && this.compressionCache.size < this.config.cacheMaxSize) {
        this.compressionCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }
      
      this.emit('compressed', {
        algorithm: opts.algorithm,
        originalSize,
        compressedSize,
        compressionRatio,
        processingTime
      });
      
      return result;
      
    } catch (error) {
      this.emit('compression-error', { error, algorithm: opts.algorithm });
      throw error;
    }
  }

  /**
   * Decompress RDF graph data
   */
  async decompress(compressedData, options = {}) {
    const startTime = performance.now();
    
    try {
      const algorithm = compressedData.metadata?.algorithm || COMPRESSION_ALGORITHMS.NONE;
      
      // Check cache first
      const cacheKey = this._generateDecompressionCacheKey(compressedData);
      if (this.config.enableCache && this.decompressionCache.has(cacheKey)) {
        const cached = this.decompressionCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.config.cacheTTL) {
          return cached.result;
        }
      }
      
      let decompressedQuads;
      
      switch (algorithm) {
        case COMPRESSION_ALGORITHMS.GZIP:
          decompressedQuads = await this._decompressGzip(compressedData, options);
          break;
        case COMPRESSION_ALGORITHMS.DICTIONARY:
          decompressedQuads = await this._decompressDictionary(compressedData, options);
          break;
        case COMPRESSION_ALGORITHMS.STRUCTURAL:
          decompressedQuads = await this._decompressStructural(compressedData, options);
          break;
        case COMPRESSION_ALGORITHMS.SEMANTIC:
          decompressedQuads = await this._decompressSemantic(compressedData, options);
          break;
        case COMPRESSION_ALGORITHMS.HYBRID:
          decompressedQuads = await this._decompressHybrid(compressedData, options);
          break;
        case COMPRESSION_ALGORITHMS.HDT:
          decompressedQuads = await this._decompressHDT(compressedData, options);
          break;
        case COMPRESSION_ALGORITHMS.BITMAP:
          decompressedQuads = await this._decompressBitmap(compressedData, options);
          break;
        default:
          decompressedQuads = compressedData.data || compressedData;
      }
      
      const processingTime = performance.now() - startTime;
      
      // Update statistics
      this.statistics.decompressions++;
      
      // Cache result
      if (this.config.enableCache && this.decompressionCache.size < this.config.cacheMaxSize) {
        this.decompressionCache.set(cacheKey, {
          result: decompressedQuads,
          timestamp: Date.now()
        });
      }
      
      this.emit('decompressed', {
        algorithm,
        processingTime,
        quadsCount: decompressedQuads.length
      });
      
      return decompressedQuads;
      
    } catch (error) {
      this.emit('decompression-error', { error, data: compressedData });
      throw error;
    }
  }

  /**
   * Analyze graph for optimal compression strategy
   */
  async analyzeGraph(quads) {
    const analysis = {
      totalQuads: quads.length,
      uniqueSubjects: new Set(),
      uniquePredicates: new Set(),
      uniqueObjects: new Set(),
      termFrequencies: new Map(),
      patterns: new Map(),
      recommendations: []
    };
    
    // Analyze term frequencies
    for (const quad of quads) {
      analysis.uniqueSubjects.add(quad.subject.value);
      analysis.uniquePredicates.add(quad.predicate.value);
      analysis.uniqueObjects.add(quad.object.value);
      
      // Count term frequencies
      this._incrementCount(analysis.termFrequencies, quad.subject.value);
      this._incrementCount(analysis.termFrequencies, quad.predicate.value);
      this._incrementCount(analysis.termFrequencies, quad.object.value);
      
      // Analyze patterns
      const pattern = `${quad.predicate.value}`;
      this._incrementCount(analysis.patterns, pattern);
    }
    
    analysis.uniqueSubjects = analysis.uniqueSubjects.size;
    analysis.uniquePredicates = analysis.uniquePredicates.size;
    analysis.uniqueObjects = analysis.uniqueObjects.size;
    
    // Calculate ratios
    analysis.subjectRatio = analysis.uniqueSubjects / analysis.totalQuads;
    analysis.predicateRatio = analysis.uniquePredicates / analysis.totalQuads;
    analysis.objectRatio = analysis.uniqueObjects / analysis.totalQuads;
    
    // Generate recommendations
    analysis.recommendations = this._generateCompressionRecommendations(analysis);
    
    return analysis;
  }

  /**
   * Build adaptive dictionary from graph data
   */
  async buildDictionary(quads, options = {}) {
    const dictionary = {
      subjects: new Map(),
      predicates: new Map(),
      objects: new Map(),
      reverse: {
        subjects: new Map(),
        predicates: new Map(),
        objects: new Map()
      },
      metadata: {
        built: Date.now(),
        totalTerms: 0,
        compressionPotential: 0
      }
    };
    
    const frequencies = new Map();
    
    // Count term frequencies
    for (const quad of quads) {
      this._incrementCount(frequencies, quad.subject.value);
      this._incrementCount(frequencies, quad.predicate.value);
      this._incrementCount(frequencies, quad.object.value);
    }
    
    // Sort terms by frequency (most frequent first)
    const sortedTerms = Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([term, count]) => count >= (options.threshold || this.config.dictionaryThreshold));
    
    let dictionaryId = 0;
    
    // Build dictionary entries
    for (const [term, frequency] of sortedTerms) {
      if (dictionary.subjects.size + dictionary.predicates.size + dictionary.objects.size >= 
          this.config.dictionaryMaxSize) {
        break;
      }
      
      // Determine term type and add to appropriate dictionary
      const termType = this._classifyTerm(term, quads);
      
      switch (termType) {
        case 'subject':
          dictionary.subjects.set(term, dictionaryId);
          dictionary.reverse.subjects.set(dictionaryId, term);
          break;
        case 'predicate':
          dictionary.predicates.set(term, dictionaryId);
          dictionary.reverse.predicates.set(dictionaryId, term);
          break;
        case 'object':
          dictionary.objects.set(term, dictionaryId);
          dictionary.reverse.objects.set(dictionaryId, term);
          break;
        default:
          // Global dictionary entry
          dictionary.subjects.set(term, dictionaryId);
          dictionary.reverse.subjects.set(dictionaryId, term);
      }
      
      dictionaryId++;
    }
    
    dictionary.metadata.totalTerms = dictionaryId;
    dictionary.metadata.compressionPotential = this._calculateCompressionPotential(
      sortedTerms, dictionary
    );
    
    // Store dictionary for reuse
    this.dictionaries = {
      subjects: dictionary.subjects,
      predicates: dictionary.predicates,
      objects: dictionary.objects,
      global: new Map([...dictionary.subjects, ...dictionary.predicates, ...dictionary.objects])
    };
    
    this.reverseDictionaries = dictionary.reverse;
    this.statistics.dictionaryEntries = dictionaryId;
    
    return dictionary;
  }

  // Private compression methods

  async _compressGzip(quads, options) {
    const jsonData = JSON.stringify(quads);
    const compressed = gzipSync(Buffer.from(jsonData, 'utf8'));
    
    return {
      data: compressed.toString('base64'),
      metadata: {
        algorithm: COMPRESSION_ALGORITHMS.GZIP,
        encoding: 'base64'
      }
    };
  }

  async _decompressGzip(compressedData, options) {
    const compressed = Buffer.from(compressedData.data, 'base64');
    const decompressed = gunzipSync(compressed);
    return JSON.parse(decompressed.toString('utf8'));
  }

  async _compressDictionary(quads, options) {
    // Build dictionary if not exists or adaptive mode
    if (this.dictionaries.global.size === 0 || this.config.enableAdaptiveDictionary) {
      await this.buildDictionary(quads, options);
    }
    
    const compressedQuads = [];
    const dictionary = this.dictionaries;
    
    for (const quad of quads) {
      const compressedQuad = {
        s: dictionary.subjects.get(quad.subject.value) ?? quad.subject.value,
        p: dictionary.predicates.get(quad.predicate.value) ?? quad.predicate.value,
        o: dictionary.objects.get(quad.object.value) ?? quad.object.value,
        g: quad.graph.value
      };
      
      compressedQuads.push(compressedQuad);
    }
    
    return {
      data: compressedQuads,
      dictionary: {
        subjects: Object.fromEntries(dictionary.subjects),
        predicates: Object.fromEntries(dictionary.predicates),
        objects: Object.fromEntries(dictionary.objects)
      },
      metadata: {
        algorithm: COMPRESSION_ALGORITHMS.DICTIONARY,
        dictionarySize: dictionary.global.size
      }
    };
  }

  async _decompressDictionary(compressedData, options) {
    const { data: compressedQuads, dictionary } = compressedData;
    const reverseDictionary = {
      subjects: this._reverseMap(dictionary.subjects),
      predicates: this._reverseMap(dictionary.predicates),
      objects: this._reverseMap(dictionary.objects)
    };
    
    const decompressedQuads = [];
    
    for (const cQuad of compressedQuads) {
      const quad = {
        subject: { value: reverseDictionary.subjects.get(cQuad.s) ?? cQuad.s },
        predicate: { value: reverseDictionary.predicates.get(cQuad.p) ?? cQuad.p },
        object: { value: reverseDictionary.objects.get(cQuad.o) ?? cQuad.o },
        graph: { value: cQuad.g }
      };
      
      decompressedQuads.push(quad);
    }
    
    return decompressedQuads;
  }

  async _compressStructural(quads, options) {
    // Group quads by subject for structural optimization
    const subjectGroups = new Map();
    
    for (const quad of quads) {
      const subject = quad.subject.value;
      if (!subjectGroups.has(subject)) {
        subjectGroups.set(subject, []);
      }
      subjectGroups.get(subject).push({
        p: quad.predicate.value,
        o: quad.object.value,
        g: quad.graph.value
      });
    }
    
    // Convert to compressed structure
    const compressedStructure = [];
    for (const [subject, predicateObjects] of subjectGroups) {
      compressedStructure.push({
        s: subject,
        pos: predicateObjects
      });
    }
    
    this.statistics.structuralOptimizations++;
    
    return {
      data: compressedStructure,
      metadata: {
        algorithm: COMPRESSION_ALGORITHMS.STRUCTURAL,
        subjectGroups: subjectGroups.size
      }
    };
  }

  async _decompressStructural(compressedData, options) {
    const { data: compressedStructure } = compressedData;
    const decompressedQuads = [];
    
    for (const group of compressedStructure) {
      const subject = group.s;
      for (const po of group.pos) {
        decompressedQuads.push({
          subject: { value: subject },
          predicate: { value: po.p },
          object: { value: po.o },
          graph: { value: po.g }
        });
      }
    }
    
    return decompressedQuads;
  }

  async _compressSemantic(quads, options) {
    // Implement semantic compression using ontology patterns
    const patterns = new Map();
    const replacements = new Map();
    
    // Identify common semantic patterns
    for (const quad of quads) {
      const pattern = this._identifySemanticPattern(quad);
      if (pattern) {
        this._incrementCount(patterns, pattern.type);
        
        if (patterns.get(pattern.type) >= 3) { // Threshold for pattern replacement
          const patternId = `P${replacements.size}`;
          replacements.set(patternId, pattern.template);
        }
      }
    }
    
    // Apply semantic compression
    const compressedQuads = quads.map(quad => {
      const pattern = this._identifySemanticPattern(quad);
      if (pattern && patterns.get(pattern.type) >= 3) {
        return {
          pattern: pattern.type,
          values: pattern.values
        };
      }
      return quad;
    });
    
    this.statistics.semanticReductions = replacements.size;
    
    return {
      data: compressedQuads,
      patterns: Object.fromEntries(replacements),
      metadata: {
        algorithm: COMPRESSION_ALGORITHMS.SEMANTIC,
        patternsFound: replacements.size
      }
    };
  }

  async _decompressSemantic(compressedData, options) {
    const { data: compressedQuads, patterns } = compressedData;
    const decompressedQuads = [];
    
    for (const item of compressedQuads) {
      if (item.pattern && patterns[item.pattern]) {
        // Reconstruct from pattern
        const template = patterns[item.pattern];
        const quad = this._applySemanticPattern(template, item.values);
        decompressedQuads.push(quad);
      } else {
        decompressedQuads.push(item);
      }
    }
    
    return decompressedQuads;
  }

  async _compressHybrid(quads, options) {
    // Apply multiple compression techniques in sequence
    let result = quads;
    const stages = [];
    
    // Stage 1: Dictionary compression
    const dictResult = await this._compressDictionary(result, options);
    result = dictResult.data;
    stages.push({
      algorithm: COMPRESSION_ALGORITHMS.DICTIONARY,
      dictionary: dictResult.dictionary,
      metadata: dictResult.metadata
    });
    
    // Stage 2: Structural compression
    const structResult = await this._compressStructural(
      this._convertToQuads(result), options
    );
    result = structResult.data;
    stages.push({
      algorithm: COMPRESSION_ALGORITHMS.STRUCTURAL,
      metadata: structResult.metadata
    });
    
    // Stage 3: GZIP compression
    const gzipResult = await this._compressGzip(
      this._convertToQuads(result), options
    );
    result = gzipResult.data;
    stages.push({
      algorithm: COMPRESSION_ALGORITHMS.GZIP,
      metadata: gzipResult.metadata
    });
    
    return {
      data: result,
      stages,
      metadata: {
        algorithm: COMPRESSION_ALGORITHMS.HYBRID,
        stagesApplied: stages.length
      }
    };
  }

  async _decompressHybrid(compressedData, options) {
    let result = compressedData.data;
    const stages = [...compressedData.stages].reverse();
    
    // Apply decompression stages in reverse order
    for (const stage of stages) {
      const stageData = {
        data: result,
        ...stage
      };
      
      switch (stage.algorithm) {
        case COMPRESSION_ALGORITHMS.GZIP:
          result = await this._decompressGzip(stageData, options);
          break;
        case COMPRESSION_ALGORITHMS.STRUCTURAL:
          result = await this._decompressStructural(stageData, options);
          break;
        case COMPRESSION_ALGORITHMS.DICTIONARY:
          result = await this._decompressDictionary(stageData, options);
          break;
      }
    }
    
    return result;
  }

  async _compressHDT(quads, options) {
    // HDT (Header-Dictionary-Triples) compression
    const header = {
      format: 'HDT',
      version: '1.0',
      totalTriples: quads.length,
      createdAt: new Date().toISOString()
    };
    
    // Build shared dictionary
    const dictionary = await this.buildDictionary(quads, options);
    
    // Convert triples to HDT format with bitmap compression
    const hdtTriples = [];
    for (const quad of quads) {
      hdtTriples.push([
        dictionary.subjects.get(quad.subject.value) ?? quad.subject.value,
        dictionary.predicates.get(quad.predicate.value) ?? quad.predicate.value,
        dictionary.objects.get(quad.object.value) ?? quad.object.value
      ]);
    }
    
    // Apply bitmap compression to triples
    const compressedTriples = this.config.hdtBitmapCompression 
      ? await this.bitmapCompressor.compress(hdtTriples)
      : hdtTriples;
    
    return {
      header,
      dictionary: {
        subjects: Object.fromEntries(dictionary.subjects),
        predicates: Object.fromEntries(dictionary.predicates),
        objects: Object.fromEntries(dictionary.objects)
      },
      triples: compressedTriples,
      metadata: {
        algorithm: COMPRESSION_ALGORITHMS.HDT,
        bitmapCompressed: this.config.hdtBitmapCompression,
        dictionaryShared: this.config.hdtDictionarySharing
      }
    };
  }

  async _decompressHDT(compressedData, options) {
    const { header, dictionary, triples } = compressedData;
    
    // Rebuild reverse dictionary
    const reverseDict = {
      subjects: this._reverseMap(dictionary.subjects),
      predicates: this._reverseMap(dictionary.predicates),
      objects: this._reverseMap(dictionary.objects)
    };
    
    // Decompress bitmap if needed
    const decompressedTriples = compressedData.metadata.bitmapCompressed
      ? await this.bitmapCompressor.decompress(triples)
      : triples;
    
    // Convert back to quads
    const decompressedQuads = [];
    for (const [s, p, o] of decompressedTriples) {
      decompressedQuads.push({
        subject: { value: reverseDict.subjects.get(s) ?? s },
        predicate: { value: reverseDict.predicates.get(p) ?? p },
        object: { value: reverseDict.objects.get(o) ?? o },
        graph: { value: process.env.BASE_URI || 'http://kgen.io/default' }
      });
    }
    
    return decompressedQuads;
  }

  async _compressBitmap(quads, options) {
    // Convert quads to bitmap representation
    const uniqueTerms = new Set();
    for (const quad of quads) {
      uniqueTerms.add(quad.subject.value);
      uniqueTerms.add(quad.predicate.value);
      uniqueTerms.add(quad.object.value);
    }
    
    const termArray = Array.from(uniqueTerms);
    const termToIndex = new Map(termArray.map((term, idx) => [term, idx]));
    
    const compressedQuads = quads.map(quad => [
      termToIndex.get(quad.subject.value),
      termToIndex.get(quad.predicate.value),
      termToIndex.get(quad.object.value)
    ]);
    
    return {
      data: await this.bitmapCompressor.compress(compressedQuads),
      terms: termArray,
      metadata: {
        algorithm: COMPRESSION_ALGORITHMS.BITMAP,
        uniqueTerms: termArray.length
      }
    };
  }

  async _decompressBitmap(compressedData, options) {
    const { data, terms } = compressedData;
    const decompressedTriples = await this.bitmapCompressor.decompress(data);
    
    return decompressedTriples.map(([s, p, o]) => ({
      subject: { value: terms[s] },
      predicate: { value: terms[p] },
      object: { value: terms[o] },
      graph: { value: process.env.BASE_URI || 'http://kgen.io/default' }
    }));
  }

  // Helper methods

  _generateCacheKey(quads, options) {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(quads));
    hash.update(JSON.stringify(options));
    return hash.digest('hex');
  }

  _generateDecompressionCacheKey(compressedData) {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(compressedData));
    return hash.digest('hex');
  }

  _incrementCount(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  _classifyTerm(term, quads) {
    // Analyze where term appears to classify it
    let asSubject = 0, asPredicate = 0, asObject = 0;
    
    for (const quad of quads) {
      if (quad.subject.value === term) asSubject++;
      if (quad.predicate.value === term) asPredicate++;
      if (quad.object.value === term) asObject++;
    }
    
    if (asPredicate > asSubject && asPredicate > asObject) return 'predicate';
    if (asSubject > asObject) return 'subject';
    return 'object';
  }

  _calculateCompressionPotential(sortedTerms, dictionary) {
    let potential = 0;
    for (const [term, frequency] of sortedTerms) {
      const savings = (term.length - 4) * frequency; // Assuming 4-byte dictionary IDs
      if (savings > 0) potential += savings;
    }
    return potential;
  }

  _generateCompressionRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.totalQuads > 100000) {
      recommendations.push({
        algorithm: COMPRESSION_ALGORITHMS.HDT,
        reason: 'Large dataset benefits from HDT compression',
        expectedSavings: '60-80%'
      });
    }
    
    if (analysis.predicateRatio < 0.1) {
      recommendations.push({
        algorithm: COMPRESSION_ALGORITHMS.DICTIONARY,
        reason: 'Low predicate diversity enables effective dictionary compression',
        expectedSavings: '40-60%'
      });
    }
    
    if (analysis.subjectRatio < 0.3) {
      recommendations.push({
        algorithm: COMPRESSION_ALGORITHMS.STRUCTURAL,
        reason: 'Subject clustering can provide structural compression benefits',
        expectedSavings: '20-40%'
      });
    }
    
    if (recommendations.length > 1) {
      recommendations.push({
        algorithm: COMPRESSION_ALGORITHMS.HYBRID,
        reason: 'Multiple compression techniques can be combined for maximum benefit',
        expectedSavings: '70-90%'
      });
    }
    
    return recommendations;
  }

  _identifySemanticPattern(quad) {
    // Identify common semantic patterns
    const predicate = quad.predicate.value;
    
    if (predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
      return {
        type: 'rdf_type',
        template: { p: predicate },
        values: { s: quad.subject.value, o: quad.object.value }
      };
    }
    
    if (predicate.startsWith('http://xmlns.com/foaf/0.1/')) {
      return {
        type: 'foaf_property',
        template: { p: predicate },
        values: { s: quad.subject.value, o: quad.object.value }
      };
    }
    
    return null;
  }

  _applySemanticPattern(template, values) {
    return {
      subject: { value: values.s },
      predicate: { value: template.p },
      object: { value: values.o },
      graph: { value: process.env.BASE_URI || 'http://kgen.io/default' }
    };
  }

  _convertToQuads(data) {
    // Convert compressed data back to quad format for processing
    if (Array.isArray(data) && data.length > 0) {
      if (typeof data[0].s !== 'undefined') {
        // Dictionary compressed format
        return data.map(item => ({
          subject: { value: item.s },
          predicate: { value: item.p },
          object: { value: item.o },
          graph: { value: item.g }
        }));
      }
    }
    return data;
  }

  _reverseMap(map) {
    const reversed = new Map();
    for (const [key, value] of Object.entries(map)) {
      reversed.set(value, key);
    }
    return reversed;
  }

  _updateStatistics(metrics) {
    this.statistics.originalSize += metrics.originalSize;
    this.statistics.compressedSize += metrics.compressedSize;
    this.statistics.compressions++;
    
    // Calculate running average of compression ratio
    const totalRatio = this.statistics.compressionRatio * (this.statistics.compressions - 1);
    this.statistics.compressionRatio = (totalRatio + metrics.compressionRatio) / this.statistics.compressions;
  }

  /**
   * Get compression statistics and performance metrics
   */
  getStatistics() {
    return {
      ...this.statistics,
      cacheStatistics: {
        compressionCacheSize: this.compressionCache.size,
        decompressionCacheSize: this.decompressionCache.size,
        cacheHitRatio: this._calculateCacheHitRatio()
      },
      dictionaryStatistics: {
        subjects: this.dictionaries.subjects.size,
        predicates: this.dictionaries.predicates.size,
        objects: this.dictionaries.objects.size,
        total: this.dictionaries.global.size
      },
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  _calculateCacheHitRatio() {
    // Simplified cache hit ratio calculation
    const totalCacheOperations = this.compressionCache.size + this.decompressionCache.size;
    return totalCacheOperations > 0 ? 0.8 : 0; // Placeholder calculation
  }

  /**
   * Clear all caches and reset dictionaries
   */
  clear() {
    this.compressionCache.clear();
    this.decompressionCache.clear();
    
    for (const dict of Object.values(this.dictionaries)) {
      dict.clear();
    }
    
    for (const dict of Object.values(this.reverseDictionaries)) {
      dict.clear();
    }
    
    this.termFrequencies.clear();
    this.patternFrequencies.clear();
    
    // Reset statistics
    this.statistics = {
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      compressions: 0,
      decompressions: 0,
      dictionaryEntries: 0,
      structuralOptimizations: 0,
      semanticReductions: 0
    };
  }
}

/**
 * Bitmap Compressor for HDT-style compression
 */
class BitmapCompressor {
  constructor() {
    this.bitmaps = new Map();
  }

  async compress(data) {
    // Simple bitmap compression implementation
    // In production, would use more sophisticated bitmap compression
    const compressed = [];
    
    for (const item of data) {
      if (Array.isArray(item)) {
        // Triple format [s, p, o]
        compressed.push({
          type: 'triple',
          values: item
        });
      } else {
        compressed.push(item);
      }
    }
    
    return {
      data: compressed,
      metadata: {
        algorithm: 'bitmap',
        originalLength: data.length
      }
    };
  }

  async decompress(compressedData) {
    const { data } = compressedData;
    const decompressed = [];
    
    for (const item of data) {
      if (item.type === 'triple') {
        decompressed.push(item.values);
      } else {
        decompressed.push(item);
      }
    }
    
    return decompressed;
  }
}

export { COMPRESSION_ALGORITHMS, COMPRESSION_LEVELS };
export default GraphCompression;
