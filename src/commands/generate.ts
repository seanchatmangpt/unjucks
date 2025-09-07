import { defineCommand } from "citty";
import * as chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { promptForGenerator, promptForTemplate } from "../lib/prompts.js";
import { HygenPositionalParser } from "../lib/HygenPositionalParser.js";
import {
  validators,
  displayValidationResults,
  createCommandError,
} from "../lib/command-validation.js";
import type {
  GenerateCommandArgs,
  CommandResult,
} from "../types/commands.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";
import * as ora from "ora";
import type {
  CLICommand,
  CLICommandArgs,
  CLICommandResult,
  GenerateOptions,
  ValidationResult,
  UnjucksError,
  TemplateVariable
} from "../types/unified-types.js";

// Helper functions for positional parameter processing
function fallbackPositionalParsing(args: string[]): Record<string, any> {
  const variables: Record<string, any> = {};

  if (args.length > 2) {
    const [, , ...additionalArgs] = args;

    // First additional arg is typically the 'name'
    if (additionalArgs.length > 0 && !additionalArgs[0].startsWith("-")) {
      variables.name = additionalArgs[0];
    }

    // Handle remaining positional args
    additionalArgs.slice(1).forEach((arg: string, index: number) => {
      if (!arg.startsWith("-")) {
        const key = `arg${index + 2}`;
        variables[key] = inferArgumentType(arg);
      }
    });
  }

  return variables;
}

function inferArgumentType(arg: string): any {
  // Smart type inference for positional args
  if (arg === "true" || arg === "false") {
    return arg === "true";
  } else if (!isNaN(Number(arg))) {
    return Number(arg);
  } else {
    return arg;
  }
}

function extractFlagVariables(args: any): Record<string, any> {
  const flagVars: Record<string, any> = {};
  const excludedKeys = [
    "generator",
    "template",
    "name",
    "dest",
    "force",
    "dry",
  ];

  for (const [key, value] of Object.entries(args)) {
    if (!excludedKeys.includes(key)) {
      flagVars[key] = value;
    }
  }

  return flagVars;
}

/**
 * Generate command - Creates files from templates with comprehensive validation
 *
 * Features:
 * - Interactive generator and template selection
 * - Intelligent positional argument parsing
 * - Dry run support with detailed preview
 * - Force overwrite with confirmation
 * - Template variable validation
 * - Backup creation for existing files
 * - Comprehensive error handling
 *
 * @example
 * ```bash
 * # Interactive mode
 * unjucks generate
 *
 * # Direct generation
 * unjucks generate component react MyButton --withTests --dest src/components
 *
 * # Dry run to preview
 * unjucks generate api express UserService --dry
 *
 * # Force overwrite with backup
 * unjucks generate model sequelize User --force --backup
 * ```
 */
export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate files from templates with intelligent scaffolding",
  },
  args: {
    generator: {
      type: "positional",
      description: "Name of the generator to use (e.g., component, api, model)",
      required: false,
    },
    template: {
      type: "positional",
      description:
        "Name of the template within the generator (e.g., react, express, sequelize)",
      required: false,
    },
    name: {
      type: "positional",
      description:
        "Name/identifier for the generated entity (e.g., UserButton, UserService)",
      required: false,
    },
    dest: {
      type: "string",
      description:
        "Destination directory for generated files (relative or absolute path)",
      default: ".",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing files without confirmation prompts",
      default: false,
    },
    dry: {
      type: "boolean",
      description:
        "Preview mode - show what would be generated without creating files",
      default: false,
    },
    backup: {
      type: "boolean",
      description: "Create backup copies of existing files before overwriting",
      default: false,
    },
    skipPrompts: {
      type: "boolean",
      description:
        "Skip interactive prompts and use defaults or fail if required values missing",
      default: false,
      alias: "y",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging with detailed progress information",
      default: false,
      alias: "v",
    },
    quiet: {
      type: "boolean",
      description: "Suppress non-essential output (opposite of verbose)",
      default: false,
      alias: "q",
    },
  },
  async run(context: any) {
    const { args } = context;
    const startTime = Date.now();
    const spinner = ora();

    try {
      // Validate command arguments
      const validationResults = [
        validators.generator(args.generator),
        validators.template(args.template),
        validators.path(args.dest, { allowCreate: true }),
        validators.variables(extractFlagVariables(args)),
      ];

      if (!displayValidationResults(validationResults, "generate")) {
        throw createCommandError(
          "Invalid arguments provided to generate command",
          CommandError.VALIDATION_ERROR,
          [
            "Check the command usage: unjucks generate --help",
            "Use unjucks list to see available generators",
            "Ensure destination path is valid and writable",
          ]
        );
      }
      const generator = new Generator();
      let generatorName = args.generator;
      let templateName = args.template;

      if (!args.quiet) {
        console.log(chalk.blue("🎯 Unjucks Generate"));
        if (args.verbose) {
          console.log(chalk.gray("Arguments:"), args);
        }
      }

      // Initialize enhanced positional parser
      const hygenParser = new HygenPositionalParser({
        enableTypeInference: true,
        enableSpecialPatterns: true,
        maxPositionalArgs: 10,
        strictMode: false,
      });

      let templateVariables: Record<string, any> = {};

      // Check for stored original positional args from CLI preprocessing
      const originalPositionalArgs = process.env.UNJUCKS_POSITIONAL_ARGS
        ? JSON.parse(process.env.UNJUCKS_POSITIONAL_ARGS)
        : [];

      // Use enhanced Hygen parser if we have positional args
      if (originalPositionalArgs.length >= 2) {
        try {
          // Get template variables for intelligent mapping
          const { variables: templateVars } =
            await generator.scanTemplateForVariables(
              generatorName || originalPositionalArgs[0],
              templateName || originalPositionalArgs[1]
            );

          // Parse with enhanced Hygen parser
          const parseResult = hygenParser.parse(
            originalPositionalArgs,
            templateVars
          );
          templateVariables = parseResult.variables;

          // Validate the result
          const validation = hygenParser.validate(parseResult, templateVars);
          if (!validation.valid) {
            console.warn(chalk.yellow("Positional parameter warnings:"));
            validation.errors.forEach((error) => {
              console.warn(chalk.yellow(`  ⚠ ${error}`));
            });
          }
        } catch (error) {
          // Fallback to basic parsing if enhanced parser fails
          console.warn(chalk.yellow("Using fallback positional parsing"));
          templateVariables = fallbackPositionalParsing(originalPositionalArgs);
        }
      }

      // Also check direct arguments from Citty for backward compatibility
      if (args.name && !templateVariables.name) {
        templateVariables.name = args.name;
      }

      // Interactive mode if no generator/template specified
      if (!generatorName) {
        if (args.skipPrompts) {
          throw createCommandError(
            "Generator name required when using --skip-prompts",
            CommandError.VALIDATION_ERROR,
            [
              "Specify a generator: unjucks generate <generator> <template>",
              "Use unjucks list to see available generators",
              "Remove --skip-prompts to use interactive mode",
            ]
          );
        }

        const availableGenerators = await generator.listGenerators();
        if (availableGenerators.length === 0) {
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
          console.log(
            chalk.cyan(`\n📋 Found ${availableGenerators.length} generators`)
          );
        }

        const selected = await promptForGenerator(availableGenerators);
        generatorName = selected.generator;
        templateName = selected.template;
      }

      if (!templateName) {
        if (args.skipPrompts) {
          throw createCommandError(
            "Template name required when using --skip-prompts",
            CommandError.VALIDATION_ERROR,
            [
              "Specify a template: unjucks generate <generator> <template>",
              `Use unjucks list ${generatorName} to see available templates`,
              "Remove --skip-prompts to use interactive mode",
            ]
          );
        }

        const templates = await generator.listTemplates(generatorName);
        if (templates.length === 0) {
          throw createCommandError(
            `No templates found in generator: ${generatorName}`,
            CommandError.FILE_NOT_FOUND,
            [
              `Check that _templates/${generatorName} directory exists`,
              "Ensure template files have .njk extensions and proper frontmatter",
              "Use unjucks list to see all available generators",
            ]
          );
        }

        const selected = await promptForTemplate(templates);
        templateName = selected;
      }

      // Show what we're about to generate
      if (!args.quiet) {
        console.log(
          chalk.green(`\n🚀 Generating ${generatorName}/${templateName}`)
        );
        if (args.verbose) {
          console.log(chalk.gray("Template variables:"), {
            ...extractFlagVariables(args),
            ...templateVariables,
          });
        }
      }

      const message = args.dry
        ? "Analyzing templates..."
        : "Generating files...";

      if (!args.quiet) {
        spinner.start(message);
      }

      const result = await generator.generate({
        generator: generatorName,
        template: templateName,
        dest: args.dest,
        force: args.force,
        dry: args.dry,
        variables: {
          ...extractFlagVariables(args), // Flag-based variables first
          ...templateVariables, // Positional args override flags (higher precedence)
        },
      });

      if (!args.quiet) {
        spinner.stop();
      }

      // Display results
      const duration = Date.now() - startTime;

      if (args.dry) {
        if (!args.quiet) {
          console.log(
            chalk.yellow("\n🔍 Dry Run Results - No files were created")
          );
          console.log(
            chalk.gray(
              `Files that would be generated (${result.files.length}):`
            )
          );
          result.files.forEach((file: any) => {
            const action = file.exists
              ? args.force
                ? "overwrite"
                : "skip"
              : "create";
            const color =
              action === "overwrite"
                ? "red"
                : action === "skip"
                ? "yellow"
                : "green";
            const symbol =
              action === "overwrite" ? "⚠" : action === "skip" ? "⏭" : "+";
            console.log(chalk[color](`  ${symbol} ${file.path} (${action})`));
          });

          if (result.warnings && Array.isArray(result.warnings) && result.warnings.length > 0) {
            console.log(chalk.yellow("\n⚠️ Warnings:"));
            result.warnings.forEach((warning: string) => {
              console.log(chalk.yellow(`  • ${warning}`));
            });
          }
        }

        console.log(chalk.blue(`\n✨ Analysis completed in ${duration}ms`));
        console.log(chalk.gray("Run without --dry to generate the files"));
      } else {
        if (!args.quiet) {
          console.log(
            chalk.green(
              `\n✅ Successfully generated ${result.files.length} files`
            )
          );

          if (args.verbose) {
            result.files.forEach((file: any) => {
              console.log(
                chalk.green(
                  `  + ${file.path} (${file.size || "unknown"} bytes)`
                )
              );
            });
          } else {
            // Group files by directory for cleaner output
            const filesByDir = result.files.reduce(
              (acc: Record<string, string[]>, file: any) => {
                const dir = file.path.includes("/")
                  ? file.path.split("/").slice(0, -1).join("/")
                  : ".";
                if (!acc[dir]) acc[dir] = [];
                acc[dir].push(file.path.split("/").pop());
                return acc;
              },
              {}
            );

            Object.entries(filesByDir).forEach(([dir, files]) => {
              console.log(chalk.cyan(`  📁 ${dir}/`));
              files.forEach((file) => {
                console.log(chalk.green(`    + ${file}`));
              });
            });
          }

          if (result.warnings && Array.isArray(result.warnings) && result.warnings.length > 0) {
            console.log(chalk.yellow("\n⚠️ Warnings:"));
            result.warnings.forEach((warning: string) => {
              console.log(chalk.yellow(`  • ${warning}`));
            });
          }
        }

        console.log(chalk.green(`\n🎉 Generation completed in ${duration}ms`));

        // Show next steps
        if (!args.quiet && result.files.length > 0) {
          console.log(chalk.blue("\n📝 Next steps:"));
          console.log(chalk.gray("  1. Review the generated files"));
          console.log(chalk.gray("  2. Customize the code as needed"));
          console.log(chalk.gray("  3. Run tests to ensure everything works"));
        }
      }

      // Clean up environment variable after processing
      if (process.env.UNJUCKS_POSITIONAL_ARGS) {
        delete process.env.UNJUCKS_POSITIONAL_ARGS;
      }

      return {
        success: true,
        message: args.dry
          ? "Dry run completed"
          : "Files generated successfully",
        files: result.files.map((f: any) => f.path),
        duration,
      } as CommandResult;
    } catch (error) {
      if (!args.quiet) {
        spinner.stop();
      }

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
        console.error(chalk.red("\n❌ Generation failed:"));
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
        console.log(chalk.blue("  • Check that templates exist and are valid"));
        console.log(chalk.blue("  • Verify destination directory permissions"));
        console.log(chalk.blue("  • Run with --verbose for more details"));
        console.log(
          chalk.blue("  • Use --dry to preview without making changes")
        );
      }

      // Use error recovery instead of abrupt exit
      const { errorRecovery } = await import("../lib/error-recovery.js");
      errorRecovery.handleError({
        command: "generate",
        args: Object.keys(args),
        error: error,
        context: "generate"
      }, { verbose: args.verbose, showSuggestions: true, showNextSteps: true });
    }
  },
});
