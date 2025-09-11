/**
 * KGEN Template Engine Tests
 * 
 * Comprehensive tests for the simplified template engine
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TemplateEngine, createTemplateEngine } from '../../../packages/kgen-core/src/templating/template-engine.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';

const TEST_TEMPLATES_DIR = '/tmp/kgen-test-templates';
const TEST_OUTPUT_DIR = '/tmp/kgen-test-output';

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
  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'simple.njk'), `---
to: "{{ name }}.txt"
---
Hello {{ name }}!`);

  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'component.njk'), `---
to: "{{ componentName | pascalCase }}.ts"
inject: true
before: "// IMPORTS"
---
import { {{ componentName | pascalCase }} } from './{{ componentName | kebabCase }}';`);

  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'conditional.njk'), `---
to: "output.txt"
skipIf: "skip"
---
{% if showContent %}
Content: {{ content }}
{% else %}
No content
{% endif %}`);

  writeFileSync(path.join(TEST_TEMPLATES_DIR, 'variables.njk'), `---
to: "{{ filename }}.{{ extension }}"
---
Name: {{ name }}
Count: {{ count }}
Items: {% for item in items %}{{ item }}{% if not loop.last %}, {% endif %}{% endfor %}`);
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

describe('TemplateEngine', () => {
  test('should create engine with default options', () => {
    const engine = new TemplateEngine();
    expect(engine.options.autoescape).toBe(false);
    expect(engine.options.trimBlocks).toBe(true);
    expect(engine.options.lstripBlocks).toBe(true);
  });

  test('should create engine with custom options', () => {
    const engine = new TemplateEngine({
      templatesDir: TEST_TEMPLATES_DIR,
      throwOnUndefined: true
    });
    expect(engine.options.templatesDir).toBe(TEST_TEMPLATES_DIR);
    expect(engine.options.throwOnUndefined).toBe(true);
  });

  test('should create engine using factory function', () => {
    const engine = createTemplateEngine({
      templatesDir: TEST_TEMPLATES_DIR
    });
    expect(engine).toBeInstanceOf(TemplateEngine);
  });
});

describe('Template Parsing', () => {
  let engine;
  
  beforeEach(() => {
    engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
  });

  test('should parse template with frontmatter', async () => {
    const content = `---
to: "output.txt"
---
Hello World!`;
    
    const result = await engine.parseTemplate(content);
    expect(result.hasValidFrontmatter).toBe(true);
    expect(result.frontmatter.to).toBe('output.txt');
    expect(result.content).toBe('Hello World!');
  });

  test('should parse template without frontmatter', async () => {
    const content = 'Simple template without frontmatter';
    
    const result = await engine.parseTemplate(content);
    expect(result.hasValidFrontmatter).toBe(false);
    expect(result.frontmatter).toEqual({});
    expect(result.content).toBe(content);
  });

  test('should extract variables from template', async () => {
    const content = `Hello {{ name }}! Count: {{ count }}
{% if showItems %}
Items: {% for item in items %}{{ item }}{% endfor %}
{% endif %}`;
    
    const result = await engine.parseTemplate(content);
    expect(result.variables).toContain('name');
    expect(result.variables).toContain('count');
    expect(result.variables).toContain('showItems');
    expect(result.variables).toContain('items');
  });
});

describe('Template Rendering', () => {
  let engine;
  
  beforeEach(() => {
    engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
  });

  test('should render simple template', async () => {
    const result = await engine.render('simple.njk', { name: 'World' });
    
    expect(result.content).toBe('Hello World!');
    expect(result.outputPath).toBe('World.txt');
    expect(result.metadata.templatePath).toBe('simple.njk');
    expect(result.metadata.variablesUsed).toContain('name');
  });

  test('should render template with conditional logic', async () => {
    const result1 = await engine.render('conditional.njk', {
      showContent: true,
      content: 'Test Content'
    });
    expect(result1.content.trim()).toBe('Content: Test Content');

    const result2 = await engine.render('conditional.njk', {
      showContent: false
    });
    expect(result2.content.trim()).toBe('No content');
  });

  test('should render template with loops', async () => {
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

  test('should handle skipIf condition', async () => {
    const engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
    
    // Should skip when skip=true
    const shouldSkip = engine.shouldSkip({ skipIf: 'skip' }, { skip: true });
    expect(shouldSkip).toBe(true);
    
    // Should not skip when skip=false
    const shouldNotSkip = engine.shouldSkip({ skipIf: 'skip' }, { skip: false });
    expect(shouldNotSkip).toBe(false);
  });

  test('should validate dependencies', async () => {
    const result = await engine.render('variables.njk', {
      filename: 'test',
      extension: 'js',
      name: 'TestName'
      // Missing count and items
    }, { validateDependencies: true });
    
    expect(result.metadata.validation).toBeDefined();
    expect(result.metadata.validation.valid).toBe(false);
    expect(result.metadata.validation.missing).toContain('count');
    expect(result.metadata.validation.missing).toContain('items');
  });

  test('should render string templates', async () => {
    const templateString = 'Hello {{ name }}! Today is {{ date }}.';
    
    const result = await engine.renderString(templateString, {
      name: 'Alice',
      date: '2024-01-01'
    });
    
    expect(result.content).toBe('Hello Alice! Today is 2024-01-01.');
  });

  test('should handle rendering errors gracefully', async () => {
    const result = await engine.render('nonexistent.njk', {}, { 
      throwOnError: false 
    });
    
    expect(result.content).toContain('Template rendering error');
    expect(result.metadata.error).toBeDefined();
  });
});

describe('Deterministic Rendering', () => {
  let engine;
  
  beforeEach(() => {
    engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
  });

  test('should produce consistent output for same input', async () => {
    const context = { name: 'Test', timestamp: '2024-01-01T00:00:00.000Z' };
    
    const result1 = await engine.render('simple.njk', context);
    const result2 = await engine.render('simple.njk', context);
    
    expect(result1.content).toBe(result2.content);
    expect(result1.outputPath).toBe(result2.outputPath);
  });

  test('should use deterministic timestamps when provided', async () => {
    const fixedTimestamp = '2024-01-01T12:00:00.000Z';
    
    const result = await engine.render('simple.njk', { 
      name: 'Test',
      timestamp: fixedTimestamp
    });
    
    expect(result.content).toContain('Test');
    // The engine should have the timestamp available in the context
  });
});

describe('Template Utilities', () => {
  let engine;
  
  beforeEach(() => {
    engine = new TemplateEngine({ templatesDir: TEST_TEMPLATES_DIR });
  });

  test('should check template existence', () => {
    expect(engine.templateExists('simple.njk')).toBe(true);
    expect(engine.templateExists('nonexistent.njk')).toBe(false);
  });

  test('should get operation mode from frontmatter', () => {
    const mode1 = engine.getOperationMode({ append: true });
    expect(mode1.mode).toBe('append');
    
    const mode2 = engine.getOperationMode({ inject: true, before: 'marker' });
    expect(mode2.mode).toBe('inject');
    expect(mode2.target).toBe('marker');
    
    const mode3 = engine.getOperationMode({ lineAt: 10 });
    expect(mode3.mode).toBe('lineAt');
    expect(mode3.lineNumber).toBe(10);
  });

  test('should track rendering statistics', async () => {
    await engine.render('simple.njk', { name: 'Test1' });
    await engine.render('variables.njk', { filename: 'test', extension: 'js', name: 'Test2', count: 1, items: [] });
    
    const stats = engine.getStats();
    expect(stats.renders).toBe(2);
    expect(stats.uniqueTemplates).toBe(2);
    expect(stats.templatesRendered).toContain('simple.njk');
    expect(stats.templatesRendered).toContain('variables.njk');
  });

  test('should reset statistics', async () => {
    await engine.render('simple.njk', { name: 'Test' });
    
    let stats = engine.getStats();
    expect(stats.renders).toBe(1);
    
    engine.resetStats();
    stats = engine.getStats();
    expect(stats.renders).toBe(0);
    expect(stats.uniqueTemplates).toBe(0);
  });

  test('should clear cache', () => {
    expect(() => engine.clearCache()).not.toThrow();
  });
});