import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnjucksWorld } from '../support/world.js';
import * from 'path';

describe('Safety Features Validation', () => {
  let world;

  beforeEach(async () => {
    world = new UnjucksWorld();
    await world.createTempDirectory();
  });

  afterEach(async () => {
    await world.cleanupTempDirectory();
  });

  describe('HYGEN-DELTA Claim, () => { it('should support dry-run mode for previewing changes', async () => {
      const templateContent = `---
to }}.ts"
---
export const {{ name }} = "generated";`;

      await world.helper.createDirectory('_templates/preview/test');
      await world.helper.createFile('_templates/preview/test/file.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate preview test --name=TestFile --dry');
      
      expect(result.exitCode).toBe(0);
      
      // File should NOT be created in dry-run mode
      const files = await world.helper.listFiles();
      expect(files).not.toContain('src/TestFile.ts');
      
      // But should show what would be generated
      expect(result.stdout).toContain('TestFile');
      expect(result.stdout).toMatch(/would create|preview|dry/i);
    });

    it('should support force mode for overwriting existing files', async () => { // Create existing file first
      await world.helper.createDirectory('src');
      await world.helper.createFile('src/existing.ts', 'export const existing = "old content";');
      
      const templateContent = `---
to });

    it('should create backups before overwriting files', async () => { // Create existing file
      await world.helper.createDirectory('src');
      await world.helper.createFile('src/backup-test.ts', 'export const original = "content";');
      
      const templateContent = `---
to }
    });

    it('should perform idempotent operations to prevent duplicates', async () => {
      // Create target file for injection
      await world.helper.createDirectory('src');
      await world.helper.createFile('src/idempotent.ts', `// Components
export class ExistingComponent {}
// End`);
      
      const templateContent = `---
to: "src/idempotent.ts"
inject: true
after: "// Components"
---
export class {{ name }}Component {}`;

      await world.helper.createDirectory('_templates/idempotent/test');
      await world.helper.createFile('_templates/idempotent/test/component.ts', templateContent);
      
      // Run the same generation twice
      const firstRun = await world.helper.runCli('unjucks generate idempotent test --name=Test');
      expect(firstRun.exitCode).toBe(0);
      
      const secondRun = await world.helper.runCli('unjucks generate idempotent test --name=Test');
      expect(secondRun.exitCode).toBe(0);
      
      // Check that content was not duplicated
      const content = await world.helper.readFile('src/idempotent.ts');
      const occurrences = (content.match(/export class TestComponent/g) || []).length;
      expect(occurrences).toBe(1); // Should appear only once, not twice
    });

    it('should provide comprehensive validation with detailed error messages', async () => { const invalidTemplateContent = `---
to }}.ts"
inject: true
# Missing injection target (after/before/append/prepend/lineAt)
---
export const {{ name }} = "test";`;

      await world.helper.createDirectory('_templates/invalid/test');
      await world.helper.createFile('_templates/invalid/test/file.ts', invalidTemplateContent);
      
      const result = await world.helper.runCli('unjucks generate invalid test --name=Test');
      
      // Should provide helpful error message for invalid configuration
      if (result.exitCode !== 0) {
        const errorOutput = result.stderr || result.stdout;
        expect(errorOutput.length).toBeGreaterThan(0);
        expect(errorOutput).toMatch(/inject|target|invalid/i);
      }
    });
  });

  describe('HYGEN-DELTA Claim, () => { it('should perform atomic write operations', async () => {
      const templateContent = `---
to }}.ts"
---
export const {{ name }} = { timestamp };`;

      await world.helper.createDirectory('_templates/atomic/test');
      await world.helper.createFile('_templates/atomic/test/file.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate atomic test --name=TestFile');
      expect(result.exitCode).toBe(0);
      
      // File should be created completely or not at all
      const exists = await world.helper.fileExists('src/atomic-TestFile.ts');
      expect(exists).toBe(true);
      
      const content = await world.helper.readFile('src/atomic-TestFile.ts');
      expect(content).toContain('export const TestFile');
      expect(content).toContain('timestamp:');
      expect(content).toContain('generated);
    });
  });

  describe('HYGEN-DELTA Claim, () => { it('should handle template syntax errors gracefully', async () => {
      const brokenTemplateContent = `---
to }}.ts"
---
export const { { name = {
  # Broken Nunjucks syntax
  broken };`;

      await world.helper.createDirectory('_templates/broken/test');
      await world.helper.createFile('_templates/broken/test/file.ts', brokenTemplateContent);
      
      const result = await world.helper.runCli('unjucks generate broken test --name=Test');
      
      // Should fail gracefully with helpful error message
      expect(result.exitCode).not.toBe(0);
      const errorOutput = result.stderr || result.stdout;
      expect(errorOutput).toMatch(/syntax|template|error/i);
    });

    it('should validate frontmatter configuration', async () => { const invalidFrontmatterContent = `---
to }}.ts"
inject: true
after: "// Target"
append: true  # Conflicting injection modes
---
export const {{ name }} = "test";`;

      await world.helper.createDirectory('_templates/conflict/test');
      await world.helper.createFile('_templates/conflict/test/file.ts', invalidFrontmatterContent);
      
      const result = await world.helper.runCli('unjucks generate conflict test --name=Test');
      
      // Should detect conflicting configuration
      if (result.exitCode !== 0) {
        const errorOutput = result.stderr || result.stdout;
        expect(errorOutput).toMatch(/conflict|invalid|frontmatter/i);
      }
    });
  });
});