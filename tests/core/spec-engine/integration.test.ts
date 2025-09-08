/**
 * Integration Tests for SpecEngine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpecEngine } from '../../../src/core/spec-engine/index.js';
import type { SpecEngineOptions } from '../../../src/core/spec-engine/index.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Mock file system operations
vi.mock('node:fs/promises');
vi.mock('node:fs');
vi.mock('glob');

describe('SpecEngine Integration', () => {
  let engine: SpecEngine;

  beforeEach(async () => {
    const options: SpecEngineOptions = {
      templatesDirectory: 'test-templates',
      outputDirectory: 'test-output',
      generationOptions: {
        dryRun: true // Prevent actual file writes in tests
      }
    };

    engine = new SpecEngine(options);

    // Setup basic mocks
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFile).mockResolvedValue('template content');
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined);

    await engine.initialize();
  });

  describe('End-to-End Workflow', () => {
    it('should complete full spec-to-code transformation', async () => {
      const yamlSpec = `
name: User Service
version: 1.0.0
description: A service for managing users
entities:
  - name: User
    type: model
    properties:
      - name: id
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: name
        type: string
        required: true
  - name: UserService
    type: service
    methods:
      - name: createUser
        parameters:
          - name: userData
            type: CreateUserDto
            required: true
        returnType: User
      - name: getUserById
        parameters:
          - name: id
            type: string
            required: true
        returnType: User
relationships: []
constraints: []
context:
  domain: user-management
  technology:
    language: typescript
    framework: express
`;

      // Mock template files
      const modelTemplate = `
---
entityTypes:
  - model
to: models/{{ entityName | kebabCase }}.model.ts
---
export interface {{ entityName }} {
  {% for property in properties %}
  {{ property.name }}: {{ property.type }};
  {% endfor %}
}
      `;

      const serviceTemplate = `
---
entityTypes:
  - service
to: services/{{ entityName | kebabCase }}.service.ts
---
export class {{ entityName }} {
  {% for method in methods %}
  async {{ method.name }}({{ method.parameters | join(', ') }}): Promise<{{ method.returnType }}> {
    // Implementation here
  }
  
  {% endfor %}
}
      `;

      vi.mocked(readFile)
        .mockResolvedValueOnce(modelTemplate)
        .mockResolvedValueOnce(serviceTemplate);

      const result = await engine.transformSpecToCode(yamlSpec, 'yaml');

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.statistics.entitiesProcessed).toBe(2);
    });

    it('should handle complex specifications with relationships', async () => {
      const complexSpec = `
name: Blog Platform
entities:
  - name: User
    type: model
    properties:
      - name: id
        type: string
      - name: username
        type: string
      - name: email
        type: string
  - name: Post
    type: model
    properties:
      - name: id
        type: string
      - name: title
        type: string
      - name: content
        type: string
      - name: authorId
        type: string
relationships:
  - type: hasMany
    source:
      entityId: user-1
    target:
      entityId: post-1
    cardinality: "1:n"
constraints:
  - type: validation
    description: Email must be unique
    entities:
      - user-1
    expression: "UNIQUE(email)"
context:
  technology:
    language: typescript
    framework: nestjs
`;

      const result = await engine.transformSpecToCode(complexSpec, 'yaml');

      expect(result.metadata.statistics.entitiesProcessed).toBe(2);
      expect(result.metadata.statistics.relationshipsProcessed).toBe(1);
    });
  });

  describe('Template Matching and Variables', () => {
    it('should correctly map specification variables to templates', async () => {
      const spec = `
name: Product Catalog
entities:
  - name: Product
    type: model
    properties:
      - name: id
        type: number
      - name: name
        type: string
      - name: price
        type: number
context:
  technology:
    language: typescript
`;

      const template = `
---
entityTypes:
  - model
variables:
  entityName: entities[0].name
  entityProps: entities[0].properties
to: "{{ entityName | lowerCase }}.interface.ts"
---
export interface {{ entityName }} {
  {% for prop in entityProps %}
  {{ prop.name }}: {{ prop.type }};
  {% endfor %}
}
      `;

      vi.mocked(readFile).mockResolvedValue(template);

      const result = await engine.transformSpecToCode(spec, 'yaml');

      expect(result.files).toHaveLength(1);
      expect(result.files[0].content).toContain('export interface Product');
      expect(result.files[0].content).toContain('id: number');
      expect(result.files[0].content).toContain('name: string');
      expect(result.files[0].content).toContain('price: number');
    });
  });

  describe('OpenAPI Integration', () => {
    it('should process OpenAPI specifications', async () => {
      const openApiSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Pet Store API',
          version: '1.0.0'
        },
        paths: {
          '/pets': {
            get: {
              operationId: 'listPets',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Pet' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                category: { type: 'string' }
              }
            }
          }
        }
      };

      const controllerTemplate = `
---
entityTypes:
  - controller
to: controllers/{{ entityName | kebabCase }}.controller.ts
---
@Controller()
export class {{ entityName }} {
  {% for method in methods %}
  @{{ method.annotations[0].parameters.method }}('{{ method.annotations[0].parameters.path }}')
  {{ method.name }}() {
    // Implementation
  }
  
  {% endfor %}
}
      `;

      vi.mocked(readFile).mockResolvedValue(controllerTemplate);

      const result = await engine.transformSpecToCode(
        JSON.stringify(openApiSpec), 
        'openapi'
      );

      expect(result.files.length).toBeGreaterThan(0);
    });
  });

  describe('Markdown Specification Processing', () => {
    it('should extract entities from markdown', async () => {
      const markdownSpec = `
# E-commerce System

A comprehensive e-commerce platform.

## Models

Entity: Product
- id: string
- name: string
- price: number
- categoryId: string

Entity: Category
- id: string
- name: string
- description: string

## Services

Service: ProductService
- findById: method
- create: method
- update: method
- delete: method

## Requirements

- Products must have unique names
- Categories can contain multiple products
- Prices must be positive numbers
      `;

      const entityTemplate = `
---
to: entities/{{ entityName | kebabCase }}.entity.ts
---
export class {{ entityName }} {
  {% for property in properties %}
  {{ property.name }}: {{ property.type }};
  {% endfor %}
}
      `;

      vi.mocked(readFile).mockResolvedValue(entityTemplate);

      const result = await engine.transformSpecToCode(markdownSpec, 'markdown');

      expect(result.metadata.statistics.entitiesProcessed).toBeGreaterThan(0);
    });
  });

  describe('Validation and Preview', () => {
    it('should validate specifications', async () => {
      const validSpec = `
name: Valid Spec
description: A valid specification
entities:
  - name: TestEntity
    type: model
    properties:
      - name: id
        type: string
relationships: []
constraints: []
      `;

      const validation = await engine.validateSpecification(validSpec, 'yaml');

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should generate preview without writing files', async () => {
      const spec = `
name: Preview Test
entities:
  - name: TestEntity
    type: model
    properties:
      - name: id
        type: string
      `;

      const template = `
---
to: preview.ts
---
export class {{ entities[0].name }} {}
      `;

      vi.mocked(readFile).mockResolvedValue(template);

      const preview = await engine.previewGeneration(spec, 'yaml');

      expect(preview.files).toHaveLength(1);
      expect(preview.files[0].content).toContain('export class TestEntity');
      
      // Verify writeFile was not called (dry run)
      expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
    });
  });

  describe('Custom Template Mappings', () => {
    it('should allow adding custom template mappings', async () => {
      const customMapping = {
        specPattern: {
          entityTypes: ['custom' as any],
          relationshipTypes: [],
          technologyStack: {},
          patterns: []
        },
        templatePath: 'custom/template.ejs',
        variables: [
          {
            specPath: 'entities[0].name',
            templateVariable: 'name'
          }
        ],
        conditions: [],
        priority: 20
      };

      engine.addTemplateMapping('custom', customMapping);

      const spec = await engine.parseSpecification(`
name: Custom Test
entities:
  - name: CustomEntity
    type: custom
    properties: []
      `, 'yaml');

      const mappings = await engine.findMatchingTemplates(spec);
      
      expect(mappings.some(m => m.templatePath === 'custom/template.ejs')).toBe(true);
    });
  });

  describe('Traceability', () => {
    it('should track traceability when enabled', async () => {
      const spec = `
name: Traceability Test
entities:
  - name: TrackedEntity
    type: model
    properties:
      - name: id
        type: string
      `;

      const template = `
---
to: tracked.ts
---
export class TrackedEntity {
  id: string;
}
      `;

      vi.mocked(readFile).mockResolvedValue(template);

      const result = await engine.transformSpecToCode(spec, 'yaml');
      const tracker = engine.getTraceabilityTracker();

      expect(result.traceability.length).toBeGreaterThan(0);
      
      const records = tracker.getRecordsForFile('tracked.ts');
      expect(records.length).toBeGreaterThan(0);
    });
  });

  describe('Engine Statistics', () => {
    it('should provide engine statistics', () => {
      const stats = engine.getEngineStatistics();

      expect(stats.engineVersion).toBeDefined();
      expect(stats.supportedSpecFormats).toContain('yaml');
      expect(stats.supportedSpecFormats).toContain('json');
      expect(stats.supportedSpecFormats).toContain('markdown');
      expect(stats.supportedSpecFormats).toContain('openapi');
      expect(stats.supportedEntityTypes).toContain('model');
      expect(stats.supportedEntityTypes).toContain('service');
      expect(stats.supportedEntityTypes).toContain('controller');
    });
  });

  describe('Error Recovery', () => {
    it('should gracefully handle missing templates directory', async () => {
      const emptyEngine = new SpecEngine({
        templatesDirectory: 'non-existent-templates'
      });

      await emptyEngine.initialize(); // Should not throw

      const spec = 'name: Test\nentities: []';
      const result = await emptyEngine.transformSpecToCode(spec, 'yaml');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].type).toBe('no_templates');
    });

    it('should handle malformed specifications gracefully', async () => {
      const malformedSpec = `
name: 123
entities: "not an array"
relationships: null
      `;

      // Should not throw, but may have warnings/errors
      const result = await engine.transformSpecToCode(malformedSpec, 'yaml');
      expect(result).toBeDefined();
    });
  });
});