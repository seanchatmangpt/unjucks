/**
 * Specification Parser - Extracts structured data from various specification formats
 */

import { z } from 'zod';
import yaml from 'js-yaml';
import type { 
  Specification, 
  ParseOptions, 
  Entity, 
  Relationship, 
  Constraint,
  SpecContext,
  SpecMetadata 
} from '../types/index.js';

export class SpecificationParser {
  private readonly schemas: Map<string, z.ZodSchema> = new Map();

  constructor() {
    this.initializeSchemas();
  }

  /**
   * Parse specification from various formats
   */
  async parseSpecification(
    content: string, 
    format: 'yaml' | 'json' | 'markdown' | 'openapi',
    options: ParseOptions = this.getDefaultParseOptions()
  ): Promise<Specification> {
    try {
      const rawData = await this.parseContent(content, format);
      const structuredData = await this.extractStructuredData(rawData, format, options);
      
      if (options.validateSchema) {
        await this.validateSpecification(structuredData);
      }

      if (options.resolveReferences) {
        return this.resolveReferences(structuredData);
      }

      return structuredData;
    } catch (error) {
      throw new Error(`Failed to parse specification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse content based on format
   */
  private async parseContent(content: string, format: string): Promise<unknown> {
    switch (format) {
      case 'yaml':
        return yaml.load(content, { json: true });
      case 'json':
        return JSON.parse(content);
      case 'markdown':
        return this.parseMarkdownSpec(content);
      case 'openapi':
        return this.parseOpenAPISpec(content);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Extract structured data from parsed content
   */
  private async extractStructuredData(
    rawData: unknown, 
    format: string, 
    options: ParseOptions
  ): Promise<Specification> {
    const extractor = this.getExtractorForFormat(format);
    return extractor(rawData, options);
  }

  /**
   * Get appropriate extractor based on format
   */
  private getExtractorForFormat(format: string) {
    const extractors = {
      yaml: this.extractFromYamlSpec.bind(this),
      json: this.extractFromJsonSpec.bind(this),
      markdown: this.extractFromMarkdownSpec.bind(this),
      openapi: this.extractFromOpenAPISpec.bind(this)
    };

    return extractors[format as keyof typeof extractors] || extractors.json;
  }

  /**
   * Extract from YAML specification
   */
  private extractFromYamlSpec(data: any, options: ParseOptions): Specification {
    return {
      id: data.id || this.generateId(),
      name: data.name || 'Unnamed Specification',
      version: data.version || '1.0.0',
      description: data.description || '',
      metadata: this.extractMetadata(data.metadata || {}),
      entities: this.extractEntities(data.entities || []),
      relationships: this.extractRelationships(data.relationships || []),
      constraints: this.extractConstraints(data.constraints || []),
      context: this.extractContext(data.context || {})
    };
  }

  /**
   * Extract from JSON specification
   */
  private extractFromJsonSpec(data: any, options: ParseOptions): Specification {
    return this.extractFromYamlSpec(data, options); // Same structure
  }

  /**
   * Extract from Markdown specification
   */
  private extractFromMarkdownSpec(data: any, options: ParseOptions): Specification {
    // Parse markdown structure and extract entities, relationships, etc.
    const { entities, relationships, constraints, context, metadata } = this.parseMarkdownContent(data);
    
    return {
      id: this.generateId(),
      name: metadata.title || 'Markdown Specification',
      version: '1.0.0',
      description: metadata.description || '',
      metadata: this.extractMetadata(metadata),
      entities,
      relationships,
      constraints,
      context
    };
  }

  /**
   * Extract from OpenAPI specification
   */
  private extractFromOpenAPISpec(data: any, options: ParseOptions): Specification {
    const openApiData = typeof data === 'string' ? JSON.parse(data) : data;
    
    return {
      id: this.generateId(),
      name: openApiData.info?.title || 'OpenAPI Specification',
      version: openApiData.info?.version || '1.0.0',
      description: openApiData.info?.description || '',
      metadata: this.extractOpenAPIMetadata(openApiData.info || {}),
      entities: this.extractOpenAPIEntities(openApiData),
      relationships: this.extractOpenAPIRelationships(openApiData),
      constraints: this.extractOpenAPIConstraints(openApiData),
      context: this.extractOpenAPIContext(openApiData)
    };
  }

  /**
   * Parse markdown content to extract specification elements
   */
  private parseMarkdownSpec(content: string): any {
    const lines = content.split('\n');
    const result: any = {
      title: '',
      description: '',
      entities: [],
      relationships: [],
      sections: {}
    };

    let currentSection = '';
    let currentEntity: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Headers
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const title = line.replace(/^#+\s*/, '');

        if (level === 1 && !result.title) {
          result.title = title;
        } else {
          currentSection = title.toLowerCase().replace(/\s+/g, '_');
          result.sections[currentSection] = [];
        }
        continue;
      }

      // Entity definitions (looking for patterns like "Entity: User")
      if (line.match(/^(Entity|Model|Service|Controller):\s*(.+)$/i)) {
        const match = line.match(/^(Entity|Model|Service|Controller):\s*(.+)$/i);
        if (match) {
          currentEntity = {
            name: match[2],
            type: match[1].toLowerCase(),
            properties: [],
            methods: []
          };
          result.entities.push(currentEntity);
        }
        continue;
      }

      // Properties (looking for bullet points or dashes)
      if (line.match(/^[-*]\s*(.+):\s*(.+)$/) && currentEntity) {
        const match = line.match(/^[-*]\s*(.+):\s*(.+)$/);
        if (match) {
          currentEntity.properties.push({
            name: match[1],
            type: match[2],
            required: true,
            constraints: [],
            annotations: []
          });
        }
        continue;
      }

      // Collect content for sections
      if (currentSection && line) {
        result.sections[currentSection].push(line);
      }

      // Description (first paragraph after title)
      if (!result.description && line && !line.startsWith('#') && !currentSection) {
        result.description = line;
      }
    }

    return result;
  }

  /**
   * Parse markdown content structure
   */
  private parseMarkdownContent(data: any): {
    entities: Entity[];
    relationships: Relationship[];
    constraints: Constraint[];
    context: SpecContext;
    metadata: any;
  } {
    const entities: Entity[] = (data.entities || []).map((entity: any) => ({
      id: this.generateId(),
      name: entity.name,
      type: entity.type || 'model',
      properties: entity.properties || [],
      methods: entity.methods || [],
      annotations: [],
      location: undefined
    }));

    return {
      entities,
      relationships: [],
      constraints: [],
      context: {
        domain: 'general',
        technology: {
          language: 'typescript',
          dependencies: []
        },
        patterns: [],
        requirements: []
      },
      metadata: {
        title: data.title,
        description: data.description,
        sections: data.sections
      }
    };
  }

  /**
   * Extract metadata from specification
   */
  private extractMetadata(data: any): SpecMetadata {
    return {
      author: data.author,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      tags: Array.isArray(data.tags) ? data.tags : [],
      category: data.category || 'general',
      priority: data.priority || 'medium',
      status: data.status || 'draft'
    };
  }

  /**
   * Extract entities from specification
   */
  private extractEntities(data: any[]): Entity[] {
    return data.map(entity => ({
      id: entity.id || this.generateId(),
      name: entity.name,
      type: entity.type || 'model',
      properties: this.extractProperties(entity.properties || []),
      methods: this.extractMethods(entity.methods || []),
      annotations: entity.annotations || [],
      location: entity.location
    }));
  }

  /**
   * Extract properties from entity
   */
  private extractProperties(data: any[]): any[] {
    return data.map(prop => ({
      name: prop.name,
      type: prop.type,
      required: prop.required !== false,
      defaultValue: prop.defaultValue,
      constraints: prop.constraints || [],
      annotations: prop.annotations || []
    }));
  }

  /**
   * Extract methods from entity
   */
  private extractMethods(data: any[]): any[] {
    return data.map(method => ({
      name: method.name,
      parameters: method.parameters || [],
      returnType: method.returnType || 'void',
      visibility: method.visibility || 'public',
      annotations: method.annotations || [],
      body: method.body
    }));
  }

  /**
   * Extract relationships from specification
   */
  private extractRelationships(data: any[]): Relationship[] {
    return data.map(rel => ({
      id: rel.id || this.generateId(),
      type: rel.type,
      source: rel.source,
      target: rel.target,
      cardinality: rel.cardinality || '1:1',
      annotations: rel.annotations || []
    }));
  }

  /**
   * Extract constraints from specification
   */
  private extractConstraints(data: any[]): Constraint[] {
    return data.map(constraint => ({
      id: constraint.id || this.generateId(),
      type: constraint.type,
      description: constraint.description,
      entities: constraint.entities || [],
      expression: constraint.expression || '',
      severity: constraint.severity || 'error'
    }));
  }

  /**
   * Extract context from specification
   */
  private extractContext(data: any): SpecContext {
    return {
      domain: data.domain || 'general',
      technology: {
        language: data.technology?.language || 'typescript',
        framework: data.technology?.framework,
        database: data.technology?.database,
        runtime: data.technology?.runtime,
        dependencies: data.technology?.dependencies || []
      },
      patterns: data.patterns || [],
      requirements: data.requirements || []
    };
  }

  /**
   * Extract OpenAPI-specific metadata
   */
  private extractOpenAPIMetadata(info: any): SpecMetadata {
    return {
      author: info.contact?.name,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      category: 'api',
      priority: 'medium',
      status: 'draft'
    };
  }

  /**
   * Extract entities from OpenAPI specification
   */
  private extractOpenAPIEntities(openApiData: any): Entity[] {
    const entities: Entity[] = [];
    const schemas = openApiData.components?.schemas || {};

    // Extract models from schemas
    Object.entries(schemas).forEach(([name, schema]: [string, any]) => {
      entities.push({
        id: this.generateId(),
        name,
        type: 'model',
        properties: this.extractOpenAPIProperties(schema.properties || {}),
        methods: [],
        annotations: [],
        location: undefined
      });
    });

    // Extract API endpoints as controllers
    Object.entries(openApiData.paths || {}).forEach(([path, methods]: [string, any]) => {
      const controllerName = this.pathToControllerName(path);
      const entity: Entity = {
        id: this.generateId(),
        name: controllerName,
        type: 'controller',
        properties: [],
        methods: [],
        annotations: [],
        location: undefined
      };

      Object.entries(methods).forEach(([method, operation]: [string, any]) => {
        entity.methods!.push({
          name: operation.operationId || `${method}${controllerName}`,
          parameters: this.extractOpenAPIParameters(operation.parameters || []),
          returnType: this.extractOpenAPIReturnType(operation.responses || {}),
          visibility: 'public',
          annotations: [{
            name: 'Route',
            parameters: { method: method.toUpperCase(), path }
          }]
        });
      });

      entities.push(entity);
    });

    return entities;
  }

  /**
   * Extract properties from OpenAPI schema
   */
  private extractOpenAPIProperties(properties: any): any[] {
    return Object.entries(properties).map(([name, prop]: [string, any]) => ({
      name,
      type: this.openApiTypeToTypeScript(prop.type, prop.format),
      required: true, // OpenAPI required is handled at schema level
      defaultValue: prop.default,
      constraints: this.extractOpenAPIConstraints(prop),
      annotations: []
    }));
  }

  /**
   * Extract parameters from OpenAPI operation
   */
  private extractOpenAPIParameters(parameters: any[]): any[] {
    return parameters.map(param => ({
      name: param.name,
      type: this.openApiTypeToTypeScript(param.schema?.type, param.schema?.format),
      required: param.required !== false,
      defaultValue: param.schema?.default
    }));
  }

  /**
   * Extract return type from OpenAPI responses
   */
  private extractOpenAPIReturnType(responses: any): string {
    const successResponse = responses['200'] || responses['201'] || responses['default'];
    if (successResponse?.content?.['application/json']?.schema) {
      const schema = successResponse.content['application/json'].schema;
      return this.openApiTypeToTypeScript(schema.type, schema.format);
    }
    return 'any';
  }

  /**
   * Extract constraints from OpenAPI property
   */
  private extractOpenAPIConstraints(prop: any): any[] {
    const constraints = [];
    
    if (prop.minLength !== undefined) {
      constraints.push({ type: 'length', value: { min: prop.minLength } });
    }
    if (prop.maxLength !== undefined) {
      constraints.push({ type: 'length', value: { max: prop.maxLength } });
    }
    if (prop.minimum !== undefined) {
      constraints.push({ type: 'range', value: { min: prop.minimum } });
    }
    if (prop.maximum !== undefined) {
      constraints.push({ type: 'range', value: { max: prop.maximum } });
    }
    if (prop.pattern) {
      constraints.push({ type: 'pattern', value: prop.pattern });
    }

    return constraints;
  }

  /**
   * Extract relationships from OpenAPI specification
   */
  private extractOpenAPIRelationships(openApiData: any): Relationship[] {
    // OpenAPI relationships are typically inferred from references
    return [];
  }

  /**
   * Extract context from OpenAPI specification
   */
  private extractOpenAPIContext(openApiData: any): SpecContext {
    return {
      domain: 'api',
      technology: {
        language: 'typescript',
        framework: 'express',
        dependencies: []
      },
      patterns: [
        {
          name: 'REST API',
          type: 'other',
          description: 'RESTful API pattern',
          applications: ['api']
        }
      ],
      requirements: []
    };
  }

  /**
   * Convert path to controller name
   */
  private pathToControllerName(path: string): string {
    return path
      .split('/')
      .filter(segment => segment && !segment.startsWith('{'))
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('') + 'Controller';
  }

  /**
   * Convert OpenAPI type to TypeScript type
   */
  private openApiTypeToTypeScript(type: string, format?: string): string {
    const typeMap: Record<string, string> = {
      'string': format === 'date-time' ? 'Date' : 'string',
      'integer': format === 'int64' ? 'bigint' : 'number',
      'number': 'number',
      'boolean': 'boolean',
      'array': 'Array<any>',
      'object': 'Record<string, any>'
    };

    return typeMap[type] || 'any';
  }

  /**
   * Validate specification against schema
   */
  private async validateSpecification(spec: Specification): Promise<void> {
    const schema = this.schemas.get('specification');
    if (schema) {
      schema.parse(spec);
    }
  }

  /**
   * Resolve references in specification
   */
  private resolveReferences(spec: Specification): Specification {
    // Implementation for resolving $ref and other references
    return spec;
  }

  /**
   * Initialize validation schemas
   */
  private initializeSchemas(): void {
    // Define Zod schemas for validation
    this.schemas.set('specification', z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      description: z.string(),
      metadata: z.object({}).passthrough(),
      entities: z.array(z.object({}).passthrough()),
      relationships: z.array(z.object({}).passthrough()),
      constraints: z.array(z.object({}).passthrough()),
      context: z.object({}).passthrough()
    }));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `spec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default parse options
   */
  private getDefaultParseOptions(): ParseOptions {
    return {
      strict: false,
      validateSchema: true,
      includeComments: true,
      resolveReferences: true
    };
  }
}

export { SpecificationParser };