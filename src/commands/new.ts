import { defineCommand } from "citty";
import * as chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { promptForGenerator, promptForTemplate } from "../lib/prompts.js";
import { cliParser } from "../lib/cli-parser.js";
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

/**
 * New command - Primary unified command for creating files from templates
 * 
 * This is the main entry point that replaces the cognitive overload of dual syntax.
 * Uses clear intent with "new" verb and supports both quick generation and interactive mode.
 * 
 * Features:
 * - Single clear syntax: unjucks new <template> [name]
 * - Interactive template selection when no arguments provided
 * - Intelligent template discovery and suggestion
 * - Error recovery with helpful guidance
 * - Backward compatibility warnings for old syntax
 * 
 * @example
 * ```bash
 * # Interactive mode - discover what's available
 * unjucks new
 * 
 * # Quick generation - clear and simple
 * unjucks new component MyButton
 * unjucks new api UserService
 * unjucks new page AboutPage
 * 
 * # With options - flexible configuration
 * unjucks new component MyButton --withTests --dest src/components
 * unjucks new api UserService --template graphql --withAuth
 * ```
 */
export const newCommand = defineCommand({
  meta: {
    name: "new",
    description: "Create new files from templates with intelligent scaffolding",
  },
  args: {
    template: {
      type: "positional",
      description: "Template to use (e.g., component, api, model)",
      required: false,
    },
    name: {
      type: "positional", 
      description: "Name for the generated entity (e.g., MyButton, UserService)",
      required: false,
    },
    dest: {
      type: "string",
      description: "Destination directory (default: current directory)",
      default: ".",
    },
    template_variant: {
      type: "string",
      description: "Specific template variant (e.g., react, vue, angular)",
      alias: "template",
    },
    force: {
      type: "boolean", 
      description: "Overwrite existing files",
      default: false,
    },
    interactive: {
      type: "boolean",
      description: "Force interactive mode even with arguments",
      default: false,
      alias: "i",
    },
    verbose: {
      type: "boolean",
      description: "Show detailed progress information",
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
  async run(context: any) {
    const { args } = context;
    const startTime = Date.now();
    const spinner = ora();

    try {
      if (!args.quiet) {
        console.log(chalk.blue("🚀 Unjucks New"));
        console.log(chalk.gray("   Primary command for creating files from templates"));
      }

      const generator = new Generator();
      let templateChoice = args.template;
      let entityName = args.name;

      // Interactive mode: No arguments or explicit --interactive
      if (!templateChoice || args.interactive) {
        if (!args.quiet) {
          console.log(chalk.cyan("\n✨ Interactive Mode"));
          console.log(chalk.gray("   Let's find the perfect template for you"));
        }

        const availableGenerators = await generator.listGenerators();
        
        if (availableGenerators.length === 0) {
          const errorMessage = "No templates found in your project";
          const suggestions = [
            "Run 'unjucks init' to set up initial templates",
            "Create a _templates directory with template subdirectories", 
            "Check that template files have .ejs or .njk extensions",
            "Visit our docs for template creation guide"
          ];

          console.error(chalk.red(`\n❌ ${errorMessage}`));
          console.log(chalk.blue("\n💡 Quick fixes:"));
          suggestions.forEach(suggestion => {
            console.log(chalk.blue(`  • ${suggestion}`));
          });
          
          return {
            success: false,
            message: errorMessage,
            suggestions,
            files: []
          };
        }

        if (!args.quiet) {
          console.log(chalk.cyan(`\n📋 Found ${availableGenerators.length} template types`));
        }

        // Interactive selection with enhanced UX
        const selected = await promptForGenerator(availableGenerators, {
          message: "What would you like to create?",
          filter: templateChoice, // Pre-filter if partial template provided
        });
        
        templateChoice = selected.generator;
        
        // If multiple templates available, let user choose specific variant
        if (selected.template && selected.templates && selected.templates.length > 1) {
          const templateSelected = await promptForTemplate(selected.templates, {
            message: `Which ${templateChoice} template?`,
          });
          templateChoice = `${templateChoice}/${templateSelected}`;
        } else if (selected.template) {
          templateChoice = `${templateChoice}/${selected.template}`;
        }

        // Prompt for name if not provided
        if (!entityName && !args.quiet) {
          const { default: inquirer } = await import("inquirer");
          const answers = await inquirer.prompt([{
            type: "input",
            name: "name",
            message: `Name for your ${templateChoice}:`,
            validate: (input: string) => {
              if (!input.trim()) {
                return "Name is required";
              }
              if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(input)) {
                return "Name must start with a letter and contain only letters, numbers, underscores, and hyphens";
              }
              return true;
            }
          }]);
          entityName = answers.name;
        }
      }

      // Validate we have what we need
      if (!templateChoice) {
        const errorMessage = "Template is required";
        const suggestions = [
          "Run 'unjucks new' for interactive mode",
          "Specify a template: unjucks new component MyButton", 
          "Use 'unjucks list' to see available templates",
          "Get help: unjucks help new"
        ];

        console.error(chalk.red(`\n❌ ${errorMessage}`));
        console.log(chalk.blue("\n💡 Quick fixes:"));
        suggestions.forEach(suggestion => {
          console.log(chalk.blue(`  • ${suggestion}`));
        });

        return {
          success: false,
          message: errorMessage,
          suggestions,
          files: []
        };
      }

      if (!entityName) {
        const errorMessage = "Name is required for generation";
        const suggestions = [
          "Provide a name: unjucks new component MyButton",
          "Use interactive mode: unjucks new",
          "Check help: unjucks help new"
        ];

        console.error(chalk.red(`\n❌ ${errorMessage}`));
        console.log(chalk.blue("\n💡 Quick fixes:"));
        suggestions.forEach(suggestion => {
          console.log(chalk.blue(`  • ${suggestion}`));
        });

        return {
          success: false, 
          message: errorMessage,
          suggestions,
          files: []
        };
      }

      // Parse template choice (handle both "component" and "component/react" formats)
      const [generatorName, templateName] = templateChoice.includes('/') 
        ? templateChoice.split('/') 
        : [templateChoice, args.template_variant];

      if (!args.quiet) {
        console.log(chalk.green(`\n🎯 Creating ${generatorName}${templateName ? `/${templateName}` : ''}`));
        console.log(chalk.gray(`   Name: ${entityName}`));
        console.log(chalk.gray(`   Destination: ${args.dest}`));
        
        if (args.verbose) {
          console.log(chalk.gray("   Arguments:"), { 
            generator: generatorName, 
            template: templateName,
            name: entityName,
            ...args 
          });
        }
      }

      if (!args.quiet) {
        spinner.start("Generating files...");
      }

      // Use the existing generator logic
      const result = await generator.generate({
        generator: generatorName,
        template: templateName || generatorName,
        dest: args.dest,
        force: args.force,
        dry: false,
        variables: {
          name: entityName,
          // Extract additional variables from CLI flags
          ...Object.fromEntries(
            Object.entries(args).filter(([key]) => 
              !['template', 'name', 'dest', 'force', 'interactive', 'verbose', 'quiet', 'template_variant'].includes(key)
            )
          )
        },
      });

      if (!args.quiet) {
        spinner.stop();
      }

      // Success feedback with clear next steps
      const duration = Date.now() - startTime;
      
      if (!args.quiet) {
        console.log(chalk.green(`\n✅ Successfully created ${result.files.length} files`));
        
        if (args.verbose) {
          result.files.forEach((file: any) => {
            console.log(chalk.green(`  + ${file.path}`));
          });
        } else {
          // Show grouped output for cleaner display
          const filesByDir = result.files.reduce((acc: Record<string, string[]>, file: any) => {
            const dir = file.path.includes("/") 
              ? file.path.split("/").slice(0, -1).join("/") 
              : ".";
            if (!acc[dir]) acc[dir] = [];
            acc[dir].push(file.path.split("/").pop());
            return acc;
          }, {});

          Object.entries(filesByDir).forEach(([dir, files]) => {
            console.log(chalk.cyan(`  📁 ${dir}/`));
            files.forEach((file) => {
              console.log(chalk.green(`    + ${file}`));
            });
          });
        }

        console.log(chalk.green(`\n🎉 Generation completed in ${duration}ms`));
        
        // Helpful next steps
        console.log(chalk.blue("\n📝 Next steps:"));
        console.log(chalk.gray("  1. Review and customize the generated files"));
        console.log(chalk.gray("  2. Update imports and dependencies as needed"));
        console.log(chalk.gray("  3. Run tests to ensure everything works"));
        console.log(chalk.gray(`  4. Use 'unjucks preview ${templateChoice} [name]' to explore variations`));
      }

      return {
        success: true,
        message: `Successfully created ${entityName}`,
        files: result.files.map((f: any) => f.path),
        duration,
      } as CommandResult;

    } catch (error) {
      if (!args.quiet) {
        spinner.stop();
      }

      // Intelligent error handling with recovery suggestions
      if (error instanceof UnjucksCommandError) {
        console.error(chalk.red(`\n❌ ${error.message}`));
        
        if (error.suggestions && error.suggestions.length > 0) {
          console.log(chalk.blue("\n💡 Suggestions:"));
          error.suggestions.forEach((suggestion) => {
            console.log(chalk.blue(`  • ${suggestion}`));
          });
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\n❌ Failed to create ${entityName || 'files'}`));
        console.error(chalk.red(`   ${errorMessage}`));

        // Context-aware suggestions based on error type
        console.log(chalk.blue("\n💡 Try this:"));
        
        if (errorMessage.includes('not found') || errorMessage.includes('No such file')) {
          console.log(chalk.blue("  • Check that template exists: unjucks list"));
          console.log(chalk.blue("  • Verify template name spelling"));
          console.log(chalk.blue("  • Make sure _templates directory is set up"));
        } else if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
          console.log(chalk.blue("  • Check directory permissions"));
          console.log(chalk.blue("  • Try a different destination: --dest /tmp/test"));
          console.log(chalk.blue("  • Run with sudo if necessary"));
        } else if (errorMessage.includes('exists') && !args.force) {
          console.log(chalk.blue("  • Use --force to overwrite existing files"));
          console.log(chalk.blue("  • Choose a different name"));
          console.log(chalk.blue("  • Use different destination: --dest ./new-location"));
        } else {
          console.log(chalk.blue("  • Try interactive mode: unjucks new"));
          console.log(chalk.blue("  • Check available templates: unjucks list"));
          console.log(chalk.blue("  • Get detailed help: unjucks help new"));
          console.log(chalk.blue("  • Run with --verbose for more details"));
        }

        if (args.verbose && error instanceof Error && error.stack) {
          console.error(chalk.gray("\n📍 Technical details:"));
          console.error(chalk.gray(error.stack));
        }
      }

      // Graceful exit with error code but no abrupt termination
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        files: [],
        duration: Date.now() - startTime
      } as CommandResult;
    }
  },
});