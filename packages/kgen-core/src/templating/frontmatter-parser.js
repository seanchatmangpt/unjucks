/**
 * KGEN Enhanced Frontmatter Parser
 * 
 * Enhanced frontmatter parser combining UNJUCKS capabilities with KGEN-specific features.
 * Supports deterministic generation, content addressing, attestations, and provenance metadata.
 * 
 * Key Features:
 * - KGEN-specific frontmatter fields (deterministic, contentAddressed, attestations)
 * - Template metadata extraction and validation
 * - Injection directives with enhanced support
 * - Provenance tracking and compliance metadata
 * - SPARQL/RDF content preprocessing from UNJUCKS
 * - Enterprise-grade validation and error handling
 */

import yaml from "yaml";
import { createHash } from "crypto";

// Optional semantic validator - create a fallback if not available
class FallbackSemanticValidator {
  constructor(config) {
    this.config = config;
  }
  
  validate(frontmatter) {
    return { valid: true, errors: [] };
  }
}

// Use fallback semantic validator for now - can be replaced with actual implementation
const SemanticValidator = FallbackSemanticValidator;

export class FrontmatterParser {
  constructor(options = {}) {
    this.enableValidation = options.enableValidation ?? false;
    this.trackProvenance = options.trackProvenance ?? true;
    this.enableSemanticValidation = options.enableSemanticValidation ?? false;
    this.strictMode = options.strictMode ?? false;
    
    // Initialize semantic validator if enabled
    if (this.enableSemanticValidation) {
      this.semanticValidator = new SemanticValidator({
        strictMode: this.strictMode,
        maxErrors: 100,
        timeout: 5000,
        memoryLimit: 2048,
        enablePerformanceMetrics: true,
        cacheEnabled: true,
        parallelProcessing: false,
        validationRules: [],
        ...options.validatorConfig
      });
    }
    
    // KGEN-specific configuration
    this.kgenConfig = {
      enableAttestations: options.enableAttestations ?? true,
      enableContentAddressing: options.enableContentAddressing ?? true,
      enableProvenanceTracking: options.enableProvenanceTracking ?? true,
      defaultDeterministic: options.defaultDeterministic ?? false,
      ...options.kgenConfig
    };
  }

  /**
   * Parse template content with enhanced frontmatter processing
   * @param {string} templateContent - Template content to parse
   * @param {Object} options - Parsing options
   * @param {boolean} options.enableSemanticValidation - Enable semantic validation
   * @param {boolean} options.extractMetadata - Extract template metadata
   * @param {boolean} options.validateKgenFields - Validate KGEN-specific fields
   * @param {string} options.templatePath - Template file path for provenance
   * @returns {Promise<{frontmatter: Object, content: string, hasValidFrontmatter: boolean, metadata?: Object, validationResult?: Object}>}
   */
  async parse(templateContent, options = {}) {
    const {
      enableSemanticValidation = this.enableSemanticValidation,
      extractMetadata = true,
      validateKgenFields = true,
      templatePath = null
    } = options;
    // Handle empty or whitespace-only content
    if (!templateContent || typeof templateContent !== 'string' || templateContent.trim().length === 0) {
      const emptyResult = {
        frontmatter: this._getDefaultFrontmatter(),
        content: templateContent || '',
        hasValidFrontmatter: false,
      };
      
      if (extractMetadata) {
        emptyResult.metadata = this._extractTemplateMetadata({}, templatePath);
      }
      
      return emptyResult;
    }

    // Enhanced frontmatter regex that properly handles SPARQL content
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
    const match = templateContent.match(frontmatterRegex);

    if (!match) {
      const noFrontmatterResult = {
        frontmatter: this._getDefaultFrontmatter(),
        content: templateContent,
        hasValidFrontmatter: false,
      };
      
      if (extractMetadata) {
        noFrontmatterResult.metadata = this._extractTemplateMetadata({}, templatePath);
      }
      
      return noFrontmatterResult;
    }

    try {
      // Pre-process frontmatter to handle SPARQL queries safely (from UNJUCKS)
      const processedFrontmatterText = this._preprocessSparqlFrontmatter(match[1]);
      
      let frontmatter = yaml.parse(processedFrontmatterText, {
        keepUndefined: true,
        strict: false
      }) || {};
      
      // Post-process to restore SPARQL content (from UNJUCKS)
      frontmatter = this._postprocessSparqlFrontmatter(frontmatter);
      
      // Apply KGEN-specific defaults and enhancements
      frontmatter = this._enhanceWithKgenDefaults(frontmatter);
      
      const content = match[2].trim();

      const result = {
        frontmatter,
        content,
        hasValidFrontmatter: true,
      };

      // Enhanced validation combining UNJUCKS and KGEN features
      if (this.enableValidation || enableSemanticValidation) {
        const validation = await this._performEnhancedValidation(
          frontmatter, 
          enableSemanticValidation,
          validateKgenFields
        );
        
        if (!validation.valid) {
          result.validationResult = validation;
        }
      }
      
      // Extract template metadata if requested
      if (extractMetadata) {
        result.metadata = this._extractTemplateMetadata(frontmatter, templatePath);
      }
      
      // Add provenance information if tracking is enabled
      if (this.trackProvenance && templatePath) {
        result.provenance = this._generateProvenanceInfo(frontmatter, templatePath);
      }

      return result;
    } catch (error) {
      console.warn("Warning: Invalid YAML frontmatter, ignoring:", error.message);
      const errorResult = {
        frontmatter: this._getDefaultFrontmatter(),
        content: templateContent,
        hasValidFrontmatter: false,
        error: {
          message: error.message,
          type: 'YAML_PARSE_ERROR'
        }
      };
      
      if (extractMetadata) {
        errorResult.metadata = this._extractTemplateMetadata({}, templatePath);
      }
      
      return errorResult;
    }
  }

  /**
   * Enhanced validation combining UNJUCKS and KGEN features
   * @param {Object} frontmatter - Frontmatter object to validate
   * @param {boolean} enableSemanticValidation - Enable semantic validation
   * @param {boolean} validateKgenFields - Validate KGEN-specific fields
   * @returns {Promise<{valid: boolean, errors: Array, warnings: Array}>}
   */
  async _performEnhancedValidation(frontmatter, enableSemanticValidation = false, validateKgenFields = true) {
    const errors = [];
    const warnings = [];

    // Core validation from original implementation
    const coreValidation = this._validateCore(frontmatter);
    errors.push(...coreValidation.errors);
    warnings.push(...coreValidation.warnings);

    // KGEN-specific validation
    if (validateKgenFields) {
      const kgenValidation = this._validateKgenFields(frontmatter);
      errors.push(...kgenValidation.errors);
      warnings.push(...kgenValidation.warnings);
    }

    // RDF/SPARQL validation (from UNJUCKS)
    if (this._hasRDFConfig(frontmatter)) {
      const rdfValidation = this._validateRDFConfig(frontmatter);
      errors.push(...rdfValidation.errors);
      warnings.push(...rdfValidation.warnings);
    }

    // Semantic validation if enabled and validator is available
    if (enableSemanticValidation && this.semanticValidator && this._hasRDFConfig(frontmatter)) {
      try {
        const configValidation = this.semanticValidator.validate(frontmatter);
        if (!configValidation.valid) {
          errors.push(...configValidation.errors.map(err => ({
            code: "SEMANTIC_VALIDATION_ERROR",
            message: err,
            severity: "error",
          })));
        }
      } catch (validationError) {
        warnings.push({
          code: "SEMANTIC_VALIDATION_FAILED",
          message: `Semantic validation failed: ${validationError.message}`,
          severity: "warning"
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Core frontmatter validation (from original KGEN + UNJUCKS)
   * @param {Object} frontmatter - Frontmatter object to validate
   * @returns {{errors: Array, warnings: Array}}
   */
  _validateCore(frontmatter) {
    const errors = [];
    const warnings = [];

    // Check mutually exclusive injection options
    const injectionModes = [
      frontmatter.inject,
      frontmatter.append,
      frontmatter.prepend,
      frontmatter.lineAt !== undefined,
    ].filter(Boolean);

    if (injectionModes.length > 1) {
      errors.push({
        code: "EXCLUSIVE_INJECTION_MODES",
        message: "Only one injection mode allowed: inject, append, prepend, or lineAt",
        severity: "error"
      });
    }

    // Validate injection modes require inject: true
    if ((frontmatter.before || frontmatter.after) && !frontmatter.inject) {
      errors.push({
        code: "INJECTION_MODE_REQUIRED",
        message: "before/after requires inject: true",
        severity: "error"
      });
    }

    // Validate lineAt is a positive number
    if (frontmatter.lineAt !== undefined && (typeof frontmatter.lineAt !== 'number' || frontmatter.lineAt < 1)) {
      errors.push({
        code: "INVALID_LINE_NUMBER",
        message: "lineAt must be a positive number (1-based line numbers)",
        severity: "error"
      });
    }

    // Validate chmod format
    if (frontmatter.chmod !== undefined) {
      if (typeof frontmatter.chmod === "string") {
        if (!/^[0-7]{3,4}$/.test(frontmatter.chmod)) {
          errors.push({
            code: "INVALID_CHMOD_FORMAT",
            message: "chmod string must be octal format (e.g., '755', '0644')",
            severity: "error"
          });
        }
      } else if (
        typeof frontmatter.chmod === "number" &&
        (frontmatter.chmod < 0 || frontmatter.chmod > 0o777)
      ) {
        errors.push({
          code: "INVALID_CHMOD_VALUE",
          message: "chmod number must be between 0 and 0o777",
          severity: "error"
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Legacy validate method for backward compatibility
   * @param {Object} frontmatter - Frontmatter object to validate
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate(frontmatter) {
    const result = this._validateCore(frontmatter);
    return {
      valid: result.errors.length === 0,
      errors: result.errors.map(err => err.message)
    };
  }

  /**
   * Determine the operation mode based on frontmatter
   * @param {Object} frontmatter - Frontmatter object
   * @returns {{mode: string, lineNumber?: number, target?: string}}
   */
  getOperationMode(frontmatter) {
    if (frontmatter.lineAt !== undefined) {
      return { mode: "lineAt", lineNumber: frontmatter.lineAt };
    }

    if (frontmatter.append) {
      return { mode: "append" };
    }

    if (frontmatter.prepend) {
      return { mode: "prepend" };
    }

    if (frontmatter.inject) {
      if (frontmatter.before) {
        return { mode: "inject", target: frontmatter.before };
      }
      if (frontmatter.after) {
        return { mode: "inject", target: frontmatter.after };
      }
      return { mode: "inject" };
    }

    return { mode: "write" };
  }

  /**
   * Check if generation should be skipped based on skipIf condition
   * @param {Object} frontmatter - Frontmatter object
   * @param {Object} variables - Template variables
   * @returns {boolean}
   */
  shouldSkip(frontmatter, variables) {
    if (!frontmatter.skipIf || typeof frontmatter.skipIf !== 'string' || frontmatter.skipIf.trim().length === 0) {
      return false;
    }

    try {
      // Simple expression evaluation for skipIf conditions
      const condition = frontmatter.skipIf.trim();

      // Check for simple variable existence: skipIf: "variableName"
      if (variables[condition] !== undefined) {
        return Boolean(variables[condition]);
      }

      // Check for negation: skipIf: "!variableName"
      if (condition.startsWith("!")) {
        const varName = condition.slice(1);
        return !variables[varName];
      }

      // Check for equality: skipIf: "variableName==value"
      const equalityMatch = condition.match(/^(\w+)\s*==\s*(.+)$/);
      if (equalityMatch) {
        const [, varName, value] = equalityMatch;
        const actualValue = variables[varName];

        // Remove quotes if present
        const expectedValue = value.replace(/^["'](.*)["']$/, "$1");

        return String(actualValue) === expectedValue;
      }

      // Check for inequality: skipIf: "variableName!=value"
      const inequalityMatch = condition.match(/^(\w+)\s*!=\s*(.+)$/);
      if (inequalityMatch) {
        const [, varName, value] = inequalityMatch;
        const actualValue = variables[varName];

        // Remove quotes if present
        const expectedValue = value.replace(/^["'](.*)["']$/, "$1");

        return String(actualValue) !== expectedValue;
      }

      return false;
    } catch (error) {
      console.warn(
        `Warning: Error evaluating skipIf condition: ${frontmatter.skipIf}`,
        error
      );
      return false;
    }
  }

  /**
   * Validate KGEN-specific frontmatter fields
   * @param {Object} frontmatter - Frontmatter object to validate
   * @returns {{errors: Array, warnings: Array}}
   */
  _validateKgenFields(frontmatter) {
    const errors = [];
    const warnings = [];

    // Validate deterministic flag
    if (frontmatter.deterministic !== undefined && typeof frontmatter.deterministic !== 'boolean') {
      errors.push({
        code: "INVALID_DETERMINISTIC_FLAG",
        message: "deterministic must be a boolean value",
        severity: "error"
      });
    }

    // Validate contentAddressed flag
    if (frontmatter.contentAddressed !== undefined && typeof frontmatter.contentAddressed !== 'boolean') {
      errors.push({
        code: "INVALID_CONTENT_ADDRESSED_FLAG",
        message: "contentAddressed must be a boolean value",
        severity: "error"
      });
    }

    // Validate attestations flag
    if (frontmatter.attestations !== undefined && typeof frontmatter.attestations !== 'boolean') {
      errors.push({
        code: "INVALID_ATTESTATIONS_FLAG",
        message: "attestations must be a boolean value",
        severity: "error"
      });
    }

    // Validate provenance metadata
    if (frontmatter.provenance && typeof frontmatter.provenance === 'object') {
      if (frontmatter.provenance.source && typeof frontmatter.provenance.source !== 'string') {
        errors.push({
          code: "INVALID_PROVENANCE_SOURCE",
          message: "provenance.source must be a string",
          severity: "error"
        });
      }
      
      if (frontmatter.provenance.version && typeof frontmatter.provenance.version !== 'string') {
        errors.push({
          code: "INVALID_PROVENANCE_VERSION",
          message: "provenance.version must be a string",
          severity: "error"
        });
      }
    }

    // Validate template metadata fields
    const metadataFields = ['name', 'title', 'description', 'version', 'author', 'license'];
    metadataFields.forEach(field => {
      if (frontmatter[field] !== undefined && typeof frontmatter[field] !== 'string') {
        warnings.push({
          code: "INVALID_METADATA_FIELD",
          message: `${field} should be a string for better metadata extraction`,
          severity: "warning"
        });
      }
    });

    // Validate tags array
    if (frontmatter.tags && !Array.isArray(frontmatter.tags)) {
      warnings.push({
        code: "INVALID_TAGS_FORMAT",
        message: "tags should be an array of strings",
        severity: "warning"
      });
    }

    // Warn about conflicting deterministic settings
    if (frontmatter.deterministic === false && frontmatter.contentAddressed === true) {
      warnings.push({
        code: "CONFLICTING_DETERMINISTIC_SETTINGS",
        message: "contentAddressed=true with deterministic=false may cause inconsistent behavior",
        severity: "warning"
      });
    }

    return { errors, warnings };
  }

  /**
   * Normalize chmod value to octal number
   * @param {string|number} chmod - Chmod value to normalize
   * @returns {number} Normalized chmod as octal number
   */
  normalizeChmod(chmod) {
    if (typeof chmod === "number") {
      return chmod;
    }

    // Handle string format like '755' or '0755'
    const parsed = chmod.startsWith("0")
      ? Number.parseInt(chmod, 8)
      : Number.parseInt(chmod, 8);

    return parsed;
  }

  /**
   * Get default frontmatter with KGEN-specific fields
   * @returns {Object} Default frontmatter object
   */
  _getDefaultFrontmatter() {
    return {
      deterministic: this.kgenConfig.defaultDeterministic,
      contentAddressed: this.kgenConfig.enableContentAddressing,
      attestations: this.kgenConfig.enableAttestations
    };
  }

  /**
   * Enhance frontmatter with KGEN-specific defaults
   * @param {Object} frontmatter - Original frontmatter
   * @returns {Object} Enhanced frontmatter
   */
  _enhanceWithKgenDefaults(frontmatter) {
    const enhanced = { ...frontmatter };
    
    // Set KGEN defaults if not explicitly defined
    if (enhanced.deterministic === undefined) {
      enhanced.deterministic = this.kgenConfig.defaultDeterministic;
    }
    
    if (enhanced.contentAddressed === undefined) {
      enhanced.contentAddressed = this.kgenConfig.enableContentAddressing;
    }
    
    if (enhanced.attestations === undefined) {
      enhanced.attestations = this.kgenConfig.enableAttestations;
    }
    
    // Add KGEN version information
    if (!enhanced._generated) {
      enhanced._generated = {
        kgenVersion: process.env.npm_package_version || '1.0.0',
        timestamp: this.getDeterministicDate().toISOString()
      };
    }
    
    return enhanced;
  }

  /**
   * Extract template metadata from frontmatter
   * @param {Object} frontmatter - Frontmatter object
   * @param {string} templatePath - Template file path
   * @returns {Object} Template metadata
   */
  _extractTemplateMetadata(frontmatter, templatePath = null) {
    const metadata = {
      name: frontmatter.name,
      title: frontmatter.title,
      description: frontmatter.description,
      category: frontmatter.category,
      tags: frontmatter.tags || [],
      version: frontmatter.version,
      author: frontmatter.author,
      license: frontmatter.license,
      templatePath,
      extractedAt: this.getDeterministicDate().toISOString()
    };
    
    // Extract KGEN-specific metadata
    metadata.kgen = {
      deterministic: frontmatter.deterministic,
      contentAddressed: frontmatter.contentAddressed,
      attestations: frontmatter.attestations,
      operationMode: this.getOperationMode(frontmatter),
      hasRdfConfig: this._hasRDFConfig(frontmatter)
    };
    
    // Extract injection configuration
    if (frontmatter.inject || frontmatter.append || frontmatter.prepend || frontmatter.lineAt !== undefined) {
      metadata.injection = {
        mode: this.getOperationMode(frontmatter),
        skipIf: frontmatter.skipIf,
        before: frontmatter.before,
        after: frontmatter.after
      };
    }
    
    return metadata;
  }

  /**
   * Generate provenance information for template processing
   * @param {Object} frontmatter - Frontmatter object
   * @param {string} templatePath - Template file path
   * @returns {Object} Provenance information
   */
  _generateProvenanceInfo(frontmatter, templatePath) {
    const templateHash = createHash('sha256')
      .update(JSON.stringify(frontmatter))
      .digest('hex');
      
    return {
      templatePath,
      templateHash,
      frontmatterHash: createHash('sha256').update(JSON.stringify(frontmatter, null, 2)).digest('hex'),
      parsedAt: this.getDeterministicDate().toISOString(),
      parserVersion: '2.0.0-enhanced',
      deterministic: frontmatter.deterministic,
      contentAddressed: frontmatter.contentAddressed,
      attestationEnabled: frontmatter.attestations
    };
  }

  // ============================================================================
  // UNJUCKS-derived methods for SPARQL/RDF support
  // ============================================================================

  /**
   * Pre-process frontmatter to safely handle SPARQL queries in YAML
   * @param {string} frontmatterText - Raw frontmatter text
   * @returns {string} Processed frontmatter safe for YAML parsing
   */
  _preprocessSparqlFrontmatter(frontmatterText) {
    // Handle multiline SPARQL queries using literal block scalar (|)
    // This preserves line breaks and special characters
    return frontmatterText.replace(
      /^(\s*(?:sparql|query|rdf|turtle):\s*)([\s\S]*?)(?=^\s*[a-zA-Z_]|\s*$)/gm,
      (match, header, content) => {
        // If content doesn't start with | or >, add | for literal block
        if (!content.trim().startsWith('|') && !content.trim().startsWith('>')) {
          // Check if content looks like a SPARQL query
          const trimmedContent = content.trim();
          if (this._isSparqlLikeContent(trimmedContent)) {
            return header + '|\n' + content.split('\n').map(line => 
              line.trim() ? '  ' + line : line
            ).join('\n');
          }
        }
        return match;
      }
    );
  }

  /**
   * Post-process parsed frontmatter to restore SPARQL content
   * @param {object} frontmatter - Parsed YAML frontmatter
   * @returns {object} Processed frontmatter with clean SPARQL content
   */
  _postprocessSparqlFrontmatter(frontmatter) {
    const result = { ...frontmatter };
    
    // Clean up SPARQL/RDF content
    ['sparql', 'query', 'rdf', 'turtle'].forEach(key => {
      if (typeof result[key] === 'string') {
        result[key] = result[key].trim();
      }
    });

    // Handle RDF prefixes array
    if (result.rdf && typeof result.rdf === 'object') {
      if (Array.isArray(result.rdf.prefixes)) {
        result.rdf.prefixes = result.rdf.prefixes.map(prefix => {
          if (typeof prefix === 'string') {
            return prefix.trim();
          }
          return prefix;
        });
      }
    }

    return result;
  }

  /**
   * Check if content looks like SPARQL
   * @param {string} content - Content to check
   * @returns {boolean} Whether content appears to be SPARQL
   */
  _isSparqlLikeContent(content) {
    const sparqlKeywords = [
      'SELECT', 'CONSTRUCT', 'ASK', 'DESCRIBE', 'INSERT', 'DELETE',
      'PREFIX', 'WHERE', 'FILTER', 'OPTIONAL', 'UNION', 'GRAPH'
    ];
    
    const upperContent = content.toUpperCase();
    return sparqlKeywords.some(keyword => upperContent.includes(keyword));
  }

  /**
   * Validate RDF configuration from frontmatter
   * @param {Object} frontmatter - Frontmatter object to validate
   * @returns {{errors: Array, warnings: Array}}
   */
  _validateRDFConfig(frontmatter) {
    const errors = [];
    const warnings = [];

    // Validate RDF configuration
    if (frontmatter.rdf && typeof frontmatter.rdf === "object") {
      if (!frontmatter.rdf.source && !frontmatter.rdf.prefixes) {
        errors.push({
          code: "INVALID_RDF_CONFIG",
          message: "RDF configuration requires a 'source' property or 'prefixes' array",
          severity: "error"
        });
      }
      if (
        frontmatter.rdf.type &&
        !["file", "inline", "uri"].includes(frontmatter.rdf.type)
      ) {
        errors.push({
          code: "INVALID_RDF_TYPE",
          message: "RDF type must be 'file', 'inline', or 'uri'",
          severity: "error"
        });
      }
      
      // Validate prefixes array
      if (frontmatter.rdf.prefixes && !Array.isArray(frontmatter.rdf.prefixes)) {
        errors.push({
          code: "INVALID_RDF_PREFIXES",
          message: "RDF prefixes must be an array",
          severity: "error"
        });
      }
    }

    if (frontmatter.turtle && typeof frontmatter.turtle === "object") {
      if (!frontmatter.turtle.source) {
        errors.push({
          code: "INVALID_TURTLE_CONFIG",
          message: "Turtle configuration requires a 'source' property",
          severity: "error"
        });
      }
      if (
        frontmatter.turtle.type &&
        !["file", "inline", "uri"].includes(frontmatter.turtle.type)
      ) {
        errors.push({
          code: "INVALID_TURTLE_TYPE",
          message: "Turtle type must be 'file', 'inline', or 'uri'",
          severity: "error"
        });
      }
    }

    // Validate inline SPARQL queries
    if (frontmatter.sparql && typeof frontmatter.sparql === "string") {
      const sparqlContent = frontmatter.sparql.trim();
      if (sparqlContent && !this._isValidSparqlSyntax(sparqlContent)) {
        warnings.push({
          code: "INVALID_SPARQL_SYNTAX",
          message: "Invalid SPARQL query syntax in frontmatter",
          severity: "warning"
        });
      }
    }

    // Validate RDF base URI format
    if (frontmatter.rdfBaseUri && !this._isValidUri(frontmatter.rdfBaseUri)) {
      errors.push({
        code: "INVALID_RDF_BASE_URI",
        message: "rdfBaseUri must be a valid URI",
        severity: "error"
      });
    }

    return { errors, warnings };
  }

  /**
   * Check if frontmatter contains RDF configuration
   * @param {Object} frontmatter - Frontmatter object to check
   * @returns {boolean}
   */
  _hasRDFConfig(frontmatter) {
    return !!(
      frontmatter.rdf ||
      frontmatter.turtle ||
      frontmatter.turtleData ||
      frontmatter.rdfData ||
      frontmatter.sparql ||
      frontmatter.query
    );
  }

  /**
   * Basic SPARQL syntax validation
   * @param {string} sparqlQuery - SPARQL query to validate
   * @returns {boolean} Whether the query has basic valid syntax
   */
  _isValidSparqlSyntax(sparqlQuery) {
    if (!sparqlQuery || typeof sparqlQuery !== 'string') return false;
    
    const query = sparqlQuery.trim().toUpperCase();
    
    // Check for basic SPARQL query structure
    const hasQueryType = /^(SELECT|CONSTRUCT|ASK|DESCRIBE|INSERT|DELETE)/.test(query);
    if (!hasQueryType) return false;
    
    // For SELECT/CONSTRUCT queries, check for WHERE clause
    if (query.startsWith('SELECT') || query.startsWith('CONSTRUCT')) {
      return query.includes('WHERE');
    }
    
    // For UPDATE queries (INSERT/DELETE), they're valid without WHERE
    return true;
  }

  /**
   * Check if URI is valid
   * @param {string} uri - URI to validate
   * @returns {boolean}
   */
  _isValidUri(uri) {
    try {
      new URL(uri);
      return true;
    } catch {
      // Also accept relative URIs or namespace patterns
      return uri.includes(":") || uri.startsWith("/");
    }
  }

  /**
   * Extract RDF configuration from frontmatter
   * @param {Object} frontmatter - Frontmatter object
   * @returns {Object|null} RDF configuration or null if not found
   */
  getRDFConfig(frontmatter) {
    if (frontmatter.rdf) {
      if (typeof frontmatter.rdf === "string") {
        return { type: "file", source: frontmatter.rdf };
      }
      return frontmatter.rdf;
    }

    if (frontmatter.turtle) {
      if (typeof frontmatter.turtle === "string") {
        return {
          type: "file",
          source: frontmatter.turtle,
          format: "text/turtle",
        };
      }
      return { ...frontmatter.turtle, format: "text/turtle" };
    }

    if (frontmatter.turtleData || frontmatter.rdfData) {
      return {
        type: "inline",
        source: frontmatter.turtleData || frontmatter.rdfData,
        format: "text/turtle",
      };
    }

    return null;
  }
}

export default FrontmatterParser;