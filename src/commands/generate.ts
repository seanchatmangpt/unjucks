import { defineCommand } from "citty";
import chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { promptForGenerator, promptForTemplate } from "../lib/prompts.js";
import { HygenPositionalParser } from "../lib/HygenPositionalParser.js";
import ora from "ora";

// Helper functions for positional parameter processing
function fallbackPositionalParsing(args: string[]): Record<string, any> {
  const variables: Record<string, any> = {};
  
  if (args.length > 2) {
    const [, , ...additionalArgs] = args;
    
    // First additional arg is typically the 'name'
    if (additionalArgs.length > 0 && !additionalArgs[0].startsWith('-')) {
      variables.name = additionalArgs[0];
    }
    
    // Handle remaining positional args
    additionalArgs.slice(1).forEach((arg: string, index: number) => {
      if (!arg.startsWith('-')) {
        const key = `arg${index + 2}`;
        variables[key] = inferArgumentType(arg);
      }
    });
  }
  
  return variables;
}

function inferArgumentType(arg: string): any {
  // Smart type inference for positional args
  if (arg === 'true' || arg === 'false') {
    return arg === 'true';
  } else if (!isNaN(Number(arg))) {
    return Number(arg);
  } else {
    return arg;
  }
}

function extractFlagVariables(args: any): Record<string, any> {
  const flagVars: Record<string, any> = {};
  const excludedKeys = ['generator', 'template', 'name', 'dest', 'force', 'dry'];
  
  for (const [key, value] of Object.entries(args)) {
    if (!excludedKeys.includes(key)) {
      flagVars[key] = value;
    }
  }
  
  return flagVars;
}

export const generateCommand = defineCommand({
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
    // Enhanced positional parameter support with comprehensive handling
    name: {
      type: "positional", 
      description: "Name of the component/entity being generated",
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
      
      // Initialize enhanced positional parser
      const hygenParser = new HygenPositionalParser({
        enableTypeInference: true,
        enableSpecialPatterns: true,
        maxPositionalArgs: 10,
        strictMode: false
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
          const { variables: templateVars } = await generator.scanTemplateForVariables(
            generatorName || originalPositionalArgs[0],
            templateName || originalPositionalArgs[1]
          );
          
          // Parse with enhanced Hygen parser
          const parseResult = hygenParser.parse(originalPositionalArgs, templateVars);
          templateVariables = parseResult.variables;
          
          // Validate the result
          const validation = hygenParser.validate(parseResult, templateVars);
          if (!validation.valid) {
            console.warn(chalk.yellow("Positional parameter warnings:"));
            validation.errors.forEach(error => {
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

      const spinner = ora("Generating files...").start();

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

      spinner.stop();

      if (args.dry) {
        console.log(chalk.yellow("Dry run - no files were created:"));
        console.log(chalk.gray("Files that would be generated:"));
        result.files.forEach((file: any) => {
          console.log(chalk.green(`  + ${file.path}`));
        });
      } else {
        console.log(chalk.green(`✅ Generated ${result.files.length} files:`));
        result.files.forEach((file: any) => {
          console.log(chalk.green(`  + ${file.path}`));
        });
      }
      
      // Clean up environment variable after processing
      if (process.env.UNJUCKS_POSITIONAL_ARGS) {
        delete process.env.UNJUCKS_POSITIONAL_ARGS;
      }
    } catch (error) {
      console.error(chalk.red("Error generating files:"), error);
      process.exit(1);
    }
  },
});
