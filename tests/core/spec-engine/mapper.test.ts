/**
 * Tests for TemplateMapper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateMapper } from '../../../src/core/spec-engine/mapper/index.js';
import type { 
  Specification, 
  TemplateMapping, 
  MappingOptions 
} from '../../../src/core/spec-engine/types/index.js';
import { readFile } from 'node:fs/promises';

// Mock fs functions
vi.mock('node:fs/promises');
vi.mock('glob');

describe('TemplateMapper', () => {
  let mapper: TemplateMapper;
  let mockSpec: Specification;

  beforeEach(() => {
    mapper = new TemplateMapper('test-templates');
    
    mockSpec = {
      id: 'test-spec',
      name: 'Test Specification',
      version: '1.0.0',
      description: 'A test specification',
      metadata: {
        author: 'Test Author',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['test'],
        category: 'general',
        priority: 'medium',
        status: 'draft'
      },
      entities: [
        {
          id: 'user-entity',
          name: 'User',
          type: 'model',
          properties: [
            {
              name: 'id',
              type: 'string',
              required: true,
              constraints: [],
              annotations: []
            },
            {
              name: 'email',
              type: 'string',
              required: true,
              constraints: [],
              annotations: []
            }
          ],
          methods: [],
          annotations: []
        }
      ],
      relationships: [],
      constraints: [],
      context: {
        domain: 'user-management',
        technology: {
          language: 'typescript',
          framework: 'express',
          dependencies: []
        },
        patterns: [],
        requirements: []
      }
    };

    // Mock file system calls
    vi.mocked(readFile).mockResolvedValue(`
---
entityTypes:
  - model
technologyStack:
  language: typescript
variables:
  entityName: entities[0].name
  properties: entities[0].properties
priority: 10
---
class {{ entityName }} {
  {% for prop in properties %}
  {{ prop.name }}: {{ prop.type }};
  {% endfor %}
}
    `);
  });

  describe('Template Mapping', () => {
    it('should find matching templates for specification', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: {
          entityTypes: ['model'],
          relationshipTypes: [],
          technologyStack: { language: 'typescript' },
          patterns: []
        },
        templatePath: 'model/entity.ejs',
        variables: [
          {
            specPath: 'entities[0].name',
            templateVariable: 'entityName'
          }
        ],
        conditions: [],
        priority: 10
      };

      mapper.addMapping('models', mockMapping);

      const matches = await mapper.findMatchingTemplates(mockSpec);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].templatePath).toBe('model/entity.ejs');
    });

    it('should calculate mapping scores correctly', async () => {
      const highScoreMapping: TemplateMapping = {
        specPattern: {
          entityTypes: ['model'], // Matches
          relationshipTypes: [],
          technologyStack: { language: 'typescript' }, // Matches
          patterns: []
        },
        templatePath: 'high-score.ejs',
        variables: [],
        conditions: [],
        priority: 20
      };

      const lowScoreMapping: TemplateMapping = {
        specPattern: {
          entityTypes: ['service'], // Doesn't match
          relationshipTypes: [],
          technologyStack: { language: 'javascript' }, // Doesn't match
          patterns: []
        },
        templatePath: 'low-score.ejs',
        variables: [],
        conditions: [],
        priority: 5
      };

      mapper.addMapping('test', highScoreMapping);
      mapper.addMapping('test', lowScoreMapping);

      const matches = await mapper.findMatchingTemplates(mockSpec);
      
      expect(matches[0].templatePath).toBe('high-score.ejs'); // Should be first (higher score)
    });

    it('should get best matching template', async () => {
      const bestMapping: TemplateMapping = {
        specPattern: {
          entityTypes: ['model'],
          relationshipTypes: [],
          technologyStack: { language: 'typescript' },
          patterns: []
        },
        templatePath: 'best-match.ejs',
        variables: [],
        conditions: [],
        priority: 30
      };

      mapper.addMapping('best', bestMapping);

      const bestMatch = await mapper.getBestMatch(mockSpec);
      
      expect(bestMatch).toBeDefined();
      expect(bestMatch?.templatePath).toBe('best-match.ejs');
    });
  });

  describe('Variable Mapping', () => {
    it('should map specification variables to template variables', async () => {
      const mapping: TemplateMapping = {
        specPattern: {
          entityTypes: ['model'],
          relationshipTypes: [],
          technologyStack: {},
          patterns: []
        },
        templatePath: 'test.ejs',
        variables: [
          {
            specPath: 'name',
            templateVariable: 'specName'
          },
          {
            specPath: 'entities[0].name',
            templateVariable: 'entityName'
          },
          {
            specPath: 'entities[0].properties',
            templateVariable: 'properties'
          },
          {
            specPath: 'nonexistent.path',
            templateVariable: 'missing',
            defaultValue: 'default-value'
          }
        ],
        conditions: [],
        priority: 1
      };

      const variables = await mapper.mapVariables(mockSpec, mapping);

      expect(variables.specName).toBe('Test Specification');
      expect(variables.entityName).toBe('User');
      expect(variables.properties).toEqual(mockSpec.entities[0].properties);
      expect(variables.missing).toBe('default-value');
      expect(variables.spec).toBe(mockSpec); // Common variable
    });

    it('should apply transformations to variables', async () => {
      const mapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [
          {
            specPath: 'entities[0].name',
            templateVariable: 'upperCaseName',
            transformer: 'upperCase'
          },
          {
            specPath: 'entities[0].name',
            templateVariable: 'camelCaseName',
            transformer: 'camelCase'
          },
          {
            specPath: 'entities[0].name',
            templateVariable: 'kebabCaseName',
            transformer: 'kebabCase'
          },
          {
            specPath: 'entities[0].name',
            templateVariable: 'pluralName',
            transformer: 'pluralize'
          }
        ],
        conditions: [],
        priority: 1
      };

      const variables = await mapper.mapVariables(mockSpec, mapping);

      expect(variables.upperCaseName).toBe('USER');
      expect(variables.camelCaseName).toBe('user');
      expect(variables.kebabCaseName).toBe('user');
      expect(variables.pluralName).toBe('Users');
    });
  });

  describe('Mapping Conditions', () => {
    it('should check exists conditions', () => {
      const mapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [],
        conditions: [
          {
            type: 'exists',
            path: 'entities[0].name'
          },
          {
            type: 'exists',
            path: 'nonexistent.path'
          }
        ],
        priority: 1
      };

      const result1 = mapper.checkMappingConditions(mockSpec, {
        ...mapping,
        conditions: [mapping.conditions[0]]
      });
      expect(result1).toBe(true);

      const result2 = mapper.checkMappingConditions(mockSpec, {
        ...mapping,
        conditions: [mapping.conditions[1]]
      });
      expect(result2).toBe(false);
    });

    it('should check equals conditions', () => {
      const mapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [],
        conditions: [
          {
            type: 'equals',
            path: 'entities[0].name',
            value: 'User'
          },
          {
            type: 'equals',
            path: 'entities[0].name',
            value: 'Product'
          }
        ],
        priority: 1
      };

      const result1 = mapper.checkMappingConditions(mockSpec, {
        ...mapping,
        conditions: [mapping.conditions[0]]
      });
      expect(result1).toBe(true);

      const result2 = mapper.checkMappingConditions(mockSpec, {
        ...mapping,
        conditions: [mapping.conditions[1]]
      });
      expect(result2).toBe(false);
    });

    it('should check contains conditions', () => {
      const mapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [],
        conditions: [
          {
            type: 'contains',
            path: 'metadata.tags',
            value: 'test'
          },
          {
            type: 'contains',
            path: 'name',
            value: 'Test'
          }
        ],
        priority: 1
      };

      const result1 = mapper.checkMappingConditions(mockSpec, {
        ...mapping,
        conditions: [mapping.conditions[0]]
      });
      expect(result1).toBe(true);

      const result2 = mapper.checkMappingConditions(mockSpec, {
        ...mapping,
        conditions: [mapping.conditions[1]]
      });
      expect(result2).toBe(true);
    });

    it('should check matches conditions', () => {
      const mapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [],
        conditions: [
          {
            type: 'matches',
            path: 'entities[0].name',
            pattern: '^U.*'
          },
          {
            type: 'matches',
            path: 'entities[0].name',
            pattern: '^P.*'
          }
        ],
        priority: 1
      };

      const result1 = mapper.checkMappingConditions(mockSpec, {
        ...mapping,
        conditions: [mapping.conditions[0]]
      });
      expect(result1).toBe(true);

      const result2 = mapper.checkMappingConditions(mockSpec, {
        ...mapping,
        conditions: [mapping.conditions[1]]
      });
      expect(result2).toBe(false);
    });
  });

  describe('Mapping Options', () => {
    it('should respect priority threshold', async () => {
      const lowPriorityMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'low-priority.ejs',
        variables: [],
        conditions: [],
        priority: 5
      };

      mapper.addMapping('test', lowPriorityMapping);

      const options: MappingOptions = {
        allowPartialMatch: false,
        fallbackToDefault: false,
        priorityThreshold: 10,
        includeExperimental: false
      };

      const matches = await mapper.findMatchingTemplates(mockSpec, options);
      expect(matches).toHaveLength(0); // Should be filtered out by threshold
    });

    it('should handle partial matches when enabled', async () => {
      const partialMapping: TemplateMapping = {
        specPattern: {
          entityTypes: ['service'], // Doesn't match
          relationshipTypes: [],
          technologyStack: { language: 'typescript' }, // Matches
          patterns: []
        },
        templatePath: 'partial-match.ejs',
        variables: [],
        conditions: [],
        priority: 15
      };

      mapper.addMapping('test', partialMapping);

      const optionsWithPartial: MappingOptions = {
        allowPartialMatch: true,
        fallbackToDefault: false,
        priorityThreshold: 10,
        includeExperimental: false
      };

      const matches = await mapper.findMatchingTemplates(mockSpec, optionsWithPartial);
      expect(matches.length).toBeGreaterThan(0);

      const optionsWithoutPartial: MappingOptions = {
        allowPartialMatch: false,
        fallbackToDefault: false,
        priorityThreshold: 10,
        includeExperimental: false
      };

      const matchesStrict = await mapper.findMatchingTemplates(mockSpec, optionsWithoutPartial);
      expect(matchesStrict).toHaveLength(0);
    });
  });

  describe('Template Management', () => {
    it('should add and remove mappings', () => {
      const mapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test-mapping.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      mapper.addMapping('test-category', mapping);
      
      let allMappings = mapper.getAllMappings();
      expect(allMappings).toContain(mapping);

      mapper.removeMapping('test-category', 'test-mapping.ejs');
      
      allMappings = mapper.getAllMappings();
      expect(allMappings).not.toContain(mapping);
    });

    it('should get all mappings', () => {
      const mapping1: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'mapping1.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      const mapping2: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'mapping2.ejs',
        variables: [],
        conditions: [],
        priority: 2
      };

      mapper.addMapping('category1', mapping1);
      mapper.addMapping('category2', mapping2);

      const allMappings = mapper.getAllMappings();
      expect(allMappings).toHaveLength(2);
      expect(allMappings).toContain(mapping1);
      expect(allMappings).toContain(mapping2);
    });
  });

  describe('String Transformations', () => {
    it('should handle case transformations correctly', async () => {
      const mapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [
          {
            specPath: 'name',
            templateVariable: 'pascalCase',
            transformer: 'pascalCase'
          },
          {
            specPath: 'name',
            templateVariable: 'snakeCase',
            transformer: 'snakeCase'
          }
        ],
        conditions: [],
        priority: 1
      };

      // Update mock spec name to test transformations
      const testSpec = {
        ...mockSpec,
        name: 'test specification name'
      };

      const variables = await mapper.mapVariables(testSpec, mapping);

      expect(variables.pascalCase).toBe('TestSpecificationName');
      expect(variables.snakeCase).toBe('test_specification_name');
    });

    it('should handle pluralization and singularization', async () => {
      const mapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [
          {
            specPath: 'entities[0].name',
            templateVariable: 'singular',
            transformer: 'singularize'
          }
        ],
        conditions: [],
        priority: 1
      };

      // Test with plural entity name
      const testSpec = {
        ...mockSpec,
        entities: [{
          ...mockSpec.entities[0],
          name: 'Users'
        }]
      };

      const variables = await mapper.mapVariables(testSpec, mapping);

      expect(variables.singular).toBe('User');
    });
  });
});