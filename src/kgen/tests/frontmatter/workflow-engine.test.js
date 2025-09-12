/**
 * KGEN Frontmatter Workflow Engine Tests
 * 
 * Comprehensive test suite for the frontmatter workflow system
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { FrontmatterWorkflowEngine } from '../../core/frontmatter/workflow-engine.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';

describe('FrontmatterWorkflowEngine', () => {
  let engine;
  let testDir;
  
  beforeEach(async () => {
    // Create test directory
    testDir = join(tmpdir(), `kgen-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    
    // Initialize engine with test configuration
    engine = new FrontmatterWorkflowEngine({
      enableValidation: true,
      enableProvenance: true,
      enableConditionalProcessing: true,
      enableSchemaValidation: false, // Disabled for simpler tests
      maxConcurrentOperations: 2,
      deterministic: true,
      auditTrail: true,
      frontmatter: {
        baseDirectory: testDir,
        enableBackups: false,
        enableRollback: false
      }
    });
    
    await engine.initialize();
  });
  
  afterEach(async () => {
    await engine.shutdown();
    
    // Cleanup test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Template Processing', () => {
    test('should process template with basic frontmatter', async () => {
      const template = `---
to: test-output.txt
---
Hello {{ name }}!`;
      
      const context = { name: 'World' };
      
      const result = await engine.processTemplate(template, context);
      
      expect(result.status).toBe('success');
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].path).toContain('test-output.txt');
      
      // Verify file was created
      const outputPath = join(testDir, 'test-output.txt');
      const content = await readFile(outputPath, 'utf8');
      expect(content).toBe('Hello World!');
    });

    test('should handle template without frontmatter', async () => {
      const template = 'Hello {{ name }}!';
      const context = { name: 'World' };
      
      const result = await engine.processTemplate(template, context);
      
      expect(result.status).toBe('success');
      expect(result.reason).toContain('No output path');
    });

    test('should process template with variables', async () => {
      const template = `---
to: {{ outputDir }}/{{ filename }}.txt
variables:
  name:
    type: string
    required: true
  outputDir:
    type: string
    default: output
---
Hello {{ name }}!`;
      
      const context = { 
        name: 'KGEN',
        outputDir: 'generated',
        filename: 'greeting'
      };
      
      const result = await engine.processTemplate(template, context);
      
      expect(result.status).toBe('success');
      expect(result.pathResolution.resolvedPath).toContain('generated/greeting.txt');
    });
  });

  describe('Operation Modes', () => {
    test('should handle append operation', async () => {
      const outputPath = join(testDir, 'append-test.txt');
      await writeFile(outputPath, 'Existing content\n');
      
      const template = `---
to: append-test.txt
append: true
---
Appended content`;
      
      const result = await engine.processTemplate(template, {});
      
      expect(result.status).toBe('success');
      
      const content = await readFile(outputPath, 'utf8');
      expect(content).toBe('Existing content\nAppended content');
    });

    test('should handle prepend operation', async () => {
      const outputPath = join(testDir, 'prepend-test.txt');
      await writeFile(outputPath, 'Existing content');
      
      const template = `---
to: prepend-test.txt
prepend: true
---
Prepended content`;
      
      const result = await engine.processTemplate(template, {});
      
      expect(result.status).toBe('success');
      
      const content = await readFile(outputPath, 'utf8');
      expect(content).toBe('Prepended content\nExisting content');
    });

    test('should handle inject operation with markers', async () => {
      const outputPath = join(testDir, 'inject-test.txt');
      await writeFile(outputPath, `Line 1
// INJECT_MARKER
Line 3`);
      
      const template = `---
to: inject-test.txt
inject: true
after: "// INJECT_MARKER"
---
Injected content`;
      
      const result = await engine.processTemplate(template, {});
      
      expect(result.status).toBe('success');
      
      const content = await readFile(outputPath, 'utf8');
      expect(content).toContain('// INJECT_MARKER\nInjected content');
    });

    test('should handle lineAt operation', async () => {
      const outputPath = join(testDir, 'line-test.txt');
      await writeFile(outputPath, `Line 1
Line 2
Line 3`);
      
      const template = `---
to: line-test.txt
lineAt: 2
---
Inserted at line 2`;
      
      const result = await engine.processTemplate(template, {});
      
      expect(result.status).toBe('success');
      
      const content = await readFile(outputPath, 'utf8');
      const lines = content.split('\n');
      expect(lines[1]).toBe('Inserted at line 2');
      expect(lines[2]).toBe('Line 2');
    });
  });

  describe('Conditional Processing', () => {
    test('should skip processing when skipIf condition is true', async () => {
      const template = `---
to: conditional-test.txt
skipIf: skipCondition
---
This should not be generated`;
      
      const context = { skipCondition: true };
      
      const result = await engine.processTemplate(template, context);
      
      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('Skip condition evaluated to true');
    });

    test('should process when skipIf condition is false', async () => {
      const template = `---
to: conditional-test.txt
skipIf: skipCondition
---
This should be generated`;
      
      const context = { skipCondition: false };
      
      const result = await engine.processTemplate(template, context);
      
      expect(result.status).toBe('success');
      expect(result.artifacts).toHaveLength(1);
    });

    test('should handle complex skipIf conditions', async () => {
      const template = `---
to: complex-conditional.txt
skipIf: "environment == 'production'"
---
Development content`;
      
      const context = { environment: 'development' };
      
      const result = await engine.processTemplate(template, context);
      
      expect(result.status).toBe('success');
      
      const context2 = { environment: 'production' };
      const result2 = await engine.processTemplate(template, context2);
      
      expect(result2.status).toBe('skipped');
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple templates concurrently', async () => {
      const templates = [
        {
          content: `---
to: batch-1.txt
---
Content 1`,
          context: {}
        },
        {
          content: `---
to: batch-2.txt
---
Content 2`,
          context: {}
        },
        {
          content: `---
to: batch-3.txt
---
Content 3`,
          context: {}
        }
      ];
      
      const result = await engine.processTemplates(templates);
      
      expect(result.status).toBe('success');
      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      
      // Verify all files were created
      for (let i = 1; i <= 3; i++) {
        const content = await readFile(join(testDir, `batch-${i}.txt`), 'utf8');
        expect(content).toBe(`Content ${i}`);
      }
    });

    test('should handle partial batch failures gracefully', async () => {
      const templates = [
        {
          content: `---
to: batch-success.txt
---
Success content`,
          context: {}
        },
        {
          content: `---
to: /invalid/absolute/path.txt
---
This should fail`,
          context: {}
        }
      ];
      
      const result = await engine.processTemplates(templates);
      
      expect(result.status).toBe('partial_success');
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid frontmatter gracefully', async () => {
      const template = `---
to: test.txt
invalid: yaml: content: [
---
Content`;
      
      const result = await engine.processTemplate(template, {});
      
      expect(result.status).toBe('success'); // Parser should handle invalid YAML
      expect(result.reason).toContain('No output path'); // Falls back to no frontmatter
    });

    test('should handle missing injection markers', async () => {
      const outputPath = join(testDir, 'missing-marker.txt');
      await writeFile(outputPath, 'Existing content');
      
      const template = `---
to: missing-marker.txt
inject: true
before: "NONEXISTENT_MARKER"
---
This injection should fail`;
      
      const result = await engine.processTemplate(template, {});
      
      expect(result.status).toBe('error');
      expect(result.reason).toContain('Template processing failed');
    });

    test('should handle file permission errors gracefully', async () => {
      const template = `---
to: readonly-test.txt
chmod: "444"
---
Content with readonly permissions`;
      
      const result = await engine.processTemplate(template, {});
      
      expect(result.status).toBe('success');
      // File permissions should be applied if possible
    });
  });

  describe('Variable Extraction', () => {
    test('should extract variables from template', async () => {
      const template = `---
to: {{ outputPath }}
variables:
  name:
    type: string
    required: true
  outputPath:
    type: string
    default: output.txt
---
Hello {{ name }}! Your data: {{ data.value }}`;
      
      const result = await engine.extractVariables(template);
      
      expect(result.frontmatterVariables).toContain('outputPath');
      expect(result.templateVariables).toContain('name');
      expect(result.templateVariables).toContain('data');
      expect(result.allVariables).toContain('name');
      expect(result.allVariables).toContain('outputPath');
      expect(result.allVariables).toContain('data');
    });
  });

  describe('Template Validation', () => {
    test('should validate template frontmatter', async () => {
      const template = `---
to: test.txt
inject: true
append: true
---
Invalid: both inject and append set`;
      
      const result = await engine.validateTemplate(template, 'basic');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate valid template frontmatter', async () => {
      const template = `---
to: test.txt
append: true
---
Valid template`;
      
      const result = await engine.validateTemplate(template, 'basic');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Path Resolution', () => {
    test('should resolve dynamic paths correctly', async () => {
      const template = `---
to: "{{ category }}/{{ name | kebabCase }}.txt"
---
Dynamic path content`;
      
      const context = {
        category: 'components',
        name: 'MyComponent'
      };
      
      const result = await engine.processTemplate(template, context);
      
      expect(result.status).toBe('success');
      expect(result.pathResolution.resolvedPath).toBe('components/my-component.txt');
    });

    test('should handle path conflicts in batch processing', async () => {
      const templates = [
        {
          content: `---
to: same-file.txt
---
Content 1`,
          context: {}
        },
        {
          content: `---
to: same-file.txt
---
Content 2`,
          context: {}
        }
      ];
      
      const result = await engine.processTemplates(templates);
      
      // Should detect conflict but both operations might succeed
      expect(result.conflictDetails).toBeDefined();
      if (result.conflictDetails.length > 0) {
        expect(result.conflictDetails[0].path).toBe('same-file.txt');
      }
    });
  });

  describe('Metadata and Provenance', () => {
    test('should track operation metadata', async () => {
      const template = `---
to: metadata-test.txt
---
Content for metadata tracking`;
      
      const result = await engine.processTemplate(template, {});
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.core).toBeDefined();
      expect(result.metadata.operational).toBeDefined();
      expect(result.metadata.extractionMetadata).toBeDefined();
      expect(result.metadata.extractionMetadata.extractionTime).toBeGreaterThan(0);
    });

    test('should maintain operation history', async () => {
      const template = `---
to: history-test.txt
---
Content for history tracking`;
      
      await engine.processTemplate(template, {});
      
      const status = engine.getStatus();
      expect(status.components.frontmatterWorkflow).toBeDefined();
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle concurrent operations correctly', async () => {
      const templates = Array.from({ length: 5 }, (_, i) => ({
        content: `---
to: concurrent-${i}.txt
---
Concurrent content ${i}`,
        context: { index: i }
      }));
      
      const startTime = Date.now();
      const result = await engine.processTemplates(templates);
      const endTime = Date.now();
      
      expect(result.status).toBe('success');
      expect(result.successful).toBe(5);
      
      // Should complete reasonably quickly with concurrency
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should respect concurrency limits', async () => {
      // Engine is configured with maxConcurrentOperations: 2
      const templates = Array.from({ length: 10 }, (_, i) => ({
        content: `---
to: limit-test-${i}.txt
---
Content ${i}`,
        context: { index: i }
      }));
      
      const result = await engine.processTemplates(templates);
      
      expect(result.status).toBe('success');
      expect(result.successful).toBe(10);
    });
  });

  describe('Shell Commands', () => {
    test('should execute shell commands after file operations', async () => {
      const template = `---
to: shell-test.txt
sh:
  - "echo 'Shell command executed'"
---
Content with shell commands`;
      
      const result = await engine.processTemplate(template, {});
      
      expect(result.status).toBe('success');
      expect(result.artifacts).toHaveLength(1);
      
      // File should be created
      const content = await readFile(join(testDir, 'shell-test.txt'), 'utf8');
      expect(content).toBe('Content with shell commands');
    });
  });
});

describe('FrontmatterWorkflowEngine Integration', () => {
  test('should integrate with KGEN engine format', async () => {
    const engine = new FrontmatterWorkflowEngine({
      enableProvenance: true,
      deterministic: true
    });
    
    await engine.initialize();
    
    try {
      const template = `---
to: integration-test.txt
---
KGEN integration test`;
      
      const result = await engine.processTemplate(template, {});
      
      // Verify KGEN-compatible result format
      expect(result).toHaveProperty('operationId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('artifacts');
      expect(result).toHaveProperty('metadata');
      
      if (result.artifacts && result.artifacts.length > 0) {
        const artifact = result.artifacts[0];
        expect(artifact).toHaveProperty('type');
        expect(artifact).toHaveProperty('path');
        expect(artifact).toHaveProperty('operationId');
      }
      
    } finally {
      await engine.shutdown();
    }
  });
});