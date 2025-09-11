/**
 * KGEN Frontmatter Parser
 * 
 * Simplified frontmatter parser for KGEN templates, focused on code generation use cases.
 * Extracted and simplified from the original frontmatter-parser.js.
 */

import yaml from "yaml";

export class FrontmatterParser {
  constructor(enableValidation = false) {
    this.enableValidation = enableValidation;
  }

  /**
   * Parse template content with frontmatter
   * @param {string} templateContent - Template content to parse
   * @param {boolean} [enableSemanticValidation=false] - Enable semantic validation
   * @returns {Promise<{frontmatter: Object, content: string, hasValidFrontmatter: boolean}>}
   */
  async parse(templateContent, enableSemanticValidation = false) {
    // Handle empty or whitespace-only content
    if (!templateContent || typeof templateContent !== 'string' || templateContent.trim().length === 0) {
      return {
        frontmatter: {},
        content: templateContent || '',
        hasValidFrontmatter: false,
      };
    }

    // Enhanced frontmatter regex
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
      const frontmatter = yaml.parse(match[1], {
        keepUndefined: true,
        strict: false
      }) || {};
      
      const content = match[2].trim();

      const result = {
        frontmatter: frontmatter || {},
        content,
        hasValidFrontmatter: true,
      };

      // Basic validation if enabled
      if (enableSemanticValidation && this.enableValidation) {
        const validation = this.validate(frontmatter);
        if (!validation.valid) {
          result.validationResult = {
            valid: false,
            errors: validation.errors.map((err) => ({
              code: "FRONTMATTER_CONFIG_ERROR",
              message: err,
              severity: "error",
            })),
          };
        }
      }

      return result;
    } catch (error) {
      console.warn("Warning: Invalid YAML frontmatter, ignoring:", error.message);
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
    if (frontmatter.lineAt !== undefined && (typeof frontmatter.lineAt !== 'number' || frontmatter.lineAt < 1)) {
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

    return {
      valid: errors.length === 0,
      errors,
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

export default FrontmatterParser;