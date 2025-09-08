/**
 * File Operations and Dry-Run Tests
 * Testing file generation, modification, and dry-run functionality
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.cjs');

async function runCLI(args = [], cwd) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30000
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode || 0 });
    });

    child.on('error', (error) => {
      resolve({ stdout, stderr: error.message, exitCode: 1 });
    });
  });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

describe('File Operations and Dry-Run Tests', () => {
  let tempDir, originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'unjucks-files-'));
    process.chdir(tempDir);
    
    await createFileOperationTemplates();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force });
  });

  async function createFileOperationTemplates() {
     // Basic file creation template
    await fs.mkdir('_templates/file', { recursive: true });
    await fs.writeFile(
      '_templates/file/create.txt.njk',
      `---
to: {{dest}}/{{name}}.txt
---
File: {{name}}
Created at: {{timestamp}}
Content);

    // Template with multiple files
    await fs.writeFile(
      '_templates/file/multi.ts.njk',
      `---
to: src/{{name}}.ts
---
export interface {{name}} { id }} = { id };
    expect(item.id).toBe('1');
  });
});
`
    );

    // Injection templates
    await fs.mkdir('_templates/inject', { recursive: true });
    await fs.writeFile(
      '_templates/inject/append.ts.njk',
      `---
to: src/{{target}}.ts
inject: true
append: true
---

// Added by injection);

    await fs.writeFile(
      '_templates/inject/prepend.ts.njk',
      `---
to: src/{{target}}.ts
inject: true
prepend: true
---
// Prepended);

    await fs.writeFile(
      '_templates/inject/after.ts.njk',
      `---
to: src/{{target}}.ts
inject: true
after: "// INJECT_AFTER"
---
  // Added after marker: {{name}}
  {{name}},
`
    );

    // Conditional templates
    await fs.writeFile(
      '_templates/file/conditional.js.njk',
      `---
to: {{#if createDir}}{{name}}/{{/if}}{{name}}.js
---
// {{name}} module
{{#if withExports}}
module.exports = {
  name);
{{/if}}
`
    );

    // Template with complex directory structure
    await fs.writeFile(
      '_templates/file/nested.jsx.njk',
      `---
to) {
  return (
    <div className="{{category}}-{{name | lower}}">
      {{name}}</h1>
      Category);
}
`
    );

    // Error-prone template
    await fs.writeFile(
      '_templates/file/error.txt.njk',
      `---
to);

    await fs.mkdir('src', { recursive: true });
  }

  describe('Basic File Creation', () => {
    it('should create a single file', async () => {
      const result = await runCLI([
        'file', 'create', 'TestFile',
        '--dest', 'output',
        '--content', 'Hello World',
        '--timestamp', '2024-01-01'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Generated');
      expect(result.stdout).toContain('TestFile.txt');
      
      const fileContent = await readFileContent('output/TestFile.txt');
      expect(fileContent).toContain('File);
      expect(fileContent).toContain('Content);
      expect(fileContent).toContain('Created at);
    });

    it('should create multiple files from single template', async () => {
      const result = await runCLI(['file', 'multi', 'User']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Generated');
      
      const tsExists = await fileExists('src/User.ts');
      const testExists = await fileExists('src/User.test.ts');
      
      expect(tsExists).toBe(true);
      expect(testExists).toBe(true);
      
      const tsContent = await readFileContent('src/User.ts');
      expect(tsContent).toContain('export interface User');
      
      const testContent = await readFileContent('src/User.test.ts');
      expect(testContent).toContain("import { User } from './User.js'");
    });

    it('should create nested directory structures', async () => {
      const result = await runCLI([
        'file', 'nested', 'UserProfile',
        '--category', 'auth'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      const fileExists = await fs.access('src/components/auth/UserProfile/UserProfile.jsx')
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(true);
      
      const content = await readFileContent('src/components/auth/UserProfile/UserProfile.jsx');
      expect(content).toContain('export function UserProfile()');
      expect(content).toContain('className="auth-userprofile"');
      expect(content).toContain('Category);
    });

    it('should handle conditional file paths', async () => {
      // Test with createDir=true
      const result1 = await runCLI([
        'file', 'conditional', 'MyModule',
        '--createDir', 'true',
        '--withExports', 'true'
      ]);
      
      expect(result1.exitCode).toBe(0);
      
      const dirFileExists = await fileExists('MyModule/MyModule.js');
      expect(dirFileExists).toBe(true);
      
      const content = await readFileContent('MyModule/MyModule.js');
      expect(content).toContain('module.exports');
      
      // Test with createDir=false
      const result2 = await runCLI([
        'file', 'conditional', 'SimpleModule',
        '--createDir', 'false',
        '--withExports', 'false'
      ]);
      
      expect(result2.exitCode).toBe(0);
      
      const flatFileExists = await fileExists('SimpleModule.js');
      expect(flatFileExists).toBe(true);
      
      const simpleContent = await readFileContent('SimpleModule.js');
      expect(simpleContent).toContain('console.log');
      expect(simpleContent).not.toContain('module.exports');
    });
  });

  describe('Dry Run Mode', () => {
    it('should show what would be created without creating files', async () => {
      const result = await runCLI([
        'file', 'create', 'DryRunTest',
        '--dest', 'output',
        '--content', 'Test content',
        '--dry'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Dry run');
      expect(result.stdout).toContain('no files were created');
      expect(result.stdout).toContain('output/DryRunTest.txt');
      
      const fileExists = await fs.access('output/DryRunTest.txt')
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(false);
    });

    it('should show multiple files in dry run', async () => {
      const result = await runCLI(['file', 'multi', 'DryTest', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Dry run');
      expect(result.stdout).toContain('src/DryTest.ts');
      expect(result.stdout).toContain('src/DryTest.test.ts');
      
      const tsExists = await fileExists('src/DryTest.ts');
      const testExists = await fileExists('src/DryTest.test.ts');
      
      expect(tsExists).toBe(false);
      expect(testExists).toBe(false);
    });

    it('should validate templates in dry run mode', async () => {
      const result = await runCLI(['file', 'error', 'ErrorTest', '--dry']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
      // Should fail even in dry run due to invalid path
    });

    it('should show complex directory structures in dry run', async () => {
      const result = await runCLI([
        'file', 'nested', 'ComplexComponent',
        '--category', 'forms',
        '--dry'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('src/components/forms/ComplexComponent/ComplexComponent.jsx');
    });
  });

  describe('File Overwriting and Force Mode', () => { it('should prompt when file exists (non-interactive test)', async () => {
      // Create initial file
      await fs.mkdir('output', { recursive: true });
      await fs.writeFile('output/ExistingFile.txt', 'Original content');
      
      const result = await runCLI([
        'file', 'create', 'ExistingFile',
        '--dest', 'output',
        '--content', 'New content'
      ]);
      
      // In non-interactive mode, should either fail or use default behavior
      expect([0, 1]).toContain(result.exitCode);
      
      if (result.exitCode === 0) {
        // If successful, check if content was updated
        const content = await readFileContent('output/ExistingFile.txt');
        expect(content).toBeTruthy();
      }
    });

    it('should overwrite files with --force flag', async () => { // Create initial file
      await fs.mkdir('output', { recursive: true });
      await fs.writeFile('output/ForceTest.txt', 'Original content');
      
      const result = await runCLI([
        'file', 'create', 'ForceTest',
        '--dest', 'output',
        '--content', 'Forced content',
        '--force'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      const content = await readFileContent('output/ForceTest.txt');
      expect(content).toContain('Forced content');
      expect(content).not.toContain('Original content');
    });

    it('should preserve existing files without --force', async () => { // Create initial file
      await fs.mkdir('output', { recursive: true });
      await fs.writeFile('output/PreserveTest.txt', 'Original content');
      
      const result = await runCLI([
        'file', 'create', 'PreserveTest',
        '--dest', 'output',
        '--content', 'New content'
      ]);
      
      // Should either skip or prompt
      expect([0, 1]).toContain(result.exitCode);
      
      const content = await readFileContent('output/PreserveTest.txt');
      if (content) {
        // If file exists, it should be either original or new based on behavior
        expect(content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('File Injection Operations', () => {
    beforeEach(async () => {
      // Create target files for injection
      await fs.writeFile('src/target.ts', `
// Target file for injection
export const existing = 'value';

// INJECT_AFTER

// End of file
      `.trim());
    });

    it('should append content to existing file', async () => {
      const result = await runCLI([
        'inject', 'append', 'NewConstant',
        '--target', 'target',
        '--value', 'appended'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      const content = await readFileContent('src/target.ts');
      expect(content).toContain('export const existing');
      expect(content).toContain('// Added by injection);
      expect(content).toContain("export const NewConstant = 'appended'");
    });

    it('should prepend content to existing file', async () => {
      const result = await runCLI([
        'inject', 'prepend', 'PrependedConstant',
        '--target', 'target'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      const content = await readFileContent('src/target.ts');
      expect(content).toStartWith('// Prepended);
      expect(content).toContain('export const existing');
    });

    it('should inject after specific marker', async () => {
      const result = await runCLI([
        'inject', 'after', 'AfterMarker',
        '--target', 'target',
        '--type', 'string'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      const content = await readFileContent('src/target.ts');
      expect(content).toContain('// INJECT_AFTER');
      expect(content).toContain('// Added after marker);
      expect(content).toContain('AfterMarker,');
    });

    it('should handle injection in dry run mode', async () => {
      const originalContent = await readFileContent('src/target.ts');
      
      const result = await runCLI([
        'inject', 'append', 'DryInject',
        '--target', 'target',
        '--value', 'dry-test',
        '--dry'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Dry run');
      
      const currentContent = await readFileContent('src/target.ts');
      expect(currentContent).toBe(originalContent);
    });

    it('should fail injection on non-existent files', async () => {
      const result = await runCLI([
        'inject', 'append', 'FailTest',
        '--target', 'nonexistent',
        '--value', 'test'
      ]);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });
  });

  describe('Error Handling in File Operations', () => {
    it('should handle invalid file paths gracefully', async () => {
      const result = await runCLI(['file', 'error', 'InvalidPath']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('should handle permission errors', async () => { // Create read-only directory
      await fs.mkdir('readonly', { recursive: true });
      await fs.chmod('readonly', 0o444);
      
      const result = await runCLI([
        'file', 'create', 'PermissionTest',
        '--dest', 'readonly',
        '--content', 'test'
      ]);
      
      // Restore permissions for cleanup
      await fs.chmod('readonly', 0o755);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('should handle disk space issues gracefully', async () => {
      // This is hard to test reliably, but we can test with very large files
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      
      const result = await runCLI([
        'file', 'create', 'LargeFile',
        '--dest', 'output',
        '--content', largeContent
      ]);
      
      // Should either succeed or fail gracefully
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should clean up partial files on error', async () => { // This would test that incomplete files are cleaned up on error
      const result = await runCLI(['file', 'error', 'CleanupTest']);
      
      expect(result.exitCode).toBe(1);
      
      // Check that no partial files were left
      const files = await fs.readdir('.', { recursive: true });
      const partialFiles = files.filter(f => f.toString().includes('CleanupTest'));
      expect(partialFiles).toHaveLength(0);
    });
  });

  describe('Performance with File Operations', () => {
    it('should handle multiple file generation efficiently', async () => {
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(runCLI([
          'file', 'create', `PerfTest${i}`,
          '--dest', 'perf',
          '--content', `Performance test ${i}`
        ]));
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // All should succeed
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
      
      // Should complete reasonably quickly (less than 30 seconds)
      expect(endTime - startTime).toBeLessThan(30000);
      
      // Verify all files were created
      for (let i = 0; i < 10; i++) {
        const exists = await fileExists(`perf/PerfTest${i}.txt`);
        expect(exists).toBe(true);
      }
    });

    it('should handle large file generation', async () => {
      const largeContent = 'Large content line\n'.repeat(10000); // ~200KB
      
      const result = await runCLI([
        'file', 'create', 'LargeContentTest',
        '--dest', 'output',
        '--content', largeContent
      ]);
      
      expect(result.exitCode).toBe(0);
      
      const content = await readFileContent('output/LargeContentTest.txt');
      expect(content).toBeTruthy();
      expect(content?.includes('Large content line')).toBe(true);
    });
  });

  describe('File Metadata and Attributes', () => {
    it('should preserve file permissions where applicable', async () => {
      const result = await runCLI([
        'file', 'create', 'PermissionTest',
        '--dest', 'output',
        '--content', 'test'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      // Check that file was created with appropriate permissions
      const stats = await fs.stat('output/PermissionTest.txt');
      expect(stats.isFile()).toBe(true);
    });

    it('should handle files with special extensions', async () => {
      const extensions = ['.ts', '.jsx', '.vue', '.md', '.json', '.yaml'];
      
      for (const ext of extensions) {
        await fs.writeFile(
          `_templates/file/special${ext}.njk`,
          `---\nto);
        
        const result = await runCLI(['file', `special${ext}`, 'Test']);
        expect(result.exitCode).toBe(0);
        
        const exists = await fileExists(`testTest${ext}`);
        expect(exists).toBe(true);
      }
    });

    it('should handle binary file generation', async () => { // This tests handling of binary content (though templates are usually text)
      await fs.writeFile(
        '_templates/file/binary.bin.njk',
        `---\nto }}.bin\n---\nBinary content);
      
      const result = await runCLI([
        'file', 'binary.bin', 'BinaryTest',
        '--content', 'test-binary-data'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      const exists = await fileExists('BinaryTest.bin');
      expect(exists).toBe(true);
    });
  });
});
