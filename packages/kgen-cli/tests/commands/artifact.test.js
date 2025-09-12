/**
 * KGEN CLI Artifact Command Tests
 * Tests for artifact generation, validation, and management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'path';
import { writeFile, readFile, mkdir } from 'fs/promises';

describe('kgen artifact command', () => {
  let testDir;
  let sampleRDF;
  let sampleTemplate;

  beforeEach(async () => {
    testDir = await global.testUtils.createTempDir('kgen-artifact-test-');
    process.chdir(testDir);

    // Create sample RDF data
    sampleRDF = `
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      
      ex:john a foaf:Person ;
          foaf:name "John Developer" ;
          foaf:email "john@example.com" ;
          ex:role "Senior Developer" ;
          ex:department "Engineering" .
          
      ex:jane a foaf:Person ;
          foaf:name "Jane Architect" ;
          foaf:email "jane@example.com" ;
          ex:role "System Architect" ;
          ex:department "Engineering" .
    `.trim();

    // Create sample template
    sampleTemplate = `
      // Generated Employee class
      export class {{person.name | replace(' ', '')}} {
        constructor() {
          this.name = "{{person.name}}";
          this.email = "{{person.email}}";
          this.role = "{{person.role}}";
          this.department = "{{person.department}}";
        }
        
        getInfo() {
          return {
            name: this.name,
            email: this.email,
            role: this.role,
            department: this.department
          };
        }
      }
    `.trim();

    // Set up directory structure
    await mkdir(resolve(testDir, 'data'), { recursive: true });
    await mkdir(resolve(testDir, 'templates'), { recursive: true });
    await mkdir(resolve(testDir, 'output'), { recursive: true });

    // Write test files
    await writeFile(resolve(testDir, 'data', 'employees.ttl'), sampleRDF);
    await writeFile(resolve(testDir, 'templates', 'employee.js.njk'), sampleTemplate);
  });

  afterEach(async () => {
    await global.testUtils.cleanupTempDir(testDir);
  });

  describe('artifact generate', () => {
    it('should generate artifacts from RDF and templates', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/generated'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Generated');
      expect(result.exitCode).toBe(0);

      // Verify output files were created
      const outputExists = await global.testUtils.waitForFile('output/generated');
      expect(outputExists).toBe(true);
    });

    it('should generate multiple artifacts from single template', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/employees',
        '--multiple'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Generated');
      
      // Should create separate files for John and Jane
      const johnExists = await global.testUtils.waitForFile('output/employees/JohnDeveloper.js');
      const janeExists = await global.testUtils.waitForFile('output/employees/JaneArchitect.js');
      
      expect(johnExists).toBe(true);
      expect(janeExists).toBe(true);
    });

    it('should support dry-run mode', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/dry-run',
        '--dry-run'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('DRY RUN');
      expect(result.stdout).toContain('Would generate');

      // No files should be created
      const outputExists = await global.testUtils.waitForFile('output/dry-run', 1000);
      expect(outputExists).toBe(false);
    });

    it('should validate generated artifacts', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/validated',
        '--validate'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Validation');
      expect(result.stdout).toContain('✓') || expect(result.stdout).toContain('passed');
    });

    it('should generate with custom variables', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/custom',
        '--var', 'namespace=com.example',
        '--var', 'version=1.0.0'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Generated');
    });

    it('should handle template errors gracefully', async () => {
      // Create template with syntax error
      const badTemplate = `
        class {{person.invalidProperty.nonExistent}} {
          // This will fail
        }
      `;
      
      await writeFile(resolve(testDir, 'templates', 'bad.js.njk'), badTemplate);

      const result = await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/bad.js.njk',
        '--output', 'output/error-test'
      ]);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('error') || expect(result.stderr).toContain('Error');
    });

    it('should support output format options', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/formatted',
        '--format', 'js',
        '--beautify'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Generated');
    });
  });

  describe('artifact validate', () => {
    beforeEach(async () => {
      // Generate some artifacts first
      await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/to-validate'
      ]);
    });

    it('should validate existing artifacts', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'validate',
        '--path', 'output/to-validate'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Validation');
    });

    it('should detect artifact corruption', async () => {
      // Modify generated artifact to simulate corruption
      const artifactPath = resolve(testDir, 'output/to-validate');
      const files = await readFile(artifactPath).catch(() => '// corrupted');
      await writeFile(artifactPath, files + '\n// CORRUPTED');

      const result = await global.testUtils.execCLI([
        'artifact', 'validate',
        '--path', 'output/to-validate',
        '--strict'
      ]);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('validation') || expect(result.stderr).toContain('error');
    });

    it('should validate syntax for different languages', async () => {
      // Create Python template
      const pythonTemplate = `
        class {{person.name | replace(' ', '')}}:
            def __init__(self):
                self.name = "{{person.name}}"
                self.email = "{{person.email}}"
            
            def get_info(self):
                return {
                    "name": self.name,
                    "email": self.email
                }
      `;
      
      await writeFile(resolve(testDir, 'templates', 'employee.py.njk'), pythonTemplate);

      // Generate Python artifact
      await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.py.njk',
        '--output', 'output/python-employee.py'
      ]);

      // Validate Python syntax
      const result = await global.testUtils.execCLI([
        'artifact', 'validate',
        '--path', 'output/python-employee.py',
        '--language', 'python'
      ]);

      expect(result.success).toBe(true);
    });
  });

  describe('artifact list', () => {
    beforeEach(async () => {
      // Generate multiple artifacts
      await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/list-test',
        '--multiple'
      ]);
    });

    it('should list generated artifacts', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'list',
        '--path', 'output/list-test'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Artifacts');
      expect(result.stdout).toContain('.js');
    });

    it('should show artifact metadata', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'list',
        '--path', 'output/list-test',
        '--details'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Size') || expect(result.stdout).toContain('Created');
    });

    it('should filter artifacts by type', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'list',
        '--path', 'output/list-test',
        '--filter', '*.js'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('.js');
    });
  });

  describe('artifact clean', () => {
    beforeEach(async () => {
      // Generate artifacts to clean
      await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/to-clean',
        '--multiple'
      ]);
    });

    it('should clean generated artifacts', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'clean',
        '--path', 'output/to-clean',
        '--confirm'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Cleaned') || expect(result.stdout).toContain('Removed');
    });

    it('should require confirmation for destructive operations', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'clean',
        '--path', 'output/to-clean'
        // No --confirm flag
      ]);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('confirmation') || expect(result.stderr).toContain('confirm');
    });

    it('should support selective cleaning', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'clean',
        '--path', 'output/to-clean',
        '--filter', '*.js',
        '--confirm'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Cleaned');
    });
  });

  describe('artifact diff', () => {
    beforeEach(async () => {
      // Generate baseline artifacts
      await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/baseline'
      ]);

      // Modify template and generate again
      const modifiedTemplate = sampleTemplate.replace('Senior Developer', 'Lead Developer');
      await writeFile(resolve(testDir, 'templates', 'employee-modified.js.njk'), modifiedTemplate);
      
      await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee-modified.js.njk',
        '--output', 'output/modified'
      ]);
    });

    it('should show differences between artifact versions', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'diff',
        '--baseline', 'output/baseline',
        '--current', 'output/modified'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('diff') || expect(result.stdout).toContain('changes');
    });

    it('should detect identical artifacts', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'diff',
        '--baseline', 'output/baseline',
        '--current', 'output/baseline'
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('identical') || expect(result.stdout).toContain('no changes');
    });
  });

  describe('error handling', () => {
    it('should handle missing input files', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'nonexistent.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/error'
      ]);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('not found') || expect(result.stderr).toContain('missing');
    });

    it('should handle invalid RDF syntax', async () => {
      await writeFile(resolve(testDir, 'data', 'invalid.ttl'), 'This is not valid RDF!!!');

      const result = await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/invalid.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', 'output/error'
      ]);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('parse') || expect(result.stderr).toContain('syntax');
    });

    it('should handle permission errors', async () => {
      const result = await global.testUtils.execCLI([
        'artifact', 'generate',
        '--input', 'data/employees.ttl',
        '--template', 'templates/employee.js.njk',
        '--output', '/root/forbidden'  // Simulate permission error
      ]);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('permission') || expect(result.stderr).toContain('access');
    });
  });
});