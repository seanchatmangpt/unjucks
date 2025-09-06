import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHelper } from '../support/TestHelper.js';
import * as os from 'node:os';
import * as path from 'node:path';

describe('CLI Validation Integration Tests', () => {
  let testHelper: TestHelper;
  let testDir: string;

  beforeEach(async () => {
    // Create unique temporary directory for each test
    testDir = path.join(os.tmpdir(), `unjucks-test-${Date.now()}-${Math.random().toString(36)}`);
    testHelper = new TestHelper(testDir);
    
    // Setup validation test templates
    await testHelper.createStructuredTemplates([
      // Simple validation template
      { type: 'directory', path: 'simple' },
      { type: 'directory', path: 'simple/test' },
      {
        type: 'file',
        path: 'simple/test/file.txt',
        frontmatter: 'to: "output/{{ name }}.txt"',
        content: 'Hello {{ name }}!'
      },

      // Complex validation template
      { type: 'directory', path: 'complex' },
      { type: 'directory', path: 'complex/validation' },
      {
        type: 'file',
        path: 'complex/validation/{{ className | pascalCase }}.ts',
        frontmatter: 'to: "src/{{ module }}/{{ className | pascalCase }}.ts"',
        content: `export class {{ className | pascalCase }} {
  private {{ property | camelCase }}: {{ dataType }};
  
  constructor({{ property | camelCase }}: {{ dataType }}) {
    this.{{ property | camelCase }} = {{ property | camelCase }};
  }
  
  get{{ property | pascalCase }}(): {{ dataType }} {
    return this.{{ property | camelCase }};
  }
  
  set{{ property | pascalCase }}(value: {{ dataType }}): void {
    this.{{ property | camelCase }} = value;
  }
}`
      },

      // Skip condition template
      { type: 'directory', path: 'conditional' },
      { type: 'directory', path: 'conditional/skip' },
      {
        type: 'file',
        path: 'conditional/skip/optional.txt',
        frontmatter: `to: "optional/{{ name }}.txt"
skipIf: "{{ skipOptional }}"`,
        content: 'This file is optional: {{ name }}'
      },
      {
        type: 'file',
        path: 'conditional/skip/required.txt',
        frontmatter: `to: "required/{{ name }}.txt"
skipIf: "!{{ includeRequired }}"`,
        content: 'This file is required: {{ name }}'
      },

      // Injection validation template  
      { type: 'directory', path: 'inject' },
      { type: 'directory', path: 'inject/append' },
      {
        type: 'file',
        path: 'inject/append/content.md',
        frontmatter: `to: "docs/{{ filename }}.md"
inject: true
append: true
skipIf: "!{{ shouldAppend }}"`,
        content: `## {{ title }}

{{ content }}

Added: {{ new Date().toISOString() }}
`
      }
    ]);

    // Create package.json to establish project root
    await testHelper.createFile('package.json', JSON.stringify({
      name: 'validation-test-project',
      version: '1.0.0'
    }));
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Template Discovery Validation', () => {
    it('should successfully discover all test templates', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('list');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('simple');
        expect(result.stdout).toContain('complex');
        expect(result.stdout).toContain('conditional');
        expect(result.stdout).toContain('inject');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should validate template help generation', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('help simple test');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Help for simple/test');
        expect(result.stdout).toContain('name');
        expect(result.stdout).toContain('Usage Examples');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle help for complex templates', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('help complex validation');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Help for complex/validation');
        expect(result.stdout).toContain('className');
        expect(result.stdout).toContain('module');
        expect(result.stdout).toContain('property');
        expect(result.stdout).toContain('dataType');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Parameter Validation', () => {
    it('should validate simple template generation', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('simple test World');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Generated');

        const fileExists = await testHelper.fileExists('output/World.txt');
        expect(fileExists).toBe(true);

        const content = await testHelper.readFile('output/World.txt');
        expect(content).toBe('Hello World!');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should validate complex multi-parameter template', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('complex validation UserService --module=services --property=username --dataType=string');

        expect(result.exitCode).toBe(0);

        const fileExists = await testHelper.fileExists('src/services/UserService.ts');
        expect(fileExists).toBe(true);

        const content = await testHelper.readFile('src/services/UserService.ts');
        expect(content).toContain('export class UserService');
        expect(content).toContain('private username: string');
        expect(content).toContain('constructor(username: string)');
        expect(content).toContain('getUsername(): string');
        expect(content).toContain('setUsername(value: string): void');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should validate boolean parameter handling', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test with skipOptional=true (should skip optional file)
        const result1 = await testHelper.runCli('conditional skip TestFile --skipOptional=true --includeRequired=true');
        expect(result1.exitCode).toBe(0);

        const optionalExists = await testHelper.fileExists('optional/TestFile.txt');
        const requiredExists = await testHelper.fileExists('required/TestFile.txt');
        
        expect(optionalExists).toBe(false); // Should be skipped
        expect(requiredExists).toBe(true);  // Should be included

        // Clean up for next test
        await testHelper.removeFile('required/TestFile.txt');

        // Test with skipOptional=false (should include optional file)
        const result2 = await testHelper.runCli('conditional skip TestFile2 --skipOptional=false --includeRequired=true');
        expect(result2.exitCode).toBe(0);

        const optionalExists2 = await testHelper.fileExists('optional/TestFile2.txt');
        const requiredExists2 = await testHelper.fileExists('required/TestFile2.txt');
        
        expect(optionalExists2).toBe(true);  // Should be included
        expect(requiredExists2).toBe(true);  // Should be included
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('File Generation Validation', () => {
    it('should validate file output paths', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('simple test ValidationTest');

        expect(result.exitCode).toBe(0);

        // Verify correct path generation
        const expectedPath = 'output/ValidationTest.txt';
        const fileExists = await testHelper.fileExists(expectedPath);
        expect(fileExists).toBe(true);

        // Verify directory was created
        const dirExists = await testHelper.directoryExists('output');
        expect(dirExists).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should validate nested path generation', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('complex validation NestedClass --module=utils/helpers --property=data --dataType=any[]');

        expect(result.exitCode).toBe(0);

        const fileExists = await testHelper.fileExists('src/utils/helpers/NestedClass.ts');
        expect(fileExists).toBe(true);

        // Verify nested directories were created
        const dirExists = await testHelper.directoryExists('src/utils/helpers');
        expect(dirExists).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should validate file content rendering', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('complex validation DataProcessor --module=processors --property=config --dataType="Record<string, any>"');

        expect(result.exitCode).toBe(0);

        const content = await testHelper.readFile('src/processors/DataProcessor.ts');
        expect(content).toContain('export class DataProcessor');
        expect(content).toContain('private config: Record<string, any>');
        expect(content).toContain('constructor(config: Record<string, any>)');
        expect(content).toContain('getConfig(): Record<string, any>');
        expect(content).toContain('setConfig(value: Record<string, any>): void');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Injection Validation', () => {
    it('should validate file injection with append', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Create initial file
        await testHelper.createFile('docs/features.md', `# Features

## Existing Feature
This feature already exists.
`);

        // Test injection
        const result = await testHelper.runCli('inject append NewFeature --filename=features --title="Awesome Feature" --content="This feature is awesome!" --shouldAppend=true');

        expect(result.exitCode).toBe(0);

        const content = await testHelper.readFile('docs/features.md');
        expect(content).toContain('# Features');
        expect(content).toContain('## Existing Feature');
        expect(content).toContain('## Awesome Feature');
        expect(content).toContain('This feature is awesome!');
        expect(content).toContain('Added:');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should validate skipIf condition in injection', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Create initial file
        await testHelper.createFile('docs/notes.md', `# Notes

## Initial Note
Starting content.
`);

        // Test with shouldAppend=false (should skip)
        const result1 = await testHelper.runCli('inject append SkipTest --filename=notes --title="Should Skip" --content="This should be skipped" --shouldAppend=false');

        expect(result1.exitCode).toBe(0);
        expect(result1.stdout).toContain('Skipping') || expect(result1.stdout).toContain('skipped');

        const content1 = await testHelper.readFile('docs/notes.md');
        expect(content1).not.toContain('Should Skip');
        expect(content1).not.toContain('This should be skipped');

        // Test with shouldAppend=true (should not skip)
        const result2 = await testHelper.runCli('inject append NoSkipTest --filename=notes --title="Should Not Skip" --content="This should be included" --shouldAppend=true');

        expect(result2.exitCode).toBe(0);

        const content2 = await testHelper.readFile('docs/notes.md');
        expect(content2).toContain('Should Not Skip');
        expect(content2).toContain('This should be included');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Error Handling Validation', () => {
    it('should handle invalid template name', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('nonexistent template TestName');

        expect(result.exitCode).toBe(1);
        expect(result.stderr || result.stdout).toContain('not found');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle invalid generator name', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('simple nonexistent TestName');

        expect(result.exitCode).toBe(1);
        expect(result.stderr || result.stdout).toContain('not found');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle missing required parameters gracefully', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test without providing required parameters - should either prompt or error gracefully
        const result = await testHelper.runCli('complex validation');

        expect([0, 1]).toContain(result.exitCode);
        // Should either succeed with prompts or fail with helpful error
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Dry Run Validation', () => {
    it('should validate dry run output without file creation', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('simple test DryRunTest --dry');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Dry run');
        expect(result.stdout).toContain('output/DryRunTest.txt');

        // Verify no files were created
        const fileExists = await testHelper.fileExists('output/DryRunTest.txt');
        expect(fileExists).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should validate complex dry run output', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('complex validation DryRunClass --module=test --property=value --dataType=string --dry');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Dry run');
        expect(result.stdout).toContain('src/test/DryRunClass.ts');

        // Verify no files or directories were created
        const fileExists = await testHelper.fileExists('src/test/DryRunClass.ts');
        const dirExists = await testHelper.directoryExists('src/test');
        
        expect(fileExists).toBe(false);
        expect(dirExists).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Force Mode Validation', () => {
    it('should validate force overwrite behavior', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // First generation
        const result1 = await testHelper.runCli('simple test ForceTest');
        expect(result1.exitCode).toBe(0);

        // Modify the file
        const originalContent = await testHelper.readFile('output/ForceTest.txt');
        await testHelper.createFile('output/ForceTest.txt', 'Modified: ' + originalContent);

        // Force overwrite
        const result2 = await testHelper.runCli('simple test ForceTest --force');
        expect(result2.exitCode).toBe(0);

        // Verify original content is restored
        const newContent = await testHelper.readFile('output/ForceTest.txt');
        expect(newContent).toBe('Hello ForceTest!');
        expect(newContent).not.toContain('Modified:');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Template Integration Consistency', () => {
    it('should consistently process all templates', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test all templates to ensure they work
        const results = await Promise.all([
          testHelper.runCli('simple test ConsistencyTest1'),
          testHelper.runCli('complex validation ConsistencyTest2 --module=test --property=data --dataType=string'),
          testHelper.runCli('conditional skip ConsistencyTest3 --skipOptional=false --includeRequired=true')
        ]);

        // All should succeed
        results.forEach((result, index) => {
          expect(result.exitCode).toBe(0);
        });

        // Verify files were created
        const files = [
          'output/ConsistencyTest1.txt',
          'src/test/ConsistencyTest2.ts',
          'optional/ConsistencyTest3.txt',
          'required/ConsistencyTest3.txt'
        ];

        for (const file of files) {
          const exists = await testHelper.fileExists(file);
          expect(exists).toBe(true);
        }
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle rapid sequential operations', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Rapid fire multiple operations
        const commands = [
          'simple test Rapid1',
          'simple test Rapid2',
          'simple test Rapid3',
          'simple test Rapid4',
          'simple test Rapid5'
        ];

        const startTime = Date.now();
        const results = await Promise.all(
          commands.map(cmd => testHelper.runCli(cmd))
        );
        const endTime = Date.now();

        // All should succeed
        results.forEach(result => {
          expect(result.exitCode).toBe(0);
        });

        // Should complete reasonably quickly (under 30 seconds)
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(30000);

        // All files should exist
        for (let i = 1; i <= 5; i++) {
          const exists = await testHelper.fileExists(`output/Rapid${i}.txt`);
          expect(exists).toBe(true);
        }
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});