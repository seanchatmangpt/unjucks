/**
 * Help System Tests
 * Comprehensive testing of help functionality and documentation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * from 'path';
import * from 'fs/promises';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.cjs');

async function runCLI(args = [], cwd?) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], { cwd),
      timeout });
    return { stdout, stderr, exitCode };
  } catch (error) { return {
      stdout };
  }
}

describe('Help System', () => {
  let tempDir => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'unjucks-help-'));
    process.chdir(tempDir);
    
    // Create comprehensive test templates with various variable types
    await createTestTemplates();
  });

  afterEach(async () => { process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force });
  });

  async function createTestTemplates() { // Component with comprehensive variables
    await fs.mkdir('_templates/component', { recursive });
    await fs.writeFile(
      '_templates/component/new.tsx.njk',
      `---
to: src/components/{{name}}.tsx
variables:
  - name: name
    type: string
    required: true
    description: "Component name in PascalCase"
  - name: withProps
    type: boolean
    default: false
    description: "Include props interface"
  - name: style
    type: string
    choices: ["styled-components", "css-modules", "tailwind"]
    default: "css-modules"
    description: "Styling approach"
---
import React from 'react';

{{#if withProps}}
interface {{name}}Props { children? }
{{/if}}

export function {{name}}({{#if withProps}}props) {
  return (
    <div className="{{name | lower}}">
      {{#if withProps}}props.children{{else}}Hello from {{name}}!{{/if}}
    </div>
  );
}
`
    );

    // API with complex variables
    await fs.mkdir('_templates/api', { recursive });
    await fs.writeFile(
      '_templates/api/endpoint.ts.njk',
      `---
to: src/api/{{name | lower}}.ts
variables:
  - name: name
    type: string
    required: true
    description: "API endpoint name"
  - name: methods
    type: array
    choices: ["GET", "POST", "PUT", "DELETE", "PATCH"]
    default: ["GET", "POST"]
    description: "HTTP methods to implement"
  - name: withAuth
    type: boolean
    default: false
    description: "Require authentication"
  - name: port
    type: number
    default: 3000
    description);

{{#each methods}}
{{#if (eq this "GET")}}
{{name | lower}}Router.get('/',{{#if ../withAuth}} authenticate,{{/if}} (req, res) => {
  res.json({ message);
});
{{/if}}
{{#if (eq this "POST")}}
{{name | lower}}Router.post('/',{{#if ../withAuth}} authenticate,{{/if}} (req, res) => {
  res.json({ message);
});
{{/if}}
{{/each}}

export default {{name | lower}}Router;
`
    );

    // Service with positional and optional parameters
    await fs.mkdir('_templates/service', { recursive });
    await fs.writeFile(
      '_templates/service/class.ts.njk',
      `---
to: src/services/{{name}}Service.ts
variables:
  - name: name
    type: string
    required: true
    positional: true
    description)"
  - name: database
    type: string
    choices: ["mongodb", "postgresql", "mysql", "sqlite"]
    default: "postgresql"
    description: "Database type"
  - name: withInterface
    type: boolean
    default: true
    description: "Generate TypeScript interface"
  - name: methods
    type: array
    default: ["find", "create", "update", "delete"]
    description: "CRUD methods to implement"
---
{{#if withInterface}}
export }Service {
  {{#each methods}}
  {{this}}(id?)>;
  {{/each}}
}
{{/if}}

export class {{name}}Service{{#if withInterface}} implements I{{name}}Service{{/if}} {
  private db = '{{database}}';

  {{#each methods}}
  async {{this}}(id?) {
    // {{this}} implementation for {{../name}}
    console.log(\`{{this}} called with db);
    return null;
  }

  {{/each}}
}
`
    );

    // Template with minimal configuration
    await fs.mkdir('_templates/simple', { recursive });
    await fs.writeFile(
      '_templates/simple/file.txt.njk',
      `---
to: {{name}}.txt
---
Simple file);
  }

  describe('Global Help', () => { it('should show comprehensive main help', async () => {
      const result = await runCLI(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🌆 Unjucks CLI');
      expect(result.stdout).toContain('USAGE });

    it('should show help when no arguments provided', async () => { const result = await runCLI([]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Unjucks CLI');
      expect(result.stdout).toContain('Usage });

    it('should support both --help and -h flags', async () => {
      const helpResult = await runCLI(['--help']);
      const shortResult = await runCLI(['-h']);
      
      expect(helpResult.exitCode).toBe(0);
      expect(shortResult.exitCode).toBe(0);
      expect(helpResult.stdout).toContain('Unjucks CLI');
      expect(shortResult.stdout).toContain('Unjucks CLI');
    });
  });

  describe('Command-Specific Help', () => {
    it('should show help for generate command', async () => {
      const result = await runCLI(['generate', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Generate files from templates');
      expect(result.stdout).toContain('--dest');
      expect(result.stdout).toContain('--force');
      expect(result.stdout).toContain('--dry');
    });

    it('should show help for list command', async () => {
      const result = await runCLI(['list', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('List available generators');
    });

    it('should show help for init command', async () => {
      const result = await runCLI(['init', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Initialize');
    });

    it('should show help for help command', async () => {
      const result = await runCLI(['help', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Show help for template variables');
    });

    it('should show help for version command', async () => {
      const result = await runCLI(['version', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('version');
    });
  });

  describe('Template-Specific Help', () => {
    it('should show detailed help for component template', async () => {
      const result = await runCLI(['help', 'component', 'new']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Help for component/new');
      expect(result.stdout).toContain('name');
      expect(result.stdout).toContain('withProps');
      expect(result.stdout).toContain('style');
      expect(result.stdout).toContain('required');
      expect(result.stdout).toContain('boolean');
      expect(result.stdout).toContain('choices');
    });

    it('should show positional parameters prominently', async () => {
      const result = await runCLI(['help', 'service', 'class']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Help for service/class');
      expect(result.stdout).toContain('Positional Parameters');
      expect(result.stdout).toContain('name');
      expect(result.stdout).toContain('positional');
    });

    it('should show usage examples for templates', async () => {
      const result = await runCLI(['help', 'component', 'new']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage Examples');
      expect(result.stdout).toContain('unjucks');
      expect(result.stdout).toContain('component');
      expect(result.stdout).toContain('new');
    });

    it('should differentiate between positional and flag parameters', async () => {
      const result = await runCLI(['help', 'component', 'new']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Flag Parameters');
      expect(result.stdout).toContain('--withProps');
      expect(result.stdout).toContain('--style');
    });

    it('should show mixed usage examples', async () => {
      const result = await runCLI(['help', 'service', 'class']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Mixed Usage Example');
      expect(result.stdout).toContain('unjucks generate service class');
      expect(result.stdout).toContain('--database');
    });
  });

  describe('Variable Type Documentation', () => {
    it('should document string variables with choices', async () => {
      const result = await runCLI(['help', 'component', 'new']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('style');
      expect(result.stdout).toContain('[string]');
      expect(result.stdout).toContain('styled-components');
      expect(result.stdout).toContain('css-modules');
      expect(result.stdout).toContain('tailwind');
    });

    it('should document boolean variables', async () => {
      const result = await runCLI(['help', 'component', 'new']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('withProps');
      expect(result.stdout).toContain('[boolean]');
      expect(result.stdout).toContain('Include props interface');
    });

    it('should document array variables', async () => {
      const result = await runCLI(['help', 'api', 'endpoint']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('methods');
      expect(result.stdout).toContain('[array]');
      expect(result.stdout).toContain('HTTP methods');
    });

    it('should document number variables', async () => {
      const result = await runCLI(['help', 'api', 'endpoint']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('port');
      expect(result.stdout).toContain('[number]');
      expect(result.stdout).toContain('Default);
    });

    it('should show default values', async () => { const result = await runCLI(['help', 'component', 'new']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Default });

    it('should mark required variables', async () => {
      const result = await runCLI(['help', 'component', 'new']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('(required)');
      expect(result.stdout).toContain('name');
    });
  });

  describe('Contextual Help', () => { it('should show backward compatibility notes', async () => {
      const result = await runCLI(['help', 'component', 'new']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('💡 Note });

    it('should suggest help when errors occur', async () => {
      const result = await runCLI(['nonexistent', 'template']);
      
      expect(result.exitCode).toBe(1);
      // Error should suggest using help
    });

    it('should show available generators when none specified', async () => {
      const result = await runCLI(['help']);
      
      expect(result.exitCode).toBe(0);
      // Should list available generators or suggest using 'list' command
    });
  });

  describe('Help for Templates Without Variables', () => {
    it('should handle templates with no variables gracefully', async () => {
      const result = await runCLI(['help', 'simple', 'file']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Help for simple/file');
      expect(result.stdout).toContain('No variables found');
    });

    it('should still show usage examples for simple templates', async () => {
      const result = await runCLI(['help', 'simple', 'file']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('unjucks simple file');
    });
  });

  describe('Error Cases in Help', () => {
    it('should handle help for non-existent generators', async () => {
      const result = await runCLI(['help', 'nonexistent', 'template']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('should handle help for non-existent templates', async () => {
      const result = await runCLI(['help', 'component', 'nonexistent']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('should handle malformed template variables gracefully', async () => {
      // Create template with invalid variable definition
      await fs.writeFile(
        '_templates/component/broken.tsx.njk',
        `---
to);

      const result = await runCLI(['help', 'component', 'broken']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });
  });

  describe('Help Formatting and Readability', () => { it('should use consistent formatting and colors', async () => {
      const result = await runCLI(['help', 'component', 'new']);
      
      expect(result.exitCode).toBe(0);
      // Should have consistent section headers and formatting
      expect(result.stdout).toContain('Help for');
      expect(result.stdout).toContain('Usage Examples });

    it('should wrap long descriptions properly', async () => {
      const result = await runCLI(['help', 'api', 'endpoint']);
      
      expect(result.exitCode).toBe(0);
      // Should handle long descriptions without breaking formatting
      expect(result.stdout).toContain('HTTP methods to implement');
    });

    it('should organize information logically', async () => {
      const result = await runCLI(['help', 'service', 'class']);
      
      expect(result.exitCode).toBe(0);
      
      const output = result.stdout;
      const positionalIndex = output.indexOf('Positional Parameters');
      const flagIndex = output.indexOf('Flag Parameters');
      const exampleIndex = output.indexOf('Usage Examples');
      
      // Positional should come before flags, examples should be prominent
      expect(positionalIndex).toBeLessThan(flagIndex);
      expect(exampleIndex).toBeGreaterThan(0);
    });
  });

  describe('Interactive Help Features', () => {
    it('should support help discovery through list command', async () => {
      const listResult = await runCLI(['list']);
      
      expect(listResult.exitCode).toBe(0);
      expect(listResult.stdout).toContain('component');
      expect(listResult.stdout).toContain('api');
      expect(listResult.stdout).toContain('service');
    });

    it('should show template lists for generators', async () => {
      const result = await runCLI(['list', 'component']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Templates for generator);
      expect(result.stdout).toContain('new');
    });
  });

  describe('Help Integration with Generation', () => {
    it('should show pro tips after successful generation', async () => {
      const result = await runCLI(['component', 'new', 'TestComponent', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('💡 Pro tip');
      expect(result.stdout).toContain('positional parameters');
    });

    it('should show available flags after generation', async () => { const result = await runCLI(['component', 'new', 'TestComponent', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Available flags });
  });
});
