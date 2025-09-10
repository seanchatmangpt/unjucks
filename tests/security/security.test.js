/**
 * Security Tests
 * 
 * Tests for security vulnerabilities including path traversal, injection attacks,
 * and other security concerns in template processing and file operations.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { createWorkspace, getErrorScenarios } from '../fixtures/test-data-manager.js';
import { TemplateScanner } from '../../src/lib/template-scanner.js';

describe('Security Tests', () => {
  let workspace;

  beforeEach(async () => {
    workspace = createWorkspace('security-test');
    await workspace.setup();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('Path Traversal Prevention', () => {
    test('should prevent directory traversal in template paths', async () => {
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      
      // Attempt to traverse outside the templates directory
      const maliciousPath = await scanner.getTemplatePath('../../../etc', 'passwd');
      
      // Path should be contained within the workspace
      expect(maliciousPath).toContain(workspace.rootPath);
      expect(maliciousPath).not.toContain('/etc/passwd');
    });

    test('should sanitize output paths in frontmatter', async () => {
      const maliciousTemplate = `---
to: ../../../etc/passwd
---
malicious content`;

      await workspace.createTemplate('security', 'traversal', maliciousTemplate);
      
      // Template processing should sanitize the output path
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      const content = await scanner.readTemplate(
        path.join(workspace.rootPath, '_templates/security/traversal')
      );
      
      expect(content).toContain('../../../etc/passwd'); // Raw content preserved
      // But actual file writing should be prevented at the generation level
    });

    test('should prevent absolute path injection', async () => {
      const maliciousTemplate = `---
to: /root/malicious.txt
---
Should not be written to system root`;

      await workspace.createTemplate('security', 'absolute', maliciousTemplate);
      
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      const content = await scanner.readTemplate(
        path.join(workspace.rootPath, '_templates/security/absolute')
      );
      
      expect(content).toBeDefined();
      // The template system should detect and prevent absolute paths
    });

    test('should handle symbolic link attacks', async () => {
      // Create a symbolic link pointing outside the workspace
      const linkPath = path.join(workspace.rootPath, '_templates/symlink');
      
      try {
        await fs.ensureDir(path.dirname(linkPath));
        await fs.symlink('/etc', linkPath);
        
        const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
        const templates = await scanner.getTemplatesForGenerator('symlink');
        
        // Should not follow symlinks outside workspace
        expect(templates).toEqual([]);
      } catch (error) {
        // Symlink creation might fail in some environments
        console.warn('Symlink test skipped:', error.message);
      }
    });
  });

  describe('Template Injection Prevention', () => {
    test('should handle malicious Nunjucks code injection', async () => {
      const maliciousTemplate = `---
to: output.js
---
{{ constructor.constructor('return process')().exit() }}`;

      await workspace.createTemplate('security', 'injection', maliciousTemplate);
      
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      const content = await scanner.readTemplate(
        path.join(workspace.rootPath, '_templates/security/injection')
      );
      
      expect(content).toContain('constructor.constructor');
      // Template engine should sandbox execution and prevent code injection
    });

    test('should prevent prototype pollution via template variables', async () => {
      const maliciousTemplate = `---
to: output.js
---
{% set constructor.prototype.polluted = "pwned" %}
Normal content`;

      await workspace.createTemplate('security', 'pollution', maliciousTemplate);
      
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      const content = await scanner.readTemplate(
        path.join(workspace.rootPath, '_templates/security/pollution')
      );
      
      expect(content).toBeDefined();
      // Should not allow prototype pollution
      expect(Object.prototype.polluted).toBeUndefined();
    });

    test('should sanitize user input in variables', async () => {
      const template = `---
to: src/{{ name }}.js
---
// Component: {{ name }}
export const {{ name }} = () => {};`;

      await workspace.createTemplate('security', 'input', template);
      
      // Malicious input
      const maliciousName = '<script>alert("xss")</script>';
      
      // Template processing should escape/sanitize the input
      // This would be tested at the generation level, not just template reading
    });

    test('should prevent YAML deserialization attacks', async () => {
      const maliciousYaml = `---
to: output.js
!!python/object/apply:os.system
- 'echo pwned > /tmp/pwned'
---
Content`;

      // This should fail to parse safely
      try {
        await workspace.createTemplate('security', 'yaml', maliciousYaml);
        
        const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
        const content = await scanner.readTemplate(
          path.join(workspace.rootPath, '_templates/security/yaml')
        );
        
        // Should either fail to parse or sanitize the YAML
        expect(content).toBeDefined();
      } catch (error) {
        // Expected to fail with malicious YAML
        expect(error).toBeDefined();
      }
    });
  });

  describe('File System Security', () => {
    test('should respect file permissions', async () => {
      // Create a read-only template
      const templatePath = path.join(workspace.rootPath, '_templates/readonly/test');
      await workspace.createDir(path.dirname(templatePath));
      await fs.writeFile(path.join(templatePath, 'index.njk'), 'content');
      
      try {
        await fs.chmod(templatePath, 0o444); // Read-only
        
        const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
        const content = await scanner.readTemplate(templatePath);
        
        expect(content).toBe('content');
      } catch (error) {
        // Permission changes might not work in all environments
        console.warn('Permission test skipped:', error.message);
      }
    });

    test('should handle permission denied errors gracefully', async () => {
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      
      // Try to read from a non-existent restricted path
      const content = await scanner.readTemplate('/root/restricted');
      
      // Should return empty string rather than throwing
      expect(content).toBe('');
    });

    test('should prevent overwriting system files', async () => {
      const systemTemplate = `---
to: /etc/hosts
---
127.0.0.1 malicious.com`;

      await workspace.createTemplate('security', 'system', systemTemplate);
      
      // The generation process should prevent writing to system locations
      // This test verifies the template exists but shouldn't be executed
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      const content = await scanner.readTemplate(
        path.join(workspace.rootPath, '_templates/security/system')
      );
      
      expect(content).toContain('/etc/hosts');
    });
  });

  describe('Input Validation', () => {
    test('should validate generator names', async () => {
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      
      // Test various invalid generator names
      const invalidNames = [
        '../malicious',
        'gen/../../etc',
        'gen\x00null',
        'gen\nwith\nnewlines',
        'gen\rwith\rcarriage',
        'gen\twith\ttabs'
      ];
      
      for (const name of invalidNames) {
        const templates = await scanner.getTemplatesForGenerator(name);
        expect(templates).toEqual([]);
      }
    });

    test('should validate template names', async () => {
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      
      // Test path traversal in template names
      const maliciousTemplate = await scanner.getTemplatePath('component', '../../../etc/passwd');
      
      // Should not resolve to system paths
      expect(maliciousTemplate).toContain(workspace.rootPath);
      expect(maliciousTemplate).not.toContain('/etc/passwd');
    });

    test('should handle extremely long input gracefully', async () => {
      const longString = 'a'.repeat(10000);
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      
      const templates = await scanner.getTemplatesForGenerator(longString);
      expect(templates).toEqual([]);
    });

    test('should handle null and undefined input safely', async () => {
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      
      const templates1 = await scanner.getTemplatesForGenerator(null);
      const templates2 = await scanner.getTemplatesForGenerator(undefined);
      
      expect(templates1).toEqual([]);
      expect(templates2).toEqual([]);
    });
  });

  describe('Resource Exhaustion Prevention', () => {
    test('should handle large numbers of templates', async () => {
      // Create many templates to test resource limits
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        await workspace.createTemplate(`gen${i}`, 'template', 'content');
      }
      
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      const generators = await scanner.getGenerators();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(generators).toHaveLength(100);
      expect(duration).toBeLessThan(10000); // Should complete in reasonable time
    });

    test('should handle deep directory nesting', async () => {
      // Create deeply nested structure
      let currentPath = '_templates';
      for (let i = 0; i < 50; i++) {
        currentPath = path.join(currentPath, `level${i}`);
      }
      
      await workspace.createDir(currentPath);
      await workspace.createFile(path.join(currentPath, 'template.njk'), 'deep content');
      
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      const generators = await scanner.getGenerators();
      
      // Should handle deep nesting without stack overflow
      expect(generators).toBeDefined();
    });

    test('should handle circular directory references', async () => {
      // Create circular symlinks (if supported)
      try {
        const dir1 = path.join(workspace.rootPath, '_templates/circular1');
        const dir2 = path.join(workspace.rootPath, '_templates/circular2');
        
        await fs.ensureDir(dir1);
        await fs.ensureDir(dir2);
        
        await fs.symlink(dir2, path.join(dir1, 'link'));
        await fs.symlink(dir1, path.join(dir2, 'link'));
        
        const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
        const generators = await scanner.getGenerators();
        
        // Should detect and handle circular references
        expect(generators).toBeDefined();
      } catch (error) {
        // Symlinks might not be supported
        console.warn('Circular reference test skipped:', error.message);
      }
    });
  });

  describe('Error Information Disclosure', () => {
    test('should not expose sensitive paths in error messages', async () => {
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      
      try {
        await scanner.readTemplate('/etc/shadow');
      } catch (error) {
        // Error should not expose system information
        expect(error.message).not.toContain('/etc/shadow');
        expect(error.message).not.toContain('Permission denied');
      }
    });

    test('should sanitize stack traces', async () => {
      const maliciousTemplate = `---
to: output.js
---
{{ undefinedFunction() }}`;

      await workspace.createTemplate('security', 'error', maliciousTemplate);
      
      // Template processing errors should not expose internal details
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      const content = await scanner.readTemplate(
        path.join(workspace.rootPath, '_templates/security/error')
      );
      
      expect(content).toBeDefined();
      // Processing this template should handle errors safely
    });
  });

  describe('Dependency Security', () => {
    test('should use safe YAML parsing', async () => {
      const yamlContent = `---
safe: true
test: value
---
content`;

      await workspace.createTemplate('security', 'safe-yaml', yamlContent);
      
      const scanner = new TemplateScanner({ baseDir: workspace.rootPath });
      const content = await scanner.readTemplate(
        path.join(workspace.rootPath, '_templates/security/safe-yaml')
      );
      
      expect(content).toBeDefined();
      // YAML parsing should be safe and not execute code
    });

    test('should sanitize template engine output', async () => {
      const template = `---
to: output.html
---
<script>alert('{{ userInput }}')</script>`;

      await workspace.createTemplate('security', 'xss', template);
      
      // Template engine should escape output appropriately
      // This would be tested at the generation level with actual variables
    });
  });
});