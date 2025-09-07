import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import path from 'node:path';
import { GeneratorFactory, TemplateFactory, FileFactory } from '../factories/index.js';

const execAsync = promisify(exec);

describe('CLI Integration Tests', () => {
  let testDir => {
    // Create temporary test directory
    testDir = path.join(process.cwd(), `test-cli-${Date.now()}`);
    templatesDir = path.join(testDir, '_templates');
    
    await fs.ensureDir(testDir);
    await fs.ensureDir(templatesDir);
    
    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    process.chdir(path.dirname(testDir));
    await fs.remove(testDir).catch(() => {}); // Ignore errors
  });

  describe('unjucks list', () => {
    it('should list available generators', async () => {
      // Create test generator structure
      await createTestGenerator('component', 'basic');
      await createTestGenerator('service', 'crud');

      const { stdout } = await execAsync('node ../../dist/cli.mjs list');

      expect(stdout).toContain('component');
      expect(stdout).toContain('service');
      expect(stdout).toContain('basic');
      expect(stdout).toContain('crud');
    });

    it('should handle empty templates directory', async () => {
      const { stdout } = await execAsync('node ../../dist/cli.mjs list');

      expect(stdout).toContain('No generators found');
    });

    it('should show detailed generator information', async () => { await createTestGenerator('component', 'react', {
        description });

      const { stdout } = await execAsync('node ../../dist/cli.mjs list --verbose');

      expect(stdout).toContain('React component generator');
      expect(stdout).toContain('component.njk');
      expect(stdout).toContain('test.njk');
      expect(stdout).toContain('stories.njk');
    });
  });

  describe('unjucks generate', () => {
    beforeEach(async () => {
      await createTestGenerator('component', 'basic');
    });

    it('should generate files from template', async () => {
      const { stdout } = await execAsync('node ../../dist/cli.mjs generate component basic Button');

      expect(stdout).toContain('Generated');
      expect(stdout).toContain('Button');

      // Verify files were created
      const generatedFile = path.join(testDir, 'src', 'Button.tsx');
      expect(await fs.pathExists(generatedFile)).toBe(true);
      
      const content = await fs.readFile(generatedFile, 'utf8');
      expect(content).toContain('Button');
    });

    it('should handle custom destination directory', async () => {
      const customDest = path.join(testDir, 'custom');
      
      const { stdout } = await execAsync(
        `node ../../dist/cli.mjs generate component basic Button --dest ${customDest}`
      );

      expect(stdout).toContain('Generated');

      const generatedFile = path.join(customDest, 'Button.tsx');
      expect(await fs.pathExists(generatedFile)).toBe(true);
    });

    it('should perform dry run without creating files', async () => {
      const { stdout } = await execAsync(
        'node ../../dist/cli.mjs generate component basic Button --dry'
      );

      expect(stdout).toContain('DRY RUN');
      expect(stdout).toContain('Would create');

      // Verify no files were created
      const wouldCreateFile = path.join(testDir, 'src', 'Button.tsx');
      expect(await fs.pathExists(wouldCreateFile)).toBe(false);
    });

    it('should handle force overwrite', async () => {
      // Create existing file
      const existingFile = path.join(testDir, 'src', 'Button.tsx');
      await fs.ensureDir(path.dirname(existingFile));
      await fs.writeFile(existingFile, 'existing content');

      const { stdout } = await execAsync(
        'node ../../dist/cli.mjs generate component basic Button --force'
      );

      expect(stdout).toContain('Generated');

      const content = await fs.readFile(existingFile, 'utf8');
      expect(content).not.toBe('existing content');
      expect(content).toContain('Button');
    });

    it('should handle custom variables via flags', async () => {
      const { stdout } = await execAsync(
        'node ../../dist/cli.mjs generate component basic MyComponent --hasProps --testFramework jest'
      );

      expect(stdout).toContain('Generated');

      const generatedFile = path.join(testDir, 'src', 'MyComponent.tsx');
      const content = await fs.readFile(generatedFile, 'utf8');
      expect(content).toContain('MyComponent');
      expect(content).toContain('jest'); // Custom variable
    });

    it('should handle interactive prompts for missing variables', async () => {
      // This test would require mocking stdin for interactive prompts
      // For now, we test that the command fails appropriately when required vars are missing
      
      await expect(
        execAsync('node ../../dist/cli.mjs generate component basic')
      ).rejects.toThrow();
    });
  });

  describe('unjucks init', () => {
    it('should initialize new project structure', async () => {
      const projectDir = path.join(testDir, 'my-app');
      
      const { stdout } = await execAsync(
        `node ../../dist/cli.mjs init app ${projectDir}`
      );

      expect(stdout).toContain('Initialized');
      expect(await fs.pathExists(projectDir)).toBe(true);
      expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(true);
    });

    it('should handle existing directory error', async () => {
      const existingDir = path.join(testDir, 'existing');
      await fs.ensureDir(existingDir);

      await expect(
        execAsync(`node ../../dist/cli.mjs init app ${existingDir}`)
      ).rejects.toThrow();
    });
  });

  describe('unjucks help', () => {
    beforeEach(async () => {
      await createTestGenerator('component', 'basic');
    });

    it('should show general help', async () => {
      const { stdout } = await execAsync('node ../../dist/cli.mjs --help');

      expect(stdout).toContain('Usage');
      expect(stdout).toContain('Commands');
      expect(stdout).toContain('generate');
      expect(stdout).toContain('list');
      expect(stdout).toContain('init');
    });

    it('should show command-specific help', async () => {
      const { stdout } = await execAsync('node ../../dist/cli.mjs generate --help');

      expect(stdout).toContain('generate');
      expect(stdout).toContain('--dest');
      expect(stdout).toContain('--force');
      expect(stdout).toContain('--dry');
    });

    it('should show generator help', async () => {
      const { stdout } = await execAsync('node ../../dist/cli.mjs help component basic');

      expect(stdout).toContain('component');
      expect(stdout).toContain('basic');
      expect(stdout).toContain('Variables');
    });
  });

  describe('error handling', () => {
    it('should handle non-existent generator', async () => {
      await expect(
        execAsync('node ../../dist/cli.mjs generate nonexistent template name')
      ).rejects.toThrow();
    });

    it('should handle non-existent template', async () => {
      await createTestGenerator('component', 'basic');

      await expect(
        execAsync('node ../../dist/cli.mjs generate component nonexistent name')
      ).rejects.toThrow();
    });

    it('should handle invalid destination path', async () => {
      await createTestGenerator('component', 'basic');

      await expect(
        execAsync('node ../../dist/cli.mjs generate component basic name --dest /invalid/path')
      ).rejects.toThrow();
    });

    it('should handle malformed templates gracefully', async () => {
      await createMalformedGenerator('broken', 'template');

      await expect(
        execAsync('node ../../dist/cli.mjs generate broken template name')
      ).rejects.toThrow();
    });
  });

  describe('file injection', () => { beforeEach(async () => {
      await createInjectionGenerator('route', 'add');
      
      // Create target file for injection
      const targetFile = path.join(testDir, 'src', 'routes.ts');
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeFile(targetFile, `export const routes = {
  home });

    it('should inject content into existing files', async () => {
      const { stdout } = await execAsync(
        'node ../../dist/cli.mjs generate route add user --dest src'
      );

      expect(stdout).toContain('Generated');
      expect(stdout).toContain('Injected');

      const routesFile = path.join(testDir, 'src', 'routes.ts');
      const content = await fs.readFile(routesFile, 'utf8');
      expect(content).toContain('user);
    });

    it('should skip injection when content already exists', async () => {
      // First injection
      await execAsync('node ../../dist/cli.mjs generate route add user --dest src');

      // Second injection (should be skipped)
      const { stdout } = await execAsync(
        'node ../../dist/cli.mjs generate route add user --dest src'
      );

      expect(stdout).toContain('Skipped');
      expect(stdout).toContain('already exists');
    });
  });

  describe('performance', () => {
    it('should handle large number of templates efficiently', async () => {
      // Create 50 templates
      for (let i = 0; i < 50; i++) {
        await createTestGenerator('component', `template${i}`);
      }

      const startTime = Date.now();
      const { stdout } = await execAsync('node ../../dist/cli.mjs list');
      const endTime = Date.now();

      expect(stdout).toContain('component');
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should generate multiple files quickly', async () => {
      await createMultiFileGenerator('feature', 'full-stack');

      const startTime = Date.now();
      const { stdout } = await execAsync(
        'node ../../dist/cli.mjs generate feature full-stack UserManager'
      );
      const endTime = Date.now();

      expect(stdout).toContain('Generated');
      expect(endTime - startTime).toBeLessThan(3000); // Should be reasonably fast
    });
  });

  // Helper functions
  async function createTestGenerator(generator, template, options = {}) { const generatorDir = path.join(templatesDir, generator);
    const templateDir = path.join(generatorDir, template);
    
    await fs.ensureDir(templateDir);

    // Create template file
    const templateContent = options.content || TemplateFactory.generateTemplateContent('component');
    const templateFile = path.join(templateDir, 'component.njk');
    
    await fs.writeFile(templateFile, `---
to);

    // Create config file if needed
    if (options.description || options.files) {
      const config = {
        description };
      await fs.writeFile(
        path.join(templateDir, 'config.json'),
        JSON.stringify(config, null, 2)
      );
    }
  }

  async function createMalformedGenerator(generator, template) { const templateDir = path.join(templatesDir, generator, template);
    await fs.ensureDir(templateDir);

    // Create malformed template
    const malformedContent = TemplateFactory.createMalformedTemplate();
    await fs.writeFile(
      path.join(templateDir, 'template.njk'),
      `---
to }`
    );
  }

  async function createInjectionGenerator(generator, template) { const templateDir = path.join(templatesDir, generator, template);
    await fs.ensureDir(templateDir);

    await fs.writeFile(
      path.join(templateDir, 'route.njk'),
      `---
to }}: '/{{ name }}'`
    );
  }

  async function createMultiFileGenerator(generator, template) { const templateDir = path.join(templatesDir, generator, template);
    await fs.ensureDir(templateDir);

    // Create multiple template files
    const templates = [
      { name }}' },
      { name }}' },
      { name }}' },
      { name }}' }
    ];

    for (const template of templates) { await fs.writeFile(
        path.join(templateDir, template.name),
        `---
to }}.${template.name.split('.')[0]}
---
${template.content}`
      );
    }
  }
});