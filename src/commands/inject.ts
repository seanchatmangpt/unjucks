import { defineCommand } from "citty";
import chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { FileInjector } from "../lib/file-injector.js";
import { validators, displayValidationResults, createCommandError } from "../lib/command-validation.js";
import type { InjectCommandArgs, CommandResult, CommandError, UnjucksCommandError, InjectionMode } from "../types/commands.js";
import ora from "ora";
import fs from "fs-extra";
import path from "node:path";

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
 * # Insert at specific line
 * unjucks inject --file src/index.ts --content "import { Logger } from './logger';" --mode inject --line 3
 * 
 * # Dry run to preview
 * unjucks inject --file config.js --template config-update --dry
 * 
 * # With backup
 * unjucks inject --file important.json --content '{"newKey": "value"}' --mode replace --backup
 * ```
 */
export const injectCommand = defineCommand<InjectCommandArgs>({
  meta: {
    name: "inject",
    description: "Inject or modify content in existing files with precision control",
  },
  args: {
    file: {
      type: "positional",
      description: "Target file to modify (must exist unless creating new file)",
      required: true,
    },
    content: {
      type: "string",
      description: "Content to inject directly (alternative to --template)",
      alias: "c",
    },
    template: {
      type: "string",
      description: "Template name to render and inject (alternative to --content)",
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
      description: "Target marker/pattern for injection (used with inject/before/after modes)",
      alias: "T",
    },
    line: {
      type: "number",
      description: "Line number for line-based injection (1-indexed)",
      alias: "l",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing content without confirmation",
      default: false,
      alias: "f",
    },
    dry: {
      type: "boolean",
      description: "Preview changes without modifying files",
      default: false,
    },
    backup: {
      type: "boolean",
      description: "Create backup copy before modifying file",
      default: false,
      alias: "b",
    },
    skipIf: {
      type: "string",
      description: "Skip injection if condition is met (e.g., content already exists)",
      alias: "s",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging with detailed progress",
      default: false,
      alias: "v",
    },
    quiet: {
      type: "boolean",
      description: "Suppress non-essential output",
      default: false,
      alias: "q",
    },
  },
  async run({ args }: { args: InjectCommandArgs }) {
    const startTime = Date.now();
    const spinner = ora();
    
    try {
      // Validate command arguments
      const validationResults = [
        validators.path(args.file, { mustExist: true, mustBeFile: true }),
        validators.injectionMode(args.mode),
        validators.lineNumber(args.line),
        validators.required({ content: args.content, template: args.template }, ['content or template']),
      ];

      // Additional validation for template mode
      if (args.template && !args.generator) {
        validationResults.push({
          valid: false,
          errors: ['Generator is required when using template mode'],
          warnings: []
        });
      }

      if (!displayValidationResults(validationResults, 'inject')) {
        throw createCommandError(
          'Invalid arguments provided to inject command',
          CommandError.VALIDATION_ERROR,
          [
            'Specify either --content or --template (with --generator)',
            'Ensure target file exists and is readable',
            'Check injection mode (inject, append, prepend, before, after, replace)',
            'Use valid line number (positive integer) if specified'
          ]
        );
      }

      if (!args.quiet) {
        console.log(chalk.blue('💉 Unjucks Inject'));
        if (args.verbose) {
          console.log(chalk.gray('Arguments:'), args);
        }
      }

      // Resolve file path
      const filePath = path.resolve(args.file);
      
      // Check file exists
      if (!await fs.pathExists(filePath)) {
        throw createCommandError(
          `Target file does not exist: ${filePath}`,
          CommandError.FILE_NOT_FOUND,
          [
            'Check that the file path is correct',
            'Create the file first if it should exist',
            'Use unjucks generate to create new files'
          ]
        );
      }

      // Prepare content to inject
      let contentToInject: string;
      
      if (args.content) {
        contentToInject = args.content;
      } else if (args.template && args.generator) {
        if (!args.quiet) {
          console.log(chalk.cyan(`\\n🎨 Rendering template: ${args.generator}/${args.template}`));
        }
        
        const generator = new Generator();
        
        // Check if template exists
        const templates = await generator.listTemplates(args.generator);
        const templateExists = templates.some(t => t.name === args.template);
        
        if (!templateExists) {
          throw createCommandError(
            `Template not found: ${args.generator}/${args.template}`,
            CommandError.FILE_NOT_FOUND,
            [
              `Use unjucks list ${args.generator} to see available templates`,
              'Check that the template name is spelled correctly',
              'Ensure the generator exists and contains the template'
            ]
          );
        }
        
        // Render template with variables
        const templateResult = await generator.renderTemplate({
          generator: args.generator,
          template: args.template,
          variables: args.vars || {}
        });
        
        contentToInject = templateResult.content;
        
        if (args.verbose) {
          console.log(chalk.gray('Rendered content preview:'));
          console.log(chalk.gray(contentToInject.substring(0, 200) + (contentToInject.length > 200 ? '...' : '')));
        }
      } else {
        throw createCommandError(
          'Either content or template (with generator) must be specified',
          CommandError.VALIDATION_ERROR,
          [
            'Use --content "your content here" for direct injection',
            'Use --template templateName --generator generatorName for template injection',
            'Check available templates with unjucks list'
          ]
        );
      }

      if (!args.quiet) {
        const modeDesc = getModeDescription(args.mode as InjectionMode, args.target, args.line);
        console.log(chalk.green(`\\n🎯 ${modeDesc} in: ${chalk.bold(path.relative(process.cwd(), filePath))}`));
        
        if (args.dry) {
          console.log(chalk.yellow('🔍 Dry run mode - no changes will be made'));
        }
      }

      const message = args.dry ? 'Analyzing injection...' : 'Injecting content...';
      if (!args.quiet) {
        spinner.start(message);
      }

      // Perform injection
      const injector = new FileInjector();
      
      // Create frontmatter config for injection
      const frontmatterConfig: any = {
        inject: args.mode === 'inject',
        append: args.mode === 'append',
        prepend: args.mode === 'prepend',
        before: args.mode === 'before' ? args.target : undefined,
        after: args.mode === 'after' ? args.target : undefined,
        lineAt: args.line,
        skipIf: args.skipIf
      };

      const result = await injector.processFile(
        filePath,
        contentToInject,
        frontmatterConfig,
        {
          force: args.force,
          dry: args.dry,
          backup: args.backup
        }
      );

      if (!args.quiet) {
        spinner.stop();
      }

      // Display results
      const duration = Date.now() - startTime;
      
      if (result.success) {
        if (result.skipped) {
          console.log(chalk.yellow(`\\n⏭️ ${result.message}`));
          console.log(chalk.gray('Content already exists - operation skipped'));
        } else if (args.dry) {
          console.log(chalk.yellow(`\\n🔍 Dry Run Results:`));
          console.log(chalk.cyan(`  ${result.message}`));
          
          if (result.changes.length > 0) {
            console.log(chalk.gray('\\nChanges that would be made:'));
            result.changes.forEach(change => {
              console.log(chalk.blue(`  • ${change}`));
            });
          }
          
          console.log(chalk.blue(`\\n✨ Analysis completed in ${duration}ms`));
          console.log(chalk.gray('Run without --dry to apply the changes'));
        } else {
          console.log(chalk.green(`\\n✅ ${result.message}`));
          
          if (result.changes.length > 0 && args.verbose) {
            console.log(chalk.gray('\\nChanges made:'));
            result.changes.forEach(change => {
              console.log(chalk.green(`  • ${change}`));
            });
          }
          
          if (args.backup) {
            console.log(chalk.blue('💾 Backup created before modification'));
          }
          
          console.log(chalk.green(`\\n🎉 Injection completed in ${duration}ms`));
        }
      } else {
        throw createCommandError(
          result.message,
          CommandError.UNKNOWN_ERROR,
          [
            'Check file permissions and access rights',
            'Verify target markers exist in the file',
            'Ensure line numbers are within file bounds',
            'Use --verbose for more diagnostic information'
          ]
        );
      }

      return {
        success: result.success,
        message: result.message,
        files: result.success && !args.dry ? [filePath] : [],
        duration
      } as CommandResult;

    } catch (error) {
      if (!args.quiet) {
        spinner.stop();
      }
      
      // Handle different error types appropriately
      if (error instanceof UnjucksCommandError) {
        console.error(chalk.red(`\\n❌ ${error.message}`));
        
        if (error.suggestions && error.suggestions.length > 0) {
          console.log(chalk.blue('\\n💡 Suggestions:'));
          error.suggestions.forEach(suggestion => {
            console.log(chalk.blue(`  • ${suggestion}`));
          });
        }
        
        if (args.verbose && error.details) {
          console.log(chalk.gray('\\n🔍 Details:'), error.details);
        }
      } else {
        console.error(chalk.red('\\n❌ Injection failed:'));
        console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
        
        if (args.verbose && error instanceof Error) {
          console.error(chalk.gray('\\n📍 Stack trace:'));
          console.error(chalk.gray(error.stack));
        }
        
        console.log(chalk.blue('\\n💡 Suggestions:'));
        console.log(chalk.blue('  • Check that the target file exists and is writable'));
        console.log(chalk.blue('  • Verify template exists if using template mode'));
        console.log(chalk.blue('  • Use --dry to preview changes before applying'));
        console.log(chalk.blue('  • Run with --verbose for more details'));
      }
      
      process.exit(1);
    }
  },
});

/**
 * Get human-readable description of injection mode
 */
function getModeDescription(mode: InjectionMode, target?: string, line?: number): string {
  switch (mode) {
    case 'append':
      return 'Appending content to end of file';
    case 'prepend':
      return 'Prepending content to beginning of file';
    case 'before':
      return target ? `Inserting content before "${target}"` : 'Inserting content (before mode)';
    case 'after':
      return target ? `Inserting content after "${target}"` : 'Inserting content (after mode)';
    case 'replace':
      return target ? `Replacing content matching "${target}"` : 'Replacing content';
    case 'inject':
      if (line) {
        return `Injecting content at line ${line}`;
      } else if (target) {
        return `Injecting content near "${target}"`;
      } else {
        return 'Injecting content';
      }
    default:
      return 'Modifying file';
  }
}