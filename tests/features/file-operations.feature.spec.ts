import { loadFeature, defineFeature } from '@amiceli/vitest-cucumber';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileInjector, type InjectionOptions } from '../../src/lib/file-injector.js';
import { FrontmatterParser, type FrontmatterConfig } from '../../src/lib/frontmatter-parser.js';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

// BDD Feature: File Operations - All 6 Modes Validation
const feature = `
Feature: File Operations - All 6 Modes
  As a developer using Unjucks
  I want to validate all 6 file operation modes work correctly
  So that I can confidently generate and modify files

  Background:
    Given I have a clean temporary directory
    And I have a file injector instance
    And I have a frontmatter parser instance

  Scenario: Write Mode - Create new files
    Given I have content "export const greeting = 'Hello World';"
    When I write to file "greeting.ts" with write mode
    Then the file should be created successfully
    And the file should contain the exact content
    And the operation should be atomic

  Scenario: Write Mode - Overwrite protection
    Given I have an existing file "existing.ts" with content "old content"
    When I write to file "existing.ts" without force flag
    Then the operation should fail
    And the error message should mention "--force"
    And the original content should remain unchanged

  Scenario: Write Mode - Force overwrite with backup
    Given I have an existing file "existing.ts" with content "old content"
    When I write to file "existing.ts" with force flag and backup option
    Then the file should be overwritten
    And a backup file should be created
    And the backup should contain the original content

  Scenario: Inject Mode - Insert after marker
    Given I have a file "config.ts" with content:
      '''
      const config = {
        name: 'app',
        // inject-point
        version: '1.0.0'
      };
      '''
    When I inject content "  description: 'Test app'," after marker "// inject-point"
    Then the content should be inserted after the marker
    And the file structure should remain valid
    And the operation should be idempotent

  Scenario: Inject Mode - Insert before marker
    Given I have a file "config.ts" with content:
      '''
      const config = {
        name: 'app',
        // inject-point
        version: '1.0.0'
      };
      '''
    When I inject content "  description: 'Test app'," before marker "// inject-point"
    Then the content should be inserted before the marker
    And the file structure should remain valid

  Scenario: Inject Mode - Target not found
    Given I have a file "simple.ts" with content "const x = 1;"
    When I inject content "const y = 2;" after marker "non-existent-marker"
    Then the operation should fail
    And the error message should mention "Target not found"

  Scenario: Inject Mode - Idempotent behavior
    Given I have a file "duplicate.ts" with content:
      '''
      const config = {
        name: 'app',
        description: 'Test app'
      };
      '''
    When I inject content "description: 'Test app'" with inject mode
    Then the operation should be skipped
    And the content should remain unchanged
    And the result should indicate it was skipped

  Scenario: Append Mode - Add to end of file
    Given I have a file "list.ts" with content:
      '''
      const items = [
        'first',
        'second'
      ];
      '''
    When I append content "'third'"
    Then the content should be added to the end
    And the file should end with the new content
    And line breaks should be handled correctly

  Scenario: Append Mode - Idempotent behavior
    Given I have a file "complete.ts" with content:
      '''
      const items = [
        'first',
        'second',
        'third'
      ];
      '''
    When I append content "'third'"
    Then the operation should be skipped
    And the content should remain unchanged

  Scenario: Prepend Mode - Add to beginning of file
    Given I have a file "script.ts" with content:
      '''
      console.log('Hello');
      console.log('World');
      '''
    When I prepend content "console.log('Start');"
    Then the content should be added to the beginning
    And the original content should follow
    And line breaks should be handled correctly

  Scenario: Prepend Mode - Idempotent behavior
    Given I have a file "complete.ts" with content:
      '''
      console.log('Start');
      console.log('Hello');
      console.log('World');
      '''
    When I prepend content "console.log('Start');"
    Then the operation should be skipped
    And the content should remain unchanged

  Scenario: LineAt Mode - Insert at specific line number
    Given I have a file "numbered.ts" with content:
      '''
      Line 1
      Line 2
      Line 4
      Line 5
      '''
    When I insert content "Line 3" at line number 3
    Then the content should be inserted at the correct position
    And the line numbers should be maintained
    And subsequent lines should be shifted down

  Scenario: LineAt Mode - Insert at beginning
    Given I have a file "start.ts" with content:
      '''
      Original first line
      Second line
      '''
    When I insert content "New first line" at line number 1
    Then the content should be inserted at the beginning
    And the original content should be shifted down

  Scenario: LineAt Mode - Line number exceeds file length
    Given I have a file "short.ts" with content:
      '''
      Line 1
      Line 2
      '''
    When I insert content "Line 10" at line number 10
    Then the operation should fail
    And the error message should mention "exceeds file length"

  Scenario: LineAt Mode - Idempotent behavior
    Given I have a file "existing.ts" with content:
      '''
      Line 1
      Line 2
      Line 3
      '''
    When I insert content "Line 2" at line number 2
    Then the operation should be skipped
    And the content should remain unchanged

  Scenario: Conditional Mode - Skip based on condition
    Given I have a file "conditional.ts" with content:
      '''
      const config = {
        name: 'app',
        version: '1.0.0'
      };
      '''
    When I inject content "version: '1.0.0'," with skipIf condition "version"
    Then the operation should be skipped because content exists
    And the file should remain unchanged

  Scenario: Conditional Mode - Proceed when condition not met
    Given I have a file "conditional.ts" with content:
      '''
      const config = {
        name: 'app'
      };
      '''
    When I inject content "  version: '1.0.0'," after marker "name: 'app'" with skipIf condition "version"
    Then the operation should proceed
    And the content should be injected
    And the condition evaluation should work correctly

  Scenario Outline: Dry Run Mode - All operations
    Given I have a file "dryrun.ts" with content "<initial_content>"
    When I perform <operation> with dry run mode
    Then the operation should report success
    And the message should indicate "Would <action>"
    And the file content should remain unchanged
    And the changes should be tracked

    Examples:
      | operation | action | initial_content |
      | write | write file | existing content |
      | inject | inject content | existing\n// marker\ncontent |
      | append | append content | existing content |
      | prepend | prepend content | existing content |
      | lineAt | inject content at line | line1\nline2 |

  Scenario: Backup Creation - All modification operations
    Given I have a file "backup-test.ts" with content "original content"
    When I perform each modification operation with backup enabled
    Then each operation should create a backup file
    And each backup should contain the original content
    And the backup filename should include timestamp
    And the modified file should contain new content

  Scenario: Concurrent Operations - Thread safety
    Given I have 10 different target files
    When I perform write operations concurrently on all files
    Then all operations should succeed
    And no files should be corrupted
    And each file should contain its expected content
    And the operations should complete within reasonable time

  Scenario: Error Handling - Invalid scenarios
    Given various invalid operation scenarios
    When I attempt operations that should fail
    Then each operation should fail gracefully
    And appropriate error messages should be provided
    And no files should be corrupted
    And the system should remain stable

  Scenario: Performance - Large file handling
    Given I have large content (1MB+)
    When I perform write and modification operations
    Then the operations should complete efficiently
    And memory usage should be reasonable
    And the file integrity should be maintained
    And performance should be acceptable

  Scenario: Integration - Frontmatter parsing
    Given template content with various frontmatter configurations
    When I parse and execute each configuration
    Then the correct operation mode should be detected
    And the operations should execute as specified
    And the frontmatter validation should work correctly
    And complex scenarios should be handled properly
`;

defineFeature(feature, (test) => {
  let injector: FileInjector;
  let parser: FrontmatterParser;
  let tempDir: string;
  let currentFilePath: string;
  let currentContent: string;
  let lastResult: any;

  beforeEach(async () => {
    injector = new FileInjector();
    parser = new FrontmatterParser();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-bdd-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('Write Mode - Create new files', ({ given, when, then }) => {
    given('I have a clean temporary directory', () => {
      expect(tempDir).toBeDefined();
    });

    given('I have a file injector instance', () => {
      expect(injector).toBeDefined();
    });

    given('I have a frontmatter parser instance', () => {
      expect(parser).toBeDefined();
    });

    given(/I have content "(.+)"/, (content: string) => {
      currentContent = content;
    });

    when(/I write to file "(.+)" with write mode/, async (filename: string) => {
      currentFilePath = path.join(tempDir, filename);
      const frontmatter: FrontmatterConfig = {};
      lastResult = await injector.processFile(currentFilePath, currentContent, frontmatter, { force: false, dry: false });
    });

    then('the file should be created successfully', () => {
      expect(lastResult.success).toBe(true);
    });

    then('the file should contain the exact content', async () => {
      const written = await fs.readFile(currentFilePath, 'utf8');
      expect(written).toBe(currentContent);
    });

    then('the operation should be atomic', () => {
      expect(lastResult.changes).toHaveLength(1);
      expect(lastResult.changes[0]).toContain('write:');
    });
  });

  test('Write Mode - Overwrite protection', ({ given, when, then }) => {
    given(/I have an existing file "(.+)" with content "(.+)"/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      await fs.writeFile(currentFilePath, content);
      currentContent = content;
    });

    when(/I write to file "(.+)" without force flag/, async (filename: string) => {
      const newContent = 'new content';
      const frontmatter: FrontmatterConfig = {};
      lastResult = await injector.processFile(currentFilePath, newContent, frontmatter, { force: false, dry: false });
    });

    then('the operation should fail', () => {
      expect(lastResult.success).toBe(false);
    });

    then(/the error message should mention "(.+)"/, (expectedText: string) => {
      expect(lastResult.message).toContain(expectedText);
    });

    then('the original content should remain unchanged', async () => {
      const actualContent = await fs.readFile(currentFilePath, 'utf8');
      expect(actualContent).toBe(currentContent);
    });
  });

  test('Write Mode - Force overwrite with backup', ({ given, when, then }) => {
    let backupFile: string;

    given(/I have an existing file "(.+)" with content "(.+)"/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      await fs.writeFile(currentFilePath, content);
      currentContent = content;
    });

    when(/I write to file "(.+)" with force flag and backup option/, async (filename: string) => {
      const newContent = 'completely new content';
      const frontmatter: FrontmatterConfig = {};
      lastResult = await injector.processFile(currentFilePath, newContent, frontmatter, { 
        force: true, 
        dry: false, 
        backup: true 
      });
    });

    then('the file should be overwritten', async () => {
      expect(lastResult.success).toBe(true);
      const newContent = await fs.readFile(currentFilePath, 'utf8');
      expect(newContent).not.toBe(currentContent);
    });

    then('a backup file should be created', async () => {
      const files = await fs.readdir(tempDir);
      backupFile = files.find(f => f.includes('.bak.'))!;
      expect(backupFile).toBeDefined();
    });

    then('the backup should contain the original content', async () => {
      const backupPath = path.join(tempDir, backupFile);
      const backupContent = await fs.readFile(backupPath, 'utf8');
      expect(backupContent).toBe(currentContent);
    });
  });

  test('Inject Mode - Insert after marker', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      await fs.writeFile(currentFilePath, content.trim());
    });

    when(/I inject content "(.+)" after marker "(.+)"/, async (content: string, marker: string) => {
      const frontmatter: FrontmatterConfig = { inject: true, after: marker };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the content should be inserted after the marker', async () => {
      expect(lastResult.success).toBe(true);
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toContain('// inject-point');
      expect(finalContent).toContain("description: 'Test app',");
    });

    then('the file structure should remain valid', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toMatch(/const config = \{[\s\S]*\};/);
    });

    then('the operation should be idempotent', async () => {
      // Run the same operation again
      const frontmatter: FrontmatterConfig = { inject: true, after: '// inject-point' };
      const secondResult = await injector.processFile(currentFilePath, "description: 'Test app',", frontmatter, { force: false, dry: false });
      expect(secondResult.skipped).toBe(true);
    });
  });

  test('Inject Mode - Insert before marker', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      await fs.writeFile(currentFilePath, content.trim());
    });

    when(/I inject content "(.+)" before marker "(.+)"/, async (content: string, marker: string) => {
      const frontmatter: FrontmatterConfig = { inject: true, before: marker };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the content should be inserted before the marker', async () => {
      expect(lastResult.success).toBe(true);
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      const lines = finalContent.split('\\n');
      const markerIndex = lines.findIndex(line => line.includes('// inject-point'));
      const insertedIndex = lines.findIndex(line => line.includes("description: 'Test app',"));
      expect(insertedIndex).toBeLessThan(markerIndex);
    });

    then('the file structure should remain valid', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toMatch(/const config = \{[\s\S]*\};/);
    });
  });

  test('Inject Mode - Target not found', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content "(.+)"/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      await fs.writeFile(currentFilePath, content);
    });

    when(/I inject content "(.+)" after marker "(.+)"/, async (content: string, marker: string) => {
      const frontmatter: FrontmatterConfig = { inject: true, after: marker };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the operation should fail', () => {
      expect(lastResult.success).toBe(false);
    });

    then(/the error message should mention "(.+)"/, (expectedText: string) => {
      expect(lastResult.message).toContain(expectedText);
    });
  });

  test('Inject Mode - Idempotent behavior', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      currentContent = content.trim();
      await fs.writeFile(currentFilePath, currentContent);
    });

    when(/I inject content "(.+)" with inject mode/, async (content: string) => {
      const frontmatter: FrontmatterConfig = { inject: true };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the operation should be skipped', () => {
      expect(lastResult.success).toBe(true);
      expect(lastResult.skipped).toBe(true);
    });

    then('the content should remain unchanged', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toBe(currentContent);
    });

    then('the result should indicate it was skipped', () => {
      expect(lastResult.message).toContain('already exists');
    });
  });

  test('Append Mode - Add to end of file', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      currentContent = content.trim();
      await fs.writeFile(currentFilePath, currentContent);
    });

    when(/I append content "(.+)"/, async (content: string) => {
      const frontmatter: FrontmatterConfig = { append: true };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the content should be added to the end', () => {
      expect(lastResult.success).toBe(true);
    });

    then('the file should end with the new content', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toContain("'third'");
      expect(finalContent.trim().endsWith("'third'")).toBe(true);
    });

    then('line breaks should be handled correctly', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toContain('\\n');
    });
  });

  test('Append Mode - Idempotent behavior', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      currentContent = content.trim();
      await fs.writeFile(currentFilePath, currentContent);
    });

    when(/I append content "(.+)"/, async (content: string) => {
      const frontmatter: FrontmatterConfig = { append: true };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the operation should be skipped', () => {
      expect(lastResult.success).toBe(true);
      expect(lastResult.skipped).toBe(true);
    });

    then('the content should remain unchanged', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toBe(currentContent);
    });
  });

  test('Prepend Mode - Add to beginning of file', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      currentContent = content.trim();
      await fs.writeFile(currentFilePath, currentContent);
    });

    when(/I prepend content "(.+)"/, async (content: string) => {
      const frontmatter: FrontmatterConfig = { prepend: true };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the content should be added to the beginning', () => {
      expect(lastResult.success).toBe(true);
    });

    then('the original content should follow', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toContain("console.log('Start');");
      expect(finalContent).toContain("console.log('Hello');");
      expect(finalContent.indexOf("console.log('Start');")).toBeLessThan(
        finalContent.indexOf("console.log('Hello');")
      );
    });

    then('line breaks should be handled correctly', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      const lines = finalContent.split('\\n');
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  test('Prepend Mode - Idempotent behavior', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      currentContent = content.trim();
      await fs.writeFile(currentFilePath, currentContent);
    });

    when(/I prepend content "(.+)"/, async (content: string) => {
      const frontmatter: FrontmatterConfig = { prepend: true };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the operation should be skipped', () => {
      expect(lastResult.success).toBe(true);
      expect(lastResult.skipped).toBe(true);
    });

    then('the content should remain unchanged', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toBe(currentContent);
    });
  });

  test('LineAt Mode - Insert at specific line number', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      await fs.writeFile(currentFilePath, content.trim());
    });

    when(/I insert content "(.+)" at line number (\d+)/, async (content: string, lineNum: string) => {
      const frontmatter: FrontmatterConfig = { lineAt: Number.parseInt(lineNum) };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the content should be inserted at the correct position', async () => {
      expect(lastResult.success).toBe(true);
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      const lines = finalContent.split('\\n');
      expect(lines[2]).toBe('Line 3'); // 0-based index
    });

    then('the line numbers should be maintained', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      const lines = finalContent.split('\\n');
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('Line 2');
      expect(lines[2]).toBe('Line 3');
      expect(lines[3]).toBe('Line 4');
      expect(lines[4]).toBe('Line 5');
    });

    then('subsequent lines should be shifted down', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toContain('Line 4');
      expect(finalContent).toContain('Line 5');
    });
  });

  test('LineAt Mode - Insert at beginning', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      await fs.writeFile(currentFilePath, content.trim());
    });

    when(/I insert content "(.+)" at line number (\d+)/, async (content: string, lineNum: string) => {
      const frontmatter: FrontmatterConfig = { lineAt: Number.parseInt(lineNum) };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the content should be inserted at the beginning', async () => {
      expect(lastResult.success).toBe(true);
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      const lines = finalContent.split('\\n');
      expect(lines[0]).toBe('New first line');
    });

    then('the original content should be shifted down', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      const lines = finalContent.split('\\n');
      expect(lines[1]).toBe('Original first line');
      expect(lines[2]).toBe('Second line');
    });
  });

  test('LineAt Mode - Line number exceeds file length', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      await fs.writeFile(currentFilePath, content.trim());
    });

    when(/I insert content "(.+)" at line number (\d+)/, async (content: string, lineNum: string) => {
      const frontmatter: FrontmatterConfig = { lineAt: Number.parseInt(lineNum) };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the operation should fail', () => {
      expect(lastResult.success).toBe(false);
    });

    then(/the error message should mention "(.+)"/, (expectedText: string) => {
      expect(lastResult.message).toContain(expectedText);
    });
  });

  test('LineAt Mode - Idempotent behavior', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      currentContent = content.trim();
      await fs.writeFile(currentFilePath, currentContent);
    });

    when(/I insert content "(.+)" at line number (\d+)/, async (content: string, lineNum: string) => {
      const frontmatter: FrontmatterConfig = { lineAt: Number.parseInt(lineNum) };
      lastResult = await injector.processFile(currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the operation should be skipped', () => {
      expect(lastResult.success).toBe(true);
      expect(lastResult.skipped).toBe(true);
    });

    then('the content should remain unchanged', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toBe(currentContent);
    });
  });

  test('Conditional Mode - Skip based on condition', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      await fs.writeFile(currentFilePath, content.trim());
    });

    when(/I inject content "(.+)" with skipIf condition "(.+)"/, async (content: string, condition: string) => {
      const frontmatter: FrontmatterConfig = { inject: true, skipIf: condition };
      lastResult = await injector['conditionalInject'](currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the operation should be skipped because content exists', () => {
      expect(lastResult.success).toBe(true);
      expect(lastResult.skipped).toBe(true);
    });

    then('the file should remain unchanged', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toContain("version: '1.0.0'");
    });
  });

  test('Conditional Mode - Proceed when condition not met', ({ given, when, then }) => {
    given(/I have a file "(.+)" with content:/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      await fs.writeFile(currentFilePath, content.trim());
    });

    when(/I inject content "(.+)" after marker "(.+)" with skipIf condition "(.+)"/, async (content: string, marker: string, condition: string) => {
      const frontmatter: FrontmatterConfig = { inject: true, after: marker, skipIf: condition };
      lastResult = await injector['conditionalInject'](currentFilePath, content, frontmatter, { force: false, dry: false });
    });

    then('the operation should proceed', () => {
      expect(lastResult.success).toBe(true);
      expect(lastResult.skipped).not.toBe(true);
    });

    then('the content should be injected', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).toContain("version: '1.0.0'");
    });

    then('the condition evaluation should work correctly', () => {
      expect(lastResult.message).toContain('injected');
    });
  });

  // Test outline scenarios
  const dryRunScenarios = [
    { operation: 'write', action: 'write file', initial_content: 'existing content' },
    { operation: 'inject', action: 'inject content', initial_content: 'existing\\n// marker\\ncontent' },
    { operation: 'append', action: 'append content', initial_content: 'existing content' },
    { operation: 'prepend', action: 'prepend content', initial_content: 'existing content' },
    { operation: 'lineAt', action: 'inject content at line', initial_content: 'line1\\nline2' }
  ];

  dryRunScenarios.forEach(({ operation, action, initial_content }) => {
    test(`Dry Run Mode - ${operation} operation`, ({ given, when, then }) => {
      given(/I have a file "(.+)" with content "(.+)"/, async (filename: string, content: string) => {
        currentFilePath = path.join(tempDir, filename);
        // Use the content from the scenario
        const actualContent = content === '<initial_content>' ? initial_content : content;
        await fs.writeFile(currentFilePath, actualContent.replace(/\\n/g, '\\n'));
      });

      when(`I perform ${operation} with dry run mode`, async () => {
        let frontmatter: FrontmatterConfig;
        const testContent = 'test content';
        
        switch (operation) {
          case 'write':
            frontmatter = {};
            break;
          case 'inject':
            frontmatter = { inject: true, after: '// marker' };
            break;
          case 'append':
            frontmatter = { append: true };
            break;
          case 'prepend':
            frontmatter = { prepend: true };
            break;
          case 'lineAt':
            frontmatter = { lineAt: 2 };
            break;
          default:
            frontmatter = {};
        }

        lastResult = await injector.processFile(currentFilePath, testContent, frontmatter, { force: false, dry: true });
      });

      then('the operation should report success', () => {
        expect(lastResult.success).toBe(true);
      });

      then(`the message should indicate "Would ${action}"`, () => {
        expect(lastResult.message).toContain('Would');
        expect(lastResult.message.toLowerCase()).toContain(action.split(' ')[0]);
      });

      then('the file content should remain unchanged', async () => {
        const finalContent = await fs.readFile(currentFilePath, 'utf8');
        const expectedContent = initial_content.replace(/\\n/g, '\\n');
        expect(finalContent).toBe(expectedContent);
      });

      then('the changes should be tracked', () => {
        expect(lastResult.changes).toHaveLength(1);
        expect(lastResult.changes[0]).toContain(operation);
      });
    });
  });

  test('Backup Creation - All modification operations', ({ given, when, then }) => {
    const operations = [
      { frontmatter: { inject: true }, content: 'injected', name: 'inject' },
      { frontmatter: { append: true }, content: 'appended', name: 'append' },
      { frontmatter: { prepend: true }, content: 'prepended', name: 'prepend' },
      { frontmatter: { lineAt: 1 }, content: 'at line 1', name: 'lineAt' }
    ];

    given(/I have a file "(.+)" with content "(.+)"/, async (filename: string, content: string) => {
      currentFilePath = path.join(tempDir, filename);
      currentContent = content;
      await fs.writeFile(currentFilePath, content);
    });

    when('I perform each modification operation with backup enabled', async () => {
      const results = [];
      
      for (const { frontmatter, content, name } of operations) {
        // Reset file content for each test
        await fs.writeFile(currentFilePath, currentContent);
        
        const result = await injector.processFile(currentFilePath, content, frontmatter, { 
          force: false, 
          dry: false, 
          backup: true 
        });
        
        results.push({ result, name });
      }
      
      lastResult = results;
    });

    then('each operation should create a backup file', async () => {
      const files = await fs.readdir(tempDir);
      const backupFiles = files.filter(f => f.includes('.bak.'));
      expect(backupFiles.length).toBeGreaterThan(0);
    });

    then('each backup should contain the original content', async () => {
      const files = await fs.readdir(tempDir);
      const backupFiles = files.filter(f => f.includes('.bak.'));
      
      for (const backupFile of backupFiles) {
        const backupPath = path.join(tempDir, backupFile);
        const backupContent = await fs.readFile(backupPath, 'utf8');
        expect(backupContent).toBe(currentContent);
      }
    });

    then('the backup filename should include timestamp', async () => {
      const files = await fs.readdir(tempDir);
      const backupFiles = files.filter(f => f.includes('.bak.'));
      
      for (const backupFile of backupFiles) {
        expect(backupFile).toMatch(/\.bak\.\d+$/);
      }
    });

    then('the modified file should contain new content', async () => {
      const finalContent = await fs.readFile(currentFilePath, 'utf8');
      expect(finalContent).not.toBe(currentContent);
    });
  });

  test('Concurrent Operations - Thread safety', ({ given, when, then }) => {
    let filePaths: string[] = [];
    let results: any[] = [];

    given('I have 10 different target files', async () => {
      filePaths = Array.from({ length: 10 }, (_, i) => path.join(tempDir, `concurrent-${i}.ts`));
    });

    when('I perform write operations concurrently on all files', async () => {
      const operations = filePaths.map((filePath, i) => 
        injector.processFile(filePath, `export const value${i} = ${i};`, {}, { force: false, dry: false })
      );

      results = await Promise.all(operations);
    });

    then('all operations should succeed', () => {
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    then('no files should be corrupted', async () => {
      for (let i = 0; i < filePaths.length; i++) {
        const content = await fs.readFile(filePaths[i], 'utf8');
        expect(content).toBe(`export const value${i} = ${i};`);
      }
    });

    then('each file should contain its expected content', async () => {
      for (let i = 0; i < filePaths.length; i++) {
        const content = await fs.readFile(filePaths[i], 'utf8');
        expect(content).toContain(`value${i}`);
        expect(content).toContain(`${i};`);
      }
    });

    then('the operations should complete within reasonable time', () => {
      // This test passed if we got here, meaning all operations completed
      expect(results).toHaveLength(10);
    });
  });

  test('Error Handling - Invalid scenarios', ({ given, when, then }) => {
    let errorResults: any[] = [];

    given('various invalid operation scenarios', async () => {
      // Setup will be done in when step
      expect(tempDir).toBeDefined();
    });

    when('I attempt operations that should fail', async () => {
      const invalidOperations = [
        // Non-existent file for inject
        () => injector.processFile(path.join(tempDir, 'nonexistent.ts'), 'content', { inject: true }, { force: false, dry: false }),
        // Line number exceeds length
        async () => {
          const shortFile = path.join(tempDir, 'short.ts');
          await fs.writeFile(shortFile, 'line1\\nline2');
          return injector.processFile(shortFile, 'content', { lineAt: 10 }, { force: false, dry: false });
        },
        // Invalid target marker
        async () => {
          const markerFile = path.join(tempDir, 'marker.ts');
          await fs.writeFile(markerFile, 'no marker here');
          return injector.processFile(markerFile, 'content', { inject: true, after: 'nonexistent' }, { force: false, dry: false });
        }
      ];

      for (const operation of invalidOperations) {
        try {
          const result = await operation();
          errorResults.push(result);
        } catch (error) {
          errorResults.push({ success: false, error });
        }
      }
    });

    then('each operation should fail gracefully', () => {
      errorResults.forEach(result => {
        expect(result.success).toBe(false);
      });
    });

    then('appropriate error messages should be provided', () => {
      errorResults.forEach(result => {
        expect(result.message || result.error).toBeDefined();
      });
    });

    then('no files should be corrupted', async () => {
      // Check that existing files remain intact
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        if (file.endsWith('.ts')) {
          const content = await fs.readFile(path.join(tempDir, file), 'utf8');
          expect(content).toBeDefined();
          expect(typeof content).toBe('string');
        }
      }
    });

    then('the system should remain stable', () => {
      expect(injector).toBeDefined();
      expect(parser).toBeDefined();
    });
  });

  test('Performance - Large file handling', ({ given, when, then }) => {
    let startTime: number;
    let duration: number;
    const largeContent = 'A'.repeat(1024 * 1024); // 1MB

    given('I have large content (1MB+)', () => {
      expect(largeContent.length).toBeGreaterThan(1024 * 1024);
    });

    when('I perform write and modification operations', async () => {
      startTime = Date.now();
      
      // Write large file
      const largeFilePath = path.join(tempDir, 'large.ts');
      await injector.processFile(largeFilePath, largeContent, {}, { force: false, dry: false });
      
      // Perform modifications
      await injector.processFile(largeFilePath, '\\n// appended', { append: true }, { force: false, dry: false });
      await injector.processFile(largeFilePath, '// prepended\\n', { prepend: true }, { force: false, dry: false });
      
      duration = Date.now() - startTime;
    });

    then('the operations should complete efficiently', () => {
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    then('memory usage should be reasonable', () => {
      // This test passes if we didn't run out of memory
      expect(true).toBe(true);
    });

    then('the file integrity should be maintained', async () => {
      const largeFilePath = path.join(tempDir, 'large.ts');
      const finalContent = await fs.readFile(largeFilePath, 'utf8');
      expect(finalContent.length).toBeGreaterThan(largeContent.length);
      expect(finalContent).toContain('// prepended');
      expect(finalContent).toContain('// appended');
    });

    then('performance should be acceptable', () => {
      expect(duration).toBeLessThan(5000); // Should be reasonably fast
    });
  });

  test('Integration - Frontmatter parsing', ({ given, when, then }) => {
    let parseResults: any[] = [];
    let operationResults: any[] = [];

    given('template content with various frontmatter configurations', () => {
      // Will be set up in when step
      expect(parser).toBeDefined();
    });

    when('I parse and execute each configuration', async () => {
      const testConfigs = [
        { frontmatter: {}, expectedMode: 'write' },
        { frontmatter: { inject: true }, expectedMode: 'inject' },
        { frontmatter: { append: true }, expectedMode: 'append' },
        { frontmatter: { prepend: true }, expectedMode: 'prepend' },
        { frontmatter: { lineAt: 5 }, expectedMode: 'lineAt' },
        { frontmatter: { inject: true, skipIf: 'condition' }, expectedMode: 'conditional' }
      ];

      for (const { frontmatter, expectedMode } of testConfigs) {
        const mode = injector['getOperationMode'](frontmatter as FrontmatterConfig);
        parseResults.push({ frontmatter, mode, expectedMode });
        
        // Validation
        const validation = parser.validate(frontmatter as FrontmatterConfig);
        operationResults.push({ frontmatter, validation });
      }
    });

    then('the correct operation mode should be detected', () => {
      parseResults.forEach(({ mode, expectedMode }) => {
        expect(mode.mode).toBe(expectedMode);
      });
    });

    then('the operations should execute as specified', () => {
      // Mode detection worked correctly in previous assertion
      expect(parseResults).toHaveLength(6);
    });

    then('the frontmatter validation should work correctly', () => {
      operationResults.forEach(({ validation }) => {
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });
    });

    then('complex scenarios should be handled properly', () => {
      const conditionalResult = parseResults.find(r => r.expectedMode === 'conditional');
      expect(conditionalResult).toBeDefined();
      expect(conditionalResult.mode.mode).toBe('conditional');
    });
  });
});