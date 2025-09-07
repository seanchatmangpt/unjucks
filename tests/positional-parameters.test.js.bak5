import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

describe('Positional Parameters Implementation', () => { const testDir = path.join(process.cwd(), 'test-positional');
  const templatesDir = path.join(testDir, '_templates');
  const cliPath = path.join(process.cwd(), 'dist', 'cli.mjs');

  beforeEach(async () => {
    // Create test directory structure
    await fs.ensureDir(templatesDir);
    process.chdir(testDir);

    // Create test component generator
    const componentDir = path.join(templatesDir, 'component', 'new');
    await fs.ensureDir(componentDir);
    
    await fs.writeFile(
      path.join(componentDir, 'component.ts'),
      `---
to }}.ts"
---
export interface {{ name | pascalCase }}Props {
  // Component props
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = () => {
  return {{ name | titleCase }}</div>;
};

export default {{ name | pascalCase }};`
    );

    // Create test command generator
    const commandDir = path.join(templatesDir, 'command', 'citty');
    await fs.ensureDir(commandDir);
    
    await fs.writeFile(
      path.join(commandDir, 'command.ts'),
      `---
to: "src/commands/{{ commandName | pascalCase }}.ts"
---
import { defineCommand } from "citty";

export const {{ commandName | pascalCase }}Command = defineCommand({ meta }}",
    description,
  },
  run() {
    console.log("Running {{ commandName }}");
  },
});`
    );
  });

  afterEach(async () => {
    process.chdir(process.cwd().replace(path.sep + 'test-positional', ''));
    await fs.remove(testDir);
  });

  describe('Basic Positional Syntax', () => {
    it('should support Hygen-style positional syntax, () => {
      const result = execSync(`node "${cliPath}" component new MyTestComponent --dry`, { encoding });

    it('should generate actual files with positional syntax', async () => {
      execSync(`node "${cliPath}" component new ActualComponent`, { encoding });

    it('should work with command generator using positional syntax', () => {
      const result = execSync(`node "${cliPath}" command citty TestCommand --dry`, { encoding });
  });

  describe('Template Variable Mapping', () => {
    it('should correctly map positional arguments to template variables', async () => {
      execSync(`node "${cliPath}" component new UserProfile`, { encoding });

    it('should handle camelCase input correctly', async () => {
      execSync(`node "${cliPath}" component new userAccount`, { encoding });
  });

  describe('Backward Compatibility', () => {
    it('should still support explicit generate command', () => {
      const result = execSync(`node "${cliPath}" generate component new ExplicitComponent --dry`, { encoding });

    it('should support flag-based variable passing', () => {
      const result = execSync(`node "${cliPath}" generate component new --name FlaggedComponent --dry`, { encoding });
  });

  describe('Error Handling', () => {
    it('should show helpful error for non-existent generator', () => {
      try {
        execSync(`node "${cliPath}" nonexistent new Test`, { encoding } catch (error) {
        expect(error.stdout || error.stderr).toContain("Generator 'nonexistent' not found");
      }
    });

    it('should show helpful error for non-existent template', () => {
      try {
        execSync(`node "${cliPath}" component nonexistent Test`, { encoding } catch (error) {
        expect(error.stdout || error.stderr).toContain("Template 'nonexistent' not found");
      }
    });
  });

  describe('CLI Commands Still Work', () => {
    it('should list available generators', () => {
      const result = execSync(`node "${cliPath}" list`, { encoding });

    it('should show help information', () => {
      const result = execSync(`node "${cliPath}" help component new`, { encoding });

    it('should show version', () => {
      const result = execSync(`node "${cliPath}" version`, { encoding });
  });

  describe('Advanced Features', () => {
    it('should handle dry run mode with positional syntax', () => {
      const result = execSync(`node "${cliPath}" component new DryRunTest --dry`, { encoding });

    it('should handle force mode with positional syntax', async () => {
      // Create a file first
      await fs.ensureDir(path.join(testDir, 'src', 'components'));
      await fs.writeFile(
        path.join(testDir, 'src', 'components', 'ForceTest.ts'),
        'existing content'
      );

      execSync(`node "${cliPath}" component new ForceTest --force`, { encoding });
  });

  describe('Hygen Parity Validation', () => { it('should achieve exact Hygen CLI syntax compatibility', () => {
      // Test the exact claim from HYGEN-DELTA.md }" generate component new --name LegacyStyle --dry`,
        { encoding }" component new ModernStyle --dry`,
        { encoding });

    it('should validate the critical gap mentioned in HYGEN-DELTA.md is closed', () => { // From HYGEN-DELTA.md }" component new ValidationTest --dry`, { encoding }" component new ParameterTest --dry`, { encoding }).not.toThrow();
    });
  });
});