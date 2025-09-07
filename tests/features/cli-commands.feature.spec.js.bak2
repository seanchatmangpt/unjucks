import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnjucksWorld } from '../support/world.js';

describe('CLI Commands Validation', () => {
  let world;

  beforeEach(async () => {
    world = new UnjucksWorld();
    await world.createTempDirectory();
  });

  afterEach(async () => {
    await world.cleanupTempDirectory();
  });

  describe('HYGEN-DELTA Claim, () => { it('should support generate command with dynamic CLI generation', async () => {
      // Create a template with variables to test auto-detection
      const templateContent = `---
to }}.ts"
---
export class {{ name | pascalCase }} {
  private {{ enabled }} = {{ withTests }};
  description = "{{ description }}";
}`;

      await world.helper.createDirectory('_templates/class/new');
      await world.helper.createFile('_templates/class/new/class.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate class new --name=UserService --enabled=true --withTests=false --description="User management service"');
      
      expect(result.exitCode).toBe(0);
      const files = await world.helper.listFiles();
      expect(files).toContain('src/UserService.ts');
      
      const content = await world.helper.readFile('src/UserService.ts');
      expect(content).toContain('export class UserService');
      expect(content).toContain('private true = false');
      expect(content).toContain('description = "User management service"');
    });

    it('should support list command with enhanced template discovery', async () => {
      // Create multiple generators to test listing
      await world.helper.createDirectory('_templates/component/new');
      await world.helper.createFile('_templates/component/new/component.ts', `---
to);
      
      await world.helper.createDirectory('_templates/service/api');
      await world.helper.createFile('_templates/service/api/service.ts', `---
to);
      
      const result = await world.helper.runCli('unjucks list');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('component');
      expect(result.stdout).toContain('service');
    });

    it('should support init command with project setup', async () => {
      const result = await world.helper.runCli('unjucks init --type=citty');
      
      expect(result.exitCode).toBe(0);
      
      // Verify initialization creates expected structure
      const templatesExists = await world.helper.fileExists('_templates');
      const configExists = await world.helper.fileExists('unjucks.yml') || await world.helper.fileExists('unjucks.config.ts');
      
      expect(templatesExists).toBe(true);
      expect(configExists).toBe(true);
    });

    it('should support help command with detailed information', async () => {
      const result = await world.helper.runCli('unjucks help');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('generate');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('init');
      expect(result.stdout).toContain('help');
    });

    it('should support version command', async () => {
      const result = await world.helper.runCli('unjucks version');
      
      expect(result.exitCode).toBe(0);
      // Should output version number
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should provide enhanced error messages for missing templates', async () => {
      const result = await world.helper.runCli('unjucks generate nonexistent template --name=test');
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr || result.stdout).toContain('not found');
    });
  });

  describe('HYGEN-DELTA Claim, () => { it('should infer variable types from template usage', async () => {
      const templateContent = `---
to }}.ts"
---
export class {{ name | pascalCase }} {
  enabled = {{ enabled | default(false) }};
  count = {{ count | default(0) }};
  items = [{{ items | join(', ') }}];
}`;

      await world.helper.createDirectory('_templates/typed/class');
      await world.helper.createFile('_templates/typed/class/class.ts', templateContent);
      
      // Test with correct types
      const result = await world.helper.runCli('unjucks generate typed class --name=TestClass --enabled=true --count=42 --items="a,b,c"');
      
      expect(result.exitCode).toBe(0);
      const content = await world.helper.readFile('src/TestClass.ts');
      expect(content).toContain('enabled = true');
      expect(content).toContain('count = 42');
    });
  });

  describe('HYGEN-DELTA Claim, () => { it('should handle missing required variables gracefully', async () => {
      const templateContent = `---
to }}.ts"
---
export const {{ name }} = "test";`;

      await world.helper.createDirectory('_templates/required/test');
      await world.helper.createFile('_templates/required/test/file.ts', templateContent);
      
      // Test with missing required variable
      const result = await world.helper.runCli('unjucks generate required test');
      
      // Should either prompt or error gracefully
      expect(result.exitCode === 0 || result.stderr?.includes('required')).toBe(true);
    });
  });
});