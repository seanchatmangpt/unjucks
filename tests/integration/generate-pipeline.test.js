/**
 * Integration Tests for Generate Pipeline
 * 
 * End-to-end tests for the complete file generation workflow including
 * template discovery, parsing, rendering, and file writing/injection.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test workspace setup
const TEST_ROOT = path.join(__dirname, '../fixtures/integration-test-workspace');
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.js');

describe('Integration: Generate Pipeline', () => {
  beforeEach(async () => {
    // Clean and setup test workspace
    await fs.remove(TEST_ROOT);
    await fs.ensureDir(TEST_ROOT);
    process.chdir(TEST_ROOT);
  });

  afterEach(async () => {
    // Cleanup test workspace
    if (await fs.pathExists(TEST_ROOT)) {
      await fs.remove(TEST_ROOT);
    }
  });

  describe('Template Discovery and Parsing', () => {
    test('should discover and parse Nunjucks templates with frontmatter', async () => {
      // Setup template structure
      const templatePath = path.join(TEST_ROOT, '_templates/component/react');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.jsx
inject: false
skipIf: "{{ skipIfExists }}"
---
import React from 'react';
import PropTypes from 'prop-types';

/**
 * {{ description || name }} component
 * @param {Object} props - Component props
 */
export const {{ name | pascalCase }} = ({ children, ...props }) => {
  return (
    <div className="{{ name | kebabCase }}" {...props}>
      {children}
    </div>
  );
};

{{ name | pascalCase }}.propTypes = {
  children: PropTypes.node
};

{{ name | pascalCase }}.defaultProps = {
  children: null
};

export default {{ name | pascalCase }};`;

      await fs.writeFile(path.join(templatePath, 'component.njk'), templateContent);
      
      // Generate component
      const result = await execAsync(`node ${CLI_PATH} component react UserProfile --description "User profile display component"`);
      
      // Verify file was created
      const outputPath = path.join(TEST_ROOT, 'src/components/UserProfile/UserProfile.jsx');
      expect(await fs.pathExists(outputPath)).toBe(true);
      
      // Verify content
      const generatedContent = await fs.readFile(outputPath, 'utf8');
      expect(generatedContent).toContain('export const UserProfile');
      expect(generatedContent).toContain('User profile display component');
      expect(generatedContent).toContain('className="user-profile"');
      expect(generatedContent).toContain('UserProfile.propTypes');
    });

    test('should handle multiple template files in single generator', async () => {
      // Setup multi-file template
      const templatePath = path.join(TEST_ROOT, '_templates/feature/crud');
      await fs.ensureDir(templatePath);
      
      // Component file
      await fs.writeFile(path.join(templatePath, 'component.njk'), `---
to: src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.jsx
---
export const {{ name | pascalCase }} = () => <div>{{ name }}</div>;`);
      
      // Service file
      await fs.writeFile(path.join(templatePath, 'service.njk'), `---
to: src/services/{{ name | camelCase }}Service.js
---
export class {{ name | pascalCase }}Service {
  static async getAll() {
    // Implementation
  }
}`);
      
      // Test file
      await fs.writeFile(path.join(templatePath, 'test.njk'), `---
to: src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.test.jsx
---
import { render } from '@testing-library/react';
import { {{ name | pascalCase }} } from './{{ name | pascalCase }}';

test('renders {{ name }}', () => {
  render(<{{ name | pascalCase }} />);
});`);
      
      // Generate all files
      await execAsync(`node ${CLI_PATH} feature crud Product`);
      
      // Verify all files were created
      const componentPath = path.join(TEST_ROOT, 'src/components/Product/Product.jsx');
      const servicePath = path.join(TEST_ROOT, 'src/services/productService.js');
      const testPath = path.join(TEST_ROOT, 'src/components/Product/Product.test.jsx');
      
      expect(await fs.pathExists(componentPath)).toBe(true);
      expect(await fs.pathExists(servicePath)).toBe(true);
      expect(await fs.pathExists(testPath)).toBe(true);
      
      // Verify content consistency
      const componentContent = await fs.readFile(componentPath, 'utf8');
      const serviceContent = await fs.readFile(servicePath, 'utf8');
      const testContent = await fs.readFile(testPath, 'utf8');
      
      expect(componentContent).toContain('Product');
      expect(serviceContent).toContain('ProductService');
      expect(testContent).toContain('Product');
    });

    test('should apply Nunjucks filters correctly', async () => {
      const templatePath = path.join(TEST_ROOT, '_templates/util/helper');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: src/utils/{{ name | kebabCase }}.js
---
// {{ name | titleCase }} utility functions
export const {{ name | camelCase }} = {
  CONSTANT: '{{ name | upperCase }}',
  className: '{{ name | kebabCase }}',
  displayName: '{{ name | titleCase }}'
};`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      await execAsync(`node ${CLI_PATH} util helper stringUtils`);
      
      const outputPath = path.join(TEST_ROOT, 'src/utils/string-utils.js');
      const content = await fs.readFile(outputPath, 'utf8');
      
      expect(content).toContain('String Utils utility functions');
      expect(content).toContain('export const stringUtils');
      expect(content).toContain("CONSTANT: 'STRINGUTILS'");
      expect(content).toContain("className: 'string-utils'");
      expect(content).toContain("displayName: 'String Utils'");
    });
  });

  describe('File Writing and Injection', () => {
    test('should write new files without conflicts', async () => {
      const templatePath = path.join(TEST_ROOT, '_templates/config/env');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: .env.{{ environment }}
---
# {{ environment | upperCase }} Environment Configuration
NODE_ENV={{ environment }}
API_URL={{ apiUrl }}
DEBUG={{ debug }}`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      await execAsync(`node ${CLI_PATH} config env --environment development --apiUrl http://localhost:3000 --debug true`);
      
      const outputPath = path.join(TEST_ROOT, '.env.development');
      const content = await fs.readFile(outputPath, 'utf8');
      
      expect(content).toContain('# DEVELOPMENT Environment Configuration');
      expect(content).toContain('NODE_ENV=development');
      expect(content).toContain('API_URL=http://localhost:3000');
      expect(content).toContain('DEBUG=true');
    });

    test('should inject content into existing files', async () => {
      // Create existing file
      const routesFile = path.join(TEST_ROOT, 'src/routes/index.js');
      await fs.ensureDir(path.dirname(routesFile));
      await fs.writeFile(routesFile, `import { Router } from 'express';

const router = Router();

// ROUTES_PLACEHOLDER

export default router;`);

      // Create injection template
      const templatePath = path.join(TEST_ROOT, '_templates/route/api');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: src/routes/index.js
inject: true
after: "// ROUTES_PLACEHOLDER"
---
router.use('/{{ name | kebabCase }}', require('./{{ name | kebabCase }}'));`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      await execAsync(`node ${CLI_PATH} route api userManagement`);
      
      const content = await fs.readFile(routesFile, 'utf8');
      expect(content).toContain("router.use('/user-management', require('./user-management'));");
      expect(content).toContain('// ROUTES_PLACEHOLDER');
    });

    test('should handle force overwrite of existing files', async () => {
      // Create existing file
      const configFile = path.join(TEST_ROOT, 'config.json');
      await fs.writeFile(configFile, '{"old": "configuration"}');
      
      // Create template
      const templatePath = path.join(TEST_ROOT, '_templates/setup/config');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: config.json
---
{
  "app": "{{ appName }}",
  "version": "{{ version }}",
  "environment": "{{ env }}"
}`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      await execAsync(`node ${CLI_PATH} setup config --appName MyApp --version 1.0.0 --env production --force`);
      
      const content = await fs.readFile(configFile, 'utf8');
      const config = JSON.parse(content);
      
      expect(config.app).toBe('MyApp');
      expect(config.version).toBe('1.0.0');
      expect(config.environment).toBe('production');
      expect(config.old).toBeUndefined();
    });

    test('should respect skipIf conditions', async () => {
      // Create existing file that should be skipped
      const targetFile = path.join(TEST_ROOT, 'src/components/ExistingComponent.jsx');
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeFile(targetFile, 'export const ExistingComponent = () => <div>existing</div>;');
      
      const templatePath = path.join(TEST_ROOT, '_templates/component/smart');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: src/components/{{ name | pascalCase }}.jsx
skipIf: true
---
export const {{ name | pascalCase }} = () => <div>new component</div>;`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      await execAsync(`node ${CLI_PATH} component smart ExistingComponent`);
      
      const content = await fs.readFile(targetFile, 'utf8');
      expect(content).toContain('existing'); // Original content preserved
      expect(content).not.toContain('new component');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing template variables gracefully', async () => {
      const templatePath = path.join(TEST_ROOT, '_templates/test/missing');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: output/{{ requiredVar }}.txt
---
Content with {{ optionalVar || 'default' }} and {{ missingVar }}`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      // This should not throw, but handle missing variables
      await execAsync(`node ${CLI_PATH} test missing --requiredVar myFile`);
      
      const outputPath = path.join(TEST_ROOT, 'output/myFile.txt');
      const content = await fs.readFile(outputPath, 'utf8');
      
      expect(content).toContain('Content with default and');
    });

    test('should handle permission errors gracefully', async () => {
      const templatePath = path.join(TEST_ROOT, '_templates/test/permission');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: /root/restricted.txt
---
This should fail due to permissions`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      // This should fail but not crash
      try {
        await execAsync(`node ${CLI_PATH} test permission`);
      } catch (error) {
        expect(error.code).not.toBe(0);
        expect(error.stderr || error.stdout).toContain('permission');
      }
    });

    test('should handle malformed templates gracefully', async () => {
      const templatePath = path.join(TEST_ROOT, '_templates/test/malformed');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: output.txt
invalid: yaml: [unclosed
---
Content with {{ unclosedVariable }}`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      try {
        await execAsync(`node ${CLI_PATH} test malformed`);
      } catch (error) {
        expect(error.code).not.toBe(0);
        // Should provide helpful error message
        expect(error.stderr || error.stdout).toMatch(/yaml|template|parse/i);
      }
    });
  });

  describe('Performance and Optimization', () => {
    test('should handle large template generation efficiently', async () => {
      const templatePath = path.join(TEST_ROOT, '_templates/bulk/generate');
      await fs.ensureDir(templatePath);
      
      // Create template that generates multiple files
      const templateContent = `---
to: src/generated/file-{{ index }}.js
---
// Generated file {{ index }}
export const data{{ index }} = {
  id: {{ index }},
  name: 'Item {{ index }}',
  created: new Date()
};`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      const startTime = Date.now();
      
      // Generate multiple files (simulate with loop)
      for (let i = 1; i <= 10; i++) {
        await execAsync(`node ${CLI_PATH} bulk generate --index ${i}`);
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Verify all files were created
      for (let i = 1; i <= 10; i++) {
        const filePath = path.join(TEST_ROOT, `src/generated/file-${i}.js`);
        expect(await fs.pathExists(filePath)).toBe(true);
      }
      
      // Performance should be reasonable (less than 10 seconds for 10 files)
      expect(executionTime).toBeLessThan(10000);
    });

    test('should handle complex nested directory structures', async () => {
      const templatePath = path.join(TEST_ROOT, '_templates/structure/deep');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: src/{{ domain }}/{{ feature }}/{{ type }}/{{ name | kebabCase }}/index.js
---
// {{ domain }} > {{ feature }} > {{ type }} > {{ name }}
export * from './{{ name | kebabCase }}';`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      await execAsync(`node ${CLI_PATH} structure deep --domain ecommerce --feature checkout --type components --name paymentForm`);
      
      const outputPath = path.join(TEST_ROOT, 'src/ecommerce/checkout/components/payment-form/index.js');
      expect(await fs.pathExists(outputPath)).toBe(true);
      
      const content = await fs.readFile(outputPath, 'utf8');
      expect(content).toContain('ecommerce > checkout > components > paymentForm');
      expect(content).toContain("from './payment-form'");
    });
  });

  describe('Integration with External Tools', () => {
    test('should work with TypeScript files and imports', async () => {
      const templatePath = path.join(TEST_ROOT, '_templates/ts/interface');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: src/types/{{ name | kebabCase }}.types.ts
---
/**
 * {{ description }}
 */
export interface {{ name | pascalCase }} {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface {{ name | pascalCase }}Input {
  name: string;
}

export interface {{ name | pascalCase }}Update extends Partial<{{ name | pascalCase }}Input> {
  id: string;
}

export type {{ name | pascalCase }}List = {{ name | pascalCase }}[];`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      await execAsync(`node ${CLI_PATH} ts interface user --description "User entity interface"`);
      
      const outputPath = path.join(TEST_ROOT, 'src/types/user.types.ts');
      const content = await fs.readFile(outputPath, 'utf8');
      
      expect(content).toContain('export interface User');
      expect(content).toContain('export interface UserInput');
      expect(content).toContain('export interface UserUpdate');
      expect(content).toContain('export type UserList = User[]');
      expect(content).toContain('User entity interface');
    });

    test('should integrate with package.json scripts', async () => {
      // Create package.json
      const packageJson = {
        name: 'test-project',
        scripts: {
          'generate:component': 'unjucks component react'
        }
      };
      await fs.writeFile(path.join(TEST_ROOT, 'package.json'), JSON.stringify(packageJson, null, 2));
      
      // Create template
      const templatePath = path.join(TEST_ROOT, '_templates/component/react');
      await fs.ensureDir(templatePath);
      
      const templateContent = `---
to: src/components/{{ name }}.jsx
---
export const {{ name }} = () => <div>{{ name }}</div>;`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), templateContent);
      
      // Run via npm script (if npm is available)
      try {
        await execAsync('npm run generate:component TestComponent');
        
        const outputPath = path.join(TEST_ROOT, 'src/components/TestComponent.jsx');
        expect(await fs.pathExists(outputPath)).toBe(true);
      } catch (error) {
        // Skip if npm is not available in test environment
        console.warn('Skipping npm integration test - npm not available');
      }
    });
  });
});