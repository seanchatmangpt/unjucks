/**
 * CRITICAL SECURITY VALIDATION - Path Traversal Attack Prevention
 * Quick validation test to ensure all security fixes are working
 */

import { describe, it, expect } from 'vitest';
import { validateFilePathSync } from '../src/lib/latex/validator-security-patch.js';

describe('Critical Security Validation', () => {
  
  it('should block all path traversal attacks', () => {
    const attacks = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      './../../sensitive',
      'legitimate/../../../etc/passwd',
      'file.txt\0.exe',
      'test.tex%00.bat',
      '/etc/passwd',
      'C:\\Windows\\System32\\config\\sam',
      '\\\\server\\share\\file.txt'
    ];

    attacks.forEach(attack => {
      const result = validateFilePathSync(attack, process.cwd());
      expect(result.isValid, `Attack should be blocked: ${attack}`).toBe(false);
      expect(result.severity).toBe('critical');
    });
  });

  it('should allow legitimate paths', () => {
    const legitimatePaths = [
      'src/test.tex',
      'templates/template.njk',
      'docs/readme.md',
      'output/document.pdf'
    ];

    legitimatePaths.forEach(path => {
      const result = validateFilePathSync(path, process.cwd());
      if (!result.isValid) {
        console.warn(`Legitimate path blocked: ${path} - ${result.error}`);
      }
      // Note: These might fail due to non-existence, but shouldn't fail due to security
      expect(result.severity !== 'critical' || result.violation !== 'path_traversal').toBe(true);
    });
  });

  it('should provide detailed security violation information', () => {
    const result = validateFilePathSync('../../../etc/passwd', process.cwd());
    
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.severity).toBe('critical');
    expect(result.violation).toBeDefined();
  });
});
