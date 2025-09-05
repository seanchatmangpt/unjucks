import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHelper, setupTestEnvironment, cleanupTestEnvironment } from '../helpers/test-helper.js';
import { CLICommandBuilder, TestDataBuilder } from '../support/builders.js';

describe('CLI Integration Tests', () => {
  let helper: TestHelper;

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
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No generators found');
    });

    it('should list available generators', async () => {
      // Arrange
      await helper.createDirectory('_templates/component');
      await helper.createDirectory('_templates/service');
      await helper.createFile('_templates/component/index.ejs', 'Component template');
      await helper.createFile('_templates/service/index.ejs', 'Service template');

      // Act
      const result = await helper.runCli('list');

      // Assert
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('component');
      expect(result.stdout).toContain('service');
    });

    it('should handle nested generator structures', async () => {
      // Arrange
      await helper.createDirectory('_templates/frontend/component');
      await helper.createDirectory('_templates/backend/service');
      await helper.createFile('_templates/frontend/component/index.ejs', 'Frontend component');
      await helper.createFile('_templates/backend/service/index.ejs', 'Backend service');

      // Act
      const result = await helper.runCli('list');

      // Assert
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('frontend/component');
      expect(result.stdout).toContain('backend/service');
    });
  });

  describe('unjucks help command', () => {
    it('should show general help without arguments', async () => {
      // Act
      const result = await helper.runCli('help');

      // Assert
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('generate');
    });

    it('should show specific generator help', async () => {
      // Arrange
      const templateWithVars = `---
variables:
  name:
    description: Component name
    type: string
    required: true
  withProps:
    description: Include props interface
    type: boolean
    default: false
---
export const <%= name %> = () => {};`;

      await helper.createDirectory('_templates/component');
      await helper.createFile('_templates/component/index.ejs', templateWithVars);

      // Act
      const result = await helper.runCli('help component');

      // Assert
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('component');
      expect(result.stdout).toContain('--name');
      expect(result.stdout).toContain('--withProps');
      expect(result.stdout).toContain('Component name');
    });

    it('should handle nonexistent generator help', async () => {
      // Act
      const result = await helper.runCli('help nonexistent');

      // Assert
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Generator "nonexistent" not found');
    });
  });

  describe('unjucks generate command', () => {
    it('should generate simple template', async () => {
      // Arrange
      const template = `---
to: src/<%= name %>.ts
---
export const <%= name %> = '<%= name %>';`;

      await helper.createDirectory('_templates/simple');
      await helper.createFile('_templates/simple/index.ejs', template);

      // Act
      const command = new CLICommandBuilder()
        .command('generate simple')
        .withFlag('name', 'TestComponent')
        .build();

      const result = await helper.runCli(command);

      // Assert
      expect(result.exitCode).toBe(0);
      expect(await helper.fileExists('src/TestComponent.ts')).toBe(true);

      const content = await helper.readFile('src/TestComponent.ts');
      expect(content).toContain("export const TestComponent = 'TestComponent';");
    });

    it('should handle multiple files in generator', async () => {
      // Arrange
      await helper.createDirectory('_templates/fullstack');
      
      await helper.createFile('_templates/fullstack/component.tsx.ejs', `---
to: src/components/<%= name %>.tsx
---
export const <%= name %> = () => <div><%= name %></div>;`);

      await helper.createFile('_templates/fullstack/service.ts.ejs', `---
to: src/services/<%= name %>Service.ts
---
export class <%= name %>Service {}`);

      // Act
      const result = await helper.runCli('generate fullstack --name User');

      // Assert
      expect(result.exitCode).toBe(0);
      expect(await helper.fileExists('src/components/User.tsx')).toBe(true);
      expect(await helper.fileExists('src/services/UserService.ts')).toBe(true);
    });

    it('should validate required parameters', async () => {
      // Arrange
      const template = `---
variables:
  name:
    required: true
    type: string
to: src/<%= name %>.ts
---
export const <%= name %> = true;`;

      await helper.createDirectory('_templates/validation');
      await helper.createFile('_templates/validation/index.ejs', template);

      // Act
      const result = await helper.runCli('generate validation');

      // Assert
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('required');
      expect(result.stderr).toContain('name');
    });

    it('should handle dry run mode', async () => {
      // Arrange
      const template = `---
to: src/<%= name %>.ts
---
export const <%= name %> = true;`;

      await helper.createDirectory('_templates/dryrun');
      await helper.createFile('_templates/dryrun/index.ejs', template);

      // Act
      const result = await helper.runCli('generate dryrun --name Test --dry');

      // Assert
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[DRY RUN]');
      expect(result.stdout).toContain('would create');
      expect(result.stdout).toContain('src/Test.ts');
      expect(await helper.fileExists('src/Test.ts')).toBe(false);
    });

    it('should handle force mode for existing files', async () => {
      // Arrange
      const template = `---
to: existing.txt
---
New content`;

      await helper.createFile('existing.txt', 'Original content');
      await helper.createDirectory('_templates/force');
      await helper.createFile('_templates/force/index.ejs', template);

      // Act without force - should fail
      const resultNoForce = await helper.runCli('generate force');
      expect(resultNoForce.exitCode).not.toBe(0);

      // Act with force - should succeed
      const resultForce = await helper.runCli('generate force --force');
      expect(resultForce.exitCode).toBe(0);

      const content = await helper.readFile('existing.txt');
      expect(content).toContain('New content');
    });
  });

  describe('unjucks init command', () => {
    it('should initialize new project with example templates', async () => {
      // Act
      const result = await helper.runCli('init');

      // Assert
      expect(result.exitCode).toBe(0);
      expect(await helper.directoryExists('_templates')).toBe(true);
      expect(await helper.fileExists('_templates/component/index.ejs')).toBe(true);
    });

    it('should handle existing templates directory', async () => {
      // Arrange
      await helper.createDirectory('_templates');
      await helper.createFile('_templates/existing.txt', 'existing');

      // Act
      const result = await helper.runCli('init');

      // Assert
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('already exists');
      expect(await helper.fileExists('_templates/existing.txt')).toBe(true); // Should not overwrite
    });

    it('should handle force initialization', async () => {
      // Arrange
      await helper.createDirectory('_templates');
      await helper.createFile('_templates/old.txt', 'old content');

      // Act
      const result = await helper.runCli('init --force');

      // Assert
      expect(result.exitCode).toBe(0);
      expect(await helper.fileExists('_templates/component/index.ejs')).toBe(true);
    });
  });

  describe('Complex CLI Integration Scenarios', () => {
    it('should handle nested template with multiple variables', async () => {
      // Arrange
      const complexTemplate = `---
to: src/<%= module %>/<%= name %><%= suffix %>.ts
variables:
  module:
    type: string
    required: true
  name:
    type: string
    required: true
  suffix:
    type: string
    default: "Component"
  withTests:
    type: boolean
    default: false
---
// Generated <%= name %><%= suffix %>
export class <%= name %><%= suffix %> {
  constructor() {
    console.log('<%= module %>/<%= name %><%= suffix %> created');
  }
}

<% if (withTests) { %>
// Test suite for <%= name %><%= suffix %>
describe('<%= name %><%= suffix %>', () => {
  it('should create instance', () => {
    const instance = new <%= name %><%= suffix %>();
    expect(instance).toBeDefined();
  });
});
<% } %>`;

      await helper.createDirectory('_templates/advanced');
      await helper.createFile('_templates/advanced/class.ejs', complexTemplate);

      // Act
      const data = new TestDataBuilder()
        .withVariable('module', 'user')
        .withVariable('name', 'Profile')
        .withVariable('withTests', true)
        .build();

      const command = new CLICommandBuilder()
        .command('generate advanced')
        .withVariables(data)
        .build();

      const result = await helper.runCli(command);

      // Assert
      expect(result.exitCode).toBe(0);
      expect(await helper.fileExists('src/user/ProfileComponent.ts')).toBe(true);

      const content = await helper.readFile('src/user/ProfileComponent.ts');
      expect(content).toContain('export class ProfileComponent');
      expect(content).toContain('user/ProfileComponent created');
      expect(content).toContain('describe(\'ProfileComponent\'');
    });

    it('should handle injection scenarios', async () => {
      // Arrange - Create target file
      await helper.createFile('src/routes.ts', `
// Routes configuration
import express from 'express';
const router = express.Router();

// ROUTES_INJECT_HERE

export default router;
`);

      // Create injection template
      const injectionTemplate = `---
inject: true
after: "// ROUTES_INJECT_HERE"
to: src/routes.ts
---
router.get('/<%= path %>', <%= handler %>Controller.<%= action %>);`;

      await helper.createDirectory('_templates/route');
      await helper.createFile('_templates/route/inject.ejs', injectionTemplate);

      // Act
      const result = await helper.runCli('generate route --path users --handler User --action getAll');

      // Assert
      expect(result.exitCode).toBe(0);

      const content = await helper.readFile('src/routes.ts');
      expect(content).toContain("router.get('/users', UserController.getAll);");
      expect(content).toContain('// ROUTES_INJECT_HERE'); // Should preserve marker
    });

    it('should handle error recovery and cleanup', async () => {
      // Arrange - Template with intentional error
      const brokenTemplate = `---
to: src/broken.ts
---
This will cause an error: <%= undefinedVariable.property %>`;

      await helper.createDirectory('_templates/broken');
      await helper.createFile('_templates/broken/error.ejs', brokenTemplate);

      // Act
      const result = await helper.runCli('generate broken');

      // Assert
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('undefinedVariable');
      expect(await helper.fileExists('src/broken.ts')).toBe(false); // Should not create partial files
    });

    it('should handle concurrent generation attempts', async () => {
      // Arrange
      const template = `---
to: concurrent-<%= id %>.txt
---
Content for <%= id %>`;

      await helper.createDirectory('_templates/concurrent');
      await helper.createFile('_templates/concurrent/test.ejs', template);

      // Act - Run multiple generations concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        helper.runCli(`generate concurrent --id ${i}`)
      );

      const results = await Promise.all(promises);

      // Assert
      for (const [i, result] of results.entries()) {
        expect(result.exitCode).toBe(0);
      }

      // Verify all files were created
      for (let i = 0; i < 5; i++) {
        expect(await helper.fileExists(`concurrent-${i}.txt`)).toBe(true);
      }
    });
  });

  describe('CLI Error Handling', () => {
    it('should handle invalid commands gracefully', async () => {
      // Act
      const result = await helper.runCli('invalidcommand');

      // Assert
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Unknown command');
    });

    it('should validate flag formats', async () => {
      // Arrange
      await helper.createDirectory('_templates/flagtest');
      await helper.createFile('_templates/flagtest/index.ejs', 'test');

      // Act
      const result = await helper.runCli('generate flagtest --invalid-flag-format=');

      // Assert - Should handle gracefully, even with malformed flags
      expect(result.exitCode).toBe(0); // CLI should handle empty values
    });

    it('should provide helpful error messages', async () => {
      // Act
      const result = await helper.runCli('generate nonexistent');

      // Assert
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Generator "nonexistent" not found');
      expect(result.stderr).toContain('Available generators:');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle large template files efficiently', async () => {
      // Arrange
      const largeContent = 'Line <%= i %>\n'.repeat(1000);
      await helper.createDirectory('_templates/large');
      await helper.createFile('_templates/large/big.ejs', `---
to: large-output.txt
---
${largeContent}`);

      // Act
      const startTime = Date.now();
      const result = await helper.runCli('generate large --i 42');
      const duration = Date.now() - startTime;

      // Assert
      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(await helper.fileExists('large-output.txt')).toBe(true);
    });

    it('should clean up temporary resources', async () => {
      // This test would verify that no temporary files or resources leak
      // Implementation depends on how the CLI manages temporary state
      
      // Arrange
      const template = `---
to: cleanup-test.txt
---
Temporary content`;

      await helper.createDirectory('_templates/cleanup');
      await helper.createFile('_templates/cleanup/index.ejs', template);

      // Act
      await helper.runCli('generate cleanup');

      // Assert - Verify cleanup (implementation specific)
      expect(await helper.fileExists('cleanup-test.txt')).toBe(true);
      // Additional cleanup verification would go here
    });
  });
});