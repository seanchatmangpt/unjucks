import { defineCommand } from "citty";
import * as chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { FileInjector } from "../lib/file-injector.js";
import {
  validators,
  displayValidationResults,
  createCommandError,
} from "../lib/command-validation.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";
import * as ora from "ora";
import * as fs from "fs-extra";
import * as path from "node:path";

/**
 * @typedef {Object} InjectCommandArgs
 * @property {string} [file] - Target file to inject content into
 * @property {string} [content] - Content to inject directly
 * @property {string} [template] - Template to use for content generation
 * @property {string} [generator] - Generator containing the template
 * @property {string} [mode] - Injection mode
 * @property {string} [target] - Target location in file
 * @property {string} [marker] - Marker for injection point
 * @property {boolean} [backup] - Create backup before injection
 * @property {boolean} [dry] - Preview mode
 * @property {boolean} [force] - Force overwrite
 * @property {boolean} [quiet] - Suppress output
 * @property {boolean} [verbose] - Enable verbose logging
 */

/**
 * @typedef {Object} CommandResult
 * @property {boolean} success - Whether the command succeeded
 * @property {string} message - Result message
 * @property {string[]} files - Array of files processed
 * @property {number} duration - Execution time in milliseconds
 */

/**
 * @typedef {'inject'|'append'|'prepend'|'before'|'after'|'replace'} InjectionMode
 */

/**
 * Inject command - Modify existing files by injecting content
 *
 * Features:
 * - Multiple injection modes (inject, append, prepend, before, after, replace)
 * - Template rendering with variable substitution
 * - Content from direct input or template files
 * - Conditional injection with skipIf expressions
 * - Backup creation before modification
 * - Dry run preview of changes
 * - Idempotent operations (won't duplicate content)
 * - Line-based injection at specific positions
 *
 * @example
 * ```bash
 * # Append content to a file
 * unjucks inject --file src/app.js --content "console.log('injected');" --mode append
 *
 * # Inject using template
 * unjucks inject --file package.json --template dependency --generator node --mode inject --target "dependencies"
 *
 * # Inject before specific content
 * unjucks inject --file src/router.js --content "// New route" --mode before --target "module.exports"
 *
 * # Dry run to preview changes
 * unjucks inject --file src/config.js --template config --dry
 * ```
 */
export const injectCommand = defineCommand({
  meta: {
    name: "inject",
    description: "Inject or modify content in existing files with intelligent targeting",
  },
  args: {
    file: {
      type: "string",
      description: "Target file to inject content into",
      required: true,
      alias: "f",
    },
    content: {
      type: "string",
      description: "Content to inject directly (alternative to template)",
      alias: "c",
    },
    template: {
      type: "string",
      description: "Template to use for content generation",
      alias: "t",
    },
    generator: {
      type: "string",
      description: "Generator containing the template (required with --template)",
      alias: "g",
    },
    mode: {
      type: "string",
      description: "Injection mode: inject, append, prepend, before, after, replace",
      default: "inject",
      alias: "m",
    },
    target: {
      type: "string",
      description: "Target location in file (e.g., line number, search string, or CSS selector)",
      alias: "at",
    },
    marker: {
      type: "string",
      description: "Unique marker for injection point (for idempotent operations)",
    },
    backup: {
      type: "boolean",
      description: "Create backup copy before modification",
      default: false,
    },
    dry: {
      type: "boolean",
      description: "Preview mode - show what would be injected without modifying files",
      default: false,
    },
    force: {
      type: "boolean",
      description: "Force injection even if target location is not found",
      default: false,
    },
    quiet: {
      type: "boolean",
      description: "Suppress non-essential output",
      default: false,
      alias: "q",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging with detailed information",
      default: false,
      alias: "v",
    },
  },
  /**
   * Main execution handler for the inject command
   * @param {Object} context - Command context
   * @param {InjectCommandArgs} context.args - Parsed command arguments
   * @returns {Promise<CommandResult>} Command execution result
   */
  async run(context) {
    const { args } = context;
    const startTime = Date.now();
    const spinner = ora();

    try {
      // Validate command arguments
      const validationResults = [
        validators.file(args.file),
        validators.content(args.content, { required: !args.template }),
        validators.template(args.template, { required: !args.content }),
        validators.generator(args.generator, { required: !!args.template }),
        validators.injectionMode(args.mode),
        validators.target(args.target, { required: args.mode !== 'append' && args.mode !== 'prepend' }),
      ];

      if (!displayValidationResults(validationResults, "inject")) {
        throw createCommandError(
          "Invalid arguments provided to inject command",
          CommandError.VALIDATION_ERROR,
          [
            "Either --content or --template (with --generator) is required",
            "Valid injection modes: inject, append, prepend, before, after, replace", 
            "Target file must exist and be readable",
            "Target location is required for inject, before, after, and replace modes",
          ]
        );
      }

      if (!args.quiet) {
        console.log(chalk.blue("💉 Unjucks Inject"));
        if (args.verbose) {
          console.log(chalk.gray("Arguments:"), args);
        }
      }

      // Check if target file exists
      const filePath = path.resolve(args.file);
      if (!await fs.pathExists(filePath)) {
        throw createCommandError(
          `Target file not found: ${args.file}`,
          CommandError.FILE_NOT_FOUND,
          [
            "Check that the file path is correct",
            "Create the file first if it doesn't exist",
            "Use relative or absolute path syntax correctly",
          ]
        );
      }

      // Resolve content to inject
      let contentToInject = args.content;
      
      if (args.template) {
        if (!args.quiet) {
          spinner.start("Generating content from template...");
        }

        const generator = new Generator();
        
        // Extract flag variables for template rendering
        const templateVariables = {};
        for (const [key, value] of Object.entries(args)) {
          if (!['file', 'template', 'generator', 'mode', 'target', 'marker', 'backup', 'dry', 'force', 'quiet', 'verbose'].includes(key)) {
            templateVariables[key] = value;
          }
        }

        try {
          const result = await generator.generate({
            generator: args.generator,
            template: args.template,
            dest: path.dirname(filePath),
            dry: true, // Always dry run for templates to get content
            variables: templateVariables,
          });

          if (result.files && result.files.length > 0) {
            // Use content from the first generated file
            contentToInject = result.files[0].content;
          } else {
            throw new Error("Template generated no content");
          }
        } catch (error) {
          throw createCommandError(
            `Failed to generate content from template: ${error.message}`,
            CommandError.TEMPLATE_ERROR,
            [
              `Check that generator '${args.generator}' exists`,
              `Check that template '${args.template}' exists`,
              "Verify template syntax and variables",
              "Use 'unjucks list' to see available templates",
            ]
          );
        }

        if (!args.quiet) {
          spinner.stop();
        }
      }

      if (!contentToInject) {
        throw createCommandError(
          "No content to inject",
          CommandError.VALIDATION_ERROR,
          [
            "Provide content with --content flag",
            "Or use --template and --generator to generate content",
            "Check that template produces valid output",
          ]
        );
      }

      // Perform injection
      const injector = new FileInjector();
      
      if (!args.quiet) {
        const message = args.dry 
          ? "Previewing injection..."
          : `Injecting content (${args.mode} mode)...`;
        spinner.start(message);
      }

      const injectionOptions = {
        mode: args.mode,
        target: args.target,
        marker: args.marker,
        backup: args.backup,
        force: args.force,
        dry: args.dry,
      };

      const result = await injector.inject(filePath, contentToInject, injectionOptions);

      if (!args.quiet) {
        spinner.stop();
      }

      const duration = Date.now() - startTime;

      // Display results
      if (args.dry) {
        if (!args.quiet) {
          console.log(chalk.yellow("\n🔍 Dry Run Results - No files were modified"));
          console.log(chalk.gray("Content that would be injected:"));
          console.log(chalk.cyan(contentToInject));
          
          if (result.preview) {
            console.log(chalk.gray("\nPreview of changes:"));
            console.log(chalk.white(result.preview));
          }
          
          if (result.warnings && result.warnings.length > 0) {
            console.log(chalk.yellow("\n⚠️ Warnings:"));
            result.warnings.forEach((warning) => {
              console.log(chalk.yellow(`  • ${warning}`));
            });
          }
        }

        console.log(chalk.blue(`\n✨ Preview completed in ${duration}ms`));
        console.log(chalk.gray("Run without --dry to apply the changes"));
      } else {
        if (!args.quiet) {
          if (result.success) {
            console.log(chalk.green(`\n✅ Content injected successfully`));
            console.log(chalk.gray(`Mode: ${args.mode}`));
            console.log(chalk.gray(`File: ${args.file}`));
            
            if (args.target) {
              console.log(chalk.gray(`Target: ${args.target}`));
            }
            
            if (result.backup) {
              console.log(chalk.gray(`Backup: ${result.backup}`));
            }
          } else {
            console.log(chalk.yellow(`\n⚠️ Injection completed with warnings`));
          }
          
          if (result.warnings && result.warnings.length > 0) {
            console.log(chalk.yellow("\n⚠️ Warnings:"));
            result.warnings.forEach((warning) => {
              console.log(chalk.yellow(`  • ${warning}`));
            });
          }

          if (args.verbose && result.changes) {
            console.log(chalk.blue("\n📝 Changes made:"));
            result.changes.forEach((change) => {
              console.log(chalk.gray(`  ${change}`));
            });
          }
        }

        console.log(chalk.green(`\n🎉 Injection completed in ${duration}ms`));

        // Show next steps
        if (!args.quiet && result.success) {
          console.log(chalk.blue("\n📝 Next steps:"));
          console.log(chalk.gray("  1. Review the modified file"));
          console.log(chalk.gray("  2. Test your changes"));
          if (result.backup) {
            console.log(chalk.gray("  3. Remove backup file when satisfied"));
          }
        }
      }

      return {
        success: result.success || false,
        message: args.dry 
          ? "Dry run completed" 
          : "Content injected successfully",
        files: [args.file],
        duration,
      };

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
        console.error(chalk.red("\n❌ Injection failed:"));
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
        console.log(chalk.blue("  • Check that the target file exists and is writable"));
        console.log(chalk.blue("  • Verify injection mode and target location"));
        console.log(chalk.blue("  • Use --dry to preview changes first"));
        console.log(chalk.blue("  • Run with --verbose for more details"));
      }

      // Use error recovery
      const { errorRecovery } = await import("../lib/error-recovery.js");
      errorRecovery.handleError({
        command: "inject",
        args: Object.keys(args),
        error: error,
        context: "inject"
      }, { verbose: args.verbose, showSuggestions: true, showNextSteps: true });
    }
  },
});