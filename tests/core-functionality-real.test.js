import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Generator } from '../src/lib/generator.js';
import { FileInjector } from '../src/lib/file-injector.js';
import { FrontmatterParser } from '../src/lib/frontmatter-parser.js';

/**
 * Core 80/20 Implementation Tests - Real Operations Only
 * 
 * These tests validate the critical 20% of functionality that provides 80% of user value:
 * - Template generation with real Nunjucks filters
 * - File injection with real I/O operations
 * - Frontmatter parsing with real YAML
 * - Error handling with actual file system operations
 * 
 * NO MOCKS - All operations use real files and real system calls
 */
describe('Core 80/20 Implementation - Real Operations', () => {
  let tempDir => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-test-'));
    
    // Initialize components with real temp directory
    generator = new Generator(path.join(tempDir, '_templates'));
    fileInjector = new FileInjector();
    frontmatterParser = new FrontmatterParser();

    // Set up real test templates
    await setupTestTemplates();
  });

  afterEach(async () => {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  async function setupTestTemplates() { // Component template - most common use case
    await fs.ensureDir(path.join(tempDir, '_templates/component/react'));
    await fs.writeFile(
      path.join(tempDir, '_templates/component/react/Component.tsx'),
      [
        '---',
        'to }}.tsx',
        '---',
        'import React from "react";',
        '',
        'export interface {{ name | pascalCase }}Props { ',
        '  title? }',
        '',
        'export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({',
        '  title,',
        '  className = ""',
        '}) => {',
        '  return (',
        '    <div className={`{{ name | kebabCase }} ${className}`.trim()}>',
        '      {title && {title}</h1>}',
        '    </div>',
        '  );',
        '};',
        ''
      ].join('\n')
    );

    // Simple injection test template
    await fs.ensureDir(path.join(tempDir, '_templates/inject/simple'));
    await fs.writeFile(
      path.join(tempDir, '_templates/inject/simple/append.js'),
      [
        '---',
        'to: target.js',
        'append: true',
        '---',
        '',
        '// Appended by template',
        'const appendedVar = "test";'
      ].join('\n')
    );
  }

  describe('Template Generation with Real Nunjucks Processing', () => { it('should generate React component with correct path and content', async () => {
      const result = await generator.generate({
        generator });

    it('should discover generators and templates correctly', async () => {
      const generators = await generator.listGenerators();
      expect(generators.length).toBeGreaterThan(0);
      
      const generatorNames = generators.map(g => g.name);
      expect(generatorNames).toContain('component');
      expect(generatorNames).toContain('inject');
      
      const componentTemplates = await generator.listTemplates('component');
      expect(componentTemplates.length).toBeGreaterThan(0);
      const templateNames = componentTemplates.map(t => t.name);
      expect(templateNames).toContain('react');
    });

    it('should scan template variables for CLI generation', async () => {
      const { variables, cliArgs } = await generator.scanTemplateForVariables('component', 'react');
      
      expect(variables.length).toBeGreaterThan(0);
      const variableNames = variables.map(v => v.name);
      expect(variableNames).toContain('name');
      
      expect(cliArgs).toHaveProperty('name');
      expect(typeof cliArgs.name).toBe('object');
    });
  });

  describe('File Injection with Real I/O Operations', () => {
    let targetFile => {
      targetFile = path.join(tempDir, 'target.js');
      await fs.writeFile(targetFile, [
        '// Target file',
        'const original = true;',
        '',
        '// INJECTION_POINT',
        'const existing = false;',
        '',
        'module.exports = { original, existing };'
      ].join('\n'));
    });

    it('should write new files correctly', async () => {
      const newFile = path.join(tempDir, 'new.js');
      const content = 'const newFile = true;\nexport { newFile };';
      
      const result = await fileInjector.processFile(
        newFile,
        content,
        {},
        { force, dry }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('File written');
      expect(await fs.pathExists(newFile)).toBe(true);
      
      const writtenContent = await fs.readFile(newFile, 'utf-8');
      expect(writtenContent).toBe(content);
    });

    it('should prevent overwriting without force flag', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        'const overwrite = true;',
        {},
        { force, dry }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result.message).toContain('Use --force');
      
      // Original content should remain unchanged
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('const original = true');
    });

    it('should overwrite with force flag', async () => {
      const newContent = 'const overwritten = true;';
      
      const result = await fileInjector.processFile(
        targetFile,
        newContent,
        {},
        { force, dry }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('File written');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toBe(newContent);
    });

    it('should append content to end of file', async () => { const appendContent = '\n// Appended\nconst appended = true;';
      
      const result = await fileInjector.processFile(
        targetFile,
        appendContent,
        { append },
        { force, dry }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content appended');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('const original = true'); // Original preserved
      expect(content).toContain('// Appended');
      expect(content).toContain('const appended = true');
      expect(content.trim().endsWith('const appended = true;')).toBe(true);
    });

    it('should prepend content to beginning of file', async () => { const prependContent = '// Prepended header\nconst prepended = true;\n\n';
      
      const result = await fileInjector.processFile(
        targetFile,
        prependContent,
        { prepend },
        { force, dry }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content prepended');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content.startsWith('// Prepended header')).toBe(true);
      expect(content).toContain('const prepended = true');
      expect(content).toContain('const original = true'); // Original preserved
    });

    it('should inject at specific line number', async () => {
      const lineContent = '// Line injection\nconst atSpecificLine = true;';
      
      const result = await fileInjector.processFile(
        targetFile,
        lineContent,
        { lineAt,
        { force, dry }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('injected at line 3');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      const lines = content.split('\n');
      
      // Line 3 (0-indexed as 2) should contain our injection
      expect(lines[2]).toContain('// Line injection');
      expect(content).toContain('const atSpecificLine = true');
    });

    it('should be idempotent for repeated operations', async () => { const repeatContent = '\n// Idempotent content\nconst idempotent = true;';
      
      // First append
      const result1 = await fileInjector.processFile(
        targetFile,
        repeatContent,
        { append },
        { force, dry }
      );
      expect(result1.success).toBe(true);
      
      const contentAfterFirst = await fs.readFile(targetFile, 'utf-8');
      
      // Second append (should be skipped due to idempotency)
      const result2 = await fileInjector.processFile(
        targetFile,
        repeatContent,
        { append },
        { force, dry }
      );
      
      expect(result2.success).toBe(true);
      expect(result2.skipped).toBe(true);
      
      const contentAfterSecond = await fs.readFile(targetFile, 'utf-8');
      expect(contentAfterSecond).toBe(contentAfterFirst);
      
      // Content should only appear once
      const matches = (contentAfterSecond.match(/const idempotent = true;/g) || []).length;
      expect(matches).toBe(1);
    });

    it('should work in dry run mode without file modifications', async () => {
      const dryFile = path.join(tempDir, 'dry-test.js');
      
      const result = await fileInjector.processFile(
        dryFile,
        'const dryRun = true;',
        {},
        { force, dry }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Would write file');
      
      // File should NOT exist after dry run
      expect(await fs.pathExists(dryFile)).toBe(false);
    });
  });

  describe('File Permissions and Shell Commands', () => {
    it('should set file permissions correctly', async () => {
      const scriptFile = path.join(tempDir, 'test-script.sh');
      await fs.writeFile(scriptFile, '#!/bin/bash\necho "test"');
      
      const success = await fileInjector.setPermissions(scriptFile, '755');
      expect(success).toBe(true);
      
      const stats = await fs.stat(scriptFile);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      expect(permissions).toBe('755');
    });

    it('should validate chmod permissions', async () => {
      const scriptFile = path.join(tempDir, 'test-invalid.sh');
      await fs.writeFile(scriptFile, 'test');
      
      // Invalid permission should be rejected
      const success = await fileInjector.setPermissions(scriptFile, '999');
      expect(success).toBe(false);
    });

    it('should execute shell commands', async () => {
      const result = await fileInjector.executeCommands([
        'echo "Hello World"',
        'echo "Command 2"'
      ], tempDir);

      expect(result.success).toBe(true);
      expect(result.outputs).toContain('Hello World');
      expect(result.outputs).toContain('Command 2');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle failed shell commands gracefully', async () => {
      const result = await fileInjector.executeCommands([
        'nonexistent-command-should-fail'
      ], tempDir);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Command failed');
    });
  });

  describe('Frontmatter Processing with Real YAML', () => { it('should parse simple frontmatter correctly', () => {
      const content = [
        '---',
        'to });

    it('should parse complex frontmatter with all directives', () => { const content = [
        '---',
        'to }}.ts',
        'inject: true',
        'after: "// MARKER"',
        'chmod: "644"',
        'skipIf: "{{ skip }}"',
        '---',
        'const {{ name }} = true;'
      ].join('\n');
      
      const result = frontmatterParser.parse(content);
      
      expect(result.frontmatter.to).toBe('src/{{ name }}.ts');
      expect(result.frontmatter.inject).toBe(true);
      expect(result.frontmatter.after).toBe('// MARKER');
      expect(result.frontmatter.chmod).toBe('644');
      expect(result.frontmatter.skipIf).toBe('{{ skip }}');
      expect(result.content).toBe('const {{ name }} = true;');
    });

    it('should handle templates without frontmatter', () => {
      const content = 'plain content without frontmatter';
      const result = frontmatterParser.parse(content);
      
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(content);
    });

    it('should validate frontmatter correctly', () => { const validFrontmatter = {
        to };
      
      const validation = frontmatterParser.validate(validFrontmatter);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect conflicting injection directives', () => { const conflictingFrontmatter = {
        inject,
        append,
        prepend };
      
      const validation = frontmatterParser.validate(conflictingFrontmatter);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling with Real File System', () => {
    it('should handle non-existent generator gracefully', async () => {
      await expect(
        generator.scanTemplateForVariables('nonexistent-generator', 'template')
      ).rejects.toThrow(/Generator 'nonexistent-generator' not found/);
    });

    it('should handle non-existent template gracefully', async () => {
      await expect(
        generator.scanTemplateForVariables('component', 'nonexistent-template')
      ).rejects.toThrow(/Template 'nonexistent-template' not found/);
    });

    it('should handle injection into non-existent file', async () => { const result = await fileInjector.processFile(
        path.join(tempDir, 'nonexistent.js'),
        'content',
        { inject, after },
        { force, dry }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot inject into non-existent file');
    });

    it('should handle missing injection markers', async () => {
      const targetFile = path.join(tempDir, 'no-markers.js');
      await fs.writeFile(targetFile, 'const noMarkers = true;');

      const result = await fileInjector.processFile(
        targetFile,
        'injected content',
        { inject, after,
        { force, dry }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Target not found');
    });

    it('should handle invalid line numbers for lineAt injection', async () => {
      const targetFile = path.join(tempDir, 'short.js');
      await fs.writeFile(targetFile, 'line1\nline2');

      const result = await fileInjector.processFile(
        targetFile,
        'content',
        { lineAt, // Line that doesn't exist
        { force, dry }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('exceeds file length');
    });
  });

  describe('Integration Workflows - Real Use Cases', () => { it('should complete full component generation workflow', async () => {
      // Generate component with realistic variables
      const result = await generator.generate({
        generator });

    it('should handle sequential file injection operations', async () => {
      // Create main index file
      const indexFile = path.join(tempDir, 'index.ts');
      await fs.writeFile(indexFile, [
        '// Main index file',
        'export * from './base.js';',
        '',
        '// AUTO_GENERATED_EXPORTS',
        '// End exports'
      ].join('\n'));

      // Inject multiple exports sequentially
      const exports = [
        'export * from './UserService.js';',
        'export * from './ProductService.js';',
        'export * from './OrderService.js';'
      ];

      for (const exportStatement of exports) {
        const result = await fileInjector.processFile(
          indexFile,
          exportStatement,
          { inject, after,
          { force, dry }
        );
        expect(result.success).toBe(true);
      }

      // Verify all exports were added in correct order
      const finalContent = await fs.readFile(indexFile, 'utf-8');
      expect(finalContent).toContain('export * from './UserService.js'');
      expect(finalContent).toContain('export * from './ProductService.js'');
      expect(finalContent).toContain('export * from './OrderService.js'');
      expect(finalContent).toContain('// AUTO_GENERATED_EXPORTS');
      
      // Verify order
      const userIndex = finalContent.indexOf('UserService');
      const productIndex = finalContent.indexOf('ProductService');
      const orderIndex = finalContent.indexOf('OrderService');
      
      expect(productIndex).toBeGreaterThan(userIndex);
      expect(orderIndex).toBeGreaterThan(productIndex);
    });

    it('should handle multiple template generations', async () => { const names = ['Header', 'Footer', 'Navigation'];
      const results = [];

      // Generate multiple components
      for (const name of names) {
        const result = await generator.generate({
          generator }

      // All generations should succeed
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.files).toHaveLength(1);
        expect(result.files[0].content).toContain(`${names[index]}Props`);
      });

      // All files should exist
      expect(await fs.pathExists(path.join(tempDir, 'src/components/Header.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'src/components/Footer.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'src/components/Navigation.tsx'))).toBe(true);
    });
  });

  describe('Performance and Scale Validation', () => { it('should handle reasonable template complexity', async () => {
      // Create a template with multiple variables and filters
      await fs.ensureDir(path.join(tempDir, '_templates/complex/service'));
      await fs.writeFile(
        path.join(tempDir, '_templates/complex/service/service.ts'),
        [
          '---',
          'to }}Service.ts',
          '---',
          'import { Repository } from './base.js';',
          '',
          'export interface {{ name | pascalCase }}Data { ',
          '  id }}Id: string;',
          '}',
          '',
          'export class {{ name | pascalCase }}Service { ',
          '  private repository }}Data>;',
          '',
          '  constructor() {',
          '    this.repository = new Repository<{{ name | pascalCase }}Data>("{{ name | kebabCase }}");',
          '  }',
          '',
          '  async findAll() {',
          '    return this.repository.findAll();',
          '  }',
          '',
          '  async findById(id) {',
          '    return this.repository.findById(id);',
          '  }',
          '',
          '  async create(data) {',
          '    return this.repository.create({',
          '      ...data,',
          '      id),',
          '      {{ name | camelCase }}Id: data.{{ name | camelCase }}Id || this.generateId()',
          '    });',
          '  }',
          '',
          '  private generateId() {',
          '    return `{{ name | kebabCase }}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;',
          '  }',
          '}'
        ].join('\n')
      );

      const startTime = Date.now();
      
      const result = await generator.generate({ generator });

    it('should handle file operations within reasonable time', async () => {
      // Test file operations performance
      const targetFile = path.join(tempDir, 'performance-test.js');
      await fs.writeFile(targetFile, [
        '// Performance test file',
        'const start = true;',
        '',
        '// BULK_INSERT_POINT',
        '// End'
      ].join('\n'));

      const startTime = Date.now();
      
      // Perform multiple injection operations
      for (let i = 0; i < 10; i++) {
        const result = await fileInjector.processFile(
          targetFile,
          `const item${i} = ${i};`,
          { inject, after,
          { force, dry }
        );
        expect(result.success).toBe(true);
      }

      const duration = Date.now() - startTime;
      
      // Should complete bulk operations quickly (under 500ms for 10 operations)
      expect(duration).toBeLessThan(500);
      
      // Verify all operations were applied
      const finalContent = await fs.readFile(targetFile, 'utf-8');
      for (let i = 0; i < 10; i++) {
        expect(finalContent).toContain(`const item${i} = ${i};`);
      }
    });
  });
});