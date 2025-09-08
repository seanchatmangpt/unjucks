/**
 * Code Generator - Generates code from specifications using templates
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import nunjucks from 'nunjucks';
import type {
  Specification,
  TemplateMapping,
  GenerationResult,
  GenerationOptions,
  GeneratedFile,
  TraceabilityRecord,
  GenerationWarning,
  GenerationError,
  GenerationMetadata
} from '../types/index.js';
import { TemplateMapper } from '../mapper/index.js';
import { TraceabilityTracker } from '../traceability/index.js';

export class CodeGenerator {
  private nunjucksEnv: nunjucks.Environment;
  private traceabilityTracker: TraceabilityTracker;

  constructor(
    private readonly templateMapper: TemplateMapper,
    private readonly templatesDirectory: string = 'templates',
    private readonly outputDirectory: string = 'src'
  ) {
    this.nunjucksEnv = this.setupNunjucksEnvironment();
    this.traceabilityTracker = new TraceabilityTracker();
  }

  /**
   * Generate code from specification
   */
  async generateFromSpecification(
    spec: Specification,
    options: GenerationOptions = this.getDefaultGenerationOptions()
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const result: GenerationResult = {
      files: [],
      traceability: [],
      warnings: [],
      errors: [],
      metadata: {
        specificationId: spec.id,
        timestamp: new Date(),
        templateVersion: '1.0.0',
        engineVersion: '1.0.0',
        duration: 0,
        statistics: {
          totalFiles: 0,
          totalLines: 0,
          entitiesProcessed: 0,
          relationshipsProcessed: 0,
          templatesUsed: []
        }
      }
    };

    try {
      // Find matching templates
      const templateMappings = await this.templateMapper.findMatchingTemplates(spec);
      
      if (templateMappings.length === 0) {
        result.warnings.push({
          type: 'no_templates',
          message: 'No matching templates found for specification',
          suggestions: [
            'Check if templates are properly configured',
            'Ensure template patterns match specification content',
            'Consider adding fallback templates'
          ]
        });
        return result;
      }

      // Process each matching template
      for (const mapping of templateMappings) {
        try {
          const generationFiles = await this.processTemplateMapping(spec, mapping, options);
          result.files.push(...generationFiles.files);
          result.traceability.push(...generationFiles.traceability);
          result.warnings.push(...generationFiles.warnings);
          
          // Update statistics
          result.metadata.statistics.templatesUsed.push(mapping.templatePath);
        } catch (error) {
          result.errors.push({
            type: 'template_processing_error',
            message: `Failed to process template ${mapping.templatePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            templatePath: mapping.templatePath
          });
        }
      }

      // Update final statistics
      result.metadata.statistics.totalFiles = result.files.length;
      result.metadata.statistics.totalLines = result.files.reduce(
        (total, file) => total + file.content.split('\n').length, 
        0
      );
      result.metadata.statistics.entitiesProcessed = spec.entities.length;
      result.metadata.statistics.relationshipsProcessed = spec.relationships.length;
      result.metadata.duration = Date.now() - startTime;

    } catch (error) {
      result.errors.push({
        type: 'generation_error',
        message: `Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stack: error instanceof Error ? error.stack : undefined
      });
    }

    return result;
  }

  /**
   * Generate from single template mapping
   */
  async generateFromTemplate(
    spec: Specification,
    templatePath: string,
    variables: Record<string, unknown> = {},
    options: GenerationOptions = this.getDefaultGenerationOptions()
  ): Promise<GenerationResult> {
    const mapping: TemplateMapping = {
      specPattern: {
        entityTypes: [],
        relationshipTypes: [],
        technologyStack: {},
        patterns: []
      },
      templatePath,
      variables: Object.entries(variables).map(([templateVariable, value]) => ({
        specPath: templateVariable,
        templateVariable,
        defaultValue: value
      })),
      conditions: [],
      priority: 1
    };

    return this.generateFromSpecification(spec, options);
  }

  /**
   * Process a single template mapping
   */
  private async processTemplateMapping(
    spec: Specification,
    mapping: TemplateMapping,
    options: GenerationOptions
  ): Promise<{
    files: GeneratedFile[];
    traceability: TraceabilityRecord[];
    warnings: GenerationWarning[];
  }> {
    const files: GeneratedFile[] = [];
    const traceability: TraceabilityRecord[] = [];
    const warnings: GenerationWarning[] = [];

    try {
      // Map variables from specification
      const templateVariables = await this.templateMapper.mapVariables(spec, mapping);
      
      // Load template
      const templateContent = await this.loadTemplate(mapping.templatePath);
      
      // Check if template has frontmatter with multiple file outputs
      const { frontmatter, body } = this.parseTemplate(templateContent);
      
      if (frontmatter?.files) {
        // Multiple file generation
        for (const fileConfig of frontmatter.files) {
          const generatedFile = await this.generateSingleFile(
            spec,
            mapping,
            body,
            templateVariables,
            fileConfig,
            options
          );
          
          if (generatedFile) {
            files.push(generatedFile);
            
            if (options.includeTraceability) {
              traceability.push(...this.createTraceabilityRecords(spec, generatedFile, mapping));
            }
          }
        }
      } else {
        // Single file generation
        const outputPath = this.determineOutputPath(spec, mapping, templateVariables, frontmatter);
        const generatedFile = await this.generateSingleFile(
          spec,
          mapping,
          body,
          templateVariables,
          { to: outputPath },
          options
        );
        
        if (generatedFile) {
          files.push(generatedFile);
          
          if (options.includeTraceability) {
            traceability.push(...this.createTraceabilityRecords(spec, generatedFile, mapping));
          }
        }
      }

    } catch (error) {
      warnings.push({
        type: 'template_processing_warning',
        message: `Warning processing template ${mapping.templatePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        templatePath: mapping.templatePath,
        suggestions: [
          'Check template syntax',
          'Verify variable mappings',
          'Ensure all required variables are provided'
        ]
      });
    }

    return { files, traceability, warnings };
  }

  /**
   * Generate a single file from template
   */
  private async generateSingleFile(
    spec: Specification,
    mapping: TemplateMapping,
    templateBody: string,
    variables: Record<string, unknown>,
    fileConfig: any,
    options: GenerationOptions
  ): Promise<GeneratedFile | null> {
    try {
      // Render output path
      const outputPath = typeof fileConfig.to === 'string' 
        ? this.renderString(fileConfig.to, variables)
        : this.determineOutputPath(spec, mapping, variables);

      // Check if file should be generated (skipIf condition)
      if (fileConfig.skipIf && this.evaluateCondition(fileConfig.skipIf, variables)) {
        return null;
      }

      // Render template content
      const renderedContent = this.renderTemplate(templateBody, variables);

      // Handle injection vs. writing
      let finalContent = renderedContent;
      let sourceElements: string[] = [];

      if (fileConfig.inject && !options.dryRun) {
        finalContent = await this.handleInjection(outputPath, renderedContent, fileConfig);
        sourceElements = this.extractSourceElements(spec, renderedContent);
      }

      // Create generated file object
      const generatedFile: GeneratedFile = {
        path: outputPath,
        content: finalContent,
        encoding: 'utf-8',
        permissions: fileConfig.chmod,
        sourceElements,
        templateUsed: mapping.templatePath
      };

      // Write file if not dry run
      if (!options.dryRun) {
        await this.writeGeneratedFile(generatedFile, options);
      }

      return generatedFile;

    } catch (error) {
      throw new Error(`Failed to generate file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle file injection logic
   */
  private async handleInjection(
    filePath: string,
    newContent: string,
    config: any
  ): Promise<string> {
    if (!existsSync(filePath)) {
      return newContent;
    }

    const existingContent = await readFile(filePath, 'utf-8');
    const lines = existingContent.split('\n');

    switch (config.inject) {
      case 'before':
        return this.injectBefore(lines, newContent, config.beforePattern || config.before);
      
      case 'after':
        return this.injectAfter(lines, newContent, config.afterPattern || config.after);
      
      case 'append':
        return existingContent + '\n' + newContent;
      
      case 'prepend':
        return newContent + '\n' + existingContent;
      
      case 'lineAt':
        return this.injectAtLine(lines, newContent, config.lineAt);
      
      case 'replace':
        return this.injectReplace(existingContent, newContent, config.replacePattern);
      
      default:
        return newContent;
    }
  }

  /**
   * Inject content before a pattern
   */
  private injectBefore(lines: string[], content: string, pattern: string | RegExp): string {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const insertIndex = lines.findIndex(line => regex.test(line));
    
    if (insertIndex !== -1) {
      lines.splice(insertIndex, 0, content);
    }
    
    return lines.join('\n');
  }

  /**
   * Inject content after a pattern
   */
  private injectAfter(lines: string[], content: string, pattern: string | RegExp): string {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const insertIndex = lines.findIndex(line => regex.test(line));
    
    if (insertIndex !== -1) {
      lines.splice(insertIndex + 1, 0, content);
    }
    
    return lines.join('\n');
  }

  /**
   * Inject content at specific line
   */
  private injectAtLine(lines: string[], content: string, lineNumber: number): string {
    const index = Math.max(0, Math.min(lineNumber - 1, lines.length));
    lines.splice(index, 0, content);
    return lines.join('\n');
  }

  /**
   * Replace content using pattern
   */
  private injectReplace(existingContent: string, newContent: string, pattern: string | RegExp): string {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'g') : pattern;
    return existingContent.replace(regex, newContent);
  }

  /**
   * Load template from file system
   */
  private async loadTemplate(templatePath: string): Promise<string> {
    const fullPath = join(this.templatesDirectory, templatePath);
    return await readFile(fullPath, 'utf-8');
  }

  /**
   * Parse template to separate frontmatter and body
   */
  private parseTemplate(content: string): { frontmatter: any; body: string } {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    
    if (frontmatterMatch) {
      try {
        const yaml = require('js-yaml');
        return {
          frontmatter: yaml.load(frontmatterMatch[1]),
          body: frontmatterMatch[2]
        };
      } catch (error) {
        console.warn(`Failed to parse frontmatter: ${error}`);
      }
    }

    return {
      frontmatter: null,
      body: content
    };
  }

  /**
   * Render template using Nunjucks
   */
  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    return this.nunjucksEnv.renderString(template, variables);
  }

  /**
   * Render string template
   */
  private renderString(template: string, variables: Record<string, unknown>): string {
    return this.nunjucksEnv.renderString(template, variables);
  }

  /**
   * Evaluate condition string
   */
  private evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    try {
      // Simple condition evaluation (can be enhanced with a proper expression parser)
      const rendered = this.renderString(`{% if ${condition} %}true{% endif %}`, variables);
      return rendered.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Determine output path for generated file
   */
  private determineOutputPath(
    spec: Specification,
    mapping: TemplateMapping,
    variables: Record<string, unknown>,
    frontmatter?: any
  ): string {
    // Check frontmatter for 'to' path
    if (frontmatter?.to) {
      return this.renderString(frontmatter.to, variables);
    }

    // Default path generation based on template path and spec
    const templateBaseName = mapping.templatePath.replace(/\.ejs$/, '');
    const entityName = spec.entities[0]?.name || 'generated';
    
    return join(this.outputDirectory, `${entityName.toLowerCase()}.${templateBaseName}.ts`);
  }

  /**
   * Extract source elements that contributed to generation
   */
  private extractSourceElements(spec: Specification, content: string): string[] {
    const elements: string[] = [];
    
    // Add entities referenced in content
    spec.entities.forEach(entity => {
      if (content.includes(entity.name)) {
        elements.push(`entity:${entity.id}`);
      }
    });

    // Add relationships referenced in content
    spec.relationships.forEach(relationship => {
      if (content.includes(relationship.type)) {
        elements.push(`relationship:${relationship.id}`);
      }
    });

    return elements;
  }

  /**
   * Create traceability records
   */
  private createTraceabilityRecords(
    spec: Specification,
    generatedFile: GeneratedFile,
    mapping: TemplateMapping
  ): TraceabilityRecord[] {
    return this.traceabilityTracker.createRecords(spec, generatedFile, mapping);
  }

  /**
   * Write generated file to disk
   */
  private async writeGeneratedFile(file: GeneratedFile, options: GenerationOptions): Promise<void> {
    const filePath = file.path;
    
    // Check if file exists and handle overwrite logic
    if (existsSync(filePath) && !options.overwriteExisting) {
      throw new Error(`File ${filePath} already exists and overwriteExisting is false`);
    }

    // Create directories if needed
    if (options.createDirectories) {
      const dir = dirname(filePath);
      await mkdir(dir, { recursive: true });
    }

    // Write file
    await writeFile(filePath, file.content, { encoding: file.encoding as BufferEncoding });

    // Set permissions if specified
    if (file.permissions) {
      const fs = require('node:fs');
      fs.chmodSync(filePath, file.permissions);
    }
  }

  /**
   * Setup Nunjucks environment with custom filters and functions
   */
  private setupNunjucksEnvironment(): nunjucks.Environment {
    const env = new nunjucks.Environment();

    // Add custom filters
    env.addFilter('camelCase', (str: string) => {
      return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
    });

    env.addFilter('pascalCase', (str: string) => {
      const camelCase = str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
      return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    });

    env.addFilter('kebabCase', (str: string) => {
      return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-');
    });

    env.addFilter('snakeCase', (str: string) => {
      return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[\s-]+/g, '_');
    });

    env.addFilter('pluralize', (str: string) => {
      if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
      if (str.endsWith('s') || str.endsWith('sh') || str.endsWith('ch') || str.endsWith('x') || str.endsWith('z')) {
        return str + 'es';
      }
      return str + 's';
    });

    env.addFilter('singularize', (str: string) => {
      if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
      if (str.endsWith('es')) return str.slice(0, -2);
      if (str.endsWith('s') && !str.endsWith('ss')) return str.slice(0, -1);
      return str;
    });

    // Add global functions
    env.addGlobal('now', () => new Date());
    env.addGlobal('timestamp', () => Date.now());
    env.addGlobal('uuid', () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    return env;
  }

  /**
   * Get default generation options
   */
  private getDefaultGenerationOptions(): GenerationOptions {
    return {
      dryRun: false,
      overwriteExisting: false,
      createDirectories: true,
      preserveFormatting: true,
      includeTraceability: true
    };
  }
}

export { CodeGenerator };