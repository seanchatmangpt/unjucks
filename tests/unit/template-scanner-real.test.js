/**
 * Real Template Scanner Tests - Tests actual scanning functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { TemplateScanner } from '../../src/lib/template-scanner.js';

describe('TemplateScanner - Real Functionality', () => {
  let testDir;
  let templatesDir;
  let scanner;

  beforeEach(async () => {
    // Create unique test directory
    testDir = path.join(process.cwd(), 'tests', 'temp', `scanner-test-${this.getDeterministicTimestamp()}`);
    templatesDir = path.join(testDir, '_templates');
    
    await fs.ensureDir(templatesDir);
    scanner = new TemplateScanner(templatesDir);
    
    // Create test templates with various patterns
    await createTestTemplates(templatesDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.remove(testDir);
    } catch (error) {
      console.warn('Could not clean up test directory:', error.message);
    }
  });

  describe('Template Discovery', () => {
    it('should scan all templates in directory', async () => {
      const result = await scanner.scanAll();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      
      // Should find our test generators
      expect(Object.keys(result).length).toBeGreaterThan(0);
    });

    it('should scan specific generator', async () => {
      const result = await scanner.scanGenerator('component');

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      
      // Should find templates in component generator
      if (Object.keys(result).length > 0) {
        const firstTemplate = Object.values(result)[0];
        expect(firstTemplate).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          variables: expect.any(Array)
        });
      }
    });

    it('should scan specific template', async () => {
      const result = await scanner.scanTemplate('component', 'react');

      expect(result).toMatchObject({
        name: 'react',
        description: expect.any(String),
        variables: expect.any(Array),
        dependencies: expect.any(Array)
      });
    });

    it('should handle non-existent generator', async () => {
      const result = await scanner.scanGenerator('nonexistent');
      expect(result).toEqual({});
    });

    it('should handle non-existent template', async () => {
      const result = await scanner.scanTemplate('component', 'nonexistent');
      expect(result).toBeDefined();
      expect(result.variables).toEqual([]);
    });
  });

  describe('Variable Extraction', () => {
    it('should extract Nunjucks variables', async () => {
      const content = `
        <h1>{{ title }}</h1>
        <p>{{ description | safe }}</p>
        <div class="{{ className }}">{{ content }}</div>
      `;

      const variables = scanner.extractVariablesFromContent(content);

      expect(variables.length).toBeGreaterThan(0);
      
      const variableNames = variables.map(v => v.name);
      expect(variableNames).toContain('title');
      expect(variableNames).toContain('description');
      expect(variableNames).toContain('className');
      expect(variableNames).toContain('content');
    });

    it('should extract variables from conditionals', async () => {
      const content = `
        {% if showHeader %}
          <h1>{{ title }}</h1>
        {% endif %}
        {% if user.isAdmin %}
          <button>Admin Panel</button>
        {% endif %}
      `;

      const variables = scanner.extractVariablesFromContent(content);

      expect(variables.length).toBeGreaterThan(0);
      
      const variableNames = variables.map(v => v.name);
      expect(variableNames).toContain('showHeader');
      expect(variableNames).toContain('title');
      expect(variableNames).toContain('user');
    });

    it('should extract variables from loops', async () => {
      const content = `
        {% for item in items %}
          <li>{{ item.name }}</li>
        {% endfor %}
        {% for user in users %}
          <p>{{ user.email }}</p>
        {% endfor %}
      `;

      const variables = scanner.extractVariablesFromContent(content);

      expect(variables.length).toBeGreaterThan(0);
      
      const variableNames = variables.map(v => v.name);
      expect(variableNames).toContain('items');
      expect(variableNames).toContain('users');
      expect(variableNames).toContain('item');
      expect(variableNames).toContain('user');
    });

    it('should extract variables from frontmatter', async () => {
      const content = `---
to: "{{ name | kebabCase }}.component.ts"
inject: true
---
export class {{ name }}Component {
  constructor() {}
}`;

      const variables = scanner.extractVariablesFromContent(content);

      expect(variables.length).toBeGreaterThan(0);
      
      const variableNames = variables.map(v => v.name);
      expect(variableNames).toContain('name');
      
      // Check that frontmatter variables are marked as used in filename
      const nameVariable = variables.find(v => v.name === 'name');
      expect(nameVariable.usedInFilename).toBe(true);
    });

    it('should handle EJS-style variables', async () => {
      const content = `
        <h1><%= title %></h1>
        <% if (showContent) { %>
          <p><%= description %></p>
        <% } %>
      `;

      const variables = scanner.extractVariablesFromContent(content);

      expect(variables.length).toBeGreaterThan(0);
      
      const variableNames = variables.map(v => v.name);
      expect(variableNames).toContain('title');
      expect(variableNames).toContain('showContent');
      expect(variableNames).toContain('description');
    });

    it('should infer variable types correctly', async () => {
      const content = `
        {% if isVisible %}Show{% endif %}
        {% for item in itemList %}{{ item }}{% endfor %}
        <input value="{{ userId }}" />
        <span>{{ userName }}</span>
      `;

      const variables = scanner.extractVariablesFromContent(content);

      const isVisibleVar = variables.find(v => v.name === 'isVisible');
      expect(isVisibleVar?.type).toBe('boolean');

      const itemListVar = variables.find(v => v.name === 'itemList');
      expect(itemListVar?.type).toBe('array');

      const userIdVar = variables.find(v => v.name === 'userId');
      expect(userIdVar?.type).toBe('number');

      const userNameVar = variables.find(v => v.name === 'userName');
      expect(userNameVar?.type).toBe('string');
    });

    it('should exclude reserved words and filters', async () => {
      const content = `
        {{ name | upper }}
        {{ title | default("No Title") }}
        {{ items | length }}
        {{ date | format }}
      `;

      const variables = scanner.extractVariablesFromContent(content);

      const variableNames = variables.map(v => v.name);
      expect(variableNames).toContain('name');
      expect(variableNames).toContain('title');
      expect(variableNames).toContain('items');
      expect(variableNames).toContain('date');
      
      // Should not include filter names as variables
      expect(variableNames).not.toContain('upper');
      expect(variableNames).not.toContain('default');
      expect(variableNames).not.toContain('length');
      expect(variableNames).not.toContain('format');
    });
  });

  describe('Template File Discovery', () => {
    it('should find template files recursively', async () => {
      const templateDir = path.join(templatesDir, 'component', 'react');
      const files = await scanner.getTemplateFiles(templateDir);

      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.endsWith('.njk') || f.endsWith('.ejs'))).toBe(true);
    });

    it('should handle empty directories', async () => {
      const emptyDir = path.join(templatesDir, 'empty');
      await fs.ensureDir(emptyDir);

      const files = await scanner.getTemplateFiles(emptyDir);
      expect(files).toEqual([]);
    });

    it('should handle non-existent directories', async () => {
      const nonExistentDir = path.join(templatesDir, 'nonexistent');
      
      const files = await scanner.getTemplateFiles(nonExistentDir);
      expect(files).toEqual([]);
    });
  });

  describe('Dependency Extraction', () => {
    it('should extract CommonJS dependencies', async () => {
      const content = `
        const fs = require('fs');
        const path = require('path');
        const lodash = require('lodash');
      `;

      const dependencies = scanner.extractDependenciesFromContent(content);

      expect(dependencies).toContain('fs');
      expect(dependencies).toContain('path');
      expect(dependencies).toContain('lodash');
    });

    it('should extract ES6 dependencies', async () => {
      const content = `
        import React from 'react';
        import { useState } from 'react';
        import utils from './utils';
      `;

      const dependencies = scanner.extractDependenciesFromContent(content);

      expect(dependencies).toContain('react');
      expect(dependencies).toContain('./utils');
    });

    it('should handle mixed dependency formats', async () => {
      const content = `
        import React from 'react';
        const fs = require('fs');
        import { Component } from './components';
      `;

      const dependencies = scanner.extractDependenciesFromContent(content);

      expect(dependencies).toContain('react');
      expect(dependencies).toContain('fs');
      expect(dependencies).toContain('./components');
    });
  });

  describe('Variable Name Validation', () => {
    it('should validate variable names correctly', () => {
      // Valid names
      expect(scanner.isValidVariableName('validName')).toBe(true);
      expect(scanner.isValidVariableName('_private')).toBe(true);
      expect(scanner.isValidVariableName('$special')).toBe(true);
      expect(scanner.isValidVariableName('name123')).toBe(true);

      // Invalid names
      expect(scanner.isValidVariableName('123invalid')).toBe(false);
      expect(scanner.isValidVariableName('invalid-name')).toBe(false);
      expect(scanner.isValidVariableName('')).toBe(false);
      expect(scanner.isValidVariableName(null)).toBe(false);
      expect(scanner.isValidVariableName(undefined)).toBe(false);

      // Reserved words
      expect(scanner.isValidVariableName('default')).toBe(false);
      expect(scanner.isValidVariableName('length')).toBe(false);
      expect(scanner.isValidVariableName('upper')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed template content', async () => {
      const malformedContent = `
        {{{{ invalid syntax }}}}
        {% broken if statement
        <% unclosed ejs
      `;

      const variables = scanner.extractVariablesFromContent(malformedContent);
      expect(Array.isArray(variables)).toBe(true);
      // Should not crash and return what it can parse
    });

    it('should handle binary file content', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF]).toString();
      
      const variables = scanner.extractVariablesFromContent(binaryContent);
      expect(Array.isArray(variables)).toBe(true);
    });

    it('should handle null/undefined content', async () => {
      expect(scanner.extractVariablesFromContent(null)).toEqual([]);
      expect(scanner.extractVariablesFromContent(undefined)).toEqual([]);
      expect(scanner.extractVariablesFromContent('')).toEqual([]);
    });
  });
});

/**
 * Helper function to create test templates
 */
async function createTestTemplates(templatesDir) {
  // Component generator with React template
  const componentReactDir = path.join(templatesDir, 'component', 'react');
  await fs.ensureDir(componentReactDir);

  const reactTemplate = `---
to: "{{ name | pascalCase }}.tsx"
inject: false
---
import React from 'react';

interface {{ name | pascalCase }}Props {
  {% if withProps %}
  title?: string;
  children?: React.ReactNode;
  {% endif %}
}

const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({ 
  {% if withProps %}title, children{% endif %} 
}) => {
  {% if hasState %}
  const [isVisible, setIsVisible] = React.useState(true);
  {% endif %}

  return (
    <div className="{{ name | kebabCase }}">
      {% if withProps %}
      {title && <h1>{title}</h1>}
      {children}
      {% endif %}
      {% for item in items %}
      <div key="{{ item.id }}">{{ item.name }}</div>
      {% endfor %}
    </div>
  );
};

export default {{ name | pascalCase }};
`;

  await fs.writeFile(
    path.join(componentReactDir, 'component.njk'),
    reactTemplate
  );

  // Service generator with API template
  const serviceApiDir = path.join(templatesDir, 'service', 'api');
  await fs.ensureDir(serviceApiDir);

  const serviceTemplate = `---
to: "{{ name | kebabCase }}.service.ts"
---
import { Injectable } from '@nestjs/common';
{% if useDatabase %}
import { Repository } from 'typeorm';
import { {{ name | pascalCase }} } from './{{ name | kebabCase }}.entity';
{% endif %}

@Injectable()
export class {{ name | pascalCase }}Service {
  {% if useDatabase %}
  constructor(
    private readonly {{ name | camelCase }}Repository: Repository<{{ name | pascalCase }}>
  ) {}
  {% endif %}

  async findAll(): Promise<{{ name | pascalCase }}[]> {
    {% if useDatabase %}
    return this.{{ name | camelCase }}Repository.find();
    {% else %}
    // Mock implementation
    return [];
    {% endif %}
  }

  async findById(id: {{ idType || 'string' }}): Promise<{{ name | pascalCase }}> {
    {% if useDatabase %}
    return this.{{ name | camelCase }}Repository.findOne({ where: { id } });
    {% else %}
    throw new Error('Not implemented');
    {% endif %}
  }
}
`;

  await fs.writeFile(
    path.join(serviceApiDir, 'service.njk'),
    serviceTemplate
  );

  // Test generator with EJS template
  const testEjsDir = path.join(templatesDir, 'test', 'ejs');
  await fs.ensureDir(testEjsDir);

  const ejsTemplate = `---
to: "<%= name.toLowerCase() %>.test.js"
---
describe('<%= name %>', () => {
  <% if (withSetup) { %>
  beforeEach(() => {
    // Setup code here
  });
  <% } %>

  it('should work correctly', () => {
    <% if (useExpect) { %>
    expect(true).toBe(true);
    <% } else { %>
    assert(true);
    <% } %>
  });

  <% if (testCases && testCases.length > 0) { %>
  <% testCases.forEach(function(testCase) { %>
  it('should <%= testCase.description %>', () => {
    // Test implementation for <%= testCase.name %>
  });
  <% }); %>
  <% } %>
});
`;

  await fs.writeFile(
    path.join(testEjsDir, 'test.ejs'),
    ejsTemplate
  );

  // Complex template with multiple variable types
  const complexDir = path.join(templatesDir, 'complex', 'full');
  await fs.ensureDir(complexDir);

  const complexTemplate = `---
to: "{{ moduleName | kebabCase }}/{{ name | kebabCase }}.{{ fileExtension || 'ts' }}"
inject: false
---
{% if isModule %}
export module {{ moduleName | pascalCase }} {
{% endif %}

{% if useInterfaces %}
interface {{ name | pascalCase }}Config {
  apiUrl: string;
  timeout: number;
  retries: number;
  {% if enableAuth %}
  authToken?: string;
  {% endif %}
}
{% endif %}

export class {{ name | pascalCase }} {
  {% if hasConfig %}
  private config: {{ name | pascalCase }}Config;
  {% endif %}
  
  {% if isStatic %}
  static instance: {{ name | pascalCase }};
  {% endif %}

  constructor({% if hasConfig %}config: {{ name | pascalCase }}Config{% endif %}) {
    {% if hasConfig %}
    this.config = config;
    {% endif %}
    {% if isStatic %}
    {{ name | pascalCase }}.instance = this;
    {% endif %}
  }

  {% for method in methods %}
  {{ method.visibility || 'public' }} {% if method.isAsync %}async {% endif %}{{ method.name }}({% if method.params %}{{ method.params.join(', ') }}{% endif %}): {% if method.isAsync %}Promise<{% endif %}{{ method.returnType || 'void' }}{% if method.isAsync %}>{% endif %} {
    {% if method.implementation %}
    {{ method.implementation }}
    {% else %}
    throw new Error('Not implemented');
    {% endif %}
  }
  {% endfor %}

  {% if hasUtils %}
  private static utils = {
    {% for util in utilMethods %}
    {{ util.name }}: ({{ util.params || '' }}) => {
      {{ util.body || 'return null;' }}
    },
    {% endfor %}
  };
  {% endif %}
}

{% if isModule %}
}
{% endif %}

{% if hasExports %}
export { {{ name | pascalCase }} };
{% if exportTypes %}
export type { {{ name | pascalCase }}Config };
{% endif %}
{% endif %}
`;

  await fs.writeFile(
    path.join(complexDir, 'complex.njk'),
    complexTemplate
  );
}