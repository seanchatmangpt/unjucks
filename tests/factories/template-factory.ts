import path from 'node:path';
import { faker } from '@faker-js/faker';
import type { 
  TemplateFile, 
  GeneratorConfig, 
  TemplateConfig, 
  PromptConfig,
  TemplateVariable 
} from '../../src/lib/generator.js';
import type { FrontmatterConfig } from '../../src/lib/frontmatter-parser.js';

export class TemplateFactory {
  /**
   * Create a mock template file
   */
  static createTemplateFile(overrides: Partial<TemplateFile> = {}): TemplateFile {
    return {
      path: overrides.path || `src/components/${faker.system.fileName()}.ts`,
      content: overrides.content || this.generateTemplateContent(),
      frontmatter: overrides.frontmatter || this.createFrontmatter(),
      ...overrides
    };
  }

  /**
   * Create multiple template files
   */
  static createTemplateFiles(count: number = 3): TemplateFile[] {
    return Array.from({ length: count }, () => this.createTemplateFile());
  }

  /**
   * Create generator configuration
   */
  static createGeneratorConfig(overrides: Partial<GeneratorConfig> = {}): GeneratorConfig {
    return {
      name: overrides.name || faker.hacker.noun(),
      description: overrides.description || faker.lorem.sentence(),
      templates: overrides.templates || [this.createTemplateConfig()],
      ...overrides
    };
  }

  /**
   * Create template configuration
   */
  static createTemplateConfig(overrides: Partial<TemplateConfig> = {}): TemplateConfig {
    return {
      name: overrides.name || faker.hacker.noun(),
      description: overrides.description || faker.lorem.sentence(),
      files: overrides.files || [
        'component.njk',
        'component.test.njk',
        'index.njk'
      ],
      prompts: overrides.prompts || [this.createPromptConfig()],
      ...overrides
    };
  }

  /**
   * Create prompt configuration
   */
  static createPromptConfig(overrides: Partial<PromptConfig> = {}): PromptConfig {
    const types: Array<'input' | 'confirm' | 'list' | 'checkbox'> = ['input', 'confirm', 'list', 'checkbox'];
    
    return {
      name: overrides.name || faker.hacker.noun(),
      message: overrides.message || faker.lorem.sentence(),
      type: overrides.type || faker.helpers.arrayElement(types),
      default: overrides.default || faker.datatype.boolean(),
      choices: overrides.choices || faker.helpers.arrayElements([
        'option1', 'option2', 'option3'
      ]),
      ...overrides
    };
  }

  /**
   * Create template variable
   */
  static createTemplateVariable(overrides: Partial<TemplateVariable> = {}): TemplateVariable {
    const types: Array<'string' | 'boolean' | 'number'> = ['string', 'boolean', 'number'];
    
    return {
      name: overrides.name || faker.hacker.noun(),
      type: overrides.type || faker.helpers.arrayElement(types),
      defaultValue: overrides.defaultValue || faker.datatype.string(),
      description: overrides.description || faker.lorem.sentence(),
      required: overrides.required ?? faker.datatype.boolean(),
      ...overrides
    };
  }

  /**
   * Create frontmatter configuration
   */
  static createFrontmatter(overrides: Partial<FrontmatterConfig> = {}): FrontmatterConfig {
    return {
      to: overrides.to || `src/{{ name | kebabCase }}.ts`,
      inject: overrides.inject ?? false,
      before: overrides.before,
      after: overrides.after,
      append: overrides.append,
      prepend: overrides.prepend,
      lineAt: overrides.lineAt,
      skipIf: overrides.skipIf,
      chmod: overrides.chmod,
      sh: overrides.sh,
      ...overrides
    };
  }

  /**
   * Generate realistic template content
   */
  static generateTemplateContent(type: 'component' | 'service' | 'test' | 'config' = 'component'): string {
    const templates = {
      component: `import React from 'react';

interface {{ name | pascalCase }}Props {
  title: string;
  {{ #if hasDescription }}
  description?: string;
  {{ /if }}
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({ 
  title{{ #if hasDescription }}, description{{ /if }} 
}) => {
  return (
    <div className="{{ name | kebabCase }}">
      <h1>{title}</h1>
      {{ #if hasDescription }}
      {description && <p>{description}</p>}
      {{ /if }}
    </div>
  );
};`,

      service: `export interface {{ name | pascalCase }}Service {
  create(data: {{ name | pascalCase }}Data): Promise<{{ name | pascalCase }}>;
  findById(id: string): Promise<{{ name | pascalCase }} | null>;
  update(id: string, data: Partial<{{ name | pascalCase }}Data>): Promise<{{ name | pascalCase }}>;
  delete(id: string): Promise<void>;
}

export class {{ name | pascalCase }}ServiceImpl implements {{ name | pascalCase }}Service {
  async create(data: {{ name | pascalCase }}Data): Promise<{{ name | pascalCase }}> {
    // Implementation here
    throw new Error('Not implemented');
  }

  async findById(id: string): Promise<{{ name | pascalCase }} | null> {
    // Implementation here
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<{{ name | pascalCase }}Data>): Promise<{{ name | pascalCase }}> {
    // Implementation here
    throw new Error('Not implemented');
  }

  async delete(id: string): Promise<void> {
    // Implementation here
    throw new Error('Not implemented');
  }
}`,

      test: `import { describe, it, expect, beforeEach, vi } from 'vitest';
import { {{ name | pascalCase }} } from '../{{ name | kebabCase }}.js';

describe('{{ name | pascalCase }}', () => {
  let {{ name | camelCase }}: {{ name | pascalCase }};

  beforeEach(() => {
    {{ name | camelCase }} = new {{ name | pascalCase }}();
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect({{ name | camelCase }}).toBeDefined();
    });
  });

  describe('core functionality', () => {
    it('should handle basic operations', async () => {
      // Test implementation
      expect(true).toBe(true);
    });
  });
});`,

      config: `{
  "name": "{{ name | kebabCase }}",
  "version": "1.0.0",
  "description": "{{ description || 'Generated configuration' }}",
  {{ #if hasTypeScript }}
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  {{ /if }}
  "scripts": {
    "build": "{{ buildCommand || 'tsc' }}",
    "test": "{{ testCommand || 'vitest' }}",
    "dev": "{{ devCommand || 'vitest --watch' }}"
  }
}`
    };

    return templates[type];
  }

  /**
   * Create template content with variables
   */
  static createTemplateWithVariables(variables: Record<string, any>): string {
    const content = this.generateTemplateContent();
    const variableNames = Object.keys(variables);
    
    // Inject random variables into the template
    let modifiedContent = content;
    variableNames.forEach(varName => {
      if (Math.random() > 0.5) {
        modifiedContent += `\n<!-- {{ ${varName} }} -->`;
      }
    });

    return modifiedContent;
  }

  /**
   * Create malformed template for error testing
   */
  static createMalformedTemplate(): string {
    return `
      {{ unclosed_tag
      {% invalid syntax %}
      {{ undefined_variable | nonexistent_filter }}
      {% for item in %}
      {% endfor
    `;
  }

  /**
   * Create large template for performance testing
   */
  static createLargeTemplate(size: number = 1000): string {
    const baseContent = this.generateTemplateContent();
    const lines: string[] = [];
    
    for (let i = 0; i < size; i++) {
      lines.push(`// Line ${i}: {{ variable_${i} | filter_${i % 10} }}`);
      if (i % 10 === 0) {
        lines.push(baseContent);
      }
    }

    return lines.join('\n');
  }

  /**
   * Create templates for specific scenarios
   */
  static createScenarioTemplates() {
    return {
      simple: {
        content: 'Hello {{ name }}!',
        variables: ['name']
      },
      complex: {
        content: this.generateTemplateContent(),
        variables: ['name', 'hasDescription', 'description']
      },
      nested: {
        content: `
          {% for item in items %}
            {{ item.name | upper }}
            {% for subItem in item.children %}
              - {{ subItem.value }}
            {% endfor %}
          {% endfor %}
        `,
        variables: ['items']
      },
      conditional: {
        content: `
          {% if isEnabled %}
            <p>Feature is enabled</p>
            {% if hasConfig %}
              Config: {{ config.value }}
            {% endif %}
          {% else %}
            <p>Feature is disabled</p>
          {% endif %}
        `,
        variables: ['isEnabled', 'hasConfig', 'config']
      }
    };
  }
}

// Convenience exports
export const {
  createTemplateFile,
  createTemplateFiles,
  createGeneratorConfig,
  createTemplateConfig,
  createPromptConfig,
  createTemplateVariable,
  createFrontmatter,
  generateTemplateContent,
  createTemplateWithVariables,
  createMalformedTemplate,
  createLargeTemplate,
  createScenarioTemplates
} = TemplateFactory;