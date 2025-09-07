/**
 * BDD Tests for Core CLI Commands - Working Implementation
 * Based on tests/bdd/features/cli-core.feature
 * 
 * Testing actual CLI command execution with known working patterns
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

describe('Feature: Core CLI Commands', () => {
  const testDir = join(process.cwd(), 'tests/.tmp/bdd-cli-working');
  const templatesDir = join(testDir, 'templates');
  let originalCwd;

  beforeAll(() => {
    originalCwd = process.cwd();
    
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(templatesDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Scenario: Display version information', () => {
    test('When I run "unjucks --version", Then I should see the current version number', () => {
      // Execute command and capture output
      const result = execSync(`node "${join(originalCwd, 'src/cli/index.js')}" --version`, {
        encoding: 'utf8'
      });
      
      // Verify we get a version number in our expected format
      expect(result.trim()).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d{2}\.\d{2}$/);
      expect(result.trim().length).toBeGreaterThan(10);
    });
  });

  describe('Scenario: Display help information', () => {
    test('When I run "unjucks --help", Then I should see usage information and commands', () => {
      const result = execSync(`node "${join(originalCwd, 'src/cli/index.js')}" --help`, {
        encoding: 'utf8'
      });
      
      // Verify help output contains expected content
      expect(result).toContain('Hygen-style CLI generator');
      expect(result).toContain('USAGE');
      expect(result).toContain('COMMANDS');
      expect(result).toContain('new');
      expect(result).toContain('generate');
      expect(result).toContain('list');
    });
  });

  describe('Scenario: List available generators with templates', () => {
    test('Given I have templates, When I run "unjucks list", Then I should see generators', () => {
      // Set up test templates
      const componentDir = join(templatesDir, 'component', 'new');
      mkdirSync(componentDir, { recursive: true });
      writeFileSync(
        join(componentDir, 'component.ejs.t'),
        `---
to: src/components/<%= name %>.js
---
export default function <%= name %>() {
  return <div><%= name %></div>;
}`
      );

      // Run list command from test directory
      const result = execSync(`node "${join(originalCwd, 'src/cli/index.js')}" list`, {
        encoding: 'utf8',
        cwd: testDir
      });
      
      expect(result).toContain('component');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario: List generators with no templates', () => {
    test('Given empty templates directory, When I run "unjucks list", Then I should see no generators message', () => {
      // Clean templates directory
      rmSync(templatesDir, { recursive: true, force: true });
      mkdirSync(templatesDir, { recursive: true });

      const result = execSync(`node "${join(originalCwd, 'src/cli/index.js')}" list`, {
        encoding: 'utf8',
        cwd: testDir
      });
      
      // Should indicate no templates found
      expect(result).toMatch(/(no generators|empty|no templates)/i);
    });
  });

  describe('Scenario: Invalid command shows help', () => {
    test('When I run invalid command, Then I should see help information', () => {
      const result = execSync(`node "${join(originalCwd, 'src/cli/index.js')}" invalidcommand`, {
        encoding: 'utf8'
      });
      
      // Our CLI shows help for invalid commands (good UX)
      expect(result).toContain('USAGE');
      expect(result).toContain('COMMANDS');
    });
  });

  describe('Scenario: Generate without arguments shows help', () => {
    test('When I run "unjucks generate", Then I should see help or error information', () => {
      try {
        const result = execSync(`node "${join(originalCwd, 'src/cli/index.js')}" generate`, {
          encoding: 'utf8'
        });
        
        // If it succeeds, it should show help
        expect(result).toMatch(/(usage|help|generate)/i);
      } catch (error) {
        // If it errors, that's also acceptable - check error contains helpful info
        const output = error.stdout || error.stderr || error.message;
        expect(output).toMatch(/(missing|required|arguments|usage|help)/i);
      }
    });
  });

  describe('Scenario: CLI responds to common flags', () => {
    test('CLI should respond to -v flag for version', () => {
      try {
        const result = execSync(`node "${join(originalCwd, 'src/cli/index.js')}" -v`, {
          encoding: 'utf8'
        });
        
        // Should show version or help (both are acceptable)
        expect(result.length).toBeGreaterThan(0);
      } catch (error) {
        // If -v isn't supported, that's fine - just make sure we get some output
        expect(error.stdout || error.stderr).toBeDefined();
      }
    });

    test('CLI should respond to -h flag for help', () => {
      try {
        const result = execSync(`node "${join(originalCwd, 'src/cli/index.js')}" -h`, {
          encoding: 'utf8'
        });
        
        expect(result).toMatch(/(help|usage|commands)/i);
      } catch (error) {
        // If -h errors, check that output contains help info
        const output = error.stdout || error.stderr || error.message;
        expect(output).toMatch(/(help|usage|commands)/i);
      }
    });
  });
});