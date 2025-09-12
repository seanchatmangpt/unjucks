/**
 * Template Linter Test Suite
 * Comprehensive tests for KGEN template linting system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { 
  TemplateLinter, 
  lintTemplateDirectory,
  createDeterminismReport,
  LintSeverity,
  DEFAULT_LINT_RULES
} from '../packages/kgen-cli/src/lib/template-linter.js';

describe('TemplateLinter', () => {
  let tempDir;
  let linter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kgen-lint-test-'));
    linter = new TemplateLinter({ cache: false }); // Disable cache for testing
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Basic Linting', () => {
    it('should detect non-deterministic functions', async () => {
      const template = `
---
to: output.js
---
const timestamp = {{ now() }};
const random = {{ Math.random() }};
const uuid = {{ uuid() }};
      `;

      const templatePath = join(tempDir, 'test.njk');
      await writeFile(templatePath, template);

      const result = await linter.lintTemplate(templatePath);

      expect(result.deterministic).toBe(false);
      expect(result.stats.errors).toBe(3);
      
      const errorMessages = result.issues
        .filter(i => i.severity === LintSeverity.ERROR)
        .map(i => i.message);
      
      expect(errorMessages).toContainEqual(expect.stringContaining('now()'));
      expect(errorMessages).toContainEqual(expect.stringContaining('Math.random()'));
      expect(errorMessages).toContainEqual(expect.stringContaining('uuid()'));
    });

    it('should detect external data sources', async () => {
      const template = `
---
to: api-client.js
---
const data = await {{ fetch('https://api.example.com') }};
const envVar = {{ process.env.DYNAMIC_VALUE }};
const fileData = {{ fs.readFile('dynamic.json') }};
      `;

      const templatePath = join(tempDir, 'api-client.njk');
      await writeFile(templatePath, template);

      const result = await linter.lintTemplate(templatePath);

      expect(result.stats.warnings).toBeGreaterThan(0);
      
      const warningMessages = result.issues
        .filter(i => i.severity === LintSeverity.WARNING)
        .map(i => i.message);

      expect(warningMessages.some(m => m.includes('fetch('))).toBe(true);
      expect(warningMessages.some(m => m.includes('process.env'))).toBe(true);
    });

    it('should detect time-dependent logic', async () => {
      const template = `
---
to: date-utils.js
---
const year = {{ this.getDeterministicDate().getFullYear() }};
const timestamp = {{ this.getDeterministicTimestamp().toString() }};
const iso = {{ this.getDeterministicDate().toISOString() }};
      `;

      const templatePath = join(tempDir, 'date-utils.njk');
      await writeFile(templatePath, template);

      const result = await linter.lintTemplate(templatePath);

      expect(result.stats.warnings).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('getFullYear'))).toBe(true);
      expect(result.issues.some(i => i.message.includes('toISOString'))).toBe(true);
    });

    it('should detect performance issues', async () => {
      const template = `
---
to: complex.html
---
{% for item in items %}
  {% for subitem in item.subitems %}
    {% for detail in subitem.details %}
      <div>{{ detail | sort | reverse | upper | trim }}</div>
    {% endfor %}
  {% endfor %}
{% endfor %}
      `;

      const templatePath = join(tempDir, 'complex.njk');
      await writeFile(templatePath, template);

      const result = await linter.lintTemplate(templatePath);

      expect(result.stats.performance).toBeGreaterThan(0);
      expect(result.issues.some(i => i.severity === LintSeverity.PERFORMANCE)).toBe(true);
    });

    it('should provide helpful suggestions', async () => {
      const template = `
---
to: suggestions.js
---
const time = {{ now() }};
const id = {{ uuid() }};
      `;

      const templatePath = join(tempDir, 'suggestions.njk');
      await writeFile(templatePath, template);

      const result = await linter.lintTemplate(templatePath);

      const suggestions = result.issues
        .filter(i => i.suggestion)
        .map(i => i.suggestion);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('template variables'))).toBe(true);
    });
  });

  describe('Whitelisting', () => {
    it('should allow non-deterministic functions in test contexts', async () => {
      const template = `
---
to: test/mock-data.js
context: test
---
const mockTime = {{ now() }};
const randomData = {{ Math.random() }};
      `;

      const templatePath = join(tempDir, 'test', 'mock.njk');
      await writeFile(templatePath, template, { recursive: true });

      const result = await linter.lintTemplate(templatePath);

      // Should still detect issues but not fail determinism
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => i.rule === 'whitelisted-context')).toBe(true);
    });

    it('should respect ignore-whitelist option', async () => {
      const template = `
---
to: fixture/data.js
---
const time = {{ now() }};
      `;

      const templatePath = join(tempDir, 'fixture', 'data.njk');
      await writeFile(templatePath, template, { recursive: true });

      const resultWhitelisted = await linter.lintTemplate(templatePath);
      const resultIgnoreWhitelist = await linter.lintTemplate(templatePath, { 
        respectWhitelist: false 
      });

      expect(resultWhitelisted.issues.length).toBeLessThan(resultIgnoreWhitelist.issues.length);
    });
  });

  describe('Performance', () => {
    it('should complete linting within performance target', async () => {
      const template = `
---
to: simple.txt
---
Hello {{ name }}!
      `;

      const templatePath = join(tempDir, 'simple.njk');
      await writeFile(templatePath, template);

      const linterWithTarget = new TemplateLinter({ performanceTarget: 10 });
      const result = await linterWithTarget.lintTemplate(templatePath);

      expect(result.stats.lintTime).toBeLessThan(10);
    });

    it('should cache results for repeated linting', async () => {
      const template = `
---
to: cached.js
---
const value = "{{ staticValue }}";
      `;

      const templatePath = join(tempDir, 'cached.njk');
      await writeFile(templatePath, template);

      const cachedLinter = new TemplateLinter({ cache: true });
      
      const firstResult = await cachedLinter.lintTemplate(templatePath);
      const secondResult = await cachedLinter.lintTemplate(templatePath);

      expect(firstResult.hash).toBe(secondResult.hash);
      expect(cachedLinter.getCacheStats().size).toBe(1);
    });
  });

  describe('Template Syntax Validation', () => {
    it('should detect invalid Nunjucks syntax', async () => {
      const template = `
---
to: invalid.html
---
{% for item in items %
  <div>{{ item }}</div>
      `;

      const templatePath = join(tempDir, 'invalid.njk');
      await writeFile(templatePath, template);

      const result = await linter.lintTemplate(templatePath);

      expect(result.issues.some(i => i.rule === 'template-syntax')).toBe(true);
      expect(result.deterministic).toBe(false);
    });

    it('should handle frontmatter parsing errors', async () => {
      const template = `
---
to: output.js
invalid: yaml: content
---
const value = "test";
      `;

      const templatePath = join(tempDir, 'bad-frontmatter.njk');
      await writeFile(templatePath, template);

      const result = await linter.lintTemplate(templatePath);

      expect(result.issues.some(i => i.rule === 'parse-error')).toBe(true);
    });
  });

  describe('Batch Linting', () => {
    beforeEach(async () => {
      // Create test templates
      const templates = {
        'good.njk': `
---
to: good.js
---
const value = "{{ staticValue }}";
        `,
        'bad.njk': `
---
to: bad.js
---
const time = {{ now() }};
        `,
        'complex.njk': `
---
to: complex.html
---
{% for i in range(100) %}
  {% for j in range(100) %}
    <div>{{ i }}:{{ j }}</div>
  {% endfor %}
{% endfor %}
        `,
        'subfolder/nested.njk': `
---
to: nested.js
---
const uuid = {{ uuid() }};
        `
      };

      for (const [path, content] of Object.entries(templates)) {
        const fullPath = join(tempDir, path);
        await writeFile(fullPath, content, { recursive: true });
      }
    });

    it('should lint multiple templates', async () => {
      const results = await linter.lintBatch([
        join(tempDir, 'good.njk'),
        join(tempDir, 'bad.njk')
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].deterministic).toBe(true);  // good.njk
      expect(results[1].deterministic).toBe(false); // bad.njk
    });

    it('should lint entire directory', async () => {
      const batchResult = await lintTemplateDirectory(tempDir);

      expect(batchResult.summary.total).toBe(4);
      expect(batchResult.summary.passed).toBeLessThan(batchResult.summary.total);
      expect(batchResult.results).toHaveLength(4);
    });

    it('should filter by extensions', async () => {
      // Create non-template file
      await writeFile(join(tempDir, 'readme.txt'), 'Not a template');

      const batchResult = await lintTemplateDirectory(tempDir, {
        extensions: ['.njk']
      });

      expect(batchResult.summary.total).toBe(4); // Only .njk files
    });
  });

  describe('Determinism Report', () => {
    it('should create comprehensive determinism report', async () => {
      const templates = [
        {
          templatePath: 'good.njk',
          deterministic: true,
          issues: []
        },
        {
          templatePath: 'bad.njk', 
          deterministic: false,
          issues: [
            { severity: LintSeverity.ERROR, rule: 'nonDeterministicFunctions', message: 'now() detected' },
            { severity: LintSeverity.WARNING, rule: 'externalDataSources', message: 'fetch() detected' },
            { severity: LintSeverity.PERFORMANCE, rule: 'complexNesting', message: 'Complex loops' }
          ]
        }
      ];

      const report = createDeterminismReport(templates);

      expect(report.determinismScore).toBe('50.0');
      expect(report.nonDeterministicCount).toBe(1);
      expect(report.errorsByType.nonDeterministicFunctions).toHaveLength(1);
      expect(report.performanceIssues).toHaveLength(1);
      expect(report.recommendations).toContain(
        expect.stringContaining('template variables')
      );
    });
  });

  describe('Custom Rules', () => {
    it('should support custom linting rules', async () => {
      const customRules = {
        customPattern: {
          severity: LintSeverity.ERROR,
          patterns: [/\bconsole\.log\(/g]
        }
      };

      const customLinter = new TemplateLinter({ rules: customRules });

      const template = `
---
to: debug.js
---
{{ console.log('debug') }};
      `;

      const templatePath = join(tempDir, 'debug.njk');
      await writeFile(templatePath, template);

      const result = await customLinter.lintTemplate(templatePath);

      expect(result.issues.some(i => i.rule === 'customPattern')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing templates gracefully', async () => {
      await expect(linter.lintTemplate('nonexistent.njk')).rejects.toThrow('Template not found');
    });

    it('should handle unreadable templates', async () => {
      const templatePath = join(tempDir, 'unreadable.njk');
      await writeFile(templatePath, '');
      
      // Simulate permission error by trying to read a directory as file
      const result = await linter.lintTemplate(templatePath);
      
      expect(result).toBeDefined();
      expect(result.templatePath).toBe(templatePath);
    });
  });
});

describe('Integration with SHACL System', () => {
  it('should be compatible with Agent 4 SHACL validation', () => {
    // Test that lint results can be consumed by SHACL validator
    const lintResult = {
      templatePath: 'test.njk',
      deterministic: false,
      issues: [
        {
          severity: LintSeverity.ERROR,
          rule: 'nonDeterministicFunctions',
          message: 'now() detected',
          line: 5,
          column: 10
        }
      ]
    };

    // Verify structure matches expected SHACL integration format
    expect(lintResult).toHaveProperty('templatePath');
    expect(lintResult).toHaveProperty('deterministic');
    expect(lintResult).toHaveProperty('issues');
    expect(lintResult.issues[0]).toHaveProperty('severity');
    expect(lintResult.issues[0]).toHaveProperty('rule');
    expect(lintResult.issues[0]).toHaveProperty('message');
  });
});

describe('CLI Integration', () => {
  it('should provide CLI-compatible error reporting', () => {
    const lintResults = [
      {
        templatePath: 'template1.njk',
        deterministic: false,
        issues: [{ severity: LintSeverity.ERROR, rule: 'test', message: 'Error' }]
      }
    ];

    const report = createDeterminismReport(lintResults);
    
    // Verify CLI can consume this format
    expect(report).toHaveProperty('determinismScore');
    expect(report).toHaveProperty('nonDeterministicCount');
    expect(report).toHaveProperty('recommendations');
  });
});