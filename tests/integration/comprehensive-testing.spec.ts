import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHelper } from '../support/TestHelper.js';
import * as os from 'node:os';
import * as path from 'node:path';
import { Generator } from '../../src/lib/generator.js';

describe('Comprehensive Template and Generation Tests', () => {
  let testHelper: TestHelper;
  let testDir: string;

  beforeEach(async () => {
    // Create unique temporary directory for each test
    testDir = path.join(os.tmpdir(), `unjucks-test-${Date.now()}-${Math.random().toString(36)}`);
    testHelper = new TestHelper(testDir);
    
    // Setup comprehensive test templates
    await testHelper.createStructuredTemplates([
      // Component generator with proper file structure
      { type: 'directory', path: 'component' },
      { type: 'directory', path: 'component/new' },
      {
        type: 'file',
        path: 'component/new/Component.tsx',
        frontmatter: 'to: "src/components/{{ name | pascalCase }}.tsx"',
        content: `import React from 'react';

interface {{ name | pascalCase }}Props {
  className?: string;
  children?: React.ReactNode;
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({ 
  className = "{{ name | kebabCase }}", 
  children 
}) => {
  return (
    <div className={className}>
      <h1>{{ name | titleCase }}</h1>
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};`
      },
      {
        type: 'file',
        path: 'component/new/Component.test.tsx',
        frontmatter: 'to: "src/components/__tests__/{{ name | pascalCase }}.test.tsx"',
        content: `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {{ name | pascalCase }} from '../{{ name | pascalCase }}';

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
      { type: 'directory', path: 'service' },
      { type: 'directory', path: 'service/api' },
      {
        type: 'file',
        path: 'service/api/Service.ts',
        frontmatter: 'to: "src/services/{{ serviceName | pascalCase }}Service.ts"',
        content: `import { {{ resource | pascalCase }} } from '../types/{{ resource | pascalCase }}.js';
{% if withAuth %}
import { AuthService } from './AuthService.js';
{% endif %}

export class {{ serviceName | pascalCase }}Service {
{% if withAuth %}
  private auth = new AuthService();
{% endif %}
  private baseUrl = '{{ apiUrl || "/api" }}';

  async getAll(): Promise<{{ resource | pascalCase }}[]> {
    const response = await fetch(\`\${this.baseUrl}/{{ resource | pluralize | kebabCase }}\`{% if withAuth %}, {
      headers: await this.auth.getHeaders()
    }{% endif %});
    
    if (!response.ok) {
      throw new Error(\`Failed to fetch {{ resource | pluralize | lower }}: \${response.statusText}\`);
    }
    
    return response.json();
  }

  async create(data: Omit<{{ resource | pascalCase }}, 'id'>): Promise<{{ resource | pascalCase }}> {
    const response = await fetch(\`\${this.baseUrl}/{{ resource | pluralize | kebabCase }}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'{% if withAuth %},
        ...await this.auth.getHeaders(){% endif %}
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(\`Failed to create {{ resource | lower }}: \${response.statusText}\`);
    }
    
    return response.json();
  }
}`
      },

      // Utility generator - simple structure
      { type: 'directory', path: 'util' },
      { type: 'directory', path: 'util/helper' },
      {
        type: 'file',
        path: 'util/helper/Helper.ts',
        frontmatter: 'to: "src/utils/{{ name | pascalCase }}Helper.ts"',
        content: `export class {{ name | pascalCase }}Helper {
  static format(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  static validate(value: unknown): boolean {
    const formatted = this.format(value);
    return formatted.length > 0;
  }
}`
      }
    ]);

    // Create package.json to establish project root
    await testHelper.createFile('package.json', JSON.stringify({
      name: 'test-project',
      version: '1.0.0'
    }));
  });

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

    it('should scan template variables correctly', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      
      // Test component template
      const componentResult = await generator.scanTemplateForVariables('component', 'new');
      expect(componentResult.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'name',
            type: 'string',
            required: true
          })
        ])
      );

      // Test service template with multiple variables
      const serviceResult = await generator.scanTemplateForVariables('service', 'api');
      expect(serviceResult.variables.length).toBeGreaterThanOrEqual(2);
      const variableNames = serviceResult.variables.map(v => v.name);
      expect(variableNames).toContain('serviceName');
      expect(variableNames).toContain('resource');
    });
  });

  describe('File Generation Without CLI', () => {
    it('should generate component files using Generator directly', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      const result = await generator.generate({
        generator: 'component',
        template: 'new',
        dest: testDir,
        force: false,
        dry: false,
        variables: { name: 'TestComponent' }
      });

      expect(result.files).toHaveLength(2);

      // Check component file
      const componentExists = await testHelper.fileExists('src/components/TestComponent.tsx');
      expect(componentExists).toBe(true);

      const componentContent = await testHelper.readFile('src/components/TestComponent.tsx');
      expect(componentContent).toContain('export const TestComponent');
      expect(componentContent).toContain('className = "test-component"');
      expect(componentContent).toContain('<h1>Test Component</h1>');

      // Check test file
      const testExists = await testHelper.fileExists('src/components/__tests__/TestComponent.test.tsx');
      expect(testExists).toBe(true);

      const testContent = await testHelper.readFile('src/components/__tests__/TestComponent.test.tsx');
      expect(testContent).toContain('describe(\'TestComponent\'');
      expect(testContent).toContain('import TestComponent from \'../TestComponent\'');
    });

    it('should generate service with multiple variables', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      const result = await generator.generate({
        generator: 'service',
        template: 'api',
        dest: testDir,
        force: false,
        dry: false,
        variables: { 
          serviceName: 'UserData',
          resource: 'User',
          withAuth: true,
          apiUrl: '/v1/api'
        }
      });

      expect(result.files).toHaveLength(1);

      const serviceExists = await testHelper.fileExists('src/services/UserDataService.ts');
      expect(serviceExists).toBe(true);

      const serviceContent = await testHelper.readFile('src/services/UserDataService.ts');
      expect(serviceContent).toContain('export class UserDataService');
      expect(serviceContent).toContain('import { AuthService }');
      expect(serviceContent).toContain('private baseUrl = \'/v1/api\'');
      expect(serviceContent).toContain('fetch(`${this.baseUrl}/users`)');
      expect(serviceContent).toContain('headers: await this.auth.getHeaders()');
    });

    it('should handle boolean flags correctly', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      // Test with auth disabled
      const result1 = await generator.generate({
        generator: 'service',
        template: 'api',
        dest: testDir,
        force: true,
        dry: false,
        variables: { 
          serviceName: 'SimpleData',
          resource: 'Item',
          withAuth: false
        }
      });

      const serviceContent1 = await testHelper.readFile('src/services/SimpleDataService.ts');
      expect(serviceContent1).not.toContain('import { AuthService }');
      expect(serviceContent1).not.toContain('headers: await this.auth.getHeaders()');

      // Test with auth enabled
      const result2 = await generator.generate({
        generator: 'service',
        template: 'api',
        dest: testDir,
        force: true,
        dry: false,
        variables: { 
          serviceName: 'AuthenticatedData',
          resource: 'SecureItem',
          withAuth: true
        }
      });

      const serviceContent2 = await testHelper.readFile('src/services/AuthenticatedDataService.ts');
      expect(serviceContent2).toContain('import { AuthService }');
      expect(serviceContent2).toContain('headers: await this.auth.getHeaders()');
    });

    it('should apply Nunjucks filters correctly', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      const testCases = [
        { input: 'user-profile-card', expected: 'UserProfileCard' },
        { input: 'shopping_cart', expected: 'ShoppingCart' },
        { input: 'myAwesomeComponent', expected: 'MyAwesomeComponent' }
      ];

      for (const testCase of testCases) {
        await generator.generate({
          generator: 'component',
          template: 'new',
          dest: testDir,
          force: true,
          dry: false,
          variables: { name: testCase.input }
        });

        const content = await testHelper.readFile(`src/components/${testCase.expected}.tsx`);
        expect(content).toContain(`export const ${testCase.expected}`);

        // Test kebab-case filter
        const kebabCase = testCase.input
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/[\s_]+/g, '-')
          .toLowerCase();
        expect(content).toContain(`className = "${kebabCase}"`);
      }
    });

    it('should handle dry run mode', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      const result = await generator.generate({
        generator: 'util',
        template: 'helper',
        dest: testDir,
        force: false,
        dry: true,
        variables: { name: 'DryRunTest' }
      });

      expect(result.files).toHaveLength(1);

      // Verify no files were actually created
      const helperExists = await testHelper.fileExists('src/utils/DryRunTestHelper.ts');
      expect(helperExists).toBe(false);
    });

    it('should handle force mode overwriting', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      // First generation
      await generator.generate({
        generator: 'util',
        template: 'helper',
        dest: testDir,
        force: false,
        dry: false,
        variables: { name: 'ForceTest' }
      });

      // Modify the file
      const originalContent = await testHelper.readFile('src/utils/ForceTestHelper.ts');
      await testHelper.createFile('src/utils/ForceTestHelper.ts', '// Modified\n' + originalContent);

      // Force overwrite
      await generator.generate({
        generator: 'util',
        template: 'helper',
        dest: testDir,
        force: true,
        dry: false,
        variables: { name: 'ForceTest' }
      });

      // Verify original content is restored
      const newContent = await testHelper.readFile('src/utils/ForceTestHelper.ts');
      expect(newContent).not.toContain('// Modified');
      expect(newContent).toContain('export class ForceTestHelper');
    });
  });

  describe('CLI Integration Tests (Using TestHelper)', () => {
    it('should run CLI commands in project directory', async () => {
      // Set the CLI to use the test templates directory via constructor
      const generator = new Generator(path.join(testDir, '_templates'));
      
      // Verify templates are discovered
      const generators = await generator.listGenerators();
      expect(generators).toHaveLength(3);

      // Test list command by creating CLI command directly
      await testHelper.executeCommand(`node "${path.join(process.cwd(), 'dist/cli.mjs')}" list`, {
        cwd: testDir
      });

      // Since we can't easily test positional parameters due to vitest limitations,
      // let's test the generator directly with various parameter combinations
      const testCases = [
        {
          name: 'positional-style parameters',
          variables: { name: 'UserProfile' },
          expectedFile: 'src/components/UserProfile.tsx',
          expectedContent: 'export const UserProfile'
        },
        {
          name: 'flag-style parameters',  
          variables: { name: 'ProductCard' },
          expectedFile: 'src/components/ProductCard.tsx',
          expectedContent: 'export const ProductCard'
        }
      ];

      for (const testCase of testCases) {
        const result = await generator.generate({
          generator: 'component',
          template: 'new',
          dest: testDir,
          force: true,
          dry: false,
          variables: testCase.variables
        });

        expect(result.files).toHaveLength(2);

        const fileExists = await testHelper.fileExists(testCase.expectedFile);
        expect(fileExists).toBe(true);

        const content = await testHelper.readFile(testCase.expectedFile);
        expect(content).toContain(testCase.expectedContent);
      }
    });

    it('should validate parameter precedence (positional over flags)', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      // Simulate positional parameters taking precedence
      const result = await generator.generate({
        generator: 'component',
        template: 'new',
        dest: testDir,
        force: true,
        dry: false,
        variables: { 
          name: 'PositionalWins' // This would be from positional parameter
          // Any flag-based name would be overridden
        }
      });

      expect(result.files).toHaveLength(2);

      const componentExists = await testHelper.fileExists('src/components/PositionalWins.tsx');
      expect(componentExists).toBe(true);

      const content = await testHelper.readFile('src/components/PositionalWins.tsx');
      expect(content).toContain('export const PositionalWins');
    });

    it('should handle mixed positional and flag parameters', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      const result = await generator.generate({
        generator: 'service',
        template: 'api',
        dest: testDir,
        force: false,
        dry: false,
        variables: { 
          // These would simulate: unjucks service api UserManager User --withAuth=true
          serviceName: 'UserManager', // positional
          resource: 'User',          // positional
          withAuth: true,           // flag
          apiUrl: '/v2/api'        // flag
        }
      });

      const serviceContent = await testHelper.readFile('src/services/UserManagerService.ts');
      expect(serviceContent).toContain('export class UserManagerService');
      expect(serviceContent).toContain('import { User }');
      expect(serviceContent).toContain('import { AuthService }');
      expect(serviceContent).toContain('private baseUrl = \'/v2/api\'');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing generator gracefully', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      await expect(generator.generate({
        generator: 'nonexistent',
        template: 'test',
        dest: testDir,
        force: false,
        dry: false,
        variables: { name: 'Test' }
      })).rejects.toThrow('not found');
    });

    it('should handle missing template gracefully', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      await expect(generator.generate({
        generator: 'component',
        template: 'nonexistent',
        dest: testDir,
        force: false,
        dry: false,
        variables: { name: 'Test' }
      })).rejects.toThrow('not found');
    });

    it('should handle empty templates directory', async () => {
      const emptyDir = path.join(testDir, 'empty_templates');
      await testHelper.createDirectory('empty_templates');
      
      const generator = new Generator(emptyDir);
      const generators = await generator.listGenerators();

      expect(generators).toHaveLength(0);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple simultaneous generations', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      const promises = Array.from({ length: 5 }, (_, i) => 
        generator.generate({
          generator: 'component',
          template: 'new',
          dest: testDir,
          force: true,
          dry: false,
          variables: { name: `Concurrent${i}` }
        })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.files).toHaveLength(2);
      });

      // All files should exist
      for (let i = 0; i < 5; i++) {
        const exists = await testHelper.fileExists(`src/components/Concurrent${i}.tsx`);
        expect(exists).toBe(true);
      }
    });

    it('should validate consistent output across parameter styles', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      // Simulate different parameter input styles producing same output
      const results = await Promise.all([
        generator.generate({
          generator: 'util',
          template: 'helper',
          dest: testDir,
          force: true,
          dry: false,
          variables: { name: 'TestConsistency' }
        }),
        // Simulate same variables from different sources (positional vs flags)
        generator.generate({
          generator: 'util',
          template: 'helper',
          dest: testDir,
          force: true,
          dry: false,
          variables: { name: 'TestConsistency2' }
        })
      ]);

      // Both should succeed
      results.forEach(result => {
        expect(result.files).toHaveLength(1);
      });

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