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
   * @param {string} templateContent - Template content to parse
   * @param {boolean} [enableSemanticValidation=false] - Enable semantic validation
   * @returns {Promise<{frontmatter: Object, content: string, hasValidFrontmatter: boolean, validationResult?: Object}>}
   */
  async parse(templateContent, enableSemanticValidation = false) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = templateContent.match(frontmatterRegex);

    if (!match) {
      return {
        frontmatter: {},
        content: templateContent,
        hasValidFrontmatter: false,
      };
    }

    try {
      const frontmatter = yaml.parse(match[1]) || {};
      const content = match[2];

      const result = {
        frontmatter: frontmatter || {},
        content,
        hasValidFrontmatter: true,
      };

      // Semantic validation if enabled and RDF configuration present
      if (
        enableSemanticValidation &&
        this.semanticValidator &&
        this.hasRDFConfig(frontmatter)
      ) {
        try {
          // This would require RDFDataLoader to get actual data for validation
          // For now, just validate the configuration structure
          const configValidation = this.validate(frontmatter);
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
      if (!frontmatter.rdf.source) {
        errors.push("RDF configuration requires a 'source' property");
      }
      if (
        frontmatter.rdf.type &&
        !["file", "inline", "uri"].includes(frontmatter.rdf.type)
      ) {
        errors.push("RDF type must be 'file', 'inline', or 'uri'");
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
      frontmatter.rdfData
    );
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