/**
 * Spec-to-Code Transformation Engine
 * Integrates parser, mapper, generator, and traceability components
 */

import { SpecificationParser } from './parser/index.js';
import { TemplateMapper } from './mapper/index.js';
import { CodeGenerator } from './generator/index.js';
import { TraceabilityTracker } from './traceability/index.js';
import type {
  Specification,
  GenerationResult,
  ParseOptions,
  MappingOptions,
  GenerationOptions,
  TemplateMapping
} from './types/index.js';

export interface SpecEngineOptions {
  templatesDirectory?: string;
  outputDirectory?: string;
  mappingFile?: string;
  parseOptions?: Partial<ParseOptions>;
  mappingOptions?: Partial<MappingOptions>;
  generationOptions?: Partial<GenerationOptions>;
}

export class SpecEngine {
  private parser: SpecificationParser;
  private mapper: TemplateMapper;
  private generator: CodeGenerator;
  private traceabilityTracker: TraceabilityTracker;

  constructor(private options: SpecEngineOptions = {}) {
    this.parser = new SpecificationParser();
    this.mapper = new TemplateMapper(
      options.templatesDirectory || 'templates',
      options.mappingFile
    );
    this.generator = new CodeGenerator(
      this.mapper,
      options.templatesDirectory || 'templates',
      options.outputDirectory || 'src'
    );
    this.traceabilityTracker = new TraceabilityTracker();
  }

  /**
   * Initialize the spec engine
   */
  async initialize(): Promise<void> {
    await this.mapper.initialize();
  }

  /**
   * Transform specification to code
   */
  async transformSpecToCode(
    specContent: string,
    specFormat: 'yaml' | 'json' | 'markdown' | 'openapi' = 'yaml'
  ): Promise<GenerationResult> {
    try {
      // Parse specification
      const parseOptions = this.mergeParseOptions();
      const specification = await this.parser.parseSpecification(
        specContent, 
        specFormat, 
        parseOptions
      );

      // Generate code
      const generationOptions = this.mergeGenerationOptions();
      const result = await this.generator.generateFromSpecification(
        specification, 
        generationOptions
      );

      return result;
    } catch (error) {
      throw new Error(`Spec-to-code transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transform parsed specification to code
   */
  async transformParsedSpecToCode(specification: Specification): Promise<GenerationResult> {
    const generationOptions = this.mergeGenerationOptions();
    return await this.generator.generateFromSpecification(specification, generationOptions);
  }

  /**
   * Parse specification only
   */
  async parseSpecification(
    specContent: string,
    specFormat: 'yaml' | 'json' | 'markdown' | 'openapi' = 'yaml'
  ): Promise<Specification> {
    const parseOptions = this.mergeParseOptions();
    return await this.parser.parseSpecification(specContent, specFormat, parseOptions);
  }

  /**
   * Find matching templates for specification
   */
  async findMatchingTemplates(specification: Specification): Promise<TemplateMapping[]> {
    const mappingOptions = this.mergeMappingOptions();
    return await this.mapper.findMatchingTemplates(specification, mappingOptions);
  }

  /**
   * Generate code using specific template
   */
  async generateWithTemplate(
    specification: Specification,
    templatePath: string,
    variables: Record<string, unknown> = {}
  ): Promise<GenerationResult> {
    const generationOptions = this.mergeGenerationOptions();
    return await this.generator.generateFromTemplate(
      specification,
      templatePath,
      variables,
      generationOptions
    );
  }

  /**
   * Get traceability information
   */
  getTraceabilityTracker(): TraceabilityTracker {
    return this.traceabilityTracker;
  }

  /**
   * Add custom template mapping
   */
  addTemplateMapping(category: string, mapping: TemplateMapping): void {
    this.mapper.addMapping(category, mapping);
  }

  /**
   * Remove template mapping
   */
  removeTemplateMapping(category: string, templatePath: string): void {
    this.mapper.removeMapping(category, templatePath);
  }

  /**
   * Validate specification
   */
  async validateSpecification(
    specContent: string,
    specFormat: 'yaml' | 'json' | 'markdown' | 'openapi' = 'yaml'
  ): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const parseOptions = { ...this.mergeParseOptions(), validateSchema: true };
      await this.parser.parseSpecification(specContent, specFormat, parseOptions);
      return { isValid: true, errors: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  /**
   * Preview generation (dry run)
   */
  async previewGeneration(
    specContent: string,
    specFormat: 'yaml' | 'json' | 'markdown' | 'openapi' = 'yaml'
  ): Promise<GenerationResult> {
    const originalDryRun = this.options.generationOptions?.dryRun;
    
    // Set dry run to true
    this.options.generationOptions = {
      ...this.options.generationOptions,
      dryRun: true
    };

    try {
      const result = await this.transformSpecToCode(specContent, specFormat);
      
      // Restore original dry run setting
      if (this.options.generationOptions) {
        this.options.generationOptions.dryRun = originalDryRun;
      }
      
      return result;
    } catch (error) {
      // Restore original dry run setting on error
      if (this.options.generationOptions) {
        this.options.generationOptions.dryRun = originalDryRun;
      }
      throw error;
    }
  }

  /**
   * Get engine statistics
   */
  getEngineStatistics(): EngineStatistics {
    const allMappings = this.mapper.getAllMappings();
    
    return {
      totalTemplateMappings: allMappings.length,
      mappingsByCategory: this.groupMappingsByCategory(allMappings),
      supportedSpecFormats: ['yaml', 'json', 'markdown', 'openapi'],
      supportedEntityTypes: ['model', 'service', 'controller', 'repository', 'view', 'component'],
      engineVersion: '1.0.0'
    };
  }

  /**
   * Merge parse options with defaults
   */
  private mergeParseOptions(): ParseOptions {
    const defaults: ParseOptions = {
      strict: false,
      validateSchema: true,
      includeComments: true,
      resolveReferences: true
    };

    return {
      ...defaults,
      ...this.options.parseOptions
    };
  }

  /**
   * Merge mapping options with defaults
   */
  private mergeMappingOptions(): MappingOptions {
    const defaults: MappingOptions = {
      allowPartialMatch: true,
      fallbackToDefault: true,
      priorityThreshold: 10,
      includeExperimental: false
    };

    return {
      ...defaults,
      ...this.options.mappingOptions
    };
  }

  /**
   * Merge generation options with defaults
   */
  private mergeGenerationOptions(): GenerationOptions {
    const defaults: GenerationOptions = {
      dryRun: false,
      overwriteExisting: false,
      createDirectories: true,
      preserveFormatting: true,
      includeTraceability: true
    };

    return {
      ...defaults,
      ...this.options.generationOptions
    };
  }

  /**
   * Group mappings by category
   */
  private groupMappingsByCategory(mappings: TemplateMapping[]): Record<string, number> {
    const categoryMap = new Map<string, Set<string>>();
    
    mappings.forEach(mapping => {
      const category = this.getTemplateCategory(mapping.templatePath);
      if (!categoryMap.has(category)) {
        categoryMap.set(category, new Set());
      }
      categoryMap.get(category)!.add(mapping.templatePath);
    });

    const result: Record<string, number> = {};
    categoryMap.forEach((templates, category) => {
      result[category] = templates.size;
    });

    return result;
  }

  /**
   * Get template category from path
   */
  private getTemplateCategory(templatePath: string): string {
    const pathParts = templatePath.split('/');
    return pathParts[0] || 'general';
  }
}

interface EngineStatistics {
  totalTemplateMappings: number;
  mappingsByCategory: Record<string, number>;
  supportedSpecFormats: string[];
  supportedEntityTypes: string[];
  engineVersion: string;
}

// Re-export types and components
export * from './types/index.js';
export { SpecificationParser } from './parser/index.js';
export { TemplateMapper } from './mapper/index.js';
export { CodeGenerator } from './generator/index.js';
export { TraceabilityTracker } from './traceability/index.js';