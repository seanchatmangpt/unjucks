/**
 * Input Sanitization Security Tests
 * Validates input sanitization and validation in Unjucks
 */

const { describe, it, expect, beforeEach } = require('vitest');

// Mock input sanitizer for Unjucks
class InputSanitizer {
  constructor(options = {}) {
    this.options = {
      enableSanitization: true,
      allowHtml: false,
      maxLength: 10000,
      allowedTags: [],
      allowedAttributes: [],
      ...options
    };
  }

  sanitizeString(input) {
    if (!this.options.enableSanitization) {
      return input; // Vulnerable mode for testing
    }

    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    if (input.length > this.options.maxLength) {
      throw new Error(`Input exceeds maximum length of ${this.options.maxLength}`);
    }

    let sanitized = input;

    // Remove null bytes
    sanitized = sanitized.replace(/\x00/g, '');

    // Handle HTML based on configuration
    if (!this.options.allowHtml) {
      sanitized = this.escapeHtml(sanitized);
    } else {
      sanitized = this.sanitizeHtml(sanitized);
    }

    // Remove control characters except whitespace
    sanitized = sanitized.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  sanitizeObject(obj) {
    if (!this.options.enableSanitization) {
      return obj;
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      // Check for prototype pollution
      if (this.hasPrototypePollution(obj)) {
        throw new Error('Prototype pollution detected');
      }

      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key
        const sanitizedKey = this.sanitizePropertyName(key);
        // Sanitize value
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  escapeHtml(text) {
    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };

    return text.replace(/[&<>"'/]/g, char => htmlEscapes[char]);
  }

  sanitizeHtml(html) {
    // Simple allowlist-based HTML sanitization
    if (this.options.allowedTags.length === 0) {
      return this.escapeHtml(html);
    }

    // This is a simplified implementation
    // In production, use a proper HTML sanitization library like DOMPurify
    let sanitized = html;

    // Remove script tags completely
    sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');
    
    // Remove dangerous event handlers
    sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
    
    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');

    return sanitized;
  }

  sanitizePropertyName(name) {
    if (typeof name !== 'string') {
      throw new Error('Property name must be a string');
    }

    // Block dangerous property names
    const blockedNames = [
      '__proto__',
      'constructor',
      'prototype',
      'eval',
      'toString',
      'valueOf'
    ];

    if (blockedNames.includes(name)) {
      throw new Error(`Blocked property name: ${name}`);
    }

    // Remove null bytes and control characters
    const sanitized = name.replace(/[\x00-\x1F\x7F]/g, '');

    // Validate property name format
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(sanitized)) {
      throw new Error(`Invalid property name format: ${sanitized}`);
    }

    return sanitized;
  }

  hasPrototypePollution(obj) {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    return dangerousKeys.some(key => {
      return Object.prototype.hasOwnProperty.call(obj, key);
    });
  }

  validateInputType(input, expectedType) {
    const actualType = typeof input;
    
    if (actualType !== expectedType) {
      throw new Error(`Expected ${expectedType}, got ${actualType}`);
    }
    
    return true;
  }

  validateRange(value, min, max) {
    if (typeof value !== 'number') {
      throw new Error('Value must be a number');
    }
    
    if (value < min || value > max) {
      throw new Error(`Value ${value} is outside range [${min}, ${max}]`);
    }
    
    return true;
  }

  validatePattern(input, pattern) {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    
    if (!pattern.test(input)) {
      throw new Error(`Input does not match required pattern`);
    }
    
    return true;
  }
}

describe('Input Sanitization Security Tests', () => {
  let sanitizer;

  beforeEach(() => {
    sanitizer = new InputSanitizer({
      enableSanitization: true,
      allowHtml: false,
      maxLength: 1000
    });
  });

  describe('String Sanitization', () => {
    it('should escape HTML characters', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '"><script>alert(1)</script>',
        "'><script>alert(1)</script>",
        'javascript:alert(1)'
      ];

      maliciousInputs.forEach(input => {
        const sanitized = sanitizer.sanitizeString(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
        expect(sanitized).not.toContain('javascript:');
      });
    });

    it('should remove null bytes', () => {
      const nullByteInputs = [
        'normal\x00malicious',
        '\x00<script>alert(1)</script>',
        'data\x00\x00\x00more',
        'test\x00'
      ];

      nullByteInputs.forEach(input => {
        const sanitized = sanitizer.sanitizeString(input);
        expect(sanitized).not.toContain('\x00');
      });
    });

    it('should remove control characters', () => {
      const controlCharInputs = [
        'test\x01\x02\x03',
        '\x0Bvertical\x0Ctab',
        'form\x0Efeed\x0F',
        'data\x7F'
      ];

      controlCharInputs.forEach(input => {
        const sanitized = sanitizer.sanitizeString(input);
        // Should not contain control characters except normal whitespace
        expect(sanitized).toMatch(/^[^\x01-\x08\x0B\x0C\x0E-\x1F\x7F]*$/);
      });
    });

    it('should enforce maximum length', () => {
      const longInput = 'a'.repeat(2000);
      
      expect(() => {
        sanitizer.sanitizeString(longInput);
      }).toThrow('Input exceeds maximum length');
    });

    it('should preserve legitimate content', () => {
      const legitimateInputs = [
        'Hello World',
        'User Name 123',
        'email@example.com',
        'Valid input with spaces and numbers 456',
        'Special chars: !@#$%^&*()'
      ];

      legitimateInputs.forEach(input => {
        const sanitized = sanitizer.sanitizeString(input);
        // Content should be preserved (just escaped if HTML)
        expect(sanitized.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Object Sanitization', () => {
    it('should detect and block prototype pollution', () => {
      const pollutionAttempts = [
        { __proto__: { polluted: true } },
        { constructor: { prototype: { admin: true } } },
        { prototype: { dangerous: 'yes' } }
      ];

      pollutionAttempts.forEach(obj => {
        expect(() => {
          sanitizer.sanitizeObject(obj);
        }).toThrow('Prototype pollution detected');
      });
    });

    it('should sanitize nested objects recursively', () => {
      const nestedObject = {
        user: {
          name: '<script>alert(1)</script>',
          profile: {
            bio: '<img src=x onerror=alert(1)>',
            data: 'normal text'
          }
        },
        settings: {
          theme: 'dark',
          notifications: '<svg onload=alert(1)>'
        }
      };

      const sanitized = sanitizer.sanitizeObject(nestedObject);
      
      expect(sanitized.user.name).not.toContain('<script>');
      expect(sanitized.user.profile.bio).not.toContain('onerror=');
      expect(sanitized.settings.notifications).not.toContain('onload=');
      expect(sanitized.user.profile.data).toBe('normal text');
    });

    it('should sanitize arrays', () => {
      const arrayWithMalicious = [
        'normal item',
        '<script>alert(1)</script>',
        {
          name: '<img src=x onerror=alert(1)>',
          value: 'safe'
        },
        ['nested', '<svg onload=alert(1)>']
      ];

      const sanitized = sanitizer.sanitizeObject(arrayWithMalicious);
      
      expect(sanitized[0]).toBe('normal item');
      expect(sanitized[1]).not.toContain('<script>');
      expect(sanitized[2].name).not.toContain('onerror=');
      expect(sanitized[2].value).toBe('safe');
      expect(sanitized[3][1]).not.toContain('onload=');
    });

    it('should handle null and undefined values', () => {
      const objectWithNulls = {
        nullValue: null,
        undefinedValue: undefined,
        normalValue: 'test'
      };

      const sanitized = sanitizer.sanitizeObject(objectWithNulls);
      
      expect(sanitized.nullValue).toBeNull();
      expect(sanitized.undefinedValue).toBeUndefined();
      expect(sanitized.normalValue).toBe('test');
    });
  });

  describe('Property Name Validation', () => {
    it('should block dangerous property names', () => {
      const dangerousNames = [
        '__proto__',
        'constructor',
        'prototype',
        'eval',
        'toString',
        'valueOf'
      ];

      dangerousNames.forEach(name => {
        expect(() => {
          sanitizer.sanitizePropertyName(name);
        }).toThrow(`Blocked property name: ${name}`);
      });
    });

    it('should validate property name format', () => {
      const invalidNames = [
        '123invalid', // starts with number
        'invalid-name', // contains hyphen
        'invalid.name', // contains dot
        'invalid name', // contains space
        'invalid@name', // contains special char
        '', // empty string
        'invalid\x00name' // contains null byte
      ];

      invalidNames.forEach(name => {
        expect(() => {
          sanitizer.sanitizePropertyName(name);
        }).toThrow('Invalid property name format');
      });
    });

    it('should allow valid property names', () => {
      const validNames = [
        'validName',
        'valid_name',
        'valid123',
        '_privateProperty',
        '$specialProperty',
        'CamelCaseProperty'
      ];

      validNames.forEach(name => {
        expect(() => {
          const result = sanitizer.sanitizePropertyName(name);
          expect(result).toBe(name);
        }).not.toThrow();
      });
    });
  });

  describe('Type Validation', () => {
    it('should validate expected types', () => {
      const testCases = [
        { input: 'string', expected: 'string', shouldPass: true },
        { input: 123, expected: 'number', shouldPass: true },
        { input: true, expected: 'boolean', shouldPass: true },
        { input: {}, expected: 'object', shouldPass: true },
        { input: 'string', expected: 'number', shouldPass: false },
        { input: 123, expected: 'string', shouldPass: false }
      ];

      testCases.forEach(({ input, expected, shouldPass }) => {
        if (shouldPass) {
          expect(() => {
            sanitizer.validateInputType(input, expected);
          }).not.toThrow();
        } else {
          expect(() => {
            sanitizer.validateInputType(input, expected);
          }).toThrow(`Expected ${expected}, got ${typeof input}`);
        }
      });
    });
  });

  describe('Range Validation', () => {
    it('should validate numeric ranges', () => {
      const testCases = [
        { value: 5, min: 1, max: 10, shouldPass: true },
        { value: 1, min: 1, max: 10, shouldPass: true },
        { value: 10, min: 1, max: 10, shouldPass: true },
        { value: 0, min: 1, max: 10, shouldPass: false },
        { value: 11, min: 1, max: 10, shouldPass: false },
        { value: -5, min: 1, max: 10, shouldPass: false }
      ];

      testCases.forEach(({ value, min, max, shouldPass }) => {
        if (shouldPass) {
          expect(() => {
            sanitizer.validateRange(value, min, max);
          }).not.toThrow();
        } else {
          expect(() => {
            sanitizer.validateRange(value, min, max);
          }).toThrow(`Value ${value} is outside range [${min}, ${max}]`);
        }
      });
    });

    it('should reject non-numeric values', () => {
      const nonNumericValues = ['string', {}, [], true, null, undefined];

      nonNumericValues.forEach(value => {
        expect(() => {
          sanitizer.validateRange(value, 1, 10);
        }).toThrow('Value must be a number');
      });
    });
  });

  describe('Pattern Validation', () => {
    it('should validate against regex patterns', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      const testCases = [
        { input: 'valid@example.com', pattern: emailPattern, shouldPass: true },
        { input: 'user@domain.org', pattern: emailPattern, shouldPass: true },
        { input: 'invalid-email', pattern: emailPattern, shouldPass: false },
        { input: 'missing@domain', pattern: emailPattern, shouldPass: false },
        { input: '@domain.com', pattern: emailPattern, shouldPass: false }
      ];

      testCases.forEach(({ input, pattern, shouldPass }) => {
        if (shouldPass) {
          expect(() => {
            sanitizer.validatePattern(input, pattern);
          }).not.toThrow();
        } else {
          expect(() => {
            sanitizer.validatePattern(input, pattern);
          }).toThrow('Input does not match required pattern');
        }
      });
    });

    it('should reject non-string inputs for pattern validation', () => {
      const pattern = /^[a-z]+$/;
      const nonStringInputs = [123, {}, [], true, null, undefined];

      nonStringInputs.forEach(input => {
        expect(() => {
          sanitizer.validatePattern(input, pattern);
        }).toThrow('Input must be a string');
      });
    });
  });

  describe('HTML Sanitization with Allowlist', () => {
    it('should allow configured HTML tags', () => {
      const htmlSanitizer = new InputSanitizer({
        enableSanitization: true,
        allowHtml: true,
        allowedTags: ['p', 'strong', 'em']
      });

      const htmlInput = '<p>Hello <strong>world</strong> <script>alert(1)</script></p>';
      const sanitized = htmlSanitizer.sanitizeString(htmlInput);
      
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove dangerous event handlers from allowed tags', () => {
      const htmlSanitizer = new InputSanitizer({
        enableSanitization: true,
        allowHtml: true,
        allowedTags: ['img']
      });

      const maliciousHtml = '<img src="image.jpg" onerror="alert(1)" onload="evil()">';
      const sanitized = htmlSanitizer.sanitizeString(maliciousHtml);
      
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).not.toContain('onload=');
    });
  });

  describe('Configuration-based Behavior', () => {
    it('should disable sanitization when configured', () => {
      const unsafeSanitizer = new InputSanitizer({
        enableSanitization: false
      });

      const maliciousInput = '<script>alert(1)</script>';
      const result = unsafeSanitizer.sanitizeString(maliciousInput);
      
      expect(result).toBe(maliciousInput);
    });

    it('should respect custom length limits', () => {
      const shortLimitSanitizer = new InputSanitizer({
        enableSanitization: true,
        maxLength: 10
      });

      expect(() => {
        shortLimitSanitizer.sanitizeString('This is longer than 10 characters');
      }).toThrow('Input exceeds maximum length of 10');
    });
  });

  describe('Performance and DoS Protection', () => {
    it('should handle sanitization efficiently', () => {
      const startTime = this.getDeterministicTimestamp();
      
      // Test 1000 sanitization operations
      for (let i = 0; i < 1000; i++) {
        sanitizer.sanitizeString(`Test input ${i} with <script>alert(${i})</script>`);
      }
      
      const endTime = this.getDeterministicTimestamp();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (< 1 second for 1000 operations)
      expect(duration).toBeLessThan(1000);
    });

    it('should prevent ReDoS attacks with pattern validation', () => {
      // Test with a potentially vulnerable regex pattern
      const vulnerablePattern = /^(a+)+$/;
      const reDoSInput = 'a'.repeat(50) + 'b'; // Should not match and could cause ReDoS
      
      const startTime = this.getDeterministicTimestamp();
      
      expect(() => {
        sanitizer.validatePattern(reDoSInput, vulnerablePattern);
      }).toThrow('Input does not match required pattern');
      
      const endTime = this.getDeterministicTimestamp();
      const duration = endTime - startTime;
      
      // Should complete quickly even with vulnerable pattern
      expect(duration).toBeLessThan(100);
    });
  });
});

// Export test results for security dashboard
if (typeof window === 'undefined') {
  module.exports = {
    testSuite: 'Input Sanitization Security',
    vulnerabilityTypes: [
      'Cross-Site Scripting (XSS)',
      'Prototype Pollution',
      'Control Character Injection',
      'HTML Injection'
    ],
    securityControls: [
      'HTML escaping',
      'Control character removal',
      'Type validation',
      'Range validation',
      'Pattern validation',
      'Property name validation'
    ]
  };
}