import yaml from "yaml";
import { SemanticValidator } from "./semantic-validator.js";

export class FrontmatterParser {
  constructor(enableValidation = false) {
    this.semanticValidator = undefined;
    if (enableValidation) {
      this.semanticValidator = new SemanticValidator({
        strictMode: true,
        maxErrors: 100,
        timeout: 5000,
        memoryLimit: 2048,
        enablePerformanceMetrics: true,
        cacheEnabled: true,
        parallelProcessing: false,
        validationRules: [],
      });
    }
  }

  /**
   * Parse template content with frontmatter and optional semantic validation
   * Enhanced to handle SPARQL/RDF content properly
   * @param {string} templateContent - Template content to parse
   * @param {boolean} [enableSemanticValidation=false] - Enable semantic validation
   * @returns {Promise<{frontmatter: Object, content: string, hasValidFrontmatter: boolean, validationResult?: Object}>}
   */
  async parse(templateContent, enableSemanticValidation = false) {
    // Enhanced frontmatter regex that properly handles SPARQL content
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
    const match = templateContent.match(frontmatterRegex);

    if (!match) {
      return {
        frontmatter: {},
        content: templateContent,
        hasValidFrontmatter: false,
      };
    }

    try {
      // Pre-process frontmatter to handle SPARQL queries safely
      const processedFrontmatterText = this.preprocessSparqlFrontmatter(match[1]);
      
      const frontmatter = yaml.parse(processedFrontmatterText, {
        keepUndefined: true,
        strict: false
      }) || {};
      
      // Post-process to restore SPARQL content
      const processedFrontmatter = this.postprocessSparqlFrontmatter(frontmatter);
      
      const content = match[2].trim();

      const result = {
        frontmatter: processedFrontmatter || {},
        content,
        hasValidFrontmatter: true,
      };

      // Semantic validation if enabled and RDF configuration present
      if (
        enableSemanticValidation &&
        this.semanticValidator &&
        this.hasRDFConfig(processedFrontmatter)
      ) {
        try {
          // This would require RDFDataLoader to get actual data for validation
          // For now, just validate the configuration structure
          const configValidation = this.validate(processedFrontmatter);
          if (!configValidation.valid) {
            result.validationResult = {
              valid: false,
              errors: configValidation.errors.map((err) => ({
                code: "FRONTMATTER_CONFIG_ERROR",
                message: err,
                severity: "error",
              })),
            };
          }
        } catch (validationError) {
          console.warn("Semantic validation failed:", validationError);
        }
      }

      return result;
    } catch (error) {
      console.warn("Warning: Invalid YAML frontmatter, ignoring:", error);
      return {
        frontmatter: {},
        content: templateContent,
        hasValidFrontmatter: false,
      };
    }
  }

  /**
   * Pre-process frontmatter to safely handle SPARQL queries in YAML
   * @param {string} frontmatterText - Raw frontmatter text
   * @returns {string} Processed frontmatter safe for YAML parsing
   */
  preprocessSparqlFrontmatter(frontmatterText) {
    // Handle multiline SPARQL queries using literal block scalar (|)
    // This preserves line breaks and special characters
    return frontmatterText.replace(
      /^(\s*(?:sparql|query|rdf|turtle):\s*)([\s\S]*?)(?=^\s*[a-zA-Z_]|\s*$)/gm,
      (match, header, content) => {
        // If content doesn't start with | or >, add | for literal block
        if (!content.trim().startsWith('|') && !content.trim().startsWith('>')) {
          // Check if content looks like a SPARQL query
          const trimmedContent = content.trim();
          if (this.isSparqlLikeContent(trimmedContent)) {
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
  postprocessSparqlFrontmatter(frontmatter) {
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
  isSparqlLikeContent(content) {
    const sparqlKeywords = [
      'SELECT', 'CONSTRUCT', 'ASK', 'DESCRIBE', 'INSERT', 'DELETE',
      'PREFIX', 'WHERE', 'FILTER', 'OPTIONAL', 'UNION', 'GRAPH'
    ];
    
    const upperContent = content.toUpperCase();
    return sparqlKeywords.some(keyword => upperContent.includes(keyword));
  }

  /**
   * Validate frontmatter configuration
   * @param {Object} frontmatter - Frontmatter object to validate
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate(frontmatter) {
    const errors = [];

    // Check mutually exclusive injection options
    const injectionModes = [
      frontmatter.inject,
      frontmatter.append,
      frontmatter.prepend,
      frontmatter.lineAt !== undefined,
    ].filter(Boolean);

    if (injectionModes.length > 1) {
      errors.push(
        "Only one injection mode allowed: inject, append, prepend, or lineAt"
      );
    }

    // Validate injection modes require inject: true
    if ((frontmatter.before || frontmatter.after) && !frontmatter.inject) {
      errors.push("before/after requires inject: true");
    }

    // Validate lineAt is a positive number
    if (frontmatter.lineAt !== undefined && frontmatter.lineAt < 1) {
      errors.push("lineAt must be a positive number (1-based line numbers)");
    }

    // Validate chmod format
    if (frontmatter.chmod !== undefined) {
      if (typeof frontmatter.chmod === "string") {
        if (!/^[0-7]{3,4}$/.test(frontmatter.chmod)) {
          errors.push(
            "chmod string must be octal format (e.g., '755', '0644')"
          );
        }
      } else if (
        typeof frontmatter.chmod === "number" &&
        (frontmatter.chmod < 0 || frontmatter.chmod > 0o777)
      ) {
        errors.push("chmod number must be between 0 and 0o777");
      }
    }

    // Validate RDF configuration
    if (frontmatter.rdf && typeof frontmatter.rdf === "object") {
      if (!frontmatter.rdf.source && !frontmatter.rdf.prefixes) {
        errors.push("RDF configuration requires a 'source' property or 'prefixes' array");
      }
      if (
        frontmatter.rdf.type &&
        !["file", "inline", "uri"].includes(frontmatter.rdf.type)
      ) {
        errors.push("RDF type must be 'file', 'inline', or 'uri'");
      }
      
      // Validate prefixes array
      if (frontmatter.rdf.prefixes && !Array.isArray(frontmatter.rdf.prefixes)) {
        errors.push("RDF prefixes must be an array");
      }
    }

    if (frontmatter.turtle && typeof frontmatter.turtle === "object") {
      if (!frontmatter.turtle.source) {
        errors.push("Turtle configuration requires a 'source' property");
      }
      if (
        frontmatter.turtle.type &&
        !["file", "inline", "uri"].includes(frontmatter.turtle.type)
      ) {
        errors.push("Turtle type must be 'file', 'inline', or 'uri'");
      }
    }

    // Validate inline SPARQL queries
    if (frontmatter.sparql && typeof frontmatter.sparql === "string") {
      const sparqlContent = frontmatter.sparql.trim();
      if (sparqlContent && !this.isValidSparqlSyntax(sparqlContent)) {
        errors.push("Invalid SPARQL query syntax in frontmatter");
      }
    }

    // Validate RDF base URI format
    if (frontmatter.rdfBaseUri && !this.isValidUri(frontmatter.rdfBaseUri)) {
      errors.push("rdfBaseUri must be a valid URI");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if frontmatter contains RDF configuration
   * @param {Object} frontmatter - Frontmatter object to check
   * @returns {boolean}
   */
  hasRDFConfig(frontmatter) {
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
  isValidSparqlSyntax(sparqlQuery) {
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

  /**
   * Check if URI is valid
   * @param {string} uri - URI to validate
   * @returns {boolean}
   */
  isValidUri(uri) {
    try {
      new URL(uri);
      return true;
    } catch {
      // Also accept relative URIs or namespace patterns
      return uri.includes(":") || uri.startsWith("/");
    }
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
    if (!frontmatter.skipIf) {
      return false;
    }

    try {
      // Simple expression evaluation for skipIf conditions
      // Supports: variable existence, boolean checks, equality
      const condition = frontmatter.skipIf;

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
}