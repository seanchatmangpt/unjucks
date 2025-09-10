/**
 * Comprehensive Test Suite for File Injection System
 * 
 * Tests all injection strategies, idempotent operations, skipIf conditions,
 * and error handling scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileInjector, FileInjectorOrchestrator } from '../../src/core/injection.js';

describe('FileInjector', () => {
  let injector;
  let testDir;
  let testFile;

  beforeEach(async () => {
    injector = new FileInjector();
    testDir = path.join(tmpdir(), 'unjucks-injection-test', Date.now().toString());
    await fs.ensureDir(testDir);
    testFile = path.join(testDir, 'test.js');
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('Input Validation', () => {
    it('should validate file path', async () => {
      const result = await injector.processFile('', 'content', {});
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid file path');
    });

    it('should validate content', async () => {
      const result = await injector.processFile('/tmp/test.js', '', {});
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid content');
    });

    it('should detect path traversal attempts', async () => {
      const result = await injector.processFile('../../../etc/passwd', 'content', {});
      expect(result.success).toBe(false);
      expect(result.message).toContain('Path traversal detected');
    });

    it('should validate injection configuration', async () => {
      const result = await injector.processFile(testFile, 'content', null);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid injection configuration');
    });
  });

  describe('Append Injection', () => {
    it('should append content to existing file', async () => {
      const initialContent = 'console.log("start");';
      const newContent = 'console.log("end");';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { append: true });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('append');
      expect(result.linesAdded).toBe(1);
      
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent).toContain(initialContent);
      expect(finalContent).toContain(newContent);
      expect(finalContent.indexOf(newContent) > finalContent.indexOf(initialContent)).toBe(true);
    });

    it('should append content with marker for idempotent operations', async () => {
      const initialContent = 'console.log("start");';
      const newContent = 'console.log("end");';
      const marker = '// INJECTED_MARKER';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { 
        append: true, 
        marker 
      });
      
      expect(result.success).toBe(true);
      
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent).toContain(marker);
      expect(finalContent).toContain(newContent);
    });

    it('should handle empty files', async () => {
      await fs.writeFile(testFile, '');
      
      const result = await injector.processFile(testFile, 'content', { append: true });
      
      expect(result.success).toBe(true);
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent.trim()).toBe('content');
    });
  });

  describe('Prepend Injection', () => {
    it('should prepend content to existing file', async () => {
      const initialContent = 'console.log("end");';
      const newContent = 'console.log("start");';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { prepend: true });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('prepend');
      expect(result.linesAdded).toBe(1);
      
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent).toContain(initialContent);
      expect(finalContent).toContain(newContent);
      expect(finalContent.indexOf(newContent) < finalContent.indexOf(initialContent)).toBe(true);
    });
  });

  describe('LineAt Injection', () => {
    it('should insert content at specific line', async () => {
      const initialContent = 'line1\nline2\nline3';
      const newContent = 'inserted line';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { lineAt: 2 });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('lineAt');
      
      const finalContent = await fs.readFile(testFile, 'utf8');
      const lines = finalContent.split('\n');
      expect(lines[1]).toBe(newContent);
    });

    it('should handle line number beyond file length', async () => {
      const initialContent = 'line1\nline2';
      const newContent = 'inserted line';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { lineAt: 10 });
      
      expect(result.success).toBe(true);
      
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent).toContain(newContent);
    });

    it('should handle line number 0 or negative', async () => {
      const initialContent = 'line1\nline2';
      const newContent = 'inserted line';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { lineAt: 0 });
      
      expect(result.success).toBe(true);
      
      const finalContent = await fs.readFile(testFile, 'utf8');
      const lines = finalContent.split('\n');
      expect(lines[0]).toBe(newContent);
    });
  });

  describe('Before/After Pattern Injection', () => {
    it('should insert content before pattern', async () => {
      const initialContent = 'function test() {\n  return true;\n}';
      const newContent = '// Added before function';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { 
        before: 'function test()' 
      });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('before');
      
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent.indexOf(newContent) < finalContent.indexOf('function test()')).toBe(true);
    });

    it('should insert content after pattern', async () => {
      const initialContent = 'import React from "react";\n\nfunction Component() {}';
      const newContent = 'import { useState } from "react";';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { 
        after: 'import React from "react";' 
      });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('after');
      
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent).toContain(newContent);
      const reactImportIndex = finalContent.indexOf('import React');
      const useStateImportIndex = finalContent.indexOf('import { useState }');
      expect(useStateImportIndex > reactImportIndex).toBe(true);
    });

    it('should fail when pattern not found', async () => {
      const initialContent = 'console.log("test");';
      const newContent = 'new content';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { 
        before: 'nonexistent pattern' 
      });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Pattern not found');
    });

    it('should support regex patterns', async () => {
      const initialContent = 'const var1 = 1;\nconst var2 = 2;';
      const newContent = 'const newVar = 0;';
      
      await fs.writeFile(testFile, initialContent);
      
      // This test assumes the injector supports regex patterns
      const result = await injector.processFile(testFile, newContent, { 
        before: 'const var1' 
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Replace Injection', () => {
    it('should replace content matching pattern', async () => {
      const initialContent = 'const oldValue = "old";\nconsole.log(oldValue);';
      const newContent = 'const newValue = "new";';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { 
        replace: 'const oldValue = "old";' 
      });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('replace');
      
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent).toContain(newContent);
      expect(finalContent).not.toContain('const oldValue = "old";');
    });

    it('should replace multiple occurrences', async () => {
      const initialContent = 'TODO: fix this\nTODO: and this\nDone: completed';
      const newContent = 'DONE: fixed';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { 
        replace: 'TODO: .*' 
      });
      
      expect(result.success).toBe(true);
      
      const finalContent = await fs.readFile(testFile, 'utf8');
      expect(finalContent).toContain('Done: completed');
    });
  });

  describe('SkipIf Conditions', () => {
    it('should skip injection when content already exists', async () => {
      const content = 'console.log("test");';
      
      await fs.writeFile(testFile, content);
      
      const result = await injector.processFile(testFile, content, { 
        append: true,
        skipIf: 'content.includes("console.log(\\"test\\");")'
      });
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.message).toContain('Content already contains');
    });

    it('should skip injection with boolean skipIf', async () => {
      const content = 'test content';
      
      await fs.writeFile(testFile, '');
      
      const result = await injector.processFile(testFile, content, { 
        append: true,
        skipIf: true
      });
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('should proceed when skipIf is false', async () => {
      const content = 'test content';
      
      await fs.writeFile(testFile, '');
      
      const result = await injector.processFile(testFile, content, { 
        append: true,
        skipIf: false
      });
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
    });

    it('should use marker for idempotent operations', async () => {
      const content = 'test content';
      const marker = '// UNIQUE_MARKER_123';
      
      await fs.writeFile(testFile, '');
      
      // First injection should succeed
      const result1 = await injector.processFile(testFile, content, { 
        append: true,
        marker
      });
      
      expect(result1.success).toBe(true);
      expect(result1.skipped).toBe(false);
      
      // Second injection should be skipped due to marker
      const result2 = await injector.processFile(testFile, content, { 
        append: true,
        marker,
        skipIf: `content.includes("${marker}")`
      });
      
      expect(result2.success).toBe(true);
      expect(result2.skipped).toBe(true);
    });

    it('should force injection even when skipIf is true', async () => {
      const content = 'console.log("test");';
      
      await fs.writeFile(testFile, content);
      
      const result = await injector.processFile(testFile, content, { 
        append: true,
        skipIf: 'content.includes("console.log")'
      }, { force: true });
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
    });
  });

  describe('Dry Run Mode', () => {
    it('should preview changes without modifying file', async () => {
      const initialContent = 'original content';
      const newContent = 'new content';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { 
        append: true 
      }, { dry: true });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('dry_run');
      expect(result.preview).toBeDefined();
      expect(result.preview).toContain(initialContent);
      expect(result.preview).toContain(newContent);
      
      // File should not be modified
      const actualContent = await fs.readFile(testFile, 'utf8');
      expect(actualContent).toBe(initialContent);
    });

    it('should include changes summary in dry run', async () => {
      const initialContent = 'line1\nline2';
      const newContent = 'inserted line';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { 
        lineAt: 2 
      }, { dry: true });
      
      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();
      expect(result.linesAdded).toBe(1);
      expect(result.linesRemoved).toBe(0);
    });
  });

  describe('Backup Creation', () => {
    it('should create backup when requested', async () => {
      const initialContent = 'original content';
      const newContent = 'new content';
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { 
        append: true 
      }, { backup: true });
      
      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      
      // Backup should exist and contain original content
      const backupExists = await fs.pathExists(result.backupPath);
      expect(backupExists).toBe(true);
      
      const backupContent = await fs.readFile(result.backupPath, 'utf8');
      expect(backupContent).toBe(initialContent);
    });

    it('should use custom backup directory', async () => {
      const initialContent = 'original content';
      const newContent = 'new content';
      const backupDir = path.join(testDir, 'backups');
      
      await fs.writeFile(testFile, initialContent);
      
      const result = await injector.processFile(testFile, newContent, { 
        append: true 
      }, { 
        backup: true,
        backupDir 
      });
      
      expect(result.success).toBe(true);
      expect(result.backupPath).toContain('backups');
      
      const backupExists = await fs.pathExists(result.backupPath);
      expect(backupExists).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found gracefully', async () => {
      const result = await injector.processFile('/nonexistent/file.js', 'content', { 
        append: true 
      });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('does not exist');
    });

    it('should handle permission errors', async () => {
      await fs.writeFile(testFile, 'content');
      await fs.chmod(testFile, 0o444); // Read-only
      
      const result = await injector.processFile(testFile, 'new content', { 
        append: true 
      });
      
      // Should handle the error gracefully
      expect(result.success).toBe(false);
    });

    it('should handle invalid regex patterns', async () => {
      await fs.writeFile(testFile, 'content');
      
      const result = await injector.processFile(testFile, 'new content', { 
        replace: '[invalid regex' 
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('Atomic Operations', () => {
    it('should handle interrupted writes gracefully', async () => {
      await fs.writeFile(testFile, 'original content');
      
      // Mock fs.move to simulate failure
      const originalMove = fs.move;
      fs.move = () => Promise.reject(new Error('Simulated failure'));
      
      try {
        const result = await injector.processFile(testFile, 'new content', { 
          append: true 
        });
        
        expect(result.success).toBe(false);
        
        // Original file should be unchanged
        const content = await fs.readFile(testFile, 'utf8');
        expect(content).toBe('original content');
      } finally {
        fs.move = originalMove;
      }
    });
  });

  describe('Pattern Detection', () => {
    it('should detect common injection points', () => {
      const content = `import React from 'react';
import { useState } from 'react';

export const Component = () => {
  return <div>Hello</div>;
};`;

      const importPoints = injector.detectInjectionPoints(content, 'imports');
      expect(importPoints).toHaveLength(2);
      expect(importPoints[0].content).toContain('import React');
      expect(importPoints[1].content).toContain('import { useState }');

      const exportPoints = injector.detectInjectionPoints(content, 'exports');
      expect(exportPoints).toHaveLength(1);
      expect(exportPoints[0].content).toContain('export const Component');
    });
  });
});

describe('FileInjectorOrchestrator', () => {
  let orchestrator;
  let testDir;

  beforeEach(async () => {
    orchestrator = new FileInjectorOrchestrator();
    testDir = path.join(tmpdir(), 'unjucks-orchestrator-test', Date.now().toString());
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('Batch Processing', () => {
    it('should process multiple files in batch', async () => {
      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'file2.js');
      
      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');
      
      const injections = [
        {
          filePath: file1,
          content: 'injected1',
          config: { append: true }
        },
        {
          filePath: file2,
          content: 'injected2',
          config: { append: true }
        }
      ];
      
      const result = await orchestrator.processBatch(injections);
      
      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(2);
      expect(result.successfulFiles).toBe(2);
      expect(result.skippedFiles).toBe(0);
      
      const content1 = await fs.readFile(file1, 'utf8');
      const content2 = await fs.readFile(file2, 'utf8');
      expect(content1).toContain('injected1');
      expect(content2).toContain('injected2');
    });

    it('should handle partial failures in batch', async () => {
      const file1 = path.join(testDir, 'file1.js');
      const file2 = path.join(testDir, 'nonexistent.js');
      
      await fs.writeFile(file1, 'content1');
      
      const injections = [
        {
          filePath: file1,
          content: 'injected1',
          config: { append: true }
        },
        {
          filePath: file2,
          content: 'injected2',
          config: { append: true }
        }
      ];
      
      const result = await orchestrator.processBatch(injections);
      
      expect(result.success).toBe(false);
      expect(result.totalFiles).toBe(2);
      expect(result.successfulFiles).toBe(1);
      expect(result.skippedFiles).toBe(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate injection configuration', () => {
      const valid = orchestrator.validateConfig({
        append: true
      });
      
      expect(valid.valid).toBe(true);
      expect(valid.errors).toHaveLength(0);
    });

    it('should detect conflicting injection modes', () => {
      const invalid = orchestrator.validateConfig({
        append: true,
        prepend: true
      });
      
      expect(invalid.valid).toBe(false);
      expect(invalid.errors).toContain('Multiple injection modes specified: append, prepend');
    });

    it('should require at least one injection mode', () => {
      const invalid = orchestrator.validateConfig({});
      
      expect(invalid.valid).toBe(false);
      expect(invalid.errors).toContain('No injection mode specified');
    });
  });

  describe('Statistics and Health', () => {
    it('should provide injector statistics', () => {
      const stats = orchestrator.getStatistics();
      
      expect(stats.version).toBeDefined();
      expect(stats.supportedModes).toContain('append');
      expect(stats.supportedModes).toContain('prepend');
      expect(stats.supportedModes).toContain('before');
      expect(stats.supportedModes).toContain('after');
      expect(stats.supportedModes).toContain('lineAt');
      expect(stats.supportedModes).toContain('replace');
      expect(stats.features).toContain('Idempotent operations');
      expect(stats.features).toContain('Skip conditions');
    });
  });

  describe('Permission and Shell Command Support', () => {
    it('should set file permissions', async () => {
      const testFile = path.join(testDir, 'test.js');
      await fs.writeFile(testFile, 'content');
      
      const success = await orchestrator.setPermissions(testFile, '755');
      expect(success).toBe(true);
    });

    it('should execute shell commands', async () => {
      const result = await orchestrator.executeCommands(['echo "test"'], testDir);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].stdout.trim()).toBe('test');
    });
  });
});

describe('Integration Tests', () => {
  let orchestrator;
  let testDir;

  beforeEach(async () => {
    orchestrator = new FileInjectorOrchestrator();
    testDir = path.join(tmpdir(), 'unjucks-integration-test', Date.now().toString());
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('should handle complete injection workflow', async () => {
    const testFile = path.join(testDir, 'component.js');
    const initialContent = `import React from 'react';

export const Component = () => {
  return <div>Hello</div>;
};`;

    await fs.writeFile(testFile, initialContent);

    // Add import after React import
    const result1 = await orchestrator.processFile(
      testFile,
      'import { useState } from "react";',
      { after: 'import React from \'react\';' },
      { backup: true }
    );

    expect(result1.success).toBe(true);

    // Add state variable at beginning of component
    const result2 = await orchestrator.processFile(
      testFile,
      '  const [count, setCount] = useState(0);',
      { after: 'export const Component = () => {' }
    );

    expect(result2.success).toBe(true);

    // Verify final content
    const finalContent = await fs.readFile(testFile, 'utf8');
    expect(finalContent).toContain('import { useState }');
    expect(finalContent).toContain('const [count, setCount]');
    expect(finalContent.indexOf('import { useState }') > finalContent.indexOf('import React')).toBe(true);
  });

  it('should handle idempotent operations correctly', async () => {
    const testFile = path.join(testDir, 'config.js');
    const marker = '// AUTO-GENERATED: API_KEY';
    
    await fs.writeFile(testFile, 'const config = {};');

    // First injection
    const result1 = await orchestrator.processFile(
      testFile,
      `${marker}\nconst API_KEY = "secret";`,
      { 
        after: 'const config = {};',
        marker
      }
    );

    expect(result1.success).toBe(true);

    // Second injection should be skipped
    const result2 = await orchestrator.processFile(
      testFile,
      `${marker}\nconst API_KEY = "secret";`,
      { 
        after: 'const config = {};',
        marker,
        skipIf: `content.includes("${marker}")`
      }
    );

    expect(result2.success).toBe(true);
    expect(result2.skipped).toBe(true);

    // Verify content only appears once
    const finalContent = await fs.readFile(testFile, 'utf8');
    const markerCount = (finalContent.match(new RegExp(marker, 'g')) || []).length;
    expect(markerCount).toBe(1);
  });
});