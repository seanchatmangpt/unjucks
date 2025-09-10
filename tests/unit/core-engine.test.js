/**
 * Core Engine Tests
 * 
 * Tests for the main Unjucks engine orchestration layer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnjucksEngine } from '../../src/core/engine.js';
import { UnjucksApp } from '../../src/core/app.js';

describe('UnjucksEngine', () => {
  let engine;
  
  beforeEach(() => {
    engine = new UnjucksEngine({
      templatesDir: '_templates',
      outputDir: './test-output',
      dry: true // Prevent actual file writes in tests
    });
  });

  it('should initialize with default configuration', () => {
    expect(engine.config).toMatchObject({
      templatesDir: '_templates',
      outputDir: './test-output',
      dry: true,
      force: false,
      verbose: false
    });
  });

  it('should have correct initial pipeline state', () => {
    expect(engine.pipeline).toEqual({
      discovered: false,
      processed: false,
      rendered: false,
      written: false
    });
  });

  it('should initialize metrics correctly', () => {
    expect(engine.metrics).toMatchObject({
      startTime: null,
      discovery: null,
      processing: null,
      rendering: null,
      writing: null,
      total: null
    });
  });

  it('should extract template variables correctly', () => {
    const content = `
      export const {{ componentName }} = () => {
        return <div className="{{ className }}">{{ content }}</div>;
      };
    `;
    
    const variables = engine._extractTemplateVariables(content);
    expect(variables).toEqual(['componentName', 'className', 'content']);
  });

  it('should handle variable extraction with filters', () => {
    const content = `
      {{ name | pascalCase }}
      {{ items | map('id') | join(', ') }}
      {{ config | default('{}') }}
    `;
    
    const variables = engine._extractTemplateVariables(content);
    expect(variables).toEqual(['name', 'items', 'config']);
  });

  it('should build template registry correctly', () => {
    const templates = [
      {
        path: '/templates/component/react/index.js.njk',
        relativePath: 'component/react/index.js.njk',
        name: 'index.js.njk',
        variables: ['name', 'props'],
        frontmatter: { description: 'React component' }
      },
      {
        path: '/templates/component/vue/component.vue.njk',
        relativePath: 'component/vue/component.vue.njk',
        name: 'component.vue.njk',
        variables: ['name'],
        frontmatter: { description: 'Vue component' }
      }
    ];
    
    const registry = engine._buildTemplateRegistry(templates);
    
    expect(registry).toMatchObject({
      totalTemplates: 2,
      generators: {
        component: {
          name: 'component',
          description: 'component generator',
          templates: [
            {
              name: 'react',
              variables: ['name', 'props'],
              frontmatter: { description: 'React component' }
            },
            {
              name: 'vue',
              variables: ['name'],
              frontmatter: { description: 'Vue component' }
            }
          ]
        }
      }
    });
  });

  it('should get default values for variables', () => {
    expect(engine._getDefaultValue('name')).toBe('Unnamed');
    expect(engine._getDefaultValue('className')).toBe('DefaultClass');
    expect(engine._getDefaultValue('unknownVariable')).toBe('');
  });

  it('should determine write mode from frontmatter', () => {
    expect(engine._determineWriteMode({ inject: true })).toBe('inject');
    expect(engine._determineWriteMode({ append: true })).toBe('append');
    expect(engine._determineWriteMode({ prepend: true })).toBe('prepend');
    expect(engine._determineWriteMode({ lineAt: 10 })).toBe('lineAt');
    expect(engine._determineWriteMode({})).toBe('write');
  });

  it('should reset engine state correctly', () => {
    // Simulate some pipeline progress
    engine.pipeline.discovered = true;
    engine.pipeline.processed = true;
    engine.metrics.startTime = Date.now();
    
    engine.reset();
    
    expect(engine.pipeline).toEqual({
      discovered: false,
      processed: false,
      rendered: false,
      written: false
    });
    
    expect(engine.metrics.startTime).toBeNull();
  });

  it('should provide status information', () => {
    const status = engine.getStatus();
    
    expect(status).toHaveProperty('pipeline');
    expect(status).toHaveProperty('metrics');
    expect(status).toHaveProperty('config');
    expect(status).toHaveProperty('subsystems');
  });
});

describe('UnjucksApp', () => {
  let app;
  
  beforeEach(() => {
    app = new UnjucksApp({
      templatesDir: '_templates',
      outputDir: './test-output',
      dry: true
    });
  });

  it('should initialize with correct default configuration', () => {
    expect(app.config).toMatchObject({
      templatesDir: '_templates',
      outputDir: './test-output',
      dry: true,
      force: false,
      verbose: false,
      semanticValidation: false,
      templateCaching: true,
      fileWatching: false
    });
  });

  it('should have correct initial state', () => {
    expect(app.state).toEqual({
      initialized: false,
      configLoaded: false,
      templatesDiscovered: false,
      ready: false
    });
  });

  it('should have engine instance', () => {
    expect(app.engine).toBeInstanceOf(UnjucksEngine);
  });

  it('should provide status information', () => {
    const status = app.getStatus();
    
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('config');
    expect(status).toHaveProperty('engine');
    expect(status).toHaveProperty('subsystems');
  });

  it('should generate usage examples correctly', () => {
    const helpInfo = [
      {
        variables: ['name', 'withAuth', 'port'],
        frontmatter: { description: 'API endpoint' }
      }
    ];
    
    const usage = app._generateUsageExample('api', 'endpoint', helpInfo);
    expect(usage).toBe('unjucks api endpoint MyExample --withAuth <value> --port <value>');
  });

  it('should handle missing templates in usage generation', () => {
    const usage = app._generateUsageExample('api', 'endpoint', []);
    expect(usage).toBe('unjucks api endpoint <name>');
  });
});

describe('Core Integration', () => {
  it('should create engine and app instances', () => {
    const engine = new UnjucksEngine();
    const app = new UnjucksApp();
    
    expect(engine).toBeInstanceOf(UnjucksEngine);
    expect(app).toBeInstanceOf(UnjucksApp);
    expect(app.engine).toBeInstanceOf(UnjucksEngine);
  });

  it('should pass configuration to engine', () => {
    const config = {
      templatesDir: './custom-templates',
      outputDir: './custom-output',
      verbose: true
    };
    
    const app = new UnjucksApp(config);
    
    expect(app.config).toMatchObject(config);
    expect(app.engine.config).toMatchObject(config);
  });
});