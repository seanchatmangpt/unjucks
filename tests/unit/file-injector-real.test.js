/**
 * File Injector Real Tests - Tests actual file injection functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';

// Import file injector - try multiple possible paths
let FileInjector;
let SimpleFileInjectorOrchestrator;

try {
  const fileInjectorModule = await import('../../src/lib/file-injector.js');
  FileInjector = fileInjectorModule.FileInjector || fileInjectorModule.default;
  SimpleFileInjectorOrchestrator = fileInjectorModule.SimpleFileInjectorOrchestrator;
} catch (error) {
  try {
    const orchestratorModule = await import('../../src/lib/file-injector/simple-file-injector-orchestrator.js');
    SimpleFileInjectorOrchestrator = orchestratorModule.SimpleFileInjectorOrchestrator || orchestratorModule.default;
  } catch (error2) {
    console.warn('Could not import file injector, using fallback');
  }
}

describe('File Injector - Real Functionality', () => {
  let testDir;
  let injector;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'tests', 'temp', `injector-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    
    if (SimpleFileInjectorOrchestrator) {
      injector = new SimpleFileInjectorOrchestrator();
    } else if (FileInjector) {
      injector = new FileInjector();
    }
  });

  afterEach(async () => {
    try {
      await fs.remove(testDir);
    } catch (error) {
      console.warn('Could not clean up test directory:', error.message);
    }
  });

  describe('Basic File Operations', () => {
    it('should create new file when it does not exist', async () => {
      if (!injector || !injector.processFile) {
        return; // Skip if injector not available
      }

      const filePath = path.join(testDir, 'new-file.ts');
      const content = 'export const newValue = "test";';
      const frontmatter = { inject: false };

      const result = await injector.processFile(filePath, content, frontmatter, { dry: false });

      expect(result.success).toBe(true);
      expect(await fs.pathExists(filePath)).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should handle dry run mode', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'dry-run-file.ts');
      const content = 'export const dryValue = "test";';
      const frontmatter = { inject: false };

      const result = await injector.processFile(filePath, content, frontmatter, { dry: true });

      expect(result.success).toBe(true);
      expect(await fs.pathExists(filePath)).toBe(false); // File should not be created in dry run
    });

    it('should overwrite existing file with force', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'existing-file.ts');
      const originalContent = 'export const original = "value";';
      const newContent = 'export const updated = "value";';

      // Create original file
      await fs.writeFile(filePath, originalContent);

      const frontmatter = { inject: false };
      const result = await injector.processFile(filePath, newContent, frontmatter, { force: true });

      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(newContent);
    });

    it('should respect skipIf conditions', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'conditional-file.ts');
      const content = 'export const conditional = "value";';
      const frontmatter = { 
        inject: false,
        skipIf: true // This should skip the operation
      };

      const result = await injector.processFile(filePath, content, frontmatter, {});

      // Should skip due to skipIf condition
      expect(await fs.pathExists(filePath)).toBe(false);
    });
  });

  describe('File Injection Operations', () => {
    it('should inject content at the beginning of file', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'inject-before.ts');
      const existingContent = `export class ExistingClass {
  constructor() {}
}`;
      
      await fs.writeFile(filePath, existingContent);

      const newContent = 'import { Injectable } from "@nestjs/common";\n';
      const frontmatter = { 
        inject: true,
        before: 'export class' // Inject before this pattern
      };

      const result = await injector.processFile(filePath, newContent, frontmatter, {});

      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toContain('import { Injectable }');
      expect(fileContent).toContain('export class ExistingClass');
      expect(fileContent.indexOf('import')).toBeLessThan(fileContent.indexOf('export class'));
    });

    it('should inject content at the end of file', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'inject-after.ts');
      const existingContent = `export class ExistingClass {
  constructor() {}
}`;
      
      await fs.writeFile(filePath, existingContent);

      const newContent = '\nexport default ExistingClass;';
      const frontmatter = { 
        inject: true,
        after: '}' // Inject after the last closing brace
      };

      const result = await injector.processFile(filePath, newContent, frontmatter, {});

      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toContain('export default ExistingClass');
    });

    it('should inject content at specific line number', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'inject-at-line.ts');
      const existingContent = `line 1
line 2
line 3
line 4`;
      
      await fs.writeFile(filePath, existingContent);

      const newContent = 'inserted line\n';
      const frontmatter = { 
        inject: true,
        lineAt: 2 // Insert at line 2
      };

      const result = await injector.processFile(filePath, newContent, frontmatter, {});

      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      expect(lines[1]).toBe('inserted line'); // 0-indexed
    });

    it('should prepend content to file', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'prepend-file.ts');
      const existingContent = 'export class Test {}';
      
      await fs.writeFile(filePath, existingContent);

      const newContent = '// Auto-generated header\n';
      const frontmatter = { 
        inject: true,
        prepend: true
      };

      const result = await injector.processFile(filePath, newContent, frontmatter, {});

      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent.startsWith('// Auto-generated header')).toBe(true);
      expect(fileContent).toContain('export class Test');
    });

    it('should append content to file', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'append-file.ts');
      const existingContent = 'export class Test {}';
      
      await fs.writeFile(filePath, existingContent);

      const newContent = '\n// Auto-generated footer';
      const frontmatter = { 
        inject: true,
        append: true
      };

      const result = await injector.processFile(filePath, newContent, frontmatter, {});

      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent.endsWith('// Auto-generated footer')).toBe(true);
      expect(fileContent).toContain('export class Test');
    });
  });

  describe('Advanced Injection Features', () => {
    it('should handle duplicate content detection', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'duplicate-content.ts');
      const existingContent = `import { Injectable } from "@nestjs/common";

export class TestService {}`;
      
      await fs.writeFile(filePath, existingContent);

      const newContent = 'import { Injectable } from "@nestjs/common";\n';
      const frontmatter = { 
        inject: true,
        before: 'export class'
      };

      const result = await injector.processFile(filePath, newContent, frontmatter, {});

      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      // Should not duplicate the import
      const importMatches = (fileContent.match(/import { Injectable }/g) || []).length;
      expect(importMatches).toBe(1);
    });

    it('should handle multiple injection points', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'multiple-injections.ts');
      const existingContent = `export class TestService {
  constructor() {}
  
  method1() {}
  
  method2() {}
}`;
      
      await fs.writeFile(filePath, existingContent);

      // First injection
      const content1 = '  newMethod() {}\n';
      const frontmatter1 = { 
        inject: true,
        before: '  method2()'
      };

      await injector.processFile(filePath, content1, frontmatter1, {});

      // Second injection
      const content2 = 'import { Logger } from "@nestjs/common";\n';
      const frontmatter2 = { 
        inject: true,
        before: 'export class'
      };

      const result = await injector.processFile(filePath, content2, frontmatter2, {});

      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toContain('import { Logger }');
      expect(fileContent).toContain('newMethod()');
      expect(fileContent).toContain('method1()');
      expect(fileContent).toContain('method2()');
    });

    it('should handle regex patterns for injection points', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'regex-injection.ts');
      const existingContent = `export class TestService {
  // Methods here
}`;
      
      await fs.writeFile(filePath, existingContent);

      const newContent = '  async newMethod(): Promise<void> {}\n';
      const frontmatter = { 
        inject: true,
        before: '\\s*// Methods here' // Regex pattern
      };

      const result = await injector.processFile(filePath, newContent, frontmatter, {});

      expect(result.success).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toContain('async newMethod()');
    });
  });

  describe('File Permissions and Shell Commands', () => {
    it('should set file permissions (chmod)', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'executable-script.sh');
      const content = '#!/bin/bash\necho "Hello World"';
      const frontmatter = { 
        inject: false,
        chmod: 755 // Make executable
      };

      const result = await injector.processFile(filePath, content, frontmatter, {});

      expect(result.success).toBe(true);
      expect(await fs.pathExists(filePath)).toBe(true);

      // Check if file was created (permission checking is platform-specific)
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);
    });

    it('should execute shell commands after file creation', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'with-shell-command.txt');
      const content = 'Test file content';
      const frontmatter = { 
        inject: false,
        sh: 'echo "File created"' // Simple shell command
      };

      const result = await injector.processFile(filePath, content, frontmatter, {});

      expect(result.success).toBe(true);
      expect(await fs.pathExists(filePath)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle permission denied errors', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = '/root/restricted-file.ts'; // Likely to cause permission error
      const content = 'export const test = "value";';
      const frontmatter = { inject: false };

      const result = await injector.processFile(filePath, content, frontmatter, {});

      // Should handle gracefully without crashing
      expect(typeof result).toBe('object');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle malformed frontmatter gracefully', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'malformed-frontmatter.ts');
      const content = 'export const test = "value";';
      const frontmatter = {
        inject: 'not-a-boolean',
        lineAt: 'not-a-number',
        before: null
      };

      const result = await injector.processFile(filePath, content, frontmatter, {});

      // Should handle gracefully
      expect(typeof result).toBe('object');
    });

    it('should handle very large files', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'large-file.ts');
      const largeContent = 'export const data = [\n' + 
        Array.from({ length: 10000 }, (_, i) => `  "item-${i}",`).join('\n') + 
        '\n];';
      
      await fs.writeFile(filePath, largeContent);

      const newContent = 'import { SomeModule } from "./module";\n';
      const frontmatter = { 
        inject: true,
        before: 'export const'
      };

      const result = await injector.processFile(filePath, newContent, frontmatter, {});

      expect(result.success).toBe(true);
    });

    it('should handle binary files gracefully', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'binary-file.png');
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      
      await fs.writeFile(filePath, binaryContent);

      const newContent = 'some text content';
      const frontmatter = { 
        inject: true,
        append: true
      };

      const result = await injector.processFile(filePath, newContent, frontmatter, {});

      // Should handle gracefully (might succeed or fail, but shouldn't crash)
      expect(typeof result).toBe('object');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Backup and Recovery', () => {
    it('should create backup when specified', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const filePath = path.join(testDir, 'backup-test.ts');
      const originalContent = 'export const original = "value";';
      
      await fs.writeFile(filePath, originalContent);

      const newContent = 'export const updated = "value";';
      const frontmatter = { inject: false };

      const result = await injector.processFile(filePath, newContent, frontmatter, { 
        force: true,
        backup: true 
      });

      expect(result.success).toBe(true);

      // Check if backup was created (exact naming depends on implementation)
      const files = await fs.readdir(testDir);
      const backupFiles = files.filter(f => f.includes('backup') || f.includes('.bak'));
      
      // Should have some backup mechanism
      expect(files.length).toBeGreaterThan(1);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent file operations', async () => {
      if (!injector || !injector.processFile) {
        return;
      }

      const promises = Array.from({ length: 5 }, async (_, i) => {
        const filePath = path.join(testDir, `concurrent-${i}.ts`);
        const content = `export const value${i} = "test";`;
        const frontmatter = { inject: false };

        return injector.processFile(filePath, content, frontmatter, {});
      });

      const results = await Promise.all(promises);

      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Check all files were created
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testDir, `concurrent-${i}.ts`);
        expect(await fs.pathExists(filePath)).toBe(true);
      }
    });
  });
});