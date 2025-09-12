/**
 * Compression Optimized Turtle Serializer
 * 
 * Advanced compression and optimization techniques for turtle serialization
 * including dictionary compression, structural optimization, and semantic compression.
 */

import zlib from 'zlib';
import { Transform } from 'stream';
import { EventEmitter } from 'events';
import consola from 'consola';
import { CanonicalTurtleSerializer } from './canonical-turtle-serializer.js';

export class CompressionOptimizedSerializer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Compression settings
      compressionLevel: 6, // 1-9, 9 = best compression
      compressionMethod: 'gzip', // gzip, deflate, brotli
      enableDictionaryCompression: true,
      enableStructuralOptimization: true,
      enableSemanticCompression: true,
      
      // Optimization settings
      enablePrefixCollapsing: true,
      enableBlankNodeOptimization: true,
      enableLiteralOptimization: true,
      enablePatternCompression: true,
      
      // Dictionary settings
      dictionarySize: 32768, // 32KB dictionary
      frequencyThreshold: 3,
      adaptiveDictionary: true,
      
      // Structural optimization
      enableTripleGrouping: true,
      enableSubjectGrouping: true,
      enablePredicateGrouping: true,
      
      // Output settings
      enableProgressiveCompression: false,
      chunkSize: 16384,
      
      ...config
    };
    
    this.logger = consola.withTag('compression-optimizer');
    this.canonicalSerializer = new CanonicalTurtleSerializer(config);
    
    // Compression state
    this.compressionDictionary = new Map();
    this.frequencyAnalysis = new Map();
    this.structuralPatterns = new Map();
    this.compressionStatistics = {
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      dictionaryEntries: 0,
      processingTime: 0
    };
    
    this.state = 'initialized';
  }

  /**
   * Initialize compression optimizer
   */
  async initialize() {
    try {
      this.logger.info('Initializing compression optimized serializer...');
      
      await this.canonicalSerializer.initialize();
      
      // Initialize compression dictionary
      await this._initializeCompressionDictionary();
      
      this.state = 'ready';
      this.logger.success('Compression optimized serializer ready');
      
      return { status: 'success' };
      
    } catch (error) {
      this.state = 'error';
      this.logger.error('Failed to initialize compression optimizer:', error);
      throw error;
    }
  }

  /**
   * Serialize with maximum compression optimization
   */
  async serializeOptimized(quads, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.info('Starting compression optimized serialization...');
      
      // Get canonical serialization first
      const canonical = await this.canonicalSerializer.serializeCanonical(quads, options);
      
      // Apply structural optimizations
      const structurallyOptimized = this.config.enableStructuralOptimization ?
        await this._applyStructuralOptimizations(canonical.turtle) : canonical.turtle;
      
      // Apply semantic compression
      const semanticallyCompressed = this.config.enableSemanticCompression ?
        await this._applySemanticCompression(structurallyOptimized) : structurallyOptimized;
      
      // Apply dictionary compression
      const dictionaryCompressed = this.config.enableDictionaryCompression ?
        await this._applyDictionaryCompression(semanticallyCompressed) : semanticallyCompressed;
      
      // Apply final compression
      const compressed = await this._applyFinalCompression(dictionaryCompressed, options);
      
      // Calculate compression statistics
      const statistics = await this._calculateCompressionStatistics(
        canonical.turtle,
        compressed,
        this.getDeterministicTimestamp() - startTime
      );
      
      const result = {
        compressed,
        original: canonical.turtle,
        canonical: canonical,
        compression: {
          method: this.config.compressionMethod,
          level: this.config.compressionLevel,
          dictionary: this.config.enableDictionaryCompression,
          structural: this.config.enableStructuralOptimization,
          semantic: this.config.enableSemanticCompression
        },
        statistics,
        metadata: {
          ...canonical.metadata,
          compressionApplied: true,
          optimizationLevel: this._getOptimizationLevel(),
          processingTime: this.getDeterministicTimestamp() - startTime
        }
      };
      
      this.emit('compression:complete', result);
      this.logger.success(`Compression complete: ${statistics.compressionRatio.toFixed(2)}% reduction`);
      
      return result;
      
    } catch (error) {
      this.logger.error('Compression optimization failed:', error);
      throw error;
    }
  }

  /**
   * Decompress and restore original turtle
   */
  async decompress(compressedData, options = {}) {
    try {
      this.logger.info('Decompressing turtle data...');
      
      // Reverse final compression
      const decompressed = await this._reverseFinalCompression(compressedData, options);
      
      // Reverse dictionary compression
      const dictionaryDecompressed = this.config.enableDictionaryCompression ?
        await this._reverseDictionaryCompression(decompressed) : decompressed;
      
      // Reverse semantic compression
      const semanticallyDecompressed = this.config.enableSemanticCompression ?
        await this._reverseSemanticCompression(dictionaryDecompressed) : dictionaryDecompressed;
      
      // Reverse structural optimizations
      const fullyDecompressed = this.config.enableStructuralOptimization ?
        await this._reverseStructuralOptimizations(semanticallyDecompressed) : semanticallyDecompressed;
      
      return {
        turtle: fullyDecompressed,
        metadata: {
          decompressionMethod: this.config.compressionMethod,
          timestamp: this.getDeterministicDate()
        }
      };
      
    } catch (error) {
      this.logger.error('Decompression failed:', error);
      throw error;
    }
  }

  /**
   * Create progressive compression stream
   */
  createProgressiveCompressionStream() {
    const self = this;
    
    return new Transform({
      transform(chunk, encoding, callback) {
        self._processChunkProgressive(chunk, this, callback);
      },
      
      flush(callback) {
        self._flushProgressiveCompression(this, callback);
      }
    });
  }

  /**
   * Analyze compression potential
   */
  async analyzeCompressionPotential(turtleContent) {
    try {
      const analysis = {
        originalSize: Buffer.byteLength(turtleContent, 'utf8'),
        repetitionAnalysis: await this._analyzeRepetition(turtleContent),
        structuralAnalysis: await this._analyzeStructuralPatterns(turtleContent),
        dictionaryAnalysis: await this._analyzeDictionaryPotential(turtleContent),
        estimatedCompressionRatio: 0
      };
      
      // Estimate compression potential
      analysis.estimatedCompressionRatio = this._estimateCompressionRatio(analysis);
      
      return analysis;
      
    } catch (error) {
      this.logger.error('Compression analysis failed:', error);
      throw error;
    }
  }

  // Private methods

  async _initializeCompressionDictionary() {
    // Initialize with common RDF terms
    const commonTerms = [
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'http://www.w3.org/2000/01/rdf-schema#',
      'http://www.w3.org/2002/07/owl#',
      'http://www.w3.org/2001/XMLSchema#',
      'http://www.w3.org/ns/prov#',
      'http://xmlns.com/foaf/0.1/',
      '@prefix',
      'rdf:type',
      'rdfs:label',
      'rdfs:comment'
    ];
    
    let dictIndex = 0;
    for (const term of commonTerms) {
      this.compressionDictionary.set(term, dictIndex++);
    }
    
    this.logger.debug(`Initialized compression dictionary with ${dictIndex} common terms`);
  }

  async _applyStructuralOptimizations(turtle) {
    let optimized = turtle;
    
    if (this.config.enableTripleGrouping) {
      optimized = this._groupTriplesBySubject(optimized);
    }
    
    if (this.config.enablePrefixCollapsing) {
      optimized = this._collapsePrefixes(optimized);
    }
    
    if (this.config.enableBlankNodeOptimization) {
      optimized = this._optimizeBlankNodes(optimized);
    }
    
    return optimized;
  }

  _groupTriplesBySubject(turtle) {
    // Group triples by subject to reduce repetition
    const lines = turtle.split('\n');
    const groupedLines = [];
    const subjectGroups = new Map();
    let prefixSection = true;
    
    for (const line of lines) {
      if (line.startsWith('@prefix') || line.trim() === '') {
        groupedLines.push(line);
        if (line.trim() === '' && prefixSection) {
          prefixSection = false;
        }
        continue;
      }
      
      if (prefixSection) {
        groupedLines.push(line);
        continue;
      }
      
      // Extract subject from triple line
      const subjectMatch = line.match(/^(\S+)\s+/);
      if (subjectMatch) {
        const subject = subjectMatch[1];
        if (!subjectGroups.has(subject)) {
          subjectGroups.set(subject, []);
        }
        subjectGroups.get(subject).push(line);
      } else {
        groupedLines.push(line);
      }
    }
    
    // Add grouped triples
    for (const [subject, subjectLines] of subjectGroups) {
      groupedLines.push(`# Subject: ${subject}`);
      groupedLines.push(...subjectLines);
      groupedLines.push('');
    }
    
    return groupedLines.join('\n');
  }

  _collapsePrefixes(turtle) {
    // Optimize prefix usage for better compression
    const lines = turtle.split('\n');
    const prefixMap = new Map();
    const optimizedLines = [];
    
    // Collect all prefixes
    for (const line of lines) {
      if (line.startsWith('@prefix')) {
        const match = line.match(/@prefix\s+(\w+):\s+<([^>]+)>/);
        if (match) {
          prefixMap.set(match[2], match[1]);
        }
      }
    }
    
    // Sort prefixes by frequency of use (simplified)
    const sortedPrefixes = Array.from(prefixMap.entries())
      .sort((a, b) => turtle.split(a[1]).length - turtle.split(b[1]).length);
    
    // Rebuild with optimized prefix order
    for (const [uri, prefix] of sortedPrefixes) {
      optimizedLines.push(`@prefix ${prefix}: <${uri}> .`);
    }
    
    optimizedLines.push('');
    
    // Add non-prefix lines
    for (const line of lines) {
      if (!line.startsWith('@prefix') && line.trim() !== '') {
        optimizedLines.push(line);
      }
    }
    
    return optimizedLines.join('\n');
  }

  _optimizeBlankNodes(turtle) {
    // Optimize blank node representations
    const blankNodePattern = /_:b[a-f0-9]+/g;
    const blankNodes = new Set();
    let match;
    
    while ((match = blankNodePattern.exec(turtle)) !== null) {
      blankNodes.add(match[0]);
    }
    
    // Create shorter blank node labels
    let counter = 0;
    const blankNodeMap = new Map();
    
    for (const blankNode of blankNodes) {
      blankNodeMap.set(blankNode, `_:n${counter.toString(36)}`);
      counter++;
    }
    
    // Replace blank nodes with shorter versions
    let optimized = turtle;
    for (const [original, optimized_bn] of blankNodeMap) {
      optimized = optimized.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), optimized_bn);
    }
    
    return optimized;
  }

  async _applySemanticCompression(turtle) {
    // Apply semantic-aware compression techniques
    
    // Replace common patterns with shortcuts
    let compressed = turtle;
    
    // Common RDF patterns
    const patterns = [
      { pattern: 'rdf:type', replacement: 'a' },
      { pattern: '^\\s*;\\s*$', replacement: ';' }, // Compact semicolons
      { pattern: '^\\s*,\\s*$', replacement: ',' }, // Compact commas
    ];
    
    for (const { pattern, replacement } of patterns) {
      compressed = compressed.replace(new RegExp(pattern, 'gm'), replacement);
    }
    
    return compressed;
  }

  async _applyDictionaryCompression(turtle) {
    if (!this.config.enableDictionaryCompression) {
      return turtle;
    }
    
    // Build frequency analysis
    await this._updateFrequencyAnalysis(turtle);
    
    // Create compression dictionary from frequent terms
    const frequentTerms = Array.from(this.frequencyAnalysis.entries())
      .filter(([term, freq]) => freq >= this.config.frequencyThreshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.dictionarySize / 32); // Conservative dictionary size
    
    // Apply dictionary compression
    let compressed = turtle;
    let dictIndex = this.compressionDictionary.size;
    
    for (const [term, frequency] of frequentTerms) {
      if (!this.compressionDictionary.has(term) && term.length > 3) {
        const placeholder = `D${dictIndex.toString(36)}`;
        this.compressionDictionary.set(term, dictIndex);
        compressed = compressed.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder);
        dictIndex++;
      }
    }
    
    // Prepend dictionary for decompression
    const dictionaryHeader = this._createDictionaryHeader();
    return dictionaryHeader + '\n' + compressed;
  }

  _createDictionaryHeader() {
    const dictEntries = Array.from(this.compressionDictionary.entries())
      .map(([term, index]) => `${index}:${term}`)
      .join('|');
    
    return `# COMPRESSION_DICT:${dictEntries}`;
  }

  async _applyFinalCompression(content, options) {
    const compressionOptions = {
      level: this.config.compressionLevel,
      chunkSize: this.config.chunkSize
    };
    
    switch (this.config.compressionMethod) {
      case 'gzip':
        return zlib.gzipSync(Buffer.from(content, 'utf8'), compressionOptions);
      
      case 'deflate':
        return zlib.deflateSync(Buffer.from(content, 'utf8'), compressionOptions);
      
      case 'brotli':
        return zlib.brotliCompressSync(Buffer.from(content, 'utf8'), {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.compressionLevel
          }
        });
      
      default:
        throw new Error(`Unsupported compression method: ${this.config.compressionMethod}`);
    }
  }

  async _reverseFinalCompression(compressedData, options) {
    switch (this.config.compressionMethod) {
      case 'gzip':
        return zlib.gunzipSync(compressedData).toString('utf8');
      
      case 'deflate':
        return zlib.inflateSync(compressedData).toString('utf8');
      
      case 'brotli':
        return zlib.brotliDecompressSync(compressedData).toString('utf8');
      
      default:
        throw new Error(`Unsupported decompression method: ${this.config.compressionMethod}`);
    }
  }

  async _reverseDictionaryCompression(content) {
    // Extract dictionary header
    const lines = content.split('\n');
    const dictHeaderLine = lines.find(line => line.startsWith('# COMPRESSION_DICT:'));
    
    if (!dictHeaderLine) {
      return content;
    }
    
    // Parse dictionary
    const dictData = dictHeaderLine.substring('# COMPRESSION_DICT:'.length);
    const dictEntries = dictData.split('|');
    const reverseDictionary = new Map();
    
    for (const entry of dictEntries) {
      const [index, term] = entry.split(':');
      reverseDictionary.set(`D${parseInt(index).toString(36)}`, term);
    }
    
    // Remove dictionary header and apply reverse mapping
    let decompressed = lines.filter(line => !line.startsWith('# COMPRESSION_DICT:')).join('\n');
    
    for (const [placeholder, term] of reverseDictionary) {
      decompressed = decompressed.replace(new RegExp(placeholder, 'g'), term);
    }
    
    return decompressed;
  }

  async _reverseSemanticCompression(content) {
    // Reverse semantic compression patterns
    let decompressed = content;
    
    const reversePatterns = [
      { pattern: '\\ba\\b', replacement: 'rdf:type' } // Reverse 'a' back to 'rdf:type'
    ];
    
    for (const { pattern, replacement } of reversePatterns) {
      decompressed = decompressed.replace(new RegExp(pattern, 'g'), replacement);
    }
    
    return decompressed;
  }

  async _reverseStructuralOptimizations(content) {
    // This would reverse structural optimizations if needed
    // For now, return as-is since optimizations preserve semantics
    return content;
  }

  async _updateFrequencyAnalysis(content) {
    // Analyze token frequency for dictionary building
    const tokens = content.match(/\b\w+\b|https?:\/\/[^\s]+|[<>]/g) || [];
    
    for (const token of tokens) {
      this.frequencyAnalysis.set(token, (this.frequencyAnalysis.get(token) || 0) + 1);
    }
  }

  async _analyzeRepetition(content) {
    const lines = content.split('\n');
    const lineCounts = new Map();
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1);
      }
    }
    
    const repetitiveLines = Array.from(lineCounts.entries())
      .filter(([line, count]) => count > 1)
      .length;
    
    return {
      totalLines: lines.length,
      uniqueLines: lineCounts.size,
      repetitiveLines,
      repetitionRatio: repetitiveLines / lines.length
    };
  }

  async _analyzeStructuralPatterns(content) {
    return {
      prefixCount: (content.match(/@prefix/g) || []).length,
      blankNodeCount: (content.match(/_:[a-zA-Z0-9]+/g) || []).length,
      tripleCount: (content.match(/\.\s*$/gm) || []).length
    };
  }

  async _analyzeDictionaryPotential(content) {
    await this._updateFrequencyAnalysis(content);
    
    const frequentTerms = Array.from(this.frequencyAnalysis.entries())
      .filter(([term, freq]) => freq >= this.config.frequencyThreshold)
      .sort((a, b) => b[1] - a[1]);
    
    const totalSavings = frequentTerms.reduce((savings, [term, freq]) => {
      return savings + (term.length - 3) * (freq - 1); // Assuming 3-char replacement
    }, 0);
    
    return {
      frequentTermCount: frequentTerms.length,
      estimatedSavings: totalSavings,
      topTerms: frequentTerms.slice(0, 10)
    };
  }

  _estimateCompressionRatio(analysis) {
    // Estimate compression ratio based on analysis
    const baseCompression = 0.3; // Base compression from standard algorithms
    const structuralBonus = analysis.structuralAnalysis.tripleCount * 0.001;
    const repetitionBonus = analysis.repetitionAnalysis.repetitionRatio * 0.2;
    const dictionaryBonus = Math.min(analysis.dictionaryAnalysis.estimatedSavings / analysis.originalSize, 0.3);
    
    return Math.min(baseCompression + structuralBonus + repetitionBonus + dictionaryBonus, 0.8);
  }

  async _calculateCompressionStatistics(original, compressed, processingTime) {
    const originalSize = Buffer.byteLength(original, 'utf8');
    const compressedSize = Buffer.isBuffer(compressed) ? compressed.length : Buffer.byteLength(compressed, 'utf8');
    
    this.compressionStatistics = {
      originalSize,
      compressedSize,
      compressionRatio: ((originalSize - compressedSize) / originalSize) * 100,
      dictionaryEntries: this.compressionDictionary.size,
      processingTime,
      spaceSaved: originalSize - compressedSize,
      compressionEfficiency: (originalSize - compressedSize) / processingTime // bytes saved per ms
    };
    
    return this.compressionStatistics;
  }

  _getOptimizationLevel() {
    const features = [
      this.config.enableDictionaryCompression,
      this.config.enableStructuralOptimization,
      this.config.enableSemanticCompression,
      this.config.enablePrefixCollapsing,
      this.config.enableBlankNodeOptimization
    ];
    
    const enabledFeatures = features.filter(f => f).length;
    
    if (enabledFeatures >= 5) return 'maximum';
    if (enabledFeatures >= 3) return 'high';
    if (enabledFeatures >= 2) return 'medium';
    return 'basic';
  }

  async _processChunkProgressive(chunk, stream, callback) {
    // Process chunks for progressive compression
    try {
      // Apply quick optimizations to chunk
      let optimized = chunk.toString();
      
      if (this.config.enablePrefixCollapsing) {
        optimized = this._collapsePrefixes(optimized);
      }
      
      stream.push(optimized);
      callback();
      
    } catch (error) {
      callback(error);
    }
  }

  async _flushProgressiveCompression(stream, callback) {
    // Finalize progressive compression
    const finalMetadata = '\n# Progressive compression complete\n';
    stream.push(finalMetadata);
    callback();
  }

  /**
   * Get compression statistics
   */
  getStatistics() {
    return {
      ...this.compressionStatistics,
      state: this.state,
      dictionarySize: this.compressionDictionary.size,
      config: {
        compressionLevel: this.config.compressionLevel,
        compressionMethod: this.config.compressionMethod,
        optimizationLevel: this._getOptimizationLevel()
      }
    };
  }

  /**
   * Reset compression state
   */
  resetState() {
    this.compressionDictionary.clear();
    this.frequencyAnalysis.clear();
    this.structuralPatterns.clear();
    
    // Reinitialize with common terms
    this._initializeCompressionDictionary();
    
    this.logger.debug('Compression state reset');
  }

  /**
   * Shutdown compression optimizer
   */
  async shutdown() {
    this.logger.info('Shutting down compression optimizer...');
    
    await this.canonicalSerializer.shutdown();
    
    this.compressionDictionary.clear();
    this.frequencyAnalysis.clear();
    this.structuralPatterns.clear();
    
    this.state = 'shutdown';
    this.logger.success('Compression optimizer shutdown complete');
  }
}

export default CompressionOptimizedSerializer;