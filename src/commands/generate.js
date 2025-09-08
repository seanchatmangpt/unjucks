import { defineCommand } from "citty";
import chalk from "chalk";
import { SimpleFileInjectorOrchestrator } from '../lib/file-injector/simple-file-injector-orchestrator.js';
import { addCommonFilters } from '../lib/nunjucks-filters.js';
import { PerfectTemplateEngine } from '../lib/template-engine-perfect.js';
import nunjucks from 'nunjucks';
import fs from 'fs-extra';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * Real template generator using Nunjucks and file injection system
 */
class Generator {
  constructor() {
    this.templatesDir = '_templates';
    this.fileInjector = new SimpleFileInjectorOrchestrator();
    
    // Use Perfect Template Engine for zero parsing errors
    this.perfectEngine = new PerfectTemplateEngine({
      templatesDir: this.templatesDir,
      autoescape: false,
      throwOnUndefined: false,
      enableCaching: true
    });
    
    // Configure legacy Nunjucks environment for backward compatibility
    this.nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(this.templatesDir),
      {
        autoescape: false,
        throwOnUndefined: false
      }
    );
    
    // Add common filters for template processing
    addCommonFilters(this.nunjucksEnv);
  }

  async listGenerators() {
    try {
      const generators = [];
      const templatePaths = [
        path.resolve(this.templatesDir),
        path.resolve('node_modules/@seanchatmangpt/unjucks/_templates')
      ];
      
      for (const templatesPath of templatePaths) {
        if (!(await fs.pathExists(templatesPath))) {
          continue;
        }
        
        const items = await fs.readdir(templatesPath, { withFileTypes: true });
        
        for (const item of items) {
          if (item.isDirectory()) {
            const generatorPath = path.join(templatesPath, item.name);
            const hasTemplates = await this.hasTemplateFiles(generatorPath);
            
            if (hasTemplates && !generators.find(g => g.name === item.name)) {
              generators.push({
                name: item.name,
                description: `Generator for ${item.name}`,
                path: templatesPath
              });
            }
          }
        }
      }
      
      return generators;
    } catch (error) {
      console.error('Error listing generators:', error);
      return [];
    }
  }

  async listTemplates(generatorName) {
    try {
      const templates = [];
      const generatorPath = path.resolve(this.templatesDir, generatorName);
      
      if (!(await fs.pathExists(generatorPath))) {
        return [];
      }
      
      const items = await fs.readdir(generatorPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const templatePath = path.join(generatorPath, item.name);
          const hasFiles = await this.hasTemplateFiles(templatePath);
          
          if (hasFiles) {
            templates.push({
              name: item.name,
              description: `Template: ${item.name}`
            });
          }
        }
      }
      
      return templates;
    } catch (error) {
      console.error('Error listing templates:', error);
      return [];
    }
  }

  async generate(options) {
    try {
      const { generator: generatorName, template: templateName, dest, variables = {}, dry = false, force = false } = options;
      
      // Try to find template in multiple locations
      const templatePaths = [
        path.resolve(this.templatesDir, generatorName, templateName),
        path.resolve('node_modules/@seanchatmangpt/unjucks/_templates', generatorName, templateName)
      ];
      
      let templatePath = null;
      for (const tryPath of templatePaths) {
        if (await fs.pathExists(tryPath)) {
          templatePath = tryPath;
          break;
        }
      }
      
      if (!templatePath) {
        return {
          success: false,
          message: `Template not found: ${generatorName}/${templateName}. Searched in: ${templatePaths.join(', ')}`,
          files: [],
          warnings: []
        };
      }
      
      const templateFiles = await this.getTemplateFiles(templatePath);
      const results = [];
      const warnings = [];
      
      for (const templateFile of templateFiles) {
        try {
          const result = await this.processTemplateFile(templateFile, variables, dest, { dry, force });
          results.push(result);
          
          if (result.warnings) {
            warnings.push(...result.warnings);
          }
        } catch (error) {
          console.error(`Error processing template file ${templateFile}:`, error);
          warnings.push(`Failed to process ${templateFile}: ${error.message}`);
        }
      }
      
      const files = results
        .filter(r => r.success)
        .map(r => ({
          path: r.outputPath,
          exists: r.existed || false,
          size: r.size || 0
        }));
      
      return {
        success: results.some(r => r.success),
        files,
        warnings: dry ? ['This is a dry run - no files were created', ...warnings] : warnings
      };
    } catch (error) {
      return {
        success: false,
        message: `Generation failed: ${error.message}`,
        files: [],
        warnings: []
      };
    }
  }

  async processTemplateFile(templateFilePath, variables, destDir, options) {
    const { dry, force } = options;
    
    try {
      // Use Perfect Template Engine for rendering
      const renderResult = await this.perfectEngine.renderTemplate(templateFilePath, variables);
      
      if (!renderResult.success) {
        return {
          success: false,
          outputPath: templateFilePath,
          warnings: [`Template rendering failed: ${renderResult.error?.message || 'Unknown error'}`]
        };
      }
      
      const { frontmatter, content: renderedContent } = renderResult;
      
      // Render output path using Perfect Engine - CRITICAL FIX
      let outputPath;
      if (frontmatter.to) {
        // Use renderString instead of processVariables for full template processing
        try {
          outputPath = this.perfectEngine.nunjucksEnv.renderString(frontmatter.to, variables);
        } catch (error) {
          console.warn('Failed to render output path, using processVariables fallback:', error.message);
          outputPath = this.perfectEngine.processVariables(frontmatter.to, variables);
        }
      } else {
        // Strip template extensions properly
        let basename = path.basename(templateFilePath);
        if (basename.endsWith('.ejs')) {
          basename = basename.slice(0, -4);
        } else if (basename.endsWith('.njk')) {
          basename = basename.slice(0, -4);
        } else if (basename.endsWith('.hbs')) {
          basename = basename.slice(0, -4);
        }
        outputPath = basename;
      }
      
      // Resolve full output path
      const fullOutputPath = path.resolve(destDir, outputPath);
    
      // Check if file exists
      const existed = await fs.pathExists(fullOutputPath);
      
      // Don't fail on existing files if we're doing injection
      if (existed && !force && !dry && !frontmatter.inject) {
        return {
          success: false,
          outputPath: fullOutputPath,
          existed,
          warnings: [`File exists: ${fullOutputPath} (use --force to overwrite)`]
        };
      }
      
      // Use FileInjectorOrchestrator to write the file
      const injectionResult = await this.fileInjector.processFile(
        fullOutputPath,
        renderedContent,
        frontmatter,
        { dry, force }
      );
      
      if (!injectionResult.success) {
        return {
          success: false,
          outputPath: fullOutputPath,
          existed,
          warnings: [injectionResult.message]
        };
      }
      
      // Get file size if not dry run
      let size = 0;
      if (!dry && injectionResult.success) {
        try {
          const stats = await fs.stat(fullOutputPath);
          size = stats.size;
        } catch (error) {
          console.warn('Could not get file size:', error);
        }
      }
      
      return {
        success: true,
        outputPath: fullOutputPath,
        existed,
        size
      };
    } catch (error) {
      return {
        success: false,
        outputPath: templateFilePath,
        error: error.message,
        warnings: [`Template processing failed: ${error.message}`]
      };
    }
  }

  async hasTemplateFiles(dirPath) {
    try {
      const files = await this.getTemplateFiles(dirPath);
      return files.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  async getTemplateFiles(dirPath) {
    const files = [];
    
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        // Recursively get files from subdirectories
        const subFiles = await this.getTemplateFiles(itemPath);
        files.push(...subFiles);
      } else if (item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.ejs') || item.name.endsWith('.hbs'))) {
        files.push(itemPath);
      }
    }
    
    return files;
  }

  async scanTemplateForVariables(generatorName, templateName) {
    try {
      const templatePath = path.resolve(this.templatesDir, generatorName, templateName);
      const templateFiles = await this.getTemplateFiles(templatePath);
      
      const variables = new Set();
      
      for (const templateFile of templateFiles) {
        const templateContent = await fs.readFile(templateFile, 'utf8');
        const { data: frontmatter, content } = matter(templateContent);
        
        // Extract variables from frontmatter 'to' field and content
        const fullContent = (frontmatter.to || '') + '\n' + content;
        
        // Simple regex to find {{ variable }} patterns
        const variableMatches = fullContent.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g);
        
        if (variableMatches) {
          variableMatches.forEach(match => {
            const varName = match.replace(/[{}\s]/g, '');
            variables.add(varName);
          });
        }
      }
      
      return {
        variables: Array.from(variables).map(name => ({
          name,
          required: true,
          type: 'string',
          description: `Variable: ${name}`
        }))
      };
    } catch (error) {
      console.error('Error scanning template variables:', error);
      return {
        variables: [
          { name: 'name', required: true, type: 'string', description: 'Entity name' }
        ]
      };
    }
  }
}

/**
 * Simple prompt functions for interactive mode
 */
async function promptForGenerator(generators) {
  console.log(chalk.cyan("\n📋 Available Generators:"));
  generators.forEach((gen, index) => {
    console.log(`  ${index + 1}. ${chalk.green(gen.name)} - ${gen.description || 'No description'}`);
  });

  // For now, just return the first generator for testing
  // In real implementation, this would use inquirer or similar
  const selected = generators[0];
  console.log(chalk.blue(`Selected: ${selected.name}`));
  
  const templates = await new Generator().listTemplates(selected.name);
  return {
    generator: selected.name,
    template: templates[0]?.name || 'default'
  };
}

async function promptForTemplate(templates) {
  console.log(chalk.cyan("\n📋 Available Templates:"));
  templates.forEach((template, index) => {
    console.log(`  ${index + 1}. ${chalk.green(template.name)} - ${template.description || 'No description'}`);
  });

  // For now, just return the first template for testing
  const selected = templates[0]?.name || 'default';
  console.log(chalk.blue(`Selected: ${selected}`));
  return selected;
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
  // Smart type inference for positional args
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
      type: "positional",
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
      const generator = new Generator();
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

      // CRITICAL FIX: Map serviceName to name for template compatibility
      if (args.serviceName && !templateVariables.name) {
        templateVariables.name = args.serviceName;
      }
      
      // Map other common arguments to 'name' if not already set
      if (!templateVariables.name) {
        // Try common naming patterns
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

      if (!templateName) {
        if (args.skipPrompts) {
          console.error(chalk.red("\n❌ Template name required when using --skip-prompts"));
          console.log(chalk.blue("\n💡 Suggestions:"));
          console.log(chalk.blue("  • Specify a template: unjucks generate <generator> <template>"));
          console.log(chalk.blue(`  • Use 'unjucks list ${generatorName}' to see available templates`));
          return { success: false, message: "Template name required", files: [] };
        }

        const templates = await generator.listTemplates(generatorName);
        if (templates.length === 0) {
          console.error(chalk.red(`\n❌ No templates found in generator: ${generatorName}`));
          console.log(chalk.blue("\n💡 Suggestions:"));
          console.log(chalk.blue(`  • Check that _templates/${generatorName} directory exists`));
          console.log(chalk.blue("  • Use 'unjucks list' to see all available generators"));
          return { success: false, message: "No templates found", files: [] };
        }

        const selected = await promptForTemplate(templates);
        templateName = selected;
      }

      // Show what we're about to generate
      if (!args.quiet) {
        console.log(chalk.green(`\n🚀 Generating ${generatorName}/${templateName}`));
        if (args.verbose) {
          const finalVariables = {
            ...extractFlagVariables(args),
            ...templateVariables,
          };
          console.log(chalk.gray("Template variables:"), finalVariables);
        }
      }

      const message = args.dry ? "Analyzing templates..." : "Generating files...";
      
      if (!args.quiet) {
        console.log(chalk.cyan(message));
      }

      const finalVariables = {
        ...extractFlagVariables(args), // Flag-based variables first
        ...templateVariables, // Positional args override flags (higher precedence)
      };


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
          console.log(chalk.gray(`Files that would be generated (${result.files.length}):`));
          result.files.forEach((file) => {
            const action = file.exists ? (args.force ? "overwrite" : "skip") : "create";
            const color = action === "overwrite" ? "red" : action === "skip" ? "yellow" : "green";
            const symbol = action === "overwrite" ? "⚠" : action === "skip" ? "⏭" : "+";
            console.log(chalk[color](`  ${symbol} ${file.path} (${action})`));
          });

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
            // Group files by directory for cleaner output
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