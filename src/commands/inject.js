import { defineCommand } from "citty";
import chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { FileInjectorOrchestrator } from "../lib/file-injector/file-injector-orchestrator.js";
import {
  validators,
  displayValidationResults,
  createCommandError,
} from "../lib/command-validation.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";
import ora from "ora";
import fs from "fs-extra";
import path from "node:path";

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
      description: "Injection mode: before, after, append, prepend, lineAt",
      default: "after",
      alias: "m",
    },
    line: {
      type: "number",
      description: "Line number for lineAt injection mode",
    },
    name: {
      type: "string",
      description: "Name variable for template rendering",
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

      // Resolve content to inject and build frontmatter configuration
      let contentToInject = args.content;
      let frontmatterConfig = {};
      
      if (args.template) {
        if (!args.quiet) {
          spinner.start("Generating content from template...");
        }

        const generator = new Generator();
        
        // Extract flag variables for template rendering
        const templateVariables = {};
        for (const [key, value] of Object.entries(args)) {
          if (!['file', 'template', 'generator', 'mode', 'target', 'marker', 'backup', 'dry', 'force', 'quiet', 'verbose', 'line'].includes(key)) {
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
            const generatedFile = result.files[0];
            contentToInject = generatedFile.content;
            
            // Extract frontmatter from generated template if available
            if (generatedFile.frontmatter) {
              frontmatterConfig = { ...generatedFile.frontmatter };
            }
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

      // Build frontmatter configuration from CLI arguments
      if (args.mode === 'before' && (args.target || args.marker)) {
        frontmatterConfig.inject = true;
        frontmatterConfig.before = args.target || args.marker;
      } else if (args.mode === 'after' && (args.target || args.marker)) {
        frontmatterConfig.inject = true;
        frontmatterConfig.after = args.target || args.marker;
      } else if (args.mode === 'append') {
        frontmatterConfig.append = true;
      } else if (args.mode === 'prepend') {
        frontmatterConfig.prepend = true;
      } else if (args.mode === 'lineAt' && args.line !== undefined) {
        frontmatterConfig.lineAt = args.line;
      } else if (args.mode === 'lineAt' && args.target) {
        // Support line number as target
        const lineNum = parseInt(args.target, 10);
        if (!isNaN(lineNum)) {
          frontmatterConfig.lineAt = lineNum;
        }
      }

      // Add skipIf condition for idempotent operations
      if (!args.force) {
        frontmatterConfig.skipIf = `content.includes('${contentToInject.trim().replace(/'/g, "\\'")}')`;
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

      // Perform injection using FileInjectorOrchestrator
      const orchestrator = new FileInjectorOrchestrator();
      
      if (!args.quiet) {
        const message = args.dry 
          ? "Previewing injection..."
          : `Injecting content (${args.mode} mode)...`;
        spinner.start(message);
      }

      const injectionOptions = {
        force: args.force,
        dry: args.dry,
        backup: args.backup,
      };

      const result = await orchestrator.processFile(filePath, contentToInject, frontmatterConfig, injectionOptions);
      
      // Handle chmod if specified in frontmatter
      if (result.success && frontmatterConfig.chmod && !args.dry) {
        const chmodSuccess = await orchestrator.setPermissions(filePath, frontmatterConfig.chmod);
        if (!chmodSuccess && !args.quiet) {
          console.warn(chalk.yellow(`⚠️ Warning: Failed to set permissions ${frontmatterConfig.chmod} on ${filePath}`));
        }
      }
      
      // Execute shell commands if specified in frontmatter
      if (result.success && frontmatterConfig.sh && !args.dry) {
        const commandResult = await orchestrator.executeCommands(
          Array.isArray(frontmatterConfig.sh) ? frontmatterConfig.sh : [frontmatterConfig.sh],
          path.dirname(filePath)
        );
        
        if (!args.quiet) {
          if (commandResult.success) {
            console.log(chalk.blue(`📋 Command executed: ${frontmatterConfig.sh}`));
            if (commandResult.stdout) {
              console.log(chalk.gray(commandResult.stdout));
            }
          } else {
            console.warn(chalk.yellow(`⚠️ Command failed: ${commandResult.message}`));
            if (commandResult.stderr) {
              console.error(chalk.red(commandResult.stderr));
            }
          }
        }
      }

      if (!args.quiet) {
        spinner.stop();
      }

      const duration = Date.now() - startTime;

      // Display results
      if (args.dry) {
        if (!args.quiet) {
          console.log(chalk.yellow("\n🔍 Dry Run Results - No files were modified"));
          console.log(chalk.blue(`Would inject:`));
          console.log(chalk.cyan(contentToInject));
          
          console.log(chalk.blue(`\nMode: ${args.mode}`));
          if (args.target || args.marker) {
            console.log(chalk.blue(`Target: ${args.target || args.marker}`));
          }
          if (args.line !== undefined) {
            console.log(chalk.blue(`Line: ${args.line}`));
          }
          
          if (result.preview) {
            console.log(chalk.gray("\nPreview of changes:"));
            console.log(chalk.white(result.preview));
          }
        }

        console.log(chalk.blue(`\n✨ Preview completed in ${duration}ms`));
        console.log(chalk.gray("Run without --dry to apply the changes"));
      } else {
        if (!args.quiet) {
          if (result.success && !result.skipped) {
            console.log(chalk.green(`\n✅ Content injected successfully`));
            console.log(chalk.gray(`Mode: ${args.mode}`));
            console.log(chalk.gray(`File: ${args.file}`));
            
            if (args.target || args.marker) {
              console.log(chalk.gray(`Target: ${args.target || args.marker}`));
            }
            if (args.line !== undefined) {
              console.log(chalk.gray(`Line: ${args.line}`));
            }
            
            if (result.backupPath) {
              console.log(chalk.gray(`Backup: ${result.backupPath}`));
            }
          } else if (result.skipped) {
            console.log(chalk.yellow(`\n⚠️ Content already exists, skipping`));
            console.log(chalk.gray(result.message));
          } else if (args.force) {
            console.log(chalk.yellow(`\n⚡ Forcing injection`));
            console.log(chalk.gray(result.message));
          } else {
            console.log(chalk.red(`\n❌ Injection failed`));
            console.log(chalk.gray(result.message));
          }

          if (args.verbose && result.changes && result.changes.length > 0) {
            console.log(chalk.blue("\n📝 Changes made:"));
            result.changes.forEach((change) => {
              console.log(chalk.gray(`  ${change}`));
            });
          }
        }

        if (result.success && !result.skipped) {
          console.log(chalk.green(`\n🎉 Injection completed in ${duration}ms`));

          // Show next steps
          if (!args.quiet) {
            console.log(chalk.blue("\n📝 Next steps:"));
            console.log(chalk.gray("  1. Review the modified file"));
            console.log(chalk.gray("  2. Test your changes"));
            if (result.backupPath) {
              console.log(chalk.gray("  3. Remove backup file when satisfied"));
            }
          }
        }
      }

      return {
        success: result.success || false,
        message: args.dry 
          ? "Dry run completed" 
          : result.skipped 
            ? "Content already exists, skipped"
            : result.success
              ? "Content injected successfully"
              : "Injection failed",
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