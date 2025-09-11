/**
 * KGEN Template Engine Unit Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';

// Import the template engine from our package
import { TemplateEngine, createTemplateEngine } from '../../packages/kgen-core/src/templating/template-engine.js';

const TEST_TEMPLATES_DIR = '/tmp/kgen-unit-test-templates';

beforeEach(() => {
  // Clean and create test directory
  if (existsSync(TEST_TEMPLATES_DIR)) {
    rmSync(TEST_TEMPLATES_DIR, { recursive: true });
  }
  mkdirSync(TEST_TEMPLATES_DIR, { recursive: true });
  
  // Create a simple test template
  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'simple.njk'), `---
to: "{{ name }}.txt"
---
Hello {{ name }}!`);

  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'variables.njk'), `---
to: "{{ filename }}.{{ extension }}"
---
Name: {{ name }}
Count: {{ count }}
Items: {% for item in items %}{{ item }}{% if not loop.last %}, {% endif %}{% endfor %}`);
});

afterEach(() => {
  if (existsSync(TEST_TEMPLATES_DIR)) {
    rmSync(TEST_TEMPLATES_DIR, { recursive: true });
  }
});

describe('KGEN Template Engine', () => {
  test('should create engine with correct default settings', () => {
    const engine = new TemplateEngine();
    expect(engine.options.autoescape).toBe(false);
    expect(engine.options.trimBlocks).toBe(true);
    expect(engine.options.lstripBlocks).toBe(true);
  });

  test('should create engine using factory', () => {
    const engine = createTemplateEngine({
      templatesDir: TEST_TEMPLATES_DIR
    });
    expect(engine).toBeInstanceOf(TemplateEngine);
    expect(engine.options.templatesDir).toBe(TEST_TEMPLATES_DIR);
  });

  test('should parse template with frontmatter', async () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    const content = `---
to: "output.txt"
skipIf: "skip"
---
Hello World!`;
    
    const result = await engine.parseTemplate(content);
    expect(result.hasValidFrontmatter).toBe(true);
    expect(result.frontmatter.to).toBe('output.txt');
    expect(result.frontmatter.skipIf).toBe('skip');
    expect(result.content).toBe('Hello World!');
  });

  test('should extract variables from template', async () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    const content = `Hello {{ name }}! Count: {{ count }}
{% for item in items %}{{ item }}{% endfor %}`;
    
    const result = await engine.parseTemplate(content);
    expect(result.variables).toContain('name');
    expect(result.variables).toContain('count');
    expect(result.variables).toContain('items');
  });

  test('should render simple template', async () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    const result = await engine.render('simple.njk', { name: 'World' });
    
    expect(result.content).toBe('Hello World!');
    expect(result.outputPath).toBe('World.txt');
  });

  test('should render template with loops and variables', async () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    const result = await engine.render('variables.njk', {
      filename: 'test',
      extension: 'js',
      name: 'TestName',
      count: 42,
      items: ['one', 'two', 'three']
    });
    
    expect(result.content).toContain('Name: TestName');
    expect(result.content).toContain('Count: 42');
    expect(result.content).toContain('Items: one, two, three');
    expect(result.outputPath).toBe('test.js');
  });

  test('should validate template dependencies', async () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    const result = await engine.render('variables.njk', {
      filename: 'test',
      extension: 'js'
      // Missing: name, count, items
    }, { validateDependencies: true });
    
    expect(result.metadata.validation).toBeDefined();
    expect(result.metadata.validation.valid).toBe(false);
    expect(result.metadata.validation.missing).toContain('name');
    expect(result.metadata.validation.missing).toContain('count');
    expect(result.metadata.validation.missing).toContain('items');
  });

  test('should handle skipIf conditions', () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    
    expect(engine.shouldSkip({ skipIf: 'skip' }, { skip: true })).toBe(true);
    expect(engine.shouldSkip({ skipIf: 'skip' }, { skip: false })).toBe(false);
    expect(engine.shouldSkip({ skipIf: '!enabled' }, { enabled: true })).toBe(false);
    expect(engine.shouldSkip({ skipIf: '!enabled' }, { enabled: false })).toBe(true);
  });

  test('should render string templates', async () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    const result = await engine.renderString('Hello {{ name }}!', { name: 'Alice' });
    
    expect(result.content).toBe('Hello Alice!');
  });

  test('should track statistics', async () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    
    await engine.render('simple.njk', { name: 'Test1' });
    await engine.render('variables.njk', { 
      filename: 'test', 
      extension: 'js', 
      name: 'Test2',
      count: 1,
      items: []
    });
    
    const stats = engine.getStats();
    expect(stats.renders).toBe(2);
    expect(stats.uniqueTemplates).toBe(2);
    expect(stats.variablesUsed).toContain('name');
  });

  test('should ensure deterministic rendering', async () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    const context = { name: 'Test', timestamp: '2024-01-01T00:00:00.000Z' };
    
    const result1 = await engine.render('simple.njk', context);
    const result2 = await engine.render('simple.njk', context);
    
    expect(result1.content).toBe(result2.content);
    expect(result1.outputPath).toBe(result2.outputPath);
  });

  test('should handle template existence checks', () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    
    expect(engine.templateExists('simple.njk')).toBe(true);
    expect(engine.templateExists('nonexistent.njk')).toBe(false);
  });

  test('should get operation modes from frontmatter', () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    
    expect(engine.getOperationMode({ append: true }).mode).toBe('append');
    expect(engine.getOperationMode({ prepend: true }).mode).toBe('prepend');
    expect(engine.getOperationMode({ lineAt: 5 }).mode).toBe('lineAt');
    expect(engine.getOperationMode({ inject: true, before: 'marker' }).mode).toBe('inject');
    expect(engine.getOperationMode({}).mode).toBe('write');
  });

  test('should reset statistics', async () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    
    await engine.render('simple.njk', { name: 'Test' });
    expect(engine.getStats().renders).toBe(1);
    
    engine.resetStats();
    expect(engine.getStats().renders).toBe(0);
  });
});