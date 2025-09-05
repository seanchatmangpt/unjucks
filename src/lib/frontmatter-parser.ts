import yaml from "yaml";

export interface FrontmatterConfig {
  to?: string;
  inject?: boolean;
  before?: string;
  after?: string;
  append?: boolean;
  prepend?: boolean;
  lineAt?: number;
  skipIf?: string;
  chmod?: string | number;
  sh?: string | string[];
}

export interface ParsedTemplate {
  frontmatter: FrontmatterConfig;
  content: string;
  hasValidFrontmatter: boolean;
}

export class FrontmatterParser {
  /**
   * Parse template content with frontmatter
   */
  parse(templateContent: string): ParsedTemplate {
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
      const frontmatter = yaml.parse(match[1]) as FrontmatterConfig;
      const content = match[2];

      return {
        frontmatter: frontmatter || {},
        content,
        hasValidFrontmatter: true,
      };
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
   */
  validate(frontmatter: FrontmatterConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

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
          errors.push("chmod string must be octal format (e.g., '755', '0644')");
        }
      } else if (typeof frontmatter.chmod === "number" && (frontmatter.chmod < 0 || frontmatter.chmod > 0o777)) {
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
   */
  getOperationMode(frontmatter: FrontmatterConfig): {
    mode: "write" | "inject" | "append" | "prepend" | "lineAt";
    target?: string;
    lineNumber?: number;
  } {
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
   */
  shouldSkip(
    frontmatter: FrontmatterConfig,
    variables: Record<string, any>
  ): boolean {
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
      console.warn(`Warning: Error evaluating skipIf condition: ${frontmatter.skipIf}`, error);
      return false;
    }
  }

  /**
   * Normalize chmod value to octal number
   */
  normalizeChmod(chmod: string | number): number {
    if (typeof chmod === "number") {
      return chmod;
    }

    // Handle string format like '755' or '0755'
    const parsed = chmod.startsWith("0") ? 
      Number.parseInt(chmod, 8) : 
      Number.parseInt(chmod, 8);

    return parsed;
  }
}