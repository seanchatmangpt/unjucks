import { defineCommand } from "citty";
import chalk from "chalk";
import { SafeGenerator } from '../lib/generator-safe.js';

/**
 * Simple prompt functions for interactive mode
 */
async function promptForGenerator(generators) {
  console.log(chalk.cyan("\n📋 Available Generators:"));
  generators.forEach((gen, index) => {
    console.log(`  ${index + 1}. ${chalk.green(gen.name)} - ${gen.description || 'No description'}`);
  });

  // For now, just return the first generator for testing
  const selected = generators[0];
  console.log(chalk.blue(`Selected: ${selected.name}`));
  
  const templates = await new SafeGenerator().listTemplates(selected.name);
  return {
    generator: selected.name,
    template: templates[0]?.name || 'default'
  };
}

// Helper functions for positional parameter processing
function fallbackPositionalParsing(args) {
  const variables = {};

  if (args.length > 2) {
    const [, , ...additionalArgs] = args;

    // First additional arg is typically the 'name'
    if (additionalArgs.length > 0 && !additionalArgs[0].startsWith("-")) {
      variables.name = additionalArgs[0];
    }

    // Handle remaining positional args
    additionalArgs.slice(1).forEach((arg, index) => {
      if (!arg.startsWith("-")) {
        const key = `arg${index + 2}`;
        variables[key] = inferArgumentType(arg);
      }
    });
  }

  return variables;
}

function inferArgumentType(arg) {
  if (arg === "true" || arg === "false") {
    return arg === "true";
  } else if (!isNaN(Number(arg))) {
    return Number(arg);
  } else {
    return arg;
  }
}

function extractFlagVariables(args) {
  const flagVars = {};
  const excludedKeys = [
    "generator",
    "template",
    "name",
    "force",
    "dry",
    "_",
    "backup",
    "skipPrompts",
    "verbose",
    "quiet",
    "v",
    "y",
    "q"
  ];

  for (const [key, value] of Object.entries(args)) {
    if (!excludedKeys.includes(key) && !key.startsWith('$')) {
      flagVars[key] = value;
    }
  }

  return flagVars;
}

/**
 * Generate command - Creates files from templates
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
      description: "Name of the template within the generator (e.g., react, express, sequelize)",
      required: false,
    },
    name: {
      type: "string",
      description: "Name/identifier for the generated entity (e.g., UserButton, UserService)",
      required: false,
    },
    dest: {
      type: "string",
      description: "Destination directory for generated files (relative or absolute path)",
      default: ".",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing files without confirmation prompts",
      default: false,
    },
    dry: {
      type: "boolean",
      description: "Preview mode - show what would be generated without creating files",
      default: false,
    },
    backup: {
      type: "boolean",
      description: "Create backup copies of existing files before overwriting",
      default: false,
    },
    skipPrompts: {
      type: "boolean",
      description: "Skip interactive prompts and use defaults or fail if required values missing",
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
  async run(context) {
    const { args } = context;
    const startTime = Date.now();

    try {
      const generator = new SafeGenerator();
      let generatorName = args.generator;
      let templateName = args.template;

      if (!args.quiet) {
        console.log(chalk.blue("🎯 Unjucks Generate"));
        if (args.verbose) {
          console.log(chalk.gray("Arguments:"), args);
        }
      }

      let templateVariables = {};

      // Check for stored original positional args from CLI preprocessing
      const originalPositionalArgs = process.env.UNJUCKS_POSITIONAL_ARGS
        ? JSON.parse(process.env.UNJUCKS_POSITIONAL_ARGS)
        : [];

      // Use basic fallback parsing for positional args
      if (originalPositionalArgs.length >= 2) {
        templateVariables = fallbackPositionalParsing(originalPositionalArgs);
      }

      // Also check direct arguments from Citty for backward compatibility
      if (args.name && !templateVariables.name) {
        templateVariables.name = args.name;
      }

      // Map serviceName to name for template compatibility
      if (args.serviceName && !templateVariables.name) {
        templateVariables.name = args.serviceName;
      }
      
      // Map other common arguments to 'name' if not already set
      if (!templateVariables.name) {
        for (const key of ['componentName', 'modelName', 'entityName', 'className']) {
          if (args[key]) {
            templateVariables.name = args[key];
            break;
          }
        }
      }

      // Interactive mode if no generator/template specified
      if (!generatorName) {
        if (args.skipPrompts) {
          console.error(chalk.red("\n❌ Generator name required when using --skip-prompts"));
          console.log(chalk.blue("\n💡 Quick fixes:"));
          console.log(chalk.blue("  • Run: unjucks list                    (see all generators)"));
          console.log(chalk.blue("  • Try: unjucks component react Button  (example usage)"));
          console.log(chalk.blue("  • Or:  unjucks generate component react Button"));
          return { success: false, message: "Generator name required", files: [] };
        }

        const availableGenerators = await generator.listGenerators();
        if (availableGenerators.length === 0) {
          console.error(chalk.red("\n❌ No generators found in the project"));
          console.log(chalk.blue("\n💡 Suggestions:"));
          console.log(chalk.blue("  • Run 'unjucks init' to set up initial generators"));
          console.log(chalk.blue("  • Create a _templates directory with generator subdirectories"));
          return { success: false, message: "No generators found", files: [] };
        }

        if (!args.quiet) {
          console.log(chalk.cyan(`\n📋 Found ${availableGenerators.length} generators`));
        }

        const selected = await promptForGenerator(availableGenerators);
        generatorName = selected.generator;
        templateName = selected.template;
      }

      // Use 'index' as default template name if not specified
      if (!templateName) {
        const availableTemplates = await generator.listTemplates(generatorName);
        
        if (availableTemplates.length === 0) {
          templateName = 'index';
        } else if (availableTemplates.length === 1) {
          templateName = availableTemplates[0].name;
        } else {
          templateName = '*';
        }
        
        if (args.verbose) {
          console.log(chalk.gray(`Using default template: ${templateName}`));
        }
      }

      // Show what we're about to generate
      if (!args.quiet) {
        console.log(chalk.green(`\n🚀 Generating ${generatorName}/${templateName}`));
        if (args.verbose || args.dry) {
          const finalVariables = {
            ...extractFlagVariables(args),
            ...templateVariables,
          };
          console.log(chalk.gray("Template variables:"), finalVariables);
          
          if (finalVariables.name) {
            console.log(chalk.cyan(`📝 Generating with name: ${finalVariables.name}`));
          }
        }
      }

      const message = args.dry ? "Analyzing templates..." : "Generating files...";
      
      if (!args.quiet) {
        console.log(chalk.cyan(message));
      }

      const finalVariables = {
        ...extractFlagVariables(args),
        ...templateVariables,
        dest: '.',
      };
      
      // Validate generator exists first
      const availableGenerators = await generator.listGenerators();
      const generatorExists = availableGenerators.some(g => g.name === generatorName);
      
      if (!generatorExists) {
        console.error(chalk.red(`\n❌ Generator "${generatorName}" not found`));
        console.log(chalk.blue("\n💡 Available generators:"));
        availableGenerators.forEach(g => {
          console.log(chalk.blue(`  • ${g.name}`));
        });
        return { success: false, message: `Generator "${generatorName}" not found`, files: [] };
      }

      // Validate template exists
      const availableTemplates = await generator.listTemplates(generatorName);
      const templateExists = templateName === '*' || availableTemplates.some(t => t.name === templateName) || templateName === 'index';
      
      if (!templateExists) {
        console.error(chalk.red(`\n❌ Template "${templateName}" not found in generator "${generatorName}"`));
        console.log(chalk.blue("\n💡 Available templates:"));
        availableTemplates.forEach(t => {
          console.log(chalk.blue(`  • ${t.name}`));
        });
        return { success: false, message: `Template "${templateName}" not found in generator "${generatorName}"`, files: [] };
      }

      // Validate required template variables (skip for "*")
      if (templateName !== '*') {
        try {
          const variableInfo = await generator.scanTemplateForVariables(generatorName, templateName);
          const requiredVars = variableInfo.variables.filter(v => v.required);
          const missingVars = requiredVars.filter(v => !finalVariables[v.name]);
          
          if (missingVars.length > 0) {
            console.error(chalk.red(`\n❌ Missing required variables:`));
            missingVars.forEach(v => {
              console.error(chalk.red(`  • ${v.name} - ${v.description}`));
            });
            console.log(chalk.blue("\n💡 Suggestions:"));
            console.log(chalk.blue(`  • Add missing variables: ${missingVars.map(v => `--${v.name} <value>`).join(' ')}`));
            console.log(chalk.blue(`  • Use 'unjucks help ${generatorName} ${templateName}' for more details`));
            return { success: false, message: `Missing required variables: ${missingVars.map(v => v.name).join(', ')}`, files: [] };
          }
        } catch (error) {
          if (args.verbose) {
            console.warn(chalk.yellow('Warning: Could not validate template variables'));
          }
        }
      }

      const result = await generator.generate({
        generator: generatorName,
        template: templateName,
        dest: args.dest,
        force: args.force,
        dry: args.dry,
        variables: finalVariables,
      });

      // Display results
      const duration = Date.now() - startTime;

      if (args.dry) {
        if (!args.quiet) {
          console.log(chalk.yellow("\n🔍 Dry Run Results - No files were created"));
          
          if (result.files && result.files.length > 0) {
            console.log(chalk.green(`\nWould create ${result.files.length} file(s):`));
            result.files.forEach((file) => {
              const action = file.exists ? (args.force ? "overwrite" : "skip") : "create";
              const color = action === "overwrite" ? "red" : action === "skip" ? "yellow" : "green";
              const symbol = action === "overwrite" ? "⚠" : action === "skip" ? "⏭" : "+";
              console.log(chalk[color](`  ${symbol} Would create: ${file.path} (${action})`));
            });
          }
          
          const finalVariables = {
            ...extractFlagVariables(args),
            ...templateVariables,
          };
          
          if (finalVariables.name) {
            console.log(chalk.green(`\n✨ Template will be generated with:`));
            console.log(chalk.cyan(`   • Name: ${finalVariables.name}`));
            Object.entries(finalVariables).forEach(([key, value]) => {
              if (key !== 'name' && value) {
                console.log(chalk.cyan(`   • ${key}: ${value}`));
              }
            });
          }

          if (result.warnings && result.warnings.length > 0) {
            console.log(chalk.yellow("\n⚠️ Warnings:"));
            result.warnings.forEach((warning) => {
              console.log(chalk.yellow(`  • ${warning}`));
            });
          }
        }

        console.log(chalk.blue(`\n✨ Analysis completed in ${duration}ms`));
        console.log(chalk.gray("Run without --dry to generate the files"));
      } else {
        if (!args.quiet) {
          console.log(chalk.green(`\n✅ Successfully generated ${result.files.length} files`));

          if (args.verbose) {
            result.files.forEach((file) => {
              console.log(chalk.green(`  + ${file.path} (${file.size || "unknown"} bytes)`));
            });
          } else {
            const filesByDir = result.files.reduce((acc, file) => {
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

          if (result.warnings && result.warnings.length > 0) {
            console.log(chalk.yellow("\n⚠️ Warnings:"));
            result.warnings.forEach((warning) => {
              console.log(chalk.yellow(`  • ${warning}`));
            });
          }
        }

        console.log(chalk.green(`\n🎉 Generation completed in ${duration}ms`));

        if (!args.quiet && result.files.length > 0) {
          console.log(chalk.blue("\n📝 Next steps:"));
          console.log(chalk.gray("  1. Review the generated files"));
          console.log(chalk.gray("  2. Customize the code as needed"));
          console.log(chalk.gray("  3. Run tests to ensure everything works"));
        }
      }

      // Clean up environment variable
      if (process.env.UNJUCKS_POSITIONAL_ARGS) {
        delete process.env.UNJUCKS_POSITIONAL_ARGS;
      }

      return {
        success: true,
        message: args.dry ? "Dry run completed" : "Files generated successfully",
        files: result.files.map((f) => f.path),
        duration,
      };
    } catch (error) {
      console.error(chalk.red("\n❌ Generation failed:"));
      console.error(chalk.red(`  ${error.message}`));

      if (args.verbose && error.stack) {
        console.error(chalk.gray("\n📍 Stack trace:"));
        console.error(chalk.gray(error.stack));
      }

      console.log(chalk.blue("\n💡 Suggestions:"));
      console.log(chalk.blue("  • Check that templates exist and are valid"));
      console.log(chalk.blue("  • Verify destination directory permissions"));
      console.log(chalk.blue("  • Run with --verbose for more details"));
      console.log(chalk.blue("  • Use --dry to preview without making changes"));

      return {
        success: false,
        message: "Generation failed",
        error: error.message,
      };
    }
  }
});