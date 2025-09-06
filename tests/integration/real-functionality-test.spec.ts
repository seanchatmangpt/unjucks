import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { Generator } from '../../src/lib/generator.js';

describe('Real Functionality Integration Tests', () => {
  let testDir: string;
  let templatesDir: string;

  beforeEach(async () => {
    // Create unique temporary directory for each test
    testDir = path.join(os.tmpdir(), `unjucks-test-${Date.now()}-${Math.random().toString(36)}`);
    templatesDir = path.join(testDir, '_templates');
    
    // Ensure directories exist
    await fs.ensureDir(testDir);
    await fs.ensureDir(templatesDir);
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.remove(testDir);
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  });

  describe('Template Discovery Tests', () => {
    it('should discover generators from existing templates', async () => {
      // Use the actual project templates that exist
      const projectTemplatesDir = path.join(process.cwd(), '_templates');
      
      // Check if project templates exist
      const projectTemplatesExist = await fs.pathExists(projectTemplatesDir);
      if (!projectTemplatesExist) {
        // Skip this test if no project templates
        return;
      }

      const generator = new Generator(projectTemplatesDir);
      const generators = await generator.listGenerators();

      expect(generators).toBeDefined();
      expect(Array.isArray(generators)).toBe(true);

      if (generators.length > 0) {
        // Verify generator structure
        generators.forEach(gen => {
          expect(gen).toHaveProperty('name');
          expect(typeof gen.name).toBe('string');
          expect(gen.name.length).toBeGreaterThan(0);
        });

        // Test template listing for first generator
        const firstGen = generators[0];
        const templates = await generator.listTemplates(firstGen.name);
        expect(Array.isArray(templates)).toBe(true);
      }
    });

    it('should handle empty templates directory gracefully', async () => {
      const generator = new Generator(templatesDir);
      const generators = await generator.listGenerators();

      expect(generators).toEqual([]);
    });

    it('should handle non-existent templates directory', async () => {
      const nonExistentDir = path.join(testDir, 'does-not-exist');
      const generator = new Generator(nonExistentDir);
      const generators = await generator.listGenerators();

      expect(generators).toEqual([]);
    });
  });

  describe('Template Creation and Processing', () => {
    it('should create and process a simple template', async () => {
      // Create a simple template structure
      const componentDir = path.join(templatesDir, 'component', 'simple');
      await fs.ensureDir(componentDir);

      // Create a simple template file
      const templateContent = `---
to: "output/{{ name }}.txt"
---
Hello {{ name }}!
This is a test template.`;

      await fs.writeFile(path.join(componentDir, 'test.txt'), templateContent);

      // Test the generator
      const generator = new Generator(templatesDir);
      
      // Verify generator discovery
      const generators = await generator.listGenerators();
      expect(generators).toHaveLength(1);
      expect(generators[0].name).toBe('component');

      // Verify template discovery
      const templates = await generator.listTemplates('component');
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('simple');

      // Test variable scanning
      const scanResult = await generator.scanTemplateForVariables('component', 'simple');
      expect(scanResult.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'name',
            type: 'string'
          })
        ])
      );

      // Test file generation
      const result = await generator.generate({
        generator: 'component',
        template: 'simple',
        dest: testDir,
        force: false,
        dry: false,
        variables: { name: 'TestComponent' }
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toContain('output/TestComponent.txt');

      // Verify file was created
      const outputFile = path.join(testDir, 'output/TestComponent.txt');
      const exists = await fs.pathExists(outputFile);
      expect(exists).toBe(true);

      // Verify content
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('Hello TestComponent!');
      expect(content).toContain('This is a test template.');
    });

    it('should handle multiple variables and filters', async () => {
      // Create a more complex template
      const serviceDir = path.join(templatesDir, 'service', 'api');
      await fs.ensureDir(serviceDir);

      const templateContent = `---
to: "src/services/{{ serviceName | pascalCase }}Service.ts"
---
export class {{ serviceName | pascalCase }}Service {
  private resource = '{{ resource | kebabCase }}';
  
  constructor() {
    console.log('{{ serviceName | titleCase }} service initialized');
  }
  
  async get{{ resource | pascalCase }}() {
    return fetch(\`/api/\${this.resource}\`);
  }
}`;

      await fs.writeFile(path.join(serviceDir, 'service.ts'), templateContent);

      const generator = new Generator(templatesDir);

      // Test variable scanning
      const scanResult = await generator.scanTemplateForVariables('service', 'api');
      expect(scanResult.variables.length).toBeGreaterThanOrEqual(2);

      const variableNames = scanResult.variables.map(v => v.name);
      expect(variableNames).toContain('serviceName');
      expect(variableNames).toContain('resource');

      // Test generation with filters
      const result = await generator.generate({
        generator: 'service',
        template: 'api',
        dest: testDir,
        force: false,
        dry: false,
        variables: { 
          serviceName: 'userDataManager',
          resource: 'userProfile'
        }
      });

      expect(result.files).toHaveLength(1);

      // Verify file creation and content
      const outputFile = path.join(testDir, 'src/services/UserDataManagerService.ts');
      const exists = await fs.pathExists(outputFile);
      expect(exists).toBe(true);

      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('export class UserDataManagerService');
      expect(content).toContain('private resource = \'user-profile\'');
      expect(content).toContain('User Data Manager service initialized');
      expect(content).toContain('async getUserProfile()');
    });

    it('should handle conditional logic with boolean variables', async () => {
      const templateDir = path.join(templatesDir, 'config', 'env');
      await fs.ensureDir(templateDir);

      const templateContent = `---
to: "config/{{ envName }}.config.js"
---
module.exports = {
  name: '{{ envName }}',
  debug: {{ enableDebug }},
{% if enableDebug %}
  debugLevel: 'verbose',
  debugOutput: 'console',
{% endif %}
{% if enableAuth %}
  auth: {
    enabled: true,
    provider: '{{ authProvider || "local" }}'
  },
{% else %}
  auth: {
    enabled: false
  },
{% endif %}
  timestamp: new Date().toISOString()
};`;

      await fs.writeFile(path.join(templateDir, 'config.js'), templateContent);

      const generator = new Generator(templatesDir);

      // Test with debug enabled, auth disabled
      const result1 = await generator.generate({
        generator: 'config',
        template: 'env',
        dest: testDir,
        force: false,
        dry: false,
        variables: { 
          envName: 'development',
          enableDebug: true,
          enableAuth: false
        }
      });

      const content1 = await fs.readFile(path.join(testDir, 'config/development.config.js'), 'utf8');
      expect(content1).toContain('debug: true');
      expect(content1).toContain('debugLevel: \'verbose\'');
      expect(content1).toContain('enabled: false');
      expect(content1).not.toContain('provider:');

      // Test with debug disabled, auth enabled
      const result2 = await generator.generate({
        generator: 'config',
        template: 'env',
        dest: testDir,
        force: true,
        dry: false,
        variables: { 
          envName: 'production',
          enableDebug: false,
          enableAuth: true,
          authProvider: 'oauth2'
        }
      });

      const content2 = await fs.readFile(path.join(testDir, 'config/production.config.js'), 'utf8');
      expect(content2).toContain('debug: false');
      expect(content2).not.toContain('debugLevel:');
      expect(content2).toContain('enabled: true');
      expect(content2).toContain('provider: \'oauth2\'');
    });

    it('should handle dry run mode correctly', async () => {
      const testTemplateDir = path.join(templatesDir, 'test', 'dry');
      await fs.ensureDir(testTemplateDir);

      await fs.writeFile(
        path.join(testTemplateDir, 'file.txt'),
        '---\nto: "dryrun/{{ name }}.txt"\n---\nDry run test: {{ name }}'
      );

      const generator = new Generator(templatesDir);

      // Test dry run
      const result = await generator.generate({
        generator: 'test',
        template: 'dry',
        dest: testDir,
        force: false,
        dry: true,
        variables: { name: 'DryTest' }
      });

      expect(result.files).toHaveLength(1);

      // Verify no files were actually created
      const outputFile = path.join(testDir, 'dryrun/DryTest.txt');
      const exists = await fs.pathExists(outputFile);
      expect(exists).toBe(false);
    });

    it('should handle force mode for overwriting', async () => {
      const templateDir = path.join(templatesDir, 'overwrite', 'test');
      await fs.ensureDir(templateDir);

      await fs.writeFile(
        path.join(templateDir, 'file.txt'),
        '---\nto: "{{ name }}.txt"\n---\nContent: {{ name }}'
      );

      // Create existing file
      const targetFile = path.join(testDir, 'OverwriteTest.txt');
      await fs.writeFile(targetFile, 'Original content');

      const generator = new Generator(templatesDir);

      // Test without force (should not overwrite)
      const result1 = await generator.generate({
        generator: 'overwrite',
        template: 'test',
        dest: testDir,
        force: false,
        dry: false,
        variables: { name: 'OverwriteTest' }
      });

      // Original content should remain (file injector prevents overwrite without force)
      let content = await fs.readFile(targetFile, 'utf8');
      expect(content).toBe('Original content');

      // Test with force (should overwrite)
      const result2 = await generator.generate({
        generator: 'overwrite',
        template: 'test',
        dest: testDir,
        force: true,
        dry: false,
        variables: { name: 'OverwriteTest' }
      });

      // Content should be updated
      content = await fs.readFile(targetFile, 'utf8');
      expect(content).toBe('Content: OverwriteTest');
    });
  });

  describe('Filter Testing', () => {
    it('should test all Nunjucks filters', async () => {
      const filterDir = path.join(templatesDir, 'filter', 'test');
      await fs.ensureDir(filterDir);

      const templateContent = `---
to: "filters/{{ name }}-filters.txt"
---
Original: {{ name }}
kebabCase: {{ name | kebabCase }}
camelCase: {{ name | camelCase }}
pascalCase: {{ name | pascalCase }}
snakeCase: {{ name | snakeCase }}
titleCase: {{ name | titleCase }}
capitalize: {{ name | capitalize }}
pluralize: {{ name | pluralize }}
singularize: {{ name | singularize }}`;

      await fs.writeFile(path.join(filterDir, 'filters.txt'), templateContent);

      const generator = new Generator(templatesDir);

      const testCases = [
        {
          input: 'user_profile_card',
          expected: {
            kebab: 'user-profile-card',
            camel: 'userProfileCard',
            pascal: 'UserProfileCard',
            snake: 'user_profile_card',
            title: 'User Profile Card',
            capitalize: 'User_profile_card',
            pluralize: 'user_profile_cards',
            singularize: 'user_profile_card'
          }
        },
        {
          input: 'shoppingCart',
          expected: {
            kebab: 'shopping-cart',
            camel: 'shoppingCart',
            pascal: 'ShoppingCart',
            snake: 'shopping_cart',
            title: 'Shopping Cart',
            capitalize: 'Shoppingcart',
            pluralize: 'shoppingCarts',
            singularize: 'shoppingCart'
          }
        }
      ];

      for (const testCase of testCases) {
        await generator.generate({
          generator: 'filter',
          template: 'test',
          dest: testDir,
          force: true,
          dry: false,
          variables: { name: testCase.input }
        });

        const outputFile = path.join(testDir, `filters/${testCase.input}-filters.txt`);
        const content = await fs.readFile(outputFile, 'utf8');

        expect(content).toContain(`Original: ${testCase.input}`);
        expect(content).toContain(`kebabCase: ${testCase.expected.kebab}`);
        expect(content).toContain(`camelCase: ${testCase.expected.camel}`);
        expect(content).toContain(`pascalCase: ${testCase.expected.pascal}`);
        expect(content).toContain(`snakeCase: ${testCase.expected.snake}`);
        expect(content).toContain(`titleCase: ${testCase.expected.title}`);
        expect(content).toContain(`pluralize: ${testCase.expected.pluralize}`);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing generator', async () => {
      const generator = new Generator(templatesDir);

      await expect(generator.listTemplates('nonexistent')).rejects.toThrow(
        "Generator 'nonexistent' not found"
      );
    });

    it('should handle missing template', async () => {
      // Create empty generator
      await fs.ensureDir(path.join(templatesDir, 'empty'));

      const generator = new Generator(templatesDir);

      await expect(generator.scanTemplateForVariables('empty', 'nonexistent')).rejects.toThrow(
        "Template 'nonexistent' not found"
      );
    });

    it('should handle invalid frontmatter gracefully', async () => {
      const invalidDir = path.join(templatesDir, 'invalid', 'yaml');
      await fs.ensureDir(invalidDir);

      const invalidContent = `---
invalid: yaml: content:
  - broken
    indentation
---
Content here`;

      await fs.writeFile(path.join(invalidDir, 'invalid.txt'), invalidContent);

      const generator = new Generator(templatesDir);

      // Should still process the file but warn about invalid frontmatter
      const result = await generator.generate({
        generator: 'invalid',
        template: 'yaml',
        dest: testDir,
        force: false,
        dry: false,
        variables: {}
      });

      // Should create the file even with invalid frontmatter
      expect(result.files).toHaveLength(1);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple generators and templates efficiently', async () => {
      // Create multiple generators with multiple templates
      const generatorCount = 3;
      const templatesPerGenerator = 2;

      for (let g = 0; g < generatorCount; g++) {
        for (let t = 0; t < templatesPerGenerator; t++) {
          const templateDir = path.join(templatesDir, `gen${g}`, `template${t}`);
          await fs.ensureDir(templateDir);

          await fs.writeFile(
            path.join(templateDir, 'file.txt'),
            `---\nto: "gen${g}/template${t}/{{ name }}.txt"\n---\nGenerator ${g}, Template ${t}: {{ name }}`
          );
        }
      }

      const generator = new Generator(templatesDir);

      // Test discovery performance
      const startTime = Date.now();
      const generators = await generator.listGenerators();
      const discoveryTime = Date.now() - startTime;

      expect(generators).toHaveLength(generatorCount);
      expect(discoveryTime).toBeLessThan(1000); // Should be fast

      // Test generation performance
      const generationStart = Date.now();
      
      const promises = [];
      for (let g = 0; g < generatorCount; g++) {
        for (let t = 0; t < templatesPerGenerator; t++) {
          promises.push(generator.generate({
            generator: `gen${g}`,
            template: `template${t}`,
            dest: testDir,
            force: false,
            dry: false,
            variables: { name: `Test${g}${t}` }
          }));
        }
      }

      const results = await Promise.all(promises);
      const generationTime = Date.now() - generationStart;

      expect(results).toHaveLength(generatorCount * templatesPerGenerator);
      expect(generationTime).toBeLessThan(5000); // Should be reasonably fast

      // Verify all files were created
      for (let g = 0; g < generatorCount; g++) {
        for (let t = 0; t < templatesPerGenerator; t++) {
          const outputFile = path.join(testDir, `gen${g}/template${t}/Test${g}${t}.txt`);
          const exists = await fs.pathExists(outputFile);
          expect(exists).toBe(true);

          const content = await fs.readFile(outputFile, 'utf8');
          expect(content).toContain(`Generator ${g}, Template ${t}: Test${g}${t}`);
        }
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle a React component generator scenario', async () => {
      const componentDir = path.join(templatesDir, 'react', 'component');
      await fs.ensureDir(componentDir);

      // Main component file
      await fs.writeFile(
        path.join(componentDir, 'Component.tsx'),
        `---
to: "src/components/{{ name | pascalCase }}/index.tsx"
---
import React from 'react';
import './{{ name | pascalCase }}.css';

interface {{ name | pascalCase }}Props {
  className?: string;
  children?: React.ReactNode;
{% if withProps %}
  title?: string;
  onClick?: () => void;
{% endif %}
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
  className = '{{ name | kebabCase }}',
  children{% if withProps %},
  title,
  onClick{% endif %}
}) => {
  return (
    <div className={\`\${className}\`}{% if withProps %} onClick={onClick}{% endif %}>
{% if withProps %}
      {title && <h2>{\${title}}</h2>}
{% endif %}
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};`
      );

      // CSS file
      await fs.writeFile(
        path.join(componentDir, 'Component.css'),
        `---
to: "src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.css"
---
.{{ name | kebabCase }} {
  display: block;
  padding: 1rem;
{% if withStyling %}
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f9f9f9;
{% endif %}
}

.{{ name | kebabCase }}:hover {
  opacity: 0.8;
}`
      );

      // Test file
      await fs.writeFile(
        path.join(componentDir, 'Component.test.tsx'),
        `---
to: "src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.test.tsx"
---
import { describe, it, expect } from 'vitest';
import { render, screen{% if withProps %}, fireEvent{% endif %} } from '@testing-library/react';
import {{ name | pascalCase }} from './index';

describe('{{ name | pascalCase }}', () => {
  it('renders correctly', () => {
    render(<{{ name | pascalCase }}>Test content</{{ name | pascalCase }}>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <{{ name | pascalCase }} className="custom">Test</{{ name | pascalCase }}>
    );
    expect(container.firstChild).toHaveClass('custom');
  });

{% if withProps %}
  it('renders title when provided', () => {
    render(<{{ name | pascalCase }} title="Test Title">Content</{{ name | pascalCase }}>);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<{{ name | pascalCase }} onClick={handleClick}>Click me</{{ name | pascalCase }}>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
{% endif %}
});`
      );

      const generator = new Generator(templatesDir);

      // Test variable detection
      const scanResult = await generator.scanTemplateForVariables('react', 'component');
      expect(scanResult.variables.length).toBeGreaterThan(0);

      const variableNames = scanResult.variables.map(v => v.name);
      expect(variableNames).toContain('name');

      // Test generation
      const result = await generator.generate({
        generator: 'react',
        template: 'component',
        dest: testDir,
        force: false,
        dry: false,
        variables: { 
          name: 'UserProfile',
          withProps: true,
          withStyling: true
        }
      });

      expect(result.files).toHaveLength(3);

      // Verify component file
      const componentFile = path.join(testDir, 'src/components/UserProfile/index.tsx');
      const componentExists = await fs.pathExists(componentFile);
      expect(componentExists).toBe(true);

      const componentContent = await fs.readFile(componentFile, 'utf8');
      expect(componentContent).toContain('export const UserProfile');
      expect(componentContent).toContain('className = \'user-profile\'');
      expect(componentContent).toContain('title?: string;');
      expect(componentContent).toContain('onClick?: () => void;');

      // Verify CSS file
      const cssFile = path.join(testDir, 'src/components/UserProfile/UserProfile.css');
      const cssExists = await fs.pathExists(cssFile);
      expect(cssExists).toBe(true);

      const cssContent = await fs.readFile(cssFile, 'utf8');
      expect(cssContent).toContain('.user-profile {');
      expect(cssContent).toContain('border: 1px solid #ccc;');

      // Verify test file
      const testFile = path.join(testDir, 'src/components/UserProfile/UserProfile.test.tsx');
      const testExists = await fs.pathExists(testFile);
      expect(testExists).toBe(true);

      const testContent = await fs.readFile(testFile, 'utf8');
      expect(testContent).toContain('describe(\'UserProfile\'');
      expect(testContent).toContain('renders title when provided');
      expect(testContent).toContain('handles click events');
    });
  });
});