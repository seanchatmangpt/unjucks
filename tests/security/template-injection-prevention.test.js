/**
 * Template Injection Prevention Security Tests
 * Tests for Nunjucks template injection vulnerabilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InjectionPreventionFilter } from '../../src/security/protection/injection-prevention.js';
import nunjucks from 'nunjucks';

describe('Template Injection Prevention', () => {
  let filter;
  let env;

  beforeEach(() => {
    filter = new InjectionPreventionFilter();
    env = new nunjucks.Environment();
    
    // Configure Nunjucks with security hardening
    env.configure({
      autoescape: true,
      throwOnUndefined: true
    });
  });

  describe('Server-Side Template Injection (SSTI) Prevention', () => {
    it('should block template injection attempts', async () => {
      const maliciousInputs = [
        '{{ 7*7 }}',
        '{{ global.process.exit() }}',
        '{{ constructor.constructor("return process")().exit() }}',
        '{{ this.constructor.constructor("return this.process.env")() }}',
        '{% for item in ().__class__.__base__.__subclasses__() %}{% endfor %}',
        '{{ cycler.__init__.__globals__.os.popen("id").read() }}',
        '{{ request.application.__globals__.__builtins__.__import__("os").popen("id").read() }}'
      ];

      for (const input of maliciousInputs) {
        const result = await filter.validateString(input, 'template_input');
        
        expect(result.isClean).toBe(false);
        expect(result.threats.length).toBeGreaterThan(0);
        expect(result.threats.some(t => t.type === 'TEMPLATE_INJECTION')).toBe(true);
      }
    });

    it('should sanitize template expressions in user input', async () => {
      const testData = {
        userInput: '{{ 7*7 }}',
        templateVar: 'normal text with {{ user.name }}',
        config: { setting: '{{ process.env.SECRET }}' }
      };

      const result = await filter.validateData(testData, 'user_data');
      
      expect(result.isClean).toBe(false);
      expect(result.sanitizedData.userInput).not.toContain('{{');
      expect(result.sanitizedData.userInput).not.toContain('}}');
    });

    it('should allow safe template expressions', async () => {
      const safeInputs = [
        'Hello {{ name }}',
        'Welcome to {{ siteName }}',
        '{% if user %}Hello {% endif %}',
        '{{ items | length }}',
        '{{ message | escape }}'
      ];

      for (const input of safeInputs) {
        const result = await filter.validateString(input, 'safe_template');
        
        // These should be flagged for review but not necessarily blocked
        expect(result.threats.filter(t => t.severity === 'CRITICAL')).toHaveLength(0);
      }
    });
  });

  describe('Nunjucks-Specific Security', () => {
    it('should prevent access to global objects', () => {
      const maliciousTemplate = '{{ global.process.env.NODE_ENV }}';
      
      expect(() => {
        env.renderString(maliciousTemplate);
      }).toThrow();
    });

    it('should prevent constructor access', () => {
      const maliciousTemplate = '{{ constructor.constructor("return process")() }}';
      
      expect(() => {
        env.renderString(maliciousTemplate, {});
      }).toThrow();
    });

    it('should prevent __proto__ access', () => {
      const maliciousTemplate = '{{ {}.__proto__.constructor.constructor("return process")() }}';
      
      expect(() => {
        env.renderString(maliciousTemplate, {});
      }).toThrow();
    });

    it('should safely render user data with proper escaping', () => {
      const template = 'Hello {{ userName }}';
      const userData = { userName: '<script>alert("xss")</script>' };
      
      const rendered = env.renderString(template, userData);
      
      expect(rendered).not.toContain('<script>');
      expect(rendered).toContain('&lt;script&gt;');
    });
  });

  describe('Template Path Security', () => {
    it('should prevent template path traversal', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '../../../../proc/self/environ',
        '../templates/../../../sensitive.txt'
      ];

      for (const path of maliciousPaths) {
        const result = await filter.validateString(path, 'template_path');
        
        expect(result.isClean).toBe(false);
        expect(result.threats.some(t => t.type === 'PATH_TRAVERSAL')).toBe(true);
      }
    });

    it('should allow safe template paths', async () => {
      const safePaths = [
        'templates/user/profile.njk',
        'layouts/base.njk',
        'components/header.html',
        'forms/contact-form.njk'
      ];

      for (const path of safePaths) {
        const result = await filter.validateString(path, 'template_path');
        
        expect(result.threats.filter(t => t.type === 'PATH_TRAVERSAL')).toHaveLength(0);
      }
    });
  });

  describe('Dynamic Template Generation Security', () => {
    it('should validate dynamically generated template content', async () => {
      const dynamicContent = {
        templateBody: 'Hello {{ name }}',
        variables: { name: 'user input' },
        includes: ['header.njk', 'footer.njk']
      };

      const result = await filter.validateData(dynamicContent, 'dynamic_template');
      
      expect(result.isClean).toBe(true);
      expect(result.sanitizedData).toBeDefined();
    });

    it('should block malicious dynamic content', async () => {
      const maliciousContent = {
        templateBody: '{{ global.process.exit() }}',
        variables: { 
          payload: '{{ constructor.constructor("return process")() }}'
        },
        includes: ['../../../etc/passwd']
      };

      const result = await filter.validateData(maliciousContent, 'malicious_template');
      
      expect(result.isClean).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });
  });

  describe('File Operations Security', () => {
    it('should prevent unauthorized file system access', async () => {
      const maliciousOperations = [
        'fs.readFileSync("/etc/passwd")',
        'require("child_process").exec("rm -rf /")',
        'process.env.NODE_ENV',
        '__dirname + "/../../../"'
      ];

      for (const operation of maliciousOperations) {
        const result = await filter.validateString(operation, 'file_operation');
        
        expect(result.isClean).toBe(false);
        expect(result.threats.some(t => 
          t.type === 'CODE_INJECTION' || 
          t.type === 'FILE_SYSTEM_ACCESS'
        )).toBe(true);
      }
    });
  });

  describe('Content Security Policy Integration', () => {
    it('should generate CSP-compatible templates', async () => {
      const template = `
        <script>
          console.log('{{ message | safe }}');
        </script>
        <style>
          .class { color: {{ color }}; }
        </style>
      `;

      const result = await filter.validateString(template, 'csp_template');
      
      // Should flag inline scripts/styles for CSP compliance
      expect(result.threats.some(t => t.type === 'CSP_VIOLATION')).toBe(true);
    });
  });

  describe('Performance and DoS Prevention', () => {
    it('should prevent template complexity attacks', async () => {
      // Generate deeply nested template that could cause DoS
      let complexTemplate = '{{ ';
      for (let i = 0; i < 1000; i++) {
        complexTemplate += 'nested.';
      }
      complexTemplate += 'value }}';

      const result = await filter.validateString(complexTemplate, 'complex_template');
      
      expect(result.threats.some(t => t.type === 'COMPLEXITY_ATTACK')).toBe(true);
    });

    it('should limit template size', async () => {
      const largeTemplate = 'a'.repeat(10000000); // 10MB template
      
      const result = await filter.validateString(largeTemplate, 'large_template');
      
      expect(result.threats.some(t => t.type === 'SIZE_LIMIT_EXCEEDED')).toBe(true);
    });
  });
});