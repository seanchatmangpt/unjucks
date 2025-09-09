import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHelper, setupTestEnvironment, cleanupTestEnvironment } from '../helpers/test-helper.js';

describe('CLI Integration Tests', () => {
  let helper;

  beforeEach(async () => {
    helper = await setupTestEnvironment();
    await helper.changeToTempDir();
  });

  afterEach(async () => {
    await cleanupTestEnvironment(helper);
  });

  describe('unjucks list command', () => {
    it('should show empty message when no generators exist', async () => {
      // Act
      const result = await helper.runCli('list');

      // Assert
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('No generators found');
    });

    it('should list available generators', async () => {
      // Arrange
      await helper.createFileStructure({
        '_templates/component/index.njk': 'Component template',
        '_templates/service/index.njk': 'Service template'
      });

      // Act
      const result = await helper.runCli('list');

      // Assert
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('component');
      expect(result.stdout).toContain('service');
    });

    it('should handle nested generator structures', async () => {
      // Arrange
      await helper.createFileStructure({
        '_templates/frontend/component/index.njk': 'Frontend component',
        '_templates/backend/service/index.njk': 'Backend service'
      });

      // Act
      const result = await helper.runCli('list');

      // Assert
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('frontend/component');
      expect(result.stdout).toContain('backend/service');
    });
  });

  describe('unjucks help command', () => {
    it('should show general help without arguments', async () => {
      // Act
      const result = await helper.runCli('help');

      // Assert
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage');
    });

    it('should show specific generator help', async () => {
      // Arrange
      const templateWithVars = `---
variables:
  - name: "Component name"
  - withProps: "Include props"
---
Template content`;

      await helper.createFileStructure({
        '_templates/component/index.njk': templateWithVars
      });

      // Act
      const result = await helper.runCli('help', ['component']);

      // Assert
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('component');
      expect(result.stdout).toContain('--name');
      expect(result.stdout).toContain('--withProps');
      expect(result.stdout).toContain('Component name');
    });

    it('should handle nonexistent generator help', async () => {
      // Act
      const result = await helper.runCli('help', ['nonexistent']);

      // Assert
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('Generator "nonexistent" not found');
    });
  });

  describe('unjucks generate command', () => {
    it('should generate simple template', async () => {
      // Arrange
      const template = `---
to: "{{ dest }}/{{ name }}.js"
---
export const {{ name }} = {};`;

      await helper.createFileStructure({
        '_templates/simple/index.njk': template
      });

      // Act
      const result = await helper.runCli('generate', ['simple', '--name', 'TestComponent', '--dest', 'src']);

      // Assert
      expect(result.code).toBe(0);
      expect(await helper.assertFileExists('src/TestComponent.js')).toBe(true);
    });

    it('should handle multiple files in generator', async () => {
      // Arrange
      await helper.createFileStructure({
        '_templates/fullstack/component.njk': `---
to: "{{ dest }}/components/{{ name }}.tsx"
---
export const {{ name }} = () => <div>{{ name }}</div>;`,
        '_templates/fullstack/service.njk': `---
to: "{{ dest }}/services/{{ name }}Service.ts"
---
export class {{ name }}Service {}`
      });

      // Act
      const result = await helper.runCli('generate', ['fullstack', '--name', 'User', '--dest', 'src']);

      // Assert
      expect(result.code).toBe(0);
      expect(await helper.assertFileExists('src/components/User.tsx')).toBe(true);
      expect(await helper.assertFileExists('src/services/UserService.ts')).toBe(true);
    });

    it('should validate required parameters', async () => {
      // Arrange
      const template = `---
variables:
  - name: { required: true, description: "Component name" }
to: "{{ dest }}/{{ name }}.js"
---
export const {{ name }} = {};`;

      await helper.createFileStructure({
        '_templates/required/index.njk': template
      });

      // Act
      const result = await helper.runCli('generate', ['required', '--dest', 'src']);

      // Assert
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('name');
      expect(result.stderr).toContain('required');
    });

    it('should handle dry run mode', async () => {
      // Arrange
      const template = `---
to: "{{ dest }}/{{ name }}.js"
---
export const {{ name }} = {};`;

      await helper.createFileStructure({
        '_templates/dry/index.njk': template
      });

      // Act
      const result = await helper.runCli('generate', ['dry', '--name', 'Test', '--dest', 'src', '--dry']);

      // Assert
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Would create');
      expect(await helper.assertFileExists('src/Test.js')).toBe(false);
    });

    it('should handle force mode for existing files', async () => {
      // Arrange
      const template = `---
to: "{{ dest }}/{{ name }}.js"
---
export const {{ name }} = {};`;

      await helper.createFileStructure({
        '_templates/force/index.njk': template,
        'src/Existing.js': 'existing content'
      });

      // Act
      const result = await helper.runCli('generate', ['force', '--name', 'Existing', '--dest', 'src', '--force']);

      // Assert
      expect(result.code).toBe(0);
      const content = await helper.readFileStructure();
      expect(content.src['Existing.js']).toContain('export const Existing');
    });
  });

  describe('unjucks init command', () => {
    it('should initialize new project with example templates', async () => {
      // Act
      const result = await helper.runCli('init');

      // Assert
      expect(result.code).toBe(0);
      expect(await helper.assertFileExists('_templates')).toBe(true);
    });

    it('should handle existing templates directory', async () => {
      // Arrange
      await helper.createFileStructure({
        '_templates/existing.txt': 'existing'
      });

      // Act
      const result = await helper.runCli('init');

      // Assert
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('already exists');
      expect(await helper.assertFileExists('_templates/existing.txt')).toBe(true);
    });

    it('should handle force initialization', async () => {
      // Arrange
      await helper.createFileStructure({
        '_templates/old.txt': 'old content'
      });

      // Act
      const result = await helper.runCli('init', ['--force']);

      // Assert
      expect(result.code).toBe(0);
    });
  });

  describe('CLI Error Handling', () => {
    it('should handle invalid commands gracefully', async () => {
      // Act
      const result = await helper.runCli('invalidcommand');

      // Assert
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('Unknown command');
    });

    it('should provide helpful error messages', async () => {
      // Act
      const result = await helper.runCli('generate', ['nonexistent']);

      // Assert
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('Generator "nonexistent" not found');
    });
  });
});