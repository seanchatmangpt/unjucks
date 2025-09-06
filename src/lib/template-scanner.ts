import fs from "fs-extra";
import path from "node:path";
import nunjucks from "nunjucks";
import type {
  TemplateVariable as UnifiedTemplateVariable,
  TemplateScanResult as UnifiedTemplateScanResult,
} from "../types/unified-types.js";

export interface TemplateVariable {
  name: string;
  type: "string" | "boolean" | "number";
  defaultValue?: any;
  description?: string;
  required?: boolean;
}

export interface TemplateScanResult {
  variables: TemplateVariable[];
  prompts: TemplateVariable[];
}

export class TemplateScanner {
  private nunjucksEnv: nunjucks.Environment;

  constructor() {
    this.nunjucksEnv = new nunjucks.Environment(null, {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true,
    });
  }

  /**
   * Scan a template directory for variables used in templates
   */
  async scanTemplate(templatePath: string): Promise<TemplateScanResult> {
    const variables = new Set<string>();
    const prompts: TemplateVariable[] = [];

    // Scan all files in the template directory
    await this.scanDirectory(templatePath, variables);

    // Convert variables to TemplateVariable objects
    const templateVariables: TemplateVariable[] = [...variables].map(
      (varName) => ({
        name: varName,
        type: this.inferVariableType(varName),
        description: this.generateDescription(varName),
        required: this.isRequiredVariable(varName),
      })
    );

    return {
      variables: templateVariables,
      prompts: prompts,
    };
  }

  /**
   * Scan a directory recursively for template variables
   */
  private async scanDirectory(
    dirPath: string,
    variables: Set<string>
  ): Promise<void> {
    if (!(await fs.pathExists(dirPath))) {
      return;
    }

    const entries = await fs.readdir(dirPath);

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const stat = await fs.stat(entryPath);

      await (stat.isDirectory()
        ? this.scanDirectory(entryPath, variables)
        : this.scanFile(entryPath, variables));
    }
  }

  /**
   * Scan a single file for template variables
   */
  private async scanFile(
    filePath: string,
    variables: Set<string>
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf8");

      // Extract variables from Nunjucks syntax
      this.extractVariablesFromContent(content, variables);

      // Extract variables from filename
      const fileName = path.basename(filePath);
      this.extractVariablesFromContent(fileName, variables);
    } catch {
      // Skip files that can't be read
      console.warn(`Warning: Could not read file ${filePath}`);
    }
  }

  /**
   * Extract variables from template content using regex patterns
   */
  private extractVariablesFromContent(
    content: string,
    variables: Set<string>
  ): void {
    // Match {{ variable }} syntax
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const varName = match[1];

      // Skip Nunjucks built-in variables and filters
      if (!this.isBuiltinVariable(varName)) {
        variables.add(varName);
      }
    }

    // Match {{ variable | filter }} syntax
    const filteredVariablePattern =
      /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\|\s*[^}]+\}\}/g;
    while ((match = filteredVariablePattern.exec(content)) !== null) {
      const varName = match[1];
      if (!this.isBuiltinVariable(varName)) {
        variables.add(varName);
      }
    }

    // Match {% if variable %} syntax
    const ifPattern = /\{\%\s*if\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = ifPattern.exec(content)) !== null) {
      const varName = match[1];
      if (!this.isBuiltinVariable(varName)) {
        variables.add(varName);
      }
    }

    // Match {% for item in items %} syntax
    const forPattern =
      /\{\%\s*for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = forPattern.exec(content)) !== null) {
      const varName = match[2]; // The collection variable
      if (!this.isBuiltinVariable(varName)) {
        variables.add(varName);
      }
    }
  }

  /**
   * Check if a variable is a Nunjucks built-in
   */
  private isBuiltinVariable(varName: string): boolean {
    const builtins = [
      "loop",
      "super",
      "self",
      "cycler",
      "joiner",
      "range",
      "true",
      "false",
      "null",
      "undefined",
      "NaN",
      "Infinity",
    ];

    return builtins.includes(varName);
  }

  /**
   * Infer the type of a variable based on its name and usage patterns
   */
  private inferVariableType(varName: string): "string" | "boolean" | "number" {
    const lowerName = varName.toLowerCase();

    // Boolean patterns
    if (
      lowerName.startsWith("is") ||
      lowerName.startsWith("has") ||
      lowerName.startsWith("can") ||
      lowerName.startsWith("should") ||
      lowerName.startsWith("with") ||
      lowerName.startsWith("enable") ||
      lowerName.startsWith("disable") ||
      lowerName.includes("flag")
    ) {
      return "boolean";
    }

    // Number patterns
    if (
      lowerName.includes("count") ||
      lowerName.includes("size") ||
      lowerName.includes("length") ||
      lowerName.includes("index") ||
      lowerName.includes("id") ||
      lowerName.includes("number")
    ) {
      return "number";
    }

    // Default to string
    return "string";
  }

  /**
   * Generate a description for a variable based on its name
   */
  private generateDescription(varName: string): string {
    // Convert camelCase/PascalCase to readable format
    const readable = varName
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    return `${readable}`;
  }

  /**
   * Check if a variable is required based on naming patterns
   */
  private isRequiredVariable(varName: string): boolean {
    const lowerName = varName.toLowerCase();

    // Variables that are typically required
    const requiredPatterns = [
      "name",
      "title",
      "component",
      "page",
      "route",
      "path",
      "url",
      "id",
      "key",
      "type",
      "class",
      "namespace",
    ];

    return requiredPatterns.some((pattern) => lowerName.includes(pattern));
  }

  /**
   * Generate CLI argument definitions from template variables
   */
  generateCliArgs(templateVariables: TemplateVariable[]): Record<string, any> {
    const args: Record<string, any> = {};

    for (const variable of templateVariables) {
      const argName = variable.name;

      switch (variable.type) {
        case "boolean": {
          args[argName] = {
            type: "boolean",
            description: variable.description || `Set ${variable.name}`,
            default: false,
          };
          break;
        }

        case "number": {
          args[argName] = {
            type: "string", // CLI args are always strings, we'll parse them
            description: variable.description || `Set ${variable.name}`,
            default: variable.defaultValue?.toString() || "0",
          };
          break;
        }

        case "string":
        default: {
          args[argName] = {
            type: "string",
            description: variable.description || `Set ${variable.name}`,
            default: variable.defaultValue || "",
          };
          break;
        }
      }
    }

    return args;
  }

  /**
   * Convert CLI arguments to template variables
   */
  convertArgsToVariables(
    args: Record<string, any>,
    templateVariables: TemplateVariable[]
  ): Record<string, any> {
    const variables: Record<string, any> = {};

    for (const variable of templateVariables) {
      const value = args[variable.name];

      if (value !== undefined) {
        switch (variable.type) {
          case "boolean": {
            variables[variable.name] = Boolean(value);
            break;
          }
          case "number": {
            variables[variable.name] = Number(value);
            break;
          }
          case "string":
          default: {
            variables[variable.name] = String(value);
            break;
          }
        }
      }
    }

    return variables;
  }

  /**
   * Scan multiple templates and merge their variables
   */
  async scanMultipleTemplates(
    templatePaths: string[]
  ): Promise<TemplateScanResult> {
    const allVariables = new Set<string>();
    const allPrompts: TemplateVariable[] = [];

    for (const templatePath of templatePaths) {
      const result = await this.scanTemplate(templatePath);

      for (const variable of result.variables) {
        allVariables.add(variable.name);
      }

      allPrompts.push(...result.prompts);
    }

    const templateVariables: TemplateVariable[] = [...allVariables].map(
      (varName) => ({
        name: varName,
        type: this.inferVariableType(varName),
        description: this.generateDescription(varName),
        required: this.isRequiredVariable(varName),
      })
    );

    return {
      variables: templateVariables,
      prompts: allPrompts,
    };
  }
}
