/**
 * Safe List command - Display available generators and templates
 */

import { defineCommand } from "citty";
import chalk from "chalk";
import { SafeGenerator } from "../lib/generator-safe.js";
import Table from "cli-table3";
import yaml from "yaml";

/**
 * Output results in the requested format
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
      }
    } else {
      // Generator listing mode
      console.log(gen.name);
      if (args.detailed && gen.description) {
        console.log(`  ${gen.description}`);
      }
    }
  }
}

/**
 * Output in table format
 */
function outputTableFormat(generators, args) {
  if (args.generator) {
    // Template listing mode
    const gen = generators[0];
    if (!gen) return;

    const table = new Table({
      head: args.detailed
        ? ["Template", "Description", "Variables"]
        : ["Template", "Description"],
      style: { head: ["cyan"] },
      wordWrap: true,
      colWidths: args.detailed ? [20, 40, 25] : [25, 55],
    });

    for (const template of gen.templates) {
      const row = [
        chalk.green(template.name),
        template.description || chalk.gray("No description"),
      ];

      if (args.detailed) {
        row.push(chalk.gray("N/A"));
      }

      table.push(row);
    }

    if (!args.quiet) {
      console.log();
    }
    console.log(table.toString());
  } else {
    // Generator listing mode
    const table = new Table({
      head: args.detailed
        ? ["Generator", "Description", "Templates"]
        : ["Generator", "Description", "Templates"],
      style: { head: ["cyan"] },
      wordWrap: true,
      colWidths: args.detailed ? [25, 40, 30] : [25, 45, 30],
    });

    for (const gen of generators) {
      const row = [
        chalk.green(gen.name),
        gen.description || chalk.gray("No description"),
        gen.templates.length > 0
          ? gen.templates.map((t) => t.name).join(", ")
          : chalk.gray("None"),
      ];

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
      const generator = new SafeGenerator();

      if (!args.quiet) {
        console.log(chalk.blue("📋 Unjucks List"));
        if (args.verbose) {
          console.log(chalk.gray("Arguments:"), args);
        }
      }

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
          console.error(
            chalk.red(`\n❌ No templates found for generator: ${args.generator}`)
          );
          console.log(chalk.blue("\n💡 Suggestions:"));
          console.log(chalk.blue("  • Check that the generator name is correct"));
          console.log(chalk.blue("  • Use unjucks list to see all available generators"));
          console.log(chalk.blue(`  • Verify _templates/${args.generator} directory exists`));
          return { success: false, message: `No templates found for generator: ${args.generator}`, files: [] };
        }

        // Convert template data to generator format for consistent handling
        generatorsData = [
          {
            name: args.generator,
            description: `Templates for ${args.generator}`,
            templates: templates.map((t) => ({
              name: t.name,
              description: t.description || 'No description available',
              variables: [],
              outputs: [],
              tags: [],
            })),
          },
        ];
      } else {
        // List all generators
        const generators = await generator.listGenerators();
        if (generators.length === 0) {
          if (!args.quiet) {
            console.log(chalk.yellow("No generators found"));
          }
          return {
            success: true,
            message: "No generators found",
            data: [],
            duration: Date.now() - startTime,
          };
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
              templates: templates.map((t) => ({
                name: t.name,
                description: t.description || 'No description available',
                variables: [],
                outputs: [],
                tags: [],
              })),
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

      // Apply sorting
      filteredData.sort((a, b) => {
        let aValue, bValue;

        switch (args.sort) {
          case "name":
            aValue = a.name;
            bValue = b.name;
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
      console.error(chalk.red("\n❌ List command failed:"));
      console.error(chalk.red(`  ${error.message}`));

      if (args.verbose && error.stack) {
        console.error(chalk.gray("\n📍 Stack trace:"));
        console.error(chalk.gray(error.stack));
      }

      console.log(chalk.blue("\n💡 Suggestions:"));
      console.log(chalk.blue("  • Check that _templates directory exists"));
      console.log(chalk.blue("  • Verify generator and template file structure"));
      console.log(chalk.blue("  • Run with --verbose for more details"));

      return {
        success: false,
        message: "List command failed",
        error: error.message,
      };
    }
  },
});