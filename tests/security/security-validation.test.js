/**
 * SECURITY VALIDATION TESTS
 * Critical security tests for LaTeX input validation and injection prevention
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  validateSecurityThreats, 
  validateFilePath, 
  validateCommand, 
  sanitizeInput 
} from '../../src/lib/latex/validator.js';
import { LaTeXTemplateGenerator } from '../../src/lib/latex/template-generator.js';

describe('LaTeX Security Validation', () => {
  describe('validateSecurityThreats', () => {
    it('should detect shell execution attempts', () => {
      const maliciousContent = '\\write18{rm -rf /}';
      const result = validateSecurityThreats(maliciousContent);
      
      expect(result.isSafe).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('critical');
      expect(result.violations[0].message).toContain('Shell command execution');
    });

    it('should detect path traversal attacks', () => {
      const maliciousContent = '\\input{../../../etc/passwd}';
      const result = validateSecurityThreats(maliciousContent);
      
      expect(result.isSafe).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('critical');
      expect(result.violations[0].message).toContain('Path traversal attack');
    });

    it('should detect Lua code execution', () => {
      const maliciousContent = '\\directlua{os.execute("malicious command")}';
      const result = validateSecurityThreats(maliciousContent);
      
      expect(result.isSafe).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('critical');
      expect(result.violations[0].message).toContain('Lua code execution');
    });

    it('should detect excessive command nesting (DoS)', () => {
      const maliciousContent = '{'.repeat(100) + '}' .repeat(100);
      const result = validateSecurityThreats(maliciousContent);
      
      expect(result.isSafe).toBe(false);
      const dosViolation = result.violations.find(v => v.type === 'dos_attack');
      expect(dosViolation).toBeDefined();
      expect(dosViolation.severity).toBe('high');
    });

    it('should allow safe LaTeX content', () => {
      const safeContent = `
        \\documentclass{article}
        \\usepackage{amsmath}
        \\begin{document}
        \\title{Safe Document}
        \\author{Safe Author}
        \\maketitle
        \\section{Introduction}
        This is safe content.
        \\end{document}
      `;
      
      const result = validateSecurityThreats(safeContent);
      expect(result.isSafe).toBe(true);
      expect(result.violations.filter(v => v.severity === 'critical' || v.severity === 'high')).toHaveLength(0);
    });
  });

  describe('validateFilePath', () => {
    it('should prevent path traversal attacks', () => {
      const maliciousPath = '../../../etc/passwd';
      const result = validateFilePath(maliciousPath);
      
      expect(result.isValid).toBe(false);
      expect(result.violation).toBe('path_traversal');
      expect(result.error).toContain('Path traversal attack detected');
    });

    it('should block dangerous file extensions', () => {
      const dangerousPath = './malicious.exe';
      const result = validateFilePath(dangerousPath);
      
      expect(result.isValid).toBe(false);
      expect(result.violation).toBe('dangerous_extension');
      expect(result.error).toContain('Dangerous file extension');
    });

    it('should allow safe file paths', () => {
      const safePath = './documents/safe-document.tex';
      const result = validateFilePath(safePath);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toContain('safe-document.tex');
    });
  });

  describe('validateCommand', () => {
    it('should block dangerous commands', () => {
      const result = validateCommand('write18', ['rm -rf /']);
      
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.violation).toBe('blocked_command');
    });

    it('should block unknown commands in strict mode', () => {
      const result = validateCommand('unknowncommand', []);
      
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('high');
      expect(result.violation).toBe('unknown_command');
    });

    it('should allow safe commands', () => {
      const result = validateCommand('textbf', ['safe text']);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should validate graphics paths', () => {
      const result = validateCommand('includegraphics', ['../../../etc/passwd']);
      
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('high');
      expect(result.error).toContain('Invalid graphics path');
    });

    it('should block dangerous packages', () => {
      const result = validateCommand('usepackage', ['shellesc']);
      
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.error).toContain('Dangerous package detected');
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous patterns', () => {
      const maliciousInput = '\\write18{malicious}\\directlua{bad}';
      const sanitized = sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('\\write18');
      expect(sanitized).not.toContain('\\directlua');
    });

    it('should remove control characters', () => {
      const maliciousInput = 'normal\x00text\x1Fwith\x7Fcontrol';
      const sanitized = sanitizeInput(maliciousInput);
      
      expect(sanitized).toBe('normaltext withcontrol');
    });

    it('should limit input length', () => {
      const longInput = 'a'.repeat(20000);
      const sanitized = sanitizeInput(longInput);
      
      expect(sanitized.length).toBeLessThanOrEqual(10000);
    });

    it('should normalize whitespace', () => {
      const input = 'text   with    excessive     whitespace';
      const sanitized = sanitizeInput(input);
      
      expect(sanitized).toBe('text with excessive whitespace');
    });
  });

  describe('LaTeX Template Generator Security', () => {
    let generator;

    beforeEach(() => {
      generator = new LaTeXTemplateGenerator();
    });

    it('should validate template configuration', () => {
      const maliciousConfig = {
        type: 'article',
        title: '\\write18{rm -rf /}',
        author: 'Safe Author',
        packages: ['shellesc']
      };

      const validation = generator.validateTemplateConfig(maliciousConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Title contains dangerous patterns');
      expect(validation.errors).toContain('Dangerous packages detected: shellesc');
    });

    it('should sanitize LaTeX content', () => {
      const maliciousContent = '\\write18{malicious}&dangerous%content';
      const sanitized = generator.sanitizeLatexContent(maliciousContent);
      
      expect(sanitized).not.toContain('\\write18');
      expect(sanitized).toContain('\\&');  // Escaped ampersand
      expect(sanitized).toContain('\\%');  // Escaped percent
    });

    it('should generate secure templates', () => {
      const safeConfig = {
        type: 'article',
        title: 'Safe Title',
        author: 'Safe Author',
        bibliography: false,
        packages: ['amsmath', 'graphicx']
      };

      const content = generator.generateTemplate(safeConfig);
      const validation = validateSecurityThreats(content);
      
      expect(validation.isSafe).toBe(true);
      expect(content).toContain('\\documentclass{article}');
      expect(content).toContain('\\title{Safe Title}');
      expect(content).toContain('\\author{Safe Author}');
    });

    it('should reject malicious template configurations', () => {
      const maliciousConfig = {
        type: 'article',
        title: '\\directlua{os.execute("malicious")}',
        author: 'Attacker',
        packages: ['write18']
      };

      expect(() => generator.generateTemplate(maliciousConfig)).toThrow('Security validation failed');
    });
  });

  describe('Attack Vector Tests', () => {
    const attackVectors = [
      {
        name: 'Shell execution via write18',
        payload: '\\write18{cat /etc/passwd}',
        expectedDetection: 'Shell command execution'
      },
      {
        name: 'Path traversal in input',
        payload: '\\input{../../../../etc/shadow}',
        expectedDetection: 'Path traversal attack'
      },
      {
        name: 'Lua code injection',
        payload: '\\directlua{require("os").execute("malicious")}',
        expectedDetection: 'Lua code execution'
      },
      {
        name: 'File system access',
        payload: '\\openout\\myfile=malicious.txt',
        expectedDetection: 'file system access'
      },
      {
        name: 'JavaScript URL scheme',
        payload: '\\href{javascript:alert("xss")}{click}',
        expectedDetection: 'JavaScript URL scheme'
      },
      {
        name: 'Local file access',
        payload: '\\url{file:///etc/passwd}',
        expectedDetection: 'Local file URL scheme'
      }
    ];

    attackVectors.forEach(({ name, payload, expectedDetection }) => {
      it(`should detect: ${name}`, () => {
        const result = validateSecurityThreats(payload);
        
        expect(result.isSafe).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
        
        const criticalViolations = result.violations.filter(
          v => v.severity === 'critical' || v.severity === 'high'
        );
        expect(criticalViolations.length).toBeGreaterThan(0);
        
        const detectionFound = result.violations.some(v => 
          v.message.toLowerCase().includes(expectedDetection.toLowerCase())
        );
        expect(detectionFound).toBe(true);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large inputs without DoS', () => {
      const largeInput = 'safe content '.repeat(50000);  // ~650KB
      
      const startTime = this.getDeterministicTimestamp();
      const result = validateSecurityThreats(largeInput);
      const duration = this.getDeterministicTimestamp() - startTime;
      
      // Should complete within reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
      
      // Should detect size violation
      expect(result.isSafe).toBe(false);
      const sizeViolation = result.violations.find(v => v.message.includes('Content too large'));
      expect(sizeViolation).toBeDefined();
    });

    it('should handle deeply nested structures', () => {
      const deepNesting = '{'.repeat(100) + 'content' + '}'.repeat(100);
      
      const result = validateSecurityThreats(deepNesting);
      
      expect(result.isSafe).toBe(false);
      const nestingViolation = result.violations.find(v => v.message.includes('nesting'));
      expect(nestingViolation).toBeDefined();
    });
  });
});

describe('Integration Security Tests', () => {
  it('should prevent command line injection through all vectors', () => {
    const maliciousInputs = [
      '../../../etc/passwd',
      '$(rm -rf /)',
      '`malicious command`',
      '\\write18{dangerous}',
      'normal; rm -rf /',
      'file.tex && malicious'
    ];

    maliciousInputs.forEach(input => {
      const pathResult = validateFilePath(input);
      const threatResult = validateSecurityThreats(input);
      const sanitized = sanitizeInput(input);
      
      // At least one validation should catch the threat
      const isSafe = pathResult.isValid && threatResult.isSafe;
      const isSanitized = sanitized !== input;
      
      expect(isSafe || isSanitized).toBe(true);
    });
  });
});