import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { Generator } from '../../src/lib/generator.js';
import { TemplateScanner } from '../../src/lib/template-scanner.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import { FileInjector } from '../../src/lib/file-injector.js';

describe('Unjucks Working Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `unjucks-test-${Date.now()}-${Math.random().toString(36)}`);
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    try {
      await fs.remove(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Core Component Tests', () => {
    it('should scan template variables correctly', async () => {
      const scanner = new TemplateScanner();
      
      // Create a test template
      const templateDir = path.join(testDir, 'template');
      await fs.ensureDir(templateDir);
      
      const templateContent = `Hello {{ name }}!
Your {{ type }} is {{ status }}.
{% if isActive %}Active{% endif %}`;

      await fs.writeFile(path.join(templateDir, 'test.txt'), templateContent);
      
      const result = await scanner.scanTemplate(templateDir);
      
      expect(result.variables).toHaveLength(4);
      
      const variableNames = result.variables.map(v => v.name);
      expect(variableNames).toContain('name');
      expect(variableNames).toContain('type');
      expect(variableNames).toContain('status');
      expect(variableNames).toContain('isActive');
      
      // Check type inference
      const isActiveVar = result.variables.find(v => v.name === 'isActive');
      expect(isActiveVar?.type).toBe('boolean');
      
      const nameVar = result.variables.find(v => v.name === 'name');
      expect(nameVar?.type).toBe('string');
      expect(nameVar?.required).toBe(true);
    });

    it('should parse frontmatter correctly', async () => {
      const parser = new FrontmatterParser();
      
      const templateWithFrontmatter = `---
to: "output/{{ name }}.txt"
inject: true
append: true
skipIf: "!{{ includeFile }}"
---
Content here: {{ name }}`;

      const parsed = parser.parse(templateWithFrontmatter);
      
      expect(parsed.hasValidFrontmatter).toBe(true);
      expect(parsed.frontmatter.to).toBe('output/{{ name }}.txt');
      expect(parsed.frontmatter.inject).toBe(true);
      expect(parsed.frontmatter.append).toBe(true);
      expect(parsed.frontmatter.skipIf).toBe('!{{ includeFile }}');
      expect(parsed.content.trim()).toBe('Content here: {{ name }}');
    });

    it('should validate frontmatter configuration', async () => {
      const parser = new FrontmatterParser();
      
      // Valid configuration
      const validConfig = {
        to: 'output.txt',
        inject: true,
        append: true
      };
      
      const validResult = parser.validate(validConfig);
      expect(validResult.valid).toBe(false); // Should fail due to conflicting inject modes
      expect(validResult.errors).toContain('Only one injection mode allowed: inject, append, prepend, or lineAt');
      
      // Valid single mode
      const validSingleMode = {
        to: 'output.txt',
        append: true
      };
      
      const validSingleResult = parser.validate(validSingleMode);
      expect(validSingleResult.valid).toBe(true);
      expect(validSingleResult.errors).toHaveLength(0);
    });

    it('should handle skipIf conditions correctly', async () => {
      const parser = new FrontmatterParser();
      
      // Test boolean variable
      expect(parser.shouldSkip({ skipIf: 'skipThis' }, { skipThis: true })).toBe(true);
      expect(parser.shouldSkip({ skipIf: 'skipThis' }, { skipThis: false })).toBe(false);
      
      // Test negation
      expect(parser.shouldSkip({ skipIf: '!includeThis' }, { includeThis: true })).toBe(false);
      expect(parser.shouldSkip({ skipIf: '!includeThis' }, { includeThis: false })).toBe(true);
      
      // Test equality
      expect(parser.shouldSkip({ skipIf: 'env == "production"' }, { env: 'production' })).toBe(true);
      expect(parser.shouldSkip({ skipIf: 'env == "production"' }, { env: 'development' })).toBe(false);
      
      // Test inequality
      expect(parser.shouldSkip({ skipIf: 'env != "development"' }, { env: 'production' })).toBe(true);
      expect(parser.shouldSkip({ skipIf: 'env != "development"' }, { env: 'development' })).toBe(false);
    });
  });

  describe('File Injection Tests', () => {
    it('should create new files correctly', async () => {
      const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'new-file.txt');
      const content = 'This is new content';
      
      const result = await injector.processFile(
        targetFile,
        content,
        { to: targetFile },
        { force: false, dry: false }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('File written');
      
      const fileExists = await fs.pathExists(targetFile);
      expect(fileExists).toBe(true);
      
      const fileContent = await fs.readFile(targetFile, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should append content to existing files', async () => {
      const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'append-test.txt');
      const initialContent = 'Initial content\n';
      const appendContent = 'Appended content';
      
      // Create initial file
      await fs.writeFile(targetFile, initialContent);
      
      // Append content
      const result = await injector.processFile(
        targetFile,
        appendContent,
        { to: targetFile, append: true },
        { force: false, dry: false }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('appended');
      
      const finalContent = await fs.readFile(targetFile, 'utf8');
      expect(finalContent).toBe(initialContent + appendContent);
    });

    it('should prepend content to existing files', async () => {
      const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'prepend-test.txt');
      const initialContent = 'Initial content';
      const prependContent = 'Prepended content\n';
      
      // Create initial file
      await fs.writeFile(targetFile, initialContent);
      
      // Prepend content
      const result = await injector.processFile(
        targetFile,
        prependContent,
        { to: targetFile, prepend: true },
        { force: false, dry: false }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('prepended');
      
      const finalContent = await fs.readFile(targetFile, 'utf8');
      expect(finalContent).toBe(prependContent + initialContent);
    });

    it('should handle dry run mode', async () => {
      const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'dry-run.txt');
      const content = 'This should not be written';
      
      const result = await injector.processFile(
        targetFile,
        content,
        { to: targetFile },
        { force: false, dry: true }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Would write');
      
      const fileExists = await fs.pathExists(targetFile);
      expect(fileExists).toBe(false);
    });

    it('should prevent overwrite without force', async () => {
      const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'no-overwrite.txt');
      const originalContent = 'Original content';
      const newContent = 'New content';
      
      // Create original file
      await fs.writeFile(targetFile, originalContent);
      
      // Try to overwrite without force
      const result = await injector.processFile(
        targetFile,
        newContent,
        { to: targetFile },
        { force: false, dry: false }
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result.message).toContain('Use --force');
      
      // Verify original content is preserved
      const currentContent = await fs.readFile(targetFile, 'utf8');
      expect(currentContent).toBe(originalContent);
    });

    it('should allow overwrite with force', async () => {
      const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'force-overwrite.txt');
      const originalContent = 'Original content';
      const newContent = 'New content';
      
      // Create original file
      await fs.writeFile(targetFile, originalContent);
      
      // Overwrite with force
      const result = await injector.processFile(
        targetFile,
        newContent,
        { to: targetFile },
        { force: true, dry: false }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('File written');
      
      // Verify new content
      const currentContent = await fs.readFile(targetFile, 'utf8');
      expect(currentContent).toBe(newContent);
    });
  });

  describe('Generator Integration Tests', () => {
    it('should work with a complete template structure', async () => {
      // Create a proper template structure
      const templatesDir = path.join(testDir, '_templates');
      const componentDir = path.join(templatesDir, 'component', 'basic');
      await fs.ensureDir(componentDir);
      
      // Create component template file
      const componentTemplate = `---
to: "src/{{ name | pascalCase }}.ts"
---
export class {{ name | pascalCase }} {
  private name = '{{ name }}';
  
  getName(): string {
    return this.name;
  }
  
  getKebabName(): string {
    return '{{ name | kebabCase }}';
  }
}`;

      await fs.writeFile(path.join(componentDir, 'component.ts'), componentTemplate);
      
      // Test with Generator
      const generator = new Generator(templatesDir);
      
      // Verify discovery
      const generators = await generator.listGenerators();
      expect(generators).toHaveLength(1);
      expect(generators[0].name).toBe('component');
      
      const templates = await generator.listTemplates('component');
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('basic');
      
      // Verify variable scanning
      const scanResult = await generator.scanTemplateForVariables('component', 'basic');
      expect(scanResult.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'name',
            type: 'string',
            required: true
          })
        ])
      );
      
      // Test generation
      const result = await generator.generate({
        generator: 'component',
        template: 'basic',
        dest: testDir,
        force: false,
        dry: false,
        variables: { name: 'userManager' }
      });
      
      expect(result.files).toHaveLength(1);
      
      // Verify generated file
      const generatedFile = path.join(testDir, 'src/UserManager.ts');
      const fileExists = await fs.pathExists(generatedFile);
      expect(fileExists).toBe(true);
      
      const content = await fs.readFile(generatedFile, 'utf8');
      expect(content).toContain('export class UserManager');
      expect(content).toContain('private name = \'userManager\'');
      expect(content).toContain('return \'user-manager\'');
    });

    it('should handle multiple files in a template', async () => {
      const templatesDir = path.join(testDir, '_templates');
      const moduleDir = path.join(templatesDir, 'module', 'full');
      await fs.ensureDir(moduleDir);
      
      // Create main file template
      const mainTemplate = `---
to: "src/{{ name | pascalCase }}.ts"
---
export class {{ name | pascalCase }} {
  // Implementation
}`;

      // Create test file template
      const testTemplate = `---
to: "src/__tests__/{{ name | pascalCase }}.test.ts"
---
import { describe, it, expect } from 'vitest';
import { {{ name | pascalCase }} } from '../{{ name | pascalCase }}';

describe('{{ name | pascalCase }}', () => {
  it('should be defined', () => {
    expect({{ name | pascalCase }}).toBeDefined();
  });
});`;

      await fs.writeFile(path.join(moduleDir, 'main.ts'), mainTemplate);
      await fs.writeFile(path.join(moduleDir, 'test.ts'), testTemplate);
      
      const generator = new Generator(templatesDir);
      
      const result = await generator.generate({
        generator: 'module',
        template: 'full',
        dest: testDir,
        force: false,
        dry: false,
        variables: { name: 'dataService' }
      });
      
      expect(result.files).toHaveLength(2);
      
      // Verify both files were created
      const mainFile = path.join(testDir, 'src/DataService.ts');
      const testFile = path.join(testDir, 'src/__tests__/DataService.test.ts');
      
      expect(await fs.pathExists(mainFile)).toBe(true);
      expect(await fs.pathExists(testFile)).toBe(true);
      
      // Verify content
      const mainContent = await fs.readFile(mainFile, 'utf8');
      expect(mainContent).toContain('export class DataService');
      
      const testContent = await fs.readFile(testFile, 'utf8');
      expect(testContent).toContain('import { DataService }');
      expect(testContent).toContain('describe(\'DataService\'');
    });

    it('should handle conditional content based on variables', async () => {
      const templatesDir = path.join(testDir, '_templates');
      const configDir = path.join(templatesDir, 'config', 'app');
      await fs.ensureDir(configDir);
      
      // Very simple conditional template
      const configTemplate = `---
to: "config/{{ env }}.txt"
---
Environment: {{ env }}
{% if debug %}
Debug mode is enabled
{% endif %}
{% if database %}
Database is configured
{% endif %}`;

      await fs.writeFile(path.join(configDir, 'config.txt'), configTemplate);
      
      const generator = new Generator(templatesDir);
      
      // Test with simple boolean conditions
      const result1 = await generator.generate({
        generator: 'config',
        template: 'app',
        dest: testDir,
        force: false,
        dry: false,
        variables: {
          env: 'test',
          debug: true,
          database: false
        }
      });
      
      const configContent = await fs.readFile(path.join(testDir, 'config/test.txt'), 'utf8');
      
      expect(configContent).toContain('Environment: test');
      expect(configContent).toContain('Debug mode is enabled');
      expect(configContent).not.toContain('Database is configured');
    });

    it('should test all Nunjucks filters', async () => {
      const templatesDir = path.join(testDir, '_templates');
      const filtersDir = path.join(templatesDir, 'filters', 'test');
      await fs.ensureDir(filtersDir);
      
      const filtersTemplate = `---
to: "filters/{{ input }}-result.txt"
---
Input: {{ input }}
kebabCase: {{ input | kebabCase }}
camelCase: {{ input | camelCase }}
pascalCase: {{ input | pascalCase }}
snakeCase: {{ input | snakeCase }}
titleCase: {{ input | titleCase }}
capitalize: {{ input | capitalize }}
pluralize: {{ input | pluralize }}
singularize: {{ input | singularize }}`;

      await fs.writeFile(path.join(filtersDir, 'filters.txt'), filtersTemplate);
      
      const generator = new Generator(templatesDir);
      
      const testCases = [
        {
          input: 'user_profile_manager',
          expected: {
            kebab: 'user-profile-manager',
            camel: 'userProfileManager',
            pascal: 'UserProfileManager',
            snake: 'user_profile_manager',
            title: 'User Profile Manager',
            capitalize: 'User_profile_manager',
            pluralize: 'user_profile_managers',
            singularize: 'user_profile_manager'
          }
        },
        {
          input: 'ShoppingCartItem',
          expected: {
            kebab: 'shopping-cart-item',
            camel: 'shoppingCartItem',
            pascal: 'ShoppingCartItem',
            snake: 'shopping_cart_item',
            title: 'Shopping Cart Item',
            capitalize: 'Shoppingcartitem',
            pluralize: 'ShoppingCartItems',
            singularize: 'ShoppingCartItem'
          }
        }
      ];
      
      for (const testCase of testCases) {
        const result = await generator.generate({
          generator: 'filters',
          template: 'test',
          dest: testDir,
          force: true,
          dry: false,
          variables: { input: testCase.input }
        });
        
        const outputFile = path.join(testDir, `filters/${testCase.input}-result.txt`);
        const content = await fs.readFile(outputFile, 'utf8');
        
        expect(content).toContain(`Input: ${testCase.input}`);
        expect(content).toContain(`kebabCase: ${testCase.expected.kebab}`);
        expect(content).toContain(`camelCase: ${testCase.expected.camel}`);
        expect(content).toContain(`pascalCase: ${testCase.expected.pascal}`);
        expect(content).toContain(`snakeCase: ${testCase.expected.snake}`);
        expect(content).toContain(`titleCase: ${testCase.expected.title}`);
        expect(content).toContain(`pluralize: ${testCase.expected.pluralize}`);
      }
    });
  });

  describe('Real-World Use Cases', () => {
    it('should handle skipIf conditions in file generation', async () => {
      const templatesDir = path.join(testDir, '_templates');
      const conditionalDir = path.join(templatesDir, 'conditional', 'files');
      await fs.ensureDir(conditionalDir);
      
      // File that should be skipped when skipOptional is true
      const optionalTemplate = `---
to: "optional/{{ name }}.txt"
skipIf: "skipOptional"
---
This is an optional file for {{ name }}.`;

      // File that should be included when includeRequired is true
      const requiredTemplate = `---
to: "required/{{ name }}.txt"
skipIf: "!includeRequired"
---
This is a required file for {{ name }}.`;

      await fs.writeFile(path.join(conditionalDir, 'optional.txt'), optionalTemplate);
      await fs.writeFile(path.join(conditionalDir, 'required.txt'), requiredTemplate);
      
      const generator = new Generator(templatesDir);
      
      // Test with skipOptional=true, includeRequired=true
      const result1 = await generator.generate({
        generator: 'conditional',
        template: 'files',
        dest: testDir,
        force: false,
        dry: false,
        variables: {
          name: 'TestFile',
          skipOptional: true,
          includeRequired: true
        }
      });
      
      // Only required file should be generated
      expect(result1.files).toHaveLength(1);
      
      const optionalExists1 = await fs.pathExists(path.join(testDir, 'optional/TestFile.txt'));
      const requiredExists1 = await fs.pathExists(path.join(testDir, 'required/TestFile.txt'));
      
      expect(optionalExists1).toBe(false);
      expect(requiredExists1).toBe(true);
      
      // Test with skipOptional=false, includeRequired=true
      const result2 = await generator.generate({
        generator: 'conditional',
        template: 'files',
        dest: testDir,
        force: true,
        dry: false,
        variables: {
          name: 'TestFile2',
          skipOptional: false,
          includeRequired: true
        }
      });
      
      // Both files should be generated
      expect(result2.files).toHaveLength(2);
      
      const optionalExists2 = await fs.pathExists(path.join(testDir, 'optional/TestFile2.txt'));
      const requiredExists2 = await fs.pathExists(path.join(testDir, 'required/TestFile2.txt'));
      
      expect(optionalExists2).toBe(true);
      expect(requiredExists2).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing generators gracefully', async () => {
      const templatesDir = path.join(testDir, '_templates');
      await fs.ensureDir(templatesDir);
      
      const generator = new Generator(templatesDir);
      
      await expect(generator.listTemplates('nonexistent')).rejects.toThrow(
        "Generator 'nonexistent' not found"
      );
    });

    it('should handle empty templates directory', async () => {
      const templatesDir = path.join(testDir, '_templates');
      await fs.ensureDir(templatesDir);
      
      const generator = new Generator(templatesDir);
      const generators = await generator.listGenerators();
      
      expect(generators).toEqual([]);
    });

    it('should handle malformed frontmatter gracefully', async () => {
      const parser = new FrontmatterParser();
      
      const malformedTemplate = `---
invalid: yaml: content
  broken
    indentation:
---
Content here`;

      const result = parser.parse(malformedTemplate);
      
      expect(result.hasValidFrontmatter).toBe(false);
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(malformedTemplate);
    });
  });
});