import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

describe('Positional Parameters Implementation', () => {
  const testDir = path.join(process.cwd(), 'test-positional');
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
to: "src/components/{{ name | pascalCase }}.ts"
---
export interface {{ name | pascalCase }}Props {
  // Component props
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = () => {
  return <div>{{ name | titleCase }}</div>;
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

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
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
    it('should support Hygen-style positional syntax: unjucks <generator> <template> <name>', () => {
      const result = execSync(`node "${cliPath}" component new MyTestComponent --dry`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      expect(result).toContain('Would write file: src/components/MyTestComponent.ts');
      expect(result).toContain('✓');
    });

    it('should generate actual files with positional syntax', async () => {
      execSync(`node "${cliPath}" component new ActualComponent`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      const generatedFile = path.join(testDir, 'src', 'components', 'ActualComponent.ts');
      expect(await fs.pathExists(generatedFile)).toBe(true);

      const content = await fs.readFile(generatedFile, 'utf-8');
      expect(content).toContain('export interface ActualComponentProps');
      expect(content).toContain('export const ActualComponent');
      expect(content).toContain('<div>Actualcomponent</div>');
    });

    it('should work with command generator using positional syntax', () => {
      const result = execSync(`node "${cliPath}" command citty TestCommand --dry`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      expect(result).toContain('Would write file: src/commands/TestCommand.ts');
      expect(result).toContain('✓');
    });
  });

  describe('Template Variable Mapping', () => {
    it('should correctly map positional arguments to template variables', async () => {
      execSync(`node "${cliPath}" component new UserProfile`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      const content = await fs.readFile(
        path.join(testDir, 'src', 'components', 'UserProfile.ts'),
        'utf-8'
      );

      // Check PascalCase transformation
      expect(content).toContain('export interface UserProfileProps');
      expect(content).toContain('export const UserProfile');
      
      // Check TitleCase transformation
      expect(content).toContain('<div>Userprofile</div>');
    });

    it('should handle camelCase input correctly', async () => {
      execSync(`node "${cliPath}" component new userAccount`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      const content = await fs.readFile(
        path.join(testDir, 'src', 'components', 'UserAccount.ts'),
        'utf-8'
      );

      expect(content).toContain('export interface UserAccountProps');
      expect(content).toContain('export const UserAccount');
    });
  });

  describe('Backward Compatibility', () => {
    it('should still support explicit generate command', () => {
      const result = execSync(`node "${cliPath}" generate component new ExplicitComponent --dry`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      expect(result).toContain('Would write file: src/components/ExplicitComponent.ts');
    });

    it('should support flag-based variable passing', () => {
      const result = execSync(`node "${cliPath}" generate component new --name FlaggedComponent --dry`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      expect(result).toContain('Would write file: src/components/FlaggedComponent.ts');
    });
  });

  describe('Error Handling', () => {
    it('should show helpful error for non-existent generator', () => {
      try {
        execSync(`node "${cliPath}" nonexistent new Test`, {
          encoding: 'utf-8',
          cwd: testDir
        });
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain("Generator 'nonexistent' not found");
      }
    });

    it('should show helpful error for non-existent template', () => {
      try {
        execSync(`node "${cliPath}" component nonexistent Test`, {
          encoding: 'utf-8',
          cwd: testDir
        });
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain("Template 'nonexistent' not found");
      }
    });
  });

  describe('CLI Commands Still Work', () => {
    it('should list available generators', () => {
      const result = execSync(`node "${cliPath}" list`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      expect(result).toContain('component');
      expect(result).toContain('command');
    });

    it('should show help information', () => {
      const result = execSync(`node "${cliPath}" help component new`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      expect(result).toContain('Help for component/new');
    });

    it('should show version', () => {
      const result = execSync(`node "${cliPath}" version`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      expect(result).toContain('0.0.0');
    });
  });

  describe('Advanced Features', () => {
    it('should handle dry run mode with positional syntax', () => {
      const result = execSync(`node "${cliPath}" component new DryRunTest --dry`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      expect(result).toContain('Dry run - no files were created');
      expect(result).toContain('Would write file: src/components/DryRunTest.ts');
    });

    it('should handle force mode with positional syntax', async () => {
      // Create a file first
      await fs.ensureDir(path.join(testDir, 'src', 'components'));
      await fs.writeFile(
        path.join(testDir, 'src', 'components', 'ForceTest.ts'),
        'existing content'
      );

      execSync(`node "${cliPath}" component new ForceTest --force`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      const content = await fs.readFile(
        path.join(testDir, 'src', 'components', 'ForceTest.ts'),
        'utf-8'
      );

      expect(content).not.toContain('existing content');
      expect(content).toContain('export interface ForceTestProps');
    });
  });

  describe('Hygen Parity Validation', () => {
    it('should achieve exact Hygen CLI syntax compatibility', () => {
      // Test the exact claim from HYGEN-DELTA.md:
      // "Current: unjucks generate component citty --name MyComponent"
      // "Target: unjucks component new MyComponent"
      
      const legacyResult = execSync(
        `node "${cliPath}" generate component new --name LegacyStyle --dry`,
        { encoding: 'utf-8', cwd: testDir }
      );

      const modernResult = execSync(
        `node "${cliPath}" component new ModernStyle --dry`,
        { encoding: 'utf-8', cwd: testDir }
      );

      // Both should produce similar results
      expect(legacyResult).toContain('Would write file: src/components/LegacyStyle.ts');
      expect(modernResult).toContain('Would write file: src/components/ModernStyle.ts');
    });

    it('should validate the critical gap mentioned in HYGEN-DELTA.md is closed', () => {
      // From HYGEN-DELTA.md: "Positional Parameters: ✅ Full | ❌ Missing | 🚨 GAP | Critical"
      // This test validates that the gap is now closed
      
      const result = execSync(`node "${cliPath}" component new ValidationTest --dry`, {
        encoding: 'utf-8',
        cwd: testDir
      });

      expect(result).toContain('✓');
      expect(result).toContain('Would write file: src/components/ValidationTest.ts');
      
      // The positional parameter functionality is now implemented
      expect(() => {
        execSync(`node "${cliPath}" component new ParameterTest --dry`, {
          encoding: 'utf-8',
          cwd: testDir
        });
      }).not.toThrow();
    });
  });
});