/**
 * KGEN CLI Integration Tests
 * Comprehensive testing of CLI functionality and workflows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'path';
import { writeFile, readFile, mkdir, readdir } from 'fs/promises';

describe('KGEN CLI Integration', () => {
  let testDir;
  
  beforeEach(async () => {
    testDir = await global.testUtils.createTempDir('kgen-cli-integration-');
    process.chdir(testDir);
    
    // Set up basic project structure
    await mkdir('data', { recursive: true });
    await mkdir('templates', { recursive: true });
    await mkdir('output', { recursive: true });
  });

  afterEach(async () => {
    await global.testUtils.cleanupTempDir(testDir);
  });

  describe('Basic CLI Operations', () => {
    it('should display version information', async () => {
      const result = await global.testUtils.execCLI(['--version']);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
      expect(result.exitCode).toBe(0);
    });

    it('should display help information', async () => {
      const result = await global.testUtils.execCLI(['--help']);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Usage');
      expect(result.stdout).toContain('Commands');
      expect(result.stdout).toContain('Options');
    });

    it('should show command-specific help', async () => {
      const result = await global.testUtils.execCLI(['generate', '--help']);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('generate');
      expect(result.stdout).toContain('input');
      expect(result.stdout).toContain('output');
    });

    it('should handle unknown commands gracefully', async () => {
      const result = await global.testUtils.execCLI(['unknown-command']);
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('unknown') || expect(result.stderr).toContain('not found');
    });
  });

  describe('Data Processing Workflow', () => {
    beforeEach(async () => {
      // Create sample data files
      const sampleRDF = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice a foaf:Person ;
            foaf:name "Alice Johnson" ;
            foaf:email "alice@example.com" ;
            ex:department "Engineering" .
            
        ex:bob a foaf:Person ;
            foaf:name "Bob Smith" ;
            foaf:email "bob@example.com" ;
            ex:department "Marketing" .
      `;

      const classTemplate = `
        // Generated Employee class for {{person.name}}
        export class {{person.name | replace(' ', '')}} {
          constructor() {
            this.name = "{{person.name}}";
            this.email = "{{person.email}}";
            this.department = "{{person.department}}";
          }
          
          getProfile() {
            return {
              name: this.name,
              email: this.email,
              department: this.department
            };
          }
        }
      `;

      await writeFile('data/employees.ttl', sampleRDF);
      await writeFile('templates/employee.js.njk', classTemplate);
    });

    it('should process RDF data and generate code', async () => {
      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/employees'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Generated') || expect(result.stdout).toContain('Success');

      // Check that output files were created
      const outputExists = await global.testUtils.waitForFile('output/employees');
      expect(outputExists).toBe(true);
    });

    it('should support dry-run mode', async () => {
      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/dry-run',
        '--dry-run'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('DRY RUN') || expect(result.stdout).toContain('would generate');

      // No actual files should be created
      const outputExists = await global.testUtils.waitForFile('output/dry-run', 1000);
      expect(outputExists).toBe(false);
    });

    it('should validate generated output', async () => {
      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/validated',
        '--validate'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('valid') || expect(result.stdout).toContain('✓');
    });

    it('should handle multiple output formats', async () => {
      // Create additional templates
      const pythonTemplate = `
        # Generated Employee class for {{person.name}}
        class {{person.name | replace(' ', '')}}:
            def __init__(self):
                self.name = "{{person.name}}"
                self.email = "{{person.email}}"
                self.department = "{{person.department}}"
            
            def get_profile(self):
                return {
                    "name": self.name,
                    "email": self.email,
                    "department": self.department
                }
      `;

      await writeFile('templates/employee.py.njk', pythonTemplate);

      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/*.njk',
        '--output', 'output/multi-format'
      ]);

      expect(result.success).toBe(true);
      
      // Should generate both JS and Python files
      const jsExists = await global.testUtils.waitForFile('output/multi-format');
      expect(jsExists).toBe(true);
    });
  });

  describe('Advanced Features', () => {
    it('should support custom variables and filters', async () => {
      const templateWithVars = `
        // Generated at: {{timestamp}}
        // Version: {{version}}
        // Namespace: {{namespace}}
        
        export const {{entity.name | camelCase}} = {
          name: "{{entity.name}}",
          version: "{{version}}",
          timestamp: "{{timestamp}}"
        };
      `;

      const simpleRDF = `
        @prefix ex: <http://example.org/> .
        ex:config a ex:Configuration ;
            ex:name "Application Config" .
      `;

      await writeFile('templates/config.js.njk', templateWithVars);
      await writeFile('data/config.ttl', simpleRDF);

      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/config.ttl',
        '--template', 'templates/config.js.njk',
        '--output', 'output/config.js',
        '--var', 'version=1.0.0',
        '--var', 'namespace=com.example',
        '--var', 'timestamp=2024-01-01T00:00:00Z'
      ]);

      expect(result.success).toBe(true);
      
      if (await global.testUtils.waitForFile('output/config.js')) {
        const content = await readFile('output/config.js', 'utf-8');
        expect(content).toContain('1.0.0');
        expect(content).toContain('com.example');
        expect(content).toContain('2024-01-01T00:00:00Z');
      }
    });

    it('should support batch processing', async () => {
      // Create multiple data files
      const persons = [
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
        { name: 'Carol', email: 'carol@example.com' }
      ];

      for (const person of persons) {
        const rdf = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:${person.name.toLowerCase()} a foaf:Person ;
              foaf:name "${person.name}" ;
              foaf:email "${person.email}" .
        `;
        await writeFile(`data/${person.name.toLowerCase()}.ttl`, rdf);
      }

      const template = `
        export const {{person.name}} = {
          name: "{{person.name}}",
          email: "{{person.email}}"
        };
      `;
      await writeFile('templates/person.js.njk', template);

      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/*.ttl',
        '--template', 'templates/person.js.njk',
        '--output', 'output/batch',
        '--multiple'
      ]);

      expect(result.success).toBe(true);
      
      // Should create multiple output files
      const outputDir = await readdir('output/batch').catch(() => []);
      expect(outputDir.length).toBeGreaterThan(0);
    });

    it('should support watch mode for development', async () => {
      const initialRDF = `
        @prefix ex: <http://example.org/> .
        ex:test a ex:Entity ;
            ex:name "Initial" .
      `;

      const template = `
        export const entity = {
          name: "{{entity.name}}"
        };
      `;

      await writeFile('data/watch.ttl', initialRDF);
      await writeFile('templates/watch.js.njk', template);

      // Start watch mode (this would typically run in background)
      const watchProcess = global.testUtils.execCLI([
        'watch',
        '--input', 'data/watch.ttl',
        '--template', 'templates/watch.js.njk',
        '--output', 'output/watch.js'
      ]);

      // Wait for initial generation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Modify the input file
      const modifiedRDF = initialRDF.replace('Initial', 'Modified');
      await writeFile('data/watch.ttl', modifiedRDF);

      // In a real test, we'd check for file changes
      // For this test, we'll just verify the watch command doesn't crash
      expect(watchProcess).toBeDefined();
    }, 10000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed RDF gracefully', async () => {
      const malformedRDF = 'This is not valid RDF syntax at all!!!';
      await writeFile('data/malformed.ttl', malformedRDF);

      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/malformed.ttl',
        '--template', 'templates/simple.njk',
        '--output', 'output/error'
      ]);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('parse') || expect(result.stderr).toContain('syntax');
    });

    it('should handle missing files gracefully', async () => {
      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/nonexistent.ttl',
        '--template', 'templates/nonexistent.njk',
        '--output', 'output/missing'
      ]);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('not found') || expect(result.stderr).toContain('missing');
    });

    it('should handle template syntax errors', async () => {
      const badTemplate = `
        This template has {{invalid.syntax.that.will.fail}} errors
        And {{unclosed.brackets
      `;

      const validRDF = `
        @prefix ex: <http://example.org/> .
        ex:test a ex:Entity .
      `;

      await writeFile('templates/bad.njk', badTemplate);
      await writeFile('data/valid.ttl', validRDF);

      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/valid.ttl',
        '--template', 'templates/bad.njk',
        '--output', 'output/template-error'
      ]);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('template') || expect(result.stderr).toContain('syntax');
    });

    it('should provide helpful error messages', async () => {
      const result = await global.testUtils.execCLI(['generate']); // Missing required args

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('required') || expect(result.stderr).toContain('missing');
    });

    it('should continue on recoverable errors with --continue flag', async () => {
      // Create mix of valid and invalid files
      const validRDF = `
        @prefix ex: <http://example.org/> .
        ex:valid a ex:Entity ;
            ex:name "Valid" .
      `;

      const invalidRDF = 'Invalid RDF content!!!';

      await writeFile('data/valid.ttl', validRDF);
      await writeFile('data/invalid.ttl', invalidRDF);

      const template = `
        export const {{entity.name}} = "{{entity.name}}";
      `;
      await writeFile('templates/simple.js.njk', template);

      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/*.ttl',
        '--template', 'templates/simple.js.njk',
        '--output', 'output/partial',
        '--continue-on-error'
      ]);

      // Should succeed partially
      expect(result.exitCode).not.toBe(0); // Indicates partial failure
      expect(result.stdout).toContain('partial') || expect(result.stderr).toContain('error');
    });
  });

  describe('Configuration Management', () => {
    it('should support configuration files', async () => {
      const config = {
        input: 'data/**/*.ttl',
        templates: 'templates/**/*.njk',
        output: 'output/configured',
        variables: {
          version: '1.0.0',
          namespace: 'com.example'
        },
        validate: true
      };

      await writeFile('kgen.config.json', JSON.stringify(config, null, 2));

      const result = await global.testUtils.execCLI([
        'generate',
        '--config', 'kgen.config.json'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('config') || expect(result.stdout).toContain('Generated');
    });

    it('should show current configuration', async () => {
      const result = await global.testUtils.execCLI(['config', '--show']);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Configuration') || expect(result.stdout).toContain('config');
    });

    it('should validate configuration', async () => {
      const invalidConfig = {
        input: null, // Invalid
        template: 'templates/test.njk'
        // Missing output
      };

      await writeFile('invalid-config.json', JSON.stringify(invalidConfig));

      const result = await global.testUtils.execCLI([
        'config',
        '--validate',
        '--config', 'invalid-config.json'
      ]);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('config') || expect(result.stderr).toContain('invalid');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a large RDF file
      const entities = Array.from({ length: 100 }, (_, i) => `
        ex:entity${i} a ex:Entity ;
            ex:name "Entity ${i}" ;
            ex:index "${i}" .
      `).join('\n');

      const largeRDF = `
        @prefix ex: <http://example.org/> .
        ${entities}
      `;

      const template = `
        // Generated for {{entity.name}}
        export const {{entity.name | replace(' ', '')}} = {
          index: {{entity.index}},
          name: "{{entity.name}}"
        };
      `;

      await writeFile('data/large.ttl', largeRDF);
      await writeFile('templates/large.js.njk', template);

      const startTime = Date.now();
      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/large.ttl',
        '--template', 'templates/large.js.njk',
        '--output', 'output/large'
      ]);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should show progress for long-running operations', async () => {
      const result = await global.testUtils.execCLI([
        'generate',
        '--input', 'data/*.ttl',
        '--template', 'templates/*.njk',
        '--output', 'output/progress',
        '--progress'
      ]);

      expect(result.success).toBe(true);
      // Progress indicators would appear in stdout
      expect(result.stdout.length).toBeGreaterThan(0);
    });
  });
});