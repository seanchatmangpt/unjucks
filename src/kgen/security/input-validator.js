/**
 * Input Validation Framework
 * Enterprise-grade input validation for RDF graphs, templates, and user inputs
 * Prevents injection attacks, malformed data processing, and security violations
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { Store, Parser, Quad } from 'n3';
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';
import { createHash } from 'crypto';

export class InputValidator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // RDF validation settings
      maxTriples: 1000000, // Maximum triples per graph
      maxGraphSize: 100 * 1024 * 1024, // 100MB max
      allowedFormats: ['text/turtle', 'application/rdf+xml', 'application/n-triples', 'application/ld+json'],
      
      // Template validation settings
      maxTemplateSize: 10 * 1024 * 1024, // 10MB max
      allowedTemplateExtensions: ['.njk', '.nunjucks', '.html', '.json'],
      maxVariableDepth: 10,
      
      // Security settings
      enableDOMPurification: true,
      enableSQLInjectionCheck: true,
      enableXSSCheck: true,
      enablePathTraversalCheck: true,
      enableCommandInjectionCheck: true,
      
      // Performance settings
      validationTimeout: 30000, // 30 seconds
      enableParallelValidation: true,
      
      ...config
    };
    
    this.logger = consola.withTag('input-validator');
    this.validationCache = new Map();
    this.threatPatterns = this._initializeThreatPatterns();
    
    // Validation metrics
    this.metrics = {
      validationsPerformed: 0,
      threatsDetected: 0,
      validationErrors: 0,
      avgValidationTime: 0
    };
  }

  /**
   * Validate RDF graph input
   * @param {string|object} input - RDF data to validate
   * @param {object} options - Validation options
   * @returns {Promise<object>} Validation result
   */
  async validateRDFGraph(input, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    this.metrics.validationsPerformed++;
    
    try {
      this.logger.info('Validating RDF graph input');
      
      const validationResult = {
        valid: false,
        errors: [],
        warnings: [],
        statistics: {},
        sanitizedInput: null,
        threats: [],
        metadata: {
          validationType: 'rdf-graph',
          timestamp: this.getDeterministicDate(),
          size: this._getInputSize(input)
        }
      };
      
      // Basic input checks
      if (!input) {
        validationResult.errors.push('Input is required');
        return validationResult;
      }
      
      // Size validation
      const inputSize = this._getInputSize(input);
      if (inputSize > this.config.maxGraphSize) {
        validationResult.errors.push(`Input size ${inputSize} exceeds maximum allowed ${this.config.maxGraphSize}`);
        return validationResult;
      }
      
      // Security threat detection
      const threatResults = await this._detectThreats(input, 'rdf');
      if (threatResults.threatsFound.length > 0) {
        validationResult.threats = threatResults.threatsFound;
        this.metrics.threatsDetected += threatResults.threatsFound.length;
        
        if (threatResults.critical) {
          validationResult.errors.push('Critical security threats detected');
          this.emit('security-threat', {
            type: 'rdf-graph',
            threats: threatResults.threatsFound,
            input: this._sanitizeForLogging(input)
          });
          return validationResult;
        }
      }
      
      // RDF format validation
      const formatValidation = await this._validateRDFFormat(input, options.format);
      if (!formatValidation.valid) {
        validationResult.errors.push(...formatValidation.errors);
        return validationResult;
      }
      
      // Parse and validate RDF content
      const parseResult = await this._parseAndValidateRDF(input, options);
      if (!parseResult.valid) {
        validationResult.errors.push(...parseResult.errors);
        validationResult.warnings.push(...parseResult.warnings);
        return validationResult;
      }
      
      // Schema validation if provided
      if (options.schema) {
        const schemaValidation = await this._validateRDFSchema(parseResult.quads, options.schema);
        if (!schemaValidation.valid) {
          validationResult.warnings.push(...schemaValidation.warnings);
        }
      }
      
      // Generate statistics
      validationResult.statistics = {
        tripleCount: parseResult.tripleCount,
        subjectCount: parseResult.subjects.size,
        predicateCount: parseResult.predicates.size,
        objectCount: parseResult.objects.size,
        vocabularies: Array.from(parseResult.vocabularies)
      };
      
      // Sanitize input for safe processing
      validationResult.sanitizedInput = await this._sanitizeRDFInput(parseResult.quads);
      validationResult.valid = true;
      
      this.emit('validation-success', {
        type: 'rdf-graph',
        statistics: validationResult.statistics
      });
      
      return validationResult;
      
    } catch (error) {
      this.metrics.validationErrors++;
      this.logger.error('RDF validation failed:', error);
      
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        statistics: {},
        sanitizedInput: null,
        threats: [],
        metadata: {
          validationType: 'rdf-graph',
          timestamp: this.getDeterministicDate(),
          error: error.message
        }
      };
    } finally {
      const validationTime = this.getDeterministicTimestamp() - startTime;
      this._updateValidationMetrics(validationTime);
    }
  }

  /**
   * Validate template input
   * @param {string} template - Template content to validate
   * @param {object} variables - Template variables
   * @param {object} options - Validation options
   * @returns {Promise<object>} Validation result
   */
  async validateTemplate(template, variables = {}, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    this.metrics.validationsPerformed++;
    
    try {
      this.logger.info('Validating template input');
      
      const validationResult = {
        valid: false,
        errors: [],
        warnings: [],
        sanitizedTemplate: null,
        sanitizedVariables: null,
        threats: [],
        analysis: {
          variableCount: 0,
          complexityScore: 0,
          securityRisk: 'low'
        },
        metadata: {
          validationType: 'template',
          timestamp: this.getDeterministicDate(),
          size: template?.length || 0
        }
      };
      
      // Basic input checks
      if (!template || typeof template !== 'string') {
        validationResult.errors.push('Template content is required and must be a string');
        return validationResult;
      }
      
      // Size validation
      if (template.length > this.config.maxTemplateSize) {
        validationResult.errors.push(`Template size exceeds maximum allowed ${this.config.maxTemplateSize}`);
        return validationResult;
      }
      
      // Security threat detection in template
      const templateThreats = await this._detectThreats(template, 'template');
      if (templateThreats.threatsFound.length > 0) {
        validationResult.threats.push(...templateThreats.threatsFound);
        this.metrics.threatsDetected += templateThreats.threatsFound.length;
        
        if (templateThreats.critical) {
          validationResult.errors.push('Critical security threats detected in template');
          return validationResult;
        }
      }
      
      // Security threat detection in variables
      const variableThreats = await this._detectThreats(JSON.stringify(variables), 'variables');
      if (variableThreats.threatsFound.length > 0) {
        validationResult.threats.push(...variableThreats.threatsFound);
        this.metrics.threatsDetected += variableThreats.threatsFound.length;
        
        if (variableThreats.critical) {
          validationResult.errors.push('Critical security threats detected in variables');
          return validationResult;
        }
      }
      
      // Template syntax validation
      const syntaxValidation = await this._validateTemplateSyntax(template);
      if (!syntaxValidation.valid) {
        validationResult.errors.push(...syntaxValidation.errors);
        return validationResult;
      }
      
      // Variable validation
      const variableValidation = await this._validateTemplateVariables(variables, template);
      if (!variableValidation.valid) {
        validationResult.warnings.push(...variableValidation.warnings);
      }
      
      // Template complexity analysis
      const complexityAnalysis = this._analyzeTemplateComplexity(template, variables);
      validationResult.analysis = complexityAnalysis;
      
      // Sanitize template and variables
      validationResult.sanitizedTemplate = await this._sanitizeTemplate(template);
      validationResult.sanitizedVariables = await this._sanitizeVariables(variables);
      validationResult.valid = true;
      
      this.emit('validation-success', {
        type: 'template',
        analysis: validationResult.analysis
      });
      
      return validationResult;
      
    } catch (error) {
      this.metrics.validationErrors++;
      this.logger.error('Template validation failed:', error);
      
      return {
        valid: false,
        errors: [`Template validation failed: ${error.message}`],
        warnings: [],
        sanitizedTemplate: null,
        sanitizedVariables: null,
        threats: [],
        analysis: {},
        metadata: {
          validationType: 'template',
          timestamp: this.getDeterministicDate(),
          error: error.message
        }
      };
    } finally {
      const validationTime = this.getDeterministicTimestamp() - startTime;
      this._updateValidationMetrics(validationTime);
    }
  }

  /**
   * Validate file path for security
   * @param {string} filePath - File path to validate
   * @param {object} options - Validation options
   * @returns {Promise<object>} Validation result
   */
  async validateFilePath(filePath, options = {}) {
    try {
      this.logger.info(`Validating file path: ${filePath}`);
      
      const validationResult = {
        valid: false,
        errors: [],
        warnings: [],
        sanitizedPath: null,
        threats: [],
        metadata: {
          validationType: 'file-path',
          timestamp: this.getDeterministicDate(),
          originalPath: filePath
        }
      };
      
      // Basic input validation
      if (!filePath || typeof filePath !== 'string') {
        validationResult.errors.push('File path is required and must be a string');
        return validationResult;
      }
      
      // Path traversal detection
      const pathTraversalPatterns = [
        /\.\.\//, // ../
        /\.\.\\/, // ..\
        /\~\//,   // ~/
        /\$\{.*\}/, // Variable expansion
        /\%2e\%2e\%2f/i, // URL encoded ../
        /\%2e\%2e\%5c/i  // URL encoded ..\
      ];
      
      for (const pattern of pathTraversalPatterns) {
        if (pattern.test(filePath)) {
          validationResult.errors.push('Path traversal detected in file path');
          validationResult.threats.push({
            type: 'path-traversal',
            severity: 'critical',
            pattern: pattern.toString(),
            location: 'file-path'
          });
          return validationResult;
        }
      }
      
      // Validate file extension if specified
      if (options.allowedExtensions) {
        const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
        if (!options.allowedExtensions.includes(extension)) {
          validationResult.errors.push(`File extension '${extension}' is not allowed`);
          return validationResult;
        }
      }
      
      // Sanitize path
      validationResult.sanitizedPath = this._sanitizeFilePath(filePath);
      validationResult.valid = true;
      
      return validationResult;
      
    } catch (error) {
      this.logger.error('File path validation failed:', error);
      return {
        valid: false,
        errors: [`Path validation failed: ${error.message}`],
        warnings: [],
        sanitizedPath: null,
        threats: [],
        metadata: {
          validationType: 'file-path',
          timestamp: this.getDeterministicDate(),
          error: error.message
        }
      };
    }
  }

  /**
   * Validate SPARQL query for security
   * @param {string} query - SPARQL query to validate
   * @param {object} options - Validation options
   * @returns {Promise<object>} Validation result
   */
  async validateSPARQLQuery(query, options = {}) {
    try {
      this.logger.info('Validating SPARQL query');
      
      const validationResult = {
        valid: false,
        errors: [],
        warnings: [],
        sanitizedQuery: null,
        threats: [],
        analysis: {
          queryType: null,
          complexityScore: 0,
          estimatedCost: 0
        },
        metadata: {
          validationType: 'sparql-query',
          timestamp: this.getDeterministicDate(),
          size: query?.length || 0
        }
      };
      
      // Basic input validation
      if (!query || typeof query !== 'string') {
        validationResult.errors.push('SPARQL query is required and must be a string');
        return validationResult;
      }
      
      // Detect dangerous SPARQL operations
      const dangerousPatterns = [
        { pattern: /DELETE\s+WHERE/i, threat: 'delete-operation', severity: 'critical' },
        { pattern: /DROP\s+GRAPH/i, threat: 'drop-operation', severity: 'critical' },
        { pattern: /CLEAR\s+GRAPH/i, threat: 'clear-operation', severity: 'critical' },
        { pattern: /LOAD\s+</i, threat: 'load-operation', severity: 'high' },
        { pattern: /SERVICE\s+</i, threat: 'service-operation', severity: 'medium' },
        { pattern: /CONSTRUCT.*\{\s*\?/i, threat: 'overly-broad-construct', severity: 'medium' }
      ];
      
      for (const { pattern, threat, severity } of dangerousPatterns) {
        if (pattern.test(query)) {
          validationResult.threats.push({
            type: threat,
            severity,
            pattern: pattern.toString(),
            location: 'sparql-query'
          });
          
          if (severity === 'critical') {
            validationResult.errors.push(`Dangerous SPARQL operation detected: ${threat}`);
            return validationResult;
          } else {
            validationResult.warnings.push(`Potentially unsafe SPARQL operation: ${threat}`);
          }
        }
      }
      
      // Query complexity analysis
      const complexity = this._analyzeSPARQLComplexity(query);
      validationResult.analysis.complexityScore = complexity.score;
      validationResult.analysis.queryType = complexity.type;
      validationResult.analysis.estimatedCost = complexity.estimatedCost;
      
      // Check complexity limits
      if (options.maxComplexity && complexity.score > options.maxComplexity) {
        validationResult.errors.push(`Query complexity ${complexity.score} exceeds limit ${options.maxComplexity}`);
        return validationResult;
      }
      
      // Sanitize query
      validationResult.sanitizedQuery = this._sanitizeSPARQLQuery(query);
      validationResult.valid = true;
      
      return validationResult;
      
    } catch (error) {
      this.logger.error('SPARQL query validation failed:', error);
      return {
        valid: false,
        errors: [`SPARQL validation failed: ${error.message}`],
        warnings: [],
        sanitizedQuery: null,
        threats: [],
        analysis: {},
        metadata: {
          validationType: 'sparql-query',
          timestamp: this.getDeterministicDate(),
          error: error.message
        }
      };
    }
  }

  /**
   * Get validation metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.validationCache.size,
      uptime: this.getDeterministicTimestamp() - (this.startTime || this.getDeterministicTimestamp())
    };
  }

  // Private methods

  _initializeThreatPatterns() {
    return {
      xss: [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload=/gi,
        /onerror=/gi,
        /onclick=/gi
      ],
      sqlInjection: [
        /'\s*(OR|AND)\s*'\s*=\s*'/gi,
        /;\s*(DROP|DELETE|INSERT|UPDATE|ALTER)/gi,
        /UNION\s+(ALL\s+)?SELECT/gi,
        /'\s*;\s*(--|\/\*)/gi
      ],
      commandInjection: [
        /;\s*(rm|del|format|shutdown)/gi,
        /\|\s*(curl|wget|nc|telnet)/gi,
        /`[^`]*`/g,
        /\$\([^)]*\)/g
      ],
      pathTraversal: [
        /\.\.\/|\.\.\\/g,
        /\%2e\%2e\%2f/gi,
        /\%2e\%2e\%5c/gi
      ]
    };
  }

  _getInputSize(input) {
    if (typeof input === 'string') {
      return Buffer.byteLength(input, 'utf8');
    }
    return Buffer.byteLength(JSON.stringify(input), 'utf8');
  }

  async _detectThreats(input, context) {
    const threatsFound = [];
    let critical = false;
    
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    
    // Check each threat category
    for (const [category, patterns] of Object.entries(this.threatPatterns)) {
      if (!this._shouldCheckThreat(category, context)) continue;
      
      for (const pattern of patterns) {
        const matches = inputStr.match(pattern);
        if (matches) {
          const threat = {
            type: category,
            severity: this._getThreatSeverity(category),
            pattern: pattern.toString(),
            matches: matches.slice(0, 3), // Limit to first 3 matches
            context
          };
          
          threatsFound.push(threat);
          
          if (threat.severity === 'critical') {
            critical = true;
          }
        }
      }
    }
    
    return { threatsFound, critical };
  }

  _shouldCheckThreat(category, context) {
    const checkMap = {
      'xss': ['template', 'variables', 'html'],
      'sqlInjection': ['rdf', 'sparql', 'query'],
      'commandInjection': ['template', 'variables', 'file-path'],
      'pathTraversal': ['file-path', 'template']
    };
    
    return checkMap[category]?.includes(context) ?? true;
  }

  _getThreatSeverity(category) {
    const severityMap = {
      'xss': 'high',
      'sqlInjection': 'critical',
      'commandInjection': 'critical',
      'pathTraversal': 'critical'
    };
    
    return severityMap[category] || 'medium';
  }

  async _validateRDFFormat(input, format) {
    const result = { valid: false, errors: [] };
    
    try {
      // Basic format validation
      if (format && !this.config.allowedFormats.includes(format)) {
        result.errors.push(`Unsupported RDF format: ${format}`);
        return result;
      }
      
      // Content-based format detection if not specified
      if (!format) {
        format = this._detectRDFFormat(input);
      }
      
      result.valid = true;
      result.detectedFormat = format;
      
    } catch (error) {
      result.errors.push(`Format validation failed: ${error.message}`);
    }
    
    return result;
  }

  _detectRDFFormat(input) {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    
    // Simple format detection based on content patterns
    if (inputStr.includes('@prefix') || inputStr.includes('<http')) {
      return 'text/turtle';
    }
    if (inputStr.includes('<rdf:RDF') || inputStr.includes('xmlns:rdf')) {
      return 'application/rdf+xml';
    }
    if (inputStr.includes('@context') || inputStr.includes('"@id"')) {
      return 'application/ld+json';
    }
    
    return 'text/turtle'; // Default
  }

  async _parseAndValidateRDF(input, options) {
    const result = {
      valid: false,
      errors: [],
      warnings: [],
      quads: [],
      tripleCount: 0,
      subjects: new Set(),
      predicates: new Set(),
      objects: new Set(),
      vocabularies: new Set()
    };
    
    try {
      const parser = new Parser();
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
      
      // Parse RDF content
      result.quads = parser.parse(inputStr);
      result.tripleCount = result.quads.length;
      
      // Check triple count limit
      if (result.tripleCount > this.config.maxTriples) {
        result.errors.push(`Triple count ${result.tripleCount} exceeds limit ${this.config.maxTriples}`);
        return result;
      }
      
      // Extract RDF components
      for (const quad of result.quads) {
        result.subjects.add(quad.subject.value);
        result.predicates.add(quad.predicate.value);
        result.objects.add(quad.object.value);
        
        // Extract vocabularies from URIs
        this._extractVocabulary(quad.predicate.value, result.vocabularies);
      }
      
      result.valid = true;
      
    } catch (error) {
      result.errors.push(`RDF parsing failed: ${error.message}`);
    }
    
    return result;
  }

  _extractVocabulary(uri, vocabularies) {
    try {
      const url = new URL(uri);
      const baseVocab = `${url.protocol}//${url.host}${url.pathname.substring(0, url.pathname.lastIndexOf('/'))}`;
      vocabularies.add(baseVocab);
    } catch {
      // Invalid URI, skip
    }
  }

  async _validateRDFSchema(quads, schema) {
    // Placeholder for SHACL or other schema validation
    return {
      valid: true,
      warnings: []
    };
  }

  async _sanitizeRDFInput(quads) {
    // Create sanitized version of RDF quads
    return quads.map(quad => ({
      subject: this._sanitizeRDFTerm(quad.subject),
      predicate: this._sanitizeRDFTerm(quad.predicate),
      object: this._sanitizeRDFTerm(quad.object),
      graph: quad.graph ? this._sanitizeRDFTerm(quad.graph) : undefined
    }));
  }

  _sanitizeRDFTerm(term) {
    return {
      termType: term.termType,
      value: validator.escape(term.value),
      language: term.language,
      datatype: term.datatype
    };
  }

  async _validateTemplateSyntax(template) {
    const result = { valid: false, errors: [] };
    
    try {
      // Basic template syntax validation
      // Check for balanced braces
      const bracePattern = /\{\{.*?\}\}/g;
      const braces = template.match(bracePattern) || [];
      
      for (const brace of braces) {
        if (!brace.endsWith('}}')) {
          result.errors.push(`Unbalanced template brace: ${brace}`);
        }
      }
      
      // Check for potentially dangerous template constructs
      const dangerousPatterns = [
        /\{\{\s*.*\s*\|\s*safe\s*\}\}/g, // |safe filter can be dangerous
        /\{\%\s*include\s*.*\%\}/g,      // include statements
        /\{\%\s*import\s*.*\%\}/g,      // import statements
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(template)) {
          result.errors.push(`Potentially unsafe template construct detected`);
        }
      }
      
      if (result.errors.length === 0) {
        result.valid = true;
      }
      
    } catch (error) {
      result.errors.push(`Template syntax validation failed: ${error.message}`);
    }
    
    return result;
  }

  async _validateTemplateVariables(variables, template) {
    const result = { valid: true, warnings: [] };
    
    try {
      // Check variable depth
      const depth = this._getObjectDepth(variables);
      if (depth > this.config.maxVariableDepth) {
        result.warnings.push(`Variable depth ${depth} exceeds recommended limit ${this.config.maxVariableDepth}`);
      }
      
      // Check for unused variables in template
      const templateVars = this._extractTemplateVariables(template);
      const providedVars = Object.keys(variables);
      
      const unusedVars = providedVars.filter(v => !templateVars.includes(v));
      if (unusedVars.length > 0) {
        result.warnings.push(`Unused variables detected: ${unusedVars.join(', ')}`);
      }
      
    } catch (error) {
      result.warnings.push(`Variable validation failed: ${error.message}`);
    }
    
    return result;
  }

  _getObjectDepth(obj, currentDepth = 0) {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }
    
    let maxDepth = currentDepth;
    for (const value of Object.values(obj)) {
      const depth = this._getObjectDepth(value, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
    
    return maxDepth;
  }

  _extractTemplateVariables(template) {
    const varPattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*).*?\}\}/g;
    const matches = [];
    let match;
    
    while ((match = varPattern.exec(template)) !== null) {
      matches.push(match[1].split('.')[0]); // Get root variable name
    }
    
    return [...new Set(matches)];
  }

  _analyzeTemplateComplexity(template, variables) {
    const analysis = {
      variableCount: Object.keys(variables).length,
      complexityScore: 0,
      securityRisk: 'low'
    };
    
    // Calculate complexity score
    analysis.complexityScore += template.length * 0.001; // Base on size
    analysis.complexityScore += analysis.variableCount * 2; // Variables add complexity
    analysis.complexityScore += (template.match(/\{\%.*?\%\}/g) || []).length * 5; // Template tags
    analysis.complexityScore += (template.match(/\{\{.*?\}\}/g) || []).length * 2; // Variable expressions
    
    // Assess security risk
    if (analysis.complexityScore > 100) {
      analysis.securityRisk = 'high';
    } else if (analysis.complexityScore > 50) {
      analysis.securityRisk = 'medium';
    }
    
    return analysis;
  }

  async _sanitizeTemplate(template) {
    if (this.config.enableDOMPurification) {
      return DOMPurify.sanitize(template);
    }
    return validator.escape(template);
  }

  async _sanitizeVariables(variables) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string') {
        sanitized[key] = validator.escape(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = await this._sanitizeVariables(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  _sanitizeFilePath(filePath) {
    return filePath
      .replace(/\.\.\/|\.\.\\/g, '') // Remove path traversal
      .replace(/[<>:"|?*]/g, '')     // Remove invalid filename characters
      .replace(/^\~/, '')            // Remove home directory reference
      .trim();
  }

  _analyzeSPARQLComplexity(query) {
    const analysis = {
      score: 0,
      type: 'SELECT',
      estimatedCost: 0
    };
    
    // Detect query type
    if (query.match(/^\s*CONSTRUCT/i)) analysis.type = 'CONSTRUCT';
    else if (query.match(/^\s*ASK/i)) analysis.type = 'ASK';
    else if (query.match(/^\s*DESCRIBE/i)) analysis.type = 'DESCRIBE';
    
    // Calculate complexity score
    analysis.score += (query.match(/\?\w+/g) || []).length * 2; // Variables
    analysis.score += (query.match(/OPTIONAL/gi) || []).length * 10; // Optional clauses
    analysis.score += (query.match(/UNION/gi) || []).length * 15; // Union clauses
    analysis.score += (query.match(/FILTER/gi) || []).length * 5; // Filters
    analysis.score += (query.match(/\{.*\}/g) || []).length * 3; // Graph patterns
    
    // Estimate cost (simplified)
    analysis.estimatedCost = Math.min(analysis.score * 10, 10000);
    
    return analysis;
  }

  _sanitizeSPARQLQuery(query) {
    return query
      .replace(/["']/g, (match) => match === '"' ? '\\"' : "\\'") // Escape quotes
      .replace(/;\s*(--|\/\*).*$/gm, '') // Remove comments
      .trim();
  }

  _sanitizeForLogging(input) {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    return inputStr.length > 100 ? inputStr.substring(0, 100) + '...' : inputStr;
  }

  _updateValidationMetrics(validationTime) {
    this.metrics.avgValidationTime = (
      (this.metrics.avgValidationTime * (this.metrics.validationsPerformed - 1) + validationTime) /
      this.metrics.validationsPerformed
    );
  }
}

export default InputValidator;