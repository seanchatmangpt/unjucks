/**
 * Tests for SecurityValidator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityValidator } from '../../src/lib/cleanroom/security-validator.js';

describe('SecurityValidator', () => {
  let securityValidator;

  beforeEach(() => {
    securityValidator = new SecurityValidator({
      maxFileSize: 1024 * 1024, // 1MB
      allowedFileTypes: ['.tex', '.bib', '.png', '.jpg'],
      maxVariableSize: 1024, // 1KB
      enableContentFiltering: true
    });
  });

  describe('template validation', () => {
    it('should validate clean LaTeX template', async () => {
      const template = `
\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
\\title{Test Document}
\\author{Test Author}
\\maketitle

\\section{Introduction}
This is a test document with variables: {{ title }} and {{ author }}.

\\subsection{Mathematical Content}
Here's an equation:
\\begin{equation}
E = mc^2
\\end{equation}

\\end{document}
      `.trim();

      const result = await securityValidator.validateTemplate(template, 'test-session');

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.metadata.fingerprint).toBeDefined();
    });

    it('should detect shell escape attempts', async () => {
      const dangerousTemplate = `
\\documentclass{article}
\\begin{document}
\\write18{rm -rf /important/files}
This template contains shell escape!
\\end{document}
      `.trim();

      const result = await securityValidator.validateTemplate(dangerousTemplate, 'test-session');

      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('shell escape'))).toBe(true);
    });

    it('should detect path traversal attempts', async () => {
      const maliciousTemplate = `
\\documentclass{article}
\\begin{document}
\\input{../../../etc/passwd}
\\include{../../sensitive/data.tex}
\\end{document}
      `.trim();

      const result = await securityValidator.validateTemplate(maliciousTemplate, 'test-session');

      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('path traversal'))).toBe(true);
    });

    it('should detect dangerous LaTeX commands', async () => {
      const dangerousCommands = [
        '\\immediate\\write18{dangerous_command}',
        '\\ShellEscape',
        '\\system{evil_command}',
        '\\openout\\file=sensitive.txt'
      ];

      for (const cmd of dangerousCommands) {
        const template = `
\\documentclass{article}
\\begin{document}
${cmd}
\\end{document}
        `.trim();

        const result = await securityValidator.validateTemplate(template, 'test-session');
        expect(result.isValid).toBe(false);
      }
    });

    it('should validate template size limits', async () => {
      const largeTemplate = 'x'.repeat(2 * 1024 * 1024); // 2MB, exceeds 1MB limit

      const result = await securityValidator.validateTemplate(largeTemplate, 'test-session');

      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('size exceeds'))).toBe(true);
    });

    it('should check line length limits', async () => {
      const longLine = 'a'.repeat(15000); // Exceeds typical line length limit
      const template = `
\\documentclass{article}
\\begin{document}
${longLine}
\\end{document}
      `.trim();

      const result = await securityValidator.validateTemplate(template, 'test-session');

      expect(result.warnings.some(w => w.includes('line') && w.includes('length'))).toBe(true);
    });

    it('should validate LaTeX document structure', async () => {
      const incompleteTemplate = `
\\documentclass{article}
\\begin{document}
Content without proper closing
      `.trim();

      const result = await securityValidator.validateTemplate(incompleteTemplate, 'test-session');

      expect(result.warnings.some(w => w.includes('\\end{document}'))).toBe(true);
    });
  });

  describe('variable validation', () => {
    it('should validate clean variables', async () => {
      const variables = {
        title: 'My Document',
        author: 'John Doe',
        year: 2023,
        sections: ['Introduction', 'Methods', 'Results'],
        config: {
          showToc: true,
          fontSize: 12
        }
      };

      const result = await securityValidator.validateVariables(variables, 'test-session');

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.metadata.variableCount).toBe(5);
    });

    it('should reject invalid variable names', async () => {
      const variables = {
        'valid_name': 'ok',
        '123invalid': 'bad',
        'also-invalid': 'bad',
        'with space': 'bad'
      };

      const result = await securityValidator.validateVariables(variables, 'test-session');

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should detect path traversal in string variables', async () => {
      const variables = {
        filename: '../../../etc/passwd',
        path: '..\\..\\..\\windows\\system32'
      };

      const result = await securityValidator.validateVariables(variables, 'test-session');

      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('path traversal'))).toBe(true);
    });

    it('should validate variable data size', async () => {
      const largeString = 'x'.repeat(2000); // Exceeds 1KB limit
      const variables = {
        largeData: largeString
      };

      const result = await securityValidator.validateVariables(variables, 'test-session');

      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('too large'))).toBe(true);
    });

    it('should validate object depth', async () => {
      // Create deeply nested object
      let deepObject = {};
      let current = deepObject;
      for (let i = 0; i < 15; i++) {
        current.nested = {};
        current = current.nested;
      }

      const variables = {
        deep: deepObject
      };

      const result = await securityValidator.validateVariables(variables, 'test-session');

      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('deeply nested'))).toBe(true);
    });

    it('should reject disallowed variable types', async () => {
      const validator = new SecurityValidator({
        allowedVariableTypes: ['string', 'number']
      });

      const variables = {
        str: 'allowed',
        num: 123,
        bool: true, // Not allowed
        func: () => {}, // Not allowed
        symbol: Symbol('test') // Not allowed
      };

      const result = await validator.validateVariables(variables, 'test-session');

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('file path validation', () => {
    it('should validate clean file paths', async () => {
      const cleanPaths = [
        'document.tex',
        'images/figure1.png',
        'chapters/introduction.tex',
        'data/references.bib'
      ];

      for (const filePath of cleanPaths) {
        const result = await securityValidator.validateFilePath(filePath);
        expect(result.isValid).toBe(true);
      }
    });

    it('should detect path traversal in file paths', async () => {
      const dangerousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/shadow',
        'C:\\Windows\\System32\\config\\SAM'
      ];

      for (const filePath of dangerousPaths) {
        const result = await securityValidator.validateFilePath(filePath);
        expect(result.isValid).toBe(false);
      }
    });

    it('should validate file extensions', async () => {
      const result1 = await securityValidator.validateFilePath('document.tex');
      expect(result1.isValid).toBe(true);

      const result2 = await securityValidator.validateFilePath('script.exe');
      expect(result2.isValid).toBe(false);
    });

    it('should check path boundaries when base directory is provided', async () => {
      const baseDir = '/safe/directory';
      
      const result1 = await securityValidator.validateFilePath('document.tex', baseDir);
      expect(result1.isValid).toBe(true);

      const result2 = await securityValidator.validateFilePath('../outside/file.tex', baseDir);
      expect(result2.isValid).toBe(false);
    });
  });

  describe('content filtering', () => {
    it('should detect suspicious patterns', async () => {
      const suspiciousContent = `
\\documentclass{article}
\\begin{document}
This content has excessive repetition: ${'a'.repeat(200)}

And possible base64: ${'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh'.repeat(3)}
\\end{document}
      `.trim();

      const result = await securityValidator.validateTemplate(suspiciousContent, 'test-session');

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect binary data in text content', async () => {
      const binaryContent = `
\\documentclass{article}
\\begin{document}
Normal text with binary: ${String.fromCharCode(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)}
\\end{document}
      `.trim();

      const result = await securityValidator.validateTemplate(binaryContent, 'test-session');

      // Should either reject or warn about binary data
      expect(result.isValid === false || result.warnings.length > 0).toBe(true);
    });
  });

  describe('comprehensive validation', () => {
    it('should validate all inputs together', async () => {
      const inputs = {
        template: `
\\documentclass{article}
\\begin{document}
\\title{{ title }}
\\author{{ author }}
\\maketitle
\\section{Content}
{{ content }}
\\end{document}
        `.trim(),
        variables: {
          title: 'Test Document',
          author: 'Test Author',
          content: 'This is the main content.'
        },
        options: {
          latex: {
            engine: 'pdflatex'
          }
        },
        sessionId: 'comprehensive-test'
      };

      const result = await securityValidator.validateAll(inputs);

      expect(result.isValid).toBe(true);
      expect(result.details.template).toBeDefined();
      expect(result.details.variables).toBeDefined();
      expect(result.details.options).toBeDefined();
    });

    it('should aggregate violations from all validations', async () => {
      const inputs = {
        template: '\\write18{dangerous_command}',
        variables: {
          'invalid-name': '../../../etc/passwd'
        },
        options: {},
        sessionId: 'violation-test'
      };

      const result = await securityValidator.validateAll(inputs);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(1);
    });
  });

  describe('content sanitization', () => {
    it('should sanitize dangerous content', () => {
      const dangerousContent = 'Normal text\x00with null bytes\x01\x02\x03';
      const sanitized = securityValidator.sanitizeContent(dangerousContent);

      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\x01');
      expect(sanitized).toContain('Normal text');
      expect(sanitized).toContain('with null bytes');
    });

    it('should handle excessive whitespace', () => {
      const excessiveWhitespace = 'Text with' + ' '.repeat(2000) + 'lots of spaces';
      const sanitized = securityValidator.sanitizeContent(excessiveWhitespace);

      expect(sanitized.length).toBeLessThan(excessiveWhitespace.length);
      expect(sanitized).toContain('Text with');
      expect(sanitized).toContain('lots of spaces');
    });
  });

  describe('statistics and monitoring', () => {
    it('should track validation statistics', async () => {
      const initialStats = securityValidator.getValidationStats();

      await securityValidator.validateTemplate('\\documentclass{article}\\begin{document}Test\\end{document}', 'test');
      await securityValidator.validateTemplate('\\write18{bad}', 'test');

      const finalStats = securityValidator.getValidationStats();

      expect(finalStats.totalValidations).toBe(initialStats.totalValidations + 2);
      expect(finalStats.failedValidations).toBe(initialStats.failedValidations + 1);
      expect(finalStats.lastValidation).toBeGreaterThan(initialStats.lastValidation || 0);
    });
  });
});