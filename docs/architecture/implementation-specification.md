# Professional CLI Implementation Specification

## Overview

This document provides detailed TypeScript interfaces, class definitions, and implementation patterns for the professional CLI architecture. All code follows Fortune 5 enterprise standards with comprehensive error handling, validation, and type safety.

## Core Type Definitions

### Command System Types

```typescript
// src/cli/types/command.ts
export interface CommandMeta {
  name: string;
  description: string;
  category: CommandCategory;
  version: string;
  examples: UsageExample[];
  aliases?: string[];
  deprecated?: DeprecationInfo;
  stability: 'experimental' | 'beta' | 'stable' | 'deprecated';
  permissions?: Permission[];
}

export type CommandCategory = 'core' | 'semantic' | 'enterprise' | 'utility';

export interface UsageExample {
  description: string;
  command: string;
  output?: string;
  context?: string;
}

export interface DeprecationInfo {
  version: string;
  alternative: string;
  removalVersion: string;
}

export interface Permission {
  type: 'read' | 'write' | 'execute' | 'network';
  resource: string;
  required: boolean;
}
```

### Argument System

```typescript
// src/cli/types/arguments.ts
export interface ArgumentDefinition {
  [key: string]: ArgumentSpec;
}

export interface ArgumentSpec {
  type: ArgumentType;
  description: string;
  required?: boolean;
  default?: any;
  choices?: any[];
  validation?: ValidationRule[];
  alias?: string | string[];
  positional?: boolean;
  hidden?: boolean;
  deprecated?: DeprecationInfo;
}

export type ArgumentType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'array' 
  | 'object' 
  | 'file' 
  | 'directory' 
  | 'url' 
  | 'email' 
  | 'semantic-uri';

export interface ParsedArguments {
  [key: string]: any;
  _: string[]; // Positional arguments
  '--': string[]; // Arguments after --
}
```

### Validation Framework

```typescript
// src/cli/validation/types.ts
export interface ValidationRule {
  name: string;
  validator: ValidatorFunction;
  message: string | MessageFunction;
  severity: ValidationSeverity;
  condition?: ConditionFunction;
}

export type ValidatorFunction = (
  value: any,
  context: ValidationContext
) => Promise<ValidationResult> | ValidationResult;

export type MessageFunction = (value: any, context: ValidationContext) => string;
export type ConditionFunction = (args: ParsedArguments) => boolean;

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationContext {
  args: ParsedArguments;
  command: string;
  subcommand?: string;
  templateContext?: TemplateContext;
  environment: EnvironmentInfo;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}
```

### Error Handling System

```typescript
// src/cli/errors/types.ts
export class UnjucksError extends Error {
  public readonly category: ErrorCategory;
  public readonly code: string;
  public readonly details?: any;
  public readonly suggestions: string[];
  public readonly documentationUrl?: string;
  public readonly severity: ErrorSeverity;

  constructor(config: ErrorConfig) {
    super(config.message);
    this.name = 'UnjucksError';
    this.category = config.category;
    this.code = config.code;
    this.details = config.details;
    this.suggestions = config.suggestions || [];
    this.documentationUrl = config.documentationUrl;
    this.severity = config.severity || 'error';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      code: this.code,
      details: this.details,
      suggestions: this.suggestions,
      documentationUrl: this.documentationUrl,
      severity: this.severity,
      stack: this.stack
    };
  }
}

export interface ErrorConfig {
  category: ErrorCategory;
  code: string;
  message: string;
  details?: any;
  suggestions?: string[];
  documentationUrl?: string;
  severity?: ErrorSeverity;
}

export enum ErrorCategory {
  USER_ERROR = 'USER_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR'
}

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';
```

## Base Command Classes

### Abstract Base Command

```typescript
// src/cli/commands/BaseCommand.ts
export abstract class BaseCommand {
  abstract meta: CommandMeta;
  abstract args: ArgumentDefinition;
  
  protected validation?: ValidationSchema;
  protected middleware: CommandMiddleware[] = [];
  protected logger: Logger;
  protected metrics: MetricsCollector;

  constructor(protected context: CommandContext) {
    this.logger = context.logger.child({ command: this.meta.name });
    this.metrics = context.metrics;
    this.setupDefaultMiddleware();
  }

  protected setupDefaultMiddleware(): void {
    this.middleware.push(
      new ValidationMiddleware(),
      new LoggingMiddleware(),
      new MetricsMiddleware(),
      new SecurityMiddleware()
    );
  }

  async execute(rawArgs: string[]): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // Parse arguments
      const parsedArgs = this.parseArguments(rawArgs);
      
      // Run middleware pipeline
      const middlewareResult = await this.runMiddleware(parsedArgs);
      if (!middlewareResult.success) {
        throw new UnjucksError({
          category: ErrorCategory.VALIDATION_ERROR,
          code: 'MIDDLEWARE_FAILED',
          message: 'Command validation failed',
          details: middlewareResult.errors
        });
      }

      // Execute main command logic
      const result = await this.run(parsedArgs);
      
      // Record success metrics
      this.metrics.recordCommand({
        command: this.meta.name,
        duration: Date.now() - startTime,
        success: true,
        args: this.sanitizeArgsForMetrics(parsedArgs)
      });

      return result;

    } catch (error) {
      // Record failure metrics
      this.metrics.recordCommand({
        command: this.meta.name,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      throw this.handleError(error);
    }
  }

  protected abstract run(args: ParsedArguments): Promise<CommandResult>;

  protected parseArguments(rawArgs: string[]): ParsedArguments {
    // Implementation with citty or custom parser
    return ArgumentParser.parse(rawArgs, this.args);
  }

  protected async runMiddleware(args: ParsedArguments): Promise<MiddlewareResult> {
    for (const middleware of this.middleware) {
      const result = await middleware.execute(args, this.createMiddlewareContext());
      if (!result.success) {
        return result;
      }
    }
    return { success: true, errors: [] };
  }

  protected handleError(error: any): UnjucksError {
    if (error instanceof UnjucksError) {
      return error;
    }

    return new UnjucksError({
      category: ErrorCategory.SYSTEM_ERROR,
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: { originalError: error }
    });
  }

  protected createMiddlewareContext(): MiddlewareContext {
    return {
      command: this.meta.name,
      logger: this.logger,
      metrics: this.metrics,
      validation: this.validation
    };
  }

  private sanitizeArgsForMetrics(args: ParsedArguments): Record<string, any> {
    const sanitized = { ...args };
    // Remove sensitive values
    for (const [key, value] of Object.entries(sanitized)) {
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret')) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }
}
```

### Core Command Base

```typescript
// src/cli/commands/CoreCommand.ts
export abstract class CoreCommand extends BaseCommand {
  constructor(context: CommandContext) {
    super(context);
    this.meta.category = 'core';
  }

  protected setupDefaultMiddleware(): void {
    super.setupDefaultMiddleware();
    // Add core-specific middleware
    this.middleware.push(new TemplateDiscoveryMiddleware());
  }
}
```

### Semantic Command Base

```typescript
// src/cli/commands/SemanticCommand.ts
export abstract class SemanticCommand extends BaseCommand {
  protected semanticContext: SemanticContext;

  constructor(context: CommandContext) {
    super(context);
    this.meta.category = 'semantic';
    this.semanticContext = context.semantic;
  }

  protected setupDefaultMiddleware(): void {
    super.setupDefaultMiddleware();
    // Add semantic-specific middleware
    this.middleware.push(
      new RDFValidationMiddleware(),
      new OntologyMiddleware()
    );
  }
}
```

## Command Implementations

### Generate Command (Refactored)

```typescript
// src/cli/commands/core/GenerateCommand.ts
export class GenerateCommand extends CoreCommand {
  meta: CommandMeta = {
    name: 'generate',
    description: 'Generate files from templates with professional validation',
    category: 'core',
    version: '2.0.0',
    stability: 'stable',
    examples: [
      {
        description: 'Generate a React component',
        command: 'unjucks generate component react --name Button --dest src/components'
      },
      {
        description: 'Generate with dry-run preview',
        command: 'unjucks generate api endpoint --name users --dry-run'
      },
      {
        description: 'Generate with template variables file',
        command: 'unjucks generate service crud --template-vars ./vars.json'
      }
    ]
  };

  args: ArgumentDefinition = {
    generator: {
      type: 'string',
      description: 'Generator name (e.g., component, api, service)',
      required: true,
      positional: true,
      validation: [
        {
          name: 'generator-exists',
          validator: this.validateGeneratorExists,
          message: 'Generator "{value}" does not exist',
          severity: 'error'
        }
      ]
    },
    template: {
      type: 'string',
      description: 'Template name within the generator',
      required: true,
      positional: true,
      validation: [
        {
          name: 'template-exists',
          validator: this.validateTemplateExists,
          message: 'Template "{value}" not found in generator "{context.args.generator}"',
          severity: 'error'
        }
      ]
    },
    dest: {
      type: 'directory',
      description: 'Output directory for generated files',
      default: '.',
      alias: ['d', 'destination'],
      validation: [
        {
          name: 'directory-writable',
          validator: this.validateDirectoryWritable,
          message: 'Directory "{value}" is not writable',
          severity: 'error'
        }
      ]
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing files without confirmation',
      default: false,
      alias: 'f'
    },
    'dry-run': {
      type: 'boolean',
      description: 'Preview changes without writing files',
      default: false,
      alias: ['dry', 'preview']
    },
    'template-vars': {
      type: 'file',
      description: 'JSON/YAML file containing template variables',
      alias: ['vars', 'v'],
      validation: [
        {
          name: 'file-readable',
          validator: this.validateFileReadable,
          message: 'Variable file "{value}" is not readable',
          severity: 'error'
        }
      ]
    },
    'skip-prompts': {
      type: 'boolean',
      description: 'Skip interactive prompts, use defaults',
      default: false,
      alias: 'y'
    }
  };

  protected validation: ValidationSchema = {
    rules: [
      {
        name: 'output-directory-safety',
        validator: this.validateOutputDirectorySafety,
        message: 'Output directory contains system files',
        severity: 'warning'
      }
    ],
    dependencies: [
      {
        when: 'force',
        requires: ['dest'],
        message: '--force requires --dest to be specified'
      }
    ]
  };

  protected async run(args: ParsedArguments): Promise<CommandResult> {
    this.logger.info('Starting file generation', {
      generator: args.generator,
      template: args.template,
      dest: args.dest
    });

    const generator = new Generator({
      logger: this.logger.child({ component: 'generator' }),
      metrics: this.metrics
    });

    // Load template variables from multiple sources
    const templateVars = await this.loadTemplateVariables(args);

    // Interactive prompts for missing variables (if not skipped)
    const finalVars = args['skip-prompts'] 
      ? templateVars
      : await this.promptForMissingVariables(args, templateVars);

    // Generate files
    const result = await generator.generate({
      generator: args.generator,
      template: args.template,
      dest: args.dest,
      force: args.force,
      dryRun: args['dry-run'],
      variables: finalVars
    });

    // Log results
    if (args['dry-run']) {
      this.logger.info('Dry run completed', { filesPreview: result.files.length });
      console.log(chalk.yellow('🔍 Dry Run - Files that would be generated:'));
      result.files.forEach(file => {
        console.log(chalk.green(`  ✓ ${file.path}`));
      });
    } else {
      this.logger.info('Generation completed', { filesGenerated: result.files.length });
      console.log(chalk.green(`✅ Generated ${result.files.length} files successfully`));
      result.files.forEach(file => {
        console.log(chalk.green(`  ✓ ${file.path}`));
      });
    }

    return {
      success: true,
      data: result,
      metrics: {
        filesGenerated: result.files.length,
        templateVariables: Object.keys(finalVars).length
      }
    };
  }

  private async loadTemplateVariables(args: ParsedArguments): Promise<Record<string, any>> {
    const vars: Record<string, any> = {};

    // Load from file if specified
    if (args['template-vars']) {
      const fileVars = await this.loadVariablesFromFile(args['template-vars']);
      Object.assign(vars, fileVars);
    }

    // Extract from CLI arguments (non-command arguments become variables)
    const cliVars = this.extractVariablesFromArgs(args);
    Object.assign(vars, cliVars);

    return vars;
  }

  private async validateGeneratorExists(value: string): Promise<ValidationResult> {
    // Implementation
    const exists = await this.context.templateManager.generatorExists(value);
    return { valid: exists, errors: [], warnings: [] };
  }

  // ... other validation methods
}
```

## Middleware System

### Validation Middleware

```typescript
// src/cli/middleware/ValidationMiddleware.ts
export class ValidationMiddleware implements CommandMiddleware {
  async execute(args: ParsedArguments, context: MiddlewareContext): Promise<MiddlewareResult> {
    if (!context.validation) {
      return { success: true, errors: [] };
    }

    const validator = new ArgumentValidator(context.validation);
    const result = await validator.validate(args, {
      command: context.command,
      environment: this.getEnvironmentInfo()
    });

    if (!result.valid) {
      return {
        success: false,
        errors: result.errors.map(e => e.message)
      };
    }

    // Log warnings
    result.warnings.forEach(warning => {
      context.logger.warn(warning.message, { field: warning.field });
    });

    return { success: true, errors: [] };
  }

  private getEnvironmentInfo(): EnvironmentInfo {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      workingDirectory: process.cwd(),
      user: process.env.USER || 'unknown'
    };
  }
}
```

### Security Middleware

```typescript
// src/cli/middleware/SecurityMiddleware.ts
export class SecurityMiddleware implements CommandMiddleware {
  async execute(args: ParsedArguments, context: MiddlewareContext): Promise<MiddlewareResult> {
    const securityChecks = [
      this.validatePathTraversal,
      this.validateFilePermissions,
      this.validateInputSanitization,
      this.validateNetworkAccess
    ];

    for (const check of securityChecks) {
      const result = await check(args, context);
      if (!result.valid) {
        return {
          success: false,
          errors: [`Security check failed: ${result.message}`]
        };
      }
    }

    return { success: true, errors: [] };
  }

  private async validatePathTraversal(
    args: ParsedArguments, 
    context: MiddlewareContext
  ): Promise<{ valid: boolean; message?: string }> {
    // Check for path traversal attempts in file arguments
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' && this.isPathArgument(key)) {
        if (this.containsPathTraversal(value)) {
          return {
            valid: false,
            message: `Path traversal detected in argument: ${key}`
          };
        }
      }
    }
    return { valid: true };
  }

  private containsPathTraversal(path: string): boolean {
    return path.includes('../') || path.includes('..\\') || path.includes('~');
  }

  private isPathArgument(key: string): boolean {
    const pathArguments = ['dest', 'output', 'file', 'dir', 'path', 'template-vars'];
    return pathArguments.includes(key) || key.endsWith('Path') || key.endsWith('Dir');
  }

  // ... other security validation methods
}
```

## Help System Enhancement

### Context-Aware Help Generator

```typescript
// src/cli/help/HelpGenerator.ts
export class HelpGenerator {
  constructor(
    private templateManager: TemplateManager,
    private formatter: HelpFormatter = new StandardHelpFormatter()
  ) {}

  async generateCommandHelp(
    command: BaseCommand,
    context?: HelpContext
  ): Promise<string> {
    const sections = [
      this.generateHeader(command),
      this.generateDescription(command),
      this.generateUsage(command),
      this.generateArguments(command),
      await this.generateExamples(command, context),
      this.generateFooter(command)
    ];

    return sections.filter(Boolean).join('\n\n');
  }

  async generateTemplateHelp(
    generator: string,
    template: string
  ): Promise<string> {
    const templateInfo = await this.templateManager.getTemplateInfo(generator, template);
    const variables = await this.templateManager.getTemplateVariables(generator, template);

    const sections = [
      this.formatter.header(`Template: ${generator}/${template}`),
      this.formatter.description(templateInfo.description),
      this.generateVariableTable(variables),
      this.generateTemplateExamples(generator, template, variables),
      this.generateTemplateFiles(templateInfo.files)
    ];

    return sections.join('\n\n');
  }

  private generateVariableTable(variables: TemplateVariable[]): string {
    if (variables.length === 0) {
      return this.formatter.info('No variables found in this template.');
    }

    const table = new Table({
      head: ['Variable', 'Type', 'Required', 'Default', 'Description'],
      style: { head: ['cyan'] }
    });

    variables.forEach(variable => {
      table.push([
        variable.name,
        this.formatter.type(variable.type),
        variable.required ? '✓' : '',
        variable.default || '',
        variable.description || ''
      ]);
    });

    return table.toString();
  }

  private async generateExamples(
    command: BaseCommand,
    context?: HelpContext
  ): Promise<string> {
    let examples = [...command.meta.examples];

    // Add context-specific examples
    if (context?.templateContext) {
      const contextualExamples = await this.generateContextualExamples(context);
      examples = [...examples, ...contextualExamples];
    }

    if (examples.length === 0) {
      return '';
    }

    const exampleSection = this.formatter.section('Examples');
    const formattedExamples = examples.map(example => {
      return [
        this.formatter.exampleDescription(example.description),
        this.formatter.exampleCommand(example.command),
        example.output ? this.formatter.exampleOutput(example.output) : ''
      ].filter(Boolean).join('\n');
    });

    return exampleSection + '\n' + formattedExamples.join('\n\n');
  }

  // ... other help generation methods
}
```

## Configuration Management

### Professional Config System

```typescript
// src/cli/config/ConfigManager.ts
export class ConfigManager {
  private static instance: ConfigManager;
  private config: UnjucksConfig;
  private watchers: Map<string, FSWatcher> = new Map();

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  async load(configPath?: string): Promise<UnjucksConfig> {
    const configFile = configPath || await this.findConfigFile();
    
    if (!configFile) {
      this.config = this.getDefaultConfig();
      return this.config;
    }

    const rawConfig = await this.loadConfigFile(configFile);
    this.config = await this.validateAndNormalizeConfig(rawConfig);
    
    // Watch for changes in production environments
    if (process.env.NODE_ENV !== 'development') {
      this.watchConfigFile(configFile);
    }

    return this.config;
  }

  private async findConfigFile(): Promise<string | null> {
    const possibleFiles = [
      'unjucks.config.ts',
      'unjucks.config.js',
      'unjucks.config.json',
      '.unjucksrc',
      'package.json'
    ];

    for (const file of possibleFiles) {
      const fullPath = path.resolve(process.cwd(), file);
      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        continue;
      }
    }

    return null;
  }

  private getDefaultConfig(): UnjucksConfig {
    return {
      version: '2.0.0',
      templateDir: '_templates',
      outputDir: '.',
      features: {
        semanticWeb: true,
        enterprise: false,
        audit: false,
        metrics: false
      },
      security: {
        pathTraversalProtection: true,
        inputSanitization: true,
        filePermissionChecks: true
      },
      performance: {
        cacheEnabled: true,
        lazyLoading: true,
        maxConcurrency: 10
      }
    };
  }

  private async validateAndNormalizeConfig(rawConfig: any): Promise<UnjucksConfig> {
    const validator = new ConfigValidator();
    const result = validator.validate(rawConfig);
    
    if (!result.valid) {
      throw new UnjucksError({
        category: ErrorCategory.CONFIG_ERROR,
        code: 'INVALID_CONFIG',
        message: 'Configuration validation failed',
        details: result.errors,
        suggestions: [
          'Check your configuration file syntax',
          'Refer to the configuration documentation',
          'Use the config validation command'
        ]
      });
    }

    return this.normalizeConfig(rawConfig);
  }

  // ... other config management methods
}
```

This implementation specification provides the foundation for a Fortune 5-quality CLI system with comprehensive error handling, validation, security, and enterprise features while maintaining backward compatibility with the existing Hygen-style interface.