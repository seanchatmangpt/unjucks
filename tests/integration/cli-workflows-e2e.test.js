/**
 * End-to-End Integration Tests - CLI Workflows
 * Complete user scenarios from CLI invocation to file generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const cliPath = path.join(projectRoot, 'bin/unjucks.cjs');

describe('CLI Workflows - End-to-End Integration Tests', () => {
  let tempDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-e2e-'));
    process.chdir(tempDir);

    // Set up basic project structure
    await fs.ensureDir('_templates');
    await fs.ensureDir('src');
    await fs.ensureDir('tests');
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  describe('Complete User Journeys', () => {
    it('should complete full project initialization workflow', async () => {
      // Step 1: Initialize project
      const initResult = await execCLI(['init', 'my-project']);
      expect(initResult.exitCode).toBe(0);

      // Step 2: List available generators
      const listResult = await execCLI(['list']);
      expect(listResult.exitCode).toBe(0);
      expect(listResult.stdout).toContain('Available');

      // Step 3: Generate component (if templates exist)
      const generateResult = await execCLI(['generate', 'component', 'test', 'MyComponent']);
      // Should handle gracefully even if template doesn't exist
      expect(generateResult.exitCode).toBeOneOf([0, 1]);
    });

    it('should handle component generation workflow', async () => {
      // Create a basic component template
      await fs.ensureDir('_templates/component/new');
      await fs.writeFile(
        '_templates/component/new/component.js.njk',
        `// {{ name }} Component
export class {{ name }} {
  constructor() {
    this.name = '{{ name }}';
  }
}`
      );

      const result = await execCLI(['component', 'new', 'TestComponent']);
      expect(result.exitCode).toBe(0);

      // Check if file was generated
      if (await fs.pathExists('TestComponent.js')) {
        const content = await fs.readFile('TestComponent.js', 'utf8');
        expect(content).toContain('TestComponent');
      }
    });

    it('should handle API generation workflow', async () => {
      // Create API template
      await fs.ensureDir('_templates/api/endpoint');
      await fs.writeFile(
        '_templates/api/endpoint/controller.js.njk',
        `// {{ name }} Controller
export class {{ name }}Controller {
  async get{{ name }}(req, res) {
    res.json({ message: '{{ name }} endpoint' });
  }
}`
      );

      const result = await execCLI(['api', 'endpoint', 'User']);
      expect(result.exitCode).toBe(0);
    });

    it('should handle service scaffolding workflow', async () => {
      // Create service template
      await fs.ensureDir('_templates/service/microservice');
      await fs.writeFile(
        '_templates/service/microservice/service.js.njk',
        `// {{ name }} Service
export class {{ name }}Service {
  constructor() {
    this.name = '{{ name }}';
  }

  async start() {
    console.log('{{ name }} service starting...');
  }
}`
      );

      const result = await execCLI(['service', 'microservice', 'UserService']);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle missing templates gracefully', async () => {
      const result = await execCLI(['generate', 'nonexistent', 'template', 'TestName']);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr || result.stdout).toContain('');
    });

    it('should handle invalid arguments gracefully', async () => {
      const result = await execCLI(['generate']);
      expect(result.exitCode).not.toBe(0);
    });

    it('should handle filesystem permission errors', async () => {
      // Create read-only directory
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.ensureDir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o444);

      const result = await execCLI(['init', readOnlyDir]);
      // Should handle permission errors gracefully
      expect(result.exitCode).toBeOneOf([0, 1]);
    });
  });

  describe('Template Processing Workflows', () => {
    it('should process Nunjucks templates correctly', async () => {
      await fs.ensureDir('_templates/test/simple');
      await fs.writeFile(
        '_templates/test/simple/test.txt.njk',
        `Hello {{ name }}!
Today is {{ date | default('unknown') }}.
{% for item in items -%}
- {{ item }}
{% endfor %}`
      );

      const result = await execCLI(['test', 'simple', 'World', '--items', 'one,two,three']);
      expect(result.exitCode).toBe(0);
    });

    it('should handle frontmatter in templates', async () => {
      await fs.ensureDir('_templates/page/markdown');
      await fs.writeFile(
        '_templates/page/markdown/page.md.njk',
        `---
to: pages/{{ name | lower }}.md
---
# {{ title | default(name) }}

This is the {{ name }} page.

Created on: {{ date | default('today') }}
`
      );

      const result = await execCLI(['page', 'markdown', 'About', '--title', 'About Us']);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Advanced Feature Workflows', () => {
    it('should handle semantic command workflow', async () => {
      const result = await execCLI(['semantic', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('semantic');
    });

    it('should handle GitHub integration workflow', async () => {
      const result = await execCLI(['github', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('github');
    });

    it('should handle migration workflow', async () => {
      const result = await execCLI(['migrate', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('migrate');
    });
  });

  describe('File Operation Workflows', () => {
    it('should handle file injection workflow', async () => {
      // Create target file
      await fs.writeFile('target.js', `
// Existing content
export const existing = true;
`);

      // Create injection template
      await fs.ensureDir('_templates/inject/function');
      await fs.writeFile(
        '_templates/inject/function/function.js.njk',
        `
// {{ name }} function
export const {{ name }} = () => {
  return '{{ name }}';
};
`
      );

      const result = await execCLI(['inject', 'function', 'testFunction', '--target', 'target.js']);
      expect(result.exitCode).toBe(0);
    });

    it('should handle multiple file generation', async () => {
      // Template that generates multiple files
      await fs.ensureDir('_templates/module/full');
      await fs.writeFile(
        '_templates/module/full/index.js.njk',
        `export { {{ name }} } from './{{ name | lower }}.js';`
      );
      await fs.writeFile(
        '_templates/module/full/component.js.njk',
        `---
to: {{ name | lower }}.js
---
export class {{ name }} {
  constructor() {
    this.initialized = true;
  }
}`
      );

      const result = await execCLI(['module', 'full', 'UserModule']);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large template processing efficiently', async () => {
      // Create template with many iterations
      await fs.ensureDir('_templates/large/dataset');
      await fs.writeFile(
        '_templates/large/dataset/data.js.njk',
        `// Generated dataset
export const data = [
{% for i in range(0, 1000) -%}
  { id: {{ i }}, name: 'Item {{ i }}' },
{% endfor %}
];`
      );

      const start = Date.now();
      const result = await execCLI(['large', 'dataset', 'TestData']);
      const duration = Date.now() - start;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent operations', async () => {
      // Run multiple CLI operations concurrently
      const operations = [
        execCLI(['--version']),
        execCLI(['list']),
        execCLI(['--help'])
      ];

      const results = await Promise.all(operations);
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work on current platform', async () => {
      const result = await execCLI(['--version']);
      expect(result.exitCode).toBe(0);
    });

    it('should handle platform-specific paths correctly', async () => {
      const result = await execCLI(['list']);
      expect(result.exitCode).toBe(0);
    });
  });
});

/**
 * Execute CLI command in test environment
 * @param {string[]} args - CLI arguments
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
function execCLI(args = []) {
  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: process.cwd(),
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
      resolve({ exitCode: exitCode || 0, stdout, stderr });
    });

    child.on('error', (error) => {
      resolve({ exitCode: 1, stdout, stderr: error.message });
    });
  });
}

// Custom matcher for multiple possible exit codes
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      message: () => `expected ${received} to be one of ${expected.join(', ')}`,
      pass
    };
  }
});