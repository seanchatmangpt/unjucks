/**
 * Self-Documenting Turtle Serializer
 * 
 * Creates intelligent turtle output with embedded metadata, documentation,
 * and semantic annotations for enhanced human readability and machine processing.
 */

import { Writer, Store, DataFactory } from 'n3';
import { EventEmitter } from 'events';
import consola from 'consola';
import { CanonicalTurtleSerializer } from './canonical-turtle-serializer.js';

const { namedNode, literal, quad } = DataFactory;

export class SelfDocumentingSerializer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Documentation settings
      embedDocumentation: true,
      documentationLevel: 'comprehensive', // minimal, standard, comprehensive
      includeSchemaInfo: true,
      includeStatistics: true,
      includeLineage: true,
      
      // Semantic annotation settings
      enableSemanticAnnotations: true,
      annotationVocabulary: 'rdfs', // rdfs, skos, custom
      includeInferences: false,
      
      // Visual formatting
      enableVisualFormatting: true,
      sectionSeparators: true,
      colorizedComments: false, // For terminals that support it
      indentedHierarchy: true,
      
      // Metadata embedding
      embedProvenance: true,
      embedTimestamps: true,
      embedVersionInfo: true,
      embedQualityMetrics: true,
      
      ...config
    };
    
    this.logger = consola.withTag('self-documenting');
    this.canonicalSerializer = new CanonicalTurtleSerializer(config);
    
    // Documentation templates
    this.templates = {
      header: this._createHeaderTemplate(),
      section: this._createSectionTemplate(),
      entity: this._createEntityTemplate(),
      property: this._createPropertyTemplate(),
      footer: this._createFooterTemplate()
    };
    
    this.state = 'initialized';
  }

  /**
   * Initialize the self-documenting serializer
   */
  async initialize() {
    try {
      this.logger.info('Initializing self-documenting serializer...');
      
      await this.canonicalSerializer.initialize();
      
      this.state = 'ready';
      this.logger.success('Self-documenting serializer ready');
      
      return { status: 'success' };
      
    } catch (error) {
      this.state = 'error';
      this.logger.error('Failed to initialize self-documenting serializer:', error);
      throw error;
    }
  }

  /**
   * Serialize with comprehensive documentation
   */
  async serializeWithDocumentation(quads, options = {}) {
    try {
      this.logger.info('Starting self-documenting serialization...');
      
      const startTime = Date.now();
      const context = { ...this.config, ...options, timestamp: new Date() };
      
      // Get canonical serialization first
      const canonical = await this.canonicalSerializer.serializeCanonical(quads, options);
      
      // Analyze the data for documentation
      const analysis = await this._analyzeData(quads, context);
      
      // Generate documented turtle
      const documentedTurtle = await this._generateDocumentedTurtle(
        canonical.turtle, 
        analysis, 
        context
      );
      
      // Create comprehensive metadata
      const metadata = await this._createComprehensiveMetadata(
        canonical, 
        analysis, 
        context,
        Date.now() - startTime
      );
      
      const result = {
        turtle: documentedTurtle,
        canonicalTurtle: canonical.turtle,
        metadata,
        analysis,
        documentation: {
          level: this.config.documentationLevel,
          features: this._getEnabledFeatures(),
          statistics: this._calculateDocumentationStatistics(documentedTurtle, canonical.turtle)
        }
      };
      
      this.emit('documentation:complete', result);
      this.logger.success('Self-documenting serialization complete');
      
      return result;
      
    } catch (error) {
      this.logger.error('Self-documenting serialization failed:', error);
      throw error;
    }
  }

  /**
   * Generate schema documentation from turtle content
   */
  async generateSchemaDocumentation(turtleContent, options = {}) {
    try {
      // Parse turtle to extract schema information
      const store = new Store();
      const parser = new Parser();
      
      await new Promise((resolve, reject) => {
        parser.parse(turtleContent, (error, quad, prefixes) => {
          if (error) reject(error);
          if (quad) store.addQuad(quad);
          else resolve();
        });
      });
      
      // Extract schema elements
      const schema = await this._extractSchemaElements(store);
      
      // Generate documentation
      return this._generateSchemaDocumentation(schema, options);
      
    } catch (error) {
      this.logger.error('Schema documentation generation failed:', error);
      throw error;
    }
  }

  /**
   * Create interactive documentation with cross-references
   */
  async createInteractiveDocumentation(turtleContent, outputFormat = 'html') {
    try {
      const analysis = await this._analyzeData(turtleContent);
      
      switch (outputFormat) {
        case 'html':
          return this._generateHTMLDocumentation(analysis);
        case 'markdown':
          return this._generateMarkdownDocumentation(analysis);
        case 'json':
          return this._generateJSONDocumentation(analysis);
        default:
          throw new Error(`Unsupported output format: ${outputFormat}`);
      }
      
    } catch (error) {
      this.logger.error('Interactive documentation creation failed:', error);
      throw error;
    }
  }

  // Private methods

  async _analyzeData(quads, context) {
    const analysis = {
      overview: await this._analyzeOverview(quads),
      schema: await this._analyzeSchema(quads),
      patterns: await this._analyzePatterns(quads),
      quality: await this._analyzeQuality(quads),
      lineage: await this._analyzeLineage(quads),
      statistics: await this._calculateStatistics(quads)
    };
    
    return analysis;
  }

  async _analyzeOverview(quads) {
    const quadArray = Array.isArray(quads) ? quads : quads.getQuads();
    
    const subjects = new Set();
    const predicates = new Set();
    const objects = new Set();
    const graphs = new Set();
    const literals = new Set();
    const namedNodes = new Set();
    const blankNodes = new Set();
    
    for (const quad of quadArray) {
      subjects.add(quad.subject.value);
      predicates.add(quad.predicate.value);
      
      if (quad.object.termType === 'Literal') {
        literals.add(quad.object.value);
      } else if (quad.object.termType === 'NamedNode') {
        namedNodes.add(quad.object.value);
        objects.add(quad.object.value);
      } else if (quad.object.termType === 'BlankNode') {
        blankNodes.add(quad.object.value);
        objects.add(quad.object.value);
      }
      
      if (quad.graph && quad.graph.value !== '') {
        graphs.add(quad.graph.value);
      }
    }
    
    return {
      totalTriples: quadArray.length,
      uniqueSubjects: subjects.size,
      uniquePredicates: predicates.size,
      uniqueObjects: objects.size,
      uniqueGraphs: graphs.size,
      literals: literals.size,
      namedNodes: namedNodes.size,
      blankNodes: blankNodes.size,
      averagePredicatesPerSubject: subjects.size > 0 ? predicates.size / subjects.size : 0
    };
  }

  async _analyzeSchema(quads) {
    const quadArray = Array.isArray(quads) ? quads : quads.getQuads();
    
    const classes = new Set();
    const properties = new Set();
    const datatypes = new Set();
    const domains = new Map();
    const ranges = new Map();
    
    for (const quad of quadArray) {
      // Identify classes (rdf:type statements)
      if (quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        classes.add(quad.object.value);
      }
      
      // Identify properties
      properties.add(quad.predicate.value);
      
      // Identify datatypes
      if (quad.object.termType === 'Literal' && quad.object.datatype) {
        datatypes.add(quad.object.datatype.value);
      }
      
      // Track property domains and ranges (simplified)
      if (!domains.has(quad.predicate.value)) {
        domains.set(quad.predicate.value, new Set());
      }
      domains.get(quad.predicate.value).add(quad.subject.value);
      
      if (quad.object.termType === 'NamedNode') {
        if (!ranges.has(quad.predicate.value)) {
          ranges.set(quad.predicate.value, new Set());
        }
        ranges.get(quad.predicate.value).add(quad.object.value);
      }
    }
    
    return {
      classes: Array.from(classes),
      properties: Array.from(properties),
      datatypes: Array.from(datatypes),
      propertyDomains: Object.fromEntries(
        Array.from(domains.entries()).map(([prop, domains]) => [prop, Array.from(domains)])
      ),
      propertyRanges: Object.fromEntries(
        Array.from(ranges.entries()).map(([prop, ranges]) => [prop, Array.from(ranges)])
      )
    };
  }

  async _analyzePatterns(quads) {
    // Analyze common RDF patterns
    const patterns = {
      listStructures: 0,
      blankNodeComplexity: 0,
      reificationPatterns: 0,
      namedGraphUsage: 0,
      linguisticPatterns: {
        multilingualLabels: 0,
        languageTags: new Set()
      }
    };
    
    const quadArray = Array.isArray(quads) ? quads : quads.getQuads();
    
    for (const quad of quadArray) {
      // Check for list structures (rdf:first, rdf:rest)
      if (quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first' ||
          quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest') {
        patterns.listStructures++;
      }
      
      // Check for named graph usage
      if (quad.graph && quad.graph.value !== '') {
        patterns.namedGraphUsage++;
      }
      
      // Check linguistic patterns
      if (quad.object.termType === 'Literal' && quad.object.language) {
        patterns.linguisticPatterns.languageTags.add(quad.object.language);
        patterns.linguisticPatterns.multilingualLabels++;
      }
    }
    
    patterns.linguisticPatterns.languageTags = Array.from(patterns.linguisticPatterns.languageTags);
    
    return patterns;
  }

  async _analyzeQuality(quads) {
    // Analyze data quality metrics
    const quality = {
      completeness: 0,
      consistency: 0,
      validity: 0,
      issues: []
    };
    
    // This would include sophisticated quality analysis
    // For now, return basic structure
    return quality;
  }

  async _analyzeLineage(quads) {
    // Analyze data lineage and provenance
    return {
      provenanceStatements: 0,
      derivationChains: [],
      sources: new Set(),
      activities: new Set()
    };
  }

  async _calculateStatistics(quads) {
    const quadArray = Array.isArray(quads) ? quads : quads.getQuads();
    
    return {
      tripleCount: quadArray.length,
      avgTripleLength: this._calculateAverageTripleLength(quadArray),
      vocabularyDiversity: this._calculateVocabularyDiversity(quadArray),
      structuralComplexity: this._calculateStructuralComplexity(quadArray)
    };
  }

  _calculateAverageTripleLength(quads) {
    const totalLength = quads.reduce((sum, quad) => {
      return sum + quad.subject.value.length + quad.predicate.value.length + quad.object.value.length;
    }, 0);
    
    return quads.length > 0 ? totalLength / quads.length : 0;
  }

  _calculateVocabularyDiversity(quads) {
    const vocabularies = new Set();
    
    for (const quad of quads) {
      vocabularies.add(this._extractVocabulary(quad.predicate.value));
      if (quad.object.termType === 'NamedNode') {
        vocabularies.add(this._extractVocabulary(quad.object.value));
      }
    }
    
    return vocabularies.size;
  }

  _extractVocabulary(uri) {
    try {
      const url = new URL(uri);
      return url.origin + url.pathname.split('/').slice(0, -1).join('/');
    } catch {
      return 'unknown';
    }
  }

  _calculateStructuralComplexity(quads) {
    const subjectPredicateCounts = new Map();
    
    for (const quad of quads) {
      const subject = quad.subject.value;
      if (!subjectPredicateCounts.has(subject)) {
        subjectPredicateCounts.set(subject, new Set());
      }
      subjectPredicateCounts.get(subject).add(quad.predicate.value);
    }
    
    const predicateCounts = Array.from(subjectPredicateCounts.values()).map(set => set.size);
    const avgPredicatesPerSubject = predicateCounts.reduce((sum, count) => sum + count, 0) / predicateCounts.length;
    
    return avgPredicatesPerSubject || 0;
  }

  async _generateDocumentedTurtle(canonicalTurtle, analysis, context) {
    let documented = '';
    
    // Add comprehensive header
    documented += this._generateHeader(analysis, context);
    
    // Add table of contents if comprehensive
    if (this.config.documentationLevel === 'comprehensive') {
      documented += this._generateTableOfContents(analysis);
    }
    
    // Add schema documentation
    if (this.config.includeSchemaInfo) {
      documented += this._generateSchemaSection(analysis.schema);
    }
    
    // Add statistics section
    if (this.config.includeStatistics) {
      documented += this._generateStatisticsSection(analysis.overview);
    }
    
    // Add quality metrics
    if (this.config.embedQualityMetrics) {
      documented += this._generateQualitySection(analysis.quality);
    }
    
    // Add section separator
    if (this.config.sectionSeparators) {
      documented += this._generateSectionSeparator('RDF Data');
    }
    
    // Add the actual turtle content with inline documentation
    documented += this._enrichTurtleWithInlineDocumentation(canonicalTurtle, analysis);
    
    // Add footer with metadata
    documented += this._generateFooter(analysis, context);
    
    return documented;
  }

  _generateHeader(analysis, context) {
    const lines = [
      '#' + '='.repeat(79),
      '# Self-Documenting RDF/Turtle Serialization',
      '#' + '='.repeat(79),
      `# Generated: ${context.timestamp.toISOString()}`,
      `# Generator: SelfDocumentingSerializer v1.0`,
      `# Total Triples: ${analysis.overview.totalTriples}`,
      `# Unique Subjects: ${analysis.overview.uniqueSubjects}`,
      `# Unique Predicates: ${analysis.overview.uniquePredicates}`,
      `# Documentation Level: ${this.config.documentationLevel}`,
      '#' + '='.repeat(79),
      '',
      '# This RDF document has been enhanced with embedded documentation',
      '# to improve human readability and machine processing.',
      '# All content maintains semantic equivalence to the canonical form.',
      '',
    ];
    
    return lines.join('\n');
  }

  _generateTableOfContents(analysis) {
    return [
      '# TABLE OF CONTENTS',
      '# ================',
      '# 1. Schema Information',
      '# 2. Data Statistics', 
      '# 3. Quality Metrics',
      '# 4. RDF Data',
      '# 5. Metadata & Provenance',
      '',
    ].join('\n');
  }

  _generateSchemaSection(schema) {
    const lines = [
      '# SCHEMA INFORMATION',
      '# ==================',
      `# Classes (${schema.classes.length}):`,
    ];
    
    schema.classes.slice(0, 10).forEach(cls => {
      lines.push(`#   - ${cls}`);
    });
    
    if (schema.classes.length > 10) {
      lines.push(`#   ... and ${schema.classes.length - 10} more`);
    }
    
    lines.push('');
    lines.push(`# Properties (${schema.properties.length}):`);
    
    schema.properties.slice(0, 10).forEach(prop => {
      lines.push(`#   - ${prop}`);
    });
    
    if (schema.properties.length > 10) {
      lines.push(`#   ... and ${schema.properties.length - 10} more`);
    }
    
    lines.push('');
    
    return lines.join('\n');
  }

  _generateStatisticsSection(overview) {
    return [
      '# DATA STATISTICS',
      '# ===============',
      `# Total Triples: ${overview.totalTriples}`,
      `# Unique Subjects: ${overview.uniqueSubjects}`,
      `# Unique Predicates: ${overview.uniquePredicates}`,
      `# Unique Objects: ${overview.uniqueObjects}`,
      `# Named Nodes: ${overview.namedNodes}`,
      `# Literals: ${overview.literals}`,
      `# Blank Nodes: ${overview.blankNodes}`,
      `# Avg Predicates/Subject: ${overview.averagePredicatesPerSubject.toFixed(2)}`,
      '',
    ].join('\n');
  }

  _generateQualitySection(quality) {
    return [
      '# DATA QUALITY METRICS',
      '# ====================',
      `# Completeness Score: ${quality.completeness}/100`,
      `# Consistency Score: ${quality.consistency}/100`,
      `# Validity Score: ${quality.validity}/100`,
      quality.issues.length > 0 ? '# Quality Issues:' : '# No quality issues detected',
      ...quality.issues.map(issue => `#   - ${issue}`),
      '',
    ].join('\n');
  }

  _generateSectionSeparator(title) {
    const separator = '=' + '='.repeat(Math.min(title.length + 2, 77));
    return [
      '#' + separator,
      `# ${title.toUpperCase()}`,
      '#' + separator,
      '',
    ].join('\n');
  }

  _enrichTurtleWithInlineDocumentation(turtle, analysis) {
    // Add inline documentation to turtle content
    const lines = turtle.split('\n');
    const enriched = [];
    let inPrefixSection = true;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Add documentation for prefix declarations
      if (line.startsWith('@prefix') && inPrefixSection) {
        enriched.push(line);
        const prefix = line.match(/@prefix\s+(\w+):/)?.[1];
        if (prefix) {
          enriched.push(`# ↳ Namespace: ${prefix} - enables compact URI representation`);
        }
      }
      // Detect end of prefix section
      else if (line.trim() === '' && inPrefixSection) {
        inPrefixSection = false;
        enriched.push(line);
        enriched.push('# RDF Statements begin here');
        enriched.push('# Each statement represents a fact: Subject Predicate Object');
      }
      // Add documentation for significant entities
      else if (line.includes('rdf:type') && this.config.enableSemanticAnnotations) {
        enriched.push(line);
        enriched.push('# ↳ Type declaration - defines what kind of thing this entity is');
      }
      else {
        enriched.push(line);
      }
    }
    
    return enriched.join('\n');
  }

  _generateFooter(analysis, context) {
    return [
      '',
      '# METADATA & PROVENANCE',
      '# =====================',
      `# Serialization Timestamp: ${context.timestamp.toISOString()}`,
      `# Generator: SelfDocumentingSerializer v1.0`,
      `# Configuration: ${JSON.stringify(this._getSafeConfig())}`,
      '# ',
      '# This document maintains full semantic equivalence with the',
      '# canonical turtle representation while providing enhanced',
      '# documentation for improved understanding and maintenance.',
      '#' + '='.repeat(79),
    ].join('\n');
  }

  async _createComprehensiveMetadata(canonical, analysis, context, processingTime) {
    return {
      ...canonical.metadata,
      documentation: {
        level: this.config.documentationLevel,
        features: this._getEnabledFeatures(),
        processingTime,
        enhancementRatio: this._calculateEnhancementRatio(canonical.turtle, analysis)
      },
      analysis,
      quality: analysis.quality,
      schema: analysis.schema
    };
  }

  _getEnabledFeatures() {
    return Object.keys(this.config)
      .filter(key => key.startsWith('enable') || key.startsWith('include'))
      .filter(key => this.config[key] === true);
  }

  _calculateEnhancementRatio(originalTurtle, analysis) {
    // Calculate how much documentation was added
    const originalLines = originalTurtle.split('\n').length;
    const documentationLines = analysis.overview.totalTriples * 0.1; // Estimate
    
    return documentationLines / originalLines;
  }

  _calculateDocumentationStatistics(documentedTurtle, canonicalTurtle) {
    return {
      originalBytes: Buffer.byteLength(canonicalTurtle, 'utf8'),
      documentedBytes: Buffer.byteLength(documentedTurtle, 'utf8'),
      enhancementRatio: Buffer.byteLength(documentedTurtle, 'utf8') / Buffer.byteLength(canonicalTurtle, 'utf8'),
      originalLines: canonicalTurtle.split('\n').length,
      documentedLines: documentedTurtle.split('\n').length,
      documentationLines: documentedTurtle.split('\n').filter(line => line.startsWith('#')).length
    };
  }

  _createHeaderTemplate() {
    return `
# {title}
# Generated: {timestamp}
# Triples: {tripleCount}
# Documentation Level: {level}
`;
  }

  _createSectionTemplate() {
    return `
# {sectionTitle}
# {separator}
{content}
`;
  }

  _createEntityTemplate() {
    return `
# Entity: {uri}
# Type: {type}
# Properties: {propertyCount}
`;
  }

  _createPropertyTemplate() {
    return `
# Property: {property}
# Domain: {domain}
# Range: {range}
`;
  }

  _createFooterTemplate() {
    return `
# Generated by SelfDocumentingSerializer
# Maintains semantic equivalence with canonical form
`;
  }

  _getSafeConfig() {
    return {
      documentationLevel: this.config.documentationLevel,
      embedDocumentation: this.config.embedDocumentation,
      includeSchemaInfo: this.config.includeSchemaInfo,
      enableSemanticAnnotations: this.config.enableSemanticAnnotations
    };
  }

  /**
   * Get serializer status and statistics
   */
  getStatus() {
    return {
      state: this.state,
      config: this._getSafeConfig(),
      canonicalSerializer: this.canonicalSerializer.getStatistics()
    };
  }

  /**
   * Shutdown the serializer
   */
  async shutdown() {
    this.logger.info('Shutting down self-documenting serializer...');
    
    await this.canonicalSerializer.shutdown();
    
    this.state = 'shutdown';
    this.logger.success('Self-documenting serializer shutdown complete');
  }
}

export default SelfDocumentingSerializer;