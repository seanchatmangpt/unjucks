/**
 * Tests for CodeGenerator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodeGenerator } from '../../../src/core/spec-engine/generator/index.js';
import { TemplateMapper } from '../../../src/core/spec-engine/mapper/index.js';
import type {
  Specification,
  GenerationOptions,
  TemplateMapping
} from '../../../src/core/spec-engine/types/index.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Mock file system operations
vi.mock('node:fs/promises');
vi.mock('node:fs');

describe('CodeGenerator', () => {
  let generator: CodeGenerator;
  let mockMapper: TemplateMapper;
  let mockSpec: Specification;

  beforeEach(() => {
    mockMapper = {
      findMatchingTemplates: vi.fn(),
      mapVariables: vi.fn()
    } as any;

    generator = new CodeGenerator(mockMapper, 'test-templates', 'test-output');

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

    // Setup mocks
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFile).mockResolvedValue('template content');
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined);
  });

  describe('Code Generation from Specification', () => {
    it('should generate code from specification', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: {
          entityTypes: ['model'],
          relationshipTypes: [],
          technologyStack: {},
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

      const templateContent = `
---
to: test-output/{{ entityName | lowerCase }}.model.ts
---
export class {{ entityName }} {
  {% for property in properties %}
  public {{ property.name }}: {{ property.type }};
  {% endfor %}
}
      `;

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({
        entityName: 'User',
        properties: mockSpec.entities[0].properties
      });
      vi.mocked(readFile).mockResolvedValue(templateContent);

      const result = await generator.generateFromSpecification(mockSpec);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toContain('user.model.ts');
      expect(result.files[0].content).toContain('export class User');
      expect(result.files[0].content).toContain('public id: string');
      expect(result.files[0].content).toContain('public email: string');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle multiple template mappings', async () => {
      const modelMapping: TemplateMapping = {
        specPattern: { entityTypes: ['model'], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'model/entity.ejs',
        variables: [],
        conditions: [],
        priority: 10
      };

      const serviceMapping: TemplateMapping = {
        specPattern: { entityTypes: ['model'], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'service/entity.service.ejs',
        variables: [],
        conditions: [],
        priority: 8
      };

      const modelTemplate = `
---
to: models/{{ entityName | lowerCase }}.model.ts
---
export class {{ entityName }} {}
      `;

      const serviceTemplate = `
---
to: services/{{ entityName | lowerCase }}.service.ts
---
export class {{ entityName }}Service {}
      `;

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([modelMapping, serviceMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({
        entityName: 'User'
      });
      
      vi.mocked(readFile)
        .mockResolvedValueOnce(modelTemplate)
        .mockResolvedValueOnce(serviceTemplate);

      const result = await generator.generateFromSpecification(mockSpec);

      expect(result.files).toHaveLength(2);
      expect(result.files[0].path).toContain('user.model.ts');
      expect(result.files[1].path).toContain('user.service.ts');
    });

    it('should handle generation warnings and errors', async () => {
      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([]);

      const result = await generator.generateFromSpecification(mockSpec);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('no_templates');
      expect(result.files).toHaveLength(0);
    });

    it('should include traceability when enabled', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: ['model'], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'model/entity.ejs',
        variables: [],
        conditions: [],
        priority: 10
      };

      const templateContent = `
---
to: {{ entityName | lowerCase }}.ts
---
export class {{ entityName }} {}
      `;

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({ entityName: 'User' });
      vi.mocked(readFile).mockResolvedValue(templateContent);

      const options: GenerationOptions = {
        dryRun: false,
        overwriteExisting: false,
        createDirectories: true,
        preserveFormatting: true,
        includeTraceability: true
      };

      const result = await generator.generateFromSpecification(mockSpec, options);

      expect(result.traceability.length).toBeGreaterThan(0);
    });
  });

  describe('Template Processing', () => {
    it('should process frontmatter correctly', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      const templateWithFrontmatter = `
---
to: output/{{ name }}.ts
chmod: "755"
---
// Generated file
export const {{ name }} = '{{ value }}';
      `;

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({ name: 'test', value: 'hello' });
      vi.mocked(readFile).mockResolvedValue(templateWithFrontmatter);

      const result = await generator.generateFromSpecification(mockSpec);

      expect(result.files[0].path).toContain('test.ts');
      expect(result.files[0].permissions).toBe('755');
      expect(result.files[0].content).toContain('export const test = \'hello\'');
    });

    it('should handle multiple file outputs from single template', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'multi-file.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      const multiFileTemplate = `
---
files:
  - to: models/{{ entityName }}.ts
  - to: services/{{ entityName }}.service.ts
    skipIf: "{{ skipService }}"
---
{% if filename.includes('model') %}
export class {{ entityName }} {}
{% else %}
export class {{ entityName }}Service {}
{% endif %}
      `;

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({ 
        entityName: 'User',
        skipService: false
      });
      vi.mocked(readFile).mockResolvedValue(multiFileTemplate);

      const result = await generator.generateFromSpecification(mockSpec);

      expect(result.files).toHaveLength(2);
    });
  });

  describe('File Injection', () => {
    it('should handle file injection modes', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'inject.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      const injectTemplate = `
---
to: existing-file.ts
inject: after
afterPattern: "// INSERT AFTER THIS"
---
// New content to inject
      `;

      const existingContent = `
// Existing file content
// INSERT AFTER THIS
// More existing content
      `;

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({});
      vi.mocked(readFile)
        .mockResolvedValueOnce(injectTemplate) // Template content
        .mockResolvedValueOnce(existingContent); // Existing file content
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await generator.generateFromSpecification(mockSpec);

      expect(result.files[0].content).toContain('// INSERT AFTER THIS');
      expect(result.files[0].content).toContain('// New content to inject');
    });

    it('should handle append injection', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'append.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      const appendTemplate = `
---
to: existing-file.ts
inject: append
---
// Appended content
      `;

      const existingContent = '// Existing content';

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({});
      vi.mocked(readFile)
        .mockResolvedValueOnce(appendTemplate)
        .mockResolvedValueOnce(existingContent);
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await generator.generateFromSpecification(mockSpec);

      expect(result.files[0].content).toBe('// Existing content\n// Appended content');
    });
  });

  describe('Generation Options', () => {
    it('should respect dry run option', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({ name: 'test' });
      vi.mocked(readFile).mockResolvedValue('content: {{ name }}');

      const options: GenerationOptions = {
        dryRun: true,
        overwriteExisting: false,
        createDirectories: true,
        preserveFormatting: true,
        includeTraceability: true
      };

      const result = await generator.generateFromSpecification(mockSpec, options);

      expect(result.files).toHaveLength(1);
      expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
    });

    it('should create directories when enabled', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      const templateContent = `
---
to: deep/nested/path/file.ts
---
content
      `;

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({});
      vi.mocked(readFile).mockResolvedValue(templateContent);

      const options: GenerationOptions = {
        dryRun: false,
        overwriteExisting: false,
        createDirectories: true,
        preserveFormatting: true,
        includeTraceability: false
      };

      await generator.generateFromSpecification(mockSpec, options);

      expect(vi.mocked(mkdir)).toHaveBeenCalledWith(
        expect.stringContaining('deep/nested/path'),
        { recursive: true }
      );
    });

    it('should handle overwrite protection', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'test.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({});
      vi.mocked(readFile).mockResolvedValue('content');
      vi.mocked(existsSync).mockReturnValue(true);

      const options: GenerationOptions = {
        dryRun: false,
        overwriteExisting: false,
        createDirectories: true,
        preserveFormatting: true,
        includeTraceability: false
      };

      const result = await generator.generateFromSpecification(mockSpec, options);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('already exists');
    });
  });

  describe('Template Rendering', () => {
    it('should apply custom Nunjucks filters', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'filters.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      const filterTemplate = `
---
to: test.ts
---
const camelCase = '{{ name | camelCase }}';
const pascalCase = '{{ name | pascalCase }}';
const kebabCase = '{{ name | kebabCase }}';
const snakeCase = '{{ name | snakeCase }}';
const plural = '{{ name | pluralize }}';
const singular = '{{ pluralName | singularize }}';
      `;

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({
        name: 'user name',
        pluralName: 'users'
      });
      vi.mocked(readFile).mockResolvedValue(filterTemplate);

      const result = await generator.generateFromSpecification(mockSpec);

      const content = result.files[0].content;
      expect(content).toContain("camelCase = 'userName'");
      expect(content).toContain("pascalCase = 'UserName'");
      expect(content).toContain("kebabCase = 'user-name'");
      expect(content).toContain("snakeCase = 'user_name'");
      expect(content).toContain("plural = 'user names'");
      expect(content).toContain("singular = 'user'");
    });

    it('should provide global template functions', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'globals.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      const globalsTemplate = `
---
to: test.ts
---
// Generated at: {{ now() }}
// Timestamp: {{ timestamp() }}
// UUID: {{ uuid() }}
      `;

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({});
      vi.mocked(readFile).mockResolvedValue(globalsTemplate);

      const result = await generator.generateFromSpecification(mockSpec);

      const content = result.files[0].content;
      expect(content).toMatch(/Generated at: .+/);
      expect(content).toMatch(/Timestamp: \d+/);
      expect(content).toMatch(/UUID: .+/);
    });
  });

  describe('Error Handling', () => {
    it('should capture template processing errors', async () => {
      const mockMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'error.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([mockMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({});
      vi.mocked(readFile).mockRejectedValue(new Error('Template not found'));

      const result = await generator.generateFromSpecification(mockSpec);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('template_processing_error');
    });

    it('should continue processing other templates when one fails', async () => {
      const goodMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'good.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      const badMapping: TemplateMapping = {
        specPattern: { entityTypes: [], relationshipTypes: [], technologyStack: {}, patterns: [] },
        templatePath: 'bad.ejs',
        variables: [],
        conditions: [],
        priority: 1
      };

      vi.mocked(mockMapper.findMatchingTemplates).mockResolvedValue([goodMapping, badMapping]);
      vi.mocked(mockMapper.mapVariables).mockResolvedValue({ name: 'test' });
      vi.mocked(readFile)
        .mockResolvedValueOnce('Good template: {{ name }}')
        .mockRejectedValueOnce(new Error('Bad template error'));

      const result = await generator.generateFromSpecification(mockSpec);

      expect(result.files).toHaveLength(1); // Good template should still generate
      expect(result.errors).toHaveLength(1); // Bad template should generate error
    });
  });
});