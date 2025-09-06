import yaml from "yaml";
import type { RDFDataSource } from "./types/turtle-types.js";
import { SemanticValidator } from "./semantic-validator.js";
import type {
  FrontmatterConfig as UnifiedFrontmatterConfig,
  ParsedTemplate as UnifiedParsedTemplate,
  RDFDataSource as UnifiedRDFDataSource,
  ValidationResult as UnifiedValidationResult,
} from "../types/unified-types.js";

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

  // RDF/Turtle data source configurations
  rdf?: RDFDataSource | string;
  turtle?: RDFDataSource | string;
  turtleData?: string;
  rdfData?: string;

  // RDF-specific options
  rdfBaseUri?: string;
  rdfPrefixes?: Record<string, string>;
  rdfQuery?: {
    subject?: string;
    predicate?: string;
    object?: string;
    limit?: number;
    orderBy?: string;
  };

  // Semantic validation and processing
  semanticValidation?: {
    enabled?: boolean;
    ontologies?: string[];
    strictMode?: boolean;
    complianceFrameworks?: (
      | "GDPR"
      | "HIPAA"
      | "SOX"
      | "FHIR"
      | "FIBO"
      | "GS1"
    )[];
    validationLevel?: "strict" | "warn" | "info";
  };

  // Enterprise data sources with semantic context
  dataSources?: Array<{
    type: "file" | "uri" | "graphql" | "sparql";
    source: string;
    query?: string;
    endpoint?: string;
    headers?: Record<string, string>;
    ontologyContext?: string;
    semanticMapping?: boolean;
    performanceProfile?: "fast" | "balanced" | "comprehensive";
  }>;

  // Template variable enhancement with cross-ontology support
  variableEnhancement?: {
    semanticMapping?: boolean;
    typeInference?: boolean;
    ontologyContext?: string | string[];
    crossOntologyMapping?: boolean;
    enterpriseValidation?: boolean;
    performanceOptimization?: boolean;
  };
}

export interface ParsedTemplate {
  frontmatter: FrontmatterConfig;
  content: string;
  hasValidFrontmatter: boolean;
}

export class FrontmatterParser {
  private semanticValidator?: SemanticValidator;

  constructor(enableValidation: boolean = false) {
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
   */
  async parse(
    templateContent: string,
    enableSemanticValidation: boolean = false
  ): Promise<
    ParsedTemplate & {
      validationResult?: any;
    }
  > {
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

      const result: ParsedTemplate & { validationResult?: any } = {
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
   */
  validate(frontmatter: FrontmatterConfig): {
    valid: boolean;
    errors: string[];
  } {
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
   */
  hasRDFConfig(frontmatter: FrontmatterConfig): boolean {
    return !!(
      frontmatter.rdf ||
      frontmatter.turtle ||
      frontmatter.turtleData ||
      frontmatter.rdfData
    );
  }

  /**
   * Extract RDF configuration from frontmatter
   */
  getRDFConfig(frontmatter: FrontmatterConfig): RDFDataSource | null {
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
        source: frontmatter.turtleData || frontmatter.rdfData!,
        format: "text/turtle",
      };
    }

    return null;
  }

  private isValidUri(uri: string): boolean {
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
      console.warn(
        `Warning: Error evaluating skipIf condition: ${frontmatter.skipIf}`,
        error
      );
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
    const parsed = chmod.startsWith("0")
      ? Number.parseInt(chmod, 8)
      : Number.parseInt(chmod, 8);

    return parsed;
  }
}
