/**
 * Test Utilities and Helpers
 * 
 * Common utilities for setting up test environments, mocking dependencies,
 * and asserting complex conditions across the test suite.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test workspace manager for isolated test environments
 */
export class TestWorkspace {
  constructor(baseName = 'test-workspace') {
    this.baseName = baseName;
    this.workspaceId = `${baseName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.rootPath = path.join(__dirname, '../fixtures', this.workspaceId);
    this.originalCwd = process.cwd();
  }

  /**
   * Create and enter the test workspace
   */
  async setup() {
    await fs.ensureDir(this.rootPath);
    process.chdir(this.rootPath);
    return this.rootPath;
  }

  /**
   * Clean up and exit the test workspace
   */
  async cleanup() {
    process.chdir(this.originalCwd);
    if (await fs.pathExists(this.rootPath)) {
      await fs.remove(this.rootPath);
    }
  }

  /**
   * Create a file in the workspace
   */
  async createFile(relativePath, content) {
    const fullPath = path.join(this.rootPath, relativePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
    return fullPath;
  }

  /**
   * Create a directory in the workspace
   */
  async createDir(relativePath) {
    const fullPath = path.join(this.rootPath, relativePath);
    await fs.ensureDir(fullPath);
    return fullPath;
  }

  /**
   * Read a file from the workspace
   */
  async readFile(relativePath) {
    const fullPath = path.join(this.rootPath, relativePath);
    return await fs.readFile(fullPath, 'utf8');
  }

  /**
   * Check if a file exists in the workspace
   */
  async exists(relativePath) {
    const fullPath = path.join(this.rootPath, relativePath);
    return await fs.pathExists(fullPath);
  }

  /**
   * Get the full path for a relative path in the workspace
   */
  path(relativePath) {
    return path.join(this.rootPath, relativePath);
  }

  /**
   * List files in a directory
   */
  async listFiles(relativePath = '.') {
    const fullPath = path.join(this.rootPath, relativePath);
    try {
      return await fs.readdir(fullPath);
    } catch (error) {
      return [];
    }
  }

  /**
   * Create a template structure
   */
  async createTemplate(generator, template, content, frontmatter = {}) {
    const templatePath = path.join('_templates', generator, template);
    await this.createDir(templatePath);
    
    const templateContent = `---
${Object.entries(frontmatter).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}
---
${content}`;

    return await this.createFile(path.join(templatePath, 'index.njk'), templateContent);
  }
}

/**
 * Template factory for creating test templates
 */
export class TemplateFactory {
  static simpleComponent(name = 'TestComponent') {
    return {
      generator: 'component',
      template: 'react',
      content: `import React from 'react';

export const {{ name }} = () => {
  return <div>{{ name }}</div>;
};`,
      frontmatter: {
        to: 'src/components/{{ name }}.jsx'
      },
      variables: { name }
    };
  }

  static apiRoute(name = 'users') {
    return {
      generator: 'api',
      template: 'express',
      content: `import { Router } from 'express';

const router = Router();

router.get('/{{ name }}', (req, res) => {
  res.json({ message: '{{ name }} endpoint' });
});

export default router;`,
      frontmatter: {
        to: 'src/routes/{{ name }}.js'
      },
      variables: { name }
    };
  }

  static configFile(env = 'development') {
    return {
      generator: 'config',
      template: 'env',
      content: `NODE_ENV={{ env }}
API_URL={{ apiUrl }}
DATABASE_URL={{ dbUrl }}`,
      frontmatter: {
        to: '.env.{{ env }}'
      },
      variables: { env, apiUrl: 'http://localhost:3000', dbUrl: 'sqlite://dev.db' }
    };
  }

  static injectionTemplate(targetFile = 'src/index.js') {
    return {
      generator: 'inject',
      template: 'import',
      content: `import { {{ name }} } from './{{ path }}';`,
      frontmatter: {
        to: targetFile,
        inject: true,
        after: '// IMPORTS_PLACEHOLDER'
      },
      variables: { name: 'TestModule', path: './test-module' }
    };
  }

  static multiFileTemplate() {
    return {
      generator: 'feature',
      template: 'crud',
      files: [
        {
          content: `export class {{ name }}Service {
  async findAll() {
    return [];
  }
}`,
          frontmatter: {
            to: 'src/services/{{ name | kebabCase }}.service.js'
          }
        },
        {
          content: `import { {{ name }}Service } from '../services/{{ name | kebabCase }}.service.js';

export class {{ name }}Controller {
  constructor() {
    this.service = new {{ name }}Service();
  }
}`,
          frontmatter: {
            to: 'src/controllers/{{ name | kebabCase }}.controller.js'
          }
        },
        {
          content: `import { test, expect } from 'vitest';
import { {{ name }}Service } from '../{{ name | kebabCase }}.service.js';

test('{{ name }}Service should work', () => {
  const service = new {{ name }}Service();
  expect(service).toBeDefined();
});`,
          frontmatter: {
            to: 'src/services/{{ name | kebabCase }}.service.test.js'
          }
        }
      ],
      variables: { name: 'User' }
    };
  }
}

/**
 * Mock factory for creating test mocks
 */
export class MockFactory {
  static fileSystem() {
    return {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      access: vi.fn(),
      ensureDir: vi.fn(),
      pathExists: vi.fn(),
      remove: vi.fn(),
      stat: vi.fn()
    };
  }

  static logger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      level: 'info',
      startTimer: vi.fn(),
      endTimer: vi.fn(() => 100),
      shouldLog: vi.fn(() => true),
      child: vi.fn(() => MockFactory.logger())
    };
  }

  static performanceMonitor() {
    return {
      startOperation: vi.fn(() => 'timer-id'),
      endOperation: vi.fn(() => ({ operationId: 'test', duration: 100 })),
      recordOperation: vi.fn(),
      recordError: vi.fn(),
      generateReport: vi.fn(() => ({
        summary: { totalOperations: 0, totalErrors: 0 },
        operations: {},
        errors: {},
        system: {}
      })),
      getInsights: vi.fn(() => ({
        recommendations: [],
        warnings: [],
        highlights: []
      })),
      getActiveOperationsCount: vi.fn(() => 0),
      cleanup: vi.fn()
    };
  }

  static templateScanner() {
    return {
      getGenerators: vi.fn(() => Promise.resolve([])),
      getTemplatesForGenerator: vi.fn(() => Promise.resolve([])),
      getTemplatePath: vi.fn((gen, tpl) => Promise.resolve(`/_templates/${gen}/${tpl}`)),
      readTemplate: vi.fn(() => Promise.resolve('')),
      hasTemplates: vi.fn(() => Promise.resolve(true)),
      getTemplateMetadata: vi.fn(() => Promise.resolve({})),
      refresh: vi.fn(() => Promise.resolve(true))
    };
  }

  static command() {
    return {
      execute: vi.fn(() => Promise.resolve({ success: true, message: 'Command executed' }))
    };
  }
}

/**
 * Assertion helpers for complex test scenarios
 */
export class TestAssertions {
  /**
   * Assert that generated files match expected structure
   */
  static async assertFileStructure(workspace, expectedFiles) {
    for (const filePath of expectedFiles) {
      const exists = await workspace.exists(filePath);
      if (!exists) {
        throw new Error(`Expected file not found: ${filePath}`);
      }
    }
  }

  /**
   * Assert that file content matches patterns
   */
  static async assertFileContent(workspace, filePath, patterns) {
    const content = await workspace.readFile(filePath);
    
    for (const pattern of patterns) {
      if (typeof pattern === 'string') {
        if (!content.includes(pattern)) {
          throw new Error(`Pattern "${pattern}" not found in ${filePath}`);
        }
      } else if (pattern instanceof RegExp) {
        if (!pattern.test(content)) {
          throw new Error(`Pattern ${pattern} not found in ${filePath}`);
        }
      }
    }
  }

  /**
   * Assert performance metrics are within acceptable bounds
   */
  static assertPerformance(metrics, expectations) {
    if (expectations.maxDuration && metrics.duration > expectations.maxDuration) {
      throw new Error(`Performance expectation failed: duration ${metrics.duration}ms > ${expectations.maxDuration}ms`);
    }

    if (expectations.maxMemory && metrics.memoryUsed > expectations.maxMemory) {
      throw new Error(`Memory expectation failed: memory ${metrics.memoryUsed} > ${expectations.maxMemory}`);
    }
  }

  /**
   * Assert that CLI output matches expected patterns
   */
  static assertCliOutput(output, expectations) {
    const { stdout = '', stderr = '', exitCode } = output;
    const fullOutput = stdout + stderr;

    if (expectations.exitCode !== undefined && exitCode !== expectations.exitCode) {
      throw new Error(`Expected exit code ${expectations.exitCode}, got ${exitCode}`);
    }

    if (expectations.contains) {
      for (const pattern of expectations.contains) {
        if (!fullOutput.includes(pattern)) {
          throw new Error(`Expected output to contain "${pattern}"`);
        }
      }
    }

    if (expectations.notContains) {
      for (const pattern of expectations.notContains) {
        if (fullOutput.includes(pattern)) {
          throw new Error(`Expected output to not contain "${pattern}"`);
        }
      }
    }

    if (expectations.matches) {
      for (const pattern of expectations.matches) {
        if (!pattern.test(fullOutput)) {
          throw new Error(`Expected output to match pattern ${pattern}`);
        }
      }
    }
  }
}

/**
 * Data generators for test scenarios
 */
export class TestDataGenerator {
  /**
   * Generate realistic template variables
   */
  static templateVariables(count = 5) {
    const variables = {};
    const names = ['name', 'description', 'author', 'version', 'type'];
    const values = ['TestEntity', 'A test entity', 'Test Author', '1.0.0', 'component'];

    for (let i = 0; i < count; i++) {
      variables[names[i % names.length]] = values[i % values.length];
    }

    return variables;
  }

  /**
   * Generate complex template content
   */
  static complexTemplate(options = {}) {
    const {
      includeConditionals = true,
      includeLoops = true,
      includeFilters = true,
      variableCount = 5
    } = options;

    let template = `---
to: {{ outputPath || 'output.js' }}
inject: {{ inject || false }}
---
`;

    template += `// Generated {{ entityType || 'entity' }}: {{ name }}
`;

    if (includeConditionals) {
      template += `{% if withTypeScript %}
interface {{ name }}Props {
  id: string;
  name: string;
}
{% endif %}
`;
    }

    template += `export class {{ name | pascalCase }} {
  constructor({{ constructorParams | join(', ') }}) {
    this.id = id;
    this.name = name;
  }
`;

    if (includeLoops) {
      template += `
  {% for method in methods %}
  {{ method.name }}({{ method.params | join(', ') }}) {
    // TODO: Implement {{ method.name }}
  }
  {% endfor %}
`;
    }

    if (includeFilters) {
      template += `
  get displayName() {
    return '{{ name | titleCase }}';
  }

  get identifier() {
    return '{{ name | kebabCase }}';
  }
`;
    }

    template += `}
`;

    return template;
  }

  /**
   * Generate test file structures
   */
  static projectStructure(depth = 3, breadth = 3) {
    const structure = [];
    
    function generateLevel(currentDepth, parentPath = '') {
      if (currentDepth === 0) return;
      
      for (let i = 0; i < breadth; i++) {
        const itemName = `item${i}`;
        const itemPath = parentPath ? `${parentPath}/${itemName}` : itemName;
        
        if (currentDepth === 1) {
          // Create files at leaf level
          structure.push({
            type: 'file',
            path: `${itemPath}.js`,
            content: `// Generated file: ${itemPath}`
          });
        } else {
          // Create directories and recurse
          structure.push({
            type: 'directory',
            path: itemPath
          });
          generateLevel(currentDepth - 1, itemPath);
        }
      }
    }
    
    generateLevel(depth);
    return structure;
  }
}

/**
 * Test timing utilities
 */
export class TestTimer {
  constructor() {
    this.startTime = 0;
    this.marks = new Map();
  }

  start() {
    this.startTime = performance.now();
    return this;
  }

  mark(label) {
    this.marks.set(label, performance.now());
    return this;
  }

  elapsed(label) {
    if (label && this.marks.has(label)) {
      return performance.now() - this.marks.get(label);
    }
    return performance.now() - this.startTime;
  }

  getDuration(startLabel, endLabel) {
    if (!this.marks.has(startLabel) || !this.marks.has(endLabel)) {
      throw new Error(`Mark not found: ${startLabel} or ${endLabel}`);
    }
    return this.marks.get(endLabel) - this.marks.get(startLabel);
  }

  summary() {
    const marks = Array.from(this.marks.entries()).map(([label, time]) => ({
      label,
      time: time - this.startTime,
      absolute: time
    }));

    return {
      totalTime: performance.now() - this.startTime,
      marks
    };
  }
}

/**
 * Environment utilities for tests
 */
export class TestEnvironment {
  static async setupMinimalProject(workspace) {
    // Create package.json
    await workspace.createFile('package.json', JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      type: 'module'
    }, null, 2));

    // Create basic directory structure
    await workspace.createDir('src');
    await workspace.createDir('tests');
    await workspace.createDir('_templates');

    return workspace;
  }

  static async setupFullProject(workspace) {
    await this.setupMinimalProject(workspace);

    // Add more realistic project structure
    await workspace.createFile('src/index.js', 'export * from "./lib";');
    await workspace.createFile('src/lib/index.js', '// Library exports');
    await workspace.createDir('src/components');
    await workspace.createDir('src/services');
    await workspace.createDir('src/utils');

    // Add configuration files
    await workspace.createFile('.gitignore', 'node_modules/\ndist/\n.env*');
    await workspace.createFile('README.md', '# Test Project\n\nA test project for Unjucks testing.');

    return workspace;
  }

  static mockEnvironmentVariables(variables) {
    const originalEnv = { ...process.env };
    
    Object.assign(process.env, variables);
    
    return () => {
      // Restore original environment
      Object.keys(variables).forEach(key => {
        delete process.env[key];
      });
      Object.assign(process.env, originalEnv);
    };
  }
}

// Export convenience functions
export const createWorkspace = (name) => new TestWorkspace(name);
export const createTimer = () => new TestTimer();
export const mockFS = () => MockFactory.fileSystem();
export const mockLogger = () => MockFactory.logger();
export const assert = TestAssertions;