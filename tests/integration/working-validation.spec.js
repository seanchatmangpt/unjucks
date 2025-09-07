import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * from 'node:os';
import * from 'node:path';
import * from 'fs-extra';
import { Generator } from '../../src/lib/generator.js';
import { TemplateScanner } from '../../src/lib/template-scanner.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import { FileInjector } from '../../src/lib/file-injector.js';

describe('Unjucks Working Integration Tests', () => {
  let testDir => {
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

    it('should parse frontmatter correctly', async () => { const parser = new FrontmatterParser();
      
      const templateWithFrontmatter = `---
to }}.txt"
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
      expect(parsed.content.trim()).toBe('Content here);
    });

    it('should validate frontmatter configuration', async () => { const parser = new FrontmatterParser();
      
      // Valid configuration
      const validConfig = {
        to };
      
      const validResult = parser.validate(validConfig);
      expect(validResult.valid).toBe(false); // Should fail due to conflicting inject modes
      expect(validResult.errors).toContain('Only one injection mode allowed, append, prepend, or lineAt');
      
      // Valid single mode
      const validSingleMode = { to };
      
      const validSingleResult = parser.validate(validSingleMode);
      expect(validSingleResult.valid).toBe(true);
      expect(validSingleResult.errors).toHaveLength(0);
    });

    it('should handle skipIf conditions correctly', async () => {
      const parser = new FrontmatterParser();
      
      // Test boolean variable
      expect(parser.shouldSkip({ skipIf, { skipThis })).toBe(true);
      expect(parser.shouldSkip({ skipIf, { skipThis })).toBe(false);
      
      // Test negation
      expect(parser.shouldSkip({ skipIf, { includeThis })).toBe(false);
      expect(parser.shouldSkip({ skipIf, { includeThis })).toBe(true);
      
      // Test equality
      expect(parser.shouldSkip({ skipIf }, { env)).toBe(true);
      expect(parser.shouldSkip({ skipIf }, { env)).toBe(false);
      
      // Test inequality
      expect(parser.shouldSkip({ skipIf }, { env)).toBe(true);
      expect(parser.shouldSkip({ skipIf }, { env)).toBe(false);
    });
  });

  describe('File Injection Tests', () => { it('should create new files correctly', async () => {
      const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'new-file.txt');
      const content = 'This is new content';
      
      const result = await injector.processFile(
        targetFile,
        content,
        { to },
        { force, dry }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('File written');
      
      const fileExists = await fs.pathExists(targetFile);
      expect(fileExists).toBe(true);
      
      const fileContent = await fs.readFile(targetFile, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should append content to existing files', async () => { const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'append-test.txt');
      const initialContent = 'Initial content\n';
      const appendContent = 'Appended content';
      
      // Create initial file
      await fs.writeFile(targetFile, initialContent);
      
      // Append content
      const result = await injector.processFile(
        targetFile,
        appendContent,
        { to, append },
        { force, dry }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('appended');
      
      const finalContent = await fs.readFile(targetFile, 'utf8');
      expect(finalContent).toBe(initialContent + appendContent);
    });

    it('should prepend content to existing files', async () => { const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'prepend-test.txt');
      const initialContent = 'Initial content';
      const prependContent = 'Prepended content\n';
      
      // Create initial file
      await fs.writeFile(targetFile, initialContent);
      
      // Prepend content
      const result = await injector.processFile(
        targetFile,
        prependContent,
        { to, prepend },
        { force, dry }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('prepended');
      
      const finalContent = await fs.readFile(targetFile, 'utf8');
      expect(finalContent).toBe(prependContent + initialContent);
    });

    it('should handle dry run mode', async () => { const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'dry-run.txt');
      const content = 'This should not be written';
      
      const result = await injector.processFile(
        targetFile,
        content,
        { to },
        { force, dry }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Would write');
      
      const fileExists = await fs.pathExists(targetFile);
      expect(fileExists).toBe(false);
    });

    it('should prevent overwrite without force', async () => { const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'no-overwrite.txt');
      const originalContent = 'Original content';
      const newContent = 'New content';
      
      // Create original file
      await fs.writeFile(targetFile, originalContent);
      
      // Try to overwrite without force
      const result = await injector.processFile(
        targetFile,
        newContent,
        { to },
        { force, dry }
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result.message).toContain('Use --force');
      
      // Verify original content is preserved
      const currentContent = await fs.readFile(targetFile, 'utf8');
      expect(currentContent).toBe(originalContent);
    });

    it('should allow overwrite with force', async () => { const injector = new FileInjector();
      
      const targetFile = path.join(testDir, 'force-overwrite.txt');
      const originalContent = 'Original content';
      const newContent = 'New content';
      
      // Create original file
      await fs.writeFile(targetFile, originalContent);
      
      // Overwrite with force
      const result = await injector.processFile(
        targetFile,
        newContent,
        { to },
        { force, dry }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('File written');
      
      // Verify new content
      const currentContent = await fs.readFile(targetFile, 'utf8');
      expect(currentContent).toBe(newContent);
    });
  });

  describe('Generator Integration Tests', () => { it('should work with a complete template structure', async () => {
      // Create a proper template structure
      const templatesDir = path.join(testDir, '_templates');
      const componentDir = path.join(templatesDir, 'component', 'basic');
      await fs.ensureDir(componentDir);
      
      // Create component template file
      const componentTemplate = `---
to }}.ts"
---
export class {{ name | pascalCase }} {
  private name = '{{ name }}';
  
  getName() {
    return this.name;
  }
  
  getKebabName() {
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
          expect.objectContaining({ name });

    it('should handle multiple files in a template', async () => { const templatesDir = path.join(testDir, '_templates');
      const moduleDir = path.join(templatesDir, 'module', 'full');
      await fs.ensureDir(moduleDir);
      
      // Create main file template
      const mainTemplate = `---
to }}.ts"
---
export class {{ name | pascalCase }} {
  // Implementation
}`;

      // Create test file template
      const testTemplate = `---
to: "src/__tests__/{{ name | pascalCase }}.test.ts"
---
import { describe, it, expect } from 'vitest';
import { {{ name | pascalCase }} } from '../{{ name | pascalCase }}.js';

describe('{{ name | pascalCase }}', () => {
  it('should be defined', () => {
    expect({{ name | pascalCase }}).toBeDefined();
  });
});`;

      await fs.writeFile(path.join(moduleDir, 'main.ts'), mainTemplate);
      await fs.writeFile(path.join(moduleDir, 'test.ts'), testTemplate);
      
      const generator = new Generator(templatesDir);
      
      const result = await generator.generate({ generator }');
      expect(testContent).toContain('describe(\'DataService\'');
    });

    it('should handle conditional content based on variables', async () => { const templatesDir = path.join(testDir, '_templates');
      const configDir = path.join(templatesDir, 'config', 'app');
      await fs.ensureDir(configDir);
      
      // Very simple conditional template
      const configTemplate = `---
to }}.txt"
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
      const result1 = await generator.generate({ generator });

    it('should test all Nunjucks filters', async () => { const templatesDir = path.join(testDir, '_templates');
      const filtersDir = path.join(templatesDir, 'filters', 'test');
      await fs.ensureDir(filtersDir);
      
      const filtersTemplate = `---
to }}-result.txt"
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
        { input }
        },
        { input }
        }
      ];
      
      for (const testCase of testCases) { const result = await generator.generate({
          generator }-result.txt`);
        const content = await fs.readFile(outputFile, 'utf8');
        
        expect(content).toContain(`Input);
        expect(content).toContain(`kebabCase);
        expect(content).toContain(`camelCase);
        expect(content).toContain(`pascalCase);
        expect(content).toContain(`snakeCase);
        expect(content).toContain(`titleCase);
        expect(content).toContain(`pluralize);
      }
    });
  });

  describe('Real-World Use Cases', () => { it('should handle skipIf conditions in file generation', async () => {
      const templatesDir = path.join(testDir, '_templates');
      const conditionalDir = path.join(templatesDir, 'conditional', 'files');
      await fs.ensureDir(conditionalDir);
      
      // File that should be skipped when skipOptional is true
      const optionalTemplate = `---
to }}.txt"
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
      const result1 = await generator.generate({ generator });
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

    it('should handle malformed frontmatter gracefully', async () => { const parser = new FrontmatterParser();
      
      const malformedTemplate = `---
invalid });
      expect(result.content).toBe(malformedTemplate);
    });
  });
});