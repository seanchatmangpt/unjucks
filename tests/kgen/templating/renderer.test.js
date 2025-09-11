/**
 * KGEN Template Renderer Tests
 * 
 * Tests for the file rendering and injection functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TemplateRenderer, createRenderer } from '../../../packages/kgen-core/src/templating/renderer.js';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import path from 'path';

const TEST_TEMPLATES_DIR = '/tmp/kgen-renderer-templates';
const TEST_OUTPUT_DIR = '/tmp/kgen-renderer-output';

// Setup test directories and templates
beforeEach(() => {
  // Clean and create test directories
  if (existsSync(TEST_TEMPLATES_DIR)) {
    rmSync(TEST_TEMPLATES_DIR, { recursive: true });
  }
  if (existsSync(TEST_OUTPUT_DIR)) {
    rmSync(TEST_OUTPUT_DIR, { recursive: true });
  }
  
  mkdirSync(TEST_TEMPLATES_DIR, { recursive: true });
  mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  
  // Create test templates
  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'write.njk'), `---
to: "{{ name }}.txt"
---
Content for {{ name }}`);

  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'append.njk'), `---
to: "append.txt"
append: true
---
Appended content`);

  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'prepend.njk'), `---
to: "prepend.txt"
prepend: true
---
Prepended content`);

  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'inject.njk'), `---
to: "inject.txt"
inject: true
before: "// MARKER"
---
Injected content`);

  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'skip.njk'), `---
to: "skip.txt"
skipIf: "skip"
---
This should be skipped`);

  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'lineAt.njk'), `---
to: "lineAt.txt"
lineAt: 2
---
Line inserted at position 2`);
});

afterEach(() => {
  // Cleanup
  if (existsSync(TEST_TEMPLATES_DIR)) {
    rmSync(TEST_TEMPLATES_DIR, { recursive: true });
  }
  if (existsSync(TEST_OUTPUT_DIR)) {
    rmSync(TEST_OUTPUT_DIR, { recursive: true });
  }
});

describe('TemplateRenderer', () => {
  test('should create renderer with default options', () => {
    const renderer = new TemplateRenderer();
    expect(renderer.options.dryRun).toBe(false);
    expect(renderer.options.force).toBe(false);
    expect(renderer.options.createDirectories).toBe(true);
  });

  test('should create renderer with custom options', () => {
    const renderer = new TemplateRenderer({
      templatesDir: TEST_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR,
      dryRun: true,
      force: true
    });
    expect(renderer.options.templatesDir).toBe(TEST_TEMPLATES_DIR);
    expect(renderer.options.outputDir).toBe(TEST_OUTPUT_DIR);
    expect(renderer.options.dryRun).toBe(true);
    expect(renderer.options.force).toBe(true);
  });

  test('should create renderer using factory function', () => {
    const renderer = createRenderer({
      templatesDir: TEST_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR
    });
    expect(renderer).toBeInstanceOf(TemplateRenderer);
  });
});

describe('File Operations', () => {
  let renderer;
  
  beforeEach(() => {
    renderer = new TemplateRenderer({
      templatesDir: TEST_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR
    });
  });

  test('should write new file', async () => {
    const result = await renderer.renderToFile('write.njk', { name: 'test' });
    
    expect(result.operation).toBe('write');
    expect(result.outputPath).toBe('test.txt');
    expect(result.fileOperation.operation).toBe('write');
    
    const filePath = path.join(TEST_OUTPUT_DIR, 'test.txt');
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf8')).toBe('Content for test');
  });

  test('should append to existing file', async () => {
    // Create initial file
    const filePath = path.join(TEST_OUTPUT_DIR, 'append.txt');
    writeFileSync(filePath, 'Initial content');
    
    const result = await renderer.renderToFile('append.njk', {});
    
    expect(result.operation).toBe('append');
    expect(result.fileOperation.operation).toBe('append');
    
    const content = readFileSync(filePath, 'utf8');
    expect(content).toBe('Initial content\nAppended content');
  });

  test('should prepend to existing file', async () => {
    // Create initial file
    const filePath = path.join(TEST_OUTPUT_DIR, 'prepend.txt');
    writeFileSync(filePath, 'Initial content');
    
    const result = await renderer.renderToFile('prepend.njk', {});
    
    expect(result.operation).toBe('prepend');
    expect(result.fileOperation.operation).toBe('prepend');
    
    const content = readFileSync(filePath, 'utf8');
    expect(content).toBe('Prepended content\nInitial content');
  });

  test('should inject content before marker', async () => {
    // Create file with marker
    const filePath = path.join(TEST_OUTPUT_DIR, 'inject.txt');
    writeFileSync(filePath, 'Line 1\n// MARKER\nLine 3');
    
    const result = await renderer.renderToFile('inject.njk', {});
    
    expect(result.operation).toBe('inject');
    expect(result.fileOperation.operation).toBe('inject');
    expect(result.fileOperation.injected).toBe(true);
    
    const content = readFileSync(filePath, 'utf8');
    expect(content).toContain('Line 1\nInjected content\n// MARKER');
  });

  test('should handle inject failure when marker not found', async () => {
    // Create file without marker
    const filePath = path.join(TEST_OUTPUT_DIR, 'inject.txt');
    writeFileSync(filePath, 'Line 1\nLine 2\nLine 3');
    
    const result = await renderer.renderToFile('inject.njk', {});
    
    expect(result.operation).toBe('inject-failed');
    expect(result.fileOperation.injected).toBe(false);
    expect(result.fileOperation.reason).toBe('Target string not found');
  });

  test('should insert at specific line number', async () => {
    // Create file with existing lines
    const filePath = path.join(TEST_OUTPUT_DIR, 'lineAt.txt');
    writeFileSync(filePath, 'Line 1\nLine 2\nLine 3');
    
    const result = await renderer.renderToFile('lineAt.njk', {});
    
    expect(result.operation).toBe('lineAt');
    expect(result.fileOperation.operation).toBe('lineAt');
    expect(result.fileOperation.lineNumber).toBe(2);
    
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    expect(lines[1]).toBe('Line inserted at position 2');
  });

  test('should skip file when skipIf condition is met', async () => {
    const result = await renderer.renderToFile('skip.njk', { skip: true });
    
    expect(result.operation).toBe('skip');
    expect(result.skipped).toBe(true);
    expect(result.message).toContain('skipIf condition');
    
    const filePath = path.join(TEST_OUTPUT_DIR, 'skip.txt');
    expect(existsSync(filePath)).toBe(false);
  });

  test('should not skip file when skipIf condition is not met', async () => {
    const result = await renderer.renderToFile('skip.njk', { skip: false });
    
    expect(result.operation).toBe('write');
    expect(result.skipped).toBe(undefined);
    
    const filePath = path.join(TEST_OUTPUT_DIR, 'skip.txt');
    expect(existsSync(filePath)).toBe(true);
  });
});

describe('Dry Run Mode', () => {
  let renderer;
  
  beforeEach(() => {
    renderer = new TemplateRenderer({
      templatesDir: TEST_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR,
      dryRun: true
    });
  });

  test('should perform dry run without creating files', async () => {
    const result = await renderer.renderToFile('write.njk', { name: 'test' });
    
    expect(result.operation).toBe('dry-run-write');
    expect(result.fileOperation.operation).toBe('dry-run-write');
    expect(result.fileOperation.contentLength).toBeGreaterThan(0);
    
    const filePath = path.join(TEST_OUTPUT_DIR, 'test.txt');
    expect(existsSync(filePath)).toBe(false);
  });

  test('should show what would happen in append mode', async () => {
    const result = await renderer.renderToFile('append.njk', {});
    
    expect(result.operation).toBe('dry-run-append');
    expect(result.fileOperation.mode.mode).toBe('append');
  });
});

describe('Force Mode and File Existence', () => {
  let renderer;
  
  beforeEach(() => {
    renderer = new TemplateRenderer({
      templatesDir: TEST_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR,
      force: false
    });
  });

  test('should skip existing file when force is false', async () => {
    // Create existing file
    const filePath = path.join(TEST_OUTPUT_DIR, 'test.txt');
    writeFileSync(filePath, 'Existing content');
    
    const result = await renderer.renderToFile('write.njk', { name: 'test' });
    
    expect(result.operation).toBe('skip');
    expect(result.fileOperation.reason).toBe('File exists and force not specified');
    
    // Content should remain unchanged
    expect(readFileSync(filePath, 'utf8')).toBe('Existing content');
  });

  test('should overwrite existing file when force is true', async () => {
    renderer.options.force = true;
    
    // Create existing file
    const filePath = path.join(TEST_OUTPUT_DIR, 'test.txt');
    writeFileSync(filePath, 'Existing content');
    
    const result = await renderer.renderToFile('write.njk', { name: 'test' });
    
    expect(result.operation).toBe('write');
    expect(result.fileOperation.operation).toBe('write');
    
    // Content should be overwritten
    expect(readFileSync(filePath, 'utf8')).toBe('Content for test');
  });
});

describe('Multiple Template Rendering', () => {
  let renderer;
  
  beforeEach(() => {
    renderer = new TemplateRenderer({
      templatesDir: TEST_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR
    });
  });

  test('should render multiple templates', async () => {
    const templates = [
      { path: 'write.njk', context: { name: 'first' } },
      { path: 'write.njk', context: { name: 'second' } },
      { path: 'append.njk', context: {} }
    ];
    
    const results = await renderer.renderMultiple(templates, {});
    
    expect(results).toHaveLength(3);
    expect(results[0].outputPath).toBe('first.txt');
    expect(results[1].outputPath).toBe('second.txt');
    expect(results[2].outputPath).toBe('append.txt');
    
    // Check files were created
    expect(existsSync(path.join(TEST_OUTPUT_DIR, 'first.txt'))).toBe(true);
    expect(existsSync(path.join(TEST_OUTPUT_DIR, 'second.txt'))).toBe(true);
    expect(existsSync(path.join(TEST_OUTPUT_DIR, 'append.txt'))).toBe(true);
  });

  test('should merge global and template-specific context', async () => {
    const templates = [
      { 
        path: 'write.njk',
        context: { name: 'local' },
        options: { outputPath: 'custom.txt' }
      }
    ];
    
    const results = await renderer.renderMultiple(templates, { 
      globalVar: 'global' 
    });
    
    expect(results[0].outputPath).toBe('custom.txt');
    expect(results[0].content).toBe('Content for local');
  });
});

describe('Statistics and Operations Tracking', () => {
  let renderer;
  
  beforeEach(() => {
    renderer = new TemplateRenderer({
      templatesDir: TEST_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR
    });
  });

  test('should track operations', async () => {
    await renderer.renderToFile('write.njk', { name: 'test1' });
    await renderer.renderToFile('append.njk', {});
    
    const operations = renderer.getOperations();
    expect(operations).toHaveLength(2);
    expect(operations[0].operation).toBe('write');
    expect(operations[1].operation).toBe('append');
  });

  test('should provide comprehensive statistics', async () => {
    await renderer.renderToFile('write.njk', { name: 'test' });
    await renderer.renderToFile('append.njk', {});
    
    const stats = renderer.getStats();
    expect(stats.operations).toBe(2);
    expect(stats.operationTypes.write).toBe(1);
    expect(stats.operationTypes.append).toBe(1);
    expect(stats.totalFileSize).toBeGreaterThan(0);
    expect(stats.totalTime).toBeGreaterThan(0);
  });

  test('should clear operations history', async () => {
    await renderer.renderToFile('write.njk', { name: 'test' });
    
    let operations = renderer.getOperations();
    expect(operations).toHaveLength(1);
    
    renderer.clearOperations();
    operations = renderer.getOperations();
    expect(operations).toHaveLength(0);
  });

  test('should reset all statistics', async () => {
    await renderer.renderToFile('write.njk', { name: 'test' });
    
    let stats = renderer.getStats();
    expect(stats.operations).toBe(1);
    
    renderer.reset();
    stats = renderer.getStats();
    expect(stats.operations).toBe(0);
  });
});

describe('Path Resolution', () => {
  let renderer;
  
  beforeEach(() => {
    renderer = new TemplateRenderer({
      templatesDir: TEST_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR
    });
  });

  test('should resolve output path with variables', async () => {
    const result = await renderer.renderToFile('write.njk', { 
      name: 'MyComponent' 
    });
    
    expect(result.outputPath).toBe('MyComponent.txt');
  });

  test('should handle missing output path', async () => {
    // Create template without 'to' frontmatter
    writeFileSync(path.join(TEST_TEMPLATES_DIR, 'no-path.njk'), `Content without path`);
    
    const result = await renderer.renderToFile('no-path.njk', {});
    
    // Should use template name as fallback
    expect(result.outputPath).toBe('no-path');
  });
});

describe('Error Handling', () => {
  let renderer;
  
  beforeEach(() => {
    renderer = new TemplateRenderer({
      templatesDir: TEST_TEMPLATES_DIR,
      outputDir: TEST_OUTPUT_DIR
    });
  });

  test('should handle template rendering errors', async () => {
    const result = await renderer.renderToFile('nonexistent.njk', {}, {
      throwOnError: false
    });
    
    expect(result.operation).toBe('error');
    expect(result.error).toBeDefined();
  });

  test('should handle file operation errors', async () => {
    // Try to write to invalid path
    const result = await renderer.renderToFile('write.njk', { 
      name: '../../../invalid/path' 
    }, { throwOnError: false });
    
    // Should handle the error gracefully
    expect(result).toBeDefined();
  });
});