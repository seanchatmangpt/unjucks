import { defineCommand } from "citty";
import chalk from "chalk";
import { createEnhancedUnifiedTemplateEngine } from '../lib/unified-template-engine.js';
import { SimpleFileInjectorOrchestrator } from '../lib/file-injector/simple-file-injector-orchestrator.js';
import { handleEnterpriseError } from '../lib/enterprise-error-handler.js';
import { TemplateError, FileSystemError, ValidationError } from '../lib/actionable-error.js';
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Enhanced Generator using Unified Template Engine (GAMMA-3 Integration)
 */
class UnifiedGenerator {
  constructor(options = {}) {
    this.options = {
      templatesDirs: options.templatesDirs || ['_templates', 'templates'],
      enableRDF: options.enableRDF || false,
      debug: options.debug || false,
      ...options
    };
    
    // Initialize unified template engine
    this.unifiedEngine = createEnhancedUnifiedTemplateEngine({
      templatesDirs: this.options.templatesDirs,
      enableFilters: true,
      enableRDF: this.options.enableRDF,
      enableCache: true,
      deterministic: true,
      supportedEngines: ['nunjucks', 'handlebars', 'ejs'],
      defaultEngine: 'nunjucks',
      debug: this.options.debug
    });
    
    // File injector for output operations
    this.fileInjector = new SimpleFileInjectorOrchestrator();
    
    this.logger = {
      debug: this.options.debug ? console.log : () => {},
      info: console.log,
      warn: console.warn,
      error: console.error
    };
  }

  /**
   * List all available generators using unified discovery
   */
  async listGenerators() {
    try {
      const generators = await this.unifiedEngine.listGenerators();
      
      return generators.map(gen => ({
        name: gen.name,
        description: gen.description || `Generator for ${gen.name}`,
        path: gen.path,
        basePath: gen.basePath
      }));
    } catch (error) {
      await handleEnterpriseError(new FileSystemError('listGenerators', this.options.templatesDirs.join(','), error), {
        operation: 'list_generators_unified',
        metadata: { templatesDirs: this.options.templatesDirs }
      });
      return [];
    }
  }

  /**
   * List templates for a specific generator
   */
  async listTemplates(generatorName) {
    try {
      const templates = await this.unifiedEngine.listTemplates(generatorName);
      
      return templates.map(template => ({
        name: path.basename(template.name, path.extname(template.name)),
        description: `Template: ${template.name} (${template.engine})`,
        engine: template.engine,
        path: template.path
      }));
    } catch (error) {
      this.logger.error('Error listing templates:', error);
      return [];
    }
  }

  /**
   * Discover all templates in the system
   */
  async discoverTemplates() {
    try {
      return await this.unifiedEngine.discoverTemplates();
    } catch (error) {
      this.logger.error('Error discovering templates:', error);
      return {
        generators: [],
        templates: [],
        totalFiles: 0,
        engines: []
      };
    }
  }

  /**
   * Generate files using unified template engine
   */
  async generate(options) {
    try {
      const { generator: generatorName, template: templateName, dest, variables = {}, dry = false, force = false } = options;
      
      // Handle wildcard template generation
      if (templateName === '*') {
        return await this.generateAllTemplates(generatorName, variables, dest, { dry, force });
      }
      
      // Build template path
      const templatePath = path.join(generatorName, templateName);
      
      // Use unified engine to render template
      const renderResult = await this.unifiedEngine.render(templatePath, variables, {
        throwOnError: false
      });
      
      if (!renderResult.success) {
        return {
          success: false,
          message: `Template rendering failed: ${renderResult.metadata?.error || 'Unknown error'}`,
          files: [],
          warnings: []
        };
      }
      
      // Determine output path
      let outputPath;
      if (renderResult.outputPath) {
        outputPath = path.resolve(dest, renderResult.outputPath);
      } else {
        // Use template name with proper extension stripping
        const baseName = path.basename(templateName);
        const nameWithoutExt = baseName.replace(/\.(njk|ejs|hbs|nunjucks|handlebars)$/, '');
        outputPath = path.resolve(dest, nameWithoutExt);
      }
      
      // Check if file exists
      const existed = await fs.pathExists(outputPath);
      
      // Handle file existence logic
      if (existed && !force && !dry && !renderResult.frontmatter.inject) {
        return {
          success: false,
          outputPath,
          existed,
          warnings: [`File exists: ${outputPath} (use --force to overwrite)`]
        };
      }
      
      // Process file using injector
      const injectionResult = await this.fileInjector.processFile(
        outputPath,
        renderResult.content,
        renderResult.frontmatter || {},
        { dry, force }
      );
      
      if (!injectionResult.success) {
        return {
          success: false,
          outputPath,
          existed,
          warnings: [injectionResult.message]
        };
      }
      
      // Get file size if not dry run
      let size = 0;
      if (!dry && injectionResult.success) {
        try {
          const stats = await fs.stat(outputPath);
          size = stats.size;
        } catch (error) {
          // File size not critical
        }
      }
      
      return {
        success: true,
        files: [{
          path: outputPath,
          exists: existed,
          size,
          engine: renderResult.engine
        }],
        warnings: dry ? ['This is a dry run - no files were created'] : [],
        metadata: {
          engine: renderResult.engine,
          renderTime: renderResult.metadata?.renderTime,
          variablesUsed: renderResult.metadata?.variablesUsed
        }
      };
      
    } catch (error) {
      this.logger.error('Generation failed:', error);
      return {
        success: false,
        message: `Generation failed: ${error.message}`,
        files: [],
        warnings: []
      };
    }
  }

  /**
   * Generate all templates in a generator
   */
  async generateAllTemplates(generatorName, variables, dest, options) {
    const { dry, force } = options;
    
    try {
      const templates = await this.listTemplates(generatorName);
      
      if (templates.length === 0) {
        return {
          success: false,
          message: `No templates found in generator: ${generatorName}`,
          files: [],
          warnings: []
        };
      }
      
      const results = [];
      const warnings = [];
      
      for (const template of templates) {
        try {
          const result = await this.generate({
            generator: generatorName,
            template: template.name,
            dest,
            variables,
            dry,
            force
          });
          
          results.push(result);
          
          if (result.warnings) {
            warnings.push(...result.warnings);
          }
        } catch (error) {
          this.logger.error(`Error generating template ${template.name}:`, error);
          warnings.push(`Failed to generate ${template.name}: ${error.message}`);
        }
      }
      
      const files = results
        .filter(r => r.success)
        .flatMap(r => r.files || []);
      
      return {
        success: results.some(r => r.success),
        files,
        warnings: dry ? ['This is a dry run - no files were created', ...warnings] : warnings,
        metadata: {
          totalTemplates: templates.length,
          successfulTemplates: results.filter(r => r.success).length
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate all templates: ${error.message}`,
        files: [],
        warnings: []
      };
    }
  }

  /**
   * Scan template for variables using unified engine
   */
  async scanTemplateForVariables(generatorName, templateName) {
    try {
      const templatePath = path.join(generatorName, templateName);
      
      // Get template discovery info
      const discovery = await this.unifiedEngine.discoverTemplates();
      const templateInfo = discovery.templates.find(t => 
        t.generator === generatorName && 
        path.basename(t.name, path.extname(t.name)) === templateName
      );
      
      if (!templateInfo) {
        throw new Error(`Template not found: ${generatorName}/${templateName}`);
      }
      
      // Read template content and parse
      const templateContent = await fs.readFile(templateInfo.path, 'utf8');
      const variables = this.unifiedEngine.extractVariables(templateContent);
      
      return {
        variables: Array.from(variables).map(name => ({
          name,
          required: true,
          type: 'string',
          description: `Variable: ${name}`
        }))
      };
    } catch (error) {
      this.logger.error('Error scanning template variables:', error);
      return {
        variables: [
          { name: 'name', required: true, type: 'string', description: 'Entity name' }
        ]
      };
    }
  }

  /**
   * Get unified engine statistics
   */
  getStats() {
    return this.unifiedEngine.getStats();
  }

  /**
   * Get environment information
   */
  getEnvironment() {
    return {
      unified: this.unifiedEngine.getEnvironment(),
      options: this.options
    };
  }

  /**
   * Clear all caches
   */
  clearCache() {
    return this.unifiedEngine.clearCache();
  }
}

/**
 * Helper functions for CLI processing
 */
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
    "generator", "template", "name", "force", "dry", "_", "backup",
    "skipPrompts", "verbose", "quiet", "v", "y", "q", "rdf", "semantic"
  ];

  for (const [key, value] of Object.entries(args)) {
    if (!excludedKeys.includes(key) && !key.startsWith('$')) {
      flagVars[key] = value;
    }
  }

  return flagVars;
}

/**
 * Enhanced Generate Command with Unified Template Engine
 */
export const generateUnifiedCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate files using unified template engine (Nunjucks, Handlebars, EJS)",
  },
  args: {
    generator: {
      type: "positional",
      description: "Name of the generator to use",
      required: false,
    },
    template: {
      type: "positional", 
      description: "Name of the template within the generator",
      required: false,
    },
    name: {
      type: "string",
      description: "Name/identifier for the generated entity",
      required: false,
    },
    dest: {
      type: "string",
      description: "Destination directory for generated files",
      default: ".",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing files without confirmation",
      default: false,
    },
    dry: {
      type: "boolean",
      description: "Preview mode - show what would be generated",
      default: false,
    },
    rdf: {
      type: "boolean",
      description: "Enable RDF/semantic processing features",
      default: false,
    },
    semantic: {
      type: "boolean",
      description: "Enable semantic template processing",
      default: false,
    },
    engine: {
      type: "string",
      description: "Preferred template engine (nunjucks, handlebars, ejs)",
      default: "nunjucks",
    },
    debug: {
      type: "boolean", 
      description: "Enable debug logging",
      default: false,
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
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
  async run(context) {
    const { args } = context;
    const startTime = this.getDeterministicTimestamp();

    try {
      // Initialize unified generator
      const generator = new UnifiedGenerator({
        templatesDirs: ['_templates', 'templates'],
        enableRDF: args.rdf || args.semantic,
        debug: args.debug
      });

      let generatorName = args.generator;
      let templateName = args.template;

      if (!args.quiet) {
        console.log(chalk.blue("🚀 Unified Template Generator (GAMMA-3)"));
        if (args.verbose) {
          console.log(chalk.gray("Arguments:"), args);
        }
      }

      let templateVariables = {};

      // Handle positional arguments
      const originalPositionalArgs = process.env.UNJUCKS_POSITIONAL_ARGS
        ? JSON.parse(process.env.UNJUCKS_POSITIONAL_ARGS)
        : [];

      if (originalPositionalArgs.length >= 2) {
        if (!generatorName && originalPositionalArgs[0]) {
          generatorName = originalPositionalArgs[0];
        }
        if (!templateName && originalPositionalArgs[1]) {
          templateName = originalPositionalArgs[1];
        }
        
        templateVariables = fallbackPositionalParsing(originalPositionalArgs);
      }

      // Map common argument patterns
      if (args.name && !templateVariables.name) {
        templateVariables.name = args.name;
      }

      // Interactive mode if no generator specified
      if (!generatorName) {
        const availableGenerators = await generator.listGenerators();
        if (availableGenerators.length === 0) {
          console.error(chalk.red("❌ No generators found"));
          console.log(chalk.blue("💡 Create templates in _templates/ or templates/ directories"));
          return { success: false, message: "No generators found", files: [] };
        }

        if (!args.quiet) {
          console.log(chalk.cyan(`\n📋 Found ${availableGenerators.length} generators:`));
          availableGenerators.forEach((gen, index) => {
            console.log(`  ${index + 1}. ${chalk.green(gen.name)} - ${gen.description}`);
          });
        }

        // For now, use first generator (in real implementation, would prompt)
        generatorName = availableGenerators[0].name;
        console.log(chalk.blue(`Using generator: ${generatorName}`));
      }

      // Default template handling
      if (!templateName) {
        const availableTemplates = await generator.listTemplates(generatorName);
        
        if (availableTemplates.length === 0) {
          templateName = 'index';
        } else if (availableTemplates.length === 1) {
          templateName = availableTemplates[0].name;
        } else {
          templateName = '*'; // Process all templates
        }
        
        if (args.verbose) {
          console.log(chalk.gray(`Using template: ${templateName}`));
        }
      }

      // Show generation info
      if (!args.quiet) {
        console.log(chalk.green(`\n🎯 Generating ${generatorName}/${templateName}`));
        if (args.verbose || args.dry) {
          const finalVariables = {
            ...extractFlagVariables(args),
            ...templateVariables,
          };
          console.log(chalk.gray("Variables:"), finalVariables);
          console.log(chalk.cyan(`Engine: ${args.engine}`));
          console.log(chalk.cyan(`RDF/Semantic: ${args.rdf || args.semantic ? 'enabled' : 'disabled'}`));
        }
      }

      // Prepare final variables
      const finalVariables = {
        ...extractFlagVariables(args),
        ...templateVariables,
        dest: '.',
      };

      // Validate generator exists
      const availableGenerators = await generator.listGenerators();
      const generatorExists = availableGenerators.some(g => g.name === generatorName);
      
      if (!generatorExists) {
        console.error(chalk.red(`❌ Generator "${generatorName}" not found`));
        console.log(chalk.blue("💡 Available generators:"));
        availableGenerators.forEach(g => {
          console.log(chalk.blue(`  • ${g.name}`));
        });
        return { success: false, message: `Generator "${generatorName}" not found`, files: [] };
      }

      // Generate files
      const result = await generator.generate({
        generator: generatorName,
        template: templateName,
        dest: args.dest,
        force: args.force,
        dry: args.dry,
        variables: finalVariables,
      });

      // Display results
      const duration = this.getDeterministicTimestamp() - startTime;

      if (args.dry) {
        if (!args.quiet) {
          console.log(chalk.yellow("\n🔍 Dry Run Results"));
          
          if (result.files && result.files.length > 0) {
            console.log(chalk.green(`\nWould create ${result.files.length} file(s):`));
            result.files.forEach((file) => {
              const symbol = file.exists ? "⚠" : "+";
              const color = file.exists ? "yellow" : "green";
              console.log(chalk[color](`  ${symbol} ${file.path} ${file.engine ? `(${file.engine})` : ''}`));
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
      } else {
        if (!args.quiet) {
          console.log(chalk.green(`\n✅ Generated ${result.files.length} files`));

          if (args.verbose) {
            result.files.forEach((file) => {
              console.log(chalk.green(`  + ${file.path} ${file.engine ? `(${file.engine})` : ''}`));
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
        
        // Show engine stats
        if (args.verbose) {
          const stats = generator.getStats();
          console.log(chalk.blue("\n📊 Engine Statistics:"));
          console.log(chalk.gray(`  Renders: ${stats.renders}`));
          console.log(chalk.gray(`  Engines used: ${stats.enginesUsed.join(', ')}`));
          console.log(chalk.gray(`  Filters used: ${stats.filtersUsed.length}`));
        }
      }

      // Clean up
      if (process.env.UNJUCKS_POSITIONAL_ARGS) {
        delete process.env.UNJUCKS_POSITIONAL_ARGS;
      }

      return {
        success: true,
        message: args.dry ? "Dry run completed" : "Files generated successfully",
        files: result.files.map((f) => f.path),
        duration,
        metadata: result.metadata
      };

    } catch (error) {
      console.error(chalk.red(`\n❌ Generation failed: ${error.message}`));

      if (args.verbose && error.stack) {
        console.error(chalk.gray("\n📍 Stack trace:"));
        console.error(chalk.gray(error.stack));
      }

      return {
        success: false,
        message: "Generation failed",
        error: error.message,
      };
    }
  }
});

export default generateUnifiedCommand;