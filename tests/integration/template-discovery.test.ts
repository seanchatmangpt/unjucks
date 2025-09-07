import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TemplateDiscovery } from '../../src/lib/template-discovery.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Template Discovery Engine', () => {
  let discovery: TemplateDiscovery;
  let testTemplateDir: string;

  beforeAll(() => {
    // Create temporary test template directory
    testTemplateDir = join(tmpdir(), 'unjucks-test-templates-' + Date.now());
    mkdirSync(testTemplateDir, { recursive: true });
  });

  afterAll(() => {
    // Cleanup test template directory
    if (testTemplateDir) {
      rmSync(testTemplateDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    discovery = new TemplateDiscovery([testTemplateDir]);
  });

  describe('Template Indexing', () => {
    it('should index templates correctly', async () => {
      // Create test template
      const templatePath = join(testTemplateDir, 'test-component');
      mkdirSync(templatePath, { recursive: true });
      
      writeFileSync(join(templatePath, 'meta.yml'), `
name: "Test Component"
description: "A test component template"
category: "test"
complexity: "beginner"
tags: ["test", "component"]
variables:
  - name: componentName
    type: string
    required: true
`);

      writeFileSync(join(templatePath, '{{ componentName }}.tsx'), `
import React from 'react';

export const {{ componentName }}: React.FC = () => {
  return <div>{{ componentName }}</div>;
};
`);

      // Index templates
      await discovery.indexTemplates();
      const templates = await discovery.getTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0]).toMatchObject({
        name: 'Test Component',
        description: 'A test component template',
        category: 'test',
        complexity: 'beginner',
        tags: ['test', 'component']
      });
      expect(templates[0].variables).toHaveLength(1);
      expect(templates[0].variables[0]).toMatchObject({
        name: 'componentName',
        type: 'string',
        required: true
      });
    });

    it('should extract variables from template files', async () => {
      const templatePath = join(testTemplateDir, 'variable-extraction');
      mkdirSync(templatePath, { recursive: true });

      // Template with various variable patterns
      writeFileSync(join(templatePath, 'component.tsx'), `
import React from 'react';

interface {{ componentName }}Props {
  title: string;
  {% if withDescription %}description?: string;{% endif %}
}

export const {{ componentName }}: React.FC<{{ componentName }}Props> = ({ 
  title{% if withDescription %}, description{% endif %} 
}) => {
  return (
    <div className="{{ className }}">
      <h2>{title}</h2>
      {% if withDescription %}<p>{description}</p>{% endif %}
    </div>
  );
};
`);

      await discovery.indexTemplates();
      const template = (await discovery.getTemplates())[0];
      
      expect(template.variables.map(v => v.name)).toContain('componentName');
      expect(template.variables.map(v => v.name)).toContain('className');
      expect(template.variables.map(v => v.name)).toContain('withDescription');
    });

    it('should handle multiple template directories', async () => {
      // Create templates in different categories
      const reactPath = join(testTemplateDir, 'react', 'component');
      const apiPath = join(testTemplateDir, 'api', 'endpoint');
      
      mkdirSync(reactPath, { recursive: true });
      mkdirSync(apiPath, { recursive: true });

      writeFileSync(join(reactPath, 'Component.tsx'), 'React component: {{ name }}');
      writeFileSync(join(apiPath, 'endpoint.ts'), 'API endpoint: {{ name }}');

      await discovery.indexTemplates();
      const templates = await discovery.getTemplates();

      expect(templates).toHaveLength(2);
      expect(templates.find(t => t.category === 'react')).toBeDefined();
      expect(templates.find(t => t.category === 'api')).toBeDefined();
    });
  });

  describe('Template Search', () => {
    beforeEach(async () => {
      // Create multiple test templates
      const templates = [
        {
          name: 'react-component',
          meta: {
            name: 'React Component',
            description: 'A React component with TypeScript',
            category: 'frontend',
            tags: ['react', 'typescript', 'component'],
            complexity: 'beginner'
          },
          files: ['{{ name }}.tsx', '{{ name }}.test.tsx']
        },
        {
          name: 'api-endpoint',
          meta: {
            name: 'API Endpoint',
            description: 'Express.js API endpoint',
            category: 'backend',
            tags: ['api', 'express', 'backend'],
            complexity: 'intermediate'
          },
          files: ['{{ name }}.controller.ts', '{{ name }}.routes.ts']
        },
        {
          name: 'database-model',
          meta: {
            name: 'Database Model',
            description: 'Database model with migrations',
            category: 'database',
            tags: ['database', 'model', 'migration'],
            complexity: 'advanced'
          },
          files: ['{{ name }}.model.ts', 'migrations/create_{{ name }}.sql']
        }
      ];

      for (const template of templates) {
        const templatePath = join(testTemplateDir, template.name);
        mkdirSync(templatePath, { recursive: true });
        
        writeFileSync(join(templatePath, 'meta.yml'), 
          Object.entries(template.meta)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n')
        );

        for (const file of template.files) {
          const filePath = join(templatePath, file);
          mkdirSync(join(filePath, '..'), { recursive: true });
          writeFileSync(filePath, `Template file: ${file}`);
        }
      }

      await discovery.indexTemplates();
    });

    it('should search by text query', async () => {
      const results = await discovery.searchTemplates({ search: 'React' });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('React Component');
    });

    it('should filter by category', async () => {
      const results = await discovery.searchTemplates({ category: 'backend' });
      
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('backend');
    });

    it('should filter by tags', async () => {
      const results = await discovery.searchTemplates({ tags: ['typescript'] });
      
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('typescript');
    });

    it('should filter by complexity', async () => {
      const results = await discovery.searchTemplates({ complexity: 'beginner' });
      
      expect(results).toHaveLength(1);
      expect(results[0].complexity).toBe('beginner');
    });

    it('should combine multiple filters', async () => {
      const results = await discovery.searchTemplates({ 
        category: 'frontend',
        tags: ['react'],
        complexity: 'beginner'
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('React Component');
    });

    it('should return empty array for no matches', async () => {
      const results = await discovery.searchTemplates({ search: 'nonexistent' });
      
      expect(results).toHaveLength(0);
    });
  });

  describe('Template Preview', () => {
    beforeEach(async () => {
      const templatePath = join(testTemplateDir, 'preview-test');
      mkdirSync(templatePath, { recursive: true });
      
      writeFileSync(join(templatePath, 'meta.yml'), `
name: "Preview Test"
description: "Template for testing preview functionality"
category: "test"
variables:
  - name: componentName
    type: string
    default: "TestComponent"
  - name: withProps
    type: boolean
    default: true
`);

      writeFileSync(join(templatePath, '{{ componentName }}.tsx'), `
import React from 'react';

{% if withProps %}
interface {{ componentName }}Props {
  title: string;
}

export const {{ componentName }}: React.FC<{{ componentName }}Props> = ({ title }) => {
{% else %}
export const {{ componentName }}: React.FC = () => {
{% endif %}
  return <div>{{ componentName }}: {title}</div>;
};
`);

      await discovery.indexTemplates();
    });

    it('should generate sample output with default variables', async () => {
      const templates = await discovery.getTemplates();
      const template = templates[0];

      expect(template.sampleOutput).toBeDefined();
      expect(template.sampleOutput).toContain('TestComponent');
    });

    it('should include variable information', async () => {
      const templates = await discovery.getTemplates();
      const template = templates[0];

      expect(template.variables).toHaveLength(2);
      
      const componentNameVar = template.variables.find(v => v.name === 'componentName');
      expect(componentNameVar).toMatchObject({
        name: 'componentName',
        type: 'string',
        default: 'TestComponent'
      });

      const withPropsVar = template.variables.find(v => v.name === 'withProps');
      expect(withPropsVar).toMatchObject({
        name: 'withProps',
        type: 'boolean',
        default: true
      });
    });
  });

  describe('Categories and Tags', () => {
    beforeEach(async () => {
      // Create templates with various categories and tags
      const templates = [
        { name: 'template1', category: 'frontend', tags: ['react', 'typescript'] },
        { name: 'template2', category: 'backend', tags: ['nodejs', 'api'] },
        { name: 'template3', category: 'frontend', tags: ['vue', 'javascript'] },
        { name: 'template4', category: 'database', tags: ['postgresql', 'migration'] }
      ];

      for (const template of templates) {
        const templatePath = join(testTemplateDir, template.name);
        mkdirSync(templatePath, { recursive: true });
        
        writeFileSync(join(templatePath, 'template.txt'), 'Template content');
        writeFileSync(join(templatePath, 'meta.yml'), `
name: "${template.name}"
category: "${template.category}"
tags: [${template.tags.map(t => `"${t}"`).join(', ')}]
`);
      }

      await discovery.indexTemplates();
    });

    it('should get all categories', async () => {
      const categories = await discovery.getCategories();
      
      expect(categories).toContain('frontend');
      expect(categories).toContain('backend');
      expect(categories).toContain('database');
      expect(categories).toHaveLength(3);
    });

    it('should get all tags', async () => {
      const tags = await discovery.getTags();
      
      expect(tags).toContain('react');
      expect(tags).toContain('typescript');
      expect(tags).toContain('nodejs');
      expect(tags).toContain('api');
      expect(tags).toContain('vue');
      expect(tags).toContain('javascript');
      expect(tags).toContain('postgresql');
      expect(tags).toContain('migration');
    });
  });

  describe('Recommendations', () => {
    beforeEach(async () => {
      // Create templates with different characteristics
      const templates = [
        {
          name: 'react-starter',
          meta: { 
            category: 'frontend', 
            tags: ['react', 'typescript'], 
            complexity: 'beginner' 
          }
        },
        {
          name: 'express-api',
          meta: { 
            category: 'backend', 
            tags: ['express', 'api'], 
            complexity: 'intermediate' 
          }
        },
        {
          name: 'vue-component',
          meta: { 
            category: 'frontend', 
            tags: ['vue', 'javascript'], 
            complexity: 'beginner' 
          }
        }
      ];

      for (const template of templates) {
        const templatePath = join(testTemplateDir, template.name);
        mkdirSync(templatePath, { recursive: true });
        
        writeFileSync(join(templatePath, 'template.txt'), 'Template content');
        writeFileSync(join(templatePath, 'meta.yml'), 
          Object.entries(template.meta)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n')
        );
      }

      await discovery.indexTemplates();
    });

    it('should provide recommendations based on project context', async () => {
      const projectContext = {
        packageJson: {
          dependencies: {
            react: '^18.0.0',
            typescript: '^4.8.0'
          }
        }
      };

      const recommendations = await discovery.getRecommendations(projectContext);
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].name).toContain('react');
    });

    it('should provide default recommendations when no context', async () => {
      const recommendations = await discovery.getRecommendations();
      
      expect(recommendations.length).toBeGreaterThan(0);
      // Should prioritize beginner templates
      expect(recommendations.every(r => r.complexity === 'beginner')).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should index large number of templates efficiently', async () => {
      // Create many templates
      for (let i = 0; i < 100; i++) {
        const templatePath = join(testTemplateDir, `perf-test-${i}`);
        mkdirSync(templatePath, { recursive: true });
        
        writeFileSync(join(templatePath, 'template.txt'), `Template ${i}: {{ name }}`);
        writeFileSync(join(templatePath, 'meta.yml'), `
name: "Performance Test ${i}"
category: "test"
tags: ["performance", "test${i % 10}"]
`);
      }

      const startTime = Date.now();
      await discovery.indexTemplates();
      const indexTime = Date.now() - startTime;

      const templates = await discovery.getTemplates();
      expect(templates).toHaveLength(100);
      
      // Should index 100 templates in reasonable time (less than 5 seconds)
      expect(indexTime).toBeLessThan(5000);
    });

    it('should search efficiently', async () => {
      // Index templates first
      for (let i = 0; i < 50; i++) {
        const templatePath = join(testTemplateDir, `search-test-${i}`);
        mkdirSync(templatePath, { recursive: true });
        
        writeFileSync(join(templatePath, 'template.txt'), `Template ${i}`);
        writeFileSync(join(templatePath, 'meta.yml'), `
name: "Search Test ${i}"
category: "${i % 5 === 0 ? 'special' : 'regular'}"
tags: ["tag${i % 3}", "search"]
`);
      }

      await discovery.indexTemplates();

      // Search should be fast
      const startTime = Date.now();
      const results = await discovery.searchTemplates({ search: 'Search' });
      const searchTime = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(searchTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid template directories gracefully', async () => {
      const invalidDiscovery = new TemplateDiscovery(['/nonexistent/path']);
      
      await expect(invalidDiscovery.indexTemplates()).resolves.not.toThrow();
      
      const templates = await invalidDiscovery.getTemplates();
      expect(templates).toHaveLength(0);
    });

    it('should handle malformed meta.yml files', async () => {
      const templatePath = join(testTemplateDir, 'malformed-meta');
      mkdirSync(templatePath, { recursive: true });
      
      writeFileSync(join(templatePath, 'template.txt'), 'Template content');
      writeFileSync(join(templatePath, 'meta.yml'), 'invalid: yaml: content:');

      await expect(discovery.indexTemplates()).resolves.not.toThrow();
      
      const templates = await discovery.getTemplates();
      const malformedTemplate = templates.find(t => t.id.includes('malformed-meta'));
      expect(malformedTemplate).toBeDefined(); // Should still create template with defaults
    });

    it('should handle templates without meta files', async () => {
      const templatePath = join(testTemplateDir, 'no-meta');
      mkdirSync(templatePath, { recursive: true });
      
      writeFileSync(join(templatePath, 'template.njk'), 'Template: {{ name }}');

      await discovery.indexTemplates();
      
      const templates = await discovery.getTemplates();
      const noMetaTemplate = templates.find(t => t.id.includes('no-meta'));
      
      expect(noMetaTemplate).toBeDefined();
      expect(noMetaTemplate?.name).toBe('No Meta'); // Should generate name from directory
    });
  });
});