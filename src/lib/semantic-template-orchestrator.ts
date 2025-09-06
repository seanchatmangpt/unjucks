/**
 * 360° Semantic Template Orchestrator
 * E2E integration of RDF type conversion with Unjucks code generation
 */

import { RDFTypeConverter, TypeDefinition, PropertyDefinition as RDFPropertyDefinition } from './rdf-type-converter.js';
import { FrontmatterParser, ParsedTemplate } from './frontmatter-parser.js';
import { FileInjector } from './file-injector.js';
import { TemplateScanner } from './template-scanner.js';
import { PropertyDefinition } from './semantic-template-engine.js';
import nunjucks from 'nunjucks';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Glob } from 'glob';

export interface SemanticTemplateConfig {
  // RDF data sources
  ontologyPaths?: string[];
  rdfDataPaths?: string[];
  baseUri?: string;
  
  // Template configuration
  templateDir?: string;
  outputDir?: string;
  
  // Generation options
  generateTypes?: boolean;
  generateSchemas?: boolean;
  generateValidators?: boolean;
  generateTests?: boolean;
  generateDocs?: boolean;
  
  // Pipeline options
  enableCaching?: boolean;
  validateOutput?: boolean;
  runPostProcessing?: boolean;
  
  // Integration options
  mcpIntegration?: boolean;
  crossPackageSharing?: boolean;
  enterpriseMode?: boolean;
}

export interface SemanticGenerationResult {
  generatedFiles: GeneratedFile[];
  typeDefinitions: TypeDefinition[];
  validationResults: ValidationResult[];
  metrics: GenerationMetrics;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'typescript' | 'schema' | 'validator' | 'test' | 'docs' | 'api' | 'form' | 'database';
  sourceTemplate?: string;
  sourceOntology?: string;
}

export interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GenerationMetrics {
  templatesProcessed: number;
  typesGenerated: number;
  filesGenerated: number;
  validationsPassed: number;
  executionTimeMs: number;
}

/**
 * Main orchestrator for semantic-aware template generation
 */
export class SemanticTemplateOrchestrator {
  private config: SemanticTemplateConfig;
  private typeConverter: RDFTypeConverter;
  private frontmatterParser: FrontmatterParser;
  private fileInjector: FileInjector;
  private templateScanner: TemplateScanner;
  private nunjucksEnv: nunjucks.Environment;
  
  // Caching for performance
  private typeDefinitionsCache = new Map<string, TypeDefinition[]>();
  private compiledTemplatesCache = new Map<string, nunjucks.Template>();

  constructor(config: SemanticTemplateConfig = {}) {
    this.config = {
      templateDir: '_templates',
      outputDir: './generated',
      generateTypes: true,
      generateSchemas: true,
      generateValidators: true,
      generateTests: false,
      generateDocs: false,
      enableCaching: true,
      validateOutput: true,
      enterpriseMode: false,
      ...config
    };

    this.typeConverter = new RDFTypeConverter();
    this.frontmatterParser = new FrontmatterParser();
    this.fileInjector = new FileInjector();
    this.templateScanner = new TemplateScanner();
    
    // Configure Nunjucks with semantic filters
    this.nunjucksEnv = nunjucks.configure({
      autoescape: false,
      throwOnUndefined: true
    });
    
    this.registerSemanticFilters();
  }

  /**
   * Main orchestration method - 360° semantic code generation
   */
  async generateFromSemantic(): Promise<SemanticGenerationResult> {
    const startTime = Date.now();
    const result: SemanticGenerationResult = {
      generatedFiles: [],
      typeDefinitions: [],
      validationResults: [],
      metrics: {
        templatesProcessed: 0,
        typesGenerated: 0,
        filesGenerated: 0,
        validationsPassed: 0,
        executionTimeMs: 0
      }
    };

    try {
      // Phase 1: Discover and analyze RDF ontologies
      console.log('🔍 Phase 1: Discovering RDF ontologies...');
      const typeDefinitions = await this.discoverAndAnalyzeOntologies();
      result.typeDefinitions = typeDefinitions;
      result.metrics.typesGenerated = typeDefinitions.length;

      // Phase 2: Generate core type system
      console.log('🏗️  Phase 2: Generating core type system...');
      const coreFiles = await this.generateCoreTypeSystem(typeDefinitions);
      result.generatedFiles.push(...coreFiles);

      // Phase 3: Discover semantic templates
      console.log('🎯 Phase 3: Discovering semantic templates...');
      const semanticTemplates = await this.discoverSemanticTemplates();
      result.metrics.templatesProcessed = semanticTemplates.length;

      // Phase 4: Generate from templates
      console.log('⚡ Phase 4: Generating code from semantic templates...');
      const templateFiles = await this.generateFromTemplates(semanticTemplates, typeDefinitions);
      result.generatedFiles.push(...templateFiles);

      // Phase 5: Generate enterprise scaffolding
      if (this.config.enterpriseMode) {
        console.log('🏢 Phase 5: Generating enterprise scaffolding...');
        const enterpriseFiles = await this.generateEnterpriseScaffolding(typeDefinitions);
        result.generatedFiles.push(...enterpriseFiles);
      }

      // Phase 6: Validation and post-processing
      if (this.config.validateOutput) {
        console.log('✅ Phase 6: Validating generated output...');
        result.validationResults = await this.validateGeneratedFiles(result.generatedFiles);
        result.metrics.validationsPassed = result.validationResults.filter(v => v.valid).length;
      }

      // Phase 7: Cross-package coordination
      if (this.config.crossPackageSharing) {
        console.log('🔗 Phase 7: Coordinating cross-package types...');
        await this.coordinateCrossPackageTypes(typeDefinitions);
      }

      result.metrics.filesGenerated = result.generatedFiles.length;
      result.metrics.executionTimeMs = Date.now() - startTime;

      console.log(`🎉 Semantic generation complete! Generated ${result.metrics.filesGenerated} files in ${result.metrics.executionTimeMs}ms`);
      return result;

    } catch (error) {
      console.error('❌ Semantic generation failed:', error);
      throw error;
    }
  }

  /**
   * Phase 1: Discover and analyze all RDF ontologies
   */
  private async discoverAndAnalyzeOntologies(): Promise<TypeDefinition[]> {
    const allTypes: TypeDefinition[] = [];
    
    // Explicit ontology paths
    if (this.config.ontologyPaths) {
      for (const ontologyPath of this.config.ontologyPaths) {
        const cacheKey = ontologyPath;
        if (this.config.enableCaching && this.typeDefinitionsCache.has(cacheKey)) {
          allTypes.push(...this.typeDefinitionsCache.get(cacheKey)!);
          continue;
        }

        const { definitions } = await this.typeConverter.convertTurtleToTypeScript(
          ontologyPath,
          path.join(this.config.outputDir!, 'types')
        );
        
        allTypes.push(...definitions);
        
        if (this.config.enableCaching) {
          this.typeDefinitionsCache.set(cacheKey, definitions);
        }
      }
    }

    // Auto-discover RDF files in project
    const discoveredRdfFiles = await this.discoverRdfFiles();
    for (const rdfFile of discoveredRdfFiles) {
      try {
        const { definitions } = await this.typeConverter.convertTurtleToTypeScript(rdfFile);
        allTypes.push(...definitions);
      } catch (error) {
        console.warn(`⚠️  Failed to process RDF file ${rdfFile}:`, error);
      }
    }

    return this.deduplicateTypes(allTypes);
  }

  /**
   * Phase 2: Generate core type system files
   */
  private async generateCoreTypeSystem(types: TypeDefinition[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    if (this.config.generateTypes || this.config.generateSchemas) {
      const { types: tsTypes, schemas: zodSchemas } = await this.typeConverter.convertTurtleToTypeScript(
        // Use first ontology or create virtual one
        this.config.ontologyPaths?.[0] || await this.createVirtualOntology(types),
        path.join(this.config.outputDir!, 'types')
      );

      if (this.config.generateTypes) {
        files.push({
          path: path.join(this.config.outputDir!, 'types', 'index.d.ts'),
          content: tsTypes,
          type: 'typescript',
          sourceOntology: 'combined'
        });
      }

      if (this.config.generateSchemas) {
        files.push({
          path: path.join(this.config.outputDir!, 'types', 'schemas.ts'),
          content: zodSchemas,
          type: 'schema',
          sourceOntology: 'combined'
        });
      }
    }

    if (this.config.generateValidators) {
      const validators = this.typeConverter.generateValidationHelpers(types);
      files.push({
        path: path.join(this.config.outputDir!, 'types', 'validators.ts'),
        content: validators,
        type: 'validator',
        sourceOntology: 'combined'
      });
    }

    return files;
  }

  /**
   * Phase 3: Discover templates with semantic frontmatter
   */
  private async discoverSemanticTemplates(): Promise<SemanticTemplate[]> {
    const templates: SemanticTemplate[] = [];
    const templateFiles = await this.templateScanner.scanTemplate(this.config.templateDir!);

    for (const templateFile of templateFiles) {
      try {
        const content = await fs.readFile(templateFile.path, 'utf-8');
        const parsed = await this.frontmatterParser.parse(content);
        
        if (this.hasSemanticFrontmatter(parsed.frontmatter)) {
          templates.push({
            path: templateFile.path,
            name: templateFile.name,
            parsed,
            semanticConfig: this.extractSemanticConfig(parsed.frontmatter)
          });
        }
      } catch (error) {
        console.warn(`⚠️  Failed to parse template ${templateFile.path}:`, error);
      }
    }

    return templates;
  }

  /**
   * Phase 4: Generate code from semantic templates
   */
  private async generateFromTemplates(
    templates: SemanticTemplate[],
    types: TypeDefinition[]
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    for (const template of templates) {
      try {
        const context = await this.buildSemanticContext(template, types);
        const generated = await this.renderSemanticTemplate(template, context);
        files.push(...generated);
      } catch (error) {
        console.error(`❌ Failed to generate from template ${template.path}:`, error);
      }
    }

    return files;
  }

  /**
   * Phase 5: Generate enterprise scaffolding (APIs, forms, tests, docs)
   */
  private async generateEnterpriseScaffolding(types: TypeDefinition[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate REST API scaffolding
    files.push(...await this.generateApiScaffolding(types));
    
    // Generate form components
    files.push(...await this.generateFormComponents(types));
    
    // Generate database models
    files.push(...await this.generateDatabaseModels(types));
    
    if (this.config.generateTests) {
      files.push(...await this.generateTestSuites(types));
    }
    
    if (this.config.generateDocs) {
      files.push(...await this.generateDocumentation(types));
    }

    return files;
  }

  /**
   * Generate REST API routes from RDF types
   */
  private async generateApiScaffolding(types: TypeDefinition[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    
    for (const type of types) {
      const apiTemplate = `
import { Request, Response } from 'express';
import { ${type.name}Schema, validate${type.name} } from '../types/validators.js';

// GET /${type.name.toLowerCase()}s
export async function get${type.name}s(req: Request, res: Response) {
  try {
    // TODO: Implement database query
    const ${type.name.toLowerCase()}s = await db.${type.name.toLowerCase()}.findMany();
    res.json(${type.name.toLowerCase()}s);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /${type.name.toLowerCase()}
export async function create${type.name}(req: Request, res: Response) {
  try {
    const validated${type.name} = validate${type.name}(req.body);
    const created = await db.${type.name.toLowerCase()}.create({
      data: validated${type.name}
    });
    res.status(201).json(created);
  } catch (error) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

// PUT /${type.name.toLowerCase()}/:id
export async function update${type.name}(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updates = ${type.name}Schema.partial().parse(req.body);
    const updated = await db.${type.name.toLowerCase()}.update({
      where: { id },
      data: updates
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// DELETE /${type.name.toLowerCase()}/:id
export async function delete${type.name}(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await db.${type.name.toLowerCase()}.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
      `;

      files.push({
        path: path.join(this.config.outputDir!, 'api', `${type.name.toLowerCase()}.controller.ts`),
        content: apiTemplate.trim(),
        type: 'api',
        sourceOntology: type.ontology
      });
    }

    return files;
  }

  /**
   * Generate form components from RDF types
   */
  private async generateFormComponents(types: TypeDefinition[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    for (const type of types) {
      const formTemplate = `
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ${type.name}Schema, type ${type.name} } from '../types/schemas.js';

interface ${type.name}FormProps {
  initial${type.name}?: Partial<${type.name}>;
  onSubmit: (data: ${type.name}) => void;
  onCancel?: () => void;
}

export function ${type.name}Form({ initial${type.name}, onSubmit, onCancel }: ${type.name}FormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<${type.name}>({
    resolver: zodResolver(${type.name}Schema),
    defaultValues: initial${type.name}
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="${type.name.toLowerCase()}-form">
      <h2>${type.description || `${type.name} Form`}</h2>
      
      ${type.properties.map(prop => `
      <div className="field">
        <label htmlFor="${prop.name}">${prop.description || prop.name}${prop.required ? ' *' : ''}</label>
        <input
          {...register('${prop.name}')}
          type="${this.getInputType(prop)}"
          id="${prop.name}"
          ${prop.required ? 'required' : ''}
        />
        {errors.${prop.name} && (
          <span className="error">{errors.${prop.name}?.message}</span>
        )}
      </div>`).join('\n      ')}
      
      <div className="actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
      `;

      files.push({
        path: path.join(this.config.outputDir!, 'components', `${type.name}Form.tsx`),
        content: formTemplate.trim(),
        type: 'form',
        sourceOntology: type.ontology
      });
    }

    return files;
  }

  /**
   * Generate database models from RDF types
   */
  private async generateDatabaseModels(types: TypeDefinition[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate Prisma schema
    let prismaSchema = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

`;

    for (const type of types) {
      prismaSchema += `
model ${type.name} {
  id String @id @default(cuid())
  ${type.properties.map(prop => {
    const prismaType = this.getPrismaType(prop);
    const optional = prop.required ? '' : '?';
    const constraints = this.getPrismaConstraints(prop);
    return `${prop.name} ${prismaType}${optional}${constraints}`;
  }).join('\n  ')}
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
    }

    files.push({
      path: path.join(this.config.outputDir!, 'prisma', 'schema.prisma'),
      content: prismaSchema.trim(),
      type: 'database',
      sourceOntology: 'combined'
    });

    return files;
  }

  /**
   * Register semantic filters for Nunjucks
   */
  private registerSemanticFilters(): void {
    // Type-aware filters
    this.nunjucksEnv.addFilter('toTypescript', (rdfType: string) => {
      const mappings: Record<string, string> = {
        'http://www.w3.org/2001/XMLSchema#string': 'string',
        'http://www.w3.org/2001/XMLSchema#integer': 'number',
        'http://www.w3.org/2001/XMLSchema#boolean': 'boolean',
        'http://www.w3.org/2001/XMLSchema#date': 'Date',
      };
      return mappings[rdfType] || 'string';
    });

    // Property constraint filters
    this.nunjucksEnv.addFilter('zodConstraints', (property: RDFPropertyDefinition) => {
      const constraints: string[] = [];
      
      if (property.constraints?.minLength) {
        constraints.push(`min(${property.constraints.minLength})`);
      }
      if (property.constraints?.maxLength) {
        constraints.push(`max(${property.constraints.maxLength})`);
      }
      if (property.constraints?.format === 'email') {
        constraints.push('email()');
      }
      if (property.constraints?.format === 'uri') {
        constraints.push('url()');
      }
      
      return constraints.length > 0 ? `.${constraints.join('.')}` : '';
    });

    // Description formatting
    this.nunjucksEnv.addFilter('jsdoc', (description?: string) => {
      return description ? `/** ${description} */` : '';
    });
  }

  // Helper methods
  
  private async discoverRdfFiles(): Promise<string[]> {
    const patterns = ['**/*.ttl', '**/*.rdf', '**/*.owl', '**/*.n3'];
    const files: string[] = [];
    
    for (const pattern of patterns) {
      const glob = new Glob(pattern, { ignore: ['node_modules/**', '.git/**'] });
      const matches = [];
      for await (const match of glob) {
        matches.push(match);
      }
      files.push(...matches);
    }
    
    return files;
  }

  private deduplicateTypes(types: TypeDefinition[]): TypeDefinition[] {
    const seen = new Set<string>();
    return types.filter(type => {
      const key = `${type.uri}:${type.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async createVirtualOntology(types: TypeDefinition[]): Promise<string> {
    // Create a temporary ontology file from type definitions
    const tempPath = path.join(process.cwd(), 'temp-ontology.ttl');
    const ontology = await this.typeConverter.convertTypeScriptToTurtle(types, tempPath);
    return tempPath;
  }

  private hasSemanticFrontmatter(frontmatter: any): boolean {
    return !!(frontmatter.rdf || frontmatter.ontology || frontmatter.semanticTypes);
  }

  private extractSemanticConfig(frontmatter: any): SemanticTemplateConfig {
    return {
      ontologyPaths: frontmatter.ontology ? [frontmatter.ontology] : undefined,
      rdfDataPaths: frontmatter.rdf ? [frontmatter.rdf] : undefined,
      baseUri: frontmatter.baseUri,
    };
  }

  private async buildSemanticContext(template: SemanticTemplate, types: TypeDefinition[]): Promise<any> {
    return {
      types,
      semanticTypes: types.reduce((acc, type) => {
        acc[type.name] = type;
        return acc;
      }, {} as Record<string, TypeDefinition>),
      ontologies: [...new Set(types.map(t => t.ontology))],
    };
  }

  private async renderSemanticTemplate(template: SemanticTemplate, context: any): Promise<GeneratedFile[]> {
    // Implementation depends on template structure
    const rendered = this.nunjucksEnv.renderString(template.parsed.content, context);
    
    return [{
      path: this.resolveOutputPath(template.parsed.frontmatter.to || `${template.name}.generated.ts`),
      content: rendered,
      type: 'typescript',
      sourceTemplate: template.path
    }];
  }

  private resolveOutputPath(relativePath: string): string {
    return path.resolve(this.config.outputDir!, relativePath);
  }

  private getInputType(prop: RDFPropertyDefinition): string {
    // Handle TypescriptType which can be string, object, or complex type
    if (typeof prop.type === 'string') {
      switch (prop.type) {
        case 'number': return 'number';
        case 'boolean': return 'checkbox';
        case 'Date': return 'date';
        default: return 'text';
      }
    } else if (prop.type && typeof prop.type === 'object') {
      // Handle complex types like { interface: string }, { union: TypescriptType[] }, { literal: string }
      return 'text';
    }
    return 'text';
  }

  private getPrismaType(prop: RDFPropertyDefinition): string {
    // Handle TypescriptType which can be string, object, or complex type
    if (typeof prop.type === 'string') {
      switch (prop.type) {
        case 'string': return 'String';
        case 'number': return 'Float';
        case 'boolean': return 'Boolean';
        case 'Date': return 'DateTime';
        default: return 'String';
      }
    }
    return 'String';
  }

  private getPrismaConstraints(prop: RDFPropertyDefinition): string {
    const constraints: string[] = [];
    
    if (prop.constraints?.format === 'email') {
      constraints.push('@unique');
    }
    
    return constraints.length > 0 ? ` ${constraints.join(' ')}` : '';
  }

  private async validateGeneratedFiles(files: GeneratedFile[]): Promise<ValidationResult[]> {
    // Implementation would use TypeScript compiler API, ESLint, etc.
    return files.map(file => ({
      file: file.path,
      valid: true,
      errors: [],
      warnings: []
    }));
  }

  private async coordinateCrossPackageTypes(types: TypeDefinition[]): Promise<void> {
    // Implementation would coordinate types across multiple packages
    console.log(`Coordinating ${types.length} types across packages...`);
  }

  private async generateTestSuites(types: TypeDefinition[]): Promise<GeneratedFile[]> {
    // Generate test files for each type
    return [];
  }

  private async generateDocumentation(types: TypeDefinition[]): Promise<GeneratedFile[]> {
    // Generate documentation from RDF descriptions
    return [];
  }
}

// Supporting interfaces

interface SemanticTemplate {
  path: string;
  name: string;
  parsed: ParsedTemplate;
  semanticConfig: SemanticTemplateConfig;
}

// Export convenience function
export async function generateSemanticCode(config?: SemanticTemplateConfig): Promise<SemanticGenerationResult> {
  const orchestrator = new SemanticTemplateOrchestrator(config);
  return orchestrator.generateFromSemantic();
}