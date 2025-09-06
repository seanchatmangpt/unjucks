import fs from "fs-extra";
import path from "node:path";
import nunjucks from "nunjucks";
import yaml from "yaml";
import chalk from "chalk";
import { fileBatchProcessor, readFilesBatch, writeFilesBatch } from "./file-batch-processor.js";
import { TemplateScanner } from "./template-scanner.js";
import type { TemplateVariable } from "./template-scanner.js";
import { FrontmatterParser } from "./frontmatter-parser.js";
import type { ParsedTemplate, FrontmatterConfig } from "./frontmatter-parser.js";
import { FileInjector } from "./file-injector.js";
import type { InjectionResult, InjectionOptions } from "./file-injector.js";
import { templateScanCache, generatorListCache, nunjucksTemplateCache } from "./template-cache.js";

export interface TemplateFile {
  path: string;
  content: string;
  frontmatter?: FrontmatterConfig;
  injectionResult?: InjectionResult;
}

export interface GeneratorConfig {
  name: string;
  description?: string;
  templates: TemplateConfig[];
}

export interface TemplateConfig {
  name: string;
  description?: string;
  files: string[];
  prompts?: PromptConfig[];
}

export interface PromptConfig {
  name: string;
  message: string;
  type: "input" | "confirm" | "list" | "checkbox";
  default?: any;
  choices?: string[];
}

export interface GenerateOptions {
  generator: string;
  template: string;
  dest: string;
  force: boolean;
  dry: boolean;
  variables?: Record<string, any>;
}

export interface GenerateResult {
  files: TemplateFile[];
}

export interface InitOptions {
  type: string;
  dest: string;
}

export class Generator {
  private templatesDir: string;
  private nunjucksEnv: nunjucks.Environment;
  private templateScanner: TemplateScanner;
  private frontmatterParser: FrontmatterParser;
  private fileInjector: FileInjector;
  private static nunjucksEnvCache: nunjucks.Environment | null = null;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || this.findTemplatesDirectory();
    this.nunjucksEnv = this.createNunjucksEnvironment();
    this.templateScanner = new TemplateScanner();
    this.frontmatterParser = new FrontmatterParser();
    this.fileInjector = new FileInjector();
  }

  private findTemplatesDirectory(): string {
    // Start from current working directory and walk up the directory tree
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      // Check for package.json in current directory
      const packageJsonPath = path.join(currentDir, "package.json");

      if (fs.existsSync(packageJsonPath)) {
        // Look for _templates directory in the same directory as package.json
        const templatesPath = path.join(currentDir, "_templates");
        if (fs.existsSync(templatesPath)) {
          return templatesPath;
        }

        // Also check for templates directory (alternative naming)
        const altTemplatesPath = path.join(currentDir, "templates");
        if (fs.existsSync(altTemplatesPath)) {
          return altTemplatesPath;
        }
      }

      // Move up one directory
      currentDir = path.dirname(currentDir);
    }

    // If no templates directory found, default to _templates in current directory
    return path.join(process.cwd(), "_templates");
  }

  getTemplatesDirectory(): string {
    return this.templatesDir;
  }

  /**
   * Scan a specific template for variables and generate CLI arguments
   */
  async scanTemplateForVariables(
    generatorName: string,
    templateName: string,
  ): Promise<{
    variables: TemplateVariable[];
    cliArgs: Record<string, any>;
  }> {
    // Check cache first
    const templatePath = path.join(this.templatesDir, generatorName, templateName);
    const cacheKey = [this.templatesDir, generatorName, templateName, 'scan'];
    let cached = await templateScanCache.get(cacheKey, templatePath);
    
    if (cached) {
      return cached;
    }

    // First, check if the generator exists
    const generatorPath = path.join(this.templatesDir, generatorName);
    if (!(await fs.pathExists(generatorPath))) {
      throw new Error(`Generator '${generatorName}' not found`);
    }

    // Then, check if the template exists within the generator
    if (!(await fs.pathExists(templatePath))) {
      // Get available templates for better error message
      const availableTemplates = await this.getAvailableTemplates(generatorName);
      if (availableTemplates.length === 0) {
        throw new Error(
          `Generator '${generatorName}' has no templates available. ` +
          `Please add template directories under ${generatorPath}/`
        );
      }
      
      throw new Error(
        `Template '${templateName}' not found in generator '${generatorName}'. ` +
        `Available templates: ${availableTemplates.join(', ')}`
      );
    }

    // Scan template and cache result
    const scanResult = await this.templateScanner.scanTemplate(templatePath);
    const cliArgs = this.templateScanner.generateCliArgs(scanResult.variables);

    const result = {
      variables: scanResult.variables,
      cliArgs,
    };

    await templateScanCache.set(cacheKey, result, templatePath);
    return result;
  }

  /**
   * Get available template names for a generator
   */
  private async getAvailableTemplates(generatorName: string): Promise<string[]> {
    const generatorPath = path.join(this.templatesDir, generatorName);
    
    if (!(await fs.pathExists(generatorPath))) {
      return [];
    }

    const entries = await fs.readdir(generatorPath);
    const templates: string[] = [];

    for (const entry of entries) {
      const entryPath = path.join(generatorPath, entry);
      const stat = await fs.stat(entryPath);

      // Only include directories as templates (following Hygen convention)
      if (stat.isDirectory()) {
        // Check if the directory contains template files
        const templateFiles = await this.getTemplateFiles(entryPath);
        if (templateFiles.length > 0) {
          templates.push(entry);
        }
      }
    }

    return templates;
  }

  /**
   * Generate dynamic CLI arguments for a template
   */
  async generateDynamicCliArgs(
    generatorName: string,
    templateName: string,
  ): Promise<Record<string, any>> {
    const { cliArgs } = await this.scanTemplateForVariables(
      generatorName,
      templateName,
    );
    return cliArgs;
  }

  private createNunjucksEnvironment(): nunjucks.Environment {
    // Use cached environment for better performance
    if (Generator.nunjucksEnvCache) {
      return Generator.nunjucksEnvCache;
    }

    const env = new nunjucks.Environment(null, {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true,
    });

    // Add custom filters
    this.addCustomFilters(env);

    Generator.nunjucksEnvCache = env;
    return env;
  }

  /**
   * Process template content - supports both Nunjucks and EJS syntax
   */
  private processTemplateContent(
    content: string,
    variables: Record<string, any>,
    isEjsFile = false
  ): string {
    if (isEjsFile || this.containsEjsSyntax(content)) {
      // Convert EJS to Nunjucks syntax for processing
      return this.processEjsContent(content, variables);
    } else {
      // Standard Nunjucks processing
      return this.nunjucksEnv.renderString(content, variables);
    }
  }

  /**
   * Check if content contains EJS syntax
   */
  private containsEjsSyntax(content: string): boolean {
    return /<%[^>]*%>/.test(content);
  }

  /**
   * Process EJS-style template content
   */
  private processEjsContent(content: string, variables: Record<string, any>): string {
    let processed = content;
    
    // Convert EJS variable syntax to values
    processed = processed.replace(/<%=\s*(.+?)\s*%>/g, (match, expression) => {
      try {
        // Handle common EJS patterns
        const trimmedExpr = expression.trim();
        
        // Simple variable reference: <%= name %>
        if (variables[trimmedExpr]) {
          return String(variables[trimmedExpr]);
        }
        
        // Helper function calls: <%= h.changeCase.kebab(name) %>
        if (trimmedExpr.includes('h.changeCase')) {
          return this.processChangeCase(trimmedExpr, variables);
        }
        
        // Default: return the variable if it exists
        const varName = trimmedExpr.split('.')[0];
        return variables[varName] ? String(variables[varName]) : match;
      } catch (error) {
        console.warn(`Warning: Could not process EJS expression: ${expression}`);
        return match;
      }
    });
    
    // Process EJS blocks (if any) - for now, just remove them
    processed = processed.replace(/<%[^=][\s\S]*?%>/g, '');
    
    return processed;
  }

  /**
   * Process changeCase helper functions from EJS
   */
  private processChangeCase(expression: string, variables: Record<string, any>): string {
    // Extract the variable name
    const varMatch = expression.match(/h\.changeCase\.(\w+)\((\w+)\)/);
    if (!varMatch) return expression;
    
    const [, method, varName] = varMatch;
    const value = variables[varName];
    
    if (!value) return expression;
    
    switch (method) {
      case 'kebab':
        return this.toKebabCase(value);
      case 'camel':
        return this.toCamelCase(value);
      case 'pascal':
        return this.toPascalCase(value);
      case 'snake':
        return this.toSnakeCase(value);
      default:
        return String(value);
    }
  }

  /**
   * Case conversion helpers (matching Nunjucks filters)
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, "");
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
        return word.toUpperCase();
      })
      .replace(/\s+/g, "");
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[\s-]+/g, "_")
      .toLowerCase();
  }

  private addCustomFilters(env: nunjucks.Environment): void {
    // kebabCase filter
    env.addFilter("kebabCase", (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
    });

    // camelCase filter
    env.addFilter("camelCase", (str: string) => {
      if (!str) return str;
      // Split on underscores, hyphens, spaces, and camelCase boundaries
      const words = str.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_-]+/).filter(Boolean);
      return words.map((word, index) => {
        const cleaned = word.toLowerCase();
        return index === 0 ? cleaned : cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }).join('');
    });

    // pascalCase filter
    env.addFilter("pascalCase", (str: string) => {
      return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
          return word.toUpperCase();
        })
        .replace(/\s+/g, "");
    });

    // snakeCase filter
    env.addFilter("snakeCase", (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .toLowerCase();
    });

    // pluralize filter
    env.addFilter("pluralize", (str: string) => {
      if (str.endsWith("y")) {
        return str.slice(0, -1) + "ies";
      } else if (
        str.endsWith("s") ||
        str.endsWith("sh") ||
        str.endsWith("ch") ||
        str.endsWith("x") ||
        str.endsWith("z")
      ) {
        return str + "es";
      } else {
        return str + "s";
      }
    });

    // singularize filter
    env.addFilter("singularize", (str: string) => {
      if (str.endsWith("ies")) {
        return str.slice(0, -3) + "y";
      } else if (str.endsWith("es") && str.length > 3) {
        return str.slice(0, -2);
      } else if (str.endsWith("s") && str.length > 1) {
        return str.slice(0, -1);
      }
      return str;
    });

    // capitalize filter (override default to handle edge cases)
    env.addFilter("capitalize", (str: string) => {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // titleCase filter - properly handles camelCase/PascalCase input
    env.addFilter("titleCase", (str: string) => {
      if (!str) return str;
      // First, split camelCase/PascalCase into words
      const words = str.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_-]+/);
      return words.map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    });
  }

  async listGenerators(): Promise<GeneratorConfig[]> {
    const generators: GeneratorConfig[] = [];

    if (!(await fs.pathExists(this.templatesDir))) {
      return generators;
    }

    const entries = await fs.readdir(this.templatesDir);

    for (const entry of entries) {
      const entryPath = path.join(this.templatesDir, entry);
      const stat = await fs.stat(entryPath);

      if (stat.isDirectory()) {
        const configPath = path.join(entryPath, "config.yml");

        if (await fs.pathExists(configPath)) {
          try {
            const configContent = await fs.readFile(configPath, "utf8");
            const config = yaml.parse(configContent) as GeneratorConfig;
            config.name = entry;
            generators.push(config);
          } catch {
            console.warn(
              chalk.yellow(
                `Warning: Could not parse config for generator ${entry}`,
              ),
            );
          }
        } else {
          // Generator without config file - create basic config
          generators.push({
            name: entry,
            description: `Generator for ${entry}`,
            templates: await this.discoverTemplates(entryPath),
          });
        }
      }
    }

    return generators;
  }

  async listTemplates(generatorName: string): Promise<TemplateConfig[]> {
    const generatorPath = path.join(this.templatesDir, generatorName);

    if (!(await fs.pathExists(generatorPath))) {
      throw new Error(`Generator '${generatorName}' not found`);
    }

    const configPath = path.join(generatorPath, "config.yml");

    if (await fs.pathExists(configPath)) {
      const configContent = await fs.readFile(configPath, "utf8");
      const config = yaml.parse(configContent) as GeneratorConfig;
      return config.templates || [];
    }

    // Discover templates if no config file
    return await this.discoverTemplates(generatorPath);
  }

  private async discoverTemplates(
    generatorPath: string,
  ): Promise<TemplateConfig[]> {
    const templates: TemplateConfig[] = [];
    const entries = await fs.readdir(generatorPath);

    for (const entry of entries) {
      const entryPath = path.join(generatorPath, entry);
      const stat = await fs.stat(entryPath);

      if (stat.isDirectory()) {
        const templateFiles = await this.getTemplateFiles(entryPath);
        if (templateFiles.length > 0) {
          templates.push({
            name: entry,
            description: `Template for ${entry}`,
            files: templateFiles,
          });
        }
      }
    }

    return templates;
  }

  private async getTemplateFiles(templatePath: string): Promise<string[]> {
    // Use optimized directory scanning with batch processing
    try {
      const allFiles = await fileBatchProcessor.scanDirectory(templatePath);
      
      // Return relative paths from the template directory
      return allFiles.map(filePath => {
        const relativePath = path.relative(templatePath, filePath);
        return relativePath.replace(/\\/g, '/'); // Normalize path separators
      });
    } catch (error) {
      // Fallback to original implementation
      const files: string[] = [];

      const scanDir = async (dir: string, prefix = ""): Promise<void> => {
        const entries = await fs.readdir(dir);

        for (const entry of entries) {
          const entryPath = path.join(dir, entry);
          const stat = await fs.stat(entryPath);

          if (stat.isDirectory()) {
            await scanDir(entryPath, path.join(prefix, entry));
          } else {
            files.push(path.join(prefix, entry));
          }
        }
      };

      await scanDir(templatePath);
      return files;
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const startTime = performance.now();
    
    try {
      const generatorPath = path.join(this.templatesDir, options.generator);
      const templatePath = path.join(generatorPath, options.template);

      // Use batch processor for existence check
      if (!(await fileBatchProcessor.pathExists(templatePath))) {
        const availableGenerators = await this.listGenerators();
        const generatorNames = availableGenerators.map(g => g.name).join(', ');
        
        throw new Error(
          `Template '${options.template}' not found in generator '${options.generator}'. ` +
          `Available generators: ${generatorNames || 'none'}`
        );
      }

    // Load template configuration
    const config = await this.loadTemplateConfig(
      generatorPath,
      options.template,
    );

    // Scan template for variables
    const { variables: scannedVariables } = await this.scanTemplateForVariables(
      options.generator,
      options.template,
    );

    // Collect template variables from CLI args and prompts
    const variables = await this.collectVariables(
      config,
      scannedVariables,
      options,
    );

    // Process template files
    const files = await this.processTemplateFiles(
      templatePath,
      variables,
      options.dest,
    );

      // Write/inject files based on frontmatter configuration
      await this.writeFiles(files, { force: options.force, dry: options.dry });
      
      // Flush any pending file operations
      await fileBatchProcessor.flush();

      const duration = performance.now() - startTime;
      if (process.env.DEBUG_UNJUCKS) {
        console.log(chalk.gray(`[PERF] Generation completed in ${duration.toFixed(2)}ms`));
        const stats = fileBatchProcessor.getStats();
        console.log(chalk.gray(`[PERF] File operations: ${stats.totalOperations}, Cache hits: ${stats.cacheHits}`));
      }

      return { files };
    } catch (error) {
      // Enhanced error handling with context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Generation failed for ${options.generator}/${options.template}: ${errorMessage}`);
    }
  }

  private async loadTemplateConfig(
    generatorPath: string,
    templateName: string,
  ): Promise<TemplateConfig> {
    const configPath = path.join(generatorPath, "config.yml");

    if (await fs.pathExists(configPath)) {
      const configContent = await fs.readFile(configPath, "utf8");
      const config = yaml.parse(configContent) as GeneratorConfig;
      const template = config.templates?.find((t) => t.name === templateName);

      if (template) {
        return template;
      }
    }

    // Fallback to discovered template
    const templatePath = path.join(generatorPath, templateName);
    const files = await this.getTemplateFiles(templatePath);

    return {
      name: templateName,
      description: `Template for ${templateName}`,
      files,
    };
  }

  private async collectVariables(
    config: TemplateConfig,
    scannedVariables: TemplateVariable[],
    options: GenerateOptions,
  ): Promise<Record<string, any>> {
    const variables: Record<string, any> = {};

    // First, apply any pre-provided variables (from positional arguments)
    // These should take highest precedence
    const providedVariables = options.variables || {};
    
    // Then, collect variables from CLI arguments (if provided)
    const cliArgs = this.templateScanner.convertArgsToVariables(
      options as any,
      scannedVariables,
    );
    
    // Merge: CLI args first, then provided variables take precedence
    Object.assign(variables, cliArgs, providedVariables);

    // Then, collect variables from config prompts (ONLY for missing variables)
    if (config.prompts) {
      const inquirer = await import("inquirer");

      for (const promptConfig of config.prompts) {
        // Skip if variable already provided via CLI or options.variables
        if (variables[promptConfig.name] !== undefined) {
          continue;
        }

        // Only prompt for variables that are actually used in the templates
        const isUsedInTemplate = scannedVariables.some(
          (v) => v.name === promptConfig.name,
        );
        if (!isUsedInTemplate) {
          continue;
        }

        const answers = await inquirer.default.prompt([
          {
            name: promptConfig.name,
            message: promptConfig.message,
            type: promptConfig.type,
            default: promptConfig.default,
            choices: promptConfig.choices,
          },
        ]);

        // Don't overwrite already provided variables
        for (const [key, value] of Object.entries(answers)) {
          if (variables[key] === undefined) {
            variables[key] = value;
          }
        }
      }
    }

    // Finally, prompt for any remaining scanned variables that weren't provided
    const missingVariables = scannedVariables.filter(
      (v) => variables[v.name] === undefined,
    );

    if (missingVariables.length > 0) {
      const inquirer = await import("inquirer");

      for (const variable of missingVariables) {
        if (variables[variable.name] === undefined) {
          const answers = await inquirer.default.prompt([
            {
              name: variable.name,
              message: variable.description || `Enter ${variable.name}`,
              type: variable.type === "boolean" ? "confirm" : "input",
              default: variable.defaultValue,
            },
          ]);

          // Don't overwrite already provided variables
          for (const [key, value] of Object.entries(answers)) {
            if (variables[key] === undefined) {
              variables[key] = value;
            }
          }
        }
      }
    }

    return variables;
  }

  private async processTemplateFiles(
    templatePath: string,
    variables: Record<string, any>,
    destDir: string,
  ): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    const processDir = async (dir: string, prefix = ""): Promise<void> => {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = await fs.stat(entryPath);

        if (stat.isDirectory()) {
          await processDir(entryPath, path.join(prefix, entry));
        } else {
          const rawContent = await fs.readFile(entryPath, "utf8");

          // Parse frontmatter
          const parsed = this.frontmatterParser.parse(rawContent);

          // Check skipIf condition
          if (this.frontmatterParser.shouldSkip(parsed.frontmatter, variables)) {
            console.log(chalk.gray(`Skipping ${entry} due to skipIf condition`));
            continue;
          }

          // Validate frontmatter
          const validation = this.frontmatterParser.validate(parsed.frontmatter);
          if (!validation.valid) {
            console.warn(chalk.yellow(`Warning in ${entry}:`));
            for (const error of validation.errors) console.warn(chalk.yellow(`  - ${error}`));
            continue;
          }

          // Process content (supports both Nunjucks and EJS)
          const isEjsFile = entry.endsWith('.ejs.t') || entry.endsWith('.ejs');
          const processedContent = this.processTemplateContent(
            parsed.content,
            variables,
            isEjsFile
          );

          // Process filename (supports both Nunjucks and EJS)
          const processedFileName = isEjsFile 
            ? this.processEjsContent(entry.replace(/\.ejs\.t$/, ''), variables)
            : this.nunjucksEnv.renderString(entry, variables);

          // Determine destination path
          let filePath: string;
          if (parsed.frontmatter.to) {
            // Custom destination from frontmatter (supports both Nunjucks and EJS)
            const customPath = isEjsFile
              ? this.processEjsContent(parsed.frontmatter.to, variables)
              : this.nunjucksEnv.renderString(parsed.frontmatter.to, variables);
            // Ensure cross-platform path handling
            const normalizedCustomPath = customPath.replace(/[\\/]/g, path.sep);
            filePath = path.isAbsolute(normalizedCustomPath) 
              ? normalizedCustomPath 
              : path.resolve(destDir, normalizedCustomPath);
          } else {
            // Default destination with cross-platform path normalization
            const normalizedPrefix = prefix.replace(/[\\/]/g, path.sep);
            const normalizedFileName = processedFileName.replace(/[\\/]/g, path.sep);
            filePath = path.resolve(destDir, normalizedPrefix, normalizedFileName);
          }

          files.push({
            path: filePath,
            content: processedContent,
            frontmatter: parsed.frontmatter,
          });
        }
      }
    };

    await processDir(templatePath);
    return files;
  }

  private async writeFiles(
    files: TemplateFile[],
    options: { force: boolean; dry: boolean },
  ): Promise<void> {
    const injectionOptions: InjectionOptions = {
      force: options.force,
      dry: options.dry,
      backup: true, // Always create backups for safety
    };

    for (const file of files) {
      try {
        // Process the file using FileInjector
        const result = await this.fileInjector.processFile(
          file.path,
          file.content,
          file.frontmatter || {},
          injectionOptions
        );

        // Store injection result for reporting
        file.injectionResult = result;

        // Handle chmod permissions
        if (file.frontmatter?.chmod && result.success && !options.dry) {
          await this.fileInjector.setPermissions(file.path, file.frontmatter.chmod);
        }

        // Handle shell commands
        if (file.frontmatter?.sh && result.success && !options.dry) {
          const commands = Array.isArray(file.frontmatter.sh) 
            ? file.frontmatter.sh 
            : [file.frontmatter.sh];
          
          const shellResult = await this.fileInjector.executeCommands(
            commands,
            path.dirname(file.path)
          );

          if (!shellResult.success) {
            console.warn(chalk.yellow(`Shell commands failed for ${file.path}:`));
            for (const error of shellResult.errors) console.warn(chalk.yellow(`  - ${error}`))
            ;
          } else if (shellResult.outputs.length > 0) {
            console.log(chalk.gray(`Shell output for ${file.path}:`));
            for (const output of shellResult.outputs) console.log(chalk.gray(`  ${output}`))
            ;
          }
        }

        // Log result
        if (result.skipped) {
          console.log(chalk.gray(`⚠ ${result.message}`));
        } else if (result.success) {
          console.log(chalk.green(`✓ ${result.message}`));
        } else {
          console.error(chalk.red(`✗ ${result.message}`));
        }
      } catch (error) {
        console.error(chalk.red(`Error processing ${file.path}: ${error}`));
      }
    }
  }

  async initProject(options: InitOptions): Promise<void> {
    const projectPath = options.dest;

    // Create templates directory
    const templatesDir = path.join(projectPath, "_templates");
    await fs.ensureDir(templatesDir);

    // Create example generators based on project type
    await this.createExampleGenerators(templatesDir, options.type);

    // Create unjucks config file
    const config = {
      version: "1.0.0",
      generators: "_templates",
    };

    await fs.writeFile(
      path.join(projectPath, "unjucks.yml"),
      yaml.stringify(config),
      "utf-8",
    );
  }

  private async createExampleGenerators(
    templatesDir: string,
    projectType: string,
  ): Promise<void> {
    // Create command generator
    const commandDir = path.join(templatesDir, "command");
    await fs.ensureDir(commandDir);

    // Command config
    const commandConfig = {
      name: "command",
      description: "Generate Citty CLI commands",
      templates: [
        {
          name: "citty",
          description: "Citty command with subcommands",
          files: [
            "{{ commandName | pascalCase }}.ts",
            "{{ commandName | pascalCase }}.test.ts",
          ],
          prompts: [
            {
              name: "commandName",
              message: "Command name:",
              type: "input",
              default: "myCommand",
            },
            {
              name: "withTests",
              message: "Include tests?",
              type: "confirm",
              default: true,
            },
            {
              name: "withSubcommands",
              message: "Include subcommands?",
              type: "confirm",
              default: true,
            },
          ],
        },
      ],
    };

    await fs.writeFile(
      path.join(commandDir, "config.yml"),
      yaml.stringify(commandConfig),
      "utf-8",
    );

    // Create Citty command template
    const cittyDir = path.join(commandDir, "citty");
    await fs.ensureDir(cittyDir);

    // Command.ts template
    const commandTemplate = `import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
  },
  {% if withSubcommands %}
  subCommands: {
    // Add your subcommands here
    // example: exampleCommand,
  },
  {% endif %}
  args: {
    // Add your command arguments here
    // name: {
    //   type: "string",
    //   description: "Name argument",
    // },
  },
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
    console.log(chalk.gray("Running {{ commandName | kebabCase }} command..."));
    
    // Add your command logic here
    console.log(chalk.green("✅ {{ commandName | titleCase }} completed successfully!"));
  },
});
`;

    await fs.writeFile(
      path.join(cittyDir, "{{ commandName | pascalCase }}.ts"),
      commandTemplate,
      "utf-8",
    );

    // Command test template
    const testTemplate = `import { describe, expect, it } from "vitest";
import { {{ commandName | pascalCase }}Command } from "./{{ commandName | pascalCase }}";

describe("{{ commandName | pascalCase }}Command", () => {
  it("should be defined", () => {
    expect({{ commandName | pascalCase }}Command).toBeDefined();
  });

  it("should have correct meta", () => {
    expect({{ commandName | pascalCase }}Command.meta?.name).toBe("{{ commandName | kebabCase }}");
    expect({{ commandName | pascalCase }}Command.meta?.description).toBe("{{ commandName | titleCase }} command");
  });

  // Add more tests here
});
`;

    await fs.writeFile(
      path.join(cittyDir, "{{ commandName | pascalCase }}.test.ts"),
      testTemplate,
      "utf-8",
    );

    // Create CLI generator
    const cliDir = path.join(templatesDir, "cli");
    await fs.ensureDir(cliDir);

    const cliConfig = {
      name: "cli",
      description: "Generate CLI applications",
      templates: [
        {
          name: "citty",
          description: "Citty CLI application",
          files: ["cli.ts", "package.json"],
          prompts: [
            {
              name: "cliName",
              message: "CLI name:",
              type: "input",
              default: "my-cli",
            },
            {
              name: "description",
              message: "CLI description:",
              type: "input",
              default: "A CLI tool built with Citty",
            },
          ],
        },
      ],
    };

    await fs.writeFile(
      path.join(cliDir, "config.yml"),
      yaml.stringify(cliConfig),
      "utf-8",
    );

    const cliCittyDir = path.join(cliDir, "citty");
    await fs.ensureDir(cliCittyDir);

    const cliTemplate = `#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import chalk from "chalk";
// Import your commands here
// import { {{ cliName | pascalCase }}Command } from "./commands/{{ cliName | kebabCase }}.js";

const main = defineCommand({
  meta: {
    name: "{{ cliName | kebabCase }}",
    version: "0.0.0",
    description: "{{ description }}",
  },
  subCommands: {
    // Add your commands here
    // {{ cliName | kebabCase }}: {{ cliName | pascalCase }}Command,
  },
  run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ cliName | titleCase }} CLI"));
    console.log(chalk.gray("{{ description }}"));
    console.log();
    console.log(chalk.yellow("Available commands:"));
    console.log(chalk.gray("  --help    Show help information"));
    console.log(chalk.gray("  --version Show version information"));
    console.log();
    console.log(chalk.gray("Use {{ cliName | kebabCase }} <command> --help for more information about a command."));
  },
});

runMain(main);
`;

    await fs.writeFile(path.join(cliCittyDir, "cli.ts"), cliTemplate, "utf-8");

    const packageJsonTemplate = `{
  "name": "{{ cliName | kebabCase }}",
  "version": "0.0.0",
  "description": "{{ description }}",
  "type": "module",
  "bin": {
    "{{ cliName | kebabCase }}": "./dist/cli.mjs"
  },
  "exports": {
    ".": "./dist/index.mjs",
    "./cli": "./dist/cli.mjs"
  },
  "scripts": {
    "build": "obuild",
    "dev": "vitest dev",
    "test": "vitest run",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "citty": "^0.1.6",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0",
    "obuild": "^0.1.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "files": [
    "dist"
  ],
  "license": "MIT"
}`;

    await fs.writeFile(
      path.join(cliCittyDir, "package.json"),
      packageJsonTemplate,
      "utf-8",
    );
  }
}
