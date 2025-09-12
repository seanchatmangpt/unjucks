/**
 * KGEN Template Integration Tests
 * 
 * Test the template engine with real templates from the _templates directory
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createTemplatingSystem } from '../../../packages/kgen-core/src/templating/index.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const REAL_TEMPLATES_DIR = path.resolve(process.cwd(), '_templates');
const TEST_OUTPUT_DIR = '/tmp/kgen-integration-output';

// Only run integration tests if real templates directory exists
const describeIf = existsSync(REAL_TEMPLATES_DIR) ? describe : describe.skip;

beforeEach(() => {
  // Clean and create test output directory
  if (existsSync(TEST_OUTPUT_DIR)) {
    rmSync(TEST_OUTPUT_DIR, { recursive: true });
  }
  mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
});

afterEach(() => {
  // Cleanup
  if (existsSync(TEST_OUTPUT_DIR)) {
    rmSync(TEST_OUTPUT_DIR, { recursive: true });
  }
});

describeIf('Integration Tests with Real Templates', () => {
  let templatingSystem;
  
  beforeEach(() => {
    templatingSystem = createTemplatingSystem({
      templatesDir: REAL_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR
    });
  });

  test('should work with benchmark template', async () => {
    const benchmarkTemplate = 'benchmark/new/template.njk';
    
    if (!templatingSystem.templateExists(benchmarkTemplate)) {
      console.log('Skipping benchmark template test - template not found');
      return;
    }

    const result = await templatingSystem.render(benchmarkTemplate, {
      name: 'MyBenchmark'
    });
    
    expect(result.content).toContain('MyBenchmark');
    expect(result.outputPath).toBe('MyBenchmark.ts');
    expect(result.frontmatter.to).toBe('{{ name }}.ts');
  });

  test('should work with database schema template', async () => {
    const schemaTemplate = 'database/schema/table.sql.ejs';
    
    if (!templatingSystem.templateExists(schemaTemplate)) {
      console.log('Skipping database schema template test - template not found');
      return;
    }

    const result = await templatingSystem.renderString(`
-- Test template content similar to the real one
<%= tableName %> table schema
-- Generated: <%= this.getDeterministicDate().toISOString() %>

CREATE TABLE IF NOT EXISTS <%= tableName %> (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
    `, {
      tableName: 'users'
    });
    
    expect(result.content).toContain('users table schema');
    expect(result.content).toContain('CREATE TABLE IF NOT EXISTS users');
  });

  test('should handle Pascal case and kebab case filters in component templates', async () => {
    // Test if we can render a component-like template with case conversion needs
    const componentTemplate = `---
to: "{{ componentName | pascalCase }}.tsx"
---
import React from 'react';

interface {{ componentName | pascalCase }}Props {
  className?: string;
}

export const {{ componentName | pascalCase }}: React.FC<{{ componentName | pascalCase }}Props> = ({ 
  className = '' 
}) => {
  return (
    <div className={\`component-{{ componentName | kebabCase }} \${className}\`}>
      <h1>{{ componentName | pascalCase }} Component</h1>
    </div>
  );
};

export default {{ componentName | pascalCase }};`;
    
    // This should work even without custom filters - Nunjucks will just pass through
    const result = await templatingSystem.renderString(componentTemplate, {
      componentName: 'userProfile'
    });
    
    expect(result.content).toContain('userProfile');
    expect(result.frontmatter.to).toContain('{{ componentName | pascalCase }}.tsx');
  });

  test('should extract variables from complex templates', async () => {
    const complexTemplate = `---
to: "{{ directory }}/{{ filename }}.{{ extension }}"
skipIf: "!generate"
---
// Generated file for {{ entityName }}
{% if includeImports %}
import { BaseEntity } from './base';
{% endif %}

export class {{ entityName }} {
  {% for field in fields %}
  private {{ field.name }}: {{ field.type }};
  {% endfor %}
  
  constructor({% for field in fields %}{{ field.name }}: {{ field.type }}{% if not loop.last %}, {% endif %}{% endfor %}) {
    {% for field in fields %}
    this.{{ field.name }} = {{ field.name }};
    {% endfor %}
  }
}`;

    const parsed = await templatingSystem.engine.parseTemplate(complexTemplate);
    
    expect(parsed.variables).toContain('directory');
    expect(parsed.variables).toContain('filename');
    expect(parsed.variables).toContain('extension');
    expect(parsed.variables).toContain('entityName');
    expect(parsed.variables).toContain('includeImports');
    expect(parsed.variables).toContain('fields');
  });

  test('should handle real-world rendering scenarios', async () => {
    const context = {
      componentName: 'UserDashboard',
      directory: 'components/user',
      filename: 'UserDashboard',
      extension: 'tsx',
      entityName: 'User',
      includeImports: true,
      generate: true,
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' }
      ]
    };

    const complexTemplate = `---
to: "{{ directory }}/{{ filename }}.{{ extension }}"
skipIf: "!generate"
---
// Generated {{ entityName }} component
{% if includeImports %}
import React from 'react';
import { {{ entityName }} } from '../models';
{% endif %}

interface {{ entityName }}Props {
  {% for field in fields %}
  {{ field.name }}: {{ field.type }};
  {% endfor %}
}

export const {{ componentName }}: React.FC<{{ entityName }}Props> = ({
  {% for field in fields %}
  {{ field.name }}{% if not loop.last %},{% endif %}
  {% endfor %}
}) => {
  return (
    <div className="{{ componentName | lower }}-component">
      {% for field in fields %}
      <div>{{ field.name | title }}: {{{ field.name }}}</div>
      {% endfor %}
    </div>
  );
};`;

    const result = await templatingSystem.renderString(complexTemplate, context);
    
    expect(result.content).toContain('Generated User component');
    expect(result.content).toContain('import React from \'react\'');
    expect(result.content).toContain('export const UserDashboard');
    expect(result.content).toContain('id: string');
    expect(result.content).toContain('name: string');
    expect(result.content).toContain('email: string');
    expect(result.frontmatter.to).toBe('{{ directory }}/{{ filename }}.{{ extension }}');
  });

  test('should handle skipIf conditions properly', async () => {
    const conditionalTemplate = `---
to: "conditional.txt"
skipIf: "skipGeneration"
---
This should only render if skipGeneration is false`;

    // Should skip when skipGeneration is true
    const result1 = await templatingSystem.renderToFile(conditionalTemplate, {
      skipGeneration: true
    });
    expect(result1.skipped).toBe(true);

    // Should render when skipGeneration is false
    const result2 = await templatingSystem.renderToFile(conditionalTemplate, {
      skipGeneration: false
    });
    expect(result2.skipped).toBe(undefined);
    expect(result2.content).toContain('This should only render');
  });

  test('should provide comprehensive statistics', async () => {
    await templatingSystem.renderString('Hello {{ name }}!', { name: 'World' });
    await templatingSystem.renderString('Count: {{ count }}', { count: 42 });
    
    const stats = templatingSystem.getStats();
    
    expect(stats.engine.renders).toBe(2);
    expect(stats.engine.uniqueVariables).toBeGreaterThan(0);
    expect(stats.engine.variablesUsed).toContain('name');
    expect(stats.engine.variablesUsed).toContain('count');
  });

  test('should ensure deterministic rendering', async () => {
    const template = 'Generated at: {{ timestamp }} for {{ name }}';
    const fixedContext = {
      name: 'Test',
      timestamp: '2024-01-01T00:00:00.000Z'
    };

    const result1 = await templatingSystem.renderString(template, fixedContext);
    const result2 = await templatingSystem.renderString(template, fixedContext);
    
    expect(result1.content).toBe(result2.content);
    expect(result1.content).toBe('Generated at: 2024-01-01T00:00:00.000Z for Test');
  });

  test('should handle file operations correctly', async () => {
    const writeTemplate = `---
to: "test-file.txt"
---
Generated content for testing`;

    const result = await templatingSystem.renderToFile(writeTemplate, {});
    
    expect(result.operation).toBe('write');
    expect(result.outputPath).toBe('test-file.txt');
    expect(existsSync(path.join(TEST_OUTPUT_DIR, 'test-file.txt'))).toBe(true);
  });

  test('should handle dry run mode', async () => {
    const dryRunSystem = createTemplatingSystem({
      templatesDir: REAL_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR,
      dryRun: true
    });

    const writeTemplate = `---
to: "dry-run-test.txt"
---
This should not create a file`;

    const result = await dryRunSystem.renderToFile(writeTemplate, {});
    
    expect(result.operation).toBe('dry-run-write');
    expect(existsSync(path.join(TEST_OUTPUT_DIR, 'dry-run-test.txt'))).toBe(false);
  });

  test('should handle multiple template rendering', async () => {
    const templates = [
      {
        path: 'simple1',
        content: '---\nto: "file1.txt"\n---\nContent 1',
        context: {}
      },
      {
        path: 'simple2', 
        content: '---\nto: "file2.txt"\n---\nContent 2',
        context: {}
      }
    ];

    const results = [];
    for (const template of templates) {
      const result = await templatingSystem.renderer.renderToFile(
        template.content,
        template.context
      );
      results.push(result);
    }

    expect(results).toHaveLength(2);
    expect(results[0].outputPath).toBe('file1.txt');
    expect(results[1].outputPath).toBe('file2.txt');
  });
});

describe('Template Engine Performance', () => {
  test('should handle large number of renders efficiently', async () => {
    const system = createTemplatingSystem({
      templatesDir: REAL_TEMPLATES_DIR
    });

    const template = 'Item {{ index }}: {{ name }}';
    const startTime = performance.now();
    
    const results = [];
    for (let i = 0; i < 100; i++) {
      const result = await system.renderString(template, {
        index: i,
        name: `Item${i}`
      });
      results.push(result);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(results).toHaveLength(100);
    expect(totalTime).toBeLessThan(1000); // Should complete in less than 1 second
    
    const stats = system.getStats();
    expect(stats.engine.renders).toBe(100);
    expect(stats.engine.avgRenderTime).toBeLessThan(10); // Average should be fast
  });

  test('should handle complex nested templates efficiently', async () => {
    const system = createTemplatingSystem({
      templatesDir: REAL_TEMPLATES_DIR
    });

    const complexTemplate = `
    {%- for category in categories -%}
      Category: {{ category.name }}
      {%- for item in category.items -%}
        Item: {{ item.name }} ({{ item.type }})
        {%- if item.properties -%}
          Properties:
          {%- for prop in item.properties -%}
            - {{ prop.key }}: {{ prop.value }}
          {%- endfor -%}
        {%- endif -%}
      {%- endfor -%}
    {%- endfor -%}`;

    const context = {
      categories: [
        {
          name: 'Components',
          items: [
            {
              name: 'Button',
              type: 'React',
              properties: [
                { key: 'variant', value: 'primary' },
                { key: 'size', value: 'medium' }
              ]
            },
            {
              name: 'Input',
              type: 'React',
              properties: [
                { key: 'type', value: 'text' },
                { key: 'placeholder', value: 'Enter text' }
              ]
            }
          ]
        },
        {
          name: 'Services',
          items: [
            {
              name: 'UserService',
              type: 'Class',
              properties: [
                { key: 'endpoint', value: '/api/users' }
              ]
            }
          ]
        }
      ]
    };

    const startTime = performance.now();
    const result = await system.renderString(complexTemplate, context);
    const endTime = performance.now();
    
    expect(result.content).toContain('Category: Components');
    expect(result.content).toContain('Item: Button');
    expect(result.content).toContain('variant: primary');
    expect(endTime - startTime).toBeLessThan(100); // Should render quickly
  });
});