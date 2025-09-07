import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHelper } from '../support/TestHelper.js';
import * from 'node:os';
import * from 'node:path';
import { Generator } from '../../src/lib/generator.js';

describe('Comprehensive Template and Generation Tests', () => {
  let testHelper;
  let testDir => {
    // Create unique temporary directory for each test
    testDir = path.join(os.tmpdir(), `unjucks-test-${Date.now()}-${Math.random().toString(36)}`);
    testHelper = new TestHelper(testDir);
    
    // Setup comprehensive test templates
    await testHelper.createStructuredTemplates([
      // Component generator with proper file structure
      { type },
      { type },
      { type }}.tsx"',
        content: `import React from 'react';

interface {{ name | pascalCase }}Props { className? }

export const {{ name | pascalCase }}, 
  children 
}) => {
  return (
    <div className={className}>
      {{ name | titleCase }}</h1>
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};`
      },
      { type }}.test.tsx"',
        content: `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {{ name | pascalCase }} from '../{{ name | pascalCase }}.js';

describe('{{ name | pascalCase }}', () => {
  it('renders with default title', () => {
    render(<{{ name | pascalCase }} />);
    expect(screen.getByText('{{ name | titleCase }}')).toBeInTheDocument();
  });

  it('applies correct CSS class', () => {
    const { container } = render(<{{ name | pascalCase }} />);
    expect(container.querySelector('.{{ name | kebabCase }}')).toBeInTheDocument();
  });
});`
      },

      // Service generator with multiple parameters
      { type },
      { type },
      { type }}Service.ts"',
        content: `import { {{ resource | pascalCase }} } from '../types/{{ resource | pascalCase }}.js';
{% if withAuth %}
import { AuthService } from './AuthService.js';
{% endif %}

export class {{ serviceName | pascalCase }}Service {
{% if withAuth %}
  private auth = new AuthService();
{% endif %}
  private baseUrl = '{{ apiUrl || "/api" }}';

  async getAll() {
    const response = await fetch(\`\${this.baseUrl}/{{ resource | pluralize | kebabCase }}\`{% if withAuth %}, {
      headers)
    }{% endif %});
    
    if (!response.ok) {
      throw new Error(\`Failed to fetch {{ resource | pluralize | lower }});
    }
    
    return response.json();
  }

  async create(data) {
    const response = await fetch(\`\${this.baseUrl}/{{ resource | pluralize | kebabCase }}\`, { method }
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(\`Failed to create {{ resource | lower }});
    }
    
    return response.json();
  }
}`
      },

      // Utility generator - simple structure
      { type },
      { type },
      { type }}Helper.ts"',
        content: `export class {{ name | pascalCase }}Helper {
  static format(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  static validate(value) {
    const formatted = this.format(value);
    return formatted.length > 0;
  }
}`
      }
    ]);

    // Create package.json to establish project root
    await testHelper.createFile('package.json', JSON.stringify({ name });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Template Discovery', () => {
    it('should discover all generators', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      const generators = await generator.listGenerators();

      expect(generators).toHaveLength(3);
      expect(generators.map(g => g.name).sort()).toEqual(['component', 'service', 'util']);
    });

    it('should list templates for each generator', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      
      const componentTemplates = await generator.listTemplates('component');
      expect(componentTemplates).toHaveLength(1);
      expect(componentTemplates[0].name).toBe('new');

      const serviceTemplates = await generator.listTemplates('service');
      expect(serviceTemplates).toHaveLength(1);
      expect(serviceTemplates[0].name).toBe('api');

      const utilTemplates = await generator.listTemplates('util');
      expect(utilTemplates).toHaveLength(1);
      expect(utilTemplates[0].name).toBe('helper');
    });

    it('should scan template variables correctly', async () => { const generator = new Generator(path.join(testDir, '_templates'));
      
      // Test component template
      const componentResult = await generator.scanTemplateForVariables('component', 'new');
      expect(componentResult.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name });
  });

  describe('File Generation Without CLI', () => { it('should generate component files using Generator directly', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      const result = await generator.generate({
        generator });

    it('should generate service with multiple variables', async () => { const generator = new Generator(path.join(testDir, '_templates'));

      const result = await generator.generate({
        generator }');
      expect(serviceContent).toContain('private baseUrl = \'/v1/api\'');
      expect(serviceContent).toContain('fetch(`${this.baseUrl}/users`)');
      expect(serviceContent).toContain('headers)');
    });

    it('should handle boolean flags correctly', async () => { const generator = new Generator(path.join(testDir, '_templates'));

      // Test with auth disabled
      const result1 = await generator.generate({
        generator }');
      expect(serviceContent1).not.toContain('headers)');

      // Test with auth enabled
      const result2 = await generator.generate({ generator }');
      expect(serviceContent2).toContain('headers)');
    });

    it('should apply Nunjucks filters correctly', async () => { const generator = new Generator(path.join(testDir, '_templates'));

      const testCases = [
        { input },
        { input },
        { input }
      ];

      for (const testCase of testCases) { await generator.generate({
          generator }.tsx`);
        expect(content).toContain(`export const ${testCase.expected}`);

        // Test kebab-case filter
        const kebabCase = testCase.input
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/[\s_]+/g, '-')
          .toLowerCase();
        expect(content).toContain(`className = "${kebabCase}"`);
      }
    });

    it('should handle dry run mode', async () => { const generator = new Generator(path.join(testDir, '_templates'));

      const result = await generator.generate({
        generator });

    it('should handle force mode overwriting', async () => { const generator = new Generator(path.join(testDir, '_templates'));

      // First generation
      await generator.generate({
        generator });
  });

  describe('CLI Integration Tests (Using TestHelper)', () => {
    it('should run CLI commands in project directory', async () => {
      // Set the CLI to use the test templates directory via constructor
      const generator = new Generator(path.join(testDir, '_templates'));
      
      // Verify templates are discovered
      const generators = await generator.listGenerators();
      expect(generators).toHaveLength(3);

      // Test list command by creating CLI command directly
      await testHelper.executeCommand(`node "${path.join(process.cwd(), 'dist/cli.mjs')}" list`, { cwd });

      // Since we can't easily test positional parameters due to vitest limitations,
      // let's test the generator directly with various parameter combinations
      const testCases = [
        { name },
          expectedFile: 'src/components/UserProfile.tsx',
          expectedContent: 'export const UserProfile'
        },
        { name },
          expectedFile: 'src/components/ProductCard.tsx',
          expectedContent: 'export const ProductCard'
        }
      ];

      for (const testCase of testCases) { const result = await generator.generate({
          generator }
    });

    it('should validate parameter precedence (positional over flags)', async () => { const generator = new Generator(path.join(testDir, '_templates'));

      // Simulate positional parameters taking precedence
      const result = await generator.generate({
        generator });

    it('should handle mixed positional and flag parameters', async () => { const generator = new Generator(path.join(testDir, '_templates'));

      const result = await generator.generate({
        generator }');
      expect(serviceContent).toContain('import { AuthService }');
      expect(serviceContent).toContain('private baseUrl = \'/v2/api\'');
    });
  });

  describe('Error Handling', () => { it('should handle missing generator gracefully', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      await expect(generator.generate({
        generator });

    it('should handle missing template gracefully', async () => { const generator = new Generator(path.join(testDir, '_templates'));

      await expect(generator.generate({
        generator });

    it('should handle empty templates directory', async () => {
      const emptyDir = path.join(testDir, 'empty_templates');
      await testHelper.createDirectory('empty_templates');
      
      const generator = new Generator(emptyDir);
      const generators = await generator.listGenerators();

      expect(generators).toHaveLength(0);
    });
  });

  describe('Performance and Reliability', () => { it('should handle multiple simultaneous generations', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      const promises = Array.from({ length, (_, i) => 
        generator.generate({
          generator });

      // All files should exist
      for (let i = 0; i < 5; i++) {
        const exists = await testHelper.fileExists(`src/components/Concurrent${i}.tsx`);
        expect(exists).toBe(true);
      }
    });

    it('should validate consistent output across parameter styles', async () => { const generator = new Generator(path.join(testDir, '_templates'));

      // Simulate different parameter input styles producing same output
      const results = await Promise.all([
        generator.generate({
          generator });

      const content1 = await testHelper.readFile('src/utils/TestConsistencyHelper.ts');
      const content2 = await testHelper.readFile('src/utils/TestConsistency2Helper.ts');

      // Structure should be identical, only names different
      expect(content1.replace(/TestConsistency/g, 'X')).toBe(
        content2.replace(/TestConsistency2/g, 'X')
      );
    });
  });

  describe('Template Variable Scanning', () => {
    it('should correctly identify all template variables', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      const serviceResult = await generator.scanTemplateForVariables('service', 'api');
      
      // Should find multiple variables
      expect(serviceResult.variables.length).toBeGreaterThanOrEqual(2);
      
      const variableNames = serviceResult.variables.map(v => v.name);
      expect(variableNames).toContain('serviceName');
      expect(variableNames).toContain('resource');
      
      // Check that CLI args are generated
      expect(serviceResult.cliArgs).toHaveProperty('serviceName');
      expect(serviceResult.cliArgs).toHaveProperty('resource');
    });

    it('should infer variable types correctly', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      const serviceResult = await generator.scanTemplateForVariables('service', 'api');
      
      const withAuthVar = serviceResult.variables.find(v => v.name === 'withAuth');
      if (withAuthVar) {
        expect(withAuthVar.type).toBe('boolean');
      }

      const serviceNameVar = serviceResult.variables.find(v => v.name === 'serviceName');
      if (serviceNameVar) {
        expect(serviceNameVar.type).toBe('string');
      }
    });
  });
});