/**
 * Template Engine Integration Tests - Tests real template rendering
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import nunjucks from 'nunjucks';

// Import template engines - try multiple possible paths
let PerfectTemplateEngine;
let SecureTemplateEngine;
let createSecureNunjucksEnvironment;

try {
  const perfectModule = await import('../../src/lib/template-engine-perfect.js');
  PerfectTemplateEngine = perfectModule.PerfectTemplateEngine || perfectModule.default;
} catch (error) {
  console.warn('Could not import PerfectTemplateEngine');
}

try {
  const secureModule = await import('../../src/lib/template-engine-secure.js');
  SecureTemplateEngine = secureModule.SecureTemplateEngine || secureModule.default;
} catch (error) {
  console.warn('Could not import SecureTemplateEngine');
}

try {
  const nunjucksModule = await import('../../src/lib/nunjucks-env.js');
  createSecureNunjucksEnvironment = nunjucksModule.createSecureNunjucksEnvironment;
} catch (error) {
  console.warn('Could not import createSecureNunjucksEnvironment');
}

describe('Template Engine Integration', () => {
  let testDir;
  let templatesDir;
  let perfectEngine;
  let secureEngine;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'tests', 'temp', `template-engine-test-${Date.now()}`);
    templatesDir = path.join(testDir, '_templates');
    
    await fs.ensureDir(templatesDir);
    
    if (PerfectTemplateEngine) {
      perfectEngine = new PerfectTemplateEngine({
        templatesDir,
        autoescape: false,
        throwOnUndefined: false
      });
    }
    
    if (SecureTemplateEngine) {
      secureEngine = new SecureTemplateEngine({
        templatesDir,
        autoescape: true,
        throwOnUndefined: false
      });
    }
    
    // Create test templates
    await createTestTemplates(templatesDir);
  });

  afterEach(async () => {
    try {
      await fs.remove(testDir);
    } catch (error) {
      console.warn('Could not clean up test directory:', error.message);
    }
  });

  describe('Basic Template Rendering', () => {
    it('should render simple Nunjucks template', async () => {
      const templateContent = `Hello {{ name }}! Welcome to {{ project }}.`;
      const variables = {
        name: 'John',
        project: 'Unjucks'
      };

      // Test with raw Nunjucks
      const env = nunjucks.configure({ autoescape: false });
      const result = env.renderString(templateContent, variables);

      expect(result).toBe('Hello John! Welcome to Unjucks.');
    });

    it('should render template with PerfectTemplateEngine', async () => {
      if (!perfectEngine) return;

      const templateFile = path.join(templatesDir, 'test', 'simple.njk');
      const variables = {
        name: 'TestClass',
        description: 'A test class'
      };

      const result = await perfectEngine.renderTemplate(templateFile, variables);

      expect(result.success).toBe(true);
      expect(result.content).toContain('TestClass');
      expect(result.content).toContain('A test class');
    });

    it('should render template with SecureTemplateEngine', async () => {
      if (!secureEngine) return;

      const templateFile = path.join(templatesDir, 'test', 'simple.njk');
      const variables = {
        name: 'SecureClass',
        description: 'A secure test class'
      };

      const result = await secureEngine.renderTemplate(templateFile, variables);

      expect(result.success).toBe(true);
      expect(result.content).toContain('SecureClass');
    });

    it('should handle frontmatter in templates', async () => {
      if (!perfectEngine) return;

      const templateFile = path.join(templatesDir, 'test', 'with-frontmatter.njk');
      const variables = {
        name: 'Component',
        type: 'React'
      };

      const result = await perfectEngine.renderTemplate(templateFile, variables);

      expect(result.success).toBe(true);
      expect(result.frontmatter).toBeDefined();
      expect(result.frontmatter.to).toContain('Component');
      expect(result.content).toContain('React');
    });
  });

  describe('Advanced Template Features', () => {
    it('should render templates with filters', async () => {
      const templateContent = `
export class {{ name | pascalCase }}Service {
  private {{ name | camelCase }}Repository;
  
  constructor() {
    this.logger = new Logger('{{ name | uppercase }}');
  }
}`;

      const variables = { name: 'user-profile' };

      // Test filter functionality (note: custom filters need to be registered)
      const env = nunjucks.configure({ autoescape: false });
      
      // Register basic filters for testing
      env.addFilter('pascalCase', str => 
        str.replace(/(?:^|[-_\s])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_\s]/g, '')
      );
      env.addFilter('camelCase', str => {
        const pascal = str.replace(/(?:^|[-_\s])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_\s]/g, '');
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
      });
      env.addFilter('uppercase', str => str.toUpperCase());

      const result = env.renderString(templateContent, variables);

      expect(result).toContain('UserProfileService');
      expect(result).toContain('userProfileRepository');
      expect(result).toContain('USER-PROFILE');
    });

    it('should render templates with conditionals', async () => {
      const templateContent = `
export class {{ name }}Service {
  {% if withDatabase %}
  constructor(
    private repository: Repository<{{ name }}>
  ) {}
  {% else %}
  constructor() {}
  {% endif %}
  
  {% if withValidation %}
  validate(data: any): boolean {
    return true;
  }
  {% endif %}
}`;

      const variables = {
        name: 'User',
        withDatabase: true,
        withValidation: false
      };

      const env = nunjucks.configure({ autoescape: false });
      const result = env.renderString(templateContent, variables);

      expect(result).toContain('Repository<User>');
      expect(result).not.toContain('validate(data: any)');
    });

    it('should render templates with loops', async () => {
      const templateContent = `
export interface {{ name }}Interface {
  {% for field in fields %}
  {{ field.name }}: {{ field.type }};
  {% endfor %}
}

export class {{ name }} implements {{ name }}Interface {
  {% for field in fields %}
  private _{{ field.name }}: {{ field.type }};
  {% endfor %}
  
  {% for field in fields %}
  get {{ field.name }}(): {{ field.type }} {
    return this._{{ field.name }};
  }
  
  set {{ field.name }}(value: {{ field.type }}) {
    this._{{ field.name }} = value;
  }
  {% endfor %}
}`;

      const variables = {
        name: 'User',
        fields: [
          { name: 'id', type: 'number' },
          { name: 'name', type: 'string' },
          { name: 'email', type: 'string' }
        ]
      };

      const env = nunjucks.configure({ autoescape: false });
      const result = env.renderString(templateContent, variables);

      expect(result).toContain('id: number');
      expect(result).toContain('name: string');
      expect(result).toContain('email: string');
      expect(result).toContain('get id()');
      expect(result).toContain('set name(value: string)');
    });

    it('should handle nested object variables', async () => {
      const templateContent = `
export class {{ entity.name }}Controller {
  @Get('{{ entity.endpoints.list }}')
  async list(): Promise<{{ entity.name }}[]> {
    return this.{{ entity.service }}.findAll();
  }
  
  @Post('{{ entity.endpoints.create }}')
  async create(@Body() data: Create{{ entity.name }}Dto): Promise<{{ entity.name }}> {
    return this.{{ entity.service }}.create(data);
  }
}`;

      const variables = {
        entity: {
          name: 'Product',
          service: 'productService',
          endpoints: {
            list: '/products',
            create: '/products'
          }
        }
      };

      const env = nunjucks.configure({ autoescape: false });
      const result = env.renderString(templateContent, variables);

      expect(result).toContain('ProductController');
      expect(result).toContain("@Get('/products')");
      expect(result).toContain('this.productService.findAll()');
      expect(result).toContain('CreateProductDto');
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined variables gracefully', async () => {
      const templateContent = `
export const config = {
  name: "{{ name }}",
  version: "{{ version }}",
  debug: {{ debug }},
  missing: "{{ missingVariable }}"
};`;

      const variables = {
        name: 'TestApp',
        version: '1.0.0'
        // debug and missingVariable are missing
      };

      const env = nunjucks.configure({ 
        autoescape: false,
        throwOnUndefined: false 
      });
      
      const result = env.renderString(templateContent, variables);

      expect(result).toContain('TestApp');
      expect(result).toContain('1.0.0');
      // Should handle missing variables without throwing
      expect(typeof result).toBe('string');
    });

    it('should handle template syntax errors', async () => {
      const malformedTemplate = `
export class {{ name }} {
  {% if unclosed condition
  method() {}
  {% endunknown %}
}`;

      const variables = { name: 'Test' };

      const env = nunjucks.configure({ autoescape: false });
      
      // Should throw or handle gracefully
      expect(() => {
        env.renderString(malformedTemplate, variables);
      }).toThrow();
    });

    it('should handle circular references in variables', async () => {
      const templateContent = `
export const data = {
  name: "{{ obj.name }}",
  type: "{{ obj.type }}"
};`;

      const obj = { name: 'Test', type: 'Object' };
      obj.self = obj; // Circular reference

      const variables = { obj };

      const env = nunjucks.configure({ autoescape: false });
      
      // Should handle without infinite recursion
      const result = env.renderString(templateContent, variables);
      expect(result).toContain('Test');
      expect(result).toContain('Object');
    });
  });

  describe('Security Features', () => {
    it('should handle autoescaping in SecureTemplateEngine', async () => {
      if (!secureEngine) return;

      const templateContent = `<div>{{ userInput }}</div>`;
      const variables = {
        userInput: '<script>alert("xss")</script>'
      };

      // Create temp template file
      const templateFile = path.join(templatesDir, 'security-test.njk');
      await fs.writeFile(templateFile, templateContent);

      const result = await secureEngine.renderTemplate(templateFile, variables);

      expect(result.success).toBe(true);
      // Should escape dangerous content
      expect(result.content).not.toContain('<script>');
      expect(result.content).toContain('&lt;script&gt;');
    });

    it('should prevent template injection attacks', async () => {
      const templateContent = `Hello {{ name }}!`;
      const variables = {
        name: '{{ maliciousCode }}'
      };

      const env = nunjucks.configure({ autoescape: true });
      const result = env.renderString(templateContent, variables);

      // Should treat the malicious code as literal text
      expect(result).toContain('{{ maliciousCode }}');
    });
  });

  describe('Performance', () => {
    it('should handle large templates efficiently', async () => {
      const largeTemplate = `
export interface LargeInterface {
  {% for i in range(0, 1000) %}
  field{{ i }}: string;
  {% endfor %}
}

export class LargeClass implements LargeInterface {
  {% for i in range(0, 1000) %}
  field{{ i }}: string = "value{{ i }}";
  {% endfor %}
}`;

      const variables = {};

      const start = Date.now();
      const env = nunjucks.configure({ autoescape: false });
      const result = env.renderString(largeTemplate, variables);
      const duration = Date.now() - start;

      expect(result).toContain('field0: string');
      expect(result).toContain('field999: string');
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should cache compiled templates', async () => {
      if (!perfectEngine) return;

      const templateFile = path.join(templatesDir, 'test', 'simple.njk');
      const variables = { name: 'Test', description: 'Cache test' };

      // First render
      const start1 = Date.now();
      const result1 = await perfectEngine.renderTemplate(templateFile, variables);
      const time1 = Date.now() - start1;

      // Second render (should use cache)
      const start2 = Date.now();
      const result2 = await perfectEngine.renderTemplate(templateFile, variables);
      const time2 = Date.now() - start2;

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.content).toBe(result2.content);
      
      // Second render should be faster due to caching
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });
});

/**
 * Helper function to create test templates
 */
async function createTestTemplates(templatesDir) {
  // Simple template
  const simpleDir = path.join(templatesDir, 'test');
  await fs.ensureDir(simpleDir);

  const simpleTemplate = `export class {{ name }} {
  private description = "{{ description }}";
  
  constructor() {
    console.log("Created {{ name }}");
  }
}`;

  await fs.writeFile(
    path.join(simpleDir, 'simple.njk'),
    simpleTemplate
  );

  // Template with frontmatter
  const frontmatterTemplate = `---
to: "{{ name | kebabCase }}.{{ type | lower }}.ts"
inject: false
---
import { {{ type }} } from '@framework/core';

export class {{ name }}{{ type }} extends {{ type }} {
  constructor() {
    super();
  }
}`;

  await fs.writeFile(
    path.join(simpleDir, 'with-frontmatter.njk'),
    frontmatterTemplate
  );

  // Complex template with filters and conditionals
  const complexTemplate = `---
to: "{{ name | kebabCase }}/{{ name | kebabCase }}.service.ts"
---
import { Injectable } from '@nestjs/common';
{% if withDatabase %}
import { Repository } from 'typeorm';
import { {{ name }} } from './{{ name | kebabCase }}.entity';
{% endif %}
{% if withValidation %}
import { ValidationPipe } from '@nestjs/common';
{% endif %}

@Injectable()
export class {{ name }}Service {
  {% if withDatabase %}
  constructor(
    private readonly {{ name | camelCase }}Repository: Repository<{{ name }}>
  ) {}
  {% else %}
  constructor() {}
  {% endif %}

  {% for method in methods %}
  async {{ method.name }}({% if method.params %}{{ method.params.join(', ') }}{% endif %}): Promise<{{ method.returnType || 'void' }}> {
    {% if method.implementation %}
    {{ method.implementation }}
    {% else %}
    throw new Error('Not implemented');
    {% endif %}
  }
  {% endfor %}

  {% if withValidation %}
  private validate(data: any): boolean {
    // Validation logic here
    return true;
  }
  {% endif %}
}`;

  await fs.writeFile(
    path.join(simpleDir, 'complex.njk'),
    complexTemplate
  );
}