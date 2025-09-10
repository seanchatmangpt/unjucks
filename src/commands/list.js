/**
 * List command - Display available generators and templates with filtering
 * @fileoverview Shows generators, templates, and their metadata in various formats
 */

import { defineCommand } from "citty";
import chalk from "chalk";
import { Generator } from "../lib/generator.js";
import {
  validators,
  displayValidationResults,
  createCommandError,
} from "../lib/command-validation.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";
import Table from "cli-table3";
import yaml from "yaml";

/**
 * @typedef {Object} ListCommandArgs
 * @property {string} [generator] - Specific generator to list templates for
 * @property {string} [category] - Filter by category
 * @property {string} [search] - Search generators/templates
 * @property {string} [format] - Output format
 * @property {string} [sort] - Sort field
 * @property {string} [direction] - Sort direction
 * @property {boolean} [detailed] - Show detailed information
 * @property {boolean} [stats] - Include usage statistics
 * @property {boolean} [quiet] - Suppress headers
 * @property {boolean} [verbose] - Verbose output
 */

/**
 * @typedef {Object} CommandResult
 * @property {boolean} success - Command success status
 * @property {string} message - Result message
 * @property {string[]} [files] - Generated files
 * @property {any} [data] - Result data
 * @property {number} [duration] - Execution duration
 */

/**
 * @typedef {Object} GeneratorInfo
 * @property {string} name - Generator name
 * @property {string} [description] - Generator description
 * @property {string} [category] - Generator category
 * @property {string} path - Generator path
 * @property {TemplateInfo[]} templates - Available templates
 * @property {string} [created] - Creation date
 * @property {string} [modified] - Modification date
 * @property {any} [usage] - Usage statistics
 */

/**
 * @typedef {Object} TemplateInfo
 * @property {string} name - Template name
 * @property {string} [description] - Template description
 * @property {string} path - Template path
 * @property {VariableInfo[]} variables - Template variables
 * @property {string[]} outputs - Output files
 * @property {string[]} tags - Template tags
 * @property {string} [created] - Creation date
 * @property {string} [modified] - Modification date
 */

/**
 * @typedef {Object} VariableInfo
 * @property {string} name - Variable name
 * @property {boolean} required - Whether variable is required
 */

/**
 * Output results in the requested format
 * @param {GeneratorInfo[]} generators - Generators to output
 * @param {ListCommandArgs} args - Command arguments
 */
async function outputResults(generators, args) {
  switch (args.format) {
    case "json":
      console.log(JSON.stringify(generators, null, 2));
      break;

    case "yaml":
      console.log(yaml.stringify(generators));
      break;

    case "simple":
      outputSimpleFormat(generators, args);
      break;

    default:
    case "table":
      outputTableFormat(generators, args);
      break;
  }
}

/**
 * Output in simple text format
 * @param {GeneratorInfo[]} generators - Generators to output
 * @param {ListCommandArgs} args - Command arguments
 */
function outputSimpleFormat(generators, args) {
  for (const gen of generators) {
    if (args.generator) {
      // Template listing mode
      for (const template of gen.templates) {
        console.log(template.name);
        if (args.detailed && template.description) {
          console.log(`  ${template.description}`);
        }
        if (args.detailed && template.variables.length > 0) {
          console.log(
            `  Variables: ${template.variables.map((v) => v.name).join(", ")}`
          );
        }
      }
    } else {
      // Generator listing mode
      console.log(gen.name);
      if (args.detailed && gen.description) {
        console.log(`  ${gen.description}`);
      }
      if (args.detailed && gen.templates.length > 0) {
        console.log(
          `  Templates: ${gen.templates.map((t) => t.name).join(", ")}`
        );
      }
    }
  }
}

/**
 * Output in table format
 * @param {GeneratorInfo[]} generators - Generators to output
 * @param {ListCommandArgs} args - Command arguments
 */
function outputTableFormat(generators, args) {
  if (args.generator) {
    // Template listing mode
    const gen = generators[0];
    if (!gen) return;

    const table = new Table({
      head: args.detailed
        ? ["Template", "Description", "Variables", "Outputs"]
        : ["Template", "Description"],
      style: { head: ["cyan"] },
      wordWrap: true,
      colWidths: args.detailed ? [20, 40, 25, 25] : [25, 55],
    });

    for (const template of gen.templates) {
      const row = [
        chalk.green(template.name),
        template.description || chalk.gray("No description"),
      ];

      if (args.detailed) {
        row.push(
          template.variables.length > 0
            ? template.variables
                .map((v) => `${v.name}${v.required ? "*" : ""}`)
                .join(", ")
            : chalk.gray("None"),
          template.outputs && template.outputs.length > 0
            ? template.outputs.join(", ")
            : chalk.gray("Unknown")
        );
      }

      table.push(row);
    }

    if (!args.quiet) {
      console.log();
    }
    console.log(table.toString());

    if (args.detailed && !args.quiet) {
      console.log(chalk.gray("\n* Required variables"));
    }
  } else {
    // Generator listing mode
    const table = new Table({
      head: args.detailed
        ? ["Generator", "Description", "Templates", "Category", "Usage"]
        : ["Generator", "Description", "Templates"],
      style: { head: ["cyan"] },
      wordWrap: true,
      colWidths: args.detailed ? [18, 35, 20, 15, 12] : [25, 45, 30],
    });

    for (const gen of generators) {
      const row = [
        chalk.green(gen.name),
        gen.description || chalk.gray("No description"),
        gen.templates.length > 0
          ? gen.templates.map((t) => t.name).join(", ")
          : chalk.gray("None"),
      ];

      if (args.detailed) {
        row.push(
          gen.category || chalk.gray("None"),
          args.stats && gen.usage
            ? gen.usage?.count?.toString() || '0'
            : chalk.gray("N/A")
        );
      }

      table.push(row);
    }

    if (!args.quiet) {
      console.log();
    }
    console.log(table.toString());
  }
}

/**
 * List command - Display available generators and templates with filtering
 *
 * Features:
 * - List all generators or specific generator templates
 * - Multiple output formats (table, JSON, YAML, simple)
 * - Search and category filtering
 * - Sorting by name, date, or usage statistics
 * - Detailed view with template variables
 * - Usage statistics and metadata
 *
 * @example
 * ```bash
 * # List all generators
 * unjucks list
 *
 * # List templates for specific generator
 * unjucks list component
 *
 * # Search generators
 * unjucks list --search react
 *
 * # JSON output for automation
 * unjucks list --format json
 *
 * # Detailed view with variables
 * unjucks list --detailed
 * ```
 */
export const listCommand = defineCommand({
  meta: {
    name: "list",
    description:
      "List available generators and templates with filtering options",
  },
  args: {
    generator: {
      type: "positional",
      description:
        "Name of specific generator to list templates for (optional)",
      required: false,
    },
    category: {
      type: "string",
      description:
        "Filter by category (e.g., frontend, backend, database, mobile)",
      alias: "c",
    },
    search: {
      type: "string",
      description: "Search generators/templates by name or description",
      alias: "s",
    },
    format: {
      type: "string",
      description: "Output format for results",
      default: "table",
      alias: "f",
    },
    sort: {
      type: "string",
      description: "Sort results by field",
      default: "name",
    },
    direction: {
      type: "string",
      description: "Sort direction (asc/desc)",
      default: "asc",
      alias: "d",
    },
    detailed: {
      type: "boolean",
      description: "Show detailed information including template variables",
      default: false,
      alias: "D",
    },
    stats: {
      type: "boolean",
      description: "Include usage statistics in output",
      default: false,
    },
    quiet: {
      type: "boolean",
      description: "Suppress headers and formatting (useful for scripting)",
      default: false,
      alias: "q",
    },
    verbose: {
      type: "boolean",
      description: "Show verbose output with additional metadata",
      default: false,
      alias: "v",
    },
  },
  async run(context) {
    const { args } = context;
    const startTime = Date.now();

    try {
      // Validate command arguments
      const validationResults = [
        validators.generator(args.generator),
        validators.outputFormat(args.format),
        validators.sortOption(args.sort),
        validators.sortDirection(args.direction),
      ];

      if (!displayValidationResults(validationResults, "list")) {
        throw createCommandError(
          "Invalid arguments provided to list command",
          CommandError.VALIDATION_ERROR,
          [
            "Check valid formats: table, json, yaml, simple",
            "Check valid sort options: name, modified, created, usage",
            "Check valid directions: asc, desc",
          ]
        );
      }

      const generator = new Generator();

      if (!args.quiet) {
        console.log(chalk.blue("📋 Unjucks List"));
        if (args.verbose) {
          console.log(chalk.gray("Arguments:"), args);
        }
      }

      /** @type {GeneratorInfo[]} */
      let generatorsData;

      if (args.generator) {
        // List templates for specific generator
        if (!args.quiet) {
          console.log(
            chalk.cyan(
              `\n🎯 Templates for generator: ${chalk.bold(args.generator)}`
            )
          );
        }

        const templates = await generator.listTemplates(args.generator);
        if (templates.length === 0) {
          throw createCommandError(
            `No templates found for generator: ${args.generator}`,
            CommandError.FILE_NOT_FOUND,
            [
              "Check that the generator name is correct",
              "Use unjucks list to see all available generators",
              `Verify _templates/${args.generator} directory exists`,
            ]
          );
        }

        // Convert template data to generator format for consistent handling
        generatorsData = [
          {
            name: args.generator,
            description: `Templates for ${args.generator}`,
            category: "specified",
            path: `_templates/${args.generator}`,
            templates: templates.map((t) => ({
              name: t.name,
              description: t.description || 'No description available',
              path: t.path || `_templates/${args.generator}/${t.name}`,
              variables: t.variables || [],
              outputs: t.files || [],
              tags: t.tags || [],
              created: t.created,
              modified: t.modified,
            })),
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
          },
        ];
      } else {
        // List all generators
        const generators = await generator.listGenerators();
        if (generators.length === 0) {
          throw createCommandError(
            "No generators found in the project",
            CommandError.FILE_NOT_FOUND,
            [
              "Run 'unjucks init' to set up initial generators",
              "Create a _templates directory with generator subdirectories",
              "Check that template files have proper .njk extensions",
            ]
          );
        }

        if (!args.quiet) {
          console.log(chalk.cyan(`\n📚 Found ${generators.length} generators`));
        }

        // Enhanced generator data with metadata
        generatorsData = await Promise.all(
          generators.map(async (gen) => {
            const templates = await generator.listTemplates(gen.name);
            return {
              name: gen.name,
              description: gen.description || 'No description available',
              category: gen.category || "uncategorized",
              path: gen.path || `_templates/${gen.name}`,
              templates: templates.map((t) => ({
                name: t.name,
                description: t.description || 'No description available',
                path: t.path || `_templates/${gen.name}/${t.name}`,
                variables: t.variables || [],
                outputs: t.files || [],
                tags: t.tags || [],
                created: t.created,
                modified: t.modified,
              })),
              created: gen.created,
              modified: gen.modified,
              usage: gen.usage,
            };
          })
        );
      }

      // Apply filters
      let filteredData = generatorsData;

      if (args.search) {
        const searchTerm = args.search.toLowerCase();
        filteredData = filteredData.filter(
          (gen) =>
            gen.name.toLowerCase().includes(searchTerm) ||
            gen.description?.toLowerCase().includes(searchTerm) ||
            gen.templates.some(
              (t) =>
                t.name.toLowerCase().includes(searchTerm) ||
                t.description?.toLowerCase().includes(searchTerm)
            )
        );

        if (filteredData.length === 0) {
          console.log(
            chalk.yellow(
              `\n⚠️  No generators or templates found matching: "${args.search}"`
            )
          );
          return { success: true, message: "No matches found", files: [] };
        }
      }

      if (args.category) {
        filteredData = filteredData.filter(
          (gen) => gen.category?.toLowerCase() === args.category.toLowerCase()
        );
      }

      // Apply sorting
      filteredData.sort((a, b) => {
        let aValue, bValue;

        switch (args.sort) {
          case "name":
            aValue = a.name;
            bValue = b.name;
            break;
          case "modified":
            aValue = a.modified || new Date(0);
            bValue = b.modified || new Date(0);
            break;
          case "created":
            aValue = a.created || new Date(0);
            bValue = b.created || new Date(0);
            break;
          case "usage":
            aValue = a.usage?.count || 0;
            bValue = b.usage?.count || 0;
            break;
          default:
            aValue = a.name;
            bValue = b.name;
        }

        const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return args.direction === "desc" ? -result : result;
      });

      // Output results in requested format
      await outputResults(filteredData, args);

      const duration = Date.now() - startTime;

      if (!args.quiet && args.verbose) {
        console.log(
          chalk.blue(
            `\n✨ Listed ${filteredData.length} generators in ${duration}ms`
          )
        );
      }

      return {
        success: true,
        message: `Found ${filteredData.length} generators`,
        data: filteredData,
        duration,
      };
    } catch (error) {
      // Handle different error types appropriately
      if (error instanceof UnjucksCommandError) {
        console.error(chalk.red(`\n❌ ${error.message}`));

        if (error.suggestions && error.suggestions.length > 0) {
          console.log(chalk.blue("\n💡 Suggestions:"));
          error.suggestions.forEach((suggestion) => {
            console.log(chalk.blue(`  • ${suggestion}`));
          });
        }

        if (args.verbose && error.details) {
          console.log(chalk.gray("\n🔍 Details:"), error.details);
        }
      } else {
        console.error(chalk.red("\n❌ List command failed:"));
        console.error(
          chalk.red(
            `  ${error instanceof Error ? error.message : String(error)}`
          )
        );

        if (args.verbose && error instanceof Error) {
          console.error(chalk.gray("\n📍 Stack trace:"));
          console.error(chalk.gray(error.stack));
        }

        console.log(chalk.blue("\n💡 Suggestions:"));
        console.log(chalk.blue("  • Check that _templates directory exists"));
        console.log(
          chalk.blue("  • Verify generator and template file structure")
        );
        console.log(chalk.blue("  • Run with --verbose for more details"));
      }

      // Error handled above, continuing without error recovery for now
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        files: []
      };
    }
  },
});