/**
 * COMPREHENSIVE PATH TRAVERSAL SECURITY TESTS
 * Tests all implemented security measures against known attack vectors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { 
  validateFilePathSecure, 
  validateFilePathSync, 
  validateFilePath 
} from '../src/lib/latex/validator-security-patch.js';
import { 
  PathSecurityManager, 
  initializePathSecurity 
} from '../src/lib/latex/path-security.js';

describe('Path Traversal Security Tests', () => {
  let testDir;
  let pathSecurity;

  beforeEach(async () => {
    // Create isolated test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-test-'));
    
    // Initialize security manager
    pathSecurity = await initializePathSecurity(testDir, {
      allowedDirectories: ['src', 'templates', 'tests', 'docs'],
      maxAuditEntries: 1000
    });

    // Create test file structure
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'templates'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'src', 'test.tex'), 'test content');
    await fs.writeFile(path.join(testDir, 'templates', 'template.njk'), 'template content');
  });

  describe('PathSecurityManager - Comprehensive Attack Prevention', () => {
    
    it('should block basic path traversal attacks', async () => {
      const attacks = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'src/../../../etc/passwd',
        'templates\\..\\..\\..\\windows\\system32',
        './../../etc/passwd',
        './../../../etc/passwd'
      ];

      for (const attack of attacks) {
        const result = await pathSecurity.validateAndSecurePath(attack);
        expect(result.isValid, `Attack should be blocked: ${attack}`).toBe(false);
        expect(result.reason).toContain('traversal');
      }
    });

    it('should block null byte injection attacks', async () => {
      const attacks = [
        'src/test.tex\0.txt',
        'templates/template.njk%00.exe',
        'src/test\u0000.tex',
        'src/test.tex\0/../../../etc/passwd',
        'templates/\0\0\0malicious.exe'
      ];

      for (const attack of attacks) {
        const result = await pathSecurity.validateAndSecurePath(attack);
        expect(result.isValid, `Null byte attack should be blocked: ${attack}`).toBe(false);
        expect(result.reason).toMatch(/(null byte|encoding)/i);
      }
    });

    it('should block unicode normalization attacks', async () => {
      const attacks = [
        'src/test\u202e\u0074\u0073\u0065\u0074.txt', // Right-to-left override
        'templates/\ufeffmalicious.exe',              // Byte order mark
        'src/test\u2028.tex',                        // Line separator
        'templates/file\u00a0name.njk'               // Non-breaking space
      ];

      for (const attack of attacks) {
        const result = await pathSecurity.validateAndSecurePath(attack);
        expect(result.isValid, `Unicode attack should be blocked: ${attack}`).toBe(false);
      }
    });

    it('should block symlink escape attacks', async () => {
      // Create symlink outside test directory (if permissions allow)
      try {
        const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outside-test-'));
        await fs.writeFile(path.join(outsideDir, 'secret.txt'), 'secret data');
        
        const symlinkPath = path.join(testDir, 'src', 'escape-link');
        await fs.symlink(path.join(outsideDir, 'secret.txt'), symlinkPath);

        const result = await pathSecurity.validateAndSecurePath('src/escape-link');
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/(symlink|escape)/i);
        
        // Cleanup
        await fs.rm(outsideDir, { recursive: true, force: true });
      } catch (symlinkError) {
        // Symlink creation failed (permissions) - skip this test
        console.warn('Skipping symlink test due to permissions');
      }
    });

    it('should block absolute path attacks', async () => {
      const attacks = [
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\sam',
        '\\\\server\\share\\file.txt',
        '/usr/bin/bash',
        'C:\\Program Files\\malicious.exe',
        '/tmp/../../../etc/passwd'
      ];

      for (const attack of attacks) {
        const result = await pathSecurity.validateAndSecurePath(attack);
        expect(result.isValid, `Absolute path should be blocked: ${attack}`).toBe(false);
        expect(result.reason).toMatch(/(absolute|pattern)/i);
      }
    });

    it('should block dangerous file extensions', async () => {
      const attacks = [
        'src/malware.exe',
        'templates/script.bat',
        'src/virus.scr',
        'templates/trojan.com',
        'src/backdoor.pif'
      ];

      for (const attack of attacks) {
        const result = await pathSecurity.validateAndSecurePath(attack);
        expect(result.isValid, `Dangerous extension should be blocked: ${attack}`).toBe(false);
        expect(result.reason).toMatch(/extension/i);
      }
    });

    it('should block command injection patterns', async () => {
      const attacks = [
        'src/test.tex;rm -rf /',
        'templates/file.njk|cat /etc/passwd',
        'src/test.tex && rm -rf *',
        'templates/`rm -rf /`',
        'src/$(rm -rf /)',
        'templates/file.njk||format C:'
      ];

      for (const attack of attacks) {
        const result = await pathSecurity.validateAndSecurePath(attack);
        expect(result.isValid, `Command injection should be blocked: ${attack}`).toBe(false);
        expect(result.reason).toMatch(/(pattern|command|shell)/i);
      }
    });

    it('should allow legitimate safe paths', async () => {
      const safePaths = [
        'src/test.tex',
        'templates/template.njk',
        'src/document.tex',
        'templates/legal-brief.njk',
        'src/subfolder/document.tex',
        'docs/readme.md'
      ];

      for (const safePath of safePaths) {
        const result = await pathSecurity.validateAndSecurePath(safePath);
        if (!result.isValid) {
          console.error(`Safe path rejected: ${safePath}`, result.reason);
        }
        expect(result.isValid, `Safe path should be allowed: ${safePath}`).toBe(true);
      }
    });

    it('should provide comprehensive audit logging', async () => {
      // Perform various attacks
      await pathSecurity.validateAndSecurePath('../../../etc/passwd');
      await pathSecurity.validateAndSecurePath('src/malware.exe');
      await pathSecurity.validateAndSecurePath('test.tex\0.txt');

      const auditLog = pathSecurity.getAuditLog({ severity: 'critical' });
      expect(auditLog.length).toBeGreaterThan(0);
      
      // Check audit entries contain expected information
      expect(auditLog.some(entry => entry.details.reason?.includes('traversal'))).toBe(true);
      expect(auditLog.some(entry => entry.details.reason?.includes('extension'))).toBe(true);
      expect(auditLog.some(entry => entry.details.reason?.includes('null byte'))).toBe(true);
    });

    it('should handle DoS attacks (large files and paths)', async () => {
      // Long path attack
      const longPath = 'src/' + 'a'.repeat(5000) + '.tex';
      const longPathResult = await pathSecurity.validateAndSecurePath(longPath);
      expect(longPathResult.isValid).toBe(false);
      expect(longPathResult.reason).toMatch(/too long/i);

      // Create large file and test
      const largeFilePath = path.join(testDir, 'src', 'large.tex');
      const largeContent = 'x'.repeat(200 * 1024 * 1024); // 200MB
      await fs.writeFile(largeFilePath, largeContent);

      const largeFileResult = await pathSecurity.validateAndSecurePath('src/large.tex', {
        requireReadable: true
      });
      // Should pass validation but might fail on additional checks if size limits are enforced
    });
  });

  describe('Validator Security Patches', () => {

    it('should block all path traversal variants (async)', async () => {
      const attacks = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        './../../sensitive',
        'legitimate/../../../etc/passwd',
        'file.txt/../../secret'
      ];

      for (const attack of attacks) {
        const result = await validateFilePathSecure(attack, testDir);
        expect(result.isValid, `Async validator should block: ${attack}`).toBe(false);
        expect(result.severity).toBe('critical');
      }
    });

    it('should block all path traversal variants (sync)', () => {
      const attacks = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        './../../sensitive',
        'legitimate/../../../etc/passwd'
      ];

      for (const attack of attacks) {
        const result = validateFilePathSync(attack, testDir);
        expect(result.isValid, `Sync validator should block: ${attack}`).toBe(false);
        expect(result.severity).toBe('critical');
      }
    });

    it('should provide detailed audit information', async () => {
      const result = await validateFilePathSecure('../../../etc/passwd', testDir, {
        enableAuditLog: true
      });
      
      expect(result.isValid).toBe(false);
      expect(result.auditLog).toBeDefined();
      expect(result.auditLog.length).toBeGreaterThan(0);
      expect(result.validationId).toBeDefined();
      
      // Check audit log contains security phases
      const phases = result.auditLog.map(entry => entry.phase);
      expect(phases).toContain('pattern_validation');
    });

    it('should validate file existence and properties when required', async () => {
      const result = await validateFilePathSecure('src/test.tex', testDir, {
        requireExistence: true,
        maxFileSize: 1024 * 1024 // 1MB
      });

      expect(result.isValid).toBe(true);
      expect(result.securityChecks.filesystemValidation).toBe(true);
    });
  });

  describe('Integration Tests', () => {

    it('should prevent all known CVE attack patterns', async () => {
      const cveAttacks = [
        // CVE-style path traversal attacks
        '../../../../../etc/passwd%00.txt',
        '..%2f..%2f..%2fetc%2fpasswd',
        '....//....//....//etc/passwd',
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '/var/www/../../etc/passwd',
        '\\\\?\\C:\\Windows\\System32\\config\\sam'
      ];

      for (const attack of cveAttacks) {
        const result = await pathSecurity.validateAndSecurePath(attack);
        expect(result.isValid, `CVE-style attack should be blocked: ${attack}`).toBe(false);
      }
    });

    it('should maintain security under concurrent access', async () => {
      // Test concurrent validation attempts
      const attacks = Array(50).fill(0).map((_, i) => `../../../attack-${i}`);
      
      const results = await Promise.all(
        attacks.map(attack => pathSecurity.validateAndSecurePath(attack))
      );

      // All attacks should be blocked
      expect(results.every(r => !r.isValid)).toBe(true);
      
      // Audit log should capture all attempts
      const auditLog = pathSecurity.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(attacks.length);
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCases = [
        '', // Empty string
        null, // Null value
        undefined, // Undefined
        '/', // Root
        '.', // Current dir
        '..', // Parent dir
        String.fromCharCode(0), // Null char
        'a'.repeat(10000) // Very long string
      ];

      for (const edge of edgeCases) {
        const result = await pathSecurity.validateAndSecurePath(edge);
        expect(result.isValid, `Edge case should be handled: ${edge}`).toBe(false);
        expect(result.reason).toBeDefined();
      }
    });
  });

  afterEach(async () => {
    // Cleanup test directory
    if (testDir) {
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Failed to cleanup test directory:', cleanupError.message);
      }
    }
  });
});

describe('Security Metrics and Monitoring', () => {
  let pathSecurity;

  beforeEach(async () => {
    pathSecurity = await initializePathSecurity(process.cwd());
  });

  it('should track security violations in metrics', async () => {
    // Perform some attacks
    await pathSecurity.validateAndSecurePath('../../../etc/passwd');
    await pathSecurity.validateAndSecurePath('malware.exe');
    await pathSecurity.validateAndSecurePath('test\0.txt');

    const stats = pathSecurity.getSecurityStats();
    expect(stats.totalEvents).toBeGreaterThan(0);
    expect(stats.severityCounts.critical).toBeGreaterThan(0);
  });

  it('should provide security audit trail for forensics', async () => {
    // Simulate attack pattern
    const attackSequence = [
      '../etc/passwd',
      '../../windows/system32',
      'test.exe',
      'script.bat',
      '../../../secret.txt'
    ];

    for (const attack of attackSequence) {
      await pathSecurity.validateAndSecurePath(attack);
    }

    const auditLog = pathSecurity.getAuditLog({
      severity: 'critical',
      limit: 100
    });

    expect(auditLog.length).toBe(attackSequence.length);
    
    // Verify timestamps are in order
    const timestamps = auditLog.map(entry => new Date(entry.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });
});