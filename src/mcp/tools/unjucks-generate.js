/**
 * Implementation of the unjucks_generate MCP tool
 * Generates files using real unjucks functionality
 */

import { Generator } from "../../lib/generator.js";
import {
  createTextToolResult,
  createJSONToolResult,
  handleToolError,
  validateObjectSchema,
  validateDestination,
  validateGeneratorName,
  validateTemplateName,
  formatFileSize,
  logPerformance,
  createFileOperationSummary,
} from "../utils.js";
import { TOOL_SCHEMAS } from "../types.js";
import path from "node:path";
import fs from "fs-extra";

/**
 * Generate files using unjucks templates with real file creation
 * @param {import('../types.js').UnjucksGenerateParams} params - Generation parameters
 * @returns {Promise<import('../types.js').ToolResult>}
 */
export async function unjucksGenerate(params) {
  const startTime = performance.now();

  try {
    // Validate input parameters
    const validation = validateObjectSchema(
      params,
      TOOL_SCHEMAS.unjucks_generate
    );
    if (!validation.valid) {
      return createTextToolResult(
        `Invalid parameters: ${validation.errors.join(", ")}`,
        true
      );
    }

    const {
      generator,
      template,
      dest,
      variables = {},
      force = false,
      dry = false,
    } = params;

    // Validate generator and template names
    try {
      validateGeneratorName(generator);
      validateTemplateName(template);
    } catch (error) {
      return handleToolError(error, "unjucks_generate", "parameter validation");
    }

    // Validate and sanitize destination
    /** @type {string} */
    let destinationPath;
    try {
      destinationPath = validateDestination(dest);
    } catch (error) {
      return handleToolError(
        error,
        "unjucks_generate",
        "destination validation"
      );
    }

    // Initialize generator instance
    const gen = new Generator();

    try {
      // Check if generator and template exist
      const generators = await gen.listGenerators();
      const foundGenerator = generators.find((g) => g.name === generator);

      if (!foundGenerator) {
        const availableGenerators = generators.map((g) => g.name).join(", ");
        return createTextToolResult(
          `Generator "${generator}" not found. Available generators: ${
            availableGenerators || "none"
          }`,
          true
        );
      }

      const foundTemplate = foundGenerator.templates.find(
        (t) => t.name === template
      );
      if (!foundTemplate) {
        const availableTemplates = foundGenerator.templates
          .map((t) => t.name)
          .join(", ");
        return createTextToolResult(
          `Template "${template}" not found in generator "${generator}". Available templates: ${
            availableTemplates || "none"
          }`,
          true
        );
      }

      // Ensure destination directory exists (unless dry run)
      if (!dry) {
        try {
          await fs.ensureDir(destinationPath);
        } catch (error) {
          return handleToolError(
            error,
            "unjucks_generate",
            "creating destination directory"
          );
        }
      }

      // Generate files using the real unjucks generator
      const generateOptions = {
        generator,
        template,
        dest: destinationPath,
        force,
        dry,
        variables,
      };

      const result = await gen.generate(generateOptions);

      // Process results into MCP format
      const files = result.files.map((file) => {
        let action = "created";

        if (file.injectionResult) {
          if (file.injectionResult.skipped) {
            action = "skipped";
          } else if (file.injectionResult.action === "inject") {
            action = "injected";
          } else if (file.injectionResult.action === "update") {
            action = "updated";
          }
        }

        return {
          path: file.path,
          content: dry ? file.content : "[Generated]", // Don't return full content in production
          action,
          size: Buffer.byteLength(file.content, "utf8"),
          relativePath: path.relative(destinationPath, file.path),
        };
      });

      // Create summary
      const summary = createFileOperationSummary(files);

      /** @type {import('../types.js').UnjucksGenerateResult} */
      const generateResult = {
        files,
        summary: {
          created: summary.created,
          updated: summary.updated,
          skipped: summary.skipped,
          injected: summary.injected,
        },
      };

      // Add metadata
      const metadata = {
        generator,
        template,
        destination: destinationPath,
        variables,
        options: { force, dry },
        performance: {
          duration: performance.now() - startTime,
          filesProcessed: files.length,
          totalSize: formatFileSize(summary.totalSize),
        },
        timestamp: new Date().toISOString(),
      };

      // Performance logging
      logPerformance({
        operation: `generate ${generator}/${template}`,
        duration: metadata.performance.duration,
        filesProcessed: files.length,
      });

      // Create detailed response
      const response = {
        success: true,
        operation: dry ? "dry-run" : "generate",
        result: generateResult,
        metadata,
      };

      // Add success message
      let message = dry
        ? `Dry run completed for ${generator}/${template}. Would generate ${files.length} files.`
        : `Successfully generated ${files.length} files using ${generator}/${template}.`;

      if (summary.skipped > 0) {
        message += ` ${summary.skipped} files were skipped.`;
      }
      if (summary.injected > 0) {
        message += ` ${summary.injected} files had content injected.`;
      }

      // Return success response with both message and detailed data
      return {
        content: [
          {
            type: "text",
            text: message,
          },
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
        isError: false,
        _meta: metadata,
      };
    } catch (error) {
      return handleToolError(
        error,
        "unjucks_generate",
        `generating ${generator}/${template}`
      );
    }
  } catch (error) {
    return handleToolError(error, "unjucks_generate", "general operation");
  }
}

/**
 * Helper function to check if files would be overwritten
 * @param {Array<{path: string}>} files - Files to check
 * @param {boolean} force - Whether to force overwrite
 * @returns {Promise<Array<{path: string, exists: boolean, size?: number}>>}
 */
async function checkFileConflicts(files, force) {
  const conflicts = [];

  for (const file of files) {
    try {
      const stat = await fs.stat(file.path);
      conflicts.push({
        path: file.path,
        exists: true,
        size: stat.size,
      });
    } catch {
      // File doesn't exist, no conflict
      conflicts.push({
        path: file.path,
        exists: false,
      });
    }
  }

  return conflicts;
}