import { defineCommand } from "citty";
import chalk from "chalk";
import { Generator } from "./generator.js";
import { promptForGenerator, promptForTemplate } from "./prompts.js";
import ora from "ora";

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

        // Generate dynamic CLI arguments based on template variables
        const dynamicArgs = await generator.generateDynamicCliArgs(
          generatorName,
          templateName,
        );

        // Merge CLI arguments with dynamic template variables
        const templateVariables: Record<string, any> = {};

        // Extract template variables from CLI args
        for (const [key, value] of Object.entries(args)) {
          if (dynamicArgs[key]) {
            templateVariables[key] = value;
          }
        }

        const spinner = ora("Generating files...").start();

        const result = await generator.generate({
          generator: generatorName,
          template: templateName,
          dest: args.dest,
          force: args.force,
          dry: args.dry,
          ...templateVariables, // Pass template variables
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

        // Show available template variables for future reference
        if (Object.keys(dynamicArgs).length > 0) {
          console.log();
          console.log(chalk.blue("Available template variables:"));
          for (const [varName, varConfig] of Object.entries(dynamicArgs)) {
            const type =
              (varConfig as any).type === "boolean" ? "boolean" : "string";
            console.log(
              chalk.gray(
                `  --${varName} (${type}) - ${(varConfig as any).description}`,
              ),
            );
          }
        }
      } catch (error) {
        console.error(chalk.red("Error generating files:"), error);
        process.exit(1);
      }
    },
  });
}

/**
 * Create a help command that shows available template variables
 */
export function createTemplateHelpCommand() {
  return defineCommand({
    meta: {
      name: "help",
      description: "Show help for template variables",
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
            `Template Variables for ${args.generator}/${args.template}:`,
          ),
        );
        console.log();

        if (variables.length === 0) {
          console.log(chalk.gray("No variables found in this template."));
          return;
        }

        for (const variable of variables) {
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

        console.log(chalk.yellow("Usage example:"));
        console.log(
          chalk.gray(
            `  unjucks generate ${args.generator} ${args.template} --${variables[0]?.name || "variableName"}="value"`,
          ),
        );
      } catch (error) {
        console.error(chalk.red("Error scanning template:"), error);
        process.exit(1);
      }
    },
  });
}
