/**
 * Backward Compatibility Tests
 * Ensures existing Hygen-style workflows continue to work
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.cjs');

interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCLI(args: string[] = [], cwd?: string): Promise<CLIResult> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      timeout: 30000
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1
    };
  }
}

describe('Backward Compatibility with Hygen', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'unjucks-compat-'));
    process.chdir(tempDir);
    
    // Create comprehensive test structure mimicking Hygen
    await createHygenCompatibleStructure();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createHygenCompatibleStructure() {
    // Component generator
    await fs.mkdir('_templates/component', { recursive: true });
    await fs.writeFile(
      '_templates/component/new.tsx.njk',
      `---
to: src/components/{{name}}.tsx
---
import React from 'react';

interface {{name}}Props {
  {{#if withProps}}
  title?: string;
  {{/if}}
  children?: React.ReactNode;
}

export function {{name}}({{ '{' }}{{#if withProps}} title, {{/if}}children {{ '}' }}: {{name}}Props) {
  return (
    <div className="{{name | lower}}">
      {{#if withProps}}
      {title && <h2>{title}</h2>}
      {{/if}}
      {children}
    </div>
  );
}
`
    );

    // API generator
    await fs.mkdir('_templates/api', { recursive: true });
    await fs.writeFile(
      '_templates/api/new.ts.njk',
      `---
to: src/api/{{name | lower}}.ts
---
import { Router } from 'express';

const {{name | lower}}Router = Router();

{{name | lower}}Router.get('/', (req, res) => {
  res.json({ message: 'Hello from {{name}}!' });
});

{{#if withCrud}}
{{name | lower}}Router.post('/', (req, res) => {
  // Create {{name | lower}}
  res.json({ message: '{{name}} created' });
});

{{name | lower}}Router.put('/:id', (req, res) => {
  // Update {{name | lower}}
  res.json({ message: '{{name}} updated' });
});

{{name | lower}}Router.delete('/:id', (req, res) => {
  // Delete {{name | lower}}
  res.json({ message: '{{name}} deleted' });
});
{{/if}}

export default {{name | lower}}Router;
`
    );

    // Service generator with complex variables
    await fs.mkdir('_templates/service', { recursive: true });
    await fs.writeFile(
      '_templates/service/new.ts.njk',
      `---
to: src/services/{{name}}Service.ts
---
{{#if withInterface}}
interface I{{name}}Service {
  get{{name}}ById(id: string): Promise<{{name}} | null>;
  {{#if withCrud}}
  create{{name}}(data: Create{{name}}Data): Promise<{{name}}>;
  update{{name}}(id: string, data: Update{{name}}Data): Promise<{{name}}>;
  delete{{name}}(id: string): Promise<void>;
  {{/if}}
}
{{/if}}

export class {{name}}Service {{#if withInterface}}implements I{{name}}Service {{/if}}{
  async get{{name}}ById(id: string) {
    // Implementation here
    return null;
  }

  {{#if withCrud}}
  async create{{name}}(data: Create{{name}}Data) {
    // Implementation here
    return {} as {{name}};
  }

  async update{{name}}(id: string, data: Update{{name}}Data) {
    // Implementation here
    return {} as {{name}};
  }

  async delete{{name}}(id: string) {
    // Implementation here
  }
  {{/if}}
}
`
    );

    // Create src directory
    await fs.mkdir('src/components', { recursive: true });
    await fs.mkdir('src/api', { recursive: true });
    await fs.mkdir('src/services', { recursive: true });
  }

  describe('Classic Hygen Patterns', () => {
    it('should support generator template name pattern', async () => {
      const result = await runCLI(['component', 'new', 'MyButton', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('MyButton');
      expect(result.stdout).toContain('src/components/MyButton.tsx');
    });

    it('should support API generation with positional args', async () => {
      const result = await runCLI(['api', 'new', 'UserAPI', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('src/api/userapi.ts');
    });

    it('should support service generation with complex variables', async () => {
      const result = await runCLI(['service', 'new', 'UserService', '--withInterface', '--withCrud', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('src/services/UserServiceService.ts');
    });

    it('should handle mixed positional and flag arguments', async () => {
      const result = await runCLI(['component', 'new', 'HeaderComponent', '--withProps', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('HeaderComponent');
    });
  });

  describe('Variable Precedence (Hygen Compatible)', () => {
    it('should prioritize positional arguments over flags', async () => {
      // name from positional should override --name flag
      const result = await runCLI(['component', 'new', 'PositionalName', '--name', 'FlagName', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('PositionalName');
      expect(result.stdout).not.toContain('FlagName');
    });

    it('should use flag values when no positional equivalent', async () => {
      const result = await runCLI(['component', 'new', 'TestComponent', '--withProps', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('TestComponent');
    });

    it('should handle boolean flags in Hygen style', async () => {
      const result = await runCLI(['service', 'new', 'TestService', '--withInterface', '--withCrud', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('TestService');
    });
  });

  describe('Traditional Hygen Command Patterns', () => {
    it('should support multiple word generators', async () => {
      // Create multi-word generator
      await fs.mkdir('_templates/react-component', { recursive: true });
      await fs.writeFile(
        '_templates/react-component/new.tsx.njk',
        `---
to: src/{{name}}.tsx
---
export function {{name}}() {
  return <div>{{name}}</div>;
}
`
      );

      const result = await runCLI(['react-component', 'new', 'TestComponent', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('TestComponent');
    });

    it('should support dash-separated generators', async () => {
      await fs.mkdir('_templates/express-route', { recursive: true });
      await fs.writeFile(
        '_templates/express-route/new.js.njk',
        `---
to: routes/{{name}}.js
---
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.send('{{name}} route');
});

module.exports = router;
`
      );

      const result = await runCLI(['express-route', 'new', 'users', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('routes/users.js');
    });

    it('should support nested template names', async () => {
      await fs.mkdir('_templates/component/form', { recursive: true });
      await fs.writeFile(
        '_templates/component/form.tsx.njk',
        `---
to: src/forms/{{name}}Form.tsx
---
export function {{name}}Form() {
  return <form>{{name}} Form</form>;
}
`
      );

      const result = await runCLI(['component', 'form', 'User', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('UserForm.tsx');
    });
  });

  describe('Complex Variable Patterns', () => {
    it('should handle camelCase, PascalCase, and kebab-case transformations', async () => {
      await fs.writeFile(
        '_templates/component/style-test.tsx.njk',
        `---
to: src/{{name | kebab}}/{{name}}.tsx
---
// PascalCase: {{name}}
// camelCase: {{name | camel}}
// kebab-case: {{name | kebab}}
// UPPER_CASE: {{name | upper | snake}}

export function {{name}}() {
  return <div className="{{name | kebab}}">{{name}}</div>;
}
`
      );

      const result = await runCLI(['component', 'style-test', 'MyTestComponent', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('MyTestComponent');
    });

    it('should support array and object-like variables', async () => {
      await fs.writeFile(
        '_templates/api/complex.ts.njk',
        `---
to: src/api/{{name}}.ts
---
interface {{name}}Config {
  {{#if fields}}
  {{#each fields}}
  {{this.name}}: {{this.type}};
  {{/each}}
  {{/if}}
}

export const {{name | lower}}Config: {{name}}Config = {
  // Configuration here
};
`
      );

      const result = await runCLI(['api', 'complex', 'UserAPI', '--fields', 'id:string,name:string', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('UserAPI');
    });
  });

  describe('File System Operations (Hygen Compatible)', () => {
    it('should respect existing Hygen directory structures', async () => {
      const result = await runCLI(['component', 'new', 'ExistingComponent']);
      
      expect(result.exitCode).toBe(0);
      
      // Verify file was created in expected location
      const fileExists = await fs.access('src/components/ExistingComponent.tsx')
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(true);
    });

    it('should handle force overwrite like Hygen', async () => {
      // Create initial file
      await runCLI(['component', 'new', 'OverwriteTest']);
      
      // Try to overwrite without force (should fail or prompt)
      const result1 = await runCLI(['component', 'new', 'OverwriteTest']);
      
      // Try to overwrite with force (should succeed)
      const result2 = await runCLI(['component', 'new', 'OverwriteTest', '--force']);
      
      expect(result2.exitCode).toBe(0);
    });

    it('should support dry run mode like Hygen', async () => {
      const result = await runCLI(['component', 'new', 'DryRunTest', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Dry run');
      expect(result.stdout).toContain('no files were created');
      
      // Verify no files were actually created
      const fileExists = await fs.access('src/components/DryRunTest.tsx')
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(false);
    });
  });

  describe('Migration from Pure Hygen', () => {
    it('should work with existing .ejs templates renamed to .njk', async () => {
      // Test both .ejs and .njk extensions
      await fs.writeFile(
        '_templates/component/legacy.tsx.ejs',
        `---
to: src/legacy/<%= name %>.tsx
---
export function <%= name %>() {
  return <div><%= name %></div>;
}
`
      );

      const result = await runCLI(['component', 'legacy', 'LegacyComponent', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('LegacyComponent');
    });

    it('should maintain Hygen-style template discovery', async () => {
      const result = await runCLI(['list']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('component');
      expect(result.stdout).toContain('api');
      expect(result.stdout).toContain('service');
    });

    it('should show Hygen-compatible help', async () => {
      const result = await runCLI(['help', 'component', 'new']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Help for component/new');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing generators gracefully', async () => {
      const result = await runCLI(['nonexistent', 'new', 'Test']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('should handle invalid template syntax gracefully', async () => {
      await fs.writeFile(
        '_templates/component/broken.tsx.njk',
        `---
to: src/{{name}}.tsx
---
{{#invalid syntax}}
This is broken
`
      );

      const result = await runCLI(['component', 'broken', 'Test']);
      
      expect(result.exitCode).toBe(1);
    });

    it('should handle empty generator names', async () => {
      const result = await runCLI(['', 'new', 'Test']);
      
      expect(result.stdout).toContain('Unjucks CLI'); // Should show help
      expect(result.exitCode).toBe(0);
    });
  });
});
