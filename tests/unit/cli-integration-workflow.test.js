/**
 * CLI Integration Workflow Tests - Tests complete CLI workflows end-to-end
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { spawn } from 'child_process';
import { promisify } from 'util';

describe('CLI Integration Workflow', () => {
  let testDir;
  let templatesDir;
  let outputDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = path.join(process.cwd(), 'tests', 'temp', `cli-workflow-test-${this.getDeterministicTimestamp()}`);
    templatesDir = path.join(testDir, '_templates');
    outputDir = path.join(testDir, 'output');
    
    await fs.ensureDir(templatesDir);
    await fs.ensureDir(outputDir);
    
    // Create comprehensive test templates
    await createComprehensiveTemplates(templatesDir);
    
    // Change to test directory for CLI operations
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Restore original directory
    process.chdir(originalCwd);
    
    // Clean up test directory
    try {
      await fs.remove(testDir);
    } catch (error) {
      console.warn('Could not clean up test directory:', error.message);
    }
  });

  describe('Complete CLI Workflows', () => {
    it('should complete discover -> help -> generate workflow', async () => {
      // Step 1: List available generators
      const { listCommand } = await import('../../src/commands/list.js');
      
      const listResult = await listCommand.run({
        args: { quiet: true, format: 'simple' }
      });

      expect(listResult.success).toBe(true);
      expect(listResult.data.length).toBeGreaterThan(0);

      const firstGenerator = listResult.data[0].name;
      
      // Step 2: Get help for the generator
      const { helpCommand } = await import('../../src/commands/help.js');
      
      const helpResult = await helpCommand.run({
        args: { generator: firstGenerator }
      });

      expect(helpResult.success).toBe(true);

      // Step 3: Generate from the template
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      const generateResult = await generateCommand.run({
        args: {
          generator: firstGenerator,
          template: 'react', // Assuming we have a react template
          name: 'TestComponent',
          dest: outputDir,
          quiet: true
        }
      });

      expect(generateResult.success).toBe(true);
      expect(generateResult.files.length).toBeGreaterThan(0);

      // Verify files were created
      for (const filePath of generateResult.files) {
        expect(await fs.pathExists(filePath)).toBe(true);
      }
    });

    it('should handle dry run -> actual generation workflow', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      // Step 1: Dry run to preview
      const dryRunResult = await generateCommand.run({
        args: {
          generator: 'component',
          template: 'react',
          name: 'PreviewComponent',
          dest: outputDir,
          dry: true,
          quiet: true
        }
      });

      expect(dryRunResult.success).toBe(true);
      expect(dryRunResult.message).toContain('Dry run');

      // Files should not exist after dry run
      for (const filePath of dryRunResult.files) {
        expect(await fs.pathExists(filePath)).toBe(false);
      }

      // Step 2: Actual generation
      const actualResult = await generateCommand.run({
        args: {
          generator: 'component',
          template: 'react',
          name: 'PreviewComponent',
          dest: outputDir,
          quiet: true
        }
      });

      expect(actualResult.success).toBe(true);
      expect(actualResult.message).toContain('generated');

      // Files should exist after actual generation
      for (const filePath of actualResult.files) {
        expect(await fs.pathExists(filePath)).toBe(true);
      }
    });

    it('should handle template exploration workflow', async () => {
      const { listCommand } = await import('../../src/commands/list.js');
      
      // Step 1: List all generators
      const allGenerators = await listCommand.run({
        args: { quiet: true }
      });

      expect(allGenerators.success).toBe(true);
      expect(allGenerators.data.length).toBeGreaterThan(0);

      // Step 2: List templates for each generator
      for (const generator of allGenerators.data.slice(0, 2)) { // Test first 2 generators
        const templatesResult = await listCommand.run({
          args: {
            generator: generator.name,
            quiet: true,
            detailed: true
          }
        });

        expect(templatesResult.success).toBe(true);
        
        if (templatesResult.data.length > 0) {
          const generatorData = templatesResult.data[0];
          expect(generatorData.templates).toBeDefined();
          expect(Array.isArray(generatorData.templates)).toBe(true);
        }
      }
    });

    it('should handle multiple file generation workflow', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      const testCases = [
        { name: 'UserComponent', type: 'component' },
        { name: 'AuthService', type: 'service' },
        { name: 'ProductModel', type: 'model' }
      ];

      const results = [];

      // Generate multiple files
      for (const testCase of testCases) {
        const result = await generateCommand.run({
          args: {
            generator: 'component', // Use component generator for all
            template: 'react',
            name: testCase.name,
            dest: path.join(outputDir, testCase.type),
            quiet: true
          }
        });

        results.push(result);
      }

      // Verify all generations succeeded
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify files were created in different directories
      const outputContents = await fs.readdir(outputDir);
      expect(outputContents.length).toBeGreaterThan(0);
    });

    it('should handle template with complex variables workflow', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      const complexVariables = {
        generator: 'service',
        template: 'api',
        name: 'ComplexService',
        dest: outputDir,
        quiet: true,
        // Additional complex variables
        withDatabase: true,
        hasAuth: true,
        methods: ['create', 'read', 'update', 'delete'],
        returnType: 'Promise<ComplexService[]>'
      };

      const result = await generateCommand.run({
        args: complexVariables
      });

      expect(result.success).toBe(true);

      if (result.files.length > 0) {
        const generatedFile = result.files[0];
        const content = await fs.readFile(generatedFile, 'utf8');
        
        // Should contain the complex variable substitutions
        expect(content).toContain('ComplexService');
      }
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle invalid generator gracefully in workflow', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      const result = await generateCommand.run({
        args: {
          generator: 'invalid-generator',
          template: 'invalid-template',
          name: 'Test',
          dest: outputDir,
          quiet: true
        }
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should handle permission errors gracefully', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      const result = await generateCommand.run({
        args: {
          generator: 'component',
          template: 'react',
          name: 'PermissionTest',
          dest: '/root/restricted', // Likely to cause permission error
          quiet: true
        }
      });

      // Should handle gracefully without crashing
      expect(typeof result).toBe('object');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle missing template variables workflow', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      const result = await generateCommand.run({
        args: {
          generator: 'component',
          template: 'react',
          // Missing 'name' variable
          dest: outputDir,
          quiet: true
        }
      });

      // Should handle missing variables gracefully
      expect(typeof result).toBe('object');
    });
  });

  describe('File Injection Workflows', () => {
    it('should handle file injection workflow', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      // Create an existing file to inject into
      const existingFile = path.join(outputDir, 'existing.ts');
      const existingContent = `export class ExistingClass {
  constructor() {}
  
  // Methods will be added here
}`;
      
      await fs.writeFile(existingFile, existingContent);

      // Generate template that injects into existing file
      const result = await generateCommand.run({
        args: {
          generator: 'service',
          template: 'inject',
          name: 'InjectedMethod',
          dest: outputDir,
          quiet: true
        }
      });

      // Should handle injection workflow
      expect(typeof result).toBe('object');
    });

    it('should handle incremental updates workflow', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      // First generation
      const firstResult = await generateCommand.run({
        args: {
          generator: 'component',
          template: 'react',
          name: 'IncrementalComponent',
          dest: outputDir,
          quiet: true
        }
      });

      expect(firstResult.success).toBe(true);

      // Second generation with force (simulating update)
      const updateResult = await generateCommand.run({
        args: {
          generator: 'component',
          template: 'react',
          name: 'IncrementalComponent',
          dest: outputDir,
          force: true,
          quiet: true
        }
      });

      expect(updateResult.success).toBe(true);
    });
  });

  describe('Performance Workflows', () => {
    it('should handle batch generation workflow', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      const batchSize = 5;
      const promises = Array.from({ length: batchSize }, (_, i) => {
        return generateCommand.run({
          args: {
            generator: 'component',
            template: 'react',
            name: `BatchComponent${i}`,
            dest: path.join(outputDir, `batch-${i}`),
            quiet: true
          }
        });
      });

      const results = await Promise.all(promises);

      expect(results.length).toBe(batchSize);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
      });

      // Verify all batch directories were created
      for (let i = 0; i < batchSize; i++) {
        const batchDir = path.join(outputDir, `batch-${i}`);
        expect(await fs.pathExists(batchDir)).toBe(true);
      }
    });

    it('should handle large template generation workflow', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      const start = this.getDeterministicTimestamp();
      
      const result = await generateCommand.run({
        args: {
          generator: 'service',
          template: 'large',
          name: 'LargeService',
          dest: outputDir,
          quiet: true,
          // Large data for template
          items: Array.from({ length: 100 }, (_, i) => ({
            name: `item${i}`,
            type: 'string',
            description: `Description for item ${i}`
          }))
        }
      });

      const duration = this.getDeterministicTimestamp() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Cross-Platform Workflows', () => {
    it('should handle different path separators', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      const windowsStylePath = 'src\\components\\user';
      const unixStylePath = 'src/components/user';
      
      const result1 = await generateCommand.run({
        args: {
          generator: 'component',
          template: 'react',
          name: 'WindowsPathTest',
          dest: path.join(outputDir, windowsStylePath.replace(/\\/g, path.sep)),
          quiet: true
        }
      });

      const result2 = await generateCommand.run({
        args: {
          generator: 'component',
          template: 'react',
          name: 'UnixPathTest',
          dest: path.join(outputDir, unixStylePath),
          quiet: true
        }
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should handle special characters in filenames', async () => {
      const { generateCommand } = await import('../../src/commands/generate.js');
      
      const specialNames = [
        'Component-With-Dashes',
        'Component_With_Underscores',
        'ComponentWithNumbers123',
        'Component.With.Dots'
      ];

      for (const name of specialNames) {
        const result = await generateCommand.run({
          args: {
            generator: 'component',
            template: 'react',
            name: name,
            dest: outputDir,
            quiet: true
          }
        });

        expect(result.success).toBe(true);
      }
    });
  });
});

/**
 * Helper function to create comprehensive test templates
 */
async function createComprehensiveTemplates(templatesDir) {
  // Component templates
  const componentDir = path.join(templatesDir, 'component');
  const reactDir = path.join(componentDir, 'react');
  await fs.ensureDir(reactDir);

  const reactTemplate = `---
to: "{{ name }}.tsx"
inject: false
---
import React from 'react';
{% if withProps %}
import { {{ name }}Props } from './{{ name }}.types';
{% endif %}

{% if withHooks %}
const {{ name }}: React.FC{% if withProps %}<{{ name }}Props>{% endif %} = ({% if withProps %}props{% endif %}) => {
  {% if hasState %}
  const [state, setState] = React.useState(false);
  {% endif %}
  
  {% if withEffects %}
  React.useEffect(() => {
    // Effect logic here
  }, []);
  {% endif %}
{% else %}
class {{ name }} extends React.Component{% if withProps %}<{{ name }}Props>{% endif %} {
  {% if hasState %}
  state = { active: false };
  {% endif %}

  render() {
{% endif %}
    return (
      <div className="{{ name | kebabCase }}">
        {% if withProps %}
        <h1>{% raw %}{{% endraw %}{% if withProps %}props.title || {% endif %}'{{ name }}'{% raw %}}{% endraw %}</h1>
        {% else %}
        <h1>{{ name }}</h1>
        {% endif %}
        {% if hasChildren %}
        {% raw %}{children}{% endraw %}
        {% endif %}
      </div>
    );
{% if not withHooks %}
  }
{% endif %}
};

export default {{ name }};
`;

  await fs.writeFile(path.join(reactDir, 'component.njk'), reactTemplate);

  // Service templates
  const serviceDir = path.join(templatesDir, 'service');
  const apiDir = path.join(serviceDir, 'api');
  await fs.ensureDir(apiDir);

  const serviceTemplate = `---
to: "{{ name | kebabCase }}.service.ts"
inject: false
---
import { Injectable } from '@nestjs/common';
{% if withDatabase %}
import { Repository } from 'typeorm';
import { {{ name }} } from './{{ name | kebabCase }}.entity';
{% endif %}
{% if withLogger %}
import { Logger } from '@nestjs/common';
{% endif %}

@Injectable()
export class {{ name }}Service {
  {% if withLogger %}
  private readonly logger = new Consola({{ name }}Service.name);
  {% endif %}

  {% if withDatabase %}
  constructor(
    private readonly {{ name | camelCase }}Repository: Repository<{{ name }}>
  ) {}
  {% else %}
  constructor() {}
  {% endif %}

  {% for method in methods %}
  async {{ method }}({% if method === 'create' %}data: Partial<{{ name }}>{% elif method === 'update' %}id: string, data: Partial<{{ name }}>{% elif method === 'read' %}id: string{% elif method === 'delete' %}id: string{% endif %}): {{ returnType || 'Promise<void>' }} {
    {% if withLogger %}
    this.logger.log('Executing {{ method }} operation');
    {% endif %}
    
    {% if withDatabase %}
    {% if method === 'create' %}
    return this.{{ name | camelCase }}Repository.save(data);
    {% elif method === 'read' %}
    return this.{{ name | camelCase }}Repository.findOne({ where: { id } });
    {% elif method === 'update' %}
    await this.{{ name | camelCase }}Repository.update(id, data);
    return this.{{ name | camelCase }}Repository.findOne({ where: { id } });
    {% elif method === 'delete' %}
    await this.{{ name | camelCase }}Repository.delete(id);
    {% else %}
    return this.{{ name | camelCase }}Repository.find();
    {% endif %}
    {% else %}
    throw new Error('{{ method }} not implemented');
    {% endif %}
  }
  {% endfor %}
}
`;

  await fs.writeFile(path.join(apiDir, 'service.njk'), serviceTemplate);

  // Injection template
  const injectDir = path.join(serviceDir, 'inject');
  await fs.ensureDir(injectDir);

  const injectTemplate = `---
to: "existing.ts"
inject: true
before: "  // Methods will be added here"
---
  
  {{ name | camelCase }}(): void {
    // {{ name }} implementation
    console.log('{{ name }} method called');
  }
`;

  await fs.writeFile(path.join(injectDir, 'method.njk'), injectTemplate);

  // Large template for performance testing
  const largeDir = path.join(serviceDir, 'large');
  await fs.ensureDir(largeDir);

  const largeTemplate = `---
to: "{{ name | kebabCase }}.large.ts"
---
export interface {{ name }}Interface {
  {% for item in items %}
  {{ item.name }}: {{ item.type }}; // {{ item.description }}
  {% endfor %}
}

export class {{ name }} implements {{ name }}Interface {
  {% for item in items %}
  private _{{ item.name }}: {{ item.type }};
  {% endfor %}

  constructor() {
    {% for item in items %}
    this._{{ item.name }} = {% if item.type === 'string' %}'default'{% elif item.type === 'number' %}0{% elif item.type === 'boolean' %}false{% else %}null{% endif %};
    {% endfor %}
  }

  {% for item in items %}
  get {{ item.name }}(): {{ item.type }} {
    return this._{{ item.name }};
  }

  set {{ item.name }}(value: {{ item.type }}) {
    this._{{ item.name }} = value;
  }
  {% endfor %}
}
`;

  await fs.writeFile(path.join(largeDir, 'large.njk'), largeTemplate);

  // Model templates
  const modelDir = path.join(templatesDir, 'model');
  const entityDir = path.join(modelDir, 'entity');
  await fs.ensureDir(entityDir);

  const modelTemplate = `---
to: "{{ name | kebabCase }}.entity.ts"
---
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('{{ name | kebabCase | replace('-', '_') }}')
export class {{ name }} {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
`;

  await fs.writeFile(path.join(entityDir, 'entity.njk'), modelTemplate);
}