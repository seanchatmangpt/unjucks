import { defineCommand } from "citty";
import chalk from "chalk";
import { Generator } from "./generator.js";
import { promptForGenerator, promptForTemplate } from "./prompts.js";
import { ArgumentParser, mergeArguments, hasPositionalArguments } from "./ArgumentParser.js";
import { getOra } from "./dynamic-imports.js";
import { performanceMonitor } from "./performance-monitor.js";

export interface DynamicGenerateOptions {
  generator?: string;
  template?: string;
  dest?: string;
  force?: boolean;
  dry?: boolean;
  [key: string]: any; // Allow dynamic properties
}

/**
 * Create a dynamic generate command that adapts to template variables
 */
export function createDynamicGenerateCommand() {
  return defineCommand({
    meta: {
      name: "generate",
      description: "Generate files from templates",
    },
    args: {
      generator: {
        type: "positional",
        description: "Name of the generator to use",
        required: false,
      },
      template: {
        type: "positional",
        description: "Name of the template to generate",
        required: false,
      },
      dest: {
        type: "string",
        description: "Destination directory for generated files",
        default: ".",
      },
      force: {
        type: "boolean",
        description: "Overwrite existing files without prompting",
        default: false,
      },
      dry: {
        type: "boolean",
        description: "Show what would be generated without creating files",
        default: false,
      },
    },
    async run({ args }: { args: any }) {
      try {
        const generator = new Generator();

        let generatorName = args.generator;
        let templateName = args.template;

        // Interactive mode if no generator/template specified
        if (!generatorName) {
          const availableGenerators = await generator.listGenerators();
          if (availableGenerators.length === 0) {
            console.log(
              chalk.red(
                "No generators found. Run 'unjucks init' to set up generators.",
              ),
            );
            return;
          }

          const selected = await promptForGenerator(availableGenerators);
          generatorName = selected.generator;
          templateName = selected.template;
        }

        if (!templateName) {
          const templates = await generator.listTemplates(generatorName);
          const selected = await promptForTemplate(templates);
          templateName = selected;
        }

        // Get template variables for positional parameter parsing
        const { variables } = await generator.scanTemplateForVariables(
          generatorName,
          templateName,
        );

        // Create argument parser with template variables
        const argumentParser = new ArgumentParser({
          templateVariables: variables,
        });

        // Parse arguments to separate positional and flag-based parameters
        const parsedArgs = argumentParser.parseArguments(args);
        
        // Validate positional parameters
        const positionalParams = argumentParser.extractPositionalParameters();
        const validation = argumentParser.validateArguments(parsedArgs, positionalParams);
        
        if (!validation.valid) {
          console.error(chalk.red("Argument validation errors:"));
          for (const error of validation.errors) {
            console.error(chalk.red(`  ❌ ${error}`));
          }
          
          // Show usage examples
          const examples = argumentParser.generateUsageExamples(
            generatorName,
            templateName,
            positionalParams
          );
          
          if (examples.length > 0) {
            console.log();
            console.log(chalk.yellow("Usage examples:"));
            examples.forEach(example => {
              console.log(chalk.gray(`  ${example}`));
            });
          }
          
          process.exit(1);
        }

        // Show warnings if any
        if (validation.warnings.length > 0) {
          for (const warning of validation.warnings) {
            console.warn(chalk.yellow(`  ⚠ ${warning}`));
          }
        }

        // Merge positional and flag arguments, with positional taking precedence
        const templateVariables = mergeArguments(parsedArgs.positional, parsedArgs.flags);

        // Log positional parameter usage for debugging (if enabled)
        if (process.env.DEBUG_UNJUCKS && hasPositionalArguments(args)) {
          console.log(chalk.cyan("Debug: Positional parameters detected"));
          console.log(chalk.gray(`  Positional: ${JSON.stringify(parsedArgs.positional)}`));
          console.log(chalk.gray(`  Flags: ${JSON.stringify(parsedArgs.flags)}`));
        }

        const ora = await getOra();
        const spinner = ora.default("Generating files...").start();

        const result = await generator.generate({
          generator: generatorName,
          template: templateName,
          dest: args.dest,
          force: args.force,
          dry: args.dry,
          variables: templateVariables, // Pass merged template variables properly
        });

        spinner.stop();

        if (args.dry) {
          console.log(chalk.yellow("Dry run - no files were created:"));
          console.log(chalk.gray("Files that would be generated:"));
          result.files.forEach((file: any) => {
            console.log(chalk.green(`  + ${file.path}`));
          });
        } else {
          console.log(
            chalk.green(`✅ Generated ${result.files.length} files:`),
          );
          result.files.forEach((file: any) => {
            console.log(chalk.green(`  + ${file.path}`));
          });
        }

        // Show positional parameter help for future reference
        if (positionalParams.length > 0 && !hasPositionalArguments(args)) {
          console.log();
          console.log(chalk.blue("💡 Pro tip: You can use positional parameters:"));
          const examples = argumentParser.generateUsageExamples(
            generatorName,
            templateName,
            positionalParams
          );
          if (examples.length > 0) {
            console.log(chalk.gray(`  ${examples[0]}`));
          }
        }

        // Clean up environment variable after processing
        if (process.env.UNJUCKS_POSITIONAL_ARGS) {
          delete process.env.UNJUCKS_POSITIONAL_ARGS;
        }

        // Show available template variables for flag-based usage
        const flagVariables = variables.filter(v => 
          !positionalParams.some(p => p.name === v.name)
        );
        
        if (flagVariables.length > 0) {
          console.log();
          console.log(chalk.blue("Available flags:"));
          for (const variable of flagVariables) {
            const type = variable.type === "boolean" ? "boolean" : "string";
            const required = variable.required ? chalk.red(" (required)") : "";
            console.log(
              chalk.gray(`  --${variable.name} (${type})${required} - ${variable.description}`),
            );
          }
        }
      } catch (error) {
        console.error(chalk.red("Error generating files:"), error);
        process.exit(1);
      } finally {
        // Always clean up environment variable, even on error
        if (process.env.UNJUCKS_POSITIONAL_ARGS) {
          delete process.env.UNJUCKS_POSITIONAL_ARGS;
        }
      }
    },
  });
}

/**
 * Create a help command that shows available template variables and positional parameters
 */
export function createTemplateHelpCommand() {
  return defineCommand({
    meta: {
      name: "help",
      description: "Show help for template variables and positional parameters",
    },
    args: {
      generator: {
        type: "positional",
        description: "Name of the generator",
        required: true,
      },
      template: {
        type: "positional",
        description: "Name of the template",
        required: true,
      },
    },
    async run({ args }: { args: any }) {
      try {
        const generator = new Generator();

        const { variables } = await generator.scanTemplateForVariables(
          args.generator,
          args.template,
        );

        console.log(
          chalk.blue.bold(
            `Help for ${args.generator}/${args.template}`,
          ),
        );
        console.log();

        if (variables.length === 0) {
          console.log(chalk.gray("No variables found in this template."));
          return;
        }

        // Create argument parser to identify positional parameters
        const argumentParser = new ArgumentParser({
          templateVariables: variables,
        });
        
        const positionalParams = argumentParser.extractPositionalParameters();
        
        // Show positional parameters
        if (positionalParams.length > 0) {
          console.log(argumentParser.generateHelpText(positionalParams));
          
          // Show usage examples
          const examples = argumentParser.generateUsageExamples(
            args.generator,
            args.template,
            positionalParams
          );
          
          console.log(chalk.yellow("Usage Examples:"));
          examples.forEach((example, index) => {
            if (index === 0) {
              console.log(chalk.green(`  ${example}`));
            } else {
              console.log(chalk.gray(`  ${example}`));
            }
          });
          console.log();
        }

        // Show flag-based parameters
        const flagVariables = variables.filter(v => 
          !positionalParams.some(p => p.name === v.name)
        );

        if (flagVariables.length > 0) {
          console.log(chalk.blue.bold("Flag Parameters:"));
          console.log();
          
          for (const variable of flagVariables) {
            const required = variable.required ? chalk.red(" (required)") : "";
            const type = chalk.gray(`[${variable.type}]`);
            console.log(
              chalk.green(`  --${variable.name}`) + ` ${type}${required}`,
            );
            console.log(chalk.gray(`    ${variable.description}`));
            if (variable.defaultValue !== undefined) {
              console.log(chalk.gray(`    Default: ${variable.defaultValue}`));
            }
            console.log();
          }
        }

        // Show mixed usage example
        if (positionalParams.length > 0 && flagVariables.length > 0) {
          console.log(chalk.yellow("Mixed Usage Example:"));
          const firstPositional = positionalParams[0];
          const firstFlag = flagVariables[0];
          const exampleValue = firstPositional.name.includes('name') ? 'MyComponent' : 'value';
          
          console.log(
            chalk.gray(
              `  unjucks generate ${args.generator} ${args.template} ${exampleValue} --${firstFlag.name}="value"`,
            ),
          );
          console.log();
        }

        // Show backward compatibility note
        console.log(chalk.blue("💡 Note:"));
        console.log(chalk.gray("  • Positional parameters take precedence over flags"));
        console.log(chalk.gray("  • All parameters can still be used as flags (--name=value)"));
        console.log(chalk.gray("  • Missing parameters will prompt interactively"));

      } catch (error) {
        console.error(chalk.red("Error scanning template:"), error);
        process.exit(1);
      }
    },
  });
}
