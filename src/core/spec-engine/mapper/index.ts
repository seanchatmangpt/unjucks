/**
 * Template Mapper - Maps specifications to appropriate unjucks templates
 */

import { glob } from 'glob';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import type { 
  Specification, 
  TemplateMapping, 
  SpecPattern, 
  MappingOptions, 
  VariableMapping,
  EntityType,
  RelationshipType,
  TechnologyStack 
} from '../types/index.js';

export class TemplateMapper {
  private mappings: Map<string, TemplateMapping[]> = new Map();
  private templateCache: Map<string, any> = new Map();

  constructor(
    private readonly templatesDirectory: string = 'templates',
    private readonly mappingFile?: string
  ) {}

  /**
   * Initialize mapper by scanning templates and loading mappings
   */
  async initialize(): Promise<void> {
    await this.scanTemplateDirectory();
    if (this.mappingFile) {
      await this.loadMappingFile();
    }
    await this.buildAutomaticMappings();
  }

  /**
   * Find matching templates for a specification
   */
  async findMatchingTemplates(
    spec: Specification, 
    options: MappingOptions = this.getDefaultMappingOptions()
  ): Promise<TemplateMapping[]> {
    const allMappings = this.getAllMappings();
    const matches: Array<TemplateMapping & { score: number }> = [];

    for (const mapping of allMappings) {
      const score = this.calculateMappingScore(spec, mapping);
      
      if (score >= options.priorityThreshold) {
        matches.push({ ...mapping, score });
      } else if (options.allowPartialMatch && score > 0) {
        matches.push({ ...mapping, score });
      }
    }

    // Sort by score (highest first) and priority
    matches.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return b.priority - a.priority;
    });

    return matches.map(({ score, ...mapping }) => mapping);
  }

  /**
   * Get best matching template for a specification
   */
  async getBestMatch(
    spec: Specification, 
    options: MappingOptions = this.getDefaultMappingOptions()
  ): Promise<TemplateMapping | null> {
    const matches = await this.findMatchingTemplates(spec, options);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Map specification variables to template variables
   */
  async mapVariables(
    spec: Specification, 
    mapping: TemplateMapping
  ): Promise<Record<string, unknown>> {
    const variables: Record<string, unknown> = {};

    for (const variableMapping of mapping.variables) {
      const value = this.extractValueFromSpec(spec, variableMapping.specPath);
      const transformedValue = this.transformValue(value, variableMapping.transformer);
      
      variables[variableMapping.templateVariable] = transformedValue ?? variableMapping.defaultValue;
    }

    // Add common variables
    variables.spec = spec;
    variables.entities = spec.entities;
    variables.relationships = spec.relationships;
    variables.context = spec.context;

    return variables;
  }

  /**
   * Check if mapping conditions are satisfied
   */
  checkMappingConditions(spec: Specification, mapping: TemplateMapping): boolean {
    return mapping.conditions.every(condition => {
      const value = this.extractValueFromSpec(spec, condition.path);
      
      switch (condition.type) {
        case 'exists':
          return value !== undefined && value !== null;
        
        case 'equals':
          return value === condition.value;
        
        case 'contains':
          if (Array.isArray(value)) {
            return value.includes(condition.value);
          }
          if (typeof value === 'string') {
            return value.includes(condition.value as string);
          }
          return false;
        
        case 'matches':
          if (typeof value === 'string' && condition.pattern) {
            return new RegExp(condition.pattern).test(value);
          }
          return false;
        
        default:
          return false;
      }
    });
  }

  /**
   * Add custom mapping
   */
  addMapping(category: string, mapping: TemplateMapping): void {
    const existing = this.mappings.get(category) || [];
    existing.push(mapping);
    this.mappings.set(category, existing);
  }

  /**
   * Remove mapping
   */
  removeMapping(category: string, templatePath: string): void {
    const existing = this.mappings.get(category) || [];
    const filtered = existing.filter(m => m.templatePath !== templatePath);
    this.mappings.set(category, filtered);
  }

  /**
   * Get all mappings
   */
  getAllMappings(): TemplateMapping[] {
    const all: TemplateMapping[] = [];
    for (const mappings of this.mappings.values()) {
      all.push(...mappings);
    }
    return all;
  }

  /**
   * Scan template directory for available templates
   */
  private async scanTemplateDirectory(): Promise<void> {
    try {
      const templateFiles = await glob('**/*.ejs', {
        cwd: this.templatesDirectory,
        absolute: false
      });

      for (const templatePath of templateFiles) {
        await this.analyzeTemplate(templatePath);
      }
    } catch (error) {
      console.warn(`Failed to scan template directory: ${error}`);
    }
  }

  /**
   * Analyze template to extract metadata and create mappings
   */
  private async analyzeTemplate(templatePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.templatesDirectory, templatePath);
      const content = await readFile(fullPath, 'utf-8');
      
      // Extract frontmatter
      const frontmatter = this.extractFrontmatter(content);
      
      if (frontmatter) {
        const mapping = this.createMappingFromFrontmatter(templatePath, frontmatter);
        const category = this.getTemplateCategory(templatePath, frontmatter);
        this.addMapping(category, mapping);
      }

      // Cache template for later use
      this.templateCache.set(templatePath, {
        content,
        frontmatter,
        variables: this.extractTemplateVariables(content)
      });
    } catch (error) {
      console.warn(`Failed to analyze template ${templatePath}: ${error}`);
    }
  }

  /**
   * Extract frontmatter from template
   */
  private extractFrontmatter(content: string): any {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (frontmatterMatch) {
      try {
        return yaml.load(frontmatterMatch[1]);
      } catch (error) {
        console.warn(`Failed to parse frontmatter: ${error}`);
      }
    }
    return null;
  }

  /**
   * Extract template variables from content
   */
  private extractTemplateVariables(content: string): string[] {
    const variables = new Set<string>();
    
    // Extract EJS variables: <%= variable %>, <%- variable %>, <% variable %>
    const ejsMatches = content.match(/<%-?\s*([^%\s]+)[\s\S]*?%>/g) || [];
    ejsMatches.forEach(match => {
      const variable = match.replace(/<%-?\s*([^%\s.]+)[\s\S]*?%>/, '$1');
      if (variable && !variable.includes('(') && !variable.includes('=')) {
        variables.add(variable);
      }
    });

    // Extract Nunjucks variables: {{ variable }}
    const nunjucksMatches = content.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
    nunjucksMatches.forEach(match => {
      const variable = match.replace(/\{\{\s*([^}\s.]+)[\s\S]*?\}\}/, '$1');
      if (variable && !variable.includes('(') && !variable.includes('=')) {
        variables.add(variable);
      }
    });

    return Array.from(variables);
  }

  /**
   * Create mapping from template frontmatter
   */
  private createMappingFromFrontmatter(templatePath: string, frontmatter: any): TemplateMapping {
    return {
      specPattern: {
        entityTypes: frontmatter.entityTypes || [],
        relationshipTypes: frontmatter.relationshipTypes || [],
        technologyStack: frontmatter.technologyStack || {},
        patterns: frontmatter.patterns || []
      },
      templatePath,
      variables: this.createVariableMappings(frontmatter.variables || {}),
      conditions: frontmatter.conditions || [],
      priority: frontmatter.priority || 0
    };
  }

  /**
   * Create variable mappings from frontmatter
   */
  private createVariableMappings(variables: Record<string, any>): VariableMapping[] {
    return Object.entries(variables).map(([templateVar, config]) => {
      if (typeof config === 'string') {
        return {
          specPath: config,
          templateVariable: templateVar
        };
      }
      
      return {
        specPath: config.specPath || templateVar,
        templateVariable: templateVar,
        transformer: config.transformer,
        defaultValue: config.defaultValue
      };
    });
  }

  /**
   * Get template category from path and frontmatter
   */
  private getTemplateCategory(templatePath: string, frontmatter: any): string {
    if (frontmatter?.category) {
      return frontmatter.category;
    }

    const pathParts = templatePath.split('/');
    return pathParts[0] || 'general';
  }

  /**
   * Load mapping file if specified
   */
  private async loadMappingFile(): Promise<void> {
    if (!this.mappingFile) return;

    try {
      const content = await readFile(this.mappingFile, 'utf-8');
      const mappingData = yaml.load(content) as any;

      Object.entries(mappingData).forEach(([category, mappings]: [string, any]) => {
        if (Array.isArray(mappings)) {
          mappings.forEach(mapping => this.addMapping(category, mapping));
        }
      });
    } catch (error) {
      console.warn(`Failed to load mapping file: ${error}`);
    }
  }

  /**
   * Build automatic mappings based on conventions
   */
  private async buildAutomaticMappings(): Promise<void> {
    // Create automatic mappings based on template structure and naming conventions
    const conventions = [
      {
        pattern: /model|entity/i,
        entityTypes: ['model' as EntityType],
        priority: 1
      },
      {
        pattern: /service/i,
        entityTypes: ['service' as EntityType],
        priority: 1
      },
      {
        pattern: /controller/i,
        entityTypes: ['controller' as EntityType],
        priority: 1
      },
      {
        pattern: /repository/i,
        entityTypes: ['repository' as EntityType],
        priority: 1
      },
      {
        pattern: /component/i,
        entityTypes: ['component' as EntityType],
        priority: 1
      }
    ];

    for (const [templatePath, templateInfo] of this.templateCache.entries()) {
      for (const convention of conventions) {
        if (convention.pattern.test(templatePath)) {
          const mapping: TemplateMapping = {
            specPattern: {
              entityTypes: convention.entityTypes,
              relationshipTypes: [],
              technologyStack: {},
              patterns: []
            },
            templatePath,
            variables: this.createAutomaticVariableMappings(templateInfo.variables),
            conditions: [],
            priority: convention.priority
          };

          const category = 'automatic';
          this.addMapping(category, mapping);
        }
      }
    }
  }

  /**
   * Create automatic variable mappings
   */
  private createAutomaticVariableMappings(variables: string[]): VariableMapping[] {
    const commonMappings: Record<string, string> = {
      'name': 'name',
      'entityName': 'entities[0].name',
      'entities': 'entities',
      'properties': 'entities[0].properties',
      'methods': 'entities[0].methods',
      'description': 'description',
      'version': 'version',
      'author': 'metadata.author'
    };

    return variables.map(variable => ({
      specPath: commonMappings[variable] || variable,
      templateVariable: variable,
      defaultValue: this.getDefaultValueForVariable(variable)
    }));
  }

  /**
   * Get default value for a variable
   */
  private getDefaultValueForVariable(variable: string): unknown {
    const defaults: Record<string, unknown> = {
      'name': 'UnnamedEntity',
      'version': '1.0.0',
      'description': '',
      'author': 'Unknown',
      'entities': [],
      'properties': [],
      'methods': []
    };

    return defaults[variable];
  }

  /**
   * Calculate mapping score for a specification
   */
  private calculateMappingScore(spec: Specification, mapping: TemplateMapping): number {
    let score = 0;
    const pattern = mapping.specPattern;

    // Check entity types
    if (pattern.entityTypes.length > 0) {
      const specEntityTypes = new Set(spec.entities.map(e => e.type));
      const matchingEntityTypes = pattern.entityTypes.filter(type => specEntityTypes.has(type));
      score += (matchingEntityTypes.length / pattern.entityTypes.length) * 30;
    }

    // Check relationship types
    if (pattern.relationshipTypes.length > 0) {
      const specRelationshipTypes = new Set(spec.relationships.map(r => r.type));
      const matchingRelationshipTypes = pattern.relationshipTypes.filter(type => 
        specRelationshipTypes.has(type)
      );
      score += (matchingRelationshipTypes.length / pattern.relationshipTypes.length) * 20;
    }

    // Check technology stack
    if (pattern.technologyStack.language) {
      if (spec.context.technology.language === pattern.technologyStack.language) {
        score += 25;
      }
    }

    if (pattern.technologyStack.framework) {
      if (spec.context.technology.framework === pattern.technologyStack.framework) {
        score += 15;
      }
    }

    // Check patterns
    if (pattern.patterns.length > 0) {
      const specPatterns = new Set(spec.context.patterns.map(p => p.name));
      const matchingPatterns = pattern.patterns.filter(p => specPatterns.has(p));
      score += (matchingPatterns.length / pattern.patterns.length) * 10;
    }

    // Check conditions
    if (this.checkMappingConditions(spec, mapping)) {
      score += mapping.priority;
    }

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Extract value from specification using path
   */
  private extractValueFromSpec(spec: Specification, path: string): unknown {
    try {
      return this.getNestedValue(spec, path);
    } catch {
      return undefined;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        // Handle array access like entities[0]
        const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, arrayKey, index] = arrayMatch;
          const array = current[arrayKey];
          return Array.isArray(array) ? array[parseInt(index, 10)] : undefined;
        }
        return current[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Transform value using specified transformer
   */
  private transformValue(value: unknown, transformer?: string): unknown {
    if (!transformer) return value;

    const transformers: Record<string, (val: unknown) => unknown> = {
      'upperCase': (val) => typeof val === 'string' ? val.toUpperCase() : val,
      'lowerCase': (val) => typeof val === 'string' ? val.toLowerCase() : val,
      'camelCase': (val) => typeof val === 'string' ? this.toCamelCase(val) : val,
      'pascalCase': (val) => typeof val === 'string' ? this.toPascalCase(val) : val,
      'kebabCase': (val) => typeof val === 'string' ? this.toKebabCase(val) : val,
      'snakeCase': (val) => typeof val === 'string' ? this.toSnakeCase(val) : val,
      'pluralize': (val) => typeof val === 'string' ? this.pluralize(val) : val,
      'singularize': (val) => typeof val === 'string' ? this.singularize(val) : val
    };

    const transform = transformers[transformer];
    return transform ? transform(value) : value;
  }

  /**
   * Convert string to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    const camelCase = this.toCamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  }

  /**
   * Convert string to kebab-case
   */
  private toKebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-');
  }

  /**
   * Convert string to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[\s-]+/g, '_');
  }

  /**
   * Simple pluralization (can be enhanced with a proper library)
   */
  private pluralize(str: string): string {
    if (str.endsWith('y')) {
      return str.slice(0, -1) + 'ies';
    }
    if (str.endsWith('s') || str.endsWith('sh') || str.endsWith('ch') || str.endsWith('x') || str.endsWith('z')) {
      return str + 'es';
    }
    return str + 's';
  }

  /**
   * Simple singularization
   */
  private singularize(str: string): string {
    if (str.endsWith('ies')) {
      return str.slice(0, -3) + 'y';
    }
    if (str.endsWith('es')) {
      return str.slice(0, -2);
    }
    if (str.endsWith('s') && !str.endsWith('ss')) {
      return str.slice(0, -1);
    }
    return str;
  }

  /**
   * Get default mapping options
   */
  private getDefaultMappingOptions(): MappingOptions {
    return {
      allowPartialMatch: true,
      fallbackToDefault: true,
      priorityThreshold: 10,
      includeExperimental: false
    };
  }
}

export { TemplateMapper };