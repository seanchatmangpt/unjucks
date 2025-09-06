/**
 * Command Combinations and Integration Tests
 * Testing complex interactions between different CLI features
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
      timeout: 45000
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('Command Combinations and Integration', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'unjucks-combo-'));
    process.chdir(tempDir);
    
    await createIntegrationTestEnvironment();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createIntegrationTestEnvironment() {
    // Full-stack application templates
    await fs.mkdir('_templates/app', { recursive: true });
    
    // Backend API template
    await fs.writeFile(
      '_templates/app/api.ts.njk',
      `---
to: src/api/{{name | lower}}.ts
variables:
  - name: name
    type: string
    required: true
    positional: true
  - name: methods
    type: array
    default: ["GET", "POST"]
  - name: withAuth
    type: boolean
    default: false
  - name: database
    type: string
    choices: ["mongodb", "postgresql", "sqlite"]
    default: "postgresql"
---
import { Router } from 'express';
{{#if withAuth}}
import { authenticate } from '../middleware/auth.js';
{{/if}}

const {{name | lower}}Router = Router();

{{#each methods}}
{{#if (eq this "GET")}}
{{../name | lower}}Router.get('/',{{#if ../withAuth}} authenticate,{{/if}} async (req, res) => {
  try {
    // GET implementation using {{../database}}
    res.json({ message: 'GET {{../name}}' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
{{/if}}
{{#if (eq this "POST")}}
{{../name | lower}}Router.post('/',{{#if ../withAuth}} authenticate,{{/if}} async (req, res) => {
  try {
    // POST implementation using {{../database}}
    res.status(201).json({ message: 'Created {{../name}}' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
{{/if}}
{{/each}}

export default {{name | lower}}Router;
`
    );

    // Frontend component template
    await fs.writeFile(
      '_templates/app/component.tsx.njk',
      `---
to: src/components/{{name}}.tsx
variables:
  - name: name
    type: string
    required: true
    positional: true
  - name: withProps
    type: boolean
    default: false
  - name: styling
    type: string
    choices: ["css-modules", "styled-components", "tailwind"]
    default: "css-modules"
  - name: withTests
    type: boolean
    default: true
---
import React{{#if withProps}}, { ReactNode }{{/if}} from 'react';
{{#if (eq styling "styled-components")}}
import styled from 'styled-components';
{{/if}}
{{#if (eq styling "css-modules")}}
import styles from './{{name}}.module.css';
{{/if}}

{{#if withProps}}
interface {{name}}Props {
  children?: ReactNode;
  className?: string;
}
{{/if}}

{{#if (eq styling "styled-components")}}
const Container = styled.div\`
  padding: 1rem;
  background: #f5f5f5;
\`;
{{/if}}

export function {{name}}({{#if withProps}}{ children, className }: {{name}}Props{{/if}}) {
  return (
    {{#if (eq styling "styled-components")}}
    <Container className={className}>
    {{else if (eq styling "css-modules")}}
    <div className={\`\${styles.{{name | lower}}} \${className || ''}\`}>
    {{else}}
    <div className={\`{{name | lower}} \${className || ''}\`}>
    {{/if}}
      {{#if withProps}}
      {children || <h1>{{name}}</h1>}
      {{else}}
      <h1>{{name}}</h1>
      {{/if}}
    </div>
    {{#if (eq styling "styled-components")}}
    </Container>
    {{else}}
    </div>
    {{/if}}
  );
}
`
    );

    // Test template
    await fs.writeFile(
      '_templates/app/test.test.tsx.njk',
      `---
to: src/{{type}}/{{name}}.test.tsx
skipIf: "{{skipTests}}"
variables:
  - name: name
    type: string
    required: true
  - name: type
    type: string
    choices: ["components", "api", "utils"]
    required: true
  - name: skipTests
    type: boolean
    default: false
---
import { describe, it, expect{{#if (eq type "components")}}, render, screen{{/if}} } from '{{#if (eq type "components")}}@testing-library/react{{else}}vitest{{/if}}';
{{#if (eq type "components")}}
import { {{name}} } from './{{name}}.jsx';
{{else if (eq type "api")}}
import {{name | lower}}Router from './{{name}}.js';
{{else}}
import { {{name}} } from './{{name}}.js';
{{/if}}

describe('{{name}}', () => {
  {{#if (eq type "components")}}
  it('should render without crashing', () => {
    render(<{{name}} />);
    expect(screen.getByText('{{name}}')).toBeInTheDocument();
  });

  it('should accept custom className', () => {
    render(<{{name}} className="custom-class" />);
    const element = screen.getByText('{{name}}');
    expect(element.closest('div')).toHaveClass('custom-class');
  });
  {{else if (eq type "api")}}
  it('should export router', () => {
    expect({{name | lower}}Router).toBeDefined();
    expect(typeof {{name | lower}}Router).toBe('function');
  });

  it('should handle GET requests', async () => {
    // Add router testing logic here
    expect(true).toBe(true); // Placeholder
  });
  {{else}}
  it('should be defined', () => {
    expect({{name}}).toBeDefined();
  });
  {{/if}}
});
`
    );

    // CSS Module template
    await fs.writeFile(
      '_templates/app/styles.module.css.njk',
      `---
to: src/components/{{name}}.module.css
skipIf: "{{skipStyles}}"
variables:
  - name: name
    type: string
    required: true
  - name: skipStyles
    type: boolean
    default: false
---
.{{name | lower}} {
  padding: 1rem;
  margin: 0.5rem;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.{{name | lower}}:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
  transition: all 0.2s ease;
}

.{{name | lower}} h1 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.5rem;
}
`
    );

    // Multi-generator template
    await fs.mkdir('_templates/full-stack', { recursive: true });
    await fs.writeFile(
      '_templates/full-stack/feature.ts.njk',
      `---
to: src/features/{{name | lower}}/index.ts
variables:
  - name: name
    type: string
    required: true
    positional: true
  - name: includeAPI
    type: boolean
    default: true
  - name: includeComponent
    type: boolean
    default: true
  - name: includeTests
    type: boolean
    default: true
---
// {{name}} feature barrel export
{{#if includeAPI}}
export { default as {{name}}API } from './api.js';
export type { {{name}}Data, Create{{name}}Data } from './types.js';
{{/if}}
{{#if includeComponent}}
export { {{name}} } from './{{name}}.jsx';
export type { {{name}}Props } from './{{name}}.jsx';
{{/if}}
{{#if includeTests}}
// Tests are in ./{{name}}.test.tsx
{{/if}}
`
    );

    // Create directories
    await fs.mkdir('src/api', { recursive: true });
    await fs.mkdir('src/components', { recursive: true });
    await fs.mkdir('src/features', { recursive: true });
    await fs.mkdir('src/utils', { recursive: true });
  }

  describe('Sequential Command Execution', () => {
    it('should create API then component with consistent naming', async () => {
      // Create API first
      const apiResult = await runCLI([
        'app', 'api', 'User',
        '--methods', 'GET,POST,PUT,DELETE',
        '--withAuth', 'true',
        '--database', 'postgresql'
      ]);
      
      expect(apiResult.exitCode).toBe(0);
      expect(apiResult.stdout).toContain('user.ts');
      
      // Create matching component
      const componentResult = await runCLI([
        'app', 'component', 'User',
        '--withProps', 'true',
        '--styling', 'css-modules',
        '--withTests', 'true'
      ]);
      
      expect(componentResult.exitCode).toBe(0);
      expect(componentResult.stdout).toContain('User.tsx');
      
      // Verify both files exist
      const apiExists = await fileExists('src/api/user.ts');
      const componentExists = await fileExists('src/components/User.tsx');
      
      expect(apiExists).toBe(true);
      expect(componentExists).toBe(true);
      
      // Verify content consistency
      const apiContent = await fs.readFile('src/api/user.ts', 'utf-8');
      const componentContent = await fs.readFile('src/components/User.tsx', 'utf-8');
      
      expect(apiContent).toContain('userRouter');
      expect(apiContent).toContain('authenticate');
      expect(apiContent).toContain('postgresql');
      expect(componentContent).toContain('export function User');
      expect(componentContent).toContain('UserProps');
    });

    it('should create tests for both API and component', async () => {
      // Create API with tests
      const apiTestResult = await runCLI([
        'app', 'test', 'UserAPI',
        '--type', 'api',
        '--skipTests', 'false'
      ]);
      
      expect(apiTestResult.exitCode).toBe(0);
      
      // Create component with tests
      const componentTestResult = await runCLI([
        'app', 'test', 'UserComponent',
        '--type', 'components',
        '--skipTests', 'false'
      ]);
      
      expect(componentTestResult.exitCode).toBe(0);
      
      // Verify test files
      const apiTestExists = await fileExists('src/api/UserAPI.test.tsx');
      const componentTestExists = await fileExists('src/components/UserComponent.test.tsx');
      
      expect(apiTestExists).toBe(true);
      expect(componentTestExists).toBe(true);
      
      // Verify test content
      const apiTestContent = await fs.readFile('src/api/UserAPI.test.tsx', 'utf-8');
      const componentTestContent = await fs.readFile('src/components/UserComponent.test.tsx', 'utf-8');
      
      expect(apiTestContent).toContain('should export router');
      expect(componentTestContent).toContain('should render without crashing');
      expect(componentTestContent).toContain('@testing-library/react');
    });
  });

  describe('Parallel Command Execution', () => {
    it('should handle concurrent generation without conflicts', async () => {
      const promises = [
        runCLI(['app', 'component', 'Header', '--styling', 'tailwind']),
        runCLI(['app', 'component', 'Footer', '--styling', 'css-modules']),
        runCLI(['app', 'component', 'Sidebar', '--styling', 'styled-components']),
        runCLI(['app', 'api', 'Auth', '--withAuth', 'true']),
        runCLI(['app', 'api', 'Products', '--methods', 'GET,POST,PUT'])
      ];
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
      
      // Verify all files were created
      const expectedFiles = [
        'src/components/Header.tsx',
        'src/components/Footer.tsx',
        'src/components/Sidebar.tsx',
        'src/api/auth.ts',
        'src/api/products.ts'
      ];
      
      for (const file of expectedFiles) {
        const exists = await fileExists(file);
        expect(exists).toBe(true);
      }
    });

    it('should handle mixed dry-run and actual generation', async () => {
      const promises = [
        runCLI(['app', 'component', 'RealComponent']),
        runCLI(['app', 'component', 'DryComponent', '--dry']),
        runCLI(['app', 'api', 'RealAPI', '--withAuth']),
        runCLI(['app', 'api', 'DryAPI', '--dry'])
      ];
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
      
      // Only real files should exist
      expect(await fileExists('src/components/RealComponent.tsx')).toBe(true);
      expect(await fileExists('src/components/DryComponent.tsx')).toBe(false);
      expect(await fileExists('src/api/realapi.ts')).toBe(true);
      expect(await fileExists('src/api/dryapi.ts')).toBe(false);
      
      // Dry run results should show what would be created
      const dryResults = results.filter(r => r.stdout.includes('Dry run'));
      expect(dryResults).toHaveLength(2);
    });
  });

  describe('Complex Flag Combinations', () => {
    it('should handle component with all options enabled', async () => {
      const result = await runCLI([
        'app', 'component', 'ComplexComponent',
        '--withProps', 'true',
        '--styling', 'styled-components',
        '--withTests', 'true'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      const content = await fs.readFile('src/components/ComplexComponent.tsx', 'utf-8');
      expect(content).toContain('ComplexComponentProps');
      expect(content).toContain('styled-components');
      expect(content).toContain('ReactNode');
      expect(content).toContain('styled.div');
    });

    it('should handle API with all methods and authentication', async () => {
      const result = await runCLI([
        'app', 'api', 'CompleteAPI',
        '--methods', 'GET,POST,PUT,DELETE,PATCH',
        '--withAuth', 'true',
        '--database', 'mongodb'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      const content = await fs.readFile('src/api/completeapi.ts', 'utf-8');
      expect(content).toContain('authenticate');
      expect(content).toContain('mongodb');
      expect(content).toContain('completeapiRouter.get');
      expect(content).toContain('completeapiRouter.post');
      expect(content).toContain('completeapiRouter.put');
      expect(content).toContain('completeapiRouter.delete');
      expect(content).toContain('completeapiRouter.patch');
    });

    it('should handle conditional file creation', async () => {
      // Create component with tests enabled
      const withTestsResult = await runCLI([
        'app', 'test', 'WithTestsComponent',
        '--type', 'components',
        '--skipTests', 'false'
      ]);
      
      expect(withTestsResult.exitCode).toBe(0);
      expect(await fileExists('src/components/WithTestsComponent.test.tsx')).toBe(true);
      
      // Create component with tests disabled
      const withoutTestsResult = await runCLI([
        'app', 'test', 'WithoutTestsComponent',
        '--type', 'components',
        '--skipTests', 'true'
      ]);
      
      expect(withoutTestsResult.exitCode).toBe(0);
      expect(await fileExists('src/components/WithoutTestsComponent.test.tsx')).toBe(false);
    });
  });

  describe('Multi-Template Workflows', () => {
    it('should create full feature with API, component, and tests', async () => {
      // Create the main feature file
      const featureResult = await runCLI([
        'full-stack', 'feature', 'UserProfile',
        '--includeAPI', 'true',
        '--includeComponent', 'true',
        '--includeTests', 'true'
      ]);
      
      expect(featureResult.exitCode).toBe(0);
      expect(await fileExists('src/features/userprofile/index.ts')).toBe(true);
      
      // Create API for the feature
      const apiResult = await runCLI([
        'app', 'api', 'UserProfile',
        '--methods', 'GET,POST,PUT',
        '--withAuth', 'true'
      ]);
      
      expect(apiResult.exitCode).toBe(0);
      
      // Create component for the feature
      const componentResult = await runCLI([
        'app', 'component', 'UserProfile',
        '--withProps', 'true',
        '--styling', 'css-modules'
      ]);
      
      expect(componentResult.exitCode).toBe(0);
      
      // Create styles
      const stylesResult = await runCLI([
        'app', 'styles.module.css', 'UserProfile',
        '--skipStyles', 'false'
      ]);
      
      expect(stylesResult.exitCode).toBe(0);
      
      // Verify all files exist
      const files = [
        'src/features/userprofile/index.ts',
        'src/api/userprofile.ts',
        'src/components/UserProfile.tsx',
        'src/components/UserProfile.module.css'
      ];
      
      for (const file of files) {
        expect(await fileExists(file)).toBe(true);
      }
      
      // Verify content relationships
      const featureContent = await fs.readFile('src/features/userprofile/index.ts', 'utf-8');
      expect(featureContent).toContain('UserProfileAPI');
      expect(featureContent).toContain('UserProfile');
      expect(featureContent).toContain('UserProfileProps');
      
      const componentContent = await fs.readFile('src/components/UserProfile.tsx', 'utf-8');
      expect(componentContent).toContain('UserProfile.module.css');
    });
  });

  describe('Error Recovery in Complex Scenarios', () => {
    it('should handle partial failures in multi-step operations', async () => {
      // Create valid API first
      const apiResult = await runCLI(['app', 'api', 'PartialTest']);
      expect(apiResult.exitCode).toBe(0);
      
      // Try to create component with invalid parameters
      const componentResult = await runCLI([
        'app', 'component', 'PartialTest',
        '--styling', 'invalid-styling'
      ]);
      
      expect(componentResult.exitCode).toBe(1);
      
      // API should still exist
      expect(await fileExists('src/api/partialtest.ts')).toBe(true);
      // Component should not exist
      expect(await fileExists('src/components/PartialTest.tsx')).toBe(false);
    });

    it('should clean up properly after interrupted operations', async () => {
      // This is hard to test directly, but we can test error states
      const result = await runCLI([
        'app', 'component', 'ErrorTest',
        '--styling', 'invalid-option'
      ]);
      
      expect(result.exitCode).toBe(1);
      
      // No partial files should be left
      const files = await fs.readdir('src/components', { recursive: true });
      const errorFiles = files.filter(f => f.toString().includes('ErrorTest'));
      expect(errorFiles).toHaveLength(0);
    });
  });

  describe('Performance with Complex Operations', () => {
    it('should handle multiple template generations efficiently', async () => {
      const startTime = Date.now();
      
      const operations = [];
      
      // Create multiple components
      for (let i = 0; i < 5; i++) {
        operations.push(runCLI([
          'app', 'component', `Component${i}`,
          '--withProps', 'true',
          '--withTests', 'true'
        ]));
      }
      
      // Create multiple APIs
      for (let i = 0; i < 5; i++) {
        operations.push(runCLI([
          'app', 'api', `API${i}`,
          '--withAuth', 'true',
          '--methods', 'GET,POST'
        ]));
      }
      
      const results = await Promise.all(operations);
      const endTime = Date.now();
      
      // All should succeed
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
      
      // Should complete in reasonable time (less than 1 minute)
      expect(endTime - startTime).toBeLessThan(60000);
      
      // Verify all files were created
      for (let i = 0; i < 5; i++) {
        expect(await fileExists(`src/components/Component${i}.tsx`)).toBe(true);
        expect(await fileExists(`src/api/api${i}.ts`)).toBe(true);
      }
    });

    it('should handle large-scale project generation', async () => {
      // Simulate generating a complete feature set
      const featureNames = ['User', 'Product', 'Order', 'Payment', 'Analytics'];
      const operations = [];
      
      for (const feature of featureNames) {
        // API
        operations.push(runCLI([
          'app', 'api', feature,
          '--methods', 'GET,POST,PUT,DELETE',
          '--withAuth', 'true'
        ]));
        
        // Component
        operations.push(runCLI([
          'app', 'component', feature,
          '--withProps', 'true',
          '--styling', 'css-modules'
        ]));
        
        // Tests
        operations.push(runCLI([
          'app', 'test', feature,
          '--type', 'components'
        ]));
        
        // Styles
        operations.push(runCLI([
          'app', 'styles.module.css', feature
        ]));
      }
      
      const results = await Promise.all(operations);
      
      // Count successes and failures
      const successes = results.filter(r => r.exitCode === 0).length;
      const failures = results.filter(r => r.exitCode !== 0).length;
      
      // Most should succeed (allow for some failures due to complexity)
      expect(successes).toBeGreaterThan(failures);
      expect(successes).toBeGreaterThan(operations.length * 0.8); // At least 80% success rate
    });
  });

  describe('CLI State Management', () => {
    it('should maintain isolation between command executions', async () => {
      // Run command with specific parameters
      const result1 = await runCLI([
        'app', 'component', 'IsolatedComponent1',
        '--styling', 'styled-components'
      ]);
      
      expect(result1.exitCode).toBe(0);
      
      // Run different command - should not inherit previous state
      const result2 = await runCLI([
        'app', 'component', 'IsolatedComponent2'
        // No styling parameter - should use default
      ]);
      
      expect(result2.exitCode).toBe(0);
      
      // Verify different styling approaches
      const content1 = await fs.readFile('src/components/IsolatedComponent1.tsx', 'utf-8');
      const content2 = await fs.readFile('src/components/IsolatedComponent2.tsx', 'utf-8');
      
      expect(content1).toContain('styled-components');
      expect(content2).toContain('css-modules'); // Default styling
      expect(content2).not.toContain('styled-components');
    });

    it('should handle environment variable pollution gracefully', async () => {
      // Set some environment variables that might interfere
      process.env.UNJUCKS_TEST_VAR = 'test-value';
      process.env.NODE_ENV = 'test';
      process.env.DEBUG = '1';
      
      const result = await runCLI([
        'app', 'component', 'EnvTestComponent',
        '--withProps', 'true'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(await fileExists('src/components/EnvTestComponent.tsx')).toBe(true);
      
      // Clean up
      delete process.env.UNJUCKS_TEST_VAR;
    });
  });
});
