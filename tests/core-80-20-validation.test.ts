import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Generator } from '../src/lib/generator.js';
import { FileInjector } from '../src/lib/file-injector.js';
import { FrontmatterParser } from '../src/lib/frontmatter-parser.js';

/**
 * Core 80/20 Implementation Validation Tests
 * 
 * Tests the critical 20% of functionality that provides 80% of user value:
 * 1. Template generation with Nunjucks filters
 * 2. Frontmatter processing (to, inject, append, prepend, skipIf)
 * 3. File injection operations (idempotent)
 * 4. CLI argument parsing and positional parameters
 * 5. Real file I/O operations without mocks
 */
describe('Core 80/20 Implementation Validation - Real Operations', () => {
  let tempDir: string;
  let originalCwd: string;
  let generator: Generator;
  let fileInjector: FileInjector;
  let frontmatterParser: FrontmatterParser;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-core-test-'));
    
    // Set up test environment without changing process.cwd() to avoid worker issues
    generator = new Generator(path.join(tempDir, '_templates'));
    fileInjector = new FileInjector();
    frontmatterParser = new FrontmatterParser();

    await setupRealTemplates();
  });

  afterEach(async () => {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  async function setupRealTemplates() {
    // Critical 20% Template 1: React Component (most common use case)
    await fs.ensureDir(path.join(tempDir, '_templates', 'component', 'react'));
    await fs.writeFile(
      path.join(tempDir, '_templates', 'component', 'react', 'Component.tsx'),
      `---
to: src/components/{{ name | pascalCase }}.tsx
---
import React from 'react';

export interface {{ name | pascalCase }}Props {
  title?: string;
  children?: React.ReactNode;
  className?: string;
  isActive?: boolean;
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
  title,
  children,
  className = '',
  isActive = false
}) => {
  return (
    <div className={\`{{ name | kebabCase }} \${className}\`.trim()} data-active={isActive}>
      {title && <h1>{title}</h1>}
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};
`
    );

    // Critical 20% Template 2: File injection (second most common)
    await fs.ensureDir(path.join(tempDir, '_templates', 'inject', 'test'));
    await fs.writeFile(
      path.join(tempDir, '_templates', 'inject', 'test', 'after-marker.js'),
      `---
to: target.js
inject: true
after: "// INSERT_AFTER"
---
// Injected content
const injectedVar = 'after-marker';
console.log('Injected after marker');
`
    );

    await fs.writeFile(
      path.join(tempDir, '_templates', 'inject', 'test', 'append-content.js'),
      `---
to: target.js
append: true
---

// Appended at end
const appendedVar = 'end-of-file';
export { appendedVar };
`
    );

    // Critical 20% Template 3: Conditional generation (skipIf)
    await fs.writeFile(
      path.join(tempDir, '_templates', 'inject', 'test', 'conditional.js'),
      `---
to: conditional.js
skipIf: "{{ shouldSkip === true }}"
---
// This should only generate when shouldSkip is false
const conditionalVar = 'generated';
console.log('Conditional generation worked!');
`
    );

    // Critical 20% Template 4: API endpoint (common enterprise use case)
    await fs.ensureDir(path.join(tempDir, '_templates', 'api', 'endpoint'));
    await fs.writeFile(
      path.join(tempDir, '_templates', 'api', 'endpoint', 'controller.ts'),
      `---
to: src/api/{{ name | kebabCase }}/{{ name | kebabCase }}.controller.ts
---
import { Request, Response } from 'express';

export class {{ name | pascalCase }}Controller {
  async getAll(req: Request, res: Response) {
    try {
      // TODO: Implement {{ name | camelCase }} listing
      const {{ name | camelCase | pluralize }} = [];
      res.json({
        success: true,
        data: {{ name | camelCase | pluralize }},
        count: {{ name | camelCase | pluralize }}.length
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // TODO: Implement {{ name | camelCase }} retrieval
      const {{ name | camelCase }} = null;
      
      if (!{{ name | camelCase }}) {
        return res.status(404).json({ success: false, message: '{{ name | titleCase }} not found' });
      }

      res.json({ success: true, data: {{ name | camelCase }} });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const data = req.body;
      // TODO: Implement {{ name | camelCase }} creation
      const new{{ name | pascalCase }} = { id: Date.now(), ...data };
      res.status(201).json({ success: true, data: new{{ name | pascalCase }} });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
`
    );
  }

  describe('Critical 20%: Template Generation with Nunjucks Filters', () => {
    it('should generate React component with all filters working correctly', async () => {
      const result = await generator.generate({
        generator: 'component',
        template: 'react',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {
          name: 'user profile card'
        }
      });

      expect(result.files).toHaveLength(1);
      const file = result.files[0];
      
      // Verify path uses kebabCase filter
      expect(file.path).toContain('user-profile-card');
      expect(file.path).toContain('UserProfileCard.tsx');
      
      // Verify content uses pascalCase filter
      expect(file.content).toContain('UserProfileCardProps');
      expect(file.content).toContain('export const UserProfileCard');
      
      // Verify kebabCase in className
      expect(file.content).toContain('user-profile-card');
      
      // Verify file was actually written
      expect(await fs.pathExists(file.path)).toBe(true);
      
      const writtenContent = await fs.readFile(file.path, 'utf-8');
      expect(writtenContent).toBe(file.content);
      
      // Test all critical filters
      expect(file.content).toContain('UserProfileCard'); // pascalCase
      expect(file.content).toContain('user-profile-card'); // kebabCase
    });

    it('should generate API endpoint with pluralization and case filters', async () => {
      const result = await generator.generate({
        generator: 'api',
        template: 'endpoint',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {
          name: 'product'
        }
      });

      expect(result.files).toHaveLength(1);
      const file = result.files[0];
      
      expect(file.path).toContain('product/product.controller.ts');
      expect(file.content).toContain('ProductController');
      expect(file.content).toContain('products'); // pluralize filter
      expect(file.content).toContain('product'); // camelCase filter
      expect(file.content).toContain('Product not found'); // titleCase filter
      
      expect(await fs.pathExists(file.path)).toBe(true);
    });
  });

  describe('Critical 20%: Frontmatter Processing', () => {
    it('should parse frontmatter correctly', () => {
      const content = `---
to: output.js
inject: true
after: "marker"
skipIf: "{{ skip === true }}"
---
const content = true;`;

      const result = frontmatterParser.parse(content);
      
      expect(result.frontmatter.to).toBe('output.js');
      expect(result.frontmatter.inject).toBe(true);
      expect(result.frontmatter.after).toBe('marker');
      expect(result.frontmatter.skipIf).toBe('{{ skip === true }}');
      expect(result.content).toBe('const content = true;');
    });

    it('should evaluate skipIf conditions correctly', () => {
      // Should skip when condition is true
      const shouldSkip1 = frontmatterParser.shouldSkip(
        { skipIf: '{{ shouldSkip === true }}' },
        { shouldSkip: true }
      );
      expect(shouldSkip1).toBe(true);

      // Should not skip when condition is false
      const shouldSkip2 = frontmatterParser.shouldSkip(
        { skipIf: '{{ shouldSkip === true }}' },
        { shouldSkip: false }
      );
      expect(shouldSkip2).toBe(false);

      // Should not skip when no skipIf
      const shouldSkip3 = frontmatterParser.shouldSkip(
        { to: 'output.js' },
        { shouldSkip: true }
      );
      expect(shouldSkip3).toBe(false);
    });

    it('should handle conditional generation in real workflow', async () => {
      // Should skip generation
      const result1 = await generator.generate({
        generator: 'inject',
        template: 'test',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {
          shouldSkip: true
        }
      });

      // Template with skipIf should not generate any files
      const conditionalFiles = result1.files.filter(f => f.path.includes('conditional.js'));
      expect(conditionalFiles).toHaveLength(0);

      // Should not skip generation  
      const result2 = await generator.generate({
        generator: 'inject',
        template: 'test',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {
          shouldSkip: false
        }
      });

      const conditionalFiles2 = result2.files.filter(f => f.path.includes('conditional.js'));
      expect(conditionalFiles2.length).toBeGreaterThan(0);
    });
  });

  describe('Critical 20%: File Injection Operations', () => {
    let targetFile: string;

    beforeEach(async () => {
      targetFile = path.join(tempDir, 'target.js');
      await fs.writeFile(targetFile, `// Target file for injection
const original = true;

// INSERT_AFTER
const placeholder = false;

// End of file
`);
    });

    it('should inject content after marker correctly', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        '// Injected after marker\nconst injected = true;',
        { inject: true, after: '// INSERT_AFTER' },
        { force: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content injected');

      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('// INSERT_AFTER');
      expect(content).toContain('// Injected after marker');
      
      // Verify order
      const markerIndex = content.indexOf('// INSERT_AFTER');
      const injectedIndex = content.indexOf('// Injected after marker');
      expect(injectedIndex).toBeGreaterThan(markerIndex);
    });

    it('should append content to end of file', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        '\n// Appended content\nconst appended = true;',
        { append: true },
        { force: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content appended');

      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('// Appended content');
      expect(content.trim().endsWith('const appended = true;')).toBe(true);
    });

    it('should be idempotent - running same injection twice should not duplicate', async () => {
      // First injection
      await fileInjector.processFile(
        targetFile,
        '\n// Idempotent content\nconst idempotent = true;',
        { append: true },
        { force: false, dry: false }
      );

      const contentAfterFirst = await fs.readFile(targetFile, 'utf-8');

      // Second injection (should be skipped)
      const result = await fileInjector.processFile(
        targetFile,
        '\n// Idempotent content\nconst idempotent = true;',
        { append: true },
        { force: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);

      const contentAfterSecond = await fs.readFile(targetFile, 'utf-8');
      expect(contentAfterSecond).toBe(contentAfterFirst);

      // Should only have one instance
      const matches = (contentAfterSecond.match(/const idempotent = true;/g) || []).length;
      expect(matches).toBe(1);
    });

    it('should handle prepend operations correctly', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        '// Prepended content\nconst prepended = true;\n\n',
        { prepend: true },
        { force: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content prepended');

      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('// Prepended content');
      expect(content.startsWith('// Prepended content')).toBe(true);
    });

    it('should handle line-specific injection', async () => {
      const result = await fileInjector.processFile(
        targetFile,
        '// Injected at line 3\nconst atLine3 = true;',
        { lineAt: 3 },
        { force: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('injected at line 3');

      const content = await fs.readFile(targetFile, 'utf-8');
      const lines = content.split('\n');
      
      // Line 3 (0-indexed as 2) should contain our injection
      expect(lines[2]).toContain('// Injected at line 3');
    });
  });

  describe('Critical 20%: File Operations and Safety', () => {
    it('should refuse to overwrite existing files without force flag', async () => {
      const existingFile = path.join(tempDir, 'existing.js');
      await fs.writeFile(existingFile, 'const existing = true;');

      const result = await fileInjector.processFile(
        existingFile,
        'const overwrite = true;',
        {},
        { force: false, dry: false }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result.message).toContain('Use --force');

      // Original content should be preserved
      const content = await fs.readFile(existingFile, 'utf-8');
      expect(content).toBe('const existing = true;');
    });

    it('should overwrite with force flag', async () => {
      const existingFile = path.join(tempDir, 'existing.js');
      await fs.writeFile(existingFile, 'const existing = true;');

      const result = await fileInjector.processFile(
        existingFile,
        'const overwritten = true;',
        {},
        { force: true, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('File written');

      const content = await fs.readFile(existingFile, 'utf-8');
      expect(content).toBe('const overwritten = true;');
    });

    it('should work correctly in dry run mode', async () => {
      const result = await fileInjector.processFile(
        path.join(tempDir, 'dry-run-test.js'),
        'const dryRun = true;',
        {},
        { force: false, dry: true }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Would write file');

      // File should not be created in dry run
      expect(await fs.pathExists(path.join(tempDir, 'dry-run-test.js'))).toBe(false);
    });

    it('should set file permissions correctly', async () => {
      const scriptFile = path.join(tempDir, 'test.sh');
      await fs.writeFile(scriptFile, '#!/bin/bash\necho "test"');

      const success = await fileInjector.setPermissions(scriptFile, '755');
      expect(success).toBe(true);

      const stats = await fs.stat(scriptFile);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      expect(permissions).toBe('755');
    });

    it('should validate chmod permissions', async () => {
      const scriptFile = path.join(tempDir, 'test.sh');
      await fs.writeFile(scriptFile, 'test');

      // Invalid permission should fail
      const success = await fileInjector.setPermissions(scriptFile, '999');
      expect(success).toBe(false);
    });
  });

  describe('Critical 20%: Generator Discovery and Listing', () => {
    it('should list available generators', async () => {
      const generators = await generator.listGenerators();

      expect(generators.length).toBeGreaterThan(0);
      const generatorNames = generators.map(g => g.name);
      expect(generatorNames).toContain('component');
      expect(generatorNames).toContain('inject');
      expect(generatorNames).toContain('api');
    });

    it('should list templates for a specific generator', async () => {
      const templates = await generator.listTemplates('component');

      expect(templates.length).toBeGreaterThan(0);
      const templateNames = templates.map(t => t.name);
      expect(templateNames).toContain('react');
    });

    it('should scan template variables correctly', async () => {
      const { variables, cliArgs } = await generator.scanTemplateForVariables('component', 'react');

      expect(variables.length).toBeGreaterThan(0);
      const variableNames = variables.map(v => v.name);
      expect(variableNames).toContain('name');

      expect(cliArgs).toHaveProperty('name');
    });

    it('should handle generator not found errors gracefully', async () => {
      await expect(
        generator.scanTemplateForVariables('nonexistent', 'template')
      ).rejects.toThrow(/Generator 'nonexistent' not found/);
    });

    it('should handle template not found errors gracefully', async () => {
      await expect(
        generator.scanTemplateForVariables('component', 'nonexistent')
      ).rejects.toThrow(/Template 'nonexistent' not found/);
    });
  });

  describe('Critical 20%: Shell Commands and Advanced Features', () => {
    it('should execute shell commands successfully', async () => {
      const result = await fileInjector.executeCommands([
        'echo "Hello World"',
        'echo "Test Command"'
      ], tempDir);

      expect(result.success).toBe(true);
      expect(result.outputs).toContain('Hello World');
      expect(result.outputs).toContain('Test Command');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle command execution failures gracefully', async () => {
      const result = await fileInjector.executeCommands([
        'nonexistent-command-that-fails'
      ], tempDir);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Command failed');
    });
  });

  describe('Critical 20%: Error Handling and Edge Cases', () => {
    it('should handle injection into non-existent file', async () => {
      const result = await fileInjector.processFile(
        path.join(tempDir, 'nonexistent.js'),
        'content',
        { inject: true, after: 'marker' },
        { force: false, dry: false }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot inject into non-existent file');
    });

    it('should handle missing injection marker gracefully', async () => {
      const targetFile = path.join(tempDir, 'no-marker.js');
      await fs.writeFile(targetFile, 'const noMarker = true;');

      const result = await fileInjector.processFile(
        targetFile,
        'injected content',
        { inject: true, after: 'MISSING_MARKER' },
        { force: false, dry: false }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Target not found');
    });

    it('should handle invalid line numbers in lineAt injection', async () => {
      const targetFile = path.join(tempDir, 'short-file.js');
      await fs.writeFile(targetFile, 'line 1\nline 2');

      const result = await fileInjector.processFile(
        targetFile,
        'injected at line 10',
        { lineAt: 10 },
        { force: false, dry: false }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('exceeds file length');
    });
  });

  describe('Critical 20%: Integration Workflow', () => {
    it('should complete a full component generation workflow', async () => {
      // Generate component
      const result = await generator.generate({
        generator: 'component',
        template: 'react',
        dest: tempDir,
        force: false,
        dry: false,
        variables: {
          name: 'TodoItem'
        }
      });

      expect(result.files).toHaveLength(1);
      const file = result.files[0];

      // Verify file was created with correct content
      expect(await fs.pathExists(file.path)).toBe(true);
      expect(file.path).toContain('TodoItem.tsx');

      const content = await fs.readFile(file.path, 'utf-8');
      expect(content).toContain('TodoItemProps');
      expect(content).toContain('export const TodoItem');
      expect(content).toContain('todo-item'); // kebabCase in className

      // Verify it's a valid React component structure
      expect(content).toContain('import React from');
      expect(content).toContain('React.FC<TodoItemProps>');
      expect(content).toContain('export default TodoItem');
    });

    it('should handle multiple template generation in sequence', async () => {
      const results: any[] = [];

      // Generate multiple components
      for (const name of ['Header', 'Footer', 'Sidebar']) {
        const result = await generator.generate({
          generator: 'component',
          template: 'react',
          dest: tempDir,
          force: false,
          dry: false,
          variables: { name }
        });
        results.push(result);
      }

      // All should succeed
      results.forEach(result => {
        expect(result.files).toHaveLength(1);
      });

      // Verify all files were created
      expect(await fs.pathExists(path.join(tempDir, 'src/components/Header.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'src/components/Footer.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'src/components/Sidebar.tsx'))).toBe(true);
    });

    it('should maintain file consistency across operations', async () => {
      const targetFile = path.join(tempDir, 'app.js');
      await fs.writeFile(targetFile, `// Main app file
const app = {};

// COMPONENTS_START
// COMPONENTS_END

// EXPORTS_START  
// EXPORTS_END

module.exports = app;
`);

      // Multiple injections
      await fileInjector.processFile(
        targetFile,
        'const Header = require("./Header");',
        { inject: true, after: '// COMPONENTS_START' },
        { force: false, dry: false }
      );

      await fileInjector.processFile(
        targetFile,
        'const Footer = require("./Footer");',
        { inject: true, after: 'const Header = require("./Header");' },
        { force: false, dry: false }
      );

      await fileInjector.processFile(
        targetFile,
        'app.Header = Header;',
        { inject: true, after: '// EXPORTS_START' },
        { force: false, dry: false }
      );

      await fileInjector.processFile(
        targetFile,
        'app.Footer = Footer;',
        { inject: true, after: 'app.Header = Header;' },
        { force: false, dry: false }
      );

      const finalContent = await fs.readFile(targetFile, 'utf-8');
      
      // Verify all injections worked and are in correct order
      expect(finalContent).toContain('const Header = require("./Header");');
      expect(finalContent).toContain('const Footer = require("./Footer");');
      expect(finalContent).toContain('app.Header = Header;');
      expect(finalContent).toContain('app.Footer = Footer;');

      // Verify order
      const headerImportIndex = finalContent.indexOf('const Header = require');
      const footerImportIndex = finalContent.indexOf('const Footer = require');
      const headerExportIndex = finalContent.indexOf('app.Header = Header');
      const footerExportIndex = finalContent.indexOf('app.Footer = Footer');

      expect(footerImportIndex).toBeGreaterThan(headerImportIndex);
      expect(footerExportIndex).toBeGreaterThan(headerExportIndex);
    });
  });
});