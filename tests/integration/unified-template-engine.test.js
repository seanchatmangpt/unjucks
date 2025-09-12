/**
 * Unified Template Engine Integration Tests
 * 
 * Tests the GAMMA-3 template engine unification that merges
 * unjucks and KGEN template processing systems.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { UnifiedTemplateEngine, createEnhancedUnifiedTemplateEngine } from '../../src/lib/unified-template-engine.js';
import { generateUnifiedCommand } from '../../src/commands/generate-unified.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Unified Template Engine (GAMMA-3)', () => {
  let tempDir;
  let engine;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unified-engine-test-'));
    
    // Create test template directories
    const templatesDir = path.join(tempDir, '_templates');
    const altTemplatesDir = path.join(tempDir, 'templates');
    
    await fs.ensureDir(templatesDir);
    await fs.ensureDir(altTemplatesDir);
    
    // Initialize engine with test directories
    engine = new UnifiedTemplateEngine({
      templatesDirs: [templatesDir, altTemplatesDir],
      enableFilters: true,
      enableRDF: false,
      enableCache: true,
      deterministic: true,
      debug: true
    });
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Engine Initialization', () => {
    it('should initialize with multiple template engines', () => {
      expect(engine.engines.size).toBeGreaterThanOrEqual(1);
      expect(engine.engines.has('nunjucks')).toBe(true);
      expect(engine.options.supportedEngines).toContain('nunjucks');
    });

    it('should support multiple template directories', () => {
      expect(engine.options.templatesDirs).toHaveLength(2);
      expect(engine.options.templatesDirs[0]).toContain('_templates');
      expect(engine.options.templatesDirs[1]).toContain('templates');
    });

    it('should initialize filter pipeline', () => {
      expect(engine.filterCatalog).toBeDefined();
      expect(engine.options.enableFilters).toBe(true);
    });
  });

  describe('Template Discovery', () => {
    beforeEach(async () => {
      // Create test templates in both directories
      const templatesDir = engine.options.templatesDirs[0];
      const altTemplatesDir = engine.options.templatesDirs[1];
      
      // Nunjucks templates
      await fs.ensureDir(path.join(templatesDir, 'component'));
      await fs.writeFile(
        path.join(templatesDir, 'component', 'react.njk'),
        '---\nto: {{name}}.jsx\n---\nimport React from "react";\n\nconst {{name}} = () => {\n  return <div>{{name}}</div>;\n};\n\nexport default {{name}};'
      );
      
      // Handlebars template in alternate directory
      await fs.ensureDir(path.join(altTemplatesDir, 'service'));
      await fs.writeFile(
        path.join(altTemplatesDir, 'service', 'api.hbs'),
        '---\nto: {{name}}.service.js\n---\nclass {{name}}Service {\n  constructor() {\n    this.name = "{{name}}";\n  }\n}\n\nmodule.exports = {{name}}Service;'
      );
      
      // EJS template
      await fs.writeFile(
        path.join(templatesDir, 'config.ejs'),
        '---\nto: <%- name %>.config.js\n---\nmodule.exports = {\n  name: "<%- name %>",\n  env: "<%- env || "development" %>"\n};'
      );
    });

    it('should discover templates across multiple directories', async () => {
      const discovery = await engine.discoverTemplates();
      
      expect(discovery.generators).toHaveLength(2); // component, service
      expect(discovery.templates.length).toBeGreaterThanOrEqual(3);
      expect(discovery.engines).toContain('nunjucks');
      expect(discovery.totalFiles).toBeGreaterThanOrEqual(3);
    });

    it('should list generators correctly', async () => {
      const generators = await engine.listGenerators();
      
      expect(generators).toHaveLength(2);
      expect(generators.some(g => g.name === 'component')).toBe(true);
      expect(generators.some(g => g.name === 'service')).toBe(true);
    });

    it('should list templates for specific generator', async () => {
      const componentTemplates = await engine.listTemplates('component');
      const serviceTemplates = await engine.listTemplates('service');
      
      expect(componentTemplates.length).toBeGreaterThanOrEqual(1);
      expect(serviceTemplates.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect template engines by extension', () => {
      const nunjucksEngine = engine.detectEngineByExtension('test.njk');
      const handlebarsEngine = engine.detectEngineByExtension('test.hbs');
      const ejsEngine = engine.detectEngineByExtension('test.ejs');
      
      expect(nunjucksEngine?.name).toBe('nunjucks');
      expect(handlebarsEngine?.name).toBe('handlebars');
      expect(ejsEngine?.name).toBe('ejs');
    });
  });

  describe('Template Rendering', () => {
    beforeEach(async () => {
      const templatesDir = engine.options.templatesDirs[0];
      
      // Create test templates
      await fs.ensureDir(path.join(templatesDir, 'test'));
      
      // Nunjucks template with variables
      await fs.writeFile(
        path.join(templatesDir, 'test', 'nunjucks-test.njk'),
        '---\nto: {{name}}.js\nengine: nunjucks\n---\n// Generated with Nunjucks\nconst {{name}} = "{{ description | default("No description") }}";\nmodule.exports = {{name}};'
      );
      
      // Template with filters
      await fs.writeFile(
        path.join(templatesDir, 'test', 'filters-test.njk'),
        '---\nto: {{name | camelCase}}.js\n---\n// {{name | upperCase}}\nconst result = "{{ value | hash }}";'
      );
    });

    it('should render Nunjucks templates correctly', async () => {
      const result = await engine.render('test/nunjucks-test', {
        name: 'TestComponent',
        description: 'A test component'
      });
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('const TestComponent = "A test component"');
      expect(result.outputPath).toBe('TestComponent.js');
      expect(result.engine).toBe('nunjucks');
    });

    it('should handle template variables extraction', () => {
      const templateContent = 'Hello {{name}}! Your {{type}} is ready. Status: {{status.value}}';
      const variables = engine.extractVariables(templateContent);
      
      expect(variables.has('name')).toBe(true);
      expect(variables.has('type')).toBe(true);
      expect(variables.has('status')).toBe(true);
    });

    it('should apply filters correctly', async () => {
      const result = await engine.render('test/filters-test', {
        name: 'test-component',
        value: 'hello world'
      });
      
      expect(result.success).toBe(true);
      expect(result.outputPath).toContain('testComponent.js'); // camelCase filter
      expect(result.content).toContain('TEST-COMPONENT'); // upperCase filter
      // Hash filter should produce consistent output for deterministic builds
      expect(result.content).toMatch(/const result = "[a-f0-9]{64}";/);
    });

    it('should handle render errors gracefully', async () => {
      const result = await engine.render('nonexistent/template', {}, {
        throwOnError: false
      });
      
      expect(result.success).toBe(false);
      expect(result.content).toContain('<!-- Template rendering error');
      expect(result.metadata.error).toBeDefined();
    });
  });

  describe('Multi-Engine Support', () => {
    beforeEach(async () => {
      if (!engine.engines.has('handlebars') || !engine.engines.has('ejs')) {
        // Skip tests if engines not available
        return;
      }
      
      const templatesDir = engine.options.templatesDirs[0];
      await fs.ensureDir(path.join(templatesDir, 'multi'));
      
      // Handlebars template
      await fs.writeFile(
        path.join(templatesDir, 'multi', 'handlebars-test.hbs'),
        '---\nto: {{name}}.hbs.js\n---\n// Generated with Handlebars\nconst {{name}} = "{{description}}";\nmodule.exports = {{name}};'
      );
      
      // EJS template
      await fs.writeFile(
        path.join(templatesDir, 'multi', 'ejs-test.ejs'),
        '---\nto: <%- name %>.ejs.js\n---\n// Generated with EJS\nconst <%- name %> = "<%- description %>";\nmodule.exports = <%- name %>;'
      );
    });

    it('should render Handlebars templates', async () => {
      if (!engine.engines.has('handlebars')) {
        console.warn('Handlebars engine not available, skipping test');
        return;
      }
      
      const result = await engine.render('multi/handlebars-test', {
        name: 'HandlebarsTest',
        description: 'Handlebars rendering test'
      });
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('const HandlebarsTest = "Handlebars rendering test"');
      expect(result.engine).toBe('handlebars');
      expect(result.outputPath).toBe('HandlebarsTest.hbs.js');
    });

    it('should render EJS templates', async () => {
      if (!engine.engines.has('ejs')) {
        console.warn('EJS engine not available, skipping test');
        return;
      }
      
      const result = await engine.render('multi/ejs-test', {
        name: 'EjsTest',
        description: 'EJS rendering test'
      });
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('const EjsTest = "EJS rendering test"');
      expect(result.engine).toBe('ejs');
      expect(result.outputPath).toBe('EjsTest.ejs.js');
    });
  });

  describe('Deterministic Rendering', () => {
    beforeEach(async () => {
      const templatesDir = engine.options.templatesDirs[0];
      await fs.ensureDir(path.join(templatesDir, 'deterministic'));
      
      await fs.writeFile(
        path.join(templatesDir, 'deterministic', 'test.njk'),
        '---\nto: {{name}}.js\n---\n// Generated: {{timestamp}}\n// Hash: {{ content | contentHash }}\nconst config = {{ config | jsonify }};'
      );
    });

    it('should produce deterministic output with fixed timestamp', async () => {
      const fixedTimestamp = '2025-01-01T00:00:00.000Z';
      engine.options.fixedTimestamp = fixedTimestamp;
      
      const result1 = await engine.render('deterministic/test', {
        name: 'DeterministicTest',
        content: 'test content',
        config: { key: 'value', number: 42 }
      });
      
      const result2 = await engine.render('deterministic/test', {
        name: 'DeterministicTest',
        content: 'test content',
        config: { key: 'value', number: 42 }
      });
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.content).toBe(result2.content);
      expect(result1.content).toContain(fixedTimestamp);
    });

    it('should sort object keys for consistency', () => {
      const unsorted = { z: 1, a: 2, m: { y: 1, b: 2 } };
      const sorted = engine.sortObjectKeys(unsorted);
      
      expect(Object.keys(sorted)).toEqual(['a', 'm', 'z']);
      expect(Object.keys(sorted.m)).toEqual(['b', 'y']);
    });
  });

  describe('Caching', () => {
    it('should cache discovery results', async () => {
      const templatesDir = engine.options.templatesDirs[0];
      await fs.ensureDir(path.join(templatesDir, 'cache-test'));
      await fs.writeFile(
        path.join(templatesDir, 'cache-test', 'test.njk'),
        'Test template'
      );
      
      // First call
      const start1 = Date.now();
      const discovery1 = await engine.discoverTemplates();
      const time1 = Date.now() - start1;
      
      // Second call (should be cached)
      const start2 = Date.now();
      const discovery2 = await engine.discoverTemplates();
      const time2 = Date.now() - start2;
      
      expect(discovery1).toEqual(discovery2);
      expect(time2).toBeLessThan(time1); // Cached call should be faster
    });

    it('should clear all caches', async () => {
      await engine.discoverTemplates(); // Populate cache
      
      expect(engine.discoveryCache.size).toBeGreaterThan(0);
      
      engine.clearCache();
      
      expect(engine.discoveryCache.size).toBe(0);
      expect(engine.renderCache.size).toBe(0);
      expect(engine.templateCache.size).toBe(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      const templatesDir = engine.options.templatesDirs[0];
      await fs.ensureDir(path.join(templatesDir, 'stats'));
      await fs.writeFile(
        path.join(templatesDir, 'stats', 'test.njk'),
        'Stats test: {{name}} - {{value | upperCase}}'
      );
    });

    it('should track rendering statistics', async () => {
      const initialStats = engine.getStats();
      
      await engine.render('stats/test', { name: 'test', value: 'hello' });
      await engine.render('stats/test', { name: 'test2', value: 'world' });
      
      const finalStats = engine.getStats();
      
      expect(finalStats.renders).toBe(initialStats.renders + 2);
      expect(finalStats.templatesRendered.length).toBeGreaterThan(initialStats.templatesRendered.length);
      expect(finalStats.variablesUsed).toContain('name');
      expect(finalStats.variablesUsed).toContain('value');
      expect(finalStats.filtersUsed).toContain('upperCase');
      expect(finalStats.enginesUsed).toContain('nunjucks');
    });

    it('should reset statistics correctly', async () => {
      await engine.render('stats/test', { name: 'test', value: 'hello' });
      
      let stats = engine.getStats();
      expect(stats.renders).toBeGreaterThan(0);
      
      engine.resetStats();
      
      stats = engine.getStats();
      expect(stats.renders).toBe(0);
      expect(stats.templatesRendered).toHaveLength(0);
      expect(stats.variablesUsed).toHaveLength(0);
    });

    it('should provide comprehensive environment information', () => {
      const env = engine.getEnvironment();
      
      expect(env.templatesDirs).toBeDefined();
      expect(env.engines).toBeDefined();
      expect(env.version).toBe('3.0.0-unified');
      expect(env.deterministic).toBe(true);
      expect(env.availableFilters).toBeDefined();
      expect(env.cacheSize).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing template gracefully', async () => {
      const result = await engine.render('nonexistent/template', {}, {
        throwOnError: false
      });
      
      expect(result.success).toBe(false);
      expect(result.metadata.error).toBeDefined();
    });

    it('should handle template syntax errors', async () => {
      const result = await engine.renderString('{{invalid syntax', {}, {
        throwOnError: false
      });
      
      expect(result.success).toBe(false);
      expect(result.metadata.error).toBeDefined();
    });
  });
});

describe('Enhanced Generate Command', () => {
  let tempDir;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unified-cmd-test-'));
    process.chdir(tempDir);
    
    // Create test templates
    const templatesDir = path.join(tempDir, '_templates');
    await fs.ensureDir(path.join(templatesDir, 'component'));
    
    await fs.writeFile(
      path.join(templatesDir, 'component', 'react.njk'),
      '---\nto: src/components/{{name}}.jsx\n---\nimport React from "react";\n\nexport const {{name}} = () => {\n  return (\n    <div className="{{name | kebabCase}}">\n      <h1>{{name}}</h1>\n    </div>\n  );\n};\n\nexport default {{name}};'
    );
  });
  
  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  it('should execute generate command successfully', async () => {
    // Set up command arguments
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(['component', 'react', 'TestButton']);
    
    const context = {
      args: {
        generator: 'component',
        template: 'react',
        name: 'TestButton',
        dest: '.',
        dry: true,
        force: false,
        verbose: true,
        quiet: false
      }
    };
    
    const result = await generateUnifiedCommand.run(context);
    
    expect(result.success).toBe(true);
    expect(result.files).toBeDefined();
    expect(result.metadata).toBeDefined();
    
    // Clean up
    delete process.env.UNJUCKS_POSITIONAL_ARGS;
  });
});

describe('Factory Functions', () => {
  it('should create enhanced unified template engine', () => {
    const engine = createEnhancedUnifiedTemplateEngine({
      templatesDirs: ['test-templates'],
      debug: true
    });
    
    expect(engine).toBeInstanceOf(UnifiedTemplateEngine);
    expect(engine.options.enableFilters).toBe(true);
    expect(engine.options.enableRDF).toBe(true);
    expect(engine.options.deterministic).toBe(true);
    expect(engine.options.templatesDirs).toContain('test-templates');
  });
});